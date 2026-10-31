/**
 * drm-helper.js — DRM (Digital Radio Mondiale) decoding for browser listeners.
 *
 * The UberSDR model: one ubersdr-drm process per listener (github.com/madpsy/
 * ubersdr-drm, a headless Dream, GPL-2-or-later; built by setup-drm.sh), fed
 * zero-IF I/Q from a loopback tap on spectrumserver's IQ mode. The I/Q never
 * leaves the server; the listener gets decoded audio and the decoder's status.
 *
 *   browser ──ws──> drm-helper ──IQTap──> spectrumserver (/audio?tap=, mode IQ)
 *                       │ stdin: s16 I/Q      stdout: s16 PCM 12 kHz
 *                       └──> ubersdr-drm ──── fd 3: JSON Lines status
 *
 * Browser protocol (ws://<host>:8075, or /drm through proxy.py):
 *   → {"type":"start","freq":<Hz>,"rx":"<receiver id>"}   rx optional (?rx=)
 *   → {"type":"tune","freq":<Hz>}
 *   → {"type":"stop"}
 *   ← binary: Int16 little-endian mono PCM at 12000 Hz (decoded audio only
 *              while locked) — half the bytes of Float32, inaudible difference
 *   ← {"type":"ready","rate":12000,"iqRate":<Hz>}
 *   ← {"type":"status", ...ubersdr-drm status line}  about once a second
 *   ← {"type":"error","msg":"..."}
 *
 * HTTP on the same port: GET /schedule — the DRM broadcast schedule as JSON
 * (drmschedule.js, plus what this receiver has decoded — drmheard.js), for
 * the panel's station selector; GET /status — the
 * sessions, for the admin panel's DRM card (direct loopback callers only: a
 * request that came through proxy.py carries X-Forwarded-For and is refused).
 *
 * Settings: drm.json in the repo root, written by the admin panel —
 *   {"enabled": true, "max_sessions": 5, "per_ip": 1}
 * re-read within 5 s, no restart needed. An environment variable below, when
 * set, wins over the file.
 *
 * Environment:
 *   DRM_HELPER_PORT     listen port (default 8075)
 *   DRM_HELPER_HOST     bind address (default 0.0.0.0, like the RADE sidecar)
 *   DRM_BINARY          decoder (default <repo>/drm/bin/ubersdr-drm)
 *   DRM_MAX_SESSIONS    concurrent decoders, overriding drm.json (default 5, UberSDR's;
 *                       each costs ~2 % of a core, 13 MB and ~192 kbit/s upload)
 *   DRM_PER_IP          concurrent decoders per listener IP, overriding drm.json (default 1)
 *   DRM_BANS_FILE       the admin panel's ban list (default <repo>/admin_bans.json):
 *                       a banned address is refused, and dropped if banned later
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';
import { IQTap } from './iqtap.js';
import { receiverPort } from './serverport.js';
import { getSchedule } from './drmschedule.js';
import { record as recordHeard, withHeard } from './drmheard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.DRM_HELPER_PORT) || 8075;
const HOST = process.env.DRM_HELPER_HOST || '0.0.0.0';
const BINARY = process.env.DRM_BINARY || join(ROOT, 'drm', 'bin', 'ubersdr-drm');
const SETTINGS_FILE = process.env.DRM_SETTINGS_FILE || join(ROOT, 'drm.json');
const BANS_FILE = process.env.DRM_BANS_FILE || join(ROOT, 'admin_bans.json');

const OUT_RATE = 12000;              // ubersdr-drm always writes 12 kHz mono
const DECODER_RATE = 12000;          // I/Q rate handed to ubersdr-drm (see IqResampler)
const MAX_BACKLOG_S = 2;             // drop I/Q rather than let latency grow
const RESTARTS_PER_MIN = 3;          // a decoder that keeps dying is given up on
const MLC_ITERATIONS = 2;            // bench: 1 → 2 gave fewer dropouts, 3–4 no more

const log = (...a) => console.log('[DRM]', ...a);

/** The listener's address: proxy.py forwards it in X-Forwarded-For. */
function clientIp(req) {
    const peer = req.socket.remoteAddress || '';
    const loop = /^(::1|127\.|::ffff:127\.)/.test(peer);
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return (loop && fwd) ? fwd : peer.replace(/^::ffff:/, '');
}

/**
 * The admin panel's 24-hour bans ({ip: {until: epoch_s, name}}). spectrumserver
 * enforces them on its own sockets; the DRM helper is a socket of its own, so
 * it reads the same list. Re-read only when the file changes.
 */
