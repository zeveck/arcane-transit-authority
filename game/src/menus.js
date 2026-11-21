// menus.js — the HTML menu screens: title, settings, How to Play, credits, pause, confirm.
import { icon } from './icons.js';
import { TYPE_COLORS } from './palette.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export function esc(s) { return String(s).replace(/>=/g, '≥').replace(/\bx(\d)/g, '×$1').replace(/ x /g, ' × ').replace(/->/g, '→').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function show(id) { const el = document.getElementById(id); if (el) el.hidden = false; return el; }
export function hide(id) { const el = document.getElementById(id); if (el) el.hidden = true; return el; }
export function isShown(id) { const el = document.getElementById(id); return !!el && !el.hidden; }

export const CONTROLS = [
  ['Left-drag, arrows or WASD', 'Spin the globe'],
  ['Wheel, + or −', 'Zoom (tilt follows zoom)'],
  ['Right-drag, Q / E', 'Tilt'],
  ['Left-click', 'Select a station, line or district'],
  ['R', 'Route tool: click A, click B, pick a card'],
  ['Enter', 'Build the highlighted card'],
  ['Tab', 'Open a card\'s details'],
  ['/', 'Places list'],
  ['B', 'Station tool (place one by hand)'],
  ['+ / −', 'Add or remove a train on the selected line'],
  ['C', 'Ride the selected line (any input exits)'],
  ['X', 'Demolish (click a district or drag across districts)'],
  ['G', 'Green: grove, park or attraction'],
  ['1 / 2', 'Brace / Reroute while a disaster warning shows'],
  ['V', 'X-ray'],
  ['O', 'Flow overlay'],
  ['Shift+1 … Shift+7', 'Show or hide each layer'],
  ['T', 'Tech tree'],
  ['K', 'Milestones'],
  ['Space', 'Pause / resume the clock'],
  ['F', 'Game speed 1x / 2x / 4x'],
  ['Ctrl+Z or U', 'Undo (within 10 s)'],
  ['Esc or right-click', 'Cancel the tool or selection'],
  ['Esc or P', 'Pause menu (Save to one of six slots, Load any save; every term in progress also keeps an Autosave)'],
  ['M', 'Mute'],
  ['Ctrl+Shift+F', 'Report a bug'],
];
export function controlsHtml() {
  return `<div class="keys">${CONTROLS.map(([k, v]) => `<span>${k.split(/( or |, | \/ | … )/).map((p) => /^( or |, | \/ | … )$/.test(p) ? `<span style="color:var(--dim)">${p}</span>` : `<kbd>${esc(p)}</kbd>`).join('')}</span><span>${esc(v)}</span>`).join('')}</div>`;
}

