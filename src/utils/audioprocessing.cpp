#include "audioprocessing.h"
#include <cmath>
#include <algorithm>
#include <mutex>  // ✅ ADDED: For std::mutex

// ✅ FIXED: Local mutex for FFTW thread safety in audioprocessing
// This avoids dependency on fft.h and provides thread-safe FFTW plan operations
namespace {
    std::mutex g_audioprocessing_fftw_mutex;
}


AGC::AGC(float desiredLevel, float attackTimeMs, float releaseTimeMs, float lookAheadTimeMs, float sr)
    : desired_level(desiredLevel), sample_rate(sr) {

    // Look-ahead buffer in samples
    look_ahead_samples = static_cast<size_t>(lookAheadTimeMs * sample_rate / 1000.0f);

    // Base attack/release time constants (per-sample coefficients)
    attack_coeff  = 1.0f - std::exp(-1.0f / (attackTimeMs  * 0.001f * sample_rate));
    release_coeff = 1.0f - std::exp(-1.0f / (releaseTimeMs * 0.003f * sample_rate));
    
    // Multiple gain stages (RF, IF1, IF2, IF3, Audio) – kept for future use
    gains.resize(5, 1.0f);

    // Limit how loud AGC can go (effective max_lin_gain ≈ max_gain * 0.01)
    max_gain = 500.0f;  // → max_lin_gain ≈ 5× (~+8 dB)

    // Dual time constant (fast branch, common to all modes)
    fast_attack_coeff = 1.0f - std::exp(-1.0f / (0.003f * sample_rate)); // ~3 ms

    // ▼ Default profile: SSB / CW (more agile speech AGC)
    configureForSSB();
    // ▲ Caller can later call configureForAM() when demod is AM

    // Initialize Noise Blanker parameters
    nb_enabled = false;
    nb_fft_size = 2048; // Profile 1 Audio.js
    nb_overlap = 1536; 
    nb_average_windows = 32; 
    nb_threshold = 0.140f; 
    
    // Additional NB parameters (from header)
    nb_window_size = 2048;
    nb_threshold_factor = 0.140f;  // Matches nb_threshold
    nb_smoothing_factor = 0.1f;
    
    nb_buffer.resize(nb_fft_size);
    nb_spectrum_history.resize(nb_average_windows, std::vector<float>(nb_fft_size / 2));
    nb_spectrum_average.resize(nb_fft_size / 2);
    nb_history_index = 0;

    // ✅ FIXED: Allocate FFTW memory
    nb_fft_in = fftwf_alloc_complex(nb_fft_size);
    nb_fft_out = fftwf_alloc_complex(nb_fft_size);
    
    // ✅ CRITICAL FIX: Create FFTW plans with mutex protection for thread safety
    // FFTW planner is NOT thread-safe, so we must protect all plan operations
    {
        std::scoped_lock lock(g_audioprocessing_fftw_mutex);
        nb_fft_plan = fftwf_plan_dft_1d(nb_fft_size, nb_fft_in, nb_fft_out, FFTW_FORWARD, FFTW_ESTIMATE);
        nb_ifft_plan = fftwf_plan_dft_1d(nb_fft_size, nb_fft_out, nb_fft_in, FFTW_BACKWARD, FFTW_ESTIMATE);
    }
    
    // ✅ CRITICAL FIX: Validate that FFTW plans were created successfully
    if (!nb_fft_plan || !nb_ifft_plan) {
        std::cerr << "ERROR: Failed to create FFTW plans for AGC Noise Blanker" << std::endl;
        // Clean up partial resources
        {
            std::scoped_lock lock(g_audioprocessing_fftw_mutex);
            if (nb_fft_plan) {
                fftwf_destroy_plan(nb_fft_plan);
                nb_fft_plan = nullptr;
            }
            if (nb_ifft_plan) {
                fftwf_destroy_plan(nb_ifft_plan);
                nb_ifft_plan = nullptr;
            }
        }
        if (nb_fft_in) {
            fftwf_free(nb_fft_in);
            nb_fft_in = nullptr;
        }
        if (nb_fft_out) {
            fftwf_free(nb_fft_out);
            nb_fft_out = nullptr;
        }
        throw std::runtime_error("FFTW plan creation failed in AGC constructor");
    }
    
    reset();
}

