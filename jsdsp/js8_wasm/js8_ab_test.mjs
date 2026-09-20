/**
 * js8_ab_test.mjs — Phase 7: our receiver against JS8Call's, on identical audio.
 *
 * Everything else in this suite checks us against JS8Call's ENCODER or its
 * unpackers. This is the only thing that checks our RECEIVER: the same raw
 * recording is fed to both, and the decodes are compared slot by slot.
 *
 * The reference side is produced by reference/build_reference_decoder.sh, which
 * compiles JS8Call's own js8a_decode (sync + BP + OSD + 4-pass subtraction)
 * into a standalone binary inside a container.
 *
 * Usage:
 *   node js8_ab_test.mjs <file.f32> <startMs> [numSlots]
 *
 * A perfect score is not the goal and would be surprising: JS8Call runs OSD
 * and multi-pass subtraction that we do not. What matters is how much it
 * finds that we miss, and whether anything we report is wrong.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '../../frontend/src/modules');

const file = process.argv[2];
const startMs = Number(process.argv[3]);
const wantSlots = Number(process.argv[4] || 0);
if (!file || !Number.isFinite(startMs)) {
  console.error('usage: node js8_ab_test.mjs <file.f32> <startMs> [numSlots]');
  process.exit(2);
}

const SR = 12000;
const PERIOD = 15;            // JS8 Normal
const CAPTURE = 14.6;         // what audio.js grabs per slot

// ── our decoder ──────────────────────────────────────────────────────────────
const dictBytes = readFileSync(join(HERE, '../../frontend/public/decoders/js8_dict.bin'));
const wasmBytes = readFileSync(join(HERE, '../../frontend/public/decoders/js8.wasm'));
globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('js8_dict') ? dictBytes : wasmBytes;
  return { ok: true, status: 200,
           arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
};

const { decodeJS8 } = await import(join(MODULES, 'js8-decoder.js'));
const js8 = await import(join(MODULES, 'js8.js'));
const { formatJs8Frame } = await import(join(MODULES, 'js8-format.js'));
const { ALPHABET72 } = await import(join(MODULES, 'js8-tables.js'));
await js8.loadDictionary();

/**
 * Render the 72 payload bits as the 12 alphabet72 characters JS8Call's own
 * decoder prints. Comparing those is exact -- no formatting differences, no
 * message-layer differences, just "did we recover the same bits".
 */
function frameText(payload) {
  let out = '';
  for (let i = 0; i < 12; i++) {
    let v = 0;
    for (let b = 0; b < 6; b++) {
      const bit = i * 6 + b;
      v = (v << 1) | ((payload[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    out += ALPHABET72[v];
  }
  return out;
}

const pcm = new Float32Array(readFileSync(file).buffer);
const totalS = pcm.length / SR;

// Slot k starts at the first UTC boundary at/after the recording's start.
const firstBoundaryS = (PERIOD - ((startMs / 1000) % PERIOD)) % PERIOD;
const maxSlots = Math.floor((totalS - firstBoundaryS - CAPTURE) / PERIOD) + 1;
const nSlots = wantSlots > 0 ? Math.min(wantSlots, maxSlots) : maxSlots;

console.log(`${file}: ${totalS.toFixed(1)} s, first boundary at +${firstBoundaryS.toFixed(3)} s, ${nSlots} slots\n`);

const ours = [];
for (let k = 0; k < nSlots; k++) {
  const from = Math.round((firstBoundaryS + k * PERIOD) * SR);
  const slice = pcm.subarray(from, from + Math.round(CAPTURE * SR));
  if (slice.length < SR) break;
  const raw = await decodeJS8(Float32Array.from(slice), 0, SR);
  for (const r of raw) {
    const f = js8.decodeFrame(r.payload, r.i3bit);
    ours.push({
      slot: k, freq: r.freq, snr: Math.round(r.snr),
      frame: frameText(r.payload), i3bit: r.i3bit,
      text: formatJs8Frame(f), kind: f.kind,
    });
  }
}

// ── JS8Call's decoder ────────────────────────────────────────────────────────
const refPath = join(HERE, 'reference/ref_decode.txt');
const theirs = [];
if (existsSync(refPath)) {
  for (const line of readFileSync(refPath, 'utf8').split('\n')) {
    // JS8Call's callback hands back msg37: the 12-character frame followed by
    // the i3bit value. That is the raw payload, not a formatted message -- the
    // message layer lives in its C++ side, not in the Fortran.
    const m = line.match(/^DEC\s+(\d+)\s+(-?\d+)\s+(-?[\d.]+)\s+([\d.]+)\s+(\S+)\s*(\d*)\s*$/);
    if (m) {
      theirs.push({ slot: +m[1], snr: +m[2], dt: +m[3], freq: +m[4],
                    frame: m[5], i3bit: m[6] === '' ? null : +m[6] });
    }
  }
}

// ── compare ──────────────────────────────────────────────────────────────────
const key = (d) => `${d.slot}`;
// Match on the recovered bits when we can -- that is unambiguous. Fall back to
// slot+frequency so a frame one of us decoded and the other did not still lines
// up in the report.
const near = (a, b) => a.slot === b.slot &&
                       (a.frame === b.frame || Math.abs(a.freq - b.freq) <= 12);

const matched = [];
const oursOnly = [];
const theirsLeft = [...theirs];
for (const o of ours) {
  const i = theirsLeft.findIndex((t) => near(o, t));
  if (i >= 0) { matched.push([o, theirsLeft[i]]); theirsLeft.splice(i, 1); }
  else oursOnly.push(o);
}

const fmt = (d) => `slot ${String(d.slot).padStart(2)} ${String(Math.round(d.freq)).padStart(4)}Hz ` +
                   `${String(d.snr).padStart(3)}dB  ${d.frame}` +
                   (d.i3bit === null || d.i3bit === undefined ? '' : ` i3=${d.i3bit}`) +
                   (d.text ? `  ${d.text}` : '');

console.log(`ours:    ${ours.length} frames`);
console.log(`JS8Call: ${theirs.length} decodes` + (existsSync(refPath) ? '' : '  (no reference -- run reference/build_reference_decoder.sh)'));
console.log();

if (matched.length) {
  console.log('both found:');
  let bitExact = 0;
  for (const [o, t] of matched) {
    const same = o.frame === t.frame;
    if (same) bitExact++;
    console.log(`  ${same ? '=' : '~'} ${fmt(o)}`);
    console.log(`      JS8Call ${String(t.snr).padStart(3)}dB ${String(Math.round(t.freq)).padStart(4)}Hz  ${t.frame}` +
                (t.i3bit === null ? '' : ` i3=${t.i3bit}`));
  }
  console.log(`  (${bitExact}/${matched.length} bit-identical)`);
  console.log();
}
if (oursOnly.length) {
  console.log('ours only:');
  for (const o of oursOnly) console.log(`  ${fmt(o)}`);
  console.log();
}
if (theirsLeft.length) {
  console.log('JS8Call only (what we miss):');
  for (const t of theirsLeft) console.log(`  ${fmt(t)}`);
  console.log();
}

if (theirs.length) {
  const pct = (100 * matched.length / theirs.length).toFixed(0);
  console.log(`caught ${matched.length}/${theirs.length} of JS8Call's decodes (${pct}%)`);
}
