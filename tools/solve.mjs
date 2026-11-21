#!/usr/bin/env node
// tools/solve.mjs — plays a Charter from a starting region with the greedy strategy from the Tech plan,
// prints quota times, money curve, idle gaps and type shares, and writes design/solutions/charter-<n>.json.
//
//   node tools/solve.mjs                      all six Charters and Galactic from their regions (recorded solutions)
//   node tools/solve.mjs --charter III        one Charter (region from SOLUTION_REGION unless --region)
//   node tools/solve.mjs --sweep              7 Charters (I-VI, Galactic) × 6 regions × 2 seeds
//   node tools/solve.mjs --verify             replay each written solution and check its hashes
//   node tools/solve.mjs --sweep --charter I,II --no-write --rows part.json   one part of a split sweep (run parts in parallel)
//   options: --region <id> --seed <n> --lookahead <s> --clusters <n> --no-write --quiet
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../game/src/sim.js';
import { CHARTERS, SOLUTION_REGION, SOLVER, SOLVER_TECH_PRIORITY, TYPES, CHARTER_IDS, REGIONS, GREEN } from '../game/src/tuning.js';
import { cellMeta, getCells, hexDistances } from '../game/src/planet.js';
import { angleDeg } from '../game/src/geo.js';
import { techPrice, techBlock } from '../game/src/tech.js';
import { liveStations, liveLines, components, lineGeo } from '../game/src/network.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOL_DIR = path.join(HERE, '..', 'design', 'solutions');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const QUIET = flag('quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };

const meta = cellMeta(), CELLS = getCells();
export const SOLUTION_SEEDS = { I: SOLVER.tutorialTermSeed, II: 202, III: 303, IV: 404, V: 515, VI: 626, G: 717 };

/** The tutorial's fixed script (Charter I, the Capital), times in game seconds. */
export function tutorialScript() {
  const T = meta.tutorial;
  return [
    [20, { type: 'buildRoute', a: T.a, b: T.b, kind: 'surface' }],
    [90, { type: 'addTrain', line: 0 }],
    [180, { type: 'buildRoute', a: { station: 1 }, b: meta.terminal, kind: 'core' }],
    [370, { type: 'green', cell: T.path[1], kind: 'park' }],
    [430, { type: 'buildRoute', a: meta.capitalCentre, b: { station: 1 }, kind: 'earth' }],
    [520, { type: 'buildRoute', a: T.peaks[0], b: T.peaks[1], kind: 'sky' }],
  ];
}

// ------------------------------------------------------------------ evaluation
function value(g, t0Money, minutes) {
  return g.throughput() * 10 + (g.s.money - t0Money) / minutes;
}
export function lookahead(g, action, seconds) {
  const c = g.clone();
  let cost = 0;
  for (const a of action ? (Array.isArray(action) ? action : [action]) : []) { const r = c.act(a); if (!r.ok) return null; cost += r.cost || 0; }
  const m0 = c.s.money;
  autoDisasters(c, null);
  const step = 15;
  for (let t = 0; t < seconds; t += step) { c.step(step); autoDisasters(c, null); }
  return { v: value(c, m0, seconds / 60), cost };
}
/** Answer disasters: Brace if affordable, else Reroute; Repair all when something is broken. */
function autoDisasters(g, rec) {
  const w = g.s.dis.warning;
  const doIt = (a) => { const r = g.act(a); if (r.ok && rec) rec.push([g.s.time, a]); return r; };
  if (w && !w.braced && !w.rerouted) {
    const d = g.disasters();
    if (g.s.money - d.warning.bracePrice > 800) doIt({ type: 'brace' });
    else if (d.warning.canReroute) doIt({ type: 'reroute' });
  }
  if (g.s.dis.flare && g.s.money > 3000) doIt({ type: 'coolant' });
  if (g.s.blackoutUntil && g.s.money > 3000) doIt({ type: 'restorePower' });
  const rp = g.disasters().repairAllPrice;
  if (rp > 0 && g.s.money - rp > 0) doIt({ type: 'repairAll' });
}

