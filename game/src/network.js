// network.js — stations, walkways, interchanges, lines, components, capacities, catchments and the
// ley-rail path geometry (dense samples ~1 unit apart that the renderer, trains, Ride and picking all use).
// Functions take `g`, the Game (sim.js): g.s = serializable state, g.mods = modifiers, g.ct = static cells.

import { PLANET, TYPES, TRANSFER, DWELL_PER_ROUND_TRIP, REGIONS, CHARTERS, SIM, GREEN, AREA_IDS } from './tuning.js';
import { getCells, getGrid, ringTrackDeg, ringTrackPoint, TERRAIN, isWater, hexDistances } from './planet.js';
import { norm, scale, add, sub, dot, cross, slerp, lerp, lerp3, len, dist, angleDeg, angleRad, gcDist, smoothstep, perp, DEG } from './geo.js';

export const LAYERS = ['surface', 'sky', 'water', 'earth', 'fire', 'space'];

// ------------------------------------------------------------------ station rules
/** Can a station of `layer` stand on this cell? Returns null if yes, else a reason. */
export function layerCellBlock(g, cell, layer) {
  const c = g.ct[cell];
  switch (layer) {
    case 'surface': case 'earth': return c.land ? null : 'needs land';
    case 'sky': return c.peak ? null : 'needs a peak';
    case 'water': return (c.terrain === TERRAIN.ATLANTIS || c.coastal) ? null : 'needs coastal ocean or Atlantis';
    case 'space': return c.land && spaceRing(g, cell) ? null : 'beyond the ring\'s reach';
    case 'fire': return 'Core Exchanges sit under a Bore station';
  }
  return 'unknown layer';
}
/** Which ring (equator / polar) a cell can reach with a Space Elevator, or null. */
export function spaceRing(g, cell) {
  const p = g.ct[cell].pos;
  if (ringTrackDeg(p, 'equator') <= PLANET.ringReachDeg) return 'equator';
  if (g.mods.polarRing && ringTrackDeg(p, 'polar') <= PLANET.ringReachDeg) return 'polar';
  return null;
}
export function ringsFor(g, cell) {
  const p = g.ct[cell].pos, out = [];
  if (ringTrackDeg(p, 'equator') <= PLANET.ringReachDeg) out.push('equator');
  if (g.mods.polarRing && ringTrackDeg(p, 'polar') <= PLANET.ringReachDeg) out.push('polar');
  return out;
}
export function stationKindFor(g, cell, layer) {
  const c = g.ct[cell];
  if (c.terrain === TERRAIN.TERMINAL) return 'terminal';
  if (layer === 'water') return c.terrain === TERRAIN.ATLANTIS ? 'dome' : 'pier';
  if (layer === 'sky') return 'sky';
  if (layer === 'fire') return 'core';
  return 'ground';
}
/** Can an existing station take `layer` (as an interchange upgrade)? */
export function stationCanTake(g, st, layer) {
  if (!st || st.kind === 'core') return false;
  if (st.layers.includes(layer)) return true;
  if (st.kind === 'pier' || st.kind === 'dome') return false;
  if (layer === 'water' || layer === 'fire') return false;
  if (layer === 'sky') return false; // a Sky Port is its own station on the peak (walkway-linked)
  return layerCellBlock(g, st.cell, layer) === null;
}

export const liveStations = (g) => g.s.stations.filter(Boolean);
export const liveLines = (g) => g.s.lines.filter(Boolean);
export function stationsAt(g, cell) { return g.s.stations.filter((s) => s && s.cell === cell); }
export function terminalStation(g) { return g.s.stations[g.s.terminalStation]; }
export function coreUnder(g, st) { return g.s.stations.find((s) => s && s.kind === 'core' && s.parent === st.id) || null; }

