import { createDecoder, firdes_kaiser_lowpass } from './lib/wrappers'
import { OpusMLDecoder } from '@wasm-audio-decoders/opus-ml';

import createWindow from 'live-moving-average'
import { decode as cbor_decode } from 'cbor-x';
import { encode } from "./modules/ft8.js";
import { WSPR_TOTAL_SAMPLES, wspr2SlotPosition } from "./modules/wspr.js";
import { KiwiSSTVDecoder } from './sstv.js';
import { VideoRecorder } from './videoRecorder.js';
import CWDecoder from './cwDecoder.js';

// ── Opus master switch ──────────────────────────────────────────────────
// Set false to "kill" Opus in the browser: the client tells the server it
// cannot decode Opus (via the "codec_caps" command on connect), so the server
// keeps C-QUAM on FLAC instead of switching this client to Opus.  Also guards
// the decode path so a stray Opus packet can never reach a disabled decoder.
// Leave true for normal operation.
const OPUS_ENABLED = true;

// All gain sources mapped
// FLAC decoder output  ×175  (line 2440) const flacGain = 175.0                ─┐
// Opus decoder output  ×175  (line 179) const gain = 175.0;                    ─┤→ playAudio() → DSP chain → playPCM() → audioInputNode
// RADE decoded speech  ×0.20 (line 2017) this.radeGainNode.gain.value = 0.20   ─┘ 

// ── Decoder Web Worker ────────────────────────────────────────────────────
// All heavy decoding (FT8, FT4, WSPR) runs off the main thread so audio
// playback and the UI never freeze at slot boundaries.
const _decoderWorker = new Worker(
  new URL('./decoder.worker.js', import.meta.url),
  { type: 'module' }
);

let _workerReqId = 0;
const _workerPending = new Map();

_decoderWorker.onmessage = ({ data }) => {
  const p = _workerPending.get(data.id);
  if (!p) return;
  _workerPending.delete(data.id);
  if (data.error) {
    console.error(`[Worker] ${data.type} error:`, data.error);
    p.resolve([]);
  } else {
    p.resolve(data.results);
  }
};

_decoderWorker.onerror = (e) => {
  console.error('[Worker] Uncaught worker error:', e);
};

/**
 * Send a PCM buffer to the decoder worker and return a Promise of results.
 * NOTE: we do NOT transfer the buffer — structured clone is used instead.
 * Transfer would detach the pre-allocated accumulator buffer, breaking audio.
 */
function _workerDecode(type, pcm, opts = {}) {
  return new Promise((resolve) => {
    const id  = ++_workerReqId;
    _workerPending.set(id, { resolve });
    _decoderWorker.postMessage({ id, type, pcm, ...opts });
    // No [pcm.buffer] transfer list — structured clone keeps the accumulator intact
  });
}
// ── end worker bridge ─────────────────────────────────────────────────────

import { AudioContext, ConvolverNode, IIRFilterNode, GainNode, AudioBuffer, AudioBufferSourceNode, DynamicsCompressorNode, MediaStreamAudioDestinationNode } from 'standardized-audio-context'
import { BiquadFilterNode } from 'standardized-audio-context';

// PERF (#1): drop-in replacement for `fft-js`. Same { fft, ifft } interface
// (real-or-pair input → [re,im] pairs), bit-identical output, but an iterative
// radix-2 transform with cached twiddle/bit-reversal tables and reused scratch
// buffers — ~32× faster on the 2048-pt NR round-trip that runs per audio
// buffer on the main thread. Verified against fft-js: scratchpad/fft_verify.mjs.
import { fft, ifft, transformFlat } from './lib/fftRadix2.js';

/* Opus Encoder */
class OpusMLAdapter {
  constructor(targetSampleRate, initialChannels) {
    // targetSampleRate is what the rest of the pipeline expects (e.g. 12000),
    // but the Opus bitstream itself carries its own sample rate, so we mostly
    // use this value for logging and optional resampling if ever needed.
    this.targetSampleRate = targetSampleRate || 48000;
    // Track mono/stereo (1 or 2) for C-QUAM.  Set BEFORE _createDecoder() so the
    // underlying decoder is built at the right channel count immediately —
    // otherwise a later setChannels(2) would free a not-yet-ready mono decoder
    // (its _common is still undefined) and throw during the swap to C-QUAM.
    this.channels = (initialChannels === 2) ? 2 : 1;
    this.decoder = null;
    this.isReady = false;
    // Native-rate tap for timing-sensitive decoders other than FAX.
    // FAX always uses the shared pipeline (rawPcm) for both FLAC and Opus.
    this.lastNativePcm = new Float32Array(0);
    this.lastNativeSampleRate = 48000;
    // Fractional phase accumulators for non-integer resampling in resampleAndGain.
    // Carries the remainder across decode() calls so the output sample rate is
    // exact on average rather than drifting by Math.round() error each frame.
    // Separate L/R accumulators so stereo channels don't share phase state.
    this._resampleAccum  = 0.0;   // mono / stereo-L
    this._resampleAccumR = 0.0;   // stereo-R only
    this._createDecoder();  // ✅ ADDED: Separate decoder creation method
  }
  
  // ✅ ADDED: Separate decoder creation for stereo support
  _createDecoder() {
    if (this.decoder) {
      try {
        this.decoder.free();
      } catch (e) {
        console.warn('Error freeing old OpusMLDecoder:', e);
      }
      this.decoder = null;
    }

    try {
      // Let the decoder infer the Opus stream configuration from the frames
      // themselves. Channels can be 1 (mono) or 2 (stereo) for C-QUAM.
      this.decoder = new OpusMLDecoder({
      sampleRate: 48000,
      channels: this.channels,  // ✅ CHANGED: Use this.channels instead of hardcoded 1
      // Opus 1.5 ML speech post-filter. Library default is 'nolace'. This is a
      // separate audio-quality knob ('none' | 'lace' | 'nolace') — not related
      // to the spectrogram display; tune to taste.
      frameDuration: 10,     // 10 ms packets – sweet spot for HF
      forwardErrorCorrection: false,
      lowLatency: true,
      });

      // If the decoder exposes a .ready Promise, wait for it; otherwise assume ready now.
      if (this.decoder && this.decoder.ready && typeof this.decoder.ready.then === 'function') {
        this.decoder.ready
          .then(() => {
            this.isReady = true;
            console.log('OpusMLDecoder ready, channels=', this.channels, ', target=', this.targetSampleRate, 'Hz');
          })
          .catch((e) => {
            console.error('OpusMLDecoder.ready rejected', e);
          });
      } else {
        this.isReady = true;
        console.log('OpusMLDecoder created (no ready Promise), channels=', this.channels);
      }
    } catch (e) {
      console.error('Failed to construct OpusMLDecoder', e);
      this.decoder = null;
    }
  }

  decode(encoded) {
    if (!this.decoder || !this.isReady) {
      // Decoder not ready yet; drop frame
      return new Float32Array(0);
    }

    try {
      // Normalise to Uint8Array – CBOR gives us either a Uint8Array already
      // or an ArrayBuffer / typed array view.
      let frame;
      if (encoded instanceof Uint8Array) {
        frame = encoded;
      } else if (encoded instanceof ArrayBuffer) {
        frame = new Uint8Array(encoded);
      } else if (ArrayBuffer.isView(encoded)) {
        frame = new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength);
      } else {
        // Last-ditch attempt – this should still give us a sane view if it's array-like.
        frame = new Uint8Array(encoded);
      }

      // Prefer the sync decodeFrame() API, which returns a decoded block immediately.
      const result = this.decoder.decodeFrame(frame);

      if (!result || !result.channelData || result.channelData.length === 0) {
        return new Float32Array(0);
      }

      // Apply a modest gain boost for Opus to bring its level closer to FLAC,
      // and to make even very small decoded values audible for debugging.
      const gain = 175.0; // Adjust if it sounds too loud/quiet.

      const nativeGainOnly = (input) => {
        if (!input || input.length === 0) return new Float32Array(0);
        const out = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) out[i] = input[i] * gain;
        return out;
      };

      // Determine input/output sample rates
      const inSampleRate = result.sampleRate || this.targetSampleRate || 48000;
      const outSampleRate = this.targetSampleRate || inSampleRate;

      // ✅ ADDED: Helper function to resample and apply gain.
      // `accumKey` selects which phase-accumulator field to use so that
      // stereo L and R channels each carry their own fractional remainder
      // across frames without polluting each other's phase state.
      const resampleAndGain = (input, accumKey) => {
        if (!input || input.length === 0) return new Float32Array(0);

        if (inSampleRate && outSampleRate && inSampleRate !== outSampleRate) {
          const ratio = inSampleRate / outSampleRate;
          const rounded = Math.round(ratio);
          if (Math.abs(ratio - rounded) < 1e-6 && rounded >= 1) {
            // ── Integer decimation (e.g. 48000→12000, factor=4) ──────────────
            // Boxcar-average each group of `factor` input samples.
            // Nearest-neighbour (taking input[i*factor] only) aliases the full
            // 0–24 kHz Opus output into the 0–12 kHz band, corrupting the FAX
            // FM phase discriminator.  Boxcar gives a sinc anti-alias response
            // with a first null at outSampleRate, sufficient to suppress alias
            // energy across the FAX tone band (1500–2300 Hz).
            const factor = rounded;
            const outLen = Math.floor(input.length / factor);
            const out = new Float32Array(outLen);
            const invFactor = 1.0 / factor;
            for (let i = 0; i < outLen; i++) {
              const base = i * factor;
              let sum = 0;
              for (let j = 0; j < factor; j++) sum += input[base + j];
              out[i] = sum * invFactor * gain;
            }
            return out;
          }

          // ── Non-integer decimation (e.g. 48000→trueAudioSps≈12207 Hz) ─────
          // Using Math.round(L/ratio) per frame causes a fixed fractional error
          // that accumulates as sample-rate drift (visible as diagonal lean in
          // HF FAX images).  A phase accumulator carried across frames ensures
          // the output rate equals outSampleRate exactly on average.
          // Each channel uses its own accumulator field (accumKey) so L and R
          // are independently phase-accurate.
          const out = [];
          let pos = this[accumKey];          // fractional input position
          while (pos < input.length) {
            const idx  = Math.floor(pos);
            const frac = pos - idx;
            const a    = input[idx];
            const b    = input[Math.min(idx + 1, input.length - 1)];
            out.push((a + frac * (b - a)) * gain);
            pos += ratio;
          }
          this[accumKey] = pos - input.length; // carry remainder to next frame
          return new Float32Array(out);
        }

        // inSampleRate === outSampleRate — gain only, no resampling needed.
        const out = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
          out[i] = input[i] * gain;
        }
        return out;
      };

      let pcm;
      let maxAbs = 0;

      // Native-rate tap (48 kHz, no anti-aliasing).  Not used by any active decoder;
      // retained in case a future timing-sensitive consumer needs it.  FAX was removed
      // from this path — it now uses the shared 12 kHz pipeline like all other decoders.
      this.lastNativeSampleRate = inSampleRate || 48000;
      this.lastNativePcm = nativeGainOnly(result.channelData[0] || new Float32Array(0));

      // ✅ ADDED: Stereo (C-QUAM) handling - interleave L/R channels
      if (this.channels === 2 && result.channelData.length >= 2) {
        // L uses _resampleAccum, R uses _resampleAccumR — independent phase state.
        const L = resampleAndGain(result.channelData[0] || new Float32Array(0), '_resampleAccum');
        const R = resampleAndGain(result.channelData[1] || new Float32Array(0), '_resampleAccumR');
        const len = Math.min(L.length, R.length);

        // Interleave L and R: [L0, R0, L1, R1, L2, R2, ...]
        pcm = new Float32Array(len * 2);
        const step = Math.max(1, Math.floor(len / 32));
        for (let i = 0; i < len; i++) {
          pcm[i * 2] = L[i];
          pcm[i * 2 + 1] = R[i];
          if (i % step === 0) {
            const aL = Math.abs(L[i]);
            const aR = Math.abs(R[i]);
            const a = Math.max(aL, aR);
            if (a > maxAbs) maxAbs = a;
          }
        }
      } else {
        // Mono path (original code)
        const pcmRaw = result.channelData[0] || new Float32Array(0);
        pcm = resampleAndGain(pcmRaw, '_resampleAccum');
        
        const step = Math.max(1, Math.floor(pcm.length / 32));
        for (let i = 0; i < pcm.length; i += step) {
          const a = Math.abs(pcm[i]);
          if (a > maxAbs) maxAbs = a;
        }
      }

      if (result.errors && result.errors.length) {
        console.warn('OpusMLDecoder reported errors for frame:', result.errors[0]);
      }

      return pcm;
    } catch (e) {
      console.error('OpusMLAdapter.decode error', e);
      return new Float32Array(0);
    }
  }

  // ✅ ADDED: Method to switch between mono and stereo for C-QUAM
  setChannels(ch) {
    const wanted = (ch === 2) ? 2 : 1;
    if (wanted === this.channels) return;  // Already at desired channel count
    
    console.log('[OpusMLAdapter] Switching from', this.channels, 'to', wanted, 'channel(s)');
    this.channels = wanted;
    this.isReady = false;
    this._createDecoder();  // Recreate decoder with new channel count
  }

  free() {
    if (this.decoder && typeof this.decoder.free === 'function') {
      this.decoder.free();
    }
    this.decoder = null;
    this.isReady = false;
    this.lastNativePcm = new Float32Array(0);
  }
}
/**/

export default class SpectrumAudio {

  constructor(endpoint) {


    // For Recording
    this.isRecording = false;
    this.recordedAudio = [];

    // Added to allow for adjustment of the //
    // dynamic audio buffer //
    // ── Audio buffer latency tuning ─────────────────────────────────────────
    // If users on high-jitter connections (mobile, VPN, satellite) report
    // choppy audio or frequent dropouts, raise these two values together:
    //
    //   bufferLimit      — overrun ceiling (seconds). When playTime drifts
    //                      more than this ahead of currentTime, the scheduler
    //                      resets to bufferThreshold. Also must match
    //                      maxBufferedSeconds in the worklet constructor below
    //                      (search "processorOptions"). Raise both together.
    //                      Current: 0.15s  Safe range: 0.15 – 0.50s
    //
    //   bufferThreshold  — underrun recovery point (seconds). After a dropout
    //                      playTime is reset to currentTime + bufferThreshold.
    //                      Raising this adds steady-state latency directly.
    //                      Current: 0.01s  Safe range: 0.01 – 0.10s
    //
    // Typical fix for jitter problems: raise bufferLimit 0.15→0.25, raise
    // maxBufferedSeconds (worklet) 0.15→0.25. Leave bufferThreshold alone
    // unless you still hear underrun clicks after raising bufferLimit.
    // Note: RADE decoding has its own ~260ms pipeline latency and is not
    // affected by any of these values.
    // ────────────────────────────────────────────────────────────────────────
    this.bufferLimit = 0.25;     // matches worklet maxBufferedSeconds
    this.bufferThreshold = 0.01;  // 10ms underrun recovery point

    // AudioWorklet / fallback diagnostics and hardening
    this._loggedWorkletPlayback = false;
    this._loggedFallbackPlayback = false;
    this._loggedWorkletFailure = false;
    this._streamStats = null;

    this.endpoint = endpoint

    this.playAmount = 0

    this.playMovingAverage = []
    this.playSampleLength = 1
    this.audioQueue = []

    this.demodulation = 'USB'
    this.channels = 1  // ✅ ADDED: Track mono/stereo (1 or 2) for C-QUAM

    // Decoders
    //
    // FTx slot capture follows KiwiSDR's decode_ft8.c: the capture window opens
    // at the UTC slot boundary plus `ftxTimeShift` seconds and runs for
    // (slot_period - 0.4) s. The shift compensates for the streaming/jitter
    // buffer latency — audio arriving now was actually received a moment ago.
    //
    // Unlike Kiwi, which decodes server-side and so has a fixed local buffer
    // depth, we decode in the browser: the latency being compensated includes
    // the whole network path to *this* client. It therefore differs per
    // installation AND per visitor, and no constant can be right for everyone.
    // So the value self-calibrates from the decoders' own DT measurement — see
    // _ftxAutoCalibrate(). 0.8 s (ft8_lib's default) is only the starting seed.
    // Stored PER MODE. The optimal shift is not the same for all three: the
    // capture windows have different slack (1.96 s for FT8 against 0.83 s for
    // FT2), so the ideal DT — and hence the shift — differs. Measured on air:
    // FT8 settles near 0.03 s where FT2 needs ~0.35 s on the same pipeline.
    // A single shared value left FT2 parked at FT8's optimum, far outside
    // FT2's -0.24..+0.46 s tolerance, so it decoded nothing and the loop could
    // never bootstrap.
    this.ftxShift = {
      FT8: this._ftxLoadPref('ftxShift.FT8', 0.8),
      FT4: this._ftxLoadPref('ftxShift.FT4', 0.8),
      FT2: this._ftxLoadPref('ftxShift.FT2', 0.8),
    };
    this.ftxActiveMode = 'FT8';
    this.ftxAutoSync   = this._ftxLoadPref('ftxAutoSync', 1) ? true : false;

    // DT samples accumulate ACROSS slots, per mode. Requiring several in a
    // single slot makes auto-sync useless on sparse modes — an FT2 band may
    // carry exactly one signal, so a per-slot threshold never fires.
    this._ftxDtHistory = { FT8: [], FT4: [], FT2: [] };

    // ── Mini audio spectrum for the decoder panel ────────────────────────
    // Max-hold across the current slot. FT signals are short bursts of hopping
    // tones, so an instantaneous spectrum mostly shows gaps; holding the peak
    // per bin draws each station as a steady mark at its audio frequency,
    // which is what makes it comparable with the Hz column.
    this._ftxSpec  = this._makeSpec(4096);   // 2.93 Hz/bin at 12 kHz
    // WSPR gets a 4x longer transform. Its whole band is only 220 Hz wide and
    // a busy one packs stations a few Hz apart; measured with Hann windowing,
    // 4096 merges any pair closer than ~6 Hz, while 16384 still separates them
    // at 3 Hz. 0.73 Hz bins also match the resolution the WSPR decoder itself
    // works at (DF2 in wspr.js). One transform per 1.37 s of a 2-minute slot,
    // so the extra cost is irrelevant.
    this._wsprSpec = this._makeSpec(16384);  // 0.73 Hz/bin at 12 kHz

    this.decodeFT4      = false;
    this.isFT4Collecting = false;
    this.ft4Accumulator    = null;  // pre-allocated in _initAccumulators()
    this.ft4AccumulatorLen = 0;
    this.maxFT4AccumulatorSize = 90000 * 2;

    // FT2 state — 3.75 s T/R slots
    this.decodeFT2          = false;
    this.isFT2Collecting    = false;
    this.ft2Accumulator     = null;
    this.ft2AccumulatorLen  = 0;
    this.maxFT2AccumulatorSize = 45000 * 2;

    // WSPR-2 state — 2-minute slots on even UTC minutes
    this.decodeWSPR         = false;
    this.isWSPRCollecting   = false;
    this.wsprAccumulator    = null;  // pre-allocated in _initAccumulators()
    this.wsprAccumulatorLen = 0;
    this.wsprDialFreqHz     = 0;
    this.wsprTimer          = null;
    this.maxWSPRAccumulatorSize = 12000 * 125;

    this.accumulator    = null;   // pre-allocated in _initAccumulators()
    this.accumulatorLen = 0;
    this.decodeFT8 = false;
    this.farthestDistance = 0;   // ✅ FIXED: was undefined → distance > undefined always false
    this.nb = false;
    // Separate client-side toggles
    this.nbBlankerEnabled = false; // impulsive noise blanker
    this.nrEnabled = false;        // spectral noise reduction
    // Blanker envelope follower state — initialized here so hasOwnProperty checks work
    this._nbEnv  = 0.001;
    this._nbHold = 0;

    // Adaptive noise-cancel gate (works for FLAC & Opus)
    this.noiseCancelEnabled = true;
    this.noiseEnv           = 0;
    this.noiseFloor         = 0.001;
    this.noiseGateOpen      = true;
    this.noiseGatePreset    = 'balanced'; // Options: balanced, aggressive, weak-signal, smooth, maximum, cw, am-fm

    // Audio controls
    this.mute = false
    this.squelchMute = false
    this.squelch = false
    this.squelchThreshold = 0
    this.power = 1;
    this.dBPower = -130;
    this._dBQueue = [];
    this.ctcss = false
    this.ctcssToneHz = null;          // null => accept any valid CTCSS tone
    this.ctcssMute = false;           // true while tone squelch should hold audio closed
    this._ctcssEnabled = false;
    this._ctcssDetectThreshold = 0.20;  // confidence = bestPower/sumSq; real tones >> 0.5, noise << 0.05
    this._ctcssNeighborReject = 2.5;    // separation vs secondPower; at N=4096 legit seps are >> 10
    this._ctcssMinRms = 0.008;          // raised from 0.003; filters sub-threshold noise frames early
    this._ctcssHoldMs = 220;
    this._ctcssLastOpenMs = 0;
    this._ctcssDetectedToneHz = null;
    this._ctcssDetectBuffer = new Float32Array(4096); // 341 ms @ 12 kHz — 2.93 Hz/bin resolves all CTCSS pairs
    this._ctcssDetectFill = 0;
    this._ctcssHpState = 0;
    this._ctcssHpPrevIn = 0;
    this._ctcssLpState = 0;
    // Consecutive-detection gate: gate opens only after this many back-to-back
    // window detections (~openCount x 341 ms). A single spurious window
    // (noise spike, brief interference) cannot open the squelch.
    this._ctcssConsecutive = 0;
    this._ctcssOpenCount   = 3;         // ~1 s of sustained tone required
    this._ctcssStdTones = [
      67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
      97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
      131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5,
      167.9, 171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8,
      196.6, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6,
      241.8, 250.3, 254.1
    ];
    
    // Spectrogram integration
    this.spectrogramCallback = null
    this.spectrogramEnabled = false

    // CW Decoder state — initialised by _cwReset()
    this.decodeCW = false;
    this.cwCallback = null;
    this._cwReset();

    // ── HF FAX / WEFAX decoder state ─────────────────────────────────────
    this.decodeFAX   = false;
    this.faxCallback = null;
    this._faxReset();

    // ── SSTV decoder state (Kiwi-style raw PCM path) ──────────────────────
    this.decodeSSTV   = false;
    this.sstvCallback = null;
    this._sstvForcedMode = 'auto';
    this._sstvDecoder = new KiwiSSTVDecoder({
      sampleRate: () => this.audioOutputSps || this.trueAudioSps || this.audioMaxSps || 12000,
      callback: (event) => {
        if (typeof this.sstvCallback === 'function') this.sstvCallback(event);
      },
      defaultMode: this._sstvForcedMode
    });
    this._sstvReset();

    // ── NAVTEX / SITOR-B decoder state ───────────────────────────────────
    this.decodeNAVTEX   = false;
    this.navtexCallback = null;
    this._navtexReset();

    // ── RADE v1 digital voice decoder state ──────────────────────────────
    this.decodeRADE    = false;
    this._radeSideband = 'USB';
    this._radeSocket   = null;
    this._radeCallback = null;
    this._radeReady    = false;
    this._radeNextTime = 0;    // scheduled end-time of last RADE audio chunk
    this._radeSources  = new Set(); // active/scheduled RADE decoded-audio sources

    // ── Generic Kiwi-style FSK decoder state (weather / maritime / ham) ──
    this.decodeFSK   = false;
    this.fskCallback = null;
    this.fskVariant  = 'maritime';
    this._fskReset();
    
    // Remove the element with id startaudio from the DOM

    // Frontend audio-level control state (playback-only; backend AGC stays in charge)
    this.agcGain = 1;
    this.agcEnvelope = 0;
    this.agcLookaheadBuffer = [];
    this.userGain = 1.0;
    this.audioLevelGain = 1.0;
    this.audioLevelEnabled = true;
    this.audioLevelMode = 0;   // 0=Auto/Bypass, 1=Fast, 2=Smooth, 3=Adaptive
    this.audioLevelRms = 0.0;
    this.audioLevelPeak = 0.0;
    this.audioLevelTarget = 0.22;
    this.audioLevelMaxBoost = 1.8;
    this.audioLevelAttack = 0.10;
    this.audioLevelRelease = 0.03;

    // Noise blanker parameters. Profile 1: Maximum Quality (recommended for strong signals)
    this.nbEnabled = false;
    this.nbFFTSize = 2048;
    this.nbOverlap = 1536;
    this.nbAverageWindows = 8;   // was 12 (~1.5s) — 8 ≈ 1.0s, reacts to fast QSB on 10-15m
    this.nbThreshold = 0.140;
    this.nbBuffer = new Float32Array(this.nbFFTSize);
    this.nbSpectrumAverage = new Float32Array(this.nbFFTSize / 2);
    this.nbSpectrumHistory = Array(this.nbAverageWindows).fill().map(() => new Float32Array(this.nbFFTSize / 2));
    this.nbHistoryIndex = 0;

    // === Background Noise Measurement & Fixed Suppression ===
    this.bnFFTSize         = 1024;
    // bnFFTSize / bnOverlap (currently 4096 / 3072 — doubles frequency resolution (~3 Hz/bin at 12 kHz), slower floor estimate update rate, better bin classification)
    // 2048 / 1536, i.e. 75% overlap
    // 1024 / 768 — coarser bins, updates more frequently; useful if CPU is a concern
    // 2048 / 1024 — 50% overlap; lighter processing, slightly less smooth suppression    
    this.bnOverlap         = 768;
    this.bnBuffer          = new Float32Array(this.bnFFTSize);
    this.bnNoiseFloor       = new Float32Array(this.bnFFTSize / 2);
    this.bnDownTimeConstant = 4;     // seconds — floor can fall this slowly to find genuine gaps
    // bnDownTimeConstant (floor fall speed, currently 32s)
    // 4 — more responsive on bands that genuinely quiet down quickly (e.g. 40m at dawn)
    // 12 — better on busy HF bands where real gaps are rare
    // 20 — near-permanent floor; only reacts to band openings/closings
    // 3 — aggressive, useful if you trust QSB is always faster than this
    this.bnUpTimeConstant   = 300;    // seconds — floor rises far slower than that (won't mistake sustained signal for "louder noise")
    // bnUpTimeConstant (floor rise speed, currently 240s)
    // 45 — half the default; still slower than QSB but adapts to propagation changes faster
    // 120 — safer on bands with slow S9+ noise that creeps up (low-band evenings)
    // 180 — essentially "set it once per session" behaviour
    // 300 — 5 minutes; almost static floor, set-and-forget for stable noise environments
    this.bnClassifyRatio    = 2.00;    // bins within this ratio of the floor are classified as noise
    // bnClassifyRatio (noise vs signal threshold, currently 1.25×)
    // 1.2 — tighter; only classifies bins very close to floor as noise — less risk of nibbling signal
    // 1.8 — wider; catches more noise bins but more likely to clip quiet SSB sidebands
    // 2.0 — aggressive; useful when noise floor is flat and well-characterised
    // 1.35 — a conservative middle ground between 1.2 and 1.5    
    this.bnSuppressionDB    = 12;     // suppression depth at the LOW end of the band (below bnTiltLowHz=300Hz)
    // bnSuppressionDB (low-end cut depth, currently 9 dB)
    // 3 — gentle; just takes the edge off without audible effect on band character
    // 9 — noticeable improvement on a quiet band without killing low-frequency hiss
    // 12 — strong cut; good if LF band noise dominates
    // 0 — effectively disables low-end suppression while keeping the tilt active    
    this.bnSuppressionDBHigh = 30
    // bnSuppressionDBHigh (high-end cut depth, currently 26 dB)
    // 12 — less aggressive HF cut; better if the tilt feels like it's muffling weak signals
    // 18 — previous tested value, a reasonable midpoint
    // 30 — maximum useful cut before noise-classified bins become inaudible gaps
    // 36 — essentially silences HF noise bins; only suitable if bnClassifyRatio is tight (≤1.3)    
    this.bnTiltLowHz         = 300
    this.bnTiltHighHz        = 2500
    // bnTiltHighHz (top of tilt ramp, currently 2500 Hz)
    // 2500 — keeps full suppression away from the upper SSB edge, safer for DX
    // 3000 — extends into the filter skirt (fine if your BPF rolls off before 3 kHz)
    // 2200 — a more conservative top-end; leaves 2.2–3 kHz fully unaffected    
    this.bnEnabled          = false; // off by default — toggled via the NS button in the UI, scoped to bnModes below
    this.bnModes            = ['USB', 'LSB', 'AM']; // scope — SSB + AM per the stated goal, nothing else
    this._bnNeedsSeed       = true;  // forces an immediate seed on first use rather than climbing from zero

    // Soft-knee width around bnClassifyRatio, as a fraction of the threshold.
    // A hard yes/no cut right at the ratio boundary means a bin that's 1%
    // above/below the line gets a totally different gain — that's what
    // nibbles the edges of real signal and causes musical-noise chatter on
    // borderline bins. Widening this softens the decision into a ramp.
    // Deliberately asymmetric: the low (noise) side is narrow so bins that
    // are clearly below the floor reach full suppression depth quickly —
    // that's where the extra strength comes from. The high (signal) side
    // stays wide, which is what keeps real audio protected: nothing gets
    // more suppression as a *result* of this change unless it was already
    // well inside the "noise" side of the boundary.
    this.bnKneeRatioLow     = 0.12;
    this.bnKneeRatioHigh    = 0.35;
    // Per-bin gain is smoothed over time, deliberately asymmetric:
    // fast attack (open up) so a real signal appearing doesn't get clipped
    // on its first block, slow release (clamp down) so a bin doesn't
    // chatter open/closed across blocks that are individually noisy —
    // that chatter is what's audible as "musical noise".
    this.bnGainAttackMs     = 8;
    this.bnGainReleaseMs    = 180;
    this._bnGain            = new Float32Array(this.bnFFTSize / 2).fill(1);

    // ── Auto Notch Filter (ANF) ──────────────────────────────────────────────
    // NLMS adaptive linear predictor: learns to predict tonal interference
    // (carriers, birdies, heterodynes) and subtracts it in real time.
    // Broadband audio (voice, CW) is unpredictable → passes through as the
    // prediction *error* and is therefore preserved.
    this.anfEnabled       = false;
    this.anfTaps          = 64;     // FIR predictor length  (more = more simultaneous notches)
    this.anfDelay         = 2;      // decorrelation delay in samples (1–4 for SSB/CW; ≥8 for FM)
    this.anfMu            = 0.01;   // NLMS step size (0.005=slow/stable … 0.05=fast/aggressive)
    this._anfW            = new Float32Array(this.anfTaps);                    // adaptive weights
    this._anfBuf          = new Float32Array(this.anfTaps + this.anfDelay);    // circular delay line
    this._anfBufIdx       = 0;
    // Second set of state for the stereo R channel (C-QUAM)
    this._anfWR           = new Float32Array(this.anfTaps);
    this._anfBufR         = new Float32Array(this.anfTaps + this.anfDelay);
    this._anfBufIdxR      = 0;
    // ────────────────────────────────────────────────────────────────────────

    // ✅ FIXED: Cleanup tracking for proper resource management
    this.collectionTimer = null;
    this.userGestureFunc = null;
    this.maxAccumulatorSize = 12000 * 30; // 30 seconds max at 12 kHz
    this.maxRecordingDuration = 3600;
    // Matches the audio cap. Video is heavier than WAV, but the bitrate cap in
    // videoRecorder.js keeps it to roughly 15 MB/min rather than whatever rate
    // the browser would pick on its own.
    this.maxVideoRecordingDuration = 3600;
    this.recordingStartTime = null;
    this._initAccumulators();


    if (this.audioCtx && this.audioCtx.state == 'running') {
      startaudio = document.getElementById('startaudio')
      if (startaudio) {
        startaudio.remove()
      }
    } else {
      // for chrome
      // ✅ FIXED: Remove old listener if exists to prevent leaks
      if (this.userGestureFunc) {
        document.documentElement.removeEventListener('mousedown', this.userGestureFunc);
      }
      
      this.userGestureFunc = () => {
        if (this.audioCtx && this.audioCtx.state !== 'running') {
          this.audioCtx.resume();
        }
        // Remove the element with id startaudio from the DOM
        const startaudio = document.getElementById('startaudio');
        if (startaudio) {
          startaudio.remove();
        }
        document.documentElement.removeEventListener('mousedown', this.userGestureFunc);
        this.userGestureFunc = null;
      };
      
      document.documentElement.addEventListener('mousedown', this.userGestureFunc);
    }


    this.mode = 0
    this.d = 10
    this.v = 10
    this.n2 = 10
    this.n1 = 10
    this.var = 10
    this.highThres = 1

    this.initTimer(); // Start the timing mechanism
  }


_resetInitPromise(err = null) {
  const reject = this.rejectPromise
  this.promise = null
  this.resolvePromise = null
  this.rejectPromise = null
  if (err && reject) {
    try { reject(err) } catch (_) {}
  }
}

_clearInitTimeout() {
  if (this._initTimeout) {
    clearTimeout(this._initTimeout)
    this._initTimeout = null
  }
}

_isSocketOpen() {
  return !!this.audioSocket && this.audioSocket.readyState === WebSocket.OPEN
}

_safeSend(payload) {
  if (!this._isSocketOpen()) {
    return false
  }
  try {
    this.audioSocket.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
    return true
  } catch (e) {
    console.warn('[Audio] WebSocket send failed:', e)
    return false
  }
}

_handleSocketTerminal(kind, evt) {
  this._clearInitTimeout()

  if (this.audioSocket) {
    try {
      this.audioSocket.onmessage = null
      this.audioSocket.onopen = null
      this.audioSocket.onerror = null
      this.audioSocket.onclose = null
    } catch (_) {}
  }

  const hadPendingInit = !!this.promise
  const err = new Error(`[Audio] socket ${kind}`)
  this._resetInitPromise(hadPendingInit ? err : null)

  this.audioSocket = null
}

async init() {
  if (this.promise) {
    return this.promise
  }

  this.promise = new Promise((resolve, reject) => {
    this.resolvePromise = resolve
    this.rejectPromise = reject
  })

  this.audioSocket = new WebSocket(this.endpoint)
  this.audioSocket.binaryType = 'arraybuffer'
  this.firstAudioMessage = true
  this.audioSocket.onmessage = this.socketMessageInitial.bind(this)
  this.audioSocket.onopen = () => {
    // Advertise codec capabilities before any mode change can trigger C-QUAM.
    // Older servers ignore unknown commands, so this is backward-compatible.
    this._safeSend({ cmd: 'codec_caps', opus: OPUS_ENABLED })
  }
  this.audioSocket.onerror = (evt) => this._handleSocketTerminal('error', evt)
  this.audioSocket.onclose = (evt) => this._handleSocketTerminal('close', evt)

  this._clearInitTimeout()
  this._initTimeout = setTimeout(() => {
    if (this.promise) {
      this._handleSocketTerminal('timeout')
    }
  }, 8000)

  return this.promise
}

