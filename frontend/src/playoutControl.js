// ─────────────────────────────────────────────────────────────────────────────
// Playout control: how late audio arrives, and how much of it we hold.
//
// Two pieces, both used by audio.js on the AudioBufferSourceNode path that
// every remote listener lands on while the station is plain http.
//
// ArrivalMeter measures the link. Each packet's lateness is its arrival time
// minus its position in the stream (cumulative frames / sample rate). A link
// with no jitter gives a constant lateness; the spread of lateness over a
// window is exactly the cushion a listener needs to never run dry. Measuring
// against the stream timeline rather than packet-to-packet intervals is what
// makes a burst count properly: three packets arriving together after a stall
// show as one large spread, not as three small, cancelling interval errors.
// It also measures the drift between the server's sample clock and the
// listener's sound card, which slowly grows or shrinks any fixed cushion.
//
// CushionController removes the excess. The fallback scheduler only ever
// advances playTime by each chunk's own length, so whatever cushion a burst or
// a restart leaves behind stays for the rest of the session — the "x1 = 20 ms"
// preset meant anywhere up to bufferLimit + prebuffer in practice. The
// controller watches the smallest cushion seen at packet arrival over a
// window (60 s, doubling up to 10 min each time a trim is followed by an
// underrun). If even the worst moment in that window had spare cushion above the
// preset's margin, that spare is never used, and it is trimmed away a few
// milliseconds at a time with a pitch-matched splice (spliceOut below). The
// same splice run the other way (spliceIn) adds cushion when it falls below
// the margin without running dry — a fast sound card, or jitter wider than
// the cushion — so a slow shrink becomes a few inaudible ms, not a gap.
//
// Only the speaker copy is trimmed. Decoders tap the PCM before scheduling and
// recordings keep the untrimmed stream, so neither ever sees a splice.
// ─────────────────────────────────────────────────────────────────────────────

// Sliding window of {t, v} with min/max/avg, in whatever units the caller uses.
class Window {
  constructor(spanSec) { this.span = spanSec; this.t = []; this.v = [] }
  clear() { this.t.length = 0; this.v.length = 0 }
  push(t, v) {
    this.t.push(t); this.v.push(v)
    let drop = 0
    while (drop < this.t.length && t - this.t[drop] > this.span) drop++
    if (drop) { this.t.splice(0, drop); this.v.splice(0, drop) }
  }
  shift(d) { for (let i = 0; i < this.v.length; i++) this.v[i] += d }
  get length() { return this.v.length }
  // Seconds of history actually held, so "window full" can be tested.
  coverage() { return this.t.length > 1 ? this.t[this.t.length - 1] - this.t[0] : 0 }
  min() { let m = Infinity; for (const x of this.v) if (x < m) m = x; return m }
  max() { let m = -Infinity; for (const x of this.v) if (x > m) m = x; return m }
  avg() { let s = 0; for (const x of this.v) s += x; return this.v.length ? s / this.v.length : 0 }
}

export class ArrivalMeter {
  constructor(windowSec = 10) {
    this.win = new Window(windowSec)
    this.reset()
  }

  // Call on reconnect or codec switch: the stream timeline starts again.
  reset() {
    this.win.clear()
    this.mediaSec = 0          // stream time received so far
    this.t0 = null             // wall-clock seconds at the first packet
    this.worst = 0             // largest windowed spread seen this session
    // Drift: lateness on the AUDIO clock, one minimum per block. Minima are
    // immune to jitter (the earliest packet in a block is the one that was
    // not delayed), so their slope is the clock difference alone.
    this.blockSec = 10
    this.blockStart = null
    this.blockMin = Infinity
    this.firstMin = null       // {t, v}
    this.lastMin = null
  }

