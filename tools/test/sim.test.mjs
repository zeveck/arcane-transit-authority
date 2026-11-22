// Determinism, snapshot round-trip, card kinds and their carries, the Rift rule, the one earth rule, bottlenecks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../../game/src/sim.js';
import { cellMeta, getCells, hexDistances } from '../../game/src/planet.js';
import { angleDeg } from '../../game/src/geo.js';
import { lineGeo } from '../../game/src/network.js';

const meta = cellMeta(), cells = getCells();
const T = meta.tutorial;
function pick(pred) { for (const a of cells) for (const b of cells) if (a.id < b.id && pred(a, b)) return [a.id, b.id]; return null; }

function playScript(g, script, until) {
  for (const [t, a] of script) { g.stepTo(t); g.act(a); }
  g.stepTo(until);
}
const SCRIPT = [ // the tutorial's order (tools/solve.mjs tutorialScript), the crossing at a fixed time
  [20, { type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }],
  [120, { type: 'buildRoute', a: meta.capitalCentre, b: { station: 1 }, kind: 'earth' }],
  [210, { type: 'addTrain', line: 0 }],
  [300, { type: 'buildRoute', a: T.peaks[0], b: T.peaks[1], kind: 'sky' }],
  [390, { type: 'green', cell: T.path[1], kind: 'park' }],
  [660, { type: 'buildRoute', a: { station: 1 }, b: { station: 0 }, kind: 'core' }],
];

test('determinism: same seed + same actions → same hash', () => {
  const a = Game.newTerm({ tutorial: true }), b = Game.newTerm({ tutorial: true });
  playScript(a, SCRIPT, 900); playScript(b, SCRIPT, 900);
  assert.equal(a.hash(), b.hash());
  const c = Game.newTerm({ charter: 'VI', region: 'ringside', termSeed: 77 }), d = Game.newTerm({ charter: 'VI', region: 'ringside', termSeed: 77 });
  c.step(400); d.step(400);
  assert.equal(c.hash(), d.hash());
  const e = Game.newTerm({ charter: 'VI', region: 'ringside', termSeed: 78 }); e.step(400);
  assert.notEqual(c.hash(), e.hash());
});

test('tutorial: every step is paid (no free crossing); the crossing is affordable by 11 min and emits firstCrossing', () => {
  const g = Game.newTerm({ tutorial: true });
  const built = [];
  for (const [t, a] of SCRIPT) { g.stepTo(t); g.drainEvents(); const r = g.act(a); assert.ok(r.ok, `${a.type} ${a.kind || ''} at ${t}: ${r.reason}`); assert.ok(r.cost > 0); built.push(...g.drainEvents().filter((e) => e.type === 'built')); }
  assert.ok(g.s.firstCrossingUsed);
  assert.deepEqual(built.map((e) => e.firstCrossing), [false, false, false, true]);
  assert.equal(built[3].kind, 'core');
  assert.ok(g.s.money >= 0, 'no debt in the tutorial');
});

test('snapshot round-trip: a restored term gives the same hash after the same steps', () => {
  const g = Game.newTerm({ charter: 'III', region: 'rift', termSeed: 11 });
  g.s.money = 50000;
  const [x, y] = pick((p, q) => p.areaId === 'rift' && q.areaId === 'rift' && p.isCity && q.isCity && angleDeg(p.pos, q.pos) > 15 && angleDeg(p.pos, q.pos) < 25);
  g.step(20);
  assert.ok(g.act({ type: 'buildRoute', a: x, b: y, kind: 'earth' }).ok);
  assert.ok(g.act({ type: 'buildRoute', a: x, b: meta.terminal, kind: 'core' }).ok);
  g.step(500);
  const snap = JSON.stringify(g.snapshot());
  const r = Game.restore(snap);
  assert.equal(r.hash(), g.hash());
  g.step(700); r.step(700);
  assert.equal(r.hash(), g.hash());
  g.act({ type: 'addTrain', line: 0 }); r.act({ type: 'addTrain', line: 0 });
  g.step(300); r.step(300);
  assert.equal(r.hash(), g.hash());
});

