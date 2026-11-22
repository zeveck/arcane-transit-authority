// routes.js — route cards (one per feasible kind: Surface, Sky, Water, Earth, Through the core, Space,
// Hybrid), their cost / carries / exports numbers and feasibility reasons, the build plans that make them,
// and the inherited network. A card's numbers come from trial-applying its plan to the live network and
// rolling it back (the same geometry and capacity code the sim uses).

import { TYPES, CHARTERS, REGIONS, SIM, PLANET, TRAINS_PER_NEW_LINE, INTERCHANGE_LAYER_FEE, VIADUCT_TRACK_MULT, VIADUCT_MAX_OCEAN, TRANSFER, EARTH_LONG_CHORD, SHAFT_TRAINS, TUTORIAL } from './tuning.js';
import { TERRAIN, hexDistances, isWater, cellMeta } from './planet.js';
import { angleDeg, angleRad, gcDist, dot } from './geo.js';
import { Heap, computePaths } from './paths.js';
import {
  layerCellBlock, stationCanTake, stationKindFor, layerPrice, demolitionPrice, liveStations, liveLines, coreUnder,
  lineGeo, lineCapacity, lineTime, stationCapacity, ringsFor, portalPos, segSegDist, stationPos, components, lineUpkeep,
} from './network.js';
import { maxEarthAngle } from './tech.js';
import { cellName, stationName, lineName } from './names.js';

export const CARD_KINDS = ['surface', 'sky', 'water', 'earth', 'core', 'space', 'hybrid'];
export const CARD_NAMES = { surface: 'Surface', sky: 'Sky', water: 'Water', earth: 'Earth', core: 'Through the core', space: 'Space', hybrid: 'Hybrid' };
export const BEST_AT = {
  surface: 'Short hops over light districts: fast and cheap to run, but every block it crosses is demolished.',
  sky: 'Peak to peak with light flow: cheapest to build, nothing to demolish.',
  water: 'The only way to serve Atlantis; island and coastal links.',
  earth: 'Under dense blocks, dig: nothing to demolish, up to the crust\'s angle.',
  core: 'The far side for a fair price: earth down, fire across, earth up.',
  space: 'Fastest and biggest along the ring, once elevators are affordable.',
  hybrid: 'A short surface feeder onto an existing station\'s layer.',
};
const TYPE_OF_KIND = { surface: 'surface', sky: 'sky', water: 'water', earth: 'earth', core: 'fire', space: 'space' };

// ------------------------------------------------------------------ places
/** Normalise a place reference: number (cell), {cell}, {station}. → { cell, station|null } */
export function resolvePlace(g, p) {
  if (p == null) return null;
  if (typeof p === 'number') return { cell: p, station: null };
  if (p.station != null) { const st = g.s.stations[p.station]; return st ? { cell: st.cell, station: st.id } : null; }
  if (p.cell != null) return { cell: p.cell, station: null };
  return null;
}

// ------------------------------------------------------------------ trial apply / rollback
/** Apply build ops to the live state. Returns { refs, changes }. Does not charge money. */
export function applyOps(g, ops, { inherited = false } = {}) {
  const S = g.s, refs = {};
  const res = (x) => (typeof x === 'string' ? refs[x] : x);
  const changes = { stationsLen: S.stations.length, linesLen: S.lines.length, layers: [], demolished: [], firstCrossing: S.firstCrossingUsed };
  const demolish = (c) => { if (!S.demolished[c] && g.ct[c].isCity) { S.demolished[c] = 1; changes.demolished.push(c); } };
  for (const op of ops) {
    switch (op.op) {
      case 'station': {
        const id = S.stations.length;
        S.stations.push({ id, cell: op.cell, kind: stationKindFor(g, op.cell, op.layer), layers: [op.layer], upgraded: false, parent: null, inherited, built: S.time, closedUntil: 0 });
        refs[op.ref] = id;
        break; // a Surface station is built into its block: its district keeps its people (it serves itself and its neighbours)
      }
      case 'layer': {
        const st = S.stations[res(op.station)];
        if (!st.layers.includes(op.layer)) { st.layers.push(op.layer); changes.layers.push([st.id, op.layer]); }
        if (op.ref) refs[op.ref] = st.id;
        break;
      }
      case 'core': {
        const parent = S.stations[res(op.parent)];
        const id = S.stations.length;
        S.stations.push({ id, cell: parent.cell, kind: 'core', layers: ['fire'], upgraded: false, parent: parent.id, coreSlot: op.slot || 0, inherited, built: S.time, closedUntil: 0 });
        refs[op.ref] = id;
        break;
      }
      case 'demolish': for (const c of op.cells) demolish(c); break;
      case 'line': {
        const id = S.lines.length;
        S.lines.push({ id, type: op.type, a: res(op.a), b: res(op.b), trains: op.trains ?? TRAINS_PER_NEW_LINE, shaft: !!op.shaft, cells: op.cells || null,
          slot: op.slot || 0, skyExtra: op.skyExtra || 0, portal: op.portal || [0, 0], ring: op.ring || null, inherited, built: S.time, closed: false, broken: null, core: !!op.coreRoute });
        refs[op.ref || ('L' + id)] = id;
        if (op.type === 'fire' && !inherited) S.firstCrossingUsed = true; // "a core route has been built" (the first-crossing cinematic)
        break;
      }
    }
  }
  g.invalidate();
  return { refs, changes };
}
export function rollbackOps(g, changes) {
  const S = g.s;
  for (let id = changes.linesLen; id < S.lines.length; id++) g.cache.geo.delete(id);
  S.stations.length = changes.stationsLen; S.lines.length = changes.linesLen;
  for (const [sid, layer] of changes.layers) { const st = S.stations[sid]; st.layers = st.layers.filter((x) => x !== layer); }
  for (const c of changes.demolished) S.demolished[c] = 0;
  S.firstCrossingUsed = changes.firstCrossing;
  g.invalidate();
}

// ------------------------------------------------------------------ endpoint resolution (the walkway rule)
/**
 * Where a layer's station goes for an end. Returns { ops, ref, cost, upgrades, newStations, reason, cell }.
 * Reuses an existing station within 1 cell that can serve the layer (interchange upgrade if needed);
 * otherwise builds a new one (on the end's cell, or for Sky / Water a fitting cell within 1, walkway-linked).
 */
