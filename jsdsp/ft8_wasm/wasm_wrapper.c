/**
 * wasm_wrapper.c — FT8 / FT4 / FT2 decode bridge for PhantomSDR-Plus
 * Place at: ~/ft8_lib_ft2/wasm_wrapper.c
 *
 * Harness modelled on KiwiSDR's FT8 extension
 * (Beagle_SDR_GPS/extensions/FT8/decode_ft8.c), which drives ft8_lib's own
 * common/monitor.c unmodified. This file does the same rather than
 * reimplementing the STFT — the previous hand-rolled waterfall builder
 * produced zero decodes.
 *
 * Kiwi parity notes:
 *   - passband 100..3100 Hz (Kiwi's FT8_PASSBAND_LO/HI)
 *   - kMax_candidates = 140, kLDPC_iterations = 25, kMin_score = 10
 *   - reported audio frequency computed from the candidate + mon.min_bin
 *     (ftx_decode_candidate() never assigns status.freq — reading it was a bug)
 *   - persistent aging callsign hash table so <...> compound calls resolve
 *   - sample rate is a parameter, not a compile-time constant
 *
 * Beyond Kiwi (2026-10-24, ~/sdr-shots/scripts/ftx-reliability.mjs):
 *   - signal subtraction with up to SUB_PASSES decode passes, and TIME_OSR 4:
 *     74 % -> 86 % of WSJT-X's decodes on ft8_lib's real recordings, a busy
 *     45-station FT8 slot 57 % -> 96 %
 *   - a second, later pass for FT4/FT2 (LATE_SKIP_BLOCKS): their start-time
 *     window was under a second
 *   - audio above 12 kHz is decimated to ~12 kHz first (cost, not quality)
 *
 * JS protocol: 0=FT8, 1=FT4, 2=FT2
 * C enum:      FTX_PROTOCOL_FT4=0, FTX_PROTOCOL_FT8=1
 * FT2 strategy: 2x upsample PCM, decode as FT4.
 */

#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>
#include <stdbool.h>

#include "ft8/decode.h"
#include "ft8/constants.h"
#include "ft8/message.h"
#include "ft8/encode.h"
#include "ft8/crc.h"
#include "common/monitor.h"

/* ── Constants (mirroring Kiwi's decode_ft8.c) ────────────────────────────── */
#define DEFAULT_SAMPLE_RATE 12000
/* TIME_OSR 4, not Kiwi's 2: the finer start estimate is what lets the
   subtraction below fit each signal (2 with subtraction: +1 decode on the
   real-recording corpus; 4 with it: +45, see the 2026-10-24 notes). */
#ifndef TIME_OSR
#define TIME_OSR            4
#endif
#ifndef FREQ_OSR
#define FREQ_OSR            2
#endif
#ifndef MIN_SCORE
#define MIN_SCORE           10
#endif
#ifndef MAX_CANDIDATES
#define MAX_CANDIDATES      140
#endif
#ifndef LDPC_ITERATIONS
#define LDPC_ITERATIONS     25
#endif
#define MAX_RESULTS         100
#define MSG_BUF_LEN         36
#define SNR_FLOOR           (-24.0f)   /* WSJT-X clamps at -24 dB too */

/* ft8_lib looks for a message start only 10 symbols before to 19 after the
   start of the audio (ftx_find_candidates). That is -1.6..+3.0 s for FT8 but
   only -0.48..+0.91 s for FT4 and -0.24..+0.46 s for FT2, so a listener whose
   clock or capture was off by half a second got no FT4/FT2 decodes at all.
   FT4/FT2 therefore get a second pass over the same slot with its first
   LATE_SKIP_BLOCKS symbols skipped, which covers starts up to 47 symbols
   (2.3 s FT4, 1.1 s FT2): every start a whole message can have in its slot. */
#define LATE_SKIP_BLOCKS    28

/* Signal subtraction, as WSJT-X does it: after a decode pass every decoded
   signal is rebuilt from its message, fitted to the audio (time to 1/64
   symbol, frequency from the phase slope, amplitude and phase tracked over a
   one-symbol window) and subtracted; the remainder is decoded again. A strong
   station no longer hides the weaker ones under it. */
#ifndef SUB_PASSES
#define SUB_PASSES          3
#endif
#define GFSK_K              5.336446f
/* Coarse time search over every COARSE_STRIDE-th symbol: 3 saves 30 % of
   the decode time but loses 4 of 313 decodes on the corpus. */
#ifndef COARSE_STRIDE
#define COARSE_STRIDE       1
#endif

/* Kiwi: FT8_PASSBAND_LO / FT8_PASSBAND_HI in extensions/FT8/FT8.h */
#define PASSBAND_LO         100.0f
#define PASSBAND_HI         3100.0f

/* ── Result store ─────────────────────────────────────────────────────────── */
typedef struct {
    char text[MSG_BUF_LEN]; float freq; float snr; float dt;
    float osd;   /* 0: decoded by belief propagation; else the OSD distance */
    int   osd_nhard;
    int   bp_errors;   /* parity checks belief propagation left unsatisfied */
    /* for subtraction: tones, and where the signal sits in the decode buffer */
    uint8_t tones[FT4_NN]; int nn; float f_dec; float t_dec;
} result_t;
static result_t s_results[MAX_RESULTS];
static int      s_count = 0;

/* ── Callsign hash table ──────────────────────────────────────────────────────
 * Mirrors Kiwi's hashtable_add/lookup/cleanup. Entries carry an age in the 10
 * MSBs of `hash`; the 22 LSBs hold the hash value itself. Aged out after
 * CALLSIGN_AGE_MAX slots. Persists across ftx_decode() calls — that is the
 * whole point: a compound callsign heard in one slot lets a later slot's
 * hashed reference to it be printed in full instead of as <...>.
 */
#define CALLSIGN_HASHTABLE_MAX 1024
#define CALLSIGN_AGE_MAX       60

