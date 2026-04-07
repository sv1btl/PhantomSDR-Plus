#include "client.h"
#include "signal.h"
#include "spectrumserver.h"
#include "waterfall.h"
#include "chat.h"

#include "glaze/glaze.hpp"

#include <chrono>
#include <map>

// ---------------------------------------------------------------------------
// Adaptive throttling
//
// Browsers aggressively throttle background tabs (JS timers, rendering, and
// websocket message handling). When the client becomes a slow consumer,
// websocketpp's send buffer grows; if the server responds by *never sending*
// (i.e., `continue;` forever), the user experiences a "freeze".
//
// The strategy below is:
//  - Never enter an infinite starvation state.
//  - When buffered_amount rises, reduce send rate (drop intermediate frames).
//  - When buffered_amount falls, automatically ramp back up.
//
// This keeps audio/waterfall "alive" under background throttling, while still
// protecting server memory.
//
// IMPROVEMENTS:
//  - More granular buffer thresholds for smoother degradation
//  - Separate tuning for audio (needs tighter timing) vs waterfall
//  - Lower base intervals to maintain better continuity
// ---------------------------------------------------------------------------

namespace {
using clock_t = std::chrono::steady_clock;

struct throttle_state {
    uint64_t last_frame_sent = 0;                 // last frame_num we sent
    clock_t::time_point last_send_time = {};      // last time we sent
};

// Use owner_less so connection_hdl can be map key safely.
using throttle_map_t = std::map<connection_hdl, throttle_state, std::owner_less<connection_hdl>>;

// Separate state for audio and waterfall (different thresholds).
throttle_map_t g_audio_throttle;
throttle_map_t g_waterfall_throttle;

// Decide whether to send this frame given the current buffered amount.
// Returns true if we should send now.
inline bool should_send_adaptive(throttle_state &st,
                                const size_t buffered_amount,
                                const uint64_t frame_num,
                                const int base_fps_cap,
                                const bool is_audio = false) {
    // base_fps_cap is interpreted as a *minimum* cadence guard in ms when
    // we are under pressure (acts like a token bucket).
    // In normal operation, we send every frame.

    // Map buffer pressure -> frame skipping and minimum interval.
    // These values are conservative and meant to avoid starvation.
    // Audio uses tighter thresholds to prevent audible gaps.
    int skip_mod = 1;
    int min_interval_ms = 0;

    if (is_audio) {
        // AUDIO: More aggressive early intervention to prevent buffer buildup
        // Lower thresholds, gentler skipping to maintain continuity
        if (buffered_amount > 500000) {          // severe pressure
            skip_mod = 20;
            min_interval_ms = base_fps_cap * 5;
        } else if (buffered_amount > 300000) {   // high pressure
            skip_mod = 10;
            min_interval_ms = base_fps_cap * 4;
        } else if (buffered_amount > 150000) {   // moderate pressure
            skip_mod = 5;
            min_interval_ms = base_fps_cap * 3;
        } else if (buffered_amount > 75000) {    // light pressure
            skip_mod = 3;
            min_interval_ms = base_fps_cap * 2;
        } else if (buffered_amount > 30000) {    // early warning
            skip_mod = 2;
            min_interval_ms = base_fps_cap;
        }
    } else {
        // WATERFALL: Can tolerate more aggressive skipping
        // Higher thresholds, more aggressive skipping (visual continuity less critical)
        if (buffered_amount > 700000) {          // very slow client
            skip_mod = 30;
            min_interval_ms = base_fps_cap * 6;
        } else if (buffered_amount > 400000) {
            skip_mod = 15;
            min_interval_ms = base_fps_cap * 4;
        } else if (buffered_amount > 200000) {
            skip_mod = 8;
            min_interval_ms = base_fps_cap * 3;
        } else if (buffered_amount > 100000) {
            skip_mod = 4;
            min_interval_ms = base_fps_cap * 2;
        } else if (buffered_amount > 50000) {
            skip_mod = 2;
            min_interval_ms = base_fps_cap;
        }
    }

    // If no pressure: send.
    if (skip_mod == 1 && min_interval_ms == 0) {
        return true;
    }

    // Skip intermediate frames by modulo.
    if ((frame_num % static_cast<uint64_t>(skip_mod)) != 0) {
        return false;
    }

    // Also enforce a minimum time interval when under pressure.
    const auto now = clock_t::now();
    if (min_interval_ms > 0) {
        if (st.last_send_time.time_since_epoch().count() != 0) {
            const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - st.last_send_time).count();
            if (elapsed < min_interval_ms) {
                return false;
            }
        }
    }

