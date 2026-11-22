// Requests 35-37: an earned crossing (no grant, no debt in the tutorial, no early tutorial disasters), honest cards
// (DEMOLITION from tuning.js, demolition losses, Dense? Dig., the core to the Terminal), money in billions (fmt.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../../game/src/sim.js';
import { cellMeta, getCells } from '../../game/src/planet.js';
import { DEMOLITION, TUTORIAL, CHARTERS, MANDATES, MILESTONES, MERITS } from '../../game/src/tuning.js';
import { demolitionPrice } from '../../game/src/network.js';
import { fmtMoney, fmtRate } from '../../game/src/fmt.js';

const meta = cellMeta(), cells = getCells();
const T = meta.tutorial;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', 'game', 'src');

test('fmt.js: thousands, millions, billions, rates', () => {
  const cases = [[0, '$0'], [0.4, '$400K'], [0.05, '$50K'], [0.9996, '$1M'], [1, '$1M'], [2, '$2M'], [2.5, '$2.5M'], [2.04, '$2M'], [9.96, '$10M'],
    [24, '$24M'], [750, '$750M'], [999.6, '$1B'], [1000, '$1B'], [2480, '$2.48B'], [6100, '$6.1B'], [8500, '$8.5B'], [12000, '$12B'], [12345, '$12.3B'], [123456, '$123B'],
    [-2.5, '−$2.5M'], [-0.0001, '$0']];
  for (const [x, want] of cases) assert.equal(fmtMoney(x), want, String(x));
  assert.equal(fmtRate(24), '$24M/min');
  assert.equal(fmtMoney(3000, { sign: true }), '+$3B');
  assert.equal(fmtMoney(-3, { sign: true }), '−$3M');
});

// files the browser builder owns (they import three.js or the DOM); everything else in game/src is the sim's
const BROWSER = new Set(['audio.js', 'camera.js', 'city.js', 'debug.js', 'demo-net.js', 'game.js', 'hud.js', 'icons.js', 'input.js', 'main.js', 'menus.js', 'meta.js', 'models.js', 'render-net.js', 'save.js', 'scene.js', 'story.js', 'xray.js']);
// a line may opt out with a `fmt-ok` comment (e.g. a regex replacement '$1', not money)
const MONEY_TEXT = [/\$[0-9]/, /\$\$\{/, /\$['"`]\s*\+/, /['"`][+\-−]?\$['"`]/];
function moneyTextHits(files) {
  const hits = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(SRC, f), 'utf8').split('\n');
    lines.forEach((l, i) => { if (!l.includes('fmt-ok') && MONEY_TEXT.some((re) => re.test(l))) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`); });
  }
  return hits;
}
const srcFiles = fs.readdirSync(SRC).filter((f) => f.endsWith('.js') && f !== 'fmt.js');
test('no hand-written money text in the sim: "$" + digit or "$" concatenation only in fmt.js', () => {
  const hits = moneyTextHits(srcFiles.filter((f) => !BROWSER.has(f)));
  assert.deepEqual(hits, []);
});
test('no hand-written money text in the browser files (fmtMoney / fmtRate instead)', () => {
  const hits = moneyTextHits(srcFiles.filter((f) => BROWSER.has(f)));
  assert.deepEqual(hits, []);
});
test('money data carries numbers; texts are made by fmtMoney', () => {
  const ms = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));
  assert.equal(ms.untouchable.bonus.cash, 3000); assert.equal(ms.untouchable.bonusText, '+$3B');
  assert.equal(ms.quickStart.bonusText, fmtMoney(ms.quickStart.bonus.cash, { sign: true }));
  assert.equal(ms.solvent.goal.amount, 20000); assert.equal(ms.solvent.text, 'Hold $20B');
  const perk = MERITS.perks.find((p) => p.id === 'cash');
  assert.equal(perk.name, fmtMoney(perk.effect.cash, { sign: true }) + ' starting money');
});

