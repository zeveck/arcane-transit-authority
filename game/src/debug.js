// debug.js — window.__game, the play-test hook. Reads state and sets up situations; never plays.
import * as audio from './audio.js';
import * as save from './save.js';
import { geoHash, regionCounts, getCells } from './planet.js';

export function installDebug(G, { step, perf, setQuality }) {
  window.__runLog = window.__runLog || [];
  const g = () => G.game;
  window.__game = {
    state: () => {
      const base = { screen: G.screen, overlays: [...G.overlays], frozen: G.frozen, quiet: G.quiet, updates: G.updates, camera: G.cam.state(), xray: G.xrayTarget > 0.5 };
      return g()?.debugState ? { ...base, ...g().debugState() } : base;
    },
    frames: () => G.frameLog.map((x) => [...x]),
    clearFrames: () => { G.frameLog.length = 0; },
    step: (seconds = 0, draw = false) => { step(seconds, draw); return window.__game.state(); },
    stepTo: (gameTime, draw = false) => { const t = g()?.gameTime?.() ?? 0; if (gameTime > t) step(gameTime - t, draw); else step(0, draw); return window.__game.state(); },
    quiet: (on = true) => { G.quiet = !!on; return G.quiet; },
    resume: () => { G.frozen = false; return true; },
    startTerm: (charter = 'I', region = 'capital', termSeed = 1, opts = {}) => g()?.startTerm?.({ charter, region, termSeed, ...opts }),
    geoHash: () => geoHash(),
    project: (target) => g()?.project?.(target) ?? null,
    regions: () => regionCounts(),
    cells: (filter) => { const cs = getCells(); const out = cs.map((c) => ({ id: c.id, area: c.areaId, terrain: c.terrainName, density: g()?.densityOf?.(c.id) ?? c.density, peak: c.peak, lat: +c.lat.toFixed(2), lon: +c.lon.toFixed(2) })); return typeof filter === 'function' ? out.filter(filter) : filter ? out.filter((c) => Object.entries(filter).every(([k, v]) => c[k] === v)) : out; },
    stations: () => g()?.stations?.() ?? [],
    lines: () => g()?.lines?.() ?? [],
    routeCards: () => g()?.routeCards?.() ?? [],
    hash: () => g()?.hash?.() ?? null,
    perf: () => perf(),
    // read-only helpers for the replay: what a click at (x, y) would pick, and where a world point is on screen
    pickAt: (x, y) => g()?.pickAt?.(x, y) ?? null,
    cellAt: (x, y) => g()?.cellAt?.(x, y) ?? null,
    projectPoint: (p) => { const v = new G.camera.position.constructor(p[0], p[1], p[2]); const sp = g()?.screenOf?.(v); return sp ? { x: Math.round(sp.x), y: Math.round(sp.y), visible: sp.visible } : null; },
    cellOffsets: (id, r = 3.6) => { const c = getCells()[id]; const n = c.pos; const up = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
      let e1 = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]]; const l = Math.hypot(...e1); e1 = e1.map((x) => x / l);
      const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
      const rad = c.terrainName === 'ocean' || c.terrainName === 'atlantis' ? 100 : c.ground;
      const out = [[n[0] * rad, n[1] * rad, n[2] * rad]];
      for (const rr of [r, r * 0.6]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const q = [n[0] * 100 + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * rr, n[1] * 100 + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * rr, n[2] * 100 + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * rr]; const L = Math.hypot(...q); out.push(q.map((x) => x / L * rad)); }
      return out; },
    simLog: () => g()?.sim?.s.log.map(([u, a]) => [u, a]) ?? [],
    audioState: () => audio.audioState(),
    setQuality: (q) => setQuality(q),
    xray: (on) => g()?.setXray?.(on),
    // save slots (read-only listing; the UI saves and loads)
    slots: () => save.listSlots(),
    termId: () => g()?.termId ?? null,
  };
}
