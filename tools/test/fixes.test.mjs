// Final-review fixes: Undo reverts only its own action; bottleneck fallback names the fullest line/station;
// route cards' export outcome; place names; free play; Terminal transfer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../../game/src/sim.js';
import { cellMeta, getCells, hexDistances } from '../../game/src/planet.js';

const meta = cellMeta(), cells = getCells();
const T = meta.tutorial;
const fresh = (o = {}) => Game.newTerm({ charter: 'I', region: 'capital', termSeed: 5, noDisasters: true, noInherited: true, ...o });
/** A city cell with no station, not demolished, away from the network. */
function freeCity(g, avoid = []) {
  return cells.find((c) => c.isCity && !g.s.demolished[c.id] && !g.s.green[c.id] && !g.s.stations.some((st) => st && st.cell === c.id) && !avoid.includes(c.id) && c.areaId === 'capital').id;
}

test('undo exploit: demolish, then removeTrain x2 on another line, then undo keeps the trains removed', () => {
  const g = fresh();
  g.s.money = 50000;
  assert.ok(g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  g.step(20); // past the build's window
  const c = freeCity(g);
  const m0 = g.s.money;
  const d = g.act({ type: 'demolish', cell: c }); assert.ok(d.ok);
  const r1 = g.act({ type: 'removeTrain', line: 0 }), r2 = g.act({ type: 'removeTrain', line: 0 });
  assert.ok(r1.ok && r2.ok);
  const u = g.act({ type: 'undo' }); assert.ok(u.ok, u.reason);
  assert.equal(g.s.lines[0].trains, 0, 'the removed trains stay removed');
  assert.equal(g.s.demolished[c], 0, 'the demolished cell rises again');
  assert.equal(g.s.money, m0 + r1.refund + r2.refund, 'money: the demolition refunded, the train refunds kept, nothing more');
});

test('undo exploit: removing the new line\'s trains clears the pending undo', () => {
  const g = fresh(); g.s.money = 50000;
  const b = g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }); assert.ok(b.ok);
  assert.ok(g.act({ type: 'removeTrain', line: b.lines[0] }).ok);
  assert.equal(g.state().undo, null);
  assert.equal(g.act({ type: 'undo' }).ok, false);
  assert.ok(g.s.lines[b.lines[0]], 'the line is still built');
});