typedef struct {
    /* NB: callsign is NOT null terminated. Must use strncpy() / strncmp(). */
    char     callsign[11];
    uint32_t hash;   /* 10 MSBs = age, 22 LSBs = hash value */
} callsign_hashtable_t;

static callsign_hashtable_t s_callsign_hashtable[CALLSIGN_HASHTABLE_MAX];
static int                  s_callsign_hashtable_size = 0;

static void hashtable_cleanup(uint8_t max_age)
{
    callsign_hashtable_t *ht = s_callsign_hashtable;

    for (int i = 0; i < CALLSIGN_HASHTABLE_MAX; ++i, ++ht) {
        if (ht->callsign[0] == '\0') continue;

        uint8_t age = (uint8_t)(ht->hash >> 22);
        if (age >= max_age) {
            ht->callsign[0] = '\0';
            ht->hash = 0;
            s_callsign_hashtable_size--;
        } else {
            ht->hash = (((uint32_t)age + 1u) << 22) | (ht->hash & 0x3FFFFFu);
        }
    }
}

static void hashtable_add(const char *callsign, uint32_t hash)
{
    uint16_t hash10   = (hash >> 12) & 0x3FFu;
    int      idx_hash = (hash10 * 23) % CALLSIGN_HASHTABLE_MAX;
    callsign_hashtable_t *ht = &s_callsign_hashtable[idx_hash];
    int wrap_idx = -1;

    while (ht->callsign[0] != '\0') {
        if (((ht->hash & 0x3FFFFFu) == hash) &&
            (0 == strncmp(ht->callsign, callsign, 11))) {
            /* Already present — reset age so active calls stay resident. */
            ht->hash &= 0x3FFFFFu;
            return;
        }
        /* Collision: linear probe until an empty slot or full wrap. */
        if (wrap_idx == -1) wrap_idx = idx_hash;
        idx_hash = (idx_hash + 1) % CALLSIGN_HASHTABLE_MAX;
        ht = &s_callsign_hashtable[idx_hash];
        if (idx_hash == wrap_idx) {
            /* Table full — overwrite this entry. */
            s_callsign_hashtable_size--;
            break;
        }
    }

    s_callsign_hashtable_size++;
    strncpy(ht->callsign, callsign, 11);    /* NB: strncpy zero-fills */
    ht->hash = hash;
}

static bool hashtable_lookup(ftx_callsign_hash_type_t hash_type,
                             uint32_t hash, char *callsign)
{
    uint8_t hash_shift = (hash_type == FTX_CALLSIGN_HASH_10_BITS) ? 12
                       : (hash_type == FTX_CALLSIGN_HASH_12_BITS) ? 10 : 0;
    uint16_t hash10   = (hash >> (12 - hash_shift)) & 0x3FFu;
    int      idx_hash = (hash10 * 23) % CALLSIGN_HASHTABLE_MAX;
    callsign_hashtable_t *ht = &s_callsign_hashtable[idx_hash];
    int wrap_idx = -1;

    while (ht->callsign[0] != '\0') {
        if (((ht->hash & 0x3FFFFFu) >> hash_shift) == hash) {
            strncpy(callsign, ht->callsign, 11);
            callsign[11] = '\0';   /* caller's buffer is char[12] and strlen()d */
            return true;
        }
        if (wrap_idx == -1) wrap_idx = idx_hash;
        idx_hash = (idx_hash + 1) % CALLSIGN_HASHTABLE_MAX;
        ht = &s_callsign_hashtable[idx_hash];
        if (idx_hash == wrap_idx) break;
    }

    callsign[0] = '\0';
    return false;
}

static ftx_callsign_hash_interface_t s_hash_if = {
    .lookup_hash = hashtable_lookup,
    .save_hash   = hashtable_add
};

/* ── Monitor, kept alive between calls and reinitialised only on change ───── */
static monitor_t s_mon;
static bool      s_mon_init  = false;
static int       s_mon_rate  = 0;
static int       s_mon_proto = -1;

/* ── SNR, referred to 2500 Hz like WSJT-X ─────────────────────────────────────
 * The reported SNR used to be score/2 − 10: half the Costas sync score, which
 * ft8_lib's own decode_ft8.c marks "TODO: compute better approximation of
 * SNR". Against WSJT-X on the test corpus it barely moved (0.12 dB per real
 * dB): a −20 dB signal read about +1, a +10 dB one about +5.
 *
 * Signal: re-encode the decoded message to get the tone sent in every symbol
 * and average the power in that tone over the message.
 * Noise: the median power of the spectrum around the signal (±SNR_NOISE_SPAN
 * bins, every block of the slot), which other stations hardly move; for noise
 * power the median is ln 2 × the mean. WSJT-X's own reference, the unused tone
 * four places away, does not work on this spectrum: its time steps are half a
 * symbol, so that tone picks up the signal from the neighbouring symbols and
 * strong stations saturated at about +5 dB.
 *     SNR = 10·log10(signal/noise − 1) − 10·log10(2500 / bin width) − SNR_CAL_DB
 * bin_hz is the TRUE audio bin width (FT2 is analysed stretched in time).
 * SNR_CAL_DB is the constant this spectrum's window and overlap leave over,
 * fitted against WSJT-X on ft8_lib's test corpus: after it, 255 decodes
 * follow WSJT-X at slope 0.97, correlation 0.94, same offset from −15 to +14.
 */
#define SNR_NOISE_SPAN 40
#define SNR_CAL_DB     3.3

