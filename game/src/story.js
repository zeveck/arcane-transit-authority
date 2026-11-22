// story.js — dispatches from beyond the warp, Juno's tutorial (one step table: the staged toolbar, the planned
// and earned through-the-core crossing), the Auditor's quota lines and Juno's hints.
import { termStream } from './rng.js';
import { cellMeta } from './planet.js';
import * as save from './save.js';
import * as audio from './audio.js';
import { fmtMoney } from './fmt.js';

// ~10 per Charter, from the Warp Conductor (the far end of the warp is never shown: only a voice)
export const DISPATCHES = {
  I: [
    'Delivered your crates to a planet of gardens. They asked what a "building" is. I said: a garden that gave up.',
    'Passed a world where every train runs backwards. They arrive before they leave, so nobody is ever late. Nobody is ever early either.',
    'A lantern-maker on the Homeworld asked what colour your planet is. I said: all of them, at once.',
    'There is a station at the edge of the galaxy where one passenger has waited a thousand years. Today I told him: soon.',
    'The warp hums in your planet\'s key now. I can tell your crates apart by the sound.',
    'A moon asked me for directions. I gave it yours. Expect a moon.',
    'The Homeworld sorts your goods by colour. Yours are the shiny ones.',
    'I counted the stars between here and the core. I lost count at the second one. They move.',
    'A child on a passing liner waved at your planet. I waved back on your behalf. You looked very busy.',
    'Rain on a world of glass today. It rang like a bell for an hour. I thought of your rails.',
  ],
  II: [
    'The Atlanteans send their regards and a crate of pearls. The pearls send their regards too. They are that kind of pearl.',
    'A sea planet asked how you keep your water in the oceans. I said: politely.',
    'Your blue trains are the talk of three nebulae. Mostly the word is "bubbly".',
    'Delivered goods to a fish who runs a bank. He was very fair. Slippery, but fair.',
    'A lighthouse on a dead world still turns every night. I stopped and let it shine on the cargo. Tradition.',
    'Someone at the Homeworld framed one of your shipping labels. It hangs between two famous labels.',
    'The tide on Kessa follows my train now. Gravity is a strange fan.',
    'Brought your exports past a choir of comets. They sang flat. I sang along.',
    'A drowned city asked if Atlantis is hiring. I said I would pass it on.',
    'The deep dark between stars is warm today. Something nearby is busy. I think it is you.',
  ],
  III: [
    'A world with no rails at all asked how you move a city. I showed them a picture of your core line. They fainted, briefly.',
    'Heritage, the Homeworld says, is a building you are not allowed to knock down. I said you have plenty of those.',
    'Your fire line glows on our charts like a stitch of thread through the planet. We sew with it now.',
    'A museum on Ilvar wants one of your old trains. I told them they are all still working.',
    'Passed an empty station with its lights left on. Someone believed in the timetable.',
    'Your capital is visible from the warp now. A bright knot. People make wishes on it.',
    'Delivered a crate of clocks to a world without time. They loved the ticking.',
    'The Auditor sneezed in a meeting today. Everybody wrote it down.',
    'A comet slowed down to read your planet\'s lights. It took a while. It is a slow reader.',
    'I met a conductor from another line. We compared lanterns. Mine is better.',
  ],
  IV: [
    'The frontier worlds watch your long lines with envy. Distance, they say, is only a timetable problem.',
    'The orbital ring of yours makes a fine halo. Saints have asked for the pattern.',
    'Today a passenger asked where the warp goes. I said: further. She seemed satisfied.',
    'A space whale followed the train for a light-week. It wanted the snacks.',
    'Your exports smell of rain and engine oil. The Homeworld calls it "Oikumene, vintage".',
    'Saw a world turning slowly to face your light. Plants do that. So do planets, it turns out.',
    'A station master on a far ice moon keeps a picture of your Warp Terminal by the kettle.',
    'The Homeworld\'s ledger has a page with your planet\'s name at the top. It used to be a footnote.',
    'Somewhere a toy train set has your network on it. Badly. But with love.',
    'I tipped my cap at a pulsar. It tipped back, eleven hundred times a second.',
  ],
  V: [
    'The yard at your Terminal is small, they say. I say the best stations are snug.',
    'A storm on the warp road today. I held my lantern high and the cargo stayed dry.',
    'The Homeworld runs out of shelves for your goods. They are building shelves out of shelves.',
    'Your trains are faster than the gossip now. That has never happened before.',
    'A small planet asked me to take its whole population to a concert. Next trip, I promised.',
    'I passed the passenger who waits at the galaxy\'s edge. He has started packing.',
    'The core of the galaxy is brighter tonight. Someone there is reading your reports.',
    'Two stars collided and apologised to each other. Very civilised, the core.',
    'Your launch ring hums a chord I last heard at a wedding. Make of that what you will.',
    'The Auditor smiled at a spreadsheet. We are all worried about him.',
  ],
  VI: [
    'The Homeworld is quiet today. Listening, I think.',
    'Every train in the galaxy is a little brighter since your lines went in. I don\'t know how. I don\'t ask.',
    'The passenger at the galaxy\'s edge bought a ticket. He has never bought a ticket before.',
    'They have started calling your planet "the engine". As in: the thing that makes everything go.',
    'I was asked, again, where the trains go. Not yet. Soon.',
    'The core is turning toward you. You will feel it at the Terminal: a warmth.',
    'Your rails hum in my sleep now. Do conductors sleep? I am finding out.',
    'The last shelf at the Homeworld is filling. Then: something new.',
    'I polished my lantern for the first time in a thousand years. There is an occasion coming.',
    'Keep going, Chief Engineer. The light at the heart of the galaxy is waiting for one more train.',
  ],
};
// the first departure that launches exports (sim `departure` event, firstExports)
const FIRST_EXPORTS = 'Your first exports reached the Homeworld. A clerk stamped them twice, out of excitement. That never happens.';
export const FINALE_DISPATCH = 'You asked where the trains go. They go home. Not to the Homeworld: home is wherever the next train arrives, and every train in the galaxy now arrives because of you. The passenger at the edge has boarded. The lights are on all the way to the core. Thank you, Chief Engineer. Your line is open.';
const QUOTA_LINES = [
  'Quota I met. I have noted it in the ledger, in ink. Do not let it go to your head.',
  'Quota II. Planet-spanning, I see. The Office is... not displeased.',
  'Quota III. The Charter is Commended. I have stamped it myself. Firmly.',
];
const HINTS = {
  interchange: 'That interchange is full. Upgrade it (select the station) or build a second route around it.',
  unlinked: 'Some stations have no link to the Terminal, so they make commuters but no exports.',
  line: 'That line is full: select it and add a train (+), or build a second route beside it. A full shaft needs a second core route.',
  warp: 'The Warp ring is the limit now: Warp Consists and Twin Launch Ring in the Tech tree raise it.',
  atlantis: 'Atlantis is dense and unserved! Sea Stations in the Tech tree reach it.',
};