  stop() {
    this._clearInitTimeout();
    this._resetInitPromise();
    try { _workerPending.clear(); } catch (_) {}

    // Stop the compositor before the audio graph below is torn down, otherwise
    // its rAF loop keeps running against a closed context and holds the encoder
    // open. Chunks recorded so far stay downloadable.
    try {
      this.stopVideoRecording();
      this._closeResampleContext();
    } catch (e) {
      console.warn('[VideoRecording] stop error', e);
    }
    // ✅ FIXED: Clear the FT8 collection timer
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    if (this.ft4CollectionTimer) {
      clearInterval(this.ft4CollectionTimer);
      this.ft4CollectionTimer = null;
    }

    if (this.wsprTimer) {
      clearInterval(this.wsprTimer);
      this.wsprTimer = null;
    }
    
    // ✅ FIXED: Remove user gesture listener
    if (this.userGestureFunc) {
      document.documentElement.removeEventListener('mousedown', this.userGestureFunc);
      this.userGestureFunc = null;
    }
    
    // ✅ FIXED: Close WebSocket and remove handlers
    if (this.audioSocket) {
      this.audioSocket.onmessage = null;
      this.audioSocket.onopen = null;
      this.audioSocket.onerror = null;
      this.audioSocket.onclose = null;
      
      if (this.audioSocket.readyState === WebSocket.OPEN || 
          this.audioSocket.readyState === WebSocket.CONNECTING) {
        try {
          this.audioSocket.close();
        } catch (e) {
          console.warn('Error closing WebSocket:', e);
        }
      }
      this.audioSocket = null;
    }
    
    // ✅ FIXED: Free decoder
    if (this.decoder && typeof this.decoder.free === 'function') {
      try {
        this.decoder.free();
      } catch (e) {
        console.warn('Error freeing decoder:', e);
      }
      this.decoder = null;
    }
    
    // ✅ FIXED: Clean up audio context
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        // Disconnect all nodes first
        if (this.destinationNode) this.destinationNode.disconnect();
        if (this.gainNode) this.gainNode.disconnect();
        if (this.audioInputNode) this.audioInputNode.disconnect();
        if (this.convolverNode) this.convolverNode.disconnect();
        if (this.humNotch50) this.humNotch50.disconnect();
        if (this.humNotch60) this.humNotch60.disconnect();
        
        this.audioCtx.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      this.audioCtx = null;
    }
    
    // ✅ FIXED: Clear accumulator and recording data
    this.accumulatorLen     = 0;
    this.ft4AccumulatorLen  = 0;
    this.ft2AccumulatorLen  = 0;
    this.wsprAccumulatorLen = 0;
    this.recordedAudio = [];
    this.audioQueue = [];
    this.recordedChunks = [];
    // Clear CW state
    this._cwReset();

    // Clear FAX state
    if (this.decodeFAX) { this.decodeFAX = false; this._faxReset(); }
    this.faxCallback = null;

    // Clear NAVTEX state
    if (this.decodeNAVTEX) { this.decodeNAVTEX = false; this._navtexReset(); }
    this.navtexCallback = null;

    if (this._sstvDecoder && typeof this._sstvDecoder.destroy === 'function') {
      try { this._sstvDecoder.destroy(); } catch (e) { console.warn('[SSTV] destroy error', e); }
    }

    // Clear generic FSK state
    if (this.decodeFSK) { this.decodeFSK = false; this._fskReset(); }
    this.fskCallback = null;
  }

    applyAGC(pcmArray) {
    // Frontend sample-domain AGC is intentionally disabled.
    // Backend AGC should be the only real AGC in the chain.
    return pcmArray;
  }

  _resetAudioLevelControl() {
    this.audioLevelGain = 1.0;
    this.audioLevelRms = 0.0;
    this.audioLevelPeak = 0.0;
    this.audioLevelDetectorPeak = 0.0;
    this.agcGain = 1.0;
    this.agcEnvelope = 0.0;
    this.agcLookaheadBuffer = [];
    this._applyOutputGain();
  }

  _applyOutputGain() {
    const finalGain = Math.max(0, (this.userGain ?? 1.0) * (this.audioLevelEnabled ? (this.audioLevelGain ?? 1.0) : 1.0));
    this.gain = finalGain;
    if (this.gainNode) {
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      try {
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setTargetAtTime(finalGain, now, 0.010);
      } catch (_) {
        this.gainNode.gain.value = finalGain;
      }
    }
  }

  _configureAudioLevelMode(mode) {
    this.audioLevelMode = mode;
    this.audioLevelHoldCounter = 0;
    this.audioLevelDetectorFast = 0.0;
    this.audioLevelDetectorSlow = 0.0;
    this.audioLevelDetectorPeak = 0.0;  // smoothed peak follower — reset on every mode switch

    switch (mode) {
      case 1: // Fast — real transceiver fast AGC
          // Attack: fast (~85ms T63) — clamps loud signals within one packet.
          // Release: ~80ms T63 — gain snaps back quickly after a signal ends.
          // You clearly hear the noise floor rise between words and after TX.
          // Peak-driven: reacts to peaks, not RMS average.
          // This is what IC-7300 / K3 "FAST" sounds like.
          this.audioLevelEnabled    = true;
          this.audioLevelTarget     = 0.38;
          this.audioLevelMinGain    = 0.45;
          this.audioLevelMaxBoost   = 1.30;
          this.audioLevelAttack     = 0.85;   // T63 ≈ 85ms — fast clamp on loud signals
          this.audioLevelRelease    = 0.86;   // T63 ≈ 80ms — gain snaps back almost instantly
          this.audioLevelHoldFrames = 1;      // minimal hold — releases immediately
          this.audioLevelPeakWeight = 0.92;
          this.audioLevelFastCoeff  = 0.55;
          this.audioLevelSlowCoeff  = 0.10;
          this.audioLevelPeakCoeff  = 0.75;
          break;

      case 2: // Smooth — real transceiver slow AGC
          // Attack: fast (same as Fast mode — all hardware AGCs attack fast).
          // Release: ~3–5s T63 — gain barely recovers between words or even between
          // transmissions. Noise floor stays suppressed for several seconds after
          // a signal ends. This is what IC-7300 / K3 "SLOW" sounds like on a busy band.
          this.audioLevelEnabled    = true;
          this.audioLevelTarget     = 0.38;
          this.audioLevelMinGain    = 0.55;
          this.audioLevelMaxBoost   = 2.00;
          this.audioLevelAttack     = 0.85;   // T63 ≈ 85ms — same fast attack as Fast mode
          this.audioLevelRelease    = 0.032;  // T63 ≈ 4500ms — very slow recovery
          this.audioLevelHoldFrames = 50;     // ~8s hold before release even starts
          this.audioLevelPeakWeight = 0.75;
          this.audioLevelFastCoeff  = 0.06;
          this.audioLevelSlowCoeff  = 0.012;
          this.audioLevelPeakCoeff  = 0.08;
          break;

      case 3: // Adaptive — medium AGC, ~400ms release
          // Attack: fast. Release: ~400ms T63 — a classic medium/auto setting.
          // Tracks QSB reasonably, doesn't pump on speech but recovers within
          // a word or two. The adaptive branch in _updateAudioLevelControl
          // additionally shifts timing based on crest factor and signal dynamics.
          this.audioLevelEnabled    = true;
          this.audioLevelTarget     = 0.38;
          this.audioLevelMinGain    = 0.42;
          this.audioLevelMaxBoost   = 2.00;
          this.audioLevelAttack     = 0.85;   // T63 ≈ 85ms — fast attack
          this.audioLevelRelease    = 0.33;   // T63 ≈ 400ms — medium release
          this.audioLevelHoldFrames = 5;      // ~800ms hold
          this.audioLevelPeakWeight = 0.80;
          this.audioLevelFastCoeff  = 0.25;
          this.audioLevelSlowCoeff  = 0.05;
          this.audioLevelPeakCoeff  = 0.35;
          break;

      case 0: // Auto = bypass frontend audio-level
      default:
        this.audioLevelEnabled = false;
        this.audioLevelTarget = 0.20;
        this.audioLevelMinGain = 1.0;
        this.audioLevelMaxBoost = 2.0;
        this.audioLevelAttack = 0.0;
        this.audioLevelRelease = 0.0;
        this.audioLevelHoldFrames = 0;
        this.audioLevelPeakWeight = 0.0;
        this.audioLevelFastCoeff = 0.0;
        this.audioLevelSlowCoeff = 0.0;
        break;
    }
  }

  _updateAudioLevelControl(pcmArray) {
    if (!this.audioLevelEnabled || !pcmArray || !pcmArray.length) {
      if (!this.audioLevelEnabled && this.audioLevelGain !== 1.0) {
        this.audioLevelGain = 1.0;
        this._applyOutputGain();
      }
      return;
    }

    let sumSq = 0.0;
    let peak = 0.0;
    for (let i = 0; i < pcmArray.length; i++) {
      const s = pcmArray[i];
      const a = Math.abs(s);
      sumSq += s * s;
      if (a > peak) peak = a;
    }

    const rms = Math.sqrt(sumSq / pcmArray.length);
    this.audioLevelRms = rms;
    this.audioLevelPeak = peak;

    const fastCoeff = this.audioLevelFastCoeff ?? 0.12;
    const slowCoeff = this.audioLevelSlowCoeff ?? 0.03;
    const peakCoeff = this.audioLevelPeakCoeff ?? 0.22;
    this.audioLevelDetectorFast += (rms - this.audioLevelDetectorFast) * fastCoeff;
    this.audioLevelDetectorSlow += (rms - this.audioLevelDetectorSlow) * slowCoeff;
    // Smoothed peak follower — tracks the per-frame peak envelope across frames.
    // The original code used raw per-frame `peak` (instantaneous) with peakWeight=0.78,
    // meaning 78% of each gain decision was based on a single-frame peak that varies
    // wildly between SSB/CW packets. This caused subtle gain jitter on every packet.
    // The smoothed follower removes this noise while still reacting to real level changes.
    if (this.audioLevelDetectorPeak === undefined) this.audioLevelDetectorPeak = 0.0;
    this.audioLevelDetectorPeak += (peak - this.audioLevelDetectorPeak) * peakCoeff;

    let detector = Math.max(
      (this.audioLevelDetectorFast * (1.0 - (this.audioLevelPeakWeight ?? 0.75))) + (this.audioLevelDetectorPeak * (this.audioLevelPeakWeight ?? 0.75)),
      this.audioLevelDetectorSlow * 0.85,
      1e-4
    );

    let target = this.audioLevelTarget;
    let minGain = this.audioLevelMinGain ?? 0.65;
    let maxBoost = this.audioLevelMaxBoost;
    let attack = this.audioLevelAttack;
    let release = this.audioLevelRelease;
    let holdFrames = this.audioLevelHoldFrames ?? 0;

    if (this.audioLevelMode === 3) {
      const crest = peak / Math.max(rms, 1e-4);
      const levelVsSlow = this.audioLevelDetectorFast / Math.max(this.audioLevelDetectorSlow, 1e-4);

      // Keep the same nominal loudness as Fast/Smooth.
      // Adaptive only changes reaction timing, not the steady-state gain law.
      if (crest > 3.2) {
        detector = Math.max(detector, peak * 1.03);
        attack = 0.26;
        release = 0.060;
        holdFrames = 2;
      } else if (rms < this.audioLevelDetectorSlow * 0.65) {
        // Signal has dropped well below the tracked noise floor — quiet passage or gap.
        // Use slower timing to avoid gain rushing up into a noise burst.
        detector = Math.max(detector, this.audioLevelDetectorSlow * 0.98);
        attack = 0.060;
        release = 0.012;
        holdFrames = 8;
      } else if (levelVsSlow > 1.35) {
        attack = 0.18;
        release = 0.040;
        holdFrames = 3;
      } else {
        attack = 0.10;
        release = 0.020;
        holdFrames = 6;
      }
    }

    let desired = Math.min(maxBoost, Math.max(minGain, target / detector));

    if (desired < this.audioLevelGain) {
      this.audioLevelHoldCounter = holdFrames;
      this.audioLevelGain += (desired - this.audioLevelGain) * attack;
    } else {
      if ((this.audioLevelHoldCounter ?? 0) > 0) {
        this.audioLevelHoldCounter--;
        desired = this.audioLevelGain;
      } else {
        this.audioLevelGain += (desired - this.audioLevelGain) * release;
      }
    }

    this.audioLevelGain = Math.min(maxBoost, Math.max(minGain, this.audioLevelGain));
    this._applyOutputGain();
  }

   // Frontend audio-level parameters (backend AGC remains enabled)

