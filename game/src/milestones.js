// milestones.js — 30 milestone cards (10 in the starting pool, 20 bought with Merits), 3 dealt per term from
// the `milestones` stream, their progress checks and bonuses. Inherited stations, lines and trains never count.
import { MILESTONES, MILESTONES_DEALT, CHARTERS, GREEN, TECH } from './tuning.js';
import { TERRAIN } from './planet.js';
import { liveLines, liveStations, lineGeo, coreUnder, components } from './network.js';
import { angleDeg } from './geo.js';

export const MILESTONE_BY_ID = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

/** Deal 3 cards from the pool (base + unlocked), skipping cards that don't fit the term. */
export function dealMilestones(s, rng, unlocked = []) {
  const pool = MILESTONES.filter((m) => m.pool === 'base' || unlocked.includes(m.id)).filter((m) => {
    if (s.tutorial && m.needs) return false;
    if (m.needs === 'space' && !s.natives.includes('space') && CHARTERS[s.charter].natives.indexOf('space') < 0 && s.charter === 'I') return false;
    return true;
  }).map((m) => m.id);
  rng.shuffle(pool);
  return pool.slice(0, MILESTONES_DEALT);
}

/** Current value and target of a card's goal. */
export function milestoneProgress(g, id) {
  const m = MILESTONE_BY_ID[id], goal = m.goal, s = g.s;
  const lines = liveLines(g).filter((l) => !l.inherited);
  const stations = liveStations(g).filter((st) => !st.inherited);
  const pm = CHARTERS[s.charter].price;
  const q = CHARTERS[s.charter].quotas;
  switch (goal.kind) {
    case 'trackUnits': return [lines.reduce((a, l) => a + lineGeo(g, l).length, 0), goal.n];
    case 'trackOfType': return [lines.filter((l) => l.type === goal.type).reduce((a, l) => a + lineGeo(g, l).length, 0), goal.n];
    case 'trainsOfType': return [lines.filter((l) => l.type === goal.type).reduce((a, l) => a + l.trains, 0), goal.n];
    case 'trainsEachType': {
      const types = ['surface', 'sky', 'earth', 'fire', ...(g.mods.water ? ['water'] : []), ...(g.mods.space ? ['space'] : [])];
      return [Math.min(...types.map((t) => lines.filter((l) => l.type === t).reduce((a, l) => a + l.trains, 0))), goal.n];
    }
    case 'coreRoutes': return [lines.filter((l) => l.type === 'fire').length, goal.n];
    case 'greenCells': return [s.green.filter((x) => x === 1 || x === 2).length, goal.n];
    case 'attractions': return [s.attractions.length, goal.n];
    case 'atlantisServed': return [g.ct.filter((c) => c.terrain === TERRAIN.ATLANTIS && g.servedCell(c.id)).length, goal.n];
    case 'islandServed': return [g.ct.filter((c) => c.areaId === 'brine' && c.isCity && g.servedCell(c.id)).length, goal.n];
    case 'commutersPerMin': return [g.s.ema.delivered, goal.q3 * q[2]];
    case 'demolished': return [s.stats.demolishedByPlayer, goal.n];
    case 'interchanges3': return [stations.filter((st) => st.layers.length + (coreUnder(g, st) ? 1 : 0) >= 3).length, goal.n];
    case 'maxLayers': return [Math.max(0, ...stations.map((st) => st.layers.length + (coreUnder(g, st) ? 1 : 0))), goal.n];
    case 'throughputHold': {
      const since = s.milestones.hold[id];
      return [since != null ? s.time - since : 0, goal.seconds];
    }
    case 'skyPortsAllPeaks': {
      const peaks = g.ct.filter((c) => c.peak);
      return [peaks.filter((c) => stations.some((st) => st.cell === c.id && st.layers.includes('sky'))).length, peaks.length];
    }
    case 'noDamageSeconds': return [s.dis.firstAt != null ? s.time - Math.max(s.dis.lastDamage ?? s.dis.firstAt, s.dis.firstAt) : 0, goal.n];
    case 'servedShare': { const city = g.ct.filter((c) => c.isCity); return [city.filter((c) => g.servedCell(c.id)).length / city.length, goal.n]; }
    case 'routeAngle': {
      const comp = components(g); let minDot = 1;
      const st = stations.filter((x) => x.kind !== 'core');
      for (let i = 0; i < st.length; i++) {
        const a = g.ct[st[i].cell].pos, ca = comp.comp.get(st[i].id);
        for (let j = i + 1; j < st.length; j++) if (comp.comp.get(st[j].id) === ca) { const b = g.ct[st[j].cell].pos; const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; if (d < minDot) minDot = d; }
      }
      return [Math.round(Math.acos(Math.max(-1, Math.min(1, minDot))) * 180 / Math.PI * 1e6) / 1e6, goal.n];
    }
    case 'coreExchanges': return [stations.filter((x) => x.kind === 'core').length, goal.n];
    case 'linesOfType': return [lines.filter((l) => l.type === goal.type && !(goal.chordsOnly && l.shaft)).length, goal.n];
    case 'greeneryShare': return [g.greeneryScore() / g.ct.filter((c) => c.isCity).length, goal.n];
    case 'noTurnAwaySeconds': return [s.quota.stage >= 1 ? s.time - Math.max(s.stats.lastTurnAway ?? 0, s.quota.metAt[0] ?? s.time) : 0, goal.n];
    case 'quotaBy': return [s.quota.metAt[goal.quota] != null && s.quota.metAt[goal.quota] <= goal.seconds ? 1 : 0, 1];
    case 'stations': return [stations.filter((x) => x.kind !== 'core').length, goal.n];
    case 'launchedTotal': return [s.stats.launched, goal.n];
    case 'cash': return [s.money, goal.n * pm];
  }
  return [0, 1];
}

