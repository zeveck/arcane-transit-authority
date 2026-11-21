// sim.js — the Game: fixed update (1/30 s), a sim tick every 30 updates (one game second): demand,
// assignment, travel, fares, exports to the Warp Terminal, deep space departures, money and upkeep,
// Throughput (window (t-60, t]), quotas, the Audit deadline, Overtime, bankruptcy, bottleneck naming,
// and the single action API (game.act) used by the browser and the solver alike.
//
// Determinism: the state `g.s` is plain JSON; everything random comes from named mulberry32 streams whose
// states live in g.s.rng. Same term seed + same actions at the same update counts → same hash().

import {
  CHARTERS, REGIONS, SIM, TYPES, TRANSFER, GREEN, TRAINS_PER_NEW_LINE, TRAIN_REFUND, STATION_UPKEEP, LAYER_UPKEEP,
  INTERCHANGE_LAYER_FEE, SOLVER, AREA_IDS, MERITS, UNLOCKS, MANDATES, DISASTER_PACING,
} from './tuning.js';
import { getCells, getGrid, termSetup, geoHash, regionCounts, cellMeta, hexDistances, TERRAIN, TERRAIN_NAMES } from './planet.js';
import { Rng, termStream, hashValue, hashSeed } from './rng.js';
import { gcDist, angleDeg } from './geo.js';
import { computeMods, techPrice, techBlock, nativeTech, techTree, TECH_BY_ID } from './tech.js';
import {
  liveStations, liveLines, components, walkways, catchment, effDensity, lineCapacity, lineOpen, stationCapacity,
  lineTime, lineGeo, stationInfo, layerPrice, demolitionPrice, stationCanTake, layerCellBlock, trainPositions, walkwayGeo,
  stationWells, stationPos, coreUnder,
} from './network.js';
import { computePaths } from './paths.js';
import { routeCards as makeCards, buildPlan, buildInheritedNetwork, CARD_KINDS, applyOps } from './routes.js';
import { initDisasters, disasterTick, brace, reroute, repair, repairAll, coolant, restorePower, disasterView } from './disasters.js';
import { dealMilestones, checkMilestones, milestoneView } from './milestones.js';
import { cellName, stationName, lineName } from './names.js';

const EMA = 1 / 20;


export class Game {
  /** Use Game.newTerm(...) or Game.restore(snapshot). */
  constructor(s, opts = {}) {
    this.s = s;
    this.ct = getCells();
    this.opts = opts;
    this.cache = { geo: new Map() };
    this.events = [];
    this.perf = { worstTick: 0, ticks: 0, tickTotal: 0, worstRecompute: 0, recomputes: 0, updates: 0, updateTotal: 0 };
    this.stats = { xferFlow: new Map(), waiting: new Map(), blockedX: new Map(), turnedAwayPerMin: 0 };
    this.refreshMods();
    this.refreshFlare();
    this.dirty = true;
    this.paths = new Map();
    this.demand = null;
    this.gen = null;
  }

  // ---------------------------------------------------------------- creation
  /**
   * Start a term. opts: { termSeed, charter ('I'..'VI','G'), region, tutorial, freePlay, perks: [ids],
   *   unlockedMilestones: [ids], noDisasters, noInherited }.
   */
  static newTerm(opts = {}) {
    const tutorial = !!opts.tutorial;
    const charter = tutorial ? 'I' : (opts.charter || 'I');
    const region = tutorial ? 'capital' : (opts.region || 'capital');
    const termSeed = tutorial ? (opts.termSeed ?? SOLVER.tutorialTermSeed) : (opts.termSeed ?? 1);
    const ch = CHARTERS[charter];
    const setup = termSetup(termSeed, charter, region, { tutorial });
    const meta = cellMeta();
    const s = {
      v: 1, geo: geoHash(), termSeed, charter, region, tutorial, freePlay: !!opts.freePlay,
      mandates: setup.mandates, natives: setup.natives, priority: setup.priority,
      update: 0, time: 0,
      money: ch.start, startMoney: ch.start,
      densities: Array.from(setup.densities), demolished: new Array(642).fill(0), green: new Array(642).fill(0), attractions: [],
      stations: [], lines: [], terminalStation: 0,
      tech: nativeTech(setup.natives), freeTechCredits: 0, freeCoreExchanges: 0, firstCrossingUsed: false,
      bx: {}, bc: {}, inflight: {}, yard: 0, lineFlow: [], ema: { delivered: 0, reaching: 0, fares: 0 },
      launches: [], nextDeparture: 0, driftDelays: null,
      quota: { stage: 0, streak: 0, metAt: [] }, won: false, commendedAt: null, overtime: false, termOver: null, belowDebtSince: null,
      stats: { delivered: 0, launched: 0, turnedAway: 0, turnedAwayX: 0, fares: 0, freight: 0, upkeep: 0, spent: 0, demolishedByPlayer: 0, lastTurnAway: null, reached: 0 },
      turnedAwayBy: {},
      milestones: { dealt: [], done: {}, bonuses: [], hold: {} },
      ringSlow: null, blackoutUntil: null,
      rng: {}, log: [], undo: null, perks: opts.perks || [], genScale: opts.genScale || 1,
    };
    // the Warp Terminal (station 0)
    s.stations.push({ id: 0, cell: meta.terminal, kind: 'terminal', layers: [], upgraded: false, parent: null, inherited: false, built: 0, closedUntil: 0 });
    const g = new Game(s, opts);
    const trng = termStream(termSeed, 'term');
    // advance the term stream past what termSetup used, deterministically: re-derive it by name
    const inh = new Rng(hashSeed(termSeed, 'term', 'inherited'));
    if (!tutorial && !opts.noInherited) buildInheritedNetwork(g, inh);
    const mrng = termStream(termSeed, 'milestones');
    let dealt = dealMilestones(s, mrng, opts.unlockedMilestones || []);
    s.milestones.dealt = dealt;
    const drng = termStream(termSeed, 'disasters');
    s.dis = initDisasters(s, drng);
    if (tutorial) s.dis.nextAt = Math.max(s.dis.nextAt, 12 * 60);
    if (opts.noDisasters || s.freePlay) s.dis.nextAt = Infinity;
    s.rng = { milestones: mrng.state, disasters: drng.state, dispatches: termStream(termSeed, 'dispatches').state, term: trng.state };
    // perks
    for (const p of s.perks) {
      const perk = MERITS.perks.find((x) => x.id === p); if (!perk) continue;
      if (perk.effect.cash) { s.money += perk.effect.cash; s.startMoney += perk.effect.cash; }
      if (perk.effect.freeTechNode) s.freeTechCredits += perk.effect.freeTechNode;
      if (perk.effect.freeCorePair) s.freeCoreExchanges += 2;
      if (perk.effect.reroll) { const r2 = new Rng(hashSeed(termSeed, 'milestones', 'reroll')); s.milestones.dealt = dealMilestones(s, r2, opts.unlockedMilestones || []); }
      if (perk.effect.freeElevator) {
        const start = meta.starts[region];
        const st = liveStations(g).find((x) => x.cell === start);
        if (layerCellBlock(g, start, 'space') === null) applyOps(g, st ? [{ op: 'layer', station: st.id, layer: 'space' }] : [{ op: 'station', cell: start, layer: 'space', ref: 'P' }]);
      }
    }
    s.nextDeparture = g.departureInterval();
    g.refreshMods();
    g.dirty = true;
    return g;
  }

