#!/usr/bin/env node
// tools/bench.mjs — performance at ~100 stations: worst sim tick, worst path recompute, average update().
import { Game } from '../game/src/sim.js';
import { getCells, hexDistances } from '../game/src/planet.js';
import { liveStations, components } from '../game/src/network.js';
import { angleDeg } from '../game/src/geo.js';

const target = +(process.argv[2] || 100);
const g = Game.newTerm({ charter: 'VI', region: 'ringside', termSeed: 9, noDisasters: true });
g.s.money = 1e8;
const cells = getCells();
const t0 = performance.now();
let guard = 0;
while (liveStations(g).length < target && guard++ < 400) {
  const comp = components(g);
  const term = liveStations(g).filter((s) => s.kind !== 'core' && comp.comp.get(s.id) === comp.terminal);
  const gen = g.generation();
  const cand = cells.filter((c) => c.isCity && !gen.cover.has(c.id) && !g.s.demolished[c.id]).sort((a, b) => g.s.densities[b.id] - g.s.densities[a.id] || a.id - b.id);
  let built = false;
  for (const c of cand.slice(0, 20)) {
    const near = term.slice().sort((a, b) => angleDeg(cells[a.cell].pos, c.pos) - angleDeg(cells[b.cell].pos, c.pos))[0];
    const cards = g.routeCards(c.id, { station: near.id }, { withExports: false }).filter((x) => x.feasible);
    if (!cards.length) continue;
    const best = cards.reduce((m, x) => (x.cost < m.cost ? x : m));
    if (g.act({ type: 'buildRoute', a: c.id, b: { station: near.id }, kind: best.kind }).ok) { built = true; break; }
  }
  if (!built) break;
  g.step(5);
}
const buildMs = performance.now() - t0;
for (const l of g.s.lines) if (l) l.trains = 4;
g.dirty = true;
g.perf = { worstTick: 0, ticks: 0, tickTotal: 0, worstRecompute: 0, recomputes: 0, updates: 0, updateTotal: 0 };
const ticks = [];
for (let i = 0; i < 600; i++) { const t0 = performance.now(); g.step(1); const dt = performance.now() - t0 - (g._lastRecompute || 0); ticks.push(dt); }
ticks.sort((a, b) => a - b);
const pct = (q) => ticks[Math.min(ticks.length - 1, Math.floor(q * ticks.length))].toFixed(2);
const st = liveStations(g).length, ln = g.s.lines.filter(Boolean).length;
const p = g.perfStats();
console.log(`stations ${st}, lines ${ln}, pairs ${g.demand.commuters.length}; built in ${(buildMs / 1000).toFixed(1)} s`);
console.log(`tick (1 s of game time incl. its 30 updates) median ${pct(0.5)} ms, p95 ${pct(0.95)}, p99 ${pct(0.99)}, max ${pct(1)}`);
console.log(`worst sim tick ${p.worstTick} ms (avg ${p.avgTick}); worst tick incl. a path recompute ${p.worstTickWithRecompute} ms; worst path recompute ${p.worstRecompute} ms (full recompute incl. demand ${p.worstFullRecompute} ms); update() avg ${p.avgUpdate} ms`);
// a recompute on a network change at this size
const r0 = performance.now(); g.dirty = true; g.step(1); console.log(`one network change: ${(performance.now() - r0).toFixed(1)} ms`);
