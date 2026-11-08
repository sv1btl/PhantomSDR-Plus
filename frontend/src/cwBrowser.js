// cwBrowser.js — CW signal browser ("skimmer") for the CW decoder window
// ============================================================================
// Decodes every CW signal between ~200 and ~3000 Hz of USB audio at once, one
// line per signal, with the station's callsign picked out and CQ calls marked.
//
// Finding signals: a CW carrier is a narrow line in an averaged spectrum.
// Once a second a 1.46 Hz-bin FFT of the last ~0.7 s is folded into an
// averaged spectrum (fast attack, slow release, so a signal survives the gaps
// between letters); its local maxima well above the median floor are carriers.
// A new carrier that holds for two scans opens a channel.
//
// One channel per carrier: the audio is mixed down with a complex oscillator
// at the carrier, low-passed (FIR, ±150 Hz) and decimated ×DEC, then put back
// on a fixed IF tone and fed to its own CWDecoder (cwDecoder.js) running at
// the low rate with `fixedToneHz` — all of the decoder's weak-signal work
// (speed estimation, noise gate, QSB slicer, soft decisions) per signal, at
// about a quarter of the cost of running it on the full-rate audio. The
// channel oscillator follows the carrier's drift between scans.
//
// Interface:
//   new CwBrowser({ sampleRate, lowHz, highHz, onUpdate, onStatus })
//   .feed(Float32Array); .reset();
//   onUpdate([{ id, hz, wpm, text, call, cq, last }])  about 4 times a second
//   (ghost lines — a strong station's keying sidebands — are left out)
// ============================================================================

import CWDecoder from './cwDecoder.js';
import { transformFlat } from './lib/fftRadix2.js';

const FFT_N = 8192;
const MAX_CHANNELS = 30;
const MIN_SPACING_HZ = 30;        // two carriers closer than this are one signal
const DETECT_DB = 10;             // averaged peak over the median floor
const DROP_AFTER_MS = 60000;      // no carrier and no text this long: dropped
const TEXT_KEEP = 4000;      // per line; the page shows ~6 lines and scrolls back (▲ ▼)
const IF_HZ = 400;                // where each channel's carrier sits for its decoder
const FIR_HALF_BW = 150;          // first channel filter (before decimation): ± Hz kept
const FIR_TAPS = 129;
const NARROW_HALF_BW = 30;        // second, sharp filter at the low rate: ± Hz kept
const NARROW_TAPS = 241;          // at ~1.5 kHz: ~25 Hz transition
const REPLAY_S = 3;               // audio replayed into a new channel (its first words)
const EST_PERIOD_MS = 2100;      // speed re-estimate (decoder default 700): cheaper AND measured slightly better
const LIVE_DB = 6;                // a known carrier is "still there" this far over the floor
const CARRIER_HOLD_S = 2;         // letters are taken only this long after the carrier was last seen
// Ghost lines: a strong keyed carrier has keying sidebands that stand out of
// the averaged spectrum 30-70 Hz either side of it (measured 16-34 dB below
// it), and a channel opened there prints a garbled copy of that station.
// Their level overlaps a real weak neighbour's (a -4 dB station 60 Hz from
// a +20 dB one is about as far down), but their keying does not: sidebands
// are made by the key edges, so a ghost's envelope follows the EDGES of its
// parent's keying (|d envelope|), measured r 0.79-0.88, while a real
// station's follows its own keying. Hard-keyed +20..+30 dB stations spread
// them as far as 160 Hz. A carrier ~31 Hz away sits on the narrow filter's
// -6 dB edge and comes through itself: that ghost follows the parent's
// envelope (not its edges) and is only a few dB down. Each channel keeps the
// envelope of its narrow filter output; a line that follows a stronger one
// either way is hidden.
const ENV_MS = 10;                // envelope block
const ENV_N = 600;                // envelope history (6 s)
const GHOST_WIN = 400;            // blocks compared (4 s)
const GHOST_HZ = 200;             // a parent within this distance
const GHOST_DB = 10;              // ... at least this much stronger
const LEAK_HZ = 40;               // closer than this a parent's carrier leaks in ...
const LEAK_DB = 3;                // ... so it only has to be this much stronger
const GHOST_CORR = 0.78;          // correlation that makes a ghost (option ghostCorr; > 1 turns the test off)
const GHOST_LAG = 2;              // blocks of lag tried either way