static float ftx_snr(const ftx_waterfall_t *wf, const ftx_candidate_t *cand,
                     const ftx_message_t *msg, float bin_hz)
{
    uint8_t tones[FT4_NN > FT8_NN ? FT4_NN : FT8_NN];
    int nn, ntones;
    if (wf->protocol == FTX_PROTOCOL_FT4) { ft4_encode(msg->payload, tones); nn = FT4_NN; ntones = 4; }
    else                                  { ft8_encode(msg->payload, tones); nn = FT8_NN; ntones = 8; }

    /* Same indexing as decode.c's get_cand_mag(), without the time offset. */
    const WF_ELEM_T *plane = wf->mag
        + cand->time_sub * wf->freq_osr * wf->num_bins
        + cand->freq_sub * wf->num_bins;
    const WF_ELEM_T *base = plane + cand->freq_offset;

    double sig = 0.0;
    int used = 0;
    for (int i = 0; i < nn; i++) {
        int blk = cand->time_offset + i;
        if (blk < 0 || blk >= wf->num_blocks) continue;
        sig += pow(10.0, WF_ELEM_MAG(base[blk * wf->block_stride + tones[i]]) / 10.0);
        used++;
    }
    if (used < nn / 2) return SNR_FLOOR;
    sig /= used;

    /* Noise floor: median of the surrounding bins over the whole slot. The
       waterfall holds 0.5 dB steps in a byte, so a 256-bucket histogram gives
       the median directly. */
    int lo = cand->freq_offset - SNR_NOISE_SPAN;
    int hi = cand->freq_offset + ntones + SNR_NOISE_SPAN;
    if (lo < 0) lo = 0;
    if (hi > wf->num_bins) hi = wf->num_bins;
    uint32_t hist[256] = {0};
    uint32_t total = 0;
    for (int blk = 0; blk < wf->num_blocks; blk++) {
        const WF_ELEM_T *row = plane + blk * wf->block_stride;
        for (int b = lo; b < hi; b++) { hist[(uint8_t)row[b]]++; total++; }
    }
    if (total == 0) return SNR_FLOOR;
    uint32_t acc = 0; int med = 0;
    while (med < 255 && (acc += hist[med]) < total / 2) med++;
    double noi = pow(10.0, WF_ELEM_MAG(med) / 10.0) / 0.6931472;

    double r = sig / noi - 1.0;
    if (r < 0.001) r = 0.001;
    float snr = (float)(10.0 * log10(r) - 10.0 * log10(2500.0 / bin_hz) - SNR_CAL_DB);
    return snr < SNR_FLOOR ? SNR_FLOOR : snr;
}

/* ── 2x upsample (FT2 → FT4) ─────────────────────────────────────────────── */
static void upsample2x(const float *src, int n, float *dst) {
    int i;
    for (i = 0; i < n - 1; i++) {
        dst[2*i]   = src[i];
        dst[2*i+1] = 0.5f * (src[i] + src[i+1]);
    }
    dst[2*i]   = src[i];
    dst[2*i+1] = src[i];
}

/* ── OSD: ordered-statistics decoding ─────────────────────────────────────────
   When belief propagation gives up, decode the candidate again from its bit
   likelihoods the way WSJT-X's osd174_91 does: sort the 174 bits by
   reliability, take the most reliable independent set of 91 (GF(2) Gaussian
   elimination of the generator, bit-packed), re-encode from their hard
   decisions, and try flipping each of them (order 1) and pairs among the
   OSD_ORDER2 least reliable (order 2). The codeword that passes the CRC
   closest to the received likelihoods wins. OSD always finds SOME codeword,
   and the 14-bit CRC passes one random try in 16384, so a result is kept only
   below OSD_MAX_DIST / OSD_MAX_NHARD / OSD_MAX_BP_ERRORS, calibrated on pure
   noise: 1 false decode in 10000 FT8 noise slots without the BP limit; real
   recordings 313 -> 321 of WSJT-X's 362, FT8 at -19 dB 58 -> 73 %.

   The likelihood extraction is a copy of ft8_lib's static functions in
   ft8/decode.c (MIT, Kārlis Goba), which the library does not export. */
#ifndef OSD_ENABLED
#define OSD_ENABLED   1
#endif
#ifndef OSD_ORDER2
#define OSD_ORDER2    24
#endif
#ifndef OSD_MAX_DIST
#define OSD_MAX_DIST  42.0f
#endif
#ifndef OSD_MAX_NHARD
#define OSD_MAX_NHARD 31
#endif
#ifndef OSD_MAX_BP_ERRORS
#define OSD_MAX_BP_ERRORS 10
#endif
#ifndef OSD_MIN_SCORE
#define OSD_MIN_SCORE 0
#endif

/* An OSD decode is kept only as a plain standard message: CQ [XX] CALL [GRID]
   or CALL CALL [GRID | ±NN | R±NN | RRR | RR73 | 73], calls without /P, /R or
   a <hash>, no "R grid". Of 589 false OSD decodes from noise 7 % had that
   form (a random payload sets the /P, /R and R flags 7 times in 8); real
   weak-signal QSOs nearly always do. Belief-propagation decodes are not
   filtered. */
static bool osd_is_letter(char c) { return c >= 'A' && c <= 'Z'; }
static bool osd_is_digit(char c)  { return c >= '0' && c <= '9'; }
static bool osd_call(const char *t, int n)
{
    static const char *forms[] = { "L", "LL", "LD", "DL" };
    for (int f = 0; f < 4; f++) {
        int pl = (int)strlen(forms[f]), ok = 1;
        if (n < pl + 2 || n > pl + 5) continue;
        for (int i = 0; i < pl; i++) ok &= forms[f][i] == 'L' ? osd_is_letter(t[i]) : osd_is_digit(t[i]);
        ok &= osd_is_digit(t[pl]);
        for (int i = pl + 1; i < n; i++) ok &= osd_is_letter(t[i]);
        if (ok) return true;
    }
    return false;
}
static bool osd_tail(const char *t, int n)
{
    if (n == 4 && t[0] >= 'A' && t[0] <= 'R' && t[1] >= 'A' && t[1] <= 'R' && osd_is_digit(t[2]) && osd_is_digit(t[3])) return true;
    if (n == 3 && (t[0] == '+' || t[0] == '-') && osd_is_digit(t[1]) && osd_is_digit(t[2])) return true;
    if (n == 4 && t[0] == 'R' && (t[1] == '+' || t[1] == '-') && osd_is_digit(t[2]) && osd_is_digit(t[3])) return true;
    return (n == 3 && !strncmp(t, "RRR", 3)) || (n == 4 && !strncmp(t, "RR73", 4)) || (n == 2 && !strncmp(t, "73", 2));
}
static bool osd_plausible(const char *text)
{
    const char *tok[5]; int len[5], nt = 0;
    for (const char *p = text; *p && nt < 5; ) {
        while (*p == ' ') p++;
        if (!*p) break;
        const char *q = p; while (*q && *q != ' ') q++;
        tok[nt] = p; len[nt] = (int)(q - p); nt++; p = q;
    }
    if (nt < 2 || nt > 4) return false;
    if (len[0] == 2 && !strncmp(tok[0], "CQ", 2)) {
        int i = 1;
        if (nt == 4) {   /* CQ DX / CQ POTA / CQ 123 */
            int allL = 1, allD = 1;
            for (int k = 0; k < len[1]; k++) { allL &= osd_is_letter(tok[1][k]); allD &= osd_is_digit(tok[1][k]); }
            if (!((allL && len[1] >= 2 && len[1] <= 4) || (allD && len[1] == 3))) return false;
            i = 2;
        }
        if (!osd_call(tok[i], len[i])) return false;
        return nt == i + 1 || (nt == i + 2 && osd_tail(tok[i + 1], len[i + 1]));
    }
    if (nt > 3 || !osd_call(tok[0], len[0]) || !osd_call(tok[1], len[1])) return false;
    return nt == 2 || osd_tail(tok[2], len[2]);
}