// ✅ CRITICAL FIX: Destructor with proper FFTW cleanup and thread safety
AGC::~AGC() {
    // Destroy FFTW plans with mutex protection for thread safety
    {
        std::scoped_lock lock(g_audioprocessing_fftw_mutex);
        if (nb_fft_plan) {
            fftwf_destroy_plan(nb_fft_plan);
            nb_fft_plan = nullptr;
        }
        if (nb_ifft_plan) {
            fftwf_destroy_plan(nb_ifft_plan);
            nb_ifft_plan = nullptr;
        }
    }
    
    // Free FFTW-allocated memory (thread-safe, no lock needed)
    if (nb_fft_in) {
        fftwf_free(nb_fft_in);
        nb_fft_in = nullptr;
    }
    if (nb_fft_out) {
        fftwf_free(nb_fft_out);
        nb_fft_out = nullptr;
    }
}

// --------------------------------------------------------------------------
// Mode-dependent AGC profiles
// --------------------------------------------------------------------------

// SSB / CW: smoother speech handling (unchanged)
void AGC::configureForSSB() {
    hang_time      = static_cast<size_t>(0.50f * sample_rate);  // mild hold; avoids syllable pumping
    hang_threshold = 0.15f;                                     // trigger hang at normal speech level
    am_attack_coeff  = attack_coeff * 0.5f;                     // moderate peak control
    am_release_coeff = release_coeff * 0.15f;                   // gentle gain-up; smoother audio
}

// AM broadcast: TIGHTER - very stable level, aggressive control, minimal movement
void AGC::configureForAM() {
    hang_time      = static_cast<size_t>(1.0f * sample_rate);   // 1 second hold (was 0.5s)
    hang_threshold = 0.25f;                                     // engage hang more often (was 0.20)
    am_attack_coeff  = attack_coeff * 0.5f;                     // faster peak control (was 0.5)
    am_release_coeff = release_coeff * 0.15f;                   // ultra-slow gain-up (was 0.15)
}

// --------------------------------------------------------------------------
// Lookahead buffer management
// --------------------------------------------------------------------------

void AGC::push(float sample) {
    lookahead_buffer.push_back(sample);
    while (!lookahead_max.empty() && std::abs(lookahead_max.back()) < std::abs(sample)) {
        lookahead_max.pop_back();
    }
    lookahead_max.push_back(sample);

    if (lookahead_buffer.size() > look_ahead_samples) {
        pop();
    }
}

void AGC::pop() {
    float sample = lookahead_buffer.front();
    lookahead_buffer.pop_front();
    if (!lookahead_max.empty() && sample == lookahead_max.front()) {
        lookahead_max.pop_front();
    }
}

float AGC::max() {
    return lookahead_max.empty() ? 0.0f : std::abs(lookahead_max.front());
}

// --------------------------------------------------------------------------
// Noise Blanker Implementation
// --------------------------------------------------------------------------

