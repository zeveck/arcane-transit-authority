#!/usr/bin/env node
// tools/spokes.mjs — the "ring the Terminal with cheap Earth spokes" strategy (final review): every 15 s build the
// cheapest earth card from the densest unserved district within earth reach of the Warp Terminal, add trains to
// busy lines, buy Warp Consists / Twin Launch Ring when the ring is the limit. Prints quota times.
//   node tools/spokes.mjs [--charter II] [--region brine] [--seed 202]
import { Game } from '../game/src/sim.js';
import { cellMeta, getCells } from '../game/src/planet.js';
import { techBlock, techPrice } from '../game/src/tech.js';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
export function spokes({ charter = 'II', region = 'brine', termSeed = 202, until = 45 * 60, ring = true } = {}) {
  const meta = cellMeta(), cells = getCells();
  const g = Game.newTerm({ charter, region, termSeed });
  let built = 0;
  while (g.s.time < until && !g.s.termOver && !g.s.won) {
    g.step(15);
    const w = g.s.dis.warning; if (w && !w.braced) g.act({ type: 'brace' });
    if (g.disasters().broken.length) g.act({ type: 'repairAll' });
    const bn = g.breakdown().bottleneck;
    if (bn.kind === 'warp') for (const id of ['biggerInterchanges', 'warpConsists', 'warpAnchor', 'twinLaunchRing']) if (!g.s.tech[id] && !techBlock(g.s, id) && g.canAfford(techPrice(g.s, id))) g.act({ type: 'buyTech', id });
    for (const l of g.lines()) if (l.load > 0.85 && l.trains < 8 && g.canAfford(2000)) g.act({ type: 'addTrain', line: l.id });
    // hubs: the Terminal and stations on its neighbouring cells (walkway-linked: their transfer is the Terminal's)
    const hubs = [{ station: 0 }];
    for (const n of cells[meta.terminal].neighbours) { const st = g.s.stations.find((x) => x && x.cell === n && x.kind === 'ground'); if (st) hubs.push({ station: st.id }); else if (ring && cells[n].land) hubs.push(n); }
    const tp = cells[meta.terminal].pos, near = (c) => Math.acos(Math.max(-1, Math.min(1, c.pos[0] * tp[0] + c.pos[1] * tp[1] + c.pos[2] * tp[2]))) * 180 / Math.PI <= (c.areaId === 'rift' ? 60 : 82);
    const cand = cells.filter((c) => c.isCity && near(c) && !g.servedCell(c.id) && !g.s.demolished[c.id]).sort((a, b) => g.s.densities[b.id] - g.s.densities[a.id] || a.id - b.id);
    let best = null;
    for (const c of cand.slice(0, 14)) for (const h of hubs) {
      const card = g.routeCards(c.id, h, { kinds: ['earth'] })[0];
      if (!card || !card.feasible || card.exportsGain < 5) continue;
      const v = card.exportsGain / card.cost; if (!best || v > best.v) best = { v, c: c.id, h, cost: card.cost };
    }
    if (best && g.canAfford(best.cost + 500) && g.act({ type: 'buildRoute', a: best.c, b: best.h, kind: 'earth' }).ok) built++;
  }
  return { charter, region, termSeed, quotas: g.s.quota.metAt.map((t) => +(t / 60).toFixed(1)), spokes: built, money: Math.round(g.s.money), throughput: g.throughput(), ceiling: g.breakdown().ceiling };
}
if (process.argv[1] && process.argv[1].endsWith('spokes.mjs')) console.log(JSON.stringify(spokes({ charter: arg('charter', 'II'), region: arg('region', 'brine'), termSeed: +arg('seed', 202), ring: !argv.includes('--no-ring') })));
