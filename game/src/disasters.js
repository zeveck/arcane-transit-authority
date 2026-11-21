// disasters.js — the seven disasters: pre-rolled timeline (unit gap, roll, roll) from the `disasters` stream,
// 15 s warnings, regional first hits, Brace / Reroute / Repair, timed effects.
import { DISASTERS, DISASTER_IDS, DISASTER_PACING, DISASTER_WARNING_SECONDS, DISASTER_TIMELINE_LENGTH, DISASTER_JITTER, BRACE_SHARE, CHARTERS } from './tuning.js';
import { liveLines, liveStations, lineOpen } from './network.js';
import { hexDistances } from './planet.js';
import { lineName, stationName } from './names.js';

/** Pre-roll the term's disaster timeline: [unit gap (1 ± 40%), type roll, target roll]. */
export function prerollTimeline(rng) {
  const out = [];
  for (let i = 0; i < DISASTER_TIMELINE_LENGTH; i++) out.push([1 + (rng.next() * 2 - 1) * DISASTER_JITTER, rng.next(), rng.next()]);
  return out;
}
export function initDisasters(s, rng) {
  const pace = DISASTER_PACING[s.charter];
  return { timeline: prerollTimeline(rng), idx: 0, nextAt: pace.first * 60, warning: null, firstAt: null, lastDamage: null, history: [], flare: null };
}
const pm = (g) => CHARTERS[g.s.charter].price;
/** The warning's target as the player reads it ("the Brasswick–Saltmarch Deep", "Cinder Gate Core Exchange", "the orbital ring"). */
export function targetName(g, w) {
  if (!w) return null;
  if (w.target === 'ring') return 'the orbital ring';
  if (w.target === 'terminal') return 'the Warp Terminal';
  if (['meteor', 'seaquake', 'caveIn'].includes(w.type)) return g.s.lines[w.target] ? lineName(g, w.target) : null;
  return g.s.stations[w.target] ? stationName(g, w.target) : null;
}

/** Eligible targets per disaster type right now (sorted by id), with the home-region preference applied. */
export function eligibleTargets(g, type) {
  const m = g.mods, cells = g.ct, S = g.s;
  const lines = liveLines(g).filter((l) => !l.broken);
  const inRegion = (cell, r) => cells[cell].areaId === r;
  let all = [], home = [];
  switch (type) {
    case 'meteor':
      all = lines.filter((l) => l.type === 'sky').map((l) => l.id);
      home = all.filter((id) => { const l = S.lines[id]; return inRegion(S.stations[l.a].cell, 'spires') || inRegion(S.stations[l.b].cell, 'spires'); });
      break;
    case 'seaquake': all = lines.filter((l) => l.type === 'water').map((l) => l.id); home = all; break;
    case 'caveIn': if (!m.noCaveIn) all = lines.filter((l) => l.type === 'earth').map((l) => l.id); break;
    case 'coreFlare':
      if (!m.noCoreFlare && liveLines(g).some((l) => l.type === 'fire')) {
        all = liveStations(g).filter((st) => st.kind === 'core').map((st) => st.id);
        home = all.filter((id) => inRegion(S.stations[id].cell, 'rift'));
      }
      break;
    case 'solarStorm': if (liveLines(g).some((l) => l.type === 'space')) all = ['ring']; break;
    case 'blackout': all = liveStations(g).filter((st) => st.kind !== 'core' && st.kind !== 'terminal' && liveLines(g).some((l) => l.a === st.id || l.b === st.id)).map((st) => st.id); break;
    case 'warpDrift': if (!m.noWarpDrift && S.stats.launched > 0) all = ['terminal']; break;
  }
  return home.length ? home : all;
}

function repairPrice(g, w) {
  switch (w.type) {
    case 'meteor': return DISASTERS.meteor.repairPerSegment * Math.max(1, g.mods.meteorSegments) * pm(g);
    case 'seaquake': return DISASTERS.seaquake.repair * pm(g);
    case 'caveIn': return DISASTERS.caveIn.repair * pm(g);
    case 'coreFlare': return DISASTERS.coreFlare.coolant * pm(g);
    case 'blackout': return DISASTERS.blackout.restore * pm(g);
    default: return 300 * pm(g); // solar storm, warp drift: no repair; brace priced on a $300 base
  }
}
export function bracePrice(g, w = g.s.dis.warning) { return w ? Math.round(repairPrice(g, w) * BRACE_SHARE) : 0; }