test('undo of a build reverts only that build: an older line broken or emptied in the window stays so', () => {
  const g = fresh(); g.s.money = 50000;
  assert.ok(g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  g.step(15);
  const m0 = g.s.money, dem0 = g.s.demolished.slice(), sts0 = g.s.stations.length;
  const b = g.act({ type: 'buildRoute', a: { station: 1 }, b: meta.terminal, kind: 'core' }); assert.ok(b.ok && !b.free && b.cost > 0 && b.firstCrossing);
  assert.ok(g.s.firstCrossingUsed);
  g.s.lines[0].broken = { by: 'caveIn', cost: 100, seconds: 30 }; // damage on another line inside the window
  assert.ok(g.act({ type: 'removeTrain', line: 0 }).ok);
  const t0 = g.s.lines[0].trains, money = g.s.money;
  const u = g.act({ type: 'undo' }); assert.ok(u.ok, u.reason);
  assert.equal(g.s.lines.length, 1); assert.equal(g.s.stations.length, sts0);
  assert.equal(g.s.firstCrossingUsed, false, 'undone: the next core route is the first crossing again');
  assert.ok(g.s.lines[0].broken, 'the other line stays broken'); assert.equal(g.s.lines[0].trains, t0);
  assert.equal(g.s.money, money + b.cost);
  assert.deepEqual(g.s.demolished, dem0);
  g.step(5); // the sim runs on with the restored network
});

test('a disaster hit on the new line clears its undo', () => {
  const g = fresh(); g.s.money = 50000;
  const b = g.act({ type: 'buildRoute', a: meta.capitalCentre, b: T.a, kind: 'earth' }); assert.ok(b.ok, b.reason);
  const id = b.lines[0];
  g.s.dis.warning = { type: 'caveIn', target: id, targetRef: { kind: 'line', id }, at: g.s.time, hitAt: g.s.time + 1, braced: false, rerouted: false };
  g.step(2);
  assert.ok(g.s.lines[id].broken);
  assert.equal(g.state().undo, null);
});

test('normal undo of each undoable action', () => {
  // buildRoute (surface: stations, demolition, line)
  let g = fresh(); g.s.money = 50000;
  let m0 = g.s.money, dem0 = g.s.demolished.slice(), by0 = g.s.stats.demolishedByPlayer;
  let r = g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }); assert.ok(r.ok);
  assert.ok(g.act({ type: 'undo' }).ok);
  assert.equal(g.s.money, m0); assert.deepEqual(g.s.demolished, dem0); assert.equal(g.s.lines.length, 0); assert.equal(g.s.stations.length, 1);
  assert.equal(g.s.stats.demolishedByPlayer, by0);
  g.step(3);
  // addTrain
  g = fresh(); g.s.money = 50000;
  g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }); g.step(12);
  m0 = g.s.money;
  assert.ok(g.act({ type: 'addTrain', line: 0 }).ok); assert.equal(g.s.lines[0].trains, 3);
  assert.ok(g.act({ type: 'undo' }).ok); assert.equal(g.s.lines[0].trains, 2); assert.equal(g.s.money, m0);
  // upgradeInterchange
  m0 = g.s.money;
  assert.ok(g.act({ type: 'upgradeInterchange', station: 1 }).ok); assert.ok(g.s.stations[1].upgraded);
  assert.ok(g.act({ type: 'undo' }).ok); assert.equal(g.s.stations[1].upgraded, false); assert.equal(g.s.money, m0);
  // placeStation: a layer on an existing station, and a new station
  m0 = g.s.money;
  r = g.act({ type: 'placeStation', cell: g.s.stations[1].cell, layer: 'earth' }); assert.ok(r.ok, r.reason);
  assert.ok(g.s.stations[1].layers.includes('earth'));
  assert.ok(g.act({ type: 'undo' }).ok); assert.deepEqual(g.s.stations[1].layers, ['surface']); assert.equal(g.s.money, m0);
  const c = freeCity(g); const n0 = g.s.stations.length;
  r = g.act({ type: 'placeStation', cell: c, layer: 'earth' }); assert.ok(r.ok, r.reason); assert.equal(g.s.stations.length, n0 + 1);
  assert.ok(g.act({ type: 'undo' }).ok); assert.equal(g.s.stations.length, n0); assert.equal(g.s.money, m0);
  // demolish (two cells) and green (park, attraction)
  const c2 = freeCity(g, [c]);
  r = g.act({ type: 'demolish', cells: [c, c2] }); assert.ok(r.ok);
  assert.ok(g.act({ type: 'undo' }).ok); assert.equal(g.s.demolished[c], 0); assert.equal(g.s.demolished[c2], 0); assert.equal(g.s.money, m0);
  g.act({ type: 'demolish', cell: c }); g.step(12);
  m0 = g.s.money;
  assert.ok(g.act({ type: 'green', cell: c, kind: 'park' }).ok); assert.equal(g.s.green[c], 2);
  assert.ok(g.act({ type: 'undo' }).ok); assert.equal(g.s.green[c], 0); assert.equal(g.s.demolished[c], 1, 'the cell stays cleared'); assert.equal(g.s.money, m0);
  const nearLine = g.s.lines[0].cells.flatMap((x) => [x, ...cells[x].neighbours]).find((x) => cells[x].isCity && g.s.demolished[x] && !g.s.green[x] && !g.s.stations.some((st) => st && st.cell === x));
  if (nearLine != null) {
    assert.ok(g.act({ type: 'green', cell: nearLine, kind: 'attraction', look: 'wheel' }).ok);
    assert.ok(g.act({ type: 'undo' }).ok); assert.equal(g.s.attractions.length, 0); assert.equal(g.s.green[nearLine], 0); assert.equal(g.s.money, m0);
  }
  // the window closes after 10 s
  g.act({ type: 'addTrain', line: 0 }); g.step(12);
  assert.equal(g.act({ type: 'undo' }).ok, false);
});

