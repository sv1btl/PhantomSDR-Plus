/**
 * js8_frames_test.mjs — validate frontend/src/modules/js8.js against JS8Call.
 *
 * Reads the vectors produced by ref_frames.cpp, which were unpacked by
 * JS8Call's OWN Varicode/JSC running under Qt6 in a container (see
 * build_reference_frames.sh). For each vector we decode the identical
 * 12-character frame with js8.js and require the same result.
 *
 * The vectors are mostly pseudorandom frames rather than realistic ones. That
 * is deliberate: random frames hammer the callsign, grid and command unpackers
 * across their whole range, including the odd corners (base-27 padding, the
 * Swaziland/Guinea workarounds, grid-vs-command overloading) that a handful of
 * tidy example messages would never reach.
 *
 * Usage: node js8_frames_test.mjs [path/to/ref_frames.txt]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '../../frontend/src/modules');

const { decodeFrame } = await import(join(MODULES, 'js8.js'));
const { ALPHABET72, I3_DATA } = await import(join(MODULES, 'js8-tables.js'));
const js8 = await import(join(MODULES, 'js8.js'));

const vectorPath = process.argv[2] || join(HERE, "reference/ref_frames.txt");

// The dictionary is needed for compressed data frames; load it from disk here
// rather than over HTTP.
const dictPath = join(HERE, '../../frontend/public/decoders/js8_dict.bin');
const dictBytes = readFileSync(dictPath);
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => dictBytes.buffer.slice(
    dictBytes.byteOffset, dictBytes.byteOffset + dictBytes.byteLength),
});
await js8.loadDictionary();

/** 12 alphabet72 characters + i3bit -> the 10 payload bytes the wasm returns. */
function framePayload(text, i3bit) {
  const bits = [];
  for (const ch of text) {
    const v = ALPHABET72.indexOf(ch);
    if (v < 0) throw new Error(`char outside alphabet72: ${ch}`);
    for (let b = 5; b >= 0; b--) bits.push((v >> b) & 1);
  }
  for (let b = 2; b >= 0; b--) bits.push((i3bit >> b) & 1);

  const payload = new Uint8Array(10);
  for (let i = 0; i < 75; i++) if (bits[i]) payload[i >> 3] |= 0x80 >> (i & 7);
  return payload;
}

/** Render a decoded frame the way ref_frames.cpp joins JS8Call's output. */
function render(f) {
  switch (f.kind) {
    case 'heartbeat':
      return [f.from, '', f.grid].join(',');
    case 'compound':
    case 'compound_directed': {
      const parts = [f.from, ''];
      if (f.grid !== null) parts.push(' ' + f.grid);
      else if (f.cmdRaw !== null) {
        parts.push(f.cmdRaw);
        if (f.num !== null) parts.push(f.num);
      }
      return parts.join(',');
    }
    case 'directed': {
      const parts = [f.from, f.to, f.cmdRaw];
      if (f.num !== null) parts.push(f.num);
      return parts.join(',');
    }
    case 'data':
      return f.text ?? '';
    default:
      return '<none>';
  }
}

function fromHex(hex) {
  let s = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return s;
}

const lines = readFileSync(vectorPath, 'utf8').split('\n').filter(Boolean);

let total = 0;
let fails = 0;
const byKind = new Map();
const failSamples = [];

for (const line of lines) {
  const [label, frameText, i3str, kind, ...rest] = line.split('|');
  // The vector file also carries MULTI| and CHECKSUM16| rows for the
  // reassembly test; they have a different shape and are not ours.
  if (label === 'MULTI' || label === 'CHECKSUM16') continue;
  if (frameText === 'SKIP' || frameText === undefined) continue;
  if (!['heartbeat', 'compound', 'directed', 'data'].includes(kind)) continue;
  // The reference hex-encodes its text field: the JSC dictionary contains
  // arbitrary Latin-1 bytes, newlines included.
  const expected = fromHex(rest.join('|'));
  const i3bit = Number(i3str);

  total++;
  const f = decodeFrame(framePayload(frameText, i3bit), i3bit);
  const got = render(f);

  const stat = byKind.get(kind) || { n: 0, bad: 0 };
  stat.n++;

  // The reference dispatches frame types 1 and 2 to the same unpacker and
  // labels both "compound"; js8.js keeps them apart.
  const gotKind = f.kind === 'compound_directed' ? 'compound' : f.kind;

  if (gotKind !== kind || got !== expected) {
    stat.bad++;
    fails++;
    if (failSamples.length < 12) {
      failSamples.push(
        `  ${label} ${frameText} i3=${i3bit}\n` +
        `    expected [${kind}] ${JSON.stringify(expected)}\n` +
        `    got      [${gotKind}] ${JSON.stringify(got)}`);
    }
  }
  byKind.set(kind, stat);
}

console.log(`js8.js vs JS8Call: ${total} frames\n`);
for (const [kind, s] of [...byKind].sort()) {
  console.log(`  ${kind.padEnd(10)} ${String(s.n).padStart(5)} frames  ` +
              `${s.bad ? `${s.bad} MISMATCH` : 'all match'}`);
}
if (failSamples.length) {
  console.log('\nfirst mismatches:');
  console.log(failSamples.join('\n'));
}
console.log(fails ? `\n*** ${fails} mismatches ***` : '\nall frames match JS8Call');
process.exit(fails ? 1 : 0);
