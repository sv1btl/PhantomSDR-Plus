/**
 * drmschedule.js — the DRM broadcast schedule, for the DRM panel's selector.
 *
 * Three sources, each used for what it is best at:
 *
 *   drmrx.org (the DRM Reception Project, www.drmrx.org/schedules/
 *     drmschedules.php) — the schedule DRM listeners maintain. The primary
 *     source: frequency, UTC times, days of the week, target area, power,
 *     site and language for every service. Dream's own schedule format.
 *   drm.kiwisdr.com/drm/drmrx.cjson — KiwiSDR's digest of the same data. It
 *     drops the days and targets but marks the entries listeners confirmed
 *     on air; those marks are merged in as `verified`. It is also the
 *     fallback when drmrx.org cannot be reached.
 *   HFCC (frequencylist/0.TXT, the season's registrations that the marker
 *     updater downloads) — what broadcasters themselves registered. Entries
 *     whose notes say DRM, inside their validity dates, are marked
 *     `registered`; a registered service drmrx.org does not list is added.
 *
 * Fetched by the helper rather than each browser, at most once an hour; the
 * last good copy is kept when the sources are unreachable.
 *
 * Normalised form (what /schedule serves and the panel's snapshot holds):
 *   [{ station, region: "SW"|"MW", url,
 *      slots: [{ khz, start: "HH:MM", end: "HH:MM", days: "SMTWTFS" bits,
 *                target, power, site, language, verified, registered }] }]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const DRMRX_URL = 'https://www.drmrx.org/schedules/drmschedules.php';
export const KIWI_URL = 'https://drm.kiwisdr.com/drm/drmrx.cjson';
const HFCC_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'frequencylist', '0.TXT');
const REFRESH_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const MW_TOP_KHZ = 2300;

const pad = (n) => String(n).padStart(2, '0');

/** "H:M" or "HHMM" (minutes may read 60) → "HH:MM"; a leading "-" is reported. */
function hhmm(t) {
    const s = String(t).trim();
    const verified = s.startsWith('-');
    const bare = s.replace(/^-/, '');
    const [h, m] = bare.includes(':') ? bare.split(':').map((x) => Number(x) || 0)
                                      : [Number(bare.slice(0, 2)) || 0, Number(bare.slice(2)) || 0];
    const total = Math.min(24 * 60, h * 60 + m);
    return { time: `${pad(Math.floor(total / 60))}:${pad(total % 60)}`, verified };
}

/** drmrx.org: blank-line separated KEY=value records (Dream's DRMSchedule format). */
export function parseDrmrx(text) {
    const recs = [];
    for (const block of text.split(/\r?\n\s*\r?\n/)) {
        const r = {};
        for (const line of block.split(/\r?\n/)) {
            const i = line.indexOf('=');
            if (i > 0) r[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        }
        const khz = Number(r.Frequency);
        const times = String(r.StartStopTimeUTC || '').split('-');
        if (!(khz > 0) || times.length !== 2) continue;
        const days = /^[01]{7}$/.test(r['Days[SMTWTFS]'] || '') ? r['Days[SMTWTFS]'] : '1111111';
        recs.push({
            station: r.Programme || 'DRM', khz,
            start: hhmm(times[0]).time, end: hhmm(times[1]).time, days,
            target: r.Target || '', power: Number(r.Power) || 0,
            site: [r.Site, r.Country].filter(Boolean).join(', '), language: r.Language || '',
        });
    }
    return recs;
}

/** KiwiSDR's cjson digest → flat records (no days or targets in it). */
export function parseKiwi(text) {
    const data = JSON.parse(text.replace(/^\s*\/\/.*$/mg, ''));
    const out = [];
    for (const block of Array.isArray(data) ? data : []) {
        for (const [key, val] of Object.entries(block)) {
            if (!Array.isArray(val)) continue;
            const rest = typeof val[0] === 'string' ? val.slice(1) : val;
            for (let i = 0; i + 2 < rest.length; i += 3) {
                const khz = Number(rest[i]);
                if (!(khz > 0)) continue;
                const a = hhmm(rest[i + 1]), b = hhmm(rest[i + 2]);
                out.push({ station: key, khz, start: a.time, end: b.time, verified: a.verified });
            }
        }
    }
    return out;
}

/** HFCC fixed-width rows whose notes mention DRM and that are in force today. */
export function parseHfccDrm(text, now = new Date()) {
    const out = [];
    const today = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
    const ymd = (d) => 20000000 + Number(d.slice(4, 6)) * 10000 + Number(d.slice(2, 4)) * 100 + Number(d.slice(0, 2));
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith(';') || !/\bDRM/.test(line)) continue;
        const m = line.match(/^\s*(\d+)\s+(\d{4})\s+(\d{4})\s+\S+\s+(\S+)\s+(\d+)\s.*?\s([1-7]{1,7})\s+(\d{6})\s+(\d{6})\s+\S+\s+\d+\s+(\S+)\s+\S+\s+(\S+)/);
        if (!m) continue;
        const [, f, a, b, loc, pow, days, from, to, lang, brc] = m;
        if (ymd(from) > today || ymd(to) < today) continue;
        out.push({ khz: Number(f), start: hhmm(a).time, end: hhmm(b).time,
                   days: days === '1234567' ? '1111111' : null, site: loc, power: Number(pow),
                   language: lang, broadcaster: brc, notes: (line.match(/DRM\S*/) || [''])[0] });
    }
    return out;
}

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** Same channel and the same broadcast: frequency equal, start within 10 minutes. */
const sameSlot = (x, y) => x.khz === y.khz && Math.abs(toMin(x.start) - toMin(y.start)) <= 10;

