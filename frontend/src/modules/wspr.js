/**
 * wspr.js — WSPR-2 decoder for PhantomSDR-Plus
 *
 * This version pushes the browser decoder closer to the wsprd/Kiwi style:
 *  • overlapping 8192-pt Hann spectrogram at 12 kHz
 *  • candidate search over averaged amplitude spectrum
 *  • multi-hypothesis sync/timing/drift search
 *  • normalized soft symbols instead of raw tone differences only
 *  • list-Viterbi (multiple survivor paths) instead of a single hard best path
 *  • re-encode / symbol-match scoring before accepting a decode
 *  • two-pass subtraction and tighter duplicate suppression
 *
 * It is still a JavaScript/browser decoder, so it is not literally the same code
 * as Kiwi/wsprd. But these changes make it materially closer in behavior and
 * accuracy than the previous single-path beam decoder.
 */

import { fft } from 'fft-js';

export const WSPR_SR   = 12000;
export const WSPR_NFFT = 8192;
export const WSPR_HOP  = 4096;
export const WSPR_FPS  = 2;
export const WSPR_NSYM = 162;
export const WSPR_WIN_SEC    = WSPR_NFFT / WSPR_SR;
export const WSPR_SYMBOL_SEC = (2 * WSPR_HOP) / WSPR_SR;
export const WSPR_DT         = WSPR_WIN_SEC;
export const WSPR_DF         = WSPR_SR / WSPR_NFFT;
export const WSPR_TOTAL_SAMPLES = WSPR_NFFT + (WSPR_NSYM * WSPR_FPS - 1) * WSPR_HOP;

const WSPR_SYNC = new Uint8Array([
  1,1,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0,0,1,0,0,1,0,1,1,1,1,0,0,0,
  0,0,0,0,1,0,0,1,0,1,0,0,0,0,0,0,1,0,1,1,0,0,1,1,0,1,0,0,0,1,
  1,0,1,0,0,0,0,1,1,0,1,0,1,0,1,0,1,1,0,0,0,1,0,0,0,0,0,0,0,1,
  0,0,1,0,0,1,1,1,0,1,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,1,0,1,0,0,
  1,0,0,0,1,1,0,1,0,1,0,0,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,
  1,0,0,0,1,0,0,0,0,0,0,1
]);

const G1 = 0xF2D05351 >>> 0;
const G2 = 0xE4613C47 >>> 0;
const VALID_PWR = new Set([0,3,7,10,13,17,20,23,27,30,33,37,40,43,47,50,53,57,60]);
const DRIFTS = [-4,-3.5,-3,-2.5,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5,3,3.5,4];

const WSPR_PERM = (() => {
  const p = [];
  for (let i = 0; i < 256 && p.length < 162; i++) {
    let k = 0;
    for (let b = 0; b < 8; b++) k = (k << 1) | ((i >> b) & 1);
    if (k < 162) p.push(k);
  }
  return new Uint8Array(p);
})();

export async function decodeWSPR(pcm, sampleRate = WSPR_SR, dialFreqHz = 0) {
  const samples = (sampleRate !== WSPR_SR) ? _resample(pcm, sampleRate, WSPR_SR) : pcm;

  if (samples.length < WSPR_TOTAL_SAMPLES) {
    console.warn(`[WSPR] Only ${samples.length} samples, need ≥${WSPR_TOTAL_SAMPLES}`);
    return [];
  }

  const spectra = _buildSpectrogram(samples);
  console.log(`[WSPR] ${spectra.length} frames`);

  const { results: pass1, signals } = _decodePass(spectra, dialFreqHz, 'P1', []);

  const combined = [...pass1];
  const seen = new Set(combined.map(_dedupeKey));
  const decodedBins = signals.map(s => s.refined.freqBin);

  if (signals.length > 0) {
    const residual = spectra.map(f => new Float32Array(f));
    for (const sig of signals) _subtractSignal(residual, sig);
    const { results: pass2 } = _decodePass(residual, dialFreqHz, 'P2', decodedBins);
    for (const r of pass2) {
      const key = _dedupeKey(r);
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(r);
      }
    }
  }

  combined.sort((a, b) => (a.freq - b.freq) || (b.snr - a.snr));
  console.log(`[WSPR] Total decoded: ${combined.length}`);
  return combined;
}

