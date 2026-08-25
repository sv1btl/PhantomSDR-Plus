/**
 * js8_wasm_test.mjs — exercise the BUILT js8.wasm from node.
 *
 * Building cleanly proves nothing about the exports actually working, so this
 * loads frontend/public/decoders/js8.wasm exactly the way the browser will
 * (STANDALONE_WASM, hand-written Emscripten import stubs, same as
 * frontend/src/modules/ft4.js) and decodes the slots written by
 * `js8_decode_test --dump`.
 *
 * Usage:  node js8_wasm_test.mjs
 * (generate the slots first: for i in 0 1 2 3 4; do js8_decode_test --dump $i /tmp/js8-phase0/slot_$i.f32; done)
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE     = dirname(fileURLToPath(import.meta.url));
const WASM     = join(HERE, '../../frontend/public/decoders/js8.wasm');
const SLOT_DIR = process.env.JS8_SLOT_DIR || '/tmp/js8-phase0';
const EXPECT   = '71f04b75500000000060';

function makeImports(memory) {
    let active = memory;
    let HEAPU32 = new Uint32Array(active.buffer);
    let HEAPU8  = new Uint8Array(active.buffer);
    const refresh = () => {
        HEAPU32 = new Uint32Array(active.buffer);
        HEAPU8  = new Uint8Array(active.buffer);
    };
    const env = {
        memory,
        emscripten_memcpy_js: (d, s, n) => { HEAPU8.copyWithin(d, s, s + n); },
        emscripten_resize_heap(requested) {
            const needed = requested >>> 0;
            if (needed <= active.buffer.byteLength) return 1;
            const pages = Math.ceil((needed - active.buffer.byteLength) / 65536);
            try { active.grow(pages); refresh(); return 1; } catch { return 0; }
        },
        fd_close: () => 0,
        fd_seek:  () => 70,
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
const { instance } = await WebAssembly.instantiate(await readFile(WASM), imports);
const x = instance.exports;
const mem = x.memory || memory;
bindMemory(mem);
if (typeof x._initialize === 'function') x._initialize();

const cstr = (ptr) => {
    const h = new Uint8Array(mem.buffer);
    let end = ptr;
    while (h[end] !== 0) end++;
    return new TextDecoder().decode(h.subarray(ptr, end));
};

console.log(`js8.wasm loaded, ${x.js8_num_submodes()} submodes`);

let fail = 0;
for (let sm = 0; sm < x.js8_num_submodes(); sm++) {
    const name = cstr(x.js8_submode_name(sm));
    const pcm  = new Float32Array((await readFile(join(SLOT_DIR, `slot_${sm}.f32`))).buffer);

    const ptr = x.malloc(pcm.length * 4);
    new Float32Array(mem.buffer, ptr, pcm.length).set(pcm);
    const count = x.js8_decode(ptr, pcm.length, sm, 12000);
    x.free(ptr);

    let hit = null;
    for (let i = 0; i < count; i++) {
        const p = new Uint8Array(mem.buffer, x.js8_get_payload(i), 10);
        const hex = [...p].map((b) => b.toString(16).padStart(2, '0')).join('');
        if (hex === EXPECT) {
            hit = {
                hex,
                i3bit: x.js8_get_i3bit(i),
                freq: x.js8_get_freq(i),
                dt:   x.js8_get_dt(i),
                snr:  x.js8_get_snr(i),
            };
            break;
        }
    }

    if (!hit) {
        console.log(`  ${name.padEnd(7)} ${String(count).padStart(2)} decodes  *** payload not found ***`);
        fail++;
        continue;
    }
    const freqOk = Math.abs(hit.freq - 1500) < x.js8_submode_baud(sm);
    const dtOk   = Math.abs(hit.dt - 0.5) < 0.15;
    console.log(`  ${name.padEnd(7)} ${String(count).padStart(2)} decodes  ` +
                `i3bit ${hit.i3bit}  ${hit.freq.toFixed(1)} Hz  dt ${hit.dt.toFixed(3)} s  ` +
                `snr ${hit.snr.toFixed(0)}  ${freqOk && dtOk ? 'ok' : '*** off ***'}`);
    if (!freqOk || !dtOk) fail++;
}

console.log(fail ? '\n*** wasm test FAILED ***' : '\nwasm test passed');
process.exit(fail ? 1 : 0);