test('throughput breakdown fallback: names the fullest line or interchange, else exports travelling', () => {
  const g = fresh(); g.s.money = 50000;
  const b = g.act({ type: 'buildRoute', a: T.a, b: meta.terminal, kind: 'core' }); assert.ok(b.ok);
  g.step(200);
  const made = g.breakdown().made; assert.ok(made > 1);
  const setup = () => { g.s.ema.reaching = 0.1 * made; g.stats.blockedX = new Map(); g.s.lineFlow.fill(0); g.stats.xferFlow = new Map(); };
  // a line at 100% load
  setup();
  const fire = g.lines().find((l) => l.type === 'fire');
  g.s.lineFlow[fire.id * 2] = fire.capacity;
  let bn = g.breakdown().bottleneck;
  assert.equal(bn.kind, 'line'); assert.deepEqual(bn.target, { line: fire.id });
  assert.ok(bn.text.includes(g.lineName(fire.id)) && bn.text.includes('100%'), bn.text);
  assert.ok(!/still on their way/.test(bn.text));
  // a station at its transfer cap
  setup();
  const core = g.stations().find((st) => st.kind === 'core');
  g.stats.xferFlow.set(core.id, core.capacity);
  bn = g.breakdown().bottleneck;
  assert.equal(bn.kind, 'interchange'); assert.ok(bn.text.includes(core.name), bn.text);
  // nothing full, exports on board: they are travelling
  setup();
  const k = Object.keys(g.s.inflight)[0] ?? String(g.s.time + 5); g.s.inflight[k] = g.s.inflight[k] || [0, 0, 0]; g.s.inflight[k][2] += 10;
  bn = g.breakdown().bottleneck;
  assert.equal(bn.kind, 'travelling'); assert.equal(bn.text, 'Limit: exports are still travelling to the Terminal');
  // nothing full and nothing in flight: not "travelling"
  setup(); for (const key in g.s.inflight) g.s.inflight[key][2] = 0;
  assert.notEqual(g.breakdown().bottleneck.kind, 'travelling');
});

test('route cards: explicit export outcome, "within 1 cell of"; firstCrossingUsed = a core route was built', () => {
  const g = fresh(); g.s.money = 1e6;
  const ab = g.routeCards(T.a, T.b).find((c) => c.kind === 'surface');
  assert.equal(ab.exportsGain, 0); assert.equal(ab.exportsNote, 'not linked to the Terminal');
  for (const c of g.routeCards(T.a, T.b)) assert.equal(typeof c.exportsGain, 'number');
  assert.equal(g.state().firstCrossingUsed, false); assert.equal('firstCrossingAvailable' in g.state(), false);
  g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' });
  const core = g.routeCards({ station: 1 }, meta.terminal).find((c) => c.kind === 'core');
  assert.ok(!core.free && core.cost > 0 && core.exportsGain > 5); assert.equal(core.exportsNote, null);
  g.act({ type: 'buildRoute', a: { station: 1 }, b: meta.terminal, kind: 'core' });
  assert.equal(g.state().firstCrossingUsed, true);
  g.step(60);
  // already served: a neighbour of the linked station
  const served = g.routeCards(cells[T.a].neighbours[0], meta.terminal).find((c) => c.feasible);
  assert.equal(served.exportsGain, 0); assert.equal(served.exportsNote, `already served by ${g.stationName(1)}`);
  // the same place, named
  const same = g.routeCards({ station: 1 }, cells[T.a].neighbours[1]).find((c) => c.kind === 'surface');
  assert.equal(same.reason, `Both ends are within 1 cell of ${g.stationName(1)}`);
  // a far district through the Terminal's (full) shaft
  const shaft = g.lines().find((l) => l.shaft && g.s.stations[l.a].parent === 0 || l.shaft && g.s.stations[l.b].parent === 0);
  g.s.lineFlow[shaft.id * 2] = g.s.lineFlow[shaft.id * 2 + 1] = shaft.capacity;
  const far = cells.filter((c) => c.isCity && c.areaId === 'flats' && !g.servedCell(c.id)).sort((a, b) => b.density - a.density)[0];
  const fc = g.routeCards(far.id, meta.terminal).find((c) => c.kind === 'core');
  assert.ok(fc.feasible, fc.reason);
  const run = g.lines().find((l) => l.type === 'fire');
  assert.equal(fc.exportsNote, `limited by the Terminal's shaft (shared with the ${run.name})`);
});