/** Price of a layer at a station on `cell` (Charter price applied; surface includes its cell's demolition). */
export function layerPrice(g, cell, layer, { forTerminal = false } = {}) {
  const pm = CHARTERS[g.s.charter].price;
  const c = g.ct[cell];
  if (forTerminal && (layer === 'surface' || layer === 'earth')) return 0;
  switch (layer) {
    case 'surface': return Math.round(TYPES.surface.station * pm); // built into its block (no demolition)
    case 'sky': return Math.round(TYPES.sky.station * pm);
    case 'water': return Math.round((c.terrain === TERRAIN.ATLANTIS ? TYPES.water.stationDome : TYPES.water.station) * pm);
    case 'earth': return Math.round(TYPES.earth.station * pm);
    case 'space': return Math.round((g.mods.cheapElevators ? TYPES.space.stationCheap : TYPES.space.station) * g.mods.elevatorMult * pm);
    case 'fire': return Math.round((c.areaId === 'rift' ? TYPES.fire.stationRift : TYPES.fire.station) * pm);
  }
  return 0;
}
/** Demolition price of a cell's buildings (0 if none). */
export function demolitionPrice(g, cell, forSurfaceLine = false) {
  const c = g.ct[cell];
  if (!c.isCity || g.s.demolished[cell] || g.s.green[cell]) return 0;
  const d = g.s.densities[cell];
  let p = [0, 100, 250, 450, 700, 1000][d] * CHARTERS[g.s.charter].demolition * REGIONS[c.areaId].demolition * g.mods.demolition;
  if (forSurfaceLine) p *= g.mods.surfaceDemolition;
  return Math.round(p);
}

/** Transfer capacity per minute at a station. */
export function stationCapacity(g, st) {
  if (st.kind === 'terminal') return Infinity;
  if (g.s.time < (st.closedUntil || 0)) return 0;
  let cap = st.kind === 'core' ? TRANSFER.core : st.layers.includes('space') ? TRANSFER.elevator : TRANSFER.ordinary;
  if (st.upgraded) cap *= TRANSFER.upgradeMult;
  cap *= g.mods.transferMult;
  if (st.kind === 'core') {
    if (g.mods.wideShafts) cap *= TRANSFER.wideShaftsMult;
    cap *= g.mods.coreTransferMult;
    if (g.flareHits?.has(st.id)) cap *= 0.5;
  }
  return cap;
}

// ------------------------------------------------------------------ walkways and components
/** Walkway pairs [a, b] (a < b): stations on the same or neighbouring cells (Core Exchanges excluded). */
export function walkways(g) {
  if (g.cache.walkways) return g.cache.walkways;
  const st = liveStations(g).filter((s) => s.kind !== 'core');
  const out = [];
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
    const a = st[i], b = st[j];
    if (a.cell === b.cell || g.ct[a.cell].neighbours.includes(b.cell)) out.push(a.id < b.id ? [a.id, b.id] : [b.id, a.id]);
  }
  g.cache.walkways = out;
  return out;
}
/** Component id per station id (Map), and the Terminal's component id. Lines (all built) + walkways. */
export function components(g) {
  if (g.cache.components) return g.cache.components;
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(Math.max(a, b), Math.min(a, b)); };
  for (const s of liveStations(g)) parent.set(s.id, s.id);
  for (const l of liveLines(g)) unite(l.a, l.b);
  for (const [a, b] of walkways(g)) unite(a, b);
  const comp = new Map();
  for (const s of liveStations(g)) comp.set(s.id, find(s.id));
  const res = { comp, terminal: comp.get(g.s.terminalStation) };
  g.cache.components = res;
  return res;
}