setAGC(newAGCSpeed) {
  if (typeof this.decoder?.set_agc_enable === 'function') {
    this.decoder.set_agc_enable(true);
  }

  this.mute = false;
  this._configureAudioLevelMode(newAGCSpeed);
  this._resetAudioLevelControl();

  const modeNames = {
    0: 'Audio Level Auto (Bypass)',
    1: 'Audio Level Fast (Strong Ride)',
    2: 'Audio Level Smooth (Gentle Ride)',
    3: 'Audio Level Adaptive (Program Dependent)'
  };

  console.log('Backend AGC ENABLED | Frontend mode = ' + (modeNames[newAGCSpeed] || ('Unknown ' + newAGCSpeed)));
}

  smoothMaxgain(maxgain) {
    // Legacy helper kept for compatibility. It now only limits
    // frontend playback-level boost instead of enabling sample AGC.
    this.audioLevelMaxBoost = Math.max(1.0, Number(maxgain) || 1.0);
  }


  _initAccumulators() {
    // The FTx capture length is (slot_period - 0.4) s, so the buffers have to
    // be sized from the real sample rate. They were previously fixed at 12 kHz
    // assumptions; at a higher audio_sps the buffer would fill before a full
    // window was collected and the slot would never decode.
    const sps = this.audioOutputSps || 12000;
    const slotBuf = (period) => Math.ceil(period * sps) + sps;   // +1 s headroom

    this.maxAccumulatorSize     = Math.max(this.maxAccumulatorSize,    slotBuf(15.0));
    this.maxFT4AccumulatorSize  = Math.max(this.maxFT4AccumulatorSize, slotBuf(7.5));
    this.maxFT2AccumulatorSize  = Math.max(this.maxFT2AccumulatorSize, slotBuf(3.75));
    this.maxWSPRAccumulatorSize = Math.max(this.maxWSPRAccumulatorSize, sps * 125);

    this.accumulator        = new Float32Array(this.maxAccumulatorSize);
    this.accumulatorLen     = 0;
    this.ft4Accumulator     = new Float32Array(this.maxFT4AccumulatorSize);
    this.ft4AccumulatorLen  = 0;
    this.ft2Accumulator     = new Float32Array(this.maxFT2AccumulatorSize);
    this.ft2AccumulatorLen  = 0;
    this.wsprAccumulator    = new Float32Array(this.maxWSPRAccumulatorSize);
    this.wsprAccumulatorLen = 0;
  }

  applyNoiseBlanker(pcmArray) {
    // Legacy master switch `this.nb` is treated as "both on"
    // if separate toggles have not been explicitly set.
    const useBlanker = this.nbBlankerEnabled || this.nb;
    // nrEnabled is set by set_js_nb() but Svelte's handleNBChange sets only
    // nbBlankerEnabled directly. Treat nbBlankerEnabled as implying NR on,
    // since the NB button is intended to enable both together.
    const useNR      = this.nrEnabled || this.nbBlankerEnabled || this.nb;

    if (!useBlanker && !useNR) return pcmArray;

    // ── Time-domain envelope blanker (replaces broken FFT-domain blanker) ──
    // The original blanker compared IFFT complex magnitudes against a spectral
    // average threshold, then gated the original sample by that ratio. The IFFT
    // output and the original sample are not coherent — their phase relationship
    // is arbitrary — so the gating was effectively random within each frame,
    // amplitude-modulating the audio at sub-frame rates. That is exactly what
    // produces the metallic / ring-modulator artifact.
    //
    // This replacement tracks a smoothed envelope of the signal in the time
    // domain and blanks only samples that exceed the envelope by a fixed ratio.
    // True impulsive events (static crashes, QRM bursts) have instantaneous
    // amplitude >> envelope; normal SSB/AM audio stays close to the envelope.
    // Attack is fast (1 ms) so the envelope follows speech peaks; release is
    // slow (30 ms) so it doesn't chase fast QSB. Blanked samples are
    // replaced with zero (hard blank) — a brief silence is less objectionable
    // than the metallic modulation the previous approach produced.
    let workArray = pcmArray;

    if (useBlanker) {
      const sps         = this.audioOutputSps || 12000;
      // Attack must be SLOW so the envelope does not rise with the impulse.
      // At 20 ms, a 1–5 sample static crash leaves env virtually unchanged,
      // making abs/env >> threshold. At 1 ms the envelope chased the impulse
      // immediately and the ratio never triggered.
      const attackTC    = 0.020;  // 20 ms
      const releaseTC   = 0.200;  // 200 ms — stable floor, doesn't chase QSB
      const blankRatio  = 3.5;    // blank when sample > 3.5× envelope (~11 dB)
      const holdSamples = Math.round(0.005 * sps);  // 5 ms — covers full crash duration

      const alphaA = 1 - Math.exp(-1 / (sps * attackTC));
      const alphaR = 1 - Math.exp(-1 / (sps * releaseTC));

      let env  = this._nbEnv;
      let hold = this._nbHold;

      workArray = new Float32Array(pcmArray.length);
      for (let i = 0; i < pcmArray.length; i++) {
        const s   = pcmArray[i];
        const abs = Math.abs(s);

        // Check BEFORE updating envelope — updating first lets env rise with
        // the impulse, collapsing the ratio before the comparison happens.
        const triggered = abs > blankRatio * env;

        env = abs > env
          ? env + alphaA * (abs - env)
          : env + alphaR * (abs - env);

        if (triggered) hold = holdSamples;

        if (hold > 0) {
          workArray[i] = 0;
          hold--;
        } else {
          workArray[i] = s;
        }
      }
      this._nbEnv  = env;
      this._nbHold = hold;
    }

    // ── Frequency-domain noise reduction ──
    if (!useNR) return workArray;

    const processedArray = new Float32Array(workArray.length);

    // PERF: reuse flat Float64 scratch (re/im) and the magnitude buffer across
    // overlap steps AND across calls, and transform through the allocation-free
    // transformFlat() instead of fft()/ifft() (which each allocate an N-element
    // [re,im] pair-array every step). This removes the dominant per-audio-buffer
    // allocation churn on the NR path. Output is bit-identical: transformFlat
    // matches fft()/ifft() exactly, magnitude is still Float32 (same rounding),
    // nbBuffer is loaded exactly as before (its stale-tail behaviour on a short
    // final window is preserved — nbBuffer is never destroyed by the transform,
    // only copied into re/im), and only the lower half of the spectrum is
    // scaled, same as before.
    const N = this.nbFFTSize;
    if (!this._nbRe || this._nbRe.length !== N) {
      this._nbRe = new Float64Array(N);
      this._nbIm = new Float64Array(N);
    }
    if (!this._nbMag || this._nbMag.length !== N / 2) {
      this._nbMag = new Float32Array(N / 2);
    }
    const re = this._nbRe, im = this._nbIm, magnitudeSpectrum = this._nbMag;

    for (let i = 0; i < workArray.length; i += this.nbOverlap) {
      this.nbBuffer.set(workArray.subarray(i, i + N));

      for (let j = 0; j < N; j++) { re[j] = this.nbBuffer[j]; im[j] = 0; }
      transformFlat(re, im, false);

      for (let j = 0; j < N / 2; j++) {
        magnitudeSpectrum[j] = Math.sqrt(re[j] * re[j] + im[j] * im[j]);
      }

      this.nbSpectrumHistory[this.nbHistoryIndex].set(magnitudeSpectrum);
      this.nbHistoryIndex = (this.nbHistoryIndex + 1) % this.nbAverageWindows;

      for (let j = 0; j < N / 2; j++) {
        let sum = 0;
        for (let k = 0; k < this.nbAverageWindows; k++) sum += this.nbSpectrumHistory[k][j];
        this.nbSpectrumAverage[j] = sum / this.nbAverageWindows;
      }

      // Spectral NR — exponent=0.5: at ratio=2× → −3 dB, ratio=4× → −6 dB.
      // Audibly effective on broadband noise without silencing weak signals.
      // No hard floor: bins well above average get meaningful suppression.
      for (let j = 0; j < N / 2; j++) {
        const ratio = this.nbSpectrumAverage[j] > 0
          ? magnitudeSpectrum[j] / this.nbSpectrumAverage[j]
          : 1;
        const scale = ratio > 1 ? 1 / Math.pow(ratio, 0.5) : 1;
        re[j] *= scale;
        im[j] *= scale;
      }

      transformFlat(re, im, true);
      for (let j = 0; j < N; j++) {
        const idx = i + j;
        if (idx >= workArray.length) break;
        processedArray[idx] = re[j];
      }
    }

    return processedArray;
  }

  // Enable/disable and tune the background-noise tool from outside (UI hook).
  setBackgroundNoiseSuppression(enabled, depthDB) {
    this.bnEnabled = !!enabled;
    if (typeof depthDB === 'number' && depthDB >= 0) {
      this.bnSuppressionDB = depthDB;
    }
    if (this.bnEnabled) this.resetBackgroundNoise();
    console.log('[BG Noise] ' + (this.bnEnabled ? 'ENABLED' : 'DISABLED') +
                ' depth=' + this.bnSuppressionDB + 'dB modes=' + this.bnModes.join('/'));
  }

  // Frequency/mode changes invalidate the floor measurement (it describes
  // noise character at the OLD tuned spot, not the new one). Rather than
  // zeroing it and waiting out the slow ~90s upAlpha climb again, seed it
  // directly from the next block's actual spectrum on the first pass after
  // a reset — instant reasonable starting point, then refine slowly as usual.
  resetBackgroundNoise() {
    this._bnNeedsSeed = true;
    if (this._bnGain) this._bnGain.fill(1);
  }

  applyBackgroundNoiseSuppression(pcmArray) {
    if (!this.bnEnabled) return pcmArray;

    // Scope strictly to SSB/AM per the stated goal — leave CW/FM/digital
    // modes completely untouched rather than guessing whether this helps
    // them too.
    if (!this.bnModes.includes(this.demodulation)) return pcmArray;

    const N   = this.bnFFTSize;
    const hop = this.bnOverlap;
    const hopSeconds = hop / (this.audioOutputSps || 12000);

    // Both directions are slow relative to typical QSB fade cycles — that's
    // what makes this immune to "breathing". downAlpha lets the floor find
    // genuine quiet periods over several seconds; upAlpha is far slower so a
    // sustained strong signal can't drag the "noise" reference up to meet it.
    const downAlpha = 1 - Math.exp(-hopSeconds / this.bnDownTimeConstant);
    const upAlpha   = 1 - Math.exp(-hopSeconds / this.bnUpTimeConstant);

    // Per-bin gain smoothing (attack fast, release slow — see bnGainAttackMs
    // / bnGainReleaseMs above).
    const gainAttackAlpha  = 1 - Math.exp(-hopSeconds / (Math.max(this.bnGainAttackMs, 1e-3) / 1000));
    const gainReleaseAlpha = 1 - Math.exp(-hopSeconds / (Math.max(this.bnGainReleaseMs, 1e-3) / 1000));

    // Soft-knee boundaries around bnClassifyRatio: below loR, treated as
    // fully noise (bnGainCurve depth applied); above hiR, treated as fully
    // signal (no suppression); in between, a smoothstep ramp between the two.
    const loR = this.bnClassifyRatio * (1 - this.bnKneeRatioLow);
    const hiR = this.bnClassifyRatio * (1 + this.bnKneeRatioHigh);

    if (!this._bnGain || this._bnGain.length !== N / 2) {
      this._bnGain = new Float32Array(N / 2).fill(1);
    }
    const bnGain = this._bnGain;

    // Per-bin suppression-depth curve — ramps from bnSuppressionDB to
    // bnSuppressionDBHigh between bnTiltLowHz and bnTiltHighHz. Cached and
    // only rebuilt when something it depends on actually changes, since
    // recomputing 1024 bins' worth of dB math every block is wasted work
    // when none of these parameters move between calls.
    const sps = this.audioOutputSps || 12000;
    const curveKey = N + ':' + sps + ':' + this.bnSuppressionDB + ':' +
                     this.bnSuppressionDBHigh + ':' + this.bnTiltLowHz + ':' + this.bnTiltHighHz;
    if (this._bnGainCurveKey !== curveKey) {
      this._bnGainCurve = new Float32Array(N / 2);
      for (let j = 0; j < N / 2; j++) {
        const freq = j * sps / N;
        const frac = Math.max(0, Math.min(1,
          (freq - this.bnTiltLowHz) / (this.bnTiltHighHz - this.bnTiltLowHz)));
        const depthDB = this.bnSuppressionDB + frac * (this.bnSuppressionDBHigh - this.bnSuppressionDB);
        this._bnGainCurve[j] = Math.pow(10, -depthDB / 20);
      }
      this._bnGainCurveKey = curveKey;
    }
    const bnGainCurve = this._bnGainCurve;

    const processedArray = new Float32Array(pcmArray.length);
    // PERF: reuse flat Float64 scratch and transform via the allocation-free
    // transformFlat() instead of fft()/ifft() (which allocate an N-element
    // [re,im] pair-array per overlap step). Same treatment already applied to
    // the NR path; bit-identical output. bnBuffer is still loaded exactly as
    // before (stale-tail on a short final window preserved), only the lower
    // half of the spectrum is scaled, and the inverse runs over the full N.
    if (!this._bnRe || this._bnRe.length !== N) {
      this._bnRe = new Float64Array(N);
      this._bnIm = new Float64Array(N);
    }
    const bnRe = this._bnRe, bnIm = this._bnIm;
    if (!this._bnMags || this._bnMags.length !== N / 2) this._bnMags = new Float32Array(N / 2);
    const mags = this._bnMags;
    if (!this._bnFloorSmoothed || this._bnFloorSmoothed.length !== N / 2) {
      this._bnFloorSmoothed = new Float32Array(N / 2);
    }
    const floorSmoothed = this._bnFloorSmoothed;

    for (let i = 0; i < pcmArray.length; i += hop) {
      this.bnBuffer.set(pcmArray.subarray(i, i + N));
      for (let j = 0; j < N; j++) { bnRe[j] = this.bnBuffer[j]; bnIm[j] = 0; }
      transformFlat(bnRe, bnIm, false);

      // Pass 1: update the noise floor per bin (unchanged — still tracked
      // at full frequency resolution, not smoothed, so it stays accurate).
      for (let j = 0; j < N / 2; j++) {
        const mag = Math.sqrt(bnRe[j] * bnRe[j] + bnIm[j] * bnIm[j]);
        mags[j] = mag;

        if (this._bnNeedsSeed) {
          // First block after a retune/mode-change/enable: snap straight to
          // the current spectrum instead of blending from a stale or zeroed
          // value, so suppression doesn't take ~90s to become meaningful
          // again every time you tune somewhere new.
          this.bnNoiseFloor[j] = mag;
        } else {
          const floor = this.bnNoiseFloor[j];
          if (mag < floor) {
            this.bnNoiseFloor[j] = floor + downAlpha * (mag - floor);
          } else {
            this.bnNoiseFloor[j] = floor + upAlpha * (mag - floor);
          }
        }
      }

      // Light 3-tap smoothing of the floor across frequency, used only for
      // the noise/signal decision below — not written back into
      // bnNoiseFloor. This is a much lighter touch than windowing/OLA
      // changes: it doesn't move a single sample of audio, it just keeps
      // neighbouring bins from picking wildly different floor references,
      // which is what let isolated bins flip in and out of the gate
      // independently of their neighbours (the actual "musical noise").
      for (let j = 0; j < N / 2; j++) {
        const lo = j > 0 ? this.bnNoiseFloor[j - 1] : this.bnNoiseFloor[j];
        const hi = j < N / 2 - 1 ? this.bnNoiseFloor[j + 1] : this.bnNoiseFloor[j];
        floorSmoothed[j] = (lo + this.bnNoiseFloor[j] + hi) / 3;
      }

      for (let j = 0; j < N / 2; j++) {
        const mag = mags[j];

        // Classification against the (slow, stable, frequency-smoothed)
        // floor is a soft-knee ramp rather than a hard cut, so a bin
        // sitting right on the boundary doesn't flip between "fully
        // passed" and "fully cut" from one block to the next. The DEPTH
        // applied to a noise-like bin still follows bnGainCurve — deeper
        // at higher frequencies.
        const ratio = mag / Math.max(floorSmoothed[j], 1e-9);
        let t = (ratio - loR) / (hiR - loR);
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const smooth = t * t * (3 - 2 * t); // smoothstep: 0=noise, 1=signal
        const depthDB = -20 * Math.log10(Math.max(bnGainCurve[j], 1e-9));
        const targetGain = Math.pow(10, -depthDB * (1 - smooth) / 20);

        // Asymmetric temporal smoothing: open (gain rising) fast so real
        // signal isn't clipped on onset, close (gain falling) slowly so
        // isolated noisy blocks don't cause audible chatter.
        const g = bnGain[j];
        const gAlpha = targetGain > g ? gainAttackAlpha : gainReleaseAlpha;
        const newGain = g + gAlpha * (targetGain - g);
        bnGain[j] = newGain;

        bnRe[j] *= newGain;
        bnIm[j] *= newGain;
      }
      this._bnNeedsSeed = false;

      transformFlat(bnRe, bnIm, true);
      for (let j = 0; j < N; j++) {
        const idx = i + j;
        if (idx >= pcmArray.length) break;
        processedArray[idx] = bnRe[j];
      }
    }

    return processedArray;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  AUTO NOTCH FILTER (ANF)
  //  NLMS Adaptive Linear Predictor
  // ═══════════════════════════════════════════════════════════════════════════

  applyAutoNotch(pcmIn, chR = false) {
    const N      = pcmIn.length;
    // Reuse the per-channel output buffer across calls (out[n] is fully written
    // for every n below, so there is no stale carry-over). Separate L/R buffers
    // are required because the stereo path holds both outputs simultaneously
    // during re-interleave; the mono path only ever uses the chR=false buffer.
    let out;
    if (chR) {
      if (!this._anfOutR || this._anfOutR.length !== N) this._anfOutR = new Float32Array(N);
      out = this._anfOutR;
    } else {
      if (!this._anfOut || this._anfOut.length !== N) this._anfOut = new Float32Array(N);
      out = this._anfOut;
    }
    const taps   = this.anfTaps;
    const D      = this.anfDelay;
    const mu     = this.anfMu;
    const leak   = 1e-4;           // FIX 4: weight leakage — prevents long-term drift
    const eps    = 1e-9;           // NLMS denominator floor (prevents ÷0)

    const w      = chR ? this._anfWR    : this._anfW;
    const buf    = chR ? this._anfBufR  : this._anfBuf;
    const bufLen = buf.length;         // taps + D  (= taps + D, exactly right)
    let   ptr    = chR ? this._anfBufIdxR : this._anfBufIdx;

    // FIX 3: cache tap vector once per block — collapses two modulo loops into one.
    // Reused scratch (keyed on taps); fully overwritten each sample before use.
    if (!this._anfXvec || this._anfXvec.length !== taps) this._anfXvec = new Float32Array(taps);
    const xvec = this._anfXvec;

    for (let n = 0; n < N; n++) {
      const x = pcmIn[n];

      // 1. Write current sample into circular delay line
      buf[ptr] = x;

      // 2. Fill tap cache, compute prediction ŷ and signal power in one pass
      let yhat  = 0.0;
      let power = eps;
      const base = ptr - D + 2 * bufLen;   // FIX 4 cosmetic: 2*bufLen is clearer
      for (let k = 0; k < taps; k++) {
        const s  = buf[(base - k) % bufLen];
        xvec[k]  = s;
        yhat    += w[k] * s;
        power   += s * s;
      }

      // 3. Prediction error = desired output (tones predicted → cancelled; voice passes through)
      const e = x - yhat;

      // 4. NLMS weight update with leakage (FIX 2: no clip; FIX 4: leakage term)
      //    w[k] ← w[k]·(1 − μ·leak) + (μ/‖x‖²)·e·x[n−D−k]
      const mu_n   = mu / power;
      const leak_c = 1.0 - mu * leak;
      for (let k = 0; k < taps; k++) {
        w[k] = w[k] * leak_c + mu_n * e * xvec[k];
      }

      // FIX 1: no hard clip — NLMS is unconditionally stable; a fixed ±1.5 threshold
      // was destroying normal audio because Opus gain=300 puts samples far above ±1.5.
      out[n] = e;

      // 5. Advance circular pointer
      ptr = (ptr + 1) % bufLen;
    }

    if (chR) { this._anfBufIdxR = ptr; }
    else      { this._anfBufIdx  = ptr; }

    return out;
  }

  /**
   * Reset the ANF adaptive weights and delay lines.
   * Call this whenever the demodulation mode changes to avoid
   * stale weight vectors from a previous mode corrupting the new one.
   */
  resetAutoNotch() {
    this._anfW.fill(0);
    this._anfBuf.fill(0);
    this._anfBufIdx = 0;
    this._anfWR.fill(0);
    this._anfBufR.fill(0);
    this._anfBufIdxR = 0;
  }

  /**
   * Enable or disable the Auto Notch Filter.
   * @param {boolean} enabled
   */
  enableAutoNotch(enabled) {
    const was = this.anfEnabled;
    this.anfEnabled = !!enabled;
    if (!was && this.anfEnabled) {
      // Re-entering: clear stale weights so filter converges cleanly
      this.resetAutoNotch();
    }
    console.log(`[ANF] Auto Notch Filter: ${this.anfEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  }

  /**
   * Tune the Auto Notch Filter parameters at run-time.
   *
   * @param {object} opts
   * @param {number} [opts.mu]     NLMS step size (0.005 – 0.05).
   *                               Lower  → slower convergence, less audio artefact.
   *                               Higher → faster lock-on,    more background ripple.
   * @param {number} [opts.taps]  FIR predictor length (16 – 256).
   *                               More taps = more simultaneous notches and sharper cuts.
   *                               More taps also increases CPU load (linear).
   * @param {number} [opts.delay] Decorrelation delay in samples (1 – 8).
   *                               2 is ideal for SSB/CW/AM.
   *                               Set to ≥ 8 for wideband FM.
   */
  setAutoNotchParams({ mu, taps, delay } = {}) {
    let resetNeeded = false;   // FIX 2: only taps/delay changes require a reset

    if (mu !== undefined) {
      this.anfMu = Math.max(1e-4, Math.min(0.1, mu));
      // mu is a scalar — update in-flight, no state reset needed
      console.log(`[ANF] mu updated → ${this.anfMu}`);
    }
    if (taps !== undefined) {
      const newTaps = Math.max(8, Math.min(512, Math.round(taps)));
      if (newTaps !== this.anfTaps) {
        this.anfTaps = newTaps;
        resetNeeded = true;
      }
    }
    if (delay !== undefined) {
      const newDelay = Math.max(1, Math.min(32, Math.round(delay)));
      if (newDelay !== this.anfDelay) {
        this.anfDelay = newDelay;
        resetNeeded = true;
      }
    }

    if (resetNeeded) {
      // Reallocate buffers and weights to match new dimensions
      const bufLen     = this.anfTaps + this.anfDelay;
      this._anfW       = new Float32Array(this.anfTaps);
      this._anfBuf     = new Float32Array(bufLen);
      this._anfBufIdx  = 0;
      this._anfWR      = new Float32Array(this.anfTaps);
      this._anfBufR    = new Float32Array(bufLen);
      this._anfBufIdxR = 0;
      console.log(`[ANF] Params updated — taps=${this.anfTaps}, delay=${this.anfDelay}, mu=${this.anfMu}`);
    }
  }
  // ── end ANF ───────────────────────────────────────────────────────────────


  /*
  * CONFIGURABLE NOISE GATE PRESETS
  * ================================
  * 
  * Usage: spectrumAudio.setNoiseGatePreset('preset-name')
  * 
  * Available presets:
  * 
  * 'balanced' (default)  - General purpose, works well for most situations
  * 'aggressive'          - More noise reduction, quieter background (-20 dB)
  * 'weak-signal'         - Better preservation of weak DX signals
  * 'smooth'              - Less gate "pumping", smoother transitions
  * 'maximum'             - Maximum quieting for very noisy bands (-26 dB)
  * 'cw'                  - Optimized for CW and digital modes
  * 'am-fm'               - Optimized for AM/FM with natural sound
  * 
  */

  applyNoiseCancel(pcmArray) {
    if (!this.noiseCancelEnabled) return pcmArray;

    const out = new Float32Array(pcmArray.length);

    // --- State ---
    let env        = this.noiseEnv || 0;
    let noiseFloor = this.noiseFloor || 0.001;
    let gateOpen   = (this.noiseGateOpen !== undefined)
      ? this.noiseGateOpen
      : true;
    let gateGain   = this.noiseGateGain ?? 1.0;

    // Track gate state changes for debugging
    const previousGateState = gateOpen;

    // Select parameters based on preset (ENHANCED FOR MORE AUDIBLE DIFFERENCES)
    let alphaEnv, alphaNoiseFloor, openFactor, closeFactor, floorGain;
    
    switch (this.noiseGatePreset) {

      case 'aggressive':
        alphaEnv = 0.0025;          // faster open (prevents clipped consonants)
        alphaNoiseFloor = 0.00008;
        // FIX: openFactor/closeFactor were swapped in all presets — see comment below.
        // Correct invariant: openFactor (HIGH) > closeFactor (LOW).
        // Gate opens when ratio > openFactor, closes when ratio < closeFactor.
        // Dead zone [closeFactor, openFactor] prevents chattering.
        openFactor = 3.50;          // HIGH — opens only on clear signal
        closeFactor = 1.70;         // LOW  — stays open through normal fades
        floorGain = 0.06;           // very quiet floor — near-silence between transmissions
        break;

      case 'weak-signal':
        alphaEnv = 0.0022;
        alphaNoiseFloor = 0.00007;
        openFactor = 3.40;          // FIX: was 1.60 (swapped)
        closeFactor = 1.60;         // FIX: was 3.40 (swapped)
        floorGain = 0.15;           // quiet floor while still keeping faint DX barely audible
        break;

      case 'smooth':
        alphaEnv = 0.0005;          // was 0.0020 — slowest envelope; immune to QSB-rate swings
        alphaNoiseFloor = 0.00006;
        openFactor = 3.60;          // FIX: was 1.75 (swapped)
        closeFactor = 1.40;         // was 1.75 — wider hysteresis; stays open through fades
        floorGain = 0.10;           // smooth fade to near-silence; no abrupt cuts
        break;

      case 'maximum':
        alphaEnv = 0.0028;
        alphaNoiseFloor = 0.00008;
        openFactor = 3.45;          // FIX: was 1.65 (swapped)
        closeFactor = 1.65;         // FIX: was 3.45 (swapped)
        floorGain = 0.03;           // maximum quieting — almost inaudible floor
        break;

      case 'cw':
        // CW needs a bit more “shape”, but still avoid clicky gating
        alphaEnv = 0.0035;
        alphaNoiseFloor = 0.00010;
        openFactor = 3.30;          // FIX: was 1.65 (swapped)
        closeFactor = 1.65;         // FIX: was 3.30 (swapped)
        floorGain = 0.06;           // near-silent floor between dits/dahs
        break;

      case 'am-fm':
        // Mostly-open feel; just gentle quieting
        alphaEnv = 0.0020;
        alphaNoiseFloor = 0.00006;
        openFactor = 3.80;          // FIX: was 2.00 (swapped)
        closeFactor = 2.00;         // FIX: was 3.80 (swapped)
        floorGain = 0.20;           // AM/FM: slightly more floor to preserve natural feel
        break;

      case 'balanced':
      default:
        alphaEnv = 0.0008;          // was 0.0024 — slower envelope; stops tracking QSB fades
        alphaNoiseFloor = 0.00008;
        openFactor = 3.50;          // FIX: was 1.70 (swapped)
        closeFactor = 1.50;         // was 1.70 — less hair-trigger on re-close during fades
        floorGain = 0.10;           // much quieter background; signals still open gate cleanly
      }

    // Debug counter for logging
    if (!this.noiseGateDebugCounter) this.noiseGateDebugCounter = 0;

    for (let i = 0; i < pcmArray.length; i++) {
      const s = pcmArray[i];
      const x = Math.abs(s);

      // Envelope follower
      env += alphaEnv * (x - env);

      // Update noise floor when we're near the noise region
      if (env < noiseFloor * 1.5) {
        noiseFloor += alphaNoiseFloor * (env - noiseFloor);
      }
      if (noiseFloor < 1e-6) noiseFloor = 1e-6;

      const ratio = env / noiseFloor;

      if (gateOpen) {
        if (ratio < closeFactor) {
          gateOpen = false;
        }
      } else {
        if (ratio > openFactor) {
          gateOpen = true;
        }
      }

      // Smooth gain ramp instead of hard binary switch — eliminates breathing/clicks.
      // Close is slow (~250 ms), open is fast (~20 ms) so signals cut through immediately.
      const targetGain = gateOpen ? 1.0 : floorGain;
      gateGain += (targetGain > gateGain ? 0.002 : 0.0003) * (targetGain - gateGain);
      out[i] = s * gateGain;
    }

    // Debug logging (once every 5 seconds)
    this.noiseGateDebugCounter++;
    if (this.noiseGateDebugCounter % 60000 === 0) {
      console.log(`[Noise Gate] Preset: ${this.noiseGatePreset}, Gate: ${gateOpen ? 'OPEN' : 'CLOSED'}, Env: ${env.toFixed(6)}, Noise: ${noiseFloor.toFixed(6)}, Ratio: ${(env/noiseFloor).toFixed(2)}x, FloorGain: ${floorGain}`);
    }

    // Log state changes
    if (gateOpen !== previousGateState) {
      console.log(`[Noise Gate] ${gateOpen ? '🔊 OPENED' : '🔇 CLOSED'} (Preset: ${this.noiseGatePreset}, FloorGain: ${floorGain})`);
    }

    this.noiseEnv      = env;
    this.noiseFloor    = noiseFloor;
    this.noiseGateOpen = gateOpen;
    this.noiseGateGain = gateGain;

    return out;
  }

  // Create the decoder for `codec` ('flac' | 'opus'), freeing any previous one,
  // and (re)attach the backend control methods.  Called at connect time and
  // whenever the server switches this client's codec mid-session.
  _buildDecoder(codec) {
    // ✅ Free old decoder before creating new one to prevent memory leak
    if (this.decoder && typeof this.decoder.free === 'function') {
      try {
        console.log('[Audio] Freeing old decoder before creating new one');
        this.decoder.free();
      } catch (e) {
        console.warn('[Audio] Error freeing old decoder:', e);
      }
      this.decoder = null;
    }

    if (codec === 'opus') {
      // Use WASM-based Opus ML decoder for raw Opus frames.  Build it at the
      // current channel count (2 for C-QUAM) up front so we don't create a mono
      // decoder and immediately rebuild it stereo via setChannels().
      this.decoder = new OpusMLAdapter(this.audioMaxSps || this.trueAudioSps || this.audioOutputSps || 48000, this.channels || 1);
    } else {
      // Use existing wrapper-based decoder (FLAC, etc.)
      this.decoder = createDecoder(codec, this.audioMaxSps, this.trueAudioSps, this.audioOutputSps);

      // ✅ CRITICAL FIX: Disable buggy WASM noise blanker for FLAC
      // The WASM FLAC decoder has a noise blanker with an index-out-of-bounds bug
      // (noiseblankerwild.rs:189 - tries to access array[26] when len=26).
      // Override set_nb() to prevent the crash while keeping JavaScript NB working.
      if (codec === 'flac' && this.decoder && typeof this.decoder.set_nb === 'function') {
        const originalSetNb = this.decoder.set_nb.bind(this.decoder);
        this.decoder.set_nb = function(enabled) {
          console.warn('[FLAC NB Bypass] WASM noise blanker disabled due to bug (use JavaScript NB instead)');
          // Don't call originalSetNb - it crashes!
          // JavaScript noise blanker (applyNoiseBlanker) will handle it instead
        };
        console.log('✅ FLAC WASM noise blanker bypassed - using JavaScript noise blanker only');
      }
    }

    // ============================================================================
    // Add backend audio control methods to decoder (signal.cpp control)
    // ============================================================================
    if (this.decoder) {
      // Store reference to WebSocket for sending commands
      this.decoder.socket = this.audioSocket;

      // Backend noise gate preset control
      this.decoder.set_noise_gate_preset = function(preset) {
        if (this.socket && this.socket.readyState === 1) {
          this.socket.send(JSON.stringify({
            cmd: "noise_gate_preset",
            preset: preset
          }));
          console.log('✅ Backend noise gate preset:', preset);
        } else {
          console.warn('⚠️ WebSocket not ready for noise gate preset');
        }
      };

      // Backend noise gate enable/disable
      this.decoder.set_noise_gate_enable = function(enabled) {
        if (this.socket && this.socket.readyState === 1) {
          this.socket.send(JSON.stringify({
            cmd: "noise_gate_enable",
            enabled: enabled
          }));
          console.log('✅ Backend noise gate:', enabled ? 'ENABLED' : 'DISABLED');
        } else {
          console.warn('⚠️ WebSocket not ready for noise gate enable');
        }
      };

      // Backend AGC enable/disable
      this.decoder.set_agc_enable = function(enabled) {
        if (this.socket && this.socket.readyState === 1) {
          this.socket.send(JSON.stringify({
            cmd: "agc_enable",
            enabled: enabled
          }));
          console.log('✅ Backend AGC:', enabled ? 'ENABLED' : 'DISABLED');
        } else {
          console.warn('⚠️ WebSocket not ready for AGC enable');
        }
      };

      // ✅ For FLAC: Add JavaScript noise blanker control method
      // Since WASM NB is bypassed, provide alternative control
      this.decoder.set_js_nb = (enabled) => {
        this.nbBlankerEnabled = enabled;
        this.nrEnabled = enabled;
        console.log('✅ JavaScript Noise Blanker:', enabled ? 'ENABLED' : 'DISABLED');
      };

      // Make it easy to enable both blanker and NR together
      this.decoder.enableJavascriptNoiseBlanker = () => {
        this.nbBlankerEnabled = true;
        this.nrEnabled = true;
        console.log('✅ JavaScript Noise Blanker + NR: ENABLED');
      };

      this.decoder.disableJavascriptNoiseBlanker = () => {
        this.nbBlankerEnabled = false;
        this.nrEnabled = false;
        console.log('❌ JavaScript Noise Blanker + NR: DISABLED');
      };

      // Keep the fresh decoder's channel count in sync (mono vs C-QUAM stereo).
      if (typeof this.decoder.setChannels === 'function') {
        this.decoder.setChannels(this.channels || 1);
      }

      console.log('✅ Backend audio control methods initialized');
    }
    // ============================================================================
  }

  // Swap the active decoder to `codec` mid-session, in response to the server
  // changing this client's codec (it does so when C-QUAM is toggled: Opus while
  // stereo is active, the configured default — normally FLAC — otherwise).
  // No-op if the codec is unchanged.  A brief audio gap at the swap is expected.
  switchCodec(codec) {
    const c = (codec === 'opus') ? 'opus' : 'flac';
    if (!this.settings) this.settings = {};
    if (this.settings.audio_compression === c) return;
    if (!this.audioCtx) {
      // Decoder not built yet (pre-initAudio); just record the choice.
      this.settings.audio_compression = c;
      return;
    }
    console.log('[Audio] Runtime codec switch:', this.settings.audio_compression, '→', c);
    // Update settings BEFORE rebuilding: the flac gain-boost path in decode()
    // keys off this.settings.audio_compression, so it must match the new codec.
    this.settings.audio_compression = c;
    this._buildDecoder(c);
  }

  initAudio(settings) {
    const sampleRate = this.audioOutputSps
    try {
      this.audioCtx = new AudioContext({
        sampleRate: sampleRate
      })
    } catch {
      this._clearInitTimeout()
      if (this.resolvePromise) this.resolvePromise()
      this._resetInitPromise()
      return
    }

    this.audioStartTime = this.audioCtx.currentTime
    this.playTime       = this.audioCtx.currentTime + this.bufferThreshold;
    this.playStartTime  = this.audioCtx.currentTime;

    // Build the audio decoder for the negotiated codec.  Factored into
    // _buildDecoder() so the same setup runs when the server swaps this
    // client's codec at runtime (FLAC↔Opus on C-QUAM) — see switchCodec().
    this._buildDecoder(settings.audio_compression)
    // ============================================================================

    // Bass boost (lowshelf filter) – a bit more bass, slightly higher corner
    this.bassBoost = new BiquadFilterNode(this.audioCtx)
    this.bassBoost.type = 'lowshelf'
    this.bassBoost.frequency.value = 120    // was 100
    this.bassBoost.Q.value = 0.8            // was 0.7
    this.bassBoost.gain.value = 8           // was 6 (more bass)

    /* Bandpass (upper mids) – slightly lower center, softer gain
      so the midrange is not so “forward” */
    this.bandpass = new BiquadFilterNode(this.audioCtx)
    this.bandpass.type = 'peaking'
    this.bandpass.frequency.value = 1800    // was 1800
    this.bandpass.Q.value = 1.0             // was 1.2
    this.bandpass.gain.value = 3            // updateFilters() sets 3 for USB/LSB, 2 for AM/FM — constructor value is immediately overridden

    // High-pass filter – let a bit more low end through
    this.highPass = new BiquadFilterNode(this.audioCtx)
    this.highPass.type = 'highpass'
    this.highPass.frequency.value = 45      // was 60
    this.highPass.Q.value = 0.7

    /* Presence boost – move it lower and reduce gain
      so highs are smoother / less sharp */
    this.presenceBoost = new BiquadFilterNode(this.audioCtx)
    this.presenceBoost.type = 'peaking'
    this.presenceBoost.frequency.value = 2200  // was 3500 — 2200Hz sits inside SSB passband where consonant intelligibility lives; updateFilters() overrides per mode
    this.presenceBoost.Q.value = 1.2
    this.presenceBoost.gain.value = 2          // was 4 — updateFilters() overrides this per mode

    // Convolver node for additional filtering
    // Mains hum notch filters — 50 Hz (EU/Asia) and 60 Hz (Americas).
    // Both are always in the graph; each can be enabled/disabled independently
    // via setHumNotch(). Q=10 → ~5 Hz bandwidth at 50 Hz, ~6 Hz at 60 Hz.
    this.humNotch50 = new BiquadFilterNode(this.audioCtx)
    this.humNotch50.type = 'allpass'  // transparent until enabled — allpass = unity gain all freqs
    this.humNotch50.frequency.value = 50
    this.humNotch50.Q.value = 10     // Q=10 → ~5 Hz bandwidth; catches drifting hum, still inaudible in voice
    this.humNotch50Enabled = false    // off by default — sysop enables via setHumNotch()

    this.humNotch60 = new BiquadFilterNode(this.audioCtx)
    this.humNotch60.type = 'allpass'  // transparent until enabled
    this.humNotch60.frequency.value = 60
    this.humNotch60.Q.value = 10     // Q=10 → ~6 Hz bandwidth at 60 Hz
    this.humNotch60Enabled = false

    this.convolverNode = new ConvolverNode(this.audioCtx)
    this.setLowpass(15000)

    // Dynamic compressor — tuned for SSB voice speech processing.
    // Off by default; toggle with setCompressor(true) from the UI.
    this.compressor = new DynamicsCompressorNode(this.audioCtx)
    this.compressor.threshold.value = -30;  // start compressing well below peaks
    this.compressor.knee.value = 10;        // moderate knee for smooth onset
    this.compressor.ratio.value = 4;        // 4:1 — solid SSB speech compression
    this.compressor.attack.value = 0.085;   // fast enough to catch syllables
    this.compressor.release.value = 0.50;   // natural release for voice
    this.compressorEnabled = false          // default OFF

    // Makeup gain — compression lowers the average level, so raise it back
    // here. THIS is the knob to change the compressor's audio level:
    //   > 1.0 louder, < 1.0 quieter.
    this.compressorMakeup = new GainNode(this.audioCtx)
    this.compressorMakeup.gain.value = 0.3   // <-- COMPRESSOR AUDIO LEVEL HERE (0-1 = quieter, >1 = louder)

    // Auto-makeup: when ON, the makeup gain is driven by threshold, knee and
    // ratio, spanning _makeupMin..._makeupMax. Each knob maps to a 0..1 factor
    // (threshold -60 dB→0 .. 0 dB→1; knee 0→0 .. 40→1; ratio 20:1→0 .. 1:1→1);
    // the three factors are averaged and mapped onto the makeup range. ON by
    // default. So threshold/knee up → louder, ratio up → quieter.
    this.autoMakeup = true
    this._makeupMin = 0.3
    this._makeupMax = 1.5
    this._applyAutoMakeup()

    // 5-band graphic equalizer — peaking filters log-spaced 100 Hz .. 10 kHz.
    // Off by default; each band gain is in dB (-12 .. +12), 0 = flat.
    this.eqEnabled = false
    this.eqFreqs = [100, 350, 1000, 2000, 3000, 5000]
    this.eqBands = this.eqFreqs.map((f) => {
      const b = new BiquadFilterNode(this.audioCtx)
      b.type = 'peaking'
      b.frequency.value = f
      b.Q.value = 1.0
      b.gain.value = 0
      return b
    })

    // Gain node
    this.gainNode = new GainNode(this.audioCtx)
    this.setGain(1.0) // was 3.5 — 3.5× on top of 6× = 21× total, still fine
    this._configureAudioLevelMode(this.audioLevelMode || 0)
    this._resetAudioLevelControl()

    // Add MediaStreamDestination node
    this.destinationNode = new MediaStreamAudioDestinationNode(this.audioCtx);

    // Connect nodes in the correct order
    this.convolverNode.connect(this.highPass)
    this.highPass.connect(this.bandpass)
    this.bandpass.connect(this.bassBoost)
    this.bassBoost.connect(this.presenceBoost)
    this.presenceBoost.connect(this.humNotch50)
    this.humNotch50.connect(this.humNotch60)
    // Output chain from humNotch60 -> [EQ] -> [compressor] -> gainNode is
    // built dynamically. Both EQ and compressor are OFF by default and are
    // always bypassed for digital modes (see _rebuildOutputChain).
    this._rebuildOutputChain()
    this.gainNode.connect(this.destinationNode);
    this.gainNode.connect(this.audioCtx.destination)

    // RADE decoded-audio gain node.
    // Change ONLY the next line to trim recorded demodulated RADE audio:
    // lower value = quieter recording, higher value = louder recording.
    this.radeGainNode = new GainNode(this.audioCtx)
    this.radeGainNode.gain.value = 0.20 // <-- TRIM RADE RECORDED AUDIO LEVEL HERE
    this.radeGainNode.connect(this.gainNode)

    this.audioInputNode = this.convolverNode

    // Initial filter update based on current demodulation
    this.updateFilters()

    this._clearInitTimeout()
    if (this.resolvePromise) this.resolvePromise(settings)
    this._resetInitPromise()
  }

  updateFilters() {
    switch (this.demodulation) {
      case 'USB':
      case 'LSB':
      case 'CW':
        this.bassBoost.gain.value = 12
        this.bandpass.frequency.value = 1800
        this.bandpass.Q.value = 1.0              // was 1.2 — wider peak, less forward midrange
        this.bandpass.gain.value = 3
        this.highPass.frequency.value = 60
        this.presenceBoost.frequency.value = 2200 // was 3500 — inside passband, consonant band; 3500 was above FIR cutoff
        this.presenceBoost.gain.value = 2         // was 4 — softer boost; 4dB at 3500Hz was boosting filter skirt noise
        this.setLowpass(3000)
        break
      case 'AM':
        this.bassBoost.gain.value = 20
        this.bandpass.frequency.value = 1500
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 2
        this.highPass.frequency.value = 50
        this.presenceBoost.frequency.value = 2200 // explicit — don't inherit from previous mode
        this.presenceBoost.gain.value = 3
        this.setLowpass(4500)
        break
      case 'AM-S':
        // C-QUAM AM stereo carries full-fidelity music, so mono-AM's heavy 20 dB
        // low-shelf is boomy here.  Previously there was NO 'AM-S' case, so
        // C-QUAM silently inherited the previous mode's bass (usually AM's 20 dB).
        // Lighter shelf + slightly wider top end for a balanced stereo sound.
        this.bassBoost.gain.value = 8            // was inheriting 20 dB → too much bass
        this.bandpass.frequency.value = 1500
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 1
        this.highPass.frequency.value = 60       // trims subsonic rumble/boom
        this.presenceBoost.frequency.value = 2200
        this.presenceBoost.gain.value = 2
        this.setLowpass(5000)                    // a touch more air than mono AM (4500)
        break
      case 'FM':
        // Was 40dB — a 100x voltage gain on a lowshelf, with the compressor
        // downstream only doing a gentle 1.8:1 ratio above -4dB. That's
        // nowhere near enough to act as a limiter against a boost that
        // large; any real low-frequency content in FM audio would push the
        // output well past 0dBFS and hard-clip at the Web Audio
        // destination. 26dB keeps FM as the most bass-forward of the three
        // modes (above AM's 23, SSB's 15) while staying inside what this
        // compressor can actually control without audible clipping.
        this.bassBoost.gain.value = 26
        this.bandpass.frequency.value = 2400
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 2
        this.highPass.frequency.value = this.ctcss ? 35 : 100
        this.presenceBoost.frequency.value = 2200 // explicit — don't inherit from previous mode
        this.presenceBoost.gain.value = 3
        this.setLowpass(4800)
        break
    }
    // If a hum notch is active, keep highpass at 35 Hz regardless of mode
    // default — a mode switch must not silently undo the notch effectiveness
    // by pre-attenuating 50/60 Hz before it reaches the notch filter.
    if ((this.humNotch50Enabled || this.humNotch60Enabled) && this.highPass) {
      this.highPass.frequency.value = 35;
    }
  }


  setFIRFilter(fir) {
    const firAudioBuffer = new AudioBuffer({ length: fir.length, numberOfChannels: 1, sampleRate: this.audioOutputSps })
    firAudioBuffer.copyToChannel(fir, 0, 0)
    this.convolverNode.buffer = firAudioBuffer
  }

  setLowpass(lowpass, transitionWidth = 400) {
    const sampleRate = this.audioOutputSps
    // Bypass the FIR filter if the sample rate is low enough
    if (lowpass >= sampleRate / 2) {
      this.setFIRFilter(Float32Array.of(1))
      return
    }
    // transitionWidth was hardcoded at 1000 Hz — a gentle roll-off that lets
    // noise well above the nominal cutoff leak through before being
    // attenuated. 400 Hz gives a much sharper transition at the SAME
    // cutoff frequencies already set per mode, purely via a longer linear
    // FIR filter — no adaptive/gating behavior, so no pumping or musical
    // noise, just less out-of-band noise getting through to begin with.
    const fir = firdes_kaiser_lowpass(lowpass / sampleRate, transitionWidth / sampleRate, 0.001)
    this.setFIRFilter(fir)
  }


  // Audio Buffer Delay function that sets the new values for //
  // bufferLimit and bufferThreshold //
  setAudioBufferDelay(newAudioBufferLimit, newAudioBufferThreshold) {
  // Validate inputs
  if (typeof newAudioBufferLimit !== 'number' || typeof newAudioBufferThreshold !== 'number') {
    console.warn('Invalid buffer delay parameters, using defaults');
    this.bufferLimit = 0.15;
    this.bufferThreshold = 0.01;
    return;
  }
  
  // Ensure threshold is less than limit
  if (newAudioBufferThreshold >= newAudioBufferLimit) {
    console.warn('Threshold must be less than limit, adjusting automatically');
    newAudioBufferThreshold = newAudioBufferLimit * 0.5;
  }
  
  // Clamp to reasonable ranges (20ms to 5 seconds)
  this.bufferThreshold = Math.max(0.02, Math.min(5.0, newAudioBufferThreshold));
  this.bufferLimit = Math.max(0.02, Math.min(5.0, newAudioBufferLimit));
  
  console.log(`Audio buffer delay updated: threshold=${this.bufferThreshold.toFixed(3)}s, limit=${this.bufferLimit.toFixed(3)}s`);
}

  setFT8Decoding(value) {
    this.decodeFT8 = value;
    if (value) this._ftxSetActiveMode('FT8');
    if (value) {
      // ✅ FIXED: Reset farthest-distance counter and label on each new session
      this.farthestDistance = 0;
      const el = document.getElementById('farthest-distance');
      if (el) el.textContent = 'Farthest: 0 km';
    }
  }

  setFT4Decoding(value) {
    this.decodeFT4 = value;
    if (value) this._ftxSetActiveMode('FT4');
    this._rebuildOutputChain();
    if (value) {
      // ✅ FIXED: Reset farthest-distance counter and label on each new session
      this.farthestDistance = 0;
      const el = document.getElementById('farthest-distance');
      if (el) el.textContent = 'Farthest: 0 km';
    } else {
      this.isFT4Collecting = false;
      this.ft4AccumulatorLen = 0;
    }
  }

  setFT2Decoding(value) {
    this.decodeFT2 = value;
    if (value) this._ftxSetActiveMode('FT2');
    if (!value) {
      this.isFT2Collecting = false;
      this.ft2AccumulatorLen = 0;
    }
  }

  setNoiseGatePreset(preset) {
    const validPresets = ['balanced', 'aggressive', 'weak-signal', 'smooth', 'maximum', 'cw', 'am-fm'];
    if (validPresets.includes(preset)) {
      this.noiseGatePreset = preset;
      //console.log('Noise gate preset set to:', preset);
    } else {
      console.warn('Invalid noise gate preset. Valid options:', validPresets.join(', '));
      console.log('Current preset remains:', this.noiseGatePreset);
    }
  }


  setFmDeemph(tau) {
    if (tau === 0) {
      this.audioInputNode = this.convolverNode
      return
    }
    // FM deemph https://github.com/gnuradio/gnuradio/blob/master/gr-analog/python/analog/fm_emph.py
    // Digital corner frequency
    const wc = 1.0 / tau
    const fs = this.audioOutputSps

    // Prewarped analog corner frequency
    const wca = 2.0 * fs * Math.tan(wc / (2.0 * fs))

    // Resulting digital pole, zero, and gain term from the bilinear
    // transformation of H(s) = w_ca / (s + w_ca) to
    // H(z) = b0 (1 - z1 z^-1)/(1 - p1 z^-1)
    const k = -wca / (2.0 * fs)
    const z1 = -1.0
    const p1 = (1.0 + k) / (1.0 - k)
    const b0 = -k / (1.0 - k)

    const feedForwardTaps = [b0 * 1.0, b0 * -z1]
    const feedBackwardTaps = [1.0, -p1]

    // Disconnect any previously created de-emphasis node before creating the
    // new one.  Without this, every call to setFmDeemph() leaves the old
    // IIRFilterNode connected to this.convolverNode in parallel with the new
    // one, doubling the signal and creating a comb-filter artefact.
    if (this.fmDeemphNode) {
      try { this.fmDeemphNode.disconnect(); } catch (_) {}
      this.fmDeemphNode = null;
    }

    this.fmDeemphNode = new IIRFilterNode(this.audioCtx, { feedforward: feedForwardTaps, feedback: feedBackwardTaps })
    this.fmDeemphNode.connect(this.convolverNode)

    this.audioInputNode = this.fmDeemphNode
  }

  socketMessageInitial(event) {
    // first message gives the parameters in json.
    // Guard: if an audio (binary) frame ever races ahead of the settings text
    // frame, event.data is an ArrayBuffer/Blob, not a string. Such frames are
    // undecodable before settings arrive anyway — skip them and keep waiting
    // for the JSON settings rather than tearing down the socket (no sound).
    if (typeof event.data !== 'string') {
      return
    }
    let settings;
    try {
      settings = JSON.parse(event.data)
    } catch (e) {
      console.error('[Audio] socketMessageInitial: expected JSON settings, got:', typeof event.data, e)
      this._handleSocketTerminal('bad-settings')
      return
    }
    this.settings = settings
    this.fftSize = settings.fft_size
    this.audioMaxSize = settings.fft_result_size
    this.baseFreq = settings.basefreq
    this.totalBandwidth = settings.total_bandwidth
    this.sps = settings.sps
    // BUG FIX (NaN propagation): settings.fft_overlap is NOT sent by the C++
    // server's send_basic_info() (websocket.cpp).  Reading it gives undefined,
    // and undefined / 2 === NaN, silently poisoning any downstream arithmetic.
    // Default to 0 when the field is absent.
    this.audioOverlap = (settings.fft_overlap ?? 0) / 2
    this.audioMaxSps = settings.audio_max_sps
    this.grid_locator = settings.grid_locator
    this.smeter_offset = settings.smeter_offset
    this.analog_smeter_offset = settings.analog_smeter_offset ?? 0
    // Our own signal-protocol UUID, sent by the C++ server (websocket.cpp).
    // Same key used in /users and events-socket signal_changes, so the UI can
    // identify its own waterfall pill exactly instead of guessing by frequency.
    this.clientId = settings.client_id ?? null

    this.audioL = settings.defaults.l
    this.audioM = settings.defaults.m
    this.audioR = settings.defaults.r

    const targetFFTBins = Math.ceil(this.audioMaxSps * this.audioMaxSize / this.sps / 4) * 4

    this.trueAudioSps = targetFFTBins / this.audioMaxSize * this.sps
    this.audioOutputSps = Math.min(this.audioMaxSps, 96000)

    // Reinitialise the decoder accumulators now that audioOutputSps is known.
    // The constructor sizes them at 12 kHz, which truncates the collection
    // window at any higher audio_sps (WSPR needs 119 s; the FTx buffers must
    // hold a full slot_period - 0.4 s or the slot never reaches decode).
    this._initAccumulators();

    this._clearInitTimeout()
    this.audioSocket.onmessage = this.socketMessage.bind(this)
    this.audioSocket.onerror = (evt) => this._handleSocketTerminal('error', evt)
    this.audioSocket.onclose = (evt) => this._handleSocketTerminal('close', evt)

    this.initAudio(settings)

    console.log('Audio Samplerate: ', this.trueAudioSps)
  }

  socketMessage(event) {
    if (event.data instanceof ArrayBuffer) {
      const packet = cbor_decode(new Uint8Array(event.data))
      
      // ✅ ADDED: Track channel count for C-QUAM stereo
      this.channels = packet.channels || 1;

      // Mono SAM (AM) PLL lock state — drives the AM button "SAM" indicator.
      this.samLocked = !!packet.sam_locked;

      // Runtime codec switch: the server tags each audio packet with the codec
      // that produced it (see audio.cpp).  When it changes — e.g. FLAC→Opus as
      // C-QUAM is enabled — rebuild the decoder BEFORE decoding this packet so
      // the new decoder matches the new frames.
      let wantCodec = packet.codec;
      // Defensive guard: if Opus is disabled in this build the server should
      // already keep us on FLAC (it honors our codec_caps).  Should an Opus
      // packet still slip through (e.g. an old server), never spin up the
      // disabled Opus decoder — treat it as FLAC so we fail safe, not silent.
      if (!OPUS_ENABLED && wantCodec === 'opus') {
        console.warn('[Audio] Opus disabled locally but server sent opus; forcing flac');
        wantCodec = 'flac';
      }
      if (wantCodec && this.settings && wantCodec !== this.settings.audio_compression) {
        this.switchCodec(wantCodec);
      }

      if (this.decoder && this.decoder.setChannels) {
        this.decoder.setChannels(this.channels);
      }
      
      const receivedPower = packet.pwr;
      this.power = 0.5 * this.power + 0.5 * receivedPower || 1;
      const dBpower = 20 * Math.log10(Math.sqrt(this.power) / 2);
      if (this.squelch && dBpower < this.squelchThreshold) {
        this.squelchMute = true;
      } else {
        this.squelchMute = false;
      }

      // Capture scheduled play time BEFORE decode() advances this.playTime.
      // getPowerDb() will only release this value once audioCtx.currentTime
      // reaches it, so the S-meter tracks the audio instead of leading it.
      if (this.audioCtx && this.audioCtx.state === 'running' && this.playTime) {
        this._dBQueue.push({ playAt: this.playTime, value: dBpower });
        // Cap queue: when AudioContext is suspended (background tab, autoplay policy)
        // currentTime freezes so nothing drains, causing unbounded GC pressure that
        // eventually stalls the event loop and backs up the server's send path.
        if (this._dBQueue.length > 300) this._dBQueue.splice(0, this._dBQueue.length - 300);
      } else {
        this.dBPower = dBpower;
      }

      this.decode(packet.data);
    }
  }

  decode(encoded) {
    // Audio not available
    if (!this.audioCtx) {
      return
    }
    let pcmArray = this.decoder.decode(encoded)
    // More samples needed
    if (pcmArray.length === 0) {
      return
    }

    // ✅ FIX: WASM FLAC decoder may return object with channelData for stereo
    // Handle both formats: object (stereo) or flat array (mono or already interleaved)
    if (pcmArray.channelData && this.channels === 2) {
      // FLAC stereo: decoder returns {channelData: [L_array, R_array]}
      // Interleave manually
      const L = pcmArray.channelData[0] || new Float32Array(0)
      const R = pcmArray.channelData[1] || new Float32Array(0)
      const len = Math.min(L.length, R.length)
      const interleaved = new Float32Array(len * 2)
      for (let i = 0; i < len; i++) {
        interleaved[i * 2] = L[i]
        interleaved[i * 2 + 1] = R[i]
      }
      pcmArray = interleaved
      if (!this._flacStereoLogged) { console.log('[FLAC Stereo] Interleaved channelData:', len, 'frames'); this._flacStereoLogged = true; }
    }

    this.intervals = this.intervals || createWindow(10000, 0)
    this.lens = this.lens || createWindow(10000, 0)
    this.lastReceived = this.lastReceived || 0
    // For checking sample rate
    if (this.lastReceived === 0) {
      this.lastReceived = performance.now()
    } else {
      const curReceived = performance.now()
      const delay = curReceived - this.lastReceived
      this.intervals.push(delay)
      this.lastReceived = curReceived
      this.lens.push(pcmArray.length)

      let updatedv = true

      if (this.mode === 0) {
        if (Math.abs(delay - this.n1) > Math.abs(this.v) * 2 + 800) {
          this.var = 0
          this.mode = 1
        }
      } else {
        this.var = this.var / 2 + Math.abs((2 * delay - this.n1 - this.n2) / 8)
        if (this.var <= 63) {
          this.mode = 0
          updatedv = false
        }
      }

      if (updatedv) {
        if (this.mode === 0) {
          this.d = 0.125 * delay + 0.875 * this.d
        } else {
          this.d = this.d + delay - this.n1
        }
        this.v = 0.125 * Math.abs(delay - this.d) + 0.875 * this.v
      }

      this.n2 = this.n1
      this.n1 = delay
    }

    this.pcmArray = pcmArray

    // C-QUAM 25 Hz stereo-pilot detection.  Only meaningful in stereo (QUAM):
    // pcmArray is interleaved [L0,R0,L1,R1,...] here.  A genuine C-QUAM
    // transmission carries a 25 Hz pilot in the L−R difference channel; mono AM
    // does not.  Drives the QUAM button's green indicator in the UI.
    if (this.channels === 2) {
      this._updateCquamPilot(pcmArray, this.audioOutputSps || 12000)
    } else if (this.cquamPilotDetected || this._pilot) {
      this.cquamPilotDetected = false
      this._pilot = null   // reset detector state so it re-locks next time
    }

    // Save original (pre-boost) PCM specifically for RADE.
    // The 300x FLAC gain boost is needed by the speaker pipeline and by
    // all other decoders (which are calibrated to ~256 amplitude).
    // RADE must receive the original unmodified amplitude — the boost would
    // saturate radae_rxe.py and destroy sync acquisition.
    const pcmArrayPreBoost = pcmArray;

    // ✅ FLAC 16-bit gain boost: pipeline is calibrated for 8-bit amplitude (~256).
    // 16-bit FLAC decoder outputs amplitude ~1.0 → 256× too quiet → silence.
    if (this.settings && this.settings.audio_compression === 'flac') {
      const flacGain = 175.0
      const boosted = new Float32Array(pcmArray.length)
      for (let i = 0; i < pcmArray.length; i++) boosted[i] = pcmArray[i] * flacGain
      pcmArray = boosted
    }

    if (this.signalDecoder) {
      this.signalDecoder.decode(pcmArray)
    }

    // FAX always uses rawPcm (the shared, properly band-limited 12 kHz stream)
    // regardless of codec.  The old Opus native-PCM override (48 kHz without
    // anti-aliasing) corrupted the FM phase discriminator and prevented phasing
    // calibration.  FLAC and Opus now follow the identical path here.
    this.playAudio(pcmArray, pcmArrayPreBoost)
  }

  // True while a C-QUAM 25 Hz stereo pilot is being detected on the current
  // (stereo) audio.  Read by the UI to light the QUAM button green.
  getCquamPilotDetected() {
    return !!this.cquamPilotDetected
  }

  // True while mono SAM (AM) has PLL lock.  Read by the UI to show "SAM" in red
  // on the AM button.
  getSamLocked() {
    return !!this.samLocked
  }

  // Detect the 25 Hz C-QUAM stereo pilot in the L−R difference of an interleaved
  // stereo block, using block Goertzels.  The pilot bin (25 Hz) is compared to
  // two off-pilot reference bins (45 & 70 Hz); a real pilot stands well above
  // them, whereas mono/noise leaves all bins comparable.  A smoothed ratio with
  // hysteresis drives this.cquamPilotDetected.  Thresholds are conservative and
  // may want field tuning on weak HF signals (see ON/OFF below).
  _updateCquamPilot(interleaved, fs) {
    if (!interleaved || interleaved.length < 4 || !fs) return

    let p = this._pilot
    if (!p || p.fs !== fs) {
      const w = (f) => 2 * Math.cos((2 * Math.PI * f) / fs)
      p = this._pilot = {
        fs,
        N: Math.max(1024, Math.round(fs * 0.5)), // ~0.5 s integration window
        n: 0,
        coeffP: w(25), coeffA: w(45), coeffB: w(70),
        sP1: 0, sP2: 0, sA1: 0, sA2: 0, sB1: 0, sB2: 0,
        ratioEMA: 0,
      }
    }

    for (let i = 0; i + 1 < interleaved.length; i += 2) {
      const d = interleaved[i] - interleaved[i + 1] // L − R
      let s = d + p.coeffP * p.sP1 - p.sP2; p.sP2 = p.sP1; p.sP1 = s
      s = d + p.coeffA * p.sA1 - p.sA2; p.sA2 = p.sA1; p.sA1 = s
      s = d + p.coeffB * p.sB1 - p.sB2; p.sB2 = p.sB1; p.sB1 = s

      if (++p.n >= p.N) {
        const powP = p.sP1 * p.sP1 + p.sP2 * p.sP2 - p.coeffP * p.sP1 * p.sP2
        const powA = p.sA1 * p.sA1 + p.sA2 * p.sA2 - p.coeffA * p.sA1 * p.sA2
        const powB = p.sB1 * p.sB1 + p.sB2 * p.sB2 - p.coeffB * p.sB1 * p.sB2
        const ref = 0.5 * (powA + powB) + 1e-12
        const ratio = powP / ref

        // Smooth to reject momentary spikes, then apply hysteresis.
        p.ratioEMA = 0.6 * p.ratioEMA + 0.4 * ratio
        const ON = 6.0, OFF = 3.0 // pilot must be ~6× the neighbour bins to lock
        if (p.ratioEMA >= ON) this.cquamPilotDetected = true
        else if (p.ratioEMA <= OFF) this.cquamPilotDetected = false
        this.cquamPilotRatio = p.ratioEMA // exposed for debugging/tuning

        // Reset accumulators for the next block.
        p.n = 0
        p.sP1 = p.sP2 = p.sA1 = p.sA2 = p.sB1 = p.sB2 = 0
      }
    }
  }

  updateAudioParams() {
    if (this.demodulation == "CW") {
      this._safeSend({
        cmd: 'window',
        l: this.audioLOffset,
        m: this.audioMOffset,
        r: this.audioROffset
      })
    } else {
      this._safeSend({
        cmd: 'window',
        l: this.audioL,
        m: this.audioM,
        r: this.audioR
      })
    }

  }

  setAudioDemodulation(demodulation) {

    // ✅ ADDED: Normalize AM stereo labels to "AM-S" for C-QUAM
    const d0 = String(demodulation || '').trim();
    const dUpper = d0.toUpperCase();
    let backendDemod = null; // overrides the wire value without changing this.demodulation

    if (
      dUpper === 'CQUAM' ||
      dUpper === 'AM-S' ||
      dUpper === 'AM S' ||
      dUpper === 'AMST' ||
      dUpper === 'AM ST' ||
      dUpper === 'AM STEREO' ||
      dUpper === 'AM-STEREO' ||
      dUpper === 'AM_STEREO' ||
      dUpper === 'QUAM'
    ) {
      demodulation = 'AM-S';
      console.log('[C-QUAM] Stereo mode activated:', d0, '→ AM-S');
    } else if (dUpper === 'AM-ENV' || dUpper === 'AMENV' || dUpper === 'AM ENV') {
      // Envelope (non-synchronous) AM. Internally it stays plain 'AM' so all
      // filter/UI logic is unchanged; only the backend is told 'AM-ENV'.
      demodulation = 'AM';
      backendDemod = 'AM-ENV';
    } else {
      demodulation = d0;
    }

    this.demodulation = demodulation
    this._resetCTCSSState(this._ctcssEnabled && this.demodulation === 'FM');
    // ANF weights trained for one mode can corrupt another — reset on mode switch
    if (this.anfEnabled) this.resetAutoNotch();
    if (this.bnEnabled) this.resetBackgroundNoise();
    if (demodulation == "CW") {
      demodulation = "USB"
    }
    this.updateFilters()
    this._safeSend({
      cmd: 'demodulation',
      demodulation: backendDemod || demodulation
    })
  }

  setAudioRange(audioL, audioM, audioR, audioLOffset, audioMOffset, audioROffset) {
    // Retuning means the old floor measurement describes noise at a
    // different frequency — same reasoning as the ANF reset on mode switch
    // above, just triggered by frequency instead of demodulation.
    if (this.bnEnabled) this.resetBackgroundNoise();
    this.audioL = Math.floor(audioL);
    this.audioM = audioM;
    this.audioR = Math.ceil(audioR);
    this.actualL = audioL;
    this.actualR = audioR;

    this.audioLOffset = Math.floor(audioLOffset);
    this.audioMOffset = audioMOffset;
    this.audioROffset = Math.ceil(audioROffset);
    this.actualLOffset = audioLOffset;
    this.actualROffset = audioROffset;


    this.updateAudioParams();
  }

  getAudioRange() {
    return [this.actualL, this.audioM, this.actualR]
  }

  // Our own signal-protocol UUID, sent by the server in the initial settings.
  // Used to identify our own waterfall pill exactly (see updateTick in App).
  getClientId() {
    return this.clientId ?? null
  }

  setAudioOptions(options) {
    this.audioOptions = options
    this._safeSend({
      cmd: 'options',
      options: options
    })
  }


_resetCTCSSState(closeGate = false) {
  this._ctcssDetectFill = 0;
  this._ctcssHpState = 0;
  this._ctcssHpPrevIn = 0;
  this._ctcssLpState = 0;
  this._ctcssLastOpenMs = 0;
  this._ctcssDetectedToneHz = null;
  this._ctcssConsecutive = 0;
  this.ctcssMute = !!closeGate;
}

_normalizeCTCSSSelection(ctcss) {
  if (ctcss === false || ctcss === null || typeof ctcss === 'undefined') {
    return { enabled: false, toneHz: null };
  }
  if (ctcss === true) {
    return { enabled: true, toneHz: null };
  }
  if (typeof ctcss === 'number' && isFinite(ctcss) && ctcss > 0) {
    return { enabled: true, toneHz: ctcss };
  }
  if (typeof ctcss === 'string') {
    const trimmed = ctcss.trim().toLowerCase();
    if (!trimmed || trimmed === 'off' || trimmed === 'false' || trimmed === 'none') {
      return { enabled: false, toneHz: null };
    }
    if (trimmed === 'on' || trimmed === 'true' || trimmed === 'any') {
      return { enabled: true, toneHz: null };
    }
    const parsed = parseFloat(trimmed);
    if (isFinite(parsed) && parsed > 0) {
      return { enabled: true, toneHz: parsed };
    }
  }
  if (typeof ctcss === 'object') {
    const enabled = ctcss.enabled !== false;
    const parsed = parseFloat(ctcss.tone ?? ctcss.toneHz ?? ctcss.frequency ?? ctcss.freq);
    return { enabled, toneHz: (isFinite(parsed) && parsed > 0) ? parsed : null };
  }
  return { enabled: !!ctcss, toneHz: null };
}

_nearestCTCSSTone(targetHz) {
  if (!(targetHz > 0)) return null;
  let best = null;
  let bestErr = Infinity;
  for (const tone of this._ctcssStdTones) {
    const err = Math.abs(tone - targetHz);
    if (err < bestErr) {
      bestErr = err;
      best = tone;
    }
  }
  return best;
}

_goertzelPower(samples, targetHz, sampleRate) {
  const n = samples.length;
  if (!n || !(targetHz > 0) || !(sampleRate > 0)) return 0;
  const omega = (2 * Math.PI * targetHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

_analyzeCTCSSWindow(windowSamples, sampleRate) {
  const n = windowSamples.length;
  if (!n || !(sampleRate > 0)) return null;

  const prepared = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += windowSamples[i];
  mean /= n;

  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
    const v = (windowSamples[i] - mean) * w;
    prepared[i] = v;
    sumSq += v * v;
  }

  const rms = Math.sqrt(sumSq / n);
  if (!(rms > this._ctcssMinRms)) return null;

  const tones = (this.ctcssToneHz && this.ctcssToneHz > 0)
    ? [this._nearestCTCSSTone(this.ctcssToneHz)].filter(Boolean)
    : this._ctcssStdTones;

  let bestTone = null;
  let bestPower = 0;
  let secondPower = 0;

  for (const tone of tones) {
    const power = this._goertzelPower(prepared, tone, sampleRate);
    if (power > bestPower) {
      secondPower = bestPower;
      bestPower = power;
      bestTone = tone;
    } else if (power > secondPower) {
      secondPower = power;
    }
  }

  if (!bestTone || !(bestPower > 0)) return null;

  // Separation: compare best CTCSS tone against the second-best standard tone.
  // ±Hz Goertzel neighbor checks are intentionally omitted: at any realistic
  // window length they fall inside the Hamming mainlobe (half-width ≈ 2 bins)
  // and produce near-peak power, making the ratio meaningless and suppressing
  // every valid detection. secondPower is the correct discriminator — it
  // measures whether a single tone dominates over all other CTCSS candidates.
  // Requires _ctcssDetectBuffer ≥ 4096 samples so the 2.93 Hz/bin resolution
  // can actually distinguish adjacent CTCSS pairs (closest gap: 2.4 Hz).
  const neighborPower = secondPower;

  const confidence = bestPower / Math.max(sumSq, 1e-12);
  const separation  = bestPower / Math.max(neighborPower, 1e-12);
  const toneErr = this.ctcssToneHz ? Math.abs(bestTone - this.ctcssToneHz) : 0;
  const toneTol = this.ctcssToneHz ? Math.max(1.5, this.ctcssToneHz * 0.015) : Infinity;

  if (confidence < this._ctcssDetectThreshold) return null;
  if (separation < this._ctcssNeighborReject) return null;
  if (toneErr > toneTol) return null;

  return { toneHz: bestTone, confidence, separation, rms };
}

_updateCTCSSGate(rawPcm) {
  if (!this._ctcssEnabled || this.demodulation !== 'FM' || this.channels !== 1) {
    this.ctcssMute = false;
    return;
  }

  if (!(rawPcm && rawPcm.length)) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.ctcssMute = (now - this._ctcssLastOpenMs) > this._ctcssHoldMs;
    return;
  }

  const sampleRate = this.audioOutputSps || this.trueAudioSps || this.audioMaxSps || 12000;
  const hpCut = 55;
  const lpCut = 300;
  const hpAlpha = sampleRate > 0 ? Math.exp(-2 * Math.PI * hpCut / sampleRate) : 0.97;
  const lpAlpha = sampleRate > 0 ? Math.exp(-2 * Math.PI * lpCut / sampleRate) : 0.85;
  const detectBuf = this._ctcssDetectBuffer;
  let fill = this._ctcssDetectFill;
  let hpState = this._ctcssHpState;
  let hpPrevIn = this._ctcssHpPrevIn;
  let lpState = this._ctcssLpState;

  for (let i = 0; i < rawPcm.length; i++) {
    const x = rawPcm[i];
    hpState = hpAlpha * (hpState + x - hpPrevIn);
    hpPrevIn = x;
    lpState = lpState + (1 - lpAlpha) * (hpState - lpState);
    detectBuf[fill++] = lpState;

    if (fill >= detectBuf.length) {
      const result = this._analyzeCTCSSWindow(detectBuf, sampleRate);
      if (result) {
        // Require _ctcssOpenCount consecutive detections before opening the gate.
        // Prevents a single noise window from briefly unmuting the speaker.
        this._ctcssConsecutive = (this._ctcssConsecutive || 0) + 1;
        if (this._ctcssConsecutive >= this._ctcssOpenCount) {
          const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          this._ctcssLastOpenMs = now;
          this._ctcssDetectedToneHz = result.toneHz;
        }
      } else {
        // Miss: reset streak. One failed window re-arms the false-positive guard.
        this._ctcssConsecutive = 0;
      }
      fill = 0;
    }
  }

  this._ctcssDetectFill = fill;
  this._ctcssHpState = hpState;
  this._ctcssHpPrevIn = hpPrevIn;
  this._ctcssLpState = lpState;

  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  this.ctcssMute = (now - this._ctcssLastOpenMs) > this._ctcssHoldMs;
}

  setGain(gain) {
    gain /= 30;
    this.userGain = gain;
    this._applyOutputGain();
  }

  // True when any digital decoder is active — compressor and EQ must never
  // colour the audio for digital modes.
  _isDigitalActive() {
    return !!(this.decodeFT4 || this.decodeCW || this.decodeSSTV || this.decodeRADE);
  }

  // (Re)build the output chain from humNotch60 -> gainNode, inserting the EQ
  // and/or compressor only when they are enabled AND no digital mode is active.
  _rebuildOutputChain() {
    if (!this.humNotch60 || !this.gainNode) return;
    const digital = this._isDigitalActive();
    const useEq   = this.eqEnabled && !digital;
    const useComp = this.compressorEnabled && !digital;

    // Tear down every possible link from humNotch60 downstream.
    try { this.humNotch60.disconnect(); } catch (e) {}
    try { this.compressor.disconnect(); } catch (e) {}
    try { this.compressorMakeup.disconnect(); } catch (e) {}
    if (this.eqBands) {
      for (const b of this.eqBands) { try { b.disconnect(); } catch (e) {} }
    }

    let cursor = this.humNotch60;
    if (useEq && this.eqBands) {
      for (const b of this.eqBands) { cursor.connect(b); cursor = b; }
    }
    if (useComp) {
      cursor.connect(this.compressor);
      this.compressor.connect(this.compressorMakeup);
      cursor = this.compressorMakeup;
    }
    cursor.connect(this.gainNode);
  }

  // Toggle the SSB dynamic compressor in/out of the audio chain.
  setCompressor(enabled) {
    this.compressorEnabled = !!enabled;
    this._rebuildOutputChain();
  }

  // ── Compressor parameter regulators (used by the Compressor popup) ──
  // Auto-makeup gain, spanning _makeupMin.._makeupMax. Each knob maps to a
  // 0..1 factor; the three factors are averaged and mapped onto the makeup
  // range, so all knobs at their "loud" ends → _makeupMax, all at their "quiet"
  // ends → _makeupMin. The 0-factor anchors are set at the Reset/startup
  // defaults so that operating point evaluates to exactly _makeupMin (0.3);
  // the user's quiet endpoints (threshold -60, knee 0, ratio 20:1) sit past the
  // anchors and clamp to 0.3, and the loud endpoints reach _makeupMax (1.5).
  _computeAutoMakeup() {
    if (!this.compressor) return this._makeupMin;
    // Fractional position of v between anchors v0 (→0) and v1 (→1), clamped.
    const norm = (v, v0, v1) =>
      v1 === v0 ? 0 : Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
    const fThr   = norm(this.compressor.threshold.value, -24,  0);  // ≤-24 dB→0, 0 dB→1
    const fKnee  = norm(this.compressor.knee.value,       10, 40);  //  ≤10→0, 40→1
    const fRatio = norm(this.compressor.ratio.value,        4,  1);  //  ≥4:1→0, 1:1→1
    const f = (fThr + fKnee + fRatio) / 3;
    return this._makeupMin + f * (this._makeupMax - this._makeupMin);
  }
  // When auto-makeup is on, recompute and apply the makeup gain. Returns the
  // effective linear makeup gain so the UI can reflect it.
  _applyAutoMakeup() {
    if (!this.compressorMakeup) return null;
    if (!this.autoMakeup) return this.compressorMakeup.gain.value;
    const g = this._computeAutoMakeup();
    this.compressorMakeup.gain.value = g;
    return g;
  }
  // threshold: dB (-100..0) — level above which compression starts
  setCompressorThreshold(db) {
    if (!this.compressor) return;
    this.compressor.threshold.value = Math.max(-100, Math.min(0, Number(db) || 0));
    this._applyAutoMakeup();
  }
  // knee: dB (0..40) — how gradual the onset of compression is
  setCompressorKnee(db) {
    if (!this.compressor) return;
    this.compressor.knee.value = Math.max(0, Math.min(40, Number(db) || 0));
    this._applyAutoMakeup();
  }
  // ratio: :1 (1..20) — amount of gain reduction above threshold
  setCompressorRatio(ratio) {
    if (!this.compressor) return;
    this.compressor.ratio.value = Math.max(1, Math.min(20, Number(ratio) || 1));
    this._applyAutoMakeup();
  }
  // attack: seconds (0..1) — how fast it clamps down on peaks
  setCompressorAttack(sec) {
    if (!this.compressor) return;
    this.compressor.attack.value = Math.max(0, Math.min(1, Number(sec) || 0));
  }
  // release: seconds (0..1) — how fast it lets go after peaks
  setCompressorRelease(sec) {
    if (!this.compressor) return;
    this.compressor.release.value = Math.max(0, Math.min(1, Number(sec) || 0));
  }
  // makeup: linear gain (0..4) — output level after compression.
  // Manually setting makeup turns auto-makeup OFF (it becomes the live value).
  setCompressorMakeup(gain) {
    if (!this.compressorMakeup) return;
    this.autoMakeup = false;
    this.compressorMakeup.gain.value = Math.max(0, Math.min(4, Number(gain) || 0));
  }
  // Toggle auto-makeup. When enabled, makeup is recomputed from threshold &
  // ratio; returns the effective makeup gain so the UI can display it.
  setCompressorAutoMakeup(enabled) {
    this.autoMakeup = !!enabled;
    return this._applyAutoMakeup();
  }

  // Return current compressor settings so the UI can initialise its controls.
  getCompressorSettings() {
    return {
      enabled:   !!this.compressorEnabled,
      threshold: this.compressor ? this.compressor.threshold.value : -24,
      knee:      this.compressor ? this.compressor.knee.value : 6,
      ratio:     this.compressor ? this.compressor.ratio.value : 4,
      attack:    this.compressor ? this.compressor.attack.value : 0.003,
      release:   this.compressor ? this.compressor.release.value : 0.25,
      makeup:    this.compressorMakeup ? this.compressorMakeup.gain.value : 0.3,
      autoMakeup: !!this.autoMakeup,
    };
  }

  // Enable/disable the 5-band equalizer.
  setEqualizer(enabled) {
    this.eqEnabled = !!enabled;
    this._rebuildOutputChain();
  }

  // Set a single EQ band gain in dB. index 0..4, gainDb typically -12..+12.
  setEqBand(index, gainDb) {
    if (!this.eqBands || index < 0 || index >= this.eqBands.length) return;
    const g = Math.max(-24, Math.min(24, Number(gainDb) || 0));
    this.eqBands[index].gain.value = g;
  }

  // Set all EQ band gains at once from an array of dB values.
  setEqGains(gains) {
    if (!Array.isArray(gains) || !this.eqBands) return;
    for (let i = 0; i < this.eqBands.length && i < gains.length; i++) {
      this.setEqBand(i, gains[i]);
    }
  }

  setMute(mute) {
    if (mute === this.mute) {
      return
    }
    this.mute = mute
    this._safeSend({
      cmd: 'mute',
      mute: mute
    })
  }

  setCTCSSFilter(ctcss) {
    const normalized = this._normalizeCTCSSSelection(ctcss);
    this.ctcss = normalized.enabled;
    this._ctcssEnabled = normalized.enabled;
    this.ctcssToneHz = normalized.toneHz;
    this._resetCTCSSState(normalized.enabled && this.demodulation === 'FM');
    this.updateFilters();
  }

  setSquelch(squelch) {
    this.squelch = squelch
  }

  setSquelchThreshold(squelchThreshold) {
    this.squelchThreshold = squelchThreshold
  }

  // Enable or disable the mains-hum notch filters.
  // freq: 50 | 60 | 'both'
  // enabled: true | false
  // Example: audio.setHumNotch(50, true)   // EU/Asia sysops
  //          audio.setHumNotch(60, true)   // Americas sysops
  //          audio.setHumNotch('both', true)
  setHumNotch(freq, enabled) {
    // Toggle between 'notch' (active) and 'allpass' (transparent bypass).
    if (freq === 50 || freq === 'both') {
      this.humNotch50Enabled = !!enabled;
      if (this.humNotch50) this.humNotch50.type = enabled ? 'notch' : 'allpass';
      console.log('[HumNotch] 50 Hz notch: ' + (enabled ? 'ON' : 'OFF'));
    }
    if (freq === 60 || freq === 'both') {
      this.humNotch60Enabled = !!enabled;
      if (this.humNotch60) this.humNotch60.type = enabled ? 'notch' : 'allpass';
      console.log('[HumNotch] 60 Hz notch: ' + (enabled ? 'ON' : 'OFF'));
    }

    // The highpass filter sits before the notches in the graph. In USB/LSB mode
    // it is set to 60 Hz, which pre-attenuates 50 Hz hum by ~5 dB before the
    // notch even sees it — making the 50 Hz notch largely ineffective.
    // When any notch is active, pull the highpass down to 35 Hz so both 50 Hz
    // and 60 Hz hum pass through with negligible pre-attenuation (<1 dB) and
    // the notch can do its full 30+ dB of rejection. Restore normal cutoff when
    // both notches are off.
    if (this.highPass) {
      const eitherActive = this.humNotch50Enabled || this.humNotch60Enabled;
      if (eitherActive) {
        this.highPass.frequency.value = 35;
        console.log('[HumNotch] Highpass lowered to 35 Hz to allow notch full rejection');
      } else {
        // Restore mode-appropriate cutoff via updateFilters
        this.updateFilters();
        console.log('[HumNotch] Highpass restored to mode default');
      }
    }
  }

  getPowerDb() {
    if (this._dBQueue && this._dBQueue.length && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      let i = 0;
      while (i < this._dBQueue.length && this._dBQueue[i].playAt <= now) {
        this.dBPower = this._dBQueue[i].value;
        i++;
      }
      if (i > 0) {
        this._dBQueue.splice(0, i);
      }
    }
    return this.dBPower;
  }

  setUserID(userID) {
    this._safeSend({
      cmd: 'userid',
      userid: userID
    })
  }

  setSignalDecoder(decoder) {
    this.signalDecoder = decoder
  }

  getSignalDecoder() {
    return this.signalDecoder
  }


  // FT8 Start

  gridSquareToLatLong(gridSquare) {
    const l = gridSquare.toUpperCase();
    let lon = ((l.charCodeAt(0) - 'A'.charCodeAt(0)) * 20) - 180;
    let lat = ((l.charCodeAt(1) - 'A'.charCodeAt(0)) * 10) - 90;

    if (l.length >= 4) {
      lon += ((l.charCodeAt(2) - '0'.charCodeAt(0)) * 2);
      lat += (l.charCodeAt(3) - '0'.charCodeAt(0));
    }

    if (l.length == 6) {
      lon += ((l.charCodeAt(4) - 'A'.charCodeAt(0)) * (5 / 60));
      lat += ((l.charCodeAt(5) - 'A'.charCodeAt(0)) * (2.5 / 60));
      lon += (5 / 120); // center of the square for 6-char grid
      lat += (1.25 / 120); // center of the square for 6-char grid
    } else if (l.length == 4) {
      lon += 1; // center of the square for 4-char grid
      lat += 0.5; // center of the square for 4-char grid
    }

    return [lat, lon];
  }


  initTimer() {
    // ✅ FIXED: Store interval ID for proper cleanup
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    
    // NB: FT8/FT4/FT2 slot boundaries are no longer polled from a timer. They
    // are evaluated on every arriving audio block by _ftxSlotStart(), the way
    // Kiwi's decode_ft8_samples() does it. Browsers coalesce setInterval in
    // background tabs, and a single missed tick used to drop a whole slot.

    // WSPR timer — checks every 500 ms for 2-minute even-UTC-minute slots
    if (this.wsprTimer) clearInterval(this.wsprTimer);
    this.wsprTimer = setInterval(() => {
      this.updateWSPRCollectionStatus();
    }, 500);
  }

  /**
   * One decoded spot, as a row of the FTx grid.
   *
   * Column order is fixed by `.ftx-grid` in the App style blocks and must stay
   * in step with the header row there:
   *
   *     Mode | dB | Hz | DT | Message | Locator | Distance
   *
   * dB and Hz both come from the decoder. The frequency in particular used to
   * be read from an uninitialised field, so it is newly meaningful.
   */
  _ftxRenderSpot(mode, message, baseLocation) {
    const row = document.createElement('div');
    row.classList.add('glass-message', 'ftx-grid', 'p-2', 'rounded-lg', 'text-sm');

    const cell = (classes, text) => {
      const d = document.createElement('div');
      if (classes) d.classList.add(...classes);
      if (text !== undefined) d.textContent = text;
      row.appendChild(d);
      return d;
    };

    cell(['text-green-400', 'font-bold', 'text-xs'], mode);
    cell(['ftx-num', 'text-cyan-300', 'text-xs'],
         Number.isFinite(message.snr)
           ? `${message.snr > 0 ? '+' : ''}${message.snr.toFixed(0)}` : '');
    cell(['ftx-num', 'text-cyan-300', 'text-xs'],
         Number.isFinite(message.freq) ? message.freq.toFixed(0) : '');
    // DT relative to the ideal, so a well-synced client reads ~0.0 here
    // regardless of protocol — the same convention WSJT-X uses.
    const dtRel = Number.isFinite(message.dt)
      ? message.dt - this._ftxDtTarget(mode) : NaN;
    cell(['ftx-num', 'text-xs', Math.abs(dtRel) > 0.5 ? 'text-orange-400' : 'text-gray-400'],
         Number.isFinite(dtRel) ? `${dtRel > 0 ? '+' : ''}${dtRel.toFixed(1)}` : '');
    cell(['ftx-msg'], message.text);

    const locCell  = cell(['text-xs']);
    const distCell = cell(['ftx-num', 'text-xs']);

    // Locator and distance stay empty for messages that carry no grid square
    // (signal reports, RRR/RR73/73, bare CQ) — those are still listed.
    const locators = this.extractGridLocators(message.text);
    if (locators.length > 0) {
      locators.forEach((locator, i) => {
        const link = document.createElement('a');
        link.href = `https://www.levinecentral.com/ham/grid_square.php?&Grid=${locator}&Zoom=13&sm=y`;
        link.classList.add('text-yellow-300', 'hover:underline');
        link.textContent = locator;
        link.target = '_blank';
        if (i > 0) locCell.appendChild(document.createTextNode(', '));
        locCell.appendChild(link);
      });

      const target = this.gridSquareToLatLong(locators[0]);
      const distance = this.calculateDistance(
        baseLocation[0], baseLocation[1], target[0], target[1]);
      distCell.textContent = `${distance.toFixed(0)} km`;

      if (distance > this.farthestDistance) {
        this.farthestDistance = distance;
        const el = document.getElementById('farthest-distance');
        if (el) el.textContent = `Farthest Distance: ${this.farthestDistance.toFixed(2)} km`;
      }
    }

    return row;
  }

  /** Append one slot's spots and keep the list scrolled to the newest. */
  _ftxRenderSpots(mode, decodedMessages) {
    const list = document.getElementById('ft8MessagesList');
    if (!list || !decodedMessages || decodedMessages.length === 0) return;

    const baseLocation = this.gridSquareToLatLong(this.grid_locator);
    for (const message of decodedMessages) {
      list.appendChild(this._ftxRenderSpot(mode, message, baseLocation));
    }
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 500);

    // Marks let the Hz column be read straight off the spectrum.
    this._ftxSpec.marks = decodedMessages
      .filter(m => Number.isFinite(m.freq))
      .map(m => ({ hz: m.freq, snr: m.snr, text: m.text }));
    this._ftxSpec.seq++;

    this._ftxAutoCalibrate(mode, decodedMessages);
  }

  // For FT8
  extractGridLocators(message) {
    // Regular expression for matching grid locators
    const regex = /[A-R]{2}[0-9]{2}([A-X]{2})?/gi;

    // Find matches in the provided message
    const matches = message.match(regex);

    // Ensure unique matches, as the same locator might appear more than once
    const uniqueLocators = matches ? Array.from(new Set(matches)) : [];

    return uniqueLocators;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    function toRad(x) {
      return x * Math.PI / 180;
    }

    var R = 6371; // km
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
  }

  // ── Kiwi-style FTx slot scheduling ──────────────────────────────────────
  //
  // Port of the tsync logic in KiwiSDR's decode_ft8_samples(). Both halves run
  // off arriving audio rather than a timer:
  //
  //   _ftxSlotStart()  — before samples are appended, opens a capture window if
  //                      the clock has reached a slot boundary (+ time shift).
  //   _ftxSlotFinish() — after samples are appended, decodes once a full
  //                      (slot_period - 0.4) s window is in hand.

  /** Position within the current slot, in seconds, honouring the time shift. */
  _ftxSlotPos(slotPeriod, mode) {
    const t = Date.now() / 1000 - (this.ftxShift[mode] ?? 0.8);
    const m = t % slotPeriod;
    return m < 0 ? m + slotPeriod : m;
  }

  /** Number of samples Kiwi captures per slot: (slot_period - 0.4) s. */
  _ftxSlotSamples(slotPeriod) {
    const sps = this.audioOutputSps || 12000;
    return Math.floor((slotPeriod - 0.4) * sps);
  }

  /**
   * Width of the window, at the head of a slot, in which a capture may start.
   *
   * Kiwi uses slot_period/4 because it evaluates this from a comparatively
   * coarse loop and wants to be sure not to miss the boundary. We are called on
   * every audio block (tens of ms), so a much tighter window is both safe and
   * necessary: a capture runs for (slot_period - 0.4) s, so it ends 0.4 s
   * *before* the next boundary. With a quarter-slot window that end still falls
   * inside the acceptance window, so the next capture latches 0.4 s early and
   * every slot creeps earlier until it happens to wrap — minutes of misaligned
   * captures. Keeping the window under 0.4 s makes the end-of-capture position
   * wrap negative, so the next start can only happen at a true boundary.
   */
  _ftxStartWindow(slotPeriod) {
    // Must span at least one audio block or boundaries fall between calls and
    // slots get skipped; must stay under 0.4 s or the creep described above
    // returns. Block size is server-driven (fft_result_size), so track it.
    const sps = this.audioOutputSps || 12000;
    const blockDur = (this._ftxLastBlockLen || 0) / sps;
    return Math.min(slotPeriod / 4, 0.39, Math.max(0.35, blockDur * 1.05));
  }

  _ftxSlotStart(blockLen) {
    if (blockLen) this._ftxLastBlockLen = blockLen;

    if (this.decodeFT8 && !this.isCollecting &&
        this._ftxSlotPos(15.0, 'FT8') <= this._ftxStartWindow(15.0)) {
      this.isCollecting = true;
      this.accumulatorLen = 0;
      this._ftxSpecReset();
    }
    if (this.decodeFT4 && !this.isFT4Collecting &&
        this._ftxSlotPos(7.5, 'FT4') <= this._ftxStartWindow(7.5)) {
      this.isFT4Collecting = true;
      this.ft4AccumulatorLen = 0;
      this._ftxSpecReset();
    }
    if (this.decodeFT2 && !this.isFT2Collecting &&
        this._ftxSlotPos(3.75, 'FT2') <= this._ftxStartWindow(3.75)) {
      this.isFT2Collecting = true;
      this.ft2AccumulatorLen = 0;
      this._ftxSpecReset();
    }
  }

  _ftxSlotFinish() {
    if (this.isCollecting && this.accumulatorLen >= this._ftxSlotSamples(15.0)) {
      this.stopCollection();
    }
    if (this.isFT4Collecting && this.ft4AccumulatorLen >= this._ftxSlotSamples(7.5)) {
      this.stopFT4Collection();
    }
    if (this.isFT2Collecting && this.ft2AccumulatorLen >= this._ftxSlotSamples(3.75)) {
      this.stopFT2Collection();
    }
  }

  // ── Mini audio spectrum ─────────────────────────────────────────────────

  /** Allocate one max-hold spectrum accumulator of transform size N. */
  _makeSpec(N) {
    return {
      N,
      re:    new Float64Array(N),
      im:    new Float64Array(N),
      fill:  new Float32Array(N),
      pos:   0,
      max:   new Float32Array((N >> 1) + 1).fill(-140),
      marks: [],   // decoded spots: {hz, snr, text}
      seq:   0,    // bumped on change so the UI can skip redraws
    };
  }

  /** Feed slot audio; runs one FFT per full frame and max-holds the result. */
  _specFeed(st, pcm) {
    const N = st.N;
    let i = 0;
    while (i < pcm.length) {
      const take = Math.min(N - st.pos, pcm.length - i);
      st.fill.set(pcm.subarray(i, i + take), st.pos);
      st.pos += take;
      i += take;
      if (st.pos < N) return;

      // Hann window, so neighbouring strong signals don't smear across the
      // display and hide weak ones.
      const re = st.re, im = st.im;
      for (let k = 0; k < N; k++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N);
        re[k] = st.fill[k] * w;
        im[k] = 0;
      }
      try { transformFlat(re, im, false); } catch (e) { st.pos = 0; return; }

      const half = N >> 1;
      const max  = st.max;
      for (let k = 0; k <= half; k++) {
        const p  = re[k] * re[k] + im[k] * im[k];
        const db = 10 * Math.log10(p / (N * N) + 1e-14);
        if (db > max[k]) max[k] = db;
      }
      st.seq++;
      st.pos = 0;
    }
  }

  _specReset(st) {
    st.max.fill(-140);
    st.pos = 0;
    st.seq++;
  }

  _ftxSpecFeed(pcm)  { this._specFeed(this._ftxSpec, pcm); }
  _ftxSpecReset()    { this._specReset(this._ftxSpec); }

  /**
   * Snapshot for the panel display: max-hold magnitudes over the slot so far,
   * plus the frequencies of the spots decoded from the previous slot.
   */
  getFTxSpectrum() {
    const sps = this.audioOutputSps || 12000;
    const st  = this._ftxSpec;
    return {
      mags:       st.max,
      binHz:      sps / st.N,
      marks:      st.marks,
      seq:        st.seq,
      // Match the decoder's own passband so the axis means the same thing.
      loHz:       100,
      hiHz:       Math.min(3100, sps / 2),
      gridHz:     500,
      collecting: !!(this.isCollecting || this.isFT4Collecting || this.isFT2Collecting),
    };
  }

  /**
   * Same shape as getFTxSpectrum(), zoomed to the WSPR sub-band.
   *
   * WSPR only ever occupies WSPR_CENTER +/- 110 Hz (FMIN/FMAX in wspr.js), so
   * the full 100-3100 Hz axis would compress the whole band into a few percent
   * of the strip and merge every station into one smear. 1390-1610 Hz gives the
   * same box ~14x the horizontal resolution.
   */
  getWSPRSpectrum() {
    const sps = this.audioOutputSps || 12000;
    const st  = this._wsprSpec;
    return {
      mags:       st.max,
      binHz:      sps / st.N,
      marks:      st.marks,
      seq:        st.seq,
      loHz:       1390,
      hiHz:       1610,
      gridHz:     50,
      collecting: !!this.isWSPRCollecting,
    };
  }

  // ── Sync offset: persistence and self-calibration ───────────────────────

  _ftxLoadPref(key, dflt) {
    try {
      const v = Number(localStorage.getItem(key));
      return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : dflt;
    } catch (e) { return dflt; }   // private mode / storage disabled
  }

  _ftxSavePref(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }

  /** Capture lead-in for a mode (defaults to whichever mode is running). */
  getFTxTimeShift(mode) {
    return this.ftxShift[mode || this.ftxActiveMode] ?? 0.8;
  }

  /** Adjust the lead-in for the active mode. Manual override; clears history. */
  setFTxTimeShift(seconds, mode) {
    const v = Number(seconds);
    if (!Number.isFinite(v)) return;
    const m = mode || this.ftxActiveMode;
    this.ftxShift[m] = Math.max(0, Math.min(3, v));
    this._ftxSavePref(`ftxShift.${m}`, this.ftxShift[m].toFixed(3));
    this._ftxDtHistory[m] = [];        // stale relative to the new shift
    console.log(`[FTx] ${m} time shift = ${this.ftxShift[m].toFixed(2)} s`);
  }

  /**
   * Note which mode is decoding, so the slider tracks the right value and
   * calibration is attributed correctly.
   */
  _ftxSetActiveMode(mode) {
    if (this.ftxActiveMode === mode) return;
    this.ftxActiveMode = mode;
    this._ftxDtHistory[mode] = [];
    if (typeof this.onFTxTimeShiftChange === 'function') {
      this.onFTxTimeShiftChange(this.ftxShift[mode]);
    }
  }

  setFTxAutoSync(on) {
    this.ftxAutoSync = !!on;
    this._ftxSavePref('ftxAutoSync', this.ftxAutoSync ? 1 : 0);
    console.log(`[FTx] auto-sync ${this.ftxAutoSync ? 'ON' : 'OFF'}`);
  }

  /**
   * Ideal DT for a protocol: half the slack between the capture window and the
   * transmission. Centring the signal leaves the most room for residual error
   * on both sides, and keeps us well inside find_sync's search range (which is
   * only -0.48..+0.91 s for FT4, versus -1.6..+3.0 s for FT8).
   */
  _ftxDtTarget(mode) {
    const spec = {
      FT8: { slot: 15.0,  tx: 79  * 0.160 },
      FT4: { slot: 7.5,   tx: 105 * 0.048 },
      FT2: { slot: 3.75,  tx: 105 * 0.024 },
    }[mode];
    if (!spec) return 0;
    return Math.max(0, ((spec.slot - 0.4) - spec.tx) / 2);
  }

  /**
   * Nudge the capture lead-in from the decoders' own DT measurements.
   *
   * DT is where the decoded signal actually sat in the analysis window, so
   * DT = latency - shift. Verified empirically: trimming N seconds off the
   * front of a recording lowers DT by exactly N. The correction is therefore
   * `shift += (DT - target)`, damped.
   *
   * Uses the median, not the mean: one badly mistimed station would otherwise
   * drag the whole loop. Needs a few decodes before acting, for the same
   * reason.
   */
  _ftxAutoCalibrate(mode, decodedMessages) {
    if (!this.ftxAutoSync) return;

    // Accumulate across slots rather than requiring several in one. A band may
    // carry a single signal — FT2 typically does — and a per-slot threshold
    // would then never fire at all.
    const hist = this._ftxDtHistory[mode] || (this._ftxDtHistory[mode] = []);
    for (const m of decodedMessages) {
      if (Number.isFinite(m.dt)) hist.push(m.dt);
    }
    while (hist.length > 12) hist.shift();   // rolling, so it tracks drift
    if (hist.length < 3) return;

    const sorted = hist.slice().sort((a, b) => a - b);
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : 0.5 * (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]);

    const error = median - this._ftxDtTarget(mode);
    if (Math.abs(error) < 0.05) return;  // deadband: don't chase jitter

    const GAIN = 0.5;                    // damped, so it settles instead of ringing
    const cur  = this.ftxShift[mode] ?? 0.8;
    const next = Math.max(0, Math.min(3, cur + GAIN * error));
    if (Math.abs(next - cur) < 0.01) return;

    this.ftxShift[mode] = next;
    this._ftxSavePref(`ftxShift.${mode}`, next.toFixed(3));
    hist.length = 0;                     // measured against the old shift
    console.log(`[FTx] auto-sync: ${mode} median DT ${median.toFixed(2)}s ` +
                `(target ${this._ftxDtTarget(mode).toFixed(2)}s) → shift ${next.toFixed(2)}s`);

    // Let the UI slider follow, but only while this mode is the one showing.
    if (mode === this.ftxActiveMode &&
        typeof this.onFTxTimeShiftChange === 'function') {
      this.onFTxTimeShiftChange(next);
    }
  }

  startCollection() {
    this.isCollecting = true;
    this.accumulatorLen = 0;
  }

  async stopCollection() {
    this.isCollecting = false;
    if (this.decodeFT8) {
      // ✅ FIXED: zero accumulatorLen immediately after snapshot so the slot
      //           boundary timer cannot read a stale length before startCollection()
      const bigFloat32Array = this.accumulator.slice(0, this.accumulatorLen);
      this.accumulatorLen = 0;

      const decodedMessages = await _workerDecode('ft8', bigFloat32Array, { sampleRate: this.audioOutputSps || 12000 });
      this._ftxRenderSpots('FT8', decodedMessages);
    }
  }

