// game.js — the in-play controller: owns the sim Game, turns input into actions (Route tool, Demolish,
// Green, Station, selection), keeps the renderer and the city in step with the sim, runs the camera modes
// (fly-to, Ride, first-crossing cinematic) and feeds the HUD, story and meta screens.
import * as THREE from 'three';
import { Game as Sim } from './sim.js';
import { cellMeta, getCells, TERRAIN } from './planet.js';
import { TYPE_COLORS, TYPE_ORDER } from './palette.js';
import { CHARTERS, REGIONS, GREEN, MERITS, TECH, DISASTERS } from './tuning.js';
import * as audio from './audio.js';
import * as save from './save.js';
import { ZOOM, vecLatLon } from './camera.js';
import { Hud } from './hud.js';
import { Story } from './story.js';
import { Meta } from './meta.js';
import * as names from './names.js';
import { fmtMoney } from './fmt.js';

const R = 100;
const SPEEDS = [1, 2, 4];
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const toArr = (f) => { const out = []; for (let i = 0; i < f.length; i += 3) out.push([f[i], f[i + 1], f[i + 2]]); return out; };

export class Game {
  constructor(G) {
    this.G = G; this.cells = getCells(); this.meta = cellMeta();
    this.sim = null; this.playing = false;
    this.speedIdx = 0; this.paused = false; this.pauseReasons = new Set();
    this.tool = 'route'; this.route = { a: null, b: null, cards: null, hi: -1 };
    this.selection = null; this.flow = false; this.layers = Object.fromEntries(TYPE_ORDER.map((t) => [t, true]));
    this.xrayUser = false; this.xrayAuto = false;
    this.trainCache = new Map();
    this.ride = null; this.cinematic = null;
    this.lastTick = -1; this.netVersion = 0;
    this.popups = []; this.popupBudget = 0;
    this.hud = new Hud(this);
    this.story = new Story(this);
    this.metaUi = new Meta(this);
    G.net.trainSource = (id) => this.trainsFor(id);
    // the title's demo network is built by the sim itself, so its rails use the real path samples
    try {
      const d = Sim.newTerm({ tutorial: true, noDisasters: true });
      const m = this.meta;
      const b = (a, bb, kind) => { const r = d.act({ type: 'buildRoute', a, b: bb, kind }); return r.ok; };
      b(m.tutorial.a, m.tutorial.b, 'surface'); b(m.tutorial.a, m.terminal, 'core'); b(m.capitalCentre, m.tutorial.a, 'earth');
      b(m.tutorial.peaks[0], m.tutorial.peaks[1], 'sky');
      d.act({ type: 'buyTech', id: 'seaStations' }); b(m.tutorial.atlantis[0], m.tutorial.atlantis[1], 'water');
      d.s.money += 20000; d.act({ type: 'buyTech', id: 'spaceElevators' }); b(m.starts.ringside, m.terminal, 'space');
      const toArrL = (f) => { const o = []; for (let i = 0; i < f.length; i += 3) o.push([f[i], f[i + 1], f[i + 2]]); return o; };
      G.net.demo = {
        stations: d.stations().map((x) => ({ ...x, terminal: x.kind === 'terminal', core: x.kind === 'core' })),
        lines: d.lines().map((l) => ({ id: l.id, type: l.type, shaft: l.shaft, a: l.a, b: l.b, samples: toArrL(d.lineSamples(l.id).samples), trains: 2, cars: l.cars, load: 0.4, born: -10 })),
        walkways: d.walkways().map((w) => ({ a: w.a, b: w.b, samples: w.geo ? toArrL(w.geo.samples) : null })),
      };
      if (G.net.demoOn) G.net.showDemo(true);
    } catch (e) { console.warn('demo network', e?.message); }
  }

