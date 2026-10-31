/**
 * drmheard.js — the DRM services this receiver has actually decoded.
 *
 * The published schedules miss transmissions nobody lists (TDF's tests on
 * 15490 kHz, the day the B26 season dropped them from drmrx.org), and they
 * list services that never reach this station. So the DRM helper notes every
 * service it decodes here: frequency, station name and the UTC half-hours it
 * was heard in. No listener address is kept.
 *
 * In /schedule a published slot that was heard here gets `heard: true`; a
 * service no source lists becomes an entry of its own (`heardOnly`), daily,
 * over the half-hours it was heard. Whatever has not been heard for
 * KEEP_DAYS drops out.
 *
 * File: drm-heard.json in the repo root (DRM_HEARD_FILE overrides), this
 * station's own data like drm.json — never shipped, never overwritten.
 *   { "<kHz>|<service>": { khz, service, country, language, codec,
 *                          first, last (epoch ms), slots: [48 × 0/1] } }
 */
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = process.env.DRM_HEARD_FILE ||
    join(dirname(fileURLToPath(import.meta.url)), '..', 'drm-heard.json');
const KEEP_DAYS = 30;
const SAVE_MS = 60 * 1000;
const MW_TOP_KHZ = 2300;

let heard = {};
try { heard = JSON.parse(readFileSync(FILE, 'utf8')) || {}; } catch { /* none yet */ }
let dirty = false;

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (half) => half >= 48 ? '24:00' : `${pad(Math.floor(half / 2))}:${half % 2 ? '30' : '00'}`;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Note one status line of a session decoding `freqHz`. */
export function record(freqHz, st) {
    if (!st || st.audio !== 3 || !st.service || !(freqHz > 0)) return;
    const khz = Math.round(freqHz / 1000);
    const service = String(st.service).trim();
    if (!service) return;
    const key = `${khz}|${service}`;
    const now = new Date();
    const e = heard[key] ??= { khz, service, first: now.getTime(), slots: new Array(48).fill(0) };
    const half = now.getUTCHours() * 2 + (now.getUTCMinutes() >= 30 ? 1 : 0);
    if (!e.slots[half] || now.getTime() - e.last > SAVE_MS) dirty = true;
    e.slots[half] = 1;
    e.last = now.getTime();
    e.country = st.country || e.country || '';
    e.language = st.language || e.language || '';
    e.codec = st.codec || e.codec || '';
}

function save() {
    const cut = Date.now() - KEEP_DAYS * 86400e3;
    for (const [k, e] of Object.entries(heard)) if (!(e.last > cut)) { delete heard[k]; dirty = true; }
    if (!dirty) return;
    dirty = false;
    try {
        writeFileSync(`${FILE}.tmp`, JSON.stringify(heard, null, 1));
        renameSync(`${FILE}.tmp`, FILE);
    } catch (e) { console.log('[DRM] could not save', FILE, e.message); }
}
setInterval(save, SAVE_MS).unref();
process.on('exit', save);

/** Heard half-hours as slots: each run of consecutive half-hours, wrapping midnight. */
function runs(slots) {
    if (slots.every(Boolean)) return [[0, 48]];
    const out = [];
    const start = slots.findIndex((v) => !v);          // begin scanning just after a gap
    for (let i = 0; i < 48; i++) {
        const h = (start + i) % 48;
        if (!slots[h]) continue;
        if (out.length && (out[out.length - 1][1] % 48) === h) out[out.length - 1][1] += 1;
        else out.push([h, h + 1]);
    }
    return out.map(([a, b]) => [a, b > 48 ? b - 48 : b]);
}

/** The schedule list with what was heard here merged in (a copy; the input is the shared cache). */
export function withHeard(list) {
    const out = JSON.parse(JSON.stringify(list || []));
    const cut = Date.now() - KEEP_DAYS * 86400e3;
    const overlaps = (s, a, b) => {
        const s0 = toMin(s.start), s1 = toMin(s.end) <= s0 ? toMin(s.end) + 1440 : toMin(s.end);
        const h0 = a * 30, h1 = b * 30 <= h0 ? b * 30 + 1440 : b * 30;
        return [0, 1440, -1440].some((d) => h0 + d < s1 && s0 < h1 + d);
    };
    for (const e of Object.values(heard)) {
        if (!(e.last > cut)) continue;
        const lastHeard = new Date(e.last).toISOString().slice(0, 10);
        for (const [a, b] of runs(e.slots)) {
            const hits = out.flatMap((st) => st.slots).filter((s) => s.khz === e.khz && overlaps(s, a, b));
            if (hits.length) { for (const s of hits) { s.heard = true; s.lastHeard = lastHeard; } continue; }
            const region = e.khz < MW_TOP_KHZ ? 'MW' : 'SW';
            let st = out.find((x) => x.station === e.service && x.region === region && x.heardOnly);
            if (!st) out.push(st = { station: e.service, region, url: '', heardOnly: true, slots: [] });
            st.slots.push({ khz: e.khz, start: hhmm(a), end: hhmm(b), days: '1111111', target: '',
                            power: 0, site: '', language: e.language || '', verified: false,
                            registered: false, heard: true, heardOnly: true, lastHeard });
        }
    }
    return out;
}