static float osd_max2(float a, float b) { return (a >= b) ? a : b; }
static float osd_max4(float a, float b, float c, float d) { return osd_max2(osd_max2(a, b), osd_max2(c, d)); }
static const WF_ELEM_T *osd_cand_mag(const ftx_waterfall_t *wf, const ftx_candidate_t *c)
{
    int o = c->time_offset;
    o = o * wf->time_osr + c->time_sub;
    o = o * wf->freq_osr + c->freq_sub;
    o = o * wf->num_bins + c->freq_offset;
    return wf->mag + o;
}
static void osd_likelihood(const ftx_waterfall_t *wf, const ftx_candidate_t *cand, float *log174)
{
    const WF_ELEM_T *mag = osd_cand_mag(wf, cand);
    if (wf->protocol == FTX_PROTOCOL_FT4) {
        for (int k = 0; k < FT4_ND; ++k) {
            int sym = k + ((k < 29) ? 5 : ((k < 58) ? 9 : 13)), b = 2 * k, blk = cand->time_offset + sym;
            if (blk < 0 || blk >= wf->num_blocks) { log174[b] = log174[b + 1] = 0; continue; }
            const WF_ELEM_T *w = mag + sym * wf->block_stride; float s2[4];
            for (int j = 0; j < 4; ++j) s2[j] = WF_ELEM_MAG(w[kFT4_Gray_map[j]]);
            log174[b]     = osd_max2(s2[2], s2[3]) - osd_max2(s2[0], s2[1]);
            log174[b + 1] = osd_max2(s2[1], s2[3]) - osd_max2(s2[0], s2[2]);
        }
    } else {
        for (int k = 0; k < FT8_ND; ++k) {
            int sym = k + ((k < 29) ? 7 : 14), b = 3 * k, blk = cand->time_offset + sym;
            if (blk < 0 || blk >= wf->num_blocks) { log174[b] = log174[b + 1] = log174[b + 2] = 0; continue; }
            const WF_ELEM_T *w = mag + sym * wf->block_stride; float s2[8];
            for (int j = 0; j < 8; ++j) s2[j] = WF_ELEM_MAG(w[kFT8_Gray_map[j]]);
            log174[b]     = osd_max4(s2[4], s2[5], s2[6], s2[7]) - osd_max4(s2[0], s2[1], s2[2], s2[3]);
            log174[b + 1] = osd_max4(s2[2], s2[3], s2[6], s2[7]) - osd_max4(s2[0], s2[1], s2[4], s2[5]);
            log174[b + 2] = osd_max4(s2[1], s2[3], s2[5], s2[7]) - osd_max4(s2[0], s2[2], s2[4], s2[6]);
        }
    }
}

typedef struct { uint64_t w[3]; } bits174_t;
static inline int  b_get(const bits174_t *v, int i) { return (int)((v->w[i >> 6] >> (i & 63)) & 1u); }
static inline void b_set(bits174_t *v, int i)       { v->w[i >> 6] |= (uint64_t)1 << (i & 63); }
static inline void b_xor(bits174_t *a, const bits174_t *b) { a->w[0] ^= b->w[0]; a->w[1] ^= b->w[1]; a->w[2] ^= b->w[2]; }

/* Weighted distance of permuted codeword c from the permuted hard decisions;
   *nh = number of disagreeing bits. */
static float osd_dist(const bits174_t *c, const bits174_t *hard, const float *rel, int *nh)
{
    float d = 0; int n = 0;
    for (int k = 0; k < 3; k++) {
        uint64_t x = c->w[k] ^ hard->w[k];
        while (x) { int bit = __builtin_ctzll(x); d += rel[k * 64 + bit]; n++; x &= x - 1; }
    }
    *nh = n; return d;
}

/* CRC of a permuted codeword; on success the 91 info bits go to a91. */
static bool osd_crc_ok(const bits174_t *c, const int *perm, uint8_t *a91)
{
    uint8_t plain[FTX_LDPC_N];
    for (int p = 0; p < FTX_LDPC_N; p++) plain[perm[p]] = (uint8_t)b_get(c, p);
    for (int i = 0; i < FTX_LDPC_K_BYTES; i++) a91[i] = 0;
    for (int i = 0; i < FTX_LDPC_K; i++) if (plain[i]) a91[i / 8] |= (uint8_t)(0x80u >> (i % 8));
    uint8_t t[FTX_LDPC_K_BYTES]; memcpy(t, a91, sizeof t);
    const uint16_t ex = ftx_extract_crc(t);
    t[9] &= 0xF8; t[10] = 0;
    return ex == ftx_compute_crc(t, 96 - 14);
}