// ------------------------------------------------------------------ Juno's tutorial: one table (requests 35–37)
// Each step: id, open (game seconds: its instructions open no earlier), tools (the toolbar from this step on),
// want (the card kind Juno asks for), cells (outlined), frame (camera), text (Juno's instructions, from live numbers),
// cards (what she says when the cards are dealt), wait / waitDone / idle (while the step waits to open: a suggestion,
// what finishes it, what she says after), ready (an extra condition to open, polled), have (rebuild: is this step
// already done on this network), done (by events: built / action / plan / quota, in the handlers below).
// The story's saved step is versioned: a save written by an older table is rebuilt from the network (have()).
export const STORY_VERSION = 2;
const BASE_TOOLS = ['route', 'places'];
const T_FLOW = [...BASE_TOOLS, 'flow'];
const T_GREEN = [...T_FLOW, 'xray', 'demolish', 'green'];
const T_XRAY = T_GREEN;
const T_ALL = [...T_XRAY, 'tech'];
const ALL_TOOLS = ['route', 'places', 'flow', 'xray', 'demolish', 'green', 'tech', 'more'];
const BUSY = 0.8; // step 3: a line is "genuinely busy" at this load
const STEPS = [
  { id: 'surface', open: 0, tools: BASE_TOOLS, want: 'surface',
    cells: (m) => [m.tutorial.a, m.tutorial.b],
    text: (k) => `Welcome, Chief Engineer! I'm Juno, your dispatcher. Let's lay your first line. <b>Click the highlighted district</b>, ${k.nm(k.m.tutorial.a)}, then the one <b>four districts beyond it</b>.`,
    cards: (k) => { const s = k.card('surface'); const cheap = s?.tags?.includes('Cheapest'); return `Look at <b>Surface</b>'s red line: the blocks it clears, and what they'd lose. ${cheap ? '<b>Cheapest here because these blocks are light.</b>' : 'These blocks are light, so clearing them is cheap.'} Over dense blocks, demolition costs more than digging. Pick <b>Surface</b>.`; },
    have: (x) => x.built.has('surface') },
  { id: 'earth', open: 60, tools: BASE_TOOLS, want: 'earth',
    wait: 'Your first line is running! While it warms up, try <b>Ride</b>: click the yellow line, then press <kbd>C</kbd>. Any key brings you back.', waitDone: 'ride', idle: 'Watch your trains run while the line warms up.',
    cells: (m) => [m.capitalCentre],
    text: (k) => `Now connect the <b>Capital</b>: click its centre, then <b>your first station</b>. Those blocks are dense. <b>Dense? Dig.</b>`,
    cards: (k) => { const e = k.card('earth'), s = k.card('surface'); return e?.tags?.includes('Cheapest') ? `Under these dense blocks <b>Earth</b> is Cheapest${s ? `: Surface would cost ${k.money(s.cost)} and demolish ${s.demolishes} block${s.demolishes === 1 ? '' : 's'}` : ''}. Dense? Dig. Pick <b>Earth</b>.` : `<b>Earth</b> keeps the dense blocks standing and digs underneath. Dense? Dig. Pick <b>Earth</b>.`; },
    have: (x) => x.built.has('earth') },
  { id: 'train', open: 150, tools: T_FLOW,
    wait: 'Press <b>Flow</b> (<kbd>O</kbd>): busy ley-rails widen and brighten, and white rings show how full each line is. When one fills up, I\'ll show you what to do.', waitDone: 'flow', idle: 'Watch the load: small hollow rings are fine, big flashing ones are full.',
    // opens once a line is genuinely busy (or, if none fills, 2.5 minutes later with the busiest one)
    ready: (k) => k.busiest().load >= BUSY || k.sim.s.time >= 300,
    cells: () => [],
    text: (k) => { const b = k.busiest(); return b.load >= BUSY ? `The <b>${k.esc(b.name)}</b> is at <b>${Math.round(b.load * 100)}%</b>: it's full, and riders wait. <b>Click the line</b> and press <kbd>+</kbd> (or the + in its panel) to <b>add a train</b>.` : `Your busiest line, the <b>${k.esc(b.name)}</b>, is at <b>${Math.round(b.load * 100)}%</b>. When a line fills up, more trains carry more. Practise it: <b>click the line</b> and press <kbd>+</kbd> to <b>add a train</b>.`; },
    have: (x) => x.actions.has('addTrain') },
  { id: 'sky', open: 210, tools: T_FLOW, want: 'sky',
    wait: 'Spin the globe (drag, or the arrow keys) toward the far side: the <b>Warp Terminal</b> sits on the equator under the ring. Everything you build has to get there, one day.', waitDone: 'terminal', idle: 'That\'s the Warp Terminal. Everything has to reach it.',
    cells: (m) => m.tutorial.peaks,
    text: (k) => `See the two peaks, <b>${k.nm(k.m.tutorial.peaks[0])}</b> and <b>${k.nm(k.m.tutorial.peaks[1])}</b>? Click one, then the other, and pick <b>Sky</b>: peaks are the one place nothing needs clearing, and its Sky Port joins the district below by a walkway.`,
    cards: () => 'Between two peaks, <b>Sky</b> flies over everything: no blocks cleared, no tunnel. Pick <b>Sky</b>.',
    have: (x) => x.built.has('sky') },
  { id: 'green', open: 270, tools: T_GREEN,
    wait: 'Up there: the <b>orbital ring</b>. Space Elevators, one day. And in the Brine\'s northern bay: <b>Atlantis</b>, the domed city under the sea. Try <b class="nw">X-ray</b> (<kbd>V</kbd>) to see your tunnels through the rock.', waitDone: 'xray', idle: 'Bores, shafts and the molten core: that\'s <span class="nw">X-ray</span>. Press <kbd>V</kbd> again to come back up.',
    cells: (m, k) => k.clearedCells(),
    text: () => 'Demolishing makes room, and the room can grow back green. Press <kbd>G</kbd>, then <b>click a cleared district</b> (outlined green) along your Surface line to plant a park.',
    have: (x) => x.actions.has('green') },
  { id: 'plan', open: 330, tools: T_XRAY, want: 'core',
    cells: (m) => [m.tutorial.a, m.terminal],
    text: (k) => {
      const c = k.toTerminal(); const s = c.surface, core = c.core;
      const earth = c.earth && !c.earth.feasible ? 'Earth can\'t dig that far' : 'Earth would carry less';
      const slower = s?.feasible && core?.feasible && s.tripTime > core.tripTime ? ' for a slower line' : '';
      const surf = s?.feasible ? `Surface would flatten ${s.demolishes} block${s.demolishes === 1 ? '' : 's'}${slower}` : 'Surface can\'t get there';
      return `The <b>Warp Terminal</b> is on the far side. ${earth}, and ${surf}. The core is the way: the most expensive thing you'll build. <b>Click your first station</b>, then the Terminal (a marker through the globe, or <b>Pick from list</b>), and press <b>Plan it</b> on <b>Through the core</b>.`;
    },
    cards: (k) => { const c = k.card('core'); return c ? `<b>Through the core</b>: ${k.money(c.cost)}${c.tags?.length ? `, ${c.tags.join(' and ').replace('Most capacity', 'most capacity')}` : ''}. You have ${k.money(k.st().money)}. Press <b>Plan it</b>: its ghost stays on the globe and the chip at the top counts the money down.` : 'Press <b>Plan it</b> on the core card.'; },
    have: (x) => x.planCore || x.crossing },
  { id: 'cross', open: 0, tools: T_XRAY,
    text: (k) => `Saved up! The chip is gold: press <b>Build</b> on it. Down a shaft, across the molten core, up the far side, and your stations start sending exports to the Terminal.`,
    have: (x) => x.crossing },
  { id: 'quota', open: 0, tools: T_ALL,
    cells: () => [],
    text: (k) => `Last step: meet <b>Quota I: ${k.st().quotas?.[0] ?? 90} exports a minute</b>. Add trains where Flow shows a full line, click the Throughput meter to see what limits you, and try the <b>Tech</b> tree (<kbd>T</kbd>).`,
    have: () => false },
];
const STEP_N = STEPS.length;
const stepOf = (id) => STEPS.findIndex((x) => x.id === id) + 1;

