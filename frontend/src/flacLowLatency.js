// ─────────────────────────────────────────────────────────────────────────────
// Low-latency FLAC decoder for the /audio stream.
//
// Why this exists: the WASM decoder (modules/phantomsdrdsp_bg.wasm, Audio with
// AudioCodec.Flac) runs its output through an internal resampler that works in
// fixed 1024-sample chunks. Measured on the live stream (420-sample packets,
// 2026-09-28): it returns nothing for the first 5 packets, then 1023 samples
// every 2–3 packets, holding back ~160 ms on average and up to 200 ms — more
// than the server FFT, the network and the playback cushion together. It does
// this even when asked for no rate change, so no parameter avoids it.
//
// This decodes each FLAC frame the moment its packet arrives (the server sets
// the FLAC block size to exactly one audio block, so one packet = one frame),
// and does the small 12016.3 → 12000 Hz rate correction with a polyphase
// windowed-sinc resampler whose delay is 32 samples (2.7 ms).
//
// Output is what the WASM decoder produced, so nothing downstream changes:
// Float32 at the output rate, mono or interleaved stereo, same scale.
//
// FLAC is lossless, so correctness is checkable to the sample: 20 s of the live
// stream decoded here matched ffmpeg with zero mismatches, and tones from 100
// Hz to 5 kHz through the resampler measure the same as through the WASM path
// (flat, error -82 to -92 dB — the floor of the 16-bit test signal).
// ─────────────────────────────────────────────────────────────────────────────

// ── Bit reader ───────────────────────────────────────────────────────────────
class Bits {
  constructor(buf, pos = 0) { this.b = buf; this.p = pos * 8 }
  need(n) { if (this.p + n > this.b.length * 8) throw SHORT }
  u(n) {                      // unsigned, n <= 32
    this.need(n)
    let v = 0
    while (n > 0) {
      const byte = this.b[this.p >> 3], off = this.p & 7
      const take = Math.min(8 - off, n)
      const bits = (byte >> (8 - off - take)) & ((1 << take) - 1)
      v = v * (1 << take) + bits
      this.p += take; n -= take
    }
    return v
  }
  s(n) {                      // signed two's complement, n <= 32
    const v = this.u(n)
    return n && v >= 2 ** (n - 1) ? v - 2 ** n : v
  }
  unary() {                   // count zeros up to the terminating 1
    let q = 0
    for (;;) {
      this.need(1)
      const byte = this.b[this.p >> 3], off = this.p & 7
      const rest = (byte << off) & 0xFF
      if (rest === 0) { q += 8 - off; this.p += 8 - off; continue }
      const z = Math.clz32(rest) - 24
      q += z; this.p += z + 1
      return q
    }
  }
  align() { this.p = (this.p + 7) & ~7 }
  get byte() { return this.p >> 3 }
}
const SHORT = new Error('flac: need more data')

// ── Frame decoding ───────────────────────────────────────────────────────────
const BLOCK = [0, 192, 576, 1152, 2304, 4608, -8, -16, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]
const DEPTH = [0, 8, 12, 0, 16, 20, 24, 32]

function readUtf8Number(r) {
  const x = r.u(8)
  let n = 0
  if (x < 0x80) return x
  else if (x >= 0xC0 && x < 0xE0) n = 1
  else if (x < 0xF0) n = 2
  else if (x < 0xF8) n = 3
  else if (x < 0xFC) n = 4
  else if (x < 0xFE) n = 5
  else n = 6
  let v = x & (0x3F >> n)
  for (let i = 0; i < n; i++) v = v * 64 + (r.u(8) & 0x3F)
  return v
}

function residual(r, out, order, blocksize) {
  const method = r.u(2)
  const pbits = method === 0 ? 4 : 5, escape = method === 0 ? 15 : 31
  const porder = r.u(4)
  const parts = 1 << porder
  let i = order
  for (let p = 0; p < parts; p++) {
    const n = (blocksize >> porder) - (p === 0 ? order : 0)
    const k = r.u(pbits)
    if (k === escape) {
      const raw = r.u(5)
      for (let j = 0; j < n; j++) out[i++] = raw ? r.s(raw) : 0
    } else {
      for (let j = 0; j < n; j++) {
        const v = r.unary() * (2 ** k) + (k ? r.u(k) : 0)
        out[i++] = (v % 2) ? -(v + 1) / 2 : v / 2
      }
    }
  }
}