    st.last_send_time = now;
    st.last_frame_sent = frame_num;
    return true;
}
} // namespace

void broadcast_server::send_basic_info(connection_hdl hdl) {

    // Example format:
    // "{\"sps\":1000000,\"fft_size\":65536,\"clientid\":\"123\",\"basefreq\":123}";
    // Craft a JSON string for the client

    std::string grid_locator = config["websdr"]["grid_locator"].value_or("-");
    std::optional<int> offset_smeter = config["input"]["smeter_offset"].value<int>();
    int offset_smeter_value = offset_smeter.value();
    glz::json_t json = {
        {"sps", sps},
        {"audio_max_sps", audio_max_sps},
        {"audio_max_fft", audio_max_fft_size},
        {"fft_size", fft_size},
        {"fft_result_size", fft_result_size},
        {"waterfall_size", min_waterfall_fft},
        {"basefreq", basefreq},
        {"total_bandwidth", is_real ? sps / 2 : sps},
        {"defaults",
         {{"frequency", default_frequency},
          {"modulation", default_mode_str},
          {"l", default_l},
          {"m", default_m},
          {"r", default_r}}},
        {"waterfall_compression", waterfall_compression_str},
        {"audio_compression", audio_compression_str},
        {"grid_locator", grid_locator},
        {"smeter_offset", offset_smeter_value},
        {"markers", markers.dump()}  
    };
    
    m_server.send(hdl, glz::write_json(json), websocketpp::frame::opcode::text);
}

// PacketSender---------------------------------------------------------------

void broadcast_server::init_server() {
    // Suppress all access logs
    m_server.clear_access_channels(websocketpp::log::alevel::all);

    // Suppress all error logs
    m_server.clear_error_channels(websocketpp::log::elevel::all);

    // IMPORTANT: do NOT re-enable fatal logs
    // Either delete this line:
    // m_server.set_error_channels(websocketpp::log::elevel::fatal);

    // Or explicitly set none:
    m_server.set_error_channels(websocketpp::log::elevel::none);

    // Your fail handler etc. can stay as-is
    m_server.set_fail_handler([this](connection_hdl hdl) {
        try {
            auto con = m_server.get_con_from_hdl(hdl);
            auto ec  = con->get_ec();
            // Ignore typical EOF / transport errors (2, 7, etc.)
            if (ec.value() != 2 && ec.value() != 7) {
                // std::cerr << "Connection failed: " << ec.message() << std::endl;
            }
        } catch (...) {
        }
    });
    
    // Set custom interrupt handler to suppress EOF errors during close
    m_server.set_interrupt_handler([this](connection_hdl hdl) {
        try {
            auto con = m_server.get_con_from_hdl(hdl);
            // Silently close the connection
            websocketpp::lib::error_code ec;
            con->terminate(ec);
        } catch (...) {
            // Connection already gone
        }
    });
}

void broadcast_server::log(connection_hdl, const std::string &str) {
    m_server.get_alog().write(websocketpp::log::alevel::app, str);
}

std::string broadcast_server::ip_from_hdl(connection_hdl hdl) {
    return m_server.get_con_from_hdl(hdl)->get_remote_endpoint();
}

waterfall_slices_t &broadcast_server::get_waterfall_slices() {
    return waterfall_slices;
}

waterfall_mutexes_t &broadcast_server::get_waterfall_slice_mtx() {
    return waterfall_slice_mtx;
}

signal_slices_t &broadcast_server::get_signal_slices() { 
    return signal_slices; 
}

std::mutex &broadcast_server::get_signal_slice_mtx() {
    return signal_slice_mtx;
}

void broadcast_server::on_message(connection_hdl, server::message_ptr msg,
                                  std::shared_ptr<Client> &client) {

    // Limit the amount of data received
    std::string payload = msg->get_payload().substr(0, 1024);
    client->on_message(payload);
}