void AGC::applyNoiseBlanker(std::vector<float>& buffer) {
    // Check if NB is enabled AND plans are valid before processing
    if (!nb_enabled.load(std::memory_order_relaxed) || !nb_fft_plan || !nb_ifft_plan) {
        return;
    }

    std::vector<float> processed_buffer(buffer.size());
    const float norm = 1.0f / static_cast<float>(nb_fft_size);  // FIX 1: IFFT normalisation factor

    for (size_t i = 0; i < buffer.size(); i += nb_overlap) {
        // FIX 3: Copy available samples then ZERO-PAD the remainder so the
        // FFT never sees stale data from the previous iteration.
        size_t copy_size = std::min(nb_fft_size, buffer.size() - i);
        std::copy(buffer.begin() + i, buffer.begin() + i + copy_size, nb_buffer.begin());
        if (copy_size < nb_fft_size) {
            std::fill(nb_buffer.begin() + copy_size, nb_buffer.end(), 0.0f);
        }

        // Load as real-valued complex input (imaginary = 0)
        for (size_t j = 0; j < nb_fft_size; ++j) {
            nb_fft_in[j][0] = nb_buffer[j];
            nb_fft_in[j][1] = 0.0f;
        }
        fftwf_execute(nb_fft_plan);

        // Calculate magnitude spectrum (positive frequencies only)
        std::vector<float> magnitude_spectrum(nb_fft_size / 2);
        for (size_t j = 0; j < nb_fft_size / 2; ++j) {
            magnitude_spectrum[j] = std::sqrt(nb_fft_out[j][0] * nb_fft_out[j][0] +
                                              nb_fft_out[j][1] * nb_fft_out[j][1]);
        }

        // FIX 4: Incremental running-difference average update — O(N/2) instead of O(N/2 × W)
        // Subtract the bin that is being evicted, add the new bin.
        for (size_t j = 0; j < nb_fft_size / 2; ++j) {
            nb_spectrum_average[j] +=
                (magnitude_spectrum[j] - nb_spectrum_history[nb_history_index][j])
                / static_cast<float>(nb_average_windows);
        }
        nb_spectrum_history[nb_history_index] = magnitude_spectrum;
        nb_history_index = (nb_history_index + 1) % nb_average_windows;

        // Derive threshold from average spectral level
        float avg_signal_level = std::accumulate(nb_spectrum_average.begin(),
                                                 nb_spectrum_average.end(), 0.0f)
                                 / static_cast<float>(nb_spectrum_average.size());
        float dynamic_threshold = nb_threshold * avg_signal_level;

        // Scale spectral bins and FIX 2: apply the SAME scale to the
        // conjugate-symmetric upper half so the IFFT output stays real.
        // DC (j=0) and Nyquist (j=N/2) are self-conjugate — scale once.
        {
            // DC bin
            float ratio0 = magnitude_spectrum[0] / (nb_spectrum_average[0] + 1e-12f);
            float scale0 = ratio0 > 1.0f ? 1.0f / std::pow(ratio0, 0.5f) : 1.0f;
            nb_fft_out[0][0] *= scale0;
            nb_fft_out[0][1] *= scale0;

            // Positive + mirrored negative frequencies
            for (size_t j = 1; j < nb_fft_size / 2; ++j) {
                float ratio = magnitude_spectrum[j] / (nb_spectrum_average[j] + 1e-12f);
                float scale = ratio > 1.0f ? 1.0f / std::pow(ratio, 0.5f) : 1.0f;
                nb_fft_out[j][0] *= scale;
                nb_fft_out[j][1] *= scale;
                // Mirror to conjugate-symmetric bin
                nb_fft_out[nb_fft_size - j][0] *= scale;
                nb_fft_out[nb_fft_size - j][1] *= scale;
            }

            // Nyquist bin
            float ratioN = magnitude_spectrum[nb_fft_size / 2 - 1]
                           / (nb_spectrum_average[nb_fft_size / 2 - 1] + 1e-12f);
            float scaleN = ratioN > 1.0f ? 1.0f / std::pow(ratioN, 0.5f) : 1.0f;
            nb_fft_out[nb_fft_size / 2][0] *= scaleN;
            nb_fft_out[nb_fft_size / 2][1] *= scaleN;
        }

        // Inverse FFT — result lands in nb_fft_in
        fftwf_execute(nb_ifft_plan);

        // Time-domain blanking using the normalised IFFT output as signal estimate
        for (size_t j = 0; j < nb_fft_size && (i + j) < buffer.size(); ++j) {
            // FIX 1: Normalise IFFT output by 1/N before comparing with threshold
            float real_out = nb_fft_in[j][0] * norm;
            float imag_out = nb_fft_in[j][1] * norm;
            float magnitude = std::sqrt(real_out * real_out + imag_out * imag_out);

            if (magnitude > dynamic_threshold) {
                float reduction_factor = dynamic_threshold / (magnitude + 1e-12f);
                processed_buffer[i + j] = buffer[i + j] * reduction_factor;
            } else {
                processed_buffer[i + j] = buffer[i + j];
            }
        }
    }

    buffer = processed_buffer;
}

