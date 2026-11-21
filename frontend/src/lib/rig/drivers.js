// CAT drivers for the rigs a browser can talk to directly over USB serial.
// Ported from Desktop PhantomSDR+ (src/rig/drivers/*.js); every driver
// speaks Hamlib's mode names (USB, LSB, CW, CWR, AM, FM, WFM, RTTY, RTTYR,
// PKTUSB, PKTLSB, PKTFM, SAM, DSB) and reads { hz, mode, bw, ptt }.
//
// One difference from Desktop, on Icom rigs: a filter width from the page
// only SELECTS the nearest of FIL1/FIL2/FIL3 (CI-V 06 <mode> <fil>), it never
// writes a width (1A 03). Writing a width changes the width stored in the
// rig's selected filter, which scrambled the IC-7300's FIL1/2/3 settings in
// September 2026 (see tci-bridge/tci-rigctld.mjs).
//
// Power: every driver has powerOn(baudRate) / powerOff() and a canPowerOn
// flag. A rig that is off does not answer, so powerOn only sends (with the
// wake-up its family needs) and serialRig.js then waits for the rig to answer.
// The rig must still have its DC supply; only its front-panel power is off.

import { Link, terminatedFramer, ascii, text, indexOfSeq, startsWithBytes } from "./link.js";

// ── BCD helpers (old Yaesu and Icom) ──────────────────────────────────────

export function toBcd(value, digits) {
  const t = String(value).padStart(digits, "0").slice(-digits);
  const bytes = [];
  for (let i = 0; i < digits; i += 2) bytes.push(parseInt(t.slice(i, i + 2), 16));
  return bytes;
}

export function fromBcd(bytes) {
  let t = "";
  for (const b of bytes) t += b.toString(16).padStart(2, "0");
  return parseInt(t, 10);
}

// ── Icom CI-V (and Xiegu G90/X6100 in CI-V mode) ──────────────────────────
//
//   FE FE <to> <from> <command> [<sub>] [<data>] FD
//
// This end is controller address E0. With "CI-V USB Echo Back" on, every
// frame we send comes straight back, so only frames addressed *to* E0 *from*
// the rig are taken as replies. Transceive frames go to 00 and are ignored
// the same way; the poll reads the state anyway.

const CONTROLLER = 0xe0;
const ICOM_MODE_FROM_CODE = { 0x00: "LSB", 0x01: "USB", 0x02: "AM", 0x03: "CW", 0x04: "RTTY", 0x05: "FM", 0x06: "WFM", 0x07: "CWR", 0x08: "RTTYR", 0x11: "SAM", 0x17: "FM", 0x22: "FM" };
const ICOM_CODE_FROM_MODE = { LSB: 0x00, USB: 0x01, AM: 0x02, CW: 0x03, RTTY: 0x04, FM: 0x05, WFM: 0x06, CWR: 0x07, RTTYR: 0x08, PKTUSB: 0x01, PKTLSB: 0x00, PKTFM: 0x05, SAM: 0x02, DSB: 0x02 };
const PREAMBLE = new Uint8Array([0xfe, 0xfe]);

export function civFramer(buffer) {
  const frames = [];
  let i = 0;
  let consumed = 0;
  while (i < buffer.length) {
    // Resynchronise on the FE FE preamble; anything before it is noise.
    const start = indexOfSeq(buffer, PREAMBLE, i);
    if (start === -1) {
      consumed = Math.max(consumed, buffer.length - 1);
      break;
    }
    let p = start;
    while (p < buffer.length && buffer[p] === 0xfe) p++;
    const end = buffer.indexOf(0xfd, p);
    if (end === -1) {
      consumed = start;
      break;
    }
    frames.push(buffer.subarray(p, end)); // to, from, command, data...
    i = end + 1;
    consumed = i;
  }
  return { frames, rest: buffer.subarray(consumed) };
}

