#!/usr/bin/env node
// tools/oikumene.mjs — builds Oikumene's fixed geography from the map seed, the region rules and the
// hand-set overrides in OIKUMENE (game/src/tuning.js), checks it, prints per-area counts, and writes the
// frozen cell table (OIKUMENE_CELLS + OIKUMENE_META) into tuning.js.
//
//   node tools/oikumene.mjs            build + check; fails if the frozen table differs from a fresh build
//   node tools/oikumene.mjs --write    build + check + write the frozen table into tuning.js
//   node tools/oikumene.mjs --tune     search the orientation and region weights/reaches/overrides,
//                                      write them into OIKUMENE in tuning.js (then run --write)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from '../game/src/tuning.js';
import { buildGrid, rawIcosphere, ringTrackDeg, TERRAIN, roundPos } from '../game/src/planet.js';
import { latLonToVec, angleDeg, dot, cross, norm, bearing } from '../game/src/geo.js';
import { Rng, hashSeed, hashValue } from '../game/src/rng.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TUNING_PATH = path.join(HERE, '..', 'game', 'src', 'tuning.js');
const A = T.AREA_IDS; // capital brine spires rift flats ringside farwards
const AI = Object.fromEntries(A.map((id, i) => [id, i]));
const WEIGHTED = ['brine', 'spires', 'rift', 'flats'];
const TARGET = Object.fromEntries(A.map((id) => [id, T.REGIONS[id].cells]));

// ------------------------------------------------------------------ helpers on a grid
function nearest(grid, lat, lon) {
  const v = latLonToVec(lat, lon); let b = -1, bd = -2;
  for (let i = 0; i < grid.count; i++) { const d = dot(v, grid.pos[i]); if (d > bd) { bd = d; b = i; } }
  return b;
}
function bfs(grid, from, maxD = 999, pass = null) {
  const d = new Int16Array(grid.count).fill(-1); const q = Array.isArray(from) ? from.slice() : [from];
  for (const c of q) d[c] = 0;
  for (let h = 0; h < q.length; h++) { const c = q[h]; if (d[c] >= maxD) continue; for (const m of grid.neighbours[c]) if (d[m] < 0 && (!pass || pass(m))) { d[m] = d[c] + 1; q.push(m); } }
  return d;
}
const startCells = (grid) => Object.fromEntries(A.filter((id) => T.REGIONS[id].start).map((id) => [id, nearest(grid, T.REGIONS[id].start.lat, T.REGIONS[id].start.lon)]));

function regionParams() {
  const p = {};
  for (const id of WEIGHTED) p[id] = { weight: T.REGIONS[id].weight, reach: T.REGIONS[id].reach };
  if (T.OIKUMENE.regionTuning) for (const id of WEIGHTED) Object.assign(p[id], T.OIKUMENE.regionTuning[id] || {});
  return p;
}

/** Cell → area by the design's rules, then the area overrides. */
function assignAreas(grid, params, overrides = []) {
  const n = grid.count, area = new Int8Array(n).fill(-1);
  const capC = nearest(grid, ...T.REGIONS.capital.centre);
  const dcap = bfs(grid, capC, 3);
  for (let i = 0; i < n; i++) if (dcap[i] >= 0) area[i] = AI.capital;
  const centres = WEIGHTED.map((id) => latLonToVec(...T.REGIONS[id].centre));
  for (let i = 0; i < n; i++) {
    if (area[i] >= 0) continue;
    let best = -1, bs = Infinity;
    WEIGHTED.forEach((id, k) => {
      const a = angleDeg(grid.pos[i], centres[k]);
      if (a > params[id].reach) return;
      const s = a / params[id].weight;
      if (s < bs) { bs = s; best = AI[id]; }
    });
    if (best >= 0) area[i] = best;
  }
  for (let i = 0; i < n; i++) if (area[i] < 0 && ringTrackDeg(grid.pos[i]) <= T.PLANET.ringReachDeg) area[i] = AI.ringside;
  for (let i = 0; i < n; i++) if (area[i] < 0) area[i] = AI.farwards;
  for (const [c, f, v] of overrides) if (f === 'area') area[c] = v;
  return area;
}
const counts = (area) => { const c = new Array(A.length).fill(0); for (const a of area) c[a]++; return c; };

