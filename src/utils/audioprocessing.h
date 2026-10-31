#ifndef AUDIO_PROCESSING_H
#define AUDIO_PROCESSING_H

#include <cstddef>
#include <deque>
#include <vector>
#include "fftw3.h"
#include <functional>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>
#include <atomic>  // ✅ ADDED: For atomic nb_enabled

class AGC {
  private:
    float desired_level;
    float attack_coeff;
    float release_coeff;
    float fast_attack_coeff;
    float am_attack_coeff;
    float am_release_coeff;
    size_t look_ahead_samples;
    std::vector<float> gains;
    std::deque<float> lookahead_buffer;
    std::deque<float> lookahead_max;
    float sample_rate;
    float max_gain;  // Maximum allowed gain


    // Noise Blanker
    std::atomic<bool> nb_enabled;  // ✅ FIXED: Made atomic for thread safety
    size_t nb_fft_size;
    size_t nb_overlap;
    size_t nb_average_windows;
    float nb_threshold;
     int nb_window_size;
    float nb_threshold_factor;
    float nb_smoothing_factor;
    std::vector<float> nb_buffer;
    std::vector<std::vector<float>> nb_spectrum_history;
    std::vector<float> nb_spectrum_average;
    size_t nb_history_index;
    fftwf_plan nb_fft_plan;
    fftwf_plan nb_ifft_plan;
    fftwf_complex *nb_fft_in, *nb_fft_out;
    
    // Hang system
    size_t hang_time;
    size_t hang_counter;

    // Transceiver-style AGC (Fast / Medium / Slow buttons). 0 = the legacy
    // mode-dependent AGC above ("Auto"), which stays the default.
    int    trx_speed = 0;
    float  trx_level = 0.0f;          // tracked peak envelope (linear)
    float  trx_attack_coeff = 0.0f;   // per-sample, ~2 ms
    float  trx_decay_mult = 1.0f;     // per-sample exponential decay of the envelope
    size_t trx_hang_samples = 0;
    size_t trx_hang_counter = 0;
    float  trx_gain = 1.0f;           // smoothed applied gain (no zipper noise)
    float  trx_gain_coeff = 0.0f;

    // Shared-gain stereo AGC state used by C-QUAM so both channels track
    // exactly the same gain and the stereo image stays stable.
    float stereo_level;
    float stereo_gain;
    float stereo_min_gain;
    float stereo_max_gain;
    float stereo_attack_alpha;
    float stereo_release_alpha_fast;
    float stereo_release_alpha_slow;
    float stereo_level_alpha;
    float stereo_target_level;

    void push(float sample);
    void pop();
    float max();
    void applyProgressiveAGC(float desired_gain);
    void applyNoiseBlanker(std::vector<float>& buffer);

public:
    AGC(float desiredLevel,
        float attackTimeMs,
        float releaseTimeMs,
        float lookAheadTimeMs,
        float sr);
    
    // ✅ CRITICAL FIX: Delete copy/move operations to prevent double-free bugs
    // The AGC class manages raw FFTW pointers. If copied, both objects would
    // share the same pointers, and when destroyed, both would try to free
    // the same memory, causing crashes. By deleting these operations, we
    // prevent accidental copies that would cause double-free errors.
    AGC(const AGC&) = delete;
    AGC& operator=(const AGC&) = delete;
    AGC(AGC&&) = delete;
    AGC& operator=(AGC&&) = delete;
    
    // ✅ CRITICAL FIX: Destructor with FFTW cleanup
    // Implementation in .cpp file includes mutex protection for thread safety
    ~AGC();
    
    void process(float *arr, size_t len);
    void process_stereo(float *left, float *right, size_t len);
    void reset();
    void configureForSSB();
    void configureForAM();
    void configureForQUAM();
    // 0 = Auto (legacy AGC), 1 = Fast, 2 = Medium, 3 = Slow.
    void setTrxSpeed(int speed);
};

#endif