/** Called every tick by the sim. */
export function disasterTick(g) {
  const S = g.s, D = S.dis;
  if (!D || g.freePlayNoDisasters) return;
  const pace = DISASTER_PACING[S.charter];
  // line repairs completing
  for (const l of S.lines) if (l && l.broken && l.repairAt != null && S.time >= l.repairAt) { l.broken = null; l.repairAt = null; l.closed = false; g.dirty = true; g.emit({ type: 'repaired', line: l.id, lineName: lineName(g, l) }); }
  // timed effects expiring
  if (D.flare && S.time >= D.flare.until) { D.flare = null; g.refreshFlare(); g.dirty = true; }
  if (S.ringSlow && S.time >= S.ringSlow.until) { S.ringSlow = null; g.dirty = true; }
  if (S.blackoutUntil && S.time >= S.blackoutUntil) { S.blackoutUntil = null; g.dirty = true; }
  for (const l of S.lines) if (l && l.slowUntil && S.time >= l.slowUntil) { l.slowUntil = null; l.slowMult = 1; g.dirty = true; }
  // the warning running out: the hit
  if (D.warning && S.time >= D.warning.hitAt) { hit(g, D.warning); D.warning = null; }
  // a new disaster time
  if (!D.warning && S.time >= D.nextAt && D.idx < D.timeline.length) {
    const [, r1, r2] = D.timeline[D.idx];
    const types = DISASTER_IDS.filter((t) => pace.pool.includes(t)).filter((t) => eligibleTargets(g, t).length);
    if (types.length) {
      const type = types[Math.floor(r1 * types.length)];
      const targets = eligibleTargets(g, type);
      const target = targets[Math.floor(r2 * targets.length)];
      const targetRef = typeof target === 'number' ? (['meteor', 'seaquake', 'caveIn'].includes(type) ? { kind: 'line', id: target } : { kind: 'station', id: target, cell: S.stations[target].cell }) : target === 'ring' ? { kind: 'ring', id: 'equator' } : { kind: 'terminal', id: S.terminalStation, cell: S.stations[S.terminalStation].cell };
      D.warning = { type, target, targetRef, at: S.time, hitAt: S.time + DISASTER_WARNING_SECONDS, braced: false, rerouted: false };
      if (D.firstAt == null) D.firstAt = S.time;
      const tName = targetName(g, D.warning);
      g.emit({ type: 'disasterWarning', disaster: type, name: DISASTERS[type].name, target, targetRef: D.warning.targetRef, targetName: tName, text: `${DISASTERS[type].name}: ${tName} hit in ${DISASTER_WARNING_SECONDS} s`, hitAt: D.warning.hitAt, bracePrice: bracePrice(g) });
    } else g.emit({ type: 'disasterSkipped' });
    D.idx++;
    const mean = S.quota.stage >= 2 ? pace.gapLate : pace.gap;
    const unit = D.idx < D.timeline.length ? D.timeline[D.idx][0] : 1;
    D.nextAt = S.time + unit * mean * 60;
  }
}

function breakLine(g, l, cost, seconds, w) {
  const braced = w.braced;
  l.broken = { by: w.type, cost: Math.round(cost * (braced && w.type !== 'meteor' ? 0.5 : 1)), seconds: seconds * (braced && w.type !== 'meteor' ? 0.5 : 1) };
  l.repairAt = null;
  if (!w.rerouted && !braced) g.loseOnboard(l);
  if (!w.rerouted && braced) g.loseOnboard(l, 0.5);
  g.dirty = true;
  g.s.dis.lastDamage = g.s.time;
  g.touchUndo(l.id);
}

