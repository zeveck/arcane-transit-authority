// rng.js — deterministic PRNG streams (mulberry32) and string/number hashing.
// Pure: no DOM, no Math.random. Node- and browser-importable.

/** FNV-1a 32-bit hash of a string → uint32. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine values (numbers or strings) into one uint32 seed. */
export function hashSeed(...parts) {
  return hashString(parts.map(String).join('|'));
}

/** mulberry32 step on a state; returns [value in [0,1), newState]. */
function step(a) {
  a = (a + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/**
 * A mulberry32 stream. `state` is a plain int so streams snapshot as numbers.
 * Methods: next() in [0,1), int(n) in [0,n), range(a,b), pick(arr), shuffle(arr) (in place).
 */
export class Rng {
  constructor(seed) { this.state = seed | 0; }
  next() { const [v, s] = step(this.state); this.state = s; return v; }
  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + (b - a) * this.next(); }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
}

/** Named term stream: seeded from hash(term seed, name). Names: term, milestones, disasters, dispatches, cosmetic. */
export function termStream(termSeed, name) { return new Rng(hashSeed(termSeed, name)); }

/** Stable 32-bit hash of any JSON-able value (floats rounded to 1e-6), as 8 hex chars. Object keys are sorted. */
export function hashValue(v) {
  let h = 0x811c9dc5;
  const mix = (x) => { h ^= x & 0xffff; h = Math.imul(h, 0x01000193); h ^= x >>> 16; h = Math.imul(h, 0x01000193); };
  const feed = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } };
  const num = (x) => {
    if (!Number.isFinite(x)) { feed(String(x)); return; }
    const r = Math.round(x * 1e6);
    if (Number.isSafeInteger(r)) { mix(1); mix(r | 0); mix(Math.floor(r / 4294967296) | 0); }
    else { feed('F' + x.toExponential(9)); }
  };
  const walk = (x) => {
    if (x === null || x === undefined) { mix(2); return; }
    const t = typeof x;
    if (t === 'number') { num(x); return; }
    if (t === 'string') { mix(3); mix(x.length); feed(x); return; }
    if (t === 'boolean') { mix(x ? 4 : 5); return; }
    if (Array.isArray(x) || ArrayBuffer.isView(x)) { mix(6); mix(x.length); for (let i = 0; i < x.length; i++) walk(x[i]); return; }
    mix(7);
    for (const k of Object.keys(x).sort()) { feed(k); walk(x[k]); }
  };
  walk(v);
  return (h >>> 0).toString(16).padStart(8, '0');
}