function endStation(g, E, layer, refName, { protectCapital = false, avoid = null } = {}) {
  const cells = g.ct;
  const out = { ops: [], ref: null, cost: 0, upgrades: 0, newStations: 0, reason: null, cell: null, layersAdded: 0 };
  const tryStation = (st) => {
    out.cell = st.cell;
    if (st.layers.includes(layer)) { out.ref = st.id; return true; }
    if (layer === 'surface' && protectCapital && cells[st.cell].areaId === 'capital' && !g.s.demolished[st.cell] && cells[st.cell].isCity) { out.reason = 'Heritage Capital: no new demolition in the Capital'; return false; }
    const term = st.kind === 'terminal';
    const price = layerPrice(g, st.cell, layer, { forTerminal: term }) + (term ? 0 : Math.round(INTERCHANGE_LAYER_FEE * CHARTERS[g.s.charter].price));
    out.ops.push({ op: 'layer', station: st.id, layer, ref: refName });
    out.ref = refName; out.cost += price; out.upgrades++; out.layersAdded++;
    return true;
  };
  // 1. the given station
  if (E.station != null) { const st = g.s.stations[E.station]; if (stationCanTake(g, st, layer)) return tryStation(st) ? out : out; }
  // 2. an existing station within 1 cell that can serve the layer (same cell first, then by id)
  const near = [E.cell, ...cells[E.cell].neighbours];
  const cand = liveStations(g).filter((st) => near.includes(st.cell) && stationCanTake(g, st, layer) && !(avoid && avoid.includes(st.cell) && st.cell !== E.cell))
    .sort((a, b) => (a.cell === E.cell ? 0 : 1) - (b.cell === E.cell ? 0 : 1) || (b.layers.includes(layer) ? 1 : 0) - (a.layers.includes(layer) ? 1 : 0) || a.id - b.id);
  if (cand.length) { tryStation(cand[0]); return out; }
  // 3. a new station
  let cell = null;
  if (layerCellBlock(g, E.cell, layer) === null && !stationsBlockCell(g, E.cell, layer)) cell = E.cell;
  else if (layer === 'sky' || layer === 'water' || layer === 'space') {
    const opts = cells[E.cell].neighbours.filter((c) => layerCellBlock(g, c, layer) === null && !stationsBlockCell(g, c, layer) && !(avoid && avoid.includes(c)))
      .sort((a, b) => (layer === 'water' ? (cells[b].terrain === TERRAIN.ATLANTIS) - (cells[a].terrain === TERRAIN.ATLANTIS) : 0) || a - b);
    if (opts.length) cell = opts[0];
  }
  if (cell == null) {
    out.reason = layer === 'sky' ? 'No peak next to %E' : layer === 'water' ? '%E is not on the coast or next to Atlantis' : layer === 'space' ? '%E is too far from the equator for a Space Elevator' : '%E must be on land';
    return out;
  }
  if (layer === 'surface' && protectCapital && cells[cell].areaId === 'capital' && cells[cell].isCity && !g.s.demolished[cell]) { out.reason = 'Heritage Capital: no new demolition in the Capital'; return out; }
  out.ops.push({ op: 'station', cell, layer, ref: refName });
  out.ref = refName; out.cell = cell; out.cost += layerPrice(g, cell, layer); out.newStations++;
  return out;
}
/** A cell already holding a station of another kind that can't take the layer blocks a new one there. */
function stationsBlockCell(g, cell, layer) {
  return g.s.stations.some((s) => s && s.cell === cell && s.kind !== 'core' && !(layer === 'sky' || layer === 'water'));
}

// ------------------------------------------------------------------ path finding on cells
function cellAstar(g, from, to, passable, stepCost) {
  const cells = g.ct, n = cells.length;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const h = new Heap(); dist[from] = 0; h.push(0, from);
  const goal = cells[to].pos;
  const heur = (c) => angleRad(cells[c].pos, goal) * 100 * 0.5;
  const done = new Uint8Array(n);
  while (h.size) {
    const u = h.pop(); if (done[u]) continue; done[u] = 1;
    if (u === to) break;
    for (const v of cells[u].neighbours) {
      if (done[v] || !passable(v)) continue;
      const nd = dist[u] + stepCost(u, v);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(nd + heur(v), v); }
    }
  }
  if (!isFinite(dist[to])) return null;
  const path = []; for (let c = to; c >= 0; c = prev[c]) path.push(c);
  return path.reverse();
}

// ------------------------------------------------------------------ per-kind plans
const pm = (g) => CHARTERS[g.s.charter].price;
/** World units as the player reads them: 1 unit = 50 miles. */
export const miles = (u) => `${Math.round(u * 50).toLocaleString('en-US')} miles`;
const trainCost = (g, type, n = TRAINS_PER_NEW_LINE) => Math.round(TYPES[type].train * pm(g)) * n;
const lockedFor = (g, kind) => {
  if (kind === 'water' && !g.mods.water) return { tech: 'seaStations', text: 'Needs the Sea Stations tech' };
  if (kind === 'space' && !g.mods.space) return { tech: 'spaceElevators', text: 'Needs the Space Elevators tech' };
  return null;
};
/** Why a card can't be built, in plain words (the card shows its kind, so no "<Kind>:" prefix). %E → the end's tag. */
const fail = (kind, reason, extra = {}) => ({ kind, feasible: false, reason: reason ? reason[0].toUpperCase() + reason.slice(1) : reason, ...extra });
const endWhy = (e, tag) => e.reason.replace('%E', tag);

