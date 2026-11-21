// "Direct USB" CAT: the receiver page talks to the listener's transceiver
// itself, over Web Serial (Chrome, Edge, Opera, Firefox 151+ on the desktop;
// the page must be https or http://localhost). No TCI software and no bridge.
//
// The handle it returns has the same shape as connectCatSyncAny() in
// ../catsync.js - sendFreqToRig / sendModeToRig (TCI mode names) /
// sendFilterToRig / close - and drives the same callbacks (onVfo with TCI
// mode names, onFilter with edges around the carrier, onPtt), so App.svelte's
// sync logic, echo guards and mute-on-TX serve both connections unchanged.
// Only onStatus differs: (state, message), state being one of
// "connecting" | "connected" | "ready" (a port is known, not opened) |
// "no-port" | "lost" | "error" | "closed" | "off" (switched off from here).
//
// powerOn() opens the port, sends the rig family's power-on command and waits
// up to POWER_ON_WAIT_MS for the rig to answer, then carries on as Connect.
// powerOff() stops polling, sends the power-off command and closes the port.
//
// setScope(true) asks a rig that has one (Icom CI-V 27 00) to stream its
// spectrum scope; every sweep goes to callbacks.onScope({lo, hi, levels,
// max, outOfRange}). The wish survives reconnects; Disconnect and close stop
// the stream first. A rig that refuses it reports through onScopeError.
//
// The rig's port is opened on start only with { autoOpen: true } (CAT Sync
// on): opening the CAT window alone must not take the port away from
// WSJT-X or a logger.
//
// The rig is polled 4x a second (the drivers come from Desktop PhantomSDR+);
// a change the page asks for is written first, newest value only, so a drag
// across the waterfall never builds a backlog on the serial line.

import { makeDriver } from "./drivers.js";
import { findRigPreset, parseCivAddress, parseSsbFilters, rigScope, rigBlockedHere } from "./presets.js";

const POLL_MS = 250;
const FAILS_BEFORE_LOST = 4;
// After a frequency is sent, reports of any other frequency are the rig's
// old position still on the way, not a hand on the knob.
const FREQ_IN_FLIGHT_MS = 1500;
// An IC-7300 answers about 3 s after 18 01; give slower rigs room.
const POWER_ON_WAIT_MS = 15000;
// How long an Icom gets to answer the first question of a connection.
const FIRST_ANSWER_MS = 3000;
// When the rig does not answer at the configured speed, these are tried in
// turn (each SEARCH_ANSWER_MS) and the one that answers is kept.
const BAUD_SEARCH = [115200, 19200, 57600, 38400, 9600, 4800];
const SEARCH_ANSWER_MS = 1500;
// Between two attempts: some USB serial drivers dislike a port that is
// closed and opened again at once.
const SEARCH_PAUSE_MS = 400;

// Hamlib mode -> the TCI name the page understands (as the TCI bridge sends).
const RIG_TO_TCI = {
  USB: "usb", PKTUSB: "usb", LSB: "lsb", PKTLSB: "lsb",
  CW: "cw", CWR: "cw-l", AM: "am", SAM: "am", DSB: "am",
  FM: "fm", PKTFM: "fm", WFM: "wfm", RTTY: "lsb", RTTYR: "usb",
};
// TCI names from the page -> Hamlib's.
const TCI_TO_RIG = {
  usb: "USB", lsb: "LSB", cw: "CW", "cw-l": "CWR", am: "AM", sam: "AM",
  nfm: "FM", fm: "FM", wfm: "WFM", digu: "PKTUSB", digl: "PKTLSB",
};

function filterEdges(hamlibMode, width) {
  if (/USB$/.test(hamlibMode) || hamlibMode === "RTTYR") return [0, width];
  if (/LSB$/.test(hamlibMode) || hamlibMode === "RTTY") return [-width, 0];
  return [-Math.round(width / 2), Math.round(width / 2)];
}

function samePort(info, saved) {
  if (!saved) return false;
  return info.usbVendorId === saved.usbVendorId && info.usbProductId === saved.usbProductId;
}

const infoOf = (p) => (p && p.getInfo ? p.getInfo() : {});