function subframe(r, blocksize, bps) {
  if (r.u(1) !== 0) throw new Error('flac: bad subframe padding')
  const type = r.u(6)
  let wasted = 0
  if (r.u(1)) wasted = r.unary() + 1
  bps -= wasted
  const s = new Float64Array(blocksize)
  if (type === 0) {
    const v = r.s(bps); s.fill(v)
  } else if (type === 1) {
    for (let i = 0; i < blocksize; i++) s[i] = r.s(bps)
  } else if (type >= 8 && type <= 12) {
    const order = type - 8
    for (let i = 0; i < order; i++) s[i] = r.s(bps)
    residual(r, s, order, blocksize)
    for (let i = order; i < blocksize; i++) {
      switch (order) {
        case 1: s[i] += s[i - 1]; break
        case 2: s[i] += 2 * s[i - 1] - s[i - 2]; break
        case 3: s[i] += 3 * s[i - 1] - 3 * s[i - 2] + s[i - 3]; break
        case 4: s[i] += 4 * s[i - 1] - 6 * s[i - 2] + 4 * s[i - 3] - s[i - 4]; break
      }
    }
  } else if (type >= 32) {
    const order = type - 31
    for (let i = 0; i < order; i++) s[i] = r.s(bps)
    const prec = r.u(4) + 1
    const shift = r.s(5)
    const c = new Float64Array(order)
    for (let j = 0; j < order; j++) c[j] = r.s(prec)
    residual(r, s, order, blocksize)
    const div = 2 ** shift
    for (let i = order; i < blocksize; i++) {
      let sum = 0
      for (let j = 0; j < order; j++) sum += c[j] * s[i - j - 1]
      s[i] += Math.floor(sum / div)
    }
  } else {
    throw new Error('flac: reserved subframe type ' + type)
  }
  if (wasted) for (let i = 0; i < blocksize; i++) s[i] *= 2 ** wasted
  return s
}

// Decode one frame starting at byte `pos`. Returns { channels: Float64Array[],
// end } with integer sample values, or throws SHORT if the buffer ends early.
function frame(buf, pos, info) {
  const r = new Bits(buf, pos)
  if (r.u(14) !== 0x3FFE) throw new Error('flac: lost frame sync')
  r.u(1); r.u(1)
  const bcode = r.u(4), rcode = r.u(4), chan = r.u(4), dcode = r.u(3)
  r.u(1)
  readUtf8Number(r)
  let blocksize = BLOCK[bcode]
  if (blocksize === -8) blocksize = r.u(8) + 1
  else if (blocksize === -16) blocksize = r.u(16) + 1
  if (rcode === 12) r.u(8); else if (rcode === 13 || rcode === 14) r.u(16)
  r.u(8)                                    // header CRC-8
  const bps = dcode ? DEPTH[dcode] : info.bps
  const nch = chan < 8 ? chan + 1 : 2
  const ch = []
  for (let c = 0; c < nch; c++) {
    const side = (chan === 8 && c === 1) || (chan === 9 && c === 0) || (chan === 10 && c === 1)
    ch.push(subframe(r, blocksize, bps + (side ? 1 : 0)))
  }
  if (chan === 8) {                         // left / side
    for (let i = 0; i < blocksize; i++) ch[1][i] = ch[0][i] - ch[1][i]
  } else if (chan === 9) {                  // side / right
    for (let i = 0; i < blocksize; i++) ch[0][i] += ch[1][i]
  } else if (chan === 10) {                 // mid / side
    for (let i = 0; i < blocksize; i++) {
      const side = ch[1][i]
      const mid = ch[0][i] * 2 + (side % 2 !== 0 ? 1 : 0)
      ch[0][i] = (mid + side) / 2
      ch[1][i] = (mid - side) / 2
    }
  }
  r.align()
  r.u(16)                                   // frame CRC-16
  return { channels: ch, bps, end: r.byte }
}

// ── Resampler ────────────────────────────────────────────────────────────────
// Polyphase windowed sinc, state carried across blocks. 64 taps, so the delay
// is 32 input samples; Kaiser beta 9 keeps images and aliases below ~-90 dB.
// The ratio here is ~1.0014, so the cutoff sits at 0.47 of the input rate.
const TAPS = 64, PHASES = 256
function i0(x) {
  let s = 1, t = 1
  for (let k = 1; k < 50; k++) { t *= (x / (2 * k)) ** 2; s += t; if (t < 1e-16 * s) break }
  return s
}
function bank(cutoff, beta) {
  const b = new Float32Array((PHASES + 1) * TAPS), half = TAPS / 2, ib = i0(beta)
  for (let p = 0; p <= PHASES; p++) {
    const frac = p / PHASES
    let sum = 0
    for (let t = 0; t < TAPS; t++) {
      const x = (t - half + 1) - frac
      const s = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)
      const w = x / half
      const win = Math.abs(w) >= 1 ? 0 : i0(beta * Math.sqrt(1 - w * w)) / ib
      b[p * TAPS + t] = s * win; sum += s * win
    }
    for (let t = 0; t < TAPS; t++) b[p * TAPS + t] /= sum
  }
  return b
}