function planSurface(g, A, B, opts = {}) {
  const cells = g.ct;
  if (!cells[A.cell].land || !cells[B.cell].land) return fail('surface', landReason(g, A, B));
  const protect = g.s.mandates.includes('heritageCapital');
  const ea = endStation(g, A, 'surface', 'SA', { protectCapital: protect });
  if (ea.reason) return fail('surface', endWhy(ea, 'A'));
  const eb = endStation(g, B, 'surface', 'SB', { protectCapital: protect });
  if (eb.reason) return fail('surface', endWhy(eb, 'B'));
  if (ea.cell === eb.cell) return fail('surface', samePlace(g, ea));
  const stAt = new Map(); for (const s of liveStations(g)) if (s.kind !== 'core') { let a = stAt.get(s.cell); if (!a) stAt.set(s.cell, a = []); a.push(s); }
  const viaducts = g.mods.viaducts;
  const passable = (c) => {
    if (c === ea.cell || c === eb.cell) return true;
    const cc = cells[c];
    if (!cc.land && !viaducts) return false;
    if (cc.terrain === TERRAIN.TERMINAL) return false;
    if (g.s.green[c]) return false;
    const sts = stAt.get(c); if (sts && sts.some((s) => !s.layers.includes('surface'))) return false;
    if (protect && cc.areaId === 'capital' && cc.isCity && !g.s.demolished[c]) return false;
    return true;
  };
  const lost = SIM.surfaceLostFareShare * SIM.surfaceLostFareMinutes * SIM.surfaceAvgFare * SIM.commutersPerDensity;
  const tm = TYPES.surface.track * g.mods.trackCost.surface * pm(g);
  const stepCost = (u, v) => {
    const d = gcDist(cells[u].pos, cells[v].pos);
    const ocean = !cells[v].land;
    return d * tm * (ocean ? VIADUCT_TRACK_MULT : 1) + demolitionPrice(g, v, true) + lost * (cells[v].isCity && !g.s.demolished[v] ? g.s.densities[v] : 0) + (ocean ? 50 : 0);
  };
  const path = cellAstar(g, ea.cell, eb.cell, passable, stepCost);
  if (!path) return fail('surface', protect ? 'Heritage Capital: no path around the Capital' : 'No land path between them');
  const oceanCells = path.filter((c) => !cells[c].land).length;
  if (oceanCells > (viaducts ? VIADUCT_MAX_OCEAN : 0)) return fail('surface', viaducts ? 'Crosses more than 2 ocean cells (Elevated Viaducts allow 2)' : 'Can\'t cross the ocean (Elevated Viaducts bridge up to 2 ocean cells)');
  const inner = path.slice(1, -1);
  const demolishCells = inner.filter((c) => cells[c].isCity && !g.s.demolished[c] && !g.s.green[c]);
  const demolition = demolishCells.reduce((s, c) => s + demolitionPrice(g, c, true), 0);
  // shared corridors: lateral slot = number of existing surface lines sharing a consecutive cell pair
  const pairs = new Set(); for (let i = 0; i < path.length - 1; i++) pairs.add(Math.min(path[i], path[i + 1]) + ':' + Math.max(path[i], path[i + 1]));
  let slot = 0;
  for (const l of liveLines(g)) if (l.type === 'surface' && l.cells) { for (let i = 0; i < l.cells.length - 1; i++) if (pairs.has(Math.min(l.cells[i], l.cells[i + 1]) + ':' + Math.max(l.cells[i], l.cells[i + 1]))) { slot++; break; } }
  const stationDemolished = []; // Surface stations no longer demolish their own cell (round 2)
  // the tutorial's first line starts with TUTORIAL.firstLineTrains (1) so it gets busy: the add-a-train lesson
  const nTrains = g.s.tutorial && !liveLines(g).length ? TUTORIAL.firstLineTrains : TRAINS_PER_NEW_LINE;
  const ops = [...ea.ops, ...eb.ops, { op: 'demolish', cells: demolishCells }, { op: 'line', type: 'surface', a: ea.ref, b: eb.ref, cells: path, slot, ref: 'L1', trains: nTrains }];
  return {
    kind: 'surface', feasible: true, ops, legs: [{ ref: 'L1', type: 'surface' }], interior: [],
    fixedCost: ea.cost + eb.cost + demolition, demolition, stationsCost: ea.cost + eb.cost - stationDemolished.reduce((s, c) => s + demolitionPrice(g, c, true), 0),
    trackRate: { L1: tm }, oceanCells, trains: trainCost(g, 'surface', nTrains), demolishCells: [...stationDemolished, ...demolishCells],
    newStations: ea.newStations + eb.newStations, layersAdded: ea.layersAdded + eb.layersAdded,
  };
}

function planSky(g, A, B) {
  const ea = endStation(g, A, 'sky', 'KA');
  if (ea.reason) return fail('sky', endWhy(ea, 'A'));
  const eb = endStation(g, B, 'sky', 'KB');
  if (eb.reason) return fail('sky', endWhy(eb, 'B'));
  if (ea.cell === eb.cell) return fail('sky', samePlace(g, ea));
  const S = gcDist(g.ct[ea.cell].pos, g.ct[eb.cell].pos);
  if (S > g.mods.skyRange) return fail('sky', `Too far apart for a sky arc (${miles(S)}; range ${miles(g.mods.skyRange)}` + (g.mods.skyRange < TYPES.sky.rangeTech ? `; Long Arcs reach ${miles(TYPES.sky.rangeTech)})` : ')'));
  let extra = 0;
  const near = new Set([ea.cell, eb.cell, ...g.ct[ea.cell].neighbours, ...g.ct[eb.cell].neighbours]);
  for (const l of liveLines(g)) if (l.type === 'sky' && (near.has(g.s.stations[l.a].cell) || near.has(g.s.stations[l.b].cell))) extra++;
  const tm = TYPES.sky.track * g.mods.trackCost.sky * pm(g);
  const ops = [...ea.ops, ...eb.ops, { op: 'line', type: 'sky', a: ea.ref, b: eb.ref, skyExtra: extra, ref: 'L1' }];
  return { kind: 'sky', feasible: true, ops, legs: [{ ref: 'L1', type: 'sky' }], interior: [], fixedCost: ea.cost + eb.cost, stationsCost: ea.cost + eb.cost, trackRate: { L1: tm }, trains: trainCost(g, 'sky'), demolishCells: [], newStations: ea.newStations + eb.newStations, layersAdded: ea.layersAdded + eb.layersAdded };
}

function planWater(g, A, B) {
  const lk = lockedFor(g, 'water');
  // a district next to Atlantis: its pier goes on the coast beside it, never on the dome it links to
  const ea = endStation(g, A, 'water', 'WA', { avoid: [B.cell] });
  const hint = (E) => (g.ct[(E === A ? B : A).cell].terrain === TERRAIN.ATLANTIS ? `: Atlantis is reached by Water from a station on the coast next to it (build one there first, or pick a coastal district)` : '');
  if (ea.reason) return fail('water', endWhy(ea, 'A') + hint(A), lk ? { locked: true, lockTech: lk.tech, reason: lk.text } : {});
  const eb = endStation(g, B, 'water', 'WB', { avoid: [ea.cell] });
  if (eb.reason) return fail('water', endWhy(eb, 'B') + hint(B), lk ? { locked: true, lockTech: lk.tech, reason: lk.text } : {});
  if (ea.cell === eb.cell) return fail('water', samePlace(g, ea));
  const path = cellAstar(g, ea.cell, eb.cell, (c) => isWater(g.ct[c]), (u, v) => gcDist(g.ct[u].pos, g.ct[v].pos));
  if (!path) return fail('water', 'No sea route between them');
  let slot = 0;
  const pairs = new Set(); for (let i = 0; i < path.length - 1; i++) pairs.add(Math.min(path[i], path[i + 1]) + ':' + Math.max(path[i], path[i + 1]));
  for (const l of liveLines(g)) if (l.type === 'water' && l.cells) { for (let i = 0; i < l.cells.length - 1; i++) if (pairs.has(Math.min(l.cells[i], l.cells[i + 1]) + ':' + Math.max(l.cells[i], l.cells[i + 1]))) { slot++; break; } }
  const tm = TYPES.water.track * g.mods.trackCost.water * pm(g);
  const ops = [...ea.ops, ...eb.ops, { op: 'line', type: 'water', a: ea.ref, b: eb.ref, cells: path, slot, ref: 'L1' }];
  const plan = { kind: 'water', feasible: true, ops, legs: [{ ref: 'L1', type: 'water' }], interior: [], fixedCost: ea.cost + eb.cost, stationsCost: ea.cost + eb.cost, trackRate: { L1: tm }, trains: trainCost(g, 'water'), demolishCells: [], newStations: ea.newStations + eb.newStations, layersAdded: ea.layersAdded + eb.layersAdded };
  if (lk) return { ...plan, feasible: false, locked: true, lockTech: lk.tech, reason: lk.text };
  return plan;
}