  // ------------------------------------------------------------------ lifecycle
  canContinue() { return !!save.latestSlot(); }
  newTerm() {
    const m = save.meta();
    if (!m.tutorialDone) return this.startTutorial();
    if (!m.commended?.I) return this.metaUi.openSetup({ charter: 'I', region: 'capital' });
    this.metaUi.openCharterBoard();
  }
  // a new term never destroys a saved one: the old term keeps its autosave slot
  startTutorial() { this.startTerm({ tutorial: true }); }
  openMerit() { this.metaUi.openMerit(); }
  continueTerm() { const id = save.latestSlot(); if (id) this.loadSlot(id); }
  /** Load a save slot (Continue, Load). The term in play, if any, is autosaved first and keeps its slot. */
  loadSlot(id) {
    const r = save.readSlot(id);
    if (!r || r.damaged) { audio.sfx('ui-error'); this.hud.toast?.('That save is damaged and can\'t be loaded.', 'error'); return false; }
    try {
      const sim = Sim.restore(r.data.sim);
      if (this.playing) { this.saveNow(); this.stopCameraModes(); }
      this.begin(sim, { restored: { ...r.data, termId: r.termId, slot: id } });
      save.setLastPlayed(id);
      return true;
    } catch (e) { console.warn('restore failed', e); audio.sfx('ui-error'); return false; }
  }
  /** "the autosave of Charter II (The Brine, 12:30)" for messages about removed slots. */
  slotLabel(s) { const i = s.info || {}; const t = Math.floor(i.time || 0); return `the autosave of ${i.tutorial ? 'the tutorial' : i.charter === 'G' ? 'Charter Galactic' : 'Charter ' + (i.charter || '?')} (${REGIONS[i.region]?.name || '?'}, ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')})`; }
  /** The slot record for the term in play (autosave or a manual slot). */
  slotRecord(kind) {
    const st = this.sim.state();
    return { kind, termId: this.termId, thumb: this.thumbnail(kind === 'manual'),
      info: { charter: st.charter, region: st.region, time: st.time, throughput: Math.round(st.throughput || 0), tutorial: !!st.tutorial && !!this.story.tut, freePlay: !!st.freePlay },
      data: { sim: this.sim.snapshot(), opts: this.termOpts, story: this.story.saveState(), plan: this.plan ? { a: this.plan.a, b: this.plan.b, kind: this.plan.kind, at: this.plan.at } : null } };
  }
  /** A small picture of the planet for the slot list (~160×100 JPEG), refreshed at most every 2 minutes for autosaves. */
  thumbnail(fresh = false) {
    const now = performance.now();
    if (!fresh && this.thumbCache && now - this.thumbAt < 120000) return this.thumbCache;
    try {
      const G = this.G; G.renderer.render(G.scene, G.camera);
      const c = document.createElement('canvas'); c.width = 160; c.height = 100;
      const src = G.renderer.domElement; const sw = src.width, sh = src.height; const k = Math.min(sw / 160, sh / 100);
      c.getContext('2d').drawImage(src, (sw - 160 * k) / 2, (sh - 100 * k) / 2, 160 * k, 100 * k, 0, 0, 160, 100);
      this.thumbCache = c.toDataURL('image/jpeg', 0.7); this.thumbAt = now;
    } catch { /* keep the old picture */ }
    return this.thumbCache || null;
  }
  /** Save the term in play to a manual slot. */
  saveToSlot(id) {
    if (!this.sim) return { ok: false };
    const r = save.writeSlot(id, this.slotRecord('manual'));
    if (r.ok && r.removed?.length) this.hud.toast(`To make room, removed ${r.removed.map((x) => this.slotLabel(x)).join(', ')}.`, 'info');
    if (!r.ok) this.hud.toast(r.error === 'quota' ? 'Not saved: the browser\'s storage is full. Delete a save and try again.' : 'Not saved: the browser refused to store it.', 'error');
    return r;
  }
  /** opts: { charter, region, termSeed, tutorial, perks, freePlay } */
  startTerm(opts = {}) {
    const m = save.meta();
    const o = { ...opts };
    if (!o.tutorial) { o.unlockedMilestones = m.ownedMilestones; o.termSeed = o.termSeed ?? ((Date.now() % 1e9) | 0); }
    const sim = Sim.newTerm(o);
    this.begin(sim, { fresh: true, opts: o });
    return this.debugState();
  }
  begin(sim, { restored = null, fresh = false, opts = {} } = {}) {
    const G = this.G;
    this.stopCameraModes();
    this.sim = sim; this.playing = true; this.lastTick = -1; this.deadlineDone = false;
    // every term has an id: its autosave slot is 'auto-<id>', and its Merits are banked once (save.markBanked)
    this.termId = restored?.termId || save.newTermId(); this.thumbCache = null; this.hasProgress = !!restored;
    this.termOpts = restored?.opts || opts;
    this.speedIdx = 0; this.paused = false; this.pauseReasons.clear();
    this.tool = 'route'; this.clearRoute(); this.selection = null; this.flow = false; this.xrayUser = false; this.xrayAuto = false;
    this.ride = null; this.cinematic = null; this.prevSpeed = null; this.allClearAt = null; this.rideThrough = null;
    this.plan = null; G.net.setPlanGhost(null); G.net.setHeldCrates([]);
    this.layers = Object.fromEntries(TYPE_ORDER.map((t) => [t, true]));
    for (const t of TYPE_ORDER) G.net.setLayer(t, true);
    G.net.setFlow(false); G.net.useGameTime = true;
    G.net.setLivery(MERITS.liveries.find((x) => x.id === save.meta().livery));
    G.net.showDemo(false);
    G.closeOverlays();
    audio.duck(false); window.gameReport?.resumed?.(); // never start a term with the pause menu's duck still on
    for (const id of ['title', 'charters', 'setup', 'result', 'merit', 'finale']) document.getElementById(id).hidden = true;
    G.screen = 'play';
    G.cam.viewShiftTarget = 0; G.cam.exitFollow(); G.cam.mode = 'orbit'; G.attract = null;
    this.applyXray();
    // city from the term's densities and changed cells
    G.city.buildBuildings(sim.s.densities);
    this.cityState = { demolished: new Uint8Array(642), green: new Uint8Array(642) };
    this.syncCity(false);
    this.syncNetwork();
    const st = sim.state();
    G.net.setPriority(st.priority);
    const start = this.meta.starts[st.region] ?? this.meta.capitalCentre;
    G.cam.jumpTo(V(this.cells[start].pos), 300);
    G.cam.flyTo(V(this.cells[start].pos), 175, 2.2);
    this.hud.enter(st);
    this.story.enter(sim, { tutorial: st.tutorial, restored: !!restored, story: restored?.story });
    if (restored?.plan) this.setPlan(restored.plan); // the planned project is saved with the term
    this.hud.updatePlan();
    audio.playMusic('build');
    // a term saved mid-disaster comes back with its warning (Brace / Reroute) or damage report on screen
    if (restored) { const d = sim.disasters(); if (d?.warning) { this.hud.disasterWarning(); audio.playMusic('disaster'); } else this.hud.disasterRefresh(); }
    this.saveTimer = 0;
    if (fresh) { save.saveMeta({ termsPlayed: (save.meta().termsPlayed || 0) + 1 }); this.saveNow(); }
    this.onResize();
  }
  /** End a Ride or the crossing cinematic without any fly-to or story step (leaving play, pausing, end screens). */
  stopCameraModes() {
    if (this.ride) this.exitRide(true);
    if (this.cinematic) { const first = this.cinematic.first; this.cinematic = null; this.G.net.endCrossing(); this.G.cam.exitFollow(); this.xrayAuto = false; this.applyXray(); this.hud.setCinematic(false); this.hud.caption(null); if (first) this.story.afterCrossing?.(true); }
    this.G.net.riding = false; this.setUnderwater(false); this.hud.setRiding(null); audio.ambience('amb-deep', 0);
  }
  leavePlay() {
    this.stopCameraModes();
    if (!this.playing) return;
    this.playing = false; this.sim = null;
    this.hud.leave(); this.story.leave();
    this.G.net.useGameTime = false; this.G.net.setPriority([]); this.G.net.setGhost(null); this.G.net.setSelected(null);
    this.plan = null; this.G.net.setPlanGhost(null); this.G.net.setHeldCrates([]); this.hud.updatePlan();
    this.G.net.setPin('A', null); this.G.net.setPin('B', null);
    this.G.city.clearOutlines();
    for (let i = 0; i < 642; i++) { if (this.cityState?.demolished[i] || this.cityState?.green[i]) { this.G.city.setCellCleared(i, false, false); this.G.city.setGreen(i, null); this.G.city.tintCell(i, null); } }
    this.G.city.buildBuildings(null);
    this.G.xrayTarget = 0;
    this.G.screen = 'title';
  }
  /** Autosave: the term's own slot (every 30 s, on pause, when the tab hides). A finished term is never saved back. */
  saveNow() {
    if (!this.sim || this.sim.state().termOver || this.metaUi.banked === this.sim) return;
    // no autosave until the term has progress (a build, or a minute played), and never for a term already banked
    if (!this.hasProgress) { if (this.sim.state().time >= 60) this.hasProgress = true; else return; }
    if (save.isBanked(this.termId)) return;
    try {
      const r = save.writeSlot('auto-' + this.termId, this.slotRecord('auto'));
      if (r.ok && r.removed?.length) this.hud.toast(`Autosave limit: removed ${r.removed.map((x) => this.slotLabel(x)).join(', ')}.`, 'info');
      if (!r.ok && (this.saveWarnAt == null || performance.now() - this.saveWarnAt > 60000)) { this.saveWarnAt = performance.now(); this.hud.toast(r.error === 'quota' ? 'Autosave failed: the browser\'s storage is full. Delete old saves (pause menu, Load).' : 'Autosave failed.', 'error'); }
    } catch (e) { console.warn('save failed', e); }
  }
  abandon() {
    const sim = this.sim; if (!sim) return;
    this.metaUi.showTermOver({ reason: 'abandoned' });
  }
  /** Replay Tutorial from a term in progress: the term is autosaved and kept (Continue or Load brings it back). */
  endTermForTutorial() {
    if (!this.sim) return;
    this.saveNow();
    this.leavePlay();
  }
  // tab hidden: save; the pause menu opens unless an end screen is up (openPause refuses then)
  onHidden() { if (this.playing) { this.saveNow(); if (!this.G.overlays.includes('pause')) this.G.openPause(); } }
  overlaysClosed() { this.setPaused(false, 'overlay'); }

  // ------------------------------------------------------------------ time
  setPaused(on, why = 'user') { if (on) this.pauseReasons.add(why); else this.pauseReasons.delete(why); this.hud.updateSpeed(); }
  isPaused() { return this.pauseReasons.size > 0; }
  speed() { return SPEEDS[this.speedIdx]; }
  cycleSpeed() { this.speedIdx = (this.speedIdx + 1) % 3; this.hud.updateSpeed(); audio.sfx('ui-tool'); }
  setSpeedIdx(i) { this.speedIdx = i; this.hud.updateSpeed(); }
  gameTime() { return this.sim ? this.sim.s.update / 30 : 0; }

