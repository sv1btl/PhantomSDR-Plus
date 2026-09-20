/* js8_decode.c — JS8 receive path. See js8_decode.h for why this is a
 * parallel implementation rather than an extension of ft8_lib's decode.c. */

#include "js8_decode.h"
#include "js8_encode.h"   /* js8_crc12 only */
#include "js8_osd.h"
#include "js8_subtract.h"

#include <stdlib.h>

#include <math.h>
#include <stdlib.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/* Magnitudes are stored as 0.5 dB steps over -120..0 dB, as in ft8_lib. */
#define MAG_DB(x)     ((float)(x) * 0.5f - 120.0f)
#define MAG_INT(x)    ((int)(x))

/* ── Monitor ─────────────────────────────────────────────────────────────── */

static float hann_i(int i, int N)
{
    float x = sinf((float)M_PI * i / N);
    return x * x;
}

bool js8_monitor_init(js8_monitor_t* me, const js8_monitor_config_t* cfg)
{
    if (cfg->submode < 0 || cfg->submode >= JS8_NUM_SUBMODES) return false;

    memset(me, 0, sizeof *me);
    me->sub = &kJS8_submodes[cfg->submode];

    /* Symbol period is a property of the submode, not of our sample rate:
     * NSPS is defined at JS8Call's fixed 12000 Hz. */
    me->symbol_period = (float)me->sub->nsps / 12000.0f;

    me->block_size    = (int)(cfg->sample_rate * me->symbol_period);
    if (me->block_size <= 0) return false;
    me->subblock_size = me->block_size / cfg->time_osr;
    me->nfft          = me->block_size * cfg->freq_osr;
    me->fft_norm      = 2.0f / me->nfft;

    me->window = (float*)malloc(me->nfft * sizeof(float));
    if (!me->window) return false;
    for (int i = 0; i < me->nfft; ++i)
        me->window[i] = me->fft_norm * hann_i(i, me->nfft);

    me->last_frame = (float*)calloc(me->nfft, sizeof(float));
    if (!me->last_frame) { free(me->window); return false; }

    size_t fft_work_size = 0;
    kiss_fftr_alloc(me->nfft, 0, 0, &fft_work_size);
    me->fft_work = malloc(fft_work_size);
    if (!me->fft_work) { free(me->window); free(me->last_frame); return false; }
    me->fft_cfg = kiss_fftr_alloc(me->nfft, 0, me->fft_work, &fft_work_size);

    /* One bin per tone spacing. symbol_period is the reciprocal of the tone
     * spacing, so bin index == frequency * symbol_period. */
    me->min_bin = (int)(cfg->f_min * me->symbol_period);
    me->max_bin = (int)(cfg->f_max * me->symbol_period) + 1;
    if (me->min_bin < 0) me->min_bin = 0;
    if (me->max_bin > me->nfft / (2 * cfg->freq_osr))
        me->max_bin = me->nfft / (2 * cfg->freq_osr);

    int num_bins = me->max_bin - me->min_bin;
    if (num_bins < 8) { js8_monitor_free(me); return false; }

    /* Enough symbol slots to hold the whole T/R period. */
    int max_blocks = (int)(me->sub->ntxdur / me->symbol_period);
    if (max_blocks < JS8_NN) max_blocks = JS8_NN;

    me->wf.max_blocks   = max_blocks;
    me->wf.num_blocks   = 0;
    me->wf.num_bins     = num_bins;
    me->wf.time_osr     = cfg->time_osr;
    me->wf.freq_osr     = cfg->freq_osr;
    me->wf.block_stride = cfg->time_osr * cfg->freq_osr * num_bins;
    me->wf.ncostas      = me->sub->ncostas;
    me->wf.mag = (uint8_t*)malloc((size_t)max_blocks * me->wf.block_stride);
    if (!me->wf.mag) { js8_monitor_free(me); return false; }

    return true;
}

void js8_monitor_free(js8_monitor_t* me)
{
    free(me->wf.mag);   me->wf.mag = NULL;
    free(me->fft_work); me->fft_work = NULL;
    free(me->last_frame); me->last_frame = NULL;
    free(me->window);   me->window = NULL;
}

