#include "spectrumserver.h"
#include "samplereader.h"

#include <cstdio>
#include <iostream>
#include <random>
#include <shared_mutex>
#include <thread>
#include <boost/algorithm/string.hpp>
#include <toml++/toml.h>
#include <cstdlib> // For rand() and srand()
#include <ctime>   // For time()
#include <sstream> // For std::stringstream
#include <iostream> // For std::cout
#include <curl/curl.h> // For cURL functionality
#include "glaze/glaze.hpp"
#include <nlohmann/json.hpp>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
#include <cerrno>
#include <cstring>


toml::table config;
nlohmann::json markers;
// FIX: Protect the `markers` global against concurrent read (HTTP/websocket
// handler threads) vs write (marker_update_thread) data race.
std::shared_mutex markers_mutex;

void broadcast_server::check_and_update_markers() {
    while (marker_update_running) {
        

        std::string marker_file = "markers.json";
        std::ifstream file(marker_file);
        if (file.is_open()) {
            nlohmann::json new_markers;
            try {
                file >> new_markers;
                file.close();

                // FIX: Exclusive lock for write
                std::unique_lock lk(markers_mutex);
                if (new_markers != markers) {
                    std::cout << "Markers updated." << std::endl;
                    markers = new_markers;
                }
            } catch (nlohmann::json::parse_error& e) {
                std::cerr << "Error parsing marker.json: " << e.what() << std::endl;
            }
        } else {
            std::cerr << "Unable to open marker.json file." << std::endl;
        }
        std::this_thread::sleep_for(std::chrono::minutes(1));
    }
}

void broadcast_server::cleanup_dead_connections() {
    // Clean up signal connections
    {
        std::scoped_lock lg(signal_slice_mtx);
        for (auto it = signal_slices.begin(); it != signal_slices.end();) {
            try {
                auto con = m_server.get_con_from_hdl(it->second->hdl);
                if (!con || con->get_state() != websocketpp::session::state::open) {
                    it = signal_slices.erase(it);
                    continue;
                }
            } catch (...) {
                it = signal_slices.erase(it);
                continue;
            }
            ++it;
        }
    }

    // Clean up waterfall connections
    for (int i = 0; i < downsample_levels; i++) {
        std::scoped_lock lg(waterfall_slice_mtx[i]);
        for (auto it = waterfall_slices[i].begin(); it != waterfall_slices[i].end();) {
            try {
                auto con = m_server.get_con_from_hdl(it->second->hdl);
                if (!con || con->get_state() != websocketpp::session::state::open) {
                    it = waterfall_slices[i].erase(it);
                    continue;
                }
            } catch (...) {
                it = waterfall_slices[i].erase(it);
                continue;
            }
            ++it;
        }
    }

    // Clean up event connections
    // Mutex protection for events_connections
    {
        std::scoped_lock lg(events_connections_mtx);
        for (auto it = events_connections.begin(); it != events_connections.end();) {
            try {
                auto con = m_server.get_con_from_hdl(*it);
                if (!con || con->get_state() != websocketpp::session::state::open) {
                    it = events_connections.erase(it);
                    continue;
                }
            } catch (...) {
                it = events_connections.erase(it);
                continue;
            }
            ++it;
        }
    }
}