/** Existing straight bores (chords and shafts) as segments, for chord clearance. */
function boreSegments(g) {
  const out = [];
  for (const l of liveLines(g)) if (l.type === 'earth') { const geo = lineGeo(g, l); const s = geo.samples, n = geo.count - 1; out.push({ line: l, p: [s[0], s[1], s[2]], q: [s[n * 3], s[n * 3 + 1], s[n * 3 + 2]] }); }
  return out;
}
function clearOf(segs, p, q) {
  for (const s of segs) if (segSegDist(p, q, s.p, s.q) < 1.2) return s.line;
  return null;
}
const PORTAL_SLOTS = 11;
/** A place as the player sees it: the station's name ("Brasswick Heights Station", "Warp Terminal"). */
function placeName(g, stationId) {
  const st = g.s.stations[stationId]; if (!st) return 'a station';
  return stationName(g, st);
}
/** Why a land-only card can't reach an end, with the fix for Atlantis and open sea. */
function landReason(g, A, B) {
  const sea = [A, B].find((E) => !g.ct[E.cell].land);
  if (sea && g.ct[sea.cell].terrain === TERRAIN.ATLANTIS) return 'Atlantis is under the sea: only Water reaches it, from a station on the coast next to it';
  return 'Both ends must be on land';
}
/** "within 1 cell of <station name>": both ends of a card resolve to the same station or cell. */
function samePlace(g, e) {
  const where = typeof e.ref === 'number' ? placeName(g, e.ref) : cellName(e.cell);
  return `Both ends are within 1 cell of ${where}`;
}
/** What blocks a new bore, named for the player ("the Brasswick–Saltmarch Deep", "the existing shaft at A"). */
function blockerLabel(g, l, ends = {}) {
  if (l.shaft) {
    const bore = g.s.stations[l.a]?.kind === 'core' ? l.b : l.a;
    for (const [tag, id] of Object.entries(ends)) if (id === bore) return `the existing shaft at ${tag}`;
    return `the ${lineName(g, l)}`;
  }
  return `the ${lineName(g, l)}`;
}

/** Long earth chords cost more per unit (deeper, hotter bores): ×1 up to EARTH_LONG_CHORD.from units, then +1 per `per` units. */
export function earthChordMult(units) { return 1 + Math.max(0, units - EARTH_LONG_CHORD.from) / EARTH_LONG_CHORD.per; }
function earthLimit(g, cellA, cellB) {
  const ra = REGIONS[g.ct[cellA].areaId], rb = REGIONS[g.ct[cellB].areaId];
  const strict = ra.crust <= rb.crust ? ra : rb;
  const crust = strict.crust + g.mods.crust;
  return { max: maxEarthAngle(crust), region: strict };
}
function earthReason(ang, lim) {
  const a = Math.round(ang), m = Math.round(lim.max);
  if (lim.region === REGIONS.rift) return `Too far apart to dig (${a}°; the Rift's thin crust allows ${m}°)`;
  if (lim.region === REGIONS.spires) return `Too far apart to dig (${a}°; the Spires' deep crust allows ${m}°)`;
  return `Too far apart to dig (${a}°; the crust allows ${m}°)`;
}

function planEarth(g, A, B) {
  const cells = g.ct;
  if (!cells[A.cell].land || !cells[B.cell].land) return fail('earth', landReason(g, A, B));
  const ea = endStation(g, A, 'earth', 'EA');
  if (ea.reason) return fail('earth', endWhy(ea, 'A'));
  const eb = endStation(g, B, 'earth', 'EB');
  if (eb.reason) return fail('earth', endWhy(eb, 'B'));
  if (ea.cell === eb.cell) return fail('earth', samePlace(g, ea));
  const ang = angleDeg(cells[ea.cell].pos, cells[eb.cell].pos);
  const lim = earthLimit(g, ea.cell, eb.cell);
  if (ang > lim.max + 1e-9) return fail('earth', earthReason(ang, lim));
  // chord clearance: portal slots
  const segs = boreSegments(g);
  const stA = typeof ea.ref === 'number' ? g.s.stations[ea.ref] : { kind: 'ground', cell: ea.cell };
  const stB = typeof eb.ref === 'number' ? g.s.stations[eb.ref] : { kind: 'ground', cell: eb.cell };
  let portal = null, blocker = null;
  // the four east-row slots first (as before), then the extra west / north / south slots (PORTAL_SLOTS)
  outer: for (const maxK of [3, PORTAL_SLOTS - 1]) for (let sum = 0; sum <= 2 * maxK; sum++) for (let ka = 0; ka <= Math.min(maxK, sum); ka++) {
    const kb = sum - ka; if (kb > maxK || (maxK > 3 && ka <= 3 && kb <= 3)) continue;
    const bl = clearOf(segs, portalPos(g, stA, ka), portalPos(g, stB, kb));
    if (!bl) { portal = [ka, kb]; break outer; }
    blocker = blocker || bl;
  }
  if (!portal) {
    const ends = { A: typeof ea.ref === 'number' ? ea.ref : -1, B: typeof eb.ref === 'number' ? eb.ref : -1 };
    const tag = ['A', 'B'].find((t) => ends[t] >= 0 && (blocker.a === ends[t] || blocker.b === ends[t]));
    const where = tag ? `No room for another bore at ${g.s.stations[ends[tag]].kind === 'terminal' ? 'the Warp Terminal' : tag}: ` : '';
    const what = blockerLabel(g, blocker, ends);
    return fail('earth', `${where}too close to ${tag && what === `the existing shaft at ${tag}` ? 'its shaft' : what}`);
  }
  const tm = TYPES.earth.track * g.mods.trackCost.earth * pm(g);
  const ops = [...ea.ops, ...eb.ops, { op: 'line', type: 'earth', a: ea.ref, b: eb.ref, portal, ref: 'L1' }];
  return { kind: 'earth', feasible: true, ops, legs: [{ ref: 'L1', type: 'earth' }], interior: [], fixedCost: ea.cost + eb.cost, stationsCost: ea.cost + eb.cost, trackRate: { L1: tm }, trains: trainCost(g, 'earth'), demolishCells: [], newStations: ea.newStations + eb.newStations, layersAdded: ea.layersAdded + eb.layersAdded, angle: ang };
}

