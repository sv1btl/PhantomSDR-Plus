#ifndef SIGNAL_H
#define SIGNAL_H

#include "audio.h"
#include "client.h"
#include "utils.h"
#include "utils/audioprocessing.h"

#include <complex>
#include <cmath>
#include <string>

#include <boost/align/aligned_allocator.hpp>

#ifdef HAS_LIQUID
#include <liquid/liquid.h>
#endif

template <typename T>
using AlignedAllocator = boost::alignment::aligned_allocator<T, 64>;

extern std::atomic<size_t> total_audio_bits_sent;
extern std::atomic<bool> monitor_audio_thread_running;
extern std::atomic<double> audio_kbits_per_second;  // ✅ FIXED: Made atomic for thread safety


// fftwf_malloc allocator for vector
template <typename T> struct fftwfAllocator {
    typedef T value_type;
    fftwfAllocator() {}
    template <typename U> fftwfAllocator(const fftwfAllocator<U> &) {}
    T *allocate(std::size_t n) {
        if (n > std::numeric_limits<std::size_t>::max() / sizeof(T))
            throw std::bad_alloc();
        if (auto p = static_cast<T *>(fftwf_malloc(n * sizeof(T))))
            return p;
        throw std::bad_alloc();
    }
    void deallocate(T *p, std::size_t) { fftwf_free(p); }
};

struct ComplexDeleter {
    void operator()(std::complex<float> *f) {
        fftwf_free(reinterpret_cast<fftwf_complex *>(f));
    }
};

template <typename T>
static inline std::unique_ptr<T[], ComplexDeleter>
fftwf_malloc_unique_ptr(size_t n) {
    T *ptr = reinterpret_cast<T *>(fftwf_malloc(n * sizeof(T)));
    if constexpr (std::is_trivial<T>::value) {
        memset(ptr, 0, n * sizeof(T));
    } else {
        fill(ptr, ptr + n, T());
    }
    return std::unique_ptr<T[], ComplexDeleter>(ptr);
}

// ============================================================================
// NOISE GATE CLASS - Reduces background noise between signals
// ============================================================================
class NoiseGate {
private:
    float envelope = 0.0f;
    float noise_floor = 0.001f;
    bool gate_open = true;
    
    // Preset parameters (default: balanced)
    float alpha_env = 0.020f;        // Envelope tracking speed
    float alpha_noise = 0.0004f;     // Noise floor tracking speed
    float open_factor = 2.2f;        // Open when signal > noise * this
    float close_factor = 1.5f;       // Close when signal < noise * this
    float floor_gain = 0.15f;        // Gain when gate is closed (15%)
    
    bool enabled = false;            // Disabled by default
    
public:
    NoiseGate() = default;
    
    void set_enabled(bool en) {
        enabled = en;
        if (!en) {
            // Reset state when disabled
            envelope = 0.0f;
            noise_floor = 0.001f;
            gate_open = true;
        }
    }
    
    bool is_enabled() const {
        return enabled;
    }
    
    void set_preset(const std::string& preset) {
        if (preset == "aggressive") {
            alpha_env = 0.0025f;         // Slower envelope for smoother response
            alpha_noise = 0.00008f;      // More stable noise floor
            open_factor = 1.70f;         // Opens very easily
            close_factor = 3.50f;        // Much larger hysteresis (2.06x ratio)
            floor_gain = 0.38f;          // Higher floor for natural sound
        } else if (preset == "weak-signal") {
            alpha_env = 0.0022f;         // Very slow, preserves weak signals
            alpha_noise = 0.00007f;      // Very stable noise tracking
            open_factor = 1.60f;         // Opens easiest
            close_factor = 3.40f;        // Large hysteresis (2.12x ratio)
            floor_gain = 0.52f;          // High floor, natural background
        } else if (preset == "smooth") {
            alpha_env = 0.0020f;         // Ultra-slow for smoothest transitions
            alpha_noise = 0.00006f;      // Very stable
            open_factor = 1.75f;         // Moderate opening
            close_factor = 3.60f;        // Largest hysteresis (2.06x ratio)
            floor_gain = 0.55f;          // Very natural sound
        } else if (preset == "maximum") {
            alpha_env = 0.0028f;         // Slightly faster for noise reduction
            alpha_noise = 0.00008f;      // Stable tracking
            open_factor = 1.65f;         // Opens easily
            close_factor = 3.45f;        // Large hysteresis (2.09x ratio)
            floor_gain = 0.32f;          // Lower floor for quiet background
        } else if (preset == "cw") {
            // CW needs faster response but still smooth
            alpha_env = 0.0035f;         // Faster for CW tones
            alpha_noise = 0.00010f;      // Adaptive for changing conditions
            open_factor = 1.65f;         // Quick opening
            close_factor = 3.30f;        // Good hysteresis (2.0x ratio)
            floor_gain = 0.35f;          // Moderate floor
        } else if (preset == "am-fm") {
            // Ultra-open, barely gates
            alpha_env = 0.0020f;         // Very slow
            alpha_noise = 0.00006f;      // Very stable
            open_factor = 2.00f;         // Higher threshold
            close_factor = 3.80f;        // Huge hysteresis (1.9x ratio)
            floor_gain = 0.62f;          // Very high floor, natural sound
        } else if (preset == "balanced") {
            alpha_env = 0.0024f;         // Slower than before
            alpha_noise = 0.00008f;      // More stable
            open_factor = 1.70f;         // Opens easily
            close_factor = 3.50f;        // Large hysteresis (2.06x ratio)
            floor_gain = 0.45f;          // Natural background level
        }
    }
    