class Resampler {
  constructor(inRate, outRate, ch) {
    this.ratio = inRate / outRate; this.ch = ch
    this.bank = bank(0.5 * Math.min(1, outRate / inRate) * 0.94, 9)
    this.hist = new Float32Array(TAPS * ch)
    this.pos = TAPS / 2 - 1
  }
  process(x) {
    const ch = this.ch, H = TAPS, n = Math.floor(x.length / ch)
    if (!n) return new Float32Array(0)
    const total = H + n, last = n + H / 2 - 1
    const at = (j, c) => (j < H) ? this.hist[j * ch + c] : x[(j - H) * ch + c]
    let count = Math.floor((last - this.pos) / this.ratio) + 1
    if (count < 0) count = 0
    const out = new Float32Array(count * ch)
    let p = this.pos
    for (let k = 0; k < count; k++) {
      const j = Math.floor(p)
      // Interpolate linearly between the two nearest filter phases. Rounding to
      // the nearest one instead leaves an error that grows with frequency
      // (-50 dB at 5 kHz with 256 phases); interpolated, it stays near -90 dB.
      const fp = (p - j) * PHASES
      const pi = Math.min(PHASES - 1, fp | 0), fr = fp - pi
      const ph0 = pi * H, ph1 = (pi + 1) * H
      const base = j - H / 2 + 1
      for (let c = 0; c < ch; c++) {
        let a0 = 0, a1 = 0
        for (let t = 0; t < H; t++) {
          const v = at(Math.min(total - 1, Math.max(0, base + t)), c)
          a0 += this.bank[ph0 + t] * v
          a1 += this.bank[ph1 + t] * v
        }
        out[k * ch + c] = a0 + fr * (a1 - a0)
      }
      p += this.ratio
    }
    this.pos = p - n
    const keep = new Float32Array(H * ch)
    for (let i = 0; i < H; i++) for (let c = 0; c < ch; c++) keep[i * ch + c] = at(total - H + i, c)
    this.hist = keep
    return out
  }
}

// ── Public decoder ───────────────────────────────────────────────────────────
// Same surface audio.js uses on the WASM Audio object: decode(Uint8Array) →
// Float32Array, plus free(). `scale` maps full-scale integer samples to the
// level the WASM decoder produced.
export class FlacLowLatencyDecoder {
  constructor(inputRate, outputRate, scale = 1) {
    this.inRate = inputRate; this.outRate = outputRate; this.scale = scale
    this.buf = new Uint8Array(0)
    this.inHeader = true
    this.info = { bps: 16, channels: 1 }
    this.rs = null; this.rsCh = 0
  }

  _append(bytes) {
    if (!this.buf.length) { this.buf = bytes.slice(); return }
    const b = new Uint8Array(this.buf.length + bytes.length)
    b.set(this.buf); b.set(bytes, this.buf.length); this.buf = b
  }

  // Skip "fLaC" and the metadata blocks, reading bits-per-sample from
  // STREAMINFO. Returns false while they are still incomplete.
  _header() {
    const b = this.buf
    if (b.length < 4) return false
    let p = 4
    for (;;) {
      if (b.length < p + 4) return false
      const last = b[p] & 0x80, type = b[p] & 0x7F
      const len = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]
      if (b.length < p + 4 + len) return false
      if (type === 0) {
        const r = new Bits(b, p + 4 + 10)
        r.u(20)
        this.info.channels = r.u(3) + 1
        this.info.bps = r.u(5) + 1
      }
      p += 4 + len
      if (last) break
    }
    this.buf = b.slice(p)
    this.inHeader = false
    return true
  }

  decode(bytes) {
    this._append(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    if (this.inHeader && !this._header()) return new Float32Array(0)
    const parts = []
    let pos = 0
    while (pos < this.buf.length) {
      // Resynchronise on a frame sync code if the stream ever arrives torn.
      if (!(this.buf[pos] === 0xFF && (this.buf[pos + 1] & 0xFE) === 0xF8)) {
        if (pos + 1 >= this.buf.length) break
        pos++; continue
      }
      let f
      try { f = frame(this.buf, pos, this.info) }
      catch (e) { if (e === SHORT) break; pos++; continue }
      pos = f.end
      parts.push(f)
    }
    this.buf = this.buf.slice(pos)
    if (!parts.length) return new Float32Array(0)

    const nch = parts[0].channels.length
    let frames = 0
    for (const f of parts) frames += f.channels[0].length
    const pcm = new Float32Array(frames * nch)
    let o = 0
    for (const f of parts) {
      const k = this.scale / 2 ** (f.bps - 1)
      const n = f.channels[0].length
      for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) pcm[o++] = f.channels[c][i] * k
    }
    if (this.inRate === this.outRate) return pcm
    if (!this.rs || this.rsCh !== nch) { this.rs = new Resampler(this.inRate, this.outRate, nch); this.rsCh = nch }
    return this.rs.process(pcm)
  }

  free() { this.buf = new Uint8Array(0); this.rs = null }
}

// Exposed for the offline test only.
export const _test = { frame, Resampler }