// ── FT4 collection ──────────────────────────────────────────────────────
// NB: slot boundaries are handled by _ftxSlotStart()/_ftxSlotFinish(), driven
// from playAudio(). The old timer-polled updateFT4CollectionStatus() is gone.

startFT4Collection() {
    this.isFT4Collecting = true;
    this.ft4AccumulatorLen = 0;
}

async stopFT4Collection() {
    this.isFT4Collecting = false;
    if (!this.decodeFT4 || this.ft4AccumulatorLen < 1000) return;

    const pcm = this.ft4Accumulator.slice(0, this.ft4AccumulatorLen);
    this.ft4AccumulatorLen = 0;

    let decodedMessages;
    try {
        decodedMessages = await _workerDecode('ft4', pcm, { sampleRate: this.audioOutputSps || 12000 });
    } catch (e) {
        console.error('[FT4] decode error:', e);
        return;
    }

    this._ftxRenderSpots('FT4', decodedMessages);
}
// ── FT4 collection END ───────────────────────────────────────────────────

// ── FT2 collection ──────────────────────────────────────────────────────
// Slot boundaries handled by _ftxSlotStart()/_ftxSlotFinish(); see above.
startFT2Collection() {
    this.isFT2Collecting = true;
    this.ft2AccumulatorLen = 0;
}
async stopFT2Collection() {
    this.isFT2Collecting = false;
    if (!this.decodeFT2 || this.ft2AccumulatorLen < 1000) return;
    const pcm = this.ft2Accumulator.slice(0, this.ft2AccumulatorLen);
    this.ft2AccumulatorLen = 0;
    let decodedMessages;
    try {
        decodedMessages = await _workerDecode('ft2', pcm, { sampleRate: this.audioOutputSps || 12000 });
    } catch (e) {
        console.error('[FT2] decode error:', e);
        return;
    }
    this._ftxRenderSpots('FT2', decodedMessages);
}
// ── FT2 collection END ───────────────────────────────────────────────────