  /** Restore from a snapshot (as returned by snapshot()). */
  static restore(snap) {
    const s = typeof snap === 'string' ? JSON.parse(snap) : JSON.parse(JSON.stringify(snap));
    if (s.dis && s.dis.nextAt === null) s.dis.nextAt = Infinity;
    return new Game(s, {});
  }
  /** Full sim snapshot (plain JSON-able object). */
  snapshot() {
    this.flushBacklogs();
    const c = JSON.parse(JSON.stringify(this.s, (k, v) => (v === Infinity ? null : v)));
    return c;
  }
  /** Deep clone (for the solver's lookahead). */
  clone() { return Game.restore(this.snapshot()); }
  /** Hash of the sim snapshot (the action log excluded, so the same state hashes the same however it was reached). */
  hash() {
    const { log, undo, bc, bx, ...rest } = this.s;
    return hashValue({ ...rest, undo: undo ? { until: undo.until, refund: undo.refund } : null, backlog: this.backlogList() });
  }
  /** Non-zero backlogs as a flat [key, value, ...] list in key order (exports keyed -1 - station). */
  backlogList() {
    const out = [], D = this.demand;
    if (D && D.bc) {
      for (const i of D.xorder) if (D.bx[i] !== 0) out.push(-1 - D.exports[i].s, D.bx[i]);
      for (const i of D.order) if (D.bc[i] !== 0) out.push(D.commuters[i].key, D.bc[i]);
    } else {
      for (const k of Object.keys(this.s.bx).map(Number).sort((a, b) => b - a)) if (this.s.bx[k] !== 0) out.push(-1 - k, this.s.bx[k]);
      for (const k of Object.keys(this.s.bc).map(Number).sort((a, b) => a - b)) if (this.s.bc[k] !== 0) out.push(k, this.s.bc[k]);
    }
    return out;
  }

  // ---------------------------------------------------------------- derived caches
  refreshMods() { this.mods = computeMods(this.s); this.cache && (this.cache.walkways = null); }
  refreshFlare() {
    const f = this.s.dis?.flare;
    this.flareHits = f ? new Set(f.targets) : null;
  }
  invalidate() { this.cache.walkways = null; this.cache.components = null; this.gen = null; }
  emit(e) { this.events.push({ t: this.s.time, ...e }); if (this.events.length > 500) this.events.splice(0, this.events.length - 500); }
  /** Take queued events (UI). */
  drainEvents() { const e = this.events; this.events = []; return e; }

  /** Generation per station per minute: { C: Map(id → commuters), X: Map(id → exports), cover: Map(cell → [ids]), made }. */
  generation() {
    if (this.gen) return this.gen;
    const s = this.s, comp = components(this), m = this.mods, ch = CHARTERS[s.charter];
    const serving = liveStations(this).filter((st) => st.kind !== 'core' && !(s.time < (st.closedUntil || 0)));
    const cover = new Map();
    for (const st of serving) for (const c of catchment(this, st)) { let a = cover.get(c); if (!a) cover.set(c, a = []); a.push(st.id); }
    const boost = new Set();
    for (const p of s.priority) { const a = cover.get(p); if (a && a.some((id) => comp.comp.get(id) === comp.terminal)) { boost.add(p); for (const n of this.ct[p].neighbours) boost.add(n); } }
    const gm = this.greenMults();
    const C = new Map(), X = new Map();
    const atl = s.mandates.includes('atlanteanTrade');
    const cellsSorted = [...cover.keys()].sort((a, b) => a - b);
    for (const c of cellsSorted) {
      const d = effDensity(this, c); if (d <= 0) continue;
      const ids = cover.get(c), k = ids.length, cell = this.ct[c];
      const mult = (gm.get(c) || 1) * m.genMult * (s.genScale || 1);
      const com = SIM.commutersPerDensity * d * mult;
      let exp = SIM.exportsPerDensity * d * ch.export * REGIONS[cell.areaId].export * mult * m.exportMult;
      if (boost.has(c)) exp *= SIM.priorityExportMult;
      if (atl && cell.terrain === TERRAIN.ATLANTIS) exp *= SIM.atlanteanTradeMult;
      for (const id of ids) { C.set(id, (C.get(id) || 0) + com / k); X.set(id, (X.get(id) || 0) + exp / k); }
    }
    let made = 0;
    for (const [id, x] of X) if (comp.comp.get(id) === comp.terminal) made += x;
    this.gen = { C, X, cover, made, boost };
    return this.gen;
  }
  greenMults() {
    const s = this.s, out = new Map();
    for (let c = 0; c < s.green.length; c++) {
      const t = s.green[c]; if (!t) continue;
      if (t === 1 || t === 2) { const b = t === 1 ? GREEN.grove.genBonus : GREEN.park.genBonus; for (const n of this.ct[c].neighbours) out.set(n, (out.get(n) || 1) + b); }
      else if (t === 3) { const d = hexDistances(c, GREEN.attraction.radius); for (let i = 0; i < d.length; i++) if (d[i] >= 0) out.set(i, (out.get(i) || 1) + GREEN.attraction.genBonus * this.mods.attractionMult); }
    }
    return out;
  }
  /** Exports per minute made by stations in the Terminal's component (route cards' "+N exports"). */
  exportsReachable() { return this.generation().made; }
  servedCell(c) { return this.generation().cover.has(c); }
  greeneryScore() {
    const s = this.s; let parks = 0, groves = 0;
    for (const t of s.green) { if (t === 2) parks++; else if (t === 1) groves++; }
    return parks * (this.mods.parksDouble ? 2 : 1) + 0.5 * groves + 3 * s.attractions.length;
  }

  /** Write the live backlog arrays back into the state (s.bc / s.bx) so snapshots and hashes see them. */
  flushBacklogs() {
    const D = this.demand; if (!D || !D.bc) return;
    const bc = {}, bx = {};
    D.commuters.forEach((p, i) => { if (D.bc[i] !== 0) bc[p.key] = D.bc[i]; });
    D.exports.forEach((e, i) => { if (D.bx[i] !== 0) bx[e.s] = D.bx[i]; });
    this.s.bc = bc; this.s.bx = bx;
  }

  /** Recompute components, generation, paths and demand after a network change. */
  recompute() {
    this.invalidate();
    const s = this.s, comp = components(this), gen = this.generation();
    const term = s.terminalStation;
    const ws = walkways(this), walkNb = new Set(ws.map(([a, b]) => a * 100000 + b));
    const isWalk = (a, b) => walkNb.has(Math.min(a, b) * 100000 + Math.max(a, b));
    const ids = liveStations(this).filter((st) => st.kind !== 'core').map((st) => st.id).sort((a, b) => a - b);
    const byComp = new Map();
    for (const id of ids) { const c = comp.comp.get(id); let a = byComp.get(c); if (!a) byComp.set(c, a = []); a.push(id); }
    // which targets each origin needs
    const targets = new Map();
    for (const sid of ids) {
      const t = (byComp.get(comp.comp.get(sid)) || []).filter((x) => x !== sid && !isWalk(x, sid) && this.ct[this.s.stations[x].cell] && (gen.C.get(x) > 0 || x === term));
      if (comp.comp.get(sid) === comp.terminal && sid !== term && !t.includes(term) && !isWalk(sid, term)) t.push(term);
      targets.set(sid, t);
    }
    this.paths = computePaths(this, (sid) => targets.get(sid) || []);
    // demand shares
    const commuters = [], exports = [];
    for (const sid of ids) {
      const Cs = gen.C.get(sid) || 0;
      const ts = (targets.get(sid) || []).filter((t) => (gen.C.get(t) || 0) > 0);
      const pos = this.ct[s.stations[sid].cell].pos;
      if (Cs > 0 && ts.length) {
        let wsum = 0; const w = [], far = [];
        for (const t of ts) {
          const tp = this.ct[s.stations[t].cell].pos;
          const d = gcDist(pos, tp);
          w.push(gen.C.get(t) / (1 + d / SIM.gravityScale)); wsum += w[w.length - 1];
          far.push(angleDeg(pos, tp) > SIM.longHaulDeg);
        }
        const nFar = far.filter(Boolean).length;
        const gShare = nFar ? 1 - SIM.longHaulShare : 1;
        ts.forEach((t, i) => {
          const share = gShare * w[i] / wsum + (far[i] ? SIM.longHaulShare / nFar : 0);
          const tp = this.ct[s.stations[t].cell].pos;
          commuters.push({ s: sid, t, key: sid * 100000 + t, rate: Cs / 60 * share, fare: (SIM.fareBase + SIM.farePerUnit * gcDist(pos, tp)) * this.mods.fareMult * this.incomeMult(), paths: this.paths.get(sid)?.get(t) || null });
        });
      }
      if (comp.comp.get(sid) === comp.terminal && (gen.X.get(sid) || 0) > 0) {
        if (sid === term || isWalk(sid, term)) exports.push({ s: sid, rate: gen.X.get(sid) / 60, direct: true, paths: null });
        else exports.push({ s: sid, rate: gen.X.get(sid) / 60, direct: false, paths: this.paths.get(sid)?.get(term) || null });
      }
    }
    // origin ranges (commuters are built in origin order) and export index per origin
    const ranges = [];
    for (let i = 0; i < commuters.length;) { let j = i; while (j < commuters.length && commuters[j].s === commuters[i].s) j++; ranges.push([commuters[i].s, i, j]); i = j; }
    this.flushBacklogs();
    const bc = new Float64Array(commuters.length), bx = new Float64Array(exports.length);
    commuters.forEach((p, i) => { bc[i] = s.bc[p.key] || 0; });
    exports.forEach((e, i) => { bx[i] = s.bx[e.s] || 0; });
    const rangeOf = new Map(ranges.map(([sid, a, b]) => [sid, [a, b]]));
    const order = commuters.map((_, i) => i).sort((a, b) => commuters[a].key - commuters[b].key);
    const xorder = exports.map((_, i) => i).sort((a, b) => exports[b].s - exports[a].s);
    const fares = Float64Array.from(commuters, (p) => p.fare);
    for (const list of [...commuters.map((p) => p.paths), ...exports.map((e) => e.paths)]) if (list) for (const p of list) p.ticks = Math.max(1, Math.round(p.time));
    this.demand = { commuters, exports, ranges, rangeOf, bc, bx, order, xorder, fares };
    this.dirty = false;
  }