test('names: every cell named, unique; stations and lines named from cells and type; no hash change', async () => {
  const N = await import('../../game/src/names.js');
  const all = N.allCellNames();
  assert.equal(new Set(all).size, 642);
  assert.ok(!all.some((n) => /\d/.test(n)), 'no numbers in place names');
  assert.equal(all[meta.starts.brine], 'Saltmarch Island'); assert.equal(all[meta.starts.rift], 'Cinder Gate');
  assert.equal(all[meta.starts.spires], 'Hollowgate'); assert.equal(all[meta.starts.ringside], 'Ring Market'); assert.equal(all[meta.starts.capital], 'The Capital');
  assert.ok(T.peaks.every((p) => all[p].startsWith('Mount ')));
  assert.ok(T.atlantis.every((p) => all[p].startsWith('Atlantis ')));
  const g = fresh(); g.s.money = 1e6;
  const h0 = g.hash();
  g.cells(); g.places(); g.stations(); assert.equal(g.hash(), h0);
  g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' });
  g.act({ type: 'buildRoute', a: { station: 1 }, b: meta.terminal, kind: 'core' });
  g.act({ type: 'buildRoute', a: T.peaks[0], b: T.peaks[1], kind: 'sky' });
  const sts = g.stations(), lns = g.lines();
  assert.ok(sts.every((s) => typeof s.name === 'string' && s.name.length));
  assert.equal(new Set(sts.map((s) => s.name)).size, sts.length);
  assert.equal(sts.find((s) => s.id === 1).name, all[T.a] + ' Station');
  assert.ok(sts.some((s) => s.name === all[T.peaks[0]] + ' Sky Port'));
  assert.ok(sts.some((s) => s.kind === 'core' && s.name === all[T.a] + ' Core Exchange'));
  assert.ok(lns.some((l) => l.type === 'surface' && l.name === `${N.cellShort(T.a)}–${N.cellShort(T.b)} Maglev`));
  assert.ok(lns.some((l) => l.type === 'fire' && l.name.endsWith(' Core Run')));
  assert.ok(lns.some((l) => l.type === 'sky' && l.name.endsWith(' Skyway')));
  assert.equal(g.cells()[T.a].name, all[T.a]);
});

test('free play: no Audit deadline, no Commended, no stars or Merits', () => {
  const g = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 5, freePlay: true, noInherited: true });
  assert.equal(g.state().deadline, null); assert.equal(g.state().freePlay, true);
  g.s.money = 1e6;
  g.act({ type: 'buildRoute', a: T.a, b: meta.terminal, kind: 'core' });
  // force the quota ladder through
  g.s.quota.stage = 2; g.s.launches = [[g.s.time, 5000]]; g.s.quota.streak = 1; g.s.nextDeparture = g.s.time + 1;
  const evs = []; g.step(2); evs.push(...g.drainEvents());
  assert.equal(g.s.quota.stage, 3);
  const q = evs.find((e) => e.type === 'quota'); assert.ok(q && q.quota === 3 && q.freePlay === true && q.commended === false);
  assert.equal(g.s.won, false); assert.equal(g.state().commendedAt, null);
  const gr = g.grade();
  assert.equal(gr.commended, false); assert.equal(gr.nStars, 0); assert.equal(gr.merits, 0); assert.equal(gr.unlocks, null);
  g.step(46 * 60); assert.equal(g.s.overtime, false); assert.equal(g.s.termOver?.reason ?? null, null);
});

