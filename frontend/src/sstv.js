// ─────────────────────────────────────────────────────────────────────────────
// KiwiSSTVDecoder  –  PhantomSDR-Plus  (sv1btl fork)
//
// Revision history
// ─────────────────────────────────────────────────────────────────────────────
//  [1] FREQUENCY ESTIMATOR  (_estimateFreqRaw / _estimateFreq)
//      Replaced integer-lag autocorrelation (gave only ~4 discrete frequency
//      values in the SSTV pixel range) with the normalised lag-1 autocorrelation
//      identity:
//
//        f = arccos( Σ x[n]·x[n-1] / Σ x[n]² ) · sr / 2π
//
//      Continuous, amplitude-independent, stable with windows ≥ 4 samples.
//      Effective per-channel colour depth goes from ~2 bits → ~8 bits.
//
//  [2] SYNC CALIBRATION  (_freqOffset, updated every sync pulse)
//      The sync pulse is 1200 Hz by definition.  After finding each sync
//      pulse the raw estimator is applied to it and the error accumulated
//      via a slow EMA (α = 0.20, converges in ~5 lines).  _estimateFreq()
//      adds this offset so that a transmitter that is e.g. 30 Hz off-nominal
//      (common on HF USB) produces correctly scaled pixels throughout the frame.
//
//  [3] BANDPASS PREFILTER  (_bpFilter, applied after resampling in feedPCM)
//      4th-order IIR bandpass, cascade of two Butterworth biquads at Fs=12 kHz:
//        Stage 1 – Highpass  f0 = 1000 Hz,  Q = 1/√2
//        Stage 2 – Lowpass   f0 = 2500 Hz,  Q = 1/√2
//      Passband covers sync (1200 Hz) through white (2300 Hz) plus VIS bits
//      (1100/1300 Hz).  Rejects mains hum, LF noise, and adjacent interference.
//      All Robot 36 frequencies (1200–2300 Hz) are within the passband.
//
//  [4] MARTIN M2 WIDE-WINDOW HACK removed
//      The ×5.0 pixel-span window was compensating for the old lag estimator's
//      need for a full oscillation period.  The arccos estimator is stable with
//      windows ≥ 4 samples; a fixed N=8 window now applies to all modes (see [9]).
//
//  [5] SCOTTIE BRIGHTNESS CORRECTION removed
//      The old ×1.12 + 6 factor compensated for the previous estimator's
//      systematic frequency under-estimate.  With an accurate estimator it
//      over-brightens Scottie images.
//
//  [6] IMPULSE FILTER extended from 1-pixel to 2-pixel spike detection
//
//  [7] freqOffset exposed in 'line' callback events for UI diagnostics
//
//  [8] ROBOT 36 COLOR  (_decodeLineRobot36, _yuv2rgb)
//      New mode family 'robot36'.  VIS code 8, 320×240, 150 ms/line.
//      Line structure: sync(9ms) + porch(3ms) + Y(88ms) + sep(6ms) + C(44ms)
//      Color space: YCbCr (BT.601).  Even lines carry Cb (B−Y), odd lines
//      carry Cr (R−Y).  Decoder buffers even-line Y+Cb and waits for the next
//      odd line's Cr before emitting both rows together.
//      YUV→RGB: R = Y + 1.402·(Cr−128)
//               G = Y − 0.344136·(Cb−128) − 0.714136·(Cr−128)
//               B = Y + 1.772·(Cb−128)
//
//  [9] PIXEL WINDOW SIZE  N=8  (was N=6, then max(6, round(pixSpan×0.85)))
//      The arccos lag-1 estimator requires that the double-frequency cross-term
//      Σ cos(2·Δθ·n) cancels over the window.  At 1500 Hz (black, period=8 samples)
//      this term does NOT cancel for N=6 (1.5 periods of 3000 Hz residual), causing:
//        • σ = 52 px per pixel at 1500 Hz  → dark areas appear grey  (~43 px mean)
//        • σ = 35 px per pixel at 2300 Hz  → whites appear 29 px darker (226 vs 255)
//        • Overall RMS error: 17.3 px per pixel
//      N=8 = exactly one full period of 1500 Hz, so the 3000 Hz cross-term spans
//      exactly 2 full cycles and cancels perfectly:
//        • σ = 0 px at 1500 Hz → exact black, every time
//        • Error at 2300 Hz: only −5.3 px
//        • Overall RMS error: 1.9 px  (9× improvement)
//      Pixel blurring: N=8 spans 1.46 M1-pixels / 1.54 S1-pixels / 2.91 M2-pixels.
//      The accuracy gain far outweighs the mild softening on short-pixspan modes.
//
//  [10] OUTPUT GAMMA  (options.gamma, default 0.90, runtime-adjustable via setGamma())
//       A 256-entry lookup table is applied to every decoded pixel before emission.
//       gamma < 1 brightens midtones while preserving blacks (0→0) and whites (255→255).
//       At the default gamma = 0.90:
//         pixel  64  (1700 Hz, dark-mid) →  73  (+9 px)
//         pixel 128  (1900 Hz, mid-grey) → 138  (+10 px)
//         pixel 191  (2100 Hz, light-mid)→ 199  (+8 px)
//         pixel 255  (2300 Hz, white)    → 255  (exact, unchanged)
//       Applied to R/G/B channels in Martin/Scottie, and to the final RGB output
//       of the YCbCr→RGB conversion in Robot 36 (not to Y/Cb/Cr before conversion,
//       which would shift chroma).
//       Set options.gamma = 1.0 or call setGamma(1.0) for spec-accurate output.
//
//  [11] GOERTZEL BIN FORMULA  (_goertzel — removed erroneous +0.5 offset)
//       Old:  k = Math.round(0.5 + len×freq/sr)  ≡ Math.ceil for non-integers,
//             but = integer+1 when len×freq/sr is an exact integer.
//       All SSTV VIS frequencies are multiples of 100 Hz; all VIS window sizes
//       are multiples of 120 samples (12000÷100=120), so every VIS Goertzel call
//       produced an exact integer and was evaluated one DFT bin too high.
//       Power at ±1 bin from a pure tone = sin(π×1)/sin(π÷N) → 0 (DFT null).
//       Result: every leader / break / bit / start / stop Goertzel returned 0,
//       making VIS header detection and mode recognition completely fail.
//       The bug was masked before by broadband noise filling the wrong bins; the
//       bandpass filter ([3]) cleaned the signal so the zeros became exact.
//       Fix:  k = Math.max(1, Math.round(len×freq/sr))  — correct bin, full power.
//
//  [12] SCOTTIE DX  (scottieDX, VIS=76, 320×256)
//       Same decoder family as Scottie S1/S2.  chanMs = 345.6 ms (2.5× S1).
//       lineMs = porch + G + sep + B + sep + sync + porch + R
//              = 1.5 + 345.6 + 1.5 + 345.6 + 1.5 + 9.0 + 1.5 + 345.6 = 1051.8 ms.
//       256 lines ≈ 269 seconds total (~4.5 min).
//
//  [13] ROBOT 72  (robot72, VIS=12, 320×240)
//       Reuses the Robot 36 YCbCr decoder (family = 'robot36').
//       Scan times doubled: yMs = 176 ms, cMs = 88 ms, lineMs = 282 ms.
//       240 lines ≈ 67.7 seconds.  (The "72" label in common usage is
//       approximate — some references define it as 300 ms/line for exactly
//       72 s, using yMs=188/cMs=94; 282 ms is the exact 2× Robot 36 value.)
//
//  [14] BUFFER GROWTH BUG FIXED  (_detectVIS → _processPos advance)
//       When the decoder runs in VIS-detection-only mode (no mode lock),
//       _processPos was never advanced, so _ensureCapacity never compacted
//       the buffer and it doubled indefinitely on long sessions with no
//       SSTV signal.  Fix: advance _processPos alongside _visScanPos in
//       _detectVIS(), retaining one leader's worth of look-back context.
//
//  [15] LOST SYNC RECOVERY  (_lostSyncCount acted upon)
//       _lostSyncCount was tracked but never read.  Now:
//         > 6 consecutive losses → widen _findSyncNear() search to ±80 ms
//         >12 consecutive losses → abandon mode, re-enter VIS/auto detection
//       Handles QSB fades and burst interference without hanging until
//       end-of-frame.
//
//  [16] HALF-WINDOW CLAMP  (_decodeLine, _decodeLineRobot36)
//       For modes where estLen > pixSpan (Martin M2, Scottie S2, Robot
//       chroma), the estimation window start was calculated as:
//         s = segStart + x*pixSpan - halfExtra
//       At x=0, this gives s < segStart (before the channel boundary),
//       pulling in separator or porch samples that systematically darken
//       the leftmost pixels.  Fix: clamp s to [segStart, segEnd−estLen].
//
//  [17] AUTO-MODE COOLDOWN  (_tryAutoMode)
//       _tryAutoMode() was called on every feedPCM() chunk until a mode
//       locked, repeating a ~1.6 M-multiply scan on each call.  Now
//       gated behind a 500 ms advance in _bufLen so it fires at most
//       twice per second during the detection phase.
//
//  [18] FFT ESTIMATOR REWRITE  (slowrx / KiwiSDR method)  ← supersedes [8][9][13][16]
//       The pixel frequency estimator was changed from arccos lag-1
//       autocorrelation to a Hann-windowed, zero-padded 1024-pt FFT with
//       Gaussian log peak-interpolation (_estimateFreqFFT), sampled at each
//       pixel CENTRE.  This removes the tone-period-locked N=8 window (which
//       blurred the fast modes) and is far more accurate per pixel.
//       Decode rate raised 12 kHz → 48 kHz for adequate samples/pixel on the
//       fast modes; the IIR bandpass is now designed from the rate (_designBiquad)
//       so nothing is hand-tuned to 12 kHz.  Mode timings corrected to slowrx
//       values (Scottie S1 428.38, DX 1050.3).  Robot 72 given its true
//       full-colour-per-line structure (Y+R−Y+B−Y, _decodeLineRobot72), no
//       longer modelled as "2× Robot 36".  Robot 72 later corrected to the
//       138/69/69 ms unequal-channel structure.  The arccos estimator was fully
//       removed: sync-pulse frequency calibration now uses the SAME FFT estimator
//       as the pixels (_estimateFreqFFTRaw over 1000–1500 Hz) — mixing arccos
//       calibration with FFT pixels left a constant bias that tinted neutral
//       chroma below 128, a uniform green cast on the Robot modes.
// ─────────────────────────────────────────────────────────────────────────────