// ------------------------------------------------------------------ candidates
function placeOf(g, cell) {
  const st = liveStations(g).find((s) => s.cell === cell && s.kind !== 'core');
  return st ? { station: st.id } : cell;
}
function clusters(g, n) {
  const gen = g.generation();
  const s = g.s, out = [];
  const val = (c) => (CELLS[c].isCity && !s.demolished[c] && !s.green[c] && !gen.cover.has(c) ? s.densities[c] : 0) + (CELLS[c].terrain === 3 && !gen.cover.has(c) && g.mods.water ? CELLS[c].density * 1.5 : 0);
  const score = CELLS.map((c) => {
    let v = val(c.id); for (const m of c.neighbours) v += val(m);
    if (s.priority.includes(c.id)) v *= 1.6;
    return [c.id, v];
  }).filter(([id, v]) => v > 0 && (CELLS[id].land || CELLS[id].terrain === 3));
  score.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const used = new Set();
  for (const [id] of score) {
    if (out.length >= n) break;
    if (used.has(id)) continue;
    out.push(id);
    for (const m of hexDistances(id, 2).reduce((acc, d, i) => (d >= 0 ? (acc.push(i), acc) : acc), [])) used.add(m);
  }
  return out;
}
function terminalStations(g) {
  const comp = components(g);
  return liveStations(g).filter((s) => s.kind !== 'core' && comp.comp.get(s.id) === comp.terminal);
}
function nearestStations(g, cell, list, k = 2) {
  return list.slice().sort((a, b) => angleDeg(CELLS[a.cell].pos, CELLS[cell].pos) - angleDeg(CELLS[b.cell].pos, CELLS[cell].pos) || a.id - b.id).slice(0, k);
}

/** Card balance metric: over every card comparison the solver evaluates (>= 2 cards that carry something), how
 *  often one card is both Cheapest and Most capacity, by kind; and builds per kind (solve() fills `builds`). */