const PAIRS = {
  surface: () => pick((a, b) => a.areaId === 'farwards' && b.areaId === 'farwards' && a.isCity && b.isCity && hexDistances(a.id, 4)[b.id] === 4),
  sky: () => pick((a, b) => a.peak && b.peak && a.areaId === 'spires' && b.areaId === 'spires' && angleDeg(a.pos, b.pos) > 15 && angleDeg(a.pos, b.pos) < 30),
  water: () => pick((a, b) => a.terrainName === 'atlantis' && b.coastal && angleDeg(a.pos, b.pos) > 20 && angleDeg(a.pos, b.pos) < 40),
  earth: () => pick((a, b) => a.areaId === 'farwards' && b.areaId === 'farwards' && a.isCity && b.isCity && angleDeg(a.pos, b.pos) > 40 && angleDeg(a.pos, b.pos) < 60),
  core: () => pick((a, b) => a.areaId === 'farwards' && b.areaId === 'flats' && a.isCity && b.isCity && angleDeg(a.pos, b.pos) > 120),
  space: () => pick((a, b) => a.areaId === 'ringside' && b.areaId === 'ringside' && a.isCity && b.isCity && angleDeg(a.pos, b.pos) > 90),
};
for (const kind of Object.keys(PAIRS)) {
  test(`card ${kind}: buildable, and carries ≈ its "carries" when saturated (±5%)`, () => {
    const [a, b] = PAIRS[kind]();
    const g = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 5, noDisasters: true, noInherited: true, genScale: 40 });
    g.s.money = 1e6;
    if (kind === 'water') {
      const locked = g.routeCards(a, b).find((c) => c.kind === 'water');
      assert.ok(locked.locked && locked.lockTech === 'seaStations' && /Sea Stations/.test(locked.reason));
      assert.ok(g.act({ type: 'buyTech', id: 'seaStations' }).ok);
    }
    if (kind === 'space') {
      const locked = g.routeCards(a, b).find((c) => c.kind === 'space');
      assert.ok(locked.locked && locked.lockTech === 'spaceElevators');
      assert.ok(g.act({ type: 'buyTech', id: 'spaceElevators' }).ok);
    }
    const card = g.routeCards(a, b).find((c) => c.kind === kind);
    assert.ok(card.feasible, card.reason);
    const r = g.act({ type: 'buildRoute', a, b, kind });
    assert.ok(r.ok, r.reason);
    g.step(300);
    const ls = g.lines().filter((l) => r.lines.includes(l.id));
    const flow = Math.min(...ls.map((l) => Math.max(...l.flowEach)));
    assert.ok(Math.abs(flow - card.carries) <= 0.05 * card.carries, `flow ${flow} vs carries ${card.carries}`);
  });
}

test('hybrid card: a surface feeder onto an existing Core Exchange', () => {
  const g = Game.newTerm({ charter: 'I', region: 'flats', termSeed: 3, noDisasters: true, noInherited: true });
  g.s.money = 1e6;
  const fw = cells.filter((c) => c.areaId === 'farwards' && c.isCity);
  const s0 = fw[10].id;
  const capCell = cells.find((c) => c.areaId === 'capital' && c.isCity).id;
  assert.ok(g.act({ type: 'buildRoute', a: s0, b: capCell, kind: 'core' }).ok);
  let found = null;
  for (const dd of [2, 3, 4]) {
    const d = hexDistances(s0, dd);
    for (const e of cells.filter((c) => d[c.id] === dd && c.isCity)) {
      for (const far of cells.filter((c) => c.areaId === 'capital' && c.isCity && c.id !== capCell)) {
        const h = g.routeCards(e.id, far.id, { withExports: false }).find((c) => c.kind === 'hybrid');
        if (h.feasible) { found = { e: e.id, far: far.id, h }; break; }
      }
      if (found) break;
    }
    if (found) break;
  }
  assert.ok(found, 'no hybrid card found');
  assert.equal(found.h.legs[0].type, 'surface');
  assert.ok(g.act({ type: 'buildRoute', a: found.e, b: found.far, kind: 'hybrid' }).ok);
});

