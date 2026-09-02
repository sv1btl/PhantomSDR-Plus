#include "client.h"
#include "signal.h"
#include "spectrumserver.h"
#include "waterfall.h"
#include "chat.h"
#include "kiwi_bridge.h"
#include <algorithm>

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
// Mutexes protecting the throttle maps — accessed from signal/waterfall loops
// AND from close handlers which may run on a different io thread.
std::mutex g_audio_throttle_mtx;
std::mutex g_waterfall_throttle_mtx;

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

void broadcast_server::send_basic_info(connection_hdl hdl,
                                       const std::string &client_id) {

    // Example format:
    // "{\"sps\":1000000,\"fft_size\":65536,\"clientid\":\"123\",\"basefreq\":123}";
    // Craft a JSON string for the client

    std::string grid_locator = config["websdr"]["grid_locator"].value_or("-");
    std::optional<int> offset_smeter = config["input"]["smeter_offset"].value<int>();
    int offset_smeter_value = offset_smeter.value_or(0);

    std::optional<int> analog_offset_smeter = config["input"]["analog_smeter_offset"].value<int>();
    int analog_offset_smeter_value = analog_offset_smeter.value_or(0);

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
        {"analog_smeter_offset", analog_offset_smeter_value},
        {"markers", [&]() {
            std::shared_lock lk(markers_mutex);  // protect against concurrent write by marker_update_thread
            return markers.dump();
        }()}
    };

    // The client's own signal-protocol UUID.  This is the SAME id used as the
    // key in /users and in the events-socket signal_changes map, so the browser
    // can identify its own waterfall pill exactly — instead of guessing "me" by
    // frequency proximity, which mislabels users who share a frequency.
    // Empty for the waterfall socket (no AudioClient), so only emit when set.
    if (!client_id.empty()) {
        json["client_id"] = client_id;
    }

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
    auto con = m_server.get_con_from_hdl(hdl);

    // When the server is behind a VPN or reverse proxy (Nginx, etc.) the real
    // client IP is carried in X-Forwarded-For or X-Real-IP headers set by the
    // proxy. get_remote_endpoint() would return the proxy's IP in that case.
    //
    // X-Forwarded-For can contain a comma-separated chain of IPs when there
    // are multiple proxies — the first one is the original client.
    const std::string xff = con->get_request_header("X-Forwarded-For");
    if (!xff.empty()) {
        const auto comma = xff.find(',');
        std::string first = (comma != std::string::npos)
            ? xff.substr(0, comma)
            : xff;
        const auto start = first.find_first_not_of(" \t");
        const auto end   = first.find_last_not_of(" \t");
        if (start != std::string::npos)
            return first.substr(start, end - start + 1);
    }

    const std::string xri = con->get_request_header("X-Real-IP");
    if (!xri.empty()) {
        const auto start = xri.find_first_not_of(" \t");
        const auto end   = xri.find_last_not_of(" \t");
        if (start != std::string::npos)
            return xri.substr(start, end - start + 1);
    }

    // No proxy headers — direct connection, use the TCP endpoint.
    return con->get_remote_endpoint();
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
    // Isolate the handler: this runs on the websocketpp io_service thread, and
    // an exception escaping here propagates out of m_server.run() → std::terminate
    // → the ENTIRE server aborts, dropping every connected user on one bad
    // message (or a std::bad_alloc under memory pressure). Swallow per-message.
    try {
        client->on_message(payload);
    } catch (const std::exception &e) {
        m_server.get_alog().write(websocketpp::log::alevel::app,
                                  std::string("on_message handler threw: ") + e.what());
    } catch (...) {
        m_server.get_alog().write(websocketpp::log::alevel::app,
                                  "on_message handler threw unknown exception");
    }
}