export const CARD_STATS = { comparisons: 0, bothTagged: 0, bothByKind: {}, cheapestByKind: {}, capacityByKind: {}, builds: {} };
export function resetCardStats() { CARD_STATS.comparisons = 0; CARD_STATS.bothTagged = 0; CARD_STATS.bothByKind = {}; CARD_STATS.cheapestByKind = {}; CARD_STATS.capacityByKind = {}; CARD_STATS.builds = {}; }
function tallyCards(cards) {
  const tagged = cards.filter((c) => c.tags.length);
  if (!tagged.length) return;
  CARD_STATS.comparisons++;
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const c of tagged) {
    if (c.tags.includes('Cheapest')) inc(CARD_STATS.cheapestByKind, c.kind);
    if (c.tags.includes('Most capacity')) inc(CARD_STATS.capacityByKind, c.kind);
    if (c.tags.length === 2) { CARD_STATS.bothTagged++; inc(CARD_STATS.bothByKind, c.kind); }
  }
}
export function candidates(g, opts) {
  const out = [];
  const s = g.s;
  const seen = new Set();
  const addCards = (a, b, why) => {
    if (a == null || b == null) return;
    const cards = g.routeCards(a, b);
    tallyCards(cards);
    for (const c of cards) {
      if (!c.feasible) continue;
      const key = c.kind + JSON.stringify(a) + JSON.stringify(b);
      if (seen.has(key)) { if (why === 'priority') for (const o of out) if (o.key === key) o.why = 'priority'; continue; }
      seen.add(key);
      out.push({ key, action: { type: 'buildRoute', a, b, kind: c.kind }, cost: c.cost, h: (c.exportsGain * 10 + c.carries * 0.3) / Math.max(200, c.cost), why, kind: c.kind });
    }
  };
  const termSt = terminalStations(g);
  // 1. top unserved dense clusters → nearest network stations (in the Terminal's component);
  //    plus the best clusters near the network (value discounted by distance), so cheap links are on the list
  const cl = clusters(g, opts.clusters * 4);
  const near = (c) => Math.min(...termSt.map((st) => angleDeg(CELLS[st.cell].pos, CELLS[c].pos)));
  const nearSet = cl.slice().sort((a, b) => near(a) - near(b) || a - b).slice(0, opts.clusters);
  for (const c of [...new Set([...cl.slice(0, opts.clusters), ...nearSet])]) for (const st of nearestStations(g, c, termSt, 2)) addCards(c, { station: st.id }, 'cluster');
  // 1b. the densest far clusters straight to the Warp Terminal through the core (the long haul a player makes)
  const tpos = CELLS[s.stations[s.terminalStation].cell].pos;
  for (const c of cl.slice(0, opts.clusters).filter((c) => CELLS[c].land && angleDeg(CELLS[c].pos, tpos) >= TYPES.fire.minAngle).slice(0, 2)) addCards(c, { station: s.terminalStation }, 'cluster');
  // 2. stations not linked to the Terminal
  const comp = components(g);
  const unlinked = liveStations(g).filter((x) => x.kind !== 'core' && comp.comp.get(x.id) !== comp.terminal);
  for (const u of unlinked.slice(0, 3)) for (const st of nearestStations(g, u.cell, termSt, 2)) addCards({ station: u.id }, { station: st.id }, 'link');
  // 3. priority districts
  const gen = g.generation();
  for (const p of s.priority) if (!(gen.cover.get(p) || []).some((id) => comp.comp.get(id) === comp.terminal)) for (const st of nearestStations(g, p, termSt, 2)) addCards(p, { station: st.id }, 'priority');
  if (!g.frontierLinked()) {
    const start = CELLS[meta.starts[s.region]].pos;
    const far = s.priority.slice().sort((a, b) => angleDeg(CELLS[b].pos, start) - angleDeg(CELLS[a].pos, start) || a - b)[0];
    for (const c of out) if (c.why === 'priority' && c.action.a === far) c.frontier = true;
  }
  // 3b. bypasses: the stations holding the most waiting exports get their own links to the Terminal
  if (g.demand && g.demand.bx) {
    const D = g.demand;
    const waitX = D.exports.map((e, i) => [e.s, D.bx[i]]).filter(([, w]) => w > 5).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
    const avoid = new Set(); const bb = g.breakdown().bottleneck; if (bb.target?.station != null) avoid.add(bb.target.station);
    for (const [sid] of waitX) {
      const st = s.stations[sid];
      addCards({ station: sid }, s.terminalStation === sid ? null : { station: s.terminalStation }, 'bypass');
      const pathOf = new Map(D.exports.map((e) => [e.s, e]));
      const clear = (x) => { const e = pathOf.get(x.id); if (!e) return x.id === s.terminalStation; if (e.direct) return true; const p = e.paths && e.paths[0]; return !!p && !p.xfers.some((y) => avoid.has(y)); };
      for (const t of nearestStations(g, st.cell, termSt.filter((x) => x.id !== sid && !avoid.has(x.id) && x.id !== s.terminalStation && clear(x)), 2)) addCards({ station: sid }, { station: t.id }, 'bypass');
    }
  }
  // 4. the named bottleneck's fix
  const bd = g.breakdown();
  const b = bd.bottleneck;
  const trainPrice = (l) => Math.round(TYPES[l.type].train * CHARTERS[s.charter].price);
  if (b.kind === 'line' && b.target) { const l = s.lines[b.target.line]; out.push({ action: { type: 'addTrain', line: l.id }, cost: trainPrice(l), h: 1, why: 'bottleneck' }); }
  if (b.kind === 'interchange' && b.target) {
    const st = s.stations[b.target.station];
    if (!st.upgraded) out.push({ action: { type: 'upgradeInterchange', station: st.id }, cost: Math.round(600 * CHARTERS[s.charter].price), h: 1, why: 'bottleneck' });
  }
  // busy lines (load > 85%) get a train candidate too, singly and all together (chained legs bind together)
  const busy = [];
  for (const l of g.lines()) if (l.open && l.load > 0.85 && l.trains < 10) { const a = { type: 'addTrain', line: l.id }; busy.push([a, trainPrice(s.lines[l.id])]); out.push({ action: a, cost: trainPrice(s.lines[l.id]), h: 0.5, why: 'busy' }); }
  for (const st of g.stations()) if (isFinite(st.capacity) && !st.upgraded && st.transferFlow > 0.85 * st.capacity) { const a = { type: 'upgradeInterchange', station: st.id }; const p = Math.round(600 * CHARTERS[s.charter].price); busy.push([a, p]); out.push({ action: a, cost: p, h: 0.5, why: 'busy' }); }
  if (busy.length > 1) out.push({ action: busy.map((x) => x[0]), cost: busy.reduce((a, x) => a + x[1], 0), h: 0.6, why: 'busyAll' });
  // the line named by the bottleneck plus every busy line of the same route (shafts and fire chord together)
  if (b.kind === 'line' && b.target) {
    const l0 = s.lines[b.target.line];
    if (l0.core) {
      const route = busy.filter(([a]) => a.type === 'addTrain' && s.lines[a.line].core);
      if (route.length > 1) out.push({ action: route.map((x) => x[0]), cost: route.reduce((a, x) => a + x[1], 0), h: 0.9, why: 'bottleneckRoute' });
    }
  }
  // 5. the next tech on the region's list
  const pri = SOLVER_TECH_PRIORITY[s.region] || [];
  const next = pri.find((id) => !s.tech[id] && !techBlock(s, id));
  const named = b.kind === 'warp' ? ['warpConsists', 'twinLaunchRing'] : b.kind === 'interchange' ? ['biggerInterchanges', 'wideShafts'] : [];
  for (const id of new Set([next, ...named.filter((x) => !s.tech[x] && !techBlock(s, x))])) {
    if (!id) continue;
    const p = techPrice(s, id);
    if (named.includes(id) || s.money > 2 * p) out.push({ action: { type: 'buyTech', id }, cost: p, h: 0.8, why: 'tech' });
  }
  // narrow yard: Twin Launch Ring's branch is the way out
  if (s.mandates.includes('narrowYard') && !s.tech.twinLaunchRing) for (const id of ['biggerInterchanges', 'warpConsists', 'warpAnchor', 'twinLaunchRing']) if (!s.tech[id] && !techBlock(s, id)) { out.push({ action: { type: 'buyTech', id }, cost: techPrice(s, id), h: 1, why: 'narrowYard' }); break; }
  // 6. a park on a cleared corridor cell when Greenery is under target
  const cityN = CELLS.filter((c) => c.isCity).length;
  if (g.greeneryScore() < GREEN.gradeShare * cityN && s.money > SOLVER.parkMoney) {
    const cell = s.demolished.findIndex((d, i) => d && !s.green[i] && !s.stations.some((x) => x && x.cell === i));
    if (cell >= 0) out.push({ action: { type: 'green', cell, kind: 'park' }, cost: Math.round(GREEN.park.price * CHARTERS[s.charter].price), h: 0.2, why: 'green' });
  }
  return out;
}

