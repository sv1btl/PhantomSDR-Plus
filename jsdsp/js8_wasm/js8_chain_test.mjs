/**
 * js8_chain_test.mjs — the whole JS8 chain, end to end.
 *
 *   real JS8 frame  ->  8-FSK audio  ->  js8.wasm  ->  js8.js  ->  message
 *
 * The frames here are the ones JS8Call's own packers produced (see
 * reference/ref_frames.txt); the audio is synthesised at -12 dB SNR with
 * noise. This is the only test that exercises the demodulator and the message
 * layer together, so it is what proves the payload the wasm hands over is
 * actually the payload js8.js expects -- byte order, bit order and all.
 *
 * Usage: node js8_chain_test.mjs   (after run_tests.sh has built the helpers)
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '../../frontend/src/modules');
const WORK = process.env.JS8_WORK || '/tmp/js8-phase0';
const HELPER = join(WORK, 'js8_decode_test');
const WASM = join(HERE, '../../frontend/public/decoders/js8.wasm');

if (!existsSync(HELPER)) {
  console.error(`missing ${HELPER} -- run ./run_tests.sh first`);
  process.exit(1);
}

/* ── Load js8.js and its dictionary from disk ───────────────────────────── */
const js8 = await import(join(MODULES, 'js8.js'));
const dictBytes = readFileSync(join(HERE, '../../frontend/public/decoders/js8_dict.bin'));
globalThis.fetch = async () => ({
  ok: true, status: 200,
  arrayBuffer: async () => dictBytes.buffer.slice(
    dictBytes.byteOffset, dictBytes.byteOffset + dictBytes.byteLength),
});
await js8.loadDictionary();

/* ── Load the wasm exactly as the browser does ──────────────────────────── */
function makeImports(memory) {
  let active = memory;
  let HEAPU32 = new Uint32Array(active.buffer);
  let HEAPU8 = new Uint8Array(active.buffer);
  const refresh = () => {
    HEAPU32 = new Uint32Array(active.buffer);
    HEAPU8 = new Uint8Array(active.buffer);
  };
  const env = {
    memory,
    emscripten_memcpy_js: (d, s, n) => { HEAPU8.copyWithin(d, s, s + n); },
    emscripten_resize_heap(req) {
      const needed = req >>> 0;
      if (needed <= active.buffer.byteLength) return 1;
      const pages = Math.ceil((needed - active.buffer.byteLength) / 65536);
      try { active.grow(pages); refresh(); return 1; } catch { return 0; }
    },
    fd_close: () => 0,
    fd_seek: () => 70,
    fd_write(fd, iov, iovcnt, pnum) {
      let written = 0;
      for (let i = 0; i < iovcnt; i++) { written += HEAPU32[(iov >> 2) + 1]; iov += 8; }
      HEAPU32[pnum >> 2] = written;
      return 0;
    },
    exit: (c) => { throw new Error('wasm exit(' + c + ')'); },
    __cxa_atexit: () => 0,
    emscripten_notify_memory_growth: () => {},
  };
  return {
    imports: {
      env,
      wasi_snapshot_preview1: {
        fd_close: env.fd_close, fd_seek: env.fd_seek,
        fd_write: env.fd_write, proc_exit: env.exit,
      },
    },
    bindMemory: (m) => { active = m; refresh(); },
  };
}

const memory = new WebAssembly.Memory({ initial: 256, maximum: 2048 });
const { imports, bindMemory } = makeImports(memory);
const { instance } = await WebAssembly.instantiate(readFileSync(WASM), imports);
const x = instance.exports;
const mem = x.memory || memory;
bindMemory(mem);
if (typeof x._initialize === 'function') x._initialize();

/* ── Cases: frame text as JS8Call packed it, i3bit, and what it should say ── */
const CASES = [
  { frame: '2Y-pe-ukukfO', i3: 3, submode: 0, kind: 'heartbeat', want: { from: 'KN4CRD', grid: 'EM73' } },
  { frame: '3ZvWNceUuRgu', i3: 3, submode: 0, kind: 'heartbeat', want: { from: 'SV1BTL', grid: 'KM17' } },
  { frame: '3u7rfzIk-rMu', i3: 3, submode: 1, kind: 'heartbeat', want: { from: 'VE7/KN4CRD', grid: 'CN89' } },
  { frame: 'SN5-lUuJkby0', i3: 1, submode: 0, kind: 'directed', want: { from: 'KN4CRD', to: 'K0OG' } },
  { frame: 'tYuMzoX+++++', i3: 0, submode: 0, kind: 'data', want: { text: 'HELLO WORLD' } },
  { frame: 'zqCJOTmVzh7+', i3: 0, submode: 2, kind: 'data', want: { text: 'GOOD MORNING FROM GREECE' } },
  { frame: 'dIz37+++++++', i3: 4, submode: 0, kind: 'data', want: { text: 'TEST MESSAGE' } },
];

