
export class KiwiSSTVDecoder {
  constructor(options = {}) {
    this._sampleRateFn = typeof options.sampleRate === 'function'
      ? options.sampleRate
      : (() => options.sampleRate || 12000);
    this._callback = typeof options.callback === 'function' ? options.callback : null;
    this._forcedMode = options.defaultMode || 'auto';
    this._enabled = false;
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
        text: this._forcedMode === 'auto' ? 'AUTO mode detect' : `Forced ${this._forcedMode.toUpperCase()}`
      });
    }
    this._mode = null;
    this._needFreshSync = true;
    this._line = 0;
  }

  reset(opts = {}) {
    if (opts.mode) this._forcedMode = opts.mode;
    this._decodeSps = 12000;
    this._inSps = this._sampleRateFn() || 12000;
    this._resampleRatio = this._inSps / this._decodeSps;
    this._resamplePhase = 0.0;
    this._resampleLast = 0.0;

    this._buf = new Float32Array(this._decodeSps * 20);
    this._bufLen = 0;
    this._processPos = 0;
    this._visScanPos = 0;
    this._jitterLead = Math.floor(this._decodeSps * 0.45);

    this._mode = null;
    this._detectedMode = '';
    this._visConfidence = 0;
    this._autoScore = 0;
    this._syncAnchor = 0;
    this._line = 0;
    this._needFreshSync = true;
    this._lastSyncQuality = 0;
    this._lostSyncCount = 0;
    this._imageW = 320;
    this._imageH = 256;

    this._modes = {
      martin1: {
        name: 'Martin M1', vis: 44, width: 320, height: 256,
        family: 'martin', syncMs: 4.862, porchMs: 0.572, sepMs: 0.572,
        chanMs: 146.432, lineMs: 446.446, order: ['g', 'b', 'r']
      },
      martin2: {
        name: 'Martin M2', vis: 40, width: 320, height: 256,
        family: 'martin', syncMs: 4.862, porchMs: 0.572, sepMs: 0.572,
        chanMs: 73.216, lineMs: 226.798, order: ['g', 'b', 'r']
      },
      scottie1: {
        name: 'Scottie S1', vis: 60, width: 320, height: 256,
        family: 'scottie', syncMs: 9.0, porchMs: 1.5, sepMs: 1.5,
        chanMs: 138.240, lineMs: 428.088, order: ['g', 'b', 'r']
      },
      scottie2: {
        name: 'Scottie S2', vis: 56, width: 320, height: 256,
        family: 'scottie', syncMs: 9.0, porchMs: 1.5, sepMs: 1.5,
        chanMs: 88.064, lineMs: 277.692, order: ['g', 'b', 'r']
      }
    };
    this._visMap = new Map(Object.entries(this._modes).map(([k, v]) => [v.vis, k]));
  }

  destroy() {
    this._enabled = false;
    this._callback = null;
    this._buf = new Float32Array(0);
    this._bufLen = 0;
  }

  feedPCM(pcm) {
    if (!this._enabled || !pcm || pcm.length === 0) return;
    const inSr = this._sampleRateFn() || this._inSps || 12000;
    if (!Number.isFinite(this._resampleRatio) || Math.abs(inSr - this._inSps) > 1) {
      this._inSps = inSr;
      this._resampleRatio = inSr / this._decodeSps;
    }
    const estOut = Math.ceil(pcm.length / this._resampleRatio) + 4;
    this._ensureCapacity(estOut);

    let phase = this._resamplePhase;
    let last = this._resampleLast;
    const ratio = this._resampleRatio;
    for (let i = 0; i < pcm.length; i++) {
      const cur = pcm[i];
      while (phase <= 1.0) {
        this._buf[this._bufLen++] = last + (cur - last) * phase;
        phase += ratio;
      }
      phase -= 1.0;
      last = cur;
    }
    this._resamplePhase = phase;
    this._resampleLast = last;
    this._process();
  }

  _emit(event) {
    if (typeof this._callback === 'function') this._callback(event);
  }

  _ensureCapacity(extra) {
    if (this._bufLen + extra <= this._buf.length) return;
    if (this._processPos > 0) {
      const keep = this._bufLen - this._processPos;
      this._buf.copyWithin(0, this._processPos, this._bufLen);
      this._bufLen = keep;
      this._visScanPos = Math.max(0, this._visScanPos - this._processPos);
      this._syncAnchor -= this._processPos;
      this._processPos = 0;
      if (this._bufLen + extra <= this._buf.length) return;
    }
    const n = new Float32Array(Math.max(this._buf.length * 2, this._bufLen + extra + 8192));
    n.set(this._buf.subarray(0, this._bufLen));
    this._buf = n;
  }

  _goertzel(start, len, freq) {
    if (start < 0 || len <= 0 || start + len > this._bufLen) return 0;
    const sr = this._decodeSps;
    const k = Math.round(0.5 + (len * freq) / sr);
    const w = 2.0 * Math.PI * k / len;
    const coeff = 2.0 * Math.cos(w);
    let q0 = 0, q1 = 0, q2 = 0;
    for (let i = 0; i < len; i++) {
      q0 = coeff * q1 - q2 + this._buf[start + i];
      q2 = q1;
      q1 = q0;
    }
    return q1 * q1 + q2 * q2 - coeff * q1 * q2;
  }

  _dominantTone(start, len, freqs) {
    let bestF = freqs[0], bestP = -1;
    for (const f of freqs) {
      const p = this._goertzel(start, len, f);
      if (p > bestP) { bestP = p; bestF = f; }
    }
    return { freq: bestF, power: bestP };
  }

  _tonePairScore(start, len, lowF, highF) {
    const a = this._goertzel(start, len, lowF);
    const b = this._goertzel(start, len, highF);
    const sum = a + b + 1e-12;
    return {
      low: a,
      high: b,
      lowNorm: a / sum,
      highNorm: b / sum,
      confidence: Math.abs(a - b) / sum
    };
  }

  _decodeVISCandidate(pos) {
    const sym30 = Math.round(0.030 * this._decodeSps);
    const leader = Math.round(0.300 * this._decodeSps);
    const brk = Math.round(0.010 * this._decodeSps);

    const l1 = this._tonePairScore(pos, leader, 1200, 1900);
    const b1 = this._tonePairScore(pos + leader, brk, 1200, 1900);
    const l2 = this._tonePairScore(pos + leader + brk, leader, 1200, 1900);
    const s0 = pos + leader + brk + leader;

    // Need clear 1900 / 1200 / 1900 leaders.
    if (!(l1.highNorm > 0.72 && b1.lowNorm > 0.72 && l2.highNorm > 0.72)) return null;

    const startBit = this._tonePairScore(s0, sym30, 1100, 1300);
    // start bit should be 1200-ish: both 1100/1300 weak, but 1200 dominates sidebands.
    const start1200 = this._goertzel(s0, sym30, 1200);
    const startSides = this._goertzel(s0, sym30, 1100) + this._goertzel(s0, sym30, 1300) + 1e-12;
    if (!(start1200 / startSides > 1.20)) return null;

    let vis = 0;
    let ones = 0;
    let bitConfidence = 0;
    for (let i = 0; i < 7; i++) {
      const bit = this._tonePairScore(s0 + sym30 * (i + 1), sym30, 1100, 1300);
      bitConfidence += bit.confidence;
      if (bit.low > bit.high) {
        vis |= (1 << i);
        ones++;
      }
    }

    const parity = this._tonePairScore(s0 + sym30 * 8, sym30, 1100, 1300);
    const parityBit = parity.low > parity.high ? 1 : 0;
    bitConfidence += parity.confidence;

    const stop1200 = this._goertzel(s0 + sym30 * 9, sym30, 1200);
    const stopSides = this._goertzel(s0 + sym30 * 9, sym30, 1100) + this._goertzel(s0 + sym30 * 9, sym30, 1300) + 1e-12;
    if (!(stop1200 / stopSides > 1.15)) return null;

    const expectedParity = ones & 1; // odd parity for SSTV VIS
    const parityOk = parityBit === expectedParity;
    const modeKey = this._visMap.get(vis);
    if (!modeKey || !parityOk) return null;

    const leaderConf = (l1.confidence + b1.confidence + l2.confidence) / 3;
    const conf = 0.55 * leaderConf + 0.45 * (bitConfidence / 8);
    return {
      modeKey,
      vis,
      confidence: conf,
      syncAnchor: s0 + sym30 * 10
    };
  }

  _candidateSyncScore(modeKey, anchor) {
    const m = this._modes[modeKey];
    if (!m) return -1e30;
    const lineS = Math.round(m.lineMs * this._decodeSps / 1000);
    const syncS = Math.max(24, Math.round(m.syncMs * this._decodeSps / 1000));
    const syncOffset = (m.family === 'scottie')
      ? Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000)
      : 0;

    let score = 0;
    let lines = 0;
    for (let n = 0; n < 4; n++) {
      let syncStart = anchor + n * lineS + syncOffset;
      if (syncStart < 0 || syncStart + syncS >= this._bufLen) break;
      const p1200 = this._goertzel(syncStart, syncS, 1200);
      const p1500 = this._goertzel(syncStart, syncS, 1500);
      const p1900 = this._goertzel(syncStart, syncS, 1900);
      const q = (p1200 - 0.28 * p1500 - 0.42 * p1900) / (p1200 + p1500 + p1900 + 1e-12);
      score += q;
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

  for (let pos = this._visScanPos; pos <= scanLimit; pos += Math.max(8, Math.round(0.0025 * this._decodeSps))) {
    const cand = this._decodeVISCandidate(pos);
    if (!cand) continue;
    cand.syncScore = this._candidateSyncScore(cand.modeKey, cand.syncAnchor);
    const total = cand.confidence + 0.45 * Math.max(0, cand.syncScore);
    if (!best || total > best.total) {
      best = { ...cand, total };
    }
  }

  // Be conservative: prefer no detection over false mode.
  if (best && best.confidence >= 0.62 && best.syncScore >= 0.08) {
    this._visConfidence = best.confidence;
    this._autoScore = best.syncScore;
    this._setMode(best.modeKey, 'VIS');
    this._syncAnchor = best.syncAnchor;
    this._line = 0;
    this._needFreshSync = true;
    this._visScanPos = this._syncAnchor;
    return true;
  }

  this._visScanPos = Math.max(this._visScanPos, scanLimit);
  return false;
}