  // nowSec: performance.now()/1000 at arrival. ctxSec: audioCtx.currentTime,
  // or null while the context is not running. frames: stream frames carried.
  onPacket(nowSec, ctxSec, frames, sps) {
    if (!(frames > 0) || !(sps > 0)) return
    if (this.t0 === null) this.t0 = nowSec
    const lateness = (nowSec - this.t0) - this.mediaSec
    this.win.push(nowSec, lateness)
    if (this.win.coverage() >= this.win.span * 0.9) {
      const spread = this.win.max() - this.win.min()
      if (spread > this.worst) this.worst = spread
    }

    if (ctxSec !== null && Number.isFinite(ctxSec)) {
      const late = ctxSec - this.mediaSec
      if (this.blockStart === null) this.blockStart = ctxSec
      if (late < this.blockMin) this.blockMin = late
      if (ctxSec - this.blockStart >= this.blockSec) {
        const m = { t: ctxSec, v: this.blockMin }
        if (!this.firstMin) this.firstMin = m
        this.lastMin = m
        this.blockStart = ctxSec
        this.blockMin = Infinity
      }
    }
    this.mediaSec += frames / sps
  }

  // Current jitter: spread of lateness over the window, in seconds.
  jitter() { return this.win.length > 1 ? this.win.max() - this.win.min() : 0 }

  // Parts per million by which the listener's audio clock outruns the stream.
  // Positive: the sound card is fast, so a fixed cushion shrinks and ends in
  // an underrun. Negative: it is slow, so the cushion grows without bound.
  // Null until a minute of blocks exists — before that the figure is noise.
  driftPpm() {
    if (!this.firstMin || !this.lastMin) return null
    const dt = this.lastMin.t - this.firstMin.t
    if (dt < 60) return null
    return ((this.lastMin.v - this.firstMin.v) / dt) * 1e6
  }

  snapshot() {
    const d = this.driftPpm()
    return {
      jitterMs: this.jitter() * 1000,
      jitterWorstMs: this.worst * 1000,
      driftPpm: d === null ? null : Math.round(d),
      streamSec: this.mediaSec,
    }
  }
}

export class CushionController {
  constructor({ windowSec = 60, maxWindowSec = 600, fillEvidenceSec = 5, hysteresisSec = 0.010,
                maxTrimSec = 0.010, minTrimSec = 0.002, trimEverySec = 0.5,
                quietWaitSec = 2 } = {}) {
    this.win = new Window(windowSec)
    this.maxSpan = maxWindowSec
    this.fillEvidence = fillEvidenceSec
    this.hysteresis = hysteresisSec
    this.maxTrim = maxTrimSec
    this.minTrim = minTrimSec
    this.trimEvery = trimEverySec
    this.quietWait = quietWaitSec
    this.enabled = true
    this.trims = 0
    this.trimmedSec = 0
    this.fills = 0
    this.filledSec = 0
    this.reset()
  }

  // Call whenever the timeline jumps (restart after underrun, reconnect): the
  // history no longer describes the cushion we have now.
  reset() {
    this.win.clear()
    this.trimmedSinceReset = 0
    this.lastTrimAt = -Infinity
    this.pendingSince = null
    this.rmsAvg = 0
  }

  // The scheduler ran dry and restarted. If we had trimmed since the last
  // restart, the window was shorter than the gaps between this link's stalls:
  // the cushion we removed was the one that had been riding them out. Double
  // the window so the next drain waits longer for proof the cushion is spare.
  // A link that needs a big cushion ends up keeping it; one that stalled once
  // is drained after the window passes.
  onUnderrun() {
    if (this.trimmedSinceReset > 0) this.win.span = Math.min(this.win.span * 2, this.maxSpan)
    this.reset()
  }

  // The scheduler shed a whole chunk on overrun; the cushion is that much
  // smaller than the history says.
  onShed(sec) { if (sec > 0) this.win.shift(-sec) }

  // Cushion (playTime - currentTime) at packet arrival, BEFORE this chunk is
  // scheduled. Negative means an underrun.
  observe(nowSec, cushionSec) { this.win.push(nowSec, cushionSec) }