function hit(g, w) {
  const S = g.s, D = S.dis, m = g.mods;
  const rec = { type: w.type, target: w.target, at: S.time, braced: w.braced, rerouted: w.rerouted };
  D.history.push(rec);
  switch (w.type) {
    case 'meteor': {
      const l = S.lines[w.target]; if (!l) break;
      const segs = m.meteorSegments - (w.braced ? 1 : 0);
      if (segs <= 0) { if (w.rerouted) { l.closed = false; g.dirty = true; } rec.missed = true; break; }
      breakLine(g, l, DISASTERS.meteor.repairPerSegment * segs * pm(g), DISASTERS.meteor.repairSeconds, w);
      l.broken.segments = segs;
      break;
    }
    case 'seaquake': {
      const l = S.lines[w.target]; if (!l) break;
      if (m.pressureHulls) { g.touchUndo(l.id); l.slowUntil = S.time + DISASTERS.seaquake.hullsSeconds * (w.braced ? 0.5 : 1); l.slowMult = DISASTERS.seaquake.hullsSpeed; if (w.rerouted) l.closed = false; g.dirty = true; break; }
      breakLine(g, l, DISASTERS.seaquake.repair * pm(g), DISASTERS.seaquake.repairSeconds, w);
      break;
    }
    case 'caveIn': {
      const l = S.lines[w.target]; if (!l) break;
      breakLine(g, l, DISASTERS.caveIn.repair * pm(g), DISASTERS.caveIn.repairSeconds, w);
      break;
    }
    case 'coreFlare': {
      const homeRift = S.stations[w.target] && g.ct[S.stations[w.target].cell].areaId === 'rift';
      const targets = homeRift ? liveStations(g).filter((st) => st.kind === 'core' && g.ct[st.cell].areaId === 'rift').map((st) => st.id) : ['all'];
      D.flare = { until: S.time + DISASTERS.coreFlare.seconds * (w.braced ? 0.5 : 1), targets };
      g.touchUndo({ stations: targets[0] === 'all' ? liveStations(g).filter((st) => st.kind === 'core').map((st) => st.id) : targets });
      g.refreshFlare(); g.dirty = true; D.lastDamage = S.time;
      break;
    }
    case 'solarStorm':
      g.touchUndo({ lines: liveLines(g).filter((l) => l.type === 'space').map((l) => l.id) });
      S.ringSlow = { until: S.time + DISASTERS.solarStorm.seconds * (w.braced ? 0.5 : 1), mult: m.magneticShield ? DISASTERS.solarStorm.shieldMult : DISASTERS.solarStorm.speedMult, ring: 'equator' };
      g.dirty = true; D.lastDamage = S.time;
      break;
    case 'blackout': {
      const st = S.stations[w.target]; if (!st) break;
      const r = w.braced ? DISASTERS.blackout.bracedRadius : DISASTERS.blackout.radius;
      const d = hexDistances(st.cell, r);
      const until = S.time + DISASTERS.blackout.seconds;
      for (const x of liveStations(g)) if (x.kind !== 'terminal' && d[x.cell] >= 0) x.closedUntil = until;
      // Core Exchanges under closed stations close too
      for (const x of liveStations(g)) if (x.kind === 'core' && S.stations[x.parent].closedUntil === until) x.closedUntil = until;
      g.touchUndo({ stations: liveStations(g).filter((x) => x.closedUntil === until).map((x) => x.id) });
      S.blackoutUntil = until; g.dirty = true; D.lastDamage = S.time;
      break;
    }
    case 'warpDrift': {
      const delay = DISASTERS.warpDrift.delay * (w.braced ? 0.5 : 1);
      S.driftDelays = [delay, delay];
      D.lastDamage = S.time;
      break;
    }
  }
  // a rerouted line that took no damage reopens at once
  if (w.rerouted && typeof w.target === 'number' && ['meteor', 'seaquake', 'caveIn'].includes(w.type)) { const l = S.lines[w.target]; if (l && !l.broken) { l.closed = false; g.dirty = true; } }
  g.emit({ type: 'disasterHit', disaster: w.type, target: w.target, targetName: targetName(g, w), braced: w.braced, rerouted: w.rerouted });
}