// --------------------------------------------------------------------------
// Main AGC Processing
// --------------------------------------------------------------------------

void AGC::process(float *arr, size_t len) {
    // Copy input buffer so we can run the noise blanker
    std::vector<float> buffer(arr, arr + len);

    // Apply Noise Blanker if enabled (use atomic load for thread safety)
    if (nb_enabled.load(std::memory_order_relaxed)) {
        applyNoiseBlanker(buffer);
    }

    // --- ZERO-LOOKAHEAD / MINIMUM-LATENCY PATH ---
    if (look_ahead_samples == 0) {
        for (size_t i = 0; i < len; ++i) {
            float sample = buffer[i];
            float peak_sample = std::fabs(sample);

            // Desired gain from instantaneous peak
            float desired_gain = std::min(
                desired_level / (peak_sample + 1e-15f),
                max_gain
            );

            applyProgressiveAGC(desired_gain);

            // Combine all gain stages
            float total_gain = 1.0f;
            for (float g : gains) {
                total_gain *= g;
            }
            total_gain = std::min(total_gain, max_gain);

            // Apply scaled gain
            // Note: The 0.01f scaling factor means max_gain of 500 → 5× effective gain
            arr[i] = sample * (total_gain * 0.01f);
        }
        return;
    }

    // --- ORIGINAL LOOKAHEAD PATH (adds lookAheadTimeMs latency) ---
    for (size_t i = 0; i < len; ++i) {
        push(buffer[i]);

        if (lookahead_buffer.size() == look_ahead_samples) {
            float current_sample = lookahead_buffer.front();
            float peak_sample    = max();

            float desired_gain = std::min(
                desired_level / (peak_sample + 1e-15f),
                max_gain
            );

            applyProgressiveAGC(desired_gain);

            float total_gain = 1.0f;
            for (float g : gains) {
                total_gain *= g;
            }
            total_gain = std::min(total_gain, max_gain);

            arr[i] = current_sample * (total_gain * 0.01f);
        } else {
            // Still filling lookahead buffer – output muted until we have full window
            arr[i] = 0.0f;
        }
    }
}

// --------------------------------------------------------------------------
// Progressive Multi-Stage AGC
// --------------------------------------------------------------------------

void AGC::applyProgressiveAGC(float desired_gain) {
    // FIX: Decrement hang_counter ONCE per call (outside the stage loop).
    // Previously it was decremented once per gain stage (5×), causing the
    // hang timer to expire 5× faster than configured.
    if (hang_counter > 0) {
        hang_counter--;
    }

    // Apply AGC progressively to different stages
    for (size_t i = 0; i < gains.size(); ++i) {
        float stage_desired_gain = std::min(std::pow(desired_gain, 1.0f / gains.size()), max_gain);
        
        // Implement hang system
        if (stage_desired_gain < gains[i] * hang_threshold) {
            hang_counter = hang_time;
        }
        
        if (hang_counter > 0) {
            // Hang active — hold current gain, don't release
        } else {
            // Dual time constant system
            float fast_gain = gains[i] * (1 - fast_attack_coeff) + stage_desired_gain * fast_attack_coeff;
            float slow_gain;
            
            if (stage_desired_gain < gains[i]) {
                slow_gain = gains[i] * (1 - am_attack_coeff) + stage_desired_gain * am_attack_coeff;
            } else {
                slow_gain = gains[i] * (1 - am_release_coeff) + stage_desired_gain * am_release_coeff;
            }
            
            gains[i] = std::min(fast_gain, slow_gain);
        }
    }
    
    // Delayed AGC for RF stage (first stage)
    if (desired_gain > gains[0]) {
        gains[0] = std::min(gains[0] * (1 - release_coeff * 0.1f) + desired_gain * release_coeff * 0.1f, max_gain);
    }
}

void AGC::reset() {
    std::fill(gains.begin(), gains.end(), 1.0f);
    lookahead_buffer.clear();
    lookahead_max.clear();
    hang_counter = 0;
}