  // Spare cushion right now: how far the worst moment of the window stayed
  // above the margin. Zero until the window is full, so a fresh restart is
  // never trimmed on too little evidence.
  excess(marginSec) {
    if (this.win.coverage() < this.win.span * 0.95) return 0
    return Math.max(0, this.win.min() - marginSec - this.hysteresis)
  }

  // Missing cushion: how far the worst moment of the window fell below the
  // margin without running dry. This is what a sound card running fast does —
  // the cushion shrinks by a few ms a minute until it gaps — and what jitter
  // wider than the cushion does. Adding cushion costs latency, never quality,
  // so it needs far less evidence than removing it: a few seconds.
  deficit(marginSec) {
    if (this.win.coverage() < this.fillEvidence) return 0
    return Math.max(0, marginSec - this.win.min())
  }

  // Frames to adjust the chunk about to be scheduled by: positive = cut that
  // many (spliceOut), negative = stretch by that many (spliceIn), 0 = leave.
  // rms: level of that chunk; quiet chunks are preferred, so splices land in
  // speech pauses where they exist — but only for quietWait seconds, since a
  // steady carrier or a busy band never pauses.
  planAdjust(nowSec, marginSec, rms, sps) {
    this.rmsAvg = this.rmsAvg ? 0.98 * this.rmsAvg + 0.02 * rms : rms
    if (!this.enabled) return 0
    const ex = this.excess(marginSec)
    const def = ex > 0 ? 0 : this.deficit(marginSec)
    const want = ex >= this.minTrim ? ex : (def >= this.minTrim ? -def : 0)
    if (want === 0) { this.pendingSince = null; return 0 }
    if (this.pendingSince === null) this.pendingSince = nowSec
    if (nowSec - this.lastTrimAt < this.trimEvery) return 0
    const quiet = rms <= 0.5 * this.rmsAvg
    if (!quiet && nowSec - this.pendingSince < this.quietWait) return 0
    const sec = Math.sign(want) * Math.min(Math.abs(want), this.maxTrim)
    return Math.trunc(sec * sps)
  }

  // Record what was actually done: sec > 0 removed, sec < 0 added (the
  // splices may move less than asked).
  onAdjusted(nowSec, sec) {
    if (!sec) return
    this.lastTrimAt = nowSec
    if (sec > 0) {
      this.trims++
      this.trimmedSec += sec
      this.trimmedSinceReset += sec
    } else {
      this.fills++
      this.filledSec -= sec
    }
    // Every cushion in the window is now `sec` different from when it was seen.
    this.win.shift(-sec)
  }

  snapshot() {
    const n = this.win.length
    return {
      enabled: this.enabled,
      windowSec: this.win.span,
      cushionMinMs: n ? this.win.min() * 1000 : null,
      cushionAvgMs: n ? this.win.avg() * 1000 : null,
      cushionMaxMs: n ? this.win.max() * 1000 : null,
      trims: this.trims,
      trimmedMs: this.trimmedSec * 1000,
      fills: this.fills,
      filledMs: this.filledSec * 1000,
    }
  }
}

// RMS of a (possibly interleaved) block, for the quiet-chunk preference.
export function blockRms(pcm) {
  let s = 0
  for (let i = 0; i < pcm.length; i++) s += pcm[i] * pcm[i]
  return pcm.length ? Math.sqrt(s / pcm.length) : 0
}

// Best lag, between lo and hi frames, at which the waveform repeats itself:
// normalised cross-correlation of `fade` frames at `a` against `fade` frames
// at a + lag, on the mono mix. Ties go to the longer lag (same seam, more
// movement). Silence has no preferred lag and gets the longest.
function bestLag(pcm, ch, a, lo, hi, fade) {
  const mono = (i) => ch === 2 ? 0.5 * (pcm[2 * i] + pcm[2 * i + 1]) : pcm[i]
  let eA = 0
  for (let k = 0; k < fade; k++) { const x = mono(a + k); eA += x * x }
  let best = hi, bestScore = -Infinity
  if (eA <= 1e-12) return best
  for (let n = lo; n <= hi; n++) {
    let c = 0, eB = 0
    for (let k = 0; k < fade; k++) {
      const y = mono(a + n + k)
      c += mono(a + k) * y
      eB += y * y
    }
    const score = eB > 1e-12 ? c / Math.sqrt(eA * eB) : -1
    if (score > bestScore + 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && n > best)) {
      bestScore = score; best = n
    }
  }
  return best
}

