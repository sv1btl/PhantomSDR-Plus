/**
 * scheduler.js — which autorun slots should be running at a given moment.
 *
 * A slot in autorun.json may carry `hours`: the UTC hours (0..23) in which it
 * decodes and spots. No `hours` field means all day (the behaviour before
 * schedules existed); an empty list means never.
 *
 * Opening a slot exactly at HH:00 would lose the first cycle, because a decode
 * needs a full window of audio already buffered (15 s FT8/JS8, 7.5 s FT4,
 * 116 s WSPR). So a slot's tap opens PRE-ROLL seconds before its first hour,
 * and closes a few GRACE seconds after its last hour, once the decode at the
 * HH:00 boundary (which covers the last cycle of the hour) has taken its window.
 *
 * Decodes that fall outside the schedule are skipped (inSchedule): the pre-roll
 * minute's own cycle, which belongs to the hour before, is never reported.
 *
 * Everything here is pure (time in, answer out) so it can be tested with a fake
 * clock — see scheduler.test.mjs.
 */
import { MODE_TIMING } from './manager.js';

/** Seconds a slot's tap stays open after its last scheduled hour ends. */
export const GRACE_S = 8;
/** Extra seconds of pre-roll on top of the decode window (tap connect + tune). */
export const PREROLL_MARGIN_S = 10;

export const slotKey = (s) => `${s.mode}:${s.band}`;

/** Normalise an hours field: null = all day, else a sorted unique 0..23 list. */
export function normHours(hours) {
    if (hours === undefined || hours === null) return null;
    if (!Array.isArray(hours)) return null;
    const set = new Set();
    for (const h of hours) {
        const n = Number(h);
        if (Number.isInteger(n) && n >= 0 && n <= 23) set.add(n);
    }
    return [...set].sort((a, b) => a - b);
}

export function preRollS(mode) {
    const t = MODE_TIMING[mode];
    return (t ? t.windowS : 120) + PREROLL_MARGIN_S;
}

/** Is UTC hour-of-`ms` a scheduled hour for this slot? */
function hourOn(slot, ms) {
    const hours = normHours(slot.hours);
    if (hours === null) return true;
    return hours.includes(new Date(ms).getUTCHours());
}

/** Should this slot's tap be open at `nowMs` (incl. pre-roll and grace)? */
export function wantOpen(slot, nowMs) {
    return hourOn(slot, nowMs)
        || hourOn(slot, nowMs + preRollS(slot.mode) * 1000)
        || hourOn(slot, nowMs - GRACE_S * 1000);
}

/** Should a decode of the cycle that STARTED at `slotTimeS` (UTC s) be kept? */
export function inSchedule(slot, slotTimeS) {
    return hourOn(slot, slotTimeS * 1000);
}

/** The enabled slots whose taps should be open at `nowMs`. */
export function desiredSlots(slots, nowMs) {
    return slots.filter((s) => s.enabled !== false && wantOpen(s, nowMs));
}

/** Slots whose scheduled hour includes `nowMs` (no pre-roll/grace): "active now". */
export function activeSlots(slots, nowMs) {
    return slots.filter((s) => s.enabled !== false && hourOn(s, nowMs));
}

/**
 * Next time (ms) the set of ACTIVE slots changes, scanning hour starts for up
 * to 24 h. null when the schedule never changes (all-day or never).
 */
export function nextChangeAt(slots, nowMs) {
    const sig = (ms) => activeSlots(slots, ms).map(slotKey).sort().join(',');
    const cur = sig(nowMs);
    let t = Math.floor(nowMs / 3600000) * 3600000;
    for (let i = 1; i <= 24; i++) {
        t += 3600000;
        if (sig(t) !== cur) return t;
    }
    return null;
}

/** Peak number of slots active in each UTC hour (array of 24). */
export function concurrencyByHour(slots) {
    const out = new Array(24).fill(0);
    for (const s of slots) {
        if (s.enabled === false) continue;
        const hours = normHours(s.hours);
        for (let h = 0; h < 24; h++) if (hours === null || hours.includes(h)) out[h]++;
    }
    return out;
}

/** "all day", "never", or UTC ranges like "06-12,18-21" (end hour inclusive). */
export function hoursLabel(hours) {
    const h = normHours(hours);
    if (h === null || h.length === 24) return 'all day';
    if (h.length === 0) return 'never';
    const parts = [];
    let a = h[0], b = h[0];
    for (let i = 1; i <= h.length; i++) {
        if (i < h.length && h[i] === b + 1) { b = h[i]; continue; }
        const p = (n) => String(n).padStart(2, '0');
        parts.push(a === b ? p(a) : `${p(a)}-${p(b)}`);
        if (i < h.length) a = b = h[i];
    }
    return parts.join(',') + ' UTC';
}
