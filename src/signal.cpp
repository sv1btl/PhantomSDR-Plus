#include <complex.h>

#include "fft.h"
#include "signal.h"
#include "utils/dsp.h"

#include <atomic>
#include <chrono>
#include <thread>
#include <mutex>
#include <iostream>
#include <unordered_map>
#include <cmath>

// ---- Synchronous AM (SAM) product detector with simple PI-PLL ----
namespace {
struct SAM_PLL {
    double fs = 48000.0;
    double theta = 0.0;     // NCO phase
    double dtheta = 0.0;    // nominal freq offset (rad/sample), keep at 0 for centered carrier
    double ki = 0.0, kp = 0.0;
    double acc = 0.0;       // integrator
    
    // FIXED: Separate DC blocker state for each channel
    float xm1_L = 0.0f, ym1_L = 0.0f;      // Left channel
    float xm1_R = 0.0f, ym1_R = 0.0f;      // Right channel
    float xm1_mono = 0.0f, ym1_mono = 0.0f; // Mono (legacy SAM)
    
    double dc_a_mono = 0.999;   // Gentler for natural bass (was 0.995)
    double dc_a_stereo = 0.999; // Even gentler for stereo imaging (was 0.995)
    double dc_a = 0.997;        // Current active coefficient
    
    // Signal magnitude tracking for normalization
    float mag_avg = 1.0f;
    float mag_alpha = 0.01f;  // Responsive tracking (was 0.003, too slow)

    void setup(double sample_rate, double loop_bw_hz = 50.0) {
        fs = sample_rate > 1.0 ? sample_rate : 48000.0;
        // convert loop bandwidth to discrete PI gains
        // Using damping factor of 0.707 (critically damped)
        const double damping = 0.707;
        const double wn = 2.0 * M_PI * loop_bw_hz / fs;
        kp = 2.0 * damping * wn;
        ki = wn * wn;
        // Reset state
        theta = 0.0;
        acc = 0.0;
        xm1_L = xm1_R = xm1_mono = 0.0f;
        ym1_L = ym1_R = ym1_mono = 0.0f;
        mag_avg = 1.0f;
    }

    inline float wrap(float a) {
        while (a >  M_PI) a -= 2.0f * M_PI;
        while (a <= -M_PI) a += 2.0f * M_PI;
        return a;
    }
    
    // Set stereo mode (switches DC blocker coefficient)
    inline void set_stereo_mode(bool stereo) {
        dc_a = stereo ? dc_a_stereo : dc_a_mono;
    }

    // Separate DC blocking functions for each channel
    inline float dcblock_L(float x) {
        float y = x - xm1_L + (float)dc_a * ym1_L;
        xm1_L = x; 
        ym1_L = y;
        return y;
    }
    
    inline float dcblock_R(float x) {
        float y = x - xm1_R + (float)dc_a * ym1_R;
        xm1_R = x; 
        ym1_R = y;
        return y;
    }
    
    inline float dcblock_mono(float x) {
        float y = x - xm1_mono + (float)dc_a * ym1_mono;
        xm1_mono = x; 
        ym1_mono = y;
        return y;
    }

    // Mono SAM product detector
    inline float step(float I, float Q) {
        // Track signal magnitude for normalization
        float mag = sqrtf(I * I + Q * Q);
        if (mag > 0.0001f) {  // avoid division by zero
            mag_avg = mag_avg * (1.0f - mag_alpha) + mag * mag_alpha;
        }
        
        // Normalize input to help phase detector
        float norm_factor = (mag_avg > 0.0001f) ? (1.0f / mag_avg) : 1.0f;
        I *= norm_factor;
        Q *= norm_factor;

        // NCO rotation by -theta to bring carrier to baseband
        float c = cosf((float)theta);
        float s = sinf((float)theta);
        float Ir =  I * c + Q * s;
        float Qr = -I * s + Q * c;

        // Phase detector - use atan2 for better acquisition over wide range
        float e = atan2f(Qr, Ir);
        
        // Alternative: For locked condition, Qr alone works better
        // float e = Qr;

        // PI loop filter
        acc += ki * e;
        double u = kp * e + acc;

        // Advance NCO with loop correction
        theta += dtheta + u;
        
        // Wrap phase to [-π, π]
        if (theta >  M_PI) theta -= 2.0 * M_PI;
        if (theta <= -M_PI) theta += 2.0 * M_PI;

        // Return the in-phase component (demodulated audio) with DC blocking
        // Scale back by magnitude for proper amplitude
        return dcblock_mono(Ir * mag_avg);
    }