// ------------------------------------------------------------------ responses
export function brace(g) {
  const w = g.s.dis.warning;
  if (!w) return { ok: false, reason: 'No disaster warning' };
  if (w.braced) return { ok: false, reason: 'Already braced' };
  const p = bracePrice(g, w);
  if (g.s.money - p < CHARTERS[g.s.charter].debt) return { ok: false, reason: 'Not enough money' };
  g.s.money -= p; w.braced = true;
  return { ok: true, cost: p };
}
export function reroute(g) {
  const w = g.s.dis.warning;
  if (!w) return { ok: false, reason: 'No disaster warning' };
  if (typeof w.target !== 'number' || !['meteor', 'seaquake', 'caveIn'].includes(w.type)) return { ok: false, reason: 'Nothing to reroute' };
  const l = g.s.lines[w.target];
  if (!l) return { ok: false, reason: 'No line' };
  w.rerouted = true; l.closed = true; g.dirty = true;
  return { ok: true };
}
export function repair(g, lineId) {
  const l = g.s.lines[lineId];
  if (!l || !l.broken) return { ok: false, reason: 'Nothing to repair' };
  if (l.repairAt != null) return { ok: false, reason: 'Already being repaired' };
  if (g.s.money - l.broken.cost < CHARTERS[g.s.charter].debt) return { ok: false, reason: 'Not enough money' };
  g.s.money -= l.broken.cost; l.repairAt = g.s.time + Math.ceil(l.broken.seconds);
  return { ok: true, cost: l.broken.cost, at: l.repairAt };
}
export function repairAllPrice(g) { return liveLines(g).filter((l) => l.broken && l.repairAt == null).reduce((a, l) => a + l.broken.cost, 0); }
export function repairAll(g) {
  const ls = liveLines(g).filter((l) => l.broken && l.repairAt == null);
  if (!ls.length) return { ok: false, reason: 'Nothing to repair' };
  let cost = 0; for (const l of ls) { const r = repair(g, l.id); if (r.ok) cost += r.cost; }
  return { ok: true, cost };
}
export function coolant(g) {
  const D = g.s.dis; if (!D.flare) return { ok: false, reason: 'No core flare' };
  const p = Math.round(DISASTERS.coreFlare.coolant * pm(g));
  if (g.s.money - p < CHARTERS[g.s.charter].debt) return { ok: false, reason: 'Not enough money' };
  g.s.money -= p; D.flare = null; g.refreshFlare(); g.dirty = true; return { ok: true, cost: p };
}
export function restorePower(g) {
  if (!g.s.blackoutUntil) return { ok: false, reason: 'No blackout' };
  const p = Math.round(DISASTERS.blackout.restore * pm(g));
  if (g.s.money - p < CHARTERS[g.s.charter].debt) return { ok: false, reason: 'Not enough money' };
  g.s.money -= p; for (const st of liveStations(g)) if (st.closedUntil > g.s.time) st.closedUntil = g.s.time; g.s.blackoutUntil = null; g.dirty = true;
  return { ok: true, cost: p };
}

/** Disaster panel for the UI. */
export function disasterView(g) {
  const D = g.s.dis;
  return {
    warning: D.warning ? { ...D.warning, name: DISASTERS[D.warning.type].name, targetName: targetName(g, D.warning), secondsLeft: D.warning.hitAt - g.s.time, bracePrice: bracePrice(g), canReroute: typeof D.warning.target === 'number' && ['meteor', 'seaquake', 'caveIn'].includes(D.warning.type) } : null,
    broken: liveLines(g).filter((l) => l.broken).map((l) => ({ line: l.id, lineName: lineName(g, l), by: l.broken.by, cost: l.broken.cost, seconds: l.broken.seconds, repairAt: l.repairAt ?? null, segments: l.broken.segments ?? null })),
    repairAllPrice: repairAllPrice(g),
    flare: D.flare, ringSlow: g.s.ringSlow || null, blackoutUntil: g.s.blackoutUntil || null, driftDelays: g.s.driftDelays || null,
    nextAt: D.nextAt, history: D.history.slice(-10),
  };
}