/** Exports jammed behind a full interchange, or a full line that more trains can't cheaply fix (a line with few trains,
 *  e.g. a new core route's 1-train shaft, is fixed by the bottleneck's addTrain candidate, not by a bypass). */
function jammed(g, bd) {
  const b = bd.bottleneck;
  if (b.kind === 'interchange') return true;
  if (b.kind !== 'line') return false;
  const l = b.target ? g.s.lines[b.target.line] : null;
  return !l || l.trains >= 4;
}
/** Frontier Link: once Quota I is within reach, linking the frontier district is what counts. */
function frontierScore(g, score) {
  const q1 = CHARTERS[g.s.charter].quotas[0];
  return g.s.quota.stage === 0 && g.throughput() >= 0.6 * q1 ? 1e3 + score : Math.max(score, 0.01) * 4;
}

/** Track share per card kind (shafts count with the core route) and the set of types used. */
function typeMix(g) {
  const track = {}; let tot = 0;
  for (const l of liveLines(g)) { if (l.inherited) continue; const L = lineGeo(g, l).length; const k = l.core ? 'core' : l.type; track[k] = (track[k] || 0) + L; tot += L; }
  return { track, tot, kinds: new Set(Object.keys(track)) };
}
/** Solver heuristic: favour a third type while fewer than 3 are used; damp a kind above 50% of track. */
function diversity(mix, kind) {
  const k = kind === 'hybrid' ? 'surface' : kind;
  let f = 1;
  if (mix.kinds.size < 3 && !mix.kinds.has(k)) f *= 1.6;
  const sh = mix.tot > 200 ? (mix.track[k] || 0) / mix.tot : 0;
  if (sh > 0.5) f *= 0.6;
  if (sh > 0.55) f *= 0.5;
  return f;
}