broadcast_server::broadcast_server(
    std::unique_ptr<SampleConverterBase> reader, toml::parse_result &config)
    : reader{std::move(reader)}, frame_num{0}, marker_update_running(false), websdr_running(false) {  // FIXED: Initialize websdr_running

    // Must be called once before any thread calls curl_easy_init().
    // Without this, curl_easy_init() has undefined behaviour and silently
    // returns null — all geo lookups fail with no error message.
    curl_global_init(CURL_GLOBAL_DEFAULT);

    server_threads = config["server"]["threads"].value_or(1);

    // Read in configuration
    std::optional<int> sps_config = config["input"]["sps"].value<int>();
    if (!sps_config.has_value()) {
        throw std::runtime_error("Missing sample rate");
    }
    sps = sps_config.value();

    std::optional<int64_t> frequency =
        config["input"]["frequency"].value<int64_t>();
    if (!frequency.has_value()) {
        throw std::runtime_error("Missing frequency");
    }

    std::string accelerator_str =
        config["input"]["accelerator"].value_or("none");

    fft_threads = config["input"]["fft_threads"].value_or(1);

    std::optional<std::string> signal_type =
        config["input"]["signal"].value<std::string>();
    std::string signal_type_str =
        signal_type.has_value()
            ? boost::algorithm::to_lower_copy(signal_type.value())
            : "";
    if (!signal_type.has_value() ||
        (signal_type_str != "real" && signal_type_str != "iq")) {
        throw std::runtime_error("Invalid signal type, specify either real or IQ input");
    }

    is_real = signal_type_str == "real";

    fft_size = config["input"]["fft_size"].value_or(131072);
    audio_max_sps = config["input"]["audio_sps"].value_or(12000);
    min_waterfall_fft = config["input"]["waterfall_size"].value_or(1024);
    brightness_offset = config["input"]["brightness_offset"].value_or(0);
    show_other_users = config["server"]["otherusers"].value_or(1) > 0;

    // FIX (uninitialized basefreq): default_frequency previously used
    // value_or(basefreq) at this point, but basefreq was not yet assigned —
    // it is only set in the is_real block below.  Moved to after that block.
    int64_t default_frequency_raw =
        config["input"]["defaults"]["frequency"].value<int64_t>().value_or(-1LL);
    default_mode_str = boost::algorithm::to_upper_copy<std::string>(
        config["input"]["defaults"]["modulation"].value_or("USB"));

    waterfall_compression_str =
        config["input"]["waterfall_compression"].value_or("zstd");
    audio_compression_str =
        config["input"]["audio_compression"].value_or("flac");

    m_docroot = config["server"]["html_root"].value_or("html/");

    limit_audio = config["limits"]["audio"].value_or(1000);
    limit_waterfall = config["limits"]["waterfall"].value_or(1000);
    limit_events = config["limits"]["events"].value_or(1000);

    // Set the parameters correct for real and IQ input
    // For IQ signal Leftmost frequency of IQ signal needs to be shifted left by
    // the sample rate
    if (is_real) {
        fft_result_size = fft_size / 2;
        basefreq = frequency.value();
    } else {
        fft_result_size = fft_size;
        basefreq = frequency.value() - sps / 2;
    }

    // Now basefreq is valid: resolve the default frequency.
    // -1 (or absent from config) means "use centre of the band".
    default_frequency = (default_frequency_raw == -1LL)
                            ? basefreq + sps / 2
                            : default_frequency_raw;

    if (is_real) {
        default_m =
            (double)(default_frequency - basefreq) * fft_result_size * 2 / sps;
    } else {
        default_m =
            (double)(default_frequency - basefreq) * fft_result_size / sps;
    }

    int offsets_3 = (3000LL) * fft_result_size / sps;
    int offsets_4 = (4500LL) * fft_result_size / sps;
    int offsets_5 = (5000LL) * fft_result_size / sps;
    int offsets_96 = (96000LL) * fft_result_size / sps;

    if (default_mode_str == "LSB") {
        default_mode = LSB;
        default_l = default_m - offsets_3;
        default_r = default_m;
    } else if (default_mode_str == "AM") {
        default_mode = AM;
        default_l = default_m - offsets_4;
        default_r = default_m + offsets_4;
    } else if (default_mode_str == "FM") {
        default_mode = FM;
        default_l = default_m - offsets_5;
        default_r = default_m + offsets_5;
    } else if (default_mode_str == "WBFM") {
        default_mode = FM;
        default_l = default_m - offsets_96;
        default_r = default_m + offsets_96;
    } else {
        default_mode = USB;
        default_l = default_m;
        default_r = default_m + offsets_3;
    }

    default_m = std::max(0., std::min((double)fft_result_size, default_m));
    default_l = std::max(0, std::min(fft_result_size, default_l));
    default_r = std::max(0, std::min(fft_result_size, default_r));

    audio_max_fft_size = ceil((double)audio_max_sps * fft_size / sps / 4.) * 4;

    if (waterfall_compression_str == "zstd") {
        waterfall_compression = WATERFALL_ZSTD;
    } else if (waterfall_compression_str == "av1") {
#ifdef HAS_LIBAOM
        waterfall_compression = WATERFALL_AV1;
#else
        throw std::runtime_error("AV1 support not compiled in");
#endif
    }

    if (audio_compression_str == "flac") {
    audio_compression = AUDIO_FLAC;
} else if (audio_compression_str == "opus") {
#ifdef HAS_LIBOPUS
    audio_compression = AUDIO_OPUS;
#else
    throw std::runtime_error("Opus support not compiled in");
#endif
}


    fft_accelerator accelerator = CPU_FFTW;
    if (accelerator_str == "cuda") {
        accelerator = GPU_cuFFT;
        std::cout << "Using CUDA" << std::endl;
    } else if (accelerator_str == "opencl") {
        accelerator = GPU_clFFT;
        std::cout << "Using OpenCL" << std::endl;
    } else if (accelerator_str == "mkl") {
        accelerator = CPU_mklFFT;
        std::cout << "Using MKL" << std::endl;
    }

    // Calculate number of downsampling levels for fft
    downsample_levels = 0;
    for (int cur_fft = fft_result_size; cur_fft >= min_waterfall_fft;
         cur_fft /= 2) {
        downsample_levels++;
    }

    if (accelerator == GPU_cuFFT) {
#ifdef CUFFT
        fft = std::make_unique<cuFFT>(fft_size, fft_threads, downsample_levels, brightness_offset);
#else
        throw std::runtime_error("CUDA support is not compiled in");
#endif
    } else if (accelerator == GPU_clFFT) {
#ifdef CLFFT
        fft = std::make_unique<clFFT>(fft_size, fft_threads, downsample_levels, brightness_offset);
#else
        throw std::runtime_error("OpenCL support is not compiled in");
#endif
    } else if (accelerator == CPU_mklFFT) {
#ifdef MKL
        fft =
            std::make_unique<mklFFT>(fft_size, fft_threads, downsample_levels, brightness_offset);
#else
        throw std::runtime_error("MKL support is not compiled in");
#endif
    } else {
        fft = std::make_unique<FFTW>(fft_size, fft_threads, downsample_levels, brightness_offset);
    }
    fft->set_output_additional_size(audio_max_fft_size);

    // Initialize the websocket server
    m_server.init_asio();
    // websdr.org may keep inbound callback TCP idle before sending GET /~~orgstatus.
    // Default websocketpp handshake timeout is too short for that behavior.
    m_server.set_open_handshake_timeout(600000);

    // Suppress noisy EOF and handshake errors globally
    init_server();
    
    m_server.clear_access_channels(websocketpp::log::alevel::frame_header |
                                   websocketpp::log::alevel::frame_payload);

    m_server.set_open_handler(
        std::bind(&broadcast_server::on_open, this, std::placeholders::_1));
    m_server.set_http_handler(
        std::bind(&broadcast_server::on_http, this, std::placeholders::_1));

    // Init data structures
    waterfall_slices.resize(downsample_levels);
    waterfall_slice_mtx.resize(downsample_levels);

 
    
}