static bool osd_candidate(const ftx_waterfall_t *wf, const ftx_candidate_t *cand, ftx_message_t *msg, float *dist_out, int *nhard_out)
{
    float llr[FTX_LDPC_N];
    osd_likelihood(wf, cand, llr);
    { /* same normalisation as ftx_normalize_logl */
        float s1 = 0, s2 = 0;
        for (int i = 0; i < FTX_LDPC_N; i++) { s1 += llr[i]; s2 += llr[i] * llr[i]; }
        float var = (s2 - s1 * s1 / FTX_LDPC_N) / FTX_LDPC_N;
        if (var <= 0) return false;
        float g = sqrtf(24.0f / var); for (int i = 0; i < FTX_LDPC_N; i++) llr[i] *= g;
    }
    /* order bits by reliability, most reliable first */
    int perm[FTX_LDPC_N]; float rel[FTX_LDPC_N];
    for (int i = 0; i < FTX_LDPC_N; i++) perm[i] = i;
    for (int i = 1; i < FTX_LDPC_N; i++) {   /* insertion sort, 174 items */
        int v = perm[i]; float a = fabsf(llr[v]); int j = i - 1;
        while (j >= 0 && fabsf(llr[perm[j]]) < a) { perm[j + 1] = perm[j]; j--; }
        perm[j + 1] = v;
    }
    for (int p = 0; p < FTX_LDPC_N; p++) rel[p] = fabsf(llr[perm[p]]);

    /* generator rows in permuted column order: row r = info bit r + its parity */
    static bits174_t G[FTX_LDPC_K];
    int inv[FTX_LDPC_N]; for (int p = 0; p < FTX_LDPC_N; p++) inv[perm[p]] = p;
    for (int r = 0; r < FTX_LDPC_K; r++) {
        G[r].w[0] = G[r].w[1] = G[r].w[2] = 0;
        b_set(&G[r], inv[r]);
        for (int i = 0; i < FTX_LDPC_M; i++)
            if ((kFTX_LDPC_generator[i][r / 8] >> (7 - r % 8)) & 1) b_set(&G[r], inv[FTX_LDPC_K + i]);
    }
    /* reduce: pivot on the most reliable independent columns */
    int pivot[FTX_LDPC_K], rank = 0;
    for (int col = 0; col < FTX_LDPC_N && rank < FTX_LDPC_K; col++) {
        int r = rank; while (r < FTX_LDPC_K && !b_get(&G[r], col)) r++;
        if (r == FTX_LDPC_K) continue;
        if (r != rank) { bits174_t t = G[r]; G[r] = G[rank]; G[rank] = t; }
        for (int q = 0; q < FTX_LDPC_K; q++) if (q != rank && b_get(&G[q], col)) b_xor(&G[q], &G[rank]);
        pivot[rank++] = col;
    }
    if (rank < FTX_LDPC_K) return false;

    bits174_t hard = {{0, 0, 0}};
    for (int p = 0; p < FTX_LDPC_N; p++) if (llr[perm[p]] > 0) b_set(&hard, p);
    bits174_t c0 = {{0, 0, 0}};
    for (int r = 0; r < FTX_LDPC_K; r++) if (b_get(&hard, pivot[r])) b_xor(&c0, &G[r]);

    float best = 1e30f; int bestNh = 0; uint8_t bestA91[FTX_LDPC_K_BYTES]; bool found = false;
    uint8_t a91[FTX_LDPC_K_BYTES];
#define OSD_TRY(cw) do { int nh_; float d_ = osd_dist(&(cw), &hard, rel, &nh_); \
        if (d_ < best && osd_crc_ok(&(cw), perm, a91)) { best = d_; bestNh = nh_; memcpy(bestA91, a91, sizeof a91); found = true; } } while (0)
    OSD_TRY(c0);
    for (int r = 0; r < FTX_LDPC_K; r++) { bits174_t c = c0; b_xor(&c, &G[r]); OSD_TRY(c); }
    for (int r1 = FTX_LDPC_K - OSD_ORDER2; r1 < FTX_LDPC_K; r1++)
        for (int r2 = r1 + 1; r2 < FTX_LDPC_K; r2++) { bits174_t c = c0; b_xor(&c, &G[r1]); b_xor(&c, &G[r2]); OSD_TRY(c); }
#undef OSD_TRY
    if (!found || best > OSD_MAX_DIST || bestNh > OSD_MAX_NHARD) return false;

    uint8_t t[FTX_LDPC_K_BYTES]; memcpy(t, bestA91, sizeof t); t[9] &= 0xF8; t[10] = 0;
    msg->hash = ftx_compute_crc(t, 96 - 14);
    for (int i = 0; i < 10; ++i)
        msg->payload[i] = (wf->protocol == FTX_PROTOCOL_FT4) ? (uint8_t)(bestA91[i] ^ kFT4_XOR_sequence[i]) : bestA91[i];
    *dist_out = best; *nhard_out = bestNh;
    return true;
}

/* Rebuild one decoded signal and subtract it from x[0..n). The reference is
   the GFSK waveform of its tones (ported from ft8_lib demo/gen_ft8.c) at the
   decoder's frequency. Time is searched over ±half a symbol (per-symbol
   energy, which a small frequency error does not spoil), the frequency is
   corrected from the phase slope between symbols, both twice; then the
   complex amplitude is tracked with a one-symbol moving average of
   x·conj(ref) and 2·Re(a·ref) is subtracted. If that does not at least halve
   the signal's own correlation energy, the fit was wrong and it is undone. */
/* ref[k] = e^{j(2π·f0·k/sr)} · b[k]: the carrier by complex rotation
   (renormalised every 1024 samples) instead of a cos/sin per sample. */
static void make_ref(float *rr, float *ri, const float *br, const float *bi, int nw, float f0, int sr)
{
    const double w = 2 * M_PI * f0 / sr, sc = cos(w), ss = sin(w);
    double c = 1, s = 0;
    for (int k = 0; k < nw; k++) {
        rr[k] = (float)(c * br[k] - s * bi[k]);
        ri[k] = (float)(c * bi[k] + s * br[k]);
        const double c2 = c * sc - s * ss; s = s * sc + c * ss; c = c2;
        if ((k & 1023) == 1023) { const double g = 1 / sqrt(c * c + s * s); c *= g; s *= g; }
    }
}