// ------------------------------------------------------------------ settings
export function renderSettings(ctx) {
  const s = ctx.settings();
  const el = document.getElementById('settings');
  const showReport = !!window.gameReport?.shown?.();
  el.innerHTML = `
    <div class="panel settings-panel" style="width:min(640px,94vw)">
      <div class="panel-head"><h2>Settings</h2><button class="icon-btn" data-act="back" aria-label="Back">${icon('close')}</button></div>
      <div class="settings-grid">
        <label for="vol-music">Music</label><input id="vol-music" type="range" min="0" max="1" step="0.05" value="${s.music}">
        <label for="vol-sound">Sound</label><input id="vol-sound" type="range" min="0" max="1" step="0.05" value="${s.sound}">
        <label>Mute</label><div class="seg" data-seg="muted"><button data-v="false" class="${!s.muted ? 'on' : ''}">Sound on</button><button data-v="true" class="${s.muted ? 'on' : ''}">Muted</button></div>
        <label>Graphics</label><div class="seg" data-seg="quality"><button data-v="low" class="${s.quality === 'low' ? 'on' : ''}">Low</button><button data-v="high" class="${s.quality !== 'low' ? 'on' : ''}">High</button></div>
        <label>Screen shake</label><div class="seg" data-seg="shake"><button data-v="true" class="${s.shake ? 'on' : ''}">On</button><button data-v="false" class="${!s.shake ? 'on' : ''}">Off</button></div>
        <label>Hints</label><div class="seg" data-seg="hints"><button data-v="true" class="${s.hints ? 'on' : ''}">On</button><button data-v="false" class="${!s.hints ? 'on' : ''}">Off</button></div>
      </div>
      <h3>Controls</h3>
      ${controlsHtml()}
      <div class="row wrap" style="margin-top:18px">
        ${showReport ? `<button class="btn small" data-act="report">${icon('bug')}Report a bug</button>` : ''}
        <button class="btn small danger" data-act="reset">Reset progress</button>
        <span class="spacer"></span>
        <button class="btn small center" data-act="back">Back</button>
      </div>
    </div>`;
  el.querySelector('#vol-music').oninput = (e) => ctx.setSetting('music', +e.target.value);
  el.querySelector('#vol-sound').oninput = (e) => ctx.setSetting('sound', +e.target.value);
  el.querySelectorAll('[data-seg]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      const k = seg.dataset.seg; let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false;
      ctx.setSetting(k, v); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); ctx.click();
    };
  }));
  el.querySelectorAll('[data-act=back]').forEach((b) => { b.onclick = () => ctx.back(); });
  const rb = el.querySelector('[data-act=report]'); if (rb) rb.onclick = () => window.gameReport?.open();
  el.querySelector('[data-act=reset]').onclick = () => ctx.confirm('Reset progress?', 'This clears your Merits, unlocks, Commended Charters and any term in progress. Settings stay.', 'Reset', () => ctx.resetProgress());
}

