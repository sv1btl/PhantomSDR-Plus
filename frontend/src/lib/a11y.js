// Screen-reader support. Nothing in here draws anything: the live regions are
// visually hidden (the usual "sr-only" clip, written inline so it does not
// depend on Tailwind keeping the class), and the reading of decoder/chat text
// is off until the listener turns it on with a shortcut.
//
//   announce(text)        speak through the polite live region
//   use:srFeed={{ name, kind }}   on a decoder/chat output box: new text in it
//                         is announced while reading for that kind is on
//   use:srDialog          on a popup panel: keyboard users land inside it when
//                         it opens and go back where they were when it closes
//   handleA11yKey(e, ctx) the Alt+Shift shortcuts (see A11Y_SHORTCUTS)

const SR_ONLY =
  "position:absolute!important;width:1px!important;height:1px!important;" +
  "padding:0!important;margin:-1px!important;overflow:hidden!important;" +
  "clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;" +
  "white-space:nowrap!important;border:0!important;";

let polite = null;
let assertive = null;

function region(level) {
  const el = document.createElement("div");
  el.setAttribute("aria-live", level);
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("data-sr-region", level);
  el.style.cssText = SR_ONLY;
  document.body.appendChild(el);
  return el;
}

function ensureRegions() {
  if (typeof document === "undefined" || !document.body) return false;
  if (!polite || !polite.isConnected) polite = region("polite");
  if (!assertive || !assertive.isConnected) assertive = region("assertive");
  return true;
}

// The same text twice in a row is not re-read by most screen readers unless the
// region is emptied first, so clear it and write on the next frame.
// Two calls inside that gap are joined, so neither is lost.
const pending = { polite: null, assertive: null };
const queued = { polite: "", assertive: "" };
export function announce(text, { urgent = false } = {}) {
  const msg = String(text || "").trim();
  if (!msg || !ensureRegions()) return;
  const key = urgent ? "assertive" : "polite";
  const el = urgent ? assertive : polite;
  queued[key] = queued[key] ? `${queued[key]}. ${msg}` : msg;
  if (pending[key]) return;
  el.textContent = "";
  pending[key] = setTimeout(() => {
    el.textContent = queued[key];
    queued[key] = "";
    pending[key] = null;
  }, 60);
}

// ---------------------------------------------------------------- settings
const LS = { decoder: "a11y.readDecoders", chat: "a11y.readChat" };
const reading = { decoder: false, chat: false };
try {
  reading.decoder = localStorage.getItem(LS.decoder) === "1";
  reading.chat = localStorage.getItem(LS.chat) === "1";
} catch (e) {}

export function isReading(kind) {
  return !!reading[kind];
}
export function toggleReading(kind) {
  reading[kind] = !reading[kind];
  try {
    localStorage.setItem(LS[kind], reading[kind] ? "1" : "0");
  } catch (e) {}
  const what = kind === "chat" ? "Chat" : "Decoder";
  // urgent: the confirmation must not queue behind a backlog of decodes
  announce(`${what} reading ${reading[kind] ? "on" : "off"}`, { urgent: true });
  return reading[kind];
}

// ------------------------------------------------------------- text feeds
// Works off the box's rendered text, not the decoders' data, so one action
// covers every decoder however it fills its box (Svelte {#each}, a list built
// with DOM calls, a component).  New text is found by diffing against the last
// snapshot: appended at the end (most decoders, streaming CW/RTTY characters)
// or added at the top (newest-first lists).  A box trimmed at the far end by
// .slice(-N) is handled by anchoring on the tail of the old text.
const ANCHOR = 160;

function newText(prev, next) {
  if (next === prev) return "";
  // First fill (chat history, a panel's first rows): only the newest line.
  if (!prev.trim()) {
    const l = next.trim().split("\n");
    return l[l.length - 1] ? l[l.length - 1] + "\n" : "";
  }
  if (next.startsWith(prev)) return next.slice(prev.length);
  if (next.endsWith(prev)) return next.slice(0, next.length - prev.length);
  const tail = prev.slice(-ANCHOR);
  const at = next.lastIndexOf(tail);
  if (at >= 0) return next.slice(at + tail.length);
  const head = prev.slice(0, ANCHOR);
  const hat = next.indexOf(head);
  if (hat > 0) return next.slice(0, hat);
  // Cleared or replaced wholesale: read only the last line, never the lot.
  const lines = next.trim().split("\n");
  return lines[lines.length - 1] ? lines[lines.length - 1] + "\n" : "";
}

// Streaming decoders (CW, RTTY…) add a character at a time; speak whole words,
// and whatever is left once the text has been quiet for a moment.
const IDLE_MS = 1500;

export function srFeed(node, opts) {
  // always: read regardless of the shortcut toggles (the /mobile chat, where
  // there is no keyboard to press them).
  let { name = "", kind = "decoder", always = false } = opts || {};
  let prev = node.innerText || "";
  let buf = "";
  let idle = null;
  let scan = null;

  function flush(all) {
    let out = buf;
    if (!all) {
      const cut = Math.max(buf.lastIndexOf(" "), buf.lastIndexOf("\n"));
      if (cut < 0) return;
      out = buf.slice(0, cut + 1);
      buf = buf.slice(cut + 1);
    } else buf = "";
    out = out.replace(/\s+/g, " ").trim();
    if (out && (always || reading[kind])) announce(name ? `${name}: ${out}` : out);
  }

  function check() {
    scan = null;
    const next = node.innerText || "";
    const add = newText(prev, next);
    prev = next;
    if (!always && !reading[kind]) {
      buf = "";
      return;
    }
    if (!add) return;
    buf += add;
    flush(false);
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => flush(true), IDLE_MS);
  }

  const mo = new MutationObserver(() => {
    if (!scan) scan = setTimeout(check, 250);
  });
  mo.observe(node, { childList: true, subtree: true, characterData: true });

  return {
    update(o) {
      ({ name = "", kind = "decoder", always = false } = o || {});
    },
    destroy() {
      mo.disconnect();
      if (scan) clearTimeout(scan);
      if (idle) clearTimeout(idle);
    },
  };
}

