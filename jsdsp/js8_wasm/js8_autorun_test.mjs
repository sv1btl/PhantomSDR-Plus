/**
 * js8_autorun_test.mjs — the headless spotting path.
 *
 * Two halves:
 *
 *  1. WHAT IS SPOTTABLE. parseJs8Spot decides which decoded frames become
 *     PSK Reporter spots. Getting it wrong is worse than most bugs here,
 *     because the result is bad data on someone else's map: @ALLCALL is a
 *     destination, not a station, and <....> is a callsign the decoder could
 *     not resolve. Neither must ever be uploaded.
 *
 *  2. THE WORKER PATH. autorun/decodeworker.js runs under node worker_threads
 *     with a fetch shim standing in for the browser, so it is a genuinely
 *     different environment from the browser bridge. This drives real
 *     synthesised JS8 audio through it and checks structured frames come back.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const WORK = process.env.JS8_WORK || '/tmp/js8-phase0';

const { parseJs8Spot } = await import(join(ROOT, 'autorun/spotparse.js'));
const { DIAL } = await import(join(ROOT, 'autorun/bandplan.js'));
const { MODE_TIMING } = await import(join(ROOT, 'autorun/manager.js'));

let fail = 0;
function check(name, ok, detail) {
  if (!ok) { fail++; console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`); }
  else console.log(`  ok   ${name}`);
}

/* ── 1. what is spottable ────────────────────────────────────────────────── */

console.log('spot eligibility');

const cases = [
  ['heartbeat with grid',
    { kind: 'heartbeat', from: 'SV1BTL', grid: 'KM17' }, { call: 'SV1BTL', grid: 'KM17' }],
  ['heartbeat, compound call',
    { kind: 'heartbeat', from: 'VE7/KN4CRD', grid: 'CN89' }, { call: 'VE7/KN4CRD', grid: 'CN89' }],
  ['heartbeat without grid',
    { kind: 'heartbeat', from: 'K0OG', grid: '' }, { call: 'K0OG', grid: null }],
  ['directed: sender is spottable, no grid',
    { kind: 'directed', from: 'KN4CRD', to: 'K0OG', grid: null }, { call: 'KN4CRD', grid: null }],
  ['directed to a group still spots the sender',
    { kind: 'directed', from: 'W0FW', to: '@ALLCALL', grid: null }, { call: 'W0FW', grid: null }],
  ['compound with grid',
    { kind: 'compound', from: 'M0IAX', grid: 'IO91' }, { call: 'M0IAX', grid: 'IO91' }],
  ['group call is NOT a station',
    { kind: 'directed', from: '@ALLCALL', to: 'K0OG' }, null],
  ['JS8NET group is NOT a station',
    { kind: 'heartbeat', from: '@JS8NET', grid: 'EM73' }, null],
  ['unresolved callsign is NOT spottable',
    { kind: 'directed', from: '<....>', to: 'K0OG' }, null],
  ['data frame carries no callsign',
    { kind: 'data', from: null, text: 'HELLO WORLD' }, null],
  ['garbage without a digit is rejected',
    { kind: 'heartbeat', from: 'ABCDEF', grid: 'AA00' }, null],
  ['garbage without a letter is rejected',
    { kind: 'heartbeat', from: '123456', grid: 'AA00' }, null],
  ['a report is not a grid',
    { kind: 'heartbeat', from: 'K0OG', grid: 'RR73' }, { call: 'K0OG', grid: null }],
  ['empty sender', { kind: 'heartbeat', from: '', grid: 'KM17' }, null],
];

for (const [name, frame, want] of cases) {
  const got = parseJs8Spot(frame);
  const ok = want === null
    ? got === null
    : got !== null && got.call === want.call && got.grid === want.grid;
  check(name, ok, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ── bandplan and timing ─────────────────────────────────────────────────── */

console.log('\nbandplan');
// Straight from JS8Call's FrequencyList.cpp. 6m and 2m are in that list too but
// sit above the RX888's 30 MHz Nyquist.
const WANT_DIAL = {
  '160m': 1842000, '80m': 3578000, '40m': 7078000, '30m': 10130000,
  '20m': 14078000, '17m': 18104000, '15m': 21078000, '12m': 24922000,
  '10m': 28078000,
};
check(`${Object.keys(DIAL.js8).length} JS8 bands`,
  Object.keys(DIAL.js8).length === Object.keys(WANT_DIAL).length);
for (const [band, hz] of Object.entries(WANT_DIAL)) {
  check(`${band.padEnd(5)} ${hz / 1000} kHz`, DIAL.js8[band] === hz,
    `got ${DIAL.js8[band]}`);
}
check('every JS8 dial is below 30 MHz',
  Object.values(DIAL.js8).every((hz) => hz < 30_000_000));
check('js8 slot timing is the 15 s Normal cycle',
  MODE_TIMING.js8 && MODE_TIMING.js8.periodS === 15);

/* ── 2. the worker path ──────────────────────────────────────────────────── */

console.log('\nautorun decode worker');

const HELPER = join(WORK, 'js8_decode_test');
if (!existsSync(HELPER)) {
  console.log('  skipped: run ./run_tests.sh first to build the audio helper');
} else {
  // A real heartbeat frame, as JS8Call packed it: KN4CRD in EM73.
  const pcmPath = join(WORK, 'autorun_hb.f32');
  execFileSync(HELPER, ['--dumpframe', '2Y-pe-ukukfO', '3', '0', pcmPath]);
  const pcm = new Float32Array(readFileSync(pcmPath).buffer);

  const results = await new Promise((resolve, reject) => {
    const w = new Worker(join(ROOT, 'autorun/decodeworker.js'));
    const timer = setTimeout(() => { w.terminate(); reject(new Error('worker timeout')); }, 60000);
    w.on('message', (msg) => {
      clearTimeout(timer);
      w.terminate();
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.results);
    });
    w.on('error', (e) => { clearTimeout(timer); reject(e); });
    w.postMessage({ id: 1, type: 'js8', pcm, sampleRate: 12000, submode: 0 });
  }).catch((e) => { console.log(`  FAIL worker: ${e.message}`); fail++; return null; });

  if (results) {
    const hb = results.find((r) => r.kind === 'heartbeat');
    check('worker returns a structured heartbeat', !!hb,
      `got ${JSON.stringify(results.map((r) => r.kind))}`);
    if (hb) {
      check('heartbeat decodes to KN4CRD EM73',
        hb.from === 'KN4CRD' && hb.grid === 'EM73', JSON.stringify(hb));
      check('frame carries freq/snr for the reporter',
        Number.isFinite(hb.freq) && Number.isFinite(hb.snr),
        `freq ${hb.freq} snr ${hb.snr}`);
      const spot = parseJs8Spot(hb);
      check('and it is spottable as KN4CRD/EM73',
        spot && spot.call === 'KN4CRD' && spot.grid === 'EM73', JSON.stringify(spot));
    }
  }
}

console.log(fail ? `\n*** ${fail} failures ***` : '\nall autorun tests passed');
process.exit(fail ? 1 : 0);
