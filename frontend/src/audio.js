import { createDecoder, firdes_kaiser_lowpass } from './lib/wrappers'
import { OpusMLDecoder } from '@wasm-audio-decoders/opus-ml';

import createWindow from 'live-moving-average'
import { decode as cbor_decode } from 'cbor-x';
import { encode, decode } from "./modules/ft8.js";

import { AudioContext, ConvolverNode, IIRFilterNode, GainNode, AudioBuffer, AudioBufferSourceNode, DynamicsCompressorNode, MediaStreamAudioDestinationNode } from 'standardized-audio-context'
import { BiquadFilterNode } from 'standardized-audio-context';

import { fft, ifft } from 'fft-js';

class OpusMLAdapter {
  constructor(targetSampleRate) {
    // targetSampleRate is what the rest of the pipeline expects (e.g. 12000),
    // but the Opus bitstream itself carries its own sample rate, so we mostly
    // use this value for logging and optional resampling if ever needed.
    this.targetSampleRate = targetSampleRate || 48000;
    this.decoder = null;
    this.isReady = false;

    try {
      // Let the decoder infer the Opus stream configuration from the frames
      // themselves. We explicitly force mono to match the rest of the audio chain.
      this.decoder = new OpusMLDecoder({
      sampleRate: 48000,
      channels: 1,
      frameDuration: 10,     // 10 ms packets – sweet spot for HF
      forwardErrorCorrection: false,
      lowLatency: true,
      });

      // If the decoder exposes a .ready Promise, wait for it; otherwise assume ready now.
      if (this.decoder && this.decoder.ready && typeof this.decoder.ready.then === 'function') {
        this.decoder.ready
          .then(() => {
            this.isReady = true;
            console.log('OpusMLDecoder ready (target pipeline rate =', this.targetSampleRate, 'Hz)');
          })
          .catch((e) => {
            console.error('OpusMLDecoder.ready rejected', e);
          });
      } else {
        this.isReady = true;
        console.log('OpusMLDecoder created (no ready Promise)');
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

      const pcmRaw = result.channelData[0] || new Float32Array(0);

      // Apply a modest gain boost for Opus to bring its level closer to FLAC,
      // and to make even very small decoded values audible for debugging.
      const gain = 300.0; // Adjust if it sounds too loud/quiet.

      // Determine input/output sample rates
      const inSampleRate = result.sampleRate || this.targetSampleRate || 48000;
      const outSampleRate = this.targetSampleRate || inSampleRate;

      let pcm;
      let maxAbs = 0;

      if (inSampleRate && outSampleRate && inSampleRate !== outSampleRate) {
        // Simple integer-ratio down/upsampling if possible (e.g. 48000 -> 12000)
        const ratio = inSampleRate / outSampleRate;
        const rounded = Math.round(ratio);

        if (Math.abs(ratio - rounded) < 1e-6 && rounded >= 1) {
          const factor = rounded;
          const outLen = Math.floor(pcmRaw.length / factor);
          pcm = new Float32Array(outLen);
          const step = Math.max(1, Math.floor(outLen / 32));
          for (let i = 0; i < outLen; i++) {
            const v = pcmRaw[i * factor] * gain;
            pcm[i] = v;
            if (i % step === 0) {
              const a = Math.abs(v);
              if (a > maxAbs) maxAbs = a;
            }
          }
        } else {
          // Fallback: no clean integer ratio – just copy with gain applied
          pcm = new Float32Array(pcmRaw.length);
          const step = Math.max(1, Math.floor(pcmRaw.length / 32));
          for (let i = 0; i < pcmRaw.length; i++) {
            const v = pcmRaw[i] * gain;
            pcm[i] = v;
            if (i % step === 0) {
              const a = Math.abs(v);
              if (a > maxAbs) maxAbs = a;
            }
          }
        }
      } else {
        // Same rate, or unknown – just apply gain
        pcm = new Float32Array(pcmRaw.length);
        const step = Math.max(1, Math.floor(pcmRaw.length / 32));
        for (let i = 0; i < pcmRaw.length; i++) {
          const v = pcmRaw[i] * gain;
          pcm[i] = v;
          if (i % step === 0) {
            const a = Math.abs(v);
            if (a > maxAbs) maxAbs = a;
          }
        }
      }

      console.debug(
        'OpusMLAdapter.decode: pcm len =',
        pcm.length,
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

  free() {
    if (this.decoder && typeof this.decoder.free === 'function') {
      this.decoder.free();
    }
    this.decoder = null;
    this.isReady = false;
  }
}

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

    this.demodulation = 'USB'

    // Decoders
    this.accumulator = [];
    this.decodeFT8 = false;
    this.farthestDistance = 0;
    this.nb = false;
    // Separate client-side toggles
    this.nbBlankerEnabled = false; // impulsive noise blanker
    this.nrEnabled = false;        // spectral noise reduction

    // Adaptive noise-cancel gate (works for FLAC & Opus)
    this.noiseCancelEnabled = true;
    this.noiseEnv           = 0;
    this.noiseFloor         = 0.001;
    this.noiseGateOpen      = true;

    // Audio controls
    this.mute = false
    this.squelchMute = false
    this.squelch = false
    this.squelchThreshold = 0
    this.power = 1
    this.ctcss = false
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

    // ALTERNATIVE PROFILES FOR DIFFERENT USE CASES:
    // =============================================

    // Profile 1: Maximum Quality (recommended for strong signals)
    // this.nbFFTSize = 2048;
    // this.nbOverlap = 1536;          // 75% overlap
    // this.nbAverageWindows = 32;
    // this.nbThreshold = 0.140;

    // Profile 2: Balanced (good general purpose)
    // this.nbFFTSize = 2048;
    // this.nbOverlap = 1024;          // 50% overlap
    // this.nbAverageWindows = 24;
    // this.nbThreshold = 0.135;

    // Profile 3: Performance (lower CPU usage)
    // this.nbFFTSize = 1024;
    // this.nbOverlap = 768;           // 75% overlap
    // this.nbAverageWindows = 20;
    // this.nbThreshold = 0.145;

    // Profile 4: Aggressive Blanking (heavy QRM environments)
    // this.nbFFTSize = 2048;
    // this.nbOverlap = 1536;
    // this.nbAverageWindows = 40;     // Very stable baseline
    // this.nbThreshold = 0.110;       // More sensitive

    // Profile 5: Light Touch (preserve weak signals)
    // this.nbFFTSize = 1024;
    // this.nbOverlap = 512;
    // this.nbAverageWindows = 16;
    // this.nbThreshold = 0.180;       // Less aggressive


    // RECOMMENDED SETTINGS BY MODE:
    // =============================

    // SSB/USB/LSB: Use Profile 1 (Maximum Quality)
    // CW: Use Profile 2 (Balanced) or Profile 5 (Light Touch)
    // AM: Use Profile 2 (Balanced)
    // FM: Use Profile 3 (Performance) - impulse noise less critical
    // Weak Signal Work: Use Profile 5 (Light Touch)
    // Urban/High QRM: Use Profile 4 (Aggressive Blanking)

    if (this.audioCtx && this.audioCtx.state == 'running') {
      startaudio = document.getElementById('startaudio')
      if (startaudio) {
        startaudio.remove()
      }
    } else {
      // for chrome
      const userGestureFunc = () => {
        if (this.audioCtx && this.audioCtx.state !== 'running') {
          this.audioCtx.resume()
        }
        // Remove the element with id startaudio from the DOM
        const startaudio = document.getElementById('startaudio')
        if (startaudio) {
          startaudio.remove()
        }
        document.documentElement.removeEventListener('mousedown', userGestureFunc)
      }
      document.documentElement.addEventListener('mousedown', userGestureFunc)
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

    return this.promise
  }

  stop() {
    this.audioSocket.close()
    this.decoder.free()
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
  this.setGain(50); // was 50
  this.agcEnabled = true;

  switch (newAGCSpeed) {

    case 0: // AGC Auto (adaptive, moderate)
      // Automatically balances responsiveness and smoothness
      this.agcAttackTime = 0.03;       // 30 ms: reacts quickly to rising signals
      this.agcReleaseTime = 0.50;      // 300 ms: gentle recovery to avoid pumping
      this.agcLookaheadTime = 0.05;    // 50 ms: lookahead for peak anticipation
      this.agcTargetLevel = 0.9;       // Target around -1 dBFS
      this.agcMaxGain = 5;             // Allow up to 5× gain
      this.smoothMaxgain(0.9);         // Slight smoothing for steady gain
      break;

    case 1: // AGC Speed Fast
      // Ideal for speech or CW signals where rapid response is needed
      this.agcAttackTime = 0.005;      // 5 ms: very quick attack for transients
      this.agcReleaseTime = 0.2;      // 50 ms: quick recovery to new levels
      this.agcLookaheadTime = 0.02;    // 20 ms: short lookahead to catch peaks
      this.agcTargetLevel = 0.75;      // Slightly lower target (-2.5 dBFS)
      this.agcMaxGain = 5;             // Moderate gain limit to avoid overshoot
      this.smoothMaxgain(0.7);         // Faster smoothing for agility
      break;

    case 2: // AGC Speed Medium
      // Balanced mode: good for general music and broadcast audio
      this.agcAttackTime = 0.02;       // 20 ms: natural attack
      this.agcReleaseTime = 1.5;       // 1000 ms: slower release to maintain warmth
      this.agcLookaheadTime = 0.08;    // 80 ms: moderate lookahead
      this.agcTargetLevel = 1.0;       // Nominal unity (0 dBFS target)
      this.agcMaxGain = 5;             // Up to 5× gain
      this.smoothMaxgain(1.0);         // Balanced smoothing factor
      break;

    case 3: // AGC Speed Slow
      // Smooth long-term leveling, ideal for wide dynamic range (music, AM/FM)
      this.agcAttackTime = 0.1;        // 100 ms: slow attack to preserve transients
      this.agcReleaseTime = 2.5;       // 2.0 s: long release for stable dynamics
      this.agcLookaheadTime = 0.12;    // 120 ms: slightly longer lookahead
      this.agcTargetLevel = 1.1;       // Slightly boosted target
      this.agcMaxGain = 5;             // More headroom for quiet passages
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
          for (let i = 1; i < 20002; i++) {
          if (i > 20000) {
          this.setGain(50);
          }
        }
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

      // Perform FFT
      const phasors = fft(Array.from(this.nbBuffer));

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


  // Adaptive "noise cancel" – minimizes background noise
  // while preserving weak signals by working relative to the noise floor.
  applyNoiseCancel(pcmArray) {
    if (!this.noiseCancelEnabled) return pcmArray;

    const out = new Float32Array(pcmArray.length);

    // --- State ---
    let env        = this.noiseEnv || 0;
    let noiseFloor = this.noiseFloor || 0.001;
    let gateOpen   = (this.noiseGateOpen !== undefined)
      ? this.noiseGateOpen
      : true;

    // Balanced tuning for all modes (SSB/AM/CW)
    const alphaEnv        = 0.01;    // envelope smoothing
    const alphaNoiseFloor = 0.0005;  // slow noise-floor tracking
    const openFactor      = 3.0;     // env > 3x noise -> open
    const closeFactor     = 1.8;     // env < 1.8x noise -> close
    const floorGain       = 0.2;     // when closed, keep -14 dB background

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
      this.resolvePromise()
      return
    }

    this.audioStartTime = this.audioCtx.currentTime
    this.playTime       = this.audioCtx.currentTime + this.bufferThreshold;
    this.playStartTime  = this.audioCtx.currentTime;

    if (settings.audio_compression === 'opus') {
      // Use WASM-based Opus ML decoder for raw Opus frames
      this.decoder = new OpusMLAdapter(this.audioMaxSps || this.trueAudioSps || this.audioOutputSps || 48000);
    } else {
      // Use existing wrapper-based decoder (FLAC, etc.)
      this.decoder = createDecoder(settings.audio_compression, this.audioMaxSps, this.trueAudioSps, this.audioOutputSps);
    }

    // Bass boost (lowshelf filter)
    this.bassBoost = new BiquadFilterNode(this.audioCtx)
    this.bassBoost.type = 'lowshelf'
    this.bassBoost.frequency.value = 100
    this.bassBoost.Q.value = 0.7
    this.bassBoost.gain.value = 6

    // Bandpass filter for speech enhancement
    this.bandpass = new BiquadFilterNode(this.audioCtx)
    this.bandpass.type = 'peaking'
    this.bandpass.frequency.value = 1800
    this.bandpass.Q.value = 1.2
    this.bandpass.gain.value = 3

    // High-pass filter
    this.highPass = new BiquadFilterNode(this.audioCtx)
    this.highPass.type = 'highpass'
    this.highPass.frequency.value = 60
    this.highPass.Q.value = 0.7

    // Presence boost
    this.presenceBoost = new BiquadFilterNode(this.audioCtx)
    this.presenceBoost.type = 'peaking'
    this.presenceBoost.frequency.value = 3500
    this.presenceBoost.Q.value = 1.5
    this.presenceBoost.gain.value = 4

    // Convolver node for additional filtering
    this.convolverNode = new ConvolverNode(this.audioCtx)
    this.setLowpass(15000)

    // Dynamic compressor
    this.compressor = new DynamicsCompressorNode(this.audioCtx)
    this.compressor.threshold.value = -10;  // only act on fairly loud peaks
    this.compressor.knee.value = 8;         // gentle knee
    this.compressor.ratio.value = 3;        // light compression, not limiting
    this.compressor.attack.value = 0.01;    // slower attack to keep transients
    this.compressor.release.value = 0.25;   // same release

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

    this.resolvePromise(settings)
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
    this.bufferThreshold = 0.06;   // ~60 ms safety
    this.bufferLimit     = 0.30;   // cap at ~300 ms ahead
  }


  setFT8Decoding(value) {
    this.decodeFT8 = value;
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

    this.audioSocket.onmessage = this.socketMessage.bind(this)

    this.initAudio(settings)

    console.log('Audio Samplerate: ', this.trueAudioSps)
  }

  socketMessage(event) {
    if (event.data instanceof ArrayBuffer) {
      const packet = cbor_decode(new Uint8Array(event.data))
      const receivedPower = packet.pwr
      this.power = 0.5 * this.power + 0.5 * receivedPower || 1
      const dBpower = 20 * Math.log10(Math.sqrt(this.power) / 2)
      this.dBPower = dBpower
      if (this.squelch && dBpower < this.squelchThreshold) {
        this.squelchMute = true
      } else {
        this.squelchMute = false
      }

      this.decode(packet.data)
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
    if (this.signalDecoder) {
      this.signalDecoder.decode(pcmArray)
    }

    this.playAudio(pcmArray)
  }

  updateAudioParams() {
    if (this.demodulation == "CW") {
      this.audioSocket.send(JSON.stringify({
        cmd: 'window',
        l: this.audioLOffset,
        m: this.audioMOffset,
        r: this.audioROffset
      }))
    } else {
      this.audioSocket.send(JSON.stringify({
        cmd: 'window',
        l: this.audioL,
        m: this.audioM,
        r: this.audioR
      }))
    }

  }

  setAudioDemodulation(demodulation) {

    this.demodulation = demodulation
    if (demodulation == "CW") {
      demodulation = "USB"
    }
    this.updateFilters()
    this.audioSocket.send(JSON.stringify({
      cmd: 'demodulation',
      demodulation: demodulation
    }))
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
    this.audioSocket.send(JSON.stringify({
      cmd: 'options',
      options: options
    }))
  }

  setGain(gain) {
    gain /= 35;
    this.gain = gain
    this.gainNode.gain.value = gain
  }

  setMute(mute) {
    if (mute === this.mute) {
      return
    }
    this.mute = mute
    this.audioSocket.send(JSON.stringify({
      cmd: 'mute',
      mute: mute
    }))
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
    return this.dBPower
  }

  setUserID(userID) {
    this.audioSocket.send(JSON.stringify({
      cmd: 'userid',
      userid: userID
    }))
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
    // Check every second to adjust the collecting status based on current time
    setInterval(() => {
      this.updateCollectionStatus();
    }, 1000);
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
    this.accumulator = []; // Reset the accumulator
  }

  async stopCollection() {
    this.isCollecting = false;
    if (this.decodeFT8) {
      const bigFloat32Array = new Float32Array(this.accumulator.flat());
      let decodedMessages = await decode(bigFloat32Array);
      const messagesListDiv = document.getElementById('ft8MessagesList');

      let baseLocation = this.gridSquareToLatLong(this.grid_locator);

      for (let message of decodedMessages) {
        let locators = this.extractGridLocators(message.text);

        if (locators.length > 0) {
          let targetLocation = this.gridSquareToLatLong(locators[0]);
          let distance = this.calculateDistance(baseLocation[0], baseLocation[1], targetLocation[0], targetLocation[1]);

          if (distance > this.farthestDistance) {
            this.farthestDistance = distance;
            document.getElementById('farthest-distance').textContent = `Farthest Distance: ${this.farthestDistance.toFixed(2)} km`;
          }

          const messageDiv = document.createElement('div');
          messageDiv.classList.add('glass-message', 'p-2', 'rounded-lg', 'text-sm', 'flex', 'justify-between', 'items-center');

          // Message content
          const messageContent = document.createElement('div');
          messageContent.classList.add('flex-grow');
          messageContent.textContent = message.text;
          messageDiv.appendChild(messageContent);

          // Locators and distance
          const infoDiv = document.createElement('div');
          infoDiv.classList.add('flex', 'flex-col', 'items-end', 'ml-2', 'text-xs');

          // Locators
          const locatorsDiv = document.createElement('div');
          locators.forEach((locator, index) => {
            const locatorLink = document.createElement('a');
            locatorLink.href = `https://www.levinecentral.com/ham/grid_square.php?&Grid=${locator}&Zoom=13&sm=y`;
            locatorLink.classList.add('text-yellow-300', 'hover:underline');
            locatorLink.textContent = locator;
            locatorLink.target = "_blank";
            if (index > 0) locatorsDiv.appendChild(document.createTextNode(', '));
            locatorsDiv.appendChild(locatorLink);
          });
          infoDiv.appendChild(locatorsDiv);

          // Distance
          const distanceDiv = document.createElement('div');
          distanceDiv.textContent = `${distance.toFixed(2)} km`;
          infoDiv.appendChild(distanceDiv);

          messageDiv.appendChild(infoDiv);

          messagesListDiv.appendChild(messageDiv);
        }
      }

      setTimeout(() => {
        messagesListDiv.scrollTop = messagesListDiv.scrollHeight;
      }, 500);
    }
  }

  // FT8 END




  playAudio(pcmArray) {
    if (this.mute || (this.squelchMute && this.squelch)) {
      return
    }
    if (this.audioCtx.state !== 'running') {
      return
    }

    // Always run client-side noise blanker / noise reduction first,
    // independent of AGC state and codec (FLAC / Opus).
    pcmArray = this.applyNoiseBlanker(pcmArray);

    // Adaptive noise-cancel gate (works on FLAC & Opus)
    pcmArray = this.applyNoiseCancel(pcmArray);

    // Apply AGC
    if (this.agcEnabled) {
      pcmArray = this.applyAGC(pcmArray);
    }

    if (this.isCollecting && this.decodeFT8) {
      this.accumulator.push(...pcmArray);
    }


    const curPlayTime = this.playPCM(pcmArray, this.playTime, this.audioOutputSps, 1)

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
      this.recordedAudio.push(...pcmArray);
    }
  }

  playPCM(buffer, playTime, sampleRate, scale) {
    if (!this.audioInputNode) {
      console.warn('Audio not initialized');
      return 0;
    }
    const source = new AudioBufferSourceNode(this.audioCtx);
    const audioBuffer = new AudioBuffer({
      length: buffer.length,
      numberOfChannels: 1,
      sampleRate: this.audioOutputSps
    });

    audioBuffer.copyToChannel(buffer, 0, 0);

    source.buffer = audioBuffer;
    source.connect(this.audioInputNode);

    const scheduledTime = Math.max(playTime, this.audioCtx.currentTime);
    source.start(scheduledTime);

    source.onended = () => {
      source.disconnect();
    };



    return audioBuffer.duration;
  }

  startRecording() {
    if (this.isRecording) return;

    this.isRecording = true;
    this.recordedChunks = [];

    this.mediaRecorder = new MediaRecorder(this.destinationNode.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
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

}