test('no First Crossing Grant: Charter I has no mandate; core cards are never free', () => {
  assert.deepEqual(CHARTERS.I.mandates, []);
  assert.equal(MANDATES.firstCrossing, undefined);
  assert.equal(Game.charterInfo('I').mandateNote, 'Founding Charter: no mandate. Your first crossing is yours to fund.');
  const g = Game.newTerm({ tutorial: true });
  assert.deepEqual(g.state().mandates, []);
  assert.equal('firstCrossingAvailable' in g.state(), false);
  g.s.money = 1e5;
  assert.ok(g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  const core = g.routeCards({ station: 1 }, meta.terminal).find((c) => c.kind === 'core');
  assert.ok(core.feasible && !core.free && core.cost > 3000, String(core.cost));
  assert.ok(!/FREE/.test(core.line));
  // an old save that still lists the grant loads without it
  const snap = g.snapshot(); snap.mandates = ['firstCrossing'];
  assert.deepEqual(Game.restore(snap).s.mandates, []);
});

test('built.firstCrossing: true on the first core route of a term (any Charter), false after; undo resets it', () => {
  const g = Game.newTerm({ charter: 'II', region: 'brine', termSeed: 9, noDisasters: true, noInherited: true });
  g.s.money = 1e6;
  const a = cells.find((c) => c.areaId === 'brine' && c.isCity).id;
  const r = g.act({ type: 'buildRoute', a, b: meta.terminal, kind: 'core' }); assert.ok(r.ok, r.reason);
  assert.equal(r.firstCrossing, true);
  let ev = g.drainEvents().find((e) => e.type === 'built'); assert.equal(ev.firstCrossing, true); assert.equal(ev.kind, 'core');
  assert.equal(g.state().firstCrossingUsed, true);
  assert.ok(g.act({ type: 'undo' }).ok);
  assert.equal(g.state().firstCrossingUsed, false);
  assert.ok(g.act({ type: 'buildRoute', a, b: meta.terminal, kind: 'core' }).firstCrossing);
  g.step(20);
  const b = cells.find((c) => c.areaId === 'capital' && c.isCity && c.id !== meta.capitalCentre).id;
  g.drainEvents();
  const r2 = g.act({ type: 'buildRoute', a: b, b: { station: g.s.stations.find((s) => s && s.kind !== 'terminal' && s.kind !== 'core').id }, kind: 'core' });
  if (r2.ok) { assert.equal(r2.firstCrossing, false); ev = g.drainEvents().find((e) => e.type === 'built'); assert.equal(ev.firstCrossing, false); }
  // card previews (trial applies) never set it
  const g2 = Game.newTerm({ charter: 'II', region: 'brine', termSeed: 9, noDisasters: true, noInherited: true });
  g2.routeCards(a, meta.terminal);
  assert.equal(g2.state().firstCrossingUsed, false);
});

test('tutorial: its own start money and no debt (a build cannot take money below zero)', () => {
  const g = Game.newTerm({ tutorial: true });
  assert.equal(g.s.money, TUTORIAL.start);
  assert.ok(CHARTERS.I.debt < 0);
  const card = g.routeCards(T.a, T.b).find((c) => c.kind === 'surface');
  g.s.money = card.cost - 1; // would be fine down to the Charter's debt limit
  const r = g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' });
  assert.equal(r.ok, false); assert.equal(r.reason, 'Not enough money');
  g.s.money = card.cost;
  assert.ok(g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  assert.equal(g.s.money, 0);
  assert.equal(g.act({ type: 'addTrain', line: 0 }).ok, false);
  // a normal Charter I term may still go into debt
  const h = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 3, noInherited: true });
  h.s.money = card.cost - 1;
  assert.ok(h.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  assert.ok(h.s.money < 0);
});

test('tutorial: the first line starts with one train; no disasters until after Quota I', () => {
  const g = Game.newTerm({ tutorial: true });
  assert.equal(g.s.dis.nextAt, Infinity);
  const card = g.routeCards(T.a, T.b).find((c) => c.kind === 'surface');
  assert.ok(g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  assert.equal(g.s.lines[0].trains, TUTORIAL.firstLineTrains);
  assert.equal(card.carries, Math.round(g.lines()[0].capacity));
  g.s.money = 1e6;
  for (const [a, b, kind] of [[meta.capitalCentre, { station: 1 }, 'earth'], [{ station: 1 }, meta.terminal, 'core'], [T.peaks[0], T.peaks[1], 'sky']]) assert.ok(g.act({ type: 'buildRoute', a, b, kind }).ok);
  for (const l of g.lines()) if (l.shaft) for (let k = 0; k < 3; k++) g.act({ type: 'addTrain', line: l.id });
  let warned = false;
  while (g.s.quota.stage < 1 && g.s.time < 1800) { g.step(5); if (g.drainEvents().some((e) => e.type === 'disasterWarning')) warned = true; }
  assert.equal(g.s.quota.stage, 1, 'Quota I met');
  assert.equal(warned, false);
  assert.equal(g.s.dis.nextAt, g.s.quota.metAt[0] + TUTORIAL.firstDisasterAfterQuotaI * 60);
  // a normal term keeps its pacing
  const h = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 3 });
  assert.equal(h.s.dis.nextAt, 12 * 60);
});