import { transformFlat } from './lib/fftRadix2.js';

export class KiwiSSTVDecoder {

  // ── Construction / configuration ──────────────────────────────────────────

  constructor(options = {}) {
    this._sampleRateFn = typeof options.sampleRate === 'function'
      ? options.sampleRate
      : (() => options.sampleRate || 12000);
    this._callback   = typeof options.callback === 'function' ? options.callback : null;
    this._forcedMode = options.defaultMode || 'auto';
    this._gamma      = (typeof options.gamma === 'number' && options.gamma > 0) ? options.gamma : 0.90;
    // Horizontal unsharp-mask amount applied to decoded lines.  The pixel
    // frequency estimator averages over an ~8-sample window that is wider than
    // one pixel in the fast modes (Martin M2, Scottie S2, Robot chroma),
    // producing a horizontal box-blur.  The unsharp pass counteracts that known
    // blur.  0 = off, ~0.55 = moderate.  Runtime-adjustable via setSharpen().
    this._sharpen    = (typeof options.sharpen === 'number' && options.sharpen >= 0) ? options.sharpen : 0.55;
    this._enabled    = false;
    this.reset({ mode: this._forcedMode });
  }

  setEnabled(enabled) {
    this._enabled = !!enabled;
    if (!this._enabled) this.reset({ mode: this._forcedMode });
  }

  setCallback(fn) {
    this._callback = typeof fn === 'function' ? fn : null;
  }

  setMode(mode) {
    this._forcedMode = mode || 'auto';
    if (this._callback) {
      this._callback({
        type: 'status',
        text: this._forcedMode === 'auto'
          ? 'AUTO mode detect'
          : `Forced ${this._forcedMode.toUpperCase()}`
      });
    }
    this._mode          = null;
    this._needFreshSync = true;
    this._line          = 0;
  }

  // Adjust output gamma at runtime.  gamma=0.90 (default) brightens midtones
  // by ~10 px.  gamma=1.0 gives spec-accurate output.  Rebuilds the LUT instantly.
  setGamma(g) {
    this._gamma = (typeof g === 'number' && g > 0 && g <= 3.0) ? g : 0.90;
    this._buildGammaLUT();
  }

  // Adjust the horizontal unsharp-mask amount at runtime.  0 = off (spec-accurate
  // softness), ~0.55 = moderate sharpening, up to ~2.0 for aggressive.  At high SNR
  // this recovers apparent detail lost to the estimator's box-blur; on noisy
  // signals keep it low, as sharpening also amplifies pixel noise.
  setSharpen(a) {
    this._sharpen = (typeof a === 'number' && a >= 0 && a <= 3.0) ? a : 0.55;
  }

  // ── Horizontal unsharp mask ────────────────────────────────────────────────
  //
  // Counteracts the box-blur left by the fixed-width frequency estimator window.
  // For each channel:  out = clamp(orig + amount·(orig − boxBlur(orig, radius))).
  // `radius` is sized to the FFT window's blur width (winLen / pixSpan, in pixels)
  // so the correction matches the actual softening — wider for the fast modes.
  // Operates in place on an RGBA Uint8ClampedArray; alpha (channel 3) untouched.
  _sharpenLine(out, W, radius) {
    const amount = this._sharpen;
    if (!(amount > 0) || W < 3) return out;
    const r = Math.max(1, Math.min(6, Math.round(radius)));
    const win = 2 * r + 1;
    // Work on a plain copy of each channel so the blur uses original values.
    const orig = new Float32Array(W);
    for (let c = 0; c < 3; c++) {
      for (let x = 0; x < W; x++) orig[x] = out[x * 4 + c];
      // Box blur via running sum (edge-clamped).
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += orig[Math.max(0, Math.min(W - 1, k))];
      for (let x = 0; x < W; x++) {
        const blur = acc / win;
        const sharp = orig[x] + amount * (orig[x] - blur);
        out[x * 4 + c] = sharp < 0 ? 0 : sharp > 255 ? 255 : sharp;
        // Slide the window: drop x−r, add x+r+1 (both edge-clamped).
        const drop = Math.max(0, Math.min(W - 1, x - r));
        const add  = Math.max(0, Math.min(W - 1, x + r + 1));
        acc += orig[add] - orig[drop];
      }
    }
    return out;
  }