/* Sum over every stride-th symbol of |Σ x·conj(ref)|² for a signal starting
   at x[tau]. */
static double sym_energy(const float *x, int n, int tau, const float *rr, const float *ri, int nn, int nsps, int stride)
{
    double E = 0;
    for (int s = 0; s < nn; s += stride) {
        double a = 0, b = 0;
        for (int k = s * nsps; k < (s + 1) * nsps; k++) {
            int q = tau + k; if (q < 0 || q >= n) continue;
            a += x[q] * rr[k]; b -= x[q] * ri[k];
        }
        E += a * a + b * b;
    }
    return E;
}

static void subtract_signal(float *x, int n, const result_t *r, int sr, float symP, float bt)
{
    const int nsps = (int)(0.5f + sr * symP), nn = r->nn, nw = nn * nsps;
    float  *pulse = (float *)malloc(sizeof(float) * 3 * nsps);
    float  *dphi  = (float *)malloc(sizeof(float) * (nw + 2 * nsps));
    double *ph    = (double *)malloc(sizeof(double) * nw);
    float  *br    = (float *)malloc(sizeof(float) * nw);   /* e^{j·ph}, once */
    float  *bi    = (float *)malloc(sizeof(float) * nw);
    float  *rr    = (float *)malloc(sizeof(float) * nw);
    float  *ri    = (float *)malloc(sizeof(float) * nw);
    float  *keep  = (float *)malloc(sizeof(float) * nw);
    double *cr    = (double *)malloc(sizeof(double) * (nw + 1));
    double *ci    = (double *)malloc(sizeof(double) * (nw + 1));
    if (!pulse || !dphi || !ph || !br || !bi || !rr || !ri || !keep || !cr || !ci) goto out;

    /* baseband GFSK phase (tone 0 at 0 Hz) */
    for (int i = 0; i < 3 * nsps; i++) {
        float t = i / (float)nsps - 1.5f;
        pulse[i] = (erff(GFSK_K * bt * (t + 0.5f)) - erff(GFSK_K * bt * (t - 0.5f))) / 2;
    }
    const float pk = 2 * (float)M_PI / nsps;
    for (int i = 0; i < nw + 2 * nsps; i++) dphi[i] = 0;
    for (int i = 0; i < nn; i++)
        for (int j = 0; j < 3 * nsps; j++) dphi[j + i * nsps] += pk * r->tones[i] * pulse[j];
    for (int j = 0; j < 2 * nsps; j++) {
        dphi[j] += pk * pulse[j + nsps] * r->tones[0];
        dphi[j + nn * nsps] += pk * pulse[j] * r->tones[nn - 1];
    }
    { double phi = 0; for (int k = 0; k < nw; k++) { ph[k] = phi; phi += dphi[k + nsps]; } }
    for (int k = 0; k < nw; k++) { br[k] = (float)cos(ph[k]); bi[k] = (float)sin(ph[k]); }

    float f0 = r->f_dec;
    int   tau = (int)lroundf(r->t_dec * sr);
    for (int it = 0; it < 2; it++) {
        make_ref(rr, ri, br, bi, nw, f0, sr);
        /* time: per-symbol energy at 1/16 symbol over 2.5 symbols back to 1
           ahead (the decoder's start is late by about 1.2 symbols, its
           analysis window, and real signals spread around that); then ±1/16
           at 1/64. */
        const int lo = it == 0 ? (5 * nsps) / 2 : nsps / 16, hi = it == 0 ? nsps : nsps / 16;
        const int step = it == 0 ? nsps / 16 : nsps / 64;
        double bestE = -1; int bestT = tau;
        for (int t = tau - lo; t <= tau + hi; t += (step > 0 ? step : 1)) {
            double E = sym_energy(x, n, t, rr, ri, nn, nsps, it == 0 ? COARSE_STRIDE : 1);
            if (E > bestE) { bestE = E; bestT = t; }
        }
        tau = bestT;
        /* frequency: phase slope between successive symbol correlations */
        double pr = 0, pi_ = 0, lr = 0, li = 0; int have = 0;
        for (int s = 0; s < nn; s++) {
            double sr_ = 0, si_ = 0;
            for (int k = s * nsps; k < (s + 1) * nsps; k++) {
                int q = tau + k; if (q < 0 || q >= n) continue;
                sr_ += x[q] * rr[k]; si_ -= x[q] * ri[k];
            }
            if (have) { pr += sr_ * lr + si_ * li; pi_ += si_ * lr - sr_ * li; }
            lr = sr_; li = si_; have = 1;
        }
        f0 += (float)(atan2(pi_, pr) / (2 * M_PI * symP));
    }
    make_ref(rr, ri, br, bi, nw, f0, sr);

    /* complex amplitude: one-symbol moving average of x·conj(ref) */
    cr[0] = ci[0] = 0;
    const double e0 = sym_energy(x, n, tau, rr, ri, nn, nsps, 1);
    for (int k = 0; k < nw; k++) {
        int q = tau + k; float v = (q >= 0 && q < n) ? x[q] : 0;
        keep[k] = v;
        cr[k + 1] = cr[k] + v * rr[k];
        ci[k + 1] = ci[k] - v * ri[k];
    }
    const int h = nsps / 2;
    for (int k = 0; k < nw; k++) {
        int q = tau + k; if (q < 0 || q >= n) continue;
        int a0 = k - h < 0 ? 0 : k - h, a1 = k + h > nw ? nw : k + h;
        double ar = (cr[a1] - cr[a0]) / (a1 - a0), ai = (ci[a1] - ci[a0]) / (a1 - a0);
        x[q] -= (float)(2 * (ar * rr[k] - ai * ri[k]));
    }
    /* What is left of the signal itself (its correlation with the reference),
       not the whole band, where a weak signal is a few per cent of the energy. */
    const double e1 = sym_energy(x, n, tau, rr, ri, nn, nsps, 1);
    if (e1 > 0.5 * e0)   /* the fit was wrong: put it back */
        for (int k = 0; k < nw; k++) { int q = tau + k; if (q >= 0 && q < n) x[q] = keep[k]; }
out:
    free(pulse); free(dphi); free(ph); free(br); free(bi); free(rr); free(ri); free(keep); free(cr); free(ci);
}