/** Is there an unaffordable route card worth saving for (score per $ > 1.5× the best affordable one)? */
function savingFor(g, opts, la, base, best) {
  if (best.cost > 0.4 * g.s.money && best.why !== 'tech' && best.why !== 'green') return false;
  const all = candidates(g, opts).filter((c) => c.frontier || (c.why === 'cluster' || c.why === 'link' || c.why === 'bypass' || c.why === 'priority') && c.cost > g.s.money - SOLVER.minMoney && c.cost < 4 * Math.max(2000, g.s.money + 10 * 60 * Math.max(100, g.s.ema.fares - g.upkeepPerMin())));
  all.sort((a, b) => b.h - a.h);
  for (const c of all.slice(0, 3)) {
    const cl = g.clone(); cl.s.money += c.cost;
    const r = lookahead(cl, c.action, la);
    if (!r) continue;
    let score = (r.v - base.v) / Math.max(100, r.cost);
    if (c.frontier) score = frontierScore(g, score);
    if (c.why === 'bypass') { const b = g.breakdown(); if (jammed(g, b) && b.made > 1.15 * b.reaching) score *= 3; }
    if (score > 1.5 * best.score) return true;
  }
  return false;
}

// ------------------------------------------------------------------ one term
export function solve({ charter, region, termSeed, tutorial = false, lookaheadS = SOLVER.lookahead, nClusters = SOLVER.clusters, evalTop = 10, realLimitMs = 120000 }) {
  const t0 = performance.now();
  resetCardStats();
  const g = Game.newTerm(tutorial ? { tutorial: true } : { charter, region, termSeed });
  const actions = [];
  const quotas = [];
  const moneyCurve = [];
  let idleSince = null, idleMax = 0;
  const doAct = (a) => { const r = g.act(a); if (r.ok) { actions.push([g.s.time, a]); if (a.type === 'buildRoute') CARD_STATS.builds[a.kind] = (CARD_STATS.builds[a.kind] || 0) + 1; if (process.env.SOLVE_DEBUG) dbg.push([g.s.time, g.hash()]); } return r; };
  const dbg = [];
  const prefix = tutorial ? tutorialScript() : [];
  let pi = 0;
  const deadline = CHARTERS[g.s.charter].deadline * 60 + 15 * 60;
  let nextDecision = 30, lastStage = 0;
  while (!g.s.won && !g.s.termOver && g.s.time < deadline) {
    // step to the next event: a prefix action, a decision, or a disaster
    const nextT = pi < prefix.length ? Math.min(prefix[pi][0], nextDecision) : nextDecision;
    while (g.s.time < nextT && !g.s.won && !g.s.termOver) {
      g.step(1);
      let qhit = false;
      if (g.s.quota.stage !== lastStage) {
        for (let k = lastStage; k < g.s.quota.stage; k++) quotas.push({ quota: k + 1, time: g.s.quota.metAt[k], hash: g.hash(), money: Math.round(g.s.money), throughput: g.throughput() });
        lastStage = g.s.quota.stage; nextDecision = g.s.time; qhit = true;
      }
      if (!g.s.won && (g.s.dis.warning || g.disasters().repairAllPrice > 0)) autoDisasters(g, actions);
      if (qhit) break;
    }
    if (g.s.won || g.s.termOver) break;
    if (pi < prefix.length && g.s.time >= prefix[pi][0]) { const r = doAct(prefix[pi][1]); if (!r.ok) log('prefix action failed', prefix[pi][1], r.reason); pi++; continue; }
    if (g.s.time < nextDecision) continue;
    nextDecision = g.s.time + SOLVER.everySeconds;
    if (pi < prefix.length) continue; // the tutorial's own pace
    moneyCurve.push([g.s.time, Math.round(g.s.money)]);
    // decide
    const timeLeft = realLimitMs - (performance.now() - t0);
    const la = timeLeft < realLimitMs * 0.25 ? Math.min(lookaheadS, 60) : lookaheadS;
    let picks = 0, affordableAny = false, saving = false;
    const opts0 = { clusters: nClusters };
    // Frontier Link: once Quota I is in reach, link the frontier district first (save for it if needed)
    if (g.s.mandates.includes('frontierLink') && g.s.quota.stage === 0 && !g.frontierLinked() && g.s.time >= 0) {
      const fc = candidates(g, opts0).filter((c) => c.frontier).sort((a, b) => a.cost - b.cost);
      if (fc.length) {
        affordableAny = true;
        if (fc[0].cost <= g.s.money - SOLVER.minMoney) doAct(fc[0].action);
        continue;
      }
    }
    // the Warp ring: when the next quota is above the deep space ceiling, climb the deep space branch
    {
      const bd = g.breakdown(), q = CHARTERS[g.s.charter].quotas[g.s.quota.stage];
      if (q != null && q > 0.97 * bd.ceiling && g.throughput() >= 0.6 * bd.ceiling) {
        const id = ['biggerInterchanges', 'warpConsists', 'warpAnchor', 'twinLaunchRing'].find((x) => !g.s.tech[x]);
        if (id) { affordableAny = true; if (techPrice(g.s, id) <= g.s.money - SOLVER.minMoney) doAct({ type: 'buyTech', id }); continue; }
      }
    }
    for (let round = 0; round < 3; round++) {
      let cands = candidates(g, { clusters: nClusters });
      // stranded exports (an interchange or line full, made well above reaching): stop feeding the jam; save for a bypass
      const bd0 = g.breakdown();
      if (jammed(g, bd0) && bd0.made > 1.3 * bd0.reaching && cands.some((c) => c.why === 'bypass')) {
        cands = cands.filter((c) => c.why !== 'cluster' && !(c.why === 'priority' && !c.frontier));
        affordableAny = true;
      }
      cands = cands.filter((c) => c.cost <= g.s.money - SOLVER.minMoney || (c.cost === 0));
      if (cands.length) affordableAny = true;
      if (!cands.length) break;
      cands.sort((a, b) => b.h - a.h);
      const routeC = cands.filter((c) => c.why === 'cluster' || c.why === 'link' || c.why === 'bypass' || c.why === 'priority');
      const bestPerKind = Object.values(routeC.reduce((m, c) => { if (!m[c.kind]) m[c.kind] = c; return m; }, {}));
      const top = [...new Set([...cands.filter((c) => !routeC.includes(c)).slice(0, 6), ...routeC.slice(0, evalTop), ...bestPerKind])];
      const base = lookahead(g, null, la);
      const mix = typeMix(g);
      const bdn = g.breakdown();
      const stranded = jammed(g, bdn) && bdn.made > 1.15 * bdn.reaching;
      let best = null, alt = null;
      for (const c of top) {
        const r = lookahead(g, c.action, la);
        if (!r) continue;
        let score = (r.v - base.v) / Math.max(100, r.cost);
        if (c.kind && score > 0) score *= diversity(mix, c.kind);
        if (c.frontier) score = frontierScore(g, score);
        if (c.why === 'bypass' && stranded) score = Math.max(score, 0) * 3 + (score > 0 ? 0 : 0.002);
        if (!best || score > best.score) best = { ...c, score, gain: r.v - base.v };
        const ck = c.kind === 'hybrid' ? 'surface' : c.kind;
        if (score > 0 && (!c.kind || (mix.tot > 200 && (mix.track[ck] || 0) / mix.tot <= 0.55)) && (!alt || score > alt.score)) alt = { ...c, score, gain: r.v - base.v };
      }
      // type share: if the pick is of a kind already above 55% of track, prefer a decent pick of another kind
      if (best && best.kind) {
        const k = best.kind === 'hybrid' ? 'surface' : best.kind;
        if (mix.tot > 200 && (mix.track[k] || 0) / mix.tot > 0.55 && alt && alt.score >= 0.3 * best.score) best = alt;
      }
      // saving: if a route we can't afford yet is clearly better per $, wait for it instead of spending on small things
      if (best && round === 0 && savingFor(g, opts0, la, base, best)) { saving = true; break; }
      if (!best || best.score <= 0) break;
      let okAll = true;
      for (const a of Array.isArray(best.action) ? best.action : [best.action]) { const r = doAct(a); if (!r.ok) { okAll = false; break; } }
      if (!okAll) break;
      picks++;
      if (g.s.money < SOLVER.minMoney) break;
    }
    if (saving) affordableAny = true;
    if (!affordableAny) { if (idleSince == null) idleSince = g.s.time; idleMax = Math.max(idleMax, g.s.time - idleSince); }
    else idleSince = null;
  }
  if (idleSince != null) idleMax = Math.max(idleMax, g.s.time - idleSince);
  // type shares
  const track = {}; let trackTot = 0; const types = new Set();
  for (const l of liveLines(g)) { if (l.inherited) continue; const L = lineGeo(g, l).length; const k = l.core ? 'core' : l.type; track[k] = (track[k] || 0) + L; trackTot += L; types.add(l.type); }
  const shares = Object.fromEntries(Object.entries(track).map(([k, v]) => [k, +(v / trackTot).toFixed(3)]));
  return {
    charter: g.s.charter, region: g.s.region, termSeed: g.s.termSeed, tutorial,
    commended: g.s.won, commendedAt: g.s.commendedAt, termOver: g.s.termOver, overtime: g.s.overtime,
    quotas, actions, idleGapMax: idleMax, types: [...types].sort(), trackShares: shares,
    moneyCurve, finalHash: g.hash(), finalTime: g.s.time, money: Math.round(g.s.money), stations: liveStations(g).length, lines: liveLines(g).length,
    cardStats: JSON.parse(JSON.stringify(CARD_STATS)), dbg, realSeconds: +((performance.now() - t0) / 1000).toFixed(1), perf: g.perfStats(), throughput: g.throughput(),
  };
}

