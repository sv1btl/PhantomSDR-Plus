/* js8_encode.c — see js8_encode.h. Validated against JS8Call's genjs8() by
 * check_against_reference.sh. */

#include "js8_encode.h"
#include <string.h>

const char* const kJS8_test_alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+/?.";

uint16_t js8_crc12(const uint8_t* data, int len)
{
    uint32_t rem = 0;
    for (int i = 0; i < len; i++)
        for (int b = 7; b >= 0; b--)
        {
            rem = (rem << 1) | ((data[i] >> b) & 1);
            if (rem & 0x1000) rem ^= (0x1000 | JS8_CRC_POLY);
        }
    return (uint16_t)(rem & 0xFFF);
}

void js8_pack_raw(const uint8_t payload[75], uint8_t bits[JS8_LDPC_K])
{
    /* 88-bit buffer holding the 75 payload bits; the remaining 13 bits stay
     * zero, which is exactly the augmentation the CRC expects. */
    uint8_t buf[JS8_LDPC_K_BYTES];
    memset(buf, 0, sizeof buf);
    for (int i = 0; i < 75; i++)
        if (payload[i]) buf[i / 8] |= 0x80 >> (i % 8);

    uint16_t crc = js8_crc12(buf, JS8_LDPC_K_BYTES) ^ JS8_CRC_XOR;

    memcpy(bits, payload, 75);
    for (int b = 11; b >= 0; b--)
        bits[75 + (11 - b)] = (crc >> b) & 1;
}

int js8_pack(const char* msg, int i3bit, uint8_t bits[JS8_LDPC_K])
{
    uint8_t payload[75];
    int pos = 0;

    for (int i = 0; i < 12; i++)
    {
        const char* p = strchr(kJS8_test_alphabet, msg[i]);
        if (!p || (p - kJS8_test_alphabet) > 63) return -1;  /* must fit in 6 bits */
        int v = (int)(p - kJS8_test_alphabet);
        for (int b = 5; b >= 0; b--) payload[pos++] = (v >> b) & 1;
    }
    for (int b = 2; b >= 0; b--) payload[pos++] = (i3bit >> b) & 1;

    js8_pack_raw(payload, bits);
    return 0;
}

void js8_encode174(const uint8_t msg[JS8_LDPC_K], uint8_t cw[JS8_LDPC_N])
{
    uint8_t tmp[JS8_LDPC_N];
    for (int i = 0; i < JS8_LDPC_M; i++)
    {
        int sum = 0;
        for (int j = 0; j < JS8_LDPC_K; j++)
        {
            int gbit = (kJS8_LDPC_generator[i][j / 8] >> (7 - (j % 8))) & 1;
            sum += msg[j] & gbit;
        }
        tmp[i] = sum & 1;
    }
    memcpy(tmp + JS8_LDPC_M, msg, JS8_LDPC_K);
    for (int i = 0; i < JS8_LDPC_N; i++)
        cw[kJS8_LDPC_colorder[i]] = tmp[i];
}

void js8_tones(const uint8_t cw[JS8_LDPC_N], int ncostas, uint8_t tones[JS8_NN])
{
    const uint8_t (*costas)[7] = kJS8_Costas_pattern[ncostas == 1 ? 0 : 1];
    memcpy(tones +  0, costas[0], 7);
    memcpy(tones + 36, costas[1], 7);
    memcpy(tones + 72, costas[2], 7);

    /* JS8 has NO Gray mapping: three codeword bits map straight to a tone. */
    int k = 7;
    for (int j = 0; j < JS8_ND; j++)
    {
        int i = 3 * j;
        if (j == 29) k += 7;            /* skip the middle Costas block */
        tones[k++] = cw[i] * 4 + cw[i + 1] * 2 + cw[i + 2];
    }
}

int js8_encode_message(const char* msg, int i3bit, int ncostas, uint8_t tones[JS8_NN])
{
    uint8_t bits[JS8_LDPC_K], cw[JS8_LDPC_N];
    if (js8_pack(msg, i3bit, bits) != 0) return -1;
    js8_encode174(bits, cw);
    js8_tones(cw, ncostas, tones);
    return 0;
}