// --------------------------------------------------------------- dialogs
// Only keyboard users are moved: a mouse click on a popup's button keeps
// working exactly as before, focus and all.
let lastInputWasKeyboard = false;
if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Tab" || e.key === "Enter" || e.key === " " || e.altKey)
        lastInputWasKeyboard = true;
    },
    true,
  );
  window.addEventListener("pointerdown", () => (lastInputWasKeyboard = false), true);
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function srDialog(node) {
  if (!node.hasAttribute("role")) node.setAttribute("role", "dialog");
  if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
    const h = node.querySelector("h1, h2, h3");
    if (h && h.textContent.trim()) node.setAttribute("aria-label", h.textContent.trim());
  }
  const back = document.activeElement;
  const viaKeyboard = lastInputWasKeyboard;
  if (viaKeyboard) {
    requestAnimationFrame(() => {
      const first = node.querySelector(FOCUSABLE);
      if (first) first.focus({ preventScroll: true });
    });
  }
  return {
    destroy() {
      if (viaKeyboard && back && back.isConnected && typeof back.focus === "function")
        back.focus({ preventScroll: true });
    },
  };
}

// ------------------------------------------------------------- arrow keys
// The arrow-key tuning listens on window in the capture phase, so without this
// a focused slider or list could never be moved with the keyboard: the arrow
// tuned the receiver instead.  The frequency entry field keeps tuning.
export function arrowsBelongToControl(t) {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  if (t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return true;
  if (t instanceof HTMLInputElement) {
    if (t.name === "frequency" || t.closest("#frequencyContainer")) return false;
    return !/^(button|checkbox|radio|submit|reset|image|file|color|hidden)$/.test(t.type);
  }
  const role = t.getAttribute("role");
  return /^(slider|listbox|option|menu|menuitem|tablist|tab|grid|tree|spinbutton|radiogroup)$/.test(role || "");
}

// -------------------------------------------------------------- shortcuts
export const A11Y_SHORTCUTS = [
  ["Alt + Shift + F", "say frequency, mode and bandwidth"],
  ["Alt + Shift + S", "say signal strength and SNR"],
  ["Alt + Shift + R", "read decoder text aloud on/off"],
  ["Alt + Shift + C", "read new chat messages aloud on/off"],
  ["Alt + Shift + H", "say these screen-reader shortcuts"],
];

function sUnits(dbm, frequencyHz) {
  const lift = Number(frequencyHz) > 30e6 ? 20 : 0; // same rule as sUnits.js
  const over = dbm + 73 + lift; // dB over S9
  if (over > 0) return `S9 plus ${Math.round(over)}`;
  const s = Math.max(0, Math.round(9 + over / 6));
  return `S${s}`;
}

export function describeTuning({ frequency, mode, bandwidth }) {
  const f = Number(frequency);
  const parts = [];
  if (Number.isFinite(f)) parts.push(`${f.toFixed(2)} kilohertz`);
  if (mode) parts.push(String(mode));
  const bw = Number(bandwidth);
  if (Number.isFinite(bw) && bw > 0) parts.push(`bandwidth ${bw.toFixed(1)} kilohertz`);
  return parts.join(", ");
}

/** "S7, minus 85 d B m" — also the /mobile meter's spoken label. */
export function describeSignal(dbm, frequencyHz) {
  if (!Number.isFinite(Number(dbm))) return "no reading";
  dbm = Number(dbm);
  return `${sUnits(dbm, frequencyHz)}, ${dbm < 0 ? "minus " : ""}${Math.abs(Math.round(dbm))} d B m`;
}

/** ctx: { get(): {frequency, mode, bandwidth, dbm, snr} } — read at key time. */
export function handleA11yKey(e, ctx) {
  if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return false;
  const c = e.code;
  if (!/^Key[FSRCH]$/.test(c)) return false;
  e.preventDefault();
  e.stopPropagation();
  const st = ctx.get();
  if (c === "KeyF") announce(describeTuning(st), { urgent: true });
  else if (c === "KeyS") {
    const parts = [];
    if (Number.isFinite(Number(st.dbm)))
      parts.push(describeSignal(st.dbm, Number(st.frequency) * 1e3));
    if (Number.isFinite(Number(st.snr))) parts.push(`S N R ${Math.round(st.snr)} d B`);
    announce(parts.join(", ") || "No signal reading", { urgent: true });
  } else if (c === "KeyR") toggleReading("decoder");
  else if (c === "KeyC") toggleReading("chat");
  else if (c === "KeyH")
    announce(A11Y_SHORTCUTS.map(([k, d]) => `${k}: ${d}`).join(". "), { urgent: true });
  return true;
}

// Tuning with the arrow keys says the new frequency once the keys stop.
let tuneTimer = null;
export function announceTuningSoon(get) {
  if (tuneTimer) clearTimeout(tuneTimer);
  tuneTimer = setTimeout(() => announce(describeTuning(get())), 500);
}