export class Story {
  constructor(game) { this.game = game; this.tut = null; }
  get hud() { return this.game.hud; }

  enter(sim, { tutorial, restored, story }) {
    this.sim = sim; const st = sim.state();
    this.charter = st.charter;
    this.rng = termStream(st.termSeed, 'dispatches');
    this.order = [...Array(10).keys()]; this.rng.shuffle?.(this.order);
    this.next = story?.next ?? 0; this.departures = story?.departures ?? 0;
    this.hintTimers = {}; this.hinted = new Set(story?.hinted || []);
    this.tut = null; this.namedF = !!story?.namedF;
    if (tutorial) {
      // a save from an older step table (or none) is rebuilt from the network; a finished tutorial stays finished
      let step = story?.v === STORY_VERSION ? story.step : null;
      if (story && story.v !== STORY_VERSION && (story.step ?? 1) >= 10) step = STEP_N + 1;
      if (step == null) step = restored ? this.rebuild(restored) : 1;
      if (step <= STEP_N) this.tut = { step, sub: story?.v === STORY_VERSION ? story.sub || 0 : 0, planAt: story?.planAt ?? null };
    }
    this.hud.refreshToolbar();
    if (this.tut) this.openStep(true);
    else if (!restored) {
      const ch = this.game.sim.state();
      const audit = ch.deadline == null ? 'Free play: no Audit, no deadline. Build as you like.' : `The Audit is in ${Math.round(ch.deadline / 60)} minutes. I will be watching. Fondly, but watching.`;
      setTimeout(() => this.game.playing && this.hud.dispatch('thrumm', `${ch.tutorial ? '' : `Charter ${ch.charter === 'G' ? 'Galactic' : ch.charter}${ch.deadline == null ? ', free play' : ''}.`} Quota I is ${ch.quotas[0]} exports a minute. ${audit}`, { ttl: 9 }), 2500);
    }
  }
  /** The first step this network hasn't done yet (old saves, a changed table). */
  rebuild(restored) {
    const sim = this.game.sim; const lines = sim.lines(); const log = sim.s.log || [];
    const built = new Set(); const actions = new Set();
    for (const l of lines) if (!l.inherited && !l.shaft) built.add(l.type === 'fire' ? 'core' : l.type);
    for (const [, a] of log) actions.add(a.type);
    const x = { built, actions, crossing: this.crossingUsed(), planCore: restored?.plan?.kind === 'core' };
    for (let i = 0; i < STEP_N; i++) if (!STEPS[i].have(x)) return i + 1;
    return STEP_N;
  }
  leave() { this.tut = null; this.hud.clearDispatch('tut'); }
  saveState() { return { v: STORY_VERSION, next: this.next, departures: this.departures, step: this.tut?.step ?? STEP_N + 1, sub: this.tut?.sub || 0, planAt: this.tut?.planAt ?? null, namedF: this.namedF, hinted: [...this.hinted] }; }
  /** The step number (1..8) and its id, for the debug hook. */
  stepId() { return this.tut ? this.tut.step : null; }
  stepName() { return this.tut ? STEPS[this.tut.step - 1]?.id ?? null : null; }
  cur() { return this.tut ? STEPS[this.tut.step - 1] : null; }