// IF filter width (1A 03) is an index, not Hertz. SSB, CW and RTTY go
// 50..500 Hz in 50 Hz steps, then 600..3600 in 100 Hz steps; AM goes
// 200..10000 in 200 Hz steps. FM filters are fixed.
export function indexToHz(index, mode) {
  if (mode === "AM" || mode === "SAM") return (index + 1) * 200;
  return index <= 9 ? (index + 1) * 50 : (index - 4) * 100;
}

// Reference widths of FIL1/FIL2/FIL3 per mode, for picking the nearest one.
// SSB comes from the panel (the rig's own menu decides it); the rest are the
// IC-7300's factory values.
function icomFilterPlan(mode, ssbWidths) {
  const voice = String(mode || "").replace(/^PKT/, "");
  const plans = {
    LSB: [0x00, ssbWidths], USB: [0x01, ssbWidths],
    AM: [0x02, [9000, 6000, 3000]], CW: [0x03, [1200, 500, 250]],
    RTTY: [0x04, [2400, 500, 250]], FM: [0x05, [15000, 10000, 7000]],
    CWR: [0x07, [1200, 500, 250]], RTTYR: [0x08, [2400, 500, 250]],
  };
  const plan = plans[voice];
  return plan ? { byte: plan[0], widths: plan[1], data: voice !== mode } : null;
}

// ── Icom spectrum scope over CI-V (27 00) ─────────────────────────────────
// After 27 10 01 (scope on) and 27 11 01 (data output on) the rig streams its
// scope as unsolicited 27 00 frames (Hamlib icom.c icom_parse_spectrum_frame):
//   27 00 <main 00 / sub 01> <division, BCD> <divisions, BCD> ...
// Division 1 carries the scope mode (00 center, 01 fixed, 02 scroll-C,
// 03 scroll-F), two 5-byte little-endian BCD frequencies and an out-of-range
// byte; in center mode they are the centre and the HALF span, otherwise the
// low and high edge (a high nibble F in the last byte = negative). The other
// divisions carry 50 level bytes each, 0..160, low frequency first.

const SCOPE_LEVEL_MAX = 160;

function bcdLE(bytes) {
  return fromBcd([...bytes].reverse());
}

function edgeHz(bytes) {
  const b = [...bytes];
  if ((b[4] & 0xf0) !== 0xf0) return bcdLE(b);
  b[4] &= 0x0f;
  return -bcdLE(b);
}

export class IcomScopeParser {
  constructor(onLine) {
    this.onLine = onLine;
    this.head = null;
    this.parts = [];
  }

  /** frame: [to, from, cmd, sub, ...] as civFramer cuts it. */
  feed(frame) {
    if (frame.length < 7 || frame[2] !== 0x27 || frame[3] !== 0x00) return false;
    const d = frame.subarray(4);
    if (d[0] !== 0x00) return true; // the sub scope (IC-7610/9700/7760): main only
    const division = fromBcd([d[1]]);
    const divisions = fromBcd([d[2]]);
    if (division === 1) {
      if (d.length < 15) return true;
      const mode = d[3];
      let lo, hi;
      if (mode === 0x00) {
        const centre = bcdLE(d.subarray(4, 9));
        const half = bcdLE(d.subarray(9, 14));
        lo = centre - half;
        hi = centre + half;
      } else {
        lo = edgeHz(d.subarray(4, 9));
        hi = edgeHz(d.subarray(9, 14));
      }
      this.head = { mode, lo, hi, outOfRange: d[14] !== 0 };
      this.parts = d.length > 15 ? [d.slice(15)] : [];
    } else if (this.head) {
      this.parts.push(d.slice(3));
    }
    if (this.head && division === divisions) {
      const n = this.parts.reduce((a, p) => a + p.length, 0);
      const levels = new Uint8Array(n);
      let o = 0;
      for (const p of this.parts) {
        levels.set(p, o);
        o += p.length;
      }
      const h = this.head;
      this.head = null;
      this.parts = [];
      if (n > 0 && h.hi > h.lo) {
        this.onLine({ lo: h.lo, hi: h.hi, mode: h.mode, outOfRange: h.outOfRange, levels, max: SCOPE_LEVEL_MAX });
      }
    }
    return true;
  }
}