// Raised-cosine weight for crossfade position k of `fade`.
const fadeW = (k, fade) => 0.5 - 0.5 * Math.cos(Math.PI * (k + 0.5) / fade)

// Remove up to `maxRemove` frames from one block, invisibly.
//
// A plain cut shifts the phase of every tone in the block, which is a click on
// a carrier and a rough edge on a voice. Instead we look for the lag, between
// minRemove and maxRemove frames, at which the waveform best repeats itself
// (a one-shot WSOLA), and cross-fade from the audio at the splice point to the
// audio one lag later. On a tone the chosen lag is a whole number of periods
// and the seam vanishes; on voice it follows the pitch; on noise any lag is as
// good as another and the crossfade hides it.
//
// pcm is mono, or interleaved stereo when channels === 2 (C-QUAM); both
// channels are cut at the same place. Returns { pcm, removed } with removed in
// frames; the input is not modified.
export function spliceOut(pcm, channels, maxRemove, minRemove = 24, fade = 64) {
  const ch = channels === 2 ? 2 : 1
  const N = Math.floor(pcm.length / ch)
  maxRemove = Math.floor(Math.min(maxRemove, N - fade - 2))
  if (maxRemove < minRemove || N < fade + maxRemove + 2) return { pcm, removed: 0 }

  // Splice in the middle of the block, away from both edges.
  const a = Math.floor((N - fade - maxRemove) / 2)
  const n = bestLag(pcm, ch, a, minRemove, maxRemove, fade)

  const out = new Float32Array((N - n) * ch)
  out.set(pcm.subarray(0, a * ch), 0)
  for (let k = 0; k < fade; k++) {
    const w = fadeW(k, fade)
    for (let c = 0; c < ch; c++) {
      out[(a + k) * ch + c] = (1 - w) * pcm[(a + k) * ch + c] + w * pcm[(a + n + k) * ch + c]
    }
  }
  out.set(pcm.subarray((a + n + fade) * ch), (a + fade) * ch)
  return { pcm: out, removed: n }
}

// The reverse: lengthen one block by up to `maxAdd` frames, by playing one
// repeat period twice. The output runs x[0 .. a+n+fade), then cross-fades
// from x[a+n ..] back to x[a ..] and continues from there to the end — so the
// stretch x[a .. a+n) is heard twice, joined where the waveform matches
// itself. Returns { pcm, added } in frames; the input is not modified.
export function spliceIn(pcm, channels, maxAdd, minAdd = 24, fade = 64) {
  const ch = channels === 2 ? 2 : 1
  const N = Math.floor(pcm.length / ch)
  maxAdd = Math.floor(Math.min(maxAdd, N - fade - 2))
  if (maxAdd < minAdd || N < fade + maxAdd + 2) return { pcm, added: 0 }

  const a = Math.floor((N - fade - maxAdd) / 2)
  const n = bestLag(pcm, ch, a, minAdd, maxAdd, fade)

  const out = new Float32Array((N + n) * ch)
  // x[0 .. a+n) as is.
  out.set(pcm.subarray(0, (a + n) * ch), 0)
  // Crossfade x[a+n .. a+n+fade) into x[a .. a+fade).
  for (let k = 0; k < fade; k++) {
    const w = fadeW(k, fade)
    for (let c = 0; c < ch; c++) {
      out[(a + n + k) * ch + c] = (1 - w) * pcm[(a + n + k) * ch + c] + w * pcm[(a + k) * ch + c]
    }
  }
  // Then x[a+fade .. N) — the repeat.
  out.set(pcm.subarray((a + fade) * ch), (a + n + fade) * ch)
  return { pcm: out, added: n }
}
