/**
 * decoder.worker.js — Off-main-thread decoder worker for PhantomSDR-Plus
 *
 * Runs FT8, FT4, and WSPR decoding in a dedicated Web Worker so the
 * main thread (audio playback, UI, waterfall) is never blocked.
 *
 * Protocol (postMessage both ways):
 *
 *   Main → Worker:
 *     { id, type: 'ft8',  pcm: Float32Array }
 *     { id, type: 'ft4',  pcm: Float32Array }
 *     { id, type: 'wspr', pcm: Float32Array, sampleRate, dialFreqHz }
 *
 *   Worker → Main:
 *     { id, type, results, error? }
 *
 * The `id` is echoed back so the caller can match responses to requests
 * (important if multiple decode jobs are queued).
 *
 * Transfer ownership of the PCM ArrayBuffer to avoid copying:
 *   worker.postMessage(msg, [msg.pcm.buffer])
 */

import { decode }      from './modules/ft8.js';
import { decodeFT4 }   from './modules/ft4.js';
import { decodeWSPR }  from './modules/wspr.js';

self.onmessage = async (event) => {
  const { id, type, pcm, sampleRate, dialFreqHz } = event.data;

  try {
    let results;

    if (type === 'ft8') {
      results = await decode(pcm);

    } else if (type === 'ft4') {
      results = await decodeFT4(pcm);

    } else if (type === 'wspr') {
      results = await decodeWSPR(pcm, sampleRate, dialFreqHz);

    } else {
      throw new Error(`Unknown decoder type: ${type}`);
    }

    self.postMessage({ id, type, results });

  } catch (err) {
    self.postMessage({ id, type, results: [], error: err.message });
  }
};