void js8_monitor_reset(js8_monitor_t* me)
{
    me->wf.num_blocks = 0;
    memset(me->last_frame, 0, me->nfft * sizeof(float));
}

void js8_monitor_process(js8_monitor_t* me, const float* frame)
{
    if (me->wf.num_blocks >= me->wf.max_blocks) return;

    int offset = me->wf.num_blocks * me->wf.block_stride;
    int frame_pos = 0;

    for (int time_sub = 0; time_sub < me->wf.time_osr; ++time_sub)
    {
        kiss_fft_scalar timedata[me->nfft];
        kiss_fft_cpx    freqdata[me->nfft / 2 + 1];

        for (int pos = 0; pos < me->nfft - me->subblock_size; ++pos)
            me->last_frame[pos] = me->last_frame[pos + me->subblock_size];
        for (int pos = me->nfft - me->subblock_size; pos < me->nfft; ++pos)
            me->last_frame[pos] = frame[frame_pos++];

        for (int pos = 0; pos < me->nfft; ++pos)
            timedata[pos] = me->window[pos] * me->last_frame[pos];
        kiss_fftr(me->fft_cfg, timedata, freqdata);

        for (int freq_sub = 0; freq_sub < me->wf.freq_osr; ++freq_sub)
        {
            for (int bin = me->min_bin; bin < me->max_bin; ++bin)
            {
                int src = (bin * me->wf.freq_osr) + freq_sub;
                float mag2 = freqdata[src].i * freqdata[src].i +
                             freqdata[src].r * freqdata[src].r;
                float db = 10.0f * log10f(1E-12f + mag2);
                int scaled = (int)(2 * db + 240);
                me->wf.mag[offset++] = (scaled < 0) ? 0 : ((scaled > 255) ? 255 : scaled);
            }
        }
    }

    ++me->wf.num_blocks;
}

/* ── Candidate search ────────────────────────────────────────────────────── */

static const uint8_t* get_cand_mag(const js8_waterfall_t* wf, const js8_candidate_t* c)
{
    int offset = c->time_offset;
    offset = (offset * wf->time_osr) + c->time_sub;
    offset = (offset * wf->freq_osr) + c->freq_sub;
    offset = (offset * wf->num_bins) + c->freq_offset;
    return wf->mag + offset;
}

/* Costas blocks sit at symbols 0..6, 36..42 and 72..78 -- the same geometry as
 * FT8, but for submodes B/C/E/I each block carries a DIFFERENT pattern. */
static int js8_sync_score(const js8_waterfall_t* wf, const js8_candidate_t* cand)
{
    static const int kSyncStart[3] = { 0, 36, 72 };
    const uint8_t (*costas)[7] = kJS8_Costas_pattern[wf->ncostas == 1 ? 0 : 1];

    int score = 0;
    int num_average = 0;
    const uint8_t* mag_cand = get_cand_mag(wf, cand);

    for (int m = 0; m < 3; ++m)
    {
        for (int k = 0; k < 7; ++k)
        {
            int block     = kSyncStart[m] + k;
            int block_abs = cand->time_offset + block;
            if (block_abs < 0) continue;
            if (block_abs >= wf->num_blocks) break;

            const uint8_t* p8 = mag_cand + (block * wf->block_stride);
            int sm = costas[m][k];

            if (sm > 0)
            {
                score += MAG_INT(p8[sm]) - MAG_INT(p8[sm - 1]);
                ++num_average;
            }
            if (sm < 7)
            {
                score += MAG_INT(p8[sm]) - MAG_INT(p8[sm + 1]);
                ++num_average;
            }
            if ((k > 0) && (block_abs > 0))
            {
                score += MAG_INT(p8[sm]) - MAG_INT(p8[sm - wf->block_stride]);
                ++num_average;
            }
            if (((k + 1) < 7) && ((block_abs + 1) < wf->num_blocks))
            {
                score += MAG_INT(p8[sm]) - MAG_INT(p8[sm + wf->block_stride]);
                ++num_average;
            }
        }
    }

    if (num_average > 0) score /= num_average;
    return score;
}