void broadcast_server::run(uint16_t port) {
    // Start the threads and handle the network
    running = true;
    marker_update_running = true;
    marker_update_thread = std::thread(&broadcast_server::check_and_update_markers, this);
    m_server.set_listen_backlog(8192);
    m_server.set_reuse_addr(true);
    try {
        m_server.listen(port);
    } catch (...) { // Listen on IPv4 only if IPv6 is not supported
        m_server.listen(websocketpp::lib::asio::ip::tcp::v4(), port);
    }
    m_server.start_accept();
    fft_thread = std::thread(&broadcast_server::fft_task, this);

    set_event_timer();

    // FIX (async-signal-safety): std::signal() with a handler calling join(),
    // mutex::lock() etc. is undefined behaviour per POSIX.  Use boost::asio's
    // signal_set instead: the handler is delivered as a normal asio completion
    // on the io_service thread pool, where it is safe to call stop().
    boost::asio::signal_set signals(m_server.get_io_service(), SIGINT, SIGTERM);
    signals.async_wait([this](const boost::system::error_code &ec, int /*signum*/) {
        if (!ec) stop();
    });
    std::vector<std::thread> threads;
    // Spawn one less thread, use main thread as well
    for (int i = 0; i < server_threads - 1; i++) {
        threads.emplace_back(std::thread([&] { m_server.run(); }));
    }
    m_server.run();
    for (int i = 0; i < server_threads - 1; i++) {
        threads[i].join();
    }
    // FIX (double join): stop() also joins fft_thread (called from the asio
    // signal handler).  If stop() runs first, fft_thread is no longer joinable
    // here and calling join() on it would throw std::system_error / terminate.
    if (fft_thread.joinable()) {
        fft_thread.join();
    }
}