  // ---------------------------------------------------------------- time
  departureInterval() {
    if (this.mods.twinLaunch) return TYPES.deep.intervalTwin;
    if (this.s.mandates.includes('narrowYard')) return TYPES.deep.intervalNarrow;
    return TYPES.deep.interval;
  }
  /** Fares and freight scale with the Charter's price multiplier (BUILD_NOTES: income keeps pace with prices). */
  incomeMult() { return SIM.incomeScalesWithPrice ? CHARTERS[this.s.charter].price : 1; }
  warpCars() { return CHARTERS[this.s.charter].warpCars + this.mods.warpCars; }
  yardCap() { return this.s.mandates.includes('narrowYard') && !this.mods.twinLaunch ? this.warpCars() * TYPES.deep.carCap : Infinity; }
  /** Throughput: exports launched in (t-60, t]. */
  throughput(t = this.s.time) { let n = 0; for (const [lt, k] of this.s.launches) if (lt > t - SIM.throughputWindow && lt <= t) n += k; return n; }

  /** One fixed update (1/30 s of game time). Ticks the sim every 30 updates. */
  update() {
    if (this.s.termOver) return;
    const t0 = performance.now();
    this.s.update++;
    let ticked = false;
    if (this.s.update % SIM.updatesPerTick === 0) { this.tick(); ticked = true; }
    const dt = performance.now() - t0;
    this.perf.updates++; this.perf.updateTotal += dt;
    if (ticked) {
      const pure = dt - (this._recomputeMs || 0); this._recomputeMs = 0;
      this.perf.ticks++; this.perf.tickTotal += pure; this.perf.worstTick = Math.max(this.perf.worstTick, pure); this.perf.worstTickWithRecompute = Math.max(this.perf.worstTickWithRecompute || 0, dt);
    }
  }
  /** Run `seconds` of game time (whole updates). */
  step(seconds) { const n = Math.round(seconds * SIM.updatesPerSecond); for (let i = 0; i < n && !this.s.termOver; i++) this.update(); }
  /** Run until game time (seconds) is reached exactly. */
  stepTo(time) { const target = Math.round(time * SIM.updatesPerSecond); while (this.s.update < target && !this.s.termOver) this.update(); }
  /** Fractional game time (for rendering trains between ticks). */
  get gameTime() { return this.s.update / SIM.updatesPerSecond; }

  tick() {
    const s = this.s;
    s.time = Math.floor(s.update / SIM.updatesPerTick);
    disasterTick(this);
    if (this.dirty) { const r0 = performance.now(); this.recompute(); this._recomputeMs = performance.now() - r0; this.perf.worstFullRecompute = Math.max(this.perf.worstFullRecompute || 0, this._recomputeMs); }
    // undo window
    if (s.undo && s.time > s.undo.until) s.undo = null;
    this.arrivals();
    this.generate();
    this.assign();
    // the Terminal's own catchment: straight to the yard
    this.departures();
    this.money();
    this.checks();
    if (s.time % 2 === 0 || s.quota.stage >= 3) checkMilestones(this);
  }

  arrivals() {
    const s = this.s, b = s.inflight[s.time];
    if (!b) return;
    delete s.inflight[s.time];
    s.money += b[1]; s.stats.fares += b[1]; s.stats.delivered += b[0];
    this._arr = b;
    this.emitDeliveries();
    this.toYard(b[2]);
    this._arrivedThisTick = true;
  }
  /** Cosmetic: per-destination deliveries arriving this tick (from the delivery ring), as one event. */
  emitDeliveries() {
    const B = this._buf; if (!B) return;
    const slot = B.ring[this.s.time & 511];
    let list = null;
    for (let st = 0; st < B.NS; st++) {
      const n = slot[2 * st]; if (n === 0) continue;
      if (n >= 0.05) (list || (list = [])).push({ station: st, riders: Math.round(n * 100) / 100, fare: Math.round(slot[2 * st + 1] * 100) / 100 });
      slot[2 * st] = 0; slot[2 * st + 1] = 0;
    }
    if (list) this.emit({ type: 'deliveries', list });
  }
  toYard(x) {
    const s = this.s;
    if (x <= 0) return;
    s.stats.reached += x;
    this._reachedTick = (this._reachedTick || 0) + x;
    const cap = this.yardCap();
    const room = Math.max(0, cap - s.yard);
    if (x > room) { s.stats.turnedAwayX += x - room; s.stats.turnedAway += x - room; x = room; }
    s.yard += x;
  }

  generate() {
    const s = this.s, gen = this.generation(), D = this.demand, bc = D.bc, bx = D.bx;
    const cap = SIM.waitingCapMinutes;
    const exIdx = this._exIdx || (this._exIdx = new Map()); exIdx.clear();
    for (let i = 0; i < D.exports.length; i++) {
      const e = D.exports[i];
      if (e.direct) { this.toYard(e.rate); continue; }
      bx[i] += e.rate; exIdx.set(e.s, i);
    }
    const C = D.commuters;
    for (let i = 0; i < C.length; i++) bc[i] += C[i].rate;
    // waiting crowd cap: 10 × per-minute generation; overflow turned away
    const NS = s.stations.length;
    if (!this._wait || this._wait.length < NS) { this._wait = new Float64Array(Math.max(16, NS * 2)); this._waitIds = new Int32Array(this._wait.length); }
    const wait = this._wait; wait.fill(0);
    for (let i = 0; i < D.exports.length; i++) if (!D.exports[i].direct) wait[D.exports[i].s] += bx[i];
    for (let r = 0; r < D.ranges.length; r++) { const rg = D.ranges[r]; let w = 0; for (let i = rg[1]; i < rg[2]; i++) w += bc[i]; wait[rg[0]] += w; }
    for (let sid = 0; sid < NS; sid++) {
      const w = wait[sid]; if (!(w > 0)) continue;
      const limit = cap * ((gen.C.get(sid) || 0) + (gen.X.get(sid) || 0));
      if (w > limit) {
        const f = limit / w, lost = w - limit;
        const xi = exIdx.get(sid); if (xi != null) bx[xi] *= f;
        const rg = D.rangeOf.get(sid); if (rg) for (let i = rg[0]; i < rg[1]; i++) bc[i] *= f;
        s.stats.turnedAway += lost; s.stats.lastTurnAway = s.time;
        s.turnedAwayBy[sid] = (s.turnedAwayBy[sid] || 0) + lost;
        wait[sid] = limit;
      }
    }
    if (!this._waitView) { const self = this; this._waitView = { get: (id) => (self._wait && id < self._wait.length ? self._wait[id] : 0) }; }
    this.stats.waiting = this._waitView;
  }