// ------------------------------------------------------------------ catchment and generation
export function catchmentRadius(g, st) { return st.layers.includes('sky') && g.mods.skyCatchment > 1 ? g.mods.skyCatchment : 1; }
export function catchment(g, st) {
  if (st.kind === 'core') return [];
  const r = catchmentRadius(g, st);
  const water = st.layers.includes('water');
  const cells = r === 1 ? [st.cell, ...g.ct[st.cell].neighbours] : (() => { const d = hexDistances(st.cell, r); const o = []; for (let i = 0; i < d.length; i++) if (d[i] >= 0) o.push(i); return o; })();
  return cells.filter((c) => g.ct[c].terrain !== TERRAIN.ATLANTIS || water);
}
/** Effective density of a cell now (0 = makes nothing). */
export function effDensity(g, cell) {
  const c = g.ct[cell];
  if (c.terrain === TERRAIN.ATLANTIS) return c.density + g.mods.atlantisDensity;
  if (!c.isCity || g.s.demolished[cell] || g.s.green[cell]) return 0;
  return g.s.densities[cell];
}
/** Generation multiplier from greenery nearby. */
export function greenMult(g, cell) {
  let m = 1;
  const nb = g.ct[cell].neighbours;
  for (const n of nb) { const t = g.s.green[n]; if (t === 1) m += GREEN.grove.genBonus; else if (t === 2) m += GREEN.park.genBonus; }
  if (g.s.attractions?.length) for (const a of g.s.attractions) if (g.attrDist(a, cell) <= 2) m += GREEN.attraction.genBonus * g.mods.attractionMult;
  return m;
}

// ------------------------------------------------------------------ line physics
export function lineCars(g, l) { return TYPES[l.type].cars + (g.mods.cars[l.type] || 0) + g.mods.carsAll; }
export function lineCarCap(g, l) { return TYPES[l.type].carCap * (g.mods.carCap[l.type] || 1); }
/** Speed (units/s) on a segment kind of a line, including tech, the Rift rule and timed disaster effects. */
export function segSpeed(g, l, kind) {
  const m = g.mods;
  if (kind === 'elevator') return TYPES.space.elevatorSpeed * m.speedAll;
  if (kind === 'shaft') {
    const st = g.s.stations[l.a].kind === 'core' ? g.s.stations[l.b] : g.s.stations[l.a];
    return TYPES.earth.speed * m.shaftSpeed * (g.ct[st.cell].areaId === 'rift' ? REGIONS.rift.riftRule.shaftSpeedMult : 1) * m.speedAll;
  }
  let v = TYPES[l.type].speed * (m.speed[l.type] || 1) * m.speedAll;
  if (l.slowUntil && g.s.time < l.slowUntil) v *= l.slowMult;
  if (l.type === 'space' && g.s.ringSlow && g.s.time < g.s.ringSlow.until && (g.s.ringSlow.ring === (l.ring || 'equator'))) v *= g.s.ringSlow.mult;
  return v;
}
/** One-way travel time (s). */
export function lineTime(g, l) {
  const geo = lineGeo(g, l);
  let t = 0;
  for (const s of geo.segs) t += s.len / segSpeed(g, l, s.kind);
  return t;
}
/** Capacity, riders per minute each way: trains × cars × car capacity × 60 / (2 × time + 8). */
export function lineCapacity(g, l, trains = l.trains) {
  if (trains <= 0) return 0;
  let cap = trains * lineCars(g, l) * lineCarCap(g, l) * 60 / (2 * lineTime(g, l) + DWELL_PER_ROUND_TRIP);
  if (l.type === 'fire' && g.flareHits && (g.flareHits.has('all') || g.flareHits.has(l.a) || g.flareHits.has(l.b))) cap *= 0.5;
  return cap;
}
/** Is the line usable right now (not broken, closed, or touching a blacked-out station)? */
export function lineOpen(g, l) {
  if (l.closed || l.broken || l.trains <= 0) return false;
  const a = g.s.stations[l.a], b = g.s.stations[l.b];
  if (g.s.time < (a.closedUntil || 0) || g.s.time < (b.closedUntil || 0)) return false;
  return true;
}
export function lineUpkeep(g, l) { return l.trains * TYPES[l.type].upkeep; }
export function lineTrackLength(g, l) { return lineGeo(g, l).length; }

