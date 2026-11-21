// demo-net.js — the title screen's fixed demo network on Oikumene, with its own light path sampler
// (same geometry rules as the design's Tech plan: Path geometry). Used only when the sim's own network
// isn't driving the view (the title, and as a fallback).
import { getCells, cellMeta } from './planet.js';
import { slerp, norm, angleRad, lerp } from './geo.js';

const R = 100;
const cells = () => getCells();
const P = (c) => cells()[c].pos;

function chaikin(pts, n = 2) {
  let p = pts;
  for (let k = 0; k < n; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; q.push(norm(lerpV(a, b, 0.25)), norm(lerpV(a, b, 0.75))); }
    q.push(p[p.length - 1]); p = q;
  }
  return p;
}
const lerpV = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function densify(dirs, radiusAt) {
  const out = [];
  for (let i = 0; i < dirs.length - 1; i++) {
    const a = dirs[i], b = dirs[i + 1];
    const n = Math.max(1, Math.ceil(angleRad(a, b) * R));
    for (let k = 0; k < n; k++) out.push(slerp(a, b, k / n));
  }
  out.push(dirs[dirs.length - 1]);
  const total = out.length - 1;
  return out.map((d, i) => { const r = radiusAt(i / Math.max(1, total)); return [d[0] * r, d[1] * r, d[2] * r]; });
}
export function surfacePath(cellIds) {
  const cs = cells();
  const dirs = chaikin(cellIds.map((c) => cs[c].pos));
  return densify(dirs, () => R + 1.0);
}
export function waterPath(cellIds) { return densify(chaikin(cellIds.map((c) => P(c))), () => 94.8); }
export function skyPath(a, b) {
  const cs = cells(); const ang = angleRad(P(a), P(b)); const L = ang * R; const h = Math.max(12, 0.25 * L);
  const n = Math.max(8, Math.ceil(L * 1.3));
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const d = slerp(P(a), P(b), t); const r = R + lerp(cs[a].height, cs[b].height, t) + 2 + h * Math.sin(Math.PI * t); out.push([d[0] * r, d[1] * r, d[2] * r]); }
  return out;
}
export function chord(pa, pb) {
  const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]); const n = Math.max(2, Math.ceil(L));
  const out = []; for (let i = 0; i <= n; i++) out.push(lerpV(pa, pb, i / n)); return out;
}
export const at = (c, r) => { const p = P(c); return [p[0] * r, p[1] * r, p[2] * r]; };
export function ringArc(lonA, lonB, r = 130) {
  let d = lonB - lonA; if (d > 180) d -= 360; if (d < -180) d += 360;
  const n = Math.max(4, Math.ceil(Math.abs(d) * Math.PI / 180 * r));
  const out = [];
  for (let i = 0; i <= n; i++) { const lo = (lonA + d * i / n) * Math.PI / 180; out.push([Math.sin(lo) * r, 0, Math.cos(lo) * r]); }
  return out;
}
function elevator(c) {
  const p = P(c); const g = cells()[c].ground; const lo = Math.atan2(p[0], p[2]);
  return chord([p[0] * (g + 1), p[1] * (g + 1), p[2] * (g + 1)], [Math.sin(lo) * 130, 0, Math.cos(lo) * 130]);
}

/** The demo network: { stations, lines, walkways } in the view format NetRenderer.setNetwork takes. */
export function demoNetwork() {
  const m = cellMeta();
  const cs = cells();
  const tut = m.tutorial;
  const term = m.terminal, cap = m.capitalCentre;
  const ring = m.starts.ringside;
  const lonOf = (c) => cs[c].lon;
  const st = [];
  const S = (id, cell, layers, extra = {}) => { st.push({ id, cell, layers, ...extra }); return id; };
  S(1, tut.a, ['surface', 'earth']);
  S(2, tut.b, ['surface']);
  S(3, cap, ['earth']);
  S(4, tut.peaks[0], ['sky']);
  S(5, tut.peaks[1], ['sky']);
  S(6, tut.atlantis[0], ['water'], { dome: true });
  S(7, tut.atlantis[1], ['water'], { dome: true });
  S(8, term, ['terminal', 'earth', 'space'], { terminal: true });
  S(9, ring, ['surface', 'space']);
  S(10, tut.a, ['fire'], { core: true, under: 1 });
  S(11, term, ['fire'], { core: true, under: 8 });
  const tA = tut.a;
  const lines = [
    { id: 1, type: 'surface', samples: surfacePath([tut.a, ...tut.path, tut.b]), trains: 2, a: 1, b: 2 },
    { id: 2, type: 'earth', samples: chord(at(cap, 100), at(tA, 100)), trains: 2, a: 3, b: 1 },
    { id: 3, type: 'sky', samples: skyPath(tut.peaks[0], tut.peaks[1]), trains: 2, a: 4, b: 5 },
    { id: 4, type: 'water', samples: waterPath([tut.atlantis[0], tut.atlantis[1]]), trains: 2, a: 6, b: 7 },
    { id: 5, type: 'earth', samples: chord(at(tA, 100), at(tA, 37)), trains: 2, shaft: true, a: 1, b: 10 },
    { id: 6, type: 'fire', samples: chord(at(tA, 37), at(term, 37)), trains: 2, a: 10, b: 11 },
    { id: 7, type: 'earth', samples: chord(at(term, 37), at(term, 100)), trains: 2, shaft: true, a: 11, b: 8 },
    { id: 8, type: 'space', samples: [...elevator(ring), ...ringArc(lonOf(ring), lonOf(term)).slice(1), ...elevator(term).reverse().slice(1)], trains: 2, a: 9, b: 8 },
  ];
  return { stations: st, lines, walkways: [] };
}