void broadcast_server::on_open_signal(connection_hdl hdl,
                                      conn_type signal_type) {
    send_basic_info(hdl);

    int audio_fft_size = ceil((double)audio_max_sps * fft_size / sps / 4.) * 4;
    std::shared_ptr<AudioClient> client = std::make_shared<AudioClient>(
        hdl, *this, audio_compression, is_real, audio_fft_size, audio_max_sps,
        fft_result_size);

    client->set_audio_demodulation(default_mode);
    {
        std::scoped_lock lg(signal_slice_mtx);
        auto it = signal_slices.insert({{0, 0}, client});
        client->it = it;
    }
    // Default slice
    client->set_audio_range(default_l, default_m, default_r);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);

    con->set_close_handler([client](connection_hdl h) {
        // Clean up throttle state for this connection
        g_audio_throttle.erase(h);
        // AudioClient::on_close() takes no arguments
        try { client->on_close(); } catch (...) {}
    });
    con->set_message_handler(std::bind(
        &broadcast_server::on_message, this, std::placeholders::_1,
        std::placeholders::_2, std::static_pointer_cast<Client>(client)));
}

void broadcast_server::on_open_chat(connection_hdl hdl) {
    std::shared_ptr<ChatClient> client = std::make_shared<ChatClient>(hdl, *this);
    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler(std::bind(&ChatClient::on_close_chat, client,
                                     std::placeholders::_1));
    con->set_message_handler(std::bind(
        &broadcast_server::on_message, this, std::placeholders::_1,
        std::placeholders::_2, std::static_pointer_cast<Client>(client)));
}

// Iterates through the client list to send the slices
std::vector<std::future<void>> broadcast_server::signal_loop() {
    int base_idx = 0;
    if (!is_real) {
        base_idx = fft_size / 2 + 1;
    }
    std::scoped_lock lg(signal_slice_mtx);
    auto &io_service = m_server.get_io_service();

    // Completion futures
    std::vector<std::future<void>> futures;
    futures.reserve(signal_slices.size());

    // Send the apprioriate signal slice to the client
    for (auto &[slice, data] : signal_slices) {
        auto &[l_idx, r_idx] = slice;
        // Adaptive throttling for audio: never starve the client forever.
        // When buffered_amount rises (common in background tabs), reduce
        // send rate instead of hard-dropping everything.
        
        try {
            auto con = m_server.get_con_from_hdl(data->hdl);
            
            // Check connection state before sending
            if (!con || con->get_state() != websocketpp::session::state::open) {
                continue;
            }

            // IMPROVED: Audio-specific adaptive throttling with tighter parameters
            // base_fps_cap 20ms => ~50Hz minimum cadence under severe pressure
            // (was 25ms/40Hz - now tighter for better audio continuity)
            const size_t buffered = con->get_buffered_amount();
            auto &st = g_audio_throttle[data->hdl];
            if (!should_send_adaptive(st, buffered, static_cast<uint64_t>(frame_num), 20, true)) {
                continue;
            }

            // Equivalent to
            // data->send_audio(&fft_buffer[(l_idx + base_idx) % fft_result_size],
            // frame_num);
            futures.emplace_back(io_service.post(boost::asio::use_future(std::bind(
                &AudioClient::send_audio, data,
                &fft_buffer[(l_idx + base_idx) % fft_result_size], frame_num))));
        } catch (...) {
            // Connection no longer valid, skip
            continue;
        }
    }
    return futures;
}

void broadcast_server::on_open_waterfall(connection_hdl hdl) {
    send_basic_info(hdl);

    // Set default to the entire spectrum
    std::shared_ptr<WaterfallClient> client = std::make_shared<WaterfallClient>(
        hdl, *this, waterfall_compression, min_waterfall_fft);
    {
        std::scoped_lock lk(waterfall_slice_mtx[0]);
        auto it = waterfall_slices[0].insert({{0, min_waterfall_fft}, client});
        client->it = it;
    }
    client->set_waterfall_range(downsample_levels - 1, 0, min_waterfall_fft);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler([client](connection_hdl h) {
        // Clean up throttle state for this connection
        g_waterfall_throttle.erase(h);
        try { client->on_close(); } catch (...) {}
    });
    con->set_message_handler(std::bind(
        &broadcast_server::on_message, this, std::placeholders::_1,
        std::placeholders::_2, std::static_pointer_cast<Client>(client)));
}