// ------------------------------------------------------------------ positions
/** World position of a station (where its model sits). */
export function stationPos(g, st) {
  const c = g.ct[st.cell];
  switch (st.kind) {
    case 'core': return scale(portalDir(g, st, st.coreSlot || 0), PLANET.coreExchangeRadius);
    case 'pier': return scale(c.pos, PLANET.pierDeck);
    case 'dome': return scale(c.pos, PLANET.seaFloor);
    default: return scale(c.pos, c.ground);
  }
}
/** Direction of a station's portal slot k (k = 0 under the station; slots 1.5 units apart). */
export function portalDir(g, st, k) {
  const base = st.kind === 'core' ? g.s.stations[st.parent] : st;
  const p = g.ct[base.cell].pos;
  if (!k) return p;
  const east = norm(Math.abs(p[1]) > 0.99 ? cross([1, 0, 0], p) : cross([0, 1, 0], p));
  if (k <= 3) return norm(add(p, scale(east, 1.5 * k / PLANET.radius)));
  // extra slots (4..9) for chords that run along the east row: west 1..3, then north and south (1.5 units apart)
  const j = k - 4, north = norm(cross(p, east));
  const off = j < 3 ? scale(east, -1.5 * (j + 1)) : scale(north, (j < 5 ? 1.5 : -1.5) * (j < 5 ? j - 2 : j - 4));
  return norm(add(p, scale(off, 1 / PLANET.radius)));
}
export function portalPos(g, st, k) { return scale(portalDir(g, st, k), PLANET.portalRadius); }

// ------------------------------------------------------------------ geometry
/** Path samples of a line (cached): { samples: Float32Array xyz, count, cum: Float32Array, length, segs: [{i0,i1,len,kind}] }. */
export function lineGeo(g, l) {
  let geo = g.cache.geo.get(l.id);
  if (!geo) { geo = buildLineGeometry(g, l); g.cache.geo.set(l.id, geo); }
  return geo;
}

function packSamples(pts, segKinds) {
  // pts: array of [x,y,z]; segKinds: array of {i0, i1, kind} over pts indices
  const n = pts.length, samples = new Float32Array(n * 3), cum = new Float32Array(n);
  for (let i = 0; i < n; i++) { samples[i * 3] = pts[i][0]; samples[i * 3 + 1] = pts[i][1]; samples[i * 3 + 2] = pts[i][2]; if (i) cum[i] = cum[i - 1] + dist(pts[i - 1], pts[i]); }
  // lengths feed capacity, trip time and cost: quantised to 1e-6 so every JS engine agrees (samples come from trig)
  const segs = segKinds.map((s) => ({ i0: s.i0, i1: s.i1, kind: s.kind, len: Math.round((cum[s.i1] - cum[s.i0]) * 1e6) / 1e6 }));
  return { samples, count: n, cum, length: n ? Math.round(cum[n - 1] * 1e6) / 1e6 : 0, segs };
}
/** Resample a polyline (world points) at ~step spacing (straight between points). */
function resampleStraight(a, b, step = PLANET.sampleStep) {
  const L = dist(a, b), n = Math.max(1, Math.ceil(L / step)), out = [];
  for (let i = 0; i <= n; i++) out.push(lerp3(a, b, i / n));
  return out;
}
/** Chaikin corner cut at 25% on unit-vector polyline (endpoints kept). */
export function chaikin(pts) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (i > 0) out.push(norm(lerp3(a, b, 0.25)));
    if (i < pts.length - 2) out.push(norm(lerp3(a, b, 0.75)));
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** Sample along a unit-vector polyline by slerp at ~1 unit (at radius ~r); radius from rFn(dir, segIndex, t). */
function sphereSample(dirs, rFn, step = PLANET.sampleStep) {
  const out = [];
  for (let i = 0; i < dirs.length - 1; i++) {
    const a = dirs[i], b = dirs[i + 1];
    const L = angleRad(a, b) * 100, n = Math.max(1, Math.ceil(L / step));
    for (let k = i ? 1 : 0; k <= n; k++) { const t = k / n; const d = slerp(a, b, t); out.push(scale(d, rFn(d, i, t))); }
  }
  return out;
}
function lateralOffset(dirs, off) {
  if (!off) return dirs;
  return dirs.map((p, i) => {
    const a = dirs[Math.max(0, i - 1)], b = dirs[Math.min(dirs.length - 1, i + 1)];
    const side = norm(cross(p, sub(b, a)));
    return norm(add(p, scale(side, off / 100)));
  });
}
export const slotOffset = (slot) => (slot ? ((slot + 1) >> 1) * 1.2 * (slot & 1 ? 1 : -1) : 0);