// ── WSPR-2 collection ────────────────────────────────────────────────────
  /**
   * Called every 500 ms.  WSPR-2 slots start on even UTC minutes (0, 2, 4 …).
   * Transmission occupies 1.0 s … 111.6 s of the slot; we collect to 119 s.
   *
   *  pos   0 s  → start collecting  (slot open, even minute)
   *  pos 119 s  → stop and decode
   *
   * The stop point is set by capture latency, not by the decoder: with latency
   * L the collected audio covers signal times [-L, 119-L], so the transmission
   * is only complete while L <= 7.4 s.  (At the old 116 s the budget was 4.4 s,
   * and users past it saw silent "too few samples" skips.)  Nothing needs to be
   * calibrated beyond that — unlike FT8/FT4, wsprd searches the time offset
   * itself over roughly -3 … +7.5 s, so any latency inside the capture window
   * is absorbed by the sync search.  See _wsprDecode()'s k0 loop in wspr.js.
   */
  updateWSPRCollectionStatus() {
    if (!this.decodeWSPR) return;
    const pos = wspr2SlotPosition(); // 0–119 s within the current 2-minute slot

    if (pos < 2 && !this.isWSPRCollecting) {
      this.startWSPRCollection();
    } else if (pos >= 119 && this.isWSPRCollecting) {
      this.stopWSPRCollection();
    }
  }

  startWSPRCollection() {
    this.isWSPRCollecting = true;
    this.wsprAccumulatorLen = 0;
    this._specReset(this._wsprSpec);
    console.log('[WSPR] Collection started');
  }

  async stopWSPRCollection() {
    this.isWSPRCollecting = false;
    if (!this.decodeWSPR || this.wsprAccumulatorLen < WSPR_TOTAL_SAMPLES) {
      console.log(`[WSPR] Too few samples (${this.wsprAccumulatorLen} < ${WSPR_TOTAL_SAMPLES}), skipping decode`);
      return;
    }

    const pcm = this.wsprAccumulator.slice(0, this.wsprAccumulatorLen);
    this.wsprAccumulatorLen = 0;
    console.log(`[WSPR] Decoding ${pcm.length} samples…`);

    let results;
    try {
      results = await _workerDecode('wspr', pcm, {
        sampleRate: this.audioOutputSps || 12000,
        dialFreqHz: this.wsprDialFreqHz || 0,
      });
    } catch (e) {
      console.error('[WSPR] decode error:', e);
      return;
    }

    console.log(`[WSPR] ${results.length} message(s) decoded`);

    // Marks stay on the strip through the next collection window, so the spots
    // in the list can be read straight off the spectrum they came from.
    this._wsprSpec.marks = results
      .filter(r => Number.isFinite(r.audioHz))
      .map(r => ({ hz: r.audioHz, snr: r.snr, text: r.callsign }));
    this._wsprSpec.seq++;

    const listDiv = document.getElementById('wsprMessagesList');
    if (!listDiv) return;

    const now = new Date();
    const utc = now.toISOString().slice(11, 16); // "HH:MM"

    for (const r of results) {
      const row = document.createElement('div');
      row.classList.add('glass-message', 'p-1', 'rounded', 'text-xs',
                        'flex', 'justify-between', 'items-center', 'font-mono', 'gap-2');

      // Timestamp + callsign
      const csSpan = document.createElement('span');
      csSpan.classList.add('text-cyan-300', 'font-bold');
      csSpan.textContent = `${utc}  ${r.callsign}`;
      row.appendChild(csSpan);

      // Grid — clickable link
      const gridLink = document.createElement('a');
      gridLink.href = `https://www.levinecentral.com/ham/grid_square.php?&Grid=${r.grid}&Zoom=10&sm=y`;
      gridLink.target = '_blank';
      gridLink.classList.add('text-yellow-300', 'hover:underline');
      gridLink.textContent = r.grid;
      row.appendChild(gridLink);

      // Power
      const pwrSpan = document.createElement('span');
      pwrSpan.classList.add('text-orange-300');
      pwrSpan.textContent = `${r.dbm} dBm`;
      row.appendChild(pwrSpan);

      // Freq (kHz relative to dial, or absolute if dial set)
      const freqSpan = document.createElement('span');
      freqSpan.classList.add('text-gray-300');
      freqSpan.textContent = this.wsprDialFreqHz
        ? `${(r.freq / 1000).toFixed(3)} kHz`
        : `+${r.freq} Hz`;
      row.appendChild(freqSpan);

      // SNR
      const snrSpan = document.createElement('span');
      snrSpan.classList.add(r.snr >= 0 ? 'text-green-400' : 'text-gray-400');
      snrSpan.textContent = `${r.snr > 0 ? '+' : ''}${r.snr} dB`;
      row.appendChild(snrSpan);

      listDiv.appendChild(row);
    }

    // Keep list bounded to last 200 rows
    while (listDiv.children.length > 200) listDiv.removeChild(listDiv.firstChild);

    if (results.length > 0) {
      setTimeout(() => { listDiv.scrollTop = listDiv.scrollHeight; }, 200);
    }
  }

  setWSPRDecoding(enabled) {
    this.decodeWSPR = !!enabled;
    if (!enabled) {
      this.isWSPRCollecting   = false;
      this.wsprAccumulatorLen = 0;
    }
    console.log(`[WSPR] Decoding: ${this.decodeWSPR ? 'ON' : 'OFF'}`);
  }

  /** Call with the dial frequency in Hz when tuned to a WSPR band */
  setWSPRDialFreq(hz) {
    this.wsprDialFreqHz = hz || 0;
  }