    void process(float* audio, size_t length) {
        if (!enabled) return;
        
        for (size_t i = 0; i < length; i++) {
            float x = fabsf(audio[i]);
            
            envelope += alpha_env * (x - envelope);
            
            if (envelope < noise_floor * 1.5f) {
                noise_floor += alpha_noise * (envelope - noise_floor);
            }
            if (noise_floor < 1e-6f) noise_floor = 1e-6f;
            
            float ratio = envelope / noise_floor;
            
            if (gate_open) {
                if (ratio < close_factor) {
                    gate_open = false;
                }
            } else {
                if (ratio > open_factor) {
                    gate_open = true;
                }
            }
            
            audio[i] = gate_open ? audio[i] : audio[i] * floor_gain;
        }
    }
    
    void reset() {
        envelope = 0.0f;
        noise_floor = 0.001f;
        gate_open = true;
    }
};
// ============================================================================

class AudioClient : public Client {
  public:
    AudioClient(connection_hdl hdl, PacketSender &sender,
                audio_compressor audio_compression, bool is_real,
                int audio_fft_size, int audio_max_sps, int fft_result_size);
    void set_audio_range(int l, double audio_mid, int r);
    void set_audio_demodulation(demodulation_mode demodulation);
    void set_am_stereo(bool enable);  // ✅ ADDED: C-QUAM AM stereo control
    const std::string &get_unique_id();

    virtual void on_window_message(int l, std::optional<double> &m, int r,
                                   std::optional<int> &level);
    virtual void on_demodulation_message(std::string &demodulation);
    void on_close();

    // Noise gate control methods
    void on_noise_gate_enable_message(bool enabled);
    void on_noise_gate_preset_message(std::string &preset);
    
    // AGC control methods  
    void on_agc_enable_message(bool enabled);

    void send_audio(std::complex<float> *buf, size_t frame_num);
    virtual ~AudioClient();

    std::multimap<std::pair<int, int>, std::shared_ptr<AudioClient>>::iterator
        it;

  protected:
    // User requested demodulation mode
    demodulation_mode demodulation;

    // Scratch space for the slice the user requested
    fftwf_complex *fft_slice_buf;
    uint8_t *waterfall_slice_buf;

    // Scratch space for audio demodulation
    bool is_real;
    int audio_fft_size;
    int fft_result_size;
    int audio_rate;
    std::unique_ptr<std::complex<float>[], ComplexDeleter> audio_fft_input;

    // IQ data for demodulation
    std::unique_ptr<std::complex<float>[], ComplexDeleter>
        audio_complex_baseband;
    std::unique_ptr<std::complex<float>[], ComplexDeleter>
        audio_complex_baseband_prev;

    std::unique_ptr<std::complex<float>[], ComplexDeleter>
        audio_complex_baseband_carrier;
    std::unique_ptr<std::complex<float>[], ComplexDeleter>
        audio_complex_baseband_carrier_prev;
    
    std::vector<float, AlignedAllocator<float>> audio_real;
    std::vector<float, AlignedAllocator<float>> audio_real_prev;
    std::vector<int32_t, AlignedAllocator<int32_t>> audio_real_int16;

    // IFFT plans for demodulation
    fftwf_plan p_complex;
    fftwf_plan p_complex_carrier;
    fftwf_plan p_real;

    // For DC offset removal and AGC implementatino
    DCBlocker<float> dc;
    AGC agc;
    MovingAverage<float> ma;
    MovingMode<int> mm;
    
    // Noise gate (backend processing)
    NoiseGate noise_gate;
    
    // AGC enable flag
    bool agc_enabled;
    
    // C-QUAM AM stereo flag
    bool am_stereo;  // ✅ ADDED: C-QUAM AM stereo enable flag

#ifdef HAS_LIQUID
    nco_crcf mixer;
#endif

    // Compression codec variables for Audio
    std::unique_ptr<AudioEncoder> encoder;

    signal_slices_t
        &signal_slices;
    std::mutex &signal_slice_mtx;
};

#endif