// FIXED: Added method to start websdr updates thread
void broadcast_server::start_websdr_updates() {
    websdr_running = true;
    websdr_thread = std::thread(&broadcast_server::update_websdr_list, this);

    // Also start WebSDR.org registration if [websdr.org] enabled = true
    const auto* org_cfg = config["websdr"]["org"].as_table();
    if (org_cfg && (*org_cfg)["enabled"].value_or(false)) {
        websdr_org_running_ = true;
        websdr_org_thread_ = std::thread(&broadcast_server::update_websdr_org, this);
    }
}

// To register on http://sdr-list.xyz
void broadcast_server::update_websdr_list() {
    // Seed the random number generator
    std::srand(std::time(nullptr));

    int port = config["server"]["port"].value_or(9002);
    std::optional<int64_t> center_frequency = config["input"]["frequency"].value<int64_t>();
    std::optional<int64_t> bandwidth = config["input"]["sps"].value<int64_t>();
    std::string antenna = config["websdr"]["antenna"].value_or("N/A");
    std::string grid_locator = config["websdr"]["grid_locator"].value_or("-");
    std::string hostname = config["websdr"]["hostname"].value_or("");
    std::string websdr_name = config["websdr"]["name"].value_or("WebSDR_" + std::to_string(std::rand()));
    std::string signal_type = config["input"]["signal"].value_or("real");
    std::optional<int64_t> max_users = config["limits"]["audio"].value<int64_t>();

    std::vector<std::string> register_urls;
    if (auto *url_array = config["websdr"]["register_urls"].as_array()) {
        for (const auto &node : *url_array) {
            if (auto url = node.value<std::string>()) {
                if (!url->empty()) {
                    register_urls.push_back(*url);
                }
            }
        }
    }
    if (register_urls.empty()) {
        register_urls.emplace_back("https://sdr-list.xyz/api/update_websdr");
    }

    std::string websdr_id = std::to_string(std::rand());
    if(signal_type == "real")
    {
        bandwidth = bandwidth.value_or(30000000) / 2;
    }

    if(center_frequency.value_or(15000000) == 0){
        center_frequency = bandwidth.value_or(30000000) / 2;

    }

    // Initialize cURL outside the loop
    CURL *curl = curl_easy_init();
    CURLcode res;
    if (!curl) {
        std::cerr << "Failed to initialize cURL" << std::endl;
        return; // Or handle the error appropriately
    }

    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_VERBOSE, 0L);

    FILE *devnull = fopen("/dev/null", "w+");
    if (!devnull) {
        std::cerr << "Failed to open /dev/null" << std::endl;
        curl_easy_cleanup(curl);
        return; // Or handle the error appropriately
    }
    
    // FIXED: Changed from while(true) to while(websdr_running)
    while(websdr_running) {
        // FIXED: Added mutex protection for events_connections access
        int user_count;
        {
            std::scoped_lock lg(events_connections_mtx);
            user_count = static_cast<int>(events_connections.size());
        }

        // Construct JSON payload manually
        glz::json_t json_data = {
            {"id", websdr_id},
            {"name", websdr_name},
            {"antenna", antenna},
            {"bandwidth", bandwidth.value_or(30000000)},
            {"users", user_count},
            {"center_frequency", center_frequency.value_or(15000000)},
            {"grid_locator", grid_locator},
            {"hostname", hostname},
            {"max_users", max_users.value_or(100)},
            {"port", port}
        };

        std::string serialized_json = glz::write_json(json_data);

       
        if(curl) {
            // Dont print to stdout
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, devnull);

            // Set the JSON data once per update cycle
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, serialized_json.c_str());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(serialized_json.length()));

            for (const auto &register_url : register_urls) {
                curl_easy_setopt(curl, CURLOPT_URL, register_url.c_str());

                // Let libcurl generate the correct Host header from the URL.
                struct curl_slist *headers = NULL;
                struct curl_slist *tmp = curl_slist_append(headers, "Content-Type: application/json");
                if (!tmp) {
                    std::cerr << "curl_slist_append OOM" << std::endl;
                    continue;
                }
                headers = tmp;
                curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

                res = curl_easy_perform(curl);

                if (res != CURLE_OK) {
                    std::cerr << "curl_easy_perform() failed for "
                              << register_url << ": "
                              << curl_easy_strerror(res) << std::endl;
                }

                curl_slist_free_all(headers);
                curl_easy_setopt(curl, CURLOPT_HTTPHEADER, nullptr);
            }
        }

        // Delay for 10 seconds before sending the next request
        std::this_thread::sleep_for(std::chrono::seconds(10));
    }
    
    // FIXED: Cleanup code is now reachable
    curl_easy_cleanup(curl);
    fclose(devnull);
}