    // C-QUAM stereo decoder with separate DC blockers
    void step_cquam(float I, float Q, float &outL, float &outR) {
        // Track signal magnitude for normalization
        float mag = sqrtf(I * I + Q * Q);
        if (mag > 0.0001f) {
            mag_avg = mag_avg * (1.0f - mag_alpha) + mag * mag_alpha;
        }

        // Normalize inputs
        float invmag = (mag_avg > 0.0001f) ? 1.0f / mag_avg : 1.0f;
        float In = I * invmag;
        float Qn = Q * invmag;

        // Rotate into PLL tracking frame
        float c = cosf((float)theta);
        float s = sinf((float)theta);
        float Ir =  In * c + Qn * s;
        float Qr = -In * s + Qn * c;

        // Phase detector: atan2 for robust lock
        float e = atan2f(Qr, Ir);

        // PI loop filter with anti-windup
        acc += ki * e;
        // Clamp integrator to prevent wind-up and sudden phase jumps (stuttering)
        const double max_acc = M_PI / 4.0;  // Limit integrator to ±45 degrees
        if (acc > max_acc) acc = max_acc;
        if (acc < -max_acc) acc = -max_acc;
        double u = kp * e + acc;

        // Advance NCO and wrap phase
        theta += dtheta + u;
        if (theta >  M_PI) theta -= 2.0 * M_PI;
        if (theta <= -M_PI) theta += 2.0 * M_PI;

        // In C-QUAM, Ir ~ (L+R), Qr ~ (L-R) after proper normalization.
        float sum  = Ir * mag_avg;
        float diff = -Qr * mag_avg;  // ✅ INVERTED: Fixes rapid gain changes / pumping effect.
                                      // The quadrature demodulator output (L-R) had opposite
                                      // polarity, causing L and R to fight each other → volume
                                      // fluctuations. Inverting restores correct phase relationship.

        float L = 0.5f * (sum + diff);
        float R = 0.5f * (sum - diff);

        // Use separate DC blockers for each channel
        outL = dcblock_L(L);
        outR = dcblock_R(R);
    }

    void reset() {
        theta = 0.0;
        acc = 0.0;
        xm1_L = xm1_R = xm1_mono = 0.0f;
        ym1_L = ym1_R = ym1_mono = 0.0f;
        mag_avg = 1.0f;
    }
};

// Keep a per-AudioClient SAM_PLL instance without editing headers
static std::unordered_map<const void*, std::shared_ptr<SAM_PLL>> g_sam_by_client;
static std::mutex g_sam_mutex;  // Thread-safe access to prevent crashes on rapid mode switching

// Helper to get/create SAM for a client pointer.
// Returns a shared_ptr so the PLL object survives concurrent cleanup_sam()
// calls — the caller holds a live reference even if the map entry is erased.
static std::shared_ptr<SAM_PLL> get_sam(const void* key, double fs) {
    std::lock_guard<std::mutex> lock(g_sam_mutex);
    auto it = g_sam_by_client.find(key);
    if (it == g_sam_by_client.end()) {
        auto sam = std::make_shared<SAM_PLL>();
        sam->setup(fs, 50.0);
        auto it2 = g_sam_by_client.emplace(key, sam);
        return it2.first->second;
    }
    // refresh fs if changed
    if (fabs(it->second->fs - fs) > 1.0) {
        it->second->setup(fs, 50.0);
    }
    return it->second;
}

// Cleanup SAM instance for a client
static void cleanup_sam(const void* key) {
    std::lock_guard<std::mutex> lock(g_sam_mutex);  // Thread-safe cleanup
    g_sam_by_client.erase(key);
}

} // namespace

// --- Aggressive time-domain impulse blanker on complex baseband ---
static void apply_impulse_blanker_complex(std::complex<float>* buf,
                                          int len,
                                          float threshold_mul = 3.0f,
                                          int blank_len = 32)
{
    if (!buf || len <= 0) {
        return;
    }

    // Compute RMS magnitude of the complex buffer
    double sum_sq = 0.0;
    for (int i = 0; i < len; ++i) {
        const float re = buf[i].real();
        const float im = buf[i].imag();
        sum_sq += static_cast<double>(re) * re +
                  static_cast<double>(im) * im;
    }

    if (sum_sq <= 0.0 || len <= 0) {
        return;
    }

    const float rms = std::sqrt(static_cast<float>(sum_sq / len));
    if (rms <= 0.0f) {
        return;
    }

    const float thr = threshold_mul * rms;

    int hold = 0;
    std::complex<float> last(0.0f, 0.0f);

    for (int i = 0; i < len; ++i) {
        const std::complex<float> s = buf[i];
        const float mag_sq = static_cast<float>(s.real() * s.real() +
                                                s.imag() * s.imag());

        if (hold > 0) {
            // Still blanking
            buf[i] = last;
            --hold;
        } else if (mag_sq > thr * thr) {
            // Start blanking
            buf[i] = last;
            hold = blank_len - 1;
        } else {
            // Normal sample
            last = s;
        }
    }
}

