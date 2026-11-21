// story.js — dispatches from beyond the warp, Juno's tutorial (with the staged toolbar and the free
// through-the-core crossing), the Auditor's quota lines and Juno's hints.
import { termStream } from './rng.js';
import { cellMeta } from './planet.js';
import * as save from './save.js';
import * as audio from './audio.js';

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

// Juno's pacing: a step's instructions open no earlier than this game time (s); the design's "About" column
const OPEN = { 2: 60, 3: 150, 5: 330, 6: 420, 7: 510, 8: 600, 9: 630 };
// while a step waits, Juno points something out to watch or try (never a dead wait)
const INTERIM = {
  2: 'Your first Surface line is running! While it warms up, try <b>Ride</b>: click the yellow line, then press <kbd>C</kbd>. Any key brings you back.',
  3: 'Another train is running, and the line has room to spare. Spin the globe (drag, or the arrow keys) toward the far side: the <b>Warp Terminal</b> sits on the equator under the ring. That\'s where everything has to go.',
  5: 'Exports are flowing to the Terminal. Click the <b>Throughput</b> meter at the top to see how many are made, how many reach it and how many launch.',
  6: 'Watch the deep space trains leave the Terminal\'s launch ring, and the dispatches they bring back. Try <b class="nw">X-ray</b> (<kbd>V</kbd>) to see your shafts and the core.',
  7: 'Earth trains are slow but carry a lot. <b>Ride</b> one (click the green line, <kbd>C</kbd>) and the camera follows it underground.',
  8: 'The Sky Port joins the district below by a little walkway, see it? Ride the sky line for the view (<kbd>C</kbd>).',
  9: 'Have a look around. Next: the Tech tree.',
};
// what finishes each waiting step's suggestion, and what Juno says after it
const INTERIM_DONE = { 2: 'ride', 3: 'terminal', 5: 'breakdown', 6: 'xray', 7: 'ride', 8: 'ride' };
const INTERIM_IDLE = {
  2: 'Watch your trains run while the line warms up.',
  3: 'That\'s the Warp Terminal. Everything you build has to reach it.',
  5: 'Made, reaching, launched: when they differ, the readout names what limits you.',
  6: 'Shafts, bores and the molten core: that\'s <span class="nw">X-ray</span>. Press <kbd>V</kbd> again to come back up.',
  7: 'Slow, but they carry a lot. Dense? Dig.',
  8: 'Quite the view.',
  9: 'Have a look around while the next step gets ready.',
};
const ALL_TOOLS = ['route', 'places', 'flow', 'xray', 'demolish', 'green', 'tech', 'more'];
const STAGES = { 1: ['route', 'places'], 2: ['route', 'places', 'flow'], 3: ['route', 'places', 'flow', 'xray'], 5: ['route', 'places', 'flow', 'xray', 'demolish', 'green'], 8: ['route', 'places', 'flow', 'xray', 'demolish', 'green', 'tech'] };

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
    this.tut = tutorial && !save.meta().tutorialDone ? { step: story?.step ?? 1, sub: 0 } : (tutorial ? { step: story?.step ?? 1, sub: 0 } : null);
    if (this.tut && this.tut.step >= 10) this.tut = null;
    this.hud.refreshToolbar();
    if (this.tut) { const now = sim.s.time; if (OPEN[this.tut.step] && now < OPEN[this.tut.step]) { this.tut.waiting = OPEN[this.tut.step]; this.showInterim(); } else this.showStep(); }
    else if (!restored) {
      const ch = this.game.sim.state();
      const audit = ch.deadline == null ? 'Free play: no Audit, no deadline. Build as you like.' : `The Audit is in ${Math.round(ch.deadline / 60)} minutes. I will be watching. Fondly, but watching.`;
      setTimeout(() => this.game.playing && this.hud.dispatch('thrumm', `${ch.tutorial ? '' : `Charter ${ch.charter === 'G' ? 'Galactic' : ch.charter}${ch.deadline == null ? ', free play' : ''}.`} Quota I is ${ch.quotas[0]} exports a minute. ${audit}`, { ttl: 9 }), 2500);
    }
  }
  leave() { this.tut = null; this.hud.clearDispatch('tut'); }
  saveState() { return { next: this.next, departures: this.departures, step: this.tut?.step ?? 10, hinted: [...this.hinted] }; }
  stepId() { return this.tut ? this.tut.step : null; }

  // ------------------------------------------------------------------ toolbar staging
  visibleTools() {
    if (!this.tut) return ALL_TOOLS;
    let v = STAGES[1]; const st = this.tut.waiting ? this.tut.step - 1 : this.tut.step;
    for (const k of Object.keys(STAGES).map(Number).sort((a, b) => a - b)) if (st >= k) v = STAGES[k];
    return v;
  }
  toolAllowed(t) { if (t === 'station') return !this.tut; return this.visibleTools().includes(t) || t === 'route'; }
  cardAllowed(c) {
    if (!this.tut) return true;
    // the Homeworld's free crossing is kept for step 3: no core card before then
    if (c.kind === 'core' && (this.tut.step < 3 || (this.tut.step === 3 && this.tut.waiting))) { this.say('Hold the core crossing for a moment: the Homeworld will pay for it when we get there.'); return false; }
    if (this.tut.waiting) return true;
    if (this.tut.step === 1 && c.kind !== 'surface') { this.say('Pick the Surface card this time: it\'s the cheapest here.'); return false; }
    if (this.tut.step === 3 && c.kind !== 'core') { this.say('This time, go through the core: the Homeworld pays for it!'); return false; }
    return true;
  }

  // ------------------------------------------------------------------ tutorial
  say(text) { this.hud.dispatch('juno', text, { ttl: 6, key: 'tutnag' }); }
  showStep() {
    const t = this.tut; if (!t) return;
    const m = cellMeta(); const g = this.game; const city = g.G.city;
    const nm = (id) => g.cellName(id).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const S = {
      1: [`Welcome, Chief Engineer! I'm Juno, your dispatcher. Let's lay your first line. <b>Click the highlighted district</b>, ${nm(m.tutorial.a)}, then the one <b>four districts beyond it</b>.`, [m.tutorial.a, m.tutorial.b]],
      2: ['Lovely! When a line gets busy, more trains carry more riders. Practise it now: <b>click your new line</b> and press <kbd>+</kbd> (or the + in its panel) to <b>add a train</b>. Then try <b>Flow</b> (<kbd>O</kbd>) to see each line\'s load.', []],
      3: ['The <b>Warp Terminal</b> is on the far side of the planet. <b>Click your first station</b>, then the Terminal: it shows as a marker through the globe, or use <b>Pick from list</b>. The Homeworld funds your first crossing!', [m.tutorial.a]],
      4: ['Exports are streaming to the Terminal. Watch for the <b>first deep space train</b> to launch...', []],
      5: ['Demolishing makes room, and the room can grow back green. Press <kbd>G</kbd>, then <b>click a cleared district</b> (outlined green) on your Surface corridor to plant a park.', null],
      6: ['Now connect the <b>Capital</b>: click its centre, then your first station. Those blocks are dense. <b>Dense? Dig.</b>', [m.capitalCentre]],
      7: [`See the two peaks, <b>${nm(m.tutorial.peaks[0])}</b> and <b>${nm(m.tutorial.peaks[1])}</b>? Click one, then the other, and pick <b>Sky</b>: the cheapest line there is, and its Sky Port joins the district below by a walkway.`, m.tutorial.peaks],
      8: ['Up there: the <b>orbital ring</b>. Space Elevators, one day. And in the Brine\'s northern bay: <b>Atlantis</b>. Sea Stations in the <b>Tech</b> tree (<kbd>T</kbd>) reach them. Have a look!', m.tutorial.atlantis],
      9: ['Last step: meet <b>Quota I: 90 exports a minute</b>. Add trains where the load is high, and click the Throughput meter to see what limits you.', []],
    };
    // the free crossing already spent (a restored term): step 3 has nothing left to do
    if (t.step === 3 && this.crossingUsed()) { this.advance(4); return; }
    const [text, cells] = S[t.step] || ['', []];
    const el = this.hud.dispatch('juno', `${text}<br><button class="link-btn" data-skip>Skip tutorial</button>`, { sticky: true, key: 'tut' });
    el.classList.add('tut');
    el.querySelector('[data-skip]').onclick = () => this.skip();
    let outline = cells;
    if (t.step === 5) outline = g.sim.cells((c) => c.demolished && !c.green && !(c.stations?.length)).map((c) => c.id);
    city.outlineCells('tut', outline?.length ? outline : null, t.step === 5 ? '#7aa84a' : '#ffd9a0', { pulse: true, lift: 1.6 });
    this.hud.refreshToolbar();
    const hint = { 2: 'flow', 3: 'xray', 5: 'green', 8: 'tech' }[t.step];
    this.hud.highlightTool(hint, !!hint);
    if (t.step === 3) this.hud.highlightTool('places', true);
    // every step takes the camera to what Juno names (leaving a Ride first)
    if (g.ride) g.exitRide();
    if (t.step === 1) { const c = this.game.cells[m.tutorial.a], c2 = this.game.cells[m.tutorial.b]; g.G.cam.flyTo([c.lat * 0.4 + c2.lat * 0.6, c.lon * 0.4 + c2.lon * 0.6], 240, 1.6); } // a little toward B, so Juno's card (bottom left) never covers it
    else if (t.step === 2) this.frame([m.tutorial.a, m.tutorial.b], 230);
    else if (t.step === 3) this.frame([m.tutorial.a], 280);
    else if (t.step === 5) this.frame(outline?.length ? outline : [m.tutorial.a, m.tutorial.b], 230, true);
    else if (t.step === 6) this.frame([m.capitalCentre, m.tutorial.a], 240);
    else if (t.step === 7) this.frame(m.tutorial.peaks, 240, true);
    else if (t.step === 8) { const c = this.game.cells[m.tutorial.atlantis[0]]; g.G.cam.flyTo([c.lat, c.lon], 330, 2.0); }
    else if (t.step === 9) this.frame([m.capitalCentre, m.tutorial.a, m.tutorial.b], 300);
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
  advance(to = null) {
    if (!this.tut) return;
    this.hud.clearDispatch('tutnag'); // a reminder for the step just finished never lingers
    this.tut.step = to ?? this.tut.step + 1;
    audio.sfx('milestone-flip', { gain: 0.5 });
    if (this.tut.step >= 10) return this.finish();
    const now = this.game.sim?.s.time ?? 0;
    if (OPEN[this.tut.step] && now < OPEN[this.tut.step]) { this.tut.waiting = OPEN[this.tut.step]; this.showInterim(); return; }
    this.tut.waiting = null;
    this.showStep();
  }
  showInterim(done = false) {
    const t = this.tut; t.interimDone = done || !INTERIM_DONE[t.step];
    // the suggestion while waiting; once done (or when there's nothing to do) only the countdown and the F hint remain
    const text = t.interimDone ? (done ? '<b>Nice.</b> ' : '') + (INTERIM_IDLE[t.step] || 'Have a look around.') : INTERIM[t.step] || '';
    const el = this.hud.dispatch('juno', `${text}<br><span class="tut-wait">Next step in <b class="num" data-tutcount>${this.countdown()}</b> · <kbd>F</kbd> speeds up time</span><br><button class="link-btn" data-skip>Skip tutorial</button>`, { sticky: true, key: 'tut' });
    el.classList.add('tut');
    el.querySelector('[data-skip]').onclick = () => this.skip();
    this.game.G.city.outlineCells('tut', null);
    this.hud.highlightTool(null, false);
    this.hud.refreshToolbar();
  }
  countdown() { const t = this.tut; const left = Math.max(0, Math.ceil((t?.waiting ?? 0) - (this.game.sim?.s.time ?? 0))); return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; }
  /** The waiting step's suggestion was done (a Ride, X-ray, the breakdown, the Terminal on screen). */
  interim(kind) {
    const t = this.tut; if (!t?.waiting || t.interimDone) return;
    if (INTERIM_DONE[t.step] === kind || (Array.isArray(INTERIM_DONE[t.step]) && INTERIM_DONE[t.step].includes(kind))) this.showInterim(true);
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

  onPinA(place) {
    const t = this.tut; if (!t) return; const m = cellMeta();
    if (t.step === 1) {
      const cell = typeof place === 'number' ? place : null;
      if (cell === m.tutorial.a) { this.game.G.city.outlineCells('tut', [m.tutorial.b], '#ffd9a0', { pulse: true, lift: 1.6 }); }
    }
    if (t.step === 3) this.hud.highlightTool('places', true);
  }
  tutWantKind() { const t = this.tut; return t && !t.waiting ? ({ 1: 'surface', 3: 'core', 6: 'earth', 7: 'sky' })[t.step] || null : null; }
  crossingUsed() { const st = this.game.sim?.state(); return st?.firstCrossingUsed ?? !!this.game.sim?.lines().some((l) => l.type === 'fire'); }
  onCards(cards) {
    const t = this.tut; if (!t) return;
    const pick = { 1: 'surface', 3: 'core', 6: 'earth', 7: 'sky' }[t.step];
    if (pick && !t.waiting) this.hud.tutPickCard(pick);
    if (t.step === 1) this.say('Two cards you can build. <b>Surface</b> is cheapest: it clears a corridor of blocks. <b>Earth</b> digs underneath. Under dense blocks, dig. Remember that! For now, pick Surface.');
    if (t.step === 3) this.say('There it is: <b>Through the core, FREE</b>. Earth down a shaft, fire across the molten core, earth back up. Pick it!');
    if (t.step === 6) this.say('<b>Surface</b> demolishes those dense blocks and carries less. <b>Earth</b> keeps the blocks and carries more. Dense? Dig.');
  }
  onBuilt(e) {
    const t = this.tut; if (!t) return;
    if (t.step === 1 && e.kind === 'surface') this.advance(2);
    else if (t.step === 3 && e.kind === 'core') { /* advances after the cinematic */ this.hud.clearDispatch('tutnag'); }
    else if (t.step === 6) { const m = cellMeta(); const st = this.game.sim.stations(); if (e.stations?.some((id) => st.find((s) => s.id === id)?.cell === m.capitalCentre) || e.kind === 'earth' || e.kind === 'surface') this.advance(7); }
    else if (t.step === 7 && e.kind === 'sky') this.advance(8);
  }
  afterCrossing() { if (this.tut?.step === 3) this.advance(4); this.hud.dispatch('juno', 'Down the shaft, across the core, up the far side. You just put a train through a planet. Not bad for a Tuesday.', { ttl: 8 }); }
  onAction(a, res) {
    const t = this.tut; if (!t) return;
    if (t.step === 2 && a.type === 'addTrain') { this.trainAdded = true; if (this.game.flow) this.advance(3); else this.say('Another train on the line! Now press <b>Flow</b> (<kbd>O</kbd>) to see how full the line is.'); }
    if (t.step === 5 && a.type === 'green') this.advance(6);
  }
  onFlow(on) { if (this.tut?.step === 2 && on && this.trainAdded) this.advance(3); }
  onTech() { if (this.tut?.step === 8) setTimeout(() => this.tut?.step === 8 && this.advance(9), 600); }
  onTap() {}
  onPlaces() {}
  onDeparture(e) {
    this.departures++;
    if (e?.firstExports) { setTimeout(() => this.game.playing && this.hud.dispatch('conductor', FIRST_EXPORTS, { ttl: 9 }), 6000); if (this.tut?.step === 4) this.advance(5); return; }
    if (this.tut?.step === 4) { this.advance(5); return; }
    // the Conductor's dispatch on every 4th returning train
    if (!this.tut && this.departures % 4 === 2) {
      const ch = this.charter === 'G' ? 'VI' : this.charter;
      const list = DISPATCHES[ch] || DISPATCHES.I;
      const i = this.order[this.next % 10]; this.next++;
      setTimeout(() => this.game.playing && this.hud.dispatch('conductor', list[i], { ttl: 9 }), 6000);
    }
  }
  onQuota(e) {
    if (this.tut && e.quota === 1) { this.advance(10); return; }
    this.hud.dispatch('thrumm', QUOTA_LINES[e.quota - 1], { ttl: 8 });
  }

  // ------------------------------------------------------------------ hints (60 s of the same trouble)
  tick(st) {
    if (this.tut?.waiting && st.time >= this.tut.waiting) { this.tut.waiting = null; this.showStep(); }
    else if (this.tut?.waiting) {
      const c = document.querySelector('.dispatch[data-key="tut"] [data-tutcount]'); if (c) c.textContent = this.countdown();
      // step 3's suggestion: spin until the Warp Terminal is in view
      if (this.tut.step === 3 && !this.tut.interimDone) { const cam = this.game.G.camera.position.clone().normalize(); const tc = this.game.cells[cellMeta().terminal].pos; if (cam.x * tc[0] + cam.y * tc[1] + cam.z * tc[2] > 0.75) this.interim('terminal'); }
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