void broadcast_server::stop() {
    running = false;
    marker_update_running = false;
    websdr_running = false;  // FIXED: Signal websdr thread to stop
    websdr_org_running_ = false;
    fft_processed.notify_all();

    // FIXED: Join fft_thread before cleanup
    if (fft_thread.joinable()) {
        fft_thread.join();
    }

    // FIXED: Join websdr_thread before cleanup
    if (websdr_thread.joinable()) {
        websdr_thread.join();
    }

    if (websdr_org_thread_.joinable()) {
        websdr_org_thread_.join();
    }

    if (marker_update_thread.joinable()) {
        marker_update_thread.join();
    }

    m_server.stop_listening();
    for (auto &[slice, data] : signal_slices) {
        websocketpp::lib::error_code ec;
        try {
            m_server.close(data->hdl, websocketpp::close::status::going_away,
                           "", ec);
        } catch (...) {
        }
    }
    for (auto &waterfall_slice : waterfall_slices) {
        for (auto &[slice, data] : waterfall_slice) {
            websocketpp::lib::error_code ec;
            try {
                m_server.close(data->hdl,
                               websocketpp::close::status::going_away, "", ec);
            } catch (...) {
            }
        }
    }
    
    // FIXED: Added mutex protection for events_connections iteration
    {
        std::scoped_lock lg(events_connections_mtx);
        for (auto &it : events_connections) {
            websocketpp::lib::error_code ec;
            try {
                m_server.close(it, websocketpp::close::status::going_away, "", ec);
            } catch (...) {
            }
        }
    }
}