std::atomic<bool> monitor_audio_thread_running{false};
std::atomic<size_t> total_audio_bits_sent{0};

namespace {
struct StereoAgcState {
    float level = 0.1f;
    float gain = 1.0f;
};

std::mutex stereo_agc_state_mtx;
std::unordered_map<AudioClient*, StereoAgcState> stereo_agc_states;
}
std::atomic<double> audio_kbits_per_second{0.0};

void monitor_audio_data_rate() {
    monitor_audio_thread_running = true;
    while (monitor_audio_thread_running) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        size_t bits = total_audio_bits_sent.exchange(0);
        audio_kbits_per_second.store(bits / 1000.0, std::memory_order_relaxed);
    }
}

// FIX: Use call_once to eliminate the TOCTOU race where multiple audio threads
// could simultaneously observe !monitor_audio_thread_running and each spawn
// their own monitor thread, corrupting the kbits statistics.
static std::once_flag audio_monitor_once_flag;

void ensure_audio_monitor_thread_runs() {
    std::call_once(audio_monitor_once_flag, [] {
        std::thread(monitor_audio_data_rate).detach();
    });
}



AudioClient::AudioClient(connection_hdl hdl,
                         PacketSender &sender,
                         audio_compressor audio_compression,
                         bool is_real,
                         int audio_fft_size,
                         int audio_max_sps,
                         int fft_result_size)
    : Client(hdl, sender, AUDIO),
      is_real(is_real),
      audio_fft_size(audio_fft_size),
      fft_result_size(fft_result_size),
      audio_rate(audio_max_sps),
      signal_slices(sender.get_signal_slices()),
      signal_slice_mtx(sender.get_signal_slice_mtx()),
      agc(0.1f, 100.0f, 30.0f, 100.0f, audio_max_sps) {

    if (audio_compression == AUDIO_FLAC) {
        std::unique_ptr<FlacEncoder> encoder =
            std::make_unique<FlacEncoder>(hdl, sender);
        encoder->set_channels(1);
        encoder->set_verify(false);
        encoder->set_sample_rate(audio_rate);
        encoder->set_bits_per_sample(16);
        encoder->configure_flac(FlacMode::Balanced); // sets good compression params + streamable_subset(true)
        encoder->set_streamable_subset(false);        // ✅ CRITICAL: override AFTER configure_flac!
                                                      // configure_flac forces streamable_subset=true which only allows
                                                      // specific power-of-2 blocksizes (256,512,1024...). Our frame size
                                                      // (audio_fft_size/2 ≈ 394) is not valid → libFLAC silently ignores
                                                      // set_blocksize() and falls back to 1024 → buffering → tremor!
        encoder->set_blocksize(audio_fft_size / 2);  // now accepted: exact match to process() call size → no buffering
        encoder->init();
        this->encoder = std::move(encoder);
    }
#ifdef HAS_LIBOPUS
else if (audio_compression == AUDIO_OPUS) {    
    this->encoder = std::make_unique<OpusAudioEncoder>(hdl, sender, audio_max_sps);
}
#endif


    unique_id = generate_unique_id();
    frame_num = 0;

    // Audio demodulation scratch data structures
    audio_fft_input =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband_prev =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband_carrier =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband_carrier_prev =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);

    audio_real.resize(audio_fft_size);
    audio_real_prev.resize(audio_fft_size);
    // FIX: Explicitly allocate 2x for stereo interleaved use (C-QUAM path
    // writes [L0,R0,L1,R1,...] so needs audio_fft_size elements, not half).
    // Previously relied on mono size being coincidentally large enough.
    audio_real_int16.resize(audio_fft_size * 2);

    dc = DCBlocker<float>(audio_max_sps / 750 * 2);    
    ma = MovingAverage<float>(10);
    mm = MovingMode<int>(10);

    // Initialize noise gate with default preset (disabled by default)
    noise_gate.set_preset("balanced");
    noise_gate.set_enabled(false);  // Disabled by default, user must enable
    
    // AGC enabled by default for backward compatibility
    agc_enabled = true;