static void heapify_down(js8_candidate_t heap[], int heap_size)
{
    int current = 0;
    while (true)
    {
        int left = 2 * current + 1, right = left + 1, smallest = current;
        if ((left  < heap_size) && (heap[left].score  < heap[smallest].score)) smallest = left;
        if ((right < heap_size) && (heap[right].score < heap[smallest].score)) smallest = right;
        if (smallest == current) break;
        js8_candidate_t tmp = heap[smallest];
        heap[smallest] = heap[current];
        heap[current] = tmp;
        current = smallest;
    }
}

static void heapify_up(js8_candidate_t heap[], int heap_size)
{
    int current = heap_size - 1;
    while (current > 0)
    {
        int parent = (current - 1) / 2;
        if (!(heap[current].score < heap[parent].score)) break;
        js8_candidate_t tmp = heap[parent];
        heap[parent] = heap[current];
        heap[current] = tmp;
        current = parent;
    }
}

int js8_find_candidates(const js8_waterfall_t* wf, int num_candidates,
                        js8_candidate_t heap[], int min_score)
{
    int heap_size = 0;
    js8_candidate_t candidate;

    /* A candidate may start before the captured window or run past its end, as
     * long as the data symbols are present; the score is averaged over however
     * many sync symbols actually fell inside. The upper bound scales with the
     * submode, since a 4 s Ultra slot holds far more start positions than a
     * 15 s Normal one. */
    int time_max = wf->max_blocks - JS8_NN + 10;
    if (time_max < 1) time_max = 1;

    for (candidate.time_sub = 0; candidate.time_sub < wf->time_osr; ++candidate.time_sub)
    for (candidate.freq_sub = 0; candidate.freq_sub < wf->freq_osr; ++candidate.freq_sub)
    for (candidate.time_offset = -10; candidate.time_offset < time_max; ++candidate.time_offset)
    for (candidate.freq_offset = 0; (candidate.freq_offset + 7) < wf->num_bins; ++candidate.freq_offset)
    {
        candidate.score = (int16_t)js8_sync_score(wf, &candidate);
        if (candidate.score < min_score) continue;

        if ((heap_size == num_candidates) && (candidate.score > heap[0].score))
        {
            --heap_size;
            heap[0] = heap[heap_size];
            heapify_down(heap, heap_size);
        }
        if (heap_size < num_candidates)
        {
            heap[heap_size] = candidate;
            ++heap_size;
            heapify_up(heap, heap_size);
        }
    }

    /* Heap-sort into descending score order. */
    int len_unsorted = heap_size;
    while (len_unsorted > 1)
    {
        js8_candidate_t tmp = heap[len_unsorted - 1];
        heap[len_unsorted - 1] = heap[0];
        heap[0] = tmp;
        len_unsorted--;
        heapify_down(heap, len_unsorted);
    }

    return heap_size;
}

/* ── Soft symbol extraction ──────────────────────────────────────────────── */

static float max2(float a, float b) { return (a >= b) ? a : b; }
static float max4(float a, float b, float c, float d) { return max2(max2(a, b), max2(c, d)); }

/* Three bits per 8-FSK symbol. JS8 has NO Gray mapping -- the tone index IS
 * the bit triple, MSB first (genjs8.f90: indx = cw[i]*4 + cw[i+1]*2 + cw[i+2]).
 * This is the single most easily-missed difference from FT8 v2. */
static void js8_extract_symbol(const uint8_t* wf, float* logl)
{
    float s2[8];
    for (int j = 0; j < 8; ++j) s2[j] = MAG_DB(wf[j]);

    logl[0] = max4(s2[4], s2[5], s2[6], s2[7]) - max4(s2[0], s2[1], s2[2], s2[3]);
    logl[1] = max4(s2[2], s2[3], s2[6], s2[7]) - max4(s2[0], s2[1], s2[4], s2[5]);
    logl[2] = max4(s2[1], s2[3], s2[5], s2[7]) - max4(s2[0], s2[2], s2[4], s2[6]);
}