function planCore(g, A, B) {
  const cells = g.ct;
  if (!cells[A.cell].land || !cells[B.cell].land) return fail('core', landReason(g, A, B));
  const ang = angleDeg(cells[A.cell].pos, cells[B.cell].pos);
  if (ang < TYPES.fire.minAngle) return fail('core', `Too close together to go through the core (under ${TYPES.fire.minAngle}°)`);
  const ops = [], legs = [], interior = [];
  let fixed = 0, stationsCost = 0, trains = 0, newStations = 0, layersAdded = 0;
  const segs = boreSegments(g);
  const end = (E, tag) => {
    const e = endStation(g, E, 'earth', 'B' + tag);
    if (e.reason) return { reason: endWhy(e, tag) };
    ops.push(...e.ops); fixed += e.cost; stationsCost += e.cost; newStations += e.newStations; layersAdded += e.layersAdded;
    const existing = typeof e.ref === 'number' ? coreUnder(g, g.s.stations[e.ref]) : null;
    if (existing) return { core: existing.id, bore: e.ref, cell: e.cell, existingShaft: liveLines(g).find((l) => l.shaft && (l.a === existing.id || l.b === existing.id)) };
    const st = typeof e.ref === 'number' ? g.s.stations[e.ref] : { kind: 'ground', cell: e.cell };
    let slot = null, bl = null;
    for (let k = 0; k < PORTAL_SLOTS; k++) {
      const top = portalPos(g, st, k), bottom = top.map((x) => x * PLANET.coreExchangeRadius / PLANET.portalRadius);
      const b = clearOf(segs, top, bottom); if (!b) { slot = k; break; } bl = bl || b;
    }
    if (slot == null) return { reason: `No room for a shaft at ${tag}: too close to ${blockerLabel(g, bl, typeof e.ref === 'number' ? { [tag]: e.ref } : {})}` };
    const free = g.s.freeCoreExchanges > 0 && !g._freeCoreUsedInPlan;
    let price = layerPrice(g, e.cell, 'fire');
    if (free) { price = 0; g._freeCoreUsedInPlan = true; }
    fixed += price; stationsCost += price; newStations++;
    ops.push({ op: 'core', parent: e.ref, slot, ref: 'C' + tag, free });
    ops.push({ op: 'line', type: 'earth', shaft: true, a: e.ref, b: 'C' + tag, ref: 'S' + tag, coreRoute: true, trains: SHAFT_TRAINS });
    trains += trainCost(g, 'earth', SHAFT_TRAINS);
    return { core: 'C' + tag, bore: e.ref, cell: e.cell, newShaft: 'S' + tag };
  };
  g._freeCoreUsedInPlan = false;
  const a = end(A, 'A'); if (a.reason) { g._freeCoreUsedInPlan = false; return fail('core', a.reason); }
  const b = end(B, 'B'); g._freeCoreUsedInPlan = false; if (b.reason) return fail('core', b.reason);
  if (a.cell === b.cell) return fail('core', samePlace(g, { ref: a.bore, cell: a.cell }));
  ops.push({ op: 'line', type: 'fire', a: a.core, b: b.core, ref: 'F', coreRoute: true });
  trains += trainCost(g, 'fire');
  legs.push(a.newShaft ? { ref: a.newShaft, type: 'earth' } : { line: a.existingShaft?.id, type: 'earth' });
  legs.push({ ref: 'F', type: 'fire' });
  legs.push(b.newShaft ? { ref: b.newShaft, type: 'earth' } : { line: b.existingShaft?.id, type: 'earth' });
  interior.push(a.core, b.core);
  const tm = TYPES.fire.track * g.mods.trackCost.fire * pm(g);
  return { kind: 'core', feasible: true, ops, legs: legs.filter((l) => l.ref || l.line != null), interior, fixedCost: fixed, stationsCost, trackRate: { F: tm }, trains, demolishCells: [], newStations, layersAdded, angle: ang };
}

function planSpace(g, A, B) {
  const lk = lockedFor(g, 'space');
  const lockInfo = lk ? { locked: true, lockTech: lk.tech, reason: lk.text } : {};
  const ea = endStation(g, A, 'space', 'RA');
  if (ea.reason) return fail('space', endWhy(ea, 'A'), lockInfo);
  const eb = endStation(g, B, 'space', 'RB');
  if (eb.reason) return fail('space', endWhy(eb, 'B'), lockInfo);
  if (ea.cell === eb.cell) return fail('space', samePlace(g, ea));
  const ra = ringsFor(g, ea.cell), rb = ringsFor(g, eb.cell);
  const rings = ra.filter((r) => rb.includes(r));
  if (!rings.length) return fail('space', 'The two ends are under different rings', lockInfo);
  const ring = rings[0];
  const tm = TYPES.space.track * g.mods.trackCost.space * pm(g);
  const ops = [...ea.ops, ...eb.ops, { op: 'line', type: 'space', a: ea.ref, b: eb.ref, ring, ref: 'L1' }];
  const plan = { kind: 'space', feasible: true, ops, legs: [{ ref: 'L1', type: 'space' }], interior: [], fixedCost: ea.cost + eb.cost, stationsCost: ea.cost + eb.cost, trackRate: { L1: tm }, trains: trainCost(g, 'space'), demolishCells: [], newStations: ea.newStations + eb.newStations, layersAdded: ea.layersAdded + eb.layersAdded };
  if (lk) return { ...plan, feasible: false, ...lockInfo };
  return plan;
}

const PLANNERS = { surface: planSurface, sky: planSky, water: planWater, earth: planEarth, core: planCore, space: planSpace };

// ------------------------------------------------------------------ evaluate a plan (trial apply)
/** Renames refs in a plan's ops with a prefix (so two plans can be concatenated). */
function prefixPlan(plan, pre) {
  const r = (x) => (typeof x === 'string' ? pre + x : x);
  const ops = plan.ops.map((o) => {
    const c = { ...o };
    for (const k of ['ref', 'station', 'parent', 'a', 'b']) if (k in c) c[k] = r(c[k]);
    return c;
  });
  const trackRate = {}; for (const k in plan.trackRate) trackRate[pre + k] = plan.trackRate[k];
  return { ...plan, ops, trackRate, legs: plan.legs.map((l) => (l.ref ? { ...l, ref: pre + l.ref } : l)), interior: plan.interior.map(r) };
}

