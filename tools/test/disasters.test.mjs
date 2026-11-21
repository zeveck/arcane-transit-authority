// Every disaster can happen, be braced or rerouted, and be repaired or waited out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../../game/src/sim.js';
import { cellMeta, getCells, hexDistances } from '../../game/src/planet.js';
import { angleDeg } from '../../game/src/geo.js';
import { DISASTER_IDS } from '../../game/src/tuning.js';

const meta = cellMeta(), cells = getCells();
function pick(pred) { for (const a of cells) for (const b of cells) if (a.id < b.id && pred(a, b)) return [a.id, b.id]; return null; }

function bigNetwork() {
  const g = Game.newTerm({ charter: 'VI', region: 'ringside', termSeed: 31, noInherited: true });
  g.s.money = 1e6;
  for (const id of ['seaStations', 'spaceElevators']) g.act({ type: 'buyTech', id });
  const sky = pick((a, b) => a.peak && b.peak && a.areaId === 'spires' && b.areaId === 'spires' && angleDeg(a.pos, b.pos) < 25);
  const water = pick((a, b) => a.terrainName === 'atlantis' && b.coastal && angleDeg(a.pos, b.pos) > 15 && angleDeg(a.pos, b.pos) < 35);
  const ring = pick((a, b) => a.areaId === 'ringside' && b.areaId === 'ringside' && a.isCity && b.isCity && angleDeg(a.pos, b.pos) > 40);
  const t = meta.terminal;
  const near = cells.find((c) => c.isCity && hexDistances(t, 3)[c.id] === 3).id;
  assert.ok(g.act({ type: 'buildRoute', a: sky[0], b: sky[1], kind: 'sky' }).ok);
  assert.ok(g.act({ type: 'buildRoute', a: water[0], b: water[1], kind: 'water' }).ok);
  assert.ok(g.act({ type: 'buildRoute', a: ring[0], b: ring[1], kind: 'space' }).ok);
  assert.ok(g.act({ type: 'buildRoute', a: near, b: t, kind: 'earth' }).ok);
  assert.ok(g.act({ type: 'buildRoute', a: meta.starts.rift, b: t, kind: 'core' }).ok);
  return g;
}

test('every disaster type can strike, be braced or rerouted, and be repaired or waited out', () => {
  const seen = new Set();
  for (let seed = 0; seed < 12 && seen.size < DISASTER_IDS.length; seed++) {
    const g = bigNetwork();
    g.s.dis.timeline = g.s.dis.timeline.map(([u], i) => [0.2, ((i * 0.37 + seed * 0.13) % 1), ((i * 0.61 + seed * 0.29) % 1)]);
    g.s.dis.nextAt = g.s.time + 5;
    for (let k = 0; k < 400; k++) {
      g.step(1);
      const w = g.s.dis.warning;
      if (w && !w.braced && !w.rerouted) {
        const r = (k & 1) ? g.act({ type: 'brace' }) : g.act({ type: 'reroute' });
        if (!r.ok) assert.ok(g.act({ type: 'brace' }).ok);
        assert.ok(w.targetRef && w.targetRef.kind);
      }
      if (g.disasters().repairAllPrice > 0) assert.ok(g.act({ type: 'repairAll' }).ok);
      for (const h of g.s.dis.history) seen.add(h.type);
    }
    // everything repaired or expired
    g.step(120);
    assert.ok(!g.s.lines.some((l) => l && l.broken && l.repairAt == null) || g.s.dis.warning);
  }
  assert.deepEqual([...seen].sort(), DISASTER_IDS.slice().sort());
});