function _dedupeKey(r) {
  return `${r.callsign}|${r.grid}|${Math.round(r.freq)}`;
}


function _interpBin(a, x) {
  const i = Math.floor(x);
  const f = x - i;
  if (i < 0 || i + 1 >= a.length) return 0;
  return a[i] * (1 - f) + a[i + 1] * f;
}

function _tonePowersAt(spectra, frame0, frame1, baseBin) {
  const a0 = spectra[frame0];
  const a1 = (frame1 >= 0 && frame1 < spectra.length) ? spectra[frame1] : a0;
  return [
    0.5 * (_interpBin(a0, baseBin)     + _interpBin(a1, baseBin)),
    0.5 * (_interpBin(a0, baseBin + 1) + _interpBin(a1, baseBin + 1)),
    0.5 * (_interpBin(a0, baseBin + 2) + _interpBin(a1, baseBin + 2)),
    0.5 * (_interpBin(a0, baseBin + 3) + _interpBin(a1, baseBin + 3)),
  ];
}

function _decodePass(spectra, dialFreqHz, label, excludedBins) {
  const candidates = _findCandidates(spectra);
  console.log(`[WSPR] ${label}: ${candidates.length} candidates`);

  const results = [];
  const signals = [];
  const seen = new Set();
  const syncLog = [];

  for (const cand of candidates) {
    if (excludedBins.some(eb => Math.abs(cand.freqBin - eb) < 4)) continue;

    const hyps = _collectSyncHypotheses(spectra, cand.freqBin, 8);
    if (syncLog.length < 5) {
      const best = hyps[0];
      syncLog.push(`bin${cand.freqBin}:snr${cand.snr.toFixed(1)}dB:sync${best ? best.sync.toFixed(3) : '<0.03'}`);
    }
    if (!hyps.length) continue;

    let bestPick = null;
    for (const refined of hyps) {
      const pick = _decodeHypothesis(spectra, refined, cand, dialFreqHz);
      if (!pick) continue;
      if (!bestPick || pick.totalScore > bestPick.totalScore) bestPick = pick;
    }
    if (!bestPick) continue;

    const msg = bestPick.msg;
    const key = `${msg.callsign}|${msg.grid}|${Math.round(bestPick.freq)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      ...msg,
      freq: +bestPick.freq.toFixed(0),
      snr: +cand.snr.toFixed(1),
      dt: +((bestPick.refined.startFrame * WSPR_HOP) / WSPR_SR).toFixed(1),
      drift: +bestPick.refined.driftHz.toFixed(2),
      sync: +bestPick.refined.sync.toFixed(3),
      confidence: +bestPick.totalScore.toFixed(2),
    });

    if (bestPick.symbols) signals.push({ refined: bestPick.refined, symbols: bestPick.symbols });
  }

  console.log(`[WSPR] ${label}: decoded=${results.length} top-sync: ${syncLog.join(' | ')}`);
  return { results, signals };
}

function _decodeHypothesis(spectra, refined, cand, dialFreqHz) {
  const llr = _softSymbolsNormalized(spectra, refined.startFrame, refined.fracBin ?? refined.freqBin, refined.driftHz);
  const paths = _viterbiList(llr, 2048, 20);
  let best = null;

  for (const path of paths) {
    const msg = _unpackWSPR(path.bits);
    if (!msg) continue;
    const symbols = _packMessage(msg);
    if (!symbols) continue;

    const match = _messageMatchScore(spectra, refined, symbols);
    if (match < 0.10) continue;

    const audioHz = (refined.fracBin ?? refined.freqBin) * WSPR_DF;
    const absHz = dialFreqHz ? (dialFreqHz + audioHz) : audioHz;
    const totalScore = path.metric + match * 25 + refined.sync * 18 + cand.snr * 0.15;

    if (!best || totalScore > best.totalScore) {
      best = { msg, symbols, refined, freq: absHz, totalScore };
    }
  }

  return best;
}

function _subtractSignal(spectra, sig) {
  const { refined, symbols } = sig;
  const halfN = WSPR_NFFT >> 1;
  const driftBins = refined.driftHz / WSPR_DF;
  const bBase = refined.fracBin ?? refined.freqBin;

  for (let k = 0; k < WSPR_NSYM; k++) {
    const binOff = ((k - 81) / 81) * driftBins / 2;
    const b = bBase + binOff;
    if (b < 1 || b + 4 >= halfN) continue;

    const tone = symbols[k];
    const sigBin = b + tone;

    for (const offset of [0, -1, 1]) {
      const frame = refined.startFrame + k * WSPR_FPS + offset;
      if (frame < 0 || frame >= spectra.length) continue;
      const a = spectra[frame];
      const p = [
        _interpBin(a, b),
        _interpBin(a, b + 1),
        _interpBin(a, b + 2),
        _interpBin(a, b + 3),
      ];
      const sig = _interpBin(a, sigBin);
      const total = p[0] + p[1] + p[2] + p[3];
      const noiseEst = Math.max(0, (total - sig) / 3);
      const sigAmp = Math.max(0, sig - noiseEst);

      const i0 = Math.floor(sigBin);
      const f = sigBin - i0;
      if (i0 >= 0 && i0 + 1 < a.length) {
        const leftShare = (1 - f) * sigAmp;
        const rightShare = f * sigAmp;
        a[i0] = Math.max(0, a[i0] - leftShare);
        a[i0 + 1] = Math.max(0, a[i0 + 1] - rightShare);
      }
    }
  }
}

function _packMessage(msg) {
  try {
    const A37 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
    const A27 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
    let c6 = msg.callsign.toUpperCase().trimEnd();
    if (c6.length < 3 || !/\d/.test(c6[2])) c6 = ' ' + c6;
    c6 = c6.padEnd(6, ' ').slice(0, 6);
    let N1 = A37.indexOf(c6[0]);
    if (N1 < 0 || A37.indexOf(c6[1]) < 0 || !/\d/.test(c6[2])) return null;
    N1 = N1 * 36 + A37.indexOf(c6[1]);
    N1 = N1 * 10 + parseInt(c6[2], 10);
    const i3 = A27.indexOf(c6[3]), i4 = A27.indexOf(c6[4]), i5 = A27.indexOf(c6[5]);
    if (i3 < 0 || i4 < 0 || i5 < 0) return null;
    N1 = N1 * 27 + i3;
    N1 = N1 * 27 + i4;
    N1 = N1 * 27 + i5;

    const g0 = msg.grid.charCodeAt(0) - 65, g1 = msg.grid.charCodeAt(1) - 65;
    const g2 = parseInt(msg.grid[2], 10), g3 = parseInt(msg.grid[3], 10);
    if (g0 < 0 || g0 > 17 || g1 < 0 || g1 > 17 || Number.isNaN(g2) || Number.isNaN(g3)) return null;

    // WSPR standard geographic encoding: ng = nlong_geo * 180 + nlat_geo
    // nlong_geo = 179 - (g0*10 + g2),  nlat_geo = g1*10 + g3
    // N2 = ng * 128 + (dBm + 64)
    const nlong_geo = 179 - g0 * 10 - g2;
    const nlat_geo  = g1 * 10 + g3;
    const N2 = (nlong_geo * 180 + nlat_geo) * 128 + msg.dbm + 64;

    const db = new Uint8Array(81);
    for (let i = 27; i >= 0; i--) db[27-i] = (N1 >> i) & 1;
    for (let i = 21; i >= 0; i--) db[28 + (21-i)] = (N2 >> i) & 1;

    const coded = new Uint8Array(162);
    let sr = 0;
    for (let j = 0; j < 81; j++) {
      sr = ((sr << 1) | db[j]) >>> 0;
      coded[2*j]   = _popcount32(sr & G1) & 1;
      coded[2*j+1] = _popcount32(sr & G2) & 1;
    }

    const ch = new Uint8Array(162);
    for (let i = 0; i < 162; i++) ch[WSPR_PERM[i]] = coded[i];
    const sym = new Uint8Array(162);
    for (let k = 0; k < 162; k++) sym[k] = 2 * ch[k] + WSPR_SYNC[k];
    return sym;
  } catch (_) {
    return null;
  }
}

function _buildSpectrogram(samples) {
  const N = WSPR_NFFT;
  const hop = WSPR_HOP;
  const halfN = N >> 1;
  const nFrames = Math.floor((samples.length - N) / hop) + 1;

  const hann = new Float32Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));

  const frame = new Array(N);
  for (let i = 0; i < N; i++) frame[i] = [0, 0];

  const spectra = new Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    const offset = f * hop;
    for (let i = 0; i < N; i++) {
      frame[i][0] = (offset + i < samples.length ? samples[offset + i] : 0) * hann[i];
      frame[i][1] = 0;
    }
    const spec = fft(frame);
    const amp = new Float32Array(halfN);
    for (let i = 0; i < halfN; i++) {
      const re = spec[i][0], im = spec[i][1];
      amp[i] = Math.sqrt(re * re + im * im);
    }
    spectra[f] = amp;
  }
  return spectra;
}

function _findCandidates(spectra) {
  const nFrames = spectra.length;
  const halfN = WSPR_NFFT >> 1;
  const binLow = Math.floor(1350 / WSPR_DF) - 90;
  const binHigh = Math.ceil(1650 / WSPR_DF) + 90;

  const psavg = new Float32Array(halfN);
  for (let f = 0; f < nFrames; f++) {
    const a = spectra[f];
    for (let i = 0; i < halfN; i++) psavg[i] += a[i];
  }

  const sm = new Float32Array(halfN);
  for (let i = 3; i < halfN - 3; i++) {
    sm[i] = (psavg[i-3]+psavg[i-2]+psavg[i-1]+psavg[i]+psavg[i+1]+psavg[i+2]+psavg[i+3]) / 7;
  }

  const sub = [];
  for (let i = Math.max(4, binLow); i <= Math.min(halfN - 5, binHigh); i++) sub.push(sm[i]);
  sub.sort((a, b) => a - b);
  const noiseFloor = sub[Math.floor(sub.length * 0.35)] || 1e-30;

  const raw = [];
  for (let i = Math.max(5, binLow + 1); i < Math.min(halfN - 6, binHigh - 1); i++) {
    if (sm[i] <= sm[i-1] || sm[i] < sm[i+1]) continue;
    if (sm[i] < 1.15 * noiseFloor) continue;
    const snr = 10 * Math.log10((sm[i] + 1e-30) / (noiseFloor + 1e-30));
    raw.push({ freqBin: i, snr, mag: sm[i] });
  }
  raw.sort((a, b) => b.mag - a.mag);

  const cands = [];
  for (const c of raw) {
    if (cands.some(x => Math.abs(x.freqBin - c.freqBin) <= 2)) continue;
    cands.push(c);
    if (cands.length >= 220) break;
  }
  return cands;
}

function _collectSyncHypotheses(spectra, freqBin, limit = 8) {
  const nFrames = spectra.length;
  const halfN = WSPR_NFFT >> 1;
  const maxStart = nFrames - WSPR_NSYM * WSPR_FPS;
  if (maxStart < 0) return [];

  const best = [];
  const maybeKeep = (entry) => {
    if (entry.sync < 0.03) return;
    const dupe = best.findIndex(e => Math.abs(e.startFrame - entry.startFrame) <= 1 && Math.abs(e.freqBin - entry.freqBin) <= 1 && Math.abs(e.driftHz - entry.driftHz) <= 0.6);
    if (dupe >= 0) {
      if (entry.sync > best[dupe].sync) best[dupe] = entry;
    } else if (best.length < limit) {
      best.push(entry);
    } else {
      let worst = 0;
      for (let i = 1; i < best.length; i++) if (best[i].sync < best[worst].sync) worst = i;
      if (entry.sync > best[worst].sync) best[worst] = entry;
    }
  };

  for (let binDelta = -2; binDelta <= 2; binDelta++) {
    const testBin = freqBin + binDelta;
    if (testBin < 0 || testBin + 3 >= halfN) continue;

    for (const driftHz of DRIFTS) {
      const driftBins = driftHz / WSPR_DF;
      for (let start = 0; start <= maxStart; start++) {
        let ss = 0, pow = 0, valid = 0;
        for (let k = 0; k < WSPR_NSYM; k++) {
          const frame0 = start + k * WSPR_FPS;
          const frame1 = frame0 + 1;
          if (frame0 >= nFrames) break;

          const binOff = ((k - 81) / 81) * driftBins / 2;
          const b = testBin + binOff;
          if (b < 0 || b + 3 >= halfN) continue;

          const [p0, p1, p2, p3] = _tonePowersAt(spectra, frame0, frame1, b);
          ss += (2 * WSPR_SYNC[k] - 1) * ((p1 + p3) - (p0 + p2));
          pow += p0 + p1 + p2 + p3;
          valid++;
        }
        if (valid < WSPR_NSYM * 0.85) continue;
        const sync = ss / (pow + 1e-30);
        maybeKeep({ startFrame: start, driftHz, freqBin: testBin, sync });
      }
    }
  }

  best.sort((a, b) => b.sync - a.sync);
  for (const h of best) h.fracBin = _refineFracBin(spectra, h);
  return best;
}

function _refineFracBin(spectra, hyp) {
  const { startFrame, driftHz, freqBin } = hyp;
  const nFrames = spectra.length;
  const halfN = WSPR_NFFT >> 1;
  if (freqBin <= 0 || freqBin + 4 >= halfN) return freqBin;
  const driftBins = driftHz / WSPR_DF;

  const syncAt = (b) => {
    let ss = 0, pow = 0;
    for (let k = 0; k < WSPR_NSYM; k++) {
      const frame0 = startFrame + k * WSPR_FPS;
      const frame1 = frame0 + 1;
      if (frame0 >= nFrames) break;
      const bo = ((k - 81) / 81) * driftBins / 2;
      const tb = b + bo;
      if (tb < 0 || tb + 3 >= halfN) continue;
      const [p0, p1, p2, p3] = _tonePowersAt(spectra, frame0, frame1, tb);
      ss += (2 * WSPR_SYNC[k] - 1) * ((p1 + p3) - (p0 + p2));
      pow += p0 + p1 + p2 + p3;
    }
    return pow > 0 ? ss / pow : 0;
  };

  const sL = syncAt(freqBin - 1);
  const sC = hyp.sync;
  const sR = syncAt(freqBin + 1);
  const denom = sL - 2 * sC + sR;
  if (Math.abs(denom) < 1e-10) return freqBin;
  return Math.max(freqBin - 1, Math.min(freqBin + 1, freqBin - 0.5 * (sR - sL) / denom));
}

function _softSymbolsNormalized(spectra, startFrame, freqBin, driftHz) {
  const halfN = WSPR_NFFT >> 1;
  const nFrames = spectra.length;
  const driftBins = driftHz / WSPR_DF;
  const raw = new Float32Array(WSPR_NSYM);

  // Collect raw soft symbols: p3-p1 (sync=1) or p2-p0 (sync=0)
  // This matches wsprd/Kiwi exactly — no per-symbol normalization yet.
  for (let k = 0; k < WSPR_NSYM; k++) {
    const frame0 = startFrame + k * WSPR_FPS;
    const frame1 = frame0 + 1;
    if (frame0 < 0 || frame0 >= nFrames) continue;

    const binOff = ((k - 81) / 81) * driftBins / 2;
    const b = freqBin + binOff;
    if (b < 0 || b + 3 >= halfN) continue;

    const [p0, p1, p2, p3] = _tonePowersAt(spectra, frame0, frame1, b);
    raw[k] = (WSPR_SYNC[k] === 1) ? (p3 - p1) : (p2 - p0);
  }

  // Global normalization: divide by standard deviation of all 162 raw values.
  // Kiwi/wsprd uses symfac=50 as the scale; we stay in float LLR space so we
  // just normalize to unit std-dev (Viterbi doesn't need the absolute scale).
  let sum = 0, sum2 = 0;
  for (let k = 0; k < WSPR_NSYM; k++) { sum += raw[k]; sum2 += raw[k] * raw[k]; }
  const mean = sum / WSPR_NSYM;
  const variance = sum2 / WSPR_NSYM - mean * mean;
  const fac = Math.sqrt(variance > 0 ? variance : 1e-12);

  const fsymb = new Float32Array(WSPR_NSYM);
  for (let k = 0; k < WSPR_NSYM; k++) fsymb[k] = raw[k] / fac;
  return fsymb;
}

function _viterbiList(llrRaw, beamWidth = 2048, keepPaths = 20) {
  const llr = new Float32Array(WSPR_NSYM);
  for (let i = 0; i < WSPR_NSYM; i++) llr[i] = llrRaw[WSPR_PERM[i]];

  const STEPS = 81;
  const BW = beamWidth;
  const MAX2 = BW * 2;

  const tbState = new Array(STEPS + 1).fill(null).map(() => new Int32Array(BW));
  const tbParent = new Array(STEPS + 1).fill(null).map(() => new Int32Array(BW));
  const tbBit = new Array(STEPS + 1).fill(null).map(() => new Uint8Array(BW));
  const tbMetric = new Array(STEPS + 1).fill(null).map(() => new Float64Array(BW));

  let curSize = 1;
  const cndS = new Int32Array(MAX2);
  const cndP = new Int32Array(MAX2);
  const cndB = new Uint8Array(MAX2);
  const cndM = new Float64Array(MAX2);

  for (let step = 0; step < STEPS; step++) {
    let nCnd = 0;
    for (let ci = 0; ci < curSize; ci++) {
      const state = tbState[step][ci];
      const metric = tbMetric[step][ci];
      for (let bit = 0; bit < 2; bit++) {
        const full = ((state << 1) | bit) >>> 0;
        const ns = full & 0x7FFFFFFF;
        const out1 = _popcount32(full & G1) & 1;
        const out2 = _popcount32(full & G2) & 1;
        const idx = nCnd++;
        cndS[idx] = ns;
        cndP[idx] = ci;
        cndB[idx] = bit;
        cndM[idx] = metric + (out1 ? llr[2*step] : -llr[2*step]) + (out2 ? llr[2*step+1] : -llr[2*step+1]);
      }
    }

    const ord = Array.from({ length: nCnd }, (_, i) => i).sort((a, b) => cndM[b] - cndM[a]);
    curSize = Math.min(BW, nCnd);
    const lvl = step + 1;
    for (let i = 0; i < curSize; i++) {
      const o = ord[i];
      tbState[lvl][i] = cndS[o];
      tbParent[lvl][i] = cndP[o];
      tbBit[lvl][i] = cndB[o];
      tbMetric[lvl][i] = cndM[o];
    }
  }

  const out = [];
  const nKeep = Math.min(keepPaths, curSize);
  for (let wi = 0; wi < nKeep; wi++) {
    const bits = new Uint8Array(STEPS);
    let p = wi;
    for (let s = STEPS - 1; s >= 0; s--) {
      bits[s] = tbBit[s + 1][p];
      p = tbParent[s + 1][p];
    }
    out.push({ bits, metric: tbMetric[STEPS][wi] });
  }
  return out;
}

function _messageMatchScore(spectra, refined, symbols) {
  const halfN = WSPR_NFFT >> 1;
  const driftBins = refined.driftHz / WSPR_DF;
  let sum = 0;
  let good = 0;
  const baseBin = refined.fracBin ?? refined.freqBin;

  for (let k = 0; k < WSPR_NSYM; k++) {
    const frame0 = refined.startFrame + k * WSPR_FPS;
    const frame1 = frame0 + 1;
    if (frame0 < 0 || frame0 >= spectra.length) continue;

    const binOff = ((k - 81) / 81) * driftBins / 2;
    const b = baseBin + binOff;
    if (b < 0 || b + 3 >= halfN) continue;

    const p = _tonePowersAt(spectra, frame0, frame1, b);
    const tone = symbols[k];
    const sig = p[tone];
    const noise = (p[0] + p[1] + p[2] + p[3] - sig) / 3;
    sum += (sig - noise) / (sig + noise + 1e-6);
    good++;
  }

  return good ? (sum / good) : -1;
}

function _popcount32(n) {
  n = n >>> 0;
  n -= (n >>> 1) & 0x55555555;
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0F0F0F0F;
  return Math.imul(n, 0x01010101) >>> 24;
}

function _unpackWSPR(bits) {
  let N1 = 0, N2 = 0;
  for (let i = 0; i < 28; i++) N1 = N1 * 2 + bits[i];
  for (let i = 28; i < 50; i++) N2 = N2 * 2 + bits[i];

  const A37 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  const A27 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  const cs = new Array(6);
  let n = N1;
  cs[5] = A27[n % 27]; n = Math.floor(n / 27);
  cs[4] = A27[n % 27]; n = Math.floor(n / 27);
  cs[3] = A27[n % 27]; n = Math.floor(n / 27);
  cs[2] = String(n % 10); n = Math.floor(n / 10);
  cs[1] = A37[n % 36]; n = Math.floor(n / 36);
  cs[0] = A37[n];
  if (n > 36) return null;

  const callsign = cs.join('').trim();
  if (callsign.length < 3 || callsign.length > 6) return null;
  if (/\s/.test(callsign)) return null;
  var _sPos = -1;
  if (/\d/.test(callsign[2] || '') && /^[A-Z]{1,4}$/.test(callsign.slice(3))) _sPos = 2;
  else if (/\d/.test(callsign[1] || '') && /^[A-Z]{1,4}$/.test(callsign.slice(2))) _sPos = 1;
  if (_sPos < 0) return null;
  var _pfx = callsign.slice(0, _sPos);
  if (!/^[A-Z]{1,2}$/.test(_pfx) && !/^[0-9][A-Z]$/.test(_pfx)) return null;

  // WSPR standard N2 encoding: N2 = ng*128 + (dBm+64)
  // The lower 7 bits are (dBm+64), the upper 15 bits are the geographic grid index.
  const pwr7  = N2 & 0x7f;          // lower 7 bits
  const ng    = N2 >> 7;            // upper 15 bits: geographic grid
  const ntype = pwr7 - 64;          // actual dBm; must be a valid WSPR power level

  if (ng > 32399) return null;
  if (!VALID_PWR.has(ntype)) return null;  // covers ntype < 0 (Type 3) too

  // Geographic grid: ng = nlong_geo * 180 + nlat_geo
  // where nlong_geo = 179 - (g0*10 + g2)  and  nlat_geo = g1*10 + g3
  const nlat_geo  = ng % 180;
  const nlong_geo = Math.floor(ng / 180);
  const nlong_idx = 179 - nlong_geo;   // = g0*10 + g2

  const g0 = Math.floor(nlong_idx / 10);
  const g2 = nlong_idx % 10;
  const g1 = Math.floor(nlat_geo / 10);
  const g3 = nlat_geo % 10;

  if (g0 > 17 || g1 > 17) return null;

  const FIELD = 'ABCDEFGHIJKLMNOPQR';
  const grid = FIELD[g0] + FIELD[g1] + g2 + g3;
  if (!/^[A-R]{2}\d{2}$/.test(grid)) return null;

  return { callsign, grid, dbm: ntype };
}

function _resample(pcm, fromSR, toSR) {
  if (fromSR === toSR) return pcm;

  const ratio = fromSR / toSR;
  const intRatio = Math.round(ratio);

  if (Number.isFinite(ratio) && Math.abs(ratio - intRatio) < 1e-9 && intRatio >= 2) {
    const tapsPerPhase = 24;
    const taps = tapsPerPhase * intRatio * 2 + 1;
    const center = Math.floor(taps / 2);
    const fc = 0.5 / intRatio;
    const coeffs = new Float64Array(taps);
    let sum = 0;

    for (let i = 0; i < taps; i++) {
      const n = i - center;
      const x = n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n);
      const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (taps - 1));
      const c = x * w;
      coeffs[i] = c;
      sum += c;
    }
    for (let i = 0; i < taps; i++) coeffs[i] /= sum;

    const outLen = Math.floor((pcm.length - 1) / intRatio);
    const out = new Float32Array(Math.max(0, outLen));
    for (let oi = 0; oi < out.length; oi++) {
      const centerIdx = oi * intRatio;
      let acc = 0;
      for (let j = 0; j < taps; j++) {
        const idx = centerIdx + j - center;
        if (idx >= 0 && idx < pcm.length) acc += pcm[idx] * coeffs[j];
      }
      out[oi] = acc;
    }
    return out;
  }

  const outLen = Math.floor(pcm.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, pcm.length - 1);
    out[i] = pcm[lo] * (1 - (pos - lo)) + pcm[hi] * (pos - lo);
  }
  return out;
}

export function wspr2SlotPosition() {
  const now = new Date();
  return (now.getUTCMinutes() % 2) * 60 + now.getUTCSeconds();
}

export function isWSPRSlotStart() {
  return wspr2SlotPosition() === 0;
}