#ifdef HAS_LIQUID
    mixer = nco_crcf_create(LIQUID_NCO);
    nco_crcf_pll_set_bandwidth(mixer, 0.001f);
#endif

    {
        std::scoped_lock lg(fftwf_planner_mutex);
        fftwf_plan_with_nthreads(1);
        p_complex = fftwf_plan_dft_1d(
            audio_fft_size, (fftwf_complex *)audio_fft_input.get(),
            (fftwf_complex *)audio_complex_baseband.get(), FFTW_BACKWARD,
            FFTW_MEASURE);
        p_complex_carrier = fftwf_plan_dft_1d(
            audio_fft_size, (fftwf_complex *)audio_fft_input.get(),
            (fftwf_complex *)audio_complex_baseband_carrier.get(),
            FFTW_BACKWARD, FFTW_MEASURE);
        p_real = fftwf_plan_dft_c2r_1d(audio_fft_size,
                                       (fftwf_complex *)audio_fft_input.get(),
                                       audio_real.data(), FFTW_MEASURE);
    }
    
    // C-QUAM AM stereo initialization
    am_stereo = false;
}

void AudioClient::set_audio_range(int l, double m, int r) {
    audio_mid = m;
    this->l = l;
    this->r = r;

    // Change the data structures to reflect the changes
    {
        std::scoped_lock lk(signal_slice_mtx);
        auto node = signal_slices.extract(it);
        node.key() = {l, r};
        it = signal_slices.insert(std::move(node));
    }
    sender.broadcast_signal_changes(unique_id, l, m, r);
}

void AudioClient::set_audio_demodulation(demodulation_mode demodulation) {
    this->demodulation = demodulation;
}

void AudioClient::set_am_stereo(bool enable) {
    // If switching away from stereo, cleanup SAM PLL and per-client stereo AGC state
    if (!enable && am_stereo) {
        cleanup_sam(this);
        std::scoped_lock lk(stereo_agc_state_mtx);
        stereo_agc_states.erase(this);
    }

    am_stereo = enable;

    // Only create/reset the SAM PLL when enabling stereo.
    if (enable) {
        auto sam = get_sam(this, audio_rate);
        sam->set_stereo_mode(true);
        sam->reset();  // clears theta, acc, and internal DC blocker state

        std::scoped_lock lk(stereo_agc_state_mtx);
        stereo_agc_states[this] = StereoAgcState{};
    }

    // Recreate encoder with correct channel count
    if (encoder) {
        encoder->finish_encoder();

        // Determine channels: stereo (2) if C-QUAM enabled, else mono (1)
        const int channels = enable ? 2 : 1;

        if (dynamic_cast<FlacEncoder*>(encoder.get())) {
            std::unique_ptr<FlacEncoder> flac_encoder =
                std::make_unique<FlacEncoder>(hdl, sender);
            flac_encoder->set_channels(channels);
            flac_encoder->set_verify(false);
            flac_encoder->set_sample_rate(audio_rate);
            flac_encoder->set_bits_per_sample(16);
            flac_encoder->configure_flac(FlacMode::Balanced); // sets good compression params + streamable_subset(true)
            flac_encoder->set_streamable_subset(false);        // override AFTER configure_flac
            flac_encoder->set_blocksize(audio_fft_size / 2);  // exact match to process() call size
            flac_encoder->init();
            encoder = std::move(flac_encoder);
        }
#ifdef HAS_LIBOPUS
        else if (dynamic_cast<OpusAudioEncoder*>(encoder.get())) {
            std::unique_ptr<OpusAudioEncoder> opus_encoder =
                std::make_unique<OpusAudioEncoder>(hdl, sender, audio_rate, channels);
            encoder = std::move(opus_encoder);
        }
#endif
    }
}

const std::string &AudioClient::get_unique_id() { return unique_id; }