/** Windowed-sinc low-pass (Blackman), cutoff fc/fs. */
function lowpass(n, fcNorm) {
  const h = new Float64Array(n), m = (n - 1) / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = i - m;
    const sinc = x === 0 ? 2 * fcNorm : Math.sin(2 * Math.PI * fcNorm * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (n - 1));
    h[i] = sinc * w; sum += h[i];
  }
  for (let i = 0; i < n; i++) h[i] /= sum;
  return h;
}

/**
 * The station's own callsign in a line of CW, and whether it is calling CQ.
 * "CQ … DE X" / "CQ X" / "DE X" name the sender; otherwise the callsign that
 * appears most often (twice or more).
 */
const CALL_RE = /\b((?:[A-Z]{1,2}|[0-9][A-Z]|[A-Z][0-9])[0-9][A-Z]{1,4})(?:\/[A-Z0-9]{1,4})?\b/g;
export function cwCallsign(text) {
  const r = _cwCallsign(text);
  // "YT1KYDE": the DE that follows a call, read without its gap (seen on air)
  if (r.call && /DE$/.test(r.call) && /^(?:[A-Z]{1,2}|[0-9][A-Z]|[A-Z][0-9])[0-9][A-Z]{1,4}$/.test(r.call.slice(0, -2))) r.call = r.call.slice(0, -2);
  if (r.call) return r;
  // Letters that came out spaced apart ("YO 8 B N C" while the speed was
  // not locked yet): try short runs of adjacent pieces (each up to 3
  // characters, together up to 8) and keep those that make a callsign.
  const words = text.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean);
  const full = /^(?:[A-Z]{1,2}|[0-9][A-Z]|[A-Z][0-9])[0-9][A-Z]{1,4}$/;
  const n = new Map();
  let lastFound = '';
  for (let i = 0; i < words.length; i++) {
    let cat = '';
    for (let j = i; j < words.length && words[j].length <= 3; j++) {
      cat += words[j];
      if (cat.length > 8) break;
      if (j > i && full.test(cat)) { n.set(cat, (n.get(cat) || 0) + 1); lastFound = cat; }
    }
  }
  if (!n.size) return r;
  let best = lastFound, bn = 1;
  for (const [c, k] of n) if (k > bn) { best = c; bn = k; }
  return { call: best, cq: r.cq };
}

function _cwCallsign(text) {
  const t = ' ' + text.toUpperCase().replace(/[^A-Z0-9/ ]/g, ' ') + ' ';
  const calls = [...t.matchAll(CALL_RE)].map((m) => ({ call: m[1], at: m.index }));
  if (!calls.length) return { call: '', cq: false };
  const tail = t.slice(-80);
  const cq = /\bCQ\b/.test(tail);
  const n = new Map();
  for (const c of calls) n.set(c.call, (n.get(c.call) || 0) + 1);
  // a callsign sent two or more times wins: a single "DE OE3CI" next to
  // three OE3CDS (measured on air) is a mis-read letter
  let top = '', tn = 1;
  for (const [c, k] of n) if (k > tn || (k === tn && k > 1 && t.lastIndexOf(c) > t.lastIndexOf(top))) { top = c; tn = k; }
  if (tn >= 2) return { call: top, cq };
  // the last "DE <call>" names the sender
  const de = [...t.matchAll(/\bDE ((?:[A-Z]{1,2}|[0-9][A-Z]|[A-Z][0-9])[0-9][A-Z]{1,4})\b/g)];
  if (de.length) return { call: de[de.length - 1][1], cq };
  // "CQ <call>" (contest style: CQ TEST HA8A, CQ HA8A)
  const cqm = [...t.matchAll(/\bCQ (?:TEST |CQ |SS |WW |DX )*((?:[A-Z]{1,2}|[0-9][A-Z]|[A-Z][0-9])[0-9][A-Z]{1,4})\b/g)];
  if (cqm.length) return { call: cqm[cqm.length - 1][1], cq };
  if (n.size === 1) return { call: calls[0].call, cq };   // the only callsign in the line
  let best = '', bn = 1;
  for (const [c, k] of n) if (k > bn) { best = c; bn = k; }
  return { call: best, cq };
}

