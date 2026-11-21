// paths.js — the expanded graph (nodes = (station, line) ends) and route finding: for each origin one
// Dijkstra (seeded from all its line ends) gives the fastest path to every destination; two penalty re-runs
// (edges on the first tree ×2, then ×4) give up to 2 distinct alternatives. Recomputed on network change.
//
// Path format: { legs: number[] (capacity index = lineId*2 + dir; dir 0 = a→b), lines: number[] (line ids),
//                xfers: number[] (station ids whose transfer capacity is used), time: seconds }

import { TRANSFER, SIM } from './tuning.js';
import { liveLines, lineOpen, lineTime, walkways, components } from './network.js';

export class Heap {
  constructor(cap = 64) { this.d = new Float64Array(cap); this.n = new Int32Array(cap); this.size = 0; this.lastDist = 0; }
  push(dist, node) {
    if (this.size === this.n.length) { const d = new Float64Array(this.size * 2), n = new Int32Array(this.size * 2); d.set(this.d); n.set(this.n); this.d = d; this.n = n; }
    const D = this.d, N = this.n; let i = this.size++;
    while (i > 0) { const p = (i - 1) >> 1; if (D[p] < dist || (D[p] === dist && N[p] < node)) break; D[i] = D[p]; N[i] = N[p]; i = p; }
    D[i] = dist; N[i] = node;
  }
  pop() {
    const D = this.d, N = this.n, top = N[0];
    this.lastDist = D[0];
    const m = --this.size;
    if (m > 0) {
      const ld = D[m], ln = N[m];
      let i = 0;
      while (true) {
        let c = 2 * i + 1; if (c >= m) break;
        if (c + 1 < m && (D[c + 1] < D[c] || (D[c + 1] === D[c] && N[c + 1] < N[c]))) c++;
        if (D[c] > ld || (D[c] === ld && N[c] > ln)) break;
        D[i] = D[c]; N[i] = N[c]; i = c;
      }
      D[i] = ld; N[i] = ln;
    }
    return top;
  }
}

/**
 * Build the graph over open lines. Node layout per open line i: 4i dep@a, 4i+1 arr@b, 4i+2 dep@b, 4i+3 arr@a.
 */
export function buildGraph(g) {
  const lines = liveLines(g).filter((l) => lineOpen(g, l));
  const L = lines.length, N = 4 * L;
  const nodeStation = new Int32Array(N), time = new Float64Array(L), lineId = new Int32Array(L);
  const dep = new Map(), arr = new Map();
  const addTo = (m, s, v) => { let a = m.get(s); if (!a) m.set(s, a = []); a.push(v); };
  lines.forEach((l, i) => {
    lineId[i] = l.id; time[i] = lineTime(g, l);
    nodeStation[4 * i] = l.a; nodeStation[4 * i + 1] = l.b; nodeStation[4 * i + 2] = l.b; nodeStation[4 * i + 3] = l.a;
    addTo(dep, l.a, 4 * i); addTo(dep, l.b, 4 * i + 2); addTo(arr, l.b, 4 * i + 1); addTo(arr, l.a, 4 * i + 3);
  });
  const walk = new Map();
  for (const [a, b] of walkways(g)) { addTo(walk, a, b); addTo(walk, b, a); }
  // transfer adjacency (CSR) for every arrival node: dep nodes at the same station (other lines), then across walkways
  const xOff = new Int32Array(N + 1), xs = [], xt = [];
  for (let u = 0; u < N; u++) {
    xOff[u] = xs.length;
    const k = u & 3; if (k === 0 || k === 2) continue;
    const S = nodeStation[u], i = u >> 2;
    for (const v of dep.get(S) || []) if ((v >> 2) !== i) { xs.push(v); xt.push(S); }
    for (const S2 of walk.get(S) || []) for (const v of dep.get(S2) || []) { xs.push(v); xt.push(S2); }
  }
  xOff[N] = xs.length;
  return { L, N, lines, nodeStation, time, lineId, dep, arr, walk, xOff, xTo: Int32Array.from(xs), xSt: Int32Array.from(xt) };
}

/** One Dijkstra from origin station s with per-ride-edge penalty multipliers (Float64Array of 2L or null). */
function dijkstra(G, s, pen) {
  const { N, time, dep, walk, xOff, xTo, xSt } = G;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);      // previous node (-1 = seed)
  const xst = new Int32Array(N).fill(-1);       // transfer station used to reach this dep node (-1 none)
  const h = new Heap(N * 4 + 16);
  for (const v of dep.get(s) || []) { dist[v] = 0; h.push(0, v); }
  for (const s2 of walk.get(s) || []) for (const v of dep.get(s2) || []) if (TRANSFER.seconds < dist[v]) { dist[v] = TRANSFER.seconds; xst[v] = s2; h.push(dist[v], v); }
  const done = new Uint8Array(N);
  while (h.size) {
    const u = h.pop(), du = h.lastDist;
    if (done[u]) continue; done[u] = 1;
    if (du > dist[u]) continue;
    const i = u >> 2, k = u & 3;
    if (k === 0 || k === 2) { // departing: ride
      const v = u + 1, dir = k === 0 ? 0 : 1;
      const w = time[i] * (pen ? pen[2 * i + dir] : 1);
      if (du + w < dist[v]) { dist[v] = du + w; prev[v] = u; h.push(dist[v], v); }
    } else { // arrived at station S: transfer to other lines here or across walkways
      const nd = du + TRANSFER.seconds, e1 = xOff[u + 1];
      for (let e = xOff[u]; e < e1; e++) { const v = xTo[e]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; xst[v] = xSt[e]; h.push(nd, v); } }
    }
  }
  return { dist, prev, xst };
}

