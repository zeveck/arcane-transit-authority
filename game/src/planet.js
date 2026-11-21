// planet.js — Oikumene: the geodesic grid (dual of a 3x-subdivided icosphere: 642 cells, 12 pentagons),
// the frozen cell table from tuning.js, the geography hash, and per-term variation from the term seed
// (density nudges, priority districts, Charter VI's dealt mandates).
// The game reads only the frozen table (OIKUMENE_CELLS); tools/oikumene.mjs builds it.

import {
  PLANET, OIKUMENE, OIKUMENE_CELLS, OIKUMENE_META, OIKUMENE_GRID, AREA_IDS, REGIONS, CHARTERS, PRIORITY_COUNT,
  PRIORITY_MIN_DEG, PRIORITY_FRONTIER_DEG, PRIORITY_MIN_DENSITY, DEALT_MANDATE_POOL,
} from './tuning.js';
import { latLonToVec, vecToLatLon, norm, cross, dot, angleDeg, angleRad, rotateAxis, sub, DEG, q9 } from './geo.js';
import { termStream, hashValue } from './rng.js';

export const TERRAIN = { CITY: 0, MOUNTAIN: 1, OCEAN: 2, ATLANTIS: 3, TERMINAL: 4 };
export const TERRAIN_NAMES = ['city', 'mountain', 'ocean', 'atlantis', 'terminal'];

// ------------------------------------------------------------------ icosphere / dual grid
function icosphere(detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const k = a < b ? a * 100000 + b : b * 100000 + a;
      let m = cache.get(k);
      if (m === undefined) { m = verts.length; verts.push(norm([(verts[a][0] + verts[b][0]) / 2, (verts[a][1] + verts[b][1]) / 2, (verts[a][2] + verts[b][2]) / 2])); cache.set(k, m); }
      return m;
    };
    const nf = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = nf;
  }
  return { verts, faces };
}

/** Raw icosphere (before orientation): used by tools/oikumene.mjs to pick an anchor vertex. */
export function rawIcosphere(detail = OIKUMENE.gridDetail) { return icosphere(detail); }

/**
 * Build the oriented dual grid. orientation = { anchor: raw vertex index placed at the Capital's
 * centre (20°N 0°), twistDeg: rotation about that point }.
 * Returns { count, pos[], lat[], lon[], neighbours[][], corners[][], pentagon[] } with cells sorted
 * north to south (lat desc, lon asc): the cell id order.
 */
export function buildGrid(detail = OIKUMENE.gridDetail, orientation = OIKUMENE.orientation) {
  const { verts, faces } = icosphere(detail);
  const cap = latLonToVec(REGIONS.capital.centre[0], REGIONS.capital.centre[1]);
  const a = verts[orientation.anchor || 0];
  let rv = verts;
  const ax = cross(a, cap), al = angleRad(a, cap);
  if (Math.hypot(...ax) > 1e-12) { const k = norm(ax); rv = rv.map((v) => rotateAxis(v, k, al)); }
  const tw = (orientation.twistDeg || 0) * DEG;
  if (tw) rv = rv.map((v) => norm(rotateAxis(v, cap, tw)));
  rv = rv.map(norm);
  const n = rv.length;
  // adjacency and faces per vertex
  const vf = Array.from({ length: n }, () => []);
  const nb = Array.from({ length: n }, () => new Set());
  faces.forEach((f, fi) => { for (let i = 0; i < 3; i++) { vf[f[i]].push(fi); nb[f[i]].add(f[(i + 1) % 3]); nb[f[i]].add(f[(i + 2) % 3]); } });
  const centroid = faces.map(([p, q, r]) => norm([rv[p][0] + rv[q][0] + rv[r][0], rv[p][1] + rv[q][1] + rv[r][1], rv[p][2] + rv[q][2] + rv[r][2]]));
  // order: lat desc, lon asc
  const ll = rv.map(vecToLatLon);
  const order = [...Array(n).keys()].sort((i, j) => (Math.round(ll[j][0] * 1e6) - Math.round(ll[i][0] * 1e6)) || (Math.round(ll[i][1] * 1e6) - Math.round(ll[j][1] * 1e6)));
  const newId = new Int32Array(n); order.forEach((old, i) => { newId[old] = i; });
  const pos = [], lat = [], lon = [], neighbours = [], corners = [], pentagon = [], rawIndex = [];
  for (let i = 0; i < n; i++) {
    const old = order[i], p = rv[old];
    pos.push(p); lat.push(ll[old][0]); lon.push(ll[old][1]); rawIndex.push(old);
    // angular sort around p
    const e1 = norm(sub([0, 1, 0], p.map((x) => x * p[1]))), e1v = Math.hypot(...e1) > 0.1 ? e1 : norm(cross(p, [1, 0, 0]));
    const e2 = cross(p, e1v);
    const ang = (v) => Math.atan2(dot(v, e2), dot(v, e1v));
    const nbs = [...nb[old]].sort((x, y) => ang(rv[x]) - ang(rv[y])).map((x) => x); // still old ids
    neighbours.push(nbs);
    corners.push(vf[old].map((fi) => centroid[fi]).sort((x, y) => ang(x) - ang(y)));
    pentagon.push(nb[old].size === 5);
  }
  for (let i = 0; i < n; i++) neighbours[i] = neighbours[i].map((o) => newId[o]);
  return { count: n, pos, lat, lon, neighbours, corners, pentagon, rawIndex };
}