  reset(opts = {}) {
    if (opts.mode) this._forcedMode = opts.mode;

    // Decode at a high internal rate (Kiwi/slowrx-class) so the fast modes have
    // enough samples per pixel for the FFT frequency estimator.  Everything below
    // (filter design, mode timing, sync/VIS windows) is derived from this, so the
    // rate can be changed here alone.
    this._decodeSps     = 48000;
    // ── FFT frequency-estimator scratch (Hann-windowed, zero-padded to _fftN) ─
    this._fftN          = 1024;
    this._fftRe         = new Float64Array(this._fftN);
    this._fftIm         = new Float64Array(this._fftN);
    this._hannCache     = new Map();   // winLen -> Float64Array Hann window
    this._inSps         = this._sampleRateFn() || 12000;
    this._resampleRatio = this._inSps / this._decodeSps;
    this._resamplePhase = 0.0;
    this._resampleLast  = 0.0;   // raw (pre-filter) last input sample

    this._buf        = new Float32Array(this._decodeSps * 20);
    this._bufLen     = 0;
    this._processPos = 0;
    this._visScanPos = 0;
    this._jitterLead = Math.floor(this._decodeSps * 0.45);

    this._mode            = null;
    this._detectedMode    = '';
    this._visConfidence   = 0;
    this._autoScore       = 0;
    this._syncAnchor      = 0;
    this._line            = 0;
    this._needFreshSync   = true;
    this._lastSyncQuality = 0;
    this._lostSyncCount   = 0;
    this._imageW          = 320;
    this._imageH          = 256;

    // ── Frequency calibration ──────────────────────────────────────────────
    this._freqOffset      = 0;
    this._freqOffsetCount = 0;

    // ── Auto-mode cooldown ─────────────────────────────────────────────────
    // _tryAutoMode() is expensive (~1.6M mults per call).  Only re-run
    // when _bufLen has advanced by at least 500 ms since the last attempt.
    this._lastAutoAttemptPos = 0;

    // ── IIR bandpass filter (designed for the current decode rate) ──────────
    // 4th-order Butterworth bandpass = HP 1000 Hz cascaded with LP 2500 Hz,
    // Q = 1/√2, transposed direct-form II.  Coefficients are computed from
    // _decodeSps (RBJ Audio-EQ-Cookbook formulas) so the passband is correct at
    // any rate.  Passband ~1000–2500 Hz covers VIS bits (1100/1300), sync (1200),
    // and the 1500–2300 Hz video band.
    const _hp = this._designBiquad('hp', 1000, Math.SQRT1_2, this._decodeSps);
    const _lp = this._designBiquad('lp', 2500, Math.SQRT1_2, this._decodeSps);
    this._hp_b = _hp.b; this._hp_a = _hp.a; this._hp_z = [0.0, 0.0];
    this._lp_b = _lp.b; this._lp_a = _lp.a; this._lp_z = [0.0, 0.0];

    // ── Robot 36 inter-line chroma buffer ─────────────────────────────────
    // Even lines (Cb) are held here until the following odd line (Cr) arrives,
    // then both rows are emitted together.
    this._r36_pendingY    = null;   // Uint8Array(320) or null
    this._r36_pendingCb   = null;   // buffered chroma (R−Y or B−Y per _r36_pendingIsRY)
    this._r36_pendingIsRY = false;  // true if the buffered chroma is R−Y (Cr), else B−Y (Cb)
    this._r36_pendingLine = -1;     // visual line number of the buffered row

    // Build (or rebuild) the output gamma lookup table.
    this._buildGammaLUT();

    // ── Mode table ─────────────────────────────────────────────────────────
    this._modes = {
      // ── RGB modes (Martin / Scottie families) ───────────────────────────
      martin1: {
        name: 'Martin M1', vis: 44, width: 320, height: 256,
        family: 'martin',
        syncMs: 4.862, porchMs: 0.572, sepMs: 0.572,
        chanMs: 146.432, lineMs: 446.446, order: ['g', 'b', 'r']
      },
      martin2: {
        name: 'Martin M2', vis: 40, width: 320, height: 256,
        family: 'martin',
        syncMs: 4.862, porchMs: 0.572, sepMs: 0.572,
        chanMs: 73.216, lineMs: 226.798, order: ['g', 'b', 'r']
      },
      scottie1: {
        name: 'Scottie S1', vis: 60, width: 320, height: 256,
        family: 'scottie',
        syncMs: 9.0, porchMs: 1.5, sepMs: 1.5,
        chanMs: 138.240, lineMs: 428.38, order: ['g', 'b', 'r']
      },
      scottie2: {
        name: 'Scottie S2', vis: 56, width: 320, height: 256,
        family: 'scottie',
        syncMs: 9.0, porchMs: 1.5, sepMs: 1.5,
        chanMs: 88.064, lineMs: 277.692, order: ['g', 'b', 'r']
      },
      scottieDX: {
        // Scottie DX — slow, high-quality; very common on 14.230 MHz DX QSOs.
        // Line: porch(1.5) + G(345.6) + sep(1.5) + B(345.6) + sep(1.5)
        //     + sync(9.0) + porch(1.5) + R(345.6) = 1051.8 ms.
        // 256 lines ≈ 269 s total (~4.5 min).
        name: 'Scottie DX', vis: 76, width: 320, height: 256,
        family: 'scottie',
        syncMs: 9.0, porchMs: 1.5, sepMs: 1.5,
        chanMs: 345.77, lineMs: 1050.3, order: ['g', 'b', 'r']
      },

      // ── YUV modes (Robot family) ─────────────────────────────────────────
      // Robot 36 (family 'robot36'): sync(9) + porch(3) + Y(88) + sep(6) +
      //   chroma(44).  Y at 0.275 ms/px, ONE chroma at 0.1375 ms/px, the chroma
      //   alternating R−Y / B−Y line-to-line (selected by the separator tone).
      //   Chroma is subsampled 2:1 vertically (paired across two lines).
      robot36: {
        name: 'Robot 36', vis: 8, width: 320, height: 240,
        family: 'robot36',
        syncMs: 9.0, porchMs: 3.0, sepMs: 6.0,
        yMs: 88.0, cMs: 44.0, lineMs: 150.0
      },
      // Robot 72 (family 'robot72'): FULL colour every line, but UNEQUAL channels
      //   — Y = 138 ms (0.4313 ms/px) then R−Y = 69 ms and B−Y = 69 ms (chroma at
      //   2× the luma pixel rate, still 320 px each), separated by 4.7 ms.
      //   sync(9)+porch(3)+Y(138)+sep(4.7)+R−Y(69)+sep(4.7)+B−Y(69) ≈ 300.
      //   (NOT "2× Robot 36", and NOT three equal channels — own decoder path.)
      robot72: {
        name: 'Robot 72', vis: 12, width: 320, height: 240,
        family: 'robot72',
        syncMs: 9.0, porchMs: 3.0, sepMs: 4.7,
        yMs: 138.0, cMs: 69.0, lineMs: 300.0
      }
    };
    this._visMap = new Map(
      Object.entries(this._modes).map(([k, v]) => [v.vis, k])
    );
  }

  destroy() {
    this._enabled        = false;
    this._callback       = null;
    this._buf            = new Float32Array(0);
    this._bufLen         = 0;
    this._r36_pendingY   = null;
    this._r36_pendingCb  = null;
  }

  // ── Audio ingestion ───────────────────────────────────────────────────────

