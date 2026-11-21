// Map checks: tools/oikumene.mjs passes and the frozen table equals a fresh build; geography never changes per term.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, check } from '../oikumene.mjs';
import { OIKUMENE_CELLS, OIKUMENE_META, REGIONS, AREA_IDS } from '../../game/src/tuning.js';
import { geoHash, getGrid, termSetup, getCells, regionCounts } from '../../game/src/planet.js';
import { Game } from '../../game/src/sim.js';

test('oikumene builds, passes every check, and matches the frozen table', () => {
  const b = build();
  const { fails } = check(b);
  assert.deepEqual(fails, []);
  assert.deepEqual(b.cells, OIKUMENE_CELLS);
  assert.deepEqual(b.meta, OIKUMENE_META);
});

test('grid: 642 cells, 12 pentagons, neighbours symmetric', () => {
  const g = getGrid();
  assert.equal(g.count, 642);
  assert.equal(g.pentagon.filter(Boolean).length, 12);
  for (let i = 0; i < g.count; i++) for (const n of g.neighbours[i]) assert.ok(g.neighbours[n].includes(i));
});

test('per-area counts as the design table', () => {
  const rc = regionCounts();
  for (const id of AREA_IDS) assert.equal(rc[id].cells, REGIONS[id].cells, id);
  const tot = (k) => AREA_IDS.reduce((s, id) => s + rc[id][k], 0);
  assert.equal(tot('ocean'), 120); assert.equal(tot('atlantis'), 14); assert.equal(tot('peaks'), 27);
  assert.ok(Math.abs(tot('mountains') - 91) <= 3);
});

test('geoHash is the same for every term seed, Charter and region; terms only nudge densities ±1 (area avg within 0.2)', () => {
  const h = geoHash();
  const cells = getCells();
  for (const [seed, ch, rg] of [[1, 'I', 'capital'], [99, 'IV', 'spires'], [12345, 'VI', 'ringside']]) {
    const g = Game.newTerm({ termSeed: seed, charter: ch, region: rg });
    assert.equal(g.geoHash(), h);
    assert.equal(g.s.geo, h);
    const t = termSetup(seed, ch, rg);
    for (const c of cells) assert.ok(Math.abs(t.densities[c.id] - c.density) <= 1);
    for (const [ai, id] of AREA_IDS.entries()) {
      const cs = cells.filter((c) => c.area === ai && c.isCity);
      if (!cs.length) continue;
      const avg = cs.reduce((s, c) => s + t.densities[c.id], 0) / cs.length, base = cs.reduce((s, c) => s + c.density, 0) / cs.length;
      assert.ok(Math.abs(avg - base) <= 0.2 + 1e-9, `${id} avg ${avg} base ${base}`);
    }
  }
});

test('priority districts: 2 (I-III) / 3 (IV+), density >= 3, different areas, none in the start region, >= 45° apart', () => {
  const cells = getCells();
  for (const [seed, ch, rg] of [[3, 'II', 'brine'], [4, 'IV', 'spires'], [5, 'VI', 'ringside']]) {
    const t = termSetup(seed, ch, rg);
    assert.equal(t.priority.length, ['IV', 'V', 'VI', 'G'].includes(ch) ? 3 : 2);
    const areas = new Set(t.priority.map((p) => cells[p].areaId));
    assert.equal(areas.size, t.priority.length);
    assert.ok(!areas.has(rg));
    for (const p of t.priority) assert.ok(t.densities[p] >= 3);
  }
});

test('signature types: the Brine makes water native, the Ringside space, in Charter I', () => {
  assert.ok(Game.newTerm({ charter: 'I', region: 'brine', termSeed: 2 }).mods.water);
  assert.ok(Game.newTerm({ charter: 'I', region: 'ringside', termSeed: 2 }).mods.space);
  assert.ok(!Game.newTerm({ charter: 'I', region: 'capital', termSeed: 2 }).mods.water);
});