export class IcomDriver {
  /** @param {object} options { address, ssbWidths: [FIL1, FIL2, FIL3] } */
  constructor(transport, options = {}) {
    this.link = new Link(transport, civFramer);
    this.address = Number(options.address) & 0xff;
    this.ssbWidths = options.ssbWidths || [2700, 2400, 1800];
    this.canPowerOn = true;
    this.resolutionHz = 1;
    this.hasBandwidth = true;
    this.hasDataMode = true;
    this.hasPtt = true;
    // S-meter (15 02): read only while someone shows it (the rig scope strip),
    // so the poll stays as short as before otherwise.
    this.wantMeter = false;
    this.hasMeter = true;
    this.lastMode = null;
  }

  get caps() {
    return { bandwidth: this.hasBandwidth, ptt: this.hasPtt };
  }

  _frame(command, data = []) {
    return new Uint8Array([0xfe, 0xfe, this.address, CONTROLLER, ...command, ...data, 0xfd]);
  }

  /** Exchange and return the reply's data bytes, after the echoed command. */
  async _ask(command, data = [], timeoutMs = 800) {
    const reply = await this.link.exchange(this._frame(command, data), {
      timeoutMs,
      accept: (frame) =>
        frame.length >= 3 &&
        frame[0] === CONTROLLER &&
        frame[1] === this.address &&
        (frame[2] === 0xfa || startsWithBytes(frame, command, 2)),
    });
    if (reply[2] === 0xfa) throw new Error("The rig rejected the command");
    return reply.subarray(2 + command.length);
  }

  /** A set command: the rig answers FB (good) or FA (no good). */
  async _set(command, data) {
    const reply = await this.link.exchange(this._frame(command, data), {
      timeoutMs: 800,
      accept: (frame) =>
        frame.length >= 3 && frame[0] === CONTROLLER && frame[1] === this.address &&
        (frame[2] === 0xfb || frame[2] === 0xfa),
    });
    if (reply[2] === 0xfa) throw new Error("The rig rejected the command");
  }

  async open() {
    await this.read();
  }

  async read() {
    const freq = await this._ask([0x03]);
    // Little-endian BCD pairs, least significant first: 5 bytes on anything
    // current, 4 on some older rigs.
    const hz = fromBcd([...freq].reverse());

    const modeData = await this._ask([0x04]);
    let mode = ICOM_MODE_FROM_CODE[modeData[0]] || null;

    if (this.hasDataMode && (mode === "USB" || mode === "LSB" || mode === "FM")) {
      try {
        const data = await this._ask([0x1a, 0x06], [], 500);
        if (data[0]) mode = mode === "USB" ? "PKTUSB" : mode === "LSB" ? "PKTLSB" : "PKTFM";
      } catch {
        this.hasDataMode = false;
      }
    }
    this.lastMode = mode;

    const state = { hz, mode, bw: null, ptt: null };

    if (this.hasBandwidth && mode !== "FM" && mode !== "WFM" && mode !== "PKTFM") {
      try {
        const bw = await this._ask([0x1a, 0x03], [], 500);
        state.bw = indexToHz(fromBcd([bw[0]]), mode);
      } catch {
        this.hasBandwidth = false;
      }
    }

    if (this.hasPtt) {
      try {
        const tx = await this._ask([0x1c, 0x00], [], 500);
        state.ptt = tx[0] === 0x01;
      } catch {
        this.hasPtt = false;
      }
    }

    if (this.wantMeter && this.hasMeter) {
      try {
        // Two BCD bytes, 0000-0255: 0 = S0, 120 = S9, 241 = S9+60 dB.
        const m = await this._ask([0x15, 0x02], [], 500);
        if (m.length >= 2) state.smeter = fromBcd([m[0], m[1]]);
      } catch {
        this.hasMeter = false;
      }
    }
    return state;
  }