static void js8_extract_likelihood(const js8_waterfall_t* wf,
                                   const js8_candidate_t* cand, float* log174)
{
    const uint8_t* mag = get_cand_mag(wf, cand);

    for (int k = 0; k < JS8_ND; ++k)
    {
        /* Skip 7 sync symbols before the first data block, 14 before the second. */
        int sym_idx = k + ((k < 29) ? 7 : 14);
        int bit_idx = 3 * k;
        int block   = cand->time_offset + sym_idx;

        if ((block < 0) || (block >= wf->num_blocks))
        {
            log174[bit_idx + 0] = 0;
            log174[bit_idx + 1] = 0;
            log174[bit_idx + 2] = 0;
        }
        else
        {
            js8_extract_symbol(mag + (sym_idx * wf->block_stride), log174 + bit_idx);
        }
    }
}

static void js8_normalize_logl(float* log174)
{
    float sum = 0, sum2 = 0;
    for (int i = 0; i < JS8_LDPC_N; ++i)
    {
        sum  += log174[i];
        sum2 += log174[i] * log174[i];
    }
    float inv_n = 1.0f / JS8_LDPC_N;
    float variance = (sum2 - (sum * sum * inv_n)) * inv_n;
    if (variance <= 0) return;

    float norm_factor = sqrtf(24.0f / variance);
    for (int i = 0; i < JS8_LDPC_N; ++i) log174[i] *= norm_factor;
}

/* ── LDPC(174,87) belief propagation ─────────────────────────────────────── */

static float fast_tanh(float x)
{
    if (x < -4.97f) return -1.0f;
    if (x >  4.97f) return  1.0f;
    float x2 = x * x;
    float a = x * (945.0f + x2 * (105.0f + x2));
    float b = 945.0f + x2 * (420.0f + x2 * 15.0f);
    return a / b;
}

static float fast_atanh(float x)
{
    float x2 = x * x;
    float a = x * (945.0f + x2 * (-735.0f + x2 * 64.0f));
    float b = (945.0f + x2 * (-1050.0f + x2 * 225.0f));
    return a / b;
}

static int js8_ldpc_check(const uint8_t codeword[JS8_LDPC_N])
{
    int errors = 0;
    for (int m = 0; m < JS8_LDPC_M; ++m)
    {
        uint8_t x = 0;
        for (int i = 0; i < kJS8_LDPC_Num_rows[m]; ++i)
            x ^= codeword[kJS8_LDPC_Nm[m][i] - 1];
        if (x != 0) ++errors;
    }
    return errors;
}

void js8_bp_decode(const float codeword[JS8_LDPC_N], int max_iters,
                   uint8_t plain[JS8_LDPC_N], int* ok)
{
    float tov[JS8_LDPC_N][3];
    float toc[JS8_LDPC_M][7];
    uint8_t best[JS8_LDPC_N];

    int min_errors = JS8_LDPC_M;

    for (int n = 0; n < JS8_LDPC_N; ++n) tov[n][0] = tov[n][1] = tov[n][2] = 0;
    memset(best, 0, sizeof best);

    for (int iter = 0; iter < max_iters; ++iter)
    {
        int plain_sum = 0;
        for (int n = 0; n < JS8_LDPC_N; ++n)
        {
            plain[n] = ((codeword[n] + tov[n][0] + tov[n][1] + tov[n][2]) > 0) ? 1 : 0;
            plain_sum += plain[n];
        }
        if (plain_sum == 0) break;   /* all-zero is not a legal message */

        int errors = js8_ldpc_check(plain);
        if (errors < min_errors)
        {
            min_errors = errors;
            memcpy(best, plain, JS8_LDPC_N);
            if (errors == 0) break;
        }

        for (int m = 0; m < JS8_LDPC_M; ++m)
        {
            for (int n_idx = 0; n_idx < kJS8_LDPC_Num_rows[m]; ++n_idx)
            {
                int n = kJS8_LDPC_Nm[m][n_idx] - 1;
                float Tnm = codeword[n];
                for (int m_idx = 0; m_idx < 3; ++m_idx)
                    if ((kJS8_LDPC_Mn[n][m_idx] - 1) != m) Tnm += tov[n][m_idx];
                toc[m][n_idx] = fast_tanh(-Tnm / 2);
            }
        }

        for (int n = 0; n < JS8_LDPC_N; ++n)
        {
            for (int m_idx = 0; m_idx < 3; ++m_idx)
            {
                int m = kJS8_LDPC_Mn[n][m_idx] - 1;
                float Tmn = 1.0f;
                for (int n_idx = 0; n_idx < kJS8_LDPC_Num_rows[m]; ++n_idx)
                    if ((kJS8_LDPC_Nm[m][n_idx] - 1) != n) Tmn *= toc[m][n_idx];
                tov[n][m_idx] = -2 * fast_atanh(Tmn);
            }
        }
    }

    /* Hand back the best guess seen, not whatever the last iteration left
     * behind -- BP can wander away from a good answer it already found. */
    memcpy(plain, best, JS8_LDPC_N);
    *ok = min_errors;
}