test('DEMOLITION in tuning.js is the one source of demolition prices', () => {
  const g = Game.newTerm({ charter: 'I', region: 'capital', termSeed: 3, noInherited: true });
  const c = cells.find((x) => x.isCity && x.areaId === 'capital' && g.s.densities[x.id] === 3).id;
  const p0 = demolitionPrice(g, c);
  assert.equal(p0, Math.round(DEMOLITION[3]));
  const keep = DEMOLITION[3];
  try { DEMOLITION[3] = keep * 2; assert.equal(demolitionPrice(g, c), Math.round(keep * 2)); } finally { DEMOLITION[3] = keep; }
  assert.equal(g.cells({ id: c })[0].demolitionPrice, p0);
  // dense blocks cost more than digging: density 3+ is dearer per cell than light blocks by more than the price steps
  assert.ok(DEMOLITION[3] > 2 * DEMOLITION[2] && DEMOLITION[4] > DEMOLITION[3] && DEMOLITION[5] > DEMOLITION[4]);
});

test('tutorial seed: the light pair is Surface-cheapest; the Capital centre to station 1 is Earth-cheapest ("Dense? Dig.")', () => {
  const g = Game.newTerm({ tutorial: true });
  const light = g.routeCards(T.a, T.b);
  const s = light.find((c) => c.kind === 'surface');
  assert.ok(s.tags.includes('Cheapest'), JSON.stringify(light.filter((c) => c.feasible).map((c) => [c.kind, c.cost, c.tags])));
  for (const c of s.demolishCells) assert.ok(g.s.densities[c] <= 2);
  assert.ok(g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  const dense = g.routeCards(meta.capitalCentre, { station: 1 });
  const e = dense.find((c) => c.kind === 'earth'), su = dense.find((c) => c.kind === 'surface');
  assert.ok(e.tags.includes('Cheapest'), JSON.stringify(dense.filter((c) => c.feasible).map((c) => [c.kind, c.cost, c.tags])));
  assert.ok(su.feasible && su.cost > e.cost && su.demolishCells.some((c) => g.s.densities[c] >= 4));
});

test('tutorial seed: the core is the Cheapest and Most-capacity card from the tutorial stations to the Terminal', () => {
  const g = Game.newTerm({ tutorial: true }); g.s.money = 1e6;
  for (const [a, b, kind] of [[T.a, T.b, 'surface'], [meta.capitalCentre, { station: 1 }, 'earth'], [T.peaks[0], T.peaks[1], 'sky']]) assert.ok(g.act({ type: 'buildRoute', a, b, kind }).ok);
  for (const st of g.s.stations) {
    if (!st || st.kind === 'terminal') continue;
    const cards = g.routeCards({ station: st.id }, meta.terminal);
    const core = cards.find((c) => c.kind === 'core');
    assert.ok(core.feasible && core.tags.includes('Cheapest') && core.tags.includes('Most capacity'), `station ${st.id}: ` + JSON.stringify(cards.filter((c) => c.feasible).map((c) => [c.kind, c.cost, c.carries, c.tags])));
  }
});

test('route cards: demolition losses (riders and exports the demolished blocks make or would make); net export gain', () => {
  const g = Game.newTerm({ tutorial: true }); g.s.money = 1e6;
  const card = g.routeCards(T.a, T.b).find((c) => c.kind === 'surface');
  // unlinked to the Terminal: no exports lost; riders: the demolished blocks next to the new stations
  const near = new Set([T.a, T.b, ...cells[T.a].neighbours, ...cells[T.b].neighbours]);
  const want = card.demolishCells.filter((c) => near.has(c)).reduce((a, c) => a + g.cellYield(c).riders, 0);
  assert.ok(want > 0);
  assert.equal(card.ridersLost, Math.round(want * 10) / 10);
  assert.equal(card.exportsLost, 0);
  assert.match(card.line, /^demolishes \d+ blocks: −\d+ riders\/min, −0 exports\/min$/);
  for (const c of g.routeCards(T.a, T.b)) { assert.equal(typeof c.ridersLost, 'number'); assert.equal(typeof c.exportsLost, 'number'); }
  // once linked to the Terminal, demolishing served blocks costs exports too, and exportsGain is net of them
  assert.ok(g.act({ type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }).ok);
  assert.ok(g.act({ type: 'buildRoute', a: { station: 1 }, b: meta.terminal, kind: 'core' }).ok);
  g.step(30);
  let found = null;
  for (const d of cells.filter((x) => x.isCity && !g.servedCell(x.id) && ['capital', 'ringside'].includes(x.areaId)).slice(0, 40)) {
    const s = g.routeCards({ station: 1 }, d.id, { kinds: ['surface'] })[0];
    if (s.feasible && s.exportsLost > 0) { found = s; break; }
  }
  assert.ok(found, 'a Surface card that demolishes served blocks');
  assert.ok(found.ridersLost > 0);
  assert.ok(found.exportsGain <= Math.max(0, found.exportsPotential));
});