/* One decode over buf[skip..buf_n): feed the monitor, find candidates,
   append new messages to s_results (duplicates dropped), with what
   subtract_signal() needs. DT and t_dec count from the start of buf. */
static void decode_pass(const float *buf, int buf_n, int skip,
                        float freq_scale, float dt_scale)
{
    const float *decode_pcm = buf + skip;
    const int    decode_n   = buf_n - skip;
    const float  t0 = skip / (float)s_mon_rate * dt_scale;
    if (decode_n <= 0) return;
    monitor_reset(&s_mon);
    /* Feed the slot one symbol-block at a time, as Kiwi's sample path does. */
    for (int frame_pos = 0;
         frame_pos + s_mon.block_size <= decode_n;
         frame_pos += s_mon.block_size)
    {
        monitor_process(&s_mon, decode_pcm + frame_pos);
    }

    ftx_waterfall_t *wf = &s_mon.wf;

    ftx_candidate_t heap[MAX_CANDIDATES];
    int num_cands = ftx_find_candidates(wf, MAX_CANDIDATES, heap, MIN_SCORE);

    for (int i = 0; i < num_cands && s_count < MAX_RESULTS; i++) {
        ftx_message_t       msg;
        ftx_decode_status_t status;

        float osd_d = 0; int osd_nh = 0;
        status.ldpc_errors = 0;
        bool ok = ftx_decode_candidate(wf, &heap[i], LDPC_ITERATIONS, &msg, &status)
                  && status.ldpc_errors == 0 && status.crc_extracted == status.crc_calculated;
        /* FT8 only: FT4's 2-bit symbols give its likelihoods another spread, and the
           FT8 limits let 4 false decodes through in 2000 FT4 noise slots. */
        if (!ok && OSD_ENABLED && wf->protocol == FTX_PROTOCOL_FT8 &&
            heap[i].score >= OSD_MIN_SCORE && status.ldpc_errors <= OSD_MAX_BP_ERRORS)
            ok = osd_candidate(wf, &heap[i], &msg, &osd_d, &osd_nh);
        if (!ok) continue;

        /* NB: ftx_message_decode() dereferences `offsets` unconditionally
           (message.c:401) — passing NULL segfaults. */
        char                  text[MSG_BUF_LEN] = {0};
        ftx_message_offsets_t offsets;
        ftx_message_decode(&msg, &s_hash_if, text, &offsets);
        if (text[0] == '\0') continue;
        if (osd_d > 0 && !osd_plausible(text)) continue;

        /* Drop duplicates within the slot (Kiwi dedups via its message hash
           table; a linear scan over <=64 entries is equivalent here). */
        bool dup = false;
        for (int j = 0; j < s_count; j++) {
            if (0 == strcmp(s_results[j].text, text)) { dup = true; break; }
        }
        if (dup) continue;

        /* Kiwi: (min_bin + freq_offset + freq_sub/freq_osr) / symbol_period.
           status.freq is never assigned by ftx_decode_candidate(). */
        float freq_hz = (s_mon.min_bin + heap[i].freq_offset +
                         (float)heap[i].freq_sub / wf->freq_osr)
                        / s_mon.symbol_period * freq_scale;

        /* DT: where the decoded signal actually sat inside the analysis window,
           in seconds. Kiwi's time_sec. This is the residual capture-timing
           error — drive the capture lead-in from it and the client
           self-calibrates instead of relying on a hardcoded constant. */
        float dt = (heap[i].time_offset +
                    (float)heap[i].time_sub / wf->time_osr)
                   * s_mon.symbol_period * dt_scale + t0;

        strncpy(s_results[s_count].text, text, MSG_BUF_LEN - 1);
        s_results[s_count].freq = freq_hz;
        s_results[s_count].snr  = ftx_snr(wf, &heap[i], &msg,
                                          freq_scale / s_mon.symbol_period);
        s_results[s_count].dt   = dt;
        s_results[s_count].osd  = osd_d;
        s_results[s_count].osd_nhard = osd_nh;
        s_results[s_count].bp_errors = status.ldpc_errors;
        if (wf->protocol == FTX_PROTOCOL_FT8) { ft8_encode(msg.payload, s_results[s_count].tones); s_results[s_count].nn = FT8_NN; }
        else                                  { ft4_encode(msg.payload, s_results[s_count].tones); s_results[s_count].nn = FT4_NN; }
        s_results[s_count].f_dec = freq_hz / freq_scale;
        s_results[s_count].t_dec = (heap[i].time_offset + (float)heap[i].time_sub / wf->time_osr)
                                   * s_mon.symbol_period + skip / (float)s_mon_rate;
        s_count++;
    }

}

/* ── Integer decimation to ~12 kHz ─────────────────────────────────────────────
   The page hands over audio at the browser's output rate, often 48 kHz. The
   modes use only 100..3100 Hz, and the subtraction's cost grows with the rate
   (900 ms per busy FT8 slot at 48 kHz), so decode at sr/f with f = sr/12000:
   a Blackman-windowed sinc low-pass at 4.8 kHz, 16·f+1 taps. */
