/**
 * js8_reassembly_test.mjs — checks for frontend/src/modules/js8-reassembler.js.
 *
 * Two halves:
 *
 *  1. CHECKSUMS vs JS8Call. The buffered-command checksum (CRC-16/KERMIT packed
 *     base-41) decides whether a multi-frame MSG or relay is accepted at all, so
 *     a wrong implementation silently drops real traffic. Vectors come from
 *     JS8Call's own Varicode::checksum16 -- see reference/.
 *
 *  2. REASSEMBLY BEHAVIOUR. The policy is transcribed from JS8Call's
 *     mainwindow.cpp (m_messageBuffer), which is UI-level code that cannot be
 *     driven headlessly, so these are scenario tests of the transcribed rules
 *     rather than a diff against upstream. Each case states the rule it pins.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '../../frontend/src/modules');

const { Js8Reassembler, checksum16 } = await import(join(MODULES, 'js8-reassembler.js'));
const { MFI, ALPHABET72 } = await import(join(MODULES, 'js8-tables.js'));
const { formatJs8Message, formatJs8Frame, formatJs8Parts } = await import(join(MODULES, 'js8-format.js'));
const js8 = await import(join(MODULES, 'js8.js'));

// js8.js needs the dictionary for compressed data frames; load it from disk.
const dictBytes = readFileSync(join(HERE, '../../frontend/public/decoders/js8_dict.bin'));
globalThis.fetch = async () => ({
  ok: true, status: 200,
  arrayBuffer: async () => dictBytes.buffer.slice(
    dictBytes.byteOffset, dictBytes.byteOffset + dictBytes.byteLength),
});
await js8.loadDictionary();

let fail = 0;
function check(name, ok, detail) {
  if (!ok) { fail++; console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`); }
  else console.log(`  ok   ${name}`);
}

/* ── 1. checksums vs JS8Call ─────────────────────────────────────────────── */

function fromHex(hex) {
  let s = '';
  for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return s;
}

const lines = readFileSync(join(HERE, 'reference/ref_frames.txt'), 'utf8').split('\n');
let n = 0, bad = 0, firstBad = null;
for (const line of lines) {
  if (!line.startsWith('CHECKSUM16|')) continue;
  const [, hex, want] = line.split('|');
  const text = fromHex(hex);
  n++;
  const got = checksum16(text);
  if (got !== want) {
    bad++;
    if (!firstBad) firstBad = `${JSON.stringify(text)} want ${want} got ${got}`;
  }
}
console.log('checksum16 vs JS8Call');
check(`${n} vectors`, bad === 0, firstBad);

/* ── 2. reassembly behaviour ─────────────────────────────────────────────── */

const T0 = 1_700_000_000_000;
const NORMAL = 0;

/** Minimal stand-ins for what js8.js hands over. */
const dataFrame = (text, { isFirst = false, isLast = false } = {}) => ({
  kind: 'data', text, isFirst, isLast, isDataFlagged: false,
  from: null, to: null, grid: null, cmd: null, cmdRaw: null, num: null,
});
const directedFrame = (from, to, cmdRaw, { isFirst = true, isLast = false } = {}) => ({
  kind: 'directed', from, to, cmd: cmdRaw.trim(), cmdRaw, num: null, grid: null,
  text: null, isFirst, isLast, isDataFlagged: false,
});
const heartbeatFrame = (from, grid) => ({
  kind: 'heartbeat', from, grid, to: null, cmd: null, cmdRaw: null, num: null,
  text: null, isFirst: true, isLast: true, isDataFlagged: false,
});

const meta = (freq, time, snr = 0) => ({ freq, submode: NORMAL, snr, dt: 0, time });

console.log('\nreassembly');

// A heartbeat is self-contained and must not open a buffer.
{
  const r = new Js8Reassembler();
  const out = r.addFrame(heartbeatFrame('SV1BTL', 'KM17'), meta(1200, T0));
  check('heartbeat completes immediately',
    out.length === 1 && out[0].from === 'SV1BTL' && out[0].grid === 'KM17' && r.buffers.size === 0);
}

