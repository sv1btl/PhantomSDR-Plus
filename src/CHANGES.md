# PhantomSDR-Plus — Backend Fix Log

All bugs found and patched across the full C++ backend (`audio`, `chat`, `fft`, `http`, `signal`, `waterfall`, `websocket`, `audioprocessing`, `dsp`, and supporting files). Fixes are grouped by severity and then by file.

---

## 🔴 Critical Fixes

### `audio.cpp`
- **Opus sample rate snapping** — Replaced `std::clamp(samplerate, 8000, 48000)` with a discrete-snap to the nearest valid Opus rate (`{8000, 12000, 16000, 24000, 48000}`). Clamping allows values like 22050 or 44100 which cause `opus_encoder_create` to return `OPUS_BAD_ARG`.

### `audioprocessing.cpp`
- **IFFT output not normalised** — FFTW's `FFTW_BACKWARD` transform is unnormalised; output magnitudes are `N × input`. The time-domain blanker compared these inflated values against the threshold, causing every single sample to be blanked and all audio reduced to silence. Fixed by dividing IFFT output by `nb_fft_size`.
- **Conjugate-symmetric FFT bins not mirrored** — After scaling positive-frequency bins `0..N/2`, the upper half `N/2+1..N-1` was left unmodified. The IFFT of an asymmetric spectrum is complex, not real, producing spurious imaginary energy in the blanking magnitude estimate. Fixed by applying the same scale factor to bin `N-j` when scaling bin `j`.
- **Last chunk not zero-padded** — `std::copy` only fills `copy_size` elements of `nb_buffer`; the remaining `nb_fft_size - copy_size` elements retained stale data from the prior iteration, contaminating the final block's FFT. Fixed by calling `std::fill` to zero-pad after the copy.

### `chat.cpp`
- **`store_chat_message` silently drops all messages after 20** — `push_back` was inside the `else` branch of `if (size >= 20)`, so once the deque was full, new messages were popped from the front but never inserted. Fixed by making `push_back` unconditional.
- **`chat_connections` accessed without a mutex** — `on_open_chat`, `on_close_chat`, the send loop in `on_chat_message`, and the destructor all access the static `chat_connections` set concurrently with no synchronisation. Added `static std::mutex chat_connections_mtx` and `std::scoped_lock` at every access site.

### `fft.cpp`
- **Use-after-free on `fft` unique_ptr** — The last iteration's `signal_futures` and `waterfall_futures` were never waited on after `while (running)` exited, allowing async tasks to continue accessing `fft_buffer` after the `std::unique_ptr<FFT>` was destroyed. Added explicit `f.wait()` loops before the buffer-free calls.

### `fft_cuda.cu`
- **Constructor signature mismatch** — `cuFFT::cuFFT(size, nthreads, downsample_levels)` was missing `brightness_offset`, which does not match the header declaration and fails to link. Added the parameter and forwarded it to the `FFT` base constructor.
- **`cuda_quantizedbuf` not freed in destructor** — `cudaFree` was called for `cuda_inbuf`, `cuda_outbuf`, `cuda_windowbuf`, and `cuda_powerbuf` but not `cuda_quantizedbuf`, causing a GPU memory leak on every teardown.
- **`execute()` ignores direction, always runs forward** — `plan_c2c` stores `cuda_direction` correctly but `execute()` hardcodes `CUFFT_FORWARD`. Any inverse transform silently produces wrong output. Fixed by replacing the literal with `cuda_direction`.

### `fft_impl.cpp`
- **`additional_size` uninitialised in `FFT` base constructor** — `plan_c2c` and `plan_r2c` use `additional_size` to size the output buffer (`size * 2 + additional_size * 2`). The member was never initialised to zero, so the allocation size was a garbage value, causing heap corruption. Added `additional_size{0}` to the member-init list.

### `fft_mkl.cpp`
- **Constructor signature mismatch** — `mklFFT::mklFFT(size, nthreads, downsample_levels)` was missing `brightness_offset`, not matching the header and causing a link error. Added the parameter and forwarded it to the `FFT` base constructor.

### `http.cpp`
- **Blocking curl on the WebSocket I/O thread** — `on_http` is called directly on the server's event-loop thread. With up to 5 fallback URLs at 10 s timeout each, the I/O thread could block for 50 s, stalling all connections. Converted to `con->defer_http_response()` with the fetch running in a detached `std::thread`, calling `con->send_http_response()` on completion.
- **`weakly_canonical` can throw uncaught `filesystem_error`** — An invalid resource path causes `std::filesystem::weakly_canonical` to throw, which was unhandled and would crash the server. Wrapped in `try/catch`, returning HTTP 400 on error.
- **No docroot boundary check (path traversal)** — After building the file path there was no check that it still resided under `m_docroot`. A symlink inside the docroot pointing outside could serve arbitrary files. Added a `std::filesystem::canonical` comparison; paths that escape the docroot return HTTP 404.

### `signal.cpp`
- **`get_sam` returns a dangling reference** — `get_sam()` released `g_sam_mutex` and returned a `SAM_PLL&` into the map. Concurrently, `on_close()` → `cleanup_sam()` could erase that exact entry under the same mutex, leaving the caller in `send_audio` holding a dangling reference. Fixed by changing the map value type to `std::shared_ptr<SAM_PLL>` and returning a `shared_ptr`; the object stays alive even after map erasure.