// Previously used for the std::signal() SIGINT handler (now replaced by
// boost::asio::signal_set inside broadcast_server::run()).  Kept to avoid
// breaking any external debugger scripts that might reference this symbol.
broadcast_server *g_signal;

void broadcast_server::update_websdr_org() {
    const toml::table* org_cfg = nullptr;
    if (auto ws = config["websdr"].as_table()) {
        if (auto org = (*ws)["org"].as_table()) {
            org_cfg = org;
        }
    }
    if (!org_cfg || !(*org_cfg)["enabled"].value_or(false)) {
        std::cout << "[WebSDROrg] disabled ([websdr.org] enabled=true to enable)" << std::endl;
        return;
    }

    std::string public_host = (*org_cfg)["public_host"].value_or(std::string(""));
    int public_port         = static_cast<int>((*org_cfg)["public_port"].value_or(int64_t(9002)));
    std::string qth         = (*org_cfg)["qth"].value_or(std::string(""));
    std::string description = (*org_cfg)["description"].value_or(std::string(""));
    std::string logo        = (*org_cfg)["logo"].value_or(std::string("vlag-nl-48.jpg"));
    std::string email_raw   = (*org_cfg)["email"].value_or(std::string(""));

    if (public_host.empty()) {
        std::cerr << "[WebSDROrg] public_host missing in [websdr.org]" << std::endl;
        return;
    }

    uint32_t cfg_serial = static_cast<uint32_t>(time(nullptr) & 0x7FFFFFFFu);
    char cookie_buf[32];
    snprintf(cookie_buf, sizeof(cookie_buf), "%08x0000", cfg_serial);

    std::string email_obf;
    for (unsigned char c : email_raw) email_obf += static_cast<char>(c ^ 1u);

    std::vector<WebsdrOrgState::Band> bands;
    {
        int64_t bw_hz = is_real ? (sps / 2) : sps;
        int64_t center_hz = basefreq + (bw_hz / 2);
        std::string antenna = config["websdr"]["antenna"].value_or(std::string("N/A"));
        std::string name = config["websdr"]["name"].value_or(std::string("RX1"));
        std::string label = antenna.empty() ? name : (antenna + ". " + name);
        bands.push_back({center_hz / 1000.0, bw_hz / 1000.0, label});
    }

    {
        std::scoped_lock lk(websdr_org_state_mtx_);
        websdr_org_state_.enabled     = true;
        websdr_org_state_.cfg_serial  = cfg_serial;
        websdr_org_state_.cookie_id   = std::string(cookie_buf);
        websdr_org_state_.email_obf   = email_obf;
        websdr_org_state_.qth         = qth;
        websdr_org_state_.description = description;
        websdr_org_state_.logo        = logo;
        websdr_org_state_.bands       = bands;
    }

    std::cout << "[WebSDROrg] Starting (host=" << public_host
              << " port=" << public_port
              << " bands=" << bands.size() << ")" << std::endl;

    const std::string org_host = "websdr.ewi.utwente.nl";
    const std::string req = "GET /~~websdrorg?host=" + public_host +
                            "&port=" + std::to_string(public_port) +
                            " HTTP/1.1\r\nHost: " + org_host + "\r\n\r\n";

    auto interruptible_sleep = [&](int seconds) {
        for (int i = 0; i < seconds && websdr_org_running_; ++i)
            std::this_thread::sleep_for(std::chrono::seconds(1));
    };

    int attempt = 0;
    int fd = -1;
    while (websdr_org_running_) {
        if (fd < 0) {
            struct addrinfo hints{}, *res = nullptr;
            hints.ai_family = AF_UNSPEC;
            hints.ai_socktype = SOCK_STREAM;
            if (getaddrinfo(org_host.c_str(), "80", &hints, &res) == 0) {
                for (auto* rp = res; rp; rp = rp->ai_next) {
                    char ipbuf[NI_MAXHOST] = {0};
                    char portbuf[NI_MAXSERV] = {0};
                    getnameinfo(rp->ai_addr, rp->ai_addrlen, ipbuf, sizeof(ipbuf),
                                portbuf, sizeof(portbuf), NI_NUMERICHOST | NI_NUMERICSERV);
                    std::cout << "[WebSDROrg] Connect try -> " << ipbuf << ":" << portbuf << std::endl;

                    fd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
                    if (fd < 0) {
                        std::cerr << "[WebSDROrg] socket() failed: " << strerror(errno) << std::endl;
                        continue;
                    }

                    int flags = fcntl(fd, F_GETFL, 0);
                    if (flags >= 0) {
                        fcntl(fd, F_SETFL, flags | O_NONBLOCK);
                    }
                    struct timeval tv{15, 0};
                    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
                    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

                    if (connect(fd, rp->ai_addr, rp->ai_addrlen) == 0) {
                        if (flags >= 0) fcntl(fd, F_SETFL, flags);
                        std::cout << "[WebSDROrg] Connected to " << ipbuf << std::endl;
                        break;
                    }

                    if (errno == EINPROGRESS) {
                        struct pollfd pfd{};
                        pfd.fd = fd;
                        pfd.events = POLLOUT;
                        int pr = poll(&pfd, 1, 15000);
                        if (pr > 0 && (pfd.revents & POLLOUT)) {
                            int so_error = 0;
                            socklen_t slen = sizeof(so_error);
                            getsockopt(fd, SOL_SOCKET, SO_ERROR, &so_error, &slen);
                            if (so_error == 0) {
                                if (flags >= 0) fcntl(fd, F_SETFL, flags);
                                std::cout << "[WebSDROrg] Connected to " << ipbuf << std::endl;
                                break;
                            }
                            std::cerr << "[WebSDROrg] Connect failed to " << ipbuf
                                      << ": " << strerror(so_error) << std::endl;
                        } else if (pr == 0) {
                            std::cerr << "[WebSDROrg] Connect timeout to " << ipbuf << std::endl;
                        } else {
                            std::cerr << "[WebSDROrg] poll() failed while connecting to " << ipbuf
                                      << ": " << strerror(errno) << std::endl;
                        }
                    } else {
                        std::cerr << "[WebSDROrg] Connect failed to " << ipbuf
                                  << ": " << strerror(errno) << std::endl;
                    }

                    close(fd);
                    fd = -1;
                }
                freeaddrinfo(res);
            } else {
                std::cerr << "[WebSDROrg] DNS resolve failed for " << org_host << std::endl;
            }

            if (fd < 0) {
                websdr_org_last_ok_.store(false);
                std::cerr << "[WebSDROrg] Connect failed, retry in 30s" << std::endl;
                interruptible_sleep(30);
                continue;
            }
            std::cout << "[WebSDROrg] Connected to " << org_host << std::endl;
        }

        std::cout << "[WebSDROrg] Sending registration ping #" << (attempt + 1) << std::endl;
        if (send(fd, req.c_str(), req.size(), MSG_NOSIGNAL) < 0) {
            std::cerr << "[WebSDROrg] Send failed, reconnecting: " << strerror(errno) << std::endl;
            close(fd);
            fd = -1;
            websdr_org_last_ok_.store(false);
            interruptible_sleep(30);
            continue;
        }
        ++attempt;
        std::cout << "[WebSDROrg] Waiting response for ping #" << attempt << std::endl;

        char rbuf[256];
        rbuf[0] = '\0';
        ssize_t n = recv(fd, rbuf, sizeof(rbuf) - 1, 0);
        if (n > 0) {
            rbuf[n] = '\0';
            std::string s(rbuf);
            size_t nl = s.find('\r');
            std::cout << "[WebSDROrg] #" << attempt
                      << " OK — " << (nl != std::string::npos ? s.substr(0, nl) : s)
                      << std::endl;
            websdr_org_last_ok_.store(true);
        } else if (n == 0) {
            std::cerr << "[WebSDROrg] Remote closed connection, reconnecting" << std::endl;
            close(fd);
            fd = -1;
            websdr_org_last_ok_.store(false);
            interruptible_sleep(30);
            continue;
        } else {
            std::cerr << "[WebSDROrg] Receive failed: " << strerror(errno)
                      << " (reconnecting)" << std::endl;
            close(fd);
            fd = -1;
            websdr_org_last_ok_.store(false);
            interruptible_sleep(30);
            continue;
        }
        interruptible_sleep(60);
    }

    if (fd >= 0) close(fd);
    std::cout << "[WebSDROrg] thread stopped" << std::endl;
}