  assign() {
    const s = this.s, L = s.lines.length, D = this.demand, bc = D.bc, bx = D.bx;
    const NS = s.stations.length;
    let B = this._buf;
    if (!B || B.L < L || B.NS < NS) {
      const l2 = Math.max(16, L * 2), n2 = Math.max(16, NS * 2);
      B = this._buf = { L: l2, NS: n2, lineRem: new Float64Array(2 * l2), stRem: new Float64Array(n2), used: new Float64Array(2 * l2), xused: new Float64Array(n2), usedX: new Float64Array(2 * l2), xusedX: new Float64Array(n2), linc: new Float64Array(l2), blockedX: new Map(),
        ring: Array.from({ length: 512 }, () => new Float64Array(2 * n2)) };
    }
    const lineRem = B.lineRem, stRem = B.stRem, used = B.used, xused = B.xused, usedX = B.usedX, xusedX = B.xusedX, linc = B.linc, blockedX = B.blockedX;
    lineRem.fill(0); stRem.fill(0); used.fill(0); xused.fill(0); usedX.fill(0); xusedX.fill(0); linc.fill(0); blockedX.clear();
    for (const l of s.lines) if (l && lineOpen(this, l)) { const c = lineCapacity(this, l) / 60; lineRem[2 * l.id] = c; lineRem[2 * l.id + 1] = c; }
    for (const st of s.stations) if (st) stRem[st.id] = stationCapacity(this, st) / 60;
    const inflight = s.inflight;
    const ring = B.ring;
    // exports first (origin id order), then commuters (origin, destination order); inlined for speed (no per-pair calls)
    const NX = D.exports.length, C = D.commuters, NC = C.length, fares = D.fares, time = s.time;
    for (let q = 0; q < NX + NC; q++) {
      const isX = q < NX, i = isX ? q : q - NX;
      let paths, left;
      if (isX) { const e = D.exports[i]; if (e.direct) continue; left = bx[i]; if (left <= 1e-12) continue; paths = e.paths; if (!paths) { blockedX.set(200000 + e.s, (blockedX.get(200000 + e.s) || 0) + left); continue; } }
      else { left = bc[i]; if (left <= 1e-12) continue; paths = C[i].paths; if (!paths) continue; }
      for (let pi = 0; pi < paths.length && left > 1e-12; pi++) {
        const p = paths[pi], legs = p.legs, xf = p.xfers;
        let fit = left;
        for (let k = 0; k < legs.length; k++) if (lineRem[legs[k]] < fit) fit = lineRem[legs[k]];
        for (let k = 0; k < xf.length; k++) if (stRem[xf[k]] < fit) fit = stRem[xf[k]];
        if (fit <= 1e-12) continue;
        for (let k = 0; k < legs.length; k++) { lineRem[legs[k]] -= fit; used[legs[k]] += fit; }
        for (let k = 0; k < xf.length; k++) { stRem[xf[k]] -= fit; xused[xf[k]] += fit; }
        left -= fit;
        const at = time + p.ticks;
        let bk = inflight[at]; if (!bk) inflight[at] = bk = [0, 0, 0];
        if (isX) { bk[2] += fit; for (let k = 0; k < legs.length; k++) usedX[legs[k]] += fit; for (let k = 0; k < xf.length; k++) xusedX[xf[k]] += fit; }
        else {
          const money = fit * fares[i];
          bk[0] += fit; bk[1] += money;
          const share = money / legs.length; for (let k = 0; k < legs.length; k++) linc[legs[k] >> 1] += share;
          const slot = ring[at & 511], dest = C[i].t; slot[2 * dest] += fit; slot[2 * dest + 1] += money;
        }
      }
      if (isX) {
        bx[i] = left;
        if (left > 1e-9) {
          const p = paths[0]; let key = -1, min = Infinity;
          for (let k = 0; k < p.legs.length; k++) { const leg = p.legs[k]; if (lineRem[leg] < min) { min = lineRem[leg]; key = leg >> 1; } }
          for (let k = 0; k < p.xfers.length; k++) { const x = p.xfers[k]; if (stRem[x] < min) { min = stRem[x]; key = 100000 + x; } }
          if (key >= 0) blockedX.set(key, (blockedX.get(key) || 0) + left);
        }
      } else bc[i] = left;
    }
    // flow stats (per minute, smoothed)
    const li = this.stats.lineIncome || (this.stats.lineIncome = []);
    while (li.length < L) li.push(0);
    for (let i = 0; i < L; i++) li[i] += (linc[i] * 60 - li[i]) * EMA;
    const lf = s.lineFlow, xf = this.stats.xferFlow;
    while (lf.length < 2 * L) lf.push(0);
    for (let i = 0; i < 2 * L; i++) lf[i] += (used[i] * 60 - lf[i]) * EMA;
    for (let i = 0; i < s.stations.length; i++) { const v = (xf.get(i) || 0); const nv = v + (xused[i] * 60 - v) * EMA; if (nv > 1e-6 || xf.has(i)) xf.set(i, nv); }
    // exports' own share of each line direction and interchange (exports are assigned first): route cards' export check
    const lx = this.stats.lineFlowX || (this.stats.lineFlowX = []), xx = this.stats.xferFlowX || (this.stats.xferFlowX = []);
    while (lx.length < 2 * L) lx.push(0); while (xx.length < NS) xx.push(0);
    for (let i = 0; i < 2 * L; i++) lx[i] += (usedX[i] * 60 - lx[i]) * EMA;
    for (let i = 0; i < NS; i++) xx[i] += (xusedX[i] * 60 - xx[i]) * EMA;
    this.stats.blockedX = blockedX;
    const E = s.ema, b = this._arr;
    E.delivered += ((b ? b[0] : 0) * 60 - E.delivered) * EMA; E.fares += ((b ? b[1] : 0) * 60 - E.fares) * EMA;
    E.reaching += ((this._reachedTick || 0) * 60 - E.reaching) * EMA;
    this._reachedTick = 0; this._arr = null;
  }

  departures() {
    const s = this.s;
    if (s.time < s.nextDeparture) return;
    const n = Math.min(s.yard, this.warpCars() * TYPES.deep.carCap);
    s.yard -= n;
    s.launches.push([s.time, n]);
    while (s.launches.length > 12) s.launches.shift();
    const firstExports = s.stats.launched <= 0 && n > 0;
    s.stats.launched += n;
    const fee = n * SIM.freightFee * this.incomeMult(); s.money += fee; s.stats.freight += fee;
    let next = s.time + this.departureInterval();
    if (s.driftDelays && s.driftDelays.length) { next += s.driftDelays.shift(); if (!s.driftDelays.length) s.driftDelays = null; }
    s.nextDeparture = Math.round(next);
    this.emit({ type: 'departure', launched: n, throughput: this.throughput(), firstExports });
    this.quotaCheck();
  }
  frontierLinked() {
    const s = this.s;
    if (!s.mandates.includes('frontierLink') || !s.priority.length) return true;
    const start = this.ct[cellMeta().starts[s.region]].pos;
    const far = s.priority.slice().sort((a, b) => angleDeg(this.ct[b].pos, start) - angleDeg(this.ct[a].pos, start) || a - b)[0];
    const gen = this.generation(), comp = components(this);
    return (gen.cover.get(far) || []).some((id) => comp.comp.get(id) === comp.terminal);
  }
  quotaCheck() {
    const s = this.s, q = CHARTERS[s.charter].quotas;
    if (s.quota.stage >= 3) return;
    const tp = this.throughput();
    const ok = tp >= q[s.quota.stage] && (s.quota.stage > 0 || this.frontierLinked());
    s.quota.streak = ok ? s.quota.streak + 1 : 0;
    if (s.quota.streak >= 2) {
      const k = s.quota.stage;
      s.quota.metAt[k] = s.time; s.quota.stage++;
      s.quota.streak = s.quota.stage < 3 && tp >= q[s.quota.stage] ? 1 : 0;
      if (k < 2) { const bonus = Math.round(SIM.quotaBonus * CHARTERS[s.charter].price); s.money += bonus; this.touchUndo({ all: true }); }
      if (k === 2 && !s.freePlay) { s.won = true; s.commendedAt = s.time; } // free play: no Commended (nothing to bank)
      this.emit({ type: 'quota', quota: k + 1, throughput: tp, hash: this.hash(), freePlay: !!s.freePlay, commended: k === 2 && !s.freePlay });
    }
  }