  setFrequency(hz) {
    const digits = toBcd(Math.round(hz), 10).reverse();
    return this._set([0x05], digits);
  }

  async setMode(mode) {
    const code = ICOM_CODE_FROM_MODE[mode];
    if (code === undefined) return;
    // No filter byte: the rig keeps whichever of FIL1-3 it had.
    await this._set([0x06], [code]);
    this.lastMode = mode;
    if (this.hasDataMode && /^PKT/.test(mode)) {
      await this._set([0x1a, 0x06], [0x01, 0x01]).catch(() => {});
    } else if (this.hasDataMode && (mode === "USB" || mode === "LSB" || mode === "FM")) {
      await this._set([0x1a, 0x06], [0x00, 0x00]).catch(() => {});
    }
  }

  // A run of FE bytes (the CI-V preamble) sized to the baud rate, as Hamlib
  // (icom.c) sends it. A sleeping rig needs it before 18 01, and a rig whose
  // CI-V USB Baud Rate is "Auto" detects a new speed from it: without it the
  // first question at a new rate goes unanswered.
  async wake(baudRate) {
    const b = Number(baudRate) || 19200;
    const count = b >= 115200 ? 150 : b >= 57600 ? 75 : b >= 38400 ? 50 : b >= 19200 ? 25 : b >= 9600 ? 13 : 7;
    await this.link.send(new Uint8Array(count).fill(0xfe), 50);
  }

  async powerOn(baudRate) {
    await this.wake(baudRate);
    await this.link.send(this._frame([0x18], [0x01]), 100);
  }

  async powerOff() {
    await this.link.send(this._frame([0x18], [0x00]), 200);
  }

  /** Start the scope stream; every finished sweep goes to onLine. */
  async scopeOn(onLine) {
    if (!this.scopeParser) {
      this.scopeParser = new IcomScopeParser((line) => this.scopeOnLine && this.scopeOnLine(line));
      this.link.onFrame((frame) => {
        if (frame.length >= 2 && frame[1] === this.address) this.scopeParser.feed(frame);
      });
    }
    this.scopeOnLine = onLine;
    await this._set([0x27, 0x10], [0x01]); // the scope itself on
    await this._set([0x27, 0x11], [0x01]); // its data out over CI-V
  }

  /** Stop the stream (the rig's own scope display stays as it was). */
  async scopeOff() {
    this.scopeOnLine = null;
    await this._set([0x27, 0x11], [0x00]).catch(() => {});
  }

  /** Select the FIL nearest to `hz`; returns "FIL<n>" or null. */
  async setBandwidth(hz, mode) {
    const plan = icomFilterPlan(mode || this.lastMode, this.ssbWidths);
    if (!plan || !(hz > 0)) return null;
    let best = 0;
    plan.widths.forEach((w, i) => {
      if (Math.abs(w - hz) < Math.abs(plan.widths[best] - hz)) best = i;
    });
    const fil = best + 1;
    // Select only: 06 <mode> <filter>, or in a data mode 1A 06 01 <filter>.
    if (plan.data) await this._set([0x1a, 0x06], [0x01, fil]).catch(() => {});
    else await this._set([0x06], [plan.byte, fil]).catch(() => {});
    return `FIL${fil}`;
  }

  close() {
    return this.link.close();
  }
}

// ── Yaesu "new CAT" (ASCII, ';'-terminated) ───────────────────────────────
// FT-991/A, FT-891, FT-710, FTDX10, FTDX101D/MP, FTDX3000/5000/1200, FT-950,
// FT-2000, FT-450D. The FA width is nine digits on newer rigs and eight on
// older ones, so it is learned from the rig's own reply.