/** Positions rounded to 1e-12 (the frozen form: identical in every JS engine). */
export const roundPos = (p) => p.map((x) => Number(x.toFixed(12)));

/** Grid from the frozen table (positions + neighbours): no trig at run time, so every engine gets the same numbers. */
export function gridFromFrozen(fz) {
  const pos = fz.pos.map((p) => p.slice()), neighbours = fz.neighbours.map((n) => n.slice());
  const n = pos.length, lat = [], lon = [], corners = [], pentagon = [];
  for (let i = 0; i < n; i++) {
    const [la, lo] = vecToLatLon(pos[i]); lat.push(la); lon.push(lo);
    const nb = neighbours[i], p = pos[i], cs = [];
    for (let k = 0; k < nb.length; k++) { const a = pos[nb[k]], b = pos[nb[(k + 1) % nb.length]]; cs.push(norm([p[0] + a[0] + b[0], p[1] + a[1] + b[1], p[2] + a[2] + b[2]])); }
    corners.push(cs); pentagon.push(nb.length === 5);
  }
  return { count: n, pos, lat, lon, neighbours, corners, pentagon };
}

let _grid = null;
/** The game's grid (cached): from the frozen table when present (always, in the game), else built. */
export function getGrid() { if (!_grid) _grid = OIKUMENE_GRID ? gridFromFrozen(OIKUMENE_GRID) : buildGrid(); return _grid; }

/** Nearest cell to a lat/lon (brute force; 642 cells). */
export function nearestCell(lat, lon, grid = getGrid()) {
  const v = latLonToVec(lat, lon);
  let best = -1, bd = -2;
  for (let i = 0; i < grid.count; i++) { const d = dot(v, grid.pos[i]); if (d > bd) { bd = d; best = i; } }
  return best;
}
export function nearestCellToVec(v, grid = getGrid()) {
  let best = -1, bd = -Infinity;
  for (let i = 0; i < grid.count; i++) { const d = dot(v, grid.pos[i]); if (d > bd) { bd = d; best = i; } }
  return best;
}

/** BFS hex distances from a cell (or array of cells), up to maxD (default all). Int16Array, -1 = beyond. */
export function hexDistances(from, maxD = 999, grid = getGrid()) {
  const d = new Int16Array(grid.count).fill(-1);
  const q = Array.isArray(from) ? from.slice() : [from];
  for (const c of q) d[c] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; if (d[c] >= maxD) continue;
    for (const m of grid.neighbours[c]) if (d[m] < 0) { d[m] = d[c] + 1; q.push(m); }
  }
  return d;
}