// Three data frames at one frequency join into one message.
{
  const r = new Js8Reassembler();
  let out = r.addFrame(dataFrame('HELLO ', { isFirst: true }), meta(1200, T0));
  check('first data frame does not complete', out.length === 0);
  out = r.addFrame(dataFrame('BRAVE '), meta(1200, T0 + 15000));
  check('middle data frame does not complete', out.length === 0);
  out = r.addFrame(dataFrame('WORLD', { isLast: true }), meta(1200, T0 + 30000));
  check('last frame completes the message',
    out.length === 1 && out[0].text === 'HELLO BRAVE WORLD' && out[0].frames === 3,
    out.length ? JSON.stringify(out[0].text) : 'nothing emitted');
}

// Frequency drift within the submode tolerance must stay one message.
{
  const r = new Js8Reassembler();
  r.addFrame(dataFrame('DRIFT ', { isFirst: true }), meta(1200, T0));
  r.addFrame(dataFrame('ING'), meta(1206, T0 + 15000));           // +6 Hz, within 10
  const out = r.addFrame(dataFrame(' OK', { isLast: true }), meta(1209, T0 + 30000));
  check('drift within tolerance stays one message',
    out.length === 1 && out[0].text === 'DRIFT ING OK', JSON.stringify(out[0]?.text));
}

// Beyond the tolerance it is a different signal.
{
  const r = new Js8Reassembler();
  r.addFrame(dataFrame('ONE ', { isFirst: true }), meta(1200, T0));
  r.addFrame(dataFrame('TWO', { isFirst: true }), meta(1400, T0 + 15000));
  check('distant frames open separate buffers', r.buffers.size === 2);
}

// A first-flagged frame abandons whatever was open at that frequency.
{
  const r = new Js8Reassembler();
  r.addFrame(dataFrame('ABANDONED', { isFirst: true }), meta(1200, T0));
  const out = r.addFrame(dataFrame('FRESH', { isFirst: true, isLast: true }), meta(1200, T0 + 15000));
  check('first frame discards the stale buffer',
    out.length === 1 && out[0].text === 'FRESH', JSON.stringify(out[0]?.text));
}

// Idle marker after 1.5 T/R periods, close after 60 s, discard after 90 s.
{
  const r = new Js8Reassembler();
  r.addFrame(dataFrame('STALLED', { isFirst: true }), meta(1200, T0));
  let out = r.tick(T0 + 10_000);
  check('no idle marker before 1.5 periods', out.length === 0 && r.pending()[0].text === 'STALLED');
  out = r.tick(T0 + 25_000);                                       // > 1.5 * 15 s
  check('idle marker appears after 1.5 periods',
    out.length === 0 && r.pending()[0].text === 'STALLED' + MFI, r.pending()[0]?.text);
  out = r.tick(T0 + 61_000);
  check('buffer closes after 60 s idle',
    out.length === 1 && out[0].reason === 'timeout' && out[0].complete === false &&
    out[0].text === 'STALLED' + MFI, JSON.stringify(out[0]));
}
{
  const r = new Js8Reassembler();
  r.addFrame(dataFrame('GONE', { isFirst: true }), meta(1200, T0));
  const out = r.tick(T0 + 91_000);
  check('buffer discarded after 90 s', out.length === 0 && r.buffers.size === 0);
}

// A non-buffered directed command completes on its own.
{
  const r = new Js8Reassembler();
  const out = r.addFrame(directedFrame('KN4CRD', 'K0OG', ' SNR?', { isLast: true }), meta(1200, T0));
  check('plain directed command completes immediately',
    out.length === 1 && out[0].from === 'KN4CRD' && out[0].to === 'K0OG' && r.buffers.size === 0);
}

// A buffered command waits for its data, and its checksum is verified.
{
  const r = new Js8Reassembler();
  const body = 'MEET AT NOON';
  const withSum = `${body} ${checksum16(body)}`;
  r.addFrame(directedFrame('KN4CRD', 'SV1BTL', ' MSG'), meta(1200, T0));
  check('buffered command opens a buffer', r.buffers.size === 1);
  const out = r.addFrame(dataFrame(withSum, { isLast: true }), meta(1200, T0 + 15000));
  check('buffered command assembles and validates',
    out.length === 1 && out[0].text === body && out[0].checksumValid === true &&
    out[0].cmd === 'MSG', JSON.stringify(out[0]));
}