const YAESU_MODE_FROM_CODE = {
  1: "LSB", 2: "USB", 3: "CW", 4: "FM", 5: "AM", 6: "RTTY", 7: "CWR", 8: "PKTLSB",
  9: "RTTYR", A: "PKTFM", B: "FM", C: "PKTUSB", D: "AM", E: "PKTUSB", F: "PKTFM",
};
const YAESU_CODE_FROM_MODE = {
  LSB: "1", USB: "2", CW: "3", FM: "4", AM: "5", RTTY: "6", CWR: "7", PKTLSB: "8",
  RTTYR: "9", PKTFM: "A", PKTUSB: "C", SAM: "5", DSB: "5",
};

async function askAscii(link, command, prefix, timeoutMs = 800) {
  const reply = await link.exchange(ascii(command), {
    timeoutMs,
    accept: (frame) => {
      const t = text(frame);
      return t.startsWith(prefix) || t === "?;";
    },
  });
  const t = text(reply);
  if (t === "?;") throw new Error(`The rig rejected ${command}`);
  return t;
}

// SM0 reading (0-255) to dB over S9: Hamlib's FT-710 table (rigs/yaesu/
// ft710.h FT710_STR_CAL); the other new-CAT Yaesus are close to it. Checked
// against a real FT-710 in Desktop PhantomSDR+: within about 0.5 dB.
const YAESU_STR_CAL = [
  [0, -54], [12, -48], [27, -42], [40, -36], [55, -30], [65, -24], [80, -18], [95, -12],
  [112, -6], [130, 0], [150, 10], [172, 20], [190, 30], [220, 40], [240, 50], [255, 60],
];

/** Yaesu SM0 0-255 to the strip's meter scale (Icom's: 0 = S0, 120 = S9, 241 = S9+60). */
export function yaesuMeterRaw(sm) {
  const raw = Math.max(0, Math.min(255, sm));
  let db = 60;
  for (let i = 1; i < YAESU_STR_CAL.length; i++) {
    const [r1, d1] = YAESU_STR_CAL[i];
    if (raw <= r1) {
      const [r0, d0] = YAESU_STR_CAL[i - 1];
      db = d0 + ((raw - r0) * (d1 - d0)) / (r1 - r0);
      break;
    }
  }
  return Math.round(db <= 0 ? Math.max(0, ((db + 54) / 54) * 120) : 120 + (Math.min(60, db) / 60) * 121);
}

export class YaesuDriver {
  constructor(transport) {
    this.link = new Link(transport, terminatedFramer(";"));
    // The S-meter is read only while the rig strip shows it (serialRig.js).
    this.wantMeter = false;
    this.hasMeter = true;
    this.freqDigits = 9;
    this.resolutionHz = 1;
    this.hasPtt = true;
    this.canPowerOn = true;
  }

  // The first command only wakes the CAT port; PS1 has to follow within a
  // second (Yaesu CAT manuals, Hamlib newcat.c).
  async powerOn() {
    await this.link.send(ascii("PS1;"), 500);
    await this.link.send(ascii("PS1;"), 100);
  }

  async powerOff() {
    await this.link.send(ascii("PS0;"), 200);
  }

  get caps() {
    return { bandwidth: false, ptt: this.hasPtt };
  }

  async open() {
    await this.read();
  }

  async read() {
    const fa = await askAscii(this.link, "FA;", "FA");
    const digits = fa.slice(2, -1);
    if (/^\d{8,9}$/.test(digits)) this.freqDigits = digits.length;
    const md = await askAscii(this.link, "MD0;", "MD");
    const state = {
      hz: parseInt(digits, 10),
      mode: YAESU_MODE_FROM_CODE[md.slice(3, 4).toUpperCase()] || null,
      bw: null,
      ptt: null,
    };
    if (this.hasPtt) {
      try {
        const tx = await askAscii(this.link, "TX;", "TX", 500);
        state.ptt = tx[2] === "1" || tx[2] === "2";
      } catch {
        this.hasPtt = false;
      }
    }
    // One more exchange per poll, only while the strip is open; a rig that
    // rejects SM0 has no meter over CAT.
    if (this.wantMeter && this.hasMeter && !state.ptt) {
      try {
        const sm = await askAscii(this.link, "SM0;", "SM", 500);
        const raw = parseInt(sm.slice(3, -1), 10);
        if (Number.isFinite(raw)) state.smeter = yaesuMeterRaw(raw);
      } catch (e) {
        if (/rejected/i.test(e.message)) this.hasMeter = false;
      }
    }
    return state;
  }

