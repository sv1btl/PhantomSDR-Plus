/*
 * js8_decode.h — JS8 receive path.
 *
 * Deliberately a PARALLEL implementation rather than an extension of
 * ft8_lib's decode.c / ldpc.c / crc.c. Those files hardcode FTX_LDPC_K = 91,
 * a 14-bit CRC, Gray-mapped symbols and an unpermuted [message|parity]
 * codeword -- JS8 differs in every one of those, so supporting it in-place
 * would mean threading a code-parameter struct through the whole of the live
 * FT8/FT4/FT2 decoder for very little shared code. See README.
 *
 * What IS shared with ft8_lib is kiss_fft (via js8_monitor's STFT) and the
 * general shape of the algorithm: STFT -> Costas candidate search -> soft
 * symbol likelihoods -> belief propagation -> CRC.
 *
 * The decoder deliberately stops at the 75 payload bits. Varicode, callsign
 * unpacking, the directed-command grammar and multi-frame reassembly are the
 * message layer and live in JavaScript (Phase 2/3), where they are far easier
 * to iterate on and where the cross-slot state naturally belongs.
 */

#ifndef _INCLUDE_JS8_DECODE_H_
#define _INCLUDE_JS8_DECODE_H_

#include <stdint.h>
#include <stdbool.h>
#include <fft/kiss_fftr.h>
#include "js8_constants.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ── Waterfall ───────────────────────────────────────────────────────────── */

typedef struct
{
    int      max_blocks;   ///< symbols allocated in mag
    int      num_blocks;   ///< symbols stored so far
    int      num_bins;     ///< FFT bins kept (one per tone spacing)
    int      time_osr;     ///< time subdivisions per symbol
    int      freq_osr;     ///< frequency subdivisions per tone
    uint8_t* mag;          ///< [blocks][time_osr][freq_osr][num_bins], 0.5 dB steps
    int      block_stride; ///< time_osr * freq_osr * num_bins
    int      ncostas;      ///< 1 or 2; selects the Costas pattern set
} js8_waterfall_t;

/* ── Monitor ─────────────────────────────────────────────────────────────── */

typedef struct
{
    float    f_min;
    float    f_max;
    int      sample_rate;
    int      time_osr;
    int      freq_osr;
    int      submode;      ///< index into kJS8_submodes (0=Normal .. 4=Ultra)
} js8_monitor_config_t;

typedef struct
{
    const js8_submode_t* sub;
    float  symbol_period;  ///< seconds; NSPS / 12000, independent of sample rate
    int    min_bin;
    int    max_bin;
    int    block_size;     ///< samples per symbol at the configured sample rate
    int    subblock_size;
    int    nfft;
    float  fft_norm;
    float* window;
    float* last_frame;
    js8_waterfall_t wf;

    void*         fft_work;
    kiss_fftr_cfg fft_cfg;
} js8_monitor_t;

bool js8_monitor_init(js8_monitor_t* me, const js8_monitor_config_t* cfg);
void js8_monitor_reset(js8_monitor_t* me);
void js8_monitor_process(js8_monitor_t* me, const float* frame);
void js8_monitor_free(js8_monitor_t* me);

/* ── Candidates and decoding ─────────────────────────────────────────────── */

typedef struct
{
    int16_t score;
    int16_t time_offset;
    int16_t freq_offset;
    uint8_t time_sub;
    uint8_t freq_sub;
} js8_candidate_t;

typedef struct
{
    int      ldpc_errors;    ///< unsatisfied parity checks after BP
    uint16_t crc_extracted;
    uint16_t crc_calculated;
    /// SNR in a 2500 Hz reference bandwidth, in dB. Only meaningful when the
    /// decode succeeded -- it is measured from the tones the message actually
    /// used, which are not known until the CRC passes.
    float    snr;
    /// True if belief propagation failed and ordered-statistics decoding
    /// rescued the word. Useful for telling how much OSD is actually earning.
    bool     used_osd;
} js8_decode_status_t;

typedef struct
{
    uint8_t payload[10];     ///< 75 bits, MSB-first; low 5 bits of byte 9 are zero
    /// The 3-bit i3bit field (payload bits 72..74). NOT the frame type: it is a
    /// BITFIELD -- 1 = first frame of a message, 2 = last frame, 4 = raw data
    /// frame with no frame-type header (varicode.h JS8CallFirst/Last/Data).
    /// The frame type proper lives in the first 3 bits of the payload and is
    /// decoded in JS.
    uint8_t i3bit;
    /// The 79 tones this message was sent with, recovered from the decoded
    /// codeword. Needed to subtract the signal so weaker ones underneath it
    /// can be found (js8_subtract.c).
    uint8_t tones[JS8_NN];
} js8_message_t;