  fixedUpdate(speed, stepped) {
    if (!this.playing || !this.sim) return;
    if (this.isPaused() && !stepped) return;
    if (this.isPaused() && stepped && this.pauseReasons.has('menu')) return;
    if (this.cinematic?.holdSim) return;
    const n = stepped ? 1 : this.speed();
    for (let i = 0; i < n; i++) {
      if (this.sim.s.termOver) break;
      const stage = this.sim.s.quota.stage;
      this.sim.update();
      // the quota hash, taken right after the tick that meets it (as tools/solve.mjs records it)
      if (this.sim.s.quota.stage !== stage) for (let k = stage; k < this.sim.s.quota.stage; k++) window.__runLog.push({ quota: k + 1, time: this.sim.s.quota.metAt[k], money: Math.round(this.sim.s.money), throughput: Math.round(this.sim.throughput?.() ?? 0), hash: this.sim.hash() });
    }
    this.handleEvents(this.sim.drainEvents());
    const tick = this.sim.s.time;
    if (tick !== this.lastTick) { this.lastTick = tick; this.onTick(); }
  }
  onTick() {
    const sim = this.sim; const st = sim.state();
    if (this.allClearAt != null && this.gameTime() >= this.allClearAt) this.allClear();
    // a Commended term kept going for stars ends at the Audit deadline: show the Commended screen once more, to bank it
    if (st.commendedAt != null && st.deadline != null && st.time >= st.deadline && !this.deadlineDone && !this.G.overlays.includes('result')) {
      this.deadlineDone = true; this.setPaused(true, 'result'); this.metaUi.showCommended();
    }
    // line loads and station fills to the renderer
    const states = new Map();
    const stById = new Map(sim.stations().map((x) => [x.id, x]));
    const tpos = V(this.cells[this.meta.terminal].pos);
    const ang = (sid) => { const x = stById.get(sid); return x ? V(this.cells[x.cell].pos).angleTo(tpos) : 9; };
    for (const l of sim.lines()) {
      const exp = l.linkedToTerminal && (l.flow || 0) > 0 ? (ang(l.a) >= ang(l.b) ? 1 : -1) : 0;
      states.set(l.id, { load: l.load || 0, dim: (!l.open || l.closed || l.broken) ? 1 : 0, stopped: !!(l.broken || l.closed || !l.trains), speedMult: 1, gaps: l.broken?.gaps, exportDir: exp, flow: l.flow || 0 });
    }
    this.G.net.setLineStates(states);
    const fills = new Map();
    for (const s of sim.stations()) if (s.capacity && isFinite(s.capacity)) fills.set(s.id, Math.min(1, (s.transferFlow || 0) / s.capacity));
    this.G.net.setStationFill(fills);
    // turned-away riders float over their station (flow overlay)
    this.lastTurned = this.lastTurned || new Map();
    if (this.flow && st.time % 3 === 0) for (const x of sim.stations()) {
      const prev = this.lastTurned.get(x.id) ?? x.turnedAway; const dlt = Math.round((x.turnedAway || 0) - prev);
      this.lastTurned.set(x.id, x.turnedAway || 0);
      if (dlt > 0 && x.kind !== 'core') this.hud.popup(V(x.pos), `−${dlt} turned away`, 'bad');
    }
    // the planned project: its card is dealt again every 5 s (price, exports), its chip every tick; held crates every 2 s
    if (this.plan && st.time % 5 === 0) this.refreshPlan();
    if (st.time % 2 === 0 && !this.cinematic) this.updateCrates();
    this.lastMoney = st.money;
    this.hud.tick(st);
    this.story.tick(st);
    this.saveTimer = (this.saveTimer || 0) + 1;
    if (this.saveTimer >= 30) { this.saveTimer = 0; this.saveNow(); }
    if (st.termOver && !this.ended) { this.ended = true; }
  }
  /** Money pop-ups at the stations where trips arrived (at most 3 a second). */
  deliveryPops(list) {
    const top = list.filter((d) => d.fare > 0.5).sort((a, b) => b.fare - a.fare || a.station - b.station).slice(0, 3);
    if (!top.length) return;
    const st = new Map(this.sim.stations().map((x) => [x.id, x]));
    for (const d of top) { const x = st.get(d.station); if (x && x.kind !== 'core') this.hud.popup(V(x.pos), fmtMoney(d.fare, { sign: true })); }
    audio.sfx('money-chime', { minGap: 0.34, gain: 0.5 });
  }
  moneyPops(amount) {
    const busy = this.sim.stations().filter((s) => s.kind !== 'core' && (s.lines?.length)).sort((a, b) => (b.transferFlow + b.waiting) - (a.transferFlow + a.waiting) || a.id - b.id).slice(0, 6);
    if (!busy.length) return;
    const n = Math.min(3, busy.length);
    for (let i = 0; i < n; i++) {
      const s = busy[(this.sim.s.time + i) % busy.length];
      this.hud.popup(V(s.pos), fmtMoney(amount / n, { sign: true }));
    }
    audio.sfx('money-chime', { minGap: 0.34, gain: 0.5 });
  }