/** Cells within `rings` of a cell (including it), ascending id. */
export function cellsWithin(cell, rings, grid = getGrid()) {
  if (rings === 1) return [cell, ...grid.neighbours[cell]].sort((a, b) => a - b);
  const d = hexDistances(cell, rings, grid); const out = [];
  for (let i = 0; i < grid.count; i++) if (d[i] >= 0 && d[i] <= rings) out.push(i);
  return out;
}

/** Angular distance (deg) from a unit vector to a ring's ground track ('equator' or 'polar'). */
export function ringTrackDeg(p, ring = 'equator') {
  const nrm = ring === 'polar' ? [1, 0, 0] : [0, 1, 0];
  return q9(Math.asin(Math.min(1, Math.abs(dot(p, nrm)))) / DEG);
}
/** Nearest point on a ring's ground track (unit vector). */
export function ringTrackPoint(p, ring = 'equator') {
  if (ring === 'polar') { const v = [0, p[1], p[2]]; return Math.hypot(...v) < 1e-9 ? [0, 0, 1] : norm(v); }
  const v = [p[0], 0, p[2]]; return Math.hypot(...v) < 1e-9 ? [0, 0, 1] : norm(v);
}

// ------------------------------------------------------------------ frozen cell table
let _cells = null;
/**
 * Static cell data from the frozen table: [{ id, area (index), areaId, terrain, terrainName, density (base),
 *   height, peak, ground (radius of the ground), pos (unit vec), lat, lon, neighbours, pentagon, coastal }].
 */
export function getCells() {
  if (_cells) return _cells;
  if (!OIKUMENE_CELLS) throw new Error('OIKUMENE_CELLS missing: run node tools/oikumene.mjs --write');
  const g = getGrid();
  _cells = OIKUMENE_CELLS.map((row, id) => ({
    id, area: row[0], areaId: AREA_IDS[row[0]], terrain: row[1], terrainName: TERRAIN_NAMES[row[1]], density: row[2],
    height: row[3], peak: !!row[4], ground: PLANET.radius + (row[1] === TERRAIN.MOUNTAIN ? row[3] : 0),
    pos: g.pos[id], lat: g.lat[id], lon: g.lon[id], neighbours: g.neighbours[id], pentagon: g.pentagon[id], coastal: false,
  }));
  for (const c of _cells) {
    const water = c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS;
    c.coastal = water && c.neighbours.some((m) => !isWater(_cells[m]));
    c.land = !water;
    c.isCity = c.land && c.terrain !== TERRAIN.TERMINAL && !c.peak; // has buildings (city or slopes)
  }
  return _cells;
}
export const isWater = (c) => c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS;
export function cellMeta() { return OIKUMENE_META; }

/** Geography hash: hash of the frozen table (and the grid orientation that places it). */
export function geoHash() { return hashValue({ cells: OIKUMENE_CELLS, grid: OIKUMENE_GRID, orientation: OIKUMENE.orientation, detail: OIKUMENE.gridDetail }); }

/** Per-area counts as tools/oikumene.mjs prints them. */
export function regionCounts(cells = getCells()) {
  const out = {};
  AREA_IDS.forEach((id, i) => {
    const cs = cells.filter((c) => c.area === i);
    const start = OIKUMENE_META?.starts?.[id];
    out[id] = {
      name: REGIONS[id].name, cells: cs.length,
      ocean: cs.filter((c) => isWater(c)).length,
      atlantis: cs.filter((c) => c.terrain === TERRAIN.ATLANTIS).length,
      mountains: cs.filter((c) => c.terrain === TERRAIN.MOUNTAIN).length,
      peaks: cs.filter((c) => c.peak).length,
      startCell: start ?? null,
      startAngle: start != null ? +angleDeg(cells[start].pos, cells[OIKUMENE_META.terminal].pos).toFixed(1) : null,
      avgDensity: +(avg(cs.filter((c) => c.isCity).map((c) => c.density))).toFixed(2),
    };
  });
  return out;
}
const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

