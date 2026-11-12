// node autorun/scheduler.test.mjs — offline checks of the hourly schedule
// (scheduler.js) and of AutorunManager.setSlots. No receiver needed: the
// manager part points its taps at a closed port, so they die at once.
import assert from 'node:assert/strict';
import {
    wantOpen, inSchedule, desiredSlots, activeSlots, nextChangeAt,
    concurrencyByHour, normHours, hoursLabel, preRollS, GRACE_S,
} from './scheduler.js';
import { AutorunManager, REOPEN_MS } from './manager.js';

const at = (hh, mm = 0, ss = 0) => Date.UTC(2026, 10, 12, hh, mm, ss);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok', name); };

const ft8day = { band: '20m', mode: 'ft8', enabled: true, hours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] };
const wsprNight = { band: '80m', mode: 'wspr', enabled: true, hours: [22, 23, 0, 1, 2, 3] };
const allDay = { band: '40m', mode: 'ft4', enabled: true };
const never = { band: '30m', mode: 'js8', enabled: true, hours: [] };
const off = { band: '17m', mode: 'ft8', enabled: false };

console.log('scheduler');
ok('normHours', () => {
    assert.equal(normHours(undefined), null);
    assert.deepEqual(normHours([3, 1, 1, 25, -1, 'x', '2']), [1, 2, 3]);
});
ok('inside / outside hours', () => {
    assert.ok(wantOpen(ft8day, at(10, 30)));
    assert.ok(!wantOpen(ft8day, at(3)));
    assert.ok(wantOpen(allDay, at(3)));
    assert.ok(!wantOpen(never, at(12)));
});
ok('pre-roll opens before the first hour', () => {
    const pr = preRollS('ft8');                      // 25 s
    assert.ok(wantOpen(ft8day, at(6) - (pr - 1) * 1000));
    assert.ok(!wantOpen(ft8day, at(6) - (pr + 1) * 1000));
    const wpr = preRollS('wspr');                    // 126 s
    assert.ok(wpr >= 120);
    assert.ok(wantOpen(wsprNight, at(22) - (wpr - 1) * 1000));
});
ok('grace keeps the tap for the HH:00 decode', () => {
    assert.ok(wantOpen(ft8day, at(18, 0, GRACE_S - 1)));
    assert.ok(!wantOpen(ft8day, at(18, 0, GRACE_S + 1)));
});
ok('schedule across midnight', () => {
    assert.ok(wantOpen(wsprNight, at(23, 59)));
    assert.ok(wantOpen(wsprNight, at(0, 30)));
    assert.ok(!wantOpen(wsprNight, at(12)));
});
ok('decode gate: last cycle in, pre-roll cycle out', () => {
    // cycle 17:59:45 is the hour's last → kept; 05:59:45 (pre-roll) → skipped
    assert.ok(inSchedule(ft8day, at(17, 59, 45) / 1000));
    assert.ok(!inSchedule(ft8day, at(5, 59, 45) / 1000));
    assert.ok(inSchedule(ft8day, at(6, 0, 0) / 1000));
    assert.ok(!inSchedule(ft8day, at(18, 0, 0) / 1000));
});
ok('desired / active sets', () => {
    const all = [ft8day, wsprNight, allDay, never, off];
    const keys = (a) => a.map((s) => `${s.mode}:${s.band}`).sort();
    assert.deepEqual(keys(desiredSlots(all, at(12))), ['ft4:40m', 'ft8:20m']);
    assert.deepEqual(keys(desiredSlots(all, at(1))), ['ft4:40m', 'wspr:80m']);
    assert.deepEqual(keys(activeSlots(all, at(21, 58))), ['ft4:40m']);
    assert.deepEqual(keys(desiredSlots(all, at(21, 58))), ['ft4:40m', 'wspr:80m']); // pre-roll
});
ok('nextChangeAt', () => {
    const all = [ft8day, wsprNight, allDay];
    assert.equal(nextChangeAt(all, at(12, 10)), at(18));
    assert.equal(nextChangeAt(all, at(19)), at(22));
    assert.equal(nextChangeAt([allDay], at(5)), null);
});
ok('concurrencyByHour', () => {
    const c = concurrencyByHour([ft8day, wsprNight, allDay, never, off]);
    assert.equal(c.length, 24);
    assert.equal(c[12], 2); assert.equal(c[0], 2); assert.equal(c[19], 1);
});
ok('hoursLabel', () => {
    assert.equal(hoursLabel(undefined), 'all day');
    assert.equal(hoursLabel([]), 'never');
    assert.equal(hoursLabel([0, 1, 2, 3, 22, 23]), '00-03,22-23 UTC');
    assert.equal(hoursLabel([5]), '05 UTC');
});

console.log('manager.setSlots');
const mgr = new AutorunManager({ slots: [], poolSize: 1, host: '127.0.0.1', port: 1 });
mgr.on('error', () => {});
const closed = new Promise((r) => mgr.once('closed', r));
let r = mgr.setSlots([{ band: '20m', mode: 'ft8' }, { band: '40m', mode: 'ft4' }]);
ok('adds missing slots', () => assert.deepEqual(r.added.sort(), ['ft4:40m', 'ft8:20m']));
r = mgr.setSlots([{ band: '20m', mode: 'ft8' }]);
ok('removes unwanted slots', () => {
    assert.deepEqual(r.removed, ['ft4:40m']);
    assert.deepEqual(mgr.keys(), ['ft8:20m']);
});
await closed;   // the tap to port 1 dies
const deadAt = mgr.slots[0].deadAt;
r = mgr.setSlots([{ band: '20m', mode: 'ft8' }], deadAt + 1000);
ok('dead tap not reopened before REOPEN_MS', () => assert.deepEqual(r.added, []));
r = mgr.setSlots([{ band: '20m', mode: 'ft8' }], deadAt + REOPEN_MS);
ok('dead tap reopened after REOPEN_MS', () => {
    assert.deepEqual(r.added, ['ft8:20m']);
    assert.equal(mgr.slots.length, 1);
    assert.equal(mgr.slots[0].dead, false);
});
await mgr.stop();
console.log(`${n} checks passed`);