static void decimate(const float *x, int n, int f, int sr, float *y, int m)
{
    const int L = 16 * f + 1, c = 8 * f;
    float *h = (float *)malloc(sizeof(float) * L);
    if (!h) { for (int j = 0; j < m; j++) y[j] = x[j * f]; return; }
    const double fc = 4800.0 / sr;
    double sum = 0;
    for (int i = 0; i < L; i++) {
        const double t = i - c, w = 0.42 - 0.5 * cos(2 * M_PI * i / (L - 1)) + 0.08 * cos(4 * M_PI * i / (L - 1));
        h[i] = (float)(w * (t == 0 ? 2 * fc : sin(2 * M_PI * fc * t) / (M_PI * t)));
        sum += h[i];
    }
    for (int i = 0; i < L; i++) h[i] = (float)(h[i] / sum);
    for (int j = 0; j < m; j++) {
        const int base = j * f - c;
        double acc = 0;
        for (int i = 0; i < L; i++) { const int q = base + i; if (q >= 0 && q < n) acc += h[i] * x[q]; }
        y[j] = (float)acc;
    }
    free(h);
}

/* ── Main entry point ─────────────────────────────────────────────────────── */
int ftx_decode(const float *pcm, int num_samples, int js_protocol, int sample_rate)
{
    s_count = 0;

    if (sample_rate <= 0) sample_rate = DEFAULT_SAMPLE_RATE;

    float *dec_buf = NULL;
    {
        const int f = sample_rate / DEFAULT_SAMPLE_RATE;
        if (f >= 2 && sample_rate % f == 0) {
            const int m = num_samples / f;
            dec_buf = (float *)malloc((size_t)m * sizeof(float));
            if (!dec_buf) return 0;
            decimate(pcm, num_samples, f, sample_rate, dec_buf, m);
            pcm = dec_buf; num_samples = m; sample_rate /= f;
        }
    }

    /* Map JS convention (FT8=0, FT4=1, FT2=2) → C enum (FT4=0, FT8=1) */
    ftx_protocol_t protocol;
    const float   *decode_pcm = pcm;
    int            decode_n   = num_samples;
    float         *up_buf     = NULL;

    if (js_protocol == 0) {
        protocol = FTX_PROTOCOL_FT8;
    } else if (js_protocol == 1) {
        protocol = FTX_PROTOCOL_FT4;
    } else {
        /* FT2: 2x upsample then decode as FT4 at the same declared rate —
           doubling the sample count makes the doubled-rate symbols occupy the
           same number of samples an FT4 symbol would. */
        protocol = FTX_PROTOCOL_FT4;
        decode_n = num_samples * 2;
        up_buf   = (float *)malloc((size_t)decode_n * sizeof(float));
        if (!up_buf) { free(dec_buf); return 0; }
        upsample2x(pcm, num_samples, up_buf);
        decode_pcm = up_buf;
    }

    /* The FT2 buffer is stretched 2x in time but still analysed at the original
       declared rate, so every frequency in that domain sits at half its true
       audio value. Scale reported frequencies back up. (This affects only what
       is reported — the decode itself is correct, because an FT2 signal's
       doubled symbol rate and doubled tone spacing both halve into exactly the
       FT4 parameters the decoder expects.) */
    const float freq_scale = (js_protocol == 2) ? 2.0f : 1.0f;

    /* Time runs at half speed in that stretched domain, so a measured time
       offset must be halved to get real seconds — the inverse of freq_scale. */
    const float dt_scale = 1.0f / freq_scale;

    /* Reinit only when the sample rate or protocol changes; otherwise just
       reset, exactly as Kiwi does per slot. */
    if (!s_mon_init || s_mon_rate != sample_rate || s_mon_proto != (int)protocol) {
        if (s_mon_init) monitor_free(&s_mon);
        monitor_config_t cfg = {
            .f_min       = PASSBAND_LO,
            .f_max       = PASSBAND_HI,
            .sample_rate = sample_rate,
            .time_osr    = TIME_OSR,
            .freq_osr    = FREQ_OSR,
            .protocol    = protocol
        };
        monitor_init(&s_mon, &cfg);
        s_mon_init  = true;
        s_mon_rate  = sample_rate;
        s_mon_proto = (int)protocol;
    } else {
        monitor_reset(&s_mon);
    }

    /* Work on a copy: the passes subtract what they decoded from it. */
    float *work = (float *)malloc((size_t)decode_n * sizeof(float));
    if (!work) { free(up_buf); free(dec_buf); return 0; }
    memcpy(work, decode_pcm, (size_t)decode_n * sizeof(float));
    const float bt = (protocol == FTX_PROTOCOL_FT8) ? 2.0f : 1.0f;
    for (int pass = 0; pass < SUB_PASSES; pass++) {
        int before = s_count;
        decode_pass(work, decode_n, 0, freq_scale, dt_scale);
        if (protocol == FTX_PROTOCOL_FT4)
            decode_pass(work, decode_n, LATE_SKIP_BLOCKS * s_mon.block_size, freq_scale, dt_scale);
        if (s_count == before || pass == SUB_PASSES - 1) break;
        for (int i = before; i < s_count; i++)
            subtract_signal(work, decode_n, &s_results[i], s_mon_rate, s_mon.symbol_period, bt);
    }
    free(work);

    /* Age the callsign table once per slot, as Kiwi does at the end of decode() */
    hashtable_cleanup(CALLSIGN_AGE_MAX);

    free(up_buf);
    free(dec_buf);
    return s_count;
}

/* ── Accessors ────────────────────────────────────────────────────────────── */
const char *get_message_text(int i) { return (i>=0&&i<s_count)?s_results[i].text:""; }
float       get_freq(int i)         { return (i>=0&&i<s_count)?s_results[i].freq:0.0f; }
float       get_snr(int i)          { return (i>=0&&i<s_count)?s_results[i].snr:0.0f; }
#ifdef OSD_DEBUG
float       get_osd(int i)          { return (i>=0&&i<s_count)?s_results[i].osd:0.0f; }
float       get_osd_nhard(int i)    { return (i>=0&&i<s_count)?(float)s_results[i].osd_nhard:0.0f; }
float       get_bp_err(int i)       { return (i>=0&&i<s_count)?(float)s_results[i].bp_errors:0.0f; }
#endif
float       get_dt(int i)           { return (i>=0&&i<s_count)?s_results[i].dt:0.0f; }