/** Fill in numbers by trial-applying: cost, carries, exports gain, trip time, running cost, preview samples. */
function evaluate(g, plan, { withExports = true } = {}) {
  const before = withExports ? g.exportsReachable() : 0;
  const genB = withExports ? g.generation() : null, compB = withExports ? components(g) : null;
  const upkeep0 = g.upkeepPerMin ? g.upkeepPerMin() : 0;
  // demolition losses: what each demolished block makes now, if a station serves it now or the new stations would
  const lossCells = withExports && g.cellYield ? (plan.demolishCells || []) : [];
  const lossYield = lossCells.map((c) => g.cellYield(c));
  const { refs, changes } = applyOps(g, plan.ops);
  try {
    const res = (x) => (typeof x === 'string' ? refs[x] : x);
    let track = 0, trackUnits = 0, carries = Infinity, time = 0, running = 0, limit = null;
    const legs = [], preview = [];
    for (const leg of plan.legs) {
      const id = leg.ref ? refs[leg.ref] : leg.line;
      const l = g.s.lines[id];
      const geo = lineGeo(g, l);
      const isNew = !!leg.ref;
      let cap = lineCapacity(g, l);
      if (!isNew) cap = Math.max(0, cap - Math.max(g.s.lineFlow[l.id * 2] || 0, g.s.lineFlow[l.id * 2 + 1] || 0));
      const t = lineTime(g, l);
      if (isNew) {
        const rate = plan.trackRate[leg.ref] || 0;
        let units = geo.length;
        if (l.shaft) units = 0; // shafts are included in the Core Exchange price
        let tr = units * rate;
        if (l.type === 'surface' && plan.oceanCells) tr += plan.oceanCells * PLANET.cellSpacing * rate * (VIADUCT_TRACK_MULT - 1);
        if (l.type === 'earth' && !l.shaft) tr *= earthChordMult(units);
        track += tr; trackUnits += geo.length;
        running += lineUpkeep(g, l);
        preview.push({ type: l.type, shaft: !!l.shaft, samples: geo.samples });
      }
      if (cap < carries) limit = { line: l, isNew };
      carries = Math.min(carries, cap); time += t;
      legs.push({ type: l.type, shaft: !!l.shaft, line: isNew ? null : l.id, from: l.a, to: l.b, length: +geo.length.toFixed(1), lengthMiles: Math.round(geo.length * 50), time: +t.toFixed(1), capacity: Math.round(cap), isNew });
    }
    const transfers = [];
    for (const r of plan.interior) {
      const st = g.s.stations[res(r)];
      const cap = stationCapacity(g, st) - (g.stats.xferFlow.get(st.id) || 0);
      transfers.push({ station: typeof r === 'number' ? r : null, kind: st.kind, capacity: Math.max(0, Math.round(cap)) });
      if (cap < carries) limit = { station: st, free: Math.max(0, cap) };
      carries = Math.min(carries, cap); time += TRANSFER.seconds;
    }
    // running cost = exactly what the build adds to the term's upkeep: its trains, plus new stations and added layers
    const trainsRun = running;
    if (g.upkeepPerMin) running = g.upkeepPerMin() - upkeep0;
    else running += (plan.newStations || 0) * 2 + (plan.layersAdded || 0) * 2;
    running = Math.round(running * 100) / 100;
    const after = withExports ? g.exportsReachable() : 0;
    const cost = Math.round(plan.fixedCost + track + plan.trains);
    const potential = Math.max(0, after - before);
    let ridersLost = 0, exportsLost = 0;
    if (lossCells.length) {
      const genA = g.generation(), compA = components(g);
      lossCells.forEach((c, i) => {
        const was = genB.cover.get(c) || [], would = genA.cover.get(c) || [];
        if (was.length || would.length) ridersLost += lossYield[i].riders;
        if (was.some((id) => compB.comp.get(id) === compB.terminal) || would.some((id) => compA.comp.get(id) === compA.terminal)) exportsLost += lossYield[i].exports;
      });
    }
    // the new exports must also get through the existing network to the Terminal (full interchanges, busy lines)
    const route = withExports && potential > 0 ? exportRoute(g, changes, genB, compB) : null;
    const reach = route ? route.gain : Infinity;
    const exportsGain = Math.max(0, Math.round(Math.min(potential, carries, reach)));
    const pathLimit = route && route.gain < Math.min(potential, carries) ? route.limit : null;
    const exportsNote = withExports ? exportOutcome(g, plan, refs, changes, { potential, gain: exportsGain, carries, limit: pathLimit || limit, pathLimited: !!pathLimit, genB, compB }) : null;
    return {
      cost, carries: Math.round(isFinite(carries) ? carries : 0), exportsGain, exportsPotential: Math.round(potential), exportsNote, tripTime: Math.round(time),
      ridersLost: Math.round(ridersLost * 10) / 10, exportsLost: Math.round(exportsLost * 10) / 10,
      runningCost: running, runningBreakdown: { trains: trainsRun, stations: Math.round((running - trainsRun) * 100) / 100 }, trackUnits, trackMiles: Math.round(trackUnits * 50), legs, transfers, preview,
      breakdown: { track: Math.round(track), stations: Math.round(plan.stationsCost || 0), demolition: Math.round(plan.demolition || 0), blocks: plan.demolishCells.length, trains: plan.trains },
    };
  } finally { rollbackOps(g, changes); }
}

/**
 * How much of the new exports (stations whose exports rise with the plan applied) can reach the Terminal over
 * the network as it is (fastest path and its alternatives, against the capacity existing exports already use:
 * exports are assigned before commuters). Returns { gain, limit: { line, isNew } | { station, free } | null }.
 */
function exportRoute(g, changes, genB, compB) {
  const S = g.s, gen = g.generation(), comp = components(g), term = S.terminalStation;
  const origins = [];
  for (const [id, x] of gen.X) {
    if (comp.comp.get(id) !== comp.terminal) continue;
    const inc = x - (compB.comp.get(id) === compB.terminal ? (genB.X.get(id) || 0) : 0);
    if (inc > 0.01) origins.push([id, inc]);
  }
  if (!origins.length) return null;
  origins.sort((a, b) => a[0] - b[0]);
  const walkT = new Set(); for (const st of liveStations(g)) if (st.kind !== 'core' && st.id !== term && (st.cell === S.stations[term].cell || g.ct[S.stations[term].cell].neighbours.includes(st.cell))) walkT.add(st.id);
  const need = new Set(origins.map((o) => o[0]).filter((id) => id !== term && !walkT.has(id)));
  const paths = need.size ? computePaths(g, (sid) => (need.has(sid) ? [term] : []), { noPerf: true }) : new Map();
  const lx = g.stats.lineFlowX || [], xx = g.stats.xferFlowX || [];
  const lineRem = new Map(), stRem = new Map();
  const remLeg = (leg) => {
    if (!lineRem.has(leg)) { const l = S.lines[leg >> 1]; const isNew = l.id >= changes.linesLen; lineRem.set(leg, Math.max(0, lineCapacity(g, l) - (isNew ? 0 : (lx[leg] || 0)))); }
    return lineRem.get(leg);
  };
  const remSt = (id) => {
    if (!stRem.has(id)) { const st = S.stations[id]; const cap = stationCapacity(g, st); stRem.set(id, isFinite(cap) ? Math.max(0, cap - (id >= changes.stationsLen ? 0 : (xx[id] || 0))) : Infinity); }
    return stRem.get(id);
  };
  let gain = 0, limit = null, worst = Infinity;
  for (const [id, inc] of origins) {
    if (!need.has(id)) { gain += inc; continue; }
    const list = paths.get(id)?.get(term);
    if (!list) continue;
    let left = inc;
    for (const p of list) {
      let fit = left, el = null;
      for (const leg of p.legs) { const r = remLeg(leg); if (r < fit) { fit = r; el = { leg }; } }
      for (const x of p.xfers) { const r = remSt(x); if (r < fit) { fit = r; el = { station: x }; } }
      if (el && fit < worst) { worst = fit; limit = el; }
      if (fit <= 1e-9) continue;
      for (const leg of p.legs) lineRem.set(leg, remLeg(leg) - fit);
      for (const x of p.xfers) stRem.set(x, remSt(x) - fit);
      left -= fit; gain += fit;
      if (left <= 1e-9) break;
    }
  }
  if (limit && limit.leg != null) { const l = S.lines[limit.leg >> 1]; limit = { line: l, isNew: l.id >= changes.linesLen }; }
  else if (limit) limit = { station: S.stations[limit.station], free: Math.max(0, worst) };
  return { gain, limit };
}