  // ------------------------------------------------------------------ toolbar staging
  visibleTools() {
    if (!this.tut) return ALL_TOOLS;
    // while a step waits to open, the toolbar is the one of the step before it
    const i = this.tut.waiting ? this.tut.step - 2 : this.tut.step - 1;
    return STEPS[Math.max(0, i)].tools;
  }
  toolAllowed(t) { if (t === 'station') return !this.tut; return this.visibleTools().includes(t) || t === 'route'; }
  cardAllowed(c) {
    const t = this.tut; if (!t) return true;
    const id = this.cur()?.id;
    // the core is kept for the crossing steps (before them it is out of reach anyway: the tutorial has no debt)
    if (c.kind === 'core' && stepOf(id) < stepOf('plan')) { this.say('Hold the core for later: it\'s the big one, and we\'ll plan it together.'); return false; }
    if (t.waiting) return true;
    if (id === 'surface' && c.kind !== 'surface') { this.say('Pick the <b>Surface</b> card this time: over these light blocks it\'s the cheapest.'); return false; }
    if (id === 'earth' && c.kind === 'surface') { this.say('Look at Surface\'s red line: it would flatten dense blocks. <b>Dense? Dig.</b> Pick <b>Earth</b>.'); return false; }
    if (id === 'sky' && c.kind !== 'sky') { this.say('Between two peaks, pick <b>Sky</b>.'); return false; }
    return true;
  }