/** Check dealt cards (each tick); completed cards apply their bonus at once. Returns ids completed now. */
export function checkMilestones(g) {
  const s = g.s, done = [];
  const q = CHARTERS[s.charter].quotas;
  for (const id of s.milestones.dealt) {
    if (s.milestones.done[id] != null) continue;
    const m = MILESTONE_BY_ID[id];
    if (m.goal.kind === 'throughputHold') {
      if (g.throughput() >= q[m.goal.quota]) { if (s.milestones.hold[id] == null) s.milestones.hold[id] = s.time; }
      else s.milestones.hold[id] = null;
    }
    const [v, target] = milestoneProgress(g, id);
    if (v >= target - 1e-9) {
      s.milestones.done[id] = s.time;
      applyBonus(g, m.bonus);
      g.touchUndo?.({ all: true }); // the bonus stays, so the build that earned it can no longer be undone
      done.push(id);
      g.emit({ type: 'milestone', id, name: m.name, bonus: m.bonusText });
    }
  }
  return done;
}

function applyBonus(g, b) {
  const s = g.s;
  if (b.cash) s.money += Math.round(b.cash * CHARTERS[s.charter].price);
  if (b.freeTech) s.tech[b.freeTech] = true;
  if (b.freeCoreExchange) s.freeCoreExchanges += b.freeCoreExchange;
  const modKeys = Object.keys(b).filter((k) => !['cash', 'freeTech', 'freeCoreExchange'].includes(k));
  if (modKeys.length) { const e = {}; for (const k of modKeys) e[k] = b[k]; s.milestones.bonuses.push(e); }
  g.refreshMods();
}

/** Milestone cards for the UI. */
export function milestoneView(g) {
  return g.s.milestones.dealt.map((id) => {
    const m = MILESTONE_BY_ID[id];
    const [v, t] = milestoneProgress(g, id);
    const km = m.goal.kind === 'trackUnits' || m.goal.kind === 'trackOfType' ? 50 : 1; // track goals read in miles
    return { id, name: m.name, text: m.text, bonus: m.bonusText, value: v * km, target: t * km, unit: km === 50 ? 'miles' : null, progress: Math.min(1, t ? v / t : 0), done: g.s.milestones.done[id] != null, doneAt: g.s.milestones.done[id] ?? null };
  });
}