export function buildLineGeometry(g, l) {
  const A = g.s.stations[l.a], B = g.s.stations[l.b];
  const cells = g.ct;
  switch (l.type) {
    case 'surface': {
      let dirs = chaikin(l.cells.map((c) => cells[c].pos));
      dirs = lateralOffset(dirs, slotOffset(l.slot || 0));
      const gr = l.cells.map((c) => (cells[c].land ? cells[c].ground : PLANET.radius));
      // ground radius along the cut polyline: interpolate by nearest cell index
      const groundAt = (d) => { let best = 0, bd = -2; for (let i = 0; i < l.cells.length; i++) { const v = dot(d, cells[l.cells[i]].pos); if (v > bd) { bd = v; best = i; } } return gr[best]; };
      const pts = sphereSample(dirs, (d) => groundAt(d) + PLANET.surfaceRailLift);
      return packSamples(pts, [{ i0: 0, i1: pts.length - 1, kind: 'main' }]);
    }
    case 'sky': {
      const pa = cells[A.cell], pb = cells[B.cell];
      const S = angleRad(pa.pos, pb.pos) * 100;
      const h = Math.max(12, 0.25 * S) + 3 * (l.skyExtra || 0);
      const n = Math.max(2, Math.ceil(S * 1.15));
      const pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push(scale(slerp(pa.pos, pb.pos, t), 100 + lerp(pa.height, pb.height, t) + 2 + h * Math.sin(Math.PI * t))); }
      return packSamples(pts, [{ i0: 0, i1: pts.length - 1, kind: 'main' }]);
    }
    case 'water': return waterGeometry(g, l, A, B);
    case 'earth': {
      if (l.shaft) {
        const bore = A.kind === 'core' ? B : A, core = A.kind === 'core' ? A : B;
        const top = portalPos(g, bore, core.coreSlot || 0), bottom = stationPos(g, core);
        const pts = A.kind === 'core' ? resampleStraight(bottom, top) : resampleStraight(top, bottom);
        return packSamples(pts, [{ i0: 0, i1: pts.length - 1, kind: 'shaft' }]);
      }
      const pts = resampleStraight(portalPos(g, A, l.portal?.[0] || 0), portalPos(g, B, l.portal?.[1] || 0));
      return packSamples(pts, [{ i0: 0, i1: pts.length - 1, kind: 'main' }]);
    }
    case 'fire': {
      const pts = resampleStraight(stationPos(g, A), stationPos(g, B));
      return packSamples(pts, [{ i0: 0, i1: pts.length - 1, kind: 'main' }]);
    }
    case 'space': {
      const ring = l.ring || 'equator';
      const ga = stationPos(g, A), gb = stationPos(g, B);
      const ra = ringTrackPoint(cells[A.cell].pos, ring), rb = ringTrackPoint(cells[B.cell].pos, ring);
      const up = resampleStraight(ga, scale(ra, PLANET.ringRadius));
      const arcN = Math.max(2, Math.ceil(angleRad(ra, rb) * PLANET.ringRadius));
      const arc = []; for (let i = 1; i <= arcN; i++) arc.push(scale(slerp(ra, rb, i / arcN), PLANET.ringRadius));
      const down = resampleStraight(scale(rb, PLANET.ringRadius), gb).slice(1);
      const pts = [...up, ...arc, ...down];
      return packSamples(pts, [
        { i0: 0, i1: up.length - 1, kind: 'elevator' },
        { i0: up.length - 1, i1: up.length - 1 + arc.length, kind: 'main' },
        { i0: up.length - 1 + arc.length, i1: pts.length - 1, kind: 'elevator' },
      ]);
    }
  }
  throw new Error('unknown line type ' + l.type);
}