  // ------------------------------------------------------------------ the step's words
  /** Helpers the step texts read their numbers from (live, so Juno is never wrong about a price). */
  ctx() {
    const g = this.game; const m = cellMeta(); const sim = g.sim;
    const k = {
      m, g, sim, money: (v) => fmtMoney(v), esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
      nm: (id) => k.esc(g.cellName(id)), st: () => sim.state(),
      card: (kind) => g.route.cards?.find((c) => c.kind === kind && c.feasible) || null,
      busiest: () => { let b = { load: 0, name: 'line', id: null }; for (const l of sim.lines()) if (!l.inherited && !l.shaft && (l.load || 0) > b.load) b = { load: l.load || 0, name: g.lineName(l), id: l.id }; return b; },
      clearedCells: () => sim.cells((c) => c.demolished && !c.green && !(c.stations?.length)).map((c) => c.id),
      firstStation: () => sim.stations().find((s) => s.cell === m.tutorial.a && s.kind !== 'core') || null,
      toTerminal: () => {
        if (this.termCards && this.termCards.at === sim.s.time) return this.termCards;
        const fs = k.firstStation(); const out = { at: sim.s.time };
        try { for (const c of sim.routeCards(fs ? { station: fs.id } : m.tutorial.a, m.terminal)) out[c.kind] = c; } catch { /* none */ }
        this.termCards = out; return out;
      },
    };
    return k;
  }
  say(text) { this.hud.dispatch('juno', text, { ttl: 6, key: 'tutnag' }); }
  /** Open the current step now, or show its wait (time, or a condition like a busy line) first. */
  openStep(entering = false) {
    const t = this.tut; if (!t) return;
    const s = this.cur(); const now = this.game.sim?.s.time ?? 0;
    if ((s.open && now < s.open) || (s.ready && !s.ready(this.ctx()))) { t.waiting = s.open || now; this.showInterim(); return; }
    t.waiting = null;
    this.showStep();
  }
  showStep() {
    const t = this.tut; if (!t) return;
    const s = this.cur(); const k = this.ctx(); const g = this.game; const city = g.G.city;
    if (g.cinematic) { t.deferred = true; return; } // shown when the cinematic ends
    if (s.id === 'plan' && g.plan?.kind === 'core' && !t.sub) { t.sub = 1; t.planAt = t.planAt ?? g.plan.at; }
    let text = s.text(k);
    if (s.id === 'plan' && g.plan?.kind === 'core') text = this.savingText(k);
    const el = this.hud.dispatch('juno', `${text}<br><button class="link-btn" data-skip>Skip tutorial</button>`, { sticky: true, key: 'tut' });
    el.classList.add('tut');
    el.querySelector('[data-skip]').onclick = () => this.skip();
    const outline = s.cells ? s.cells(k.m, k) : [];
    city.outlineCells('tut', outline?.length && !(s.id === 'plan' && g.plan) ? outline : null, s.id === 'green' ? '#7aa84a' : '#ffd9a0', { pulse: true, lift: 1.6 });
    this.hud.refreshToolbar();
    const hint = { train: 'flow', green: 'green', plan: g.plan ? null : 'places', quota: 'tech' }[s.id];
    this.hud.highlightTool(hint, !!hint);
    // every step takes the camera to what Juno names (leaving a Ride first)
    if (g.ride) g.exitRide();
    const m = k.m;
    if (s.id === 'surface') { const c = g.cells[m.tutorial.a], c2 = g.cells[m.tutorial.b]; g.G.cam.flyTo([c.lat * 0.4 + c2.lat * 0.6, c.lon * 0.4 + c2.lon * 0.6], 240, 1.6); } // a little toward B, so Juno's card (bottom left) never covers it
    else if (s.id === 'earth') this.frame([m.capitalCentre, m.tutorial.a], 240);
    else if (s.id === 'train') { const b = k.busiest(); if (b.id != null) g.flyToSelection({ kind: 'line', id: b.id }); }
    else if (s.id === 'sky') this.frame(m.tutorial.peaks, 240, true);
    else if (s.id === 'green') this.frame(outline?.length ? outline : [m.tutorial.a, m.tutorial.b], 230, true);
    else if (s.id === 'plan' && !g.plan) this.frame([m.tutorial.a], 280);
    else if (s.id === 'quota') this.frame([m.capitalCentre, m.tutorial.a, m.tutorial.b], 300);
  }
  /** Step 6 after Plan it: the wait, one earning task to shorten it, and F named once. */
  savingText(k) {
    const g = this.game; const c = g.plan?.card; const st = k.st();
    const rate = st.moneyPerMin || 0; const left = c ? Math.max(0, c.cost - st.money) : 0;
    const eta = rate > 0.01 ? `about ${clockOf(left / rate * 60)}` : 'a while';
    const b = k.busiest();
    const task = this.tut.sub >= 2 ? '<b>Nice:</b> more income, a shorter wait.' : b.load >= 0.9 ? `To shorten it, <b>add a train</b> to the ${k.esc(b.name)} (it's at ${Math.round(b.load * 100)}%).` : 'To shorten it, <b>connect one more district</b> to your network: more riders, more fares.';
    const f = this.namedF ? '' : ' <kbd>F</kbd> fast-forwards time while you wait.';
    this.namedF = true;
    return `Planned! The chip at the top counts it down: ${eta} at this rate, while your exports wait at the stations. ${task}${f}`;
  }
  /** Fly to frame some cells: their mean direction, pulled back to fit their spread (top-down for peaks). */
  frame(cells, d = 230, topDown = false) {
    const cs = cells.map((id) => this.game.cells[id]).filter(Boolean); if (!cs.length) return;
    const v = [0, 0, 0]; for (const c of cs) { v[0] += c.pos[0]; v[1] += c.pos[1]; v[2] += c.pos[2]; }
    const L = Math.hypot(...v) || 1; const n = v.map((x) => x / L);
    let spread = 0; for (const c of cs) spread = Math.max(spread, Math.acos(Math.max(-1, Math.min(1, c.pos[0] * n[0] + c.pos[1] * n[1] + c.pos[2] * n[2]))));
    const lat = Math.asin(n[1]) * 180 / Math.PI, lon = Math.atan2(n[0], n[2]) * 180 / Math.PI;
    this.game.G.cam.flyTo([lat, lon], Math.max(d, 200 + spread * 260), 1.4, { topDown });
  }
  /** Move to a step (by number or id); past the last one the tutorial is done. */
  advance(to = null) {
    if (!this.tut) return;
    this.hud.clearDispatch('tutnag'); // a reminder for the step just finished never lingers
    const n = typeof to === 'string' ? stepOf(to) : to ?? this.tut.step + 1;
    if (n <= this.tut.step && to != null) return;
    this.tut.step = n; this.tut.sub = 0; this.tut.interimDone = false;
    audio.sfx('milestone-flip', { gain: 0.5 });
    if (this.tut.step > STEP_N) return this.finish();
    this.openStep();
  }
  showInterim(done = false) {
    const t = this.tut; const s = this.cur();
    t.interimDone = done || !s.waitDone;
    // the suggestion while waiting; once done (or when there's nothing to do) only the countdown and the F hint remain
    const text = t.interimDone ? (done ? '<b>Nice.</b> ' : '') + (s.idle || 'Have a look around.') : s.wait || 'Have a look around.';
    const el = this.hud.dispatch('juno', `${text}<br><span class="tut-wait" data-tutcount>${this.countdown()}</span><br><button class="link-btn" data-skip>Skip tutorial</button>`, { sticky: true, key: 'tut' });
    el.classList.add('tut');
    el.querySelector('[data-skip]').onclick = () => this.skip();
    this.game.G.city.outlineCells('tut', null);
    this.hud.highlightTool(s.waitDone === 'flow' && !t.interimDone ? 'flow' : null, s.waitDone === 'flow' && !t.interimDone);
    this.hud.refreshToolbar();
  }
  /** The waiting line: "Next step in m:ss · F speeds up time", or the busiest line's load while a step waits on it. */
  countdown() {
    const t = this.tut; const s = this.cur(); const now = this.game.sim?.s.time ?? 0;
    const left = Math.max(0, Math.ceil((t?.waiting ?? 0) - now));
    if (left <= 0 && s?.ready) return `Waiting for a busy line: the busiest is at <b class="num">${Math.round(this.ctx().busiest().load * 100)}%</b> · <kbd>F</kbd> speeds up time`;
    return `Next step in <b class="num">${clockOf(left)}</b> · <kbd>F</kbd> speeds up time`;
  }
  /** The waiting step's suggestion was done (a Ride, Flow, the Terminal on screen). */
  interim(kind) {
    const t = this.tut; if (!t?.waiting || t.interimDone) return;
    if (this.cur().waitDone === kind) this.showInterim(true);
  }
  finish() {
    this.tut = null;
    save.saveMeta({ tutorialDone: true });
    this.hud.clearDispatch('tut'); this.hud.clearDispatch('tutnag');
    this.game.G.city.outlineCells('tut', null);
    this.hud.highlightTool(null, false);
    this.hud.refreshToolbar();
    this.hud.dispatch('juno', 'You\'re on your own now, Chief Engineer. I\'ll shout if anything catches fire. Or floods. Or falls from the sky.', { ttl: 9 });
  }
  skip() {
    audio.sfx('ui-cancel');
    this.tut = null;
    save.saveMeta({ tutorialDone: true });
    this.hud.clearDispatch('tut'); this.hud.clearDispatch('tutnag');
    this.game.G.city.outlineCells('tut', null); this.hud.highlightTool(null, false);
    this.hud.refreshToolbar();
    this.hud.dispatch('juno', 'Tutorial skipped. Every tool is yours. How to Play (in the pause menu) has the details.', { ttl: 7 });
  }