/** The live settings: environment > drm.json (admin panel) > defaults. */
let settingsCache = { mtime: -1, file: {} };
function settings() {
    let mtime = 0;
    try { mtime = statSync(SETTINGS_FILE).mtimeMs; } catch { /* no file: defaults */ }
    if (mtime !== settingsCache.mtime) {
        let file = {};
        try { if (mtime) file = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) || {}; } catch { /* keep defaults */ }
        settingsCache = { mtime, file };
    }
    const f = settingsCache.file;
    const num = (env, v, d) => Number(process.env[env]) || (Number(v) > 0 ? Math.floor(Number(v)) : d);
    return {
        enabled: f.enabled !== false,
        maxSessions: num('DRM_MAX_SESSIONS', f.max_sessions, 5),
        perIp: num('DRM_PER_IP', f.per_ip, 1),
    };
}

let bansCache = { mtime: -1, bans: {} };
function isBanned(ip) {
    let mtime = 0;
    try { mtime = statSync(BANS_FILE).mtimeMs; } catch { return false; }   // no bans at all
    if (mtime !== bansCache.mtime) {
        let bans = {};
        try { bans = JSON.parse(readFileSync(BANS_FILE, 'utf8')) || {}; } catch { /* keep none */ }
        bansCache = { mtime, bans };
    }
    const b = bansCache.bans[ip];
    return !!(b && Number(b.until) * 1000 > Date.now());
}

/**
 * Streaming cubic (Catmull-Rom) resampler for interleaved s16 I/Q. The tap
 * delivers I/Q at the receiver's true rate (12016.3 Hz on the RX888), but
 * ubersdr-drm corrupts its heap and aborts (SIGABRT, "malloc(): corrupted top
 * size" in CTimeSync) at such an odd rate; at exactly 12000 Hz it is fine.
 * Measured on a 13690 kHz recording: same MER as feeding the raw samples.
 */
class IqResampler {
    constructor(rateIn, rateOut) {
        this.step = rateIn / rateOut;
        this.hist = new Float64Array(6);         // last 3 input pairs (I,Q)
        this.have = 0;                           // how many of them are real
        this.t = 1;                              // output position, in input samples from hist[0]
    }

    process(i16) {
        const n = i16.length >> 1;
        const all = new Float64Array((n + 3) * 2);
        all.set(this.hist);
        for (let k = 0; k < i16.length; k++) all[6 + k] = i16[k];
        const total = n + 3;
        const skip = 3 - this.have;              // the first call has no history
        if (this.t < skip + 1) this.t = skip + 1;
        const out = new Int16Array(Math.ceil((total - this.t) / this.step + 1) * 2);
        let m = 0;
        for (; this.t + 2 < total; this.t += this.step) {
            const i = Math.floor(this.t), f = this.t - i;
            for (let c = 0; c < 2; c++) {
                const p0 = all[2 * (i - 1) + c], p1 = all[2 * i + c];
                const p2 = all[2 * (i + 1) + c], p3 = all[2 * (i + 2) + c];
                const v = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3
                          + f * (3 * (p1 - p2) + p3 - p0)));
                out[m++] = v > 32767 ? 32767 : v < -32768 ? -32768 : Math.round(v);
            }
        }
        this.hist = all.slice((total - 3) * 2);
        this.have = Math.min(3, this.have + n);
        this.t -= n;
        return out.subarray(0, m);
    }
}

const sessions = new Set();

class Session {
    constructor(ws, ip) {
        this.ws = ws;
        this.ip = ip;
        this.tap = null;
        this.child = null;
        this.restarts = [];
        this.dropped = 0;
        this.closed = false;
        this.pcmRest = null;
        this.freq = 0;
        this.rx = '';
        this.since = Date.now();
        this.status = null;                      // last ubersdr-drm status line
    }

    /** What the admin panel's DRM card shows for this session. */
    summary() {
        const st = this.status || {};
        return { ip: this.ip, freq: this.freq, rx: this.rx, since: this.since,
                 decoding: st.audio === 3, acquired: !!st.acq, service: st.service || '',
                 codec: st.codec || '', wmer: Number.isFinite(st.wmer) ? st.wmer : null };
    }