test('the Rift rule: Core Exchange half price, shaft x1.5 speed (240/min with 2 trains); Rift earth stops at 64°', async () => {
  const { TYPES } = await import('../../game/src/tuning.js');
  const g = Game.newTerm({ charter: 'I', region: 'rift', termSeed: 9, noDisasters: true, noInherited: true });
  g.s.money = 1e6;
  const rift = meta.starts.rift;
  const other = cells.find((c) => c.areaId === 'farwards' && c.isCity && angleDeg(c.pos, cells[rift].pos) > 100).id;
  const card = g.routeCards(rift, other).find((c) => c.kind === 'core');
  assert.ok(card.feasible);
  assert.ok(g.act({ type: 'buildRoute', a: rift, b: other, kind: 'core' }).ok);
  for (const l of g.lines().filter((x) => x.shaft)) while (g.s.lines[l.id].trains < 2) g.act({ type: 'addTrain', line: l.id }); // new shafts start with SHAFT_TRAINS
  const shafts = g.lines().filter((l) => l.shaft);
  const caps = shafts.map((l) => l.capacity).sort((a, b) => a - b);
  assert.deepEqual(caps, [169, 240]); // shafts keep 4 cars (TYPES.earth.shaftCars); earth chords have 3
  const cores = g.stations().filter((s) => s.kind === 'core');
  assert.equal(cores.length, 2);
  // price: rift Core Exchange $450 vs $900 elsewhere
  const g2 = Game.newTerm({ charter: 'I', region: 'rift', termSeed: 9, noDisasters: true, noInherited: true });
  const c2 = g2.routeCards(rift, other).find((c) => c.kind === 'core');
  const otherRift = cells.find((c) => c.areaId === 'farwards' && c.isCity && angleDeg(c.pos, cells[other].pos) > 100).id;
  const c3 = g2.routeCards(otherRift, other).find((c) => c.kind === 'core');
  // the difference between a card with a Rift end and one without is the $450 Core Exchange discount (+ track length)
  assert.ok(c2.breakdown.stations < c3.breakdown.stations, `${c2.breakdown.stations} vs ${c3.breakdown.stations}`);
  assert.equal(c3.breakdown.stations - c2.breakdown.stations, TYPES.fire.station - TYPES.fire.stationRift);
  // Rift earth limit
  const far = cells.find((c) => c.isCity && c.areaId !== 'rift' && angleDeg(c.pos, cells[rift].pos) > 66 && angleDeg(c.pos, cells[rift].pos) < 80).id;
  const e = g2.routeCards(rift, far).find((c) => c.kind === 'earth');
  assert.ok(!e.feasible && /Rift's thin crust allows 64°/.test(e.reason), e.reason);
});

test('Flats demolition is x1.8', () => {
  const g = Game.newTerm({ charter: 'I', region: 'flats', termSeed: 9, noInherited: true });
  const c = cells.find((x) => x.areaId === 'flats' && x.isCity);
  const cap = cells.find((x) => x.areaId === 'ringside' && x.isCity && g.s.densities[x.id] === g.s.densities[c.id]);
  const info = g.cells((x) => x.id === c.id || x.id === cap.id);
  const pf = info.find((x) => x.id === c.id).demolitionPrice, pr = info.find((x) => x.id === cap.id).demolitionPrice;
  assert.equal(pf, Math.round(pr * 1.8));
});

test('one earth rule: every shaft is 63 units, portals at radius 100, including mountain stations', () => {
  const g = Game.newTerm({ charter: 'I', region: 'spires', termSeed: 4, noDisasters: true, noInherited: true });
  g.s.money = 1e6;
  const mtn = cells.find((c) => c.terrainName === 'mountain' && !c.peak && c.areaId === 'spires');
  const far = cells.find((c) => c.isCity && c.areaId === 'brine' && angleDeg(c.pos, mtn.pos) > 90);
  const r = g.act({ type: 'buildRoute', a: mtn.id, b: far.id, kind: 'core' });
  assert.ok(r.ok, r.reason);
  for (const l of g.lines().filter((x) => x.shaft)) {
    assert.ok(Math.abs(l.length - 63) < 1e-6, 'shaft length ' + l.length);
    const geo = g.lineSamples(l.id);
    const top = Math.hypot(geo.samples[0], geo.samples[1], geo.samples[2]);
    assert.ok(Math.abs(top - 100) < 1e-3, 'portal radius ' + top);
  }
  assert.ok(g.stationWells().some((w) => w.station === r.stations.find((id) => g.s.stations[id].cell === mtn.id)));
});

test('a station outside the Terminal component makes no exports; bottleneck names unlinked stations', () => {
  const g = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 5, noDisasters: true, noInherited: true });
  g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' });
  const made0 = g.breakdown().made; // the Terminal's own catchment only
  g.step(120);
  assert.equal(g.breakdown().made, made0);
  assert.equal(g.breakdown().bottleneck.kind, 'unlinked');
  assert.ok(g.stations().some((s) => !s.linkedToTerminal));
});

test('bottleneck: districts, an interchange, the warp ring', () => {
  // districts: a small linked network with spare capacity
  const g = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 5, noDisasters: true, noInherited: true });
  g.act({ type: 'buildRoute', a: T.a, b: meta.terminal, kind: 'core' });
  g.step(300);
  assert.equal(g.breakdown().bottleneck.kind, 'districts');
  // interchange: heavy feeders onto one station's transfer (120/min)
  const h = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 5, noDisasters: true, noInherited: true, genScale: 20 });
  h.s.money = 1e6;
  h.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' });
  h.act({ type: 'addTrain', line: 0 }); h.act({ type: 'addTrain', line: 0 });
  h.act({ type: 'buildRoute', a: { station: 1 }, b: meta.terminal, kind: 'core' });
  for (let k = 0; k < 6; k++) { h.act({ type: 'addTrain', line: 1 }); h.act({ type: 'addTrain', line: 2 }); h.act({ type: 'addTrain', line: 0 }); }
  h.step(400);
  const bh = h.breakdown().bottleneck;
  assert.equal(bh.kind, 'interchange', JSON.stringify(bh));
  // warp ring: far more exports reaching the yard than deep space can lift
  const w = Game.newTerm({ charter: 'I', region: 'ringside', termSeed: 5, noDisasters: true, noInherited: true, genScale: 80 });
  w.s.money = 1e6;
  const near = cells.filter((c) => c.isCity && hexDistances(meta.terminal, 1)[c.id] === 1);
  w.step(240);
  const bw = w.breakdown();
  assert.equal(bw.bottleneck.kind, 'warp', JSON.stringify(bw));
});
