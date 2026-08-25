/*
 * js8_decode_test.c — end-to-end test for the JS8 receive path.
 *
 * Synthesises 8-FSK audio from js8_encode.c (the encoder that
 * check_against_reference.sh proves bit-identical to JS8Call), adds white
 * Gaussian noise at a chosen SNR, and runs the full decoder over it:
 * STFT -> Costas candidate search -> soft symbols -> BP -> CRC-12.
 *
 * The encoder and decoder share only js8_crc12(), so a successful decode is
 * two independent implementations agreeing, not one talking to itself.
 *
 * Modes:
 *   (default)   clean-signal + frequency/timing accuracy checks, all submodes
 *   --sweep     decode rate vs SNR per submode
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "js8_constants.h"
#include "js8_encode.h"
#include "js8_decode.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#define SAMPLE_RATE 12000
static int TIME_OSR = 2;   /* overridable via JS8_TIME_OSR for experiments */
static int FREQ_OSR = 2;   /* overridable via JS8_FREQ_OSR */
#define MAX_CAND    200
#define LDPC_ITERS  30

/* ── Deterministic Gaussian noise (Box-Muller over an LCG) ───────────────── */
static uint32_t g_rng = 1;
static void rng_seed(uint32_t s) { g_rng = s ? s : 1; }
static float rng_uniform(void)
{
    g_rng = g_rng * 1103515245u + 12345u;
    return ((g_rng >> 8) & 0xFFFFFF) / (float)0x1000000;
}
static float rng_gauss(void)
{
    float u1 = rng_uniform(); if (u1 < 1e-7f) u1 = 1e-7f;
    float u2 = rng_uniform();
    return sqrtf(-2.0f * logf(u1)) * cosf(2.0f * (float)M_PI * u2);
}

/* ── Modulator ────────────────────────────────────────────────────────────
 *
 * Two shapes are available, and the default matters.
 *
 * JS8 transmits plain CPFSK: JS8Call's Modulator.cpp holds the phase increment
 * constant for a whole symbol and accumulates phase across boundaries, with no
 * Gaussian shaping. That is NOT the same as FT8, which is GFSK, and assuming
 * otherwise cost real accuracy here -- it put the STFT timing correction half a
 * symbol out and made coherent subtraction useless, because a CPFSK reference
 * cannot cancel a GFSK signal (measured: -81 dB against CPFSK, -5.6 dB against
 * GFSK).
 *
 * synth() therefore generates CPFSK. The GFSK path is kept so the difference
 * can be re-measured rather than taken on trust.
 */

/* WSJT-X's gfsk_pulse (lib/gfsk_pulse.f90): the integral of a Gaussian, so
 * that summing one pulse per symbol gives a smoothly varying frequency. */
static double gfsk_pulse(double bt, double t)
{
    const double c = M_PI * sqrt(2.0 / log(2.0));
    return 0.5 * (erf(c * bt * (t + 0.5)) - erf(c * bt * (t - 0.5)));
}

static void synth_shaped(const uint8_t tones[JS8_NN], const js8_submode_t* sub,
                         float base_hz, float start_sec, float sigma,
                         float* buf, int nbuf, double bt)
{
    for (int i = 0; i < nbuf; i++) buf[i] = sigma > 0 ? sigma * rng_gauss() : 0.0f;

    float symbol_period = (float)sub->nsps / 12000.0f;
    int   sps = (int)(SAMPLE_RATE * symbol_period);
    int   pos = (int)(start_sec * SAMPLE_RATE);
    int   nsig = JS8_NN * sps;
    double phase = 0.0;

    for (int i = 0; i < nsig; i++)
    {
        double tsym = (double)i / sps;      /* time in symbols */
        double f;

        if (bt <= 0)
        {
            /* Plain CPFSK: hold each tone for its whole symbol. */
            int s = (int)tsym;
            if (s >= JS8_NN) s = JS8_NN - 1;
            f = base_hz + tones[s] * sub->baud;
        }
        else
        {
            /* GFSK: the instantaneous tone is the pulse-weighted sum of the
             * neighbouring symbols. Three symbols either side is far more than
             * the pulse needs at BT=2. */
            double tone = 0.0, wsum = 0.0;
            int s0 = (int)tsym;
            for (int s = s0 - 3; s <= s0 + 3; s++)
            {
                int si = s < 0 ? 0 : (s >= JS8_NN ? JS8_NN - 1 : s);
                double w = gfsk_pulse(bt, tsym - s);
                tone += w * tones[si];
                wsum += w;
            }
            if (wsum > 0) tone /= wsum;
            f = base_hz + tone * sub->baud;
        }

        int idx = pos + i;
        if (idx >= 0 && idx < nbuf) buf[idx] += (float)sin(phase);
        phase += 2.0 * M_PI * f / SAMPLE_RATE;
        if (phase > 2.0 * M_PI) phase -= 2.0 * M_PI;
    }
}