// ------------------------------------------------------------------ How to Play
const TYPE_TEXT = {
  surface: ['Surface (lightning)', 'Fast and cheapest to run. Rides a chrome maglev rail in a corridor of demolished blocks, so it must clear every city district it crosses. Can\'t cross the sea.'],
  sky: ['Sky (wind)', 'Cheapest to build, demolishes nothing. Arcs between Sky Ports on mountain peaks, 60 units apart at most (90 with Long Arcs). Meteors break it.'],
  water: ['Water', 'Runs along the sea floor between Sea Stations: coastal piers and Atlantis domes. The only way to serve Atlantis. Needs Sea Stations (tech) unless you start in the Brine.'],
  earth: ['Earth', 'Bores its own straight tunnel under anything, nothing to demolish. Slow, and the crust limits how far apart its ends can be (83° in most places, 64° in the Rift).'],
  fire: ['Fire (through the core)', 'Swims through the molten core between two Core Exchanges at least 60° apart, reached by earth shafts. The far side of the planet for a fair price.'],
  space: ['Space', 'Fastest and biggest, along the orbital ring between Space Elevators near the equator. Elevators are costly. Needs Space Elevators (tech) unless you start in the Ringside.'],
  deep: ['Deep space', 'Leaves from the Warp Terminal every 30 s carrying exports to the Homeworld. Its capacity is your Throughput ceiling.'],
};
export const HOWTO_PAGES = [
  { id: 'camera', title: 'Camera', hero: null, shot: 'camera', html: `
    <p>You're the Chief Engineer of the Arcane Transit Authority on Oikumene, a planet covered pole to pole in one city. Every district's goods must reach the <b>Warp Terminal</b> on the far side, where deep space trains carry them to the Homeworld.</p>
    <h3>Moving around</h3>
    <ul><li><b>Drag</b> with the left mouse button (or use the arrow keys or WASD) to spin the globe.</li>
    <li><b>Wheel</b> (or + and −) zooms; the camera tilts toward the horizon as you get close. Right-drag or Q / E tilts by hand.</li>
    <li><b>Click</b> a station, a line or a district to select it; the camera flies there.</li>
    <li><b>Places</b> (/) lists every station, peak, Atlantis dome and priority district, so nothing needs a precise click.</li></ul>` },
  { id: 'routes', title: 'Route cards', hero: null, shot: 'cards', html: `
    <p>The Route tool (R) is the heart of the game. <b>Click a place A, then a place B.</b> You're dealt one <b>route card</b> for each kind of route that can link them, always in the same order.</p>
    <ul><li>After you click A, stations on the far side of the planet show as markers you can click through the globe; <b>Pick from list</b> works too. <span class="nw">X-ray</span> (V) stays off unless you turn it on.</li>
    <li>Each card leads with its <b>cost</b> (stations, track, its trains and any demolition) and how many riders a minute it <b>carries</b>.</li>
    <li>A card that would let more exports reach the Terminal says so: <b>+N exports/min to the Terminal</b>.</li>
    <li>Hover a card to see its path on the globe; districts it would demolish are outlined in red. <b>Cheapest</b> and <b>Most capacity</b> tags help you compare.</li>
    <li>Click the card again (or press Enter) to build. The ley-rail grows and the first train glides out. <b>Undo</b> (Ctrl+Z) reverses a build within 10 seconds.</li>
    <li>Greyed cards say what's missing: a tech to unlock, or why the route can't work.</li></ul>` },
  { id: 'trains', shot: 'ride', title: 'The seven trains', hero: 'sky', html: '' },
  { id: 'core', shot: 'xray', title: 'Interchanges and the core', hero: 'xray', html: `
    <p>A station that serves more than one layer is an <b>interchange</b>. Two stations in the same or neighbouring districts are joined by a <b>walkway</b> automatically.</p>
    <ul><li>Riders and goods changing lines use the station's <b>transfer capacity</b>: 120 a minute for an ordinary station, 360 for a Core Exchange or Space Elevator. A ring around the station fills; red means full. Upgrade it (from $600) to double it.</li>
    <li><b>Through the core:</b> a Bore Station at each end sinks a shaft to a Core Exchange on the molten core; a fire train crosses between them. Earth down, fire across, earth up: the far side of the planet in about a minute and a half.</li>
    <li>Press <b>V</b> for <span class="nw">X-ray</span> to see bores, shafts and the core.</li></ul>` },
  { id: 'flow', shot: 'breakdown', title: 'Flow and bottlenecks', hero: 'ring', html: `
    <p>Stations joined by lines and walkways form a network. Only stations linked to the Warp Terminal make exports. <b>Throughput</b> (top bar) is exports launched in the last minute: the number your Quotas measure.</p>
    <ul><li>Press <b>O</b> for the flow overlay: busy ley-rails widen, brighten and pulse faster. White rings along a rail show how full it is: small and hollow is fine, large and flashing is full.</li>
    <li>Click the Throughput meter for the breakdown: exports made, reaching the Terminal and launched, and the <b>bottleneck</b>, named, with a Show me button.</li>
    <li>Fix it: add a train (+), upgrade an interchange, build a second route, or buy a tech (T).</li></ul>` },
  { id: 'green', shot: 'demolish', title: 'Demolish and green', hero: 'surface', html: `
    <p>Oikumene has no room to spare. <b>Demolish</b> (X) clears a district (its price rises with density); a cleared district makes no riders.</p>
    <ul><li><b>Green</b> (G) a cleared district: a tree grove (from $80, +5% to its neighbours) or a park (from $150, +10%).</li>
    <li>An <b>attraction</b> (from $1,500, next to a line) adds +30% within 2 districts: a Giant Wheel, a Fountain Plaza or a Monument to the Engineers.</li>
    <li>Surface lines leave a cleared corridor: the districts beside it are cheap to green. Greenery earns a grade star.</li></ul>` },
  { id: 'charters', shot: 'charters', title: 'Charters, quotas and grades', hero: 'globe', html: `
    <p>Each term is played under a <b>Homeworld Charter</b> with three Quotas. Meet Quota III and the Charter is <b>Commended</b>: the next Charter and a new starting region unlock.</p>
    <ul><li>Each Charter has a <b>mandate</b>, a rule that changes what you build first (Charter I funds your first route through the core).</li>
    <li>Quotas count when Throughput holds at the quota for two deep space departures in a row. Quotas I and II pay a cash bonus.</li>
    <li>Grade stars: Quota III before the Audit deadline; more money at the end than at the start; enough greenery.</li>
    <li>You may run into debt down to the Charter's limit; a minute below it and the term is over.</li>
    <li>Finishing a term earns <b>Merits</b> for the Merit Office: milestone cards, starting perks and train liveries.</li></ul>` },
  { id: 'disasters', shot: 'disaster', title: 'Disasters', hero: 'atlantis', html: `
    <p>Meteors, seaquakes, cave-ins, core flares, solar storms, blackouts and warp drift strike what you've built. Each gives a <b>15-second warning</b> (the game drops to 1x).</p>
    <ul><li><b>Show me</b> flies the camera there.</li>
    <li><b>Brace</b> (1) pays half the repair price now and halves the damage.</li>
    <li><b>Reroute</b> (2) closes the threatened line at once: nobody is lost, and it reopens when repaired.</li>
    <li>Do neither and riders on board a broken line are lost. <b>Repair all</b> fixes everything afterwards; techs prevent some disasters entirely.</li></ul>` },
  { id: 'controls', title: 'Controls', hero: null, html: '' },
];
export function renderHowto(ctx, pageId = 'camera') {
  const el = document.getElementById('howto');
  const idx = Math.max(0, HOWTO_PAGES.findIndex((p) => p.id === pageId));
  const p = HOWTO_PAGES[idx];
  let body = p.html;
  if (p.id === 'trains') {
    body = `<p>Seven elemental trains, each riding its own glowing <b>ley-rail</b> in its own colour, straight through its element.</p>
      <div class="typechips">${Object.entries(TYPE_TEXT).map(([k, [n, t]]) => `<div class="typechip"><b style="color:${TYPE_COLORS[k]}">${icon(k)}${n}</b>${t}</div>`).join('')}</div>
      <div class="howto-hero" style="background-image:url(assets/keyart/atlantis.jpg);height:120px"></div>
      <p>Surface, sky, earth, fire and deep space are open from the first term. Water and space come by tech, or free when you start in the Brine or the Ringside.</p>`;
  }
  if (p.id === 'controls') body = `<p>Everything works with the mouse and keyboard.</p>${controlsHtml()}`;
  const shot = p.shot ? `<img class="shot" src="assets/howto/${p.shot}.jpg" alt="" onerror="this.remove()">` : '';
  el.innerHTML = `
    <div class="panel howto-panel">
      <div class="howto-head"><h2>How to Play</h2><button class="icon-btn" data-act="back" aria-label="Close">${icon('close')}</button></div>
      <div class="howto-tabs">${HOWTO_PAGES.map((q, i) => `<button data-page="${q.id}" class="${i === idx ? 'on' : ''}">${q.title}</button>`).join('')}</div>
      <div class="howto-body">
        ${p.hero ? `<div class="howto-hero" style="background-image:url(assets/keyart/${p.hero}.jpg)"></div>` : ''}
        <h2 style="font-size:18px">${p.title}</h2>${body}${shot}
      </div>
      <div class="howto-foot">
        <button class="btn small" data-act="prev" ${idx === 0 ? 'disabled' : ''}>${icon('back')}Back</button>
        <button class="btn small" data-act="next" ${idx === HOWTO_PAGES.length - 1 ? 'disabled' : ''}>Next${icon('next')}</button>
        <span class="spacer"></span>
        ${ctx.canReplayTutorial() ? '<button class="btn small" data-act="tutorial">Replay Tutorial</button>' : ''}
        <button class="btn small center" data-act="back">Done</button>
      </div>
    </div>`;
  el.querySelectorAll('[data-page]').forEach((b) => { b.onclick = () => { ctx.click(); renderHowto(ctx, b.dataset.page); }; });
  el.querySelectorAll('[data-act=back]').forEach((b) => { b.onclick = () => ctx.back(); });
  el.querySelector('[data-act=prev]').onclick = () => { ctx.click(); renderHowto(ctx, HOWTO_PAGES[Math.max(0, idx - 1)].id); };
  el.querySelector('[data-act=next]').onclick = () => { ctx.click(); renderHowto(ctx, HOWTO_PAGES[Math.min(HOWTO_PAGES.length - 1, idx + 1)].id); };
  const tb = el.querySelector('[data-act=tutorial]'); if (tb) tb.onclick = () => ctx.replayTutorial();
  el.dataset.page = p.id;
}