  feedPCM(pcm) {
    if (!this._enabled || !pcm || pcm.length === 0) return;

    const inSr = this._sampleRateFn() || this._inSps || 12000;
    if (!Number.isFinite(this._resampleRatio) || Math.abs(inSr - this._inSps) > 1) {
      this._inSps         = inSr;
      this._resampleRatio = inSr / this._decodeSps;
    }

    const estOut = Math.ceil(pcm.length / this._resampleRatio) + 4;
    this._ensureCapacity(estOut);

    let phase = this._resamplePhase;
    let last  = this._resampleLast;
    const ratio = this._resampleRatio;

    for (let i = 0; i < pcm.length; i++) {
      const cur = pcm[i];
      // Resample to the decode rate first (linear interpolation), then apply the
      // bandpass filter at that rate so the IIR coefficients are correct.
      while (phase <= 1.0) {
        const s = last + (cur - last) * phase;
        this._buf[this._bufLen++] = this._bpFilter(s);
        phase += ratio;
      }
      phase -= 1.0;
      last = cur;
    }
    this._resamplePhase = phase;
    this._resampleLast  = last;
    this._process();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  _emit(event) {
    if (typeof this._callback === 'function') this._callback(event);
  }

  _ensureCapacity(extra) {
    if (this._bufLen + extra <= this._buf.length) return;
    if (this._processPos > 0) {
      const keep = this._bufLen - this._processPos;
      this._buf.copyWithin(0, this._processPos, this._bufLen);
      this._bufLen     = keep;
      this._visScanPos = Math.max(0, this._visScanPos - this._processPos);
      this._syncAnchor -= this._processPos;
      this._processPos  = 0;
      if (this._bufLen + extra <= this._buf.length) return;
    }
    const n = new Float32Array(
      Math.max(this._buf.length * 2, this._bufLen + extra + 8192)
    );
    n.set(this._buf.subarray(0, this._bufLen));
    this._buf = n;
  }

  // Build a 256-entry Uint8Array gamma lookup table from this._gamma.
  // Precomputing avoids calling Math.pow() per pixel (3 calls × 320 pixels × 256 lines
  // = ~245 k calls per frame).  gamma=1.0 produces the identity table.
  _buildGammaLUT() {
    const lut = new Uint8Array(256);
    if (this._gamma === 1.0) {
      for (let i = 0; i < 256; i++) lut[i] = i;
    } else {
      const inv = this._gamma;           // pow(x/255, gamma) * 255
      for (let i = 0; i < 256; i++) {
        lut[i] = Math.min(255, Math.round(255 * Math.pow(i / 255, inv)));
      }
    }
    this._gammaLUT = lut;
  }

  // ── Bandpass filter ───────────────────────────────────────────────────────
  //
  // 4th-order IIR bandpass (cascade of two Butterworth biquads, Fs = 12 kHz)
  // in transposed direct-form II.
  //
  // Passband: ~1000–2500 Hz (−3 dB)
  //   Covers: VIS bits (1100/1300 Hz), sync (1200 Hz), black (1500 Hz),
  //           white (2300 Hz), Robot 36 chroma (1500–2300 Hz)
  //   Rejects: mains hum, LF rumble, interference above ~2600 Hz
  //
  // To redesign for a different Fs use the Audio EQ Cookbook (Bristow-Johnson)
  // HP/LP formulas with Q = 1/√2.
  _bpFilter(x) {
    // Stage 1 — Highpass at 1000 Hz
    const y1      = this._hp_b[0] * x  + this._hp_z[0];
    this._hp_z[0] = this._hp_b[1] * x  - this._hp_a[0] * y1 + this._hp_z[1];
    this._hp_z[1] = this._hp_b[2] * x  - this._hp_a[1] * y1;

    // Stage 2 — Lowpass at 2500 Hz
    const y2      = this._lp_b[0] * y1 + this._lp_z[0];
    this._lp_z[0] = this._lp_b[1] * y1 - this._lp_a[0] * y2 + this._lp_z[1];
    this._lp_z[1] = this._lp_b[2] * y1 - this._lp_a[1] * y2;

    return y2;
  }

  // RBJ Audio-EQ-Cookbook biquad, normalised (a0=1).  Returns { b:[b0,b1,b2],
  // a:[a1,a2] } for the transposed-DF-II _bpFilter above.  type 'hp' | 'lp'.
  _designBiquad(type, f0, Q, fs) {
    const w0    = 2 * Math.PI * f0 / fs;
    const cw    = Math.cos(w0);
    const sw    = Math.sin(w0);
    const alpha = sw / (2 * Q);
    const a0    = 1 + alpha;
    let b0, b1, b2;
    if (type === 'hp') {
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    } else { // 'lp'
      b0 = (1 - cw) / 2; b1 =  (1 - cw); b2 = (1 - cw) / 2;
    }
    const a1 = -2 * cw, a2 = 1 - alpha;
    return { b: [b0 / a0, b1 / a0, b2 / a0], a: [a1 / a0, a2 / a0] };
  }

  // ── FFT frequency estimator (slowrx / Kiwi method) ─────────────────────────
  //
  // Hann-windowed, zero-padded 1024-point FFT; peak bin in the 1400–2400 Hz
  // video band refined by the slowrx Gaussian log-interpolation:
  //   δ = ln(P₊/P₋) / (2·ln(P₀²/(P₊·P₋)))   (sub-bin offset from the peak bin)
  // Returns the estimated tone frequency (Hz) plus the sync-calibrated offset.
  // Far more accurate per pixel than the arccos autocorrelation it replaces,
  // and with no tone-period-locked window it does not blur across pixels.

  _hannFor(len) {
    let h = this._hannCache.get(len);
    if (h) return h;
    h = new Float64Array(len);
    const d = len > 1 ? (len - 1) : 1;
    for (let i = 0; i < len; i++) h[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / d);
    this._hannCache.set(len, h);
    return h;
  }

  // Raw FFT peak frequency (Hz) in the band [loHz, hiHz], WITHOUT the sync
  // calibration offset.  loHz/hiHz default to the 1400–2400 Hz video band.
  _estimateFreqFFTRaw(center, winLen, loHz = 1400, hiHz = 2400) {
    const N  = this._fftN;
    const sr = this._decodeSps;
    const L  = Math.max(4, Math.min(winLen | 0, N));
    let start = Math.round(center - L * 0.5);
    if (start < 0) start = 0;
    if (start + L > this._bufLen) start = this._bufLen - L;
    if (start < 0) return (loHz + hiHz) * 0.5;

    const re = this._fftRe, im = this._fftIm;
    re.fill(0); im.fill(0);
    const hann = this._hannFor(L);
    for (let i = 0; i < L; i++) re[i] = this._buf[start + i] * hann[i];
    transformFlat(re, im, false);

    const loBin = Math.max(1, Math.floor(loHz * N / sr));
    const hiBin = Math.min((N >> 1) - 1, Math.ceil(hiHz * N / sr));
    let maxBin = loBin, maxP = -1;
    for (let k = loBin; k <= hiBin; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      if (p > maxP) { maxP = p; maxBin = k; }
    }
    // Gaussian log-interpolation for sub-bin accuracy (guarded against ≤0 power).
    const pm = re[maxBin - 1] * re[maxBin - 1] + im[maxBin - 1] * im[maxBin - 1];
    const p0 = maxP;
    const pp = re[maxBin + 1] * re[maxBin + 1] + im[maxBin + 1] * im[maxBin + 1];
    let delta = 0;
    if (pm > 0 && pp > 0 && p0 > 0) {
      const denom = 2 * Math.log((p0 * p0) / (pm * pp));
      if (isFinite(denom) && Math.abs(denom) > 1e-12) {
        delta = Math.log(pp / pm) / denom;
        if (!isFinite(delta) || delta > 0.5 || delta < -0.5) delta = 0;
      }
    }
    return (maxBin + delta) * sr / N;
  }

  // Calibrated video-band estimate: raw FFT peak + the sync-derived offset.
  _estimateFreqFFT(center, winLen) {
    return this._estimateFreqFFTRaw(center, winLen, 1400, 2400) + this._freqOffset;
  }

  // Map an estimated tone frequency to a 0–255 level: 1500 Hz = 0, 2300 Hz = 255.
  _freqToLevel(freq) {
    const v = Math.round((freq - 1500) * 255 / 800);
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  // ── Goertzel / tone analysis ──────────────────────────────────────────────

  _goertzel(start, len, freq) {
    if (start < 0 || len <= 0 || start + len > this._bufLen) return 0;
    // NOTE: do NOT add 0.5 before rounding.  All SSTV VIS frequencies (1100, 1200,
    // 1300, 1900 Hz) are multiples of 100 Hz, and all VIS window sizes are multiples
    // of 120 samples (12000÷100=120), so len×freq÷sr is always an exact integer.
    // Math.round(integer + 0.5) = integer + 1 → one DFT bin too high → power = 0.
    // Math.round(integer) = integer → correct bin → full power.
    const k     = Math.max(1, Math.round((len * freq) / this._decodeSps));
    const w     = 2.0 * Math.PI * k / len;
    const coeff = 2.0 * Math.cos(w);
    let q0 = 0, q1 = 0, q2 = 0;
    for (let i = 0; i < len; i++) {
      q0 = coeff * q1 - q2 + this._buf[start + i];
      q2 = q1;
      q1 = q0;
    }
    return q1 * q1 + q2 * q2 - coeff * q1 * q2;
  }

  _tonePairScore(start, len, lowF, highF) {
    const a   = this._goertzel(start, len, lowF);
    const b   = this._goertzel(start, len, highF);
    const sum = a + b + 1e-12;
    return {
      low: a, high: b,
      lowNorm:    a / sum,
      highNorm:   b / sum,
      confidence: Math.abs(a - b) / sum
    };
  }

  // ── VIS header detection ──────────────────────────────────────────────────

  _decodeVISCandidate(pos) {
    const sym30  = Math.round(0.030 * this._decodeSps);
    const leader = Math.round(0.300 * this._decodeSps);
    const brk    = Math.round(0.010 * this._decodeSps);

    const l1 = this._tonePairScore(pos,                leader, 1200, 1900);
    const b1 = this._tonePairScore(pos + leader,       brk,    1200, 1900);
    const l2 = this._tonePairScore(pos + leader + brk, leader, 1200, 1900);
    const s0 = pos + leader + brk + leader;

    if (!(l1.highNorm > 0.72 && b1.lowNorm > 0.72 && l2.highNorm > 0.72)) return null;

    const start1200 = this._goertzel(s0, sym30, 1200);
    const startSides = this._goertzel(s0, sym30, 1100)
                     + this._goertzel(s0, sym30, 1300) + 1e-12;
    if (!(start1200 / startSides > 1.20)) return null;

    let vis = 0, ones = 0, bitConfidence = 0;
    for (let i = 0; i < 7; i++) {
      const bit = this._tonePairScore(s0 + sym30 * (i + 1), sym30, 1100, 1300);
      bitConfidence += bit.confidence;
      if (bit.low > bit.high) { vis |= (1 << i); ones++; }
    }
    const parity    = this._tonePairScore(s0 + sym30 * 8, sym30, 1100, 1300);
    const parityBit = parity.low > parity.high ? 1 : 0;
    bitConfidence  += parity.confidence;

    const stop1200 = this._goertzel(s0 + sym30 * 9, sym30, 1200);
    const stopSides = this._goertzel(s0 + sym30 * 9, sym30, 1100)
                    + this._goertzel(s0 + sym30 * 9, sym30, 1300) + 1e-12;
    if (!(stop1200 / stopSides > 1.15)) return null;

    if (parityBit !== (ones & 1)) return null;
    const modeKey = this._visMap.get(vis);
    if (!modeKey) return null;

    const leaderConf = (l1.confidence + b1.confidence + l2.confidence) / 3;
    return {
      modeKey, vis,
      confidence: 0.55 * leaderConf + 0.45 * (bitConfidence / 8),
      syncAnchor: s0 + sym30 * 10
    };
  }

  _candidateSyncScore(modeKey, anchor) {
    const m = this._modes[modeKey];
    if (!m) return -1e30;
    const lineS      = Math.round(m.lineMs  * this._decodeSps / 1000);
    const syncS      = Math.max(24, Math.round(m.syncMs * this._decodeSps / 1000));
    // Scottie has sync mid-line; Martin and Robot 36 have sync at line start.
    const syncOffset = (m.family === 'scottie')
      ? Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000)
      : 0;
    let score = 0, lines = 0;
    for (let n = 0; n < 4; n++) {
      const syncStart = anchor + n * lineS + syncOffset;
      if (syncStart < 0 || syncStart + syncS >= this._bufLen) break;
      const p1200 = this._goertzel(syncStart, syncS, 1200);
      const p1500 = this._goertzel(syncStart, syncS, 1500);
      const p1900 = this._goertzel(syncStart, syncS, 1900);
      score += (p1200 - 0.28 * p1500 - 0.42 * p1900) / (p1200 + p1500 + p1900 + 1e-12);
      lines++;
    }
    if (!lines) return -1e30;
    return score / lines;
  }

  _detectVIS() {
    const need = Math.floor(this._decodeSps * 1.05);
    if (this._bufLen - this._visScanPos < need) return false;

    const scanLimit = this._bufLen - need;
    let best = null;

    for (
      let pos = this._visScanPos;
      pos <= scanLimit;
      pos += Math.max(8, Math.round(0.0025 * this._decodeSps))
    ) {
      const cand = this._decodeVISCandidate(pos);
      if (!cand) continue;
      cand.syncScore = this._candidateSyncScore(cand.modeKey, cand.syncAnchor);
      const total = cand.confidence + 0.45 * Math.max(0, cand.syncScore);
      if (!best || total > best.total) best = { ...cand, total };
    }

    // Accept on VIS confidence ALONE.  _decodeVISCandidate has already required a
    // valid 1900/1200 leader pair, a 1200 Hz start bit, EVEN-PARITY-checked data
    // bits, a 1200 Hz stop bit, and a known VIS code — a strong, low-false-
    // positive combination.  syncScore stays in `total` above (to rank competing
    // candidates) but must NOT gate acceptance: when the ~1 s VIS header finishes,
    // only a single short image sync pulse is buffered after it, so syncScore is
    // computed from one 4.9 ms Martin pulse and a few ms of timing error zeroes
    // it — which was rejecting perfectly valid VIS headers (Martin M1, etc.) and
    // forcing the weaker AUTO fallback (which confuses Martin with Scottie).
    if (best && best.confidence >= 0.62) {
      this._visConfidence   = best.confidence;
      this._autoScore       = best.syncScore;
      this._setMode(best.modeKey, 'VIS');
      // best.syncAnchor is the start of the first image line.  The decode loop
      // tracks the SYNC PULSE, which for Scottie sits mid-line (after
      // porch+G+sep+B), not at the line start.  Advance the anchor to the first
      // sync pulse for Scottie — matching _tryAutoMode — otherwise the loop hunts
      // for a 1200 Hz pulse at the line start (green/porch, no sync), floundering
      // and re-acquiring a few times before it settles (Scottie "restart").
      const vm = this._modes[best.modeKey];
      this._syncAnchor      = best.syncAnchor + (vm.family === 'scottie'
        ? Math.round((vm.porchMs + vm.chanMs + vm.sepMs + vm.chanMs) * this._decodeSps / 1000)
        : 0);
      this._line            = 0;
      this._needFreshSync   = true;
      this._visScanPos      = this._syncAnchor;
      this._freqOffset      = 0;
      this._freqOffsetCount = 0;
      this._r36_pendingY    = null;
      this._r36_pendingCb   = null;
      this._r36_pendingLine = -1;
      return true;
    }

    // FIX [14]: advance _processPos so _ensureCapacity can compact the buffer
    // during long periods with no SSTV signal.  Without this, _processPos
    // stays at 0 forever and the buffer doubles on every reallocation.
    // Retain one full VIS leader window (≈1.05 s) of look-back context.
    this._visScanPos = Math.max(this._visScanPos, scanLimit);
    const keepBack   = Math.round(this._decodeSps * 1.10);
    this._processPos = Math.max(this._processPos, this._visScanPos - keepBack);
    return false;
  }

  // ── Mode management ───────────────────────────────────────────────────────

  _setMode(modeKey, via = 'AUTO') {
    const mode = this._modes[modeKey];
    if (!mode) return;
    this._mode         = mode;
    this._detectedMode = mode.name;
    this._imageW       = mode.width;
    this._imageH       = mode.height;
    this._emit({
      type: 'mode', mode: mode.name, via,
      visConfidence: this._visConfidence,
      autoScore:     this._autoScore
    });
    const extra = via === 'VIS'  ? ` conf=${this._visConfidence.toFixed(2)}`
                : via === 'AUTO' ? ` score=${this._autoScore.toFixed(2)}`
                : '';
    this._emit({ type: 'status', text: `${mode.name} lock (${via}${extra})` });
  }

  _tryAutoMode() {
    if (this._forcedMode && this._forcedMode !== 'auto') {
      if (!this._mode ||
          this._mode.name.toLowerCase() !== this._forcedMode.toLowerCase()) {
        const key = Object.keys(this._modes).find(k =>
          this._modes[k].name.toLowerCase() === this._forcedMode.toLowerCase() ||
          k === this._forcedMode.toLowerCase()
        );
        if (key) this._setMode(key, 'FORCED');
      }
      return !!this._mode;
    }
    if (this._mode) return true;
    if (this._bufLen < this._decodeSps * 2.0) return false;

    // FIX [17]: cooldown — skip re-scan if buffer hasn't advanced 500 ms.
    // _tryAutoMode() performs ~1.6M multiplications per call; running it on
    // every feedPCM() chunk during detection is needlessly expensive.
    const cooldown = Math.round(0.5 * this._decodeSps);
    if (this._bufLen - this._lastAutoAttemptPos < cooldown) return false;
    this._lastAutoAttemptPos = this._bufLen;

    let best = null, second = null;
    // All supported modes including Scottie DX and Robot 72.
    const candidateKeys = [
      'martin1', 'martin2',
      'scottie1', 'scottie2', 'scottieDX',
      'robot36', 'robot72'
    ];

    for (const key of candidateKeys) {
      const m          = this._modes[key];
      const lineS      = Math.round(m.lineMs * this._decodeSps / 1000);
      const syncS      = Math.max(24, Math.round(m.syncMs * this._decodeSps / 1000));
      const syncOffset = (m.family === 'scottie')
        ? Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000)
        : 0;
      const step      = Math.max(10, Math.round(0.008 * this._decodeSps));
      const anchorMin = this._processPos;
      const anchorMax = Math.max(anchorMin, this._bufLen - lineS * 4 - syncS - 8);

      for (let a = anchorMin; a <= anchorMax; a += step) {
        let score = 0, valid = 0, minLine = 1e30;
        for (let n = 0; n < 4; n++) {
          const syncStart = a + n * lineS + syncOffset;
          if (syncStart < 0 || syncStart + syncS >= this._bufLen) break;
          const p1200 = this._goertzel(syncStart, syncS, 1200);
          const p1500 = this._goertzel(syncStart, syncS, 1500);
          const p1900 = this._goertzel(syncStart, syncS, 1900);
          const lineScore = (p1200 - 0.28 * p1500 - 0.42 * p1900) /
                            (p1200 + p1500 + p1900 + 1e-12);
          score += lineScore;
          if (lineScore < minLine) minLine = lineScore;
          valid++;
        }
        // Require sync present on ALL FOUR probed lines (was 3).  A real
        // transmission has a sync pulse every line; demanding four coincident
        // hits makes accidental noise alignment far less likely.
        if (valid < 4) continue;
        score /= valid;
        const item = { key, score, anchor: a, valid, minLine };
        if      (!best   || score > best.score)   { second = best;   best   = item; }
        else if (!second || score > second.score) { second = item; }
      }
    }

    const margin = (best && second) ? best.score - second.score : 0;
    // Noise rejection is gated on the PER-LINE MINIMUM, not the mean.
    //
    // Why the old mean threshold failed: the accepted value is the MAXIMUM of
    // best.score over a large anchor search — an order statistic, not the mean.
    // The metric's mean on pure noise is (1 − 0.28 − 0.42)/3 = 0.10, but the max
    // over the hundreds of anchors scanned by the shortest-line mode (Robot 36)
    // reaches ~0.5, so raising the absolute mean gate (0.10 → 0.35) barely helped
    // — Robot 36 still cleared it on noise and won by search size.
    //
    // A genuine 1200 Hz sync train is dominant on EVERY line, so its weakest
    // line (minLine) still scores high; noise inflates the *average* off a few
    // lucky lines but its weakest line stays near the 0.10 floor.  Requiring the
    // WEAKEST of the 4 lines to be strongly 1200-dominant (minLine ≥ 0.50) is a
    // joint condition the anchor search can't satisfy on noise: four independent
    // ≥0.50 line-scores at one anchor is ~(0.5%)^4, negligible even over hundreds
    // of anchors — so it rejects noise without depending on search size, while a
    // real sync pulse (p1200 ≫ p1500,p1900 → line-score → 1) passes easily.
    if (best && best.score >= 0.40 && best.minLine >= 0.50 && margin >= 0.05) {
      this._autoScore = best.score;
      this._setMode(best.key, 'AUTO');
      this._syncAnchor = best.anchor;
      if (this._modes[best.key].family === 'scottie') {
        const m = this._modes[best.key];
        this._syncAnchor += Math.round(
          (m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000
        );
      }
      this._line            = 0;
      this._needFreshSync   = true;
      this._freqOffset      = 0;
      this._freqOffsetCount = 0;
      this._r36_pendingY    = null;
      this._r36_pendingCb   = null;
      this._r36_pendingLine = -1;
      return true;
    }
    return false;
  }

  // ── Sync tracking ─────────────────────────────────────────────────────────

  _findSyncNear(expectedSyncStart) {
    const m = this._mode;
    if (!m) return { pos: expectedSyncStart, quality: 0 };

    const syncS = Math.max(24, Math.round(m.syncMs * this._decodeSps / 1000));

    // FIX [15]: widen the search window when sync is being lost.
    // Normal ±25 ms keeps tracking tight; after 6 consecutive losses open
    // to ±80 ms to catch drift and QSB recovery.
    const wideSearch = this._lostSyncCount > 6;
    const span  = Math.round((wideSearch ? 0.080 : 0.025) * this._decodeSps);

    let bestPos = expectedSyncStart, bestQ = -1e30;

    for (
      let pos = expectedSyncStart - span;
      pos <= expectedSyncStart + span;
      pos += 8
    ) {
      if (pos < 0 || pos + syncS >= this._bufLen) continue;
      const p1200 = this._goertzel(pos, syncS, 1200);
      const p1500 = this._goertzel(pos, syncS, 1500);
      const p1900 = this._goertzel(pos, syncS, 1900);
      const q = p1200 - 0.35 * p1500 - 0.35 * p1900;
      if (q > bestQ) { bestQ = q; bestPos = pos; }
    }

    // Sync pulse frequency calibration: the sync pulse is 1200 Hz by spec.
    // Measure it with the SAME FFT estimator used for pixels (band 1000–1500 Hz),
    // not arccos — otherwise the estimator mismatch leaves a small constant error
    // in every pixel.  That error is invisible in luma (whites clamp, grays shift
    // imperceptibly) but tints neutral chroma below 128 → a uniform green cast on
    // the Robot modes.  Using one estimator for both makes the residual cancel.
    // Accumulate via a slow EMA (α = 0.20).
    if (bestQ > 0 && bestPos >= 0 && bestPos + syncS <= this._bufLen) {
      const measured = this._estimateFreqFFTRaw(bestPos + syncS * 0.5, syncS, 1000, 1500);
      if (measured > 900 && measured < 1600) {
        const newOffset = 1200.0 - measured;
        if (this._freqOffsetCount === 0) {
          this._freqOffset = newOffset;
        } else {
          this._freqOffset = 0.80 * this._freqOffset + 0.20 * newOffset;
        }
        this._freqOffsetCount++;
      }
    }

    return { pos: bestPos, quality: bestQ };
  }

  // ── RGB line decoder  (Martin / Scottie) ─────────────────────────────────

  _decodeLine(lineStart, syncStart) {
    const m = this._mode;
    if (!m) return null;

    const W      = m.width;
    const out    = new Uint8ClampedArray(W * 4);
    const chS    = m.chanMs  * this._decodeSps / 1000;
    const porchS = m.porchMs * this._decodeSps / 1000;
    const sepS   = m.sepMs   * this._decodeSps / 1000;

    let segments;
    if (m.family === 'martin') {
      // sync → porch → G → sep → B → sep → R
      const base = syncStart + Math.round(m.syncMs * this._decodeSps / 1000) + porchS;
      segments = { g: base, b: base + chS + sepS, r: base + chS + sepS + chS + sepS };
    } else {
      // Scottie: porch → G → sep → B → sep → sync → porch → R
      const g = lineStart + porchS;
      segments = { g, b: g + chS + sepS,
                   r: syncStart + Math.round(m.syncMs * this._decodeSps / 1000) + porchS };
    }

    const pixSpan = chS / W;
    // FFT window: ~1.4 pixels wide, floored for frequency resolution and capped.
    // Sampled at each pixel CENTRE ((x+0.5)·pixSpan) rather than its leading edge.
    const winLen = this._pixelWinLen(pixSpan);

    for (let x = 0; x < W; x++) {
      const cx = (x + 0.5) * pixSpan;
      // 1500 Hz = black (0), 2300 Hz = white (255).  Gamma LUT applied.
      const rv = this._gammaLUT[this._freqToLevel(this._estimateFreqFFT(segments.r + cx, winLen))];
      const gv = this._gammaLUT[this._freqToLevel(this._estimateFreqFFT(segments.g + cx, winLen))];
      const bv = this._gammaLUT[this._freqToLevel(this._estimateFreqFFT(segments.b + cx, winLen))];

      const i    = x * 4;
      out[i]     = rv;
      out[i + 1] = gv;
      out[i + 2] = bv;
      out[i + 3] = 255;
    }

    // Impulse noise suppression: single-pixel and two-pixel spike removal.
    // Only fires when flanking neighbours agree (smooth background) but centre
    // deviates sharply — avoids smearing genuine edges.
    for (let x = 2; x < W - 2; x++) {
      const i = x * 4;
      for (let c = 0; c < 3; c++) {
        const l2  = out[(x - 2) * 4 + c];
        const l1  = out[(x - 1) * 4 + c];
        const mid = out[i + c];
        const r1  = out[(x + 1) * 4 + c];
        const r2  = out[(x + 2) * 4 + c];

        // Single-pixel spike
        const n1Avg = (l1 + r1) * 0.5;
        if (Math.abs(l1 - r1) <= 8 && Math.abs(mid - n1Avg) >= 48) {
          out[i + c] = Math.round(n1Avg);
          continue;
        }
        // Two-pixel spike
        const n2Avg = (l2 + r2) * 0.5;
        if (Math.abs(l2 - r2) <= 12 &&
            Math.abs(mid - n2Avg) >= 48 &&
            Math.abs(l1  - n2Avg) >= 40) {
          out[i + c] = Math.round(n2Avg);
        }
      }
    }

    // Horizontal unsharp mask, radius matched to the FFT window's blur width.
    this._sharpenLine(out, W, winLen / pixSpan);

    return out;
  }

  // FFT window length (samples) for a channel whose pixels span `pixSpan`
  // samples.  ~1.4 pixels wide for sharpness, but floored at ONE CYCLE of the
  // lowest video tone (1500 Hz = sr/1500 samples) — below that the FFT cannot
  // reliably resolve a dark-pixel tone, which was corrupting the fast modes
  // (Martin M2, Scottie S2) whose natural window fell under the floor.  Capped
  // at 96 so the slow modes (Scottie DX) do not over-blur.
  _pixelWinLen(pixSpan) {
    const floor = Math.round(this._decodeSps / 1500);   // ≈32 at 48 kHz
    return Math.max(floor, Math.min(96, Math.round(pixSpan * 1.4)));
  }

  // Decode one channel of a YUV line into a Uint8Array(W) of 0–255 levels using
  // the FFT estimator, sampling at each pixel centre.
  _decodeYUVChannel(chanStart, pixSpan, winLen, W) {
    const out = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      out[x] = this._freqToLevel(this._estimateFreqFFT(chanStart + (x + 0.5) * pixSpan, winLen));
    }
    return out;
  }