// ── WSPR-2 collection END ─────────────────────────────────────────────────

  // FT8 END


  playAudio(pcmArray, pcmArrayPreBoost) {
    // ── Tap raw PCM for digital decoders BEFORE mute/squelch/DSP ──────────
    // These decoders must keep collecting even when speaker audio is muted.
    // CW is intentionally excluded here and is fed from processed audio below.
    // rawPcm = pcmArray = post-FLAC-boost version, which all decoders expect.
    const rawPcm = pcmArray;

    // Open any FTx capture window whose slot boundary has arrived, before the
    // appends below — so the block that crosses the boundary is captured too.
    this._ftxSlotStart(rawPcm.length);

    // Mini spectrum tracks whatever slot is being captured.
    if (this.decodeFT8 || this.decodeFT4 || this.decodeFT2) {
      try { this._ftxSpecFeed(rawPcm); } catch (e) { /* display only */ }
    }
    if (this.isWSPRCollecting && this.decodeWSPR) {
      try { this._specFeed(this._wsprSpec, rawPcm); } catch (e) { /* display only */ }
    }

    if (this.isCollecting && this.decodeFT8) {
      const end = Math.min(this.accumulatorLen + rawPcm.length, this.maxAccumulatorSize);
      this.accumulator.set(rawPcm.subarray(0, end - this.accumulatorLen), this.accumulatorLen);
      this.accumulatorLen = end;
    }
    if (this.isFT4Collecting && this.decodeFT4) {
      const end = Math.min(this.ft4AccumulatorLen + rawPcm.length, this.maxFT4AccumulatorSize);
      this.ft4Accumulator.set(rawPcm.subarray(0, end - this.ft4AccumulatorLen), this.ft4AccumulatorLen);
      this.ft4AccumulatorLen = end;
    }
    if (this.isFT2Collecting && this.decodeFT2) {
      const end = Math.min(this.ft2AccumulatorLen + rawPcm.length, this.maxFT2AccumulatorSize);
      this.ft2Accumulator.set(rawPcm.subarray(0, end - this.ft2AccumulatorLen), this.ft2AccumulatorLen);
      this.ft2AccumulatorLen = end;
    }
    if (this.isWSPRCollecting && this.decodeWSPR) {
      const end = Math.min(this.wsprAccumulatorLen + rawPcm.length, this.maxWSPRAccumulatorSize);
      this.wsprAccumulator.set(rawPcm.subarray(0, end - this.wsprAccumulatorLen), this.wsprAccumulatorLen);
      this.wsprAccumulatorLen = end;
    }

    // Decode any FTx window that is now complete.
    this._ftxSlotFinish();

    // FAX tap — uses rawPcm for both FLAC and Opus.  The 12 kHz pipeline stream
    // is already band-limited server-side, giving the FM phase discriminator a
    // clean signal.  No Opus-specific override; see calibration note above.
    if (this.decodeFAX) {
      try { this._faxFeedPCM(rawPcm); }
      catch(e) { console.error('[FAX] feed error', e); }
    }

    // SSTV tap — same raw PCM, before AGC/NR/mute/squelch
    if (this.decodeSSTV) {
      try { this._sstvFeedPCM(rawPcm); }
      catch(e) { console.error('[SSTV] feed error', e); }
    }

    // NAVTEX/SITOR-B tap — raw PCM before any DSP
    if (this.decodeNAVTEX) {
      try { this._navtexFeedPCM(rawPcm); }
      catch(e) { console.error('[NAVTEX] feed error', e); }
    }

    // Generic Kiwi-style FSK tap — raw PCM before any DSP
    if (this.decodeFSK) {
      try { this._fskFeedPCM(rawPcm); }
      catch(e) { console.error('[FSK] feed error', e); }
    }

    // RADE v1 tap — forward raw SSB audio to sidecar even when muted.
    // rade_rx needs continuous input to maintain frame sync; do NOT gate on mute.
    // Uses pcmArrayPreBoost (pre-FLAC-boost) — boosted amplitude saturates radae_rxe.py.
    if (this.decodeRADE && this._radeSocket && this._radeReady &&
        this._radeSocket.readyState === WebSocket.OPEN) {
      var radePcm = pcmArrayPreBoost || pcmArray;
      try {
        this._radeSocket.send(
          radePcm.buffer.slice(radePcm.byteOffset,
                               radePcm.byteOffset + radePcm.byteLength));
      } catch(e) { console.error('[RADE] feed error', e); }
    }

    // Real FM CTCSS tone-squelch:
    // keep speaker audio closed until a valid subtone is detected.
    this._updateCTCSSGate(rawPcm);

    // Speaker-audio gate starts here. Decoder feeds above must still run.
    if (this.mute || (this.squelchMute && this.squelch) || this.ctcssMute) {
      return
    }
    if (this.audioCtx.state !== 'running') {
      return
    }

    // RADE mode: decoded speech arrives from sidecar via _radePlayPCM();
    // suppress raw SSB output so the two audio paths don't clash.
    if (this.decodeRADE) return;

    // Raw digital decoder tap already happened above before mute/squelch.
    // CW is fed from processed audio below (ANF helps by removing carriers).
    // ✅ STEREO C-QUAM: Selective processing to avoid artifacts
    //
    // Noise blanker: ENABLED - safe for stereo when L/R processed separately
    // Noise gate: DISABLED - causes tremor (envelope follower sees L/R alternation)
    // AGC: DISABLED - fights backend C-QUAM AGC, causes pumping
    if (this.channels === 2) {
      const frames = Math.floor(pcmArray.length / 2)
      const L = new Float32Array(frames)
      const R = new Float32Array(frames)
      for (let i = 0; i < frames; i++) { 
        L[i] = pcmArray[i * 2]
        R[i] = pcmArray[i * 2 + 1]
      }

      // Apply noise blanker to each channel separately (safe for stereo)
      let Lp = this.applyNoiseBlanker(L)
      let Rp = this.applyNoiseBlanker(R)

      // Background noise measurement/suppression — also safe per-channel,
      // same reasoning as the blanker above.
      Lp = this.applyBackgroundNoiseSuppression(Lp)
      Rp = this.applyBackgroundNoiseSuppression(Rp)

      // Apply ANF to each channel separately (safe for stereo)
      if (this.anfEnabled) {
        Lp = this.applyAutoNotch(Lp, false)
        Rp = this.applyAutoNotch(Rp, true)
      }
      
      // Debug: log if noise blanker actually processed anything
      if (this.nbBlankerEnabled || this.nrEnabled || this.nb) {
        if (!this._noiseBlankerLoggedOnce) {
          console.log('[Stereo NB] Noise blanker active for C-QUAM, frames=', frames)
          this._noiseBlankerLoggedOnce = true
        }
      }

      // Skip noise gate - causes tremor on stereo
      // Skip AGC - fights backend AGC, causes pumping

      // Re-interleave
      const out = new Float32Array(frames * 2)
      for (let i = 0; i < frames; i++) { 
        out[i * 2] = Lp[i]
        out[i * 2 + 1] = Rp[i]
      }
      pcmArray = out
      this._updateAudioLevelControl(pcmArray)

    } else {
      // Mono path — full processing as before
      pcmArray = this.applyNoiseBlanker(pcmArray);
      pcmArray = this.applyBackgroundNoiseSuppression(pcmArray);
      if (this.anfEnabled) {
        pcmArray = this.applyAutoNotch(pcmArray, false);
      }
      pcmArray = this.applyNoiseCancel(pcmArray);
      this._updateAudioLevelControl(pcmArray);
    }

    // Feed PCM data to spectrogram (after all audio processing)
    if (this.spectrogramEnabled && this.spectrogramCallback) {
      try {
        // The spectrogram expects a MONO stream at the audio sample rate.
        // In C-QUAM, pcmArray is interleaved stereo [L0,R0,L1,R1,...]; feeding
        // it raw makes the FFT read the L-R difference component modulated near
        // Nyquist and fold it back over the audio band, producing a false
        // "hole" around 2.7-3.5 kHz (seen only in QUAM). Downmix to mono
        // (L+R)/2 — the same sum the ear hears — so the display is correct.
        let spectrogramData;
        if (this.channels === 2) {
          const frames = pcmArray.length >> 1;
          spectrogramData = new Float32Array(frames);
          for (let i = 0; i < frames; i++) {
            spectrogramData[i] = 0.5 * (pcmArray[i * 2] + pcmArray[i * 2 + 1]);
          }
        } else {
          // Copy to avoid interference with the audio pipeline buffer.
          spectrogramData = new Float32Array(pcmArray);
        }
        this.spectrogramCallback(spectrogramData);
      } catch (error) {
        console.error('Spectrogram feed error:', error);
      }
    }

    // Feed PCM to CW decoder (processed — ANF removes interfering carriers)
    if (this.decodeCW) {
      try { this._cwFeedPCM(pcmArray); } catch(e) { console.error('CW feed error', e); }
    }

    const curPlayTime = this.playPCM(pcmArray, this.playTime, this.audioOutputSps, 1, this.channels)  // ✅ ADDED: Pass channels parameter

    // Dynamic adjustment of play time
    const currentTime = this.audioCtx.currentTime;
    // The line below was commented out by NY4Q to allow for a mod to //
    // adjust the dynamic limits of this function. //
    //const bufferThreshold = 0.1; // 100ms buffer //
    if ((this.playTime - currentTime) <= this.bufferThreshold) {
      // Underrun: increase buffer
      this.playTime = (currentTime + this.bufferThreshold + curPlayTime);
      // removed 0.5 and placed bufferLimit in its place - NY4Q //
    } else if ((this.playTime - currentTime) > this.bufferLimit) { // Originally at 0.5
      // Overrun: decrease buffer
      this.playTime = (currentTime + this.bufferThreshold);
    } else {
      // Normal operation: advance play time
      this.playTime += curPlayTime;
    }

    if (this.isRecording) {
      // ✅ FIXED: Check recording duration to prevent memory exhaustion
      const recordingDuration = (Date.now() - this.recordingStartTime) / 1000;
      
      if (recordingDuration > this.maxRecordingDuration) {
        console.warn('[Recording] Maximum duration (' + 
                     (this.maxRecordingDuration / 60) + ' minutes) reached, stopping automatically');
        this.stopRecording();
        
        // ✅ Notify user if possible
        if (typeof window !== 'undefined' && window.postMessage) {
          window.postMessage({
            type: 'recording_limit_reached',
            duration: this.maxRecordingDuration
          }, '*');
        }
      } else {
        // FIX: recordedAudio.push(...pcmArray) spreads the entire Float32Array
        // as individual arguments — for large arrays this throws RangeError:
        // Maximum call stack size exceeded.  Use a loop instead.
        const base = this.recordedAudio.length;
        this.recordedAudio.length = base + pcmArray.length;
        for (let i = 0; i < pcmArray.length; i++) {
          this.recordedAudio[base + i] = pcmArray[i];
        }
      }
    }
  }

  async _ensureStreamingWorklet() {
    if (!this.audioCtx || !this.audioInputNode) return false;
    if (this._streamForceFallback) return false;
    if (this._streamWorkletNode) {
      if (this._streamConnectedNode !== this.audioInputNode) {
        try { this._streamWorkletNode.disconnect(); } catch (_) {}
        this._streamWorkletNode.connect(this.audioInputNode);
        this._streamConnectedNode = this.audioInputNode;
      }
      return true;
    }
    if (this._streamInitPromise) {
      return this._streamInitPromise;
    }

    this._streamInitPromise = (async () => {
      let stage = 'init';
      try {
        if (this.audioCtx.state === 'suspended') {
          stage = 'resume';
          try { await this.audioCtx.resume(); } catch (_) {}
        }
        stage = 'capability-check';
        const WorkletCtor = globalThis.AudioWorkletNode || (typeof AudioWorkletNode !== 'undefined' ? AudioWorkletNode : null);
        if (!this.audioCtx.audioWorklet || !WorkletCtor) {
          throw new Error('AudioWorklet not available');
        }
        if (!this._streamWorkletModuleLoaded) {
          stage = 'addModule(URL)';
          try {
            await this.audioCtx.audioWorklet.addModule(new URL('./audio-stream-worklet.js', import.meta.url));
          } catch (urlErr) {
            // Some bundler/server setups (service worker interception, dev
            // preview servers, MIME-type quirks) handle a constructed URL
            // differently from a plain relative string. This is a cheap,
            // low-risk second attempt rather than giving up immediately —
            // if THIS also fails, the two errors together tell you whether
            // it's a path problem (both fail the same way) or specifically
            // an import.meta.url resolution problem (only the first fails).
            stage = 'addModule(string, after URL failed)';
            console.warn('[Audio] addModule via constructed URL failed, retrying with plain path:', urlErr);
            await this.audioCtx.audioWorklet.addModule('./audio-stream-worklet.js');
          }
          this._streamWorkletModuleLoaded = true;
        }
        stage = 'construct-node';
        const node = new WorkletCtor(this.audioCtx, 'phantomsdr-audio-stream', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          processorOptions: {
            sampleRate: this.audioOutputSps || this.audioCtx.sampleRate || 12000,
            maxBufferedSeconds: 0.25,  // was 0.5 — 150ms ceiling; worklet floor now 1024 (85ms) not 4096
            minStartSeconds: 0.03,     // was 0.04 — 20ms prebuffer; worklet floor is 256 frames (21ms)
          }
        });
        node.connect(this.audioInputNode);
        this._streamConnectedNode = this.audioInputNode;
        node.port.onmessage = (event) => {
          const data = event.data || {};
          if (data.type === 'stats') {
            this._streamStats = data;
          }
        };
        this._streamWorkletNode = node;
        if (!this._loggedWorkletPlayback) {
          console.log('[Audio] Streaming AudioWorklet active');
          this._loggedWorkletPlayback = true;
        }
        return true;
      } catch (e) {
        if (!this._loggedWorkletFailure) {
          // Print stage + name + message explicitly rather than relying on
          // the console to expand the raw error object usefully — some
          // browsers collapse DOMException/AbortError objects to something
          // unhelpful when logged bare.
          console.warn('[Audio] AudioWorklet stream unavailable at stage "' + stage + '":',
                       e && e.name, '-', e && e.message, e);
          this._loggedWorkletFailure = true;
        }
        this._streamForceFallback = true;
        this._streamWorkletNode = null;
        return false;
      } finally {
        this._streamInitPromise = null;
      }
    })();

    return this._streamInitPromise;
  }

  _enqueuePCMToStreamingWorklet(buffer, channels) {
    if (!this._streamWorkletNode) return false;
    try {
      const pcm = new Float32Array(buffer);
      this._streamWorkletNode.port.postMessage({
        type: 'push',
        pcm,
        channels: channels === 2 ? 2 : 1,
      });
      return true;
    } catch (e) {
      console.warn('[Audio] Worklet enqueue failed:', e);
      return false;
    }
  }

  _logFallbackPlaybackOnce() {
    if (!this._loggedFallbackPlayback) {
      console.log('[Audio] Using fallback AudioBufferSourceNode playback');
      this._loggedFallbackPlayback = true;
    }
  }

  playPCM(buffer, playTime, sampleRate, scale, channels = 1) {  // ✅ ADDED: channels parameter
    if (!this.audioInputNode) {
      console.warn('Audio not initialized');
      return 0;
    }

    const frames = (channels === 2) ? Math.floor(buffer.length / 2) : buffer.length;
    if (frames <= 0) return 0;

    if (!this._streamForceFallback) {
      if (this._streamWorkletNode) {
        // Worklet already initialised — enqueue synchronously and return.
        // IMPORTANT: do NOT also enqueue via an async .then() path.  Because
        // _ensureStreamingWorklet() is async, the previous implementation ran
        // both the .then() callback (next microtask) AND the sync guard below
        // for the same buffer, sending every packet to the worklet twice.
        // That halved the effective maxBufferedSeconds, causing the ring buffer
        // to overflow in ~1.5 s and backing up the WebSocket receive queue.
        if (this._enqueuePCMToStreamingWorklet(buffer, channels)) {
          return frames / (this.audioOutputSps || sampleRate || this.audioCtx.sampleRate || 12000);
        }
        // Enqueue failed — fall through to AudioBufferSourceNode fallback.
        this._streamForceFallback = true;
        this._streamWorkletNode = null;
      } else {
        // Not yet initialised — kick off async init; drop this frame (first-time only).
        this._ensureStreamingWorklet().catch((e) => {
          if (!this._loggedWorkletFailure) {
            console.warn('[Audio] AudioWorklet init failed, falling back:', e);
            this._loggedWorkletFailure = true;
          }
          this._streamForceFallback = true;
          this._streamWorkletNode = null;
        });
        // Advance playTime correctly even though we dropped the frame.
        return frames / (this.audioOutputSps || sampleRate || this.audioCtx.sampleRate || 12000);
      }
    }

    this._logFallbackPlaybackOnce();
    
    const source = new AudioBufferSourceNode(this.audioCtx);
    const audioBuffer = new AudioBuffer({
      length: frames,
      numberOfChannels: channels,
      sampleRate: this.audioOutputSps
    });

    if (channels === 2) {
      const L = new Float32Array(frames);
      const R = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        L[i] = buffer[2 * i];
        R[i] = buffer[2 * i + 1];
      }
      audioBuffer.copyToChannel(L, 0, 0);
      audioBuffer.copyToChannel(R, 1, 0);
    } else {
      audioBuffer.copyToChannel(buffer, 0, 0);
    }

    source.buffer = audioBuffer;
    source.connect(this.audioInputNode);

    const scheduledTime = Math.max(playTime, this.audioCtx.currentTime);
    let safetyTimerId = null;
    let disconnected = false;
    const disconnect = () => {
      if (!disconnected) {
        disconnected = true;
        if (safetyTimerId !== null) {
          clearTimeout(safetyTimerId);
          safetyTimerId = null;
        }
        try { source.disconnect(); } catch (_) {}
      }
    };

    source.onended = disconnect;
    const safetyTimeout = (audioBuffer.duration + 1) * 1000;
    safetyTimerId = setTimeout(disconnect, safetyTimeout);

    try {
      source.start(scheduledTime);
    } catch (e) {
      console.error('Failed to start audio source:', e);
      disconnect();
      return 0;
    }

    return audioBuffer.duration;
  }

  startRecording() {
    if (this.isRecording) return;

    this.isRecording = true;
    this.recordedAudio = [];  // ✅ FIXED: Clear previous recording
    this.recordingStartTime = Date.now();  // ✅ FIXED: Track start time
    this.recordedChunks = [];

    this.mediaRecorder = new MediaRecorder(this.destinationNode.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    console.log('[Recording] Started (max duration: ' + 
                (this.maxRecordingDuration / 60) + ' minutes)');
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.mediaRecorder.stop();
  }

  downloadRecording() {
    if (this.recordedChunks.length === 0) {
      console.warn('No recorded audio to download');
      return;
    }

    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });

    // Convert blob to ArrayBuffer
    blob.arrayBuffer().then(arrayBuffer => {
      // Decode the audio data
      this.audioCtx.decodeAudioData(arrayBuffer).then(audioBuffer => {
        // Create WAV file
        const wavFile = this.createWavFile(audioBuffer);
        // Create a timestamp for the audio file to be saved //
        const audioDate = new Date();
        const audioYear = audioDate.getFullYear();
        const audioMonth = (audioDate.getMonth() + 1);
        const audioDay = audioDate.getDate();
        //
        const audioHour = audioDate.getHours();
        const audioMinute = audioDate.getMinutes();
        const audioSeconds = audioDate.getSeconds();
        //
        const audioFullDate = audioYear + '-' + audioMonth + '-' + audioDay;
        const audioTime = audioHour + '-' + audioMinute + '-' + audioSeconds;
        const timeStamp = audioFullDate + '_' + audioTime;
        // Create download link
        const url = URL.createObjectURL(new Blob([wavFile], { type: 'audio/wav' }));
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = 'recorded_audio_' + timeStamp + '_.wav';
        a.click();
        window.URL.revokeObjectURL(url);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Video + audio recording
  //
  // Reuses the same demodulated audio the WAV recorder uses (destinationNode),
  // muxed with a composite of the waterfall canvas stack. Independent of
  // startRecording(), so audio-only and video recording can run side by side.
  // ═══════════════════════════════════════════════════════════════════════════

  isVideoRecordingSupported() {
    return VideoRecorder.isSupported();
  }

  startVideoRecording({ layers, getCaption, onAutoStop, crop } = {}) {
    if (this.videoRecorder && this.videoRecorder.isRecording) return false;

    if (!this.audioCtx || !this.gainNode) {
      console.warn('[VideoRecording] Audio graph not ready, start audio first');
      return false;
    }

    // Deliberately NOT reusing this.destinationNode (the WAV recorder's node):
    // this keeps the video recorder from sharing a track with the WAV recorder.
    this._teardownVideoAudioTap();
    try {
      this.videoDestinationNode = new MediaStreamAudioDestinationNode(this.audioCtx);
      this.gainNode.connect(this.videoDestinationNode);
    } catch (e) {
      console.warn('[VideoRecording] Could not create audio tap:', e);
      this.videoDestinationNode = null;
      return false;
    }

    // The receiver's AudioContext runs at audioOutputSps (12 kHz typically).
    // MediaRecorder's Opus encoder wants 48 kHz, and when it is handed a
    // low-rate track alongside a video track it produces a silent audio channel
    // rather than resampling. The WAV recorder never hits this because it
    // records audio-only and re-decodes the result itself.
    //
    // A MediaStreamAudioSourceNode resamples whatever stream it is given up to
    // its own context's rate, so bouncing the tap through a second context
    // pinned at 48 kHz yields a track the encoder accepts. This is a native
    // context on purpose: the `AudioContext` imported at the top of this file
    // is the standardized-audio-context wrapper, and all we need here is a
    // plain resampler.
    const audioStream = this._resampleTo48k(this.videoDestinationNode.stream);

    const tracks = audioStream.getAudioTracks();
    console.log(
      '[VideoRecording] Audio tap: ' + tracks.length + ' track(s)' +
      (tracks[0]
        ? ' readyState=' + tracks[0].readyState + ' enabled=' + tracks[0].enabled +
          ' muted=' + tracks[0].muted
        : '') +
      ' src=' + this.audioCtx.sampleRate + 'Hz' +
      ' rec=' + (this.videoAudioCtx ? this.videoAudioCtx.sampleRate + 'Hz' : 'unresampled') +
      ' ctx=' + this.audioCtx.state
    );

    this.videoRecorder = new VideoRecorder({
      fps: 25,
      maxDurationSec: this.maxVideoRecordingDuration,
    });

    // Identifies this take. onStopped fires asynchronously, so a previous
    // take's flush can land after the next one has already built its tap —
    // without this check it would tear the new tap down and mute the recording.
    const session = (this._videoSession = (this._videoSession || 0) + 1);

    const started = this.videoRecorder.start({
      audioStream,
      layers,
      getCaption,
      onAutoStop,
      crop,
      // Keep the tap and the resampler alive until the encoder has flushed,
      // otherwise the tail of the recording is cut off.
      onStopped: () => {
        if (this._videoSession === session) this._teardownVideoAudioTap();
      },
    });

    if (!started) this._teardownVideoAudioTap();
    return started;
  }

  // Bounce a low-rate stream through a 48 kHz context so MediaRecorder's Opus
  // encoder accepts it. Falls back to the original stream if a context cannot
  // be created, which is still better than failing the recording.
  //
  // The context is created once and reused for the life of the page. Browsers
  // cap how many AudioContexts a page may hold (Chrome allows about six) and
  // close() only frees the slot asynchronously, so building a fresh one per
  // recording starts throwing after a handful of takes — the resampler then
  // silently falls back to the 12 kHz tap and the audio goes quiet again until
  // a reload. Only the source/destination nodes are per-recording.
  _resampleTo48k(stream) {
    const NativeAudioContext =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!NativeAudioContext) return stream;

    try {
      if (!this.videoAudioCtx || this.videoAudioCtx.state === 'closed') {
        this.videoAudioCtx = new NativeAudioContext({ sampleRate: 48000 });
      }
      // Reached from a click handler, so this should already be running; resume
      // anyway because a suspended context silently emits nothing.
      if (this.videoAudioCtx.state === 'suspended') {
        this.videoAudioCtx.resume().catch(() => {});
      }
      this.videoResampleSource = this.videoAudioCtx.createMediaStreamSource(stream);
      this.videoResampleDest = this.videoAudioCtx.createMediaStreamDestination();
      this.videoResampleSource.connect(this.videoResampleDest);
      return this.videoResampleDest.stream;
    } catch (e) {
      console.warn('[VideoRecording] 48 kHz resample unavailable, using raw tap:', e);
      this._teardownResampler();
      return stream;
    }
  }

  // Drops the per-recording nodes but keeps the context for the next take.
  _teardownResampler() {
    try { if (this.videoResampleSource) this.videoResampleSource.disconnect(); } catch (e) {}
    try { if (this.videoResampleDest) this.videoResampleDest.disconnect(); } catch (e) {}
    this.videoResampleSource = null;
    this.videoResampleDest = null;
  }

  // Full release of the resample context. Only for tearing the client down —
  // routine stop/reset keeps the context so it can be reused.
  _closeResampleContext() {
    this._teardownResampler();
    if (this.videoAudioCtx) {
      try {
        if (this.videoAudioCtx.state !== 'closed') this.videoAudioCtx.close();
      } catch (e) {
        /* already closing */
      }
    }
    this.videoAudioCtx = null;
  }

  // Drop the dedicated recording tap off the output chain. Safe to call when no
  // tap exists; never touches the shared destinationNode used for playback.
  _teardownVideoAudioTap() {
    this._teardownResampler();
    if (!this.videoDestinationNode) return;
    try {
      if (this.gainNode) this.gainNode.disconnect(this.videoDestinationNode);
    } catch (e) {
      /* already disconnected, or the context is closing */
    }
    this.videoDestinationNode = null;
  }

  stopVideoRecording() {
    if (!this.videoRecorder || !this.videoRecorder.isRecording) {
      this._teardownVideoAudioTap();
      return;
    }
    // Teardown runs from the recorder's onStopped hook once the encoder has
    // flushed; tearing down here would truncate the final chunk.
    this.videoRecorder.stop();
  }

  downloadVideoRecording() {
    if (!this.videoRecorder) {
      console.warn('[VideoRecording] No recorded video to download');
      return;
    }
    this.videoRecorder.download();
  }

  // Drop everything held by the video recorder so the next take starts clean:
  // stops any capture in progress, releases the encoded chunks (the only part
  // that is actually large), and unhooks the tap. The 48 kHz context is kept on
  // purpose — see _resampleTo48k.
  resetVideoRecording() {
    // Bump first: any in-flight onStopped from the take being discarded must
    // not run against the state we are about to rebuild.
    this._videoSession = (this._videoSession || 0) + 1;
    if (this.videoRecorder) {
      try {
        this.videoRecorder.dispose();
      } catch (e) {
        console.warn('[VideoRecording] dispose error', e);
      }
      this.videoRecorder = null;
    }
    this._teardownVideoAudioTap();
    console.log('[VideoRecording] Reset');
  }

  // Same idea for the WAV recorder: stop it and release the buffered chunks.
  resetAudioRecording() {
    try {
      if (this.isRecording) this.stopRecording();
    } catch (e) {
      console.warn('[Recording] stop error', e);
    }
    this.isRecording = false;
    this.recordedChunks = [];
    this.recordedAudio = [];
    this.mediaRecorder = null;
  }

  createWavFile(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioBuffer.length * blockAlign;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      const channel = audioBuffer.getChannelData(i);
      for (let j = 0; j < channel.length; j++) {
        const sample = Math.max(-1, Math.min(1, channel[j]));
        view.setInt16(offset + (j * numChannels + i) * bytesPerSample, sample * 0x7FFF, true);
      }
    }

    return arrayBuffer;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RADE v1  (Radio AutoencoDEr — FreeDV flagship HF digital voice)
  //
  //  Architecture:
  //    playAudio() taps raw SSB PCM → sends over WebSocket to rade_helper.py
  //    rade_helper.py pipes it into `freedv_rx RADEV1 - -` (or RADE_CMD env)
  //    Decoded f32 PCM @ 16000 Hz returns and is played via _radePlayPCM()
  //
  //  Sideband convention:
  //    RADEL → LSB (HF bands ≤ 10 MHz: 160m, 80m, 40m)
  //    RADEU → USB (HF bands > 10 MHz: 20m, 17m, 15m, 10m)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enable or disable RADE v1 decoding via the rade_helper.py sidecar.
   * @param {boolean} enabled
   * @param {string}  sideband  'USB' (RADEU) or 'LSB' (RADEL)
   * @param {string}  [uri]     Sidecar WebSocket URI; default ws://host:8074
   */
  setRADEDecoding(enabled, sideband, uri) {
    if (!enabled) {
      this.decodeRADE = false;
      this._radeReady = false;
      this._rebuildOutputChain();

      // Stop any already-scheduled/playing RADE decoded audio immediately.
      // Without this, queued RADE chunks can keep sounding briefly while raw
      // receiver audio resumes, which makes the audio sound scattered.
      if (this._radeSources && this._radeSources.size) {
        for (const src of this._radeSources) {
          try { src.stop(0); } catch (e) {}
          try { src.disconnect(); } catch (e) {}
        }
        this._radeSources.clear();
      }

      this._radeNextTime = 0;
      if (this._radeSocket) {
        try { this._radeSocket.close(); } catch (e) {}
        this._radeSocket = null;
      }
      console.log('[RADE] \u25a0 DISABLED');
      return;
    }

    this._radeSideband = sideband || 'USB';
    var helperUri = uri || ('ws://' + window.location.hostname + ':8074');

    try {
      var ws = new WebSocket(helperUri);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        // Report the ACTUAL delivered audio rate, not the nominal configured
        // one. audioOutputSps == audioMaxSps is fixed regardless of fft_size;
        // trueAudioSps is the real fft-bin-quantized rate the channelizer
        // produces and is what actually arrives on this socket. Sending the
        // nominal value here makes rade_helper.py's resample-to-8000 ratio
        // wrong whenever fft_size changes, which desyncs RADE's frame sync.
        //
        // IMPORTANT: do NOT use `this.trueAudioSps || fallback` — 0 is falsy
        // in JS, and a degenerate trueAudioSps (0/NaN, meaning the server
        // couldn't allocate enough bins for the channel at this fft_size)
        // would silently be replaced by the nominal value, hiding a real
        // channelizer failure behind what looks like a normal rate.
        var radeReportedSps;
        if (Number.isFinite(this.trueAudioSps) && this.trueAudioSps > 0) {
          radeReportedSps = this.trueAudioSps;
        } else {
          radeReportedSps = this.audioOutputSps || 8000;
          console.warn('[RADE] trueAudioSps is invalid (', this.trueAudioSps,
                       ') at fft_size=', this.fftSize, 'fft_result_size=', this.audioMaxSize,
                       '\u2014 falling back to nominal', radeReportedSps,
                       '\u2014 channelizer likely cannot build a usable channel at this fft_size');
        }
        ws.send(JSON.stringify({
          type:     'init',
          sps:      radeReportedSps,
          sideband: this._radeSideband,
        }));
        this._radeReady = true;
        this.decodeRADE = true;
        this._rebuildOutputChain();
        console.log('[RADE] \u25ba ENABLED', this._radeSideband,
                    '@', radeReportedSps, 'Hz (true) \u2192 helper', helperUri);
        if (this._radeCallback)
          this._radeCallback({ type: 'status', connected: true });
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary frame = decoded f32 PCM speech @ 16000 Hz (from lpcnet_demo)
          this._radePlayPCM(new Float32Array(event.data));
        } else {
          // Text frame = JSON status / error from the sidecar
          try {
            var msg = JSON.parse(event.data);
            if (this._radeCallback) this._radeCallback(msg);
          } catch (e) {}
        }
      };

      ws.onerror = () => {
        console.warn('[RADE] sidecar socket error');
        if (this._radeCallback)
          this._radeCallback({ type: 'error', msg: 'RADE sidecar unreachable — is rade_helper.py running on port 8074?' });
      };

      ws.onclose = () => {
        this._radeReady = false;
        this.decodeRADE = false;
        if (this._radeSocket === ws) this._radeSocket = null;
        console.log('[RADE] socket closed');
        if (this._radeCallback)
          this._radeCallback({ type: 'status', connected: false });
      };

      this._radeSocket = ws;
    } catch (e) {
      console.error('[RADE] failed to open sidecar socket:', e);
    }
  }

  /** Register a callback for RADE status/error events from the sidecar.
   *  Events: {type:'status', connected:bool}  {type:'error', msg:str} */
  setRADECallback(fn) {
    this._radeCallback = fn || null;
  }

  /** Play f32 mono PCM @ 16000 Hz returned by the RADE sidecar.
   *  Uses a scheduled playback queue so chunks play back-to-back without
   *  gaps. Each chunk is scheduled to start exactly where the previous one
   *  ended, using AudioContext.currentTime as a running clock.
   *  A small look-ahead (0.05 s) prevents underruns from scheduler jitter. */
  _radePlayPCM(samples) {
    if (!this.audioCtx || samples.length === 0) return;
    if (this.audioCtx.state !== 'running') return;
    try {
      var SAMPLE_RATE  = 16000;
      var LOOKAHEAD    = 0.05;   // seconds ahead of now to schedule if queue is empty
      var now          = this.audioCtx.currentTime;

      // If the queue has fallen behind (gap, first chunk, or long silence),
      // restart scheduling from now + lookahead
      if (this._radeNextTime < now + 0.01) {
        this._radeNextTime = now + LOOKAHEAD;
      }

      var buf = this.audioCtx.createBuffer(1, samples.length, SAMPLE_RATE);
      buf.getChannelData(0).set(samples);

      var src = this.audioCtx.createBufferSource();
      src.buffer = buf;

      // Route RADE through its own gain stage first so recorded RADE level
      // can be trimmed independently from the normal receiver audio path.
      if (this.radeGainNode) {
        src.connect(this.radeGainNode);
      } else {
        src.connect(this.audioCtx.destination);
      }

      // Track each RADE source so disabling RADE can cancel queued playback cleanly.
      this._radeSources.add(src);

      src.start(this._radeNextTime);
      src.onended = () => {
        if (this._radeSources) this._radeSources.delete(src);
        try { src.disconnect(); } catch (_) {}
      };

      // Advance the clock by the exact duration of this chunk
      this._radeNextTime += samples.length / SAMPLE_RATE;
    } catch (e) {
      console.error('[RADE] playback error', e);
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  SSTV DECODER  (best-effort Kiwi-style browser path)
  //
  //  Design goals for PhantomSDR-Plus:
  //   • always consume RAW PCM before mute / AGC / NR / DSP
  //   • jitter buffer so browser scheduling does not tear lines
  //   • VIS decode when present
  //   • auto-mode fallback when VIS is damaged or missing
  //   • soft sync recovery: keep line clock running even if a sync pulse fades
  //
  //  Supported receive modes in this implementation:
  //   Martin M1 / M2, Scottie S1 / S2 (the most common on HF)
  // ═══════════════════════════════════════════════════════════════════════════

  setSSTVDecoding(enabled) {
    this.decodeSSTV = !!enabled;
    this._rebuildOutputChain();
    if (this._sstvDecoder) this._sstvDecoder.setEnabled(this.decodeSSTV);
    if (!this.decodeSSTV && this._sstvDecoder) this._sstvDecoder.reset({ mode: this._sstvForcedMode || 'auto' });
    console.log('[SSTV]', enabled ? '▶ ENABLED' : '■ DISABLED');
  }

  setSSTVCallback(fn) {
    this.sstvCallback = fn || null;
    if (this._sstvDecoder) this._sstvDecoder.setCallback(this.sstvCallback);
  }

  setSSTVMode(mode) {
    this._sstvForcedMode = mode || 'auto';
    if (this._sstvDecoder) this._sstvDecoder.setMode(this._sstvForcedMode);
  }

  resetSSTVDecoder(mode = null) {
    if (mode != null) this._sstvForcedMode = mode || 'auto';

    this.setSSTVDecoding(false);
    this.setSSTVCallback(null);

    if (this._sstvDecoder) {
      if (typeof this._sstvDecoder.setMode === 'function') {
        this._sstvDecoder.setMode(this._sstvForcedMode || 'auto');
      }
      if (typeof this._sstvDecoder.reset === 'function') {
        this._sstvDecoder.reset({ mode: this._sstvForcedMode || 'auto' });
      }
    }
  }

  _sstvReset() {
    this.resetSSTVDecoder();
  }

  _sstvFeedPCM(pcm) {
    if (this._sstvDecoder) this._sstvDecoder.feedPCM(pcm);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  HF FAX / WEFAX DECODER  (ITU-T T.4 / CCIR 574)
  //
  //  Standard parameters:
  //    Black tone : 1500 Hz  (USB-demodulated audio)
  //    White tone : 2300 Hz  (shift = 800 Hz)
  //    Center freq: 1900 Hz  (FM discriminator reference)
  //    LPM        : 120  (lines per minute — most HF stations)
  //    IOC        : 576  (index of co-operation → π×IOC ≈ 1810 pixels/line)
  //    Start tone : 300 Hz alternating phasing (~5 min before image)
  //    Stop  tone : 450 Hz alternating phasing (~5 sec after image)
  //
  //  Algorithm: quadrature FM discriminator (mix → lowpass → atan2 derivative)
  //  followed by sub-sample pixel accumulation and optional sync-pulse
  //  auto-alignment.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Enable or disable the FAX decoder.  Resets all internal state. */
  setFAXDecoding(enabled) {
    this.decodeFAX = !!enabled;
    this._faxReset();   // always reset — rebuilds BPF/LPF with current audioOutputSps
    console.log('[FAX]', enabled ? '▶ ENABLED' : '■ DISABLED');
  }

  /**
   * Register callback for decoded line events.
   *   { type:'line', pixels:Uint8Array, lineNum:number, phasing:bool, stopTone:bool }
   */
  setFAXCallback(fn) {
    this.faxCallback = fn || null;
  }

  /**
   * Set FAX parameters (live, no canvas/image reset).
   * @param {number} lpm   Lines per minute (60 | 90 | 100 | 120 | 240)
   * @param {number} ioc   Index of co-operation (288 | 576)
   * @param {number} shift Frequency shift Hz (400 | 800)
   */
  setFAXParams(lpm, ioc, shift) {
    this._faxLPM   = lpm   || 120;
    this._faxIOC   = ioc   || 576;
    this._faxShift = shift || 800;
    this._faxUpdateTiming();
    console.log(`[FAX] Params: ${this._faxLPM} LPM, IOC ${this._faxIOC}, shift ${this._faxShift} Hz`);
  }

  /** Enable / disable automatic sync-pulse line alignment. */
  setFAXAutoAlign(enabled) {
    this._faxUsePhasing = !!enabled;
  }

  // ── Internal state reset ─────────────────────────────────────────────────────


  _faxReset() {
    // KiwiSDR-like HF FAX decoder state.
    // Keep a dedicated fixed-rate decoder path instead of using browser playback
    // rate directly. This is critical for keeping the discriminator, phasing and
    // line timing stable over long receptions.
    this._faxLPM    = 120;
    this._faxIOC    = 576;
    this._faxShift  = 800;
    this._faxBlack  = 1500;
    this._faxWhite  = 2300;
    this._faxCenter = 1900;
    this._faxStartTone = 300;
    this._faxStopToneHz = 450;
    this._faxDecodeSps = 12000;

    // Kiwi uses three ACfax LPF coefficient sets; "middle" is the default.
    // Keep raw integer taps because magnitude normalization follows.
    this._faxFirCoeffs = new Float64Array([
       0, -18, -38, -39, 0, 83, 191, 284, 320,
     284, 191, 83, 0, -39, -38, -18, 0
    ]);
    this._faxFirLen = this._faxFirCoeffs.length;
    this._faxBufI = new Float64Array(this._faxFirLen);
    this._faxBufQ = new Float64Array(this._faxFirLen);
    this._faxBufPosI = 0;
    this._faxBufPosQ = 0;

    this._faxMixerPhase = 0.0;    // normalized 0..1
    this._faxIprev = 0.0;
    this._faxQprev = 0.0;
    this._faxPrevRaw = 0.0;
    this._faxDc = 0.0;

    this._faxResamplePhase = 0.0;
    this._faxResampleLast = 0.0;
    this._faxResampleInSps = 0.0;
    this._faxResampleRatio = 1.0;

    this._faxPixPerLine = 1810;
    this._faxSampPerLine = 6000;
    this._faxSampPerPix = this._faxSampPerLine / this._faxPixPerLine;

    this._faxLineBuf = new Uint8Array(8192);
    this._faxLinePix = new Uint8Array(2048);
    this._faxLineOut = new Uint8Array(2048);
    this._faxLineBufPos = 0;
    this._faxLineCount = 0;

    // Kiwi-style phasing alignment.
    this._faxAutoAlign = true;
    this._faxUsePhasing = true;
    this._faxPhasingLines = 40;
    this._faxPhasingSkipLines = 1;
    this._faxPhasingPos = new Int32Array(this._faxPhasingLines);
    this._faxPhasingLinesLeft = 0;
    this._faxPhasingSkipData = 0;
    this._faxHavePhasing = false;
    this._faxSkip = 0;
    this._faxPendingSkip = 0;

    this._faxPhasing = false;
    this._faxStopDetected = false;
    this._faxIncludeHeadersInImages = false;
    this._faxStartCount = 0;
    this._faxStopCount = 0;
    this._faxToneConfirmLines = 3;

    this._faxUpdateTiming();
  }

  _faxUpdateTiming() {
    const inSr = this.audioOutputSps || 12000;
    const sr = this._faxDecodeSps || 12000;
    this._faxResampleInSps = inSr;
    this._faxResampleRatio = inSr / sr;
    this._faxBlack  = 1500;
    this._faxWhite  = this._faxBlack + this._faxShift;
    this._faxCenter = (this._faxBlack + this._faxWhite) / 2.0;
    this._faxPixPerLine = Math.round(Math.PI * this._faxIOC);
    this._faxSampPerLine = Math.max(1, Math.round(sr * 60.0 / this._faxLPM));
    this._faxSampPerPix = this._faxSampPerLine / this._faxPixPerLine;

    this._faxLineBuf = new Uint8Array(this._faxSampPerLine + 64);
    this._faxLinePix = new Uint8Array(Math.max(2048, this._faxPixPerLine + 64));
    this._faxLineOut = new Uint8Array(Math.max(2048, this._faxPixPerLine + 64));
    this._faxLineBufPos = 0;

    console.log(
      `[FAX] Kiwi-style discriminator | in_sr=${inSr} Hz -> decode_sr=${sr} Hz | ` +
      `${this._faxPixPerLine} px/line, ${this._faxSampPerLine} samp/line | ` +
      `carrier=${this._faxCenter} Hz shift=${this._faxShift} Hz`
    );
  }

  _faxApplyFir(buffer, posKey, sample) {
    const coeffs = this._faxFirCoeffs;
    const len = this._faxFirLen;
    let pos = this[posKey];
    buffer[pos] = sample;

    let sum = 0.0;
    let idx = pos;
    for (let i = 0; i < len; i++) {
      sum += buffer[idx] * coeffs[i];
      idx++;
      if (idx >= len) idx = 0;
    }

    pos--;
    if (pos < 0) pos = len - 1;
    this[posKey] = pos;
    return sum;
  }

  _faxFourierTransformSub(buffer, sampsPerLine, bufferLen, freq) {
    const k = -2 * Math.PI * freq * 60.0 / this._faxLPM / sampsPerLine;
    let retr = 0.0, reti = 0.0;
    for (let n = 0; n < bufferLen; n++) {
      const v = buffer[n];
      retr += v * Math.cos(k * n);
      reti += v * Math.sin(k * n);
    }
    return Math.hypot(retr, reti);
  }

  _faxDetectLineType(buffer, sampsPerLine, bufferLen) {
    // Robust Kiwi-style tone gating: remove DC first and normalize against line
    // energy so ordinary image content does not trip START/STOP detection.
    let mean = 0.0;
    for (let i = 0; i < bufferLen; i++) mean += buffer[i];
    mean /= Math.max(1, bufferLen);

    let energy = 0.0;
    const centered = new Float64Array(bufferLen);
    for (let i = 0; i < bufferLen; i++) {
      const v = buffer[i] - mean;
      centered[i] = v;
      energy += v * v;
    }
    const rms = Math.sqrt(energy / Math.max(1, bufferLen)) + 1e-9;
    // Use a 1/4-line DFT window instead of the full line.
    // The full 6000-sample window has 2 Hz bin resolution; Opus codec phase
    // perturbations shift the FM-discriminated pixel tone by ~1–3 Hz, causing
    // sinc() attenuation that drops startRatio below the detection threshold
    // (FLAC is lossless so its tone lands exactly on the bin and is fine).
    // A 1500-sample window widens each bin to 8 Hz, so a ±4 Hz offset causes
    // only ~2% attenuation (sinc(0.15) ≈ 0.977) instead of ~50%.
    // Normalised amplitude A/2 and the startRatio formula are unchanged;
    // false-positive immunity is preserved (random image content ≈ 0.018).
    const detLen = Math.max(512, Math.floor(bufferLen / 4));
    const startDet = this._faxFourierTransformSub(centered, sampsPerLine, detLen, this._faxStartTone) / detLen;
    const stopDet  = this._faxFourierTransformSub(centered, sampsPerLine, detLen, this._faxStopToneHz) / detLen;
    const startRatio = startDet / rms;
    const stopRatio  = stopDet / rms;

    // Threshold derivation: for a perfect 300 Hz square wave (0/255 pixels),
    // startRatio = 4/(π√2) ≈ 0.637.  For a sinusoidal tone it is 1/√2 ≈ 0.707.
    // Lowered from 0.40 to 0.30 to account for the small residual attenuation
    // from the shorter window under noisy HF conditions, while remaining well
    // above image-content noise (≈0.05–0.15).
    if (startRatio > 0.30 && startDet > 12) return 'START';
    if (stopRatio  > 0.30 && stopDet  > 12) return 'STOP';
    return 'IMAGE';
  }

  _faxPhasingLinePosition(image, samplesPerLine) {
    const n = Math.max(1, Math.floor(samplesPerLine * 0.07));
    const sampsIncr = Math.max(1, Math.floor(samplesPerLine / this._faxPixPerLine * 4));
    let minTotal = Number.POSITIVE_INFINITY;
    let minPos = 0;

    for (let i = 0; i < samplesPerLine; i += sampsIncr) {
      let total = 0;
      const half = Math.floor(n / 2);

      for (let j = 0; j < half; j++) {
        const idx = (j + i) % samplesPerLine;
        total += image[idx] * j;
      }
      for (let j = half; j < n; j++) {
        const idx = (j + i) % samplesPerLine;
        total += image[idx] * (n - j);
      }

      if (total < minTotal) {
        minTotal = total;
        minPos = i;
      }
    }
    return minPos;
  }

  _faxMedianFromArray(arr, count, pctLo = 10, pctHi = 90) {
    if (!count) return { median: 0, lo: 0, hi: 0 };
    const vals = Array.from(arr.slice(0, count)).sort((a, b) => a - b);
    const mid = vals[Math.floor(vals.length / 2)];
    const lo = vals[Math.max(0, Math.floor(vals.length * pctLo / 100))];
    const hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * pctHi / 100))];
    return { median: mid, lo, hi, vals };
  }

  _faxAveragePhasingPos(arr, count, samplesPerLine) {
    if (!count || samplesPerLine <= 0) return 0;

    const { median, lo, hi, vals } = this._faxMedianFromArray(arr, count, 10, 90);
    if ((hi - lo) > samplesPerLine / 6) {
      return 0;
    }

    // Kiwi stores multiple phasing-line positions and then uses a robust center.
    // Here we keep the same 10/90% spread rejection, then do a wrapped average
    // around the median so lines that straddle the line boundary still average
    // correctly instead of pulling the estimate apart.
    const window = Math.max(8, Math.floor(samplesPerLine * 0.03));
    let acc = 0;
    let used = 0;

    for (let i = 0; i < vals.length; i++) {
      let d = vals[i] - median;
      if (d >  samplesPerLine / 2) d -= samplesPerLine;
      if (d < -samplesPerLine / 2) d += samplesPerLine;
      if (Math.abs(d) <= window) {
        acc += d;
        used++;
      }
    }

    if (!used) return ((median % samplesPerLine) + samplesPerLine) % samplesPerLine;
    const avg = median + acc / used;
    return ((Math.round(avg) % samplesPerLine) + samplesPerLine) % samplesPerLine;
  }

  _faxDecodeImageLine(buffer, bufferLen, outPixels) {
    const spl = bufferLen;
    const width = this._faxPixPerLine;

    for (let i = 0; i < width; i++) {
      const first = Math.floor(spl * i / width);
      const last  = Math.max(first, Math.floor(spl * (i + 1) / width) - 1);
      let acc = 0;
      let cnt = 0;
      for (let s = first; s <= last; s++) {
        acc += buffer[s];
        cnt++;
      }
      outPixels[i] = cnt ? Math.round(acc / cnt) : buffer[first] || 0;
    }
  }

  _faxEmitLine(rawPixels, phasing, stopTone) {
    const PPL = this._faxPixPerLine;
    const out = this._faxLineOut;
    out[0] = rawPixels[0];
    out[PPL - 1] = rawPixels[PPL - 1];

    for (let p = 1; p < PPL - 1; p++) {
      const a = rawPixels[p - 1], b = rawPixels[p], c = rawPixels[p + 1];
      const lo = (a < b) ? a : b;
      const hi = (a < b) ? b : a;
      out[p] = (c <= lo) ? lo : (c >= hi) ? hi : c;
    }

    if (this.faxCallback) {
      const pixels = new Uint8Array(PPL);
      pixels.set(out.subarray(0, PPL));
      this.faxCallback({
        type: 'line',
        pixels,
        lineNum: this._faxLineCount,
        phasing,
        stopTone,
      });
    }
  }

  _faxProcessLine() {
    const spl = this._faxSampPerLine;
    const buf = this._faxLineBuf.subarray(0, spl);
    const rawType = this._faxDetectLineType(buf, spl, spl);

    if (rawType === 'START') {
      this._faxStartCount++;
      this._faxStopCount = 0;
    } else if (rawType === 'STOP') {
      this._faxStopCount++;
      this._faxStartCount = 0;
    } else {
      this._faxStartCount = 0;
      this._faxStopCount = 0;
    }

    const type =
      (this._faxStartCount >= this._faxToneConfirmLines) ? 'START' :
      (this._faxStopCount  >= this._faxToneConfirmLines) ? 'STOP'  : 'IMAGE';

    this._faxPhasing = (type === 'START');
    this._faxStopDetected = (type === 'STOP');

    if (type === 'START') {
      this._faxPhasingLinesLeft = this._faxPhasingLines;
      this._faxPhasingSkipData = 0;
      this._faxHavePhasing = false;
      this._faxSkip = 0;
      this._faxPendingSkip = 0;
    }

    if (this._faxUsePhasing && rawType === 'IMAGE' &&
        this._faxPhasingLinesLeft > this._faxPhasingSkipLines) {
      const idx = this._faxPhasingLinesLeft - this._faxPhasingSkipLines - 1;
      if (idx >= 0 && idx < this._faxPhasingPos.length) {
        this._faxPhasingPos[idx] = this._faxPhasingLinePosition(buf, spl);
      }
    }

    if (this._faxUsePhasing && rawType === 'IMAGE' &&
        this._faxPhasingLinesLeft >= -this._faxPhasingSkipLines) {
      this._faxPhasingLinesLeft--;
      if (this._faxPhasingLinesLeft === 0) {
        const used = Math.max(1, this._faxPhasingLines - this._faxPhasingSkipLines);
        this._faxPhasingSkipData = this._faxAveragePhasingPos(this._faxPhasingPos, used, spl);
      }
    }

    const shouldEmit =
      this._faxIncludeHeadersInImages ||
      !this._faxUsePhasing ||
      (rawType === 'IMAGE' && this._faxPhasingLinesLeft < -this._faxPhasingSkipLines);

    if (shouldEmit) {
      this._faxDecodeImageLine(buf, spl, this._faxLinePix);

      if (this._faxPhasingSkipData && this._faxUsePhasing && !this._faxHavePhasing) {
        this._faxPendingSkip = this._faxPhasingSkipData;
        this._faxHavePhasing = true;
        console.log(`[FAX] phasing aligned: skip=${this._faxPhasingSkipData} samples (multi-line avg)`);
      }

      this._faxLineCount++;
      this._faxEmitLine(this._faxLinePix, this._faxPhasing, this._faxStopDetected);
    }
  }

  /**
   * Feed raw PCM into a KiwiSDR-style HF FAX discriminator.
   * The PCM is expected to be post-demod audio at audioOutputSps,
   * unless an explicit inputSampleRate is supplied (used for native-rate Opus FAX).
   */
  _faxFeedPCM(pcm, inputSampleRate = null) {
    const inSr = inputSampleRate || this.audioOutputSps || 12000;
    const sr = this._faxDecodeSps || 12000;
    const carrier = this._faxCenter;
    const phInc = carrier / sr;
    const maxDev = Math.max(1.0, this._faxShift / 2);
    const ratio = inSr / sr;

    let f = this._faxMixerPhase;
    let Iprev = this._faxIprev;
    let Qprev = this._faxQprev;
    let prevRaw = this._faxPrevRaw;
    let dc = this._faxDc;
    let rsp = this._faxResamplePhase;
    let linePos = this._faxLineBufPos;
    let skip = this._faxSkip;
    let pendingSkip = this._faxPendingSkip;

    const processSample = (sample) => {
      // DC blocking ahead of discriminator materially improves long-run stability.
      dc = 0.9995 * dc + 0.0005 * sample;
      const hp = sample - dc;

      const phase = 2 * Math.PI * f;
      const Icur0 = this._faxApplyFir(this._faxBufI, '_faxBufPosI', hp * Math.cos(phase));
      const Qcur0 = this._faxApplyFir(this._faxBufQ, '_faxBufPosQ', hp * Math.sin(phase));

      f += phInc;
      if (f >= 1.0) f -= 1.0;

      const mag = Math.hypot(Icur0, Qcur0);
      if (mag < 1e-12) return;

      const Icur = Icur0 / mag;
      const Qcur = Qcur0 / mag;

      // Exact phase-difference discriminator is much less likely to drift than
      // the small-angle approximation when the signal level varies.
      let dphi = Math.atan2(Iprev * Qcur - Qprev * Icur, Iprev * Icur + Qprev * Qcur);
      let freq = (dphi * sr) / (2 * Math.PI);
      freq = this._faxCenter + freq;

      let x = (freq - this._faxBlack) / Math.max(1.0, this._faxWhite - this._faxBlack);
      x = 1.0 - x;
      if (!Number.isFinite(x)) return;
      if (x < 0) x = 0;
      else if (x > 1) x = 1;

      Iprev = Icur;
      Qprev = Qcur;

      let pixel = Math.round(x * 255.0);
      if (pixel < 0) pixel = 0;
      else if (pixel > 255) pixel = 255;

      if (skip > 0) {
        skip--;
        return;
      }

      this._faxLineBuf[linePos++] = pixel;
      if (linePos >= this._faxSampPerLine) {
        this._faxLineBufPos = linePos;
        this._faxSkip = skip;
        this._faxPendingSkip = pendingSkip;
        this._faxIprev = Iprev;
        this._faxQprev = Qprev;
        this._faxMixerPhase = f;
        this._faxDc = dc;

        this._faxProcessLine();
        linePos = 0;

        pendingSkip = this._faxPendingSkip;
        if (pendingSkip > 0) {
          skip = pendingSkip;
          pendingSkip = 0;
          this._faxPendingSkip = 0;
        }
      }
    };

    if (Math.abs(inSr - sr) < 1e-6) {
      for (let i = 0; i < pcm.length; i++) processSample(pcm[i]);
    } else {
      for (let i = 0; i < pcm.length; i++) {
        const cur = pcm[i];
        while (rsp <= 1.0) {
          const s = prevRaw + (cur - prevRaw) * rsp;
          processSample(s);
          rsp += ratio;
        }
        rsp -= 1.0;
        prevRaw = cur;
      }
    }

    this._faxMixerPhase = f;
    this._faxIprev = Iprev;
    this._faxQprev = Qprev;
    this._faxPrevRaw = prevRaw;
    this._faxDc = dc;
    this._faxResamplePhase = rsp;
    this._faxLineBufPos = linePos;
    this._faxSkip = skip;
    this._faxPendingSkip = pendingSkip;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  END HF FAX DECODER
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════

  // ── CW decoder (delegates to the soft-decision CWDecoder module) ──────────
  _cwReset() {
    if (!this.cw) {
      this.cw = new CWDecoder({
        sampleRate: this.audioOutputSps || 12000,
        callback: this.cwCallback,
      });
    } else {
      this.cw.setSampleRate(this.audioOutputSps || 12000);
      this.cw.reset();
    }
  }

  setCWDecoding(value) {
    this.decodeCW = value;
    this._rebuildOutputChain();
    if (value) this._cwReset();
  }

  setCWCallback(cb) {
    this.cwCallback = cb;
    if (this.cw) this.cw.setCallback(cb);
  }

  _cwFeedPCM(pcmArray) {
    if (!this.cw) this._cwReset();
    this.cw.setSampleRate(this.audioOutputSps || 12000);
    this.cw.feed(pcmArray);
  }


  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set spectrogram callback for feeding PCM data
   * This is called from App.svelte to register the spectrogram component
   * @param {function} callback - Function to call with PCM data
   */
  setSpectrogramCallback(callback) {
    this.spectrogramCallback = callback;
    this.spectrogramEnabled = !!callback;
    console.log('Spectrogram callback', this.spectrogramEnabled ? 'enabled' : 'disabled');
  }

  /**
   * Enable/disable spectrogram
   * @param {boolean} enabled - Whether to enable spectrogram
   */
  setSpectrogramEnabled(enabled) {
    this.spectrogramEnabled = enabled && !!this.spectrogramCallback;
    console.log('Spectrogram', this.spectrogramEnabled ? 'enabled' : 'disabled');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  NAVTEX / SITOR-B DECODER (Kiwi-style JNX + CCIR476 port)
  //
  //  Also expanded into a generic Kiwi-style FSK decoder with presets for:
  //    • maritime: NAVTEX / SITOR-B, 100 baud, 170 Hz, CCIR-476
  //    • weather : RTTY/ITA2 weather circuits, 50 baud, 450 Hz
  //    • ham     : amateur RTTY/ITA2, 45.45 baud, 170 Hz
  //
  //  All variants share the same Kiwi-style mark/space band-pass detector,
  //  abs-difference logic path, low-pass slicing and edge-timing discipline.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── CCIR-476 character tables (matched to Kiwi CCIR476.js) ──────────────

  static _NAVTEX_LTRS = (() => {
    const t = new Uint8Array(128);
    const m = [
      [0x17,'J'],[0x1B,'F'],[0x1D,'C'],[0x1E,'K'],
      [0x27,'W'],[0x2B,'Y'],[0x2D,'P'],[0x2E,'Q'],
      [0x35,'G'],[0x39,'M'],[0x3A,'X'],[0x3C,'V'],
      [0x47,'A'],[0x4B,'S'],[0x4D,'I'],[0x4E,'U'],
      [0x53,'D'],[0x55,'R'],[0x56,'E'],[0x59,'N'],[0x5A,'_'],[0x5C,' '],
      [0x63,'Z'],[0x65,'L'],[0x66,'_'],[0x69,'H'],[0x6A,'_'],[0x6C,'\n'],
      [0x71,'O'],[0x72,'B'],[0x74,'T'],[0x78,'\r'],
    ];
    for (const [c, ch] of m) t[c] = ch.charCodeAt(0);
    return t;
  })();

  static _NAVTEX_FIGS = (() => {
    const t = new Uint8Array(128);
    const m = [
      [0x17,39 ],[0x1B,33 ],[0x1D,58 ],[0x1E,40 ],
      [0x27,50 ],[0x2B,54 ],[0x2D,48 ],[0x2E,49 ],
      [0x35,38 ],[0x39,46 ],[0x3A,47 ],[0x3C,59 ],
      [0x47,45 ],[0x4B,7  ],[0x4D,56 ],[0x4E,55 ],
      [0x53,36 ],[0x55,52 ],[0x56,51 ],[0x59,44 ],[0x5A,'_'.charCodeAt(0)],[0x5C,32 ],
      [0x63,34 ],[0x65,41 ],[0x66,'_'.charCodeAt(0)],[0x69,35 ],[0x6A,'_'.charCodeAt(0)],[0x6C,10 ],
      [0x71,57 ],[0x72,63 ],[0x74,53 ],[0x78,13 ],
    ];
    for (const [c, cc] of m) t[c] = cc;
    return t;
  })();

  // ── ITA2 / Baudot tables for weather + ham RTTY ────────────────────────

  static _FSK_ITA2_LTRS = (() => {
    const t = new Array(32).fill('');
    const m = {
      0x00: '', 0x01:'E', 0x02:'\n', 0x03:'A', 0x04:' ', 0x05:'S', 0x06:'I', 0x07:'U',
      0x08:'\r', 0x09:'D', 0x0A:'R', 0x0B:'J', 0x0C:'N', 0x0D:'F', 0x0E:'C', 0x0F:'K',
      0x10:'T', 0x11:'Z', 0x12:'L', 0x13:'W', 0x14:'H', 0x15:'Y', 0x16:'P', 0x17:'Q',
      0x18:'O', 0x19:'B', 0x1A:'G', 0x1B:'FIGS', 0x1C:'M', 0x1D:'X', 0x1E:'V', 0x1F:'LTRS'
    };
    for (const [k,v] of Object.entries(m)) t[Number(k)] = v;
    return t;
  })();

  static _FSK_ITA2_FIGS = (() => {
    const t = new Array(32).fill('');
    const m = {
      0x00: '', 0x01:'3', 0x02:'\n', 0x03:'-', 0x04:' ', 0x05:"'", 0x06:'8', 0x07:'7',
      0x08:'\r', 0x09:'$', 0x0A:'4', 0x0B:"'", 0x0C:',', 0x0D:'!', 0x0E:':', 0x0F:'(',
      0x10:'5', 0x11:'"', 0x12:')', 0x13:'2', 0x14:'#', 0x15:'6', 0x16:'0', 0x17:'1',
      0x18:'9', 0x19:'?', 0x1A:'&', 0x1B:'FIGS', 0x1C:'.', 0x1D:'/', 0x1E:';', 0x1F:'LTRS'
    };
    for (const [k,v] of Object.entries(m)) t[Number(k)] = v;
    return t;
  })();

  static _NV_STATE_NOSIGNAL  = 0;
  static _NV_STATE_SYNC1     = 1;
  static _NV_STATE_SYNC2     = 2;
  static _NV_STATE_READ_DATA = 3;

  static _NV_ALPHA  = 0x0F;
  static _NV_BETA   = 0x33;
  static _NV_FIGS   = 0x36;
  static _NV_LTRS   = 0x5A;
  static _NV_REP    = 0x66;
  static _NV_CHAR32 = 0x6A;

  // ── Public API: legacy NAVTEX compatibility ─────────────────────────────

  setNAVTEXDecoding(enabled) {
    this.decodeNAVTEX = !!enabled;
    this._navtexReset();
    console.log('[NAVTEX]', enabled ? '▶ ENABLED' : '■ DISABLED');
  }

  setNAVTEXCallback(fn) {
    this.navtexCallback = fn || null;
  }

  // ── Public API: generic Kiwi-style FSK presets ──────────────────────────

  setFSKVariant(variant = 'maritime') {
    const v = String(variant || 'maritime').toLowerCase();
    if (v !== 'weather' && v !== 'maritime' && v !== 'ham') {
      console.warn('[FSK] unknown variant:', variant, '— using maritime');
      this.fskVariant = 'maritime';
    } else {
      this.fskVariant = v;
    }
    this._fskReset();
    console.log('[FSK] variant =', this.fskVariant);
  }

  setFSKConfig(cfg = null) {
    if (!cfg || typeof cfg !== 'object') {
      this.fskCustomConfig = null;
      this._fskReset();
      return;
    }
    this.fskCustomConfig = { ...cfg };
    this._fskReset();
    console.log('[FSK] custom config =', this.fskCustomConfig);
  }

  getFSKConfig() {
    return { ...(this._nvPreset || this._fskResolveConfig(this.fskVariant || 'maritime')) };
  }

  setFSKDecoding(enabled, variant = null) {
    if (variant) this.setFSKVariant(variant);
    this.decodeFSK = !!enabled;
    this._fskReset();
    console.log(`[FSK] ${enabled ? '▶ ENABLED' : '■ DISABLED'} (${this.fskVariant})`);
  }

  setFSKCallback(fn) {
    this.fskCallback = fn || null;
  }


  setFSKAutoShift(enabled) {
    this._fskAutoShift = !!enabled;
    if (!this._fskAutoShift) this._fskLastAutoShiftAt = 0;
  }

  // Trigger a one-shot auto-center scan on the next available PCM buffer.
  // Called from the UI "Auto-tune" button.
  setFSKAutoCenter(enabled) {
    this._fskAutoCenterPending = !!enabled;
    this._fskLastAutoCenterAt  = 0;
  }

  // ── Small internal biquad helper (ported from Kiwi BiQuadraticFilter.js) ─

  _nvBiquadCreate() {
    return {
      b0: 0, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0,
      x1: 0, x2: 0, y1: 0, y2: 0,
    };
  }

  _nvBiquadReset(f) {
    f.x1 = f.x2 = f.y1 = f.y2 = 0;
  }

  _nvBiquadConfigure(f, type, centerFreq, sampleRate, Q, gainDB = 0) {
    this._nvBiquadReset(f);
    Q = (Q === 0) ? 1e-9 : Q;
    const gainAbs = Math.pow(10, gainDB / 40);
    const omega = 2 * Math.PI * centerFreq / sampleRate;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const alpha = sn / (2 * Q);
    let a0, a1, a2, b0, b1, b2;

    switch (type) {
      case 'bandpass':
        b0 = alpha; b1 = 0; b2 = -alpha;
        a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
        break;
      case 'lowpass':
      default:
        b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2;
        a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
        break;
    }

    f.a0 = a0;
    f.b0 = b0 / a0;
    f.b1 = b1 / a0;
    f.b2 = b2 / a0;
    f.a1 = a1 / a0;
    f.a2 = a2 / a0;
  }

  _nvBiquadFilter(f, x) {
    const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
    f.x2 = f.x1; f.x1 = x;
    f.y2 = f.y1; f.y1 = y;
    return y;
  }

  _fskGetPreset(variant = this.fskVariant || 'maritime') {
    switch (String(variant || 'maritime').toLowerCase()) {
      case 'weather':
        return {
          name: 'weather', center: 1000.0, shift: 450.0, baud: 50.0,
          lowpass: 65.0, audioMinimum: 96.0, protocol: 'ita2', encoding: 'ita2', framing: '5N1.5',
          dataBits: 5, parity: 'N', stopBits: 1.5,
          // In USB, mark (idle/1) is the LOWER tone; space (0) is the higher.
          // FM discriminator outputs positive for HIGHER freq, so without inversion
          // markState=1 would map to space — every bit inverted. inverted:1 corrects this.
          inverted: 1,
        };
      case 'ham':
        return {
          name: 'ham', center: 1000.0, shift: 170.0, baud: 45.45,
          lowpass: 55.0, audioMinimum: 72.0, protocol: 'ita2', encoding: 'ita2', framing: '5N1.5',
          dataBits: 5, parity: 'N', stopBits: 1.5,
          // Same USB mark/space polarity as weather: mark=lower tone → inverted:1.
          inverted: 1,
        };
      case 'maritime':
      default:
        return {
          name: 'maritime', center: 500.0, shift: 170.0, baud: 100.0,
          lowpass: 140.0, audioMinimum: 256.0, protocol: 'ccir476', encoding: 'ccir476', framing: '7N1',
          dataBits: 7, parity: 'N', stopBits: 1.0, inverted: 0,
        };
    }
  }

  _fskResolveConfig(variant = this.fskVariant || 'maritime') {
    const preset = { ...this._fskGetPreset(variant) };
    const cfg = this.fskCustomConfig || {};
    const out = { ...preset };

    if (cfg.variant) out.name = String(cfg.variant).toLowerCase();

    const num = (v, fb) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fb;
    };

    out.center = Math.max(100, num(cfg.center, out.center));
    out.shift = Math.max(20, num(cfg.shift, out.shift));
    out.baud = Math.max(10, num(cfg.baud, out.baud));
    out.lowpass = Math.max(20, num(cfg.lowpass, Math.max(60, out.baud * 2.2)));
    out.audioMinimum = Math.max(32, num(cfg.audioMinimum, out.audioMinimum));
    out.inverted = cfg.inverted ? 1 : 0;

    const enc = String(cfg.encoding || cfg.encode || out.encoding || out.protocol || 'ita2').toLowerCase();
    out.encoding = enc;
    out.protocol = enc;

    let framing = String(cfg.framing || out.framing || '5N1.5').toUpperCase().replace(/\s+/g, '');
    const m = framing.match(/^(\d)([NEO])([12](?:\.5)?|1\.5)$/);
    if (m) {
      out.dataBits = parseInt(m[1], 10);
      out.parity = m[2];
      out.stopBits = parseFloat(m[3]);
      out.framing = framing;
    } else {
      out.dataBits = out.dataBits || 5;
      out.parity = out.parity || 'N';
      out.stopBits = out.stopBits || 1.5;
      out.framing = `${out.dataBits}${out.parity}${out.stopBits}`;
    }

    if (cfg.dataBits != null) out.dataBits = Math.max(5, Math.min(8, Math.round(num(cfg.dataBits, out.dataBits))));
    if (cfg.parity) out.parity = String(cfg.parity).toUpperCase().slice(0,1);
    if (cfg.stopBits != null) out.stopBits = num(cfg.stopBits, out.stopBits);

    if (enc === 'ccir476') {
      out.dataBits = 7;
      out.parity = 'N';
      out.stopBits = 1.0;
      out.framing = '7N1';
    }

    if (enc === 'ita2' && out.dataBits < 5) out.dataBits = 5;
    out.framing = `${out.dataBits}${out.parity}${out.stopBits}`;
    return out;
  }

  // ── State reset / setup ───────────────────────────────────────────────────

  _navtexReset() {
    this._nvApplyPreset(this._fskGetPreset('maritime'));
    this._nvResetMessageFraming();
  }

  _fskReset() {
    const preset = this._fskResolveConfig(this.fskVariant || 'maritime');
    this._nvApplyPreset(preset);

    this._fskShift = false;
    this._fskFigsRunLen = 0;
    this._fskAsyncState = 'hunt';
    this._fskAsyncBits = 0;
    this._fskAsyncBitIndex = 0;
    this._fskAsyncCenter = 0;
    this._fskPrevBit = 1;
    this._fskAutoShift = this._fskAutoShift !== false;
    this._fskLastAutoShiftAt = 0;
    this._fskLastMetricsAt = 0;
    this._fskTimingLock = false;
    this._fskTimingAnnounced = false;
    this._fskCharsDecoded = 0;
    this._fskInvalidFrames = 0;
    this._fskSignalEMA = 0;
    this._fskNoiseEMA = 0;
    this._fskRecentPCM = [];
  }

  _nvApplyPreset(preset) {
    const SR = this.trueAudioSps || this.audioOutputSps || 12000;

    this._nvPreset = { ...preset };
    this._nvSampleRate = SR;
    this._nvCenterFreq = preset.center;
    this._nvShiftHz = preset.shift;
    this._nvDeviation = this._nvShiftHz / 2.0;
    this._nvBaudRate = preset.baud;
    this._nvLowpassFreq = preset.lowpass;
    this._fskEncoding = String(preset.encoding || preset.protocol || 'ita2').toLowerCase();
    this._fskDataBits = Math.max(5, Math.min(8, preset.dataBits || 5));
    this._fskParity = String(preset.parity || 'N').toUpperCase();
    this._fskStopBits = Number.isFinite(Number(preset.stopBits)) ? Number(preset.stopBits) : 1.5;
    this._nvInvSqrt2 = 1.0 / Math.sqrt(2.0);
    this._nvMsb = 0x40;
    this._nvNbits = 7;

    this._nvAudioAverage = 0.0;
    this._nvAudioAverageTc = 1000.0 / SR;
    this._nvAudioMinimum = preset.audioMinimum;

    this._nvBitSampleCount  = Math.max(1, Math.round(SR / this._nvBaudRate));
    this._nvBitPeriodTrue   = SR / this._nvBaudRate;   // exact float — used by frac accumulator
    this._nvBitPeriodFrac   = 0.0;                     // sub-sample remainder carried between bits
    this._nvHalfBitSampleCount = this._nvBitSampleCount / 2.0;

    this._nvBitCount = 0;
    this._nvCodeBits = 0;
    this._nvErrorCount = 0;
    this._nvValidCount = 0;
    this._nvSyncChars = [];
    this._nvWaiting = false;

    this._nvSignalAccumulator = 0;
    this._nvBitDuration = 0;
    this._nvSampleCount = 0;
    this._nvNextEventCount = 0;
    this._nvAveragedMarkState = 0;
    this._nvOldMarkState = false;
    this._nvPulseEdgeEvent = false;
    this._nvSyncDelta = 0;
    this._nvBaudError = 0;
    this._nvInverted = preset.inverted ? 1 : 0;

    // Async mode flag: ITA2 (ham/weather RTTY) re-anchors the bit clock on
    // every start-bit edge, which gives better synchronisation than the
    // zero-crossing sync designed for continuous synchronous CCIR-476 data.
    // When async, _nvSyncDelta is never applied so stale or noise-derived
    // corrections can't corrupt the clean start-bit re-anchor.
    this._nvAsyncMode = (preset.protocol === 'ita2');

    this._nvZeroCrossingSamples = 16;
    this._nvZeroCrossingsDivisor = 4;
    this._nvZeroCrossingCount = 0;
    this._nvZeroCrossings = new Array(Math.max(1, Math.ceil(this._nvBitSampleCount / this._nvZeroCrossingsDivisor))).fill(0);

    // Q is chosen so each bandpass filter's 3 dB bandwidth is ~40% of the
    // tone shift, keeping the mark and space filters well-separated while
    // still having a wide enough pass-band to track the signal.
    // Old formula (q = 6 * center / 1000) gave Q≈6 for all 1000 Hz center
    // cases, producing ~167 Hz bandwidth that heavily overlapped with a
    // 170 Hz shift — the main cause of ham/weather RTTY decoding errors.
    const q = Math.max(3, this._nvCenterFreq / (this._nvShiftHz * 0.4));
    // Mark is the higher tone; space is the lower tone.
    const markFreq  = this._nvCenterFreq + this._nvDeviation;
    const spaceFreq = this._nvCenterFreq - this._nvDeviation;

    this._nvMarkFilter = this._nvBiquadCreate();
    this._nvSpaceFilter = this._nvBiquadCreate();
    this._nvLowFilter = this._nvBiquadCreate();
    this._nvBiquadConfigure(this._nvMarkFilter, 'bandpass', markFreq, SR, q);
    this._nvBiquadConfigure(this._nvSpaceFilter, 'bandpass', spaceFreq, SR, q);
    this._nvBiquadConfigure(this._nvLowFilter, 'lowpass', this._nvLowpassFreq, SR, this._nvInvSqrt2);

    this._nvState = SpectrumAudio._NV_STATE_NOSIGNAL;
    this._nvSyncSetup = 1;

    this._nvShift = false;
    this._nvAlphaPhase = false;
    this._nvC1 = 0;
    this._nvC2 = 0;
    this._nvC3 = 0;
    this._nvStrictMode = false;
    this._nvSucceedTally = 0;
    this._nvFailTally = 0;

    // ── FM phase discriminator state (ITA2/RTTY paths only) ──────────────────
    // CCIR-476 (NAVTEX/maritime) keeps the dual-BPF envelope detector which
    // works well because SITOR-B FEC corrects residual errors.  ITA2 variants
    // (ham, weather) have no FEC so every bit error shows as a garbled character;
    // a proper FM discriminator is far more robust than dual-BPF on these modes.
    this._fmPhase   = 0.0;
    this._fmPrevI   = 0.0;
    this._fmPrevQ   = 0.0;
    this._fmILPF    = this._nvBiquadCreate();
    this._fmQLPF    = this._nvBiquadCreate();
    this._fmDiscLPF = this._nvBiquadCreate();
    if (preset.protocol === 'ita2') {
      // I/Q arm lowpass: passes ±shift/2 from baseband while removing the
      // 2×centre image produced by the complex mixer.
      // shift×0.7 comfortably covers both tones without wasting noise bandwidth.
      const iqLP = Math.max(this._nvShiftHz * 0.7, this._nvBaudRate * 2.0);
      this._nvBiquadConfigure(this._fmILPF,    'lowpass', iqLP, SR, this._nvInvSqrt2);
      this._nvBiquadConfigure(this._fmQLPF,    'lowpass', iqLP, SR, this._nvInvSqrt2);
      // Post-discriminator LPF: 0.75× baud — rejects inter-bit noise while
      // tracking the fastest transitions without introducing ISI distortion.
      this._nvBiquadConfigure(this._fmDiscLPF, 'lowpass', this._nvBaudRate * 0.75, SR, this._nvInvSqrt2);
      // Adaptive threshold — EMA of mark-side and space-side disc outputs.
      // Seeded with small non-zero values so the midpoint starts at 0.
      this._fskMarkEMA  =  0.1;
      this._fskSpaceEMA = -0.1;
      this._fskThresh   =  0.0;
    }
  }

  _nvResetMessageFraming() {
    this._nvInMsg = false;
    this._nvRawWin = '';
    this._nvMsgTail = '';
    this._nvStation = '';
    this._nvSubject = '';
    this._nvSerial = '';
  }

  _nvSetState(s) {
    this._nvState = s;
  }

  _nvCheckBits(v) {
    v &= 0x7F;
    let bc = 0;
    while (v !== 0) {
      bc++;
      v &= v - 1;
    }
    return bc === 4;
  }

  _nvCodeToChar(code, shift) {
    const tbl = shift ? SpectrumAudio._NAVTEX_FIGS : SpectrumAudio._NAVTEX_LTRS;
    const cc = tbl[code & 0x7F];
    return cc ? String.fromCharCode(cc) : null;
  }

  _nvDecoderReset() {
    this._nvBitCount = 0;
    this._nvCodeBits = 0;
    this._nvErrorCount = 0;
    this._nvValidCount = 0;
    this._nvWaiting = false;
    this._nvShift = false;
    this._nvAlphaPhase = false;
    this._nvC1 = 0;
    this._nvC2 = 0;
    this._nvC3 = 0;
    this._nvSyncChars = [];
  }

  // ── PCM ingestion / Kiwi JNX-style demodulation ──────────────────────────

  _navtexFeedPCM(pcm) {
    if (!this.decodeNAVTEX || !pcm || !pcm.length) return;
    this._nvFeedPCMCommon(pcm, 'maritime', true);
  }

  _fskFeedPCM(pcm) {
    if (!this.decodeFSK || !pcm || !pcm.length) return;
    if (!this._fskRecentPCM) this._fskRecentPCM = [];
    for (let i = 0; i < pcm.length; i++) this._fskRecentPCM.push(pcm[i]);
    const keep = Math.max(1024, Math.floor((this.trueAudioSps || this.audioOutputSps || 12000) * 1.2));
    if (this._fskRecentPCM.length > keep) this._fskRecentPCM.splice(0, this._fskRecentPCM.length - keep);
    this._nvFeedPCMCommon(pcm, this.fskVariant || 'maritime', false);
  }

  _nvFeedPCMCommon(pcm, variant, legacyNavtexMode = false) {
    const preset = this._fskGetPreset(variant);
    if (!this._nvPreset || this._nvPreset.name !== preset.name || this._nvSampleRate !== (this.trueAudioSps || this.audioOutputSps || 12000)) {
      this._nvApplyPreset(preset);
      if (preset.protocol === 'ita2') this._fskReset();
      if (legacyNavtexMode) this._nvResetMessageFraming();
    }

    for (let i = 0; i < pcm.length; i++) {
      const dv = pcm[i] * 32768.0;

      let logicLevel, markState;

      if (preset.protocol === 'ita2') {
        // ── FM phase discriminator (ham / weather RTTY) ─────────────────────
        // Step 1: mix signal down to complex baseband at the centre frequency.
        const twoPiFs = 2.0 * Math.PI * this._nvCenterFreq / (this._nvSampleRate || 12000);
        this._fmPhase += twoPiFs;
        if (this._fmPhase > Math.PI) this._fmPhase -= 2.0 * Math.PI;
        const iRaw =  dv * Math.cos(this._fmPhase);
        const qRaw = -dv * Math.sin(this._fmPhase);

        // Step 2: lowpass I and Q — removes 2×fc image, passes both tones.
        const iLP = this._nvBiquadFilter(this._fmILPF, iRaw);
        const qLP = this._nvBiquadFilter(this._fmQLPF, qRaw);

        // Step 3: phase discriminator.
        //   disc = sin(Δφ) = I[n-1]·Q[n] − Q[n-1]·I[n]
        //   Positive when instantaneous frequency > centre  →  mark tone.
        //   Negative when instantaneous frequency < centre  →  space tone.
        const disc = this._fmPrevI * qLP - this._fmPrevQ * iLP;
        this._fmPrevI = iLP;
        this._fmPrevQ = qLP;

        // Step 4: normalise by signal power for amplitude-independent output.
        const power = iLP * iLP + qLP * qLP + 1e-10;

        // Step 5: post-discriminator LPF — bit-rate matched noise rejection.
        logicLevel = this._nvBiquadFilter(this._fmDiscLPF, disc / power);

        // Step 6: adaptive midpoint threshold.
        //   Track separate EMAs for samples landing on the mark side vs the
        //   space side of the current threshold, then use their midpoint as
        //   the new threshold.  This continuously cancels the DC bias that
        //   accumulates whenever the centre frequency is even slightly off,
        //   without needing periodic auto-tune scans.
        if (logicLevel > this._fskThresh) {
          this._fskMarkEMA  += (logicLevel - this._fskMarkEMA)  * 0.005;
        } else {
          this._fskSpaceEMA += (logicLevel - this._fskSpaceEMA) * 0.005;
        }
        this._fskThresh = (this._fskMarkEMA + this._fskSpaceEMA) * 0.5;
        markState = (logicLevel > this._fskThresh);

        // Signal level tracking via IQ envelope (same scale as dual-BPF path).
        const envelope = Math.sqrt(power);
        this._nvAudioAverage += (envelope - this._nvAudioAverage) * this._nvAudioAverageTc;
        this._nvAudioAverage = Math.max(0.1, this._nvAudioAverage);

        if (!legacyNavtexMode) {
          this._fskSignalEMA += (envelope - this._fskSignalEMA) * 0.01;
          // Noise proxy: envelope × constant fraction (gives ~26 dB display SNR
          // on clean signals; drops toward 0 dB when the signal fades).
          this._fskNoiseEMA += (envelope * 0.05 + 1e-9 - this._fskNoiseEMA) * 0.01;
        }
      } else {
        // ── Dual-BPF envelope detector (CCIR-476 / NAVTEX / maritime) ───────
        const markLevel  = this._nvBiquadFilter(this._nvMarkFilter, dv);
        const spaceLevel = this._nvBiquadFilter(this._nvSpaceFilter, dv);
        const markAbs    = Math.abs(markLevel);
        const spaceAbs   = Math.abs(spaceLevel);

        this._nvAudioAverage += (Math.max(markAbs, spaceAbs) - this._nvAudioAverage) * this._nvAudioAverageTc;
        this._nvAudioAverage = Math.max(0.1, this._nvAudioAverage);

        const diffAbs = (markAbs - spaceAbs) / this._nvAudioAverage;
        logicLevel = this._nvBiquadFilter(this._nvLowFilter, diffAbs);
        markState  = (logicLevel > 0);

        if (!legacyNavtexMode) {
          const signalNow = Math.max(markAbs, spaceAbs);
          const noiseNow  = Math.min(markAbs, spaceAbs) + 1e-9;
          this._fskSignalEMA += (signalNow - this._fskSignalEMA) * 0.01;
          this._fskNoiseEMA  += (noiseNow  - this._fskNoiseEMA)  * 0.01;
        }
      }

      this._nvSignalAccumulator += markState ? 1 : -1;
      this._nvBitDuration++;

      if (markState !== this._nvOldMarkState) {
        if ((this._nvBitDuration % this._nvBitSampleCount) > this._nvHalfBitSampleCount) {
          let index = Math.floor((this._nvSampleCount - this._nvNextEventCount + this._nvBitSampleCount * 8) % this._nvBitSampleCount);
          index = Math.floor(index / this._nvZeroCrossingsDivisor);
          if (index >= 0 && index < this._nvZeroCrossings.length) this._nvZeroCrossings[index]++;
        }
        this._nvBitDuration = 0;
      }
      this._nvOldMarkState = markState;

      if ((this._nvSampleCount % this._nvBitSampleCount) === 0) {
        this._nvZeroCrossingCount++;
        if (this._nvZeroCrossingCount >= this._nvZeroCrossingSamples) {
          let best = 0;
          let bestIndex = 0;
          for (let j = 0; j < this._nvZeroCrossings.length; j++) {
            const q = this._nvZeroCrossings[j];
            this._nvZeroCrossings[j] = 0;
            if (q > best) {
              best = q;
              bestIndex = j;
            }
          }
          if (best > 0) {
            let index = bestIndex * this._nvZeroCrossingsDivisor;
            index = ((index + this._nvHalfBitSampleCount) % this._nvBitSampleCount) - this._nvHalfBitSampleCount;
            index /= 8.0;
            this._nvSyncDelta = index;
            this._nvBaudError = index;
          }
          this._nvZeroCrossingCount = 0;
        }
      }

      this._nvPulseEdgeEvent = (this._nvSampleCount >= this._nvNextEventCount);
      if (this._nvPulseEdgeEvent) {
        this._nvAveragedMarkState = ((this._nvSignalAccumulator > 0) ? 1 : 0) ^ this._nvInverted;
        this._nvSignalAccumulator = 0;
        // Fractional bit-period accumulator: compensates for the rounding
        // error in _nvBitSampleCount (e.g. ham RTTY 45.45 Bd @ 12 kHz =
        // 263.956 samples/bit — rounded to 264, error −0.044/bit).
        // Every ~23 bits the accumulator crosses ±0.5 and fires a ±1-sample
        // correction, keeping the long-run average period exact.
        // For maritime (120.0) and weather (240.0) the error is 0 — no-op.
        this._nvBitPeriodFrac += this._nvBitPeriodTrue - this._nvBitSampleCount;
        const _bpCorr = Math.round(this._nvBitPeriodFrac);
        this._nvBitPeriodFrac -= _bpCorr;
        // For async ITA2: do NOT apply _nvSyncDelta — the zero-crossing sync
        // fires on absolute sample count (not relative to the bit clock anchor)
        // so after a start-bit re-anchor its corrections are phase-noise.
        // Start-bit re-anchoring already gives exact alignment; _nvSyncDelta
        // would only corrupt it.  CCIR-476 (synchronous, no re-anchor) still
        // benefits from the sync correction, so we keep it there.
        const _syncCorr = this._nvAsyncMode ? 0 : Math.floor(this._nvSyncDelta + 0.5);
        this._nvNextEventCount = this._nvSampleCount + this._nvBitSampleCount + _bpCorr + _syncCorr;
        this._nvSyncDelta = 0;
      }

      if (this._nvAudioAverage < this._nvAudioMinimum) {
        if (this._nvState !== SpectrumAudio._NV_STATE_NOSIGNAL) {
          this._nvSetState(SpectrumAudio._NV_STATE_NOSIGNAL);
          if (!legacyNavtexMode && this.fskCallback) {
            this.fskCallback({ type: 'status', variant: preset.name, text: 'No signal' });
          }
        }
      } else if (this._nvState === SpectrumAudio._NV_STATE_NOSIGNAL) {
        this._nvSyncSetup = 1;
      }

      if (this._nvPulseEdgeEvent) {
        if (preset.protocol === 'ccir476') {
          this._nvHandleBit(this._nvAveragedMarkState ? 1 : 0);
        } else {
          this._fskHandleAsyncBit(this._nvAveragedMarkState ? 1 : 0, preset);
        }
      }

      this._nvSampleCount++;

      if (!legacyNavtexMode && this.fskCallback) {
        const nowMs = (this._nvSampleCount / (this._nvSampleRate || 12000)) * 1000;
        if ((nowMs - (this._fskLastMetricsAt || 0)) >= 250) {
          this._fskLastMetricsAt = nowMs;
          const snrDb = 20 * Math.log10(((this._fskSignalEMA || 1e-6) + 1e-6) / ((this._fskNoiseEMA || 1e-6) + 1e-6));
          const succ = this._nvSucceedTally || this._fskCharsDecoded || 0;
          const fail = this._nvFailTally || this._fskInvalidFrames || 0;
          const lockQuality = Math.max(0, Math.min(100, Math.round(100 * succ / Math.max(1, succ + fail))));
          this.fskCallback({
            type: 'metrics',
            variant: preset.name,
            snrDb,
            lockQuality,
            centerHz: this._nvCenterFreq,
            shiftHz: this._nvShiftHz,
            // USB RTTY: mark = lower tone, space = higher tone.
            // _nvInverted=1 means the preset uses standard USB polarity.
            markHz:  this._nvInverted
              ? this._nvCenterFreq - this._nvShiftHz / 2
              : this._nvCenterFreq + this._nvShiftHz / 2,
            spaceHz: this._nvInverted
              ? this._nvCenterFreq + this._nvShiftHz / 2
              : this._nvCenterFreq - this._nvShiftHz / 2,
            baud: this._nvBaudRate,
            timingLocked: !!this._fskTimingLock,
            inverted: !!this._nvInverted
          });
        }
        if (this._fskAutoShift && preset.protocol !== 'ccir476' && (nowMs - (this._fskLastAutoShiftAt || 0)) >= 1500 && this._fskCharsDecoded < 2) {
          this._fskLastAutoShiftAt = nowMs;
          this._fskTryAutoShift(preset);
        }
        // Auto-center: run when manually requested OR when decoding is failing badly.
        // Throttled to once every 4 s to avoid spinning the CPU.
        const autoCenterDue = this._fskAutoCenterPending ||
          ((this._fskInvalidFrames || 0) > 30 && (this._fskCharsDecoded || 0) < 3);
        if (preset.protocol !== 'ccir476' && autoCenterDue &&
            (nowMs - (this._fskLastAutoCenterAt || 0)) >= 4000) {
          this._fskLastAutoCenterAt = nowMs;
          this._fskAutoCenterPending = false;
          this._fskTryAutoCenter(preset);
        }
      }
    }
  }

  // ── Kiwi JNX-style sync/read state machine for CCIR-476 ─────────────────

  _nvHandleBit(bit) {
    const NV = SpectrumAudio;

    if (this._nvSyncSetup) {
      this._nvDecoderReset();
      this._nvSetState(NV._NV_STATE_SYNC1);
      this._nvSyncSetup = 0;
    }

    switch (this._nvState) {
      case NV._NV_STATE_NOSIGNAL:
        break;

      case NV._NV_STATE_SYNC1:
        this._nvCodeBits = (this._nvCodeBits >> 1) | (bit ? this._nvMsb : 0);
        if (this._nvCheckBits(this._nvCodeBits)) {
          this._nvSyncChars.push(this._nvCodeBits);
          this._nvValidCount++;
          this._nvBitCount = 0;
          this._nvCodeBits = 0;
          this._nvSetState(NV._NV_STATE_SYNC2);
          this._nvWaiting = true;
        }
        break;

      case NV._NV_STATE_SYNC2:
        this._nvWaiting = false;
        this._nvCodeBits = (this._nvCodeBits >> 1) | (bit ? this._nvMsb : 0);
        this._nvBitCount++;
        if (this._nvBitCount === this._nvNbits) {
          if (this._nvCheckBits(this._nvCodeBits)) {
            this._nvSyncChars.push(this._nvCodeBits);
            this._nvCodeBits = 0;
            this._nvBitCount = 0;
            this._nvValidCount++;

            if (this._nvValidCount === 4) {
              for (let k = 0; k < this._nvSyncChars.length; k++) {
                const rv = this._nvProcessCode(this._nvSyncChars[k]);
                if (rv.tally === 1) this._nvSucceedTally++;
                else if (rv.tally === -1) this._nvFailTally++;
              }
              this._nvSetState(NV._NV_STATE_READ_DATA);
              if (this.navtexCallback) this.navtexCallback({ type: 'status', text: 'Phasing — sync acquired' });
              if (this.decodeFSK && this.fskVariant === 'maritime' && this.fskCallback) {
                this.fskCallback({ type: 'status', variant: 'maritime', text: 'Phasing — sync acquired' });
              }
            }
          } else {
            this._nvCodeBits = 0;
            this._nvBitCount = 0;
            this._nvSyncSetup = 1;
          }
          this._nvWaiting = true;
        }
        break;

      case NV._NV_STATE_READ_DATA:
        this._nvWaiting = false;
        this._nvCodeBits = (this._nvCodeBits >> 1) | (bit ? this._nvMsb : 0);
        this._nvBitCount++;
        if (this._nvBitCount === this._nvNbits) {
          const rv = this._nvProcessCode(this._nvCodeBits);
          if (rv.tally === 1) this._nvSucceedTally++;
          else if (rv.tally === -1) this._nvFailTally++;

          if (rv.success) {
            if (this._nvErrorCount > 0) this._nvErrorCount--;
          } else {
            this._nvErrorCount++;
            if (this._nvErrorCount > 2) {
              this._nvSyncSetup = 1;
              if (this.navtexCallback) this.navtexCallback({ type: 'status', text: 'Sync lost — scanning…' });
              if (this.decodeFSK && this.fskVariant === 'maritime' && this.fskCallback) {
                this.fskCallback({ type: 'status', variant: 'maritime', text: 'Sync lost — scanning…' });
              }
            }
          }
          this._nvBitCount = 0;
          this._nvCodeBits = 0;
          this._nvWaiting = true;
        }
        break;
    }
  }

  // ── Kiwi CCIR-476 decoder ────────────────────────────────────────────────

  _nvProcessCode(code) {
    const NV = SpectrumAudio;
    const success = this._nvCheckBits(code);
    let tally = 0;
    let chr = -1;

    if (code === NV._NV_REP) {
      this._nvAlphaPhase = false;
    } else if (code === NV._NV_ALPHA) {
      this._nvAlphaPhase = true;
    }

    if (!this._nvAlphaPhase) {
      this._nvC1 = this._nvC2;
      this._nvC2 = this._nvC3;
      this._nvC3 = code;
    } else {
      if (this._nvStrictMode) {
        if (success && this._nvC1 === code) chr = code;
      } else {
        if (success) chr = code;
        else if (this._nvCheckBits(this._nvC1)) chr = this._nvC1;
      }

      if (chr === -1) {
        tally = -1;
      } else {
        tally = 1;
        switch (chr) {
          case NV._NV_REP:
          case NV._NV_ALPHA:
          case NV._NV_BETA:
          case NV._NV_CHAR32:
            break;
          case NV._NV_LTRS:
            this._nvShift = false;
            break;
          case NV._NV_FIGS:
            this._nvShift = true;
            break;
          default: {
            const ch = this._nvCodeToChar(chr, this._nvShift);
            if (ch) this._nvEmitCCIRChar(ch);
            break;
          }
        }
      }
    }

    this._nvAlphaPhase = !this._nvAlphaPhase;
    return { success, tally };
  }

  // ── Async FSK decoder for weather / ham and custom RTTY/ASCII ───────────

  _fskHandleAsyncBit(bit, preset) {
    // Async ham/weather FSK must not depend on NAVTEX/SITOR sync state.
    // Keep timing lock advisory-only and driven by async start-edge activity.
    const dataBits = this._fskDataBits || 5;
    const parityMode = this._fskParity || 'N';
    const needParity = parityMode !== 'N';
    // One recovered decision arrives per bit period. The receiver only needs to
    // confirm *one* stop-bit sample before resynchronising on the next start bit.
    // Using Math.ceil(stopBits) for 1.5/2-stop-bit RTTY would demand two full
    // bit-period samples, and the second sample routinely lands on the next start
    // bit (a 0), causing a cascade of framing errors. Always require just 1.
    const stopNeeded = 1;

    switch (this._fskAsyncState) {
      case 'hunt':
      default:
        if (this._fskPrevBit === 1 && bit === 0) {
          // Re-anchor the bit-sampling clock to this start-bit edge.
          // The majority-vote period just committed here, so this sample is
          // approximately the centre of the start bit.  Snapping the next
          // event to exactly one bit period away places it at the centre of
          // the first data bit — the correct async RTTY sample point.
          // Without this, the free-running clock stays at its old phase and
          // the stop bit gets sampled at the wrong time → framing error.
          this._nvNextEventCount = this._nvSampleCount + Math.round(this._nvBitPeriodTrue);
          this._nvBitPeriodFrac  = 0.0;
          this._nvSignalAccumulator = 0;
          // Clear zero-crossing state so stale idle-period buckets don't
          // produce a bad _nvSyncDelta at the next collection cycle.
          this._nvZeroCrossings.fill(0);
          this._nvZeroCrossingCount = 0;
          this._nvSyncDelta = 0;
          this._fskAsyncState = 'data';
          this._fskAsyncBits = 0;
          this._fskAsyncBitIndex = 0;
          this._fskAsyncParityBit = 0;
          this._fskAsyncStopSeen = 0;
          if (!this._fskTimingLock) {
            this._fskTimingLock = true;
          }
          if (!this._fskTimingAnnounced && this.fskCallback) {
            this.fskCallback({ type: 'status', variant: preset.name, text: 'Timing lock acquired' });
            this._fskTimingAnnounced = true;
          }
        }
        break;

      case 'data':
        this._fskAsyncBits |= (bit ? 1 : 0) << this._fskAsyncBitIndex;
        this._fskAsyncBitIndex++;
        if (this._fskAsyncBitIndex >= dataBits) this._fskAsyncState = needParity ? 'parity' : 'stop';
        break;

      case 'parity':
        this._fskAsyncParityBit = bit ? 1 : 0;
        this._fskAsyncState = 'stop';
        break;

      case 'stop':
        if (bit === 1) {
          this._fskAsyncStopSeen++;
          if (this._fskAsyncStopSeen >= stopNeeded) {
            const code = this._fskAsyncBits;
            let parityOk = true;
            if (needParity) {
              const ones = this._fskPopcount(code & ((1 << dataBits) - 1));
              const expected = parityMode === 'E' ? (ones & 1) : ((ones + 1) & 1);
              parityOk = expected === this._fskAsyncParityBit;
            }
            if (parityOk) {
              this._fskEmitAsyncChar(code, preset);
              this._fskInvalidFrames = Math.max(0, (this._fskInvalidFrames || 0) - 1);
            } else if (this.fskCallback) {
              this._fskInvalidFrames = (this._fskInvalidFrames || 0) + 1;
              this.fskCallback({ type: 'parity-error', variant: preset.name });
            }
            this._fskAsyncState = 'hunt';
            this._fskAsyncBits = 0;
            this._fskAsyncBitIndex = 0;
            this._fskAsyncStopSeen = 0;
          }
        } else {
          // bit === 0 in stop position
          if (this._fskAsyncStopSeen >= 1) {
            // At least one stop bit seen — this 0 is the start bit of the next
            // character. Accept the current character and re-anchor immediately.
            const code = this._fskAsyncBits;
            let parityOk = true;
            if (needParity) {
              const ones = this._fskPopcount(code & ((1 << dataBits) - 1));
              const expected = parityMode === 'E' ? (ones & 1) : ((ones + 1) & 1);
              parityOk = expected === this._fskAsyncParityBit;
            }
            if (parityOk) {
              this._fskEmitAsyncChar(code, preset);
              this._fskInvalidFrames = Math.max(0, (this._fskInvalidFrames || 0) - 1);
            } else if (this.fskCallback) {
              this._fskInvalidFrames = (this._fskInvalidFrames || 0) + 1;
              this.fskCallback({ type: 'parity-error', variant: preset.name });
            }
          } else {
            // No stop bit seen at all — genuine framing error.
            this._fskInvalidFrames = (this._fskInvalidFrames || 0) + 1;
            if (this.fskCallback) this.fskCallback({ type: 'framing-error', variant: preset.name });
            if ((this._fskInvalidFrames || 0) > 24 && (this._fskCharsDecoded || 0) < 2) {
              this._fskTimingLock = false;
              this._fskTimingAnnounced = false;
            }
          }
          // In both sub-cases the current 0 is the next start bit.
          // Re-anchor the clock to this edge exactly as hunt→data does.
          this._nvNextEventCount = this._nvSampleCount + Math.round(this._nvBitPeriodTrue);
          this._nvBitPeriodFrac  = 0.0;
          this._nvSignalAccumulator = 0;
          this._nvZeroCrossings.fill(0);
          this._nvZeroCrossingCount = 0;
          this._nvSyncDelta = 0;
          this._fskAsyncState = 'data';
          this._fskAsyncBits = 0;
          this._fskAsyncBitIndex = 0;
          this._fskAsyncParityBit = 0;
          this._fskAsyncStopSeen = 0;
        }
        break;
    }

    this._fskPrevBit = bit;
  }

  _fskPopcount(v) {
    v >>>= 0;
    let c = 0;
    while (v) { c += v & 1; v >>>= 1; }
    return c;
  }

  _fskEmitAsyncChar(code, preset) {
    const enc = this._fskEncoding || 'ita2';
    if (enc === 'ita2') return this._fskEmitITA2Char(code, preset);
    if (enc === 'ascii') return this._fskEmitASCIIChar(code, preset);
    return this._fskEmitITA2Char(code, preset);
  }

  _fskEmitASCIIChar(code, preset) {
    code &= (1 << (this._fskDataBits || 7)) - 1;
    let ch = '';
    if (code === 13) ch = '\n';
    else if (code === 10) ch = '\n';
    else if (code === 9) ch = '\t';
    else if (code >= 32 && code <= 126) ch = String.fromCharCode(code);
    else return;

    const cb = this.fskCallback;
    if (!cb) return;
    this._fskCharsDecoded = (this._fskCharsDecoded || 0) + 1;
    cb({ type: 'char', variant: preset.name, char: ch });
  }

  _fskEmitITA2Char(code, preset) {
    code &= 0x1F;
    const tbl = this._fskShift ? SpectrumAudio._FSK_ITA2_FIGS : SpectrumAudio._FSK_ITA2_LTRS;
    const sym = tbl[code] || '';

    if (!sym) return;
    if (sym === 'LTRS') { this._fskShift = false; this._fskFigsRunLen = 0; return; }
    if (sym === 'FIGS') { this._fskShift = true;  this._fskFigsRunLen = 0; return; }

    // Auto-LTRS recovery: real ham RTTY text rarely stays in FIGS mode for more
    // than a handful of characters before the transmitter sends LTRS again.
    // If FIGS runs for >15 chars without a LTRS command, the shift state was
    // almost certainly flipped by a single bit error.  Force back to LTRS and
    // drop the ambiguous triggering character.
    if (this._fskShift) {
      this._fskFigsRunLen = (this._fskFigsRunLen || 0) + 1;
      if (this._fskFigsRunLen > 15) {
        this._fskShift = false;
        this._fskFigsRunLen = 0;
        if (this.fskCallback) {
          this.fskCallback({ type: 'status', variant: preset.name, text: 'Auto-LTRS: shift reset' });
        }
        return;
      }
    } else {
      this._fskFigsRunLen = 0;
    }

    const cb = this.fskCallback;
    if (!cb) return;
    this._fskCharsDecoded = (this._fskCharsDecoded || 0) + 1;
    cb({ type: 'char', variant: preset.name, char: sym });
  }


  _fskTryAutoShift(preset) {
    if (!this._fskRecentPCM || this._fskRecentPCM.length < 512) return;
    const SR = this._nvSampleRate || this.trueAudioSps || this.audioOutputSps || 12000;
    const center = this._nvCenterFreq || preset.center || 1000;
    const candidates = preset.name === 'weather' ? [85, 170, 340, 425, 450, 850] : [85, 170, 200, 340, 425, 450];
    const samples = this._fskRecentPCM.slice(-Math.min(this._fskRecentPCM.length, 2048));
    const energyAt = (freq) => {
      const w = 2 * Math.PI * freq / SR;
      let re = 0, im = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = w * i;
        const s = samples[i];
        re += s * Math.cos(a);
        im -= s * Math.sin(a);
      }
      return re * re + im * im;
    };
    let bestShift = this._nvShiftHz || preset.shift;
    let bestScore = -Infinity;
    for (const shift of candidates) {
      const half = shift / 2;
      const score = energyAt(center - half) + energyAt(center + half);
      if (score > bestScore) {
        bestScore = score;
        bestShift = shift;
      }
    }
    if (Math.abs(bestShift - (this._nvShiftHz || preset.shift)) >= 20) {
      this.fskCustomConfig = { ...(this.fskCustomConfig || {}), shift: bestShift };
      this._fskReset();
      if (this.fskCallback) {
        this.fskCallback({ type: 'status', variant: preset.name, text: `Auto shift ${bestShift.toFixed(0)} Hz` });
      }
    }
    if ((this._fskInvalidFrames || 0) > 20 && (this._fskCharsDecoded || 0) === 0) {
      this._nvInverted = this._nvInverted ? 0 : 1;
      this._fskInvalidFrames = 0;
      this._fskAsyncState = 'hunt';
      if (this.fskCallback) this.fskCallback({ type: 'status', variant: preset.name, text: 'Auto invert' });
    }
  }

  // ── Auto-center: scan the spectrum to find where the two FSK tones actually are
  //
  // Algorithm (two-pass Goertzel sweep):
  //   Pass 1 — coarse: 20 Hz steps across 300–2700 Hz
  //             score(c) = energy(c - shift/2) + energy(c + shift/2)
  //             constrained so both tones land inside 200–2800 Hz
  //   Pass 2 — fine:   5 Hz steps ±120 Hz around the coarse best
  //   Accept only if:
  //     • both tone energies > 10 % of the combined peak   (signal present)
  //     • tone balance ratio < 4:1                         (not just one tone)
  //     • new center differs from current by ≥ 10 Hz       (worth changing)
  //   On success: update _nvCenterFreq, re-init discriminator, notify UI.

  _fskTryAutoCenter(preset) {
    if (!this._fskRecentPCM || this._fskRecentPCM.length < 1024) return;
    const SR     = this._nvSampleRate || this.trueAudioSps || this.audioOutputSps || 12000;
    const shift  = this._nvShiftHz || preset.shift;
    const half   = shift / 2.0;
    // Use up to 4096 samples (~340 ms at 12 kHz) for good frequency resolution.
    const buf    = this._fskRecentPCM.slice(-Math.min(this._fskRecentPCM.length, 4096));
    const N      = buf.length;

    // Goertzel single-frequency energy — O(N) per frequency.
    const energy = (freq) => {
      const w  = 2.0 * Math.PI * freq / SR;
      const c2 = 2.0 * Math.cos(w);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < N; i++) {
        const sNew = buf[i] + c2 * s1 - s2;
        s2 = s1; s1 = sNew;
      }
      return s1 * s1 + s2 * s2 - c2 * s1 * s2;
    };

    // Score a candidate center: sum of both tone energies, penalised if unbalanced.
    const score = (c) => {
      const lo = c - half;
      const hi = c + half;
      if (lo < 150 || hi > SR / 2 - 100) return -1;
      const eLo = energy(lo);
      const eHi = energy(hi);
      const sum = eLo + eHi;
      if (sum < 1e-6) return -1;
      // Balance penalty: ratio of larger to smaller must be < 4:1
      const ratio = Math.max(eLo, eHi) / (Math.min(eLo, eHi) + 1e-12);
      if (ratio > 4.0) return sum * (4.0 / ratio);  // soft penalty
      return sum;
    };

    // Pass 1 — coarse scan 300 Hz to 2700 Hz in 20 Hz steps.
    let bestCenter = this._nvCenterFreq;
    let bestScore  = -Infinity;
    for (let c = 300; c <= 2700; c += 20) {
      const s = score(c);
      if (s > bestScore) { bestScore = s; bestCenter = c; }
    }

    // Pass 2 — fine scan ±120 Hz around coarse best in 5 Hz steps.
    const coarse = bestCenter;
    for (let c = coarse - 120; c <= coarse + 120; c += 5) {
      const s = score(c);
      if (s > bestScore) { bestScore = s; bestCenter = c; }
    }

    // Validate: require both tones to have meaningful energy.
    const eLo  = energy(bestCenter - half);
    const eHi  = energy(bestCenter + half);
    const eSum = eLo + eHi;
    const ePeak = Math.max(eLo, eHi);
    if (Math.min(eLo, eHi) < ePeak * 0.08) {
      // Only one tone visible — probably just noise or a carrier. Don't retune.
      if (this.fskCallback) {
        this.fskCallback({ type: 'status', variant: preset.name,
          text: 'Auto-tune: no dual-tone signal found' });
      }
      return;
    }

    const delta = Math.abs(bestCenter - this._nvCenterFreq);
    if (delta < 10) {
      // Already well-centered.
      if (this.fskCallback) {
        this.fskCallback({ type: 'status', variant: preset.name,
          text: `Auto-tune: already centered at ${Math.round(this._nvCenterFreq)} Hz` });
      }
      return;
    }

    // Capture old center before _fskReset() overwrites _nvCenterFreq.
    const oldCenter = Math.round(this._nvCenterFreq);

    // Apply new center — update custom config so it survives _fskReset().
    this.fskCustomConfig = { ...(this.fskCustomConfig || {}), center: Math.round(bestCenter) };
    this._fskReset();

    if (this.fskCallback) {
      this.fskCallback({ type: 'status', variant: preset.name,
        text: 'Auto-tune: center ' + Math.round(bestCenter) + ' Hz (was ' + oldCenter + ' Hz)' });
      // Also fire a metrics update so the UI center field updates immediately.
      // Respect _nvInverted so mark/space labels match the regular metrics callback.
      const inv = !!this._nvInverted;
      this.fskCallback({
        type: 'metrics', variant: preset.name,
        snrDb: 0, lockQuality: 0,
        centerHz: Math.round(bestCenter),
        shiftHz: this._nvShiftHz,
        markHz:  inv ? Math.round(bestCenter) - this._nvShiftHz / 2
                     : Math.round(bestCenter) + this._nvShiftHz / 2,
        spaceHz: inv ? Math.round(bestCenter) + this._nvShiftHz / 2
                     : Math.round(bestCenter) - this._nvShiftHz / 2,
        baud: this._nvBaudRate, timingLocked: false, inverted: !!this._nvInverted
      });
    }
  }

  // ── Shared emitters ──────────────────────────────────────────────────────

  _nvEmitCCIRChar(ch) {
    this._nvEmitNavtexChar(ch);
    if (this.decodeFSK && this.fskVariant === 'maritime' && this.fskCallback && ch !== '\r') {
      this._fskCharsDecoded = (this._fskCharsDecoded || 0) + 1;
      this.fskCallback({ type: 'char', variant: 'maritime', char: ch });
    }
  }

  // ── NAVTEX message framing layer ─────────────────────────────────────────

  _nvEmitNavtexChar(ch) {
    const cb = this.navtexCallback;
    if (!cb) return;
    if (ch === '\r') return;

    this._nvRawWin = (this._nvRawWin + ch).slice(-32);

    if (!this._nvInMsg) {
      if (this._nvRawWin.includes('ZCZC')) {
        const m = this._nvRawWin.match(/ZCZC\s*([A-Z])([A-Z])(\d{2})/);
        this._nvInMsg = true;
        this._nvMsgTail = '';
        this._nvStation = m ? m[1] : '?';
        this._nvSubject = m ? m[2] : '?';
        this._nvSerial = m ? m[3] : '??';
        cb({ type: 'navstart', station: this._nvStation, subject: this._nvSubject, seq: this._nvSerial });
      }
      return;
    }

    this._nvMsgTail = (this._nvMsgTail + ch).slice(-8);
    if (this._nvMsgTail.includes('NNNN')) {
      cb({ type: 'navend', station: this._nvStation, subject: this._nvSubject, seq: this._nvSerial });
      this._nvInMsg = false;
      this._nvRawWin = '';
      this._nvMsgTail = '';
      return;
    }

    cb({ type: 'char', char: ch });
  }

}