// A corrupt checksum must drop the message, as JS8Call does.
{
  const r = new Js8Reassembler();
  r.addFrame(directedFrame('KN4CRD', 'SV1BTL', ' MSG'), meta(1200, T0));
  const out = r.addFrame(dataFrame('MEET AT NOON XXX', { isLast: true }), meta(1200, T0 + 15000));
  check('bad checksum drops the message', out.length === 0 && r.buffers.size === 0);
}

// onMessage / onFrame callbacks.
{
  const msgs = [], frames = [];
  const r = new Js8Reassembler({ onMessage: (m) => msgs.push(m), onFrame: (f) => frames.push(f) });
  r.addFrame(dataFrame('CB ', { isFirst: true }), meta(1200, T0));
  r.addFrame(dataFrame('TEST', { isLast: true }), meta(1200, T0 + 15000));
  check('callbacks fire', frames.length === 2 && msgs.length === 1 && msgs[0].text === 'CB TEST');
}

/* ── 3. real multi-frame messages from JS8Call's transmit path ───────────── */

console.log('\nmulti-frame messages built by JS8Call');

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

let multi = 0;
for (const line of lines) {
  if (!line.startsWith('MULTI|')) continue;
  const [, hex, frameSpec] = line.split('|');
  const want = fromHex(hex);
  const frames = frameSpec.split(';').map((f) => {
    const i = f.lastIndexOf(':');
    return { text: f.slice(0, i), i3: Number(f.slice(i + 1)) };
  });

  const r = new Js8Reassembler();
  let completed = [];
  let t = T0;
  for (const f of frames) {
    const decoded = js8.decodeFrame(framePayload(f.text, f.i3), f.i3);
    completed = completed.concat(r.addFrame(decoded, meta(1200, t)));
    t += 15000;
  }

  multi++;
  const got = completed.length === 1 ? completed[0].text : null;
  check(`${frames.length} frames -> ${JSON.stringify(want.slice(0, 28))}${want.length > 28 ? '...' : ''}`,
    completed.length === 1 && got === want && r.buffers.size === 0,
    completed.length !== 1
      ? `expected 1 message, got ${completed.length}`
      : `got ${JSON.stringify(got)}`);
}
check('multi-frame vectors present', multi > 0);

/* ── 4. display formatting ───────────────────────────────────────────────── */
//
// The panel renders these strings directly, and audio.js labels the spectrum
// marks with them, so a wrong shape here is a wrong receiver -- worth pinning
// even though it is only text assembly.

console.log('\nformatting');

const fmt = [
  [{ kind: 'heartbeat', from: 'SV1BTL', grid: 'KM17' }, 'SV1BTL KM17: HB'],
  [{ kind: 'heartbeat', from: 'K0OG', grid: null }, 'K0OG: HB'],
  [{ kind: 'directed', from: 'KN4CRD', to: 'K0OG', cmd: 'SNR', num: '-05', text: '' },
   'KN4CRD: K0OG SNR -05'],
  [{ kind: 'directed', from: 'N0JDS', to: '@ALLCALL', cmd: 'MSG', num: null, text: 'MEET AT NOON' },
   'N0JDS: @ALLCALL MSG MEET AT NOON'],
  [{ kind: 'data', from: null, to: null, cmd: null, num: null, text: 'HELLO WORLD' },
   'HELLO WORLD'],
  [{ kind: 'directed', from: 'W0FW', to: 'VK1MIC', cmd: '', num: null, text: '' }, 'W0FW: VK1MIC'],
];
for (const [msg, want] of fmt) {
  const got = formatJs8Message(msg);
  check(`message: ${JSON.stringify(want)}`, got === want, `got ${JSON.stringify(got)}`);
}

