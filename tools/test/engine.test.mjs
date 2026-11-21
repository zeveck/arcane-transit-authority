// Engine independence: all 36 Charter × region term starts (+ the six solution starts) hash as recorded in
// design/solutions/start-hashes.json (which the browser replay compares against), and the grid is the frozen one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeStartHashes } from '../starthashes.mjs';
import { getGrid } from '../../game/src/planet.js';
import { OIKUMENE_GRID } from '../../game/src/tuning.js';

test('the game reads the frozen grid (no trig at run time)', () => {
  assert.ok(OIKUMENE_GRID);
  assert.deepEqual(getGrid().pos, OIKUMENE_GRID.pos);
});

test('term starts and 300 s of each (43) match design/solutions/start-hashes.json', () => {
  const want = JSON.parse(fs.readFileSync(new URL('../../design/solutions/start-hashes.json', import.meta.url), 'utf8')).rows;
  const got = computeStartHashes();
  assert.equal(got.length, 43); // 36 Charter × region at seed 11 + the seven solution starts (I-VI, Galactic)
  got.forEach((r, i) => assert.deepEqual([r.charter, r.region, r.termSeed, r.start, r.after], [want[i].charter, want[i].region, want[i].termSeed, want[i].start, want[i].after]));
});

test('last-bit differences in Math trig (as between JS engines) do not change any hash', () => {
  const base = computeStartHashes();
  const fns = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'log', 'pow', 'hypot'];
  const orig = Object.fromEntries(fns.map((f) => [f, Math[f]]));
  const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
  const bump = (x, k) => { if (!Number.isFinite(x) || x === 0) return x; f64[0] = x; u64[0] += BigInt(k); return f64[0]; };
  for (const k of [1, -1]) {
    try {
      for (const f of fns) Math[f] = (...a) => bump(orig[f](...a), k);
      const got = computeStartHashes();
      got.forEach((r, i) => assert.deepEqual([r.start, r.after], [base[i].start, base[i].after], `${r.charter} ${r.region} with ${k} ulp`));
    } finally { for (const f of fns) Math[f] = orig[f]; }
  }
});

test('the recorded solutions (I-VI, Galactic) replay to the same quota hashes with last-bit trig differences', async () => {
  const { replay } = await import('../solve.mjs');
  const fns = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'log', 'pow', 'hypot'];
  const orig = Object.fromEntries(fns.map((f) => [f, Math[f]]));
  const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
  const bump = (x) => { if (!Number.isFinite(x) || x === 0) return x; f64[0] = x; u64[0] += 1n; return f64[0]; };
  for (const n of ['I', 'II', 'III', 'IV', 'V', 'VI', 'G']) {
    const sol = JSON.parse(fs.readFileSync(new URL(`../../design/solutions/charter-${n}.json`, import.meta.url), 'utf8'));
    try {
      for (const f of fns) Math[f] = (...a) => bump(orig[f](...a));
      const r = replay(sol);
      assert.ok(r.ok, `Charter ${n}: ${JSON.stringify(r.got)} vs ${JSON.stringify(r.want)}`);
    } finally { for (const f of fns) Math[f] = orig[f]; }
  }
});