  // ------------------------------------------------------------------ events
  onPinA(place) {
    const t = this.tut; if (!t || t.waiting) return; const m = cellMeta(); const id = this.cur().id;
    if (id === 'surface' && place === m.tutorial.a) this.game.G.city.outlineCells('tut', [m.tutorial.b], '#ffd9a0', { pulse: true, lift: 1.6 });
    if (id === 'earth' && place === m.capitalCentre) { const fs = this.ctx().firstStation(); if (fs) this.game.G.city.outlineCells('tut', [fs.cell], '#ffd9a0', { pulse: true, lift: 1.6 }); }
    if (id === 'plan' && !this.game.plan) { this.hud.highlightTool('places', true); this.game.G.city.outlineCells('tut', [m.terminal], '#ffd9a0', { pulse: true, lift: 1.6 }); }
  }
  tutWantKind() { const t = this.tut; return t && !t.waiting ? this.cur().want || null : null; }
  crossingUsed() { const st = this.game.sim?.state(); return st?.firstCrossingUsed ?? !!this.game.sim?.lines().some((l) => l.type === 'fire'); }
  onCards(cards) {
    const t = this.tut; if (!t || t.waiting) return; const s = this.cur();
    if (s.want) this.hud.tutPickCard(s.want);
    if (s.id === 'plan' && this.game.plan?.kind === 'core') return;
    if (s.cards && (s.want ? cards.some((c) => c.kind === s.want && c.feasible) : true)) this.say(s.cards(this.ctx()));
  }
  onBuilt(e) {
    const t = this.tut; if (!t) return; const id = this.cur().id;
    // the crossing: on the sim's firstCrossing event, whether or not a cinematic plays (the next step waits for it to end)
    if (e.firstCrossing || (e.kind === 'core' && this.crossingUsed())) { if (stepOf(id) <= stepOf('cross')) this.advance('quota'); return; }
    if (t.waiting) return;
    if (id === 'surface' && e.kind === 'surface') this.advance();
    else if (id === 'earth' && e.kind === 'earth') this.advance();
    else if (id === 'sky' && e.kind === 'sky') this.advance();
    else if (id === 'plan' && this.game.plan?.kind === 'core') this.onEarning();
  }
  /** After the cinematic (or when it is cut short): the deferred step shows; Juno's line unless `quiet`. */
  afterCrossing(quiet = false) {
    if (this.tut?.deferred) { this.tut.deferred = false; this.showStep(); }
    if (!quiet) this.hud.dispatch('juno', 'Down the shaft, across the core, up the far side: the earth train hands its cargo to the fire train and back. From now on your exports ride it to the Terminal and the deep space trains.', { ttl: 9 });
  }
  onAction(a) {
    const t = this.tut; if (!t || t.waiting) return; const id = this.cur().id;
    if (id === 'train' && a.type === 'addTrain') this.advance();
    else if (id === 'green' && a.type === 'green') this.advance();
    else if (id === 'plan' && this.game.plan?.kind === 'core' && a.type === 'addTrain') this.onEarning();
  }
  /** Step 6: Plan it on the core card. */
  onPlan(p) {
    const t = this.tut; if (!t || t.waiting) return; const id = this.cur().id;
    if (id !== 'plan' && id !== 'cross') return;
    if (p?.kind === 'core') { if (id === 'plan') { t.sub = 1; t.planAt = t.planAt ?? this.game.sim.s.time; this.showStep(); } return; }
    // the core plan cancelled (or replaced by another): back to planning it
    t.step = stepOf('plan'); t.sub = 0; this.showStep();
  }
  /** Step 6's earning task done (a build or a train while saving): Juno says so once. */
  onEarning() { const t = this.tut; if (!t || t.sub !== 1) return; t.sub = 2; this.showStep(); }
  /** Held crates show from the planned crossing on (game.updateCrates). */
  cratesSince() { const t = this.tut; return t && t.planAt != null && stepOf(this.cur()?.id) <= stepOf('cross') ? t.planAt : null; }
  onFlow(on) { if (on) this.interim('flow'); }
  onTech() {}
  onTap() {}
  onPlaces() {}
  onDeparture(e) {
    this.departures++;
    if (e?.firstExports) { setTimeout(() => this.game.playing && this.hud.dispatch('conductor', FIRST_EXPORTS, { ttl: 9 }), 6000); return; }
    // the Conductor's dispatch on every 4th returning train
    if (!this.tut && this.departures % 4 === 2) {
      const ch = this.charter === 'G' ? 'VI' : this.charter;
      const list = DISPATCHES[ch] || DISPATCHES.I;
      const i = this.order[this.next % 10]; this.next++;
      setTimeout(() => this.game.playing && this.hud.dispatch('conductor', list[i], { ttl: 9 }), 6000);
    }
  }
  onQuota(e) {
    if (this.tut && e.quota === 1) { this.advance(STEP_N + 1); return; }
    this.hud.dispatch('thrumm', QUOTA_LINES[e.quota - 1], { ttl: 8 });
  }

