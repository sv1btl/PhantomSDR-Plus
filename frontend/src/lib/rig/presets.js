// Rigs the "Direct USB" CAT connection talks to, with the defaults each
// ships with (same list as Desktop PhantomSDR+, src/rig/presets.js). Every
// value is only a starting point: baud rate, stop bits and the CI-V address
// are editable in the panel and must match the rig's own menu. Anything not
// listed here goes through the TCI bridge (tci-bridge/tci-rigctld.mjs, Hamlib).
//
// This file is small and static so the panel can list the rigs without
// loading the drivers; drivers.js is only loaded on Connect.

export const RIG_PRESETS = [
  // -- Icom CI-V ----------------------------------------------------------
  ["icom-7300", "Icom", "IC-7300", "icom", { baudRate: 115200, civAddress: 0x94 }],
  // Same CI-V commands as the IC-7300, own default address (Hamlib ic7300.c: 0xB6).
  ["icom-7300mk2", "Icom", "IC-7300MK2", "icom", { baudRate: 115200, civAddress: 0xb6 }],
  ["icom-7610", "Icom", "IC-7610", "icom", { baudRate: 115200, civAddress: 0x98 }],
  ["icom-705", "Icom", "IC-705", "icom", { baudRate: 115200, civAddress: 0xa4 }],
  ["icom-9700", "Icom", "IC-9700", "icom", { baudRate: 115200, civAddress: 0xa2 }],
  ["icom-905", "Icom", "IC-905", "icom", { baudRate: 115200, civAddress: 0xac }],
  ["icom-7760", "Icom", "IC-7760", "icom", { baudRate: 115200, civAddress: 0xb2 }],
  ["icom-7851", "Icom", "IC-7851", "icom", { baudRate: 19200, civAddress: 0x8e }],
  ["icom-7100", "Icom", "IC-7100", "icom", { baudRate: 19200, civAddress: 0x88 }],
  ["icom-7410", "Icom", "IC-7410", "icom", { baudRate: 19200, civAddress: 0x80 }],
  ["icom-9100", "Icom", "IC-9100", "icom", { baudRate: 19200, civAddress: 0x7c }],
  ["icom-7600", "Icom", "IC-7600", "icom", { baudRate: 19200, civAddress: 0x7a }],
  ["icom-7200", "Icom", "IC-7200", "icom", { baudRate: 19200, civAddress: 0x76 }],
  ["icom-7700", "Icom", "IC-7700", "icom", { baudRate: 19200, civAddress: 0x74 }],
  ["icom-7000", "Icom", "IC-7000", "icom", { baudRate: 19200, civAddress: 0x70 }],
  ["icom-7800", "Icom", "IC-7800", "icom", { baudRate: 19200, civAddress: 0x6a }],
  ["icom-756pro3", "Icom", "IC-756PROIII", "icom", { baudRate: 19200, civAddress: 0x6e }],
  ["icom-756pro2", "Icom", "IC-756PROII", "icom", { baudRate: 19200, civAddress: 0x64 }],
  ["icom-746pro", "Icom", "IC-746PRO", "icom", { baudRate: 9600, civAddress: 0x66 }],
  ["icom-718", "Icom", "IC-718", "icom", { baudRate: 9600, civAddress: 0x5e }],
  ["icom-r8600", "Icom", "IC-R8600", "icom", { baudRate: 115200, civAddress: 0x96 }],
  ["icom-r75", "Icom", "IC-R75", "icom", { baudRate: 9600, civAddress: 0x5a }],
  ["xiegu-g90", "Xiegu", "G90 (CI-V)", "icom", { baudRate: 19200, civAddress: 0x70 }],
  ["xiegu-x6100", "Xiegu", "X6100 (CI-V)", "icom", { baudRate: 19200, civAddress: 0x70 }],
  ["icom-generic", "Icom", "Other CI-V rig", "icom", { baudRate: 19200, civAddress: 0x94 }],

  // -- Yaesu new CAT ------------------------------------------------------
  ["yaesu-ftdx101", "Yaesu", "FTDX101D / FTDX101MP", "yaesu", { baudRate: 38400 }],
  ["yaesu-ftdx10", "Yaesu", "FTDX10", "yaesu", { baudRate: 38400 }],
  ["yaesu-ft710", "Yaesu", "FT-710", "yaesu", { baudRate: 38400 }],
  ["yaesu-ft991", "Yaesu", "FT-991 / FT-991A", "yaesu", { baudRate: 38400 }],
  ["yaesu-ft891", "Yaesu", "FT-891", "yaesu", { baudRate: 38400 }],
  ["yaesu-ftdx5000", "Yaesu", "FTDX5000", "yaesu", { baudRate: 38400 }],
  ["yaesu-ftdx3000", "Yaesu", "FTDX3000", "yaesu", { baudRate: 38400 }],
  ["yaesu-ftdx1200", "Yaesu", "FTDX1200", "yaesu", { baudRate: 38400 }],
  ["yaesu-ft950", "Yaesu", "FT-950", "yaesu", { baudRate: 38400 }],
  ["yaesu-ft2000", "Yaesu", "FT-2000", "yaesu", { baudRate: 38400 }],
  ["yaesu-ft450", "Yaesu", "FT-450 / FT-450D", "yaesu", { baudRate: 38400 }],

  // -- Yaesu legacy binary CAT --------------------------------------------
  ["yaesu-ft817", "Yaesu", "FT-817 / FT-818", "yaesu-legacy", { baudRate: 38400, stopBits: 2 }],
  ["yaesu-ft857", "Yaesu", "FT-857 / FT-857D", "yaesu-legacy", { baudRate: 38400, stopBits: 2 }],
  ["yaesu-ft897", "Yaesu", "FT-897 / FT-897D", "yaesu-legacy", { baudRate: 38400, stopBits: 2 }],

  // -- Kenwood and compatibles --------------------------------------------
  ["kenwood-ts990", "Kenwood", "TS-990S", "kenwood", { baudRate: 115200 }],
  ["kenwood-ts890", "Kenwood", "TS-890S", "kenwood", { baudRate: 115200 }],
  ["kenwood-ts590", "Kenwood", "TS-590S / TS-590SG", "kenwood", { baudRate: 115200 }],
  ["kenwood-ts480", "Kenwood", "TS-480", "kenwood", { baudRate: 57600 }],
  ["kenwood-ts2000", "Kenwood", "TS-2000", "kenwood", { baudRate: 57600 }],
  ["kenwood-ts870", "Kenwood", "TS-870S", "kenwood", { baudRate: 57600 }],
  ["kenwood-generic", "Kenwood", "Other Kenwood-compatible rig", "kenwood", { baudRate: 9600 }],
  ["elecraft-k4", "Elecraft", "K4", "elecraft", { baudRate: 38400 }],
  ["elecraft-k3", "Elecraft", "K3 / K3S", "elecraft", { baudRate: 38400 }],
  ["elecraft-kx3", "Elecraft", "KX3", "elecraft", { baudRate: 38400 }],
  ["elecraft-kx2", "Elecraft", "KX2", "elecraft", { baudRate: 38400 }],
  ["flex-smartsdr", "FlexRadio", "SmartSDR CAT (virtual port)", "kenwood", { baudRate: 9600 }],
  ["qrplabs-qmx", "QRP Labs", "QMX / QMX+ / QDX", "kenwood", { baudRate: 38400 }],
  ["usdx-trusdx", "uSDX", "(tr)uSDX", "kenwood", { baudRate: 38400 }],
  ["lab599-tx500", "Lab599", "Discovery TX-500", "kenwood", { baudRate: 9600 }],
].map(([id, maker, model, protocol, defaults]) => ({
  id,
  maker,
  model,
  protocol,
  defaults: { stopBits: 1, ...defaults },
}));