/* ── SNR ─────────────────────────────────────────────────────────────────────
 *
 * Once the CRC passes we know which tone every symbol used, so the signal power
 * can be read from exactly those bins. The question is what to compare it with.
 *
 * JS8Call's js8dec.f90 offers two forms: a ratio against another tone bin
 * (`mod(itone+4,7)`, with a -27 dB constant) and a ratio against the spectral
 * baseline from syncjs8 (-32 dB). It uses the baseline form in normal
 * operation, and for good reason -- measured here, the other-tone form is
 * contaminated by the signal's own adjacent-tone leakage, which inflates the
 * "noise" term and compresses the scale: 4.5 dB pessimistic at -6 dB SNR,
 * shrinking to 0.9 dB at -20.
 *
 * So the noise term here is the band's own noise floor -- measured LOCALLY,
 * in a window around the candidate, not across the whole analysed range.
 * Noise density is not flat across a receiver's passband, and on real air it
 * is emphatically not: measured on a live 20 m capture, the floor within
 * +/-200 Hz of a signal was -34.5 dB while the median over 200..3000 Hz was
 * -46.5 dB. Using the band-wide figure inflated the SNR by that whole 12 dB.
 *
 * A median rather than a mean, because other stations sit in that window too
 * and a strong neighbour must not drag the floor up. The candidate's own eight
 * tone bins are excluded, with a guard bin either side for spectral leakage.
 *
 * Two corrections, both physical rather than fitted:
 *
 *   - 10*log10(2500/baud), the reference bandwidth. 26.0 dB for Normal's
 *     6.25 Hz tones, correspondingly less for the faster submodes.
 *   - 10*log10(1.5) = 1.76 dB for the Hann window's equivalent noise
 *     bandwidth: the noise in a Hann-windowed bin occupies 1.5 bin widths,
 *     so a per-bin median under-reads the true noise density by that factor.
 *
 * Measured against synthesised slots of known SNR the residual error is flat
 * at +1.4..+1.7 dB across -6..-20 dB before the ENBW term, which is within
 * 0.3 dB of the 1.76 dB it predicts -- so the term is a correction, not a
 * curve fit. After it, the error is under half a dB with a ~0.5 dB spread.
 * Run `js8_decode_test --snracc` to re-measure.
 */

/** Half-width, in bins, of the window the local noise floor is read from.
 *  One bin is one tone spacing, so this is +/-24 tones -- wide enough for a
 *  stable median, narrow enough to track how the floor varies across the
 *  passband. */
#define NOISE_HALF_WIDTH 24

/** Median power near the candidate: the local noise floor at that instant. */
static double js8_row_noise(const js8_monitor_t* mon, const uint8_t* row, int freq_offset)
{
    enum { MAX_S = 2 * NOISE_HALF_WIDTH + 16 };
    double s[MAX_S];
    int n = 0;

    int lo = freq_offset - NOISE_HALF_WIDTH;
    int hi = freq_offset + 7 + NOISE_HALF_WIDTH;
    if (lo < 0) lo = 0;
    if (hi >= mon->wf.num_bins) hi = mon->wf.num_bins - 1;

    for (int b = lo; b <= hi && n < MAX_S; ++b)
    {
        /* Skip the signal's own tones, plus a guard bin either side. */
        if (b >= freq_offset - 1 && b <= freq_offset + 8) continue;
        s[n++] = MAG_DB(row[b]);
    }

    if (n == 0) return 0.0;

    /* Insertion sort: n is at most 256 and usually far less. */
    for (int i = 1; i < n; ++i)
    {
        double v = s[i];
        int j = i - 1;
        while (j >= 0 && s[j] > v) { s[j + 1] = s[j]; --j; }
        s[j + 1] = v;
    }
    return pow(10.0, s[n / 2] / 10.0);
}