/** Best arrival into station t from a Dijkstra result: { node, cost, walkIn (bool) } or null. */
function bestArrival(G, R, t, s) {
  let best = null;
  for (const v of G.arr.get(t) || []) if (R.dist[v] < (best?.cost ?? Infinity)) best = { node: v, cost: R.dist[v], walkIn: false };
  for (const t2 of G.walk.get(t) || []) {
    if (t2 === s) continue;
    for (const v of G.arr.get(t2) || []) { const c = R.dist[v] + TRANSFER.seconds; if (c < (best?.cost ?? Infinity)) best = { node: v, cost: c, walkIn: true }; }
  }
  return best;
}

function reconstruct(G, R, arrival, t, s) {
  const legs = [], lines = [], xfers = [];
  let v = arrival.node; let time = 0;
  if (arrival.walkIn) xfers.push(t);
  while (v >= 0) {
    if ((v & 3) === 1 || (v & 3) === 3) { // arrival node: the ride edge into it
      const i = v >> 2, dir = (v & 3) === 1 ? 0 : 1;
      legs.push(G.lineId[i] * 2 + dir); lines.push(G.lineId[i]); time += G.time[i];
      v = R.prev[v]; // the dep node
      continue;
    }
    // departure node
    if (R.xst[v] >= 0) { xfers.push(R.xst[v]); time += TRANSFER.seconds; }
    v = R.prev[v];
  }
  legs.reverse(); lines.reverse(); xfers.reverse();
  return { legs, lines, xfers, time };
}
function samePath(a, b) {
  if (a.legs.length !== b.legs.length || a.xfers.length !== b.xfers.length) return false;
  for (let i = 0; i < a.legs.length; i++) if (a.legs[i] !== b.legs[i]) return false;
  for (let i = 0; i < a.xfers.length; i++) if (a.xfers[i] !== b.xfers[i]) return false;
  return true;
}

/**
 * All paths: Map origin → Map destination → path[] (fastest first, then up to 2 alternatives).
 * Only pairs inside one component with at least one ride leg. Records the time taken in g.perf.
 */
export function computePaths(g, targetsFor = null, { noPerf = false } = {}) {
  const t0 = performance.now();
  const G = buildGraph(g);
  const comp = components(g);
  const stationIds = [...comp.comp.keys()].sort((a, b) => a - b);
  const byComp = new Map();
  for (const id of stationIds) { const c = comp.comp.get(id); let a = byComp.get(c); if (!a) byComp.set(c, a = []); a.push(id); }
  const out = new Map();
  const idx = new Map(); G.lineId.forEach((id, i) => idx.set(id, i));
  for (const s of stationIds) {
    const targets = targetsFor ? targetsFor(s) : byComp.get(comp.comp.get(s)).filter((t) => t !== s);
    if (!targets.length) continue;
    if (!G.dep.has(s) && !(G.walk.get(s) || []).some((x) => G.dep.has(x))) continue;
    const R0 = dijkstra(G, s, null);
    const pen1 = new Float64Array(2 * G.L).fill(1), pen2 = new Float64Array(2 * G.L).fill(1);
    const m = new Map();
    const firsts = [];
    for (const t of targets) {
      const a = bestArrival(G, R0, t, s);
      if (!a || !isFinite(a.cost)) continue;
      const p = reconstruct(G, R0, a, t, s);
      if (!p.legs.length) continue;
      m.set(t, [p]); firsts.push(p);
    }
    if (!m.size) continue;
    // penalty re-runs: every ride edge on the first tree ×2, then ×4
    for (const p of firsts) for (const leg of p.legs) { const i = idx.get(leg >> 1), d = leg & 1; pen1[2 * i + d] = SIM.altPenalties[0]; pen2[2 * i + d] = SIM.altPenalties[1]; }
    for (const pen of [pen1, pen2]) {
      const R = dijkstra(G, s, pen);
      for (const [t, list] of m) {
        const a = bestArrival(G, R, t, s);
        if (!a || !isFinite(a.cost)) continue;
        const p = reconstruct(G, R, a, t, s);
        if (!p.legs.length) continue;
        if (!list.some((q) => samePath(q, p))) list.push(p);
      }
    }
    out.set(s, m);
  }
  const ms = performance.now() - t0;
  if (g.perf && !noPerf) { g.perf.lastRecompute = ms; g.perf.worstRecompute = Math.max(g.perf.worstRecompute || 0, ms); g.perf.recomputes = (g.perf.recomputes || 0) + 1; }
  return out;
}