function saturated(upgradeCores) {
  const h = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 5, noDisasters: true, noInherited: true, genScale: 20 });
  h.s.money = 1e6;
  h.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' });
  for (let k = 0; k < 4; k++) h.act({ type: 'addTrain', line: 0 });
  h.act({ type: 'buildRoute', a: { station: 1 }, b: meta.terminal, kind: 'core' });
  if (upgradeCores) for (const st of h.stations().filter((s) => s.kind === 'core')) h.act({ type: 'upgradeInterchange', station: st.id });
  else for (let k = 0; k < 6; k++) { h.act({ type: 'addTrain', line: 1 }); h.act({ type: 'addTrain', line: 2 }); h.act({ type: 'addTrain', line: 3 }); } // shafts above the 360/min interchange
  h.step(400);
  return h;
}
test('card exports: a full interchange on the existing path to the Terminal caps "+N exports" (and names it)', () => {
  const h = saturated(false);
  const core = h.stations().find((s) => s.kind === 'core' && s.parent === 1);
  assert.ok(core.transferFlow >= 0.95 * core.capacity);
  for (const c of h.routeCards(meta.capitalCentre, { station: 1 }).filter((c) => c.feasible)) {
    assert.ok(c.exportsPotential > 100); assert.ok(c.exportsGain <= 5, `${c.kind} +${c.exportsGain}`);
    assert.equal(c.exportsNote, `limited by ${core.name}'s interchange (0/min free)`);
  }
  const r0 = h.breakdown().reaching, k = h.clone();
  k.act({ type: 'buildRoute', a: meta.capitalCentre, b: { station: 1 }, kind: 'earth' }); k.step(300); h.step(300);
  assert.ok(k.breakdown().reaching <= h.breakdown().reaching + 10, 'and indeed it adds nothing');
});
test('card exports: a full line on the existing path caps "+N exports" (and names it)', () => {
  const h = saturated(true);
  const shaft = h.lines().find((l) => l.shaft && l.load >= 0.95);
  assert.ok(shaft);
  for (const c of h.routeCards(meta.capitalCentre, { station: 1 }).filter((c) => c.feasible)) {
    assert.ok(c.exportsGain <= 5, `${c.kind} +${c.exportsGain}`);
    assert.ok(c.exportsNote?.startsWith(`limited by the ${shaft.name}`), c.exportsNote);
  }
});

test('Heat Shielding bought during a Core Flare warning cancels it', () => {
  const g = fresh(); g.s.money = 1e6;
  g.act({ type: 'buildRoute', a: T.a, b: meta.terminal, kind: 'core' });
  const core = g.stations().find((s) => s.kind === 'core');
  g.s.dis.warning = { type: 'coreFlare', target: core.id, targetRef: { kind: 'station', id: core.id, cell: core.cell }, at: g.s.time, hitAt: g.s.time + 10, braced: false, rerouted: false };
  assert.ok(g.act({ type: 'buyTech', id: 'heatShielding' }).ok);
  assert.equal(g.disasters().warning, null);
  assert.ok(g.drainEvents().some((e) => e.type === 'disasterCancelled' && e.disaster === 'coreFlare'));
  g.step(15);
  assert.equal(g.s.dis.flare, null);
});

