/*
 * js8_subtract.h — remove a decoded signal from the audio so weaker ones
 * underneath it can be found.
 */

#ifndef _INCLUDE_JS8_SUBTRACT_H_
#define _INCLUDE_JS8_SUBTRACT_H_

#include <stdbool.h>
#include "js8_constants.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Coherently subtract one decoded transmission from `pcm`, in place.
 *
 * @param pcm          the slot's samples; modified
 * @param num_samples  length of pcm
 * @param sample_rate  Hz
 * @param sub          submode the signal was decoded in
 * @param tones        the 79 tones the decoder recovered
 * @param f0_hz        audio frequency of tone 0
 * @param start_sec    where the transmission starts within pcm
 * @return false if the signal does not lie inside the buffer
 */
bool js8_subtract(float* pcm, int num_samples, int sample_rate,
                  const js8_submode_t* sub, const uint8_t tones[JS8_NN],
                  float f0_hz, float start_sec);

#ifdef __cplusplus
}
#endif

#endif // _INCLUDE_JS8_SUBTRACT_H_