void broadcast_server::on_open_signal(connection_hdl hdl,
                                      conn_type signal_type) {
    // Pre-generate the client's unique id so we can advertise it in basic_info
    // WITHOUT reordering: basic_info MUST be the very first frame the browser
    // receives on /audio (socketMessageInitial JSON.parse's the first message).
    // If we sent it after the AudioClient is inserted into signal_slices, an
    // audio frame from the FFT thread could race ahead of it — the browser then
    // JSON.parse()s a binary audio frame, tears down the socket, and there is
    // NO SOUND.  Sending basic_info first (as the original code did) guarantees
    // the browser gets settings before any audio.
    const std::string uid = generate_unique_id();
    send_basic_info(hdl, uid);

    int audio_fft_size = ceil((double)audio_max_sps * fft_size / sps / 4.) * 4;
    std::shared_ptr<AudioClient> client = std::make_shared<AudioClient>(
        hdl, *this, audio_compression, is_real, audio_fft_size, audio_max_sps,
        fft_result_size);
    // Override the constructor-generated id with the one we already advertised
    // so /users and the events-socket signal_changes agree with what the
    // browser was told in basic_info.
    client->unique_id = uid;

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
        {
            std::lock_guard<std::mutex> tlk(g_audio_throttle_mtx);
            g_audio_throttle.erase(h);
        }
        // AudioClient::on_close() takes no arguments
        try { client->on_close(); } catch (...) {}
    });

    // FIX: Register a per-connection fail handler so ungraceful disconnects
    // (browser tab closed, network drop, TCP reset) also trigger on_close()
    // and get logged.  The global fail handler in init_server() never had
    // access to the per-client shared_ptr so it couldn't call on_close().
    // on_close() is guarded by an atomic<bool> so double-fire (close + fail)
    // is safe — only the first call does anything.
    con->set_fail_handler([client](connection_hdl h) {
        {
            std::lock_guard<std::mutex> tlk(g_audio_throttle_mtx);
            g_audio_throttle.erase(h);
        }
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

            // FIX (dangling pointer): previously a pointer into g_audio_throttle
            // was taken under the lock and then used *after* the lock was released.
            // If the close handler ran in that window it would erase the entry,
            // making the pointer dangle.  Fix: hold the lock for the full call —
            // should_send_adaptive is pure arithmetic so the added hold time is
            // negligible.
            const size_t buffered = con->get_buffered_amount();
            bool do_send_audio;
            {
                std::lock_guard<std::mutex> tlk(g_audio_throttle_mtx);
                do_send_audio = should_send_adaptive(
                    g_audio_throttle[data->hdl], buffered,
                    static_cast<uint64_t>(frame_num), 20, true);
            }
            if (!do_send_audio) {
                continue;
            }

            // Equivalent to
            // data->send_audio(&fft_buffer[(l_idx + base_idx) % fft_result_size],
            // frame_num);
            // Boost 1.87 removed io_service::post(); the free function has
            // been the supported spelling since Boost 1.66.
            futures.emplace_back(boost::asio::post(
                io_service, boost::asio::use_future(std::bind(
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
        {
            std::lock_guard<std::mutex> tlk(g_waterfall_throttle_mtx);
            g_waterfall_throttle.erase(h);
        }
        try { client->on_close(); } catch (...) {}
    });
    // FIX (SIGSEGV): Register a per-connection fail handler so ungraceful
    // disconnects (network drop, TCP reset, browser tab close) also trigger
    // on_close().  Without this, cleanup_dead_connections() was the only
    // path that removed dead waterfall clients — but it erased the iterator
    // directly, bypassing the closed atomic guard, causing double-erase into
    // the rb-tree → _Rb_tree_rebalance_for_erase → SIGSEGV.
    // on_close() is guarded by atomic<bool> closed so close+fail double-fire
    // is safe — only the first call does anything.
    con->set_fail_handler([client](connection_hdl h) {
        {
            std::lock_guard<std::mutex> tlk(g_waterfall_throttle_mtx);
            g_waterfall_throttle.erase(h);
        }
        try { client->on_close(); } catch (...) {}
    });
    con->set_message_handler(std::bind(
        &broadcast_server::on_message, this, std::placeholders::_1,
        std::placeholders::_2, std::static_pointer_cast<Client>(client)));
}

std::vector<std::future<void>>
broadcast_server::waterfall_loop(int8_t *fft_power_quantized, bool kiwi_only,
                                 double source_fps) {
    // FIX: was futures.reserve(signal_slices.size()) — wrong container.
    // Approximate the total waterfall client count across all downsample levels.
    // No lock required here; this is only a pre-allocation hint.
    std::vector<std::future<void>> futures;
    {
        size_t approx = 0;
        for (const auto &wf : waterfall_slices) approx += wf.size();
        futures.reserve(approx);
    }

    auto &io_service = m_server.get_io_service();
    for (int i = 0; i < downsample_levels; i++) {
        // Iterate over each waterfall client and send each slice
        std::scoped_lock lg(waterfall_slice_mtx[i]);
        for (auto &[slice, data] : waterfall_slices[i]) {
            auto &[l_idx, r_idx] = slice;

            // Kiwi clients are offered every FFT frame and thinned to the fps
            // they asked for; everyone else keeps the browser cadence, so on
            // the frames the browser waterfall skips there is nothing to do
            // for them.  See WaterfallClient::kiwi_take_frame().
            if (data->is_kiwi) {
                if (!data->kiwi_take_frame(source_fps)) {
                    continue;
                }
            } else if (kiwi_only) {
                continue;
            }

            // If the client is slow, avoid unnecessary buffering and
            // drop the packet - changed from 50000 to 100000
            
            try {
                auto con = m_server.get_con_from_hdl(data->hdl);
                
                // Check connection state before sending
                if (!con || con->get_state() != websocketpp::session::state::open) {
                    continue;
                }

                // FIX (dangling pointer): same race as audio throttle — hold the
                // lock for the full should_send_adaptive call.
                const size_t buffered = con->get_buffered_amount();
                bool do_send_wf;
                {
                    std::lock_guard<std::mutex> tlk(g_waterfall_throttle_mtx);
                    do_send_wf = should_send_adaptive(
                        g_waterfall_throttle[data->hdl], buffered,
                        static_cast<uint64_t>(frame_num), 40, false);
                }
                if (!do_send_wf) {
                    continue;
                }
                
                // Equivalent to
                // data->send_waterfall(&fft_power_quantized[l_idx],frame_num);
                futures.emplace_back(
                    boost::asio::post(io_service, boost::asio::use_future(
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
    // get_resource() includes any query string (e.g. "/audio?tap=abc"). Strip it
    // so routing below matches on the bare path.
    std::string resource = con->get_resource();
    std::string path = resource;
    {
        auto qpos = resource.find('?');
        if (qpos != std::string::npos)
            path = resource.substr(0, qpos);
    }

    // NOTE: loopback connections are NOT rejected here.
    //
    // An earlier version closed every WebSocket whose source IP was 127.0.0.1 /
    // ::1, exempting only the internal PCM tap (/audio?tap=<token>). The goal was
    // to keep server-local connections out of users.json, the JSONL stats log and
    // the waterfall user labels — but events.cpp already does exactly that, on its
    // own, via is_loopback_ip(). The close was redundant for that purpose and had
    // two real costs:
    //
    //   • A browser on the server machine (http://localhost:<port>) got the page
    //     but no /waterfall, /audio or /events data — a permanently blank GUI.
    //
    //   • The filter's last resort was get_remote_endpoint(), the raw TCP peer.
    //     Behind a same-host reverse proxy (Nginx/Caddy with upstream
    //     127.0.0.1:<port> — the standard setup) that is loopback for EVERY
    //     client, so all real users were dropped no matter what X-Forwarded-For
    //     said. proxy.py had to dial the LAN IP purely to dodge this.
    //
    // Loopback clients are served normally now and remain invisible in stats and
    // on the waterfall, exactly as before. .tap_token is still generated and the
    // autorun tap still sends ?tap=<token>; it is simply no longer a gate.

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

    // Disable Nagle. Every socket this server owns carries a real-time stream
    // of frames well under one MSS -- a 1040-byte waterfall line, a 1034-byte
    // audio frame -- and Nagle holds a small segment back until the previous
    // one is acknowledged. Paired with the peer's delayed ACK that is up to
    // 40 ms of pure queueing delay added to a frame that was ready to leave,
    // and it lands hardest on exactly the traffic that cannot afford it. There
    // is nothing here for Nagle to coalesce: the frames are already whole
    // messages, produced one per FFT hop, so switching it off costs no extra
    // packets in the normal case.
    try {
        auto socket_ptr = con->get_socket().lowest_layer().native_handle();
        int nodelay = 1;
        #ifdef _WIN32
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_NODELAY,
                   (const char *)&nodelay, sizeof(nodelay));
        #else
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_NODELAY, &nodelay,
                   sizeof(nodelay));
        #endif
    } catch (...) {
        // Ignore errors setting TCP_NODELAY
    }

    // Per-connection pong timeout (10s) to detect dead peers.
    try { con->set_pong_timeout(30000); } catch (...) {}

    // Start a lightweight keepalive ping loop to prevent idle/proxy drops.
    {
        auto& io = m_server.get_io_service();
        auto timer = std::make_shared<boost::asio::steady_timer>(io);
        std::weak_ptr<server::connection_type> weak = m_server.get_con_from_hdl(hdl);
        // FIX: Capturing a std::function by value into itself captures the
        // *not-yet-assigned* empty function — calling it is UB/crash on the
        // first timer tick.  Use a shared_ptr<function> so the lambda captures
        // a pointer to the function object rather than a copy of it.
        auto ping_fn = std::make_shared<std::function<void()>>();
        *ping_fn = [this, timer, weak, ping_fn]() {
            if (auto c = weak.lock()) {
                if (c->get_state() == websocketpp::session::state::open) {
                    try { c->ping("k"); } catch (...) {}
                }
                timer->expires_after(std::chrono::seconds(25));
                // Capture ping_fn by value so the shared_ptr keeps the
                // function alive for the duration of the timer.
                timer->async_wait([ping_fn](const boost::system::error_code& e){
                    if (!e) (*ping_fn)();
                });
            }
            // If the connection is gone we simply don't reschedule; the
            // shared_ptr chain unwinds and both timer and function are freed.
        };
        (*ping_fn)();
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
    } else if (kiwi_emulation_enabled && is_kiwi_snd_path(path)) {
        on_open_kiwi_snd(hdl);
    } else if (kiwi_emulation_enabled && is_kiwi_wf_path(path)) {
        on_open_kiwi_wf(hdl);
    } else {
        on_open_unknown(hdl);
    }
}

// ----------------------------------------------------------------------------
// Kiwi protocol bridge (leurre KiwiSDR) — voir kiwi_bridge.h
// ----------------------------------------------------------------------------

void broadcast_server::on_open_kiwi_snd(connection_hdl hdl) {
    // Pas de send_basic_info() : un client Kiwi n'attend rien avant d'avoir
    // lui-même envoyé "SET auth ...".
    int kiwi_audio_fft_size =
        ceil((double)audio_max_sps * fft_size / sps / 4.) * 4;
    std::shared_ptr<AudioClient> client = std::make_shared<AudioClient>(
        hdl, *this, AUDIO_KIWI_PCM, is_real, kiwi_audio_fft_size, audio_max_sps,
        fft_result_size);
    client->unique_id = generate_unique_id();
    client->set_audio_demodulation(default_mode);
    {
        std::scoped_lock lg(signal_slice_mtx);
        auto it = signal_slices.insert({{0, 0}, client});
        client->it = it;
    }
    client->set_audio_range(default_l, default_m, default_r);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });

    // Réaccordage : traduit "SET mod=... freq=..." en indices de bin FFT.
    // UNIQUEMENT pour une entrée réelle (is_real) — voir TODO_KIWI_RETUNE_IQ
    // dans kiwi_bridge.h pour le cas IQ, non implémenté. Journalisé dans
    // /tmp/kiwi_retune.log à chaque étape.
    //
    // IMPORTANT : audio_mid (le paramètre "m" de set_audio_range) doit être
    // exprimé en INDICE DE BIN, comme l/r — PAS en Hz. C'est le point qui a
    // fait échouer la première tentative (silence total, quelle que soit la
    // fréquence) : on passait la fréquence en Hz directement, ce qui rendait
    // audio_m totalement hors de portée dans AudioClient::send_audio() et
    // empêchait toute copie de données vers le buffer de démodulation.
    auto retune_cb = [this, client, kiwi_audio_fft_size](const std::string &mode_str,
                                    double low_cut_hz, double high_cut_hz,
                                    double freq_khz) {
        if (!is_real) {
            kiwi_debug_log("REJETE: entree non reelle (IQ), reaccordage non supporte");
            return;
        }
        double bin_hz = (double)sps / (double)fft_size;
        double freq_hz = freq_khz * 1000.0;
        double lo = freq_hz + low_cut_hz - (double)basefreq;
        double hi = freq_hz + high_cut_hz - (double)basefreq;
        if (lo > hi) std::swap(lo, hi);

        int l_bin = static_cast<int>(std::floor(lo / bin_hz));
        int r_bin = static_cast<int>(std::ceil(hi / bin_hz));
        l_bin = std::clamp(l_bin, 0, fft_result_size - 1);
        r_bin = std::clamp(r_bin, 0, fft_result_size - 1);
        kiwi_debug_log("is_real=" + std::to_string(is_real) +
                       " bin_hz=" + std::to_string(bin_hz) +
                       " l_bin=" + std::to_string(l_bin) +
                       " r_bin=" + std::to_string(r_bin) +
                       " fft_result_size=" + std::to_string(fft_result_size) +
                       " kiwi_audio_fft_size=" + std::to_string(kiwi_audio_fft_size));
        if (l_bin >= r_bin) {
            kiwi_debug_log("REJETE: l_bin >= r_bin");
            return;
        }
        if (r_bin - l_bin > kiwi_audio_fft_size) {
            kiwi_debug_log("REJETE: intervalle trop large");
            return;
        }

        bool recognized = false;
        demodulation_mode dmod = kiwi_mode_to_demod(mode_str, recognized);
        if (recognized) client->set_audio_demodulation(dmod);

        double m_bin = (freq_hz - (double)basefreq) / bin_hz;
        kiwi_debug_log("set_audio_range(l=" + std::to_string(l_bin) +
                       ", m_bin=" + std::to_string(m_bin) +
                       ", r=" + std::to_string(r_bin) +
                       ") mode_recognized=" + std::to_string(recognized));
        client->set_audio_range(l_bin, m_bin, r_bin);
    };

    auto auth_acked = std::make_shared<bool>(false);
    con->set_message_handler(
        [this, auth_acked, retune_cb](connection_hdl h, server::message_ptr msg) {
            KiwiCommandParser::handle_snd_message(
                msg->get_payload(), *auth_acked,
                [this, h](const std::string &s) {
                    send_binary_packet(h, s.data(), s.size());
                },
                retune_cb, (double)sps / 2.0,
                (double)basefreq + (double)sps / 4.0, (double)sps,
                (double)audio_max_sps);
        });
}

void broadcast_server::on_open_kiwi_wf(connection_hdl hdl) {
    std::shared_ptr<WaterfallClient> client = std::make_shared<WaterfallClient>(
        hdl, *this, WATERFALL_KIWI, min_waterfall_fft);
    {
        std::scoped_lock lk(waterfall_slice_mtx[0]);
        auto it = waterfall_slices[0].insert({{0, min_waterfall_fft}, client});
        client->it = it;
    }
    client->set_waterfall_range(downsample_levels - 1, 0, min_waterfall_fft);

    // The FFT loop produces 2*sps/fft_size spectra per second. A Kiwi client
    // asks for at most 23 fps, so that is the ceiling we advertise and the
    // default a client gets until it says otherwise with SET wf_speed.
    const double kiwi_wf_max_fps =
        std::min(2.0 * (double)sps / (double)fft_size, kiwi_wf_fps_cap);
    client->set_kiwi_target_fps(kiwi_wf_max_fps);

    // Deepest zoom at which every pixel of a 1024-bin W/F frame is still a
    // real FFT bin: our spectrum is fft_result_size bins wide and a Kiwi zoom
    // z shows fft_result_size >> z of them. Beyond this the encoder is
    // interpolating. Capped at 14, the deepest zoom the protocol defines.
    // See the long note in KiwiCommandParser::handle_wf_message.
    int kiwi_zoom_max = 0;
    for (int bins = fft_result_size;
         bins > (int)KiwiWfEncoder::kKiwiWfBins && kiwi_zoom_max < 14;
         bins /= 2) {
        kiwi_zoom_max++;
    }

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });

    // Réaccordage waterfall : traduit "SET zoom=.../cf=..." ou
    // "SET zoom=.../start=..." en WaterfallClient::on_window_message(),
    // qui réutilise la logique existante de sélection du niveau de
    // sous-échantillonnage — pas besoin de la réimplémenter.
    //
    // MAX_FREQ_KHZ est calculé depuis notre propre sps (pas figé à 30 MHz)
    // pour rester correct quel que soit le débit d'échantillonnage —
    // annoncé au client via "MSG bandwidth=..." côté SND.
    auto retune_wf_cb = [this, client](int zoom, double value, bool is_cf) {
        constexpr int MAX_ZOOM = 14;
        constexpr int WF_BINS = 1024;
        double max_freq_khz = (double)sps / 2.0 / 1000.0;

        double span_khz = max_freq_khz / (double)(1LL << zoom);
        double start_freq_khz;
        if (is_cf) {
            start_freq_khz = value - span_khz / 2.0;
        } else {
            double counter = value;
            start_freq_khz =
                counter * max_freq_khz / ((double)WF_BINS * (double)(1LL << MAX_ZOOM));
        }
        double end_freq_khz = start_freq_khz + span_khz;

        double bin_hz = (double)sps / (double)fft_size;
        double lo_hz = start_freq_khz * 1000.0 - (double)basefreq;
        double hi_hz = end_freq_khz * 1000.0 - (double)basefreq;

        // Une trame W/F Kiwi fait TOUJOURS 1024 bins. Si la fenetre
        // demandee deborde de notre spectre (0 .. sps/2), il ne faut donc
        // pas rogner les bords — cela produisait des trames courtes (770,
        // 1133, 1161 bins mesures) que le client redimensionne de travers.
        // On fait glisser la fenetre en conservant sa largeur, et on ne la
        // reduit que si elle est plus large que le spectre entier.
        int width = static_cast<int>(std::lround((hi_hz - lo_hz) / bin_hz));
        width = std::clamp(width, 1, fft_result_size);
        int l_bin = static_cast<int>(std::floor(lo_hz / bin_hz));
        l_bin = std::clamp(l_bin, 0, fft_result_size - width);
        int r_bin = l_bin + width;

        kiwi_debug_log("[WF] zoom=" + std::to_string(zoom) +
                       " is_cf=" + std::to_string(is_cf) +
                       " start_freq_khz=" + std::to_string(start_freq_khz) +
                       " span_khz=" + std::to_string(span_khz) +
                       " l_bin=" + std::to_string(l_bin) +
                       " r_bin=" + std::to_string(r_bin));

        if (l_bin >= r_bin) {
            kiwi_debug_log("[WF] REJETE: l_bin >= r_bin");
            return;
        }

        std::optional<double> dummy_m;
        std::optional<int> dummy_level;
        client->on_window_message(l_bin, dummy_m, r_bin, dummy_level);
        kiwi_debug_log("[WF] on_window_message applique");
    };

    auto auth_acked_wf = std::make_shared<bool>(false);
    auto wf_speed_cb = [client](double fps) {
        client->set_kiwi_target_fps(fps);
    };
    con->set_message_handler(
        [this, auth_acked_wf, retune_wf_cb, wf_speed_cb, kiwi_wf_max_fps,
         kiwi_zoom_max](connection_hdl h, server::message_ptr msg) {
            KiwiCommandParser::handle_wf_message(
                msg->get_payload(), *auth_acked_wf,
                [this, h](const std::string &s) {
                    send_binary_packet(h, s.data(), s.size());
                },
                retune_wf_cb, kiwi_wf_max_fps, kiwi_zoom_max, wf_speed_cb);
        });
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
        if (con->get_buffered_amount() > 2000000) {
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
        if (con->get_buffered_amount() > 2000000) {
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