export function findRigPreset(id) {
  return RIG_PRESETS.find((p) => p.id === id) || null;
}

// Rigs that stream their spectrum scope over CI-V (27 00), with the points
// per sweep (Hamlib spectrum_line_length) and the baud rate the stream needs:
// a sweep is about 600 bytes on the wire, so 115200 baud (these rigs' USB
// maximum) gives 15-20 sweeps a second, 19200 only 2-3.
export const RIG_SCOPES = {
  "icom-7300": { points: 475, baud: 115200 },
  "icom-7300mk2": { points: 475, baud: 115200 },
  "icom-705": { points: 475, baud: 115200 },
  "icom-9700": { points: 475, baud: 115200 },
  "icom-905": { points: 475, baud: 115200 },
  "icom-r8600": { points: 475, baud: 115200 },
  "icom-7610": { points: 689, baud: 115200 },
  "icom-7760": { points: 689, baud: 115200 },
};

/** The rig's scope details, or null when it has no scope over CAT. */
export function rigScope(preset) {
  return (preset && RIG_SCOPES[preset.id]) || null;
}

/**
 * Rigs whose strip shows the S-meter only: the Yaesu new-CAT rigs (SM0) and
 * the Icom CI-V rigs without a scope stream (15 02: older Icoms, Xiegu).
 * A Yaesu's scope cannot reach a browser - the FT-710's comes through an
 * FTDI FT4222 chip, not the serial port (Desktop PhantomSDR+ reads that one).
 */