// ------------------------------------------------------------------ credits
export function renderCredits(ctx) {
  const el = document.getElementById('credits');
  el.innerHTML = `
    <div class="panel credits-panel">
      <div class="logo"><span class="logo-ata">ATA</span><span class="logo-name">Arcane Transit Authority</span></div>
      <h3>The idea</h3><p>Rich Conlan</p>
      <h3>Made with</h3><p>gamegen: design, art, music, sound and code made by AI helpers</p>
      <p style="color:var(--dim);font-size:13px">Pictures by imagegen2 and nanogen, models by meshgen (Meshy), music and sound by audiogen (ElevenLabs)</p>
      <h3>Fonts</h3><p>ATA Display, a modified Orbitron (unslashed zero), © The Orbitron Project Authors · Exo 2, © The Exo 2 Project Authors</p>
      <p style="color:var(--dim);font-size:13px">Both under the SIL Open Font License 1.1 (fonts/OFL-Orbitron.txt, fonts/OFL-Exo2.txt)</p>
      <h3>Engine</h3><p>three.js, © three.js authors, MIT License</p>
      <div class="row" style="justify-content:center;margin-top:20px"><button class="btn small center" data-act="back">Back</button></div>
    </div>`;
  el.querySelector('[data-act=back]').onclick = () => ctx.back();
}