  upkeepPerMin() {
    let u = 0;
    for (const l of this.s.lines) if (l) u += l.trains * TYPES[l.type].upkeep;
    for (const st of this.s.stations) if (st) u += this.stationUpkeep(st);
    return u;
  }
  /** A station's own upkeep ($/min): the station plus each extra layer (the Terminal is free). */
  stationUpkeep(st) { return st.kind === 'terminal' ? 0 : STATION_UPKEEP * this.mods.stationUpkeepMult + LAYER_UPKEEP * Math.max(0, st.layers.length - 1); }
  money() {
    const s = this.s, u = this.upkeepPerMin() / 60;
    s.money -= u; s.stats.upkeep += u;
  }
  checks() {
    const s = this.s, ch = CHARTERS[s.charter];
    if (s.money < ch.debt) { if (s.belowDebtSince == null) { s.belowDebtSince = s.time; this.emit({ type: 'debtWarning' }); } else if (s.time - s.belowDebtSince >= SIM.bankruptcySeconds) this.endTerm('bankrupt'); }
    else s.belowDebtSince = null;
    if (!s.freePlay && !s.won) {
      const dl = ch.deadline * 60;
      if (s.time >= dl && !s.overtime) { s.overtime = true; this.emit({ type: 'overtime' }); }
      if (s.time >= dl + SIM.overtimeMinutes * 60) this.endTerm('overtime');
    }
  }
  endTerm(reason) { if (!this.s.termOver) { this.s.termOver = { reason, at: this.s.time }; this.emit({ type: 'termOver', reason }); } }

  /** Riders on board a line when it breaks are lost (share 0..1). */
  loseOnboard(l, share = 1) {
    const s = this.s;
    const f = (s.lineFlow[l.id * 2] || 0) + (s.lineFlow[l.id * 2 + 1] || 0);
    let onboard = f / 60 * lineTime(this, l) * share;
    let total = 0; for (const k in s.inflight) total += s.inflight[k][0] + s.inflight[k][2];
    if (total <= 0 || onboard <= 0) return;
    onboard = Math.min(onboard, total);
    const keep = 1 - onboard / total;
    for (const k in s.inflight) { const b = s.inflight[k]; b[0] *= keep; b[1] *= keep; b[2] *= keep; }
    s.stats.turnedAway += onboard; s.stats.lastTurnAway = s.time;
    if (!s.turnedAwayLine) s.turnedAwayLine = {};
    s.turnedAwayLine[l.id] = (s.turnedAwayLine[l.id] || 0) + onboard;
  }
  /**
   * Something (another action, a disaster hit, a milestone or quota bonus) touched what the pending Undo would
   * restore: Undo is no longer offered. `ref` is a line id (number) or { lines: [], stations: [], cells: [], all }.
   */
  touchUndo(ref) {
    const u = this.s.undo; if (!u) return;
    if (typeof ref === 'number') ref = { lines: [ref] };
    if (ref.all) { this.s.undo = null; return; }
    const hit = (mine, xs) => xs && mine && xs.some((x) => mine.includes(x));
    const sts = [...(u.newStations || []), ...(u.layers || []).map((x) => x[0]), ...(u.upgraded != null ? [u.upgraded] : [])];
    const lns = [...(u.lines || []), ...(u.train != null ? [u.train] : [])];
    const cls = [...(u.demolished || []), ...(u.green != null ? [u.green] : [])];
    if (hit(lns, ref.lines) || hit(sts, ref.stations) || hit(cls, ref.cells)) this.s.undo = null;
  }

  // ---------------------------------------------------------------- actions
  /**
   * The one action API (browser and solver). Returns { ok: true, ... } or { ok: false, reason }.
   * Actions: buildRoute {a,b,kind} · addTrain {line} · removeTrain {line} · upgradeInterchange {station}
   *  · placeStation {cell, layer} · buyTech {id} · demolish {cell | cells} · green {cell, kind, look}
   *  · closeLine {line} · openLine {line} · brace · reroute · repair {line} · repairAll · coolant · restorePower · undo
   */
  act(a) {
    if (this.s.termOver && a.type !== 'noop') return { ok: false, reason: 'The term is over' };
    const fn = ACTIONS[a.type];
    if (!fn) return { ok: false, reason: 'Unknown action ' + a.type };
    const r = fn(this, a);
    if (r.ok) {
      this.s.log.push([this.s.update, a]);
      if (r.cost) this.s.stats.spent += r.cost;
      this.emit({ type: 'action', action: a.type, cost: r.cost || 0 });
    }
    return r;
  }
  canAfford(cost) { return this.s.money - cost >= CHARTERS[this.s.charter].debt; }
  /**
   * The Undo record for one action: only what that action did (new lines and stations, layers added to existing
   * stations, demolished cells, a train, an interchange upgrade, a green cell), never a copy of the network.
   */
  beginUndo(cost, kind, rev = {}) {
    return { until: this.s.time + SIM.undoSeconds, refund: cost, kind, ...rev };
  }
  /** Undo record fields from applyOps' changes (new lines/stations, added layers, demolished cells). */
  undoFromChanges(changes, extra = {}) {
    const s = this.s, lines = [], newStations = [];
    for (let id = changes.linesLen; id < s.lines.length; id++) lines.push(id);
    for (let id = changes.stationsLen; id < s.stations.length; id++) newStations.push(id);
    return { linesLen: changes.linesLen, stationsLen: changes.stationsLen, lines, newStations, layers: changes.layers.map((x) => x.slice()), demolished: changes.demolished.slice(), firstCrossing: changes.firstCrossing, ...extra };
  }

