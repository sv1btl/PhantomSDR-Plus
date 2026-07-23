/**
 * decodeworker.js — worker_thread that runs one decoder invocation off the
 * main thread. One of these runs per pool slot (see pool.js). Each worker holds
 * its OWN wasm instance (ft8_lib), so decodes are fully isolated and can run in
 * parallel across the pool.
 *
 * Protocol (parentPort):
 *   in:  { id, type: 'ft8'|'ft4'|'ft2'|'wspr', pcm: Float32Array,
 *          sampleRate, dialFreqHz? }
 *   out: { id, results, error? }
 *
 * The wasm-shim must be imported before the decoders so ft4.js can load its
 * wasm from disk (it fetches an absolute URL that only resolves in a browser).
 */
import { parentPort } from 'node:worker_threads';
import './wasm-shim.js';
import { decodeFT8viaLib, decodeFT4, decodeFT2 } from '../frontend/src/modules/ft4.js';
import { decodeWSPR }                            from '../frontend/src/modules/wspr.js';

parentPort.on('message', async (msg) => {
    const { id, type, pcm, sampleRate, dialFreqHz } = msg;
    try {
        let results;
        switch (type) {
            case 'ft8':  results = await decodeFT8viaLib(pcm, sampleRate); break;
            case 'ft4':  results = await decodeFT4(pcm, sampleRate); break;
            case 'ft2':  results = await decodeFT2(pcm, sampleRate); break;
            case 'wspr': results = await decodeWSPR(pcm, sampleRate, dialFreqHz); break;
            default: throw new Error(`unknown decode type: ${type}`);
        }
        parentPort.postMessage({ id, results: results ?? [] });
    } catch (err) {
        parentPort.postMessage({ id, results: [], error: err?.message ?? String(err) });
    }
});