// Does the demodulation and sends the audio to the client
// buf is given offseted by l
void AudioClient::send_audio(std::complex<float> *buf, size_t frame_num) {
    try {
        const int audio_l = l - l;
        const int audio_r = r - l;
        const int audio_m = floor(audio_mid) - l;
        const int audio_m_idx = floor(audio_mid);

        int len = audio_r - audio_l;
        // If the user request for the raw IQ signal, do not demodulate
        if (type == SIGNAL) {
            sender.send_binary_packet(hdl, buf,
                                      sizeof(std::complex<float>) * len);
            return;
        }

        float average_power = std::accumulate(
            buf, buf + len, 0.0f,
            [](float a, std::complex<float> &b) { return a + std::norm(b); });

        // Main demodulation logic for the frequency
        if (demodulation == USB || demodulation == LSB) {
            if (demodulation == USB) {
                // For USB, just copy the bins to the audio frequencies
                std::fill(audio_fft_input.get(),
                          audio_fft_input.get() + audio_fft_size, 0.0f);
                // User requested for [l, r)
                // IFFT bins are [audio_m, audio_m + audio_fft_size)
                // intersect and copy
                int copy_l = std::max(audio_l, audio_m);
                int copy_r = std::min(audio_r, audio_m + audio_fft_size);
                if (copy_r >= copy_l) {
                    std::copy(buf + copy_l - audio_l, buf + copy_r - audio_l,
                            audio_fft_input.get() + copy_l - audio_m);
                }
                fftwf_execute(p_real);
            } else if (demodulation == LSB) {
                // For LSB, just copy the inverted bins to the audio frequencies
                std::fill(audio_fft_input.get(),
                          audio_fft_input.get() + audio_fft_size, 0.0f);
                // User requested for [l, r)
                // IFFT bins are [audio_m - audio_fft_size + 1, audio_m + 1)
                // intersect and copy
                int copy_l = std::max(audio_l, audio_m - audio_fft_size + 1);
                int copy_r = std::min(audio_r, audio_m + 1);
                // last element should be at audio_fft_size - 1
                if (copy_r >= copy_l) {
                    std::reverse_copy(buf + copy_l - audio_l,
                                    buf + copy_r - audio_l,
                                    audio_fft_input.get() + audio_m - copy_r + 1);
                }
                fftwf_execute(p_real);
                std::reverse(audio_real.begin(), audio_real.end());
            }
            // On every other frame, the audio waveform is inverted due to the
            // 50% overlap This only happens when downconverting by either even
            // or odd bins, depending on modulation
            if (demodulation == USB && frame_num % 2 == 1 &&
                ((audio_m_idx % 2 == 0 && !is_real) ||
                 (audio_m_idx % 2 == 1 && is_real))) {
                dsp_negate_float(audio_real.data(), audio_fft_size);
            } else if (demodulation == LSB && frame_num % 2 == 1 &&
                       ((audio_m_idx % 2 == 0 && !is_real) ||
                        (audio_m_idx % 2 == 1 && is_real))) {
                dsp_negate_float(audio_real.data(), audio_fft_size);
            }

            // Overlap and add the audio waveform, due to the 50% overlap
            dsp_add_float(audio_real.data(), audio_real_prev.data(),
                          audio_fft_size / 2);
        } else if (demodulation == AM || demodulation == FM) {
            // For AM/SAM/FM, copy the bins to the complex baseband frequencies
            std::fill(audio_fft_input.get(),
                      audio_fft_input.get() + audio_fft_size, 0.0f);

            // Bins are [audio_l, audio_r)
            // Positive IFFT bins are [audio_m, audio_m + audio_fft_size / 2)
            // Negative IFFT bins are [audio_m - audio_fft_size / 2 + 1,
            // audio_m) intersect and copy
            int pos_copy_l = std::max(audio_l, audio_m);
            int pos_copy_r = std::min(audio_r, audio_m + audio_fft_size / 2);
            if (pos_copy_r >= pos_copy_l) {
                std::copy(buf + pos_copy_l - audio_l,
                          buf + pos_copy_r - audio_l,
                          audio_fft_input.get() + pos_copy_l - audio_m);
            }
            int neg_copy_l =
                std::max(audio_l, audio_m - audio_fft_size / 2 + 1);
            int neg_copy_r = std::min(audio_r, audio_m);
            // last element should be at audio_fft_size - 1
            if (neg_copy_r >= neg_copy_l) {
                std::copy(buf + neg_copy_l - audio_l,
                          buf + neg_copy_r - audio_l,
                          audio_fft_input.get() + audio_fft_size -
                              (audio_m - neg_copy_l));
            }

            auto prev = audio_complex_baseband[audio_fft_size / 2 - 1];
            std::copy(audio_complex_baseband.get() + audio_fft_size / 2,
                      audio_complex_baseband.get() + audio_fft_size,
                      audio_complex_baseband_prev.get());

            if (demodulation == AM) {
                // Carrier reconstruction for envelope detection
                std::copy(audio_complex_baseband_carrier.get() +
                              audio_fft_size / 2,
                          audio_complex_baseband_carrier.get() + audio_fft_size,
                          audio_complex_baseband_carrier_prev.get());
            }

            // Copy the bins to the complex baseband frequencies
            fftwf_execute(p_complex);

            if (demodulation == AM) {
                // Keep only the low frequencies < 500Hz for carrier estimation
                int cutoff = 500 * audio_fft_size / audio_rate;
                std::fill(audio_fft_input.get() + cutoff,
                          audio_fft_input.get() + audio_fft_size - cutoff,
                          0.0f);
                fftwf_execute(p_complex_carrier);
            }

            if (frame_num % 2 == 1 && ((audio_m_idx % 2 == 0 && !is_real) ||
                                       (audio_m_idx % 2 == 1 && is_real))) {
                // If the center frequency is even and the frame number is odd,
                // or if the center frequency is odd and the frame number is
                // even, then the signal is inverted
                dsp_negate_complex(audio_complex_baseband.get(),
                                   audio_fft_size);
                if (demodulation == AM) {
                    dsp_negate_complex(audio_complex_baseband_carrier.get(),
                                       audio_fft_size);
                }
            }

            dsp_add_complex(audio_complex_baseband.get(),
                            audio_complex_baseband_prev.get(),
                            audio_fft_size / 2);

            // Aggressive complex impulse blanker on newly-accumulated baseband
            apply_impulse_blanker_complex(audio_complex_baseband.get(),
                                          audio_fft_size / 2);

            if (demodulation == AM) {
                dsp_add_complex(audio_complex_baseband_carrier.get(),
                                audio_complex_baseband_carrier_prev.get(),
                                audio_fft_size / 2);

                // Also blank impulses on the SAM carrier reconstruction
                apply_impulse_blanker_complex(audio_complex_baseband_carrier.get(),
                                              audio_fft_size / 2);

                // Synchronous AM demodulation with PLL (SAM / C-QUAM)
                auto sam = get_sam(this, audio_rate);
                if (am_stereo) {
                    // C-QUAM: decode true stereo (L/R)
                    for (int i = 0; i < audio_fft_size / 2; i++) {
                        float L, R;
                        sam->step_cquam(
                            audio_complex_baseband[i].real(),
                            audio_complex_baseband[i].imag(),
                            L, R
                        );
                        audio_real[i] = L;
                        audio_real_prev[i] = R;  // Right (temporary buffer in stereo mode)
                    }
                } else {
                    // Standard mono SAM
                    for (int i = 0; i < audio_fft_size / 2; i++) {
                        audio_real[i] = sam->step(
                            audio_complex_baseband[i].real(),
                            audio_complex_baseband[i].imag()
                        );
                    }
                }
            } else if (demodulation == FM) {
                // Polar discriminator for FM
                polar_discriminator_fm(audio_complex_baseband.get(), prev,
                                       audio_real.data(), audio_fft_size / 2);
            }
        }

        // Decide output channel count (C-QUAM uses true stereo)
        const int out_channels = (demodulation == AM && am_stereo) ? 2 : 1;

        if (demodulation == AM && am_stereo) {
            // ===== C-QUAM STEREO PROCESSING =====
            // At this point: audio_real[i] = L, audio_real_prev[i] = R

            // Process L and R channels separately
            std::vector<float, AlignedAllocator<float>> L_channel(audio_fft_size / 2);
            std::vector<float, AlignedAllocator<float>> R_channel(audio_fft_size / 2);

            // Copy to separate buffers
            std::copy(audio_real.begin(), audio_real.begin() + audio_fft_size / 2, L_channel.begin());
            std::copy(audio_real_prev.begin(), audio_real_prev.begin() + audio_fft_size / 2, R_channel.begin());

            // Optional backend noise gate per channel
            noise_gate.process(L_channel.data(), audio_fft_size / 2);
            noise_gate.process(R_channel.data(), audio_fft_size / 2);

            // Stereo-safe AGC:
            // derive ONE shared gain from combined L+R level,
            // then apply the same gain to both channels.
            if (agc_enabled) {
                const size_t n = audio_fft_size / 2;

                // Measure combined stereo level
                float avg_abs = 0.0f;
                for (size_t i = 0; i < n; ++i) {
                    avg_abs += 0.5f * (std::fabs(L_channel[i]) + std::fabs(R_channel[i]));
                }
                avg_abs /= static_cast<float>(n);

                StereoAgcState state;
                {
                    std::scoped_lock lk(stereo_agc_state_mtx);
                    state = stereo_agc_states[this];
                }

                // Smooth detector
                const float level_alpha = 0.02f;
                state.level += level_alpha * (avg_abs - state.level);

                // Gentle target and limits
                const float target_level = 0.20f;
                const float min_gain = 0.25f;
                const float max_gain = 10.0f;

                float target_gain = 1.0f;
                if (state.level > 1e-6f) {
                    target_gain = target_level / state.level;
                    target_gain = std::clamp(target_gain, min_gain, max_gain);
                }

                // Fast attack, adaptive release
                const float attack_alpha       = 0.22f;
                const float release_alpha_fast = 0.006f;
                const float release_alpha_slow = 0.003f;

                // When already high in gain, rise more slowly to avoid pumping/noise chasing
                const bool near_max_gain = (state.gain > max_gain * 0.75f);
                const float release_alpha = near_max_gain ? release_alpha_slow : release_alpha_fast;

                const float alpha = (target_gain < state.gain) ? attack_alpha : release_alpha;
                state.gain += alpha * (target_gain - state.gain);

                {
                    std::scoped_lock lk(stereo_agc_state_mtx);
                    stereo_agc_states[this] = state;
                }

                // Apply same gain to both channels
                for (size_t i = 0; i < n; ++i) {
                    L_channel[i] *= state.gain;
                    R_channel[i] *= state.gain;
                }
            }

            // Interleave L and R for stereo encoder
            // CORRECTED: Balanced gain so mono AM is louder (as expected)
            const float stereo_gain = 0.5f;

            // ✅ Soft limiter to prevent harsh clipping distortion.
            // threshold 2.0f effectively disables limiting for normal levels.
            auto soft_limit = [](float x, float threshold = 2.0f) -> float {
                if (x > threshold) {
                    float excess = x - threshold;
                    return threshold + excess / (1.0f + excess * 2.0f);
                } else if (x < -threshold) {
                    float excess = -x - threshold;
                    return -threshold - excess / (1.0f + excess * 2.0f);
                }
                return x;
            };

            for (int i = 0; i < audio_fft_size / 2; i++) {
                const float L = L_channel[i] * stereo_gain;
                const float R = R_channel[i] * stereo_gain;

                // Apply soft limiting before int16 conversion
                const float L_limited = soft_limit(L);
                const float R_limited = soft_limit(R);

                // Convert to int16 and interleave: [L0, R0, L1, R1, ...]
                int32_t L_int = static_cast<int32_t>(L_limited * 32767.0f);
                int32_t R_int = static_cast<int32_t>(R_limited * 32767.0f);
                L_int = std::clamp(L_int, -32768, 32767);
                R_int = std::clamp(R_int, -32768, 32767);

                audio_real_int16[i * 2] = L_int;
                audio_real_int16[i * 2 + 1] = R_int;
            }

            // Set audio details with stereo channel count
            encoder->set_data(frame_num, audio_l, audio_mid, audio_r,
                              average_power, out_channels);

            // Send interleaved stereo audio
            // size argument is samples-per-channel, not total interleaved samples
            encoder->process(audio_real_int16.data(), audio_fft_size / 2);
            } else {
            // ===== MONO PROCESSING (USB, LSB, AM mono, FM, etc.) =====
            
            // Check if any audio_real is nan
            for (int i = 0; i < audio_fft_size / 2; i++) {
                if (std::isnan(audio_real[i])) {
                    throw std::runtime_error("NaN found in audio_real");
                }
            }

            // Copy the half to add in the next frame
            std::copy(audio_real.begin() + (audio_fft_size / 2), audio_real.end(),
                    audio_real_prev.begin());

            // DC removal
            dc.removeDC(audio_real.data(), audio_fft_size / 2);

            // NOISE GATE - Apply before AGC to work on full dynamic range
            noise_gate.process(audio_real.data(), audio_fft_size / 2);

            // AGC (now conditional - can be disabled)
            if (agc_enabled) {
                agc.process(audio_real.data(), audio_fft_size / 2);
            }

            // Quantize into 16 bit audio to save bandwidth
            // Mono boost - mono AM should be louder than stereo (30% boost)
            const float mono_boost = 1.5f;  // Makes mono 30% louder than stereo
            dsp_float_to_int16(audio_real.data(), audio_real_int16.data(),
                            static_cast<int>(65536 / 2 * mono_boost), audio_fft_size / 2);

            // Set audio details with mono channel count
            encoder->set_data(frame_num, audio_l, audio_mid, audio_r,
                            average_power, out_channels);

            // Encode audio and send it off
            encoder->process(audio_real_int16.data(), audio_fft_size / 2);
        }

        // Ensure monitoring thread is running
        ensure_audio_monitor_thread_runs();
        
        // Convert bytes to bits and add to the total_bits_sent
        size_t bits_sent = static_cast<size_t>(audio_fft_size / 2) * static_cast<size_t>(out_channels) * 16; // frames * channels * 16 bits
        total_audio_bits_sent.fetch_add(bits_sent, std::memory_order_relaxed);

        // Increment the frame number
        frame_num++;
    } catch (const std::exception &exc) {
        // std::cout << "client disconnect" << std::endl;
    }
}