### `waterfall.cpp`
- **`ensure_monitor_thread_runs` TOCTOU spawns multiple monitor threads** — Multiple waterfall clients arriving simultaneously each observed `monitor_thread_running == false` and each spawned their own monitor thread, corrupting the kbits counter. Replaced the `if (!flag) spawn()` pattern with `std::call_once`, matching the pattern already used in `signal.cpp`.

### `websocket.cpp`
- **`send_basic_info` reads `markers` without the shared lock** — `check_and_update_markers()` writes `markers` under `std::unique_lock(markers_mutex)`, but `send_basic_info()` called `markers.dump()` with no lock, creating a data race. Wrapped the call in `std::shared_lock(markers_mutex)`.
- **Throttle maps accessed without mutexes** — `g_audio_throttle` and `g_waterfall_throttle` are plain `std::map`s accessed from `signal_loop`/`waterfall_loop` (one or more threads) and from WebSocket close handlers (a different io thread). Added `g_audio_throttle_mtx` and `g_waterfall_throttle_mtx` and locked all insert, lookup, and erase operations.
- **Self-capturing ping loop lambda — UB on first tick** — `std::function<void()> ping_loop` was captured by value into itself before assignment, so the lambda held an empty (default-constructed) function object. Calling it on the first timer tick is undefined behaviour and crashes. Rewrote using `shared_ptr<std::function<void()>>` so the lambda captures a pointer to the already-constructed function.

---

## 🟠 Medium Fixes

### `audioprocessing.cpp`
- **`hang_counter` decremented 5× per sample** — The decrement was inside the per-gain-stage `for` loop (5 iterations), so the hang timer expired 5× faster than configured. A 500 ms hang became ~100 ms. Moved the decrement outside the loop so it fires once per `applyProgressiveAGC` call.
- **Spectrum average O(N/2 × W) recomputed from scratch each block** — The inner `std::accumulate` iterated over all 32 history windows for each of 1024 bins on every 1536-sample block on the audio thread. Replaced with an incremental running-difference update: subtract the evicted window's bin values, add the new ones — O(N/2) instead of O(N/2 × W = 32768) per block.

### `chat.cpp`
- **`std::localtime` not thread-safe** — Returns a pointer to a shared static struct; concurrent chat messages race on it. Replaced with `localtime_r(&now_c, &tm_buf)`.
- **Whitespace-only username causes `npos+1` wrap** — `find_last_not_of` returns `std::string::npos` for an all-whitespace string; adding 1 wraps to 0 and `erase(0)` deletes the entire string. Guarded with an explicit `npos` check.

### `dsp.cpp`
- **Dead variables in `dsp_float_to_int16`** — `int minimum = 32767` and `int maximum = -32768` were declared and never read. Removed.

### `events.cpp`
- **TOCTOU race on `signal_changes`** — `get_event_info()` checked `signal_changes.size()` twice without holding `signal_changes_mtx`, while `broadcast_signal_changes` inserts under that mutex. Restructured to acquire the lock before both size checks.
- **`waterfall_kbits_per_second` reads updated to atomic load** — Following the type change in `waterfall.h`, both reads of `waterfall_kbits_per_second` updated to `.load(std::memory_order_relaxed)`.

### `fft.cpp`
- **`memcpy` on potentially overlapping IQ wrap buffer** — `memcpy(&fft_buffer[fft_result_size], &fft_buffer[0], ...)` is undefined behaviour if `fft_result_size < audio_max_fft_size`. Changed to `memmove`.

### `fft_impl.cpp`
- **Strict aliasing UB in `vec_log2`** — `uint32_t *bit_exponent = (uint32_t *)&val` type-puns through an incompatible pointer, which is undefined behaviour under C++ strict aliasing rules. Rewrote using `memcpy` round-trips to read and write the bit representation.

### `http.cpp`
- **`set_access_channels()` called per-request** — `m_server.set_access_channels(websocketpp::log::alevel::none)` modifies a global server-wide setting, not a per-connection one. Calling it inside `on_http` on every request is a race condition under concurrent HTTP requests. Removed; logging should be configured once at startup via `init_server()`.

### `spectrumserver.cpp`
- **`throw "string literal"` in 8 places** — Throwing a `const char*` bypasses any `catch(const std::exception&)` handler, causing silent `std::terminate`. All 8 replaced with `throw std::runtime_error(...)`.

### `waterfall.h` / `waterfall.cpp`
- **`waterfall_kbits_per_second` is a non-atomic `double`** — Written by the monitor thread, read by the events timer thread. A plain `double` write/read is not guaranteed atomic. Changed declaration to `std::atomic<double>` and write to `.store(std::memory_order_relaxed)`.

---

## Files With No Changes

`audio.h`, `audioprocessing.h`, `chat.h`, `client.cpp`, `client.h`, `compression.cpp`, `compression.h`, `dsp.h`, `events.h`, `fft.h`, `samplereader.cpp`, `samplereader.h`, `signal.h`, `spectrumserver.h`, `utils.cpp`, `utils.h`, `waterfallcompression.cpp`, `waterfallcompression.h`, `websocket.h`