    send(obj) {
        if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(obj));
    }

    fail(msg) {
        log(`${this.ip}: ${msg}`);
        this.send({ type: 'error', msg });
        this.close();
    }

    start(freq, rx) {
        if (this.tap) { this.tune(freq); return; }
        this.freq = freq;
        this.rx = rx;
        const port = receiverPort(rx);
        if (!port) { this.fail('no receiver to tap'); return; }
        this.tap = new IQTap({ dialHz: freq, port, label: `DRM ${freq}` });
        this.tap.on('ready', () => {
            if (!this.tap.covers(freq)) {
                this.fail(`${(freq / 1e3).toFixed(1)} kHz is outside this receiver`);
                return;
            }
            this.spawnDecoder();
            this.send({ type: 'ready', rate: OUT_RATE, iqRate: this.tap.trueSampleRate });
            log(`${this.ip}: start ${(freq / 1e3).toFixed(1)} kHz on :${port}, ` +
                `I/Q ${this.tap.trueSampleRate.toFixed(1)} Hz (${sessions.size}/${settings().maxSessions})`);
        });
        this.tap.on('iq', (i16) => this.feed(i16));
        this.tap.on('error', (e) => this.fail(`receiver tap: ${e.message}`));
        this.tap.on('close', (code) => { if (!this.closed) this.fail(`receiver tap closed (${code})`); });
        this.tap.connect();
    }

    tune(freq) {
        if (!this.tap) return;
        if (this.tap.info && !this.tap.covers(freq)) {
            this.send({ type: 'error', msg: `${(freq / 1e3).toFixed(1)} kHz is outside this receiver` });
            return;
        }
        this.freq = freq;
        this.tap.retune(freq);
    }

    spawnDecoder() {
        if (this.closed) return;
        this.resampler = new IqResampler(this.tap.trueSampleRate, DECODER_RATE);
        // --mlciter 2: one more iterative MSC decoding pass than Dream's
        // default (see setup-drm.sh); a decoder built without it ignores it.
        const child = spawn(BINARY, ['--input-sample-rate', String(DECODER_RATE), '--mlciter', String(MLC_ITERATIONS)], {
            stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
        });
        this.child = child;
        this.pcmRest = null;
        child.stdin.on('error', () => { /* decoder gone; exit handler reports it */ });
        child.stdout.on('data', (buf) => this.relayPcm(buf));
        createInterface({ input: child.stdio[3] }).on('line', (line) => {
            try {
                const o = JSON.parse(line);
                delete o.t;
                this.status = o;
                recordHeard(this.freq, o);           // what this receiver really decodes
                this.send({ type: 'status', ...o, dropped: this.dropped });
            } catch { /* a malformed line is skipped, not fatal */ }
        });
        let errLines = 0;
        const errTail = [];                      // the abort reason comes last
        createInterface({ input: child.stderr }).on('line', (line) => {
            if (errLines++ < 5) log(`${this.ip}: decoder: ${line}`);
            else { errTail.push(line); if (errTail.length > 3) errTail.shift(); }
        });
        child.on('close', (code, sig) => {      // after stderr is drained
            if (this.child === child) this.child = null;
            if (this.closed) return;
            if (code !== 0) for (const line of errTail) log(`${this.ip}: decoder: ${line}`);
            const now = Date.now();
            this.restarts = this.restarts.filter((t) => now - t < 60000);
            if (this.restarts.length >= RESTARTS_PER_MIN) {
                this.fail(`decoder keeps stopping (${sig || code})`);
                return;
            }
            this.restarts.push(now);
            log(`${this.ip}: decoder exited (${sig || code}), restarting`);
            setTimeout(() => this.spawnDecoder(), 1000);
        });
    }

    feed(i16) {
        const c = this.child;
        if (!c || !c.stdin.writable) return;
        i16 = this.resampler.process(i16);
        // Dream reads at the rate it was given; if it falls behind, throw the
        // excess away so the listener's delay stays bounded.
        const limit = DECODER_RATE * 4 * MAX_BACKLOG_S;              // stereo s16
        if (c.stdin.writableLength > limit) { this.dropped += i16.length / 2; return; }
        c.stdin.write(Buffer.from(i16.buffer, i16.byteOffset, i16.byteLength));
    }

    relayPcm(buf) {
        if (this.pcmRest) { buf = Buffer.concat([this.pcmRest, buf]); this.pcmRest = null; }
        if (buf.length & 1) { this.pcmRest = buf.subarray(buf.length - 1); buf = buf.subarray(0, buf.length - 1); }
        if (!buf.length || this.ws.readyState !== this.ws.OPEN) return;
        this.ws.send(buf);                       // already Int16 LE, as the decoder wrote it
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        sessions.delete(this);
        try { this.tap?.close(); } catch { /* ignore */ }
        const c = this.child;
        this.child = null;
        if (c) {
            // ubersdr-drm catches SIGTERM but only acts on it once its blocking
            // stdin read returns, so end the pipe first (EOF ends the read),
            // and make sure with SIGKILL if it is still there 2 s later.
            try { c.stdin.end(); } catch { /* ignore */ }
            try { c.kill('SIGTERM'); } catch { /* ignore */ }
            const t = setTimeout(() => { try { c.kill('SIGKILL'); } catch { /* ignore */ } }, 2000);
            c.once('exit', () => clearTimeout(t));
        }
        try { this.ws.close(); } catch { /* ignore */ }
        log(`${this.ip}: closed (${sessions.size}/${settings().maxSessions})`);
    }
}