// ------------------------------------------------------------------ tuning search
function tune() {
  const raw = rawIcosphere(T.OIKUMENE.gridDetail);
  // pentagon distance on the raw grid
  const nb = Array.from({ length: raw.verts.length }, () => new Set());
  for (const f of raw.faces) for (let i = 0; i < 3; i++) { nb[f[i]].add(f[(i + 1) % 3]); nb[f[i]].add(f[(i + 2) % 3]); }
  const pd = new Int16Array(raw.verts.length).fill(-1); const q = [...Array(12).keys()]; q.forEach((c) => { pd[c] = 0; });
  for (let h = 0; h < q.length; h++) for (const m of nb[q[h]]) if (pd[m] < 0) { pd[m] = pd[q[h]] + 1; q.push(m); }
  const anchors = [...pd.keys()].filter((i) => pd[i] >= 4).slice(0, 12);
  console.log('anchor candidates (pentagon distance >= 4):', anchors.join(' '));
  let best = null;
  for (const anchor of anchors) for (let tw = 0; tw < 360; tw += 1) {
    const grid = buildGrid(T.OIKUMENE.gridDetail, { anchor, twistDeg: tw });
    const term = nearest(grid, 0, 180);
    const eT = angleDeg(grid.pos[term], latLonToVec(0, 180));
    let e = eT;
    const sc = startCells(grid);
    for (const id of Object.keys(sc)) e = Math.max(e, Math.abs(angleDeg(grid.pos[sc[id]], grid.pos[term]) - T.REGIONS[id].startAngle), angleDeg(grid.pos[sc[id]], latLonToVec(T.REGIONS[id].start.lat, T.REGIONS[id].start.lon)) * 0.5);
    if (!best || e < best.e) best = { anchor, tw, e };
  }
  console.log('orientation:', best);
  const orientation = { anchor: best.anchor, twistDeg: best.tw };
  const grid = buildGrid(T.OIKUMENE.gridDetail, orientation);
  const sc = startCells(grid);
  const term = nearest(grid, 0, 180);
  // region weights / reaches: local search
  let p = {}; for (const id of WEIGHTED) p[id] = { weight: T.REGIONS[id].weight, reach: T.REGIONS[id].reach };
  // hand-set: Ring Market's neighbourhood (2 cells, inside elevator reach) stays the Ringside, so the
  // Flats (which must reach ~45° to hold 92 cells) cannot swallow the Ringside start.
  const capC0 = nearest(grid, ...T.REGIONS.capital.centre); const dcap0 = bfs(grid, capC0, 3);
  const dRM = bfs(grid, sc.ringside, 2);
  const forced = [];
  for (let i = 0; i < grid.count; i++) if (dRM[i] >= 0 && dcap0[i] < 0 && ringTrackDeg(grid.pos[i]) <= T.PLANET.ringReachDeg) forced.push([i, 'area', AI.ringside]);
  const err = (pp) => {
    const area = assignAreas(grid, pp, forced); const c = counts(area);
    let e = 0; for (const id of ['brine', 'spires', 'rift', 'flats', 'ringside']) e += Math.abs(c[AI[id]] - TARGET[id]);
    for (const id of Object.keys(sc)) if (area[sc[id]] !== AI[id]) e += 50;
    if (area[term] !== AI.ringside) e += 50;
    for (const id of WEIGHTED) e += 0.02 * Math.abs(pp[id].weight - T.REGIONS[id].weight) * 100 + 0.02 * Math.abs(pp[id].reach - T.REGIONS[id].reach);
    return e;
  };
  const rng = new Rng(hashSeed(T.OIKUMENE.mapSeed, 'tune'));
  let e = err(p);
  for (let it = 0; it < 20000 && e > 0.5; it++) {
    const np = JSON.parse(JSON.stringify(p));
    const id = rng.pick(WEIGHTED);
    if (rng.next() < 0.5) np[id].weight = +(np[id].weight + (rng.next() - 0.5) * 0.08).toFixed(3);
    else np[id].reach = +(np[id].reach + (rng.next() - 0.5) * 3).toFixed(2);
    const ne = err(np);
    if (ne <= e) { p = np; e = ne; }
  }
  console.log('region params', JSON.stringify(p), 'err', e.toFixed(2));
  // fix the residual with boundary overrides
  const overrides = forced.slice();
  let area = assignAreas(grid, p, forced);
  const protectedCells = new Set([...Object.values(sc), term, ...forced.map((f) => f[0])]);
  for (const id of Object.keys(sc)) if (area[sc[id]] !== AI[id]) { area[sc[id]] = AI[id]; overrides.push([sc[id], 'area', AI[id]]); }
  if (area[term] !== AI.ringside) { area[term] = AI.ringside; overrides.push([term, 'area', AI.ringside]); }
  for (let guard = 0; guard < 200; guard++) {
    const c = counts(area);
    const surplus = A.map((id, i) => c[i] - TARGET[id]);
    if (surplus.every((s) => s === 0)) break;
    const from = surplus.findIndex((s) => s > 0), to = surplus.findIndex((s) => s < 0);
    const centreOf = (ai) => latLonToVec(...T.REGIONS[A[ai]].centre);
    const okTo = (cell, ai) => ai !== AI.ringside || ringTrackDeg(grid.pos[cell]) <= T.PLANET.ringReachDeg;
    // direct move from -> to along their border, else via the far wards
    let cand = [];
    for (let i = 0; i < grid.count; i++) if (area[i] === from && !protectedCells.has(i) && from !== AI.capital && grid.neighbours[i].some((m) => area[m] === to) && okTo(i, to)) cand.push(i);
    let target = to;
    if (!cand.length) {
      target = AI.farwards;
      for (let i = 0; i < grid.count; i++) if (area[i] === from && !protectedCells.has(i) && from !== AI.capital && grid.neighbours[i].some((m) => area[m] === AI.farwards)) cand.push(i);
      if (from === AI.farwards) {
        target = to; cand = [];
        for (let i = 0; i < grid.count; i++) if (area[i] === AI.farwards && grid.neighbours[i].some((m) => area[m] === to) && okTo(i, to)) cand.push(i);
      }
    }
    if (!cand.length) { console.log('cannot fix counts', surplus); break; }
    cand.sort((x, y) => angleDeg(grid.pos[y], centreOf(from)) - angleDeg(grid.pos[x], centreOf(from)) || x - y);
    area[cand[0]] = target; overrides.push([cand[0], 'area', target]);
  }
  console.log('overrides', JSON.stringify(overrides));
  let src = fs.readFileSync(TUNING_PATH, 'utf8');
  src = src.replace(/orientation: \{[^\n]*\},[^\n]*\n/, `orientation: ${JSON.stringify(orientation).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')}, // tuned by tools/oikumene.mjs --tune\n`);
  src = src.replace(/regionTuning: [^\n]*\n/, `regionTuning: ${JSON.stringify(p)},\n`);
  src = src.replace(/overrides: \[[^\n]*\n/, `overrides: ${JSON.stringify(overrides)}, // [cellId, 'area', areaIndex] boundary fixes found by --tune\n`);
  fs.writeFileSync(TUNING_PATH, src);
  console.log('wrote OIKUMENE params into tuning.js; now run: node tools/oikumene.mjs --write');
}

// ------------------------------------------------------------------ full build
export function build() {
  const grid = buildGrid();
  grid.pos = grid.pos.map(roundPos); // the frozen positions (1e-12): what every engine reads
  const n = grid.count;
  const area = assignAreas(grid, regionParams(), T.OIKUMENE.overrides);
  const terrain = new Int8Array(n).fill(TERRAIN.CITY), height = new Int8Array(n), peak = new Int8Array(n), density = new Int8Array(n);
  const R = (name) => new Rng(hashSeed(T.OIKUMENE.mapSeed, name));
  const inArea = (id) => [...Array(n).keys()].filter((i) => area[i] === AI[id]);
  const capC = nearest(grid, ...T.REGIONS.capital.centre);
  const dcap = bfs(grid, capC);
  const term = nearest(grid, 0, 180);
  terrain[term] = TERRAIN.TERMINAL;
  const starts = startCells(grid);
  const capPos = grid.pos[capC];

  // --- Capital Heights: P1 at ring 2 toward the NE, a slope, P2 at ring 3, another slope
  const capCells = inArea('capital');
  const brg = (c) => bearing(capPos, grid.pos[c]);
  const angd = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const ring = (r) => capCells.filter((c) => dcap[c] === r);
  // P1 next to the centre (so the tutorial's Sky Port joins the Capital centre station by a walkway)
  const p1 = ring(1).sort((a, b) => angd(brg(a), 45) - angd(brg(b), 45) || a - b)[0];
  const s1 = grid.neighbours[p1].filter((c) => dcap[c] === 2).sort((a, b) => angd(brg(a), 60) - angd(brg(b), 60) || a - b)[0];
  const p2 = grid.neighbours[s1].filter((c) => (dcap[c] === 2 || dcap[c] === 3) && !grid.neighbours[p1].includes(c) && c !== p1).sort((a, b) => angd(brg(a), 75) - angd(brg(b), 75) || a - b)[0];
  const s2 = grid.neighbours[p1].filter((c) => (dcap[c] === 1 || dcap[c] === 2) && c !== s1 && !grid.neighbours[p2].includes(c)).sort((a, b) => angd(brg(a), 20) - angd(brg(b), 20) || a - b)[0];
  for (const c of [p1, s1, p2, s2]) terrain[c] = TERRAIN.MOUNTAIN;
  peak[p1] = 1; peak[p2] = 1;

  // --- the Brine: ocean, 26 island-city cells in clusters of 2-4 (incl. the start cell's), 14 Atlantis
  const brine = inArea('brine');
  for (const c of brine) terrain[c] = TERRAIN.OCEAN;
  const rb = R('brine');
  const isLandNow = (c) => area[c] !== AI.brine || terrain[c] === TERRAIN.CITY;
  const brineSet = new Set(brine);
  const land = new Set();
  const growCluster = (seed, size, allowMainland) => {
    const cl = [seed];
    const okCell = (c) => brineSet.has(c) && !land.has(c) && !cl.includes(c) && angleDeg(grid.pos[c], capPos) > 40 &&
      grid.neighbours[c].every((m) => cl.includes(m) || (!land.has(m) && (allowMainland || brineSet.has(m))));
    for (let k = 1; k < size; k++) {
      const opts = []; for (const c of cl) for (const m of grid.neighbours[c]) if (okCell(m) && !opts.includes(m)) opts.push(m);
      if (!opts.length) return null; opts.sort((a, b) => a - b); cl.push(rb.pick(opts));
    }
    return cl;
  };
  const startCl = growCluster(starts.brine, 3, true) || [starts.brine];
  startCl.forEach((c) => land.add(c));
  let rem = 26 - startCl.length;
  const sizes = []; while (rem > 0) { let s; if (rem <= 4) s = rem; else { s = 2 + rb.int(3); if (rem - s < 2) s = rem - 2; } sizes.push(s); rem -= s; }
  for (const s of sizes) {
    for (let tries = 0; tries < 500; tries++) {
      const seed = rb.pick(brine);
      if (land.has(seed) || angleDeg(grid.pos[seed], capPos) <= 40 || grid.neighbours[seed].some((m) => land.has(m) || !brineSet.has(m))) continue;
      const cl = growCluster(seed, s, false);
      if (cl) { cl.forEach((c) => land.add(c)); break; }
    }
  }
  for (const c of land) terrain[c] = TERRAIN.CITY;
  const ocean = brine.filter((c) => terrain[c] === TERRAIN.OCEAN);
  const bay = ocean.slice().sort((a, b) => angleDeg(grid.pos[a], capPos) - angleDeg(grid.pos[b], capPos) || a - b).slice(0, 2);
  const atl = new Set(bay);
  const ra = R('atlantis');
  for (let tries = 0; atl.size < 14 && tries < 5000; tries++) {
    const c = ra.pick(ocean);
    if (atl.has(c) || grid.neighbours[c].some((m) => atl.has(m))) continue;
    atl.add(c);
  }
  for (const c of atl) terrain[c] = TERRAIN.ATLANTIS;

  // --- the Spires: mountain except 15 valleys (incl. the start cell); 22 peaks, none adjacent
  const spires = inArea('spires');
  const rs = R('spires');
  let peaksS = null;
  for (let attempt = 0; attempt < 200 && !peaksS; attempt++) {
    const others = spires.filter((c) => c !== starts.spires); rs.shuffle(others);
    const valleys = new Set([starts.spires, ...others.slice(0, 14)]);
    const mts = spires.filter((c) => !valleys.has(c));
    // greedy independent set, fewest free neighbours first
    const chosen = new Set(), blocked = new Set();
    const order = mts.slice(); rs.shuffle(order);
    while (true) {
      const free = order.filter((c) => !chosen.has(c) && !blocked.has(c));
      if (!free.length) break;
      const deg = (c) => grid.neighbours[c].filter((m) => mts.includes(m) && !blocked.has(m) && !chosen.has(m)).length;
      free.sort((a, b) => deg(a) - deg(b));
      const c = free[0]; chosen.add(c); for (const m of grid.neighbours[c]) blocked.add(m);
    }
    if (chosen.size >= 22) {
      for (const c of spires) terrain[c] = valleys.has(c) ? TERRAIN.CITY : TERRAIN.MOUNTAIN;
      peaksS = [...chosen].sort((a, b) => a - b); rs.shuffle(peaksS); peaksS = peaksS.slice(0, 22);
    }
  }
  if (!peaksS) throw new Error('could not place 22 Spires peaks');
  for (const c of peaksS) peak[c] = 1;

  // --- the Rift: a 12-cell ridge through its centre (the start cell stays a city), 3 peaks on it
  const rift = inArea('rift');
  const rr = R('rift');
  const sp = grid.pos[starts.rift];
  const az = rr.next() * Math.PI;
  const east = norm(cross([0, 1, 0], sp)), north = cross(sp, east);
  const dir = [east[0] * Math.cos(az) + north[0] * Math.sin(az), east[1] * Math.cos(az) + north[1] * Math.sin(az), east[2] * Math.cos(az) + north[2] * Math.sin(az)];
  const gcN = norm(cross(sp, dir));
  const ridge = rift.filter((c) => c !== starts.rift)
    .sort((a, b) => Math.abs(dot(grid.pos[a], gcN)) - Math.abs(dot(grid.pos[b], gcN)) || angleDeg(grid.pos[a], sp) - angleDeg(grid.pos[b], sp) || a - b).slice(0, 12);
  for (const c of ridge) terrain[c] = TERRAIN.MOUNTAIN;
  // 3 peaks: spread along the ridge (farthest-point), non-adjacent
  const along = (c) => dot(grid.pos[c], dir);
  const rsorted = ridge.slice().sort((a, b) => along(a) - along(b));
  const peaksR = [];
  for (const c of [rsorted[0], rsorted[rsorted.length - 1], ...rsorted.slice().sort((a, b) => Math.abs(along(a)) - Math.abs(along(b)))]) {
    if (peaksR.length >= 3) break;
    if (peaksR.includes(c) || peaksR.some((p) => grid.neighbours[p].includes(c))) continue;
    peaksR.push(c);
  }
  for (const c of peaksR) peak[c] = 1;

  // --- heights: peaks 8..12, other mountains 3..7 (never a strict local maximum)
  const rh = R('heights');
  const mountains = [...Array(n).keys()].filter((c) => terrain[c] === TERRAIN.MOUNTAIN);
  const peakCells = mountains.filter((c) => peak[c]);
  for (const c of peakCells) height[c] = 8 + rh.int(5);
  const dpk = bfs(grid, peakCells, 99, (m) => terrain[m] === TERRAIN.MOUNTAIN);
  for (const c of mountains) if (!peak[c]) height[c] = Math.max(3, Math.min(7, 8 - (dpk[c] < 0 ? 5 : dpk[c]) + (rh.next() < 0.5 ? 0 : -1)));
  for (let pass = 0; pass < 50; pass++) {
    let changed = false;
    for (const c of mountains) {
      if (peak[c]) continue;
      const mx = Math.max(...grid.neighbours[c].map((m) => (terrain[m] === TERRAIN.MOUNTAIN ? height[m] : 0)));
      if (height[c] > mx) { height[c] = mx; changed = true; }
      if (height[c] < 3) { height[c] = 3; changed = true; }
    }
    if (!changed) break;
  }

  // --- tutorial geography: edge district A (Capital ring 3, SW), district B 4 cells beyond (no peaks between)
  const demol1 = (c) => T.REGIONS[A[area[c]]].demolition === 1.0;
  let aCell = null, bCell = null;
  const aCands = ring(3).filter((c) => terrain[c] === TERRAIN.CITY && angd(brg(c), 225) <= 45).sort((x, y) => angd(brg(x), 225) - angd(brg(y), 225) || x - y);
  for (const pass of [true, false]) {
    for (const ac of aCands) {
      const dA = bfs(grid, ac, 4);
      const bc = [...Array(n).keys()].filter((c) => dA[c] === 4 && dcap[c] >= 6 && terrain[c] === TERRAIN.CITY && area[c] !== AI.capital && c !== term && (!pass || demol1(c)))
        .sort((x, y) => angd(bearing(grid.pos[ac], grid.pos[x]), 225) - angd(bearing(grid.pos[ac], grid.pos[y]), 225) || x - y)[0];
      if (bc != null) { aCell = ac; bCell = bc; break; }
    }
    if (aCell != null) break;
  }
  const dB = bfs(grid, bCell, 4);
  const gcAB = norm(cross(grid.pos[aCell], grid.pos[bCell]));
  const tPath = [];
  let cur = aCell;
  while (cur !== bCell) {
    const next = grid.neighbours[cur].filter((m) => dB[m] === dB[cur] - 1 && terrain[m] === TERRAIN.CITY).sort((x, y) => Math.abs(dot(grid.pos[x], gcAB)) - Math.abs(dot(grid.pos[y], gcAB)) || x - y)[0];
    if (next == null) throw new Error('tutorial path blocked');
    if (next !== bCell) tPath.push(next);
    cur = next;
  }

  // --- densities: per-area base maps
  const rd = R('density');
  const fixed = new Map([[aCell, 2], [bCell, 2], ...tPath.map((c) => [c, 2])]);
  const noise = Array.from({ length: n }, () => rd.next());
  let sm = noise;
  for (let k = 0; k < 2; k++) sm = sm.map((v, i) => (v + grid.neighbours[i].reduce((s, m) => s + sm[m], 0)) / (1 + grid.neighbours[i].length));
  const isCity = (c) => terrain[c] === TERRAIN.CITY || (terrain[c] === TERRAIN.MOUNTAIN && !peak[c]);
  for (const id of A) {
    const cs = inArea(id).filter(isCity);
    const base = T.REGIONS[id].baseDensity;
    const target = Math.round(base * cs.length);
    let x;
    let lo = () => 1, hi = () => 5;
    if (id === 'capital') {
      const rngR = [[5, 5], [4, 5], [3, 4], [2, 3]];
      lo = (c) => rngR[dcap[c]][0]; hi = (c) => rngR[dcap[c]][1];
      x = new Map(cs.map((c) => [c, (lo(c) + hi(c)) / 2 + (sm[c] - 0.5) * 2]));
    } else {
      const vals = cs.map((c) => sm[c]); const mu = vals.reduce((s, v) => s + v, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mu) ** 2, 0) / vals.length) || 1;
      x = new Map(cs.map((c) => [c, base + 1.1 * (sm[c] - mu) / sd]));
    }
    for (const c of cs) density[c] = fixed.has(c) ? fixed.get(c) : Math.max(lo(c), Math.min(hi(c), Math.round(x.get(c))));
    let sum = cs.reduce((s, c) => s + density[c], 0);
    const adj = cs.filter((c) => !fixed.has(c));
    for (let guard = 0; sum !== target && guard < 1000; guard++) {
      if (sum < target) { const c = adj.filter((c) => density[c] < hi(c)).sort((p, q) => (x.get(q) - density[q]) - (x.get(p) - density[p]) || p - q)[0]; if (c == null) break; density[c]++; sum++; }
      else { const c = adj.filter((c) => density[c] > lo(c)).sort((p, q) => (x.get(p) - density[p]) - (x.get(q) - density[q]) || p - q)[0]; if (c == null) break; density[c]--; sum--; }
    }
  }
  for (const c of atl) density[c] = T.REGIONS.brine.atlantisDensity;

  const cells = [...Array(n).keys()].map((i) => [area[i], terrain[i], density[i], height[i], peak[i]]);
  const meta = {
    capitalCentre: capC, terminal: term, starts,
    tutorial: { a: aCell, b: bCell, path: tPath, peaks: [p1, p2], atlantis: bay.slice().sort((a, b) => a - b) },
    capitalHeights: [p1, s1, p2, s2],
  };
  return { grid, cells, meta, frozenGrid: { pos: grid.pos, neighbours: grid.neighbours } };
}

