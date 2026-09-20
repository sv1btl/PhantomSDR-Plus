/*
 * js8_osd.h — ordered-statistics decoding for JS8's LDPC(174,87).
 *
 * A second chance for candidates belief propagation could not resolve. See
 * js8_osd.c for the method and for why it is order 1 rather than upstream's
 * order 2.
 */

#ifndef _INCLUDE_JS8_OSD_H_
#define _INCLUDE_JS8_OSD_H_

#include <stdint.h>
#include <stdbool.h>
#include "js8_constants.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Attempt an algebraic decode of a word BP failed on.
 *
 * @param[in]  log174   soft bits, on-air order, log(p(1)/p(0))
 * @param[out] plain174 candidate codeword, on-air order
 * @return true if a candidate was produced. It is NOT guaranteed valid --
 *         the caller must still check the parity and the CRC, exactly as it
 *         would for a BP result.
 */
bool js8_osd_decode(const float log174[JS8_LDPC_N], uint8_t plain174[JS8_LDPC_N]);

#ifdef __cplusplus
}
#endif

#endif // _INCLUDE_JS8_OSD_H_
