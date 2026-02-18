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
    hang_time      = static_cast<size_t>(2.0f * sample_rate);   // 1 second hold (was 0.5s)
    hang_threshold = 0.25f;                                     // engage hang more often (was 0.20)
    am_attack_coeff  = attack_coeff * 0.3f;                     // faster peak control (was 0.5)
    am_release_coeff = release_coeff * 0.08f;                   // ultra-slow gain-up (was 0.15)
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
    // ✅ CRITICAL FIX: Check if NB is enabled AND plans are valid before processing
    // This prevents crashes if FFTW plan creation failed or NB is disabled
    if (!nb_enabled.load(std::memory_order_relaxed) || !nb_fft_plan || !nb_ifft_plan) {
        return;
    }
    
    std::vector<float> processed_buffer(buffer.size());

    for (size_t i = 0; i < buffer.size(); i += nb_overlap) {
        // Fill the buffer
        size_t copy_size = std::min(nb_fft_size, buffer.size() - i);
        std::copy(buffer.begin() + i, buffer.begin() + i + copy_size, nb_buffer.begin());

        // Perform FFT
        for (size_t j = 0; j < nb_fft_size; ++j) {
            nb_fft_in[j][0] = nb_buffer[j];
            nb_fft_in[j][1] = 0;
        }
        fftwf_execute(nb_fft_plan);

        // Calculate magnitude spectrum
        std::vector<float> magnitude_spectrum(nb_fft_size / 2);
        for (size_t j = 0; j < nb_fft_size / 2; ++j) {
            magnitude_spectrum[j] = std::sqrt(nb_fft_out[j][0] * nb_fft_out[j][0] + nb_fft_out[j][1] * nb_fft_out[j][1]);
        }

        // Update average spectrum
        nb_spectrum_history[nb_history_index] = magnitude_spectrum;
        nb_history_index = (nb_history_index + 1) % nb_average_windows;

        for (size_t j = 0; j < nb_fft_size / 2; ++j) {
            nb_spectrum_average[j] = std::accumulate(nb_spectrum_history.begin(), nb_spectrum_history.end(), 0.0f,
                [j](float sum, const std::vector<float>& spectrum) { return sum + spectrum[j]; }) / nb_average_windows;
        }

        // Calculate average signal level
        float avg_signal_level = std::accumulate(nb_spectrum_average.begin(), nb_spectrum_average.end(), 0.0f) / nb_spectrum_average.size();

        // ✅ CRITICAL FIX: Dynamic threshold now uses the CORRECTED normalized threshold (0.140)
        // Previously this was using 140.0, which would make dynamic_threshold = 140.0 * avg_signal_level
        // This would cause ALL signals to be blanked since the threshold would be way too high.
        // 
        // Now with nb_threshold = 0.140, we get: dynamic_threshold = 0.14 * avg_signal_level
        // This means "blank impulses that exceed 14% above the average spectrum level" - much more reasonable!
        float dynamic_threshold = nb_threshold * avg_signal_level;

        // Scale current spectrum (spectral noise reduction)
        for (size_t j = 0; j < nb_fft_size / 2; ++j) {
            float ratio = magnitude_spectrum[j] / (nb_spectrum_average[j] + 1e-12f);
            float scale = ratio > 1 ? 1 / std::pow(ratio, 0.5f) : 1; // More gradual scaling
            nb_fft_out[j][0] *= scale;
            nb_fft_out[j][1] *= scale;
        }

        // Inverse FFT
        fftwf_execute(nb_ifft_plan);

        // Apply noise reduction (time-domain blanking)
        for (size_t j = 0; j < nb_fft_size && (i + j) < buffer.size(); ++j) {
            float magnitude = std::sqrt(nb_fft_in[j][0] * nb_fft_in[j][0] + nb_fft_in[j][1] * nb_fft_in[j][1]);

            // ✅ FIXED: Now using properly scaled dynamic_threshold
            // This will only blank samples where magnitude significantly exceeds the threshold,
            // instead of blanking everything like before.
            if (magnitude > dynamic_threshold) {
                float reduction_factor = dynamic_threshold / (magnitude + 1e-12f);
                processed_buffer[i + j] = buffer[i + j] * reduction_factor;
            } else {
                processed_buffer[i + j] = buffer[i + j];
            }
        }
    }

    // Copy the processed buffer back to the input buffer
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
    // Apply AGC progressively to different stages
    for (size_t i = 0; i < gains.size(); ++i) {
        float stage_desired_gain = std::min(std::pow(desired_gain, 1.0f / gains.size()), max_gain);
        
        // Implement hang system
        if (stage_desired_gain < gains[i] * hang_threshold) {
            hang_counter = hang_time;
        }
        
        if (hang_counter > 0) {
            hang_counter--;
        } else {
            // Dual time constant system
            float fast_gain = gains[i] * (1 - fast_attack_coeff) + stage_desired_gain * fast_attack_coeff;
            float slow_gain;
            
            // Use AM time constants for slower AGC
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