std::vector<std::future<void>>
broadcast_server::waterfall_loop(int8_t *fft_power_quantized) {
    // Completion futures
    std::vector<std::future<void>> futures;
    futures.reserve(signal_slices.size());

    auto &io_service = m_server.get_io_service();
    for (int i = 0; i < downsample_levels; i++) {
        // Iterate over each waterfall client and send each slice
        std::scoped_lock lg(waterfall_slice_mtx[i]);
        for (auto &[slice, data] : waterfall_slices[i]) {
            auto &[l_idx, r_idx] = slice;
            // If the client is slow, avoid unnecessary buffering and
            // drop the packet - changed from 50000 to 100000
            
            try {
                auto con = m_server.get_con_from_hdl(data->hdl);
                
                // Check connection state before sending
                if (!con || con->get_state() != websocketpp::session::state::open) {
                    continue;
                }

                // Adaptive throttling: waterfall can be aggressively decimated
                // under pressure because we only care about the *latest* line.
                const size_t buffered = con->get_buffered_amount();
                auto &st = g_waterfall_throttle[data->hdl];
                // base_fps_cap (ms) ~40ms => ~25Hz minimum cadence under pressure.
                if (!should_send_adaptive(st, buffered, static_cast<uint64_t>(frame_num), 40, false)) {
                    continue;
                }
                
                // Equivalent to
                // data->send_waterfall(&fft_power_quantized[l_idx],frame_num);
                futures.emplace_back(
                    io_service.post(boost::asio::use_future(
                        std::bind(&WaterfallClient::send_waterfall, data,
                                  &fft_power_quantized[l_idx], frame_num))));
            } catch (...) {
                // Connection no longer valid, skip
                continue;
            }
        }

        // Prevent overwrite of previous level's quantized waterfall
        fft_power_quantized += (fft_result_size >> i);
    }
    return futures;
}

void broadcast_server::on_open_unknown(connection_hdl hdl) {
    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    if (con) {
        con->set_close_handler([](connection_hdl) {}); // No-op
    }
    // Immediately close with a benign status
    websocketpp::lib::error_code ec;
    m_server.close(hdl, websocketpp::close::status::going_away, "", ec);
}

void broadcast_server::on_open(connection_hdl hdl) {
    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    std::string path = con->get_resource();

    // Enable TCP keep-alive to detect dead connections
    try {
        auto socket_ptr = con->get_socket().lowest_layer().native_handle();
        
        #ifdef _WIN32
        // Windows
        DWORD keepalive = 1;
        setsockopt(socket_ptr, SOL_SOCKET, SO_KEEPALIVE, 
                   (const char*)&keepalive, sizeof(keepalive));
        
        // Set keep-alive parameters
        tcp_keepalive keepalive_vals;
        keepalive_vals.onoff = 1;
        keepalive_vals.keepalivetime = 30000;  // 30 seconds
        keepalive_vals.keepaliveinterval = 10000;  // 10 seconds
        
        DWORD bytes_returned;
        WSAIoctl(socket_ptr, SIO_KEEPALIVE_VALS, &keepalive_vals, 
                 sizeof(keepalive_vals), NULL, 0, &bytes_returned, NULL, NULL);
        #else
        // Linux/Unix
        int keepalive = 1;
        setsockopt(socket_ptr, SOL_SOCKET, SO_KEEPALIVE, &keepalive, sizeof(keepalive));
        
        int keepidle = 30;  // 30 seconds before sending keepalive
        int keepintvl = 10; // 10 seconds between keepalive probes
        int keepcnt = 3;    // 3 failed probes before declaring dead
        
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_KEEPIDLE, &keepidle, sizeof(keepidle));
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_KEEPINTVL, &keepintvl, sizeof(keepintvl));
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_KEEPCNT, &keepcnt, sizeof(keepcnt));
        #endif
    } catch (...) {
        // Ignore errors setting keep-alive
    }

    // Per-connection pong timeout (10s) to detect dead peers.
    try { con->set_pong_timeout(10000); } catch (...) {}

    // Start a lightweight keepalive ping loop to prevent idle/proxy drops.
    {
        auto& io = m_server.get_io_service();
        auto timer = std::make_shared<boost::asio::steady_timer>(io);
        std::weak_ptr<server::connection_type> weak = m_server.get_con_from_hdl(hdl);
        std::function<void()> ping_loop;
        ping_loop = [this, timer, weak, ping_loop]() mutable {
            if (auto c = weak.lock()) {
                if (c->get_state() == websocketpp::session::state::open) {
                    websocketpp::lib::error_code ignore_ec;
                    try { c->ping("k"); } catch (...) {}
                }
                timer->expires_after(std::chrono::seconds(25));
                timer->async_wait([ping_loop](const boost::system::error_code& e){
                    if (!e) ping_loop();
                });
            }
        };
        ping_loop();
    }

    if (path == "/audio") {
        on_open_signal(hdl, AUDIO);
    } else if (path == "/signal") {
        // on_open_signal(hdl, SIGNAL);
    } else if (path == "/waterfall") {
        on_open_waterfall(hdl);
    } else if (path == "/waterfall_raw") {
        // on_open_waterfall_raw(hdl);
    } else if (path == "/events") {
        on_open_events(hdl);
    } else if (path == "/chat") {
        on_open_chat(hdl);
    } else {
        on_open_unknown(hdl);
    }
}