const fmtFrames = [
  [{ kind: 'heartbeat', from: 'SV1BTL', grid: 'KM17' }, 'SV1BTL KM17 HB'],
  [{ kind: 'directed', from: 'KN4CRD', to: 'K0OG', cmd: 'QSL?', num: null }, 'KN4CRD: K0OG QSL?'],
  [{ kind: 'data', text: 'TEST', needsDictionary: false }, 'TEST'],
  [{ kind: 'data', text: null, needsDictionary: true }, '…'],
];
for (const [frame, want] of fmtFrames) {
  const got = formatJs8Frame(frame);
  check(`frame:   ${JSON.stringify(want)}`, got === want, `got ${JSON.stringify(got)}`);
}

// formatJs8Parts drives the panel; concatenating its pieces must reproduce
// formatJs8Message exactly, or the list and the spectrum labels drift apart.
for (const [msg, want] of fmt) {
  const joined = formatJs8Parts(msg).map((p) => p.text).join('');
  check(`parts rebuild: ${JSON.stringify(want)}`, joined === want, `got ${JSON.stringify(joined)}`);
}
// The callsigns are what gets coloured, so which pieces are flagged matters.
{
  const calls = (m) => formatJs8Parts(m).filter((p) => p.call).map((p) => p.text);
  check('heartbeat marks one callsign',
    JSON.stringify(calls(fmt[0][0])) === '["SV1BTL"]');
  check('directed marks both callsigns',
    JSON.stringify(calls(fmt[2][0])) === '["KN4CRD","K0OG"]');
  check('data frame marks none', calls(fmt[4][0]).length === 0);
}

// And the real thing: a message straight out of the reassembler must format.
{
  const r = new Js8Reassembler();
  r.addFrame(dataFrame('CQ CQ ', { isFirst: true }), meta(1200, T0));
  const out = r.addFrame(dataFrame('SV1BTL', { isLast: true }), meta(1200, T0 + 15000));
  check('reassembler output formats', formatJs8Message(out[0]) === 'CQ CQ SV1BTL',
    JSON.stringify(formatJs8Message(out[0])));
}

/* ── 5. panel markup ─────────────────────────────────────────────────────── */
//
// Every .js8-row is a four-column grid, and each row template must supply all
// four cells. A missing one does not error -- the remaining cells silently
// shift left, so the message lands in the dB track and overflows across it.
// That happened once; this is the guard.

// SNR is accurate to about half a dB; the panel must not print a raw float.
{
  const r = new Js8Reassembler();
  const out = r.addFrame(heartbeatFrame('SV1BTL', 'KM17'),
                         { freq: 1200, submode: NORMAL, snr: -8.734283447265625, dt: 0, time: T0 });
  check('single-frame SNR is 2 decimals',
    out.length === 1 && out[0].snr === -8.73, `got ${out[0]?.snr}`);
}
{
  const r = new Js8Reassembler();
  r.addFrame(dataFrame('A', { isFirst: true }),
             { freq: 1200, submode: NORMAL, snr: -8.4, dt: 0, time: T0 });
  const out = r.addFrame(dataFrame('B', { isLast: true }),
                         { freq: 1200, submode: NORMAL, snr: -9.9, dt: 0, time: T0 + 15000 });
  check('multi-frame SNR is 2 decimals',
    out.length === 1 && out[0].snr === -9.15, `got ${out[0]?.snr}`);
}

console.log('\npanel markup');
{
  const app = readFileSync(join(MODULES, '../App.svelte'), 'utf8');
  const rows = [...app.matchAll(/<div\s+class="js8-row[^"]*"[^>]*>(.*?)<\/div>/gs)];
  check('js8-row templates found', rows.length > 0);
  let bad = 0;
  for (const r of rows) {
    const cells = [...r[1].matchAll(/class="js8-(mode|hz|snr|text)"/g)].map((m) => m[1]);
    const ok = cells.length === 4 &&
      JSON.stringify(cells) === JSON.stringify(['mode', 'hz', 'snr', 'text']);
    if (!ok) { bad++; console.log(`       row has ${cells.length} cells: ${cells}`); }
  }
  check(`${rows.length} row templates each have mode/hz/snr/text`, bad === 0);
}

console.log(fail ? `\n*** ${fail} failures ***` : '\nall reassembly tests passed');
process.exit(fail ? 1 : 0);