_setMode(modeKey, via = 'AUTO') {
    const mode = this._modes[modeKey];
    if (!mode) return;
    this._mode = mode;
    this._detectedMode = mode.name;
    this._imageW = mode.width;
    this._imageH = mode.height;
    this._emit({ type: 'mode', mode: mode.name, via, visConfidence: this._visConfidence, autoScore: this._autoScore });
    const extra = via === 'VIS'
      ? ` conf=${this._visConfidence.toFixed(2)}`
      : via === 'AUTO'
        ? ` score=${this._autoScore.toFixed(2)}`
        : '';
    this._emit({ type: 'status', text: `${mode.name} lock (${via}${extra})` });
  }

_tryAutoMode() {
  if (this._forcedMode && this._forcedMode !== 'auto') {
    if (!this._mode || this._mode.name.toLowerCase() !== this._forcedMode.toLowerCase()) {
      const key = Object.keys(this._modes).find(k => this._modes[k].name.toLowerCase() === this._forcedMode.toLowerCase() || k === this._forcedMode.toLowerCase());
      if (key) this._setMode(key, 'FORCED');
    }
    return !!this._mode;
  }
  if (this._mode) return true;
  if (this._bufLen < this._decodeSps * 2.0) return false;

  let best = null;
  let second = null;
  const candidateKeys = ['martin1', 'martin2', 'scottie1', 'scottie2'];

  for (const key of candidateKeys) {
    const m = this._modes[key];
    const lineS = Math.round(m.lineMs * this._decodeSps / 1000);
    const syncS = Math.max(24, Math.round(m.syncMs * this._decodeSps / 1000));
    const syncOffset = (m.family === 'scottie')
      ? Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000)
      : 0;

    const step = Math.max(10, Math.round(0.008 * this._decodeSps));
    const anchorMin = this._processPos;
    const anchorMax = Math.max(anchorMin, this._bufLen - lineS * 4 - syncS - 8);

    for (let a = anchorMin; a <= anchorMax; a += step) {
      let score = 0;
      let valid = 0;

      for (let n = 0; n < 4; n++) {
        const syncStart = a + n * lineS + syncOffset;
        if (syncStart < 0 || syncStart + syncS >= this._bufLen) break;

        const p1200 = this._goertzel(syncStart, syncS, 1200);
        const p1500 = this._goertzel(syncStart, syncS, 1500);
        const p1900 = this._goertzel(syncStart, syncS, 1900);
        const q = (p1200 - 0.28 * p1500 - 0.42 * p1900) / (p1200 + p1500 + p1900 + 1e-12);
        score += q;
        valid++;
      }

      if (valid < 3) continue;
      score /= valid;

      const item = { key, score, anchor: a, valid };
      if (!best || score > best.score) {
        second = best;
        best = item;
      } else if (!second || score > second.score) {
        second = item;
      }
    }
  }

  // Conservative locking: need a real winner and a margin.
  const margin = best && second ? (best.score - second.score) : 0;
  if (best && best.score >= 0.10 && margin >= 0.025) {
    this._autoScore = best.score;
    this._setMode(best.key, 'AUTO');
    const m = this._modes[best.key];
    this._syncAnchor = best.anchor;
    if (m.family === 'scottie') {
      this._syncAnchor += Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000);
    }
    this._line = 0;
    this._needFreshSync = true;
    return true;
  }
  return false;
}