/**
 * Why a card adds no (or few) exports, in the player's words (null when it adds a fair amount). Runs with the
 * plan applied; genB / compB are the generation and components before it.
 */
function exportOutcome(g, plan, refs, changes, { potential, gain, carries, limit, pathLimited = false, genB, compB }) {
  if (gain >= 5 && gain >= 0.25 * potential) return null;
  const S = g.s, comp = components(g);
  const newLines = []; for (let id = changes.linesLen; id < S.lines.length; id++) if (S.lines[id] && !S.lines[id].shaft) newLines.push(S.lines[id]);
  const ends = []; for (const l of newLines) for (const id of [l.a, l.b]) { const st = S.stations[id]; ends.push(st.kind === 'core' ? S.stations[st.parent] : st); }
  if (!ends.some((st) => comp.comp.get(st.id) === comp.terminal)) return 'not linked to the Terminal';
  if (potential < 1) {
    // the new ends' districts were already served by a linked station
    for (const st of ends) {
      if (st.kind === 'terminal') continue;
      const by = (genB.cover.get(st.cell) || []).find((id) => compB.comp.get(id) === compB.terminal);
      if (by != null) return `already served by ${stationName(g, by)}`;
    }
    return 'no new districts to serve here';
  }
  if (limit && (pathLimited || carries < potential)) {
    if (limit.station) return `limited by ${stationName(g, limit.station)}'s interchange (${Math.round(limit.free)}/min free)`;
    const l = limit.line;
    if (!limit.isNew && l.shaft) {
      const core = S.stations[l.a]?.kind === 'core' ? S.stations[l.a] : S.stations[l.b];
      const bore = S.stations[core.parent];
      const shared = liveLines(g).filter((x) => x.id < changes.linesLen && x.type === 'fire' && (x.a === core.id || x.b === core.id)).map((x) => lineName(g, x));
      const where = bore.kind === 'terminal' ? "the Terminal's shaft" : `the ${lineName(g, l)}`;
      return `limited by ${where}${shared.length ? ` (shared with the ${shared.join(', the ')})` : ''}`;
    }
    if (!limit.isNew) return `limited by the ${lineName(g, l)} (already busy)`;
    return `limited by the new line's capacity (${Math.round(carries)}/min)`;
  }
  return null;
}

// ------------------------------------------------------------------ hybrid
function planHybrid(g, A, B, singles) {
  const cells = g.ct;
  let best = null;
  for (const [E, O] of [[A, B], [B, A]]) {
    if (!cells[E.cell].land) continue;
    const d = hexDistances(E.cell, 4);
    for (const S of liveStations(g)) {
      if (S.kind === 'core' || d[S.cell] < 0 || S.cell === E.cell) continue;
      if (stationCapacity(g, S) - (g.stats.xferFlow.get(S.id) || 0) <= 0) continue; // its interchange is full: the link would carry nothing
      const layers = S.layers.filter((x) => x !== 'surface');
      if (coreUnder(g, S)) layers.push('core');
      for (const L of layers) {
        const kind = L === 'fire' ? 'core' : L;
        if (!PLANNERS[kind]) continue;
        const legL = PLANNERS[kind](g, { cell: S.cell, station: S.id }, O);
        if (!legL.feasible) continue;
        const legS = planSurface(g, E, { cell: S.cell, station: S.id });
        if (!legS.feasible) continue;
        const cost0 = legS.fixedCost + legL.fixedCost + legS.trains + legL.trains;
        if (best && cost0 >= best.est) continue;
        const ps = prefixPlan(legS, 'h1'), pl = prefixPlan(legL, 'h2');
        best = {
          est: cost0, kind: 'hybrid', feasible: true, via: S.id, viaLayer: kind,
          ops: [...ps.ops, ...pl.ops], legs: [...ps.legs, ...pl.legs], interior: [S.id, ...pl.interior],
          fixedCost: legS.fixedCost + legL.fixedCost, stationsCost: (legS.stationsCost || 0) + (legL.stationsCost || 0), demolition: legS.demolition,
          trackRate: { ...ps.trackRate, ...pl.trackRate }, oceanCells: legS.oceanCells, trains: legS.trains + legL.trains,
          demolishCells: legS.demolishCells, newStations: legS.newStations + legL.newStations, layersAdded: legS.layersAdded + legL.layersAdded,
        };
      }
    }
  }
  return best || fail('hybrid', 'No station within 4 cells to feed into');
}

// ------------------------------------------------------------------ the cards
/**
 * Route cards between two places. Feasible cards first in the fixed order (Surface, Sky, Water, Earth,
 * Through the core, Space, Hybrid), then locked and impossible kinds, greyed.
 * Each card: { kind, name, feasible, locked, lockTech, reason, cost, free, carries, exportsGain, demolishes,
 *   demolishCells, tripTime, runningCost, breakdown, legs, transfers, bestAt, tags, preview, plan }.
 */
