/**
 * ft4.js  —  FT4 / FT8 decode module for PhantomSDR-Plus
 * Place at: ~/PhantomSDR-Plus/frontend/src/modules/ft4.js
 *
 * Fetches /decoders/ft8_lib.wasm directly (static public file, no Vite
 * bundling needed) and provides all required Emscripten runtime stubs so
 * WebAssembly.instantiate succeeds.
 */

const WASM_URL = '/decoders/ft8_lib.wasm';

let _instance    = null;
let _memory      = null;
let _loadPromise = null;

// ── Minimal Emscripten runtime stubs ────────────────────────────────────────
function makeImports(memory) {
    let HEAPU8  = new Uint8Array(memory.buffer);
    let HEAPU32 = new Uint32Array(memory.buffer);

    function refreshViews() {
        HEAPU8  = new Uint8Array(memory.buffer);
        HEAPU32 = new Uint32Array(memory.buffer);
    }

    const env = {
        memory,

        emscripten_memcpy_js(dest, src, num) {
            HEAPU8.copyWithin(dest, src, src + num);
        },

        emscripten_resize_heap(requestedSize) {
            const needed = requestedSize >>> 0;
            if (needed <= memory.buffer.byteLength) return 1;
            const pages = Math.ceil((needed - memory.buffer.byteLength) / 65536);
            try { memory.grow(pages); refreshViews(); return 1; }
            catch (e) { console.error('[ft4] grow failed:', e); return 0; }
        },

        fd_close() { return 0; },
        fd_seek()  { return 70; },
        fd_write(fd, iov, iovcnt, pnum) {
            let written = 0;
            for (let i = 0; i < iovcnt; i++) {
                const ptr = HEAPU32[iov >> 2];
                const len = HEAPU32[(iov >> 2) + 1];
                iov += 8;
                written += len;
            }
            HEAPU32[pnum >> 2] = written;
            return 0;
        },
        exit(code) { throw new Error('WASM exit(' + code + ')'); },
        __cxa_atexit() { return 0; },
        emscripten_notify_memory_growth() {},
    };

    return {
        env,
        wasi_snapshot_preview1: {
            fd_close:  env.fd_close,
            fd_seek:   env.fd_seek,
            fd_write:  env.fd_write,
            proc_exit: env.exit,
        },
    };
}

// ── Load WASM once ───────────────────────────────────────────────────────────
async function _load() {
    if (_instance) return;
    if (_loadPromise) { await _loadPromise; return; }

    _loadPromise = (async () => {
        const memory  = new WebAssembly.Memory({ initial: 256, maximum: 2048 });
        const imports = makeImports(memory);

        const resp  = await fetch(WASM_URL);
        if (!resp.ok) throw new Error('[ft4] fetch ' + WASM_URL + ' → ' + resp.status);
        const bytes = await resp.arrayBuffer();

        const { instance } = await WebAssembly.instantiate(bytes, imports);

        _memory   = instance.exports.memory || memory;
        _instance = instance.exports;

        

        console.log('[ft4] WASM ready, exports:', Object.keys(_instance)
            .filter(k => /^(ftx_|get_|malloc|free)/.test(k)));
    })();

    await _loadPromise;
}

// ── Core decode ──────────────────────────────────────────────────────────────
async function _decode(pcm, protocol) {
    await _load();

    const { ftx_decode: _ftx_decode, get_message_text: _get_message_text,
            get_freq: _get_freq, get_snr: _get_snr,
            malloc: _malloc, free: _free } = _instance;

    if (!_ftx_decode || !_malloc) {
        console.error('[ft4] required exports missing from WASM');
        return [];
    }

    const pcmPtr = _malloc(pcm.length * 4);
    if (!pcmPtr) { console.error('[ft4] malloc failed'); return []; }

    new Float32Array(_memory.buffer, pcmPtr, pcm.length).set(pcm);

    let count = 0;
    try {
        count = _ftx_decode(pcmPtr, pcm.length, protocol);
    } catch (e) {
        console.error('[ft4] _ftx_decode threw:', e);
    } finally {
        _free(pcmPtr);
    }

    console.log('[ft4] protocol=' + protocol + ' count=' + count +
                ' samples=' + pcm.length);

    if (count <= 0) return [];

    const heap8   = new Uint8Array(_memory.buffer);
    const results = [];

    for (let i = 0; i < count; i++) {
        const textPtr = _get_message_text(i);
        const freq    = _get_freq(i);
        const snr     = _get_snr(i);

        let end = textPtr;
        while (heap8[end] !== 0) end++;
        const text = new TextDecoder().decode(heap8.subarray(textPtr, end)).trim();
        if (text) results.push({ text, freq, snr });
    }

    return results;
}

export async function decodeFT4(pcm) {
    return _decode(pcm, 1);
}

export async function decodeFT8viaLib(pcm) {
    return _decode(pcm, 0);
}