  setFrequency(hz) {
    const t = String(Math.round(hz)).padStart(this.freqDigits, "0");
    return this.link.send(ascii(`FA${t};`));
  }

  setMode(mode) {
    const code = YAESU_CODE_FROM_MODE[mode];
    if (!code) return Promise.resolve();
    return this.link.send(ascii(`MD0${code};`), 80);
  }

  setBandwidth() {
    return Promise.resolve(null);
  }

  close() {
    return this.link.close();
  }
}

// ── Old five-byte binary Yaesu CAT: FT-817/818, FT-857, FT-897 ────────────
// Replies have no framing at all, just a known number of bytes, so the
// receive buffer is flushed before each question. 10 Hz resolution.

const LEGACY_MODE_FROM_CODE = { 0x00: "LSB", 0x01: "USB", 0x02: "CW", 0x03: "CWR", 0x04: "AM", 0x06: "WFM", 0x08: "FM", 0x0a: "PKTUSB", 0x0c: "PKTFM", 0x88: "FM" };
const LEGACY_CODE_FROM_MODE = { LSB: 0x00, USB: 0x01, CW: 0x02, CWR: 0x03, AM: 0x04, WFM: 0x06, FM: 0x08, PKTUSB: 0x0a, PKTLSB: 0x0a, RTTY: 0x0a, RTTYR: 0x0a, PKTFM: 0x0c, SAM: 0x04, DSB: 0x04 };

export class YaesuLegacyDriver {
  constructor(transport) {
    this.link = new Link(transport, null);
    this.resolutionHz = 10;
    this.hasPtt = true;
    this.canPowerOn = true;
  }

  // Dummy bytes wake the CAT port, then opcode 0F; 8F switches off (Hamlib ft817.c).
  async powerOn() {
    await this.link.send(new Uint8Array([0, 0, 0, 0, 0]), 100);
    await this.link.send(new Uint8Array([0, 0, 0, 0, 0x0f]), 100);
  }

  async powerOff() {
    await this.link.send(new Uint8Array([0, 0, 0, 0, 0x8f]), 200);
  }

  get caps() {
    return { bandwidth: false, ptt: this.hasPtt };
  }

  async open() {
    await this.read();
  }

  async read() {
    const reply = await this.link.exchange(new Uint8Array([0, 0, 0, 0, 0x03]), { bytes: 5, flush: true, timeoutMs: 800 });
    const state = {
      hz: fromBcd(reply.subarray(0, 4)) * 10,
      mode: LEGACY_MODE_FROM_CODE[reply[4]] || null,
      bw: null,
      ptt: null,
    };
    if (this.hasPtt) {
      try {
        const tx = await this.link.exchange(new Uint8Array([0, 0, 0, 0, 0xf7]), { bytes: 1, flush: true, timeoutMs: 500 });
        // Bit 7 is PTT, active low (Hamlib ft817.c).
        state.ptt = (tx[0] & 0x80) === 0;
      } catch {
        this.hasPtt = false;
      }
    }
    return state;
  }

  setFrequency(hz) {
    const tens = Math.round(hz / 10);
    return this.link.send(new Uint8Array([...toBcd(tens, 8), 0x01]), 60);
  }

  setMode(mode) {
    const code = LEGACY_CODE_FROM_MODE[mode];
    if (code === undefined) return Promise.resolve();
    return this.link.send(new Uint8Array([code, 0, 0, 0, 0x07]), 80);
  }