// ------------------------------------------------------------------ terms
/** Cells that are never density-nudged (the tutorial geography). */
export function tutorialCells() {
  const t = OIKUMENE_META?.tutorial; if (!t) return new Set();
  return new Set([t.a, t.b, ...(t.path || [])]);
}

/**
 * Everything the term seed changes (never the geography). Uses the `term` stream in this order:
 * density nudges, then dealt mandates (VI/Galactic), then priority districts.
 * @returns {{ densities: Int8Array, nudges: Int8Array, mandates: string[], priority: number[], natives: string[] }}
 */
export function termSetup(termSeed, charterId, regionId, { tutorial = false } = {}) {
  const cells = getCells();
  const rng = termStream(termSeed, 'term');
  const n = cells.length;
  const base = cells.map((c) => c.density);
  const nudges = new Int8Array(n);
  const tut = tutorialCells();
  for (const c of cells) {
    if (!c.isCity) continue;
    const roll = rng.int(3) - 1;
    if (tut.has(c.id) || tutorial) continue;
    const nd = Math.max(1, Math.min(5, base[c.id] + roll));
    nudges[c.id] = nd - base[c.id];
  }
  // rebalance each area to within 0.2 of its base average
  AREA_IDS.forEach((_, ai) => {
    const cs = cells.filter((c) => c.area === ai && c.isCity);
    if (!cs.length) return;
    const baseSum = cs.reduce((s, c) => s + base[c.id], 0);
    let sum = cs.reduce((s, c) => s + base[c.id] + nudges[c.id], 0);
    const lim = 0.2 * cs.length;
    if (sum - baseSum > lim) { for (const c of cs) { if (sum - baseSum <= lim) break; if (nudges[c.id] > 0) { nudges[c.id] = 0; sum -= 1; } } }
    if (baseSum - sum > lim) { for (const c of cs) { if (baseSum - sum <= lim) break; if (nudges[c.id] < 0) { nudges[c.id] = 0; sum += 1; } } }
  });
  const densities = new Int8Array(n);
  for (let i = 0; i < n; i++) densities[i] = base[i] + nudges[i];

  const ch = CHARTERS[charterId];
  let mandates;
  if (ch.mandates === 'dealt2') {
    const pool = DEALT_MANDATE_POOL.slice(); rng.shuffle(pool);
    mandates = pool.slice(0, 2).sort((a, b) => DEALT_MANDATE_POOL.indexOf(a) - DEALT_MANDATE_POOL.indexOf(b));
  } else mandates = ch.mandates.slice();

  let priority = [];
  if (!tutorial) {
    const start = OIKUMENE_META.starts[regionId];
    const sp = cells[start].pos;
    const ra = AREA_IDS.indexOf(regionId);
    const cand = cells.filter((c) => c.isCity && densities[c.id] >= PRIORITY_MIN_DENSITY && c.area !== ra && angleDeg(c.pos, sp) >= PRIORITY_MIN_DEG).map((c) => c.id);
    rng.shuffle(cand);
    const want = PRIORITY_COUNT[charterId];
    if (mandates.includes('frontierLink')) {
      const far = cand.find((id) => angleDeg(cells[id].pos, sp) >= PRIORITY_FRONTIER_DEG);
      if (far != null) priority.push(far);
    }
    for (const id of cand) {
      if (priority.length >= want) break;
      if (priority.includes(id)) continue;
      if (priority.some((p) => cells[p].area === cells[id].area || angleDeg(cells[p].pos, cells[id].pos) < PRIORITY_MIN_DEG)) continue;
      priority.push(id);
    }
  }
  const natives = ch.natives.slice();
  const sig = REGIONS[regionId].signature;
  if (sig && !natives.includes(sig)) natives.push(sig);
  return { densities, nudges, mandates, priority, natives };
}
