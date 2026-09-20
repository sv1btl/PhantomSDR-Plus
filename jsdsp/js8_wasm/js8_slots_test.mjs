/**
 * js8_slots_test.mjs — JS8 slot scheduling.
 *
 * Simulates the audio callback over many minutes and asserts the capture
 * windows land where they should. This exists because the FT8 path already hit
 * the failure mode once: an acceptance window slightly too wide lets the next
 * capture latch early, and every slot then creeps earlier until it wraps. The
 * symptom is "JS8 sometimes decodes badly", never an error, so it needs a test
 * rather than an inspection.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '../../frontend/src/modules');

const { js8Period, js8TxDur, js8CaptureSamples, js8SlotPos, js8StartWindow } =
  await import(join(MODULES, 'js8-slots.js'));
const { SUBMODE_NAMES, SUBMODE_PERIOD_S, SUBMODE_TXDUR_S } =
  await import(join(MODULES, 'js8-tables.js'));

let fail = 0;
function check(name, ok, detail) {
  if (!ok) { fail++; console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`); }
  else console.log(`  ok   ${name}`);
}

const SPS = 12000;

/**
 * Run the scheduler over `minutes` of simulated audio and report every capture.
 * Mirrors the structure of _ftxSlotStart / _ftxSlotFinish in audio.js: blocks
 * arrive, a window may open before the append, and may close after it.
 */
function simulate(submode, minutes, { shift = 0.8, blockSamples = 1024, startMs = 0 } = {}) {
  const period = js8Period(submode);
  const need = js8CaptureSamples(submode, SPS);
  const blockDur = blockSamples / SPS;
  const captures = [];

  let collecting = false;
  let acc = 0;
  let openedAt = 0;

  const totalBlocks = Math.floor((minutes * 60 * SPS) / blockSamples);
  for (let b = 0; b < totalBlocks; b++) {
    const nowMs = startMs + (b * blockSamples * 1000) / SPS;

    if (!collecting &&
        js8SlotPos(nowMs, period, shift) <= js8StartWindow(submode, blockDur)) {
      collecting = true;
      acc = 0;
      openedAt = nowMs;
    }
    if (collecting) acc += blockSamples;
    if (collecting && acc >= need) {
      collecting = false;
      captures.push({ openedAt, samples: acc });
    }
  }
  return { captures, period, need };
}

console.log('slot geometry');
for (let sm = 0; sm < SUBMODE_NAMES.length; sm++) {
  const period = js8Period(sm);
  const tx = js8TxDur(sm);
  const win = js8StartWindow(sm, 1024 / SPS);
  const capSec = js8CaptureSamples(sm, SPS) / SPS;
  // The capture must finish before the next boundary, with the acceptance
  // window still closed by then -- otherwise the creep starts.
  const endsAt = win + capSec;
  check(`${SUBMODE_NAMES[sm].padEnd(6)} cycle ${period}s tx ${tx}s capture ${capSec.toFixed(1)}s window ${win.toFixed(3)}s`,
    endsAt < period, `worst-case capture ends at ${endsAt.toFixed(2)}s of a ${period}s cycle`);
}

console.log('\nalignment over 10 simulated minutes');
for (let sm = 0; sm < SUBMODE_NAMES.length; sm++) {
  const { captures, period, need } = simulate(sm, 10);
  const expected = Math.floor((10 * 60) / period);

  // One capture per cycle, give or take the partial cycles at each end.
  const countOk = captures.length >= expected - 2 && captures.length <= expected;
  check(`${SUBMODE_NAMES[sm].padEnd(6)} ${captures.length} captures (expected ~${expected})`,
    countOk);

  // Every capture holds the full window.
  const shortOne = captures.find((c) => c.samples < need);
  check(`${SUBMODE_NAMES[sm].padEnd(6)} every capture is complete`, !shortOne,
    shortOne ? `one capture held ${shortOne.samples} of ${need} samples` : '');

  // No creep: the gap between consecutive captures must stay exactly one cycle.
  const gaps = captures.slice(1).map((c, i) => (c.openedAt - captures[i].openedAt) / 1000);
  const badGap = gaps.find((g) => Math.abs(g - period) > 0.2);
  check(`${SUBMODE_NAMES[sm].padEnd(6)} no drift between captures`, badGap === undefined,
    badGap !== undefined ? `saw a ${badGap.toFixed(2)}s gap in a ${period}s cycle` : '');

  // Captures start at the same phase of the cycle every time.
  const phases = captures.map((c) => js8SlotPos(c.openedAt, period, 0.8));
  const spread = Math.max(...phases) - Math.min(...phases);
  check(`${SUBMODE_NAMES[sm].padEnd(6)} start phase stable (spread ${spread.toFixed(3)}s)`,
    spread < 0.2);
}

console.log('\nrobustness');
{
  // Server block size is not fixed; a large block must not make slots skip.
  const { captures } = simulate(0, 10, { blockSamples: 4096 });
  check('large audio blocks still capture every cycle', captures.length >= 38,
    `${captures.length} captures in 10 minutes`);
}
{
  // Starting mid-cycle must not produce a truncated first capture.
  const { captures, need } = simulate(0, 5, { startMs: 7_123 });
  check('mid-cycle start yields only complete captures',
    captures.every((c) => c.samples >= need));
}
{
  // The lead-in is user- and auto-adjustable; the geometry must hold across it.
  let ok = true, why = '';
  for (const shift of [0, 0.2, 0.5, 0.8, 1.2, 2.0]) {
    const { captures, period } = simulate(0, 6, { shift });
    const gaps = captures.slice(1).map((c, i) => (c.openedAt - captures[i].openedAt) / 1000);
    if (gaps.some((g) => Math.abs(g - period) > 0.2)) { ok = false; why = `shift ${shift}`; }
  }
  check('holds for every capture lead-in', ok, why);
}
{
  // Slow is the odd one out: 28 s of signal in a 30 s cycle.
  check('Slow captures 27.6 s inside its 30 s cycle',
    SUBMODE_PERIOD_S[3] === 30 && SUBMODE_TXDUR_S[3] === 28 &&
    Math.abs(js8CaptureSamples(3, SPS) / SPS - 27.6) < 1e-6,
    `period ${SUBMODE_PERIOD_S[3]}, tx ${SUBMODE_TXDUR_S[3]}, capture ${js8CaptureSamples(3, SPS) / SPS}`);
}

console.log(fail ? `\n*** ${fail} failures ***` : '\nall slot tests passed');
process.exit(fail ? 1 : 0);