export function rigMeterOnly(preset) {
  return !!preset && !rigScope(preset) && (preset.protocol === "yaesu" || preset.protocol === "icom");
}

// Rigs with two USB serial ports, and which one carries CI-V. Both show the
// same USB IDs; serialRig.js tries the other one by itself if the chosen one
// does not answer, but the right pick saves the wait.
export const RIG_PORT_HINTS = {
  "icom-705": "This rig has two USB ports: choose “Serial Port A (CI-V)”.",
  "icom-905": "This rig has two USB ports: choose “Serial Port A (CI-V)”.",
  "icom-7610": "This rig has two USB ports (Silicon Labs CP2105): choose the “Enhanced COM Port”.",
  "icom-9700": "This rig has two USB ports (Silicon Labs CP2105): choose the “Enhanced COM Port”.",
};

export function rigPortHint(preset) {
  return (preset && RIG_PORT_HINTS[preset.id]) || "";
}

// Rigs whose Windows USB driver blocks a browser's serial reads: Icom's own
// IC-705 driver blocks inside an overlapped read (what every browser uses),
// which froze Edge and Firefox and kept the port busy until the cable was
// replugged (tested 2026-11-18). The page does not open them on Windows.
export const RIG_WINDOWS_BLOCKED = {
  "icom-705": "On Windows the IC-705's Icom USB driver makes the browser freeze, so Direct USB cannot use it. Use Connection: TCI with the Hamlib bridge (rigctl -m 3085 -r COM… -s 115200), or Desktop PhantomSDR+.",
};

export function isWindowsBrowser() {
  try {
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "";
    return /win/i.test(p);
  } catch (e) {
    return false;
  }
}

/** Why this rig cannot be used here, or "". */
export function rigBlockedHere(preset) {
  return (preset && isWindowsBrowser() && RIG_WINDOWS_BLOCKED[preset.id]) || "";
}

/** Elecraft rigs switch on only through their POWER ON line, not over CAT. */
export function rigCanPowerOn(preset) {
  return !!preset && preset.protocol !== "elecraft";
}

export const RIG_BAUD_RATES = [4800, 9600, 19200, 38400, 57600, 115200];

/** CI-V address typed in hex ("94", "0x94", "A4"); null when unusable. */
export function parseCivAddress(value) {
  if (typeof value === "number") return value > 0 && value < 0xe0 ? value : null;
  const t = String(value || "").trim().replace(/^0x/i, "").replace(/h$/i, "");
  if (!/^[0-9a-f]{1,2}$/i.test(t)) return null;
  const n = parseInt(t, 16);
  return n > 0 && n < 0xe0 ? n : null;
}

export function civHex(n) {
  return Number(n).toString(16).toUpperCase().padStart(2, "0");
}

const STORAGE_KEY = "catUsbSettings";

export function defaultUsbSettings() {
  const p = findRigPreset("icom-7300");
  return {
    preset: p.id,
    baudRate: p.defaults.baudRate,
    stopBits: p.defaults.stopBits,
    civAddress: civHex(p.defaults.civAddress),
    ssbFilters: "2700,2400,1800",
    // The last port chosen, by USB ids, so a reload finds it again.
    portInfo: null,
  };
}

export function loadUsbSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") return { ...defaultUsbSettings(), ...saved };
  } catch (e) {}
  return defaultUsbSettings();
}

export function saveUsbSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {}
}

/** Three FIL widths in Hz from "2700,2400,1800"; null when unusable. */
export function parseSsbFilters(value) {
  const w = String(value || "").split(/[,\s/]+/).filter(Boolean).map((x) => parseInt(x, 10));
  return w.length === 3 && w.every((x) => x >= 100 && x <= 10000) ? w : null;
}

/** True when this browser, on this page, can open a serial port at all. */
export function webSerialAvailable() {
  return typeof navigator !== "undefined" && !!navigator.serial && typeof window !== "undefined" && window.isSecureContext;
}