  // ── Robot YUV line decoders ───────────────────────────────────────────────
  //
  // Robot 36 and Robot 72 have DIFFERENT structures, so they no longer share a
  // decoder:
  //   • Robot 36 (family 'robot36'): sync+porch+Y(88)+sep(6)+chroma(44).  One
  //     chroma per line, alternating R−Y / B−Y (chosen by the separator tone),
  //     subsampled 2:1 vertically → pairs of lines share Cr/Cb.
  //   • Robot 72 (family 'robot72'): sync+porch+Y(92)+sep+R−Y(92)+sep+B−Y(92).
  //     Full colour every line → one row per line, no pairing.
  // Both return an array of {pixels, lineNum} (0 or 2 rows for R36, 1 for R72).
  _decodeLineRobot(lineStart, syncStart) {
    return this._mode.family === 'robot72'
      ? this._decodeLineRobot72(syncStart)
      : this._decodeLineRobot36(syncStart);
  }

  _decodeLineRobot36(syncStart) {
    const m   = this._mode;
    const W   = m.width;
    const sr  = this._decodeSps;

    const syncS  = Math.round(m.syncMs  * sr / 1000);
    const porchS = Math.round(m.porchMs * sr / 1000);
    const yS     = m.yMs  * sr / 1000;
    const sepS   = Math.round(m.sepMs   * sr / 1000);
    const cS     = m.cMs  * sr / 1000;

    const yStart = syncStart + syncS + porchS;   // start of Y scan
    const cStart = yStart + yS + sepS;           // start of chroma scan

    const pixSpanY = yS / W;
    const pixSpanC = cS / W;
    const winY = this._pixelWinLen(pixSpanY);
    const winC = this._pixelWinLen(pixSpanC);

    const Y = this._decodeYUVChannel(yStart, pixSpanY, winY, W);
    const C = this._decodeYUVChannel(cStart, pixSpanC, winC, W);

    const lineNum = this._line;

    // This line's chroma type comes from the SEPARATOR TONE between Y and chroma
    // (1500 Hz → R−Y / Cr, 2300 Hz → B−Y / Cb), not line parity — self-correcting
    // across dropped lines.  NOTE: if colours swap, flip this comparison (>= ↔ <).
    const sepStart = yStart + yS;
    const isRY = this._goertzel(sepStart, sepS, 1500) >= this._goertzel(sepStart, sepS, 2300);

    // Buffer the first line of a pair; emit both rows once the complement arrives.
    if (this._r36_pendingY === null || this._r36_pendingIsRY === isRY) {
      this._r36_pendingY    = Y;
      this._r36_pendingCb   = C;
      this._r36_pendingIsRY = isRY;
      this._r36_pendingLine = lineNum;
      return [];
    }

    const Cr = isRY ? C : this._r36_pendingCb;   // R−Y
    const Cb = isRY ? this._r36_pendingCb : C;   // B−Y
    const radius = winY / pixSpanY;

    const rows = [
      { pixels: this._yuv2rgb(this._r36_pendingY, Cb, Cr, radius), lineNum: this._r36_pendingLine },
      { pixels: this._yuv2rgb(Y,                  Cb, Cr, radius), lineNum }
    ];

    this._r36_pendingY    = null;
    this._r36_pendingCb   = null;
    this._r36_pendingLine = -1;
    return rows;
  }

