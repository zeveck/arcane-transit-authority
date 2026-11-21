// geo.js — small vector / sphere helpers shared by the sim and the renderer.
// Coordinates: y is north (up); longitude 0 faces +z; east is +x.
//   x = cos(lat)·sin(lon), y = sin(lat), z = cos(lat)·cos(lon). Angles in degrees unless named *Rad.

export const DEG = Math.PI / 180;

// Engine independence: Math.sin/cos/atan2/acos/asin may differ in the last bit between JS engines (Node vs a browser).
// Every trig-derived scalar that feeds a sim decision is quantised here, so all engines see the same value
// (an ulp-level difference cannot cross a 1e-9 rounding step except by vanishing chance).
/** Round to 1e-9. */
export const q9 = (x) => Math.round(x * 1e9) / 1e9;
/** Round to 1e-12. */
export const q12 = (x) => Math.round(x * 1e12) / 1e12;
/** Round to 1e-6. */
export const q6 = (x) => Math.round(x * 1e6) / 1e6;

export function latLonToVec(lat, lon, r = 1) {
  const la = lat * DEG, lo = lon * DEG;
  return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
}
export function vecToLatLon(v) {
  const r = Math.hypot(v[0], v[1], v[2]);
  return [q9(Math.asin(Math.max(-1, Math.min(1, v[1] / r))) / DEG), q9(Math.atan2(v[0], v[2]) / DEG)];
}
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Angle between two direction vectors, radians (robust). */
export function angleRad(a, b) { return q12(Math.atan2(len(cross(a, b)), dot(a, b))); }
/** Angle between two direction vectors, degrees. */
export function angleDeg(a, b) { return q9(angleRad(a, b) / DEG); }
/** Great-circle distance in planet units (radius 100 by default). */
export function gcDist(a, b, r = 100) { return q9(angleRad(a, b) * r); }

/** Spherical interpolation between unit vectors. */
export function slerp(a, b, t) {
  const om = angleRad(a, b);
  if (om < 1e-9) return lerp3(a, b, t);
  const so = Math.sin(om);
  const ka = Math.sin((1 - t) * om) / so, kb = Math.sin(t * om) / so;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}

/** Rotate v about unit axis k by angle (radians), Rodrigues. */
export function rotateAxis(v, k, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), kd = dot(k, v), kx = cross(k, v);
  return [v[0] * c + kx[0] * s + k[0] * kd * (1 - c), v[1] * c + kx[1] * s + k[1] * kd * (1 - c), v[2] * c + kx[2] * s + k[2] * kd * (1 - c)];
}

/** Initial bearing from a to b (degrees clockwise from north) for unit vectors. */
export function bearing(a, b) {
  const [la1, lo1] = vecToLatLon(a), [la2, lo2] = vecToLatLon(b);
  const p1 = la1 * DEG, p2 = la2 * DEG, dl = (lo2 - lo1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

/** Any unit vector perpendicular to a. */
export function perp(a) {
  const t = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return norm(cross(a, t));
}

/** Smoothstep 0..1. */
export const smoothstep = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
