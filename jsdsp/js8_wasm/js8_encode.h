/*
 * js8_encode.h — JS8 transmit-side reference: pack, CRC-12, LDPC(174,87)
 * encode, and the 79-tone mapping.
 *
 * This is the half that `check_against_reference.sh` proves bit-identical to
 * JS8Call's own genjs8(). It exists as its own unit so that the decoder tests
 * can generate signals with code that is *known* correct, rather than with a
 * second private copy that might drift.
 *
 * The decoder (js8_decode.c) does NOT share code with this file beyond
 * js8_crc12(); an end-to-end test therefore checks two independent
 * implementations against each other.
 */

#ifndef _INCLUDE_JS8_ENCODE_H_
#define _INCLUDE_JS8_ENCODE_H_

#include <stdint.h>
#include "js8_constants.h"

#ifdef __cplusplus
extern "C" {
#endif

/// Alphabet used by genjs8()'s 12-character test messages. NB: this is a test
/// harness only -- real JS8 payload bits come from the varicode packer, and
/// this alphabet has no space (see README).
extern const char* const kJS8_test_alphabet;

/// Augmented CRC-12 (poly JS8_CRC_POLY). The caller supplies the message with
/// its 12 zero bits already in place; the JS8_CRC_XOR whitening is NOT applied
/// here. Shared with the decoder.
uint16_t js8_crc12(const uint8_t* data, int len);

/// Pack 12 test-alphabet characters plus a 3-bit frame type into the 87
/// information bits (72 message + 3 frame type + 12 CRC). Returns -1 if any
/// character is outside the 6-bit range.
int js8_pack(const char* msg, int i3bit, uint8_t bits[JS8_LDPC_K]);

/// Pack 75 raw payload bits (72 message + 3 frame type) into 87 information
/// bits by appending the CRC. Used when the payload does not come from the
/// test alphabet.
void js8_pack_raw(const uint8_t payload[75], uint8_t bits[JS8_LDPC_K]);

/// LDPC(174,87): parity, [parity|message] concatenation, colorder permutation.
void js8_encode174(const uint8_t msg[JS8_LDPC_K], uint8_t cw[JS8_LDPC_N]);

/// Codeword -> 79 channel tones, inserting the three Costas blocks.
/// `ncostas` is 1 (submode A) or 2 (submodes B/C/E/I).
void js8_tones(const uint8_t cw[JS8_LDPC_N], int ncostas, uint8_t tones[JS8_NN]);

/// Convenience: message + frame type -> tones, in one call.
int js8_encode_message(const char* msg, int i3bit, int ncostas, uint8_t tones[JS8_NN]);

#ifdef __cplusplus
}
#endif

#endif // _INCLUDE_JS8_ENCODE_H_