  _decodeLineRobot72(syncStart) {
    const m   = this._mode;
    const W   = m.width;
    const sr  = this._decodeSps;

    const syncS  = Math.round(m.syncMs  * sr / 1000);
    const porchS = Math.round(m.porchMs * sr / 1000);
    const sepS   = Math.round(m.sepMs   * sr / 1000);
    const yW     = m.yMs * sr / 1000;                    // 138 ms luma channel
    const cW     = m.cMs * sr / 1000;                    //  69 ms chroma channels

    // sync+porch → Y(138) → sep → R−Y(69) → sep → B−Y(69).  Chroma pixels are
    // half the luma pixel duration (both 320 px wide).
    const yStart  = syncStart + syncS + porchS;
    const ryStart = yStart  + yW + sepS;
    const byStart = ryStart + cW + sepS;

    const yPixSpan = yW / W;
    const cPixSpan = cW / W;
    const winY = this._pixelWinLen(yPixSpan);
    const winC = this._pixelWinLen(cPixSpan);

    const Y  = this._decodeYUVChannel(yStart,  yPixSpan, winY, W);
    const Cr = this._decodeYUVChannel(ryStart, cPixSpan, winC, W);   // R−Y
    const Cb = this._decodeYUVChannel(byStart, cPixSpan, winC, W);   // B−Y

    // Full colour on this line — no vertical chroma pairing.
    return [{ pixels: this._yuv2rgb(Y, Cb, Cr, winY / yPixSpan), lineNum: this._line }];
  }