class Channel {
  constructor(id, hz, sr, dec, now, onChar) {
    this.id = id; this.hz = hz; this.text = ''; this.wpm = 0;
    this.seen = now; this.live = now; this.hits = 7; this.last = 0; this.opened = now;
    this.sr = sr; this.dec = dec;
    this.taps = lowpass(FIR_TAPS, FIR_HALF_BW / sr);
    this.bufI = new Float64Array(FIR_TAPS); this.bufQ = new Float64Array(FIR_TAPS); this.pos = 0;
    this.oc = 1; this.os = 0; this.ic = 1; this.is = 0; this.norm = 0; this.count = 0;
    this.out = new Float32Array(1024); this.outN = 0;
    this.ntaps = lowpass(NARROW_TAPS, NARROW_HALF_BW / (sr / dec));
    this.nI = new Float64Array(NARROW_TAPS); this.nQ = new Float64Array(NARROW_TAPS); this.npos = 0;
    this.envBlk = Math.max(1, Math.round(ENV_MS / 1000 * sr / dec));
    this.env = new Float32Array(ENV_N); this.envAcc = 0; this.envCnt = 0; this.envIdx = 0;   // envIdx: absolute block number
    this.env0 = 0; this.ghost = false; this.ghostVotes = 0; this.ghostEvals = 0;
    this.decoder = new CWDecoder({
      sampleRate: sr / dec,
      fixedToneHz: IF_HZ,
      estPeriodMs: EST_PERIOD_MS,
      callback: (e) => {
        if (e.type === 'char') onChar(this, e.char);
        else if (e.type === 'word') onChar(this, ' ');
      },
    });
  }

  /** Mix to baseband at this.hz, FIR, decimate, put on the IF tone, decode. */
  feed(pcm) {
    const sr = this.sr, dec = this.dec, taps = this.taps, n = FIR_TAPS;
    // rotators (cheaper than cos/sin per sample), renormalised now and then
    const w = 2 * Math.PI * this.hz / sr, wIF = 2 * Math.PI * IF_HZ / (sr / dec);
    const sc = Math.cos(w), ss = Math.sin(w), ic = Math.cos(wIF), is = Math.sin(wIF);
    let oc = this.oc, os = this.os, pos = this.pos, cnt = this.count;
    const bI = this.bufI, bQ = this.bufQ;
    for (let k = 0; k < pcm.length; k++) {
      const x = pcm[k];
      bI[pos] = x * oc; bQ[pos] = -x * os;
      const t = oc * sc - os * ss; os = os * sc + oc * ss; oc = t;
      pos = (pos + 1) % n;
      if (++cnt >= dec) {
        cnt = 0;
        let si0 = 0, sq0 = 0, j = pos;
        for (let t = 0; t < n; t++) { si0 += taps[t] * bI[j]; sq0 += taps[t] * bQ[j]; if (++j === n) j = 0; }
        // second, sharp filter at the low rate: keeps a neighbour 40 Hz away out
        const nt = this.ntaps, nn = NARROW_TAPS, nI = this.nI, nQ = this.nQ;
        nI[this.npos] = si0; nQ[this.npos] = sq0; this.npos = (this.npos + 1) % nn;
        let si = 0, sq = 0, jj = this.npos;
        for (let t = 0; t < nn; t++) { si += nt[t] * nI[jj]; sq += nt[t] * nQ[jj]; if (++jj === nn) jj = 0; }
        // envelope (for the ghost test), in blocks of ENV_MS on the shared audio clock
        this.envAcc += si * si + sq * sq;
        if (++this.envCnt >= this.envBlk) { this.env[this.envIdx % ENV_N] = Math.sqrt(this.envAcc / this.envCnt); this.envIdx++; this.envAcc = 0; this.envCnt = 0; }
        // back onto a real IF tone: Re{(si + j sq) e^{jwIF n}}
        const u = this.ic * ic - this.is * is; this.is = this.is * ic + this.ic * is; this.ic = u;
        this.out[this.outN++] = 2 * (si * this.ic - sq * this.is);
        if (++this.norm >= 512) {
          this.norm = 0;
          let g = 1 / Math.hypot(oc, os); oc *= g; os *= g;
          g = 1 / Math.hypot(this.ic, this.is); this.ic *= g; this.is *= g;
        }
        if (this.outN === this.out.length) { this.decoder.feed(this.out); this.outN = 0; }
      }
    }
    this.oc = oc; this.os = os; this.pos = pos; this.count = cnt;
    if (this.outN) { this.decoder.feed(this.out.subarray(0, this.outN)); this.outN = 0; }
  }
}

export class CwBrowser {
  constructor(options = {}) {
    this._sampleRateFn = typeof options.sampleRate === 'function'
      ? options.sampleRate : (() => Number(options.sampleRate) || 12000);
    this._lo = Number(options.lowHz) || 200;
    this._hi = Number(options.highHz) || 3000;
    this.onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : null;
    this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
    this._now = typeof options.now === 'function' ? options.now : () => Date.now();
    this._ghostCorr = Number(options.ghostCorr) || GHOST_CORR;
    this.reset();
  }