  // ------------------------------------------------------------------ events from the sim
  handleEvents(evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'built': this.onBuilt(e); break;
        case 'departure': this.G.net.departure(); audio.sfx('warp-spinup', { minGap: 15 }); setTimeout(() => audio.sfx('depart-deep', { minGap: 15 }), 900); setTimeout(() => { this.G.net.returnSparkle(); if (this.playing) audio.sfx('warp-return', { minGap: 20, gain: 0.7 }); }, 6000); this.story.onDeparture(e); break;
        case 'quota': this.onQuota(e); break;
        case 'milestone': this.hud.milestoneDone(e); audio.sfx('milestone-flip'); break;
        case 'disasterWarning': this.onDisasterWarning(e); break;
        case 'disasterHit': this.onDisasterHit(e); break;
        case 'disasterSkipped': this.hud.disasterClear(); break;
        case 'disasterCancelled': {
          // a tech bought during the warning cancels it (Heat Shielding, Tunnel Bracing, Warp Anchor)
          this.hud.disasterClear();
          const tech = TECH.find((t) => t.id === e.by)?.name || 'A new tech'; const dn = DISASTERS[e.disaster]?.name || 'disaster';
          this.hud.toast(`${tech}: the ${dn} is cancelled.`, 'good');
          this.allClear(); break;
        }
        case 'repaired': audio.sfx('repair-clank'); this.syncNetwork(); this.hud.disasterRefresh(); break;
        case 'debtWarning': audio.sfx('dis-siren', { rate: 0.7 }); this.hud.toast('Below the debt limit! Sell trains or close a line within 60 s, or the term ends.', 'warning'); break;
        case 'overtime': audio.sfx('overtime-chime'); this.hud.toast('The Audit deadline has passed: Overtime! 15 minutes to reach Quota III.', 'warning'); break;
        case 'termOver': this.onTermOver(e); break;
        case 'action': break;
        case 'deliveries': this.deliveryPops(e.list || []); break;
        default: break;
      }
    }
  }
  onBuilt(e) {
    this.hasProgress = true;
    this.syncNetwork({ grow: e.lines });
    this.syncCity(true);
    audio.sfx('build-rail-grow'); audio.sfx('build-confirm', { gain: 0.8 });
    if (e.stations?.length) audio.sfx('build-station', { gain: 0.7 });
    const first = e.lines?.[0]; const l = first != null && this.sim.lines().find((x) => x.id === first);
    if (l) setTimeout(() => audio.sfx('depart-' + l.type, { minGap: 1 }), 900);
    if (e.firstCrossing) this.startCrossingCinematic(e);
    this.story.onBuilt(e);
    if (this.plan) this.refreshPlan();
    if (!this.cinematic) this.updateCrates();
  }
  onQuota(e) {
    this.hud.quotaMet(e);
    this.story.onQuota(e);
    // free play has no Commended screen (the sim's quota event says whether this one commends the Charter)
    if (e.quota === 3) { audio.playMusic('fanfare', { once: true, after: 'busy' }); if (e.commended !== false) this.metaUi.charterCommended(); }
    else { audio.sfx('quota-sting'); if (e.quota === 2) audio.playMusic('busy'); }
    this.G.net.beam(true, true);
  }
  onDisasterWarning(e) {
    if (this.speedIdx > 0) { this.prevSpeed = this.speedIdx; this.setSpeedIdx(0); }
    audio.sfx('dis-siren'); audio.playMusic('disaster');
    this.hud.disasterWarning(e);
  }
  onDisasterHit(e) {
    const sfx = { meteor: 'dis-meteor', seaquake: 'dis-seaquake', caveIn: 'dis-cavein', coreFlare: 'dis-flare', solarStorm: 'dis-solar', blackout: 'dis-blackout', warpDrift: 'dis-warp-drift' }[e.disaster];
    if (sfx) audio.sfx(sfx);
    this.G.cam.addShake(0.8);
    this.syncNetwork();
    this.hud.disasterHit(e);
    // all clear 30 s of game time later (onTick), so pausing or speeding up doesn't desync it
    this.allClearAt = this.gameTime() + 30;
  }
  allClear() {
    this.allClearAt = null;
    if (this.prevSpeed != null) { this.setSpeedIdx(this.prevSpeed); this.prevSpeed = null; }
    audio.sfx('all-clear'); audio.playMusic(this.sim.state().quotaStage >= 2 ? 'busy' : 'build');
  }
  onTermOver(e) {
    audio.sfx('term-over');
    this.metaUi.showTermOver(e);
  }

  // ------------------------------------------------------------------ syncing view with the sim
  syncNetwork({ grow = null } = {}) {
    const sim = this.sim; if (!sim) return;
    const stations = sim.stations().map((s) => ({ ...s, terminal: s.kind === 'terminal', core: s.kind === 'core' }));
    const lines = sim.lines().map((l) => {
      const ls = sim.lineSamples(l.id);
      return { id: l.id, type: l.type, samples: toArr(ls.samples), trains: l.trains, cars: l.cars, load: l.load || 0, dim: (!l.open || l.closed || l.broken) ? 1 : 0, stopped: !!(l.broken || l.closed || !l.trains), a: l.a, b: l.b, shaft: l.shaft, born: -10 };
    });
    const walkways = sim.walkways().map((w) => ({ a: w.a, b: w.b, samples: w.geo ? toArr(w.geo.samples) : null }));
    const wells = sim.stationWells().map((w) => [w.from, w.to]);
    this.G.net.setNetwork({ stations, lines, walkways, wells });
    if (grow) this.G.net.growLines(grow, this.G.renderTime);
    this.G.net.setPolarRing(!!sim.s.tech?.polarRing);
    this.netVersion++;
    this.trainCache.clear();
    this.onTick && this.lastTick >= 0 && this.G.net.setLineStates(new Map(sim.lines().map((l) => [l.id, { load: l.load || 0, dim: (!l.open || l.closed || l.broken) ? 1 : 0, stopped: !!(l.broken || l.closed || !l.trains), gaps: l.broken?.gaps }])));
    if (this.selection?.kind === 'line' && !lines.find((l) => l.id === this.selection.id)) this.select(null);
    if (this.selection?.kind === 'station' && !stations.find((s) => s.id === this.selection.id)) this.select(null);
    this.hud.refreshPanel();
  }
  syncCity(animate) {
    const s = this.sim.s; const city = this.G.city; const cs = this.cityState;
    for (let i = 0; i < 642; i++) {
      const dem = s.demolished[i] ? 1 : 0; const gr = s.green[i] || 0;
      if (dem !== cs.demolished[i]) {
        city.setCellCleared(i, !!dem, animate);
        if (dem && animate) audio.sfx('build-demolish', { minGap: 0.3 });
        cs.demolished[i] = dem;
        if (!gr) city.tintCell(i, dem ? '#3a3c44' : null, dem ? 0.55 : 0);
      }
      if (gr !== cs.green[i]) {
        city.setGreen(i, gr === 1 ? 'grove' : gr >= 2 ? 'park' : null);
        if (!gr) city.tintCell(i, cs.demolished[i] ? '#3a3c44' : null, 0.55);
        if (gr && animate) audio.sfx('build-bloom');
        cs.green[i] = gr;
      }
    }
    // attractions: wheel and monument models; fountain drawn as a park with a plaza
    this.G.net.setAttractions?.(s.attractions || []);
  }
  reapplyCityState() {
    if (!this.sim) return;
    this.cityState = { demolished: new Uint8Array(642), green: new Uint8Array(642) };
    this.syncCity(false);
  }
  densities() { return this.sim?.s.densities ?? null; }
  densityOf(id) { return this.sim?.s.densities?.[id] ?? this.cells[id].density; }
  trainsFor(id) {
    if (!this.sim) return null;
    const key = id;
    if (this.trainCacheAt !== this.sim.s.update) { this.trainCache.clear(); this.trainCacheAt = this.sim.s.update; }
    let v = this.trainCache.get(key); if (!v) { v = this.sim.trains(id); this.trainCache.set(key, v); }
    return v;
  }

  // ------------------------------------------------------------------ X-ray, flow, layers
  setXray(on) {
    // V toggles what the player sees: when X-ray came on by itself (route pin), V turns it off
    if (on == null && this.xrayAuto && !this.xrayUser && !this.ride && !this.cinematic) this.xrayAuto = false;
    else this.xrayUser = on == null ? !this.xrayUser : !!on;
    this.applyXray(); audio.sfx('ui-tool'); this.hud.updateToggles(); if (this.xrayUser) this.story.interim?.('xray'); return this.xrayUser; }
  applyXray() { this.G.xrayTarget = (this.xrayUser || this.xrayAuto) ? 1 : 0; }
  setFlow(on) { this.flow = on == null ? !this.flow : !!on; this.G.net.setFlow(this.flow); audio.sfx('ui-tool'); this.hud.updateToggles(); this.story.onFlow?.(this.flow); }
  toggleLayer(t) { this.layers[t] = !this.layers[t]; this.G.net.setLayer(t, this.layers[t]); this.hud.updateToggles(); audio.sfx('ui-tool'); }

  // ------------------------------------------------------------------ tools
  setTool(t) {
    if (!this.story.toolAllowed(t)) return;
    if (this.tool === t && t !== 'route') t = 'route';
    this.tool = t; this.clearRoute();
    this.G.city.clearOutlines('tool');
    this.G.city.outlineCells('tool-hover', null); this.hud.tooltip(-1, -1, null); // the old tool's hover tip goes with it
    if (t === 'station') this.stationKind = this.stationKind || 'surface';
    if (t === 'green') this.greenKind = this.greenKind || 'park';
    audio.sfx('ui-tool');
    this.hud.updateTool();
    this.outlineToolTargets();
  }
  outlineToolTargets() {
    const sim = this.sim; if (!sim) return;
    if (this.tool === 'green') {
      const cells = sim.cells((c) => c.demolished && !c.green && !(c.stations?.length)).map((c) => c.id);
      this.G.city.outlineCells('tool-green', cells, '#7aa84a', { opacity: 0.8 });
    } else this.G.city.outlineCells('tool-green', null);
    // Station tool: light every cell where the chosen kind can go (nothing when that kind is still locked)
    if (this.tool === 'station') {
      const k = this.stationKind || 'surface';
      const cells = sim.stationLayerLocked?.(k) ? [] : this.cells.filter((c) => !sim.placeStationBlock(c.id, k)).map((c) => c.id);
      this.G.city.outlineCells('tool-station', cells.length ? cells : null, TYPE_COLORS[k], { opacity: 0.75 });
    } else this.G.city.outlineCells('tool-station', null);
  }
  clearRoute() {
    this.route = { a: null, b: null, cards: null, hi: -1 };
    this.G.net.setPin('A', null); this.G.net.setPin('B', null); this.G.net.setGhost(null);
    this.G.city.outlineCells('demolish-preview', null);
    if (this.xrayAuto && !this.cinematic && !this.ride) { this.xrayAuto = false; this.applyXray(); }
    this.hud.closeCards();
    this.hud.updateRouteBanner();
  }
  /** A place: { station } or a cell id → world position for the pin. */
  placePos(place) {
    if (place == null) return null;
    if (typeof place === 'object' && place.station != null) {
      const s = this.sim.stations().find((x) => x.id === place.station); if (!s) return null;
      if (s.kind === 'terminal') return V(this.cells[s.cell].pos).multiplyScalar(R + 2);
      return V(s.pos).add(V(s.pos).normalize().multiplyScalar(1.5));
    }
    const c = this.cells[typeof place === 'object' ? place.cell : place];
    const r = c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS ? R : c.ground;
    return V(c.pos).multiplyScalar(r + 0.5);
  }
  placeLabel(place) {
    if (place == null) return '';
    if (typeof place === 'object' && place.station != null) {
      const s = this.sim.stations().find((x) => x.id === place.station);
      return s ? this.stationName(s) : 'Station';
    }
    return this.cellLabel(typeof place === 'object' ? place.cell : place);
  }
  // names (names.js, through the sim so same-named stations and lines get their " 2", " 3")
  stationName(s) {
    if (s == null) return 'Station';
    if (typeof s === 'number') s = this.sim?.stations().find((x) => x.id === s);
    if (!s) return 'Station';
    if (s.kind === 'terminal') return 'Warp Terminal';
    if (s.name) return s.name;
    try { return this.sim.stationName(s.id); } catch { return 'Station ' + s.id; }
  }
  lineName(l) {
    if (l == null) return 'Line';
    if (typeof l === 'object' && l.name) return l.name;
    const id = typeof l === 'object' ? l.id : l;
    try { return this.sim.lineName(id); } catch { return 'Line ' + id; }
  }
  cellName(id) { return names.cellName(id); }
  /** A cell with its region, unless the name is the region's own start (route banner, cards). */
  cellLabel(id) {
    const n = names.cellName(id); const c = this.cells[id]; const r = REGIONS[c.areaId]?.name;
    return !r || id === this.meta.terminal || n === r || Object.values(this.meta.starts).includes(id) ? n : n + ' · ' + r;
  }

  routeTap(place) {
    const r = this.route;
    if (r.a == null) {
      r.a = place; this.G.net.setPin('A', this.placePos(place));
      // X-ray stays the player's choice (V): far-side stations show as HUD markers while choosing B
      audio.sfx('ui-click');
      this.hud.updateRouteBanner();
      this.story.onPinA?.(place);
      return;
    }
    if (samePlace(r.a, place)) { this.clearRoute(); if (place.station != null) this.select({ kind: 'station', id: place.station }); return; }
    r.b = place; this.G.net.setPin('B', this.placePos(place));
    const t0 = performance.now();
    r.cards = this.sim.routeCards(r.a, r.b);
    this.cardsMs = performance.now() - t0;
    r.hi = -1;
    audio.sfx('ui-click');
    this.hud.openCards(r.cards);
    this.hud.updateRouteBanner();
    this.story.onCards?.(r.cards);
    // frame both ends
    const pa = this.placePos(r.a), pb = this.placePos(r.b);
    const mid = pa.clone().normalize().add(pb.clone().normalize()); if (mid.lengthSq() < 0.01) mid.copy(pa).normalize();
    const ang = pa.angleTo(pb);
    this.G.cam.flyTo(mid.normalize(), Math.min(ZOOM.max - 20, 170 + ang * 130), 0.9);
  }
  highlightCard(i) {
    const r = this.route; if (!r.cards) return;
    r.hi = i; const c = r.cards[i];
    this.G.net.setGhost(c?.preview?.length ? c.preview.map((p) => ({ type: p.type, samples: toArr(p.samples) })) : null);
    this.G.city.outlineCells('demolish-preview', c?.demolishCells?.length ? c.demolishCells : null, '#ff5a6e', { pulse: true });
    this.hud.highlightCard(i);
  }
  buildCard(i) {
    const r = this.route; const c = r.cards?.[i];
    if (!c) return;
    if (!c.feasible) { audio.sfx('ui-error'); if (c.locked && c.lockTech) this.hud.openTech(c.lockTech); return; }
    if (!this.story.cardAllowed(c)) { audio.sfx('ui-error'); return; }
    const res = this.sim.act({ type: 'buildRoute', a: r.a, b: r.b, kind: c.kind });
    if (!res.ok) { audio.sfx('ui-error'); this.hud.toast(res.reason || 'Can\'t build that.', 'error'); return; }
    if (this.plan && this.plan.kind === c.kind && samePlace(this.plan.a, r.a) && samePlace(this.plan.b, r.b)) this.setPlan(null);
    this.handleEvents(this.sim.drainEvents());
    this.hud.spent(res.cost);
    this.hud.showUndo();
    this.clearRoute();
    this.select(null);
    this.story.afterBuild?.(c, res);
  }

  // ------------------------------------------------------------------ Plan it (one planned project; the sim reserves nothing)
  /** Pin route card i as the planned project: its ghost stays drawn and the HUD chip counts the money down. */
  planCard(i) {
    const r = this.route; const c = r.cards?.[i];
    if (!c?.feasible) { audio.sfx('ui-error'); return; }
    const replaced = !!this.plan;
    this.setPlan({ a: r.a, b: r.b, kind: c.kind }, c);
    audio.sfx('build-confirm', { gain: 0.5 });
    this.clearRoute(); this.select(null);
    if (replaced || !this.story.tut) this.hud.toast(replaced ? 'Plan replaced: one planned project at a time.' : 'Planned. The chip shows the price and the wait; it turns gold when you can build.', 'info');
    this.showPlan();
    this.story.onPlan?.(this.plan);
  }
  /** Set (or clear, with null) the planned project. `card` is its dealt card, if at hand; else it is dealt now. */
  setPlan(p, card = null) {
    this.plan = p ? { a: p.a, b: p.b, kind: p.kind, at: p.at ?? this.sim?.s.time ?? 0, card } : null;
    if (this.plan && !card) this.refreshPlan(); else this.applyPlan();
  }
  refreshPlan() {
    const p = this.plan; if (!p || !this.sim) return;
    let cards = []; try { cards = this.sim.routeCards(p.a, p.b); } catch { cards = []; }
    p.card = cards.find((c) => c.kind === p.kind) || null;
    this.applyPlan();
  }
  applyPlan() {
    const c = this.plan?.card;
    this.G.net.setPlanGhost(c?.feasible && c.preview?.length ? c.preview.map((q) => ({ type: q.type, samples: toArr(q.samples) })) : null);
    this.hud.updatePlan();
  }
  /** The plan chip's Build: the same action as the card's Build. */
  buildPlan() {
    const p = this.plan; if (!p || !this.sim || this.cinematic) return;
    this.refreshPlan(); const c = p.card;
    if (!c?.feasible) { audio.sfx('ui-error'); this.hud.toast(c?.reason || c?.line || 'That route can\'t be built now.', 'error'); return; }
    if (!this.story.cardAllowed(c)) { audio.sfx('ui-error'); return; }
    const res = this.sim.act({ type: 'buildRoute', a: p.a, b: p.b, kind: p.kind });
    if (!res.ok) { audio.sfx('ui-error'); this.hud.toast(res.reason || 'Can\'t build that yet.', 'error'); return; }
    this.setPlan(null);
    this.clearRoute(); this.select(null);
    this.handleEvents(this.sim.drainEvents());
    this.hud.spent(res.cost);
    this.hud.showUndo();
  }
  cancelPlan() { if (!this.plan) return; this.setPlan(null); audio.sfx('ui-cancel'); this.updateCrates(); this.story.onPlan?.(null); }
  /** Frame the planned route (the chip's name). */
  showPlan() {
    const p = this.plan; if (!p) return;
    const pa = this.placePos(p.a), pb = this.placePos(p.b); if (!pa || !pb) return;
    const mid = pa.clone().normalize().add(pb.clone().normalize()); if (mid.lengthSq() < 0.01) mid.copy(pa).normalize();
    this.G.cam.flyTo(mid.normalize(), Math.min(ZOOM.max - 20, 190 + pa.angleTo(pb) * 130), 1.0);
  }
  /**
   * Held exports (cosmetic): while a planned project (or the tutorial's crossing step) waits on the Terminal, crates
   * stack beside every station that can't reach it yet, a crate every 15 s; a station that gets linked pours them in.
   */
  updateCrates() {
    const sim = this.sim; if (!sim) return;
    const t = sim.s.time; const since = this.plan?.card?.exportsGain > 0 ? this.plan.at : this.story.cratesSince?.();
    const all = sim.stations();
    const list = since == null ? [] : all.filter((s) => s.kind !== 'terminal' && s.kind !== 'core' && s.lines?.length && !s.linkedToTerminal)
      .map((s) => ({ station: s.id, n: Math.max(1, Math.min(8, 1 + Math.floor((t - since) / 15))) }));
    const gone = this.G.net.setHeldCrates(list);
    const linked = gone.filter((r) => all.find((s) => s.id === r.station)?.linkedToTerminal);
    if (linked.length) this.G.net.pourCrates(linked);
    return linked;
  }

  act(action, okSound = null) {
    if (!this.sim) return { ok: false };
    const res = this.sim.act(action);
    if (!res.ok) { audio.sfx('ui-error'); if (res.reason) this.hud.toast(res.reason, 'error'); return res; }
    if (okSound) audio.sfx(okSound);
    this.handleEvents(this.sim.drainEvents());
    if (['addTrain', 'removeTrain', 'upgradeInterchange', 'placeStation', 'closeLine', 'openLine', 'repair', 'repairAll', 'buyTech', 'undo', 'brace', 'reroute', 'coolant', 'restorePower'].includes(action.type)) this.syncNetwork();
    if (['demolish', 'green', 'undo', 'placeStation'].includes(action.type)) { this.syncCity(true); this.outlineToolTargets(); }
    if (res.cost) this.hud.spent(res.cost);
    const undoLabel = { placeStation: 'Station placed.', demolish: 'Demolished.', green: 'Planted.', upgradeInterchange: 'Upgraded.' }[action.type];
    if (undoLabel) this.hud.showUndo(undoLabel);
    this.hud.tick(this.sim.state()); this.hud.refreshPanel();
    this.story.onAction?.(action, res);
    return res;
  }
  undo() {
    const u = this.sim?.state().undo; if (!u) { audio.sfx('ui-error'); return; }
    const res = this.act({ type: 'undo' });
    if (res.ok) { audio.sfx('build-rail-grow', { reverse: true }); this.hud.toast('Undone: full refund.', 'info'); this.hud.hideUndo(); }
  }

  select(sel) {
    this.selection = sel;
    this.G.net.setSelected(sel ? (sel.kind === 'line' ? { line: sel.id } : sel.kind === 'station' ? { station: sel.id } : null) : null);
    this.G.city.outlineCells('select', sel?.kind === 'cell' ? [sel.id] : null, '#ffd9a0');
    this.hud.showSelection(sel);
  }
  flyToSelection(sel) {
    if (!sel) return;
    if (sel.kind === 'cell') return this.flyToCell(sel.id);
    if (sel.kind === 'station') { const s = this.sim.stations().find((x) => x.id === sel.id); if (s) this.flyToCell(s.cell); return; }
    if (sel.kind !== 'line') return;
    // a line: the middle of its two ends (a chord's own middle is underground, a core chord's near the centre)
    const ls = this.sim.lineSamples(sel.id); if (!ls) return;
    const a = new THREE.Vector3(ls.samples[0], ls.samples[1], ls.samples[2]).normalize(), b = new THREE.Vector3(...ls.samples.slice((ls.count - 1) * 3, ls.count * 3)).normalize();
    let p = a.clone().add(b); if (p.lengthSq() < 0.01) { const mid = Math.floor(ls.count / 2); p = new THREE.Vector3(ls.samples[mid * 3], ls.samples[mid * 3 + 1], ls.samples[mid * 3 + 2]); }
    if (p.lengthSq() < 1e-6) p = a.clone();
    // never closer than a district overview, looking down (a fly-to never parks the camera inside a mountain)
    this.G.cam.flyTo(p.normalize(), Math.min(ZOOM.max - 20, 205 + a.angleTo(b) * 150), 0.9, { topDown: true });
  }
  /** Fly to a cell (Places, warnings): a fixed overview distance, top-down; a little higher over mountains and peaks. */
  flyToCell(id, d = null) {
    const c = this.cells[id];
    const high = c.terrain === TERRAIN.MOUNTAIN || c.peak;
    this.G.cam.flyTo(V(c.pos), Math.max(d ?? 0, high ? 230 : 205), 1.0, { topDown: true });
  }

  // ------------------------------------------------------------------ picking
  /** Screen position of a world point, and whether it's visible (in front, on screen, not occluded). */
  screenOf(p, { sphere = R, skipOcclusion = false } = {}) {
    const cam = this.G.camera; const v = p.clone().project(cam);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    const front = v.z < 1 && v.z > -1;
    let vis = front && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
    if (vis && !skipOcclusion) vis = !occluded(cam.position, p, sphere);
    return { x, y, visible: vis };
  }
  xrayOn() { return this.G.xrayTarget > 0.5; }
  pickAt(x, y) {
    const net = this.G.net; const xr = this.xrayOn();
    // stations within 24 px
    let best = null, bd = 24;
    for (const mk of net.markers || []) {
      if (!net.layerOn(mk.layer)) continue;
      const inside = mk.inside; if (inside && !xr) continue;
      const sp = this.screenOf(mk.pick || mk.pos, { sphere: mk.water ? 94 : R, skipOcclusion: inside && xr });
      if (!sp.visible) continue;
      const d = Math.hypot(sp.x - x, sp.y - y); if (d < bd) { bd = d; best = { kind: 'station', id: mk.id }; }
    }
    if (best) return best;
    // while route end A is pinned, a click picks a place (station or cell), never a line
    if (this.tool === 'route' && this.route.a != null) { const cell = this.cellAt(x, y); return cell != null ? { kind: 'cell', id: cell } : null; }
    // rail samples within 16 px
    bd = 16;
    for (const s of net.pickSamples()) {
      const inside = s.type === 'earth' || s.type === 'fire';
      if (inside && !xr) continue;
      const p = V(s.p);
      const sp = this.screenOf(p, { sphere: s.type === 'water' ? 94 : R, skipOcclusion: inside && xr });
      if (!sp.visible) continue;
      const d = Math.hypot(sp.x - x, sp.y - y); if (d < bd) { bd = d; best = { kind: 'line', id: s.line, sample: s.sample }; }
    }
    // outside X-ray, an underground line is picked on its surface trace
    if (!xr) for (const s of net.traceSamples2()) {
      const sp = this.screenOf(V(s.p)); if (!sp.visible) continue;
      const d = Math.hypot(sp.x - x, sp.y - y); if (d < bd) { bd = d; best = { kind: 'line', id: s.line, trace: true }; }
    }
    if (best) return best;
    const cell = this.cellAt(x, y);
    return cell != null ? { kind: 'cell', id: cell } : null;
  }
  cellAt(x, y) {
    const cam = this.G.camera; const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), cam);
    const nearest = (n) => { let best = -1, bd = -2; for (const c of this.cells) { const d = n.x * c.pos[0] + n.y * c.pos[1] + n.z * c.pos[2]; if (d > bd) { bd = d; best = c.id; } } return best; };
    // Mountains stand up to 12 units above the sphere: march the ray down through that shell so a click on a
    // peak or slope picks the cell drawn there, not the cell behind it where the ray meets radius 100.
    {
      const top = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R + 13), new THREE.Vector3());
      if (top) {
        const t0 = top.distanceTo(ray.ray.origin);
        const low = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R), new THREE.Vector3());
        const t1 = low ? low.distanceTo(ray.ray.origin) : t0 + 2 * Math.sqrt(Math.max(0, (R + 13) ** 2 - ray.ray.distanceSqToPoint(new THREE.Vector3())));
        const p = new THREE.Vector3(); const N = 64;
        for (let i = 0; i <= N; i++) {
          ray.ray.at(t0 + (t1 - t0) * (i / N), p);
          const len = p.length(); const id = nearest(p.clone().divideScalar(len)); const c = this.cells[id];
          if (len <= (c.terrain === TERRAIN.MOUNTAIN ? c.ground : R) + 0.01) return id;
        }
      }
    }
    const hit = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R), new THREE.Vector3());
    if (!hit) return null;
    return nearest(hit.normalize());
  }
  /** Debug hook: project a cell id, {station}, or {line, sample}. */
  project(t) {
    let p, opts = {};
    if (typeof t === 'number') { const c = this.cells[t]; p = V(c.pos).multiplyScalar(c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS ? R : c.ground); opts.sphere = R - 0.05; }
    else if (t?.station != null) {
      const mk = this.G.net.markers?.find((m) => m.id === t.station && !m.sky) || this.G.net.markers?.find((m) => m.id === t.station);
      if (!mk) return null; p = mk.pick || mk.pos; opts.sphere = mk.water ? 94 : R; if (mk.inside) { if (!this.xrayOn()) return { ...xy(this.screenOf(p, opts)), visible: false }; opts.skipOcclusion = true; }
    } else if (t?.line != null) {
      p = this.G.net.sampleOf(t.line, t.sample || 0); if (!p) return null;
      const l = this.G.net.lineById.get(t.line); opts.sphere = l?.type === 'water' ? 94 : R;
      if (l && (l.type === 'earth' || l.type === 'fire')) { if (!this.xrayOn()) return { ...xy(this.screenOf(p, opts)), visible: false }; opts.skipOcclusion = true; }
    } else return null;
    const sp = this.screenOf(p, opts);
    if (sp.visible) { const el = document.elementFromPoint(sp.x, sp.y); if (el && el !== this.G.renderer.domElement && !el.closest?.('.hud-marker')) sp.visible = false; }
    return { x: Math.round(sp.x), y: Math.round(sp.y), visible: sp.visible };
  }

  // ------------------------------------------------------------------ input
  // returns true when the input was used up (leaving a ride, or a skip key ending the cinematic), so it does nothing else;
  // any other key that skips the cinematic still does its own job
  anyInput(kind, code) {
    if (this.ride && kind === 'key' && (code === 'Enter' || code === 'NumpadEnter') && this.rideThrough) { this.rideOnThrough(); return true; }
    if (this.ride && kind !== 'none') { this.exitRide(); return true; }
    if (this.cinematic && this.cinematic.skippable && kind === 'key') { this.endCinematic(); return ['Escape', 'Space', 'Enter'].includes(code); }
    return false;
  }
  tap(x, y, button) {
    if (!this.playing || this.cinematic) return;
    if (this.ride) { this.exitRide(); return; }
    const pick = this.pickAt(x, y);
    this.story.onTap?.(pick);
    if (this.tool === 'route') {
      if (!pick) return;
      if (pick.kind === 'line') { this.clearRoute(); this.select({ kind: 'line', id: pick.id }); audio.sfx('ui-click'); return; }
      const place = pick.kind === 'station' ? { station: pick.id } : pick.id;
      if (this.route.b != null) { this.clearRoute(); }
      if (pick.kind === 'station' && this.route.a == null) this.select({ kind: 'station', id: pick.id });
      else if (pick.kind === 'cell' && this.route.a == null) this.select({ kind: 'cell', id: pick.id });
      this.routeTap(place);
    } else if (this.tool === 'demolish') {
      // cell tools act on the cell under the pointer, even under a rail or beside a station
      const cell = this.cellAt(x, y); if (cell != null) this.act({ type: 'demolish', cell });
    } else if (this.tool === 'green') {
      const cell = this.cellAt(x, y);
      if (cell != null) this.act(this.greenKind === 'attraction' ? { type: 'green', cell, kind: 'attraction', look: this.greenLook || 'wheel' } : { type: 'green', cell, kind: this.greenKind });
    } else if (this.tool === 'station') {
      if (pick?.kind === 'cell' || pick?.kind === 'station') {
        const cell = pick.kind === 'cell' ? pick.id : this.sim.stations().find((s) => s.id === pick.id)?.cell;
        if (cell != null) this.act({ type: 'placeStation', cell, layer: this.stationKind }, 'build-station');
      }
    }
  }
  rightClick() { this.cancel(); }
  dragStart(x, y, b) { if (this.tool === 'demolish' && b === 0) { this.demoDrag = new Set(); this.addDragCell(x, y); return; } }
  drag(dx, dy, x, y, b) {
    if (this.ride) { this.exitRide(); return true; }
    if (this.cinematic) return true;
    if (this.demoDrag) { this.addDragCell(x, y); return true; }
    return false;
  }
  addDragCell(x, y) {
    const c = this.cellAt(x, y); if (c == null) return;
    const cc = this.sim.cells((q) => q.id === c)[0];
    if (cc && !cc.demolished && (cc.terrain === 'city' || cc.terrain === 'mountain') && !cc.peak && !(cc.stations?.length)) this.demoDrag.add(c);
    const total = [...this.demoDrag].reduce((s, id) => s + (this.sim.cells((q) => q.id === id)[0]?.demolitionPrice || 0), 0);
    this.G.city.outlineCells('tool-drag', [...this.demoDrag], '#ff5a6e', { pulse: true });
    this.hud.tooltip(x, y, `Demolish ${this.demoDrag.size} · ${fmtMoney(total)}`);
  }
  dragEnd() {
    if (this.demoDrag) {
      const cells = [...this.demoDrag]; this.demoDrag = null;
      this.G.city.outlineCells('tool-drag', null); this.hud.tooltip(-1, -1, null);
      if (cells.length) this.act({ type: 'demolish', cells });
    }
  }
  hover(x, y) {
    if (!this.playing || this.ride) return;
    if (x < 0) { this.hud.tooltip(-1, -1, null); return; }
    if (this.tool === 'demolish' || this.tool === 'green' || this.tool === 'station') {
      const c = this.cellAt(x, y);
      if (c == null) { this.hud.tooltip(-1, -1, null); return; }
      const cc = this.sim.cells((q) => q.id === c)[0];
      this.G.city.outlineCells('tool-hover', [c], this.tool === 'demolish' ? '#ff5a6e' : this.tool === 'green' ? '#7aa84a' : '#e3ecf7');
      let tip = '';
      if (this.tool === 'demolish') tip = cc.demolished ? 'Already cleared' : cc.stations?.length ? 'Has a station' : cc.terrain === 'city' || cc.terrain === 'mountain' ? `Demolish: ${fmtMoney(cc.demolitionPrice)} (density ${cc.density})` : 'Nothing to demolish';
      if (this.tool === 'green') { const g = GREEN[this.greenKind]; tip = cc.stations?.length ? 'A station stands here' : cc.demolished && !cc.green ? `${this.greenKind === 'attraction' ? 'Attraction' : this.greenKind === 'park' ? 'Park' : 'Tree grove'}: ${fmtMoney(g.price * (CHARTERS[this.sim.s.charter]?.price || 1))}` : 'Green needs a cleared district'; }
      if (this.tool === 'station') tip = `${this.stationKind[0].toUpperCase() + this.stationKind.slice(1)} station here`;
      if (!this.demoDrag) this.hud.tooltip(x, y, tip);
    } else { this.G.city.outlineCells('tool-hover', null); this.hud.tooltip(-1, -1, null); }
  }
  cancel() {
    if (this.ride) { this.exitRide(); return true; }
    if (this.route.a != null) { this.clearRoute(); audio.sfx('ui-cancel'); return true; }
    if (this.tool !== 'route') { this.setTool('route'); return true; }
    if (this.hud.closeTopPanel()) { audio.sfx('ui-cancel'); return true; }
    if (this.selection) { this.select(null); audio.sfx('ui-cancel'); return true; }
    return false;
  }

  key(e) {
    if (!this.playing) return false;
    if (this.cinematic) { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { this.endCinematic(); return true; } return true; }
    if (this.G.overlays.length) {
      if (this.G.overlays.includes('tech') && (e.code === 'KeyT' || e.code === 'Escape')) { this.hud.closeTech(); return true; }
      return false;
    }
    const k = e.code, sh = e.shiftKey, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'KeyZ') { this.undo(); return true; }
    if (ctrl) return false;
    if (sh && /^Digit[1-7]$/.test(k)) { this.toggleLayer(TYPE_ORDER[+k.slice(5) - 1]); return true; }
    const cam = this.G.cam;
    switch (k) {
      case 'Escape': if (this.cancel()) return true; this.G.openPause(); return true;
      case 'KeyP': this.G.openPause(); return true;
      case 'ArrowLeft': case 'KeyA': if (this.ride) this.exitRide(); cam.spin(0, -5); return true;
      case 'ArrowRight': case 'KeyD': if (this.ride) this.exitRide(); cam.spin(0, 5); return true;
      case 'ArrowUp': case 'KeyW': if (this.ride) this.exitRide(); cam.spin(5, 0); return true;
      case 'ArrowDown': case 'KeyS': if (this.ride) this.exitRide(); cam.spin(-5, 0); return true;
      case 'KeyQ': cam.tiltBy(-0.08); return true;
      case 'KeyE': cam.tiltBy(0.08); return true;
      case 'Equal': case 'NumpadAdd':
        if (this.selection?.kind === 'line') { this.act({ type: 'addTrain', line: this.selection.id }, 'build-train-add'); return true; }
        cam.zoomBy(0.85); return true;
      case 'Minus': case 'NumpadSubtract':
        if (this.selection?.kind === 'line') { const r = this.act({ type: 'removeTrain', line: this.selection.id }); if (r.ok) audio.sfx('build-train-add', { reverse: true }); return true; }
        cam.zoomBy(1 / 0.85); return true;
      case 'KeyR': this.setTool('route'); return true;
      case 'KeyX': if (this.story.toolAllowed('demolish')) this.setTool('demolish'); return true;
      case 'KeyG': if (this.story.toolAllowed('green')) this.setTool('green'); return true;
      case 'KeyB': if (this.story.toolAllowed('station')) this.setTool('station'); return true;
      case 'KeyV': if (this.story.toolAllowed('xray')) this.setXray(); return true;
      case 'KeyO': if (this.story.toolAllowed('flow')) this.setFlow(); return true;
      case 'KeyT': if (this.story.toolAllowed('tech')) this.hud.openTech(); return true;
      case 'KeyK': this.hud.toggleMilestones(); return true;
      case 'Slash': case 'NumpadDivide': this.hud.openPlaces(); return true;
      case 'Space': if (this.isPaused() && this.pauseReasons.has('user')) this.setPaused(false, 'user'); else this.setPaused(true, 'user'); audio.sfx('ui-tool'); return true;
      case 'KeyF': this.cycleSpeed(); return true;
      case 'KeyU': this.undo(); return true;
      case 'KeyC': if (this.selection?.kind === 'line') this.startRide(this.selection.id); return true;
      case 'Enter': case 'NumpadEnter': if (this.route.cards) { const i = this.route.hi >= 0 ? this.route.hi : this.route.cards.findIndex((c) => c.feasible); if (i >= 0) { if (this.route.hi !== i) this.highlightCard(i); else this.buildCard(i); } return true; } return false;
      case 'Tab': if (this.route.cards) { this.hud.toggleDetails(); return true; } return false;
      case 'Digit1': if (this.hud.disasterShown()) { this.act({ type: 'brace' }, 'brace-shield'); this.hud.disasterRefresh(); return true; } return false;
      case 'Digit2': if (this.hud.disasterShown()) { this.act({ type: 'reroute' }, 'reroute-clunk'); this.hud.disasterRefresh(); return true; } return false;
      default: return false;
    }
  }

  // ------------------------------------------------------------------ Ride and the first-crossing cinematic
  startRide(lineId) {
    const l = this.sim.lines().find((x) => x.id === lineId); if (!l) return;
    this.select(null);
    const tr = this.sim.trains(lineId) || []; const moving = tr.findIndex((x) => x.dir !== 0);
    this.ride = { line: lineId, train: moving >= 0 ? moving : 0 };
    this.G.net.riding = true;
    this.G.cam.startFollow(() => {
      if (this.ride) { const tr = this.trainsFor(this.ride.line) || []; if (tr[this.ride.train]?.dir === 0) { const mv = tr.findIndex((x) => x.dir !== 0); if (mv >= 0) { this.ride.train = mv; this.G.cam.followInit = false; } } }
      const pose = this.G.net.ridePose(this.ride?.line ?? lineId, this.ride?.train ?? 0);
      if (pose) {
        // underground lines show the cutaway (X-ray); water lines stay in the sea: tint, sea floor and light shafts, no X-ray
        const below = pose.below; if (below !== this.xrayAuto) { this.xrayAuto = below; this.applyXray(); }
        this.setUnderwater(!!pose.water);
        audio.ambience('amb-deep', below || pose.water ? 0.8 : 0);
        // riding a shaft down toward its Core Exchange: "ride on through" with the fire consist waiting there
        if (l.shaft) { const deep = pose.pos.length() < 75; if (deep !== !!this.rideThrough) { this.rideThrough = deep ? this.G.net.chainFromShaft(l.id) : null; this.hud.setRiding(l, !!this.rideThrough); } }
      }
      return pose;
    });
    audio.sfx('depart-' + l.type);
    this.hud.setRiding(l);
    this.story.interim?.('ride');
  }
  /** From a shaft Ride: the crossing timeline from the first Core Exchange on (the hand-off, the fire consist, the far shaft). */
  rideOnThrough() {
    const chain = this.rideThrough; if (!chain) return;
    this.exitRide(true);
    this.startCrossingCinematic(null, { chain, start: 4.2, first: false });
  }
  exitRide(quiet = false) {
    if (!this.ride) return;
    this.ride = null; this.G.net.riding = false; this.rideThrough = null;
    this.G.cam.exitFollow();
    // back from street level to an overview of where the train was
    if (!quiet) this.G.cam.flyTo(this.G.camera.position.clone().normalize(), Math.max(210, this.G.cam.dist), 1.0);
    this.xrayAuto = false; this.applyXray(); audio.ambience('amb-deep', 0);
    this.setUnderwater(false);
    this.hud.setRiding(null);
  }
  /** The water Ride's underwater look: the sea surface seen from below, a blue tint with light shafts. */
  setUnderwater(on) {
    if (this.G.underwater === on) return;
    this.G.underwater = on;
    this.G.city.setUnderwater?.(on);
    let el = document.getElementById('underwater');
    if (!el) { el = document.createElement('div'); el.id = 'underwater'; el.innerHTML = '<i></i><i></i><i></i>'; document.body.insertBefore(el, document.getElementById('hud-root')); }
    el.classList.toggle('on', on);
  }
  /**
   * The first-crossing cinematic (and ride on through): the shared crossing timeline in render-net.js (~19 s), two
   * consists and the Core Exchange hand-off at each end. `e` is the built event; returns false when the chain can't
   * be found (the story advances on the built event anyway).
   */
  startCrossingCinematic(e, { chain = null, start = 0, first = true } = {}) {
    const net = this.G.net;
    if (!chain && e) {
      const all = this.sim.lines(); const stations = this.sim.stations();
      const lines = (e.lines || []).map((id) => all.find((l) => l.id === id)).filter(Boolean);
      const fire = lines.find((l) => l.type === 'fire');
      const atTerminal = (l) => [l.a, l.b].some((sid) => stations.find((x) => x.id === sid)?.kind === 'terminal');
      if (fire) {
        // the shafts at the fire chord's two Core Exchanges (new or reused); down is the one away from the Terminal
        const at = (sid) => all.find((l) => l.shaft && (l.a === sid || l.b === sid));
        let down = at(fire.a), up = at(fire.b);
        if (down && up && atTerminal(down) && !atTerminal(up)) [down, up] = [up, down];
        if (down && up) chain = net.chainFromLines(down.id, fire.id, up.id);
      }
    }
    if (!chain) return false;
    const ctl = net.crossingTimeline(chain, { start, onHandoff: (i) => this.onHandoff(i, first) });
    this.cinematic = { t: 0, dur: ctl.dur - start, ctl, skippable: true, holdSim: false, first, start };
    this.G.closeOverlays();
    this.select(null);
    this.xrayAuto = true; this.applyXray();
    audio.sfx('core-dive');
    this.G.cam.startFollow(() => { const c = this.cinematic; return c ? c.ctl.pose(Math.min(c.t, c.dur)) : null; });
    this.hud.setCinematic(true);
    return true;
  }
  /** A hand-off at a Core Exchange: the crossing sound with the first one; the caption the first time ever. */
  onHandoff(i, first) {
    if (i === 0) audio.sfx('core-crossing');
    if (i === 0 && !save.meta().exchangeSeen) {
      this.hud.caption('Core Exchange: cargo moves from the earth train to the fire train', 4.5);
      if (first) save.saveMeta({ exchangeSeen: true });
    }
  }
  endCinematic() {
    if (!this.cinematic) return;
    const c = this.cinematic;
    this.cinematic = null; this.G.cam.exitFollow(); this.G.net.endCrossing();
    this.G.cam.dist = Math.max(this.G.cam.dist, 220);
    this.xrayAuto = false; this.applyXray();
    this.hud.setCinematic(false); this.hud.caption(null);
    if (c.first) {
      // back up top over the stations whose held exports now pour through the core
      const poured = this.updateCrates() || [];
      const st = poured.length ? this.sim.stations().find((x) => x.id === poured[0].station) : null;
      if (st) this.G.cam.flyTo(V(this.cells[st.cell].pos), 230, 1.6); else this.G.cam.flyTo(V(this.cells[this.meta.terminal].pos), 230, 1.6);
      this.story.afterCrossing?.();
    } else this.G.cam.flyTo(this.G.camera.position.clone().normalize(), 230, 1.4);
  }

  visuals(dt) {
    if (this.cinematic) {
      this.cinematic.t += dt; if (this.cinematic.t > this.cinematic.dur + 0.3) this.endCinematic();
      // embers drifting past the camera inside the lava, rock dust in the bores
      const cp = this.G.camera.position; const r = cp.length(); const net = this.G.net;
      const n = r < 36 ? 10 : r < 99 ? 3 : 0;
      for (let i = 0; i < n; i++) {
        const p = cp.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(r < 36 ? 26 : 10));
        net.emit(p, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2), r < 36 ? new THREE.Color(1, 0.45 + Math.random() * 0.3, 0.12) : new THREE.Color(0.45, 0.4, 0.35), 1.6, r < 36 ? 0.35 : 0.2);
      }
    }
    if (this.playing && this.sim) {
      this.G.net.gameTime = this.gameTime();
      this.hud.frame(dt);
      const d = this.G.camera.position.length();
      audio.ambience('amb-city', d < 200 ? 0.6 : d < 320 ? 0.3 : 0.1);
    }
  }
  onResize() { this.hud?.layout?.(); }
  onMute(m) { this.hud?.updateMute?.(m); }

  // ------------------------------------------------------------------ debug
  simPerf() { return this.sim?.perfStats?.() || {}; }
  hash() { return this.sim?.hash() ?? null; }
  stations() { return this.sim?.stations() ?? []; }
  lines() { return this.sim?.lines().map((l) => ({ ...l, cells: undefined })) ?? []; }
  routeCards() { return (this.route.cards || []).map((c) => ({ kind: c.kind, feasible: c.feasible, locked: c.locked, cost: c.cost, carries: c.carries, exportsGain: c.exportsGain, exportsNote: c.exportsNote, line: c.line, tags: c.tags, demolishes: c.demolishes, ridersLost: c.ridersLost, exportsLost: c.exportsLost, tripTime: c.tripTime })); }
  debugState() {
    const st = this.sim ? this.sim.state() : {};
    return {
      ...st, screen: this.G.screen, playing: this.playing, tool: this.tool, speed: this.speed(), paused: this.isPaused(), pauseReasons: [...this.pauseReasons],
      selection: this.selection, pins: { a: this.route.a, b: this.route.b }, cards: this.route.cards ? this.route.cards.length : 0, highlighted: this.route.hi,
      flow: this.flow, xrayOn: this.xrayOn(), riding: !!this.ride, cinematic: !!this.cinematic, tutorialStep: this.story.stepId?.() ?? null, tutorialStepId: this.story.stepName?.() ?? null, tutorialWaiting: this.story.tut?.waiting ?? null,
      plan: this.plan ? { a: this.plan.a, b: this.plan.b, kind: this.plan.kind, cost: this.plan.card?.cost ?? null, ready: !!(this.plan.card && this.sim?.canAfford?.(this.plan.card.cost)) } : null,
      toolbar: this.story.visibleTools?.(), gameTime: +this.gameTime().toFixed(2),
    };
  }
}

function samePlace(a, b) {
  if (a == null || b == null) return false;
  if (typeof a === 'object' && typeof b === 'object') return a.station === b.station;
  return a === b;
}
function occluded(cam, p, r) {
  // does the segment camera → p hit the sphere of radius r before reaching p?
  const d = p.clone().sub(cam); const L = d.length(); d.divideScalar(L);
  const b = cam.dot(d); const c = cam.lengthSq() - r * r; const disc = b * b - c;
  if (disc < 0) return false;
  const t0 = -b - Math.sqrt(disc);
  return t0 > 0 && t0 < L - 0.6;
}
function xy(s) { return { x: Math.round(s.x), y: Math.round(s.y) }; }
export { vecLatLon };