  // ── YCbCr → RGB conversion (BT.601) ──────────────────────────────────────
  //
  // Y  : [0, 255]  luminance
  // Cb : [0, 255]  B−Y chroma  (128 = neutral)
  // Cr : [0, 255]  R−Y chroma  (128 = neutral)
  //
  // Applies the same impulse-noise filter used by the RGB decoder since static
  // bursts affect all three output channels simultaneously.
  _yuv2rgb(Y, Cb, Cr, radius = 1) {
    const W   = Y.length;
    const out = new Uint8ClampedArray(W * 4);

    for (let x = 0; x < W; x++) {
      const y  =  Y[x];
      const cb = Cb[x] - 128;
      const cr = Cr[x] - 128;

      const i    = x * 4;
      // Gamma LUT applied to final RGB — not to Y/Cb/Cr, to avoid chroma shifts.
      out[i]     = this._gammaLUT[Math.max(0, Math.min(255, Math.round(y + 1.402    * cr)))];
      out[i + 1] = this._gammaLUT[Math.max(0, Math.min(255, Math.round(y - 0.344136 * cb - 0.714136 * cr)))];
      out[i + 2] = this._gammaLUT[Math.max(0, Math.min(255, Math.round(y + 1.772    * cb)))];
      out[i + 3] = 255;
    }

    // Impulse noise suppression (same logic as RGB decoder)
    for (let x = 2; x < W - 2; x++) {
      const i = x * 4;
      for (let c = 0; c < 3; c++) {
        const l2  = out[(x - 2) * 4 + c];
        const l1  = out[(x - 1) * 4 + c];
        const mid = out[i + c];
        const r1  = out[(x + 1) * 4 + c];
        const r2  = out[(x + 2) * 4 + c];

        const n1Avg = (l1 + r1) * 0.5;
        if (Math.abs(l1 - r1) <= 8 && Math.abs(mid - n1Avg) >= 48) {
          out[i + c] = Math.round(n1Avg);
          continue;
        }
        const n2Avg = (l2 + r2) * 0.5;
        if (Math.abs(l2 - r2) <= 12 &&
            Math.abs(mid - n2Avg) >= 48 &&
            Math.abs(l1  - n2Avg) >= 40) {
          out[i + c] = Math.round(n2Avg);
        }
      }
    }

    // Horizontal unsharp mask (radius = luma box-blur width from the caller).
    this._sharpenLine(out, W, radius);

    return out;
  }