  reset() {
    this._ring = new Float32Array(FFT_N);
    this._replay = null; this._replayPos = 0; this._replayFill = 0;
    this._ringPos = 0; this._filled = 0; this._sinceScan = 0; this._samples = 0;
    this._avg = null; this._cand = new Map();
    this._channels = []; this._nextId = 1; this._lastUpdate = 0; this._lastCount = -1;
    this._sr = 0;
    this._t = 0;                  // audio time fed so far, in seconds (all channel timing uses it)
  }

  feed(pcm) {
    if (!pcm || !pcm.length) return;
    const sr = this._sampleRateFn() || 12000;
    if (sr !== this._sr) {
      this._sr = sr; this._channels = []; this._avg = null;
      this._replay = new Float32Array(Math.round(sr * REPLAY_S)); this._replayPos = 0; this._replayFill = 0;
    }
    const R = this._replay, RN = R.length;
    for (let n = 0; n < pcm.length; n++) { R[this._replayPos] = pcm[n]; this._replayPos = (this._replayPos + 1) % RN; }
    this._replayFill = Math.min(RN, this._replayFill + pcm.length);
    for (let n = 0; n < pcm.length; n++) {
      this._ring[this._ringPos] = pcm[n];
      this._ringPos = (this._ringPos + 1) % FFT_N;
    }
    this._filled = Math.min(FFT_N, this._filled + pcm.length);
    this._t += pcm.length / sr;
    this._samples += pcm.length;
    for (const ch of this._channels) ch.feed(pcm);
    this._sinceScan += pcm.length;
    if (this._sinceScan >= sr && this._filled >= FFT_N) { this._sinceScan = 0; this._scan(sr); }
    const wall = this._now();
    if (wall - this._lastUpdate >= 250) { this._lastUpdate = wall; this._emit(); }
  }