  // ------------------------------------------------------------------ per tick: waits, the crossing's money, hints (60 s of the same trouble)
  tick(st) {
    const t = this.tut;
    if (t?.waiting != null) {
      const s = this.cur();
      if (st.time >= t.waiting && (!s.ready || s.ready(this.ctx()))) { t.waiting = null; this.showStep(); }
      else {
        const c = document.querySelector('.dispatch[data-key="tut"] [data-tutcount]'); if (c) c.innerHTML = this.countdown();
        // the sky step's suggestion: spin until the Warp Terminal is in view
        if (s.waitDone === 'terminal' && !t.interimDone) { const cam = this.game.G.camera.position.clone().normalize(); const tc = this.game.cells[cellMeta().terminal].pos; if (cam.x * tc[0] + cam.y * tc[1] + cam.z * tc[2] > 0.75) this.interim('terminal'); }
      }
    } else if (t) {
      const id = this.cur().id; const p = this.game.plan;
      // step 6 → 7 when the planned crossing can be paid for (the chip turns gold)
      if (id === 'plan' && p?.kind === 'core' && p.card?.feasible && this.game.sim.canAfford?.(p.card.cost)) this.advance('cross');
      else if (id === 'plan' && p?.kind === 'core' && st.time % 10 === 0 && t.sub >= 1) { const el = document.querySelector('.dispatch[data-key="tut"] p'); if (el && !this.game.cinematic) { const k = this.ctx(); const html = `${this.savingText(k)}<br><button class="link-btn" data-skip>Skip tutorial</button>`; el.innerHTML = html; el.querySelector('[data-skip]').onclick = () => this.skip(); } }
      // step 7 without a plan (cancelled): back to planning
      else if (id === 'cross' && !p) { t.step = stepOf('plan'); t.sub = 0; this.showStep(); }
    }
    if (this.tut || !this.game.G.settings.hints) return;
    if (st.time % 5) return;
    const b = this.game.sim.breakdown(); const k = b.bottleneck?.kind;
    const now = st.time;
    const watch = (key, on) => { if (!on) { delete this.hintTimers[key]; return; } this.hintTimers[key] = this.hintTimers[key] ?? now; if (now - this.hintTimers[key] >= 60 && !this.hinted.has(key)) { this.hinted.add(key); this.hud.dispatch('juno', HINTS[key], { ttl: 9 }); } };
    watch('interchange', k === 'interchange');
    watch('unlinked', k === 'unlinked');
    watch('warp', k === 'warp');
    watch('line', k === 'line');
    watch('atlantis', !st.natives.includes('water') && st.time > 900 && !this.game.sim.s.tech?.seaStations);
  }
}
const clockOf = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