function waterGeometry(g, l, A, B) {
  const cells = g.ct;
  const domes = [];
  for (const c of l.cells) for (const m of [c, ...cells[c].neighbours]) if (cells[m].terrain === TERRAIN.ATLANTIS && !domes.includes(m)) domes.push(m);
  let dirs = chaikin(l.cells.map((c) => cells[c].pos));
  dirs = lateralOffset(dirs, slotOffset(l.slot || 0));
  // densify to ~1 unit on the sphere, push away from dome centres (6 units along the sea floor), smooth, push again
  let pts = sphereSample(dirs, () => 1).map(norm);
  const clear = PLANET.domeClearance / PLANET.seaFloor; // radians
  const endDomes = new Set([A.kind === 'dome' ? A.cell : -1, B.kind === 'dome' ? B.cell : -1]);
  const push = () => {
    for (let i = 0; i < pts.length; i++) for (const dcell of domes) {
      const c = cells[dcell].pos, a = angleRad(pts[i], c);
      if (a < clear) {
        let away = sub(pts[i], scale(c, dot(pts[i], c)));
        if (len(away) < 1e-9) away = perp(c);
        away = norm(away);
        pts[i] = norm(add(scale(c, Math.cos(clear)), scale(away, Math.sin(clear))));
      }
    }
  };
  push();
  for (let k = 0; k < 2; k++) { pts = pts.map((p, i) => (i === 0 || i === pts.length - 1) ? p : norm(add(add(scale(p, 0.5), scale(pts[i - 1], 0.25)), scale(pts[i + 1], 0.25)))); push(); }
  // radii: rail at 94.8; pier ends ramp from the deck (100.5) with a smoothstep over ~6 units
  const n = pts.length, out = [];
  const cumAng = [0]; for (let i = 1; i < n; i++) cumAng.push(cumAng[i - 1] + angleRad(pts[i - 1], pts[i]) * 100);
  const total = cumAng[n - 1], ramp = 6;
  for (let i = 0; i < n; i++) {
    let r = PLANET.waterRail;
    if (A.kind === 'pier' && cumAng[i] < ramp) r = lerp(PLANET.pierDeck, PLANET.waterRail, smoothstep(cumAng[i] / ramp));
    if (B.kind === 'pier' && total - cumAng[i] < ramp) r = lerp(PLANET.pierDeck, PLANET.waterRail, smoothstep((total - cumAng[i]) / ramp));
    out.push(scale(pts[i], r));
  }
  // straight spurs to dome edges at Atlantis ends
  const spur = (st, atStart) => {
    if (st.kind !== 'dome') return;
    const c = cells[st.cell].pos;
    const railEnd = atStart ? out[0] : out[out.length - 1];
    let dir = sub(norm(railEnd), scale(c, dot(norm(railEnd), c))); if (len(dir) < 1e-9) dir = perp(c); dir = norm(dir);
    const edge = scale(norm(add(scale(c, Math.cos(PLANET.domeRadius / PLANET.seaFloor)), scale(dir, Math.sin(PLANET.domeRadius / PLANET.seaFloor)))), PLANET.waterRail);
    const s = resampleStraight(edge, railEnd);
    if (atStart) out.splice(0, 1, ...s); else out.splice(out.length - 1, 1, ...s.reverse());
  };
  spur(A, true); spur(B, false);
  return packSamples(out, [{ i0: 0, i1: out.length - 1, kind: 'main' }]);
}