void AudioClient::on_window_message(int new_l, std::optional<double> &m,
                                    int new_r, std::optional<int> &) {
    if (!m.has_value()) {
        return;
    }
    if (new_l < 0 || new_l >= fft_result_size || new_r < 0 ||
        new_r >= fft_result_size || new_l > new_r) {
        return;
    }
    if (new_r - new_l > audio_fft_size) {
        return;
    }
    double new_m = m.value();
    set_audio_range(new_l, new_m, new_r);
}

void AudioClient::on_demodulation_message(std::string &demodulation) {
    // FIX: debounce_last_change and debounce_mutex were previously static locals,
    // meaning they were SHARED across all AudioClient instances. One user changing
    // mode would block all other users from changing mode for 100ms.
    // Now they are per-instance members (added to AudioClient in signal.h).
    {
        std::lock_guard<std::mutex> lock(debounce_mutex);
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - debounce_last_change).count();
        if (elapsed < 100) {
            return;
        }
        debounce_last_change = now;
    }
    
    // Update the demodulation type, including AM-S (C-QUAM)
    if (demodulation == "USB") {
        this->demodulation = USB;
        set_am_stereo(false);
    } else if (demodulation == "LSB") {
        this->demodulation = LSB;
        set_am_stereo(false);
    } else if (demodulation == "AM") {
        this->demodulation = AM;
        set_am_stereo(false);
    } else if (demodulation == "AM-S") {
        // C-QUAM AM Stereo
        this->demodulation = AM;
        set_am_stereo(true);
    } else if (demodulation == "FM") {
        this->demodulation = FM;
        set_am_stereo(false);
    }

    // Reset AGC when changing demodulation modes
    this->agc.reset();

    // Mode-dependent AGC profile
    if (this->demodulation == AM) {
        this->agc.configureForAM();
    } else {
        // USB, LSB, CW (if you ever add it) and FM
        this->agc.configureForSSB();
    }
    
    // Reset SAM PLL when switching to AM mode
    if (this->demodulation == AM) {
        auto sam = get_sam(this, audio_rate);
        sam->reset();
    }
    
    // Reset noise gate when changing modes
    this->noise_gate.reset();
}