  // ---------------------------------------------------------------- queries (debug hook / UI)
  routeCards(a, b, opts) { return makeCards(this, a, b, opts); }
  /** Station tool: null if a station of `layer` can go on `cell` (money aside), else why not. Read-only. */
  placeStationBlock(cell, layer) { return placeStationBlock(this, cell, layer); }
  /** Station tool: is this layer unlocked (Water and Space need their tech)? */
  stationLayerLocked(layer) { return layer === 'water' ? (this.mods.water ? null : 'Sea Stations') : layer === 'space' ? (this.mods.space ? null : 'Space Elevators') : null; }
  /** Debug-hook state. */
  state() {
    const s = this.s, ch = CHARTERS[s.charter];
    return {
      charter: s.charter, mandates: s.mandates.slice(), region: s.region, termSeed: s.termSeed, tutorial: s.tutorial,
      money: Math.round(s.money * 100) / 100, moneyPerMin: Math.round((this.s.ema.fares - this.upkeepPerMin()) * 10) / 10,
      throughput: this.throughput(), quotaStage: s.quota.stage, quotas: ch.quotas.slice(), nextQuota: ch.quotas[s.quota.stage] ?? null,
      time: s.time, update: s.update, deadline: s.freePlay ? null : ch.deadline * 60, stations: liveStations(this).length, lines: liveLines(this).length,
      priority: s.priority.slice(), termOver: s.termOver, won: s.won, overtime: s.overtime, commendedAt: s.commendedAt, quotaMetAt: s.quota.metAt.slice(),
      yard: s.yard, nextDeparture: s.nextDeparture, natives: s.natives.slice(), undo: s.undo ? { until: s.undo.until, refund: s.undo.refund, kind: s.undo.kind } : null,
      disaster: s.dis.warning ? { type: s.dis.warning.type, target: s.dis.warning.target, hitAt: s.dis.warning.hitAt } : null,
      geoHash: s.geo, freePlay: !!s.freePlay, perks: s.perks.slice(), firstCrossingUsed: !!s.firstCrossingUsed,
      firstCrossingAvailable: s.mandates.includes('firstCrossing') && !s.firstCrossingUsed,
    };
  }
  stations() { return liveStations(this).map((st) => ({ ...stationInfo(this, st), name: stationName(this, st) })); }
  /** Place names (names.js; never part of the state or the hash). */
  cellName(id) { return cellName(id); }
  stationName(st) { return stationName(this, st); }
  lineName(line) { return lineName(this, line); }
  lines() {
    const comp = components(this);
    const lw = {}, D = this.demand;
    if (D && D.bc) {
      D.commuters.forEach((p, i) => { const leg = p.paths?.[0]?.legs[0]; if (leg != null) lw[leg >> 1] = (lw[leg >> 1] || 0) + D.bc[i]; });
      D.exports.forEach((e, i) => { const leg = e.paths?.[0]?.legs[0]; if (leg != null) lw[leg >> 1] = (lw[leg >> 1] || 0) + D.bx[i]; });
    }
    const nLines = new Map(); for (const l of liveLines(this)) for (const id of [l.a, l.b]) nLines.set(id, (nLines.get(id) || 0) + 1);
    return liveLines(this).map((l) => {
      const stUp = [l.a, l.b].reduce((a, id) => a + this.stationUpkeep(this.s.stations[id]) / nLines.get(id), 0);
      const cap = lineCapacity(this, l), f0 = this.s.lineFlow[l.id * 2] || 0, f1 = this.s.lineFlow[l.id * 2 + 1] || 0;
      const geo = lineGeo(this, l);
      return {
        id: l.id, name: lineName(this, l), type: l.type, shaft: !!l.shaft, a: l.a, b: l.b, trains: l.trains, cars: TYPES[l.type].cars + (this.mods.cars[l.type] || 0) + this.mods.carsAll,
        length: +geo.length.toFixed(2), time: +lineTime(this, l).toFixed(2), capacity: Math.round(cap), flow: Math.round(f0 + f1), flowEach: [Math.round(f0), Math.round(f1)],
        load: cap > 0 ? Math.min(1, Math.max(f0, f1) / cap) : 0, open: lineOpen(this, l), closed: !!l.closed, broken: l.broken ? { ...l.broken, repairAt: l.repairAt ?? null } : null,
        inherited: !!l.inherited, ring: l.ring || null, cells: l.cells ? l.cells.slice() : null, upkeep: l.trains * TYPES[l.type].upkeep, stationUpkeep: Math.round(stUp * 100) / 100, runningCost: Math.round((l.trains * TYPES[l.type].upkeep + stUp) * 100) / 100, lengthMiles: Math.round(geo.length * 50),
        linkedToTerminal: comp.comp.get(l.a) === comp.terminal,
        income: Math.round((this.stats.lineIncome?.[l.id] || 0) * 10) / 10, waiting: Math.round(lw[l.id] || 0), turnedAway: Math.round(this.s.turnedAwayLine?.[l.id] || 0),
      };
    });
  }
  /** Path samples for a line: { samples: Float32Array (x,y,z,...), count, cum, length, segs }. */
  lineSamples(id) { const l = this.s.lines[id]; return l ? lineGeo(this, l) : null; }
  walkways() { return walkways(this).map(([a, b]) => ({ a, b, geo: walkwayGeo(this, a, b) })); }
  stationWells() { return stationWells(this); }
  trains(lineId) { const l = this.s.lines[lineId]; return l ? trainPositions(this, l, this.gameTime) : []; }
  cells(filter) {
    const s = this.s, gen = this.generation();
    let out = this.ct.map((c) => ({
      id: c.id, name: cellName(c.id), area: c.areaId, terrain: c.terrainName, peak: c.peak, height: c.height, ground: c.ground, lat: c.lat, lon: c.lon,
      density: effDensity(this, c.id), baseDensity: s.densities[c.id], demolished: !!s.demolished[c.id], green: ['', 'grove', 'park', 'attraction'][s.green[c.id]] || null,
      served: gen.cover.has(c.id), priority: s.priority.includes(c.id), coastal: c.coastal, stations: s.stations.filter((st) => st && st.cell === c.id).map((st) => st.id),
      demolitionPrice: demolitionPrice(this, c.id),
    }));
    if (typeof filter === 'function') out = out.filter(filter);
    else if (filter && typeof filter === 'object') out = out.filter((c) => Object.entries(filter).every(([k, v]) => c[k] === v));
    return out;
  }
  regions() { return regionCounts(); }
  geoHash() { return geoHash(); }
  techTree() { return techTree(this.s); }
  milestones() { return milestoneView(this); }
  disasters() { return disasterView(this); }
  /** Places list: stations, peaks, Atlantis cells, priority districts, the Terminal. */
  places() {
    const s = this.s, meta = cellMeta();
    return {
      terminal: { cell: meta.terminal, station: s.terminalStation },
      stations: liveStations(this).filter((st) => st.kind !== 'core').map((st) => ({ station: st.id, cell: st.cell, kind: st.kind, layers: st.layers.slice(), name: stationName(this, st) })),
      peaks: this.ct.filter((c) => c.peak).map((c) => ({ cell: c.id, area: c.areaId, height: c.height, name: cellName(c.id) })),
      atlantis: this.ct.filter((c) => c.terrain === TERRAIN.ATLANTIS).map((c) => ({ cell: c.id, name: cellName(c.id) })),
      priority: s.priority.map((c) => ({ cell: c, area: this.ct[c].areaId, name: cellName(c) })),
      starts: { ...meta.starts },
    };
  }
  /** Throughput breakdown and the named bottleneck. */
  breakdown() {
    const s = this.s, gen = this.generation(), comp = components(this);
    const made = gen.made, reaching = this.s.ema.reaching, launched = this.throughput();
    const ceiling = this.warpCars() * TYPES.deep.carCap * (60 / this.departureInterval());
    let bottleneck;
    const unlinked = liveStations(this).filter((st) => st.kind !== 'core' && comp.comp.get(st.id) !== comp.terminal && (gen.C.get(st.id) || 0) > 0);
    if (reaching > 1 && launched < 0.95 * reaching && reaching >= 0.95 * ceiling) bottleneck = { kind: 'warp', text: `Limit: the Warp ring (deep space capacity ${Math.round(ceiling)}/min). Tech: Warp Consists, Twin Launch Ring.`, target: { station: s.terminalStation } };
    else if (made > 1 && reaching < 0.9 * made) {
      let best = null, bv = 0;
      for (const [k, v] of this.stats.blockedX) if (v > bv) { bv = v; best = k; }
      if (best != null && best < 100000) bottleneck = this.lineLimit(s.lines[best]);
      else if (best != null && best < 200000) bottleneck = this.stationLimit(s.stations[best - 100000]);
      else if (best != null) bottleneck = { kind: 'noPath', text: `Limit: ${stationName(this, best - 200000)} has no open route to the Terminal`, target: { station: best - 200000 } };
      else bottleneck = this.fullestLimit() || (this.exportsInFlight() > 0.5
        ? { kind: 'travelling', text: 'Limit: exports are still travelling to the Terminal', target: null }
        : { kind: 'districts', text: 'Limit: districts served. Connect more of the city.', target: null });
    } else if (unlinked.length) bottleneck = { kind: 'unlinked', text: `Limit: ${unlinked.length === 1 ? stationName(this, unlinked[0]) + ' is' : unlinked.length + ' stations are'} not linked to the Terminal.`, target: { station: unlinked[0].id }, stations: unlinked.map((x) => x.id) };
    else bottleneck = { kind: 'districts', text: 'Limit: districts served. Connect more of the city.', target: null };
    return { made: Math.round(made), reaching: Math.round(reaching), launched, ceiling: Math.round(ceiling), bottleneck };
  }
  /** Bottleneck entries for a full line / interchange, named as the player sees them. */
  lineLimit(l) {
    const cap = lineCapacity(this, l), f = Math.max(this.s.lineFlow[l.id * 2] || 0, this.s.lineFlow[l.id * 2 + 1] || 0);
    return { kind: 'line', text: `Limit: ${lineName(this, l)} is full (${Math.round(Math.min(1, cap > 0 ? f / cap : 1) * 100)}% load, ${Math.round(cap)}/min each way)`, target: { line: l.id } };
  }
  stationLimit(st) {
    const cap = stationCapacity(this, st), f = this.stats.xferFlow.get(st.id) || 0;
    return { kind: 'interchange', text: `Limit: ${stationName(this, st)}'s interchange is full (${Math.round(f)} of ${Math.round(cap)} transfers/min)`, target: { station: st.id } };
  }
  /** The fullest line (load) or interchange (transfers / capacity) at 95% or more, or null. */
  fullestLimit() {
    let best = null, bv = 0.95 - 1e-9;
    for (const l of liveLines(this)) {
      if (!lineOpen(this, l)) continue;
      const cap = lineCapacity(this, l); if (!(cap > 0)) continue;
      const v = Math.max(this.s.lineFlow[l.id * 2] || 0, this.s.lineFlow[l.id * 2 + 1] || 0) / cap;
      if (v > bv) { bv = v; best = { line: l }; }
    }
    for (const st of liveStations(this)) {
      const cap = stationCapacity(this, st); if (!(cap > 0) || !isFinite(cap)) continue;
      const v = (this.stats.xferFlow.get(st.id) || 0) / cap;
      if (v > bv) { bv = v; best = { station: st }; }
    }
    if (!best) return null;
    return best.line ? this.lineLimit(best.line) : this.stationLimit(best.station);
  }
  /** Exports on board trains now (not yet at the Terminal). */
  exportsInFlight() { let n = 0; for (const k in this.s.inflight) n += this.s.inflight[k][2]; return n; }
  /** Grade and Merits (for the Term over / Commended screens). */
  grade() {
    const s = this.s, ch = CHARTERS[s.charter];
    const stars = { deadline: s.won && s.commendedAt <= ch.deadline * 60, efficiency: s.money > s.startMoney, greenery: this.greeneryScore() >= GREEN.gradeShare * this.ct.filter((c) => c.isCity).length };
    if (s.freePlay) for (const k in stars) stars[k] = false; // free play never raises a Charter's best stars
    const nStars = Object.values(stars).filter(Boolean).length;
    const quotas = s.quota.stage, ms = Object.keys(s.milestones.done).length;
    let merits = s.freePlay ? 0 : quotas * MERITS.perQuota + ms * MERITS.perMilestone + nStars * MERITS.perStar;
    if (s.won && s.commendedAt > ch.deadline * 60) merits = Math.max(0, merits - MERITS.overtimePenalty);
    return { stars, nStars, quotas, milestones: ms, merits, commended: s.won && !s.freePlay, unlocks: s.won && !s.freePlay ? UNLOCKS[s.charter] : null, freePlay: !!s.freePlay };
  }
  /** Performance numbers (worst tick, worst recompute, average update), ms. */
  perfStats() {
    const p = this.perf;
    return {
      worstTick: +p.worstTick.toFixed(3), avgTick: +(p.tickTotal / Math.max(1, p.ticks)).toFixed(3), worstTickWithRecompute: +(p.worstTickWithRecompute || 0).toFixed(3),
      worstRecompute: +(p.worstRecompute || 0).toFixed(3), worstFullRecompute: +(p.worstFullRecompute || 0).toFixed(3),
      avgUpdate: +(p.updateTotal / Math.max(1, p.updates)).toFixed(4), recomputes: p.recomputes || 0,
    };
  }
  /** Charter / mandate text for Charter documents. */
  static charterInfo(id) { const c = CHARTERS[id]; return { id, ...c, mandateText: Array.isArray(c.mandates) ? c.mandates.map((m) => MANDATES[m]) : 'Two mandates dealt from II–V', pacing: DISASTER_PACING[id] }; }
}

