/*
 * js8_roundtrip.c — Phase 0 validation for the extracted JS8 constants.
 *
 * Three independent things are proven here:
 *
 *  1. ENCODE PARITY WITH JS8CALL. For each test message we emit the 87
 *     information bits and 79 channel tones produced by js8_encode.c.
 *     `check_against_reference.sh` diffs these against ref_gen, built from
 *     *unmodified* JS8Call Fortran (genjs8.f90 + encode174.f90 + crc12.cpp).
 *     Byte-identical output means the generator matrix, colorder permutation,
 *     CRC-12 (polynomial and the XOR 42), the tone mapping and both Costas
 *     variants are all correct.
 *
 *  2. ROUND TRIP. Tones are turned back into a codeword, un-permuted, the CRC
 *     re-checked and the 12 characters + frame type recovered -- by inverse
 *     code written here, independent of js8_encode.c.
 *
 *  3. PARITY-TABLE CONSISTENCY. kJS8_LDPC_Nm / Num_rows come from a different
 *     JS8Call file (bpdecode174.f90) than the generator (ldpc_174_87_params.f90).
 *     We check every syndrome is zero on a clean codeword and that flipping any
 *     single bit makes at least one syndrome non-zero. That cross-validates the
 *     two files against each other -- neither is trusted on its own.
 *
 * Because js8_encode.c is the same code the decoder tests use to synthesise
 * signals, this comparison keeps those tests honest too.
 */

#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <stdlib.h>
#include "js8_constants.h"
#include "js8_encode.h"

/* ── Reverse: tones -> codeword -> information bits ──────────────────────── */
static void js8_untones(const uint8_t tones[JS8_NN], uint8_t cw[JS8_LDPC_N])
{
    int k = 7;
    for (int j = 0; j < JS8_ND; j++)
    {
        int i = 3 * j;
        if (j == 29) k += 7;
        uint8_t t = tones[k++];
        cw[i]     = (t >> 2) & 1;
        cw[i + 1] = (t >> 1) & 1;
        cw[i + 2] = t & 1;
    }
}

static void js8_unpermute(const uint8_t cw[JS8_LDPC_N], uint8_t msg[JS8_LDPC_K])
{
    for (int i = 0; i < JS8_LDPC_K; i++)
        msg[i] = cw[kJS8_LDPC_colorder[JS8_LDPC_M + i]];
}

static int js8_unpack(const uint8_t bits[JS8_LDPC_K], char msg[13], int* i3bit)
{
    uint8_t buf[JS8_LDPC_K_BYTES];
    memset(buf, 0, sizeof buf);
    for (int i = 0; i < 75; i++)
        if (bits[i]) buf[i / 8] |= 0x80 >> (i % 8);

    uint16_t want = 0;
    for (int i = 0; i < 12; i++) want = (uint16_t)((want << 1) | bits[75 + i]);
    if ((js8_crc12(buf, JS8_LDPC_K_BYTES) ^ JS8_CRC_XOR) != want) return -1;

    for (int i = 0; i < 12; i++)
    {
        int v = 0;
        for (int b = 0; b < 6; b++) v = (v << 1) | bits[i * 6 + b];
        msg[i] = kJS8_test_alphabet[v];
    }
    msg[12] = '\0';
    *i3bit = (bits[72] << 2) | (bits[73] << 1) | bits[74];
    return 0;
}

/* ── Syndrome check using the independently-sourced parity tables ────────── */
static int js8_syndrome_weight(const uint8_t cw[JS8_LDPC_N])
{
    int bad = 0;
    for (int m = 0; m < JS8_LDPC_M; m++)
    {
        int x = 0;
        for (int i = 0; i < kJS8_LDPC_Num_rows[m]; i++)
            x ^= cw[kJS8_LDPC_Nm[m][i] - 1];
        bad += x;
    }
    return bad;
}

/* Every bit must appear in exactly the 3 checks listed by Mn, and those
 * listings must agree with Nm. Pure table-vs-table consistency. */
static int check_mn_nm_agree(void)
{
    int errors = 0;
    for (int n = 0; n < JS8_LDPC_N; n++)
        for (int j = 0; j < 3; j++)
        {
            int m = kJS8_LDPC_Mn[n][j] - 1;
            int found = 0;
            for (int i = 0; i < kJS8_LDPC_Num_rows[m]; i++)
                if (kJS8_LDPC_Nm[m][i] - 1 == n) found = 1;
            if (!found)
            {
                printf("  Mn/Nm disagree: bit %d claims check %d\n", n + 1, m + 1);
                errors++;
            }
        }
    return errors;
}

/* ── Test vectors ───────────────────────────────────────────────────────── */
static const struct { int ncostas; int i3bit; const char* msg; } TESTS[] = {
    /* NB: genjs8.f90's 12-char alphabet has no space -- it is a test harness
     * only; real JS8 payload bits come from the varicode packer. Every
     * character here must sit at alphabet index 0..63 to fit in 6 bits. */
    { 1, 0, "SV1BTL000000" },
    { 1, 3, "HELLOWORLD00" },
    { 2, 0, "SV1BTL000000" },
    { 2, 1, "0123456789AB" },
    { 2, 2, "ZZZZZZZZZZZZ" },
    { 2, 3, "CQCQCQSV1BTL" },
    { 2, 4, "abcdefghijkl" },
    { 2, 6, "wxyz09azAZ-+" },
    { 2, 6, "000000000000" },
};
#define NSTATIC ((int)(sizeof TESTS / sizeof TESTS[0]))