/** Default synthesis: CPFSK, which is what JS8Call's modulator transmits. */
static void synth(const uint8_t tones[JS8_NN], const js8_submode_t* sub,
                  float base_hz, float start_sec, float sigma,
                  float* buf, int nbuf)
{
    synth_shaped(tones, sub, base_hz, start_sec, sigma, buf, nbuf, 0.0);
}

/* SNR in a 2500 Hz reference bandwidth for a unit-amplitude tone in noise of
 * standard deviation sigma, sampled at SAMPLE_RATE. */
static float sigma_for_snr(float snr_db)
{
    float ratio = powf(10.0f, snr_db / 10.0f);
    return sqrtf(0.5f * (SAMPLE_RATE / 2.0f) / (ratio * 2500.0f));
}

/* ── Decode one buffer, return number of messages found ──────────────────── */
typedef struct { uint8_t payload[10]; uint8_t i3bit; float freq; float dt; int score; float snr; } result_t;

/* Passes used by decode_buffer(); 1 disables subtraction. Overridable so the
 * masked-signal test can measure what subtraction is actually worth. */
static int g_passes = 3;

static int decode_buffer(const float* buf, int nbuf, int submode,
                         float f_min, float f_max, result_t* out, int max_out)
{
    js8_monitor_t mon;
    js8_monitor_config_t cfg = {
        .f_min = f_min, .f_max = f_max, .sample_rate = SAMPLE_RATE,
        .time_osr = TIME_OSR, .freq_osr = FREQ_OSR, .submode = submode
    };
    if (!js8_monitor_init(&mon, &cfg)) { fprintf(stderr, "monitor init failed\n"); return -1; }

    js8_result_t res[64];
    int got = js8_decode_slot(&mon, buf, nbuf, SAMPLE_RATE, g_passes,
                              res, (int)(sizeof res / sizeof res[0]));

    int n = 0;
    for (int i = 0; i < got && n < max_out; i++)
    {
        memcpy(out[n].payload, res[i].msg.payload, 10);
        out[n].i3bit = res[i].msg.i3bit;
        out[n].freq  = res[i].freq;
        out[n].dt    = res[i].dt;
        out[n].snr   = res[i].status.snr;
        out[n].score = res[i].score;
        n++;
    }

    js8_monitor_free(&mon);
    return n;
}