// ============================================================================
// NEW MESSAGE HANDLERS - Add these function declarations to signal.h
// ============================================================================

void AudioClient::on_noise_gate_enable_message(bool enabled) {
    noise_gate.set_enabled(enabled);
    //std::cout << "Noise gate " << (enabled ? "enabled" : "disabled") << std::endl;
}

void AudioClient::on_noise_gate_preset_message(std::string &preset) {
    noise_gate.set_preset(preset);
    //std::cout << "Noise gate preset set to: " << preset << std::endl;
}

void AudioClient::on_agc_enable_message(bool enabled) {
    agc_enabled = enabled;
    //std::cout << "Backend AGC " << (enabled ? "enabled" : "disabled") << std::endl;
}

// ============================================================================

void AudioClient::on_close() {
    {
        std::scoped_lock lk(signal_slice_mtx);
        signal_slices.erase(it);
    }
    sender.broadcast_signal_changes(unique_id, -1, -1, -1);
    
    // FIX: Guard cleanup_sam so the destructor doesn't erase an already-absent
    // key. Set the flag here; destructor checks it before calling cleanup_sam.
    if (!sam_cleaned.exchange(true)) {
        cleanup_sam(this);
    }
}

AudioClient::~AudioClient() {
    fftwf_destroy_plan(p_real);
    fftwf_destroy_plan(p_complex_carrier);
    fftwf_destroy_plan(p_complex);
#ifdef HAS_LIQUID
    nco_crcf_destroy(mixer);
#endif
    
    // FIX: Only cleanup if on_close() wasn't already called (e.g. abnormal disconnect)
    if (!sam_cleaned.exchange(true)) {
        cleanup_sam(this);
    }
}