// ------------------------------------------------------------------ action handlers
const pmOf = (g) => CHARTERS[g.s.charter].price;
/** Why a station of `layer` can't be placed on `cell` by the Station tool (null: it can; money not checked). Read-only. */
function placeStationBlock(g, cell, layer) {
  if (layer === 'fire') return 'Core Exchanges are built by a through-the-core card';
  if (layer === 'water' && !g.mods.water) return 'Needs the Sea Stations tech';
  if (layer === 'space' && !g.mods.space) return 'Needs the Space Elevators tech';
  const existing = liveStations(g).find((st) => st.cell === cell && stationCanTake(g, st, layer));
  if (existing && existing.layers.includes(layer)) return 'Already there';
  const block = existing ? null : layerCellBlock(g, cell, layer);
  if (block) return block;
  if (!existing && liveStations(g).some((st) => st.cell === cell && st.kind !== 'core')) return 'A station already stands here';
  if (layer === 'surface' && g.s.mandates.includes('heritageCapital') && g.ct[cell].areaId === 'capital' && g.ct[cell].isCity && !g.s.demolished[cell]) return 'The Capital is protected';
  return null;
}
/** What a disaster warning's target is, as an Undo touch reference. */
function warningTouch(g, w) {
  if (!w) return {};
  if (typeof w.target === 'number') return ['meteor', 'seaquake', 'caveIn'].includes(w.type) ? { lines: [w.target] } : { stations: [w.target] };
  return {};
}
const ACTIONS = {
  noop: () => ({ ok: true }),
  buildRoute(g, a) {
    const cards = makeCards(g, a.a, a.b);
    const card = cards.find((c) => c.kind === a.kind);
    if (!card) return { ok: false, reason: 'No such card' };
    if (!card.feasible) return { ok: false, reason: card.reason || 'Not feasible' };
    if (!g.canAfford(card.cost)) return { ok: false, reason: 'Not enough money' };
    const freeCore = g.s.freeCoreExchanges;
    const before = g.s.demolished.reduce((x, v) => x + v, 0);
    const { changes } = buildPlan(g, card.plan);
    g.s.money -= card.cost;
    const dBy = g.s.demolished.reduce((x, v) => x + v, 0) - before;
    g.s.stats.demolishedByPlayer += dBy;
    const newLines = []; for (let id = changes.linesLen; id < g.s.lines.length; id++) newLines.push(id);
    const newStations = []; for (let id = changes.stationsLen; id < g.s.stations.length; id++) newStations.push(id);
    g.s.undo = g.beginUndo(card.cost, 'buildRoute', g.undoFromChanges(changes, { freeCore, demolishedByPlayer: dBy }));
    g.dirty = true;
    g.emit({ type: 'built', kind: card.kind, lines: newLines, stations: newStations, cost: card.cost, firstCrossing: card.free });
    return { ok: true, cost: card.cost, kind: card.kind, lines: newLines, stations: newStations, carries: card.carries, free: card.free };
  },
  addTrain(g, a) {
    const l = g.s.lines[a.line]; if (!l) return { ok: false, reason: 'No such line' };
    const p = Math.round(TYPES[l.type].train * pmOf(g));
    if (!g.canAfford(p)) return { ok: false, reason: 'Not enough money' };
    g.s.undo = g.beginUndo(p, 'addTrain', { train: l.id });
    g.s.money -= p; l.trains++;
    if (l.trains === 1) g.dirty = true;
    return { ok: true, cost: p, trains: l.trains };
  },
  removeTrain(g, a) {
    const l = g.s.lines[a.line]; if (!l || l.trains <= 0) return { ok: false, reason: 'No train to remove' };
    const refund = Math.round(TYPES[l.type].train * pmOf(g) * TRAIN_REFUND);
    l.trains--; g.s.money += refund;
    g.touchUndo(l.id);
    if (l.trains === 0) g.dirty = true;
    return { ok: true, refund, trains: l.trains };
  },
  upgradeInterchange(g, a) {
    const st = g.s.stations[a.station]; if (!st || st.kind === 'terminal') return { ok: false, reason: 'No such station' };
    if (st.upgraded) return { ok: false, reason: 'Already upgraded' };
    const p = Math.round(TRANSFER.upgradePrice * pmOf(g));
    if (!g.canAfford(p)) return { ok: false, reason: 'Not enough money' };
    g.s.undo = g.beginUndo(p, 'upgradeInterchange', { upgraded: st.id });
    g.s.money -= p; st.upgraded = true;
    return { ok: true, cost: p };
  },
  placeStation(g, a) {
    const { cell, layer } = a;
    const why = placeStationBlock(g, cell, layer);
    if (why) return { ok: false, reason: why };
    const existing = liveStations(g).find((st) => st.cell === cell && stationCanTake(g, st, layer));
    const term = existing?.kind === 'terminal';
    const p = layerPrice(g, cell, layer, { forTerminal: term }) + (existing && !term ? Math.round(INTERCHANGE_LAYER_FEE * pmOf(g)) : 0);
    if (!g.canAfford(p)) return { ok: false, reason: 'Not enough money' };
    const before = g.s.demolished.reduce((x, v) => x + v, 0);
    const { changes } = applyOps(g, existing ? [{ op: 'layer', station: existing.id, layer }] : [{ op: 'station', cell, layer, ref: 'M' }]);
    const dBy = g.s.demolished.reduce((x, v) => x + v, 0) - before;
    g.s.stats.demolishedByPlayer += dBy;
    g.s.undo = g.beginUndo(p, 'placeStation', g.undoFromChanges(changes, { freeCore: g.s.freeCoreExchanges, demolishedByPlayer: dBy }));
    g.s.money -= p; g.dirty = true;
    return { ok: true, cost: p, station: existing ? existing.id : g.s.stations.length - 1 };
  },
  buyTech(g, a) {
    const block = techBlock(g.s, a.id); if (block) return { ok: false, reason: block };
    let p = techPrice(g.s, a.id);
    const free = g.s.freeTechCredits > 0;
    if (free) p = 0;
    if (!g.canAfford(p)) return { ok: false, reason: 'Not enough money' };
    if (free) g.s.freeTechCredits--;
    g.s.money -= p; g.s.tech[a.id] = true;
    g.refreshMods(); g.cache.geo.clear(); g.dirty = true;
    // a protection tech cancels the pending warning it protects against (Heat Shielding: Core Flare, Tunnel Bracing: Cave-in, Warp Anchor: Warp Drift)
    const w = g.s.dis.warning, cancels = { heatShielding: 'coreFlare', tunnelBracing: 'caveIn', warpAnchor: 'warpDrift' }[a.id];
    if (w && w.type === cancels) { g.s.dis.warning = null; g.s.dis.history.push({ type: w.type, target: w.target, at: g.s.time, cancelled: a.id }); g.emit({ type: 'disasterCancelled', disaster: w.type, by: a.id }); }
    if (a.id === 'twinLaunchRing' && g.s.nextDeparture > g.s.time + g.departureInterval()) g.s.nextDeparture = g.s.time + g.departureInterval();
    return { ok: true, cost: p };
  },
  demolish(g, a) {
    const cells = a.cells || [a.cell];
    let cost = 0; const todo = [];
    for (const c of cells) {
      const cell = g.ct[c]; if (!cell || !cell.isCity || g.s.demolished[c] || g.s.green[c]) continue;
      if (g.s.stations.some((st) => st && st.cell === c)) continue;
      if (g.s.mandates.includes('heritageCapital') && cell.areaId === 'capital') continue;
      cost += demolitionPrice(g, c); todo.push(c);
    }
    if (!todo.length) return { ok: false, reason: 'Nothing to demolish here' };
    if (!g.canAfford(cost)) return { ok: false, reason: 'Not enough money' };
    g.s.undo = g.beginUndo(cost, 'demolish', { demolished: todo.slice(), demolishedByPlayer: todo.length });
    for (const c of todo) g.s.demolished[c] = 1;
    g.s.stats.demolishedByPlayer += todo.length;
    g.s.money -= cost; g.dirty = true;
    return { ok: true, cost, cells: todo };
  },
  green(g, a) {
    const c = a.cell, cell = g.ct[c], kind = a.kind || 'park';
    const k = { grove: 1, park: 2, attraction: 3 }[kind]; if (!k) return { ok: false, reason: 'Unknown greenery' };
    if (!cell || !g.s.demolished[c] || g.s.green[c]) return { ok: false, reason: 'Needs a cleared cell' };
    if (g.s.stations.some((st) => st && st.cell === c)) return { ok: false, reason: 'A station stands here' };
    if (k === 3) {
      const near = [c, ...cell.neighbours];
      const nextToLine = liveLines(g).some((l) => (l.cells && l.cells.some((x) => near.includes(x))) || near.includes(g.s.stations[l.a].cell) || near.includes(g.s.stations[l.b].cell));
      if (!nextToLine) return { ok: false, reason: 'An attraction must be next to a line' };
    }
    const p = Math.round(GREEN[kind].price * pmOf(g));
    if (!g.canAfford(p)) return { ok: false, reason: 'Not enough money' };
    g.s.undo = g.beginUndo(p, 'green', { green: c });
    g.s.money -= p; g.s.green[c] = k;
    if (k === 3) g.s.attractions.push({ cell: c, look: a.look || 'wheel' });
    g.dirty = true;
    return { ok: true, cost: p };
  },
  closeLine(g, a) { const l = g.s.lines[a.line]; if (!l || l.closed) return { ok: false, reason: 'Not open' }; l.closed = true; g.dirty = true; g.touchUndo(l.id); return { ok: true }; },
  openLine(g, a) { const l = g.s.lines[a.line]; if (!l || !l.closed || l.broken) return { ok: false, reason: 'Not closed' }; l.closed = false; g.dirty = true; g.touchUndo(l.id); return { ok: true }; },
  brace(g) { const w = g.s.dis.warning; const r = brace(g); if (r.ok) g.touchUndo(warningTouch(g, w)); return r; },
  reroute(g) { const w = g.s.dis.warning; const r = reroute(g); if (r.ok) g.touchUndo(warningTouch(g, w)); return r; },
  repair(g, a) { const r = repair(g, a.line); if (r.ok) g.touchUndo(a.line); return r; },
  repairAll(g) { const ids = liveLines(g).filter((l) => l.broken && l.repairAt == null).map((l) => l.id); const r = repairAll(g); if (r.ok) g.touchUndo({ lines: ids }); return r; },
  coolant: (g) => coolant(g),
  restorePower: (g) => restorePower(g),
  /** Reverts only what the last undoable action did (see beginUndo), and refunds it in full. */
  undo(g) {
    const s = g.s, u = s.undo;
    if (!u || s.time > u.until) return { ok: false, reason: 'Nothing to undo' };
    if (u.linesLen != null && (s.lines.length !== u.linesLen + u.lines.length || s.stations.length !== u.stationsLen + u.newStations.length)) { s.undo = null; return { ok: false, reason: 'Nothing to undo' }; }
    if (u.train != null) { const l = s.lines[u.train]; if (!l || l.trains <= 0) { s.undo = null; return { ok: false, reason: 'Nothing to undo' }; } l.trains--; if (l.trains === 0) g.dirty = true; }
    if (u.upgraded != null) { const st = s.stations[u.upgraded]; if (st) st.upgraded = false; }
    if (u.green != null) {
      if (s.green[u.green] === 3) { const i = s.attractions.map((x) => x.cell).lastIndexOf(u.green); if (i >= 0) s.attractions.splice(i, 1); }
      s.green[u.green] = 0;
    }
    if (u.linesLen != null) {
      for (const id of u.lines) { g.cache.geo.delete(id); if (s.turnedAwayLine) delete s.turnedAwayLine[id]; }
      for (const id of u.newStations) delete s.turnedAwayBy[id];
      s.lines.length = u.linesLen; s.stations.length = u.stationsLen;
      for (const [sid, layer] of u.layers) { const st = s.stations[sid]; if (st) st.layers = st.layers.filter((x) => x !== layer); }
      s.firstCrossingUsed = u.firstCrossing;
      if (u.freeCore != null) s.freeCoreExchanges = u.freeCore;
      s.lineFlow.length = Math.min(s.lineFlow.length, 2 * s.lines.length);
      if (g.stats.lineIncome) g.stats.lineIncome.length = Math.min(g.stats.lineIncome.length, s.lines.length);
      if (g.stats.lineFlowX) g.stats.lineFlowX.length = Math.min(g.stats.lineFlowX.length, 2 * s.lines.length);
      if (g.stats.xferFlowX) g.stats.xferFlowX.length = Math.min(g.stats.xferFlowX.length, s.stations.length);
    }
    if (u.demolished) for (const c of u.demolished) if (!s.green[c]) s.demolished[c] = 0;
    if (u.demolishedByPlayer) s.stats.demolishedByPlayer -= u.demolishedByPlayer;
    s.money += u.refund; s.undo = null;
    g.invalidate(); g.cache.geo.clear(); g.dirty = true;
    return { ok: true, refund: u.refund, kind: u.kind };
  },
};
export const ACTION_TYPES = Object.keys(ACTIONS);
export { CARD_KINDS };

/** Convenience: start a term (same as Game.newTerm). */
export function newTerm(opts) { return Game.newTerm(opts); }