static float js8_candidate_snr(const js8_monitor_t* mon, const js8_candidate_t* cand,
                               const uint8_t tones[JS8_NN])
{
    const uint8_t* mag = get_cand_mag(&mon->wf, cand);

    /* Start of this candidate's row, without its frequency offset, so the
     * noise window can be positioned around the signal explicitly. */
    const uint8_t* base = mon->wf.mag
        + ((cand->time_offset * mon->wf.time_osr + cand->time_sub) * mon->wf.freq_osr
           + cand->freq_sub) * mon->wf.num_bins;

    double xsig = 0.0, xnoi = 0.0;
    int used = 0;

    for (int i = 0; i < JS8_NN; ++i)
    {
        int block = cand->time_offset + i;
        if (block < 0 || block >= mon->wf.num_blocks) continue;

        xsig += pow(10.0, MAG_DB(mag[i * mon->wf.block_stride + tones[i]]) / 10.0);
        xnoi += js8_row_noise(mon, base + i * mon->wf.block_stride, cand->freq_offset);
        ++used;
    }

    if (used == 0 || !(xnoi > 0.0)) return -28.0f;

    double ratio = xsig / xnoi - 1.0;
    if (ratio <= 0.0) return -28.0f;

    double snr = 10.0 * log10(ratio)
               - 10.0 * log10(2500.0 / mon->sub->baud)
               - 10.0 * log10(1.5);   /* Hann ENBW */
    return snr < -28.0 ? -28.0f : (float)snr;
}

/* ── Candidate geometry ──────────────────────────────────────────────────── */

float js8_candidate_freq(const js8_monitor_t* mon, const js8_candidate_t* cand)
{
    return (mon->min_bin + cand->freq_offset +
            (float)cand->freq_sub / mon->wf.freq_osr) / mon->symbol_period;
}

float js8_candidate_dt(const js8_monitor_t* mon, const js8_candidate_t* cand)
{
    float raw = (cand->time_offset + (float)cand->time_sub / mon->wf.time_osr)
                * mon->symbol_period;
    /* One symbol -- see the header. Calibrated against CPFSK, which is what
     * JS8Call's modulator actually transmits. */
    return raw - mon->symbol_period;
}

/* ── Decode one candidate ────────────────────────────────────────────────── */

bool js8_decode_candidate(const js8_monitor_t* mon, const js8_candidate_t* cand,
                          int max_iterations, js8_message_t* message,
                          js8_decode_status_t* status)
{
    const js8_waterfall_t* wf = &mon->wf;

    float log174[JS8_LDPC_N];
    js8_extract_likelihood(wf, cand, log174);
    js8_normalize_logl(log174);

    uint8_t plain174[JS8_LDPC_N];
    js8_bp_decode(log174, max_iterations, plain174, &status->ldpc_errors);
    status->used_osd = false;

    if (status->ldpc_errors > 0)
    {
#if JS8_OSD_ENABLED
        /* BP did not converge. If it came close, try solving the word
         * algebraically instead. The gate matters: OSD costs a Gaussian
         * elimination plus 88 re-encodings, and a slot offers ~200 candidates,
         * almost all of them noise that BP rightly rejected.
         *
         * Off by default -- see JS8_OSD_ENABLED for the measurements. */
        if (status->ldpc_errors > JS8_OSD_MAX_ERRORS) return false;
        if (!js8_osd_decode(log174, plain174)) return false;

        /* OSD guarantees nothing -- it returns the closest codeword it found,
         * which may still be wrong. Re-check the parity before trusting it. */
        if (js8_ldpc_check(plain174) != 0) return false;

        status->ldpc_errors = 0;
        status->used_osd = true;
#else
        return false;
#endif
    }

    /* Undo the column permutation: the information bits are the second half of
     * the pre-permutation vector, i.e. codeword[colorder[M + i]]. */
    uint8_t info[JS8_LDPC_K];
    for (int i = 0; i < JS8_LDPC_K; ++i)
        info[i] = plain174[kJS8_LDPC_colorder[JS8_LDPC_M + i]];

    /* CRC-12 over the 75 payload bits, zero-extended to 88. */
    uint8_t buf[JS8_LDPC_K_BYTES];
    memset(buf, 0, sizeof buf);
    for (int i = 0; i < JS8_PAYLOAD_BITS; ++i)
        if (info[i]) buf[i / 8] |= 0x80 >> (i % 8);

    uint16_t extracted = 0;
    for (int i = 0; i < JS8_CRC_BITS; ++i)
        extracted = (uint16_t)((extracted << 1) | info[JS8_PAYLOAD_BITS + i]);

    status->crc_extracted  = extracted;
    status->crc_calculated = js8_crc12(buf, JS8_LDPC_K_BYTES) ^ JS8_CRC_XOR;

    if (status->crc_extracted != status->crc_calculated) return false;

    memcpy(message->payload, buf, 10);
    message->i3bit = (uint8_t)((info[72] << 2) | (info[73] << 1) | info[74]);

    /* Now that the message is known good, rebuild the tones it was sent with
     * and measure the SNR from those bins. plain174 is already in the permuted
     * (on-air) order, which is what js8_tones() expects. */
    js8_tones(plain174, wf->ncostas, message->tones);
    status->snr = js8_candidate_snr(mon, cand, message->tones);

    return true;
}