_findSyncNear(expectedSyncStart) {
    const m = this._mode;
    if (!m) return { pos: expectedSyncStart, quality: 0 };
    const syncS = Math.max(24, Math.round(m.syncMs * this._decodeSps / 1000));
    const span = Math.round(0.025 * this._decodeSps);
    let bestPos = expectedSyncStart;
    let bestQ = -1e30;
    for (let pos = expectedSyncStart - span; pos <= expectedSyncStart + span; pos += 8) {
      if (pos < 0 || pos + syncS >= this._bufLen) continue;
      const p1200 = this._goertzel(pos, syncS, 1200);
      const p1500 = this._goertzel(pos, syncS, 1500);
      const p1900 = this._goertzel(pos, syncS, 1900);
      const q = p1200 - 0.35 * p1500 - 0.35 * p1900;
      if (q > bestQ) { bestQ = q; bestPos = pos; }
    }
    return { pos: bestPos, quality: bestQ };
  }

  _estimateFreq(start, len) {
    const begin = Math.max(0, Math.floor(start));
    const end = Math.min(this._bufLen, Math.floor(start + len));
    if (end - begin < 10) return 1500;
    let bestLag = 8;
    let best = -1e30;
    for (let lag = 5; lag <= 10; lag++) {
      let s = 0;
      for (let i = begin + lag; i < end; i++) s += this._buf[i] * this._buf[i - lag];
      if (s > best) { best = s; bestLag = lag; }
    }
    return this._decodeSps / bestLag;
  }

  _decodeLine(lineStart, syncStart) {
    const m = this._mode;
    if (!m) return null;

    const W = m.width;
    const out = new Uint8ClampedArray(W * 4);
    const chS = m.chanMs * this._decodeSps / 1000;
    const porchS = m.porchMs * this._decodeSps / 1000;
    const sepS = m.sepMs * this._decodeSps / 1000;

    let segments;
    if (m.family === 'martin') {
      const base = syncStart + Math.round(m.syncMs * this._decodeSps / 1000) + porchS;
      segments = {
        g: base,
        b: base + chS + sepS,
        r: base + chS + sepS + chS + sepS
      };
    } else {
      const g = lineStart + porchS;
      const b = g + chS + sepS;
      const r = syncStart + Math.round(m.syncMs * this._decodeSps / 1000) + porchS;
      segments = { g, b, r };
    }

    const pixSpan = chS / W;

    // Martin M2 has a much shorter pixel dwell time. With the old pixSpan+6 window,
    // many samples ended up below the minimum estimator length and returned 1500 Hz,
    // which paints the whole line black. Use a wider centered window there.
    const isMartin2 = m.name === 'Martin M2';
    const estLen = isMartin2
      ? Math.max(14, Math.ceil(pixSpan * 5.0))
      : Math.max(10, Math.ceil(pixSpan + 6));
    const halfExtra = Math.max(0, (estLen - pixSpan) * 0.5);

    for (let x = 0; x < W; x++) {
      const rStart = segments.r + x * pixSpan - halfExtra;
      const gStart = segments.g + x * pixSpan - halfExtra;
      const bStart = segments.b + x * pixSpan - halfExtra;

      let rv = Math.max(0, Math.min(255, Math.round((this._estimateFreq(rStart, estLen) - 1500) * 255 / 800)));
      let gv = Math.max(0, Math.min(255, Math.round((this._estimateFreq(gStart, estLen) - 1500) * 255 / 800)));
      let bv = Math.max(0, Math.min(255, Math.round((this._estimateFreq(bStart, estLen) - 1500) * 255 / 800)));

      if (m && m.family === 'scottie') {
        rv = Math.max(0, Math.min(255, Math.round(rv * 1.12 + 6)));
        gv = Math.max(0, Math.min(255, Math.round(gv * 1.12 + 6)));
        bv = Math.max(0, Math.min(255, Math.round(bv * 1.12 + 6)));
      }

      const i = x * 4;
      out[i] = rv;
      out[i + 1] = gv;
      out[i + 2] = bv;
      out[i + 3] = 255;
    }

    return out;
  }

  _process() {
    if (this._detectVIS()) {
    }
    if (!this._mode && !this._tryAutoMode()) return;
    const m = this._mode;
    if (!m) return;
    const lineS = Math.round(m.lineMs * this._decodeSps / 1000);
    const syncOffsetScottie = (m.family === 'scottie')
      ? Math.round((m.porchMs + m.chanMs + m.sepMs + m.chanMs) * this._decodeSps / 1000)
      : 0;

    while (this._bufLen - this._syncAnchor >= lineS + this._jitterLead && this._line < m.height) {
      const expectedSync = this._needFreshSync ? this._syncAnchor : (this._syncAnchor + lineS);
      const found = this._findSyncNear(expectedSync);
      const useFound = found.quality > (this._lastSyncQuality * 0.35);
      let syncStart = useFound ? found.pos : expectedSync;
      if (useFound) {
        this._lastSyncQuality = Math.max(found.quality, 1e-9);
        this._lostSyncCount = 0;
      } else {
        this._lostSyncCount++;
      }
      const lineStart = (m.family === 'scottie') ? (syncStart - syncOffsetScottie) : syncStart;
      if (lineStart < 0 || lineStart + lineS >= this._bufLen) break;
      const pixels = this._decodeLine(lineStart, syncStart);
      if (pixels) {
        this._emit({
          type: 'line',
          pixels,
          lineNum: this._line,
          width: m.width,
          height: m.height,
          mode: m.name,
          syncQuality: found.quality,
          soft: !useFound
        });
      }
      this._line++;
      this._needFreshSync = false;
      this._syncAnchor = syncStart;
      this._processPos = Math.max(this._processPos, lineStart);
      if (this._line >= m.height) {
        this._emit({ type: 'status', text: 'Frame complete' });
        this._mode = null;
        this._detectedMode = '';
        this._needFreshSync = true;
        this._visScanPos = this._processPos;
        break;
      }
    }
  }
}