int main(int argc, char **argv) {
    // Parse the options
    std::string config_file;
    for (int i = 1; i < argc; i++) {
        if ((std::string(argv[i]) == "-c" ||
             std::string(argv[i]) == "--config") &&
            i + 1 < argc) {
            config_file = argv[i + 1];
            i++;
        }
        if (std::string(argv[i]) == "-h" || std::string(argv[i]) == "--help") {
            std::cout
                << "Options:\n"
                   "--help                             produce help message\n"
                   "-c [ --config ] arg (=config.toml) config file\n";
            return 0;
        }
    }

    std::cout << "\r\n __                   __ __  __      \r\n|__)|_  _  _ |_ _  _ (_ |  \\|__) _|_ \r\n|   | )(_|| )|_(_)|||__)|__/| \\   |  \r\n                                     " << std::endl;
    std::cout << "Thank you for using PhantomSDR+, you are supporting the Development of an Open-Source WebSDR Project ♥" << std::endl;

    config = toml::parse_file(config_file);

    std::string host = config["server"]["host"].value_or("0.0.0.0");

    std::optional<std::string> driver_type =
        config["input"]["driver"]["name"].value<std::string>();
    if (!driver_type.has_value()) {
        std::cout << "Specify an input driver" << std::endl;
        return 0;
    }
    std::string driver_str = driver_type.value();

    std::string input_format =
        config["input"]["driver"]["format"].value_or("f32");
    boost::algorithm::to_lower(input_format);

    // Initialise FFT threads if requested for multithreaded
    int fft_threads = config["input"]["fft_threads"].value_or(1);
    if (fft_threads > 1) {
        fftwf_init_threads();
    }

    // Set input to binary
    freopen(NULL, "rb", stdin);
    std::unique_ptr<SampleReader> reader =
        std::make_unique<FileSampleReader>(stdin);
    std::unique_ptr<SampleConverterBase> driver;

    if (input_format == "u8") {
        driver = std::make_unique<SampleConverter<uint8_t>>(std::move(reader));
    } else if (input_format == "s8") {
        driver = std::make_unique<SampleConverter<int8_t>>(std::move(reader));
    } else if (input_format == "u16") {
        driver = std::make_unique<SampleConverter<uint16_t>>(std::move(reader));
    } else if (input_format == "s16") {
        driver = std::make_unique<SampleConverter<int16_t>>(std::move(reader));
    } else if (input_format == "f32") {
        driver = std::make_unique<SampleConverter<float>>(std::move(reader));
    } else if (input_format == "f64") {
        driver = std::make_unique<SampleConverter<double>>(std::move(reader));
    } else {
        std::cout << "Unknown input format: " << input_format << std::endl;
        return 1;
    }


    int port = config["server"]["port"].value_or(9002);
    bool register_online = config["websdr"]["register_online"].value_or(false);
    broadcast_server server(std::move(driver), config);

    // FIXED: Use start_websdr_updates() instead of detaching thread
    if(register_online) {
        server.start_websdr_updates();
    }
    
    // FIX: signal handling is now managed inside broadcast_server::run() via
    // boost::asio::signal_set, which is async-signal-safe.  The old
    // std::signal(SIGINT, ...) call has been removed.
    server.run(port);
    std::exit(0);
}