/* Beyond the fixed vectors we generate pseudorandom ones from a deterministic
 * LCG, so --vectors and --emit produce the same sequence in separate runs and
 * the reference comparison stays reproducible. */
static int  g_ntests = NSTATIC;
static char g_msgbuf[13];

void js8_get_test_vector(int t, int* ncostas, int* i3bit, const char** msg)
{
    if (t < NSTATIC)
    {
        *ncostas = TESTS[t].ncostas;
        *i3bit   = TESTS[t].i3bit;
        *msg     = TESTS[t].msg;
        return;
    }
    uint32_t r = (uint32_t)(t - NSTATIC) * 2654435761u + 12345u;
    for (int i = 0; i < 12; i++)
    {
        r = r * 1103515245u + 12345u;
        g_msgbuf[i] = kJS8_test_alphabet[(r >> 16) % 62];   /* alphanumerics only */
    }
    g_msgbuf[12] = 0;
    r = r * 1103515245u + 12345u;
    *ncostas = (int)((r >> 16) % 2) + 1;
    r = r * 1103515245u + 12345u;
    *i3bit   = (int)((r >> 16) % 8);
    *msg     = g_msgbuf;
}
#define NTESTS g_ntests

int main(int argc, char** argv)
{
    int emit = (argc > 1 && !strcmp(argv[1], "--emit"));
    if (argc > 2) { int n = atoi(argv[2]); if (n > NSTATIC) g_ntests = n; }

    /* Emit the test vectors in ref_gen's fixed-column input format, so the
     * reference encoder is fed exactly what we encode -- the two lists cannot
     * drift apart. Columns: 1-2 icos, 4-5 i3bit, 7-28 message. */
    if (argc > 1 && !strcmp(argv[1], "--vectors"))
    {
        for (int t = 0; t < NTESTS; t++)
        {
            int tc, ti; const char* tm;
            js8_get_test_vector(t, &tc, &ti, &tm);
            printf("%2d %2d %-22s\n", tc, ti, tm);
        }
        return 0;
    }

    int fail = 0;

    for (int t = 0; t < NTESTS; t++)
    {
        uint8_t bits[JS8_LDPC_K], cw[JS8_LDPC_N], tones[JS8_NN];
        int tc, ti; const char* tm;
        js8_get_test_vector(t, &tc, &ti, &tm);

        if (js8_pack(tm, ti, bits) != 0)
        {
            printf("FAIL pack: '%s'\n", tm);
            fail++;
            continue;
        }
        js8_encode174(bits, cw);
        js8_tones(cw, tc, tones);

        if (emit)
        {
            printf("BITS ");
            for (int i = 0; i < JS8_LDPC_K; i++) printf("%d", bits[i]);
            printf("\nTONE ");
            for (int i = 0; i < JS8_NN; i++) printf("%d", tones[i]);
            printf("\n");
            continue;
        }

        /* 2. round trip */
        uint8_t cw2[JS8_LDPC_N], bits2[JS8_LDPC_K];
        char out[13];
        int i3out;
        js8_untones(tones, cw2);
        if (memcmp(cw, cw2, JS8_LDPC_N)) { printf("FAIL tone round trip #%d\n", t); fail++; }
        js8_unpermute(cw2, bits2);
        if (memcmp(bits, bits2, JS8_LDPC_K)) { printf("FAIL colorder round trip #%d\n", t); fail++; }
        if (js8_unpack(bits2, out, &i3out) != 0) { printf("FAIL crc #%d\n", t); fail++; continue; }
        if (strcmp(out, tm) || i3out != ti)
        {
            printf("FAIL text #%d: '%s' i3=%d -> '%s' i3=%d\n", t, tm, ti, out, i3out);
            fail++;
        }

        /* 3a. clean codeword must satisfy every parity check */
        if (js8_syndrome_weight(cw) != 0)
        {
            printf("FAIL syndrome non-zero on clean codeword #%d\n", t);
            fail++;
        }

        /* 3b. every single-bit error must be detected */
        for (int b = 0; b < JS8_LDPC_N; b++)
        {
            uint8_t bad[JS8_LDPC_N];
            memcpy(bad, cw, JS8_LDPC_N);
            bad[b] ^= 1;
            if (js8_syndrome_weight(bad) == 0)
            {
                printf("FAIL bit %d undetected in #%d\n", b, t);
                fail++;
                break;
            }
        }

        /* 3c. a corrupt CRC must be rejected */
        uint8_t tampered[JS8_LDPC_K];
        memcpy(tampered, bits, JS8_LDPC_K);
        tampered[80] ^= 1;
        if (js8_unpack(tampered, out, &i3out) == 0)
        {
            printf("FAIL corrupt CRC accepted #%d\n", t);
            fail++;
        }
    }

    if (!emit)
    {
        int e = check_mn_nm_agree();
        fail += e;
        printf("Mn/Nm cross-check       : %s\n", e ? "FAIL" : "ok");
        printf("round trip + syndromes  : %d test vectors, %s\n",
               NTESTS, fail ? "FAIL" : "ok");
        printf("\n%s\n", fail ? "*** FAILURES ***" : "all local checks passed");
    }
    return fail ? 1 : 0;
}