void broadcast_server::send_text_packet(
    connection_hdl hdl, const std::initializer_list<std::string> &data) {
    
    try {
        auto con = m_server.get_con_from_hdl(hdl);
        
        // Check if connection exists and is open
        if (!con || con->get_state() != websocketpp::session::state::open) {
            return;
        }
        
        // Don't drop important control text packets too aggressively.
        // We allow moderate buffering so background tabs can recover.
        if (con->get_buffered_amount() > 800000) {
            return;
        }

        auto total_size = std::accumulate(
            data.begin(), data.end(), size_t{0},
            [](size_t acc, const std::string &str) { return acc + str.size(); });
        
        auto msg_ptr = con->get_message(websocketpp::frame::opcode::text, total_size);
        for (auto &str : data) {
            msg_ptr->append_payload(str);
        }
        
        websocketpp::lib::error_code ec;
        ec = con->send(msg_ptr);
        
        // Silently ignore send errors (connection likely dead)
        if (ec) {
            // Connection is broken, will be cleaned up by close handler
            return;
        }
    } catch (const websocketpp::exception& e) {
        // Connection no longer valid
    } catch (const std::exception& e) {
        // Other error
    } catch (...) {
        // Unknown error
    }
}

void broadcast_server::send_binary_packet(
    connection_hdl hdl,
    const std::initializer_list<std::pair<const void *, size_t>> &bufs) {
    
    try {
        auto con = m_server.get_con_from_hdl(hdl);
        
        // Check if connection exists and is open
        if (!con || con->get_state() != websocketpp::session::state::open) {
            return;
        }
        
        // Binary packets can be large; allow some buffering but cap runaway.
        if (con->get_buffered_amount() > 800000) {
            return;
        }

        auto total_size =
            std::accumulate(bufs.begin(), bufs.end(), size_t{0},
                            [](size_t acc, auto &p) { return acc + p.second; });
        
        auto msg_ptr = con->get_message(websocketpp::frame::opcode::binary, total_size);
        for (auto &bp : bufs) {
            msg_ptr->append_payload(bp.first, bp.second);
        }
        
        websocketpp::lib::error_code ec;
        ec = con->send(msg_ptr);
        
        // Silently ignore send errors
        if (ec) {
            return;
        }
    } catch (const websocketpp::exception& e) {
        // Connection no longer valid
    } catch (const std::exception& e) {
        // Other error
    } catch (...) {
        // Unknown error
    }
}

// --- Wrapper overloads to satisfy existing virtual interface ---
void broadcast_server::send_text_packet(connection_hdl hdl, const std::string &str) {
    this->send_text_packet(hdl, {str});
}

void broadcast_server::send_binary_packet(connection_hdl hdl, const void *buf, size_t len) {
    this->send_binary_packet(hdl, {{buf, len}});
}