test('Atlantis: Water from the district next to a dome works; land cards say how; a lone card has no tags', () => {
  const g = Game.newTerm({ charter: 'II', region: 'brine', termSeed: 202, noInherited: true, noDisasters: true }); g.s.money = 1e6;
  const dome = cells.find((c) => c.terrain === 3 && c.neighbours.some((n) => cells[n].isCity));
  const coast = dome.neighbours.find((n) => cells[n].isCity);
  const cards = g.routeCards(coast, dome.id);
  const w = cards.find((c) => c.kind === 'water');
  assert.ok(w.feasible, w.reason);
  assert.deepEqual(w.tags, [], 'the only feasible card is not tagged');
  assert.match(cards.find((c) => c.kind === 'earth').reason, /only Water reaches it, from a station on the coast next to it/);
  const r = g.act({ type: 'buildRoute', a: coast, b: dome.id, kind: 'water' }); assert.ok(r.ok, r.reason);
  assert.ok(r.stations.some((id) => g.s.stations[id].kind === 'dome'));
  assert.ok(g.servedCell(dome.id) && g.servedCell(coast));
});

test('card balance: light short hops favour Surface, dense blocks Earth, the far side the core; tags split', async () => {
  const { angleDeg } = await import('../../game/src/geo.js');
  const g = fresh(); g.s.money = 1e6;
  const tags = (cs, k) => cs.find((c) => c.kind === k)?.tags || [];
  // a 4-cell hop over light districts (all path cells density <= 2)
  let light = 0, lightSurface = 0, dense = 0, denseEarth = 0;
  for (const a of cells.filter((c) => c.isCity && ['farwards', 'capital', 'flats'].includes(c.areaId)).slice(0, 140)) {
    const d = hexDistances(a.id, 4);
    const b = cells.find((c) => d[c.id] === 4 && c.isCity && c.areaId === a.areaId);
    if (!b) continue;
    const cs = g.routeCards(a.id, b.id, { kinds: ['surface', 'earth'] });
    const s = cs.find((c) => c.kind === 'surface'), e = cs.find((c) => c.kind === 'earth');
    if (!s?.feasible || !e?.feasible) continue;
    const ds = [a.id, b.id, ...s.demolishCells].map((c) => g.s.densities[c]);
    if (Math.max(...ds) <= 2) { light++; if (s.cost < e.cost) lightSurface++; }
    if (ds.length >= 4 && Math.min(...ds.slice(2)) >= 4) { dense++; if (e.cost < s.cost) denseEarth++; } // 2+ dense blocks in the way
  }
  assert.ok(light >= 3 && lightSurface / light >= 0.7, `light hops: Surface cheaper in ${lightSurface}/${light}`);
  assert.ok(dense >= 1 && denseEarth / dense >= 0.7, `dense hops: Earth cheaper in ${denseEarth}/${dense}`);
  // the far side: through the core is the cheapest card
  const far = cells.find((c) => c.isCity && angleDeg(c.pos, cells[T.a].pos) > 150);
  const fc = g.routeCards(T.a, far.id);
  assert.ok(tags(fc, 'core').includes('Cheapest'), JSON.stringify(fc.filter((c) => c.feasible).map((c) => [c.kind, c.cost, c.tags])));
});

test('card reasons are plain words without a "<Kind>:" prefix; one running cost; lengths in miles', () => {
  const g = Game.newTerm({ tutorial: true });
  for (const c of [...g.routeCards(T.a, meta.terminal), ...g.routeCards(T.peaks[0], T.a)]) {
    if (!c.reason) continue;
    assert.ok(!/^(Surface|Sky|Water|Earth|Through the core|Space|Hybrid):/.test(c.reason), c.reason);
    assert.ok(/^[A-Z]/.test(c.reason), c.reason);
  }
  assert.equal(g.routeCards(T.a, meta.terminal).find((c) => c.kind === 'earth').reason, 'Too far apart to dig (165°; the crust allows 83°)');
  const card = g.routeCards(T.a, T.b).find((c) => c.kind === 'surface');
  const u0 = g.upkeepPerMin();
  g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' });
  const l = g.lines()[0];
  assert.equal(card.runningCost, g.upkeepPerMin() - u0);
  assert.equal(l.runningCost, card.runningCost, 'the line panel and the card agree');
  assert.equal(card.runningBreakdown.trains, l.upkeep);
  assert.ok(Math.abs(l.lengthMiles - l.length * 50) <= 1);
});