let fail = 0;
console.log('audio -> js8.wasm -> js8.js, -12 dB SNR\n');

for (const c of CASES) {
  const pcmPath = join(WORK, `chain_${c.frame.replace(/[^A-Za-z0-9]/g, '_')}.f32`);
  execFileSync(HELPER, ['--dumpframe', c.frame, String(c.i3), String(c.submode), pcmPath]);
  const pcm = new Float32Array(readFileSync(pcmPath).buffer);

  const ptr = x.malloc(pcm.length * 4);
  new Float32Array(mem.buffer, ptr, pcm.length).set(pcm);
  const count = x.js8_decode(ptr, pcm.length, c.submode, 12000);
  x.free(ptr);

  let msg = null;
  for (let i = 0; i < count; i++) {
    const payload = new Uint8Array(mem.buffer, x.js8_get_payload(i), 10).slice();
    const f = js8.decodeFrame(payload, x.js8_get_i3bit(i));
    if (f.kind === c.kind) { msg = f; break; }
  }

  if (!msg) {
    console.log(`  ${c.frame}  *** no ${c.kind} frame decoded (${count} decodes) ***`);
    fail++;
    continue;
  }

  const bad = Object.entries(c.want).filter(([k, v]) => msg[k] !== v);
  const summary = c.kind === 'data'
    ? JSON.stringify(msg.text)
    : `${msg.from}${msg.to ? ' -> ' + msg.to : ''}${msg.grid ? ' ' + msg.grid : ''}`;

  console.log(`  ${c.frame}  ${c.kind.padEnd(9)} ${summary}  ${bad.length ? '*** MISMATCH ***' : 'ok'}`);
  if (bad.length) {
    for (const [k, v] of bad) console.log(`      ${k}: want ${JSON.stringify(v)}, got ${JSON.stringify(msg[k])}`);
    fail++;
  }
}

/* ── Multi-frame: several slots of audio -> one assembled message ────────── */

const { Js8Reassembler } = await import(join(MODULES, 'js8-reassembler.js'));

function fromHex(hex) {
  let s = '';
  for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return s;
}

const refLines = readFileSync(join(HERE, 'reference/ref_frames.txt'), 'utf8').split('\n');
const multis = refLines.filter((l) => l.startsWith('MULTI|')).slice(0, 3);

console.log('\nmulti-frame: one audio slot per frame, through the whole chain\n');

for (const line of multis) {
  const [, hex, spec] = line.split('|');
  const want = fromHex(hex);
  const frames = spec.split(';').map((f) => {
    const i = f.lastIndexOf(':');
    return { text: f.slice(0, i), i3: Number(f.slice(i + 1)) };
  });

  const r = new Js8Reassembler();
  let done = [];
  let t = 1_700_000_000_000;
  let decodedAll = true;

  for (const f of frames) {
    const pcmPath = join(WORK, `chain_multi_${f.text.replace(/[^A-Za-z0-9]/g, '_')}.f32`);
    execFileSync(HELPER, ['--dumpframe', f.text, String(f.i3), '0', pcmPath]);
    const pcm = new Float32Array(readFileSync(pcmPath).buffer);

    const ptr = x.malloc(pcm.length * 4);
    new Float32Array(mem.buffer, ptr, pcm.length).set(pcm);
    const count = x.js8_decode(ptr, pcm.length, 0, 12000);
    x.free(ptr);

    let got = null;
    for (let i = 0; i < count; i++) {
      const payload = new Uint8Array(mem.buffer, x.js8_get_payload(i), 10).slice();
      got = js8.decodeFrame(payload, x.js8_get_i3bit(i));
      break;
    }
    if (!got) { decodedAll = false; break; }

    done = done.concat(r.addFrame(got, {
      freq: x.js8_get_freq(0), submode: 0, snr: x.js8_get_snr(0), dt: 0, time: t,
    }));
    t += 15000;
  }

  const shown = want.length > 40 ? want.slice(0, 40) + '...' : want;
  if (!decodedAll) {
    console.log(`  ${frames.length} slots  *** a frame failed to decode ***`);
    fail++;
  } else if (done.length !== 1 || done[0].text !== want) {
    console.log(`  ${frames.length} slots  *** MISMATCH ***`);
    console.log(`      want ${JSON.stringify(want)}`);
    console.log(`      got  ${JSON.stringify(done.length === 1 ? done[0].text : done.map((d) => d.text))}`);
    fail++;
  } else {
    console.log(`  ${frames.length} slots  "${shown}"  ok`);
  }
}

console.log(fail ? '\n*** chain test FAILED ***' : '\nchain test passed');
process.exit(fail ? 1 : 0);