/* ── Expected payload bytes for a test message ───────────────────────────── */
static void expected_payload(const char* msg, int i3bit, uint8_t out[10])
{
    uint8_t bits[JS8_LDPC_K];
    js8_pack(msg, i3bit, bits);
    memset(out, 0, 10);
    for (int i = 0; i < JS8_PAYLOAD_BITS; i++)
        if (bits[i]) out[i / 8] |= 0x80 >> (i % 8);
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

static int test_clean(void)
{
    printf("clean-signal decode, all five submodes\n");
    printf("  %-7s %8s %8s  %9s %8s  %s\n",
           "submode", "baud", "tx_hz", "freq_err", "dt_err", "result");

    int fail = 0;
    for (int sm = 0; sm < JS8_NUM_SUBMODES; sm++)
    {
        const js8_submode_t* sub = &kJS8_submodes[sm];
        const char* text = "SV1BTL000000";
        const int   i3   = 3;

        uint8_t tones[JS8_NN];
        if (js8_encode_message(text, i3, sub->ncostas, tones) != 0)
        {
            printf("  %-7s encode failed\n", sub->name); fail++; continue;
        }

        int nbuf = sub->ntxdur * SAMPLE_RATE;
        float* buf = malloc(nbuf * sizeof(float));
        float base = 1000.0f, start = 0.5f;
        rng_seed(12345);
        synth(tones, sub, base, start, 0.0f, buf, nbuf);

        result_t res[16];
        int n = decode_buffer(buf, nbuf, sm, 300.0f, 2700.0f, res, 16);

        uint8_t want[10];
        expected_payload(text, i3, want);

        int found = 0;
        float ferr = 0, dterr = 0;
        for (int i = 0; i < n; i++)
            if (!memcmp(res[i].payload, want, 10) && res[i].i3bit == i3)
            {
                found = 1;
                ferr  = res[i].freq - base;
                dterr = res[i].dt - start;
                break;
            }

        printf("  %-7s %8.3f %8.0f  %+9.2f %+8.3f  %s\n",
               sub->name, sub->baud, base, ferr, dterr,
               found ? "decoded" : "*** MISS ***");

        /* Frequency must land within half a tone spacing, timing within one
         * symbol -- anything worse and the reported spot would be wrong even
         * though the CRC passed. */
        if (!found) fail++;
        else if (fabsf(ferr) > sub->baud * 0.5f)
        {
            printf("      frequency error exceeds half a tone spacing\n"); fail++;
        }
        else if (fabsf(dterr) > 0.6f * (sub->nsps / 12000.0f))
        {
            printf("      timing error exceeds 0.6 symbol\n"); fail++;
        }

        free(buf);
    }
    return fail;
}

static int test_offsets(void)
{
    printf("\noff-centre frequency and timing, Normal submode\n");
    const js8_submode_t* sub = &kJS8_submodes[0];
    const char* text = "CQCQCQSV1BTL";
    const int i3 = 0;

    uint8_t tones[JS8_NN];
    js8_encode_message(text, i3, sub->ncostas, tones);
    uint8_t want[10];
    expected_payload(text, i3, want);

    const float freqs[] = { 500.0f, 1234.0f, 2000.0f, 2500.0f };
    const float starts[] = { 0.0f, 0.3f, 0.8f, 1.2f };
    int fail = 0, total = 0, ok = 0;

    for (unsigned fi = 0; fi < sizeof freqs / sizeof freqs[0]; fi++)
        for (unsigned si = 0; si < sizeof starts / sizeof starts[0]; si++)
        {
            int nbuf = sub->ntxdur * SAMPLE_RATE;
            float* buf = malloc(nbuf * sizeof(float));
            rng_seed(999);
            synth(tones, sub, freqs[fi], starts[si], 0.0f, buf, nbuf);

            result_t res[16];
            int n = decode_buffer(buf, nbuf, 0, 300.0f, 2900.0f, res, 16);
            int found = 0;
            for (int i = 0; i < n; i++)
                if (!memcmp(res[i].payload, want, 10)) { found = 1; break; }
            total++;
            if (found) ok++; else { printf("  MISS at %.0f Hz, start %.1f s\n", freqs[fi], starts[si]); fail++; }
            free(buf);
        }

    printf("  %d/%d combinations decoded\n", ok, total);
    return fail;
}

/* A strong station and a weak one in the same slot, 25 Hz apart -- four tone
 * spacings, so their skirts overlap in the sync search but their tone sets do
 * not coincide.
 *
 * That separation is where subtraction earns its keep. Closer than about 12 Hz
 * the two tone sets sit on top of each other and the residue is still enough to
 * hide the weak one; further out than about 50 Hz there is no masking to undo.
 */
static int test_masked(void)
{
    printf("\nweak signal masked by a strong one 25 Hz away (Normal)\n");
    const js8_submode_t* sub = &kJS8_submodes[0];
    const char* strong = "SV1BTL000000";
    const char* weak   = "HELLOWORLD00";

    uint8_t ts[JS8_NN], tw[JS8_NN];
    js8_encode_message(strong, 0, sub->ncostas, ts);
    js8_encode_message(weak,   1, sub->ncostas, tw);

    uint8_t want_s[10], want_w[10];
    expected_payload(strong, 0, want_s);
    expected_payload(weak,   1, want_w);

    const float weak_gain = 0.316f;          /* 10 dB below the strong one */
    int nbuf = sub->ntxdur * SAMPLE_RATE;
    float* buf = malloc(nbuf * sizeof(float));
    float* tmp = malloc(nbuf * sizeof(float));

    /* Noise set so the WEAK signal sits at -12 dB, comfortably decodable on
     * its own -- otherwise this would be measuring sensitivity, not masking. */
    rng_seed(2468);
    synth(ts, sub, 1200.0f, 0.5f, sigma_for_snr(-12.0f) * weak_gain, buf, nbuf);
    synth(tw, sub, 1225.0f, 0.5f, 0.0f, tmp, nbuf);
    for (int i = 0; i < nbuf; i++) buf[i] += weak_gain * tmp[i];

    int fail = 0;
    int weak_one_pass = 0;

    for (int passes = 1; passes <= 3; passes += 2)
    {
        g_passes = passes;
        result_t res[32];
        int n = decode_buffer(buf, nbuf, 0, 300.0f, 2700.0f, res, 32);

        int got_s = 0, got_w = 0;
        for (int i = 0; i < n; i++)
        {
            if (!memcmp(res[i].payload, want_s, 10)) got_s = 1;
            if (!memcmp(res[i].payload, want_w, 10)) got_w = 1;
        }
        printf("  %d pass%-3s strong %s   weak %s\n",
               passes, passes == 1 ? "" : "es",
               got_s ? "decoded" : "MISS   ",
               got_w ? "decoded" : "MISS");

        if (passes == 1) weak_one_pass = got_w;
        if (!got_s) { printf("      the strong signal must always decode\n"); fail++; }
        if (passes == 3 && !got_w)
        {
            printf("      subtraction did not reveal the weak signal\n");
            fail++;
        }
    }
    g_passes = 3;

    /* Not a failure, but the test has stopped testing what it claims to. */
    if (weak_one_pass)
        printf("      NOTE: one pass already found it -- retune the separation\n");

    free(buf); free(tmp);
    return fail;
}

static int test_multi(void)
{
    printf("\nthree overlapping signals in one slot, Normal submode\n");
    const js8_submode_t* sub = &kJS8_submodes[0];
    const char* texts[3] = { "SV1BTL000000", "CQCQCQSV1BTL", "HELLOWORLD00" };
    const float bases[3]  = { 700.0f, 1400.0f, 2100.0f };
    const float starts[3] = { 0.4f, 0.55f, 0.7f };

    int nbuf = sub->ntxdur * SAMPLE_RATE;
    float* buf = calloc(nbuf, sizeof(float));
    float* tmp = malloc(nbuf * sizeof(float));

    rng_seed(4242);
    for (int i = 0; i < nbuf; i++) buf[i] = sigma_for_snr(5.0f) * rng_gauss();

    for (int k = 0; k < 3; k++)
    {
        uint8_t tones[JS8_NN];
        js8_encode_message(texts[k], k, sub->ncostas, tones);
        synth(tones, sub, bases[k], starts[k], 0.0f, tmp, nbuf);
        for (int i = 0; i < nbuf; i++) buf[i] += tmp[i];
    }

    result_t res[32];
    int n = decode_buffer(buf, nbuf, 0, 300.0f, 2900.0f, res, 32);

    int ok = 0;
    for (int k = 0; k < 3; k++)
    {
        uint8_t want[10];
        expected_payload(texts[k], k, want);
        int found = 0;
        for (int i = 0; i < n; i++)
            if (!memcmp(res[i].payload, want, 10) && res[i].i3bit == k) { found = 1; break; }
        printf("  %-12s at %4.0f Hz : %s\n", texts[k], bases[k], found ? "decoded" : "*** MISS ***");
        if (found) ok++;
    }
    free(buf); free(tmp);
    return ok == 3 ? 0 : 1;
}

static void test_sweep(int trials)
{
    printf("decode rate vs SNR (%d trials per point, 2500 Hz reference bandwidth)\n\n", trials);
    printf("  %-7s", "SNR dB");
    for (int sm = 0; sm < JS8_NUM_SUBMODES; sm++) printf("%9s", kJS8_submodes[sm].name);
    printf("\n");

    for (float snr = -8.0f; snr >= -26.0f; snr -= 2.0f)
    {
        printf("  %-7.0f", snr);
        for (int sm = 0; sm < JS8_NUM_SUBMODES; sm++)
        {
            const js8_submode_t* sub = &kJS8_submodes[sm];
            int hits = 0;
            for (int t = 0; t < trials; t++)
            {
                char text[13];
                snprintf(text, sizeof text, "TEST%08d", t % 100000000);
                uint8_t tones[JS8_NN];
                if (js8_encode_message(text, t % 8, sub->ncostas, tones) != 0) continue;

                int nbuf = sub->ntxdur * SAMPLE_RATE;
                float* buf = malloc(nbuf * sizeof(float));
                rng_seed(1000u + t * 77u + sm * 13u);
                float base = 800.0f + (t % 5) * 200.0f;
                synth(tones, sub, base, 0.4f, sigma_for_snr(snr), buf, nbuf);

                result_t res[32];
                int n = decode_buffer(buf, nbuf, sm, 300.0f, 2700.0f, res, 32);
                uint8_t want[10];
                expected_payload(text, t % 8, want);
                for (int i = 0; i < n; i++)
                    if (!memcmp(res[i].payload, want, 10)) { hits++; break; }
                free(buf);
            }
            printf("%8.0f%%", 100.0 * hits / trials);
        }
        printf("\n");
    }
}

int main(int argc, char** argv)
{
    if (getenv("JS8_TIME_OSR")) TIME_OSR = atoi(getenv("JS8_TIME_OSR"));
    if (getenv("JS8_FREQ_OSR")) FREQ_OSR = atoi(getenv("JS8_FREQ_OSR"));

    /* Write a raw float32 PCM slot plus its expected payload, for the node
     * test that exercises the built wasm (see js8_wasm_test.mjs). */
    if (argc > 1 && !strcmp(argv[1], "--dump"))
    {
        int sm = (argc > 2) ? atoi(argv[2]) : 0;
        const char* path = (argc > 3) ? argv[3] : "/tmp/js8_slot.f32";
        const js8_submode_t* sub = &kJS8_submodes[sm];
        const char* text = "SV1BTL000000";
        const int i3 = 3;

        uint8_t tones[JS8_NN];
        js8_encode_message(text, i3, sub->ncostas, tones);
        int nbuf = sub->ntxdur * SAMPLE_RATE;
        float* buf = malloc(nbuf * sizeof(float));
        rng_seed(777);
        synth(tones, sub, 1500.0f, 0.5f, sigma_for_snr(-10.0f), buf, nbuf);

        FILE* f = fopen(path, "wb");
        if (!f) { perror("fopen"); return 1; }
        fwrite(buf, sizeof(float), nbuf, f);
        fclose(f);

        uint8_t want[10];
        expected_payload(text, i3, want);
        printf("submode %d %s samples %d expect ", sm, sub->name, nbuf);
        for (int i = 0; i < 10; i++) printf("%02x", want[i]);
        printf(" i3bit %d freq 1500 dt 0.5\n", i3);
        free(buf);
        return 0;
    }

    /* Synthesise a slot carrying one REAL JS8 frame, given as the 12
     * alphabet72 characters JS8Call would transmit, plus its i3bit. Used by
     * js8_chain_test.mjs to drive the whole chain: audio -> wasm -> js8.js.
     *   --dumpframe <12 chars> <i3bit> <submode> <path> */
    if (argc > 5 && !strcmp(argv[1], "--dumpframe"))
    {
        static const char* A72 =
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+/?.";
        const char* text = argv[2];
        int i3 = atoi(argv[3]);
        int sm = atoi(argv[4]);
        const char* path = argv[5];

        if ((int)strlen(text) != 12) { fprintf(stderr, "need 12 chars\n"); return 1; }

        uint8_t payload[75];
        int pos = 0;
        for (int i = 0; i < 12; i++)
        {
            const char* p = strchr(A72, text[i]);
            if (!p) { fprintf(stderr, "bad char %c\n", text[i]); return 1; }
            int v = (int)(p - A72);
            for (int b = 5; b >= 0; b--) payload[pos++] = (v >> b) & 1;
        }
        for (int b = 2; b >= 0; b--) payload[pos++] = (i3 >> b) & 1;

        uint8_t bits[JS8_LDPC_K], cw[JS8_LDPC_N], tones[JS8_NN];
        js8_pack_raw(payload, bits);
        js8_encode174(bits, cw);
        const js8_submode_t* sub = &kJS8_submodes[sm];
        js8_tones(cw, sub->ncostas, tones);

        int nbuf = sub->ntxdur * SAMPLE_RATE;
        float* buf = malloc(nbuf * sizeof(float));
        rng_seed(31337);
        synth(tones, sub, 1200.0f, 0.5f, sigma_for_snr(-12.0f), buf, nbuf);

        FILE* f = fopen(path, "wb");
        if (!f) { perror("fopen"); return 1; }
        fwrite(buf, sizeof(float), nbuf, f);
        fclose(f);
        printf("%s %d %d %d\n", text, i3, sm, nbuf);
        free(buf);
        return 0;
    }

    /* Diagnose a real off-air recording: how strong are the Costas candidates,
     * and where do they die -- sync, LDPC, or CRC?
     *   --analyze <file.f32> <submode> [minScore] [startOffsetSec]
     *
     * The offset matters: JS8 slots are UTC-aligned, and a window that
     * straddles a boundary decodes nothing however good the decoder is. */
    if (argc > 3 && !strcmp(argv[1], "--analyze"))
    {
        const char* path = argv[2];
        int sm = atoi(argv[3]);
        int minScore = (argc > 4) ? atoi(argv[4]) : 0;
        float startOff = (argc > 5) ? (float)atof(argv[5]) : 0.0f;
        const js8_submode_t* sub = &kJS8_submodes[sm];

        FILE* f = fopen(path, "rb");
        if (!f) { perror("fopen"); return 1; }
        fseek(f, 0, SEEK_END);
        long bytes = ftell(f);
        fseek(f, 0, SEEK_SET);
        int n = (int)(bytes / 4);
        float* buf = malloc((size_t)n * sizeof(float));
        if (fread(buf, sizeof(float), n, f) != (size_t)n) { fprintf(stderr, "short read\n"); return 1; }
        fclose(f);

        printf("%s: %d samples (%.1f s), submode %s, cycle %d s\n",
               path, n, n / (float)SAMPLE_RATE, sub->name, sub->period);

        /* RMS, so a dead or clipped capture is obvious before anything else. */
        double sum2 = 0;
        for (int i = 0; i < n; i++) sum2 += buf[i] * (double)buf[i];
        printf("  rms %.5f\n", sqrt(sum2 / n));

        int slotSamples = sub->ntxdur * SAMPLE_RATE;
        printf("  aligning first slot at +%.3f s\n", startOff);
        for (int start = (int)(startOff * SAMPLE_RATE);
             start + slotSamples <= n;
             start += sub->period * SAMPLE_RATE)
        {
            js8_monitor_t mon;
            js8_monitor_config_t cfg = {
                .f_min = 200.0f, .f_max = 3000.0f, .sample_rate = SAMPLE_RATE,
                .time_osr = TIME_OSR, .freq_osr = FREQ_OSR, .submode = sm
            };
            if (!js8_monitor_init(&mon, &cfg)) { fprintf(stderr, "monitor init failed\n"); return 1; }

            for (int pos = start; pos + mon.block_size <= start + slotSamples; pos += mon.block_size)
                js8_monitor_process(&mon, buf + pos);

            js8_candidate_t heap[MAX_CAND];
            int nc = js8_find_candidates(&mon.wf, MAX_CAND, heap, minScore);

            int ldpcOk = 0, crcOk = 0;
            for (int i = 0; i < nc; i++) {
                js8_message_t msg; js8_decode_status_t st;
                if (js8_decode_candidate(&mon, &heap[i], LDPC_ITERS, &msg, &st)) crcOk++;
                else if (st.ldpc_errors == 0) ldpcOk++;
            }

            printf("  t=%5.1fs  candidates %3d  best score %3d  ldpc-ok-crc-bad %2d  decoded %2d",
                   start / (float)SAMPLE_RATE, nc, nc ? heap[0].score : 0, ldpcOk, crcOk);
            if (nc) {
                printf("   top:");
                for (int i = 0; i < 5 && i < nc; i++)
                    printf(" %d@%.0fHz", heap[i].score, js8_candidate_freq(&mon, &heap[i]));
            }
            printf("\n");
            js8_monitor_free(&mon);
        }
        free(buf);
        return 0;
    }

    /* Does the reported SNR track the real one? The synthesised slots have a
     * known SNR by construction, so this is a direct accuracy measurement --
     * the thing the old sync-score proxy could never be checked against. */
    /* Write N consecutive 15 s slots, each carrying a different message at a
     * known SNR, slot-aligned from sample 0. Feeds the like-for-like
     * sensitivity comparison against JS8Call's own decoder -- both decoders
     * see the identical file, so neither side's SNR scale is involved.
     *   --dumpsweep <snr_db> <nslots> <path> */
    if (argc > 4 && !strcmp(argv[1], "--dumpsweep"))
    {
        float snr = (float)atof(argv[2]);
        int nslots = atoi(argv[3]);
        const char* path = argv[4];
        const js8_submode_t* sub = &kJS8_submodes[0];

        int slot = sub->period * SAMPLE_RATE;
        int total = slot * nslots;
        float* buf = calloc(total, sizeof(float));
        if (!buf) return 1;

        rng_seed(7777);
        for (int i = 0; i < total; i++) buf[i] = sigma_for_snr(snr) * rng_gauss();

        for (int k = 0; k < nslots; k++)
        {
            char text[13];
            snprintf(text, sizeof text, "SLOT%08d", k);
            uint8_t tones[JS8_NN];
            if (js8_encode_message(text, 3, sub->ncostas, tones) != 0) continue;
            /* Signal only, added on top of the noise already laid down. */
            float* one = calloc(slot, sizeof(float));
            synth(tones, sub, 1500.0f, 0.5f, 0.0f, one, slot);
            for (int i = 0; i < slot; i++) buf[k * slot + i] += one[i];
            free(one);
        }

        FILE* f = fopen(path, "wb");
        if (!f) { free(buf); return 1; }
        fwrite(buf, sizeof(float), total, f);
        fclose(f);
        printf("%d slots at %.0f dB -> %s\n", nslots, snr, path);
        free(buf);
        return 0;
    }

    /* Decode a file written by --dumpsweep and report how many slots decoded.
     *   --countslots <path> <nslots> */
    if (argc > 3 && !strcmp(argv[1], "--countslots"))
    {
        const char* path = argv[2];
        int nslots = atoi(argv[3]);
        const js8_submode_t* sub = &kJS8_submodes[0];
        int slot = sub->period * SAMPLE_RATE;

        FILE* f = fopen(path, "rb");
        if (!f) { perror("fopen"); return 1; }
        float* buf = malloc((size_t)slot * nslots * sizeof(float));
        if (fread(buf, sizeof(float), (size_t)slot * nslots, f) != (size_t)slot * nslots)
        { fprintf(stderr, "short read\n"); return 1; }
        fclose(f);

        int hits = 0;
        for (int k = 0; k < nslots; k++)
        {
            char text[13];
            snprintf(text, sizeof text, "SLOT%08d", k);
            uint8_t want[10];
            expected_payload(text, 3, want);

            result_t res[32];
            int n = decode_buffer(buf + (size_t)k * slot,
                                  (int)(sub->ntxdur * SAMPLE_RATE),
                                  0, 300.0f, 2700.0f, res, 32);
            for (int i = 0; i < n; i++)
                if (!memcmp(res[i].payload, want, 10)) { hits++; break; }
        }
        printf("%d/%d\n", hits, nslots);
        free(buf);
        return 0;
    }

    /* Decode a REAL recording twice -- once with subtraction, once without --
     * and report what the extra passes found. This is the only way to tell
     * whether multi-pass earns its keep on the air rather than on synthesised
     * overlaps we designed ourselves.
     *   --realpasses <file.f32> <startOffsetSamples> <nslots> */
    if (argc > 4 && !strcmp(argv[1], "--realpasses"))
    {
        const char* path = argv[2];
        int off = atoi(argv[3]);
        int nslots = atoi(argv[4]);
        const js8_submode_t* sub = &kJS8_submodes[0];
        int slot = sub->period * SAMPLE_RATE;
        int cap  = (int)(sub->ntxdur * SAMPLE_RATE);

        FILE* f = fopen(path, "rb");
        if (!f) { perror("fopen"); return 1; }
        fseek(f, 0, SEEK_END);
        long bytes = ftell(f);
        fseek(f, 0, SEEK_SET);
        int n = (int)(bytes / 4);
        float* buf = malloc((size_t)n * sizeof(float));
        if (fread(buf, sizeof(float), n, f) != (size_t)n) { fprintf(stderr, "short read\n"); return 1; }
        fclose(f);

        int tot1 = 0, tot3 = 0, extra = 0;
        printf("slot  1-pass  3-pass   frames only the extra passes found\n");

        for (int k = 0; k < nslots; k++)
        {
            int start = off + k * slot;
            if (start < 0 || start + cap > n) continue;

            result_t r1[32], r3[32];
            g_passes = 1;
            int n1 = decode_buffer(buf + start, cap, 0, 200.0f, 3000.0f, r1, 32);
            g_passes = 3;
            int n3 = decode_buffer(buf + start, cap, 0, 200.0f, 3000.0f, r3, 32);

            tot1 += n1;
            tot3 += n3;

            /* Anything in the 3-pass set that the 1-pass set did not contain. */
            char note[256] = "";
            for (int i = 0; i < n3; i++)
            {
                bool seen = false;
                for (int j = 0; j < n1; j++)
                    if (!memcmp(r1[j].payload, r3[i].payload, 10)) { seen = true; break; }
                if (seen) continue;
                extra++;
                char one[64];
                snprintf(one, sizeof one, " %.0fHz/%.0fdB", r3[i].freq, r3[i].snr);
                strncat(note, one, sizeof note - strlen(note) - 1);
            }

            if (n1 || n3)
                printf("%4d  %6d  %6d   %s\n", k, n1, n3, note);
        }
        g_passes = 3;

        printf("\ntotal: %d with one pass, %d with three (%d extra)\n", tot1, tot3, extra);
        free(buf);
        return 0;
    }

    if (argc > 1 && !strcmp(argv[1], "--snracc"))
    {
        int trials = (argc > 2) ? atoi(argv[2]) : 12;
        printf("reported SNR vs true SNR (Normal, %d trials per point)\n\n", trials);
        printf("  %-8s %-9s %-9s %s\n", "true dB", "mean dB", "error", "spread");

        double worst = 0.0;
        for (float snr = -6.0f; snr >= -20.0f; snr -= 2.0f)
        {
            const js8_submode_t* sub = &kJS8_submodes[0];
            double sum = 0, lo = 1e9, hi = -1e9;
            int n = 0;
            for (int t = 0; t < trials; t++)
            {
                char text[13];
                snprintf(text, sizeof text, "TEST%08d", t % 100000000);
                uint8_t tones[JS8_NN];
                if (js8_encode_message(text, 0, sub->ncostas, tones) != 0) continue;

                int nbuf = sub->ntxdur * SAMPLE_RATE;
                float* buf = malloc(nbuf * sizeof(float));
                rng_seed(500u + t * 37u);
                synth(tones, sub, 900.0f + (t % 4) * 300.0f, 0.5f, sigma_for_snr(snr), buf, nbuf);

                result_t res[32];
                int cnt = decode_buffer(buf, nbuf, 0, 300.0f, 2700.0f, res, 32);
                uint8_t want[10];
                expected_payload(text, 0, want);
                for (int i = 0; i < cnt; i++)
                    if (!memcmp(res[i].payload, want, 10))
                    {
                        sum += res[i].snr; n++;
                        if (res[i].snr < lo) lo = res[i].snr;
                        if (res[i].snr > hi) hi = res[i].snr;
                        break;
                    }
                free(buf);
            }
            if (!n) { printf("  %-8.0f (no decodes)\n", snr); continue; }
            double mean = sum / n;
            printf("  %-8.0f %-9.1f %+-9.1f %.1f..%.1f  (%d decodes)\n",
                   snr, mean, mean - snr, lo, hi, n);
            if (fabs(mean - snr) > worst) worst = fabs(mean - snr);
        }
        printf("\nworst mean error: %.1f dB\n", worst);
        return 0;
    }

    if (argc > 1 && !strcmp(argv[1], "--sweep"))
    {
        int trials = (argc > 2) ? atoi(argv[2]) : 20;
        test_sweep(trials);
        return 0;
    }

    int fail = 0;
    fail += test_clean();
    fail += test_offsets();
    fail += test_multi();
    fail += test_masked();

    printf("\n%s\n", fail ? "*** FAILURES ***" : "all decoder tests passed");
    return fail ? 1 : 0;
}