// ------------------------------------------------------------------ pause
export function renderPause(ctx) {
  const el = document.getElementById('pause');
  const showReport = !!window.gameReport?.shown?.();
  el.innerHTML = `
    <div class="panel pause-panel">
      <div class="panel-head"><h2>Paused</h2><button class="icon-btn" data-act="mute" aria-label="Mute (M)">${icon(ctx.muted() ? 'mute' : 'sound')}</button></div>
      <nav class="menu">
        <button class="btn primary" data-act="resume">${icon('play')}Resume</button>
        <button class="btn" data-act="howto">How to Play</button>
        <button class="btn" data-act="settings">Settings</button>
        ${showReport ? `<button class="btn" data-act="report">${icon('bug')}Report a bug</button>` : ''}
        <button class="btn" data-act="save">Save</button>
        <button class="btn" data-act="load">Load</button>
        <button class="btn" data-act="savequit">Save and Quit</button>
        <button class="btn danger" data-act="abandon">Abandon Term</button>
      </nav>
    </div>`;
  el.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => ctx.pauseAction(b.dataset.act); });
}

// ------------------------------------------------------------------ confirm
export function renderConfirm(title, text, okLabel, onOk, onCancel) {
  const el = document.getElementById('confirm');
  el.innerHTML = `<div class="panel confirm-panel"><h2>${esc(title)}</h2><p>${esc(text)}</p>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn small center" data-act="cancel">Cancel</button><button class="btn small primary center" data-act="ok">${esc(okLabel)}</button></div></div>`;
  el.hidden = false;
  el.querySelector('[data-act=ok]').onclick = () => { el.hidden = true; onOk?.(); };
  el.querySelector('[data-act=cancel]').onclick = () => { el.hidden = true; onCancel?.(); };
  el.querySelector('[data-act=ok]').focus();
}
