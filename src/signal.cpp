#include <complex.h>

#include "fft.h"
#include "signal.h"
#include "utils/dsp.h"

#include <atomic>
#include <chrono>
#include <thread>
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
    float  xm1 = 0.0f, ym1 = 0.0f; // DC blocker state
    double dc_a = 0.995;
    
    // Signal magnitude tracking for normalization
    float mag_avg = 1.0f;
    float mag_alpha = 0.01f;  // smoothing factor for magnitude

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
        xm1 = 0.0f;
        ym1 = 0.0f;
        mag_avg = 1.0f;
    }

    inline float wrap(float a) {
        while (a >  M_PI) a -= 2.0f * M_PI;
        while (a <= -M_PI) a += 2.0f * M_PI;
        return a;
    }

    inline float dcblock(float x) {
        float y = x - xm1 + (float)dc_a * ym1;
        xm1 = x; 
        ym1 = y;
        return y;
    }

    // process one IQ sample
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
        return dcblock(Ir * mag_avg);
    }

    void reset() {
        theta = 0.0;
        acc = 0.0;
        xm1 = 0.0f;
        ym1 = 0.0f;
        mag_avg = 1.0f;
    }
};

// Keep a per-AudioClient SAM_PLL instance without editing headers
static std::unordered_map<const void*, SAM_PLL> g_sam_by_client;

// Helper to get/create SAM for a client pointer
static SAM_PLL& get_sam(const void* key, double fs) {
    auto it = g_sam_by_client.find(key);
    if (it == g_sam_by_client.end()) {
        SAM_PLL sam; 
        sam.setup(fs, 50.0); // 50 Hz loop BW for good acquisition
        auto it2 = g_sam_by_client.emplace(key, sam);
        return it2.first->second;
    }
    // refresh fs if changed
    if (fabs(it->second.fs - fs) > 1.0) {
        it->second.setup(fs, 50.0);
    }
    return it->second;
}

// Cleanup SAM instance for a client
static void cleanup_sam(const void* key) {
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
            // During hold, keep the output clamped to the last "good" sample
            buf[i] = last;
            --hold;
        } else if (mag_sq > thr * thr) {
            // Detected an impulse: clamp this and a number of following samples
            buf[i] = last;
            hold = blank_len;
        } else {
            last = s;
        }
    }
}





std::atomic<bool> monitor_audio_thread_running{false};
std::atomic<size_t> total_audio_bits_sent{0}; // Atomic to safely increment from multiple clients
double audio_kbits_per_second = 0;

void monitor_audio_data_rate() {
    monitor_audio_thread_running = true;
    while (monitor_audio_thread_running) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        size_t bits = total_audio_bits_sent.exchange(0); // Reset counter and get value atomically
        audio_kbits_per_second = bits / 1000.0;
        //std::cout << "Data rate: " << kbits_per_second << " kbit/s" << std::endl;
    }
}

void ensure_audio_monitor_thread_runs() {
    if (!monitor_audio_thread_running) {
        std::thread(monitor_audio_data_rate).detach();
    }
}



AudioClient::AudioClient(connection_hdl hdl, PacketSender &sender,
                         audio_compressor audio_compression, bool is_real,
                         int audio_fft_size, int audio_max_sps,
                         int fft_result_size)
    : Client(hdl, sender, AUDIO), is_real{is_real},
      audio_fft_size{audio_fft_size}, fft_result_size{fft_result_size},
      audio_rate{audio_max_sps}, signal_slices{sender.get_signal_slices()},
      signal_slice_mtx{sender.get_signal_slice_mtx()} {

    if (audio_compression == AUDIO_FLAC) {
        std::unique_ptr<FlacEncoder> encoder =
            std::make_unique<FlacEncoder>(hdl, sender);
        encoder->set_channels(1);
        encoder->set_verify(false);
        encoder->set_compression_level(8);
        encoder->set_sample_rate(audio_rate);
        encoder->set_bits_per_sample(8);
        encoder->set_streamable_subset(true);
        encoder->init();
        this->encoder = std::move(encoder);
    }
#ifdef HAS_LIBOPUS
else if (audio_compression == AUDIO_OPUS) {
    std::cerr << "AudioClient: using OPUS encoder at "
              << audio_max_sps << " Hz\n";
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
    agc = AGC(0.1f, 100.0f, 30.0f, 100.0f, audio_max_sps);
    ma = MovingAverage<float>(10);
    mm = MovingMode<int>(10);

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

                // Synchronous AM demodulation with PLL (SAM)
                SAM_PLL& sam = get_sam(this, audio_rate);
                for (int i = 0; i < audio_fft_size / 2; i++) {
                    audio_real[i] = sam.step(
                        audio_complex_baseband[i].real(),
                        audio_complex_baseband[i].imag()
                    );
                }
            } else if (demodulation == FM) {
                // Polar discriminator for FM
                polar_discriminator_fm(audio_complex_baseband.get(), prev,
                                       audio_real.data(), audio_fft_size / 2);
            }
        }

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

        // AGC
        agc.process(audio_real.data(), audio_fft_size / 2);

        // Quantize into 16 bit audio to save bandwidth
        dsp_float_to_int16(audio_real.data(), audio_real_int16.data(),
                           65536 / 2, audio_fft_size / 2);

        // Set audio details
        encoder->set_data(frame_num, audio_l, audio_mid, audio_r,
                          average_power);

        // Encode audio and send it off
        encoder->process(audio_real_int16.data(), audio_fft_size / 2);

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
    // Update the demodulation type
    if (demodulation == "USB") {
        this->demodulation = USB;
    } else if (demodulation == "LSB") {
        this->demodulation = LSB;
    } else if (demodulation == "AM") {
        this->demodulation = AM;
    } else if (demodulation == "FM") {
        this->demodulation = FM;
    }
    
    // Reset AGC when changing demodulation modes
    this->agc.reset();
    
    // Reset SAM PLL when switching to AM mode
    if (demodulation == "AM") {
        SAM_PLL& sam = get_sam(this, audio_rate);
        sam.reset();
    }
}

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