/// Find the strongest Costas-sync candidates. Returns the number filled in.
int js8_find_candidates(const js8_waterfall_t* wf, int num_candidates,
                        js8_candidate_t heap[], int min_score);

/// Attempt to decode one candidate: soft symbols -> BP -> colorder -> CRC-12,
/// then measure the SNR from the tones the decoded message actually used.
/// Takes the monitor rather than just the waterfall because the SNR needs the
/// submode's tone spacing for its reference-bandwidth correction.
bool js8_decode_candidate(const js8_monitor_t* mon, const js8_candidate_t* cand,
                          int max_iterations, js8_message_t* message,
                          js8_decode_status_t* status);

/// Audio frequency of a candidate's lowest tone, in Hz.
float js8_candidate_freq(const js8_monitor_t* mon, const js8_candidate_t* cand);

/// Time offset of a candidate within the analysis window, in seconds.
///
/// The STFT's sliding analysis frame means a candidate locks slightly later
/// than the signal actually started; that bias is removed here, so the value
/// returned is the true signal start and the auto-sync in audio.js can
/// converge on a target of zero rather than on a per-submode constant.
///
/// The bias is ONE symbol, calibrated against CPFSK -- which is what JS8
/// actually transmits (JS8Call's Modulator.cpp holds the phase increment
/// constant per symbol, with no Gaussian shaping).
///
/// This was briefly set to half a symbol on the mistaken assumption that JS8,
/// like FT8, is GFSK. It is not, and the two differ by exactly that half
/// symbol; the same wrong assumption also made coherent subtraction useless.
float js8_candidate_dt(const js8_monitor_t* mon, const js8_candidate_t* cand);

/// Ordered-statistics decoding: OFF by default, and measured rather than
/// assumed.
///
/// Order-1 OSD is implemented and correct (js8_osd.c; it produces valid
/// codewords on every attempt), but measured over 100 trials per point it buys
/// 1-4 percentage points of decode rate -- about 0.13 dB -- for 62% more decode
/// time. That is not the ~2 dB OSD is supposed to give, and the reason is that
/// order 1 explores only 88 of the 2^87 possible messages: where BP fails, it
/// finds the transmitted codeword about 18% of the time.
///
/// The gain is NOT limited by the gate below -- raising it from 24 to 87
/// (no gate at all) changes nothing measurable. Closing the real gap needs
/// order 2, which is 3741 re-encodings per candidate and only affordable with
/// upstream's partial-syndrome pruning (osd174.f90's nt/ntheta). The order-1
/// machinery here is what that would build on.
///
/// Set JS8_OSD_ENABLED to 1 to turn it on; re-measure with
/// `js8_decode_test --sweep 100` before believing any change.
#ifndef JS8_OSD_ENABLED
#define JS8_OSD_ENABLED 0
#endif

/// How many unsatisfied parity checks BP may leave before a candidate is
/// considered hopeless. Only consulted when OSD is enabled.
#ifndef JS8_OSD_MAX_ERRORS
#define JS8_OSD_MAX_ERRORS 24
#endif

/// One decoded frame, with everything a caller needs to report it.
typedef struct
{
    js8_message_t       msg;
    js8_decode_status_t status;
    float               freq;   ///< audio Hz of tone 0
    float               dt;     ///< seconds into the slot the signal started
    int                 score;  ///< Costas sync score, for diagnostics only
    int                 pass;   ///< which decoding pass found it (0-based)
} js8_result_t;

/**
 * Decode a whole slot: STFT, candidate search, decode, then subtract what was
 * found and look again.
 *
 * A strong station masks weaker ones sharing its slot, so a single pass finds
 * only the loudest. Each pass removes what it decoded from a working copy of
 * the audio and searches the result; passes stop as soon as one finds nothing
 * new, so a quiet slot still costs only one.
 *
 * @param mon          initialised monitor; reset internally per pass
 * @param pcm          the slot's samples (not modified -- a copy is made)
 * @param passes       maximum passes; 1 disables subtraction entirely
 * @return number of results written
 */
int js8_decode_slot(js8_monitor_t* mon, const float* pcm, int num_samples,
                    int sample_rate, int passes,
                    js8_result_t* out, int max_out);

/// Belief-propagation LDPC(174,87) decoder. Exposed for testing.
void js8_bp_decode(const float codeword[JS8_LDPC_N], int max_iters,
                   uint8_t plain[JS8_LDPC_N], int* ok);

#ifdef __cplusplus
}
#endif

#endif // _INCLUDE_JS8_DECODE_H_