/* ── Whole-slot decoding with subtraction ────────────────────────────────── */

int js8_decode_slot(js8_monitor_t* mon, const float* pcm, int num_samples,
                    int sample_rate, int passes,
                    js8_result_t* out, int max_out)
{
    enum { MAX_CANDIDATES = 200, MIN_SCORE = 10, LDPC_ITERATIONS = 30 };

    if (!mon || !pcm || num_samples <= 0 || max_out <= 0) return 0;
    if (passes < 1) passes = 1;

    /* Subtraction rewrites the audio, so work on a copy. If the allocation
     * fails, one pass over the caller's buffer beats failing outright. */
    float* work = NULL;
    if (passes > 1)
    {
        work = (float*)malloc((size_t)num_samples * sizeof(float));
        if (work) memcpy(work, pcm, (size_t)num_samples * sizeof(float));
        else passes = 1;
    }
    const float* src = work ? work : pcm;

    js8_candidate_t* heap = (js8_candidate_t*)malloc(MAX_CANDIDATES * sizeof(js8_candidate_t));
    if (!heap) { free(work); return 0; }

    int count = 0;

    for (int pass = 0; pass < passes; ++pass)
    {
        int found = 0;

        js8_monitor_reset(mon);
        for (int pos = 0; pos + mon->block_size <= num_samples; pos += mon->block_size)
            js8_monitor_process(mon, src + pos);

        int ncand = js8_find_candidates(&mon->wf, MAX_CANDIDATES, heap, MIN_SCORE);

        for (int i = 0; i < ncand && count < max_out; ++i)
        {
            js8_message_t msg;
            js8_decode_status_t st;
            if (!js8_decode_candidate(mon, &heap[i], LDPC_ITERATIONS, &msg, &st))
                continue;

            float freq = js8_candidate_freq(mon, &heap[i]);
            float dt   = js8_candidate_dt(mon, &heap[i]);

            /* The same frame turns up at several nearby offsets, and a later
             * pass will re-find anything the subtraction left behind. */
            bool dup = false;
            for (int j = 0; j < count; ++j)
                if (0 == memcmp(out[j].msg.payload, msg.payload, 10)) { dup = true; break; }

            /* Subtract duplicates too: the energy is there either way. */
            if (work)
                js8_subtract(work, num_samples, sample_rate, mon->sub,
                             msg.tones, freq, dt);

            if (dup) continue;

            out[count].msg    = msg;
            out[count].status = st;
            out[count].freq   = freq;
            out[count].dt     = dt;
            out[count].score  = heap[i].score;
            out[count].pass   = pass;
            ++count;
            ++found;
        }

        if (found == 0) break;
    }

    free(heap);
    free(work);
    return count;
}
