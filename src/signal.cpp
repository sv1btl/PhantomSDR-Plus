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
static std::unordered_map<const void*, SAM_PLL> g_sam_by_client;
static std::mutex g_sam_mutex;  // Thread-safe access to prevent crashes on rapid mode switching

// Helper to get/create SAM for a client pointer
static SAM_PLL& get_sam(const void* key, double fs) {
    std::lock_guard<std::mutex> lock(g_sam_mutex);  // Protect against race conditions
    auto it = g_sam_by_client.find(key);
    if (it == g_sam_by_client.end()) {
        SAM_PLL sam; 
        sam.setup(fs, 50.0); // 50 Hz for proper AM stereo tracking (was 20 Hz, too slow)
        auto it2 = g_sam_by_client.emplace(key, sam);
        return it2.first->second;
    }
    // refresh fs if changed
    if (fabs(it->second.fs - fs) > 1.0) {
        it->second.setup(fs, 50.0);  // 50 Hz (was 20 Hz)
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
std::atomic<double> audio_kbits_per_second{0.0};  // Made atomic for thread safety

void monitor_audio_data_rate() {
    monitor_audio_thread_running = true;
    while (monitor_audio_thread_running) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        size_t bits = total_audio_bits_sent.exchange(0);
        audio_kbits_per_second.store(bits / 1000.0, std::memory_order_relaxed);  // Use atomic store
    }
}

void ensure_audio_monitor_thread_runs() {
    if (!monitor_audio_thread_running) {
        std::thread(monitor_audio_data_rate).detach();
    }
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
    audio_real_int16.resize(audio_fft_size);

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
    // If switching away from stereo, cleanup SAM PLL to prevent crashes
    if (!enable && am_stereo) {
        cleanup_sam(this);
    }
    
    am_stereo = enable;
    
    // Reset PLL state when toggling stereo and switch DC blocker mode
    SAM_PLL& sam = get_sam(this, audio_rate);
    sam.set_stereo_mode(enable);  // Switch to stereo or mono DC coefficient
    sam.reset();
    
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
            flac_encoder->set_streamable_subset(false);        // ✅ CRITICAL: override AFTER configure_flac (see mono encoder comment)
            flac_encoder->set_blocksize(audio_fft_size / 2);  // exact match to process() call size → no buffering → no tremor
            flac_encoder->init();
            encoder = std::move(flac_encoder);
            // std::cout << "[C-QUAM] FLAC encoder recreated with " << channels 
            //          << " channel(s) for " << (enable ? "stereo" : "mono") << " mode\n";
        }
#ifdef HAS_LIBOPUS
        else if (dynamic_cast<OpusAudioEncoder*>(encoder.get())) {
            std::unique_ptr<OpusAudioEncoder> opus_encoder =
                std::make_unique<OpusAudioEncoder>(hdl, sender, audio_rate, channels);
            encoder = std::move(opus_encoder);
            // std::cout << "[C-QUAM] Opus encoder recreated with " << channels 
            //          << " channel(s) for " << (enable ? "stereo" : "mono") << " mode\n";
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
                SAM_PLL& sam = get_sam(this, audio_rate);
                if (am_stereo) {
                    // C-QUAM: decode true stereo (L/R)
                    for (int i = 0; i < audio_fft_size / 2; i++) {
                        float L, R;
                        sam.step_cquam(
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
                        audio_real[i] = sam.step(
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
            

            /*
            // ===== ✅ LIGHT COMPRESSOR FOR C-QUAM =====

            static float rms_L = 0.0f;           
            static float rms_R = 0.0f;           
            static float current_gain_L = 1.0f;  
            static float current_gain_R = 1.0f;  

            // LIGHT Compressor parameters
            const float stage1_threshold = 0.08f;   // Higher (was 0.05) - only very weak signals
            const float stage1_ratio = 2.5f;        // Gentler (was 4.0) - light boost
            const float stage2_threshold = 0.20f;   // Higher (was 0.12) - moderate signals
            const float stage2_ratio = 1.5f;        // Very gentle (was 2.5) - minimal boost
            const float stage3_threshold = 0.40f;   // Higher (was 0.30) - most signals natural
            const float stage3_ratio = 1.1f;        // Almost none (was 1.2) - barely there

            // Ultra-smooth timing for maximum transparency
            const float rms_alpha = 0.00001f;       // Slower (was 0.00002) - 2 second tracking
            const float attack_coeff = 0.0001f;     // Gentler (was 0.0002) - 200ms attack
            const float release_coeff = 0.000001f;  // Ultra-slow (was 0.000002) - 20 second release!
            const float gain_smooth = 0.95f;        // More smoothing (was 0.9) - imperceptible

            const size_t block_size = audio_fft_size / 2;

            for (size_t i = 0; i < block_size; i++) {
                // === L CHANNEL ===
                float L_sq = L_channel[i] * L_channel[i];
                rms_L += rms_alpha * (L_sq - rms_L);
                float L_rms = sqrtf(rms_L + 1e-12f);
                
                float target_gain_L = 1.0f;
                if (L_rms < stage1_threshold) {
                    float ratio = L_rms / (stage1_threshold + 1e-6f);
                    target_gain_L = stage1_ratio * (1.0f - ratio) + ratio;
                } else if (L_rms < stage2_threshold) {
                    float ratio = (L_rms - stage1_threshold) / (stage2_threshold - stage1_threshold + 1e-6f);
                    target_gain_L = stage2_ratio * (1.0f - ratio) + ratio;
                } else if (L_rms < stage3_threshold) {
                    float ratio = (L_rms - stage2_threshold) / (stage3_threshold - stage2_threshold + 1e-6f);
                    target_gain_L = stage3_ratio * (1.0f - ratio) + ratio;
                }
                
                if (target_gain_L < current_gain_L) {
                    current_gain_L += attack_coeff * (target_gain_L - current_gain_L);
                } else {
                    current_gain_L += release_coeff * (target_gain_L - current_gain_L);
                }
                
                static float smoothed_gain_L = 1.0f;
                smoothed_gain_L += gain_smooth * (current_gain_L - smoothed_gain_L);
                
                L_channel[i] *= smoothed_gain_L;
                
                // === R CHANNEL (same process) ===
                float R_sq = R_channel[i] * R_channel[i];
                rms_R += rms_alpha * (R_sq - rms_R);
                float R_rms = sqrtf(rms_R + 1e-12f);
                
                float target_gain_R = 1.0f;
                if (R_rms < stage1_threshold) {
                    float ratio = R_rms / (stage1_threshold + 1e-6f);
                    target_gain_R = stage1_ratio * (1.0f - ratio) + ratio;
                } else if (R_rms < stage2_threshold) {
                    float ratio = (R_rms - stage1_threshold) / (stage2_threshold - stage1_threshold + 1e-6f);
                    target_gain_R = stage2_ratio * (1.0f - ratio) + ratio;
                } else if (R_rms < stage3_threshold) {
                    float ratio = (R_rms - stage2_threshold) / (stage3_threshold - stage2_threshold + 1e-6f);
                    target_gain_R = stage3_ratio * (1.0f - ratio) + ratio;
                }
                
                if (target_gain_R < current_gain_R) {
                    current_gain_R += attack_coeff * (target_gain_R - current_gain_R);
                } else {
                    current_gain_R += release_coeff * (target_gain_R - current_gain_R);
                }
                
                static float smoothed_gain_R = 1.0f;
                smoothed_gain_R += gain_smooth * (current_gain_R - smoothed_gain_R);
                
                R_channel[i] *= smoothed_gain_R;
            }
            // ===== ✅ END LIGHT COMPRESSOR =====
            */

            
            /*
            // ===== ✅ LIGHT AGC FOR C-QUAM =====

            // Static state - persists between calls for smooth tracking
            static float agc_level = 0.3f;        // Current average level tracker
            static float agc_gain = 1.0f;         // Current AGC gain multiplier
            
            // AGC parameters - VERY GENTLE!
            const float agc_target = 0.40f;       // Good output (40%)
            const float agc_max_gain = 3.0f;      // Can boost (3×)
            const float agc_min_gain = 0.4f;      // Can reduce (0.4×)
            const float agc_alpha = 0.00005f;     // Fast tracking (400ms)
            const float agc_gain_alpha = 0.000005f;// VERY SLOW RELEASE (4 seconds!)
            
            // Calculate average level from both channels (stereo-aware)
            float block_avg = 0.0f;
            const size_t agc_samples = audio_fft_size / 2;
            for (size_t i = 0; i < agc_samples; i++) {
                // Use sum of L+R absolute values (stereo total energy)
                float sample_energy = (std::abs(L_channel[i]) + std::abs(R_channel[i])) * 0.5f;
                block_avg += sample_energy;
            }
            block_avg /= agc_samples;
            
            // Smooth level tracking (ultra-slow for transparency)
            agc_level += agc_alpha * (block_avg - agc_level);
            
            // Calculate desired gain (very gentle adjustment)
            float target_gain = 1.0f;
            if (agc_level > 1e-6f) {  // Avoid division by zero
                target_gain = agc_target / agc_level;
                // Clamp to safe range (prevent over-amplification)
                target_gain = std::clamp(target_gain, agc_min_gain, agc_max_gain);
            }
            
            // Ultra-slow gain adjustment (no pumping/breathing)
            agc_gain += agc_gain_alpha * (target_gain - agc_gain);
            
            // Apply same gentle gain to both channels (preserves stereo image!)
            for (size_t i = 0; i < agc_samples; i++) {
                L_channel[i] *= agc_gain;
                R_channel[i] *= agc_gain;
            }
            // ===== ✅ END VERY LIGHT AGC =====
            */
            
            
            // Interleave L and R for stereo encoder
            // CORRECTED: Balanced gain so mono AM is louder (as expected)
            const float stereo_gain = 0.5f;  // CORRECTED: Changed from 1.2 to 0.2
            
            // ✅ Soft limiter to prevent harsh clipping distortion.float threshold = 0.85 - 0.99 - Lower if compressed, higher if not. Value 2.0f dissables Limiter
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
                L_int = std::clamp(L_int, -32768, 32767);  // Final safety clamp
                R_int = std::clamp(R_int, -32768, 32767);
                
                audio_real_int16[i * 2] = L_int;
                audio_real_int16[i * 2 + 1] = R_int;
            }
            
            // Set audio details with stereo channel count
            encoder->set_data(frame_num, audio_l, audio_mid, audio_r,
                            average_power, out_channels);
            
            // Send interleaved stereo audio (size is now samples-per-channel, not total samples)
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
        size_t bits_sent = (audio_fft_size / 2) * 4; // Convert bytes to bits
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
    // Debounce rapid mode changes to prevent crashes (minimum 100ms between changes)
    static std::chrono::steady_clock::time_point last_change = 
        std::chrono::steady_clock::now();
    static std::mutex debounce_mutex;
    
    {
        std::lock_guard<std::mutex> lock(debounce_mutex);
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - last_change).count();
        
        // Ignore changes faster than 100ms to prevent crashes
        if (elapsed < 100) {
            return;
        }
        last_change = now;
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
        SAM_PLL& sam = get_sam(this, audio_rate);
        sam.reset();
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
    
    // Clean up SAM PLL instance for this client
    cleanup_sam(this);
}

AudioClient::~AudioClient() {
    fftwf_destroy_plan(p_real);
    fftwf_destroy_plan(p_complex_carrier);
    fftwf_destroy_plan(p_complex);
#ifdef HAS_LIQUID
    nco_crcf_destroy(mixer);
#endif
    
    // Clean up SAM PLL instance
    cleanup_sam(this);
}