/** Merge the three sources into the normalised list. */
export function mergeSchedule(drmrx, kiwi, hfcc) {
    const slots = (drmrx && drmrx.length ? drmrx : (kiwi || []).map((k) => ({ ...k, days: '1111111',
        target: '', power: 0, site: '', language: '' }))).map((s) => ({ ...s, verified: false, registered: false }));
    for (const k of kiwi || []) {
        if (!k.verified) continue;
        for (const s of slots) if (sameSlot(s, k)) s.verified = true;
    }
    for (const h of hfcc || []) {
        const hit = slots.filter((s) => sameSlot(s, h));
        if (hit.length) { for (const s of hit) s.registered = true; continue; }
        if (!h.days) continue;              // only a daily registration is added unread
        const station = h.broadcaster === 'BBC' ? 'BBC World Service' : `${h.broadcaster} (HFCC)`;
        slots.push({ station, khz: h.khz, start: h.start, end: h.end, days: h.days,
                     target: h.notes.replace(/^DRM_?/, '') || '', power: h.power, site: h.site,
                     language: h.language, verified: false, registered: true });
    }
    const byStation = new Map();
    for (const s of slots) {
        const region = s.khz < MW_TOP_KHZ ? 'MW' : 'SW';
        const key = `${s.station}|${region}`;
        if (!byStation.has(key)) byStation.set(key, { station: s.station, region,
            url: `https://www.drmrx.org/schedules/drmbc.php?id=${encodeURIComponent(s.station)}`, slots: [] });
        const { station, ...slot } = s;
        byStation.get(key).slots.push(slot);
    }
    const list = [...byStation.values()];
    for (const st of list) st.slots.sort((a, b) => a.khz - b.khz || toMin(a.start) - toMin(b.start));
    return list;
}

let cache = null, cachedAt = 0, nextTry = 0, inflight = null;

async function fetchText(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
}

/** The merged schedule, refreshed hourly; null only when it was never fetched. */
export async function getSchedule() {
    const now = Date.now();
    if (cache && now - cachedAt < REFRESH_MS) return cache;
    if (now < nextTry) return cache;
    if (!inflight) {
        inflight = (async () => {
            const [a, b] = await Promise.allSettled([fetchText(DRMRX_URL), fetchText(KIWI_URL)]);
            let drmrx = null, kiwi = null, hfcc = null;
            try { if (a.status === 'fulfilled') drmrx = parseDrmrx(a.value); } catch (e) { console.log('[DRM] drmrx.org parse:', e.message); }
            try { if (b.status === 'fulfilled') kiwi = parseKiwi(b.value); } catch (e) { console.log('[DRM] KiwiSDR parse:', e.message); }
            try { hfcc = parseHfccDrm(readFileSync(HFCC_FILE, 'utf8')); } catch { /* no HFCC file on this station */ }
            if (a.status === 'rejected') console.log('[DRM] schedule:', a.reason.message);
            if (b.status === 'rejected') console.log('[DRM] schedule:', b.reason.message);
            if ((drmrx && drmrx.length) || (kiwi && kiwi.length)) {
                cache = mergeSchedule(drmrx, kiwi, hfcc);
                cachedAt = Date.now();
            } else {
                nextTry = Date.now() + RETRY_MS;
            }
            inflight = null;
        })();
    }
    await inflight;
    return cache;
}
