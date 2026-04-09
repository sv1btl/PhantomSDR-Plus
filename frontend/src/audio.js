import { createDecoder, firdes_kaiser_lowpass } from './lib/wrappers'
import { OpusMLDecoder } from '@wasm-audio-decoders/opus-ml';

import createWindow from 'live-moving-average'
import { decode as cbor_decode } from 'cbor-x';
import { encode } from "./modules/ft8.js";
import { WSPR_TOTAL_SAMPLES, wspr2SlotPosition } from "./modules/wspr.js";
import { KiwiSSTVDecoder } from './sstv.js';

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

import { fft, ifft } from 'fft-js';

/* Opus Encoder */
class OpusMLAdapter {
  constructor(targetSampleRate) {
    // targetSampleRate is what the rest of the pipeline expects (e.g. 12000),
    // but the Opus bitstream itself carries its own sample rate, so we mostly
    // use this value for logging and optional resampling if ever needed.
    this.targetSampleRate = targetSampleRate || 48000;
    this.channels = 1;  // ✅ ADDED: Track mono/stereo (1 or 2) for C-QUAM
    this.decoder = null;
    this.isReady = false;
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
      const gain = 300.0; // Adjust if it sounds too loud/quiet.

      // Determine input/output sample rates
      const inSampleRate = result.sampleRate || this.targetSampleRate || 48000;
      const outSampleRate = this.targetSampleRate || inSampleRate;

      // ✅ ADDED: Helper function to resample and apply gain
      const resampleAndGain = (input) => {
        if (!input || input.length === 0) return new Float32Array(0);

        if (inSampleRate && outSampleRate && inSampleRate !== outSampleRate) {
          const ratio = inSampleRate / outSampleRate;
          const rounded = Math.round(ratio);
          if (Math.abs(ratio - rounded) < 1e-6 && rounded >= 1) {
            const factor = rounded;
            const outLen = Math.floor(input.length / factor);
            const out = new Float32Array(outLen);
            for (let i = 0; i < outLen; i++) {
              out[i] = input[i * factor] * gain;
            }
            return out;
          }
        }

        const out = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
          out[i] = input[i] * gain;
        }
        return out;
      };

      let pcm;
      let maxAbs = 0;

      // ✅ ADDED: Stereo (C-QUAM) handling - interleave L/R channels
      if (this.channels === 2 && result.channelData.length >= 2) {
        const L = resampleAndGain(result.channelData[0] || new Float32Array(0));
        const R = resampleAndGain(result.channelData[1] || new Float32Array(0));
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
        pcm = resampleAndGain(pcmRaw);
        
        const step = Math.max(1, Math.floor(pcm.length / 32));
        for (let i = 0; i < pcm.length; i += step) {
          const a = Math.abs(pcm[i]);
          if (a > maxAbs) maxAbs = a;
        }
      }

      console.debug(
        'OpusMLAdapter.decode: pcm len =',
        pcm.length,
        'channels =',
        this.channels,
        'approx max|x| =',
        maxAbs.toFixed(3),
        'stream sampleRate =',
        result.sampleRate,
        'pipeline target =',
        this.targetSampleRate
      );

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
    this.bufferLimit = 0.5;      // max ~500 ms ahead
    this.bufferThreshold = 0.1;  // aim for ~100 ms safety buffer

    this.endpoint = endpoint

    this.playAmount = 0

    this.playMovingAverage = []
    this.playSampleLength = 1
    this.audioQueue = []

    // Continuous playback scheduler: accumulate small websocket/audio decoder
    // chunks into slightly larger scheduled buffers. This avoids one-source-
    // per-packet playback, which is prone to browser micro-gaps.
    this._streamSchedulerEnabled = true;
    this.streamChunkTargetSec = 0.060;   // target scheduled chunk size
    this.streamChunkMaxSec = 0.180;      // hard flush if pending audio grows larger
    this.streamLookAheadSec = 0.030;     // minimum scheduling lead time
    this._streamPending = [];
    this._streamPendingFrames = 0;
    this._streamPendingChannels = 1;
    this._streamFlushTimer = null;
    this._scheduledSources = new Set();

    this.demodulation = 'USB'
    this.channels = 1  // ✅ ADDED: Track mono/stereo (1 or 2) for C-QUAM

    // Decoders
    this.decodeFT4      = false;
    this.isFT4Collecting = false;
    this.ft4Accumulator    = null;  // pre-allocated in _initAccumulators()
    this.ft4AccumulatorLen = 0;
    this.maxFT4AccumulatorSize = 90000 * 2;

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

    // ── Generic Kiwi-style FSK decoder state (weather / maritime / ham) ──
    this.decodeFSK   = false;
    this.fskCallback = null;
    this.fskVariant  = 'maritime';
    this._fskReset();
    
    // Remove the element with id startaudio from the DOM

    // AGC state variables
    this.agcGain = 1;
    this.agcEnvelope = 0;
    this.agcLookaheadBuffer = [];    

    // Noise blanker parameters. Profile 1: Maximum Quality (recommended for strong signals)
    this.nbEnabled = false;
    this.nbFFTSize = 2048;
    this.nbOverlap = 1536;
    this.nbAverageWindows = 32;
    this.nbThreshold = 0.140;
    this.nbBuffer = new Float32Array(this.nbFFTSize);
    this.nbSpectrumAverage = new Float32Array(this.nbFFTSize / 2);
    this.nbSpectrumHistory = Array(this.nbAverageWindows).fill().map(() => new Float32Array(this.nbFFTSize / 2));
    this.nbHistoryIndex = 0;

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
        
        this.audioCtx.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      this.audioCtx = null;
      this._resetStreamScheduler();
    }
    
    // ✅ FIXED: Clear accumulator and recording data
    this.accumulatorLen     = 0;
    this.ft4AccumulatorLen  = 0;
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

    const sr = this.audioOutputSps || 12000;

    // Time constants (setAGC() controls these base values)
    const attackCoeff  = Math.exp(-1 / (this.agcAttackTime  * sr));
    const releaseCoeff = Math.exp(-1 / (this.agcReleaseTime * sr));
    const lookaheadSamples = Math.floor(this.agcLookaheadTime * sr);

    const processedArray = new Float32Array(pcmArray.length);

    // Ensure the lookahead buffer is long enough
    while (this.agcLookaheadBuffer.length < lookaheadSamples) {
      this.agcLookaheadBuffer.push(0);
    }

    // Additional state for a hybrid peak/RMS detector
    if (this.agcPeak === undefined) this.agcPeak = 0;
    if (this.agcRms === undefined) this.agcRms = 0;

    for (let i = 0; i < pcmArray.length; i++) {
      // Push into lookahead buffer and pull the delayed sample
      this.agcLookaheadBuffer.push(pcmArray[i]);
      const sample = this.agcLookaheadBuffer.shift() ?? 0;

      const absSample = Math.abs(sample);

      // Fast peak envelope
      const peakAttack = 0.5; // relatively quick (~ms range once scaled)
      this.agcPeak = Math.max(
        absSample,
        this.agcPeak + (absSample - this.agcPeak) * peakAttack
      );

      // Slower RMS envelope
      const rmsCoeff = 0.01;
      const rmsSq =
        this.agcRms * this.agcRms +
        (sample * sample - this.agcRms * this.agcRms) * rmsCoeff;
      this.agcRms = Math.sqrt(Math.max(rmsSq, 0));

      // Hybrid detector: mostly peak, some RMS
      const detector = 0.7 * this.agcPeak + 0.3 * this.agcRms;

      // Desired gain to reach target level
      const eps = 1e-6;
      const desiredGainRaw = this.agcTargetLevel / (detector + eps);
      const desiredGain = Math.min(desiredGainRaw, this.agcMaxGain);

      // Different time constants when raising vs lowering gain
      const coeff = desiredGain > this.agcGain ? attackCoeff : releaseCoeff;
      this.agcGain += (desiredGain - this.agcGain) * coeff;

      // Apply gain
      let out = sample * this.agcGain;

      // Simple limiter to avoid clipping
      if (out > 0.95) out = 0.95;
      else if (out < -0.95) out = -0.95;

      processedArray[i] = out;
    }

    return processedArray;
  }


   // AGC parameters