// ------------------------------------------------------------------ checks
export function check({ grid, cells, meta }) {
  const fails = []; const lines = [];
  const n = grid.count;
  const by = (ai) => cells.map((r, i) => [r, i]).filter(([r]) => r[0] === ai);
  if (n !== 642) fails.push(`cells ${n} != 642`);
  if (grid.pentagon.filter(Boolean).length !== 12) fails.push('pentagons != 12');
  const capCells = by(AI.capital).map(([, i]) => i);
  if (capCells.some((c) => grid.pentagon[c])) fails.push('a pentagon falls inside the Capital');
  const tpos = grid.pos[meta.terminal];
  lines.push('area        cells ocean atl  mtn peaks start angle  avgDens');
  let ocean = 0, atl = 0, mtn = 0, peaks = 0;
  const expPeaks = { capital: 2, spires: 22, rift: 3 };
  A.forEach((id, ai) => {
    const cs = by(ai);
    const o = cs.filter(([r]) => r[1] === 2 || r[1] === 3).length, at = cs.filter(([r]) => r[1] === 3).length;
    const m = cs.filter(([r]) => r[1] === 1).length, pk = cs.filter(([r]) => r[4]).length;
    ocean += o; atl += at; mtn += m; peaks += pk;
    const st = meta.starts[id];
    const ang = st != null ? angleDeg(grid.pos[st], tpos) : null;
    const city = cs.filter(([r]) => (r[1] === 0 || (r[1] === 1 && !r[4])) && r[2] > 0);
    const ad = city.reduce((s, [r]) => s + r[2], 0) / (city.length || 1);
    lines.push(`${id.padEnd(10)} ${String(cs.length).padStart(5)} ${String(o).padStart(5)} ${String(at).padStart(4)} ${String(m).padStart(4)} ${String(pk).padStart(5)} ${String(st ?? '-').padStart(5)} ${ang != null ? ang.toFixed(1).padStart(6) : '     -'}  ${ad.toFixed(2)} (base ${T.REGIONS[id].baseDensity})`);
    if (cs.length !== TARGET[id]) fails.push(`${id}: ${cs.length} cells, want ${TARGET[id]}`);
    if ((expPeaks[id] ?? 0) !== pk) fails.push(`${id}: ${pk} peaks, want ${expPeaks[id] ?? 0}`);
    if (st != null) {
      if (cells[st][0] !== ai) fails.push(`${id}: start cell ${st} not in its region`);
      if (!(cells[st][1] === 0 || cells[st][1] === 1)) fails.push(`${id}: start cell not land`);
      if (Math.abs(ang - T.REGIONS[id].startAngle) > 5) fails.push(`${id}: start angle ${ang.toFixed(1)} vs ${T.REGIONS[id].startAngle}`);
    }
    if (Math.abs(ad - T.REGIONS[id].baseDensity) > 0.05 && id !== 'brine') fails.push(`${id}: avg density ${ad.toFixed(2)} vs ${T.REGIONS[id].baseDensity}`);
  });
  lines.push(`total: ocean ${ocean}, atlantis ${atl}, mountains ${mtn}, peaks ${peaks}`);
  if (ocean !== 120) fails.push(`ocean ${ocean} != 120`);
  if (atl !== 14) fails.push(`atlantis ${atl} != 14`);
  if (Math.abs(mtn - 91) > 3) fails.push(`mountains ${mtn} not 91±3`);
  if (peaks !== 27) fails.push(`peaks ${peaks} != 27`);
  if (by(AI.brine).some(([r]) => (r[1] === 2 || r[1] === 3) && false)) fails.push('');
  if (cells.some((r) => (r[1] === 2 || r[1] === 3) && r[0] !== AI.brine)) fails.push('ocean outside the Brine');
  if (cells[meta.terminal][0] !== AI.ringside) fails.push('Terminal not in the Ringside');
  // ringside within elevator reach
  if (by(AI.ringside).some(([, i]) => ringTrackDeg(grid.pos[i]) > T.PLANET.ringReachDeg)) fails.push('a Ringside cell beyond elevator reach');
  // peaks strictly higher than every neighbour; every non-peak mountain is not a strict maximum
  for (let i = 0; i < n; i++) {
    const r = cells[i]; if (r[1] !== 1) continue;
    const gh = (j) => (cells[j][1] === 1 ? cells[j][3] : 0);
    const strict = grid.neighbours[i].every((j) => gh(j) < r[3]);
    if (!!r[4] !== strict) fails.push(`cell ${i}: peak flag ${r[4]} but strict max ${strict}`);
    if (r[4] && (r[3] < 8 || r[3] > 12)) fails.push(`peak ${i} height ${r[3]}`);
    if (!r[4] && (r[3] < 3 || r[3] > 12)) fails.push(`mountain ${i} height ${r[3]}`);
  }
  // tutorial geography
  const t = meta.tutorial, cap = meta.capitalCentre;
  const dcap = bfs(grid, cap);
  const angT = angleDeg(grid.pos[t.a], tpos);
  lines.push(`tutorial: A ${t.a} (ring ${dcap[t.a]}, dens ${cells[t.a][2]}, ${angT.toFixed(1)}° to Terminal, bearing ${bearing(grid.pos[cap], grid.pos[t.a]).toFixed(0)}°), B ${t.b} (${A[cells[t.b][0]]}, dens ${cells[t.b][2]}, ${bfs(grid, t.a)[t.b]} cells from A), path ${t.path.join(',')}`);
  if (dcap[t.a] !== 3 || cells[t.a][2] !== 2) fails.push('tutorial A not a density-2 ring-3 Capital cell');
  if (Math.abs(angT - 160) > 5) fails.push('tutorial A not ~160° from the Terminal');
  if (bfs(grid, t.a)[t.b] !== 4 || cells[t.b][2] !== 2 || cells[t.b][1] !== 0) fails.push('tutorial B not a density-2 city 4 cells from A');
  if ([t.a, t.b, ...t.path].some((c) => cells[c][1] === 1)) fails.push('a peak or mountain between the tutorial districts');
  const [pa, pb] = t.peaks;
  const capPk = capCells.filter((c) => cells[c][4]);
  if (capPk.length !== 2 || capPk.some((c) => dcap[c] > 4)) fails.push('Capital Heights peaks not within 4 cells');
  if (!capPk.some((p) => grid.neighbours[p].some((m) => dcap[m] === 1 && cells[m][1] === 0))) fails.push('no Capital peak within 1 cell of a city cell next to the centre');
  const skyDist = angleDeg(grid.pos[pa], grid.pos[pb]) * Math.PI / 180 * 100;
  lines.push(`Capital Heights peaks ${pa},${pb} (rings ${dcap[pa]},${dcap[pb]}), ${skyDist.toFixed(1)} units apart; bay Atlantis ${t.atlantis.join(',')} at ${t.atlantis.map((c) => angleDeg(grid.pos[c], grid.pos[cap]).toFixed(1)).join('°, ')}° from the Capital centre`);
  if (skyDist > T.TYPES.sky.range) fails.push('Capital Heights peaks beyond sky range');
  for (const c of t.atlantis) {
    if (cells[c][1] !== 3 || cells[c][0] !== AI.brine) fails.push(`bay Atlantis ${c} not Atlantis`);
    if (angleDeg(grid.pos[c], grid.pos[cap]) > 33) fails.push(`bay Atlantis ${c} beyond 33° of the Capital centre`);
  }
  return { fails, lines };
}