  setBandwidth() {
    return Promise.resolve(null);
  }

  close() {
    return this.link.close();
  }
}

// ── Kenwood-style ASCII CAT ───────────────────────────────────────────────
// Kenwood TS-series, Elecraft, FlexRadio SmartSDR CAT, QRP Labs, (tr)uSDX,
// Lab599 TX-500. One "IF;" reply carries frequency, PTT and mode (Hamlib's
// kenwood.c offsets: frequency 2..12, PTT 28, mode 29).

const KENWOOD_MODE_FROM_CODE = { 1: "LSB", 2: "USB", 3: "CW", 4: "FM", 5: "AM", 6: "RTTY", 7: "CWR", 9: "RTTYR" };
const KENWOOD_CODE_FROM_MODE = { LSB: 1, USB: 2, CW: 3, FM: 4, AM: 5, RTTY: 6, CWR: 7, RTTYR: 9, PKTUSB: 2, PKTLSB: 1, PKTFM: 4, SAM: 5, DSB: 5 };

export class KenwoodDriver {
  /** @param {object} options { variant: 'kenwood' | 'elecraft' } */
  constructor(transport, options = {}) {
    this.link = new Link(transport, terminatedFramer(";"));
    // Elecraft's BW command reads and sets the filter in 10 Hz steps. Kenwood's
    // own SH/SL filters are per-model lookup tables, so they are left alone.
    this.hasBandwidth = options.variant === "elecraft";
    this.resolutionHz = 1;
    // Elecraft rigs switch on only through their POWER ON line, not over CAT.
    this.canPowerOn = options.variant !== "elecraft";
  }

  // Sent twice: on several models the first PS1 only wakes the CAT port.
  async powerOn() {
    if (!this.canPowerOn) throw new Error("This rig cannot be switched on over CAT");
    await this.link.send(ascii("PS1;"), 500);
    await this.link.send(ascii("PS1;"), 100);
  }

  async powerOff() {
    await this.link.send(ascii("PS0;"), 200);
  }

  get caps() {
    return { bandwidth: this.hasBandwidth, ptt: true };
  }

  async open() {
    await this.read();
  }

  async read() {
    const t = await askAscii(this.link, "IF;", "IF");
    if (t.length < 31) throw new Error(`Short IF reply: ${t}`);
    const hz = parseInt(t.slice(2, 13), 10);
    const state = {
      hz: Number.isFinite(hz) ? hz : null,
      ptt: t[28] === "1",
      mode: KENWOOD_MODE_FROM_CODE[t[29]] || null,
      bw: null,
    };
    if (this.hasBandwidth) {
      try {
        const bw = await askAscii(this.link, "BW;", "BW");
        state.bw = parseInt(bw.slice(2, -1), 10) * 10;
      } catch {
        this.hasBandwidth = false;
      }
    }
    return state;
  }

  setFrequency(hz) {
    return this.link.send(ascii(`FA${String(Math.round(hz)).padStart(11, "0")};`));
  }

  setMode(mode) {
    const code = KENWOOD_CODE_FROM_MODE[mode];
    if (!code) return Promise.resolve();
    return this.link.send(ascii(`MD${code};`), 60);
  }

  async setBandwidth(hz) {
    if (!this.hasBandwidth) return null;
    const tens = Math.max(0, Math.min(9999, Math.round(hz / 10)));
    await this.link.send(ascii(`BW${String(tens).padStart(4, "0")};`));
    return `${tens * 10} Hz`;
  }

  close() {
    return this.link.close();
  }
}

export function makeDriver(protocol, transport, options = {}) {
  if (protocol === "icom") return new IcomDriver(transport, options);
  if (protocol === "yaesu") return new YaesuDriver(transport);
  if (protocol === "yaesu-legacy") return new YaesuLegacyDriver(transport);
  return new KenwoodDriver(transport, { variant: protocol });
}