/** Replay a recorded solution and compare hashes at each quota. */
export function replay(sol) {
  const g = Game.newTerm(sol.tutorial ? { tutorial: true } : { charter: sol.charter, region: sol.region, termSeed: sol.termSeed });
  const got = [];
  let lastStage = 0;
  const check = () => { if (g.s.quota.stage !== lastStage) { for (let k = lastStage; k < g.s.quota.stage; k++) got.push({ quota: k + 1, time: g.s.quota.metAt[k], hash: g.hash() }); lastStage = g.s.quota.stage; } };
  for (const [t, a] of sol.actions) {
    while (g.s.time < t) { g.step(1); check(); }
    const r = g.act(a); if (!r.ok) return { ok: false, reason: `action at ${t} failed: ${r.reason}`, got };
    check();
  }
  const end = sol.commendedAt ?? sol.finalTime;
  while (g.s.time < end && !g.s.termOver) { g.step(1); check(); }
  const ok = sol.quotas.every((q, i) => got[i] && got[i].hash === q.hash && got[i].time === q.time);
  return { ok, got, want: sol.quotas };
}

/** Sweep-wide card metric: share of comparisons where one card takes both tags (per kind) and builds per kind. */
export function cardMetric(rows) {
  let comp = 0, both = 0; const byKind = {}, builds = {};
  for (const r of rows) {
    const c = r.cardStats; if (!c) continue;
    comp += c.comparisons; both += c.bothTagged;
    for (const [k, v] of Object.entries(c.bothByKind)) byKind[k] = (byKind[k] || 0) + v;
    for (const [k, v] of Object.entries(c.builds)) builds[k] = (builds[k] || 0) + v;
  }
  const nb = Object.values(builds).reduce((a, v) => a + v, 0);
  const pct = (x, n) => +(100 * x / Math.max(1, n)).toFixed(1);
  return { comparisons: comp, bothTaggedPct: pct(both, comp), bothByKindPct: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, pct(v, comp)])), builds: nb, buildsByKindPct: Object.fromEntries(Object.entries(builds).map(([k, v]) => [k, pct(v, nb)])) };
}
function cardMetricText(rows) { return 'card metric ' + JSON.stringify(cardMetric(rows)); }
function summary(r) {
  const q = (k) => { const x = r.quotas.find((y) => y.quota === k); return x ? (x.time / 60).toFixed(1) : '—'; };
  return `${r.charter.padEnd(3)} ${r.region.padEnd(9)} seed ${String(r.termSeed).padEnd(5)} QI ${q(1).padStart(5)} QII ${q(2).padStart(5)} QIII ${q(3).padStart(5)}  idle ${String(r.idleGapMax).padStart(4)}s  types ${r.types.join(',')}  shares ${JSON.stringify(r.trackShares)}  $${r.money}  ${r.stations}st/${r.lines}ln  ${r.realSeconds}s${r.commended ? '' : '  NOT COMMENDED'}${r.overtime ? ' (overtime)' : ''}`;
}
function passes(r) {
  const maxShare = Math.max(...Object.values(r.trackShares));
  return r.commended && !r.overtime && r.idleGapMax <= SOLVER.idleGapLimit && r.types.length >= 3 && maxShare <= 0.6;
}