  _scan(sr) {
    const re = new Float64Array(FFT_N), im = new Float64Array(FFT_N);
    for (let k = 0; k < FFT_N; k++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / FFT_N);
      re[k] = this._ring[(this._ringPos + k) % FFT_N] * w;
    }
    transformFlat(re, im, false);
    const bin = sr / FFT_N;
    const lo = Math.max(2, Math.floor(this._lo / bin)), hi = Math.min(FFT_N / 2 - 3, Math.ceil(this._hi / bin));
    if (!this._avg) this._avg = new Float64Array(FFT_N / 2);
    const avg = this._avg;
    for (let k = lo - 2; k <= hi + 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      // fast attack, slow release: a keyed carrier stays visible between letters
      avg[k] = !avg[k] ? p : p > avg[k] ? avg[k] + 0.6 * (p - avg[k]) : avg[k] + 0.15 * (p - avg[k]);
    }
    // ±2 bins (±3 Hz) smoothing, of the average and of this scan alone
    const sm = new Float64Array(FFT_N / 2), cur = new Float64Array(FFT_N / 2);
    const pw = (k) => re[k] * re[k] + im[k] * im[k];
    for (let k = lo; k <= hi; k++) {
      sm[k] = (avg[k - 2] + avg[k - 1] + avg[k] + avg[k + 1] + avg[k + 2]) / 5;
      cur[k] = (pw(k - 2) + pw(k - 1) + pw(k) + pw(k + 1) + pw(k + 2)) / 5;
    }
    const sorted = Array.from(sm.subarray(lo, hi + 1)).sort((a, b) => a - b);
    const floor = sorted[sorted.length >> 1] || 1e-30;
    const thr = floor * Math.pow(10, DETECT_DB / 10);
    const guard = Math.max(2, Math.round((MIN_SPACING_HZ / 2) / bin));
    const peaks = [];
    for (let k = lo + guard; k <= hi - guard; k++) {
      if (sm[k] < thr) continue;
      let isMax = true;
      for (let j = -guard; j <= guard && isMax; j++) if (j && sm[k + j] > sm[k]) isMax = false;
      if (!isMax) continue;
      // parabolic refinement
      const a = sm[k - 1], b = sm[k], c = sm[k + 1], den = a - 2 * b + c;
      const d = den < 0 ? 0.5 * (a - c) / den : 0;
      peaks.push({ hz: (k + d) * bin, p: sm[k] });
    }
    peaks.sort((x, y) => y.p - x.p);
    const now = this._t;
    // keyed in THIS scan (the average releases slowly, so it cannot tell)
    const curSorted = Array.from(cur.subarray(lo, hi + 1)).sort((a, b) => a - b);
    // a known carrier only has to stand 6 dB over the floor (10 dB to open
    // one), in two of the last three scans: a lone noise peak at its
    // frequency must not keep a finished station's line printing
    const curThr = (curSorted[curSorted.length >> 1] || 1e-30) * Math.pow(10, LIVE_DB / 10);
    for (const ch of this._channels) {
      const k = Math.round(ch.hz / bin);
      let m = 0;
      for (let j = -2; j <= 2; j++) if (k + j >= lo && k + j <= hi) m = Math.max(m, cur[k + j]);
      ch.hits = ((ch.hits << 1) | (m >= curThr ? 1 : 0)) & 7;
      if ((ch.hits & 1) + ((ch.hits >> 1) & 1) + ((ch.hits >> 2) & 1) >= 2) ch.live = now;
    }
    // existing channels: follow drift, mark as seen
    for (const ch of this._channels) {
      const pk = peaks.find((q) => Math.abs(q.hz - ch.hz) < MIN_SPACING_HZ / 2);
      if (pk) { ch.seen = now; if (Math.abs(pk.hz - ch.hz) > 0.5) ch.hz += 0.5 * (pk.hz - ch.hz); }
    }
    // new carriers: open once they hold for two scans
    const cand = new Map();
    for (const pk of peaks) {
      if (this._channels.some((c) => Math.abs(c.hz - pk.hz) < MIN_SPACING_HZ)) continue;
      const key = Math.round(pk.hz / 10);
      const prev = this._cand.get(key) || this._cand.get(key - 1) || this._cand.get(key + 1);
      if (prev && this._channels.length < MAX_CHANNELS) this._open(pk.hz, sr, now);
      else cand.set(key, pk);
    }
    this._cand = cand;
    // drop gone channels; merge ones that drifted together
    this._channels = this._channels.filter((c) => now - Math.max(c.seen, c.last) < DROP_AFTER_MS / 1000);
    this._channels.sort((a, b) => a.hz - b.hz);
    this._ghosts();
    for (let i = 1; i < this._channels.length; i++) {
      const a = this._channels[i - 1], b = this._channels[i];
      if (Math.abs(a.hz - b.hz) < MIN_SPACING_HZ / 2) {
        const drop = a.text.length >= b.text.length ? b : a;
        this._channels = this._channels.filter((c) => c !== drop);
        i--;
      }
    }
  }

  _open(hz, sr, now) {
    const dec = Math.max(1, Math.round(sr / 1500));   // ~1.5 kHz per channel
    const ch = new Channel(this._nextId++, hz, sr, dec, now, (c, s) => {
      if (c.ghost) return;      // a ghost's letters are its parent's, garbled
      // Only while the carrier is there: once a station stops, the narrow
      // channel holds filtered noise that the decoder would read as E's.
      // (During the replay of a new channel its carrier was just seen.)
      if (this._t - c.live > CARRIER_HOLD_S) return;
      c.text = (c.text + s).replace(/ {2,}/g, ' ').slice(-TEXT_KEEP);
      if (s !== ' ') c.last = this._t;
    });
    // its first words: the last few seconds of audio, which the carrier was
    // already in before it held for two scans
    const R = this._replay, RN = R.length, N = this._replayFill;
    // the envelope blocks count on the audio clock shared by every channel
    ch.envIdx = ch.env0 = Math.floor((this._samples - N) / dec / ch.envBlk);
    if (N) {
      const buf = new Float32Array(N);
      let i = (this._replayPos - N + RN) % RN;
      for (let k = 0; k < N; k++) { buf[k] = R[i]; i = (i + 1) % RN; }
      ch.feed(buf);
    }
    this._channels.push(ch);
  }

  /**
   * Mark the channels whose keying follows a much stronger channel close by
   * (its keying sidebands, see GHOST_*). Two scans in a row decide either
   * way, so one noisy comparison does not hide or bring back a line.
   */
  _ghosts() {
    const chs = this._channels;
    const stat = new Map();
    const W = GHOST_WIN;
    for (const a of chs) {
      let verdict = false;
      for (const b of chs) {
        if (b === a || Math.abs(b.hz - a.hz) > GHOST_HZ) continue;
        const e = Math.min(a.envIdx, b.envIdx);
        const n = e - Math.max(e - W, a.env0, b.env0, a.envIdx - ENV_N, b.envIdx - ENV_N);
        if (n < 150) continue;
        // b must be the stronger one by GHOST_DB (mean power over the window)
        let pa = 0, pb = 0;
        for (let i = e - n; i < e; i++) { const x = a.env[i % ENV_N], y = b.env[i % ENV_N]; pa += x * x; pb += y * y; }
        const leak = Math.abs(b.hz - a.hz) < LEAK_HZ;
        if (pb < pa * Math.pow(10, (leak ? LEAK_DB : GHOST_DB) / 10)) continue;
        // a's envelope against the edges of b's keying (sidebands) or, close
        // in, against b's envelope (its carrier); best of a few lags
        let r = -1;
        for (let L = -GHOST_LAG; L <= GHOST_LAG; L++) {
          for (const edges of leak ? [true, false] : [true]) {
            let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, m = 0;
            for (let i = e - n + GHOST_LAG + 1; i < e - GHOST_LAG; i++) {
              const j = i + L, x = a.env[i % ENV_N];
              const y = edges ? Math.abs(b.env[j % ENV_N] - b.env[(j - 1) % ENV_N]) : b.env[j % ENV_N];
              sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; m++;
            }
            const va = saa - sa * sa / m, vb = sbb - sb * sb / m;
            if (va > 0 && vb > 0) r = Math.max(r, (sab - sa * sb / m) / Math.sqrt(va * vb));
          }
        }
        if (this._debugGhost) this._debugGhost(   // test hook (benches)
          a, b, r, 10 * Math.log10(pb / pa));
        if (r >= this._ghostCorr) { verdict = true; break; }
      }
      stat.set(a, verdict);
    }
    for (const [a, v] of stat) {
      a.ghostEvals++;
      a.ghostVotes = v ? Math.min(2, a.ghostVotes + 1) : Math.max(-2, a.ghostVotes - 1);
      // its text so far is the parent's, garbled: if it ever turns out to be
      // a station of its own, its line starts clean
      if (a.ghostVotes >= 2) { if (!a.ghost) { a.text = ''; a.last = 0; } a.ghost = true; }
      else if (a.ghostVotes <= -2) a.ghost = false;
    }
  }

  /**
   * A line is shown once its recent text looks like CW copy. Noise that gets
   * past the decoder's gate (measured on air at 14022.9 kHz: "E I5 E H E @H,
   * E I5 IEUH I I E") is mostly one-letter "words" of the shortest codes;
   * real copy, even with a few split words, has longer ones.
   */
  static _shown(c) {
    const t = c.text.trim().slice(-80);
    if (t.replace(/ /g, '').length < 4) return false;
    const words = t.split(' ').filter(Boolean);
    const long = words.filter((w) => w.length >= 3).length;
    const tiny = words.filter((w) => w.length === 1 && 'EITSHN5'.includes(w)).length;
    const odd = (t.match(/[@?,$!\-]/g) || []).length;   // rare in real CW, common in noise copy
    // Letters made of dits only (E I S H 5): a wide data signal near
    // 14010.3 kHz printed "EIIISSE5IIESESE …" on several lines. Real copy
    // has few of them in a row.
    const ditRun = (t.match(/[EISH5]{4,}/g) || []).reduce((a, w) => a + w.length, 0);
    return long >= 1 && tiny <= 0.4 * words.length && odd <= 2 && ditRun <= 0.25 * t.replace(/ /g, '').length;
  }

  _emit() {
    // once shown, a line stays (until its station is dropped): a few noisy
    // letters must not make it blink in and out
    for (const c of this._channels) if (!c.shown && !c.ghost && c.ghostEvals >= 2 && CwBrowser._shown(c)) c.shown = true;
    const list = this._channels.filter((c) => c.shown && !c.ghost);
    if (this.onStatus && list.length !== this._lastCount) {
      this._lastCount = list.length;
      this.onStatus(`${list.length} signal${list.length === 1 ? '' : 's'}`);
    }
    if (!this.onUpdate) return;
    this.onUpdate(list.map((c) => {
      const { call, cq } = cwCallsign(c.text);
      // the speed of the station, frozen once its carrier is gone (the
      // estimator wanders on the noise that is left)
      const d = c.decoder;
      if (this._t - c.live <= CARRIER_HOLD_S && d.Td > 0) c.wpm = Math.round(1200 / (d.Td * d.frameMs));
      return { id: c.id, hz: Math.round(c.hz), wpm: c.wpm, text: c.text, call, cq, last: c.last };
    }));
  }
}

export default CwBrowser;