  // ── Main decode loop ──────────────────────────────────────────────────────

  _process() {
    // Only scan for a VIS header when no mode is locked.  Running _detectVIS()
    // during an active frame risks a noise-induced false VIS match calling
    // _setMode() and resetting _line=0 mid-image, corrupting the frame; it also
    // wastes the (~1 s window) scan cost on every chunk while decoding.
    if (!this._mode) this._detectVIS();
    if (!this._mode && !this._tryAutoMode()) return;
    const m = this._mode;
    if (!m) return;

    const lineS = Math.round(m.lineMs * this._decodeSps / 1000);
    const syncOffsetScottie = (m.family === 'scottie')
      ? Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000)
      : 0;

    while (
      this._bufLen - this._syncAnchor >= lineS + this._jitterLead &&
      this._line < m.height
    ) {
      const expectedSync = this._needFreshSync
        ? this._syncAnchor
        : (this._syncAnchor + lineS);

      const found     = this._findSyncNear(expectedSync);
      const useFound  = found.quality > (this._lastSyncQuality * 0.35);
      const syncStart = useFound ? found.pos : expectedSync;

      if (useFound) {
        this._lastSyncQuality = Math.max(found.quality, 1e-9);
        this._lostSyncCount   = 0;
      } else {
        this._lostSyncCount++;
        // FIX [15]: after 12 consecutive sync misses the signal is gone or
        // severely corrupted.  Abandon the current mode so VIS/auto detection
        // can restart cleanly, rather than dead-reckoning for 200+ more lines.
        if (this._lostSyncCount > 12) {
          this._emit({ type: 'status', text: `${m.name} — sync lost, resetting` });
          // Clear the UI mode badge — otherwise a transient (e.g. noise-induced)
          // lock leaves its label stuck on screen after the decoder gives up.
          this._emit({ type: 'mode', mode: '', via: 'unlock' });
          this._mode          = null;
          this._detectedMode  = '';
          this._needFreshSync = true;
          this._visScanPos    = Math.max(0, this._syncAnchor - Math.round(this._decodeSps * 0.5));
          this._lostSyncCount = 0;
          this._r36_pendingY  = null;
          this._r36_pendingCb = null;
          break;
        }
      }

      const lineStart = (m.family === 'scottie')
        ? (syncStart - syncOffsetScottie)
        : syncStart;

      if (lineStart < 0 || lineStart + lineS >= this._bufLen) break;

      // Decode line and emit.  Robot 36 returns 0 rows (first line of a pair
      // buffered) or 2 rows; Robot 72 returns 1 row (full colour); Martin/Scottie
      // return 1 row wrapped in an array for uniformity.
      let rows;
      if (m.family === 'robot36' || m.family === 'robot72') {
        rows = this._decodeLineRobot(lineStart, syncStart);
      } else {
        const pixels = this._decodeLine(lineStart, syncStart);
        rows = pixels ? [{ pixels, lineNum: this._line }] : [];
      }

      for (const row of rows) {
        this._emit({
          type:        'line',
          pixels:      row.pixels,
          lineNum:     row.lineNum,
          width:       m.width,
          height:      m.height,
          mode:        m.name,
          syncQuality: found.quality,
          freqOffset:  this._freqOffset,
          soft:        !useFound
        });
      }

      this._line++;
      this._needFreshSync = false;
      this._syncAnchor    = syncStart;
      this._processPos    = Math.max(this._processPos, lineStart);

      if (this._line >= m.height) {
        this._emit({ type: 'status', text: 'Frame complete' });
        this._mode          = null;
        this._detectedMode  = '';
        this._needFreshSync = true;
        this._visScanPos    = this._processPos;
        break;
      }
    }
  }
}