function main() {
    try {
        accessSync(BINARY, constants.X_OK);
    } catch {
        console.error(`[DRM] decoder not found at ${BINARY} — run setup-drm.sh first`);
        process.exit(1);
    }
    if (!existsSync('/usr/lib/x86_64-linux-gnu/libfaad_drm.so.2') &&
        !existsSync('/usr/lib/aarch64-linux-gnu/libfaad_drm.so.2') &&
        !existsSync('/usr/lib/arm-linux-gnueabihf/libfaad_drm.so.2')) {
        log('warning: libfaad_drm.so.2 not found (apt install libfaad2) — AAC services will be silent');
    }

    const server = createServer(async (req, res) => {
        if (req.method === 'GET' && req.url.split('?')[0] === '/schedule') {
            const list = withHeard(await getSchedule());
            if (!list.length) { res.writeHead(503); res.end(); return; }
            res.writeHead(200, { 'Content-Type': 'application/json',
                                 'Cache-Control': 'max-age=600',
                                 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(list));
            return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/status') {
            // Sysop only: listener addresses are in it. A request from the
            // public port arrives through proxy.py, which adds X-Forwarded-For.
            const peer = req.socket.remoteAddress || '';
            if (!/^(::1|127\.|::ffff:127\.)/.test(peer) || req.headers['x-forwarded-for']) {
                res.writeHead(403); res.end(); return;
            }
            const st = settings();
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ ok: true, enabled: st.enabled, max_sessions: st.maxSessions,
                                     per_ip: st.perIp, sessions: [...sessions].map((x) => x.summary()) }));
            return;
        }
        res.writeHead(404); res.end();
    });
    const wss = new WebSocketServer({ server, maxPayload: 4096 });
    wss.on('connection', (ws, req) => {
        const ip = clientIp(req);
        if (isBanned(ip)) {
            ws.send(JSON.stringify({ type: 'error', msg: 'This address is banned on this receiver.' }));
            ws.close(4001, 'banned');
            log(`${ip}: refused (banned)`);
            return;
        }
        const st = settings();
        if (!st.enabled) {
            ws.send(JSON.stringify({ type: 'error', msg: 'DRM is switched off on this receiver.' }));
            ws.close();
            return;
        }
        const mine = [...sessions].filter((s) => s.ip === ip).length;
        if (sessions.size >= st.maxSessions || mine >= st.perIp) {
            ws.send(JSON.stringify({ type: 'error', msg: sessions.size >= st.maxSessions
                ? `all ${st.maxSessions} DRM decoders are in use, try again later`
                : 'one DRM decoder per listener' }));
            ws.close();
            return;
        }
        const s = new Session(ws, ip);
        sessions.add(s);
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('message', (data, isBinary) => {
            if (isBinary) return;
            let m;
            try { m = JSON.parse(data.toString()); } catch { return; }
            const freq = Number(m.freq);
            if ((m.type === 'start' || m.type === 'tune') && !(freq > 0)) return;
            if (m.type === 'start') s.start(freq, typeof m.rx === 'string' ? m.rx : '');
            else if (m.type === 'tune') s.tune(freq);
            else if (m.type === 'stop') s.close();
        });
        ws.on('close', () => s.close());
        ws.on('error', () => s.close());
    });

    // Every 30 s: drop sessions whose address has been banned since, and ping —
    // a listener whose browser vanished without a close frame still holds a
    // decoder, so whoever does not answer is dropped.
    setInterval(() => {
        // A listener banned while decoding loses the decoder too.
        for (const s of [...sessions]) {
            if (isBanned(s.ip)) { s.send({ type: 'error', msg: 'This address is banned on this receiver.' }); s.close(); log(`${s.ip}: dropped (banned)`); }
        }
        for (const ws of wss.clients) {
            if (!ws.isAlive) { ws.terminate(); continue; }
            ws.isAlive = false;
            try { ws.ping(); } catch { /* ignore */ }
        }
    }, 30000);

    // Every 5 s: switching DRM off in the admin panel ends the running sessions.
    setInterval(() => {
        if (settings().enabled || !sessions.size) return;
        for (const s of [...sessions]) { s.send({ type: 'error', msg: 'DRM is switched off on this receiver.' }); s.close(); }
        log('switched off in the admin panel — sessions closed');
    }, 5000);

    server.listen(PORT, HOST);
    const st0 = settings();
    log(`listening on ${HOST}:${PORT}, decoder ${BINARY}, ${st0.maxSessions} session(s), ${st0.perIp} per IP` +
        (st0.enabled ? '' : ' — switched off in the admin panel'));
    const stop = () => { for (const s of sessions) s.close(); process.exit(0); };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
}

main();
