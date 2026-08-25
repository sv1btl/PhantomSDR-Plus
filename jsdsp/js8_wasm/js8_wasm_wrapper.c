/*
 * js8_wasm_wrapper.c — JS8 decode bridge for PhantomSDR-Plus.
 *
 * Mirrors the structure of jsdsp/ft8_wasm/wasm_wrapper.c: a persistent monitor
 * that is reinitialised only when the submode or sample rate changes, a
 * candidate search, and indexed accessors for the results.
 *
 * The one deliberate difference is where this stops. The FT8 wrapper returns
 * finished text, because an FT8 message is self-contained. A JS8 frame is not:
 * 75 bits carry a 3-bit frame type plus either packed callsigns, a directed
 * command, or varicode-compressed text, and a real message spans several
 * frames in consecutive slots. So this returns the raw 75 payload bits and
 * leaves varicode, callsign unpacking and reassembly to JavaScript, where the
 * cross-slot state naturally lives and where iterating is far cheaper.
 *
 * JS protocol: submode index 0=Normal, 1=Fast, 2=Turbo, 3=Slow, 4=Ultra
 * (matching kJS8_submodes, NOT JS8Call's NSUBMODE numbering).
 */

#include <stdlib.h>
#include <string.h>

#include "js8_constants.h"
#include "js8_decode.h"

#define MAX_RESULTS    32
/* Decode, remove what was found, and look again. A strong station masks
 * weaker ones sharing its slot, and the only way past that is to take it out
 * of the audio. Passes stop early as soon as one finds nothing new, so a quiet
 * slot costs a single pass. */
#define MAX_PASSES     3
#define TIME_OSR       2
/* NB: nfft = block_size * freq_osr, so raising freq_osr lengthens the STFT
 * analysis window and smears adjacent symbols. Measured: freq_osr 4 costs
 * ~2 dB of sensitivity versus 2. Do not "improve" this without re-running
 * js8_decode_test --sweep. */
#define FREQ_OSR       2

/* JS8 activity sits in the same part of the audio passband as FT8. */
#define PASSBAND_LO    200.0f
#define PASSBAND_HI    3000.0f

typedef struct
{
    uint8_t payload[10];
    uint8_t i3bit;
    float   freq;
    float   snr;
    float   dt;
    int     score;
} result_t;

static result_t s_results[MAX_RESULTS];
static int      s_count = 0;

/* Monitor kept alive between calls; rebuilding the FFT plan and window every
 * slot is pure waste when neither submode nor sample rate has changed. */
static js8_monitor_t s_mon;
static bool          s_mon_init    = false;
static int           s_mon_rate    = 0;
static int           s_mon_submode = -1;

int js8_decode(const float* pcm, int num_samples, int submode, int sample_rate)
{
    s_count = 0;

    if (sample_rate <= 0) sample_rate = 12000;
    if (submode < 0 || submode >= JS8_NUM_SUBMODES) return 0;

    if (!s_mon_init || s_mon_rate != sample_rate || s_mon_submode != submode)
    {
        if (s_mon_init) js8_monitor_free(&s_mon);
        js8_monitor_config_t cfg = {
            .f_min       = PASSBAND_LO,
            .f_max       = PASSBAND_HI,
            .sample_rate = sample_rate,
            .time_osr    = TIME_OSR,
            .freq_osr    = FREQ_OSR,
            .submode     = submode
        };
        if (!js8_monitor_init(&s_mon, &cfg))
        {
            s_mon_init = false;
            return 0;
        }
        s_mon_init    = true;
        s_mon_rate    = sample_rate;
        s_mon_submode = submode;
    }
    else
    {
        js8_monitor_reset(&s_mon);
    }

    /* The decoding itself -- passes, subtraction, dedup -- lives in
     * js8_decode_slot() so that the native tests exercise the same code this
     * does, rather than a copy of it. */
    js8_result_t results[MAX_RESULTS];
    int n = js8_decode_slot(&s_mon, pcm, num_samples, sample_rate,
                            MAX_PASSES, results, MAX_RESULTS);

    for (int i = 0; i < n; i++)
    {
        memcpy(s_results[i].payload, results[i].msg.payload, 10);
        s_results[i].i3bit = results[i].msg.i3bit;
        s_results[i].freq  = results[i].freq;
        s_results[i].dt    = results[i].dt;
        s_results[i].snr   = results[i].status.snr;
        s_results[i].score = results[i].score;
    }
    s_count = n;

    return s_count;
}

/* ── Accessors ───────────────────────────────────────────────────────────── */

/// 10 bytes: the 75 payload bits MSB-first (72 message + 3 frame type),
/// low 5 bits of byte 9 always zero.
const uint8_t* js8_get_payload(int i)
{
    static const uint8_t zero[10] = { 0 };
    return (i >= 0 && i < s_count) ? s_results[i].payload : zero;
}

/// i3bit: a BITFIELD, not a frame type. 1 = first frame of a message,
/// 2 = last frame, 4 = raw data frame. The frame type proper is the first
/// 3 bits of the payload and is decoded in JS.
int   js8_get_i3bit(int i)      { return (i >= 0 && i < s_count) ? s_results[i].i3bit : -1; }
float js8_get_freq(int i)       { return (i >= 0 && i < s_count) ? s_results[i].freq : 0.0f; }
float js8_get_snr(int i)        { return (i >= 0 && i < s_count) ? s_results[i].snr : 0.0f; }
float js8_get_dt(int i)         { return (i >= 0 && i < s_count) ? s_results[i].dt : 0.0f; }
int   js8_get_score(int i)      { return (i >= 0 && i < s_count) ? s_results[i].score : 0; }

/// Number of submodes and their names, so the JS side does not hardcode them.
int         js8_num_submodes(void)      { return JS8_NUM_SUBMODES; }
const char* js8_submode_name(int i)     { return (i >= 0 && i < JS8_NUM_SUBMODES) ? kJS8_submodes[i].name : ""; }
/// T/R CYCLE in seconds -- what slot scheduling aligns to. NOT the same as the
/// transmit duration for Slow (28 s of signal in a 30 s cycle).
int         js8_submode_period(int i)   { return (i >= 0 && i < JS8_NUM_SUBMODES) ? kJS8_submodes[i].period : 0; }
/// Seconds of actual transmission; this is how much audio a slot must capture.
int         js8_submode_txdur(int i)    { return (i >= 0 && i < JS8_NUM_SUBMODES) ? kJS8_submodes[i].ntxdur : 0; }
float       js8_submode_baud(int i)     { return (i >= 0 && i < JS8_NUM_SUBMODES) ? kJS8_submodes[i].baud : 0.0f; }
float       js8_submode_start_delay(int i) { return (i >= 0 && i < JS8_NUM_SUBMODES) ? kJS8_submodes[i].start_delay : 0.0f; }
