/*
 * js8_osd.c — order-1 ordered-statistics decoding for the JS8 LDPC(174,87).
 *
 * Belief propagation gives up when the received word is too noisy for the
 * message-passing iteration to converge. OSD attacks the same word
 * algebraically instead: it trusts the K most reliable bits, re-encodes from
 * them, and picks whichever candidate codeword sits closest to what was
 * actually received.
 *
 * Ported from WSJT-X / JS8Call's osd174.f90, restricted to order 1. Upstream
 * goes to order 2 with two layers of pre-screening; order 1 is where most of
 * the gain is for a fraction of the work, and it is the difference between
 * running this on every failed candidate and not being able to afford it.
 *
 * Cost: one Gaussian elimination (87 pivots over a 87x174 matrix) plus 88
 * re-encodings. That is far too expensive to run on all ~200 candidates in a
 * slot, so js8_decode_candidate() gates it on BP having come close --
 * see JS8_OSD_MAX_ERRORS.
 *
 * Bit ordering, which is where a port like this goes wrong:
 *
 *   log174 / plain174   on-air order (what the tones carry)
 *   "gen order"         [parity | message], i.e. before kJS8_LDPC_colorder
 *   "MRB order"         gen order permuted by decreasing |LLR|
 *
 * The matrix work all happens in MRB order; the result is walked back through
 * both permutations before it is handed to the caller.
 */

#include "js8_osd.h"

#include <math.h>
#include <string.h>

#define N JS8_LDPC_N     /* 174 */
#define K JS8_LDPC_K     /*  87 */
#define M JS8_LDPC_M     /*  87 */

/* Systematic generator, K x N: columns 0..M-1 are the parity generator
 * (transposed from kJS8_LDPC_generator), columns M..N-1 are the identity. */
static uint8_t s_gen[K][N];
static bool s_gen_ready = false;

static void build_gen(void)
{
    if (s_gen_ready) return;
    memset(s_gen, 0, sizeof s_gen);

    for (int m = 0; m < M; ++m)
        for (int k = 0; k < K; ++k)
        {
            int bit = (kJS8_LDPC_generator[m][k / 8] >> (7 - (k % 8))) & 1;
            s_gen[k][m] = (uint8_t)bit;
        }
    for (int k = 0; k < K; ++k) s_gen[k][M + k] = 1;

    s_gen_ready = true;
}

/** codeword = message * g2, with g2 held transposed as [N][K]. */
static void mrbencode(const uint8_t msg[K], uint8_t cw[N], const uint8_t g2[N][K])
{
    for (int j = 0; j < N; ++j)
    {
        int sum = 0;
        const uint8_t* col = g2[j];
        for (int k = 0; k < K; ++k) sum ^= (msg[k] & col[k]);
        cw[j] = (uint8_t)sum;
    }
}

/** Indices of `absrx` sorted by DECREASING magnitude. Insertion sort: N is 174
 *  and this runs only on candidates BP already failed. */
static void sort_by_reliability(const float absrx[N], int idx[N])
{
    for (int i = 0; i < N; ++i) idx[i] = i;
    for (int i = 1; i < N; ++i)
    {
        int v = idx[i];
        float key = absrx[v];
        int j = i - 1;
        while (j >= 0 && absrx[idx[j]] < key) { idx[j + 1] = idx[j]; --j; }
        idx[j + 1] = v;
    }
}

bool js8_osd_decode(const float log174[JS8_LDPC_N], uint8_t plain174[JS8_LDPC_N])
{
    build_gen();

    /* Un-permute the LLRs into gen order, and take hard decisions. */
    float rx[N], absrx[N];
    uint8_t hdec[N];
    for (int i = 0; i < N; ++i)
    {
        rx[i] = log174[kJS8_LDPC_colorder[i]];
        hdec[i] = (rx[i] >= 0.0f) ? 1 : 0;
        absrx[i] = fabsf(rx[i]);
    }

    int indices[N];
    sort_by_reliability(absrx, indices);

    /* Generator columns in reliability order. */
    static uint8_t genmrb[K][N];
    for (int i = 0; i < N; ++i)
        for (int k = 0; k < K; ++k)
            genmrb[k][i] = s_gen[k][indices[i]];

    /* Gaussian elimination, putting an identity in the K most reliable columns.
     * The +20 search window is upstream's: if a pivot cannot be found within it
     * the position is skipped rather than searched to the end, which bounds the
     * work and costs almost nothing in practice. */
    for (int id = 0; id < K; ++id)
    {
        int limit = id + 20;
        if (limit > K + 20) limit = K + 20;
        if (limit > N) limit = N;

        for (int icol = id; icol < limit; ++icol)
        {
            if (!genmrb[id][icol]) continue;

            if (icol != id)
            {
                for (int k = 0; k < K; ++k)
                {
                    uint8_t t = genmrb[k][id];
                    genmrb[k][id] = genmrb[k][icol];
                    genmrb[k][icol] = t;
                }
                int t = indices[id];
                indices[id] = indices[icol];
                indices[icol] = t;
            }
            for (int ii = 0; ii < K; ++ii)
            {
                if (ii == id || !genmrb[ii][id]) continue;
                for (int j = 0; j < N; ++j) genmrb[ii][j] ^= genmrb[id][j];
            }
            break;
        }
    }

    static uint8_t g2[N][K];
    for (int j = 0; j < N; ++j)
        for (int k = 0; k < K; ++k)
            g2[j][k] = genmrb[k][j];

    /* Everything from here on is in MRB order. */
    uint8_t hdec_p[N];
    float absrx_p[N];
    for (int i = 0; i < N; ++i)
    {
        hdec_p[i] = hdec[indices[i]];
        absrx_p[i] = absrx[indices[i]];
    }

    uint8_t m0[K];
    memcpy(m0, hdec_p, K);

    uint8_t c0[N], best[N];
    mrbencode(m0, c0, (const uint8_t (*)[K])g2);

    double dmin = 0.0;
    for (int i = 0; i < N; ++i)
        if (c0[i] != hdec_p[i]) dmin += absrx_p[i];
    memcpy(best, c0, N);

    /* Order 1: flip each most-reliable-basis bit in turn and re-encode. The
     * soft distance is the total reliability of the bits we had to disagree
     * with, so the winner is the codeword that calls the fewest confident bits
     * wrong. */
    uint8_t me[K], ce[N];
    for (int n1 = 0; n1 < K; ++n1)
    {
        memcpy(me, m0, K);
        me[n1] ^= 1;
        mrbencode(me, ce, (const uint8_t (*)[K])g2);

        double dd = 0.0;
        for (int i = 0; i < N; ++i)
        {
            if (ce[i] != hdec_p[i]) dd += absrx_p[i];
            if (dd >= dmin) break;     /* cannot win; stop adding */
        }
        if (dd < dmin)
        {
            dmin = dd;
            memcpy(best, ce, N);
        }
    }

    /* MRB order -> gen order -> on-air order. */
    uint8_t cw_gen[N];
    for (int i = 0; i < N; ++i) cw_gen[indices[i]] = best[i];
    for (int i = 0; i < N; ++i) plain174[kJS8_LDPC_colorder[i]] = cw_gen[i];

    return true;
}