setAGC(newAGCSpeed) {
  // Always start with baseline gain and enable AGC
  this.setGain(392); // was 50
  this.agcEnabled = true;

  switch (newAGCSpeed) {

    case 0: // AGC Auto (adaptive, moderate)
      // Automatically balances responsiveness and smoothness
      this.agcAttackTime = 0.03;       // 30 ms: reacts quickly to rising signals
      this.agcReleaseTime = 0.50;      // 300 ms: gentle recovery to avoid pumping
      this.agcLookaheadTime = 0.05;    // 50 ms: lookahead for peak anticipation
      this.agcTargetLevel = 0.9;       // Target around -1 dBFS
      this.agcMaxGain = 6;             // Allow up to 6× gain
      this.smoothMaxgain(0.9);         // Slight smoothing for steady gain
      break;

    case 1: // AGC Speed Fast
      // Ideal for speech or CW signals where rapid response is needed
      this.agcAttackTime = 0.005;      // 5 ms: very quick attack for transients
      this.agcReleaseTime = 0.2;      // 50 ms: quick recovery to new levels
      this.agcLookaheadTime = 0.02;    // 20 ms: short lookahead to catch peaks
      this.agcTargetLevel = 0.75;      // Slightly lower target (-2.5 dBFS)
      this.agcMaxGain = 6;             // Moderate gain limit to avoid overshoot
      this.smoothMaxgain(0.7);         // Faster smoothing for agility
      break;

    case 2: // AGC Speed Medium
      // Balanced mode: good for general music and broadcast audio
      this.agcAttackTime = 0.02;       // 20 ms: natural attack
      this.agcReleaseTime = 1.5;       // 1000 ms: slower release to maintain warmth
      this.agcLookaheadTime = 0.08;    // 80 ms: moderate lookahead
      this.agcTargetLevel = 1.0;       // Nominal unity (0 dBFS target)
      this.agcMaxGain = 6;             // Up to 6× gain
      this.smoothMaxgain(1.0);         // Balanced smoothing factor
      break;

    case 3: // AGC Speed Slow
      // Smooth long-term leveling, ideal for wide dynamic range (music, AM/FM)
      this.agcAttackTime = 0.1;        // 100 ms: slow attack to preserve transients
      this.agcReleaseTime = 2.5;       // 2.0 s: long release for stable dynamics
      this.agcLookaheadTime = 0.12;    // 120 ms: slightly longer lookahead
      this.agcTargetLevel = 1.1;       // Slightly boosted target
      this.agcMaxGain = 6;             // More headroom for quiet passages
      this.smoothMaxgain(1.3);         // Slower gain smoothing
      break;

    case 4: // AGC Off
      // Manual gain mode: disable AGC entirely
      this.agcEnabled = false;
      this.mute = false;
      this.setGain(392);
      break;

    default:
      console.warn("Unknown AGC speed mode: " + newAGCSpeed);
      break;
  }

  console.log("AGC Enabled = " + this.agcEnabled + " | AGC Speed = " + newAGCSpeed);
}

  smoothMaxgain(maxgain) {
    // FIX: the previous implementation looped 20001 times, ignored the
    // `maxgain` parameter entirely, and called setGain(50) exactly once on
    // the very last iteration — every AGC preset got the same result.
    // Simply apply the requested maxgain to the gain node.
    if (this.gainNode) {
      this.setGain(maxgain * 30); // setGain divides by 30 internally
    }
    this.agcMaxGain = maxgain;
  }



  _initAccumulators() {
    this.accumulator        = new Float32Array(this.maxAccumulatorSize);
    this.accumulatorLen     = 0;
    this.ft4Accumulator     = new Float32Array(this.maxFT4AccumulatorSize);
    this.ft4AccumulatorLen  = 0;
    this.wsprAccumulator    = new Float32Array(this.maxWSPRAccumulatorSize);
    this.wsprAccumulatorLen = 0;
    // Pre-allocated plain Array reused by applyNoiseBlanker as fft-js input.
    // Avoids a ~16 KB Array.from(Float32Array) heap allocation on every packet
    // which was causing GC pressure and flush-timer jitter (audio micro-glitches).
    this._nbInputArr = new Array(this.nbFFTSize).fill(0);
  }

  applyNoiseBlanker(pcmArray) {
    // Legacy master switch `this.nb` is treated as "both on"
    // if separate toggles have not been explicitly set.
    const useBlanker = this.nbBlankerEnabled || this.nb;
    const useNR      = this.nrEnabled        || this.nb;

    if (!useBlanker && !useNR) return pcmArray;

    const processedArray = new Float32Array(pcmArray.length);

    for (let i = 0; i < pcmArray.length; i += this.nbOverlap) {
      // Fill FFT buffer with a block of samples
      this.nbBuffer.set(pcmArray.subarray(i, i + this.nbFFTSize));

      // Reuse the pre-allocated plain Array required by fft-js.
      // Rebuild it only when nbFFTSize has changed (rare).
      if (!this._nbInputArr || this._nbInputArr.length !== this.nbFFTSize) {
        this._nbInputArr = new Array(this.nbFFTSize).fill(0);
      }
      for (let k = 0; k < this.nbFFTSize; k++) this._nbInputArr[k] = this.nbBuffer[k];

      // Perform FFT
      const phasors = fft(this._nbInputArr);

      // Calculate magnitude spectrum
      const magnitudeSpectrum = new Float32Array(this.nbFFTSize / 2);
      for (let j = 0; j < this.nbFFTSize / 2; j++) {
        magnitudeSpectrum[j] = Math.sqrt(
          phasors[j][0] * phasors[j][0] +
          phasors[j][1] * phasors[j][1]
        );
      }

      // Update running average spectrum (used as noise floor estimate)
      this.nbSpectrumHistory[this.nbHistoryIndex].set(magnitudeSpectrum);
      this.nbHistoryIndex = (this.nbHistoryIndex + 1) % this.nbAverageWindows;

      for (let j = 0; j < this.nbFFTSize / 2; j++) {
        let sum = 0;
        for (let k = 0; k < this.nbAverageWindows; k++) {
          sum += this.nbSpectrumHistory[k][j];
        }
        this.nbSpectrumAverage[j] = sum / this.nbAverageWindows;
      }

      // Average signal level and dynamic threshold
      let sumLevel = 0;
      for (let j = 0; j < this.nbFFTSize / 2; j++) {
        sumLevel += this.nbSpectrumAverage[j];
      }
      const avgSignalLevel   = sumLevel / (this.nbFFTSize / 2);
      const dynamicThreshold = this.nbThreshold * avgSignalLevel;

      // --- Frequency‑domain noise reduction (soft) ---
      if (useNR) {
        for (let j = 0; j < this.nbFFTSize / 2; j++) {
          const ratio = this.nbSpectrumAverage[j] > 0
            ? magnitudeSpectrum[j] / this.nbSpectrumAverage[j]
            : 1;
          const scale = ratio > 1 ? 1 / Math.pow(ratio, 0.5) : 1;
          phasors[j][0] *= scale;
          phasors[j][1] *= scale;
        }
      }

      // Inverse FFT back to time domain
      const complexSignal = ifft(phasors);

      // --- Time‑domain impulsive blanker / soft clipper ---
      for (let j = 0; j < this.nbFFTSize; j++) {
        const idx = i + j;
        if (idx >= pcmArray.length) break;

        const magnitude = Math.sqrt(
          complexSignal[j][0] * complexSignal[j][0] +
          complexSignal[j][1] * complexSignal[j][1]
        );

        const inSample = pcmArray[idx];

        if (useBlanker && magnitude > dynamicThreshold) {
          const reductionFactor = dynamicThreshold / (magnitude + 1e-12);
          processedArray[idx] = inSample * reductionFactor;
        } else if (useNR) {
          // NR only: use the (possibly cleaned) real part
          processedArray[idx] = complexSignal[j][0];
        } else {
          // Fallback: original
          processedArray[idx] = inSample;
        }
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
    const out    = new Float32Array(N);
    const taps   = this.anfTaps;
    const D      = this.anfDelay;
    const mu     = this.anfMu;
    const leak   = 1e-4;           // FIX 4: weight leakage — prevents long-term drift
    const eps    = 1e-9;           // NLMS denominator floor (prevents ÷0)

    const w      = chR ? this._anfWR    : this._anfW;
    const buf    = chR ? this._anfBufR  : this._anfBuf;
    const bufLen = buf.length;         // taps + D  (= taps + D, exactly right)
    let   ptr    = chR ? this._anfBufIdxR : this._anfBufIdx;

    // FIX 3: cache tap vector once per block — collapses two modulo loops into one
    const xvec = new Float32Array(taps);

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

    // Track gate state changes for debugging
    const previousGateState = gateOpen;

    // Select parameters based on preset (ENHANCED FOR MORE AUDIBLE DIFFERENCES)
    let alphaEnv, alphaNoiseFloor, openFactor, closeFactor, floorGain;
    
    switch (this.noiseGatePreset) {

      case 'aggressive':
        alphaEnv = 0.0025;          // faster open (prevents clipped consonants)
        alphaNoiseFloor = 0.00008;
        openFactor = 1.70;          // opens easier
        closeFactor = 3.50;         // closes gentler
        floorGain = 0.38;           // avoids black-hole silence
        break;

      case 'weak-signal':
        alphaEnv = 0.0022;
        alphaNoiseFloor = 0.00007;
        openFactor = 1.60;
        closeFactor = 3.40;
        floorGain = 0.52;
        break;

      case 'smooth':
        alphaEnv = 0.0020;
        alphaNoiseFloor = 0.00006;
        openFactor = 1.75;
        closeFactor = 3.60;
        floorGain = 0.55;
        break;

      case 'maximum':
        alphaEnv = 0.0028;
        alphaNoiseFloor = 0.00008;
        openFactor = 1.65;
        closeFactor = 3.45;
        floorGain = 0.32;
        break;

      case 'cw':
        // CW needs a bit more “shape”, but still avoid clicky gating
        alphaEnv = 0.0035;
        alphaNoiseFloor = 0.00010;
        openFactor = 1.65;
        closeFactor = 3.30;
        floorGain = 0.35;
        break;

      case 'am-fm':
        // Mostly-open feel; just gentle quieting
        alphaEnv = 0.0020;
        alphaNoiseFloor = 0.00006;
        openFactor = 2.00;
        closeFactor = 3.80;
        floorGain = 0.62;
        break;

      case 'balanced':
      default:
        alphaEnv = 0.0024;
        alphaNoiseFloor = 0.00008;
        openFactor = 1.70;
        closeFactor = 3.50;
        floorGain = 0.45;
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

      out[i] = gateOpen ? s : s * floorGain;
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

    return out;
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
    this._resetStreamScheduler(true);

    // ✅ FIXED: Free old decoder before creating new one to prevent memory leak
    if (this.decoder && typeof this.decoder.free === 'function') {
      try {
        console.log('[Audio] Freeing old decoder before creating new one');
        this.decoder.free();
      } catch (e) {
        console.warn('[Audio] Error freeing old decoder:', e);
      }
      this.decoder = null;
    }

    if (settings.audio_compression === 'opus') {
      // Use WASM-based Opus ML decoder for raw Opus frames
      this.decoder = new OpusMLAdapter(this.audioMaxSps || this.trueAudioSps || this.audioOutputSps || 48000);
    } else {
      // Use existing wrapper-based decoder (FLAC, etc.)
      this.decoder = createDecoder(settings.audio_compression, this.audioMaxSps, this.trueAudioSps, this.audioOutputSps);
      
      // ✅ CRITICAL FIX: Disable buggy WASM noise blanker for FLAC
      // The WASM FLAC decoder has a noise blanker with an index-out-of-bounds bug
      // (noiseblankerwild.rs:189 - tries to access array[26] when len=26).
      // Override set_nb() to prevent the crash while keeping JavaScript NB working.
      if (settings.audio_compression === 'flac' && this.decoder && typeof this.decoder.set_nb === 'function') {
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
      
      console.log('✅ Backend audio control methods initialized');
    }
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
    this.bandpass.gain.value = 2            // was 3

    // High-pass filter – let a bit more low end through
    this.highPass = new BiquadFilterNode(this.audioCtx)
    this.highPass.type = 'highpass'
    this.highPass.frequency.value = 45      // was 60
    this.highPass.Q.value = 0.7

    /* Presence boost – move it lower and reduce gain
      so highs are smoother / less sharp */
    this.presenceBoost = new BiquadFilterNode(this.audioCtx)
    this.presenceBoost.type = 'peaking'
    this.presenceBoost.frequency.value = 3500  // was 3500
    this.presenceBoost.Q.value = 1.2           // was 1.5
    this.presenceBoost.gain.value = 2          // was 4

    // Convolver node for additional filtering
    this.convolverNode = new ConvolverNode(this.audioCtx)
    this.setLowpass(15000)

    // Dynamic compressor
    this.compressor = new DynamicsCompressorNode(this.audioCtx)
    this.compressor.threshold.value = -4;   // only act on fairly loud peaks
    this.compressor.knee.value = 4;         // gentle knee
    this.compressor.ratio.value = 1.8;      // light compression, not limiting
    this.compressor.attack.value = 0.015;   // slower attack to keep transients
    this.compressor.release.value = 0.35;   // same release

    // Gain node
    this.gainNode = new GainNode(this.audioCtx)
    this.setGain(3.5)

    // Add MediaStreamDestination node
    this.destinationNode = new MediaStreamAudioDestinationNode(this.audioCtx);

    // Connect nodes in the correct order
    this.convolverNode.connect(this.highPass)
    this.highPass.connect(this.bandpass)
    this.bandpass.connect(this.bassBoost)
    this.bassBoost.connect(this.presenceBoost)
    this.presenceBoost.connect(this.compressor)
    this.compressor.connect(this.gainNode)
    this.gainNode.connect(this.destinationNode);
    this.gainNode.connect(this.audioCtx.destination)

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
        this.bandpass.Q.value = 1.2
        this.bandpass.gain.value = 3
        this.highPass.frequency.value = 60
        this.presenceBoost.gain.value = 4
        this.setLowpass(3000)
        break
      case 'AM':
        this.bassBoost.gain.value = 20
        this.bandpass.frequency.value = 1500
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 2
        this.highPass.frequency.value = 50
        this.presenceBoost.gain.value = 3
        this.setLowpass(4500)
        break
      case 'FM':
        this.bassBoost.gain.value = 40
        this.bandpass.frequency.value = 2400
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 2
        this.highPass.frequency.value = this.ctcss ? 300 : 100
        this.presenceBoost.gain.value = 3
        this.setLowpass(4800)
        break
    }
  }


  setFIRFilter(fir) {
    const firAudioBuffer = new AudioBuffer({ length: fir.length, numberOfChannels: 1, sampleRate: this.audioOutputSps })
    firAudioBuffer.copyToChannel(fir, 0, 0)
    this.convolverNode.buffer = firAudioBuffer
  }

  setLowpass(lowpass) {
    const sampleRate = this.audioOutputSps
    // Bypass the FIR filter if the sample rate is low enough
    if (lowpass >= sampleRate / 2) {
      this.setFIRFilter(Float32Array.of(1))
      return
    }
    const fir = firdes_kaiser_lowpass(lowpass / sampleRate, 1000 / sampleRate, 0.001)
    this.setFIRFilter(fir)
  }


  // Audio Buffer Delay function that sets the new values for //
  // bufferLimit and bufferThreshold //
  setAudioBufferDelay(newAudioBufferLimit, newAudioBufferThreshold) {
  // Validate inputs
  if (typeof newAudioBufferLimit !== 'number' || typeof newAudioBufferThreshold !== 'number') {
    console.warn('Invalid buffer delay parameters, using defaults');
    this.bufferLimit = 0.5;
    this.bufferThreshold = 0.1;
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
    if (value) {
      // ✅ FIXED: Reset farthest-distance counter and label on each new session
      this.farthestDistance = 0;
      const el = document.getElementById('farthest-distance');
      if (el) el.textContent = 'Farthest: 0 km';
    }
  }

  setFT4Decoding(value) {
    this.decodeFT4 = value;
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

    this.fmDeemphNode = new IIRFilterNode(this.audioCtx, { feedforward: feedForwardTaps, feedback: feedBackwardTaps })
    this.fmDeemphNode.connect(this.convolverNode)

    this.audioInputNode = this.fmDeemphNode
  }

  socketMessageInitial(event) {
    // first message gives the parameters in json
    const settings = JSON.parse(event.data)
    this.settings = settings
    this.fftSize = settings.fft_size
    this.audioMaxSize = settings.fft_result_size
    this.baseFreq = settings.basefreq
    this.totalBandwidth = settings.total_bandwidth
    this.sps = settings.sps
    this.audioOverlap = settings.fft_overlap / 2
    this.audioMaxSps = settings.audio_max_sps
    this.grid_locator = settings.grid_locator
    this.smeter_offset = settings.smeter_offset

    this.audioL = settings.defaults.l
    this.audioM = settings.defaults.m
    this.audioR = settings.defaults.r

    const targetFFTBins = Math.ceil(this.audioMaxSps * this.audioMaxSize / this.sps / 4) * 4

    this.trueAudioSps = targetFFTBins / this.audioMaxSize * this.sps
    this.audioOutputSps = Math.min(this.audioMaxSps, 96000)

    // Reinitialise WSPR accumulator now that audioOutputSps is known.
    // The constructor hardcodes 12000 × 125, which truncates to ~62 s at 24 kHz
    // or ~31 s at 48 kHz — far short of the 116 s collection window.
    const _wsprSR = this.audioOutputSps || 12000;
    this.maxWSPRAccumulatorSize = _wsprSR * 125;
    this.wsprAccumulator    = new Float32Array(this.maxWSPRAccumulatorSize);
    this.wsprAccumulatorLen = 0;

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
      if (this.audioCtx && this.playTime) {
        this._dBQueue.push({ playAt: this.playTime, value: dBpower });
        // Prevent unbounded growth when getPowerDb() is not called (e.g. page hidden,
        // RAF paused, S-meter component unmounted). Keep the newest 300 entries (~10 s
        // at 30 packets/sec) and silently discard the oldest.
        if (this._dBQueue.length > 300) {
          this._dBQueue.splice(0, this._dBQueue.length - 300);
        }
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
      console.log('[FLAC Stereo] Interleaved channelData:', len, 'frames')
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

    // Save original (pre-boost) PCM specifically for RADE.
    // The 300x FLAC gain boost is needed by the speaker pipeline and by
    // all other decoders (which are calibrated to ~256 amplitude).
    // RADE must receive the original unmodified amplitude — the boost would
    // saturate radae_rxe.py and destroy sync acquisition.
    const pcmArrayPreBoost = pcmArray;

    // ✅ FLAC 16-bit gain boost: pipeline is calibrated for 8-bit amplitude (~256).
    // 16-bit FLAC decoder outputs amplitude ~1.0 → 256× too quiet → silence.
    if (this.settings && this.settings.audio_compression === 'flac') {
      const flacGain = 300.0
      const boosted = new Float32Array(pcmArray.length)
      for (let i = 0; i < pcmArray.length; i++) boosted[i] = pcmArray[i] * flacGain
      pcmArray = boosted
    }

    if (this.signalDecoder) {
      this.signalDecoder.decode(pcmArray)
    }

    this.playAudio(pcmArray, pcmArrayPreBoost)
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
    } else {
      demodulation = d0;
    }

    this.demodulation = demodulation
    // ANF weights trained for one mode can corrupt another — reset on mode switch
    if (this.anfEnabled) this.resetAutoNotch();
    if (demodulation == "CW") {
      demodulation = "USB"
    }
    this.updateFilters()
    this._safeSend({
      cmd: 'demodulation',
      demodulation: demodulation
    })
  }

  setAudioRange(audioL, audioM, audioR, audioLOffset, audioMOffset, audioROffset) {
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

  setAudioOptions(options) {
    this.audioOptions = options
    this._safeSend({
      cmd: 'options',
      options: options
    })
  }

  setGain(gain) {
    gain /= 30;
    this.gain = gain
    this.gainNode.gain.value = gain
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
    this.ctcss = ctcss;
    this.updateFilters();
  }

  setSquelch(squelch) {
    this.squelch = squelch
  }

  setSquelchThreshold(squelchThreshold) {
    this.squelchThreshold = squelchThreshold
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
    
    // Check every second to adjust the collecting status based on current time
    this.collectionTimer = setInterval(() => {
      this.updateCollectionStatus();
    }, 1000);

    // FT4 timer — checks every 250 ms for 7.5 s slot boundaries
    if (this.ft4CollectionTimer) clearInterval(this.ft4CollectionTimer);
    this.ft4CollectionTimer = setInterval(() => {
        this.updateFT4CollectionStatus();
    }, 250);

    // WSPR timer — checks every 500 ms for 2-minute even-UTC-minute slots
    if (this.wsprTimer) clearInterval(this.wsprTimer);
    this.wsprTimer = setInterval(() => {
      this.updateWSPRCollectionStatus();
    }, 500);
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

  updateCollectionStatus() {
    const now = new Date();
    const seconds = now.getSeconds();
    const waitSeconds = 15 - (seconds % 15);

    if (waitSeconds === 15 && !this.isCollecting) {
      this.startCollection();
    } else if (waitSeconds === 1 && this.isCollecting) {
      this.stopCollection();
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

      const decodedMessages = await _workerDecode('ft8', bigFloat32Array);
      const messagesListDiv = document.getElementById('ft8MessagesList');
      if (!messagesListDiv) return;

      const baseLocation = this.gridSquareToLatLong(this.grid_locator);

      for (const message of decodedMessages) {
        const locators = this.extractGridLocators(message.text);

        // ✅ FIXED: render ALL messages — previously only messages containing a
        //   grid locator were rendered, silently dropping signal reports (e.g.
        //   "SV1BTL VK2ABC +03"), RRR, RR73, 73, and bare CQ calls.
        //   Distance is computed only when a locator is present (same as FT4).
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('glass-message', 'p-2', 'rounded-lg', 'text-sm', 'flex', 'justify-between', 'items-center');

        const modeTag = document.createElement('span');
        modeTag.classList.add('text-green-400', 'font-bold', 'mr-2', 'text-xs');
        modeTag.textContent = 'FT8';
        messageDiv.appendChild(modeTag);

        const messageContent = document.createElement('div');
        messageContent.classList.add('flex-grow');
        messageContent.textContent = message.text;
        messageDiv.appendChild(messageContent);

        if (locators.length > 0) {
          const targetLocation = this.gridSquareToLatLong(locators[0]);
          const distance = this.calculateDistance(
            baseLocation[0], baseLocation[1],
            targetLocation[0], targetLocation[1]
          );

          if (distance > this.farthestDistance) {
            this.farthestDistance = distance;
            const el = document.getElementById('farthest-distance');
            if (el) el.textContent = `Farthest Distance: ${this.farthestDistance.toFixed(2)} km`;
          }

          const infoDiv = document.createElement('div');
          infoDiv.classList.add('flex', 'flex-col', 'items-end', 'ml-2', 'text-xs');

          const locatorsDiv = document.createElement('div');
          locators.forEach((locator, index) => {
            const locatorLink = document.createElement('a');
            locatorLink.href = `https://www.levinecentral.com/ham/grid_square.php?&Grid=${locator}&Zoom=13&sm=y`;
            locatorLink.classList.add('text-yellow-300', 'hover:underline');
            locatorLink.textContent = locator;
            locatorLink.target = '_blank';
            if (index > 0) locatorsDiv.appendChild(document.createTextNode(', '));
            locatorsDiv.appendChild(locatorLink);
          });
          infoDiv.appendChild(locatorsDiv);

          const distanceDiv = document.createElement('div');
          distanceDiv.textContent = `${distance.toFixed(2)} km`;
          infoDiv.appendChild(distanceDiv);

          messageDiv.appendChild(infoDiv);
        }

        messagesListDiv.appendChild(messageDiv);
      }

      if (decodedMessages.length > 0) {
        setTimeout(() => { messagesListDiv.scrollTop = messagesListDiv.scrollHeight; }, 500);
      }
    }
  }

// ── FT4 collection ──────────────────────────────────────────────────────
updateFT4CollectionStatus() {
    if (!this.decodeFT4) return;
    const now      = new Date();
    const msInMin  = (now.getSeconds() * 1000) + now.getMilliseconds();
    const slotMs   = 7500;                        // 7.5 s per FT4 slot
    const posInSlot = msInMin % slotMs;

    // Start collecting at the very beginning of each slot (within 400 ms window)
    if (posInSlot < 400 && !this.isFT4Collecting) {
        this.startFT4Collection();
    }
    // Stop ~200 ms before the end to leave time for decode
    else if (posInSlot > 7200 && this.isFT4Collecting) {
        this.stopFT4Collection();
    }
}

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
        decodedMessages = await _workerDecode('ft4', pcm);
    } catch (e) {
        console.error('[FT4] decode error:', e);
        return;
    }

    const messagesListDiv = document.getElementById('ft8MessagesList');
    if (!messagesListDiv) return;

    let baseLocation = this.gridSquareToLatLong(this.grid_locator);

    for (let message of decodedMessages) {
        const locators = this.extractGridLocators(message.text);

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('glass-message', 'p-2', 'rounded-lg',
                                  'text-sm', 'flex', 'justify-between', 'items-center');

        const modeTag = document.createElement('span');
        modeTag.classList.add('text-green-400', 'font-bold', 'mr-2', 'text-xs');
        modeTag.textContent = 'FT4';
        messageDiv.appendChild(modeTag);

        const messageContent = document.createElement('div');
        messageContent.classList.add('flex-grow');
        messageContent.textContent = message.text;
        messageDiv.appendChild(messageContent);

        const infoDiv = document.createElement('div');
        infoDiv.classList.add('flex', 'flex-col', 'items-end', 'ml-2', 'text-xs');

        if (locators.length > 0) {
            const locatorsDiv = document.createElement('div');
            locators.forEach((locator, index) => {
                const link = document.createElement('a');
                link.href = `https://www.levinecentral.com/ham/grid_square.php?&Grid=${locator}&Zoom=13&sm=y`;
                link.classList.add('text-yellow-300', 'hover:underline');
                link.textContent = locator;
                link.target = '_blank';
                if (index > 0) locatorsDiv.appendChild(document.createTextNode(', '));
                locatorsDiv.appendChild(link);
            });
            infoDiv.appendChild(locatorsDiv);

            const targetLocation = this.gridSquareToLatLong(locators[0]);
            const distance = this.calculateDistance(
                baseLocation[0], baseLocation[1],
                targetLocation[0], targetLocation[1]
            );

            if (distance > this.farthestDistance) {
                this.farthestDistance = distance;
                const el = document.getElementById('farthest-distance');
                if (el) el.textContent = `Farthest Distance: ${this.farthestDistance.toFixed(2)} km`;
            }

            const distDiv = document.createElement('div');
            distDiv.textContent = `${distance.toFixed(2)} km`;
            infoDiv.appendChild(distDiv);
        }

        messageDiv.appendChild(infoDiv);
        messagesListDiv.appendChild(messageDiv);
    }

    if (decodedMessages.length > 0) {
        setTimeout(() => { messagesListDiv.scrollTop = messagesListDiv.scrollHeight; }, 500);
    }
}
// ── FT4 collection END ───────────────────────────────────────────────────

// ── WSPR-2 collection ────────────────────────────────────────────────────
  /**
   * Called every 500 ms.  WSPR-2 slots start on even UTC minutes (0, 2, 4 …).
   * Transmission lasts ~110 s; we collect for 116 s then decode.
   *
   *  pos   0 s  → start collecting  (slot open, even minute)
   *  pos 116 s  → stop and decode   (leave 4 s margin before next slot)
   */
  updateWSPRCollectionStatus() {
    if (!this.decodeWSPR) return;
    const pos = wspr2SlotPosition(); // 0–119 s within the current 2-minute slot

    if (pos < 2 && !this.isWSPRCollecting) {
      this.startWSPRCollection();
    } else if (pos >= 116 && this.isWSPRCollecting) {
      this.stopWSPRCollection();
    }
  }

  startWSPRCollection() {
    this.isWSPRCollecting = true;
    this.wsprAccumulatorLen = 0;
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
    if (this.isWSPRCollecting && this.decodeWSPR) {
      const end = Math.min(this.wsprAccumulatorLen + rawPcm.length, this.maxWSPRAccumulatorSize);
      this.wsprAccumulator.set(rawPcm.subarray(0, end - this.wsprAccumulatorLen), this.wsprAccumulatorLen);
      this.wsprAccumulatorLen = end;
    }

    // FAX tap — same raw PCM, before any DSP
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

    // Speaker-audio gate starts here. Decoder feeds above must still run.
    if (this.mute || (this.squelchMute && this.squelch)) {
      this._wasMuted = true;
      return
    }
    // Audio is resuming after a mute or squelch period.
    // The noise gate may have closed while audio was absent; re-open it so the
    // first arriving audio is not silenced waiting for the gate threshold to trip.
    if (this._wasMuted) {
      this._wasMuted = false;
      this.noiseGateOpen = true;
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

    } else {
      // Mono path — full processing as before
      pcmArray = this.applyNoiseBlanker(pcmArray);
      if (this.anfEnabled) {
        pcmArray = this.applyAutoNotch(pcmArray, false);
      }
      pcmArray = this.applyNoiseCancel(pcmArray);
      if (this.agcEnabled) {
        pcmArray = this.applyAGC(pcmArray);
      }
    }

    // Feed PCM data to spectrogram (after all audio processing)
    if (this.spectrogramEnabled && this.spectrogramCallback) {
      try {
        // Create a copy to avoid interference with audio pipeline
        const spectrogramData = new Float32Array(pcmArray);
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

    // Legacy playTime drift correction is only needed for one-buffer-per-source
    // playback. The continuous scheduler updates this.playTime internally.
    if (!this._streamSchedulerEnabled) {
      const currentTime = this.audioCtx.currentTime;
      if ((this.playTime - currentTime) <= this.bufferThreshold) {
        this.playTime = (currentTime + this.bufferThreshold + curPlayTime);
      } else if ((this.playTime - currentTime) > this.bufferLimit) {
        this.playTime = (currentTime + this.bufferThreshold);
      } else {
        this.playTime += curPlayTime;
      }
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


  _resetStreamScheduler(resetPlayClock = false) {
    if (this._streamFlushTimer) {
      clearTimeout(this._streamFlushTimer);
      this._streamFlushTimer = null;
    }
    this._streamPending = [];
    this._streamPendingFrames = 0;
    this._streamPendingChannels = 1;
    if (this._scheduledSources) {
      for (const src of this._scheduledSources) {
        try { src.onended = null; } catch (e) {}
        try { src.disconnect(); } catch (e) {}
        try { src.stop(); } catch (e) {}
      }
      this._scheduledSources.clear();
    } else {
      this._scheduledSources = new Set();
    }
    if (resetPlayClock && this.audioCtx) {
      this.playTime = this.audioCtx.currentTime + this.bufferThreshold;
    }
  }

  _ensureStreamFlushTimer() {
    if (this._streamFlushTimer) return;
    const delayMs = Math.max(12, Math.min(35, Math.round(this.streamChunkTargetSec * 500)));
    this._streamFlushTimer = setTimeout(() => {
      this._streamFlushTimer = null;
      if (this._streamPendingFrames > 0) {
        this._flushPendingPlayback(true);
      }
    }, delayMs);
  }

  _appendPlaybackChunk(buffer, channels) {
    const frames = (channels === 2) ? Math.floor(buffer.length / 2) : buffer.length;
    if (frames <= 0) return 0;

    if (this._streamPendingFrames > 0 && this._streamPendingChannels !== channels) {
      this._flushPendingPlayback(true);
    }

    const copy = new Float32Array(buffer.length);
    copy.set(buffer);
    this._streamPending.push(copy);
    this._streamPendingFrames += frames;
    this._streamPendingChannels = channels;
    return frames / this.audioOutputSps;
  }

  _buildPendingInterleaved() {
    const channels = this._streamPendingChannels || 1;
    const totalFrames = this._streamPendingFrames || 0;
    if (!totalFrames) return null;

    const out = new Float32Array(totalFrames * channels);
    let offset = 0;
    for (const chunk of this._streamPending) {
      out.set(chunk, offset);
      offset += chunk.length;
    }

    this._streamPending = [];
    this._streamPendingFrames = 0;
    return { out, channels, duration: totalFrames / this.audioOutputSps };
  }

  _scheduleBufferSource(interleaved, channels) {
    const frames = (channels === 2) ? Math.floor(interleaved.length / 2) : interleaved.length;
    if (frames <= 0 || !this.audioInputNode) return 0;

    const audioBuffer = new AudioBuffer({
      length: frames,
      numberOfChannels: channels,
      sampleRate: this.audioOutputSps
    });

    if (channels === 2) {
      const L = new Float32Array(frames);
      const R = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        L[i] = interleaved[2 * i];
        R[i] = interleaved[2 * i + 1];
      }
      audioBuffer.copyToChannel(L, 0, 0);
      audioBuffer.copyToChannel(R, 1, 0);
    } else {
      audioBuffer.copyToChannel(interleaved, 0, 0);
    }

    const source = new AudioBufferSourceNode(this.audioCtx);
    source.buffer = audioBuffer;
    source.connect(this.audioInputNode);

    const now = this.audioCtx.currentTime;
    const minSchedule = now + this.streamLookAheadSec;
    const ahead = Math.max(0, (this.playTime || 0) - now);

    if (ahead > this.bufferLimit) {
      this.playTime = now + this.bufferThreshold;
    }

    const scheduledTime = Math.max(this.playTime || 0, minSchedule);
    // NOTE: playTime is advanced only after source.start() succeeds.
    // Previously it was advanced unconditionally before start(), so a
    // start() exception (e.g. AudioContext not running) would leave playTime
    // in the future causing a ~100 ms gap on the next scheduled chunk.

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this._scheduledSources.delete(source);
      try { source.disconnect(); } catch (e) {}
    };
    source.onended = cleanup;
    this._scheduledSources.add(source);

    try {
      source.start(scheduledTime);
      this.playTime = scheduledTime + audioBuffer.duration;  // advance only on success
    } catch (e) {
      console.error('Failed to start scheduled audio source:', e);
      cleanup();
      return 0;
    }

    setTimeout(cleanup, Math.max(1000, Math.ceil((audioBuffer.duration + 1.0) * 1000)));
    return audioBuffer.duration;
  }

  _flushPendingPlayback(force = false) {
    if (!this.audioCtx || !this.audioInputNode || this._streamPendingFrames <= 0) return 0;

    const pendingDuration = this._streamPendingFrames / this.audioOutputSps;
    const now = this.audioCtx.currentTime;
    const ahead = Math.max(0, (this.playTime || 0) - now);

    if (!force && pendingDuration < this.streamChunkTargetSec && pendingDuration < this.streamChunkMaxSec && ahead >= this.bufferThreshold * 0.75) {
      this._ensureStreamFlushTimer();
      return 0;
    }

    const built = this._buildPendingInterleaved();
    if (!built) return 0;
    return this._scheduleBufferSource(built.out, built.channels);
  }

  playPCM(buffer, playTime, sampleRate, scale, channels = 1) {  // ✅ ADDED: channels parameter
    if (!this.audioInputNode) {
      console.warn('Audio not initialized');
      return 0;
    }

    if (!this._streamSchedulerEnabled) {
      const source = new AudioBufferSourceNode(this.audioCtx);
      const frames = (channels === 2) ? Math.floor(buffer.length / 2) : buffer.length;
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
      source.onended = () => { try { source.disconnect(); } catch (e) {} };
      try { source.start(scheduledTime); } catch (e) {
        console.error('Failed to start audio source:', e);
        try { source.disconnect(); } catch (e2) {}
        return 0;
      }
      return audioBuffer.duration;
    }

    this._appendPlaybackChunk(buffer, channels);
    return this._flushPendingPlayback(false);
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
        const audioFullDate = audioYear + '-' + audioDay + '-' + audioMonth;
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
        ws.send(JSON.stringify({
          type:     'init',
          sps:      this.audioOutputSps || 8000,
          sideband: this._radeSideband,
        }));
        this._radeReady = true;
        this.decodeRADE = true;
        console.log('[RADE] \u25ba ENABLED', this._radeSideband,
                    '@', this.audioOutputSps, 'Hz \u2192 helper', helperUri);
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
      src.connect(this.audioCtx.destination);
      src.start(this._radeNextTime);
      src.onended = function() { src.disconnect(); };

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

  _sstvEnsureCapacity(extra) {
    if (this._sstvBufLen + extra <= this._sstvBuf.length) return;
    if (this._sstvProcessPos > 0) {
      const keep = this._sstvBufLen - this._sstvProcessPos;
      this._sstvBuf.copyWithin(0, this._sstvProcessPos, this._sstvBufLen);
      this._sstvBufLen = keep;
      this._sstvVisScanPos = Math.max(0, this._sstvVisScanPos - this._sstvProcessPos);
      this._sstvSyncAnchor -= this._sstvProcessPos;
      this._sstvProcessPos = 0;
      if (this._sstvBufLen + extra <= this._sstvBuf.length) return;
    }
    const n = new Float32Array(Math.max(this._sstvBuf.length * 2, this._sstvBufLen + extra + 8192));
    n.set(this._sstvBuf.subarray(0, this._sstvBufLen));
    this._sstvBuf = n;
  }

  _sstvFeedPCM(pcm) {
    if (this._sstvDecoder) this._sstvDecoder.feedPCM(pcm);
  }

  _sstvGoertzel(start, len, freq) {
    if (start < 0 || len <= 0 || start + len > this._sstvBufLen) return 0;
    const sr = this._sstvDecodeSps;
    const k = Math.round(0.5 + (len * freq) / sr);
    const w = 2.0 * Math.PI * k / len;
    const coeff = 2.0 * Math.cos(w);
    let q0 = 0, q1 = 0, q2 = 0;
    for (let i = 0; i < len; i++) {
      q0 = coeff * q1 - q2 + this._sstvBuf[start + i];
      q2 = q1;
      q1 = q0;
    }
    return q1*q1 + q2*q2 - coeff*q1*q2;
  }

  _sstvDominantTone(start, len, freqs) {
    let bestF = freqs[0], bestP = -1;
    for (const f of freqs) {
      const p = this._sstvGoertzel(start, len, f);
      if (p > bestP) { bestP = p; bestF = f; }
    }
    return { freq: bestF, power: bestP };
  }

  _sstvDetectVIS() {
    const need = Math.floor(this._sstvDecodeSps * 1.05);
    if (this._sstvBufLen - this._sstvVisScanPos < need) return false;
    const sym30 = Math.round(0.030 * this._sstvDecodeSps);
    const leader = Math.round(0.300 * this._sstvDecodeSps);
    const brk = Math.round(0.010 * this._sstvDecodeSps);
    const scanLimit = this._sstvBufLen - need;
    for (let pos = this._sstvVisScanPos; pos <= scanLimit; pos += Math.round(0.005 * this._sstvDecodeSps)) {
      const l1 = this._sstvDominantTone(pos, leader, [1200, 1900]);
      const b1 = this._sstvDominantTone(pos + leader, brk, [1200, 1900]);
      const l2 = this._sstvDominantTone(pos + leader + brk, leader, [1200, 1900]);
      const s0 = pos + leader + brk + leader;
      const st = this._sstvDominantTone(s0, sym30, [1100, 1200, 1300, 1900]);
      if (l1.freq !== 1900 || b1.freq !== 1200 || l2.freq !== 1900 || st.freq !== 1200) continue;
      let vis = 0;
      for (let i = 0; i < 7; i++) {
        const bit = this._sstvDominantTone(s0 + sym30 * (i + 1), sym30, [1100, 1300]);
        if (bit.freq === 1100) vis |= (1 << i);
      }
      const stop = this._sstvDominantTone(s0 + sym30 * 8, sym30, [1100, 1200, 1300]);
      if (stop.freq !== 1200) continue;
      const modeKey = this._sstvVisMap.get(vis);
      if (!modeKey) continue;
      this._sstvSetMode(modeKey, 'VIS');
      this._sstvSyncAnchor = s0 + sym30 * 10;
      this._sstvLine = 0;
      this._sstvNeedFreshSync = true;
      this._sstvVisScanPos = this._sstvSyncAnchor;
      return true;
    }
    this._sstvVisScanPos = Math.max(this._sstvVisScanPos, scanLimit);
    return false;
  }

  _sstvSetMode(modeKey, via = 'AUTO') {
    const mode = this._sstvModes[modeKey];
    if (!mode) return;
    this._sstvMode = mode;
    this._sstvDetectedMode = mode.name;
    this._sstvImageW = mode.width;
    this._sstvImageH = mode.height;
    if (this.sstvCallback) {
      this.sstvCallback({ type: 'mode', mode: mode.name, via });
      this.sstvCallback({ type: 'status', text: `${mode.name} lock (${via})` });
    }
  }

  _sstvTryAutoMode() {
    if (this._sstvForcedMode && this._sstvForcedMode !== 'auto') {
      if (!this._sstvMode || this._sstvMode.name.toLowerCase() !== this._sstvForcedMode.toLowerCase()) {
        const key = Object.keys(this._sstvModes).find(k => this._sstvModes[k].name.toLowerCase() === this._sstvForcedMode.toLowerCase() || k === this._sstvForcedMode.toLowerCase());
        if (key) this._sstvSetMode(key, 'FORCED');
      }
      return !!this._sstvMode;
    }
    if (this._sstvMode) return true;
    if (this._sstvBufLen < this._sstvDecodeSps * 2.0) return false;

    let best = null;
    const candidateKeys = ['martin1', 'martin2', 'scottie1', 'scottie2'];
    for (const key of candidateKeys) {
      const m = this._sstvModes[key];
      const lineS = Math.round(m.lineMs * this._sstvDecodeSps / 1000);
      const syncS = Math.max(24, Math.round(m.syncMs * this._sstvDecodeSps / 1000));
      const step = Math.round(0.010 * this._sstvDecodeSps);
      const anchorMin = this._sstvProcessPos;
      const anchorMax = Math.max(anchorMin, this._sstvBufLen - lineS * 3 - syncS - 8);
      for (let a = anchorMin; a <= anchorMax; a += step) {
        let score = 0;
        for (let n = 0; n < 3; n++) {
          let syncStart = a + n * lineS;
          if (m.family === 'scottie') {
            syncStart += Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._sstvDecodeSps / 1000);
          }
          const t1200 = this._sstvGoertzel(syncStart, syncS, 1200);
          const t1900 = this._sstvGoertzel(syncStart, syncS, 1900);
          score += (t1200 - 0.5 * t1900);
        }
        if (!best || score > best.score) best = { key, score, anchor: a };
      }
    }
    if (best && best.score > 5) {
      this._sstvSetMode(best.key, 'AUTO');
      const m = this._sstvModes[best.key];
      this._sstvSyncAnchor = best.anchor;
      if (m.family === 'scottie') {
        this._sstvSyncAnchor += Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._sstvDecodeSps / 1000);
      }
      this._sstvLine = 0;
      this._sstvNeedFreshSync = true;
      return true;
    }
    return false;
  }

  _sstvFindSyncNear(expectedSyncStart) {
    const m = this._sstvMode;
    if (!m) return { pos: expectedSyncStart, quality: 0 };
    const syncS = Math.max(24, Math.round(m.syncMs * this._sstvDecodeSps / 1000));
    const span = Math.round(0.025 * this._sstvDecodeSps);
    let bestPos = expectedSyncStart;
    let bestQ = -1e30;
    for (let pos = expectedSyncStart - span; pos <= expectedSyncStart + span; pos += 8) {
      if (pos < 0 || pos + syncS >= this._sstvBufLen) continue;
      const p1200 = this._sstvGoertzel(pos, syncS, 1200);
      const p1500 = this._sstvGoertzel(pos, syncS, 1500);
      const p1900 = this._sstvGoertzel(pos, syncS, 1900);
      const q = p1200 - 0.35 * p1500 - 0.35 * p1900;
      if (q > bestQ) { bestQ = q; bestPos = pos; }
    }
    return { pos: bestPos, quality: bestQ };
  }

  _sstvEstimateFreq(start, len) {
    const begin = Math.max(0, Math.floor(start));
    const end = Math.min(this._sstvBufLen, Math.floor(start + len));
    if (end - begin < 10) return 1500;
    let bestLag = 8;
    let best = -1e30;
    for (let lag = 5; lag <= 10; lag++) {
      let s = 0;
      for (let i = begin + lag; i < end; i++) s += this._sstvBuf[i] * this._sstvBuf[i - lag];
      if (s > best) { best = s; bestLag = lag; }
    }
    return this._sstvDecodeSps / bestLag;
  }

  _sstvDecodeLine(lineStart, syncStart) {
    const m = this._sstvMode;
    if (!m) return null;
    const W = m.width;
    const out = new Uint8ClampedArray(W * 4);
    const chS = m.chanMs * this._sstvDecodeSps / 1000;
    const porchS = m.porchMs * this._sstvDecodeSps / 1000;
    const sepS = m.sepMs * this._sstvDecodeSps / 1000;
    let segments;
    if (m.family === 'martin') {
      const base = syncStart + Math.round(m.syncMs * this._sstvDecodeSps / 1000) + porchS;
      segments = {
        g: base,
        b: base + chS + sepS,
        r: base + chS + sepS + chS + sepS
      };
    } else {
      const g = lineStart + porchS;
      const b = g + chS + sepS;
      const r = syncStart + Math.round(m.syncMs * this._sstvDecodeSps / 1000) + porchS;
      segments = { g, b, r };
    }
    const pixSpan = chS / W;
    for (let x = 0; x < W; x++) {
      const rv = Math.max(0, Math.min(255, Math.round((this._sstvEstimateFreq(segments.r + x * pixSpan, pixSpan + 6) - 1500) * 255 / 800)));
      const gv = Math.max(0, Math.min(255, Math.round((this._sstvEstimateFreq(segments.g + x * pixSpan, pixSpan + 6) - 1500) * 255 / 800)));
      const bv = Math.max(0, Math.min(255, Math.round((this._sstvEstimateFreq(segments.b + x * pixSpan, pixSpan + 6) - 1500) * 255 / 800)));
      const i = x * 4;
      out[i] = rv; out[i + 1] = gv; out[i + 2] = bv; out[i + 3] = 255;
    }
    return out;
  }

  _sstvProcess() {
    if (this._sstvDetectVIS()) {
      // fall through and start decoding immediately if enough data is buffered
    }
    if (!this._sstvMode && !this._sstvTryAutoMode()) return;
    const m = this._sstvMode;
    if (!m) return;
    const lineS = Math.round(m.lineMs * this._sstvDecodeSps / 1000);
    const syncOffsetScottie = (m.family === 'scottie')
      ? Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._sstvDecodeSps / 1000)
      : 0;

    while (this._sstvBufLen - this._sstvSyncAnchor >= lineS + this._sstvJitterLead && this._sstvLine < m.height) {
      const expectedSync = this._sstvNeedFreshSync ? this._sstvSyncAnchor : (this._sstvSyncAnchor + lineS);
      const found = this._sstvFindSyncNear(expectedSync);
      const useFound = found.quality > (this._sstvLastSyncQuality * 0.35);
      let syncStart = useFound ? found.pos : expectedSync;
      if (useFound) {
        this._sstvLastSyncQuality = Math.max(found.quality, 1e-9);
        this._sstvLostSyncCount = 0;
      } else {
        this._sstvLostSyncCount++;
      }
      const lineStart = (m.family === 'scottie') ? (syncStart - syncOffsetScottie) : syncStart;
      if (lineStart < 0 || lineStart + lineS >= this._sstvBufLen) break;
      const pixels = this._sstvDecodeLine(lineStart, syncStart);
      if (pixels && this.sstvCallback) {
        this.sstvCallback({
          type: 'line',
          pixels,
          lineNum: this._sstvLine,
          width: m.width,
          height: m.height,
          mode: m.name,
          syncQuality: found.quality,
          soft: !useFound
        });
      }
      this._sstvLine++;
      this._sstvNeedFreshSync = false;
      this._sstvSyncAnchor = syncStart;
      this._sstvProcessPos = Math.max(this._sstvProcessPos, lineStart);
      if (this._sstvLine >= m.height) {
        if (this.sstvCallback) this.sstvCallback({ type: 'status', text: 'Frame complete' });
        this._sstvMode = null;
        this._sstvDetectedMode = '';
        this._sstvNeedFreshSync = true;
        this._sstvVisScanPos = this._sstvProcessPos;
        break;
      }
    }
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
    this._faxAutoAlign = !!enabled;
    this._faxDarkCount = 0;
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
    const startDet = this._faxFourierTransformSub(centered, sampsPerLine, bufferLen, this._faxStartTone) / bufferLen;
    const stopDet  = this._faxFourierTransformSub(centered, sampsPerLine, bufferLen, this._faxStopToneHz) / bufferLen;
    const startRatio = startDet / rms;
    const stopRatio  = stopDet / rms;

    if (startRatio > 0.90 && startDet > 12) return 'START';
    if (stopRatio  > 0.90 && stopDet  > 12) return 'STOP';
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
   * The PCM is expected to be post-demod audio at audioOutputSps.
   */
  _faxFeedPCM(pcm) {
    const inSr = this.audioOutputSps || 12000;
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

  _cwReset() {
    this.cwFreqBuf       = [];
    this.cwFreqBufTarget = 4096;   // ~0.34 s at 12 kHz
    this.cwToneFreq = 700;         // Hz; updated by FFT
    this.cwSR       = 12000;

    // ── IIR biquad bandpass state ─────────────────────────────────────────
    this.cwIirX1 = 0; this.cwIirX2 = 0;
    this.cwIirY1 = 0; this.cwIirY2 = 0;
    this.cwIirB0 = 0; this.cwIirB2 = 0;
    this.cwIirA1 = 0; this.cwIirA2 = 0;
    this.cwIirFreq = 0;

    // ── Envelope detector state ───────────────────────────────────────────
    this.cwEnv   = 0;
    this.cwPeak  = 0;
    this.cwFloor = 1e-7;

    // ── Schmitt trigger ───────────────────────────────────────────────────
    this.cwKeyDown = false;

    // ── Timing counters (samples) ─────────────────────────────────────────
    this.cwMarkSamp  = 0;
    this.cwSpaceSamp = 0;

    // ── Mark k-means centres (samples; 0 = unknown) ───────────────────────
    //    cwDitLen / cwDahLen track the physical durations of dit and dah
    //    elements as seen at the Schmitt trigger output (including envelope
    //    attack/release bias, which is constant and cancels out).
    this.cwDitLen = 0;
    this.cwDahLen = 0;

    // ── Timing PLL ────────────────────────────────────────────────────────
    //    cwPllPeriod = authoritative dit-clock period in samples.
    //    Bootstrapped from the first dit measurement, then refined by
    //    integral corrections from every mark and every space.
    this.cwPllPeriod = 0;

    // ── Space k-means centres (samples; 0 = unknown) ──────────────────────
    //    cwShortSpace ≈ 1T  (inter-element gap, should equal 1 dit)
    //    cwLongSpace  ≈ 3T  (inter-character gap)
    //    Word spaces are classified separately (> cwLongSpace × 1.6).
    this.cwShortSpace = 0;
    this.cwLongSpace  = 0;

    // ── Silence detection ──────────────────────────────────────────────────
    //    cwSilent = true once silence is declared; cleared on next rising edge.
    //    Prevents emitting repeated silence events during one quiet period.
    this.cwSilent = false;

    // ── Morse character buffer ────────────────────────────────────────────
    this.cwMorse = '';
    if (this.cwCharTimeout) { clearTimeout(this.cwCharTimeout); this.cwCharTimeout = null; }
  }

  setCWDecoding(value) {
    this.decodeCW = value;
    // ✅ FIXED: only reset state on enable — disabling mid-QSO was discarding
    //   the PLL period, k-means centres, and frequency lock unnecessarily.
    if (value) this._cwReset();
  }

  setCWCallback(cb) {
    this.cwCallback = cb;
  }

  // ── Biquad bandpass coefficient computation ─────────────────────────────────
  /**
   * Direct-Form-I biquad bandpass, Q = 15 (≈ ±47 Hz at 700 Hz).
   * Audio-EQ cookbook formulation; coefficients pre-divided by a0.
   *   y[n] = B0·x[n] + B2·x[n-2] − A1·y[n-1] − A2·y[n-2]
   */
  _cwComputeBiquad(freq, sr) {
    // Q = 10 → 3 dB bandwidth = freq/Q ≈ ±35 Hz at 700 Hz.
    // Wider than v4's Q=15 (±23 Hz): tolerates the ~30–40 Hz error that
    // can exist during the first FFT frame (0.34 s) before the frequency
    // estimate has converged to the true tone.
    const Q     = 10;
    const w0    = 2 * Math.PI * freq / sr;
    const alpha = Math.sin(w0) / (2 * Q);
    const a0    = 1 + alpha;
    this.cwIirB0  =  alpha / a0;
    this.cwIirB2  = -alpha / a0;
    this.cwIirA1  = -2 * Math.cos(w0) / a0;
    this.cwIirA2  = (1 - alpha) / a0;
    this.cwIirFreq = freq;
    console.debug(`[CW] biquad @ ${freq.toFixed(1)} Hz`);
  }

  // ── Frequency auto-detection ────────────────────────────────────────────────
  /**
   * 4096-point FFT, Hann window, quadratic sub-bin interpolation.
   * Returns NaN when SNR < 8 dB (prevents noise stealing the frequency lock).
   */
  _cwDetectFreq(samples, sr) {
    const N = 4096;
    const fftin = new Array(N);
    for (let i = 0; i < N; i++) {
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
      fftin[i] = [i < samples.length ? samples[i] * w : 0, 0];
    }
    let spectrum;
    try { spectrum = fft(fftin); } catch(e) { return NaN; }

    const freqRes = sr / N;
    const binLow  = Math.max(1,   Math.floor(200  / freqRes));
    const binHigh = Math.min(N/2, Math.ceil (2500 / freqRes));

    let maxPow = 0, maxBin = binLow;
    const pow = new Float32Array(N / 2 + 1);
    for (let b = binLow; b <= binHigh; b++) {
      const re = spectrum[b][0], im = spectrum[b][1];
      pow[b] = re * re + im * im;
      if (pow[b] > maxPow) { maxPow = pow[b]; maxBin = b; }
    }

    // SNR guard: peak must be ≥ 8 dB (6.3×) above ±20-bin neighbourhood mean
    const nbHalf = 20;
    let nbSum = 0, nbCnt = 0;
    for (let b = Math.max(binLow, maxBin - nbHalf);
             b <= Math.min(binHigh, maxBin + nbHalf); b++) {
      if (b === maxBin) continue;
      nbSum += pow[b]; nbCnt++;
    }
    const meanNb = nbCnt > 0 ? nbSum / nbCnt : maxPow;
    if (maxPow < meanNb * 6.3) return NaN;

    // Quadratic interpolation for sub-bin accuracy
    let delta = 0;
    if (maxBin > binLow && maxBin < binHigh) {
      const yL = pow[maxBin - 1], yC = pow[maxBin], yR = pow[maxBin + 1];
      const denom = 2 * (2 * yC - yL - yR);
      if (denom > 0) delta = (yL - yR) / denom;
    }
    const detectedHz = (maxBin + delta) * freqRes;
    console.debug(`[CW] tone ${detectedHz.toFixed(1)} Hz  SNR ${(10*Math.log10(maxPow/meanNb)).toFixed(1)} dB`);
    return detectedHz;
  }

  // ── Mark classifier with PLL update ────────────────────────────────────────
  /**
   * Online k-means for two element clusters (dit / dah), with integral-gain
   * PLL update after each classification.
   *
   * The PLL update uses n = 1 (dit) or n = 3 (dah).  The error is clamped to
   * ±50% of the expected duration to reject false edges from noise bursts.
   */
  _cwClassifyMark(dur) {
    const bothKnown = this.cwDitLen > 0 && this.cwDahLen > 0;
    const LEARN = bothKnown ? 0.07 : 0.15;
    let isDit;

    // ── k-means ──────────────────────────────────────────────────────────
    if (this.cwDitLen === 0 && this.cwDahLen === 0) {
      // Cold start: store provisional dit — will be corrected if next
      // element reveals this was actually a dah (see retroactive check below)
      this.cwDitLen = dur; isDit = true;

    } else if (this.cwDahLen === 0) {
      if (dur > this.cwDitLen * 2.2) {
        // Clearly longer → bootstrap dah centre
        this.cwDahLen = dur; isDit = false;
      } else if (dur < this.cwDitLen * 0.45) {
        // ── Retroactive correction ──────────────────────────────────────
        // The first (provisional) element was actually a DAH — it is more
        // than 2× this new element.  Swap: move provisional value to dah,
        // set dit to current duration.
        // Threshold 0.45: real dit/dah ratio = 1/3 ≈ 0.33; 0.45 gives safe
        // margin above 1:2 ambiguity, below 1:3 target.
        this.cwDahLen = this.cwDitLen;
        this.cwDitLen = dur;
        isDit = true;
      } else {
        // Within range of current dit estimate
        this.cwDitLen = this.cwDitLen * (1 - LEARN) + dur * LEARN; isDit = true;
      }

    } else if (this.cwDitLen === 0) {
      if (dur < this.cwDahLen * 0.55) {
        this.cwDitLen = dur; isDit = true;
      } else {
        this.cwDahLen = this.cwDahLen * (1 - LEARN) + dur * LEARN; isDit = false;
      }
    } else {
      const mid = (this.cwDitLen + this.cwDahLen) / 2;
      if (dur < mid) {
        this.cwDitLen = this.cwDitLen * (1 - LEARN) + dur * LEARN; isDit = true;
      } else {
        this.cwDahLen = this.cwDahLen * (1 - LEARN) + dur * LEARN; isDit = false;
      }
    }

    // ── PLL integral update ───────────────────────────────────────────────
    // n = 1 for dit, 3 for dah.  Clamp to ±50% of expected to reject noise.
    const n = isDit ? 1 : 3;
    if (this.cwPllPeriod < 1) {
      // Bootstrap from first element regardless of type:
      //   first dit → T = dur
      //   first dah → T = dur / 3  (only after retroactive correction fires)
      if (isDit) this.cwPllPeriod = this.cwDitLen;       // corrected dit len
      else       this.cwPllPeriod = this.cwDahLen / 3;   // dah → infer T
    } else {
      const expected = n * this.cwPllPeriod;
      const error    = dur - expected;
      if (Math.abs(error) < expected * 0.5) {
        this.cwPllPeriod = Math.max(10, this.cwPllPeriod + 0.04 * error);
      }
    }

    return isDit ? '.' : '-';
  }

  // ── Space classifier with k-means + PLL update ──────────────────────────────
  /**
   * Two independent k-means clusters replace the fixed-ratio thresholds:
   *   cwShortSpace ≈ 1T  (inter-element gap)
   *   cwLongSpace  ≈ 3T  (inter-character gap)
   *
   * Word space = clearly beyond inter-character territory:
   *   > cwLongSpace × 1.6   when long centre is known
   *   > T × 5               during cold-start (before long centre established)
   *
   * Every classified space nudges cwPllPeriod via integral control.
   * Error clamped to ±60% of expected to handle Farnsworth and slow ops.
   */
  _cwClassifySpace(spaceSamp) {
    // Use PLL period as timing reference; fall back to mark k-means dit length
    const T = this.cwPllPeriod > 1 ? this.cwPllPeriod : this.cwDitLen;
    if (T < 1) return;  // no timing reference yet — discard

    const LEARN_SP = 0.10;  // slightly faster than mark k-means (spaces are noisier)

    // ── PLL integral update (inner helper) ───────────────────────────────
    //    n = expected integer multiple of T.
    //    Gain 0.025 (gentler than mark gain 0.04 — spaces have more jitter).
    //    Clamp ±60% of expected: rejects wildly long Farnsworth inter-char
    //    gaps from corrupting the element-period estimate.
    const pllNudge = (samp, n) => {
      if (this.cwPllPeriod < 1) return;
      const expected = n * this.cwPllPeriod;
      const error    = samp - expected;
      if (Math.abs(error) < expected * 0.6) {
        this.cwPllPeriod = Math.max(10, this.cwPllPeriod + 0.025 * error);
      }
    };

    // ── Word space check (runs first, before k-means) ─────────────────────
    //    Standard CW: inter-char = 3T, word space = 7T → ratio 2.33×
    //    Tight operators: inter-char ≈ 3T, word space ≈ 5T → ratio 1.67×
    //    Geometric-mean split between 3T and 7T: √(3×7) × T ≈ 4.58T = 3T × 1.53
    //    We use 1.6× (slightly above geometric mean) to stay clear of
    //    jittery inter-char gaps while catching tight 5T word spaces.
    //
    //    Cold-start fallback: 4T (midpoint between 3T inter-char and 5T word).
    //    This fires earlier than the old 5T and catches all real-world operators.
    const wordThresh = this.cwLongSpace > 0
      ? this.cwLongSpace * 1.6
      : T * 4;

    if (spaceSamp >= wordThresh) {
      this._cwFlushChar();
      pllNudge(spaceSamp, 7);    // clamped → no-op if Farnsworth inter-char gap
      if (this.cwCallback) this.cwCallback({ type: 'word' });
      return;
    }

    // ── Space k-means ─────────────────────────────────────────────────────

    // Cold start: neither centre known → classify by PLL period
    if (this.cwShortSpace === 0 && this.cwLongSpace === 0) {
      if (spaceSamp < T * 2.0) {
        this.cwShortSpace = spaceSamp;    // inter-element
        pllNudge(spaceSamp, 1);
      } else {
        this.cwLongSpace = spaceSamp;     // inter-character → flush
        this._cwFlushChar();
        pllNudge(spaceSamp, 3);
      }
      return;
    }

    // Only short centre known
    if (this.cwLongSpace === 0) {
      if (spaceSamp > this.cwShortSpace * 2.2) {
        this.cwLongSpace = spaceSamp;     // bootstrap long centre → flush
        this._cwFlushChar();
        pllNudge(spaceSamp, 3);
      } else {
        this.cwShortSpace = this.cwShortSpace * (1 - LEARN_SP) + spaceSamp * LEARN_SP;
        pllNudge(spaceSamp, 1);
      }
      return;
    }

    // Only long centre known
    if (this.cwShortSpace === 0) {
      if (spaceSamp < this.cwLongSpace * 0.55) {
        this.cwShortSpace = spaceSamp;    // bootstrap short centre
        pllNudge(spaceSamp, 1);
      } else {
        this.cwLongSpace = this.cwLongSpace * (1 - LEARN_SP) + spaceSamp * LEARN_SP;
        this._cwFlushChar();
        pllNudge(spaceSamp, 3);
      }
      return;
    }

    // Both centres known → nearest-centre assignment
    const midSp = (this.cwShortSpace + this.cwLongSpace) / 2;
    if (spaceSamp < midSp) {
      // Inter-element gap
      this.cwShortSpace = this.cwShortSpace * (1 - LEARN_SP) + spaceSamp * LEARN_SP;
      pllNudge(spaceSamp, 1);
    } else if (spaceSamp > this.cwLongSpace * 1.5) {
      // Clearly beyond inter-char territory even with jitter → word space.
      // This safety catch prevents a slipped word-space from pulling
      // cwLongSpace upward and raising the threshold for future detections.
      this._cwFlushChar();
      pllNudge(spaceSamp, 7);
      if (this.cwCallback) this.cwCallback({ type: 'word' });
    } else {
      // Inter-character gap → flush current character
      this.cwLongSpace = this.cwLongSpace * (1 - LEARN_SP) + spaceSamp * LEARN_SP;
      this._cwFlushChar();
      pllNudge(spaceSamp, 3);
    }
  }

  // ── Morse lookup + char flush ───────────────────────────────────────────────
  _cwFlushChar() {
    if (!this.cwMorse) return;
    const ch = this._cwLookup(this.cwMorse);
    this.cwMorse = '';
    if (ch && this.cwCallback) this.cwCallback({ type: 'char', char: ch });
  }

  _cwLookup(m) {
    const T = {
      '.-':'A',   '-...':'B', '-.-.':'C', '-..':'D',  '.':'E',
      '..-.':'F', '--.':'G',  '....':'H', '..':'I',   '.---':'J',
      '-.-':'K',  '.-..':'L', '--':'M',   '-.':'N',   '---':'O',
      '.--.':'P', '--.-':'Q', '.-.':'R',  '...':'S',  '-':'T',
      '..-':'U',  '...-':'V', '.--':'W',  '-..-':'X', '-.--':'Y',
      '--..':'Z',
      '-----':'0','.----':'1','..---':'2','...--':'3','....-':'4',
      '.....':'5','-....':'6','--...':'7','---..':'8','----.':'9',
      '.-.-.-':'.','--..--':',','..--..':'?','-..-.':'/',
      '-.-.--':'!','.--.-.':'@','-....-':'-','...-..-':'$'
    };
    return T[m] || `[${m}]`;
  }

  // ── Main PCM entry point ────────────────────────────────────────────────────
  /**
   * Sample-by-sample IIR pipeline (unchanged from v4).
   * PLL period is now used for the safety flush timer instead of cwDitLen,
   * giving a more accurate timeout at all operating speeds.
   */
  _cwFeedPCM(pcmArray) {
    const sr = this.cwSR = (this.audioOutputSps || 12000);

    // Time constants — exact, sample-rate-independent
    const ATK        = 1 - Math.exp(-1 / (sr * 0.002));   // envelope attack  τ = 2 ms
    const REL        = 1 - Math.exp(-1 / (sr * 0.006));   // envelope release τ = 6 ms
    const PEAK_DECAY = Math.exp(-Math.LN2 / sr);           // peak half-life   1 s
    const FLOOR_FALL = 1 - Math.exp(-1 / (sr * 1.0));     // noise floor fall τ = 1 s
    const FLOOR_RISE = 1 - Math.exp(-1 / (sr * 30.0));    // noise floor rise τ = 30 s

    if (this.cwIirFreq === 0) this._cwComputeBiquad(this.cwToneFreq, sr);

    for (let i = 0; i < pcmArray.length; i++) {
      const x = pcmArray[i];

      // ── A. FFT frequency-detection buffer ─────────────────────────────
      this.cwFreqBuf.push(x);
      if (this.cwFreqBuf.length >= this.cwFreqBufTarget) {
        const snap = this.cwFreqBuf.splice(0, this.cwFreqBufTarget);
        const hz   = this._cwDetectFreq(snap, sr);
        if (!isNaN(hz) && hz > 150 && hz < 3000) {
          this.cwToneFreq = this.cwToneFreq * 0.60 + hz * 0.40;  // IIR smooth (faster convergence)
          const wpm = this.cwPllPeriod > 0
            ? Math.round(1200 / (this.cwPllPeriod / sr * 1000))
            : 0;
          if (this.cwCallback) this.cwCallback({ type: 'freq', hz: Math.round(this.cwToneFreq), wpm });
        }
      }

      // ── B. Recompute biquad if tone drifted > 2 Hz ────────────────────
      if (Math.abs(this.cwToneFreq - this.cwIirFreq) > 2) {
        this._cwComputeBiquad(this.cwToneFreq, sr);
      }

      // ── C. IIR bandpass (Direct Form I, b1 = 0) ───────────────────────
      const y = this.cwIirB0 * x
              + this.cwIirB2 * this.cwIirX2
              - this.cwIirA1 * this.cwIirY1
              - this.cwIirA2 * this.cwIirY2;
      this.cwIirX2 = this.cwIirX1; this.cwIirX1 = x;
      this.cwIirY2 = this.cwIirY1; this.cwIirY1 = y;

      // ── D. Full-wave rectify → asymmetric IIR envelope ────────────────
      const rect  = Math.abs(y);
      const alpha = rect > this.cwEnv ? ATK : REL;
      this.cwEnv += alpha * (rect - this.cwEnv);
      const env = this.cwEnv;

      // ── E. Peak tracker (instant attack, 1 s half-life decay) ─────────
      if (env >= this.cwPeak) { this.cwPeak = env; }
      else                    { this.cwPeak *= PEAK_DECAY; }

      // ── F. Noise floor ─────────────────────────────────────────────────
      if (env < this.cwFloor) { this.cwFloor -= FLOOR_FALL * (this.cwFloor - env); }
      else                    { this.cwFloor += FLOOR_RISE * (env - this.cwFloor); }

      // ── G. SNR guard + silence detection ─────────────────────────────
      if (this.cwPeak < this.cwFloor * 3 || this.cwPeak < 1e-6) {
        this.cwSpaceSamp++;

        // Silence threshold: 2 s absolute, or 20 × PLL period (whichever
        // is larger), so fast operators still get a 2 s gap between QSOs.
        // We use samples, not ms, for exact comparison.
        const silenceThresh = Math.max(
          sr * 2,
          this.cwPllPeriod > 0 ? this.cwPllPeriod * 20 : 0
        );

        if (!this.cwSilent && this.cwSpaceSamp >= silenceThresh) {
          this.cwSilent = true;

          // Flush any partial character that the safety timer hasn't fired yet
          if (this.cwCharTimeout) { clearTimeout(this.cwCharTimeout); this.cwCharTimeout = null; }
          this._cwFlushChar();

          // Cap cwSpaceSamp so when signal returns _cwClassifySpace sees at
          // most one clean word-space worth of samples, not millions.
          // We use 8 × T (just above the 7T word-space boundary) so it
          // correctly fires as a word space on the next rising edge.
          const T = this.cwPllPeriod > 1 ? this.cwPllPeriod : this.cwDitLen;
          this.cwSpaceSamp = T > 0 ? Math.round(T * 8) : this.cwSpaceSamp;

          if (this.cwCallback) this.cwCallback({ type: 'silence' });
        }
        continue;
      }

      // ── H. Schmitt trigger ─────────────────────────────────────────────
      const HIGH = this.cwPeak * 0.60;
      const LOW  = this.cwPeak * 0.25;
      let keyNow = this.cwKeyDown;
      if (!this.cwKeyDown && env > HIGH) keyNow = true;
      if ( this.cwKeyDown && env < LOW ) keyNow = false;

      // ── I. Edge detection ──────────────────────────────────────────────
      if (keyNow !== this.cwKeyDown) {
        if (keyNow) {
          // Rising edge: key DOWN
          this.cwKeyDown = true;
          this.cwSilent = false;   // signal returned — clear silence flag
          if (this.cwCharTimeout) { clearTimeout(this.cwCharTimeout); this.cwCharTimeout = null; }
          if (this.cwSpaceSamp > 0) {
            this._cwClassifySpace(this.cwSpaceSamp);
            this.cwSpaceSamp = 0;
          }
        } else {
          // Falling edge: key UP
          this.cwKeyDown = false;
          if (this.cwMarkSamp > 0) {
            const elem = this._cwClassifyMark(this.cwMarkSamp);
            // Guard: longest valid code is 7 elements ($=...-..-)
            // Cap at 8 to prevent noise building unbounded garbage.
            if (this.cwMorse.length < 8) this.cwMorse += elem;
            this.cwMarkSamp = 0;
          }
          // Safety flush timer: uses PLL period (most accurate available estimate).
          // Falls back to mark k-means dit length before PLL is bootstrapped.
          // Minimum 350 ms covers up to ~40 WPM (dit ≈ 30 ms → 5 dits = 150 ms).
          const T      = this.cwPllPeriod > 1 ? this.cwPllPeriod : this.cwDitLen;
          const ditMs  = T > 0 ? (T / sr) * 1000 : 80;
          const flushMs = Math.max(350, ditMs * 5);
          if (this.cwCharTimeout) clearTimeout(this.cwCharTimeout);
          this.cwCharTimeout = setTimeout(() => {
            this.cwCharTimeout = null;
            this._cwFlushChar();
          }, flushMs);
        }
      }

      // ── J. Accumulate timing counters ──────────────────────────────────
      if (this.cwKeyDown) { this.cwMarkSamp++;  }
      else                { this.cwSpaceSamp++; }
    }
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