// ------------------------------------------------------------------ main
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const write = !flag('no-write');
  if (flag('verify')) {
    let bad = 0;
    for (const n of ['I', 'II', 'III', 'IV', 'V', 'VI', 'G']) {
      const f = path.join(SOL_DIR, `charter-${n}.json`);
      if (!fs.existsSync(f)) { console.log(n, 'missing'); bad++; continue; }
      const sol = JSON.parse(fs.readFileSync(f, 'utf8'));
      const r = replay(sol);
      console.log(n, r.ok ? 'replay OK' : 'replay MISMATCH', JSON.stringify(r.got.map((x) => [x.quota, x.time, x.hash])));
      if (!r.ok) bad++;
    }
    process.exit(bad ? 1 : 0);
  }
  if (flag('sweep')) {
    const rows = []; let fails = 0;
    const seeds = [11, 22];
    const charters = arg('charter') ? arg('charter').split(',') : ['I', 'II', 'III', 'IV', 'V', 'VI', 'G'];
    const regions = arg('region') ? [arg('region')] : ['capital', 'brine', 'rift', 'spires', 'flats', 'ringside'];
    for (const ch of charters) for (const rg of regions) for (const sd of seeds) {
      const r = solve({ charter: ch, region: rg, termSeed: sd, lookaheadS: +(arg('lookahead') || SOLVER.sweepLookahead), nClusters: +(arg('clusters') || SOLVER.sweepClusters), evalTop: +(arg('evaltop') || 10), realLimitMs: 90000 });
      if (!QUIET) process.stdout.write('');
      const ok = r.commended && r.idleGapMax <= SOLVER.idleGapLimit;
      if (!ok) fails++;
      console.log((ok ? 'ok   ' : 'FAIL ') + summary(r));
      rows.push({ charter: ch, region: rg, seed: sd, quotas: r.quotas.map((q) => q.time), idleGapMax: r.idleGapMax, shares: r.trackShares, commended: r.commended, overtime: r.overtime, ok, cardStats: r.cardStats });
    }
    console.log(cardMetricText(rows));
    if (arg('rows')) fs.writeFileSync(arg('rows'), JSON.stringify(rows, null, 1)); // part of a split sweep (merge with --merge)
    if (write) {
      const f = path.join(SOL_DIR, 'sweep.json');
      const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { seeds, rows: [] };
      const keep = prev.rows.filter((r) => !rows.some((x) => x.charter === r.charter && x.region === r.region && x.seed === r.seed));
      fs.writeFileSync(f, JSON.stringify({ seeds, lookahead: +(arg('lookahead') || SOLVER.sweepLookahead), rows: [...keep, ...rows] }, null, 1));
    }
    console.log(`${rows.length - fails}/${rows.length} sweep runs pass`);
    process.exit(fails ? 1 : 0);
  }
  const charters = arg('charter') ? [arg('charter')] : ['I', 'II', 'III', 'IV', 'V', 'VI', 'G'];
  let bad = 0;
  for (const ch of charters) {
    const region = arg('region') || SOLUTION_REGION[ch];
    const termSeed = +(arg('seed') || SOLUTION_SEEDS[ch]);
    const tutorial = ch === 'I' && region === 'capital' && !arg('seed');
    const r = solve({ charter: ch, region, termSeed, tutorial, lookaheadS: +(arg('lookahead') || SOLVER.lookahead), nClusters: +(arg('clusters') || SOLVER.clusters) });
    const ok = passes(r);
    if (!ok) bad++;
    console.log((ok ? 'PASS ' : 'FAIL ') + summary(r));
    const q3 = CHARTERS[ch].quotas[2], reach = (CHARTERS[ch].warpCars + 2) * 50 * 3;
    log(`     Quota III ${q3} = ${Math.round(100 * q3 / reach)}% of the reachable ceiling ${reach}; perf ${JSON.stringify(r.perf)}`);
    if (write) { fs.mkdirSync(SOL_DIR, { recursive: true }); fs.writeFileSync(path.join(SOL_DIR, `charter-${ch}.json`), JSON.stringify(r, null, 1)); }
  }
  process.exit(bad ? 1 : 0);
}