// A rig with two USB serial ports (IC-705, IC-905: "Serial Port A (CI-V)" and
// "Serial Port B"; IC-7610, IC-9700: a dual CP2105) shows both with the SAME
// vendor and product ID, so the IDs alone cannot tell them apart. The port is
// remembered by its position among the granted ports with those IDs.
async function sameIdPorts(p) {
  let all = [];
  try {
    all = await navigator.serial.getPorts();
  } catch (e) {}
  const info = infoOf(p);
  return all.filter((q) => samePort(infoOf(q), info));
}

async function portInfoFor(p) {
  const info = infoOf(p);
  const same = await sameIdPorts(p);
  return { usbVendorId: info.usbVendorId, usbProductId: info.usbProductId, index: Math.max(0, same.indexOf(p)) };
}

// ── Web Serial as a byte transport for ./link.js ──────────────────────────

class WebSerialTransport {
  constructor(port) {
    this.port = port;
    this.reader = null;
    this.writer = null;
    this.closing = false;
    this.dataFns = [];
    this.closeFns = [];
  }

  onData(fn) {
    this.dataFns.push(fn);
  }

  onClose(fn) {
    this.closeFns.push(fn);
  }

  async open({ baudRate, stopBits, dtr, rts }) {
    await this.port.open({
      baudRate,
      dataBits: 8,
      stopBits: stopBits === 2 ? 2 : 1,
      parity: "none",
      flowControl: "none",
      bufferSize: 4096,
    });
    // Many CAT cables key the transmitter or reset the rig on DTR or RTS, and
    // opening a port asserts both. Set them to what the listener asked for.
    try {
      await this.port.setSignals({ dataTerminalReady: !!dtr, requestToSend: !!rts });
    } catch (e) {}
    this.writer = this.port.writable.getWriter();
    this._readLoop();
  }

  async _readLoop() {
    const port = this.port;
    while (!this.closing && port.readable) {
      this.reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value && value.length) this.dataFns.forEach((fn) => fn(value));
        }
      } catch (e) {
        // A framing error is survivable; a vanished device is not, and ends
        // the loop because readable goes null.
      } finally {
        try {
          this.reader.releaseLock();
        } catch (e) {}
        this.reader = null;
      }
    }
    if (!this.closing) {
      // The port died under us: release it, or the device stays busy for
      // every other program (Desktop learned this the hard way).
      await this._release();
      this.closeFns.forEach((fn) => fn());
    }
  }

  write(bytes) {
    if (!this.writer) throw new Error("Not connected");
    this.writer.write(bytes).catch(() => {});
  }

  async _release() {
    try {
      if (this.reader) await this.reader.cancel();
    } catch (e) {}
    try {
      if (this.writer) this.writer.releaseLock();
    } catch (e) {}
    this.writer = null;
    try {
      await this.port.close();
    } catch (e) {}
  }

  close() {
    if (this.closing) return this.released || Promise.resolve();
    this.closing = true;
    this.released = this._release().then(() => this.closeFns.forEach((fn) => fn()));
    return this.released;
  }
}

// ── The connection ────────────────────────────────────────────────────────

/**
 * @param {() => object} getSettings  the panel's settings (see presets.js)
 * @param {object} callbacks          { onVfo, onFilter, onPtt, onStatus, onPortChosen }
 * @param {object} [options]          { autoOpen: open a remembered port at once }
 */
