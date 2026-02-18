// src/lib/opusMlDecoder.js
// Wrapper around @wasm-audio-decoders/opus-ml for raw Opus frames

import { OpusDecoder } from '@wasm-audio-decoders/opus-ml';

/**
 * OpusMlBrowserDecoder
 *
 * streamSampleRate  = actual Opus stream rate (MUST match encoder, e.g. 48000)
 * pipelineSampleRate = optional rate for your later DSP chain (e.g. 12000),
 *                      but by default we keep it == streamSampleRate so there
 *                      is NO pitch change.
 */
export class OpusMlBrowserDecoder {
  constructor({
    streamSampleRate,       // MUST be the same as OpusAudioEncoder sample rate
    pipelineSampleRate,     // optional: where you eventually want to run DSP
    channels = 1,
  }) {
    if (!streamSampleRate) {
      throw new Error('OpusMlBrowserDecoder: streamSampleRate is required');
    }

    this.streamSampleRate = streamSampleRate;
    this.pipelineSampleRate = pipelineSampleRate || streamSampleRate;
    this.channels = channels;
    this.onChunk = null;

    console.log(
      `OpusMLDecoder ready (stream sampleRate = ${this.streamSampleRate} Hz, ` +
      `pipeline rate = ${this.pipelineSampleRate} Hz)`
    );

    // IMPORTANT: OpusDecoder must use the *stream* sample rate (e.g. 48000),
    // NOT the lower pipeline rate (e.g. 12000), otherwise pitch is wrong.
    this.decoder = new OpusDecoder({
      sampleRate: this.streamSampleRate,
      channels: this.channels,
      onDecode: (result) => {
        if (!this.onChunk) return;

        // result usually looks like:
        // { channelData: [Float32Array], sampleRate: <number> }
        const pcm = result.channelData[0];
        const sps = result.sampleRate || this.streamSampleRate;

        // If you later want to downsample to pipelineSampleRate (e.g. 12000),
        // do it here in JS. For now we keep them equal to avoid pitch issues.
        // Example skeleton (commented out):
        //
        // const outPcm = (this.pipelineSampleRate === sps)
        //   ? pcm
        //   : simpleResample(pcm, sps, this.pipelineSampleRate);
        //
        // this.onChunk(outPcm, this.pipelineSampleRate);

        // To fix your current pitch issue, just forward as-is:
        this.onChunk(pcm, sps);
      },
    });
  }

  /**
   * Set callback that receives decoded PCM samples.
   * cb(pcm: Float32Array, sampleRate: number)
   */
  setOnChunk(cb) {
    this.onChunk = cb;
  }

  /**
   * Feed a chunk of raw Opus frame bytes (Uint8Array)
   */
  decode(chunk) {
    this.decoder.decode(chunk);
  }

  /**
   * Free WASM memory if you ever want to reset
   */
  free() {
    this.decoder.free();
  }
}