export function routeCards(g, a, b, { withExports = true, kinds = CARD_KINDS } = {}) {
  const A = resolvePlace(g, a), B = resolvePlace(g, b);
  if (!A || !B) return [];
  const out = [];
  const plans = {};
  for (const kind of kinds) {
    if (kind === 'hybrid') continue;
    let plan = PLANNERS[kind](g, A, B);
    if (plan.feasible) { const ev = evaluate(g, plan, { withExports }); plan = { ...plan, ...ev }; }
    plans[kind] = plan;
  }
  if (kinds.includes('hybrid')) {
    const singles = Object.values(plans).filter((p) => p.feasible);
    let h = planHybrid(g, A, B, singles);
    if (h.feasible) {
      const ev = evaluate(g, h, { withExports });
      h = { ...h, ...ev };
      if (singles.length && singles.some((p) => p.cost <= h.cost)) h = fail('hybrid', 'A single-type card is cheaper');
      else if (h.carries <= 0) h = fail('hybrid', hybridFullReason(g, h));
    }
    plans.hybrid = h;
  }
  for (const kind of kinds) {
    const p = plans[kind];
    out.push({
      kind, name: CARD_NAMES[kind], type: TYPE_OF_KIND[kind] || null, feasible: !!p.feasible, locked: !!p.locked, lockTech: p.lockTech || null, reason: p.feasible ? null : p.reason,
      cost: p.cost ?? null, free: false, carries: p.carries ?? null, exportsGain: p.exportsGain ?? 0, exportsPotential: p.exportsPotential ?? 0, exportsNote: p.feasible ? (p.exportsNote ?? null) : null, demolishes: p.demolishCells?.length || 0,
      ridersLost: p.ridersLost ?? 0, exportsLost: p.exportsLost ?? 0,
      demolishCells: p.demolishCells || [], tripTime: p.tripTime ?? null, runningCost: p.runningCost ?? null, runningBreakdown: p.runningBreakdown || null, trackMiles: p.trackMiles ?? null, breakdown: p.breakdown || null,
      legs: p.legs || [], transfers: p.transfers || [], bestAt: BEST_AT[kind], tags: [], preview: p.preview || [], via: p.via ?? null, plan: p.feasible ? { ops: p.ops } : null,
      line: p.feasible ? cardLine(kind, p) : (p.reason || ''),
    });
  }
  const feas = out.filter((c) => c.feasible);
  // a card that carries nothing (a full interchange or shaft on its path) is never tagged
  const useful = feas.filter((c) => c.carries > 0);
  if (useful.length >= 2) { // a lone card is no comparison: no tags
    const cheap = useful.reduce((m, c) => (c.cost < m.cost ? c : m)); cheap.tags.push('Cheapest');
    const big = useful.reduce((m, c) => (c.carries > m.carries ? c : m)); big.tags.push('Most capacity');
  }
  return [...out.filter((c) => c.feasible), ...out.filter((c) => !c.feasible)];
}
/** Why a Hybrid would carry nothing: the via station's interchange, or an existing leg, is already full. */
function hybridFullReason(g, h) {
  const t = h.transfers?.find((x) => x.capacity <= 0 && x.station != null);
  if (t) return `The interchange at ${placeName(g, t.station)} it joins is full (upgrade it first)`;
  const leg = h.legs?.find((x) => !x.isNew && x.capacity <= 0);
  if (leg) return `The ${leg.line != null && g.s.lines[leg.line] ? lineName(g, leg.line) : leg.shaft ? 'shaft' : leg.type + ' line'} it joins is already full`;
  return 'The link it joins is already full';
}
/** The card's red demolition line: "demolishes 3 blocks: −12 riders/min, −2 exports/min" or "demolishes 3 unserved blocks". */
function cardLine(kind, p) {
  if (kind === 'surface' || (kind === 'hybrid' && p.demolishCells?.length)) {
    const n = p.demolishCells.length, r = Math.round(p.ridersLost || 0), x = Math.round(p.exportsLost || 0);
    if (!n) return 'demolishes 0 blocks';
    if (!r && !x) return `demolishes ${n} unserved block${n === 1 ? '' : 's'}`;
    return `demolishes ${n} block${n === 1 ? '' : 's'}: \u2212${r} riders/min, \u2212${x} exports/min`;
  }
  return '';
}

/** Execute a card's plan for real (no money check). Returns { refs, changes }. */
export function buildPlan(g, plan, { inherited = false } = {}) {
  const r = applyOps(g, plan.ops, { inherited });
  for (const op of plan.ops) if (op.op === 'core' && op.free && g.s.freeCoreExchanges > 0) g.s.freeCoreExchanges--;
  return r;
}

// ------------------------------------------------------------------ inherited network
/**
 * Stations at the 2-4 densest city cells of the starting region (ties by id, each >= 2 cells from the others
 * and > 2 cells from the Terminal), linked into 1 or 2 lines between neighbours in that list with the
 * cheapest feasible non-Surface card of native types. Free; pays upkeep; never linked to the Terminal.
 */
export function buildInheritedNetwork(g, rng) {
  const region = g.s.region;
  const termCell = g.s.stations[g.s.terminalStation].cell;
  const dT = hexDistances(termCell, 2);
  const count = 2 + rng.int(3), nLines = 1 + rng.int(2);
  const cands = g.ct.filter((c) => c.areaId === region && c.isCity && dT[c.id] < 0).sort((x, y) => g.s.densities[y.id] - g.s.densities[x.id] || x.id - y.id);
  const pick = [];
  for (const c of cands) {
    if (pick.length >= count) break;
    if (pick.some((p) => { const d = hexDistances(p, 1); return d[c.id] >= 0; })) continue;
    pick.push(c.id);
  }
  const kinds = ['sky', 'water', 'earth', 'core', 'space'].filter((k) => g.s.natives.includes(TYPE_OF_KIND[k]) || (k === 'core' && g.s.natives.includes('fire')));
  const built = [];
  for (let i = 0; i < pick.length - 1 && built.length < nLines; i++) {
    const sa = g.s.stations.find((s) => s && s.cell === pick[i]);
    const sb = g.s.stations.find((s) => s && s.cell === pick[i + 1]);
    const cards = routeCards(g, sa ? { station: sa.id } : pick[i], sb ? { station: sb.id } : pick[i + 1], { withExports: false, kinds })
      .filter((c) => c.feasible);
    if (!cards.length) continue;
    const best = cards.reduce((m, c) => (c.cost < m.cost ? c : m));
    // never link to the Terminal's component
    const { changes } = applyOps(g, best.plan.ops, { inherited: true });
    const comp = components(g);
    const linked = liveStations(g).some((s) => s.inherited && comp.comp.get(s.id) === comp.terminal);
    if (linked) { rollbackOps(g, changes); continue; }
    built.push(best.kind);
  }
  for (const c of pick) if (!g.s.stations.some((s) => s && (s.cell === c || g.ct[c].neighbours.includes(s.cell)))) applyOps(g, [{ op: 'station', cell: c, layer: 'earth', ref: 'X' }], { inherited: true });
  for (const s of g.s.stations) if (s && s.inherited) s.inherited = true;
  return { cells: pick, lines: built };
}