export function connectRigSerial(getSettings, callbacks, options = {}) {
  const { onVfo, onFilter, onPtt, onStatus, onPortChosen, onScope, onScopeError, onBaudFound, onSmeter } = callbacks;
  let scopeWanted = false;
  let state = "closed";
  let closed = false;
  let generation = 0;
  let port = null;
  let transport = null;
  let driver = null;
  let timer = null;
  let busy = false;
  let failures = 0;
  let last = {};
  let pending = {};
  let expectHz = null;
  let wanted = { mode: null, at: 0 };
  // The previous port's close: a reopen waits for it, because closing is
  // asynchronous and Web Serial refuses to open a port that is still open.
  let lastRelease = Promise.resolve();

  function setStatus(s, message = "") {
    state = s;
    onStatus && onStatus(s, message);
  }

  function resetSync() {
    last = { hz: null, mode: null, hamlib: null, bw: null, ptt: null };
    pending = { hz: null, mode: null, bw: null };
    expectHz = null;
    wanted = { mode: null, at: 0 };
    failures = 0;
  }

  function releasePtt() {
    // Never leave the page muted by a TX the rig can no longer report.
    if (last.ptt) {
      last.ptt = false;
      onPtt && onPtt(false);
    }
  }

  // Close a port or driver of a connection attempt that will not be used,
  // and remember the close so the next open waits for it.
  function release(x) {
    try {
      const p = x && x.close();
      if (p && p.then) lastRelease = p.catch(() => {});
    } catch (e) {}
  }

  function teardown() {
    clearTimeout(timer);
    timer = null;
    let p = null;
    try {
      if (driver) p = driver.close();
      else if (transport) p = transport.close();
    } catch (e) {}
    if (p && p.then) lastRelease = p.catch(() => {});
    driver = null;
    transport = null;
  }

  async function open(chosen, how = {}) {
    const gen = ++generation;
    teardown();
    resetSync();
    port = chosen;
    await lastRelease;
    if (gen !== generation || closed) return;
    const s = getSettings();
    const preset = findRigPreset(s.preset);
    if (!preset) return setStatus("error", "Choose the rig first");
    // A driver known to hang the browser: never open the port.
    const blocked = rigBlockedHere(preset);
    if (blocked) return setStatus("error", blocked);
    let address = null;
    if (preset.protocol === "icom") {
      address = parseCivAddress(s.civAddress);
      if (address === null) return setStatus("error", "The CI-V address must be hex, e.g. 94");
    }
    const civ = preset.protocol === "icom" ? ", CI-V address" : "";
    const settings = { stopBits: Number(s.stopBits), dtr: s.dtr, rts: s.rts };
    const driverOptions = { address, ssbWidths: parseSsbFilters(s.ssbFilters) || [2700, 2400, 1800] };
    const configured = Number(s.baudRate);
    // A rig with a known maximum speed (the scope Icoms: 115200) is always
    // reached at that speed first. An IC-7300 on "Auto" stays on the first
    // speed it hears after power-on, so it must hear the fastest one first.
    const fastest = (rigScope(preset) || {}).baud || 0;
    const portError = "Could not open the port — is another program (WSJT-X, a logger) using it?";
    let t = null;
    let d = null;

    if (how.powerOn) {
      const pb = fastest || configured;
      setStatus("connecting", `Opening the port at ${pb} baud…`);
      t = new WebSerialTransport(chosen);
      try {
        await t.open({ baudRate: pb, ...settings });
      } catch (e) {
        if (gen !== generation) return;
        return setStatus("error", portError);
      }
      if (gen !== generation || closed) {
        release(t);
        return;
      }
      transport = t;
      d = makeDriver(preset.protocol, t, driverOptions);
      try {
        if (!d.canPowerOn) throw new Error(`${preset.maker} ${preset.model} cannot be switched on over CAT`);
        setStatus("connecting", "Switching the rig on…");
        await d.powerOn(pb);
        // A rig that is booting does not answer yet: ask until it does.
        const until = Date.now() + POWER_ON_WAIT_MS;
        for (;;) {
          if (gen !== generation || closed) break;
          try {
            await d.open();
            break;
          } catch (e) {
            if (Date.now() > until) {
              throw new Error(`The rig did not switch on. Check its power supply is on, and the baud rate${civ} and rig type.`);
            }
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } catch (e) {
        release(d);
        if (transport === t) transport = null;
        if (gen !== generation) return;
        return setStatus("error", e.message);
      }
      if (pb !== configured && gen === generation && !closed) onBaudFound && onBaudFound(pb, configured);
    } else {
      // The configured speed first; if the rig does not answer there, the
      // other usual speeds (an IC-7300 on "Auto" can stay on the speed it
      // first heard). The one that answers is kept (onBaudFound).
      const first = fastest || configured;
      const likely = [first, configured].filter((b, i, a) => a.indexOf(b) === i);
      // The rig's other port with the same IDs (if this browser was ever
      // allowed it): tried at the likely speeds before the long search, so a
      // pick of the wrong one of two ports sorts itself out quickly.
      const others = (await sameIdPorts(chosen)).filter((q) => q !== chosen);
      if (gen !== generation || closed) return;
      const tries = [
        ...likely.map((b) => ({ p: chosen, b })),
        ...others.flatMap((q) => likely.map((b) => ({ p: q, b }))),
        ...BAUD_SEARCH.filter((b) => !likely.includes(b)).map((b) => ({ p: chosen, b })),
      ];
      let found = 0;
      let foundPort = null;
      for (let k = 0; k < tries.length; k++) {
        const { p: tp, b } = tries[k];
        if (how.noSearch && k > 0) break;
        if (k > 0) {
          const prev = tries[k - 1];
          setStatus(
            "connecting",
            tp !== prev.p
              ? tp === chosen
                ? `No answer — trying the other speeds (${b} baud)…`
                : `No answer on this port — trying the rig's other port (${b} baud)…`
              : `No answer at ${prev.b} baud — trying ${b}…`,
          );
          await lastRelease;
          await new Promise((res) => setTimeout(res, SEARCH_PAUSE_MS));
        } else {
          setStatus("connecting", `Opening the port at ${b} baud…`);
        }
        if (gen !== generation || closed) return;
        const tt = new WebSerialTransport(tp);
        try {
          await tt.open({ baudRate: b, ...settings });
        } catch (e) {
          if (gen !== generation) return;
          if (tp === chosen) return setStatus("error", portError);
          continue; // the other port is busy: not the one we want anyway
        }
        if (gen !== generation || closed) {
          release(tt);
          return;
        }
        transport = tt;
        const dd = makeDriver(preset.protocol, tt, driverOptions);
        try {
          if (dd.wake) {
            // Icom: let an "Auto" baud rig detect the speed first, and give
            // its first answer a few tries.
            await dd.wake(b);
            const until = Date.now() + (k === 0 ? FIRST_ANSWER_MS : SEARCH_ANSWER_MS);
            for (;;) {
              try {
                await dd.open();
                break;
              } catch (e) {
                if (gen !== generation || closed || Date.now() > until) throw e;
                await dd.wake(b);
              }
            }
          } else {
            await dd.open();
          }
          t = tt;
          d = dd;
          found = b;
          foundPort = tp;
          break;
        } catch (e) {
          // Closed whether or not a newer attempt has taken over.
          release(dd);
          if (transport === tt) transport = null;
          if (gen !== generation) return;
        }
      }
      if (!d) {
        return setStatus("error", `The rig did not answer at any usual speed. Check it is on, the port (on a rig with two: the CI-V one)${civ ? ", the CI-V address" : ""} and the rig type.`);
      }
      if (foundPort !== chosen) {
        // The other port answered: from now on that one is the rig's port.
        port = foundPort;
        portInfoFor(foundPort).then((info) => onPortChosen && onPortChosen(info));
      }
      if (found !== configured) onBaudFound && onBaudFound(found, configured);
    }
    if (gen !== generation || closed) {
      release(d);
      if (transport === t) transport = null;
      return;
    }
    driver = d;
    t.onClose(() => {
      if (driver === d && !closed) lost("The rig's USB port went away");
    });
    setStatus("connected", `${preset.maker} ${preset.model}`);
    schedule(0);
    if (scopeWanted) startScope(d);
  }

  // Does the chosen rig stream a scope (presets.js RIG_SCOPES)? An Icom
  // without one has the same driver, so the driver alone cannot tell.
  function scopeRig() {
    return !!rigScope(findRigPreset(getSettings().preset));
  }

  function startScope(d) {
    if ("wantMeter" in d) d.wantMeter = true;
    // A rig with an S-meter only (older Icoms, Yaesu): the meter is all the
    // strip shows, and no scope command goes to the rig.
    if (!scopeRig() && "wantMeter" in d) return;
    if (!d.scopeOn) {
      // A rig with an S-meter only (Yaesu): the meter is all the strip shows.
      if (!("wantMeter" in d)) onScopeError && onScopeError("This rig has no scope output over CAT");
      return;
    }
    d.scopeOn((line) => {
      if (d === driver && scopeWanted) onScope && onScope(line);
    }).catch((e) => {
      if (d === driver) onScopeError && onScopeError(`The rig did not start its scope (${e.message})`);
    });
  }

  // Stop the stream before the port closes, or the rig keeps sending it.
  async function stopScope(d) {
    if (d && d.scopeOff && scopeRig()) {
      await Promise.race([d.scopeOff().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
    }
  }

  function lost(message) {
    generation++;
    teardown();
    releasePtt();
    setStatus("lost", message);
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }

  function hasPending() {
    return pending.hz != null || pending.mode != null || pending.bw != null;
  }

  async function tick() {
    const d = driver;
    if (!d || state !== "connected") return;
    busy = true;
    try {
      // The page's changes first, newest value only. A refused value (WFM on
      // an HF rig) is simply dropped; it is not a lost link.
      if (pending.hz != null) {
        const hz = pending.hz;
        pending.hz = null;
        await d.setFrequency(hz).catch(() => {});
      }
      if (pending.mode != null) {
        const mode = pending.mode;
        pending.mode = null;
        wanted = { mode, at: Date.now() };
        await Promise.resolve(d.setMode(mode)).catch(() => {});
      }
      if (pending.bw != null) {
        const bw = pending.bw;
        pending.bw = null;
        // A filter right behind a mode change belongs to the new mode.
        const mode = wanted.mode && Date.now() - wanted.at < 3000 ? wanted.mode : last.hamlib;
        await Promise.resolve(d.setBandwidth(bw, mode)).catch(() => {});
      }
      let rig;
      try {
        rig = await d.read();
        failures = 0;
      } catch (e) {
        // A poll still running when the link was closed here (Disconnect,
        // Power off) is not a lost rig.
        if (d !== driver || state !== "connected") return;
        failures++;
        if (failures >= FAILS_BEFORE_LOST || d.link.closed) {
          lost(`The rig stopped answering (${e.message})`);
        }
        return;
      }
      if (d === driver) report(rig, d.resolutionHz || 1);
    } finally {
      busy = false;
      if (driver === d && state === "connected" && !closed) {
        schedule(hasPending() ? 0 : POLL_MS);
      }
    }
  }

  function report(rig, resolution) {
    const now = Date.now();
    let hz = Number.isFinite(rig.hz) && rig.hz > 0 ? rig.hz : null;
    if (expectHz && hz != null) {
      if (now > expectHz.until) expectHz = null;
      else if (Math.abs(hz - expectHz.value) >= resolution) hz = null;
      else expectHz = null;
    }
    const tci = RIG_TO_TCI[rig.mode] || null;
    const freqChanged = hz != null && hz !== last.hz;
    const modeChanged = tci != null && tci !== last.mode;
    if (rig.mode) last.hamlib = rig.mode;
    if (freqChanged) last.hz = hz;
    if (modeChanged) last.mode = tci;
    if ((freqChanged || modeChanged) && last.hz != null) onVfo && onVfo(last.hz, last.mode);
    // The filter after the mode: the page resets its passband on a mode
    // change, then the rig's filter goes on top.
    if (rig.bw > 0 && last.hamlib && (rig.bw !== last.bw || modeChanged)) {
      last.bw = rig.bw;
      const [lo, hi] = filterEdges(last.hamlib, rig.bw);
      onFilter && onFilter(lo, hi);
    }
    if (rig.smeter != null && scopeWanted) onSmeter && onSmeter(rig.smeter, !!rig.ptt);
    if (rig.ptt === true || rig.ptt === false) {
      if (rig.ptt !== last.ptt) {
        last.ptt = rig.ptt;
        onPtt && onPtt(rig.ptt);
      }
    }
  }

  function kick() {
    if (state !== "connected" || busy) return;
    schedule(0);
  }

  // A granted port that comes back (cable plugged in, rig switched on) is
  // reopened when the listener still wants the link; one that goes away
  // ends it with a clear message.
  function onSerialConnect(ev) {
    if (closed || (state !== "lost" && state !== "no-port" && state !== "ready")) return;
    if (state === "ready" && !options.autoOpen) return;
    const p = ev.target;
    if (samePort(p.getInfo ? p.getInfo() : {}, getSettings().portInfo)) open(p);
  }
  function onSerialDisconnect(ev) {
    if (!closed && ev.target === port && (state === "connected" || state === "connecting")) {
      lost("The rig's USB cable was unplugged or the rig switched off");
    }
  }

  async function start(openIt) {
    if (closed) return;
    if (!navigator.serial) return setStatus("error", "This browser has no Web Serial");
    let ports = [];
    try {
      ports = await navigator.serial.getPorts();
    } catch (e) {}
    const saved = getSettings().portInfo;
    const same = ports.filter((p) => samePort(infoOf(p), saved));
    const match =
      (saved && same[saved.index || 0]) || same[0] || (ports.length === 1 && saved ? ports[0] : null);
    if (match && openIt) open(match);
    else if (match) {
      port = match;
      setStatus("ready", "Not connected");
    } else setStatus("no-port", "Choose the rig's USB port");
  }

  if (navigator.serial && navigator.serial.addEventListener) {
    navigator.serial.addEventListener("connect", onSerialConnect);
    navigator.serial.addEventListener("disconnect", onSerialDisconnect);
  }
  start(!!options.autoOpen);

  return {
    get state() {
      return state;
    },
    /** A port the listener just picked in the browser's chooser. */
    usePort(chosen) {
      if (closed) return;
      portInfoFor(chosen).then((info) => onPortChosen && onPortChosen(info));
      open(chosen);
    },
    /** Reopen with the current settings (after a change, or a lost link). */
    reconnect() {
      if (closed) return;
      if (port) open(port);
      else start(true);
    },
    async disconnect() {
      generation++;
      clearTimeout(timer);
      if (scopeWanted) await stopScope(driver);
      teardown();
      releasePtt();
      setStatus("closed", "");
    },
    /** Rig scope stream on or off (kept across reconnects). */
    setScope(on) {
      scopeWanted = !!on;
      if (!driver || state !== "connected") return;
      if (scopeWanted) startScope(driver);
      else {
        if ("wantMeter" in driver) driver.wantMeter = false;
        stopScope(driver);
      }
    },
    /** Switch the rig on over CAT, then connect as usual. */
    powerOn() {
      if (closed) return;
      if (!port) return setStatus("no-port", "Choose the rig's USB port first");
      open(port, { powerOn: true });
    },
    /** Switch the rig off over CAT and close the port. */
    async powerOff() {
      if (closed || state !== "connected" || !driver) return;
      const d = driver;
      // Stop polling first; the off command queues behind any exchange still
      // on the line.
      setStatus("connecting", "Switching the rig off…");
      generation++;
      clearTimeout(timer);
      try {
        await d.powerOff();
      } catch (e) {}
      teardown();
      releasePtt();
      setStatus("off", "Rig switched off");
    },
    close() {
      closed = true;
      generation++;
      const d = driver;
      if (scopeWanted && d && d.scopeOff) {
        // Let the stop command out before the port closes.
        clearTimeout(timer);
        timer = null;
        driver = null;
        transport = null;
        lastRelease = stopScope(d)
          .then(() => d.close())
          .catch(() => {});
      } else {
        teardown();
      }
      releasePtt();
      if (navigator.serial && navigator.serial.removeEventListener) {
        navigator.serial.removeEventListener("connect", onSerialConnect);
        navigator.serial.removeEventListener("disconnect", onSerialDisconnect);
      }
      setStatus("closed", "");
    },
    sendFreqToRig(freqHz) {
      if (state !== "connected" || !(freqHz > 0)) return false;
      pending.hz = Math.round(freqHz);
      // Guard the newest frequency from now on: the rig's echo of an earlier
      // step of a drag must not pull the page's dial back.
      expectHz = { value: pending.hz, until: Date.now() + FREQ_IN_FLIGHT_MS };
      kick();
      return true;
    },
    sendModeToRig(tciMode) {
      if (state !== "connected") return false;
      let target = TCI_TO_RIG[String(tciMode || "").toLowerCase()];
      if (!target) return false;
      // The page has no data modes: its USB agrees with the rig's USB-D, so
      // the rig is not knocked out of a data mode.
      if (target === "USB" && last.hamlib === "PKTUSB") target = "PKTUSB";
      if (target === "LSB" && last.hamlib === "PKTLSB") target = "PKTLSB";
      if (target === "FM" && last.hamlib === "PKTFM") target = "PKTFM";
      if (target === last.hamlib && pending.mode == null) return true;
      pending.mode = target;
      kick();
      return true;
    },
    sendFilterToRig(lowHz, highHz) {
      if (state !== "connected") return false;
      const width = Math.round(highHz - lowHz);
      if (!(width > 0)) return false;
      pending.bw = width;
      kick();
      return true;
    },
  };
}