/** Walkway geometry: short arc between the two stations at ground + 1.5. */
export function walkwayGeo(g, aId, bId) {
  const A = g.s.stations[aId], B = g.s.stations[bId];
  const pa = norm(stationPos(g, A)), pb = norm(stationPos(g, B));
  const ra = (A.kind === 'dome' || A.kind === 'pier' ? PLANET.pierDeck : g.ct[A.cell].ground) + PLANET.walkwayLift;
  const rb = (B.kind === 'dome' || B.kind === 'pier' ? PLANET.pierDeck : g.ct[B.cell].ground) + PLANET.walkwayLift;
  const n = Math.max(2, Math.ceil(angleRad(pa, pb) * 100));
  const pts = []; for (let i = 0; i <= n; i++) pts.push(scale(slerp(pa, pb, i / n), lerp(ra, rb, i / n)));
  return packSamples(pts, [{ i0: 0, i1: n, kind: 'walk' }]);
}

/** Station wells: vertical bores from a mountain station down to its portal (drawn in X-ray; no cost, no time). */
export function stationWells(g) {
  const out = [];
  for (const s of liveStations(g)) {
    if (!s.layers.includes('earth')) continue;
    const c = g.ct[s.cell];
    if (c.ground > PLANET.portalRadius + 0.01) out.push({ station: s.id, from: scale(c.pos, c.ground), to: scale(c.pos, PLANET.portalRadius) });
  }
  return out;
}

/** Train positions along a line now: [{ train, s (distance along samples), dir (+1 a→b, −1 b→a), pos [x,y,z] }]. */
export function trainPositions(g, l, time = g.s.time) {
  const geo = lineGeo(g, l), T = lineTime(g, l), P = 2 * T + DWELL_PER_ROUND_TRIP, half = DWELL_PER_ROUND_TRIP / 2;
  const out = [];
  const moving = lineOpen(g, l);
  for (let k = 0; k < l.trains; k++) {
    const ph = moving ? (((time + k * P / l.trains) % P) + P) % P : (k * P / l.trains);
    let frac, dir;
    if (ph < T) { frac = ph / T; dir = 1; } else if (ph < T + half) { frac = 1; dir = 0; } else if (ph < 2 * T + half) { frac = 1 - (ph - T - half) / T; dir = -1; } else { frac = 0; dir = 0; }
    const s = frac * geo.length;
    out.push({ train: k, s, dir, pos: sampleAt(geo, s) });
  }
  return out;
}
/** Point at distance s along a geometry. */
export function sampleAt(geo, s) {
  const { cum, samples, count } = geo;
  if (count === 1 || s <= 0) return [samples[0], samples[1], samples[2]];
  if (s >= geo.length) { const i = count - 1; return [samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]]; }
  let lo = 0, hi = count - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  return [lerp(samples[lo * 3], samples[hi * 3], t), lerp(samples[lo * 3 + 1], samples[hi * 3 + 1], t), lerp(samples[lo * 3 + 2], samples[hi * 3 + 2], t)];
}

/** Closest distance between segments p1-q1 and p2-q2. */
export function segSegDist(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) return len(r);
  if (a <= 1e-12) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return len(sub(add(p1, scale(d1, s)), add(p2, scale(d2, t))));
}

/** Station summary for the UI / debug hook. */
export function stationInfo(g, st) {
  const comp = components(g);
  return {
    id: st.id, cell: st.cell, kind: st.kind, layers: st.layers.slice(), upgraded: !!st.upgraded, parent: st.parent ?? null,
    inherited: !!st.inherited, pos: stationPos(g, st), capacity: stationCapacity(g, st),
    linkedToTerminal: comp.comp.get(st.id) === comp.terminal, closed: g.s.time < (st.closedUntil || 0),
    waiting: g.stats?.waiting?.get(st.id) || 0, transferFlow: g.stats?.xferFlow?.get(st.id) || 0,
    turnedAway: g.s.turnedAwayBy?.[st.id] || 0,
    lines: liveLines(g).filter((l) => l.a === st.id || l.b === st.id).map((l) => l.id),
  };
}