function formatTable(cells, meta, fg) {
  const rows = [];
  const prow = [];
  for (let i = 0; i < fg.pos.length; i += 4) prow.push('    ' + fg.pos.slice(i, i + 4).map((p) => JSON.stringify(p)).join(','));
  const nrow = [];
  for (let i = 0; i < fg.neighbours.length; i += 8) nrow.push('    ' + fg.neighbours.slice(i, i + 8).map((p) => JSON.stringify(p)).join(','));
  const gridSrc = `export const OIKUMENE_GRID = {\n  pos: [\n${prow.join(',\n')},\n  ],\n  neighbours: [\n${nrow.join(',\n')},\n  ],\n};\n`;
  for (let i = 0; i < cells.length; i += 12) rows.push('  ' + cells.slice(i, i + 12).map((r) => JSON.stringify(r)).join(','));
  return `// BEGIN OIKUMENE_CELLS\n// generated by tools/oikumene.mjs — do not edit by hand. geo table hash ${hashValue(cells)}\n` +
    gridSrc + `export const OIKUMENE_META = ${JSON.stringify(meta)};\nexport const OIKUMENE_CELLS = [\n${rows.join(',\n')},\n];\n// END OIKUMENE_CELLS`;
}

// ------------------------------------------------------------------ main
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--tune')) { tune(); process.exit(0); }
  const built = build();
  const { fails, lines } = check(built);
  console.log(lines.join('\n'));
  const same = JSON.stringify(T.OIKUMENE_CELLS) === JSON.stringify(built.cells) && JSON.stringify(T.OIKUMENE_META) === JSON.stringify(built.meta) && JSON.stringify(T.OIKUMENE_GRID) === JSON.stringify(built.frozenGrid);
  if (process.argv.includes('--write')) {
    const src = fs.readFileSync(TUNING_PATH, 'utf8');
    const out = src.replace(/\/\/ BEGIN OIKUMENE_CELLS[\s\S]*\/\/ END OIKUMENE_CELLS/, formatTable(built.cells, built.meta, built.frozenGrid));
    fs.writeFileSync(TUNING_PATH, out);
    console.log('wrote the frozen cell table into game/src/tuning.js');
  } else if (!same) fails.push('the frozen table in tuning.js differs from a fresh build (run with --write)');
  if (fails.length) { console.log('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('OK: Oikumene passes every check. geoHash table', hashValue(built.cells));
}
