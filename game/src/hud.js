// hud.js — the in-play HTML HUD: top bar (money, Throughput meter with the next Quota, Audit timer, pause,
// speed, menu), the staged toolbar, the right-hand column (route cards, selection panels, Places, the
// Throughput breakdown, tool pickers, layer filter), the route banner, dispatches, milestone chips, disaster
// banners, toasts and Undo, money pop-ups, far-side station markers, the tech tree screen.
import * as THREE from 'three';
import { icon } from './icons.js';
import { TYPE_COLORS, TYPE_ORDER, TYPE_NAMES } from './palette.js';
import { CHARTERS, REGIONS, GREEN, TECH_BRANCHES, TECH, DISASTERS } from './tuning.js';
import { esc } from './menus.js';
import * as audio from './audio.js';
import { fmtMoney, fmtRate } from './fmt.js';

const $ = (s, el = document) => el.querySelector(s);
const money = (v) => fmtMoney(v);
const samePlace = (a, b) => (a != null && typeof a === 'object' ? !!b && typeof b === 'object' && a.station === b.station : a === b);
const clock = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const KIND_ICON = { surface: 'surface', sky: 'sky', water: 'water', earth: 'earth', core: 'fire', space: 'space', hybrid: 'hybrid' };
const KIND_NAME = { surface: 'Surface', sky: 'Sky', water: 'Water', earth: 'Earth', core: 'Through the core', space: 'Space', hybrid: 'Hybrid' };
const KIND_COLOR = { surface: TYPE_COLORS.surface, sky: TYPE_COLORS.sky, water: TYPE_COLORS.water, earth: TYPE_COLORS.earth, core: TYPE_COLORS.fire, space: TYPE_COLORS.space, hybrid: '#c9d2e3' };
const TOOLS = [
  ['route', 'route', 'Route', 'R'], ['places', 'places', 'Places', '/'], ['flow', 'flow', 'Flow', 'O'], ['xray', 'xray', 'X-ray', 'V'],
  ['demolish', 'demolish', 'Demolish', 'X'], ['green', 'green', 'Green', 'G'], ['tech', 'tech', 'Tech', 'T'], ['more', 'more', 'More', ''],
];

// lengths are told in miles (1 world unit = 50 miles); the sim gives lengthMiles where it can
const miles = (u) => `${Math.round(u * 50).toLocaleString('en-US')} miles`;

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud-root');
    this.root.dataset.screen = 'play';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="pops"></div>
      <div class="markers"></div>
      <div class="topbar">
        <div class="tb-cell tb-money" title="Money"><span class="ic-wrap">${icon('money')}</span><span class="num" data-k="money">${fmtMoney(0)}</span><span class="sub" data-k="mpm"></span></div>
        <button class="tb-cell tb-meter" data-act="breakdown" title="Throughput (click for the breakdown)">
          <span class="ic-wrap">${icon('throughput')}</span>
          <span class="meter-col"><span class="meter-label"><span class="num" data-k="tp">0</span><span class="sub">/min</span><span class="sub" data-k="quota">Quota I: 90</span></span>
          <span class="meter"><span class="meter-fill" data-k="fill"></span><span class="meter-mark" data-k="mark"></span></span></span>
        </button>
        <div class="tb-cell tb-timer" title="Audit deadline"><span class="ic-wrap">${icon('timer')}</span><span class="num" data-k="timer">45:00</span><span class="sub" data-k="charter">Charter I</span></div>
        <span class="spacer"></span>
        <button class="icon-btn" data-act="pause" title="Pause (Space)" aria-label="Pause">${icon('pause')}</button>
        <button class="icon-btn speed-btn" data-act="speed" title="Speed (F)" aria-label="Speed"><span class="num" data-k="speed">1x</span></button>
        <button class="icon-btn" data-act="menu" title="Menu (Esc)" aria-label="Menu">${icon('menu')}</button>
      </div>
      <div class="plan-chip" hidden><button class="pc-main" data-act="plan-show" title="The planned project (click to show it)"><span class="pc-ic">${icon('pin')}</span><span class="pc-txt"><b data-k="pc-name"></b> <span class="num" data-k="pc-money"></span><span class="pc-eta" data-k="pc-eta"></span><span class="pc-held" data-k="pc-held"></span></span></button><button class="btn small primary pc-build" data-act="plan-build" hidden>Build</button><button class="icon-btn small" data-act="plan-cancel" aria-label="Cancel the plan" title="Cancel the plan">${icon('close')}</button></div>
      <button class="limit-chip" data-act="limit" hidden title="The current limit on exports (click to show it)">${icon('warning')}<span data-k="limit"></span></button>
      <div class="route-banner" hidden><span data-k="rb-text"></span><button class="btn small" data-act="places">${icon('places')}Pick from list</button><button class="icon-btn small" data-act="cancel" aria-label="Cancel (Esc)">${icon('close')}</button></div>
      <div class="ms-chips"></div>
      <div class="dispatches"></div>
      <div class="disaster" hidden></div>
      <div class="right-col"></div>
      <div class="toolbar"></div>
      <div class="toasts"></div>
      <div class="undo-toast" hidden><span>Built.</span><button class="btn small" data-act="undo">${icon('undo')}Undo <kbd>Ctrl+Z</kbd></button><span class="undo-time num"></span></div>
      <div class="tooltip" hidden></div>
      <div class="ride-banner" hidden></div>
      <div class="letterbox" hidden><div></div><div></div><span class="skip">Esc to skip</span></div>
      <div class="cine-caption" hidden></div>
      <div class="paused-badge" hidden>${icon('pause')}Paused · Space to resume</div>
    `;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.rightCol = $('.right-col', this.root);
    this.panel = null; this.panels = [];
    this.lastVals = {};
    this.popList = [];
    this.buildToolbar();
  }
  set(k, v) { if (this.lastVals[k] === v) return; this.lastVals[k] = v; const el = this.root.querySelector(`[data-k="${k}"]`); if (el) el.textContent = v; }

  enter(st) {
    this.root.hidden = false;
    this.limitAt = null; this.limitTarget = null; const lc = $('.limit-chip', this.root); if (lc) lc.hidden = true;
    this.lastPlanReady = null; const pc = $('.plan-chip', this.root); if (pc) pc.hidden = true;
    this.setCinematic(false); // never carry the finale's (or a cinematic's) hidden HUD into a term
    this.rightCol.innerHTML = ''; this.panels = [];
    $('.dispatches', this.root).innerHTML = ''; $('.toasts', this.root).innerHTML = '';
    $('.disaster', this.root).hidden = true; this.disaster = null;
    this.lastVals = {};
    this.buildToolbar();
    this.buildMilestones();
    this.tick(st);
    this.updateSpeed(); this.updateToggles(); this.updateTool(); this.updateRouteBanner();
  }
  leave() { this.root.hidden = true; this.rightCol.innerHTML = ''; this.panels = []; $('.markers', this.root).innerHTML = ''; $('.pops', this.root).innerHTML = ''; this.popList = []; }

  // ------------------------------------------------------------------ top bar
  tick(st) {
    if (!st) return;
    this.set('money', money(st.money));
    this.set('mpm', fmtRate(st.moneyPerMin || 0, { sign: true }));
    const mEl = this.root.querySelector('.tb-money'); mEl.classList.toggle('neg', st.money < 0);
    this.set('tp', String(Math.round(st.throughput)));
    const q = st.quotas || [90, 240, 360]; const stage = st.quotaStage || 0;
    const next = stage < 3 ? q[stage] : q[2];
    this.set('quota', stage < 3 ? `Quota ${['I', 'II', 'III'][stage]}: ${next}` : 'Commended');
    const scaleMax = Math.max(next * 1.25, st.throughput * 1.05, 1);
    this.root.querySelector('[data-k=fill]').style.width = `${Math.min(100, st.throughput / scaleMax * 100)}%`;
    this.root.querySelector('[data-k=mark]').style.left = `${next / scaleMax * 100}%`;
    this.root.querySelector('.tb-meter').classList.toggle('met', st.throughput >= next);
    const left = (st.deadline ?? 0) - (st.time ?? 0);
    this.set('timer', st.deadline == null ? 'Free play' : st.overtime ? `OT ${clock(left + 15 * 60)}` : clock(left));
    const tm = this.root.querySelector('.tb-timer'); tm.classList.toggle('warn', st.overtime || left < 300); tm.classList.toggle('ot', !!st.overtime);
    tm.title = st.deadline == null ? 'Free play: no deadline' : st.overtime ? 'Overtime: reach Quota III before this runs out' : 'Time to the Audit deadline';
    this.set('charter', st.tutorial && this.game.story?.tut ? 'Tutorial' : st.charter === 'G' ? 'Charter Galactic' : (CHARTERS[st.charter]?.name || '')); // after Skip tutorial (or its end) it's a Charter I term
    if (st.time !== this.limitAt && (st.time % 3 === 0 || this.limitAt == null)) { this.limitAt = st.time; this.updateLimit(); }
    this.updatePlan(st);
    if (this.panel?.kind === 'breakdown') this.renderBreakdown();
    else if (this.panel?.kind === 'line' || this.panel?.kind === 'station') this.refreshPanelNumbers();
    this.updateMilestones();
    this.disasterRefresh();
    this.updateUndo();
    this.stackBanners();
  }
  updateSpeed() {
    const g = this.game; const p = g.isPaused() && g.pauseReasons.has('user');
    this.set('speed', `${g.speed()}x`);
    const pb = this.root.querySelector('[data-act=pause]'); const want = p ? 'play' : 'pause';
    if (pb.dataset.ic !== want) { pb.dataset.ic = want; pb.innerHTML = icon(want); pb.title = p ? 'Resume (Space)' : 'Pause (Space)'; }
    this.root.querySelector('.paused-badge').hidden = !p;
  }
  updateMute() {}

  // ------------------------------------------------------------------ toolbar (staged)
  buildToolbar() {
    const tb = $('.toolbar', this.root);
    const vis = this.game.story?.visibleTools?.() || TOOLS.map((t) => t[0]);
    const key = vis.join(',');
    if (tb.dataset.key === key) return;
    tb.dataset.key = key;
    tb.innerHTML = TOOLS.filter(([id]) => vis.includes(id)).map(([id, ic, label, k]) => `<button class="tool" data-tool="${id}" title="${label}${k ? ` (${k})` : ''}">${icon(ic)}<span>${label}</span>${k ? `<kbd>${k}</kbd>` : ''}</button>`).join('');
    tb.querySelectorAll('.tool').forEach((b, i) => { b.style.animationDelay = `${i * 0.03}s`; });
    this.updateTool(); this.updateToggles();
  }
  refreshToolbar() { this.buildToolbar(); }
  updateTool() {
    const t = this.game.tool;
    this.root.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t || (b.dataset.tool === 'flow' && this.game.flow) || (b.dataset.tool === 'xray' && this.game.xrayUser)));
    if (t === 'green') this.openGreenPicker(); else this.closePanel('green');
    if (t === 'station') this.openStationPicker(); else this.closePanel('stationTool');
    if (t === 'demolish') this.toast('Demolish: click a district, or drag across several. Right-click or Esc to stop.', 'info', 'tool');
  }
  updateToggles() {
    this.root.querySelectorAll('.tool').forEach((b) => {
      if (b.dataset.tool === 'flow') b.classList.toggle('on', this.game.flow);
      if (b.dataset.tool === 'xray') b.classList.toggle('on', this.game.xrayUser);
    });
    if (this.panel?.kind === 'layers') this.renderLayers();
  }
  highlightTool(id, on) { this.root.querySelectorAll('.tool').forEach((b) => b.classList.toggle('hint', on && b.dataset.tool === id)); }

  onClick(e) {
    const g = this.game;
    const tool = e.target.closest('[data-tool]');
    if (tool) {
      audio.unlockAudio();
      const id = tool.dataset.tool;
      if (id === 'route' || id === 'demolish' || id === 'green') g.setTool(id);
      else if (id === 'places') this.openPlaces();
      else if (id === 'flow') g.setFlow();
      else if (id === 'xray') g.setXray();
      else if (id === 'tech') this.openTech();
      else if (id === 'more') this.openMore();
      return;
    }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    switch (act) {
      case 'pause': audio.sfx('ui-tool'); if (g.isPaused() && g.pauseReasons.has('user')) g.setPaused(false, 'user'); else g.setPaused(true, 'user'); break;
      case 'speed': g.cycleSpeed(); break;
      case 'menu': g.G.openPause(); break;
      case 'breakdown': this.togglePanel('breakdown'); break;
      case 'limit': { const t = this.limitTarget; if (t) { const sel = t.line != null ? { kind: 'line', id: t.line } : { kind: 'station', id: t.station }; g.select(sel); g.flyToSelection(sel); audio.sfx('ui-click'); } else this.togglePanel('breakdown'); break; }
      case 'places': this.openPlaces(); break;
      case 'plan-build': g.buildPlan(); break;
      case 'plan-cancel': g.cancelPlan(); break;
      case 'plan-show': audio.sfx('ui-click'); g.showPlan(); break;
      case 'through': g.rideOnThrough(); break;
      case 'cancel': g.cancel(); break;
      case 'undo': g.undo(); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ right column panels
  /** Open a panel of a kind (replacing the current one). */
  openPanel(kind, html, data = {}) {
    let el = this.rightCol.querySelector('.rpanel');
    if (!el) { el = document.createElement('div'); el.className = 'rpanel panel'; this.rightCol.appendChild(el); }
    el.dataset.kind = kind; el.innerHTML = html;
    this.panel = { kind, el, ...data };
    el.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { audio.sfx('ui-cancel'); this.closePanel(); if (kind === 'cards') this.game.clearRoute(); if (kind === 'line' || kind === 'station' || kind === 'cell') this.game.select(null); }; });
    return el;
  }
  closePanel(kind = null) {
    if (!this.panel) return false;
    if (kind && this.panel.kind !== kind) return false;
    this.panel.el.remove(); this.panel = null; return true;
  }
  closeTopPanel() {
    if (!this.panel) return false;
    const k = this.panel.kind;
    if (k === 'line' || k === 'station' || k === 'cell') return false; // selection panels close via select(null)
    this.closePanel();
    return true;
  }
  togglePanel(kind) { if (this.panel?.kind === kind) { this.closePanel(); audio.sfx('ui-cancel'); } else if (kind === 'breakdown') { this.renderBreakdown(); audio.sfx('ui-click'); this.game.story?.interim?.('breakdown'); } }
  head(title, ic = null, color = null) { return `<div class="rp-head">${ic ? `<span class="rp-ic" style="${color ? `color:${color}` : ''}">${icon(ic)}</span>` : ''}<h3>${title}</h3><button class="icon-btn small" data-close aria-label="Close">${icon('close')}</button></div>`; }

  // --- route cards
  openCards(cards) {
    const g = this.game;
    const html = `${this.head('Route cards', 'route')}
      <div class="rp-sub">${esc(g.placeLabel(g.route.a))} <span class="arrow">${icon('next')}</span> ${esc(g.placeLabel(g.route.b))}</div>
      <div class="cards">${cards.map((c, i) => this.cardHtml(c, i)).join('')}</div>
      <div class="rp-hint">Hover or click a card to preview it on the globe; <b>Build</b> (or <kbd>Enter</kbd>) builds it, <b>Plan it</b> pins it to save up for. <kbd>Tab</kbd> shows details.</div>`;
    const el = this.openPanel('cards', html);
    el.querySelectorAll('.rcard').forEach((cEl) => {
      const i = +cEl.dataset.i;
      cEl.addEventListener('pointerenter', () => { if (g.route.hi !== i) g.highlightCard(i); });
      cEl.addEventListener('click', (e) => {
        if (e.target.closest('.rc-more')) { cEl.classList.toggle('open'); audio.sfx('ui-click'); return; }
        if (e.target.closest('[data-tech]')) { this.openTech(e.target.closest('[data-tech]').dataset.tech); return; }
        if (e.target.closest('[data-plan]')) { g.planCard(i); return; }
        if (e.target.closest('.rc-planned')) return;
        if (e.target.closest('[data-build]') || g.route.hi === i) g.buildCard(i); else { g.highlightCard(i); audio.sfx('ui-click'); }
      });
    });
    // the keyboard highlight starts on the card the tutorial asks for, else the first one that can be built
    const want = g.story?.tutWantKind?.();
    let first = want ? cards.findIndex((c) => c.kind === want && c.feasible) : -1;
    if (first < 0) first = cards.findIndex((c) => c.feasible);
    if (first >= 0) g.highlightCard(first);
  }
  cardHtml(c, i) {
    const col = KIND_COLOR[c.kind];
    const tags = (c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    if (!c.feasible) {
      return `<div class="rcard off" data-i="${i}" style="--tc:${col}"><div class="rc-top"><span class="rc-ic">${icon(c.locked ? 'lock' : KIND_ICON[c.kind])}</span><b>${KIND_NAME[c.kind]}</b></div>
        <div class="rc-line">${esc(c.line || c.reason || '')}${c.locked && c.lockTech ? ` <button class="btn small" data-tech="${c.lockTech}">Open Tech</button>` : ''}</div></div>`;
    }
    const b = c.breakdown || {};
    const g = this.game; const afford = g.sim?.canAfford ? g.sim.canAfford(c.cost) : true;
    const plan = g.plan && g.plan.kind === c.kind && samePlace(g.plan.a, g.route.a) && samePlace(g.plan.b, g.route.b);
    const legs = (c.legs || []).map((l) => `<li><span style="color:${TYPE_COLORS[l.type]}">${l.shaft ? 'Shaft' : TYPE_NAMES[l.type]}</span> ${l.lengthMiles != null ? Math.round(l.lengthMiles).toLocaleString('en-US') + ' miles' : miles(l.length)} · ${Math.round(l.time)} s · ${Math.round(l.capacity)}/min${l.isNew ? '' : ' (existing)'}</li>`).join('');
    const tr = (c.transfers || []).map((t) => `<li>Transfer at ${t.station != null ? esc(this.game.stationName(t.station)) : t.kind}: ${Math.round(t.capacity)}/min</li>`).join('');
    return `<div class="rcard" data-i="${i}" style="--tc:${col}">
      <div class="rc-top"><span class="rc-ic">${icon(KIND_ICON[c.kind])}</span><b>${KIND_NAME[c.kind]}</b>${tags}</div>
      <div class="rc-nums"><span class="big num">${money(c.cost)}</span><span class="big num carries">carries ${Math.round(c.carries)}<small>/min</small></span></div>
      ${this.demolitionLine(c)}
      ${this.exportsLine(c)}
      ${c.line && !/^(demolishes|free)/i.test(c.line) ? `<div class="rc-line">${esc(c.line)}</div>` : ''}
      <div class="rc-details">
        <ul class="price-list">
          <li><span>Track</span><b class="num">${money(b.track || 0)}</b></li>
          <li><span>Stations</span><b class="num">${money(b.stations || 0)}</b></li>
          <li><span>Trains</span><b class="num">${money(b.trains || 0)}</b></li>
          ${b.demolition ? `<li><span>Demolition (${b.blocks} block${b.blocks === 1 ? '' : 's'})</span><b class="num">${money(b.demolition)}</b></li>` : ''}
        </ul>
        <ul>
          <li>${c.trackMiles ? `${Math.round(c.trackMiles).toLocaleString('en-US')} miles of track · ` : ''}Trip A to B: ${Math.round(c.tripTime || 0)} s · Running cost ${fmtRate(c.runningCost || 0)}</li>
          ${legs}${tr}
          ${c.bestAt ? `<li class="best">${esc(c.bestAt)}</li>` : ''}
        </ul>
      </div>
      <div class="rc-foot"><button class="rc-more" aria-label="Details">${icon('down')} Details</button><span class="spacer"></span>${plan ? '<span class="rc-planned">Planned</span>' : `<button class="btn small" data-plan title="Pin this card: its ghost stays on the globe and a chip counts the money down">${icon('pin')}Plan it</button>`}<button class="btn small primary" data-build ${afford ? '' : 'disabled title="Not enough money yet: Plan it to save up"'}>Build</button></div>
    </div>`;
  }
  /** Every card says what it does for exports: the gain, and why it's nothing (or next to nothing) when it is. */
  exportsLine(c) {
    const gain = Math.round(c.exportsGain || 0);
    if (gain >= 3) return `<div class="rc-exp">+${gain} exports/min to the Terminal${c.demolishes ? ' (after demolition)' : ''}</div>`;
    const note = c.exportsNote ? `: ${esc(c.exportsNote)}` : '';
    return `<div class="rc-exp low">+${Math.max(0, gain)} exports/min${note}</div>`;
  }
  /** The red line: what the blocks a card clears produce now, and what its new stations would have served there. */
  demolitionLine(c) {
    const n = c.demolishes || 0; if (!n) return '';
    const blocks = `${n} block${n === 1 ? '' : 's'}`;
    const r = Math.round(c.ridersLost || 0), x = Math.round(c.exportsLost || 0);
    if (!r && !x) return `<div class="rc-demo">demolishes ${n} unserved block${n === 1 ? '' : 's'}</div>`;
    const parts = [r ? `−${r} riders/min` : '', x ? `−${x} exports/min` : ''].filter(Boolean).join(', ');
    return `<div class="rc-demo">demolishes ${blocks}: ${parts}</div>`;
  }
  highlightCard(i) { this.panel?.el?.querySelectorAll('.rcard').forEach((c) => c.classList.toggle('hi', +c.dataset.i === i)); const el = this.panel?.el?.querySelector(`.rcard[data-i="${i}"]`); el?.scrollIntoView?.({ block: 'nearest' }); }
  /** Tutorial: mark the card Juno asks for (and preview it). */
  tutPickCard(kind) {
    const i = this.game.route.cards?.findIndex((c) => c.kind === kind && c.feasible) ?? -1;
    this.panel?.el?.querySelectorAll('.rcard').forEach((c) => c.classList.toggle('tut-pick', +c.dataset.i === i));
    if (i >= 0) this.game.highlightCard(i);
  }
  toggleDetails() { const el = this.panel?.el?.querySelector('.rcard.hi'); if (el) { el.classList.toggle('open'); audio.sfx('ui-click'); } }
  closeCards() { this.closePanel('cards'); }

  // --- route banner
  updateRouteBanner() {
    const g = this.game; const b = $('.route-banner', this.root);
    const show = g.playing && g.tool === 'route' && g.route.a != null && !g.route.cards;
    b.hidden = !show;
    if (show) this.set('rb-text', `A: ${g.placeLabel(g.route.a)}. Now click place\u00a0B.`);
    this.stackBanners();
    this.updateMarkers();
  }
  /** Far-side stations as HTML markers while picking B. */
  updateMarkers() {
    const g = this.game; const box = $('.markers', this.root);
    const on = g.playing && g.tool === 'route' && g.route.a != null && !g.route.cards;
    if (!on) { if (box.childElementCount) box.innerHTML = ''; this.markerEls = null; return; }
    if (!this.markerEls) {
      box.innerHTML = '';
      this.markerEls = [];
      for (const s of g.sim.stations()) {
        if (s.kind === 'core') continue;
        const el = document.createElement('button'); el.className = 'hud-marker'; el.title = g.stationName(s); el.dataset.station = String(s.id); el.hidden = true; // frameMarkers places and shows it
        const ty = s.kind === 'terminal' ? 'deep' : s.layers[0] || 'surface';
        el.style.setProperty('--tc', TYPE_COLORS[ty]);
        el.innerHTML = icon(s.kind === 'terminal' ? 'terminal' : 'station');
        el.onclick = (e) => { e.stopPropagation(); g.routeTap({ station: s.id }); };
        box.appendChild(el); this.markerEls.push({ el, s });
      }
    }
  }
  frameMarkers() {
    if (!this.markerEls) return;
    const g = this.game;
    for (const m of this.markerEls) {
      const p = m.s.kind === 'terminal' ? new THREE.Vector3(...g.cells[m.s.cell].pos).multiplyScalar(104) : new THREE.Vector3(...m.s.pos);
      const sp = g.screenOf(p, { skipOcclusion: true });
      const occl = !g.screenOf(p).visible;
      const show = sp.visible && occl; // near-side stations are picked on the globe itself
      m.el.hidden = !show;
      if (show) m.el.style.transform = `translate(${sp.x - 14}px, ${sp.y - 14}px)`;
    }
  }

  // --- selection panels
  showSelection(sel) {
    if (!sel) { if (this.panel && ['line', 'station', 'cell'].includes(this.panel.kind)) this.closePanel(); return; }
    if (sel.kind === 'line') this.renderLine(sel.id);
    else if (sel.kind === 'station') this.renderStation(sel.id);
    else if (sel.kind === 'cell') this.renderCell(sel.id);
  }
  refreshPanel() { const s = this.game.selection; if (s && this.panel && this.panel.kind === s.kind) this.showSelection(s); }
  refreshPanelNumbers() { this.refreshPanel(); }
  renderLine(id) {
    const g = this.game; const l = g.sim.lines().find((x) => x.id === id); if (!l) return;
    const name = g.lineName(l);
    const st = (x) => { const s = g.sim.stations().find((q) => q.id === x); return s ? g.stationName(s) : '—'; };
    const income = l.income ?? 0;
    const status = l.broken ? `<div class="warn-line">${icon('warning')} Broken by ${esc(DISASTERS[l.broken.by]?.name || 'a disaster')} · ${l.broken.repairAt != null ? `repairing, back in ${Math.max(0, Math.ceil(l.broken.repairAt - g.sim.s.time))} s` : `repair ${money(l.broken.cost || 0)}`}</div>` : l.closed || !l.open ? `<div class="warn-line">${icon('warning')} Closed</div>` : '';
    const html = `${this.head(esc(name), l.type, TYPE_COLORS[l.type])}
      <div class="rp-sub">${esc(st(l.a))} ↔ ${esc(st(l.b))}${l.inherited ? ' · inherited' : ''}</div>
      ${status}
      <div class="stats">
        <div><span>Load</span><b class="num">${Math.round((l.load || 0) * 100)}%</b></div>
        <div><span>Flow</span><b class="num">${Math.round(l.flow || 0)}/min</b></div>
        <div><span>Carries</span><b class="num">${Math.round(l.capacity || 0)}/min</b></div>
        <div><span>Running cost</span><b class="num">${fmtRate(l.runningCost ?? l.upkeep ?? 0)}</b></div>
        <div><span>Length</span><b class="num">${l.lengthMiles != null ? Math.round(l.lengthMiles).toLocaleString('en-US') + ' miles' : miles(l.length)}</b></div>
        <div><span>Trip</span><b class="num">${Math.round(l.time)} s</b></div>
        ${l.waiting != null ? `<div><span>Waiting</span><b class="num">${Math.round(l.waiting)}</b></div>` : ''}
        ${l.turnedAway != null ? `<div><span>Turned away</span><b class="num">${Math.round(l.turnedAway)}</b></div>` : ''}
        ${income ? `<div><span>Income</span><b class="num">${fmtRate(income)}</b></div>` : ''}
      </div>
      <div class="row trains-row"><span>Trains</span><button class="icon-btn small" data-a="rm" aria-label="Remove a train (−)">${icon('minus')}</button><b class="num">${l.trains}</b><button class="icon-btn small" data-a="add" aria-label="Add a train (+)">${icon('plus')}</button><span class="sub">× ${l.cars} cars</span></div>
      <div class="row wrap" style="margin-top:10px">
        <button class="btn small" data-a="ride">${icon('ride')}Ride <kbd>C</kbd></button>
        ${l.broken ? `<button class="btn small primary" data-a="repair">${icon('wrench')}Repair ${money(l.broken.cost || 0)}</button>` : ''}
        ${!l.broken ? `<button class="btn small" data-a="${l.closed || !l.open ? 'open' : 'close'}">${l.closed || !l.open ? 'Reopen' : 'Close line'}</button>` : ''}
        <button class="btn small" data-a="fly">${icon('eye')}Show</button>
      </div>`;
    const el = this.openPanel('line', html, { id });
    el.querySelector('[data-a=add]').onclick = () => g.act({ type: 'addTrain', line: id }, 'build-train-add');
    el.querySelector('[data-a=rm]').onclick = () => { const r = g.act({ type: 'removeTrain', line: id }); if (r.ok) audio.sfx('build-train-add', { reverse: true }); };
    el.querySelector('[data-a=ride]').onclick = () => g.startRide(id);
    el.querySelector('[data-a=fly]').onclick = () => g.flyToSelection({ kind: 'line', id });
    const rp = el.querySelector('[data-a=repair]'); if (rp) rp.onclick = () => g.act({ type: 'repair', line: id }, 'repair-clank');
    const oc = el.querySelector('[data-a=open],[data-a=close]'); if (oc) oc.onclick = () => g.act({ type: oc.dataset.a === 'open' ? 'openLine' : 'closeLine', line: id }, 'reroute-clunk');
  }
  renderStation(id) {
    const g = this.game; const s = g.sim.stations().find((x) => x.id === id); if (!s) return;
    const layers = s.layers.map((l) => `<span class="chip" style="--tc:${TYPE_COLORS[l]}">${icon(l)}${TYPE_NAMES[l]}</span>`).join('');
    const cap = s.capacity && isFinite(s.capacity) ? Math.round(s.capacity) : null;
    const fill = cap ? Math.min(1, (s.transferFlow || 0) / cap) : 0;
    const html = `${this.head(g.stationName(s), s.kind === 'terminal' ? 'terminal' : 'station')}
      <div class="rp-sub">${esc(g.cellName(s.cell))}</div>
      <div class="chips">${layers || '<span class="sub">No lines yet</span>'}</div>
      ${s.kind !== 'terminal' && !s.linkedToTerminal ? `<div class="warn-line">${icon('warning')} No link to the Terminal: makes commuters only</div>` : ''}
      ${s.closed ? `<div class="warn-line">${icon('warning')} Closed by a blackout</div>` : ''}
      <div class="stats">
        <div><span>Transfers</span><b class="num">${Math.round(s.transferFlow || 0)}${cap ? ` / ${cap}` : ''}/min</b></div>
        <div><span>Waiting</span><b class="num">${Math.round(s.waiting || 0)}</b></div>
        <div><span>Turned away</span><b class="num">${Math.round(s.turnedAway || 0)}</b></div>
        <div><span>Lines</span><b class="num">${s.lines?.length || 0}</b></div>
      </div>
      ${cap ? `<div class="capbar"><span style="width:${fill * 100}%" class="${fill > 0.95 ? 'full' : ''}"></span></div>` : ''}
      <div class="row wrap" style="margin-top:10px">
        ${s.kind !== "terminal" && !s.upgraded ? `<button class="btn small" data-a="upgrade">${icon('plus')}Upgrade transfers ×2 · ${money(600 * (CHARTERS[g.sim.s.charter]?.price || 1))}</button>` : ''}
        <button class="btn small" data-a="routeFrom">${icon('route')}Route from here</button>
        <button class="btn small" data-a="fly">${icon('eye')}Show</button>
      </div>
      ${s.lines?.length ? `<div class="linklist">${s.lines.map((lid) => { const l = g.sim.lines().find((q) => q.id === lid); return l ? `<button class="linkrow" data-line="${lid}"><span style="color:${TYPE_COLORS[l.type]}">${icon(l.type)}</span>${esc(g.lineName(l))}<span class="spacer"></span><span class="num">${Math.round((l.load || 0) * 100)}%</span></button>` : ''; }).join('')}</div>` : ''}`;
    const el = this.openPanel('station', html, { id });
    const up = el.querySelector('[data-a=upgrade]'); if (up) up.onclick = () => g.act({ type: 'upgradeInterchange', station: id }, 'build-interchange');
    el.querySelector('[data-a=fly]').onclick = () => g.flyToSelection({ kind: 'station', id });
    el.querySelector('[data-a=routeFrom]').onclick = () => { g.setTool('route'); g.routeTap({ station: id }); };
    el.querySelectorAll('[data-line]').forEach((b) => { b.onclick = () => g.select({ kind: 'line', id: +b.dataset.line }); });
  }
  renderCell(id) {
    const g = this.game; const c = g.sim.cells((q) => q.id === id)[0]; if (!c) return;
    const html = `${this.head(g.cellName(id), c.terrain === 'atlantis' ? 'dome' : c.peak ? 'peak' : 'station')}
      <div class="stats">
        <div><span>Region</span><b>${esc(REGIONS[c.area]?.name || c.area)}</b></div>
        <div><span>Terrain</span><b>${c.peak ? 'Peak' : c.terrain[0].toUpperCase() + c.terrain.slice(1)}</b></div>
        ${c.density ? `<div><span>Density</span><b class="num">${c.density}</b></div>` : ''}
        ${c.demolitionPrice && !c.demolished ? `<div><span>Demolition</span><b class="num">${money(c.demolitionPrice)}</b></div>` : ''}
        <div><span>Served</span><b>${c.served ? 'Yes' : 'No'}</b></div>
        ${c.priority ? `<div><span>Priority</span><b>×1.5 exports</b></div>` : ''}
      </div>
      <div class="rp-hint">Pinned as route end A. Click another place for B.</div>`;
    this.openPanel('cell', html, { id });
  }

  /** The small "Limit: …" chip under the Throughput meter (the breakdown's bottleneck), clickable to show it. */
  updateLimit() {
    const chip = $('.limit-chip', this.root); const g = this.game; if (!chip || !g.sim) return;
    let b = null; try { b = g.sim.breakdown()?.bottleneck; } catch { b = null; }
    let text = b?.text && b.kind && b.kind !== 'none' && g.sim.lines().length ? b.text : ''; // nothing before the first line
    if (text && b?.kind === 'districts') text = 'Limit: too few districts served. Connect more of the city.';
    this.limitTarget = b?.target && (b.target.line != null || b.target.station != null) ? b.target : null;
    chip.hidden = !text; if (!text) { this.stackBanners(); return; }
    this.set('limit', text.replace(/^Limit:\s*/, 'Limit: '));
    chip.classList.toggle('clickable', !!this.limitTarget);
    const m = this.root.querySelector('.tb-meter')?.getBoundingClientRect();
    if (m?.width) chip.style.left = `${Math.round(Math.max(m.left, 140))}px`;
    this.stackBanners();
  }
  /**
   * The planned project's chip: "Core crossing: <have> / <price> · ~2:10 at this rate", the exports waiting for the
   * Terminal, gold with Build once it can be paid for; × cancels. The time is at the current income (game time).
   */
  updatePlan(st = null) {
    const g = this.game; const chip = $('.plan-chip', this.root); if (!chip) return;
    const p = g.playing ? g.plan : null;
    if (!p) { if (!chip.hidden) { chip.hidden = true; this.stackBanners(); } return; }
    st = st || g.sim.state();
    const c = p.card; const cost = c?.cost ?? 0;
    const name = p.kind === 'core' ? 'Core crossing' : `${KIND_NAME[p.kind]}: ${g.placeLabel(p.a).split(' · ')[0]} to ${g.placeLabel(p.b).split(' · ')[0]}`;
    this.set('pc-name', name + ':');
    let eta = '', ready = false;
    if (!c || !c.feasible) { this.set('pc-money', ''); eta = c ? `can't be built now: ${c.reason || c.line || 'blocked'}` : 'can\'t be built now'; }
    else {
      ready = g.sim.canAfford ? g.sim.canAfford(cost) : st.money >= cost;
      this.set('pc-money', ready ? fmtMoney(cost) : `${fmtMoney(Math.max(0, st.money))} / ${fmtMoney(cost)}`);
      if (ready) eta = ' · ready to build';
      else { const rate = st.moneyPerMin || 0; const need = cost - st.money; eta = rate > 0.01 ? ` · ~${clock(need / rate * 60)} at this rate` : ' · no income yet'; }
    }
    this.set('pc-eta', eta);
    const gain = Math.round(c?.exportsGain || 0);
    const unlinked = gain > 0 && !g.sim.stations().some((x) => x.kind !== 'terminal' && x.linkedToTerminal);
    this.set('pc-held', gain > 0 ? (unlinked ? `Exports waiting for the Terminal: ${gain}/min` : `+${gain} exports/min to the Terminal when built`) : '');
    $('[data-k="pc-held"]', chip).hidden = !gain;
    chip.classList.toggle('ready', ready);
    $('.pc-build', chip).hidden = !ready;
    if (chip.hidden) { chip.hidden = false; this.stackBanners(); } else if (this.lastPlanReady !== ready) this.stackBanners();
    if (ready && this.lastPlanReady === false) audio.sfx('milestone-flip', { gain: 0.45 });
    this.lastPlanReady = ready;
  }
  /** A caption over the cinematic (the Core Exchange, the first time). */
  caption(text, secs = 4) {
    const el = $('.cine-caption', this.root); if (!el) return;
    if (!text) { el.hidden = true; this.captionUntil = null; return; }
    el.textContent = text; el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    this.captionUntil = this.game.G.renderTime + secs; // render time, so a slow frame rate never cuts it short
  }
  /** The top-centre stack: Limit chip, then the disaster banner, then the route / ride banner, never on top of each other. */
  stackBanners() {
    let y = 70;
    const pc = $('.plan-chip', this.root);
    if (pc && !pc.hidden) { const m = this.root.querySelector('.tb-meter')?.getBoundingClientRect(); if (m?.width) pc.style.left = `${Math.round(Math.max(m.left, 140))}px`; pc.style.top = `${y}px`; y += pc.offsetHeight + 8; }
    const chip = $('.limit-chip', this.root);
    if (chip && !chip.hidden) { chip.style.top = `${y}px`; y += chip.offsetHeight + 8; }
    const dz = $('.disaster', this.root);
    if (dz && !dz.hidden) { dz.style.top = `${y}px`; y += dz.offsetHeight + 8; }
    for (const sel of ['.route-banner', '.ride-banner']) { const e = $(sel, this.root); if (e) e.style.top = `${y}px`; }
  }
  // --- breakdown
  renderBreakdown() {
    const g = this.game; const b = g.sim.breakdown();
    const html = `${this.head('Throughput', 'throughput')}
      <div class="bd-row"><span>Made</span><b class="num">${Math.round(b.made)}/min</b></div>
      <div class="bd-row"><span>Reaching the Terminal</span><b class="num">${Math.round(b.reaching)}/min</b></div>
      <div class="bd-row"><span>Launched</span><b class="num">${Math.round(b.launched)}/min</b></div>
      <div class="bd-row sub"><span>Warp ring ceiling</span><b class="num">${Math.round(b.ceiling)}/min</b></div>
      <div class="bottleneck">${icon('warning')}<span>${esc(b.bottleneck?.text || 'No bottleneck')}</span></div>
      ${b.bottleneck?.target ? '<button class="btn small" data-a="show">Show me</button>' : ''}`;
    if (this.panel?.kind === 'breakdown' && this.panel.html === html) return;
    const el = this.openPanel('breakdown', html); this.panel.html = html;
    const sm = el.querySelector('[data-a=show]');
    if (sm) sm.onclick = () => { const t = b.bottleneck.target; const sel = t.line != null ? { kind: 'line', id: t.line } : { kind: 'station', id: t.station }; g.select(sel); g.flyToSelection(sel); };
  }

  // --- places list
  openPlaces() {
    const g = this.game; if (!g.sim) return;
    const p = g.sim.places(); audio.sfx('ui-click');
    const row = (label, ic, color, data, sub = '') => `<button class="place" data-place='${JSON.stringify(data)}' ${data.station != null ? `data-sid="${data.station}"` : ''}><span style="color:${color}">${icon(ic)}</span><span class="pl-name">${esc(label)}</span><span class="sub">${esc(sub)}</span></button>`;
    const stations = p.stations.filter((s) => s.kind !== 'terminal');
    if (!stations.some((s) => s.kind === 'core')) for (const x of g.sim.stations()) if (x.kind === 'core') stations.push({ station: x.id, cell: x.cell, kind: 'core', layers: x.layers });
    const lines = g.sim.lines();
    const html = `${this.head('Places', 'places')}
      <div class="rp-hint">${g.tool === 'route' ? (g.route.a == null ? 'Click a place to pin it as route end A.' : 'Click a place for route end B.') : 'Click a place to fly there.'}</div>
      <div class="places">
        <h4>Warp Terminal</h4>${row('Warp Terminal', 'terminal', TYPE_COLORS.deep, { station: p.terminal.station, cell: p.terminal.cell })}
        ${p.priority?.length ? `<h4>Priority districts</h4>${p.priority.map((c) => row(c.name || g.cellName(c.cell ?? c), 'diamond', '#ffd9a0', { cell: c.cell ?? c }, `${REGIONS[g.cells[c.cell ?? c].areaId]?.name || ''} · ×1.5 exports`)).join('')}` : ''}
        ${stations.length ? `<h4>Stations</h4>${stations.map((s) => row(s.name || g.stationName(s.station), 'station', TYPE_COLORS[s.layers[0]] || '#ffd9a0', { station: s.station, cell: s.cell }, s.layers.map((l) => TYPE_NAMES[l]).join(' + '))).join('')}` : ''}
        ${lines.length ? `<h4>Lines</h4>${lines.map((l) => `<button class="place" data-line="${l.id}"><span style="color:${TYPE_COLORS[l.type]}">${icon(l.type)}</span><span class="pl-name">${esc(g.lineName(l))}</span><span class="sub">${Math.round((l.load || 0) * 100)}%</span></button>`).join('')}` : ''}
        <h4>Peaks</h4>${p.peaks.map((c) => row(c.name || g.cellName(c.cell), 'peak', '#e8f0ff', { cell: c.cell }, REGIONS[c.area]?.name || '')).join('')}
        <h4>Atlantis</h4>${p.atlantis.map((c) => row(c.name || g.cellName(c.cell ?? c), 'dome', '#b8d4f0', { cell: c.cell ?? c })).join('')}
      </div>`;
    const el = this.openPanel('places', html);
    el.querySelectorAll('[data-place]').forEach((b) => {
      b.onclick = () => {
        const d = JSON.parse(b.dataset.place);
        const place = d.station != null ? { station: d.station } : d.cell;
        g.flyToCell(d.cell);
        if (g.tool === 'route') { this.closePanel('places'); if (g.route.a == null && d.station != null && d.station !== p.terminal.station) g.select({ kind: 'station', id: d.station }); g.routeTap(place); }
      };
    });
    el.querySelectorAll('[data-line]').forEach((b) => { b.onclick = () => { const sel = { kind: 'line', id: +b.dataset.line }; g.select(sel); g.flyToSelection(sel); }; });
    g.story.onPlaces?.();
  }

  // --- tool pickers
  openGreenPicker() {
    const g = this.game; const pr = CHARTERS[g.sim?.s.charter]?.price || 1;
    const opts = [['grove', 'grove', 'Tree grove', GREEN.grove.price, '+5% to neighbours'], ['park', 'park', 'Park', GREEN.park.price, '+10% to neighbours'], ['attraction', 'wheel', 'Attraction', GREEN.attraction.price, '+30% within 2 cells; next to a line']];
    const html = `${this.head('Green', 'green')}
      <div class="rp-hint">Click a cleared district (outlined green).</div>
      <div class="pick-list">${opts.map(([k, ic, n, p, t]) => `<button class="pick ${g.greenKind === k ? 'on' : ''}" data-k="${k}">${icon(ic)}<span><b>${n}</b> <span class="num">${money(p * pr)}</span><br><span class="sub">${t}</span></span></button>`).join('')}</div>
      <div class="looks" ${g.greenKind === 'attraction' ? '' : 'hidden'}>${[['wheel', 'Giant Wheel'], ['fountain', 'Fountain Plaza'], ['monument', 'Monument to the Engineers']].map(([k, n]) => `<button class="chip ${(g.greenLook || 'wheel') === k ? 'on' : ''}" data-look="${k}">${icon(k)}${n}</button>`).join('')}</div>`;
    const el = this.openPanel('green', html);
    el.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { g.greenKind = b.dataset.k; audio.sfx('ui-click'); this.openGreenPicker(); }; });
    el.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => { g.greenLook = b.dataset.look; audio.sfx('ui-click'); this.openGreenPicker(); }; });
    el.querySelector('[data-close]').onclick = () => { g.setTool('route'); };
  }
  openStationPicker() {
    const g = this.game;
    const kinds = ['surface', 'sky', 'water', 'earth', 'space'];
    const html = `${this.head('Place a station', 'station')}
      <div class="rp-hint">Pick a kind, then click one of the lit cells. Sky Ports need a peak, Sea Stations the sea, Space Elevators the ring's reach.</div>
      <div class="pick-list">${kinds.map((k) => { const lock = g.sim?.stationLayerLocked?.(k); return `<button class="pick ${g.stationKind === k ? 'on' : ''}" data-k="${k}" ${lock ? `disabled title="Needs ${lock} (Tech)"` : ''}><span style="color:${TYPE_COLORS[k]}">${icon(lock ? 'lock' : k)}</span><span><b>${TYPE_NAMES[k]}</b>${lock ? `<br><span class="sub">Needs ${esc(lock)} (Tech)</span>` : ''}</span></button>`; }).join('')}</div>`;
    const el = this.openPanel('stationTool', html);
    el.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { if (b.disabled) return; g.stationKind = b.dataset.k; audio.sfx('ui-click'); this.openStationPicker(); g.outlineToolTargets(); }; });
    el.querySelector('[data-close]').onclick = () => { g.setTool('route'); };
  }
  openMore() {
    const g = this.game; audio.sfx('ui-click');
    const html = `${this.head('More', 'more')}
      <div class="pick-list"><button class="pick" data-a="station">${icon('station')}<span><b>Station tool</b> <kbd>B</kbd><br><span class="sub">Place a station by hand</span></span></button></div>
      <h4 style="margin:12px 0 2px">Layers</h4><div class="sub" style="margin-bottom:6px">Show or hide each type: <kbd>Shift+1</kbd> … <kbd>Shift+7</kbd></div>
      <div class="layers"></div>`;
    const el = this.openPanel('layers', html);
    el.querySelector('[data-a=station]').onclick = () => g.setTool('station');
    this.renderLayers();
  }
  renderLayers() {
    const g = this.game; const box = this.panel?.el?.querySelector('.layers'); if (!box) return;
    box.innerHTML = TYPE_ORDER.map((t, i) => `<button class="chip layer ${g.layers[t] ? 'on' : ''}" data-layer="${t}" style="--tc:${TYPE_COLORS[t]}">${icon(t)}${TYPE_NAMES[t]}<kbd>Shift+${i + 1}</kbd></button>`).join('');
    box.querySelectorAll('[data-layer]').forEach((b) => { b.onclick = () => g.toggleLayer(b.dataset.layer); });
  }

  // ------------------------------------------------------------------ milestones
  buildMilestones() {
    const box = $('.ms-chips', this.root); const ms = this.game.sim.milestones();
    box.innerHTML = `<div class="ms-head">Milestones <kbd>K</kbd></div>` + ms.map((m) => `<div class="ms-chip" data-id="${m.id}" title="${esc(m.text)} · bonus: ${esc(m.bonus)}"><span class="ms-ic">${icon('card')}</span><span class="ms-txt"><b>${esc(m.name)}</b><span class="ms-goal">${esc(m.text)}</span><span class="ms-bonus">${esc(m.bonus)}</span></span><span class="ms-bar"><span></span></span></div>`).join('');
    box.classList.toggle('open', !!this.msOpen);
    this.updateMilestones();
  }
  updateMilestones() {
    const ms = this.game.sim?.milestones(); if (!ms) return;
    for (const m of ms) {
      const el = this.root.querySelector(`.ms-chip[data-id="${m.id}"]`); if (!el) continue;
      el.querySelector('.ms-bar span').style.width = `${Math.min(100, (m.progress || 0) * 100)}%`;
      el.classList.toggle('done', !!m.done);
    }
  }
  toggleMilestones() { this.msOpen = !this.msOpen; $('.ms-chips', this.root).classList.toggle('open', this.msOpen); audio.sfx('ui-click'); }
  milestoneDone(e) {
    const el = this.root.querySelector(`.ms-chip[data-id="${e.id}"]`);
    if (el) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip', 'done'); }
    this.toast(`Milestone: ${e.name}! ${e.bonus || ''}`, 'good');
  }

  // ------------------------------------------------------------------ disasters
  disasterWarning(e) { this.disaster = { phase: 'warning' }; this.renderDisaster(); }
  // a new disaster always shows its report, even if an earlier one of the same kind was put off with Later
  disasterHit(e) { this.damageDismissed = null; this.disaster = { phase: 'hit' }; this.renderDisaster(); }
  disasterClear() { this.disaster = null; $('.disaster', this.root).hidden = true; this.game.G.city.outlineCells('disaster', null); this.stackBanners(); }
  disasterShown() { return !!this.disaster && this.disaster.phase === 'warning'; }
  disasterRefresh() { if (this.disaster) this.renderDisaster(); else { const d = this.game.sim?.disasters(); if (d?.broken?.length) { this.disaster = { phase: 'hit' }; this.renderDisaster(); } } }
  renderDisaster() {
    const g = this.game; const d = g.sim?.disasters(); const box = $('.disaster', this.root);
    if (!d) return;
    const w = d.warning;
    let html = '';
    if (w) {
      this.disaster = { phase: 'warning' };
      html = `<img src="assets/portraits/juno.png" alt="" class="portrait"><div class="dz-body"><b>${esc(w.name)} in ${Math.ceil(w.secondsLeft)} s!</b><span>${esc(this.disasterTargetText(w))}</span>
        <span class="dz-help">Brace: pay now and the hit does less damage${w.canReroute ? '. Reroute (free): close the line now so no rider is lost' : ''}.</span>
        <div class="row"><button class="btn small" data-d="show">${icon('eye')}Show me</button>
        <button class="btn small" data-d="brace" title="Pay now and the hit does less damage" ${w.braced ? 'disabled' : ''}>${icon('shield')}Brace ${money(w.bracePrice || 0)} <kbd>1</kbd></button>
        <button class="btn small" data-d="reroute" ${w.canReroute && !w.rerouted ? '' : 'disabled'}>${icon('reroute')}Reroute <kbd>2</kbd></button></div></div>`;
      const cells = this.targetCells(w);
      g.G.city.outlineCells('disaster', cells, '#ff6f91', { pulse: true, lift: 2 });
    } else if (d.broken?.length || d.flare || d.ringSlow || d.blackoutUntil) {
      // "Later" hides the report until something new breaks (a line, flare, storm or blackout not in the dismissed set)
      const keys = [...(d.broken || []).map((b) => 'L' + (b.line ?? b.id ?? b)), d.flare ? 'flare' : '', d.ringSlow ? 'ring' : '', d.blackoutUntil ? 'blackout' : ''].filter(Boolean);
      if (this.damageDismissed && keys.every((k) => this.damageDismissed.has(k))) { box.hidden = true; box.dataset.html = ''; this.disaster = null; g.G.city.outlineCells('disaster', null); return; }
      this.damageDismissed = null; this.damageKeys = keys;
      this.disaster = { phase: 'hit' };
      const parts = [];
      if (d.broken?.length) parts.push(`${d.broken.length} line${d.broken.length > 1 ? 's' : ''} broken`);
      if (d.flare) parts.push('core flare: fire lines at half capacity');
      if (d.ringSlow) parts.push('solar storm: the ring is slowed');
      if (d.blackoutUntil) parts.push('blackout: stations closed');
      html = `<img src="assets/portraits/juno.png" alt="" class="portrait"><div class="dz-body"><b>Damage report</b><span>${esc(parts.join(' · ').replace(/^./, (c) => c.toUpperCase()))}</span>
        <div class="row">${d.repairAllPrice ? `<button class="btn small primary" data-d="repairAll">${icon('wrench')}Repair all ${money(d.repairAllPrice)}</button>` : ''}
        ${d.flare ? `<button class="btn small" data-d="coolant">Coolant Dump ${money(500 * (CHARTERS[g.sim.s.charter]?.price || 1))}</button>` : ''}
        ${d.blackoutUntil ? `<button class="btn small" data-d="restorePower">Restore Power ${money(300 * (CHARTERS[g.sim.s.charter]?.price || 1))}</button>` : ''}
        <button class="btn small" data-d="dismiss">Later</button></div></div>`;
      g.G.city.outlineCells('disaster', null);
    } else { this.damageDismissed = null; this.disasterClear(); return; }
    if (box.dataset.html !== html) {
      box.innerHTML = html; box.dataset.html = html; box.hidden = false; this.stackBanners();
      box.querySelectorAll('[data-d]').forEach((b) => {
        b.onclick = () => {
          const k = b.dataset.d;
          if (k === 'show') { const c = this.targetCells(g.sim.disasters().warning || {}); if (c?.length) g.flyToCell(c[0]); }
          else if (k === 'brace') g.act({ type: 'brace' }, 'brace-shield');
          else if (k === 'reroute') g.act({ type: 'reroute' }, 'reroute-clunk');
          else if (k === 'repairAll') g.act({ type: 'repairAll' }, 'repair-clank');
          else if (k === 'coolant') g.act({ type: 'coolant' }, 'repair-clank');
          else if (k === 'restorePower') g.act({ type: 'restorePower' }, 'repair-clank');
          else if (k === 'dismiss') { box.hidden = true; box.dataset.html = ''; this.disaster = null; this.damageDismissed = new Set(this.damageKeys || []); return; }
          this.renderDisaster();
        };
      });
    }
  }
  normTarget(w) {
    const r = w?.targetRef;
    if (r) return r.kind === 'line' ? { line: r.id } : r.kind === 'station' ? { station: r.id } : r.kind === 'terminal' ? { cell: r.cell } : {};
    const t = w?.target;
    if (typeof t !== 'number') return {};
    return ['meteor', 'seaquake', 'caveIn'].includes(w.type) ? { line: t } : { station: t };
  }
  disasterTargetText(w) {
    const t = this.normTarget(w);
    if (w.type === 'coreFlare') return 'Fire lines and Core Exchanges will run at half capacity for a minute.';
    if (w.type === 'solarStorm') return 'The orbital ring will slow down for a minute.';
    if (w.targetName && t.line != null) return `Threatens the ${w.targetName}.`;
    if (t.line != null) { const l = this.game.sim.lines().find((x) => x.id === t.line); return l ? `Threatens the ${this.game.lineName(l)}.` : ''; }
    if (t.station != null) { const s = this.game.sim.stations().find((q) => q.id === t.station); return `Threatens stations around ${s ? this.game.stationName(s) : "a station"}.`; }
    if (t.cell != null) return `Threatens stations around ${this.game.cellName(t.cell)}.`;
    return DISASTERS[w.type]?.hits === 'deep' ? 'Threatens the next deep space departures.' : '';
  }
  targetCells(w) {
    const t = this.normTarget(w); const g = this.game;
    if (w.type === 'solarStorm') return [];
    if (t.line != null) { const l = g.sim.lines().find((x) => x.id === t.line); if (l?.cells?.length) return l.cells; if (l) return [l.a, l.b].map((s) => g.sim.stations().find((q) => q.id === s)?.cell).filter((c) => c != null); }
    if (t.station != null) { const s = g.sim.stations().find((q) => q.id === t.station); return s ? [s.cell] : []; }
    if (t.cell != null) return [t.cell];
    return [g.meta.terminal];
  }

  // ------------------------------------------------------------------ quota, toasts, undo, pop-ups
  quotaMet(e) {
    const el = this.root.querySelector('.tb-meter'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    this.toast(`Quota ${['I', 'II', 'III'][e.quota - 1]} met: ${Math.round(e.throughput)}/min!${e.quota < 3 ? ` Bonus ${money(2000 * (CHARTERS[this.game.sim.s.charter]?.price || 1))}.` : ''}`, 'good');
  }
  toast(text, kind = 'info', key = null) {
    const box = $('.toasts', this.root);
    if (key) box.querySelector(`[data-key="${key}"]`)?.remove();
    // the same text twice in a row just refreshes
    const last = box.lastElementChild; if (last && last.dataset.text === text) { last.dataset.t = performance.now(); return; }
    const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text; el.dataset.text = text; el.dataset.t = performance.now(); if (key) el.dataset.key = key;
    box.appendChild(el);
    while (box.childElementCount > 3) box.firstElementChild.remove();
  }
  spent(cost) { if (cost) this.toast(`Spent ${money(cost)}`, 'info', 'spent'); }
  /** The undo toast names what was done: Built. / Demolished. / Planted. / Station placed. / Upgraded. */
  showUndo(label = 'Built.') { this.undoShown = true; const s = $('.undo-toast > span', this.root); if (s) s.textContent = label; this.updateUndo(); }
  hideUndo() { this.undoShown = false; $('.undo-toast', this.root).hidden = true; }
  updateUndo() {
    const u = this.game.sim?.state().undo; const el = $('.undo-toast', this.root);
    if (!u || !this.undoShown) { el.hidden = true; return; }
    const left = u.until - this.game.gameTime();
    if (left <= 0) { el.hidden = true; this.undoShown = false; return; }
    el.hidden = false; el.querySelector('.undo-time').textContent = `${Math.ceil(left)} s`;
  }
  popup(pos, text, kind = '') {
    const box = $('.pops', this.root);
    if (this.popList.length > 8) return;
    const el = document.createElement('div'); el.className = `pop num ${kind}`; el.textContent = text; box.appendChild(el);
    this.popList.push({ el, pos, t: 0 });
  }
  tooltip(x, y, text) {
    const el = $('.tooltip', this.root);
    if (!text) { el.hidden = true; return; }
    el.hidden = false; if (el.textContent !== text) el.textContent = text;
    el.style.transform = `translate(${Math.min(innerWidth - 260, x + 16)}px, ${y + 18}px)`;
  }
  dispatch(who, text, { portrait = who, ttl = 8, key = null, sticky = false } = {}) {
    const box = $('.dispatches', this.root);
    const names = { juno: 'Juno Brasswick', thrumm: 'Auditor Thrumm', conductor: 'The Warp Conductor' };
    if (key) box.querySelector(`[data-key="${key}"]`)?.remove();
    const el = document.createElement('div'); el.className = `dispatch ${who}`; if (key) el.dataset.key = key;
    el.innerHTML = `<img src="assets/portraits/${portrait}.png" alt="" class="portrait"><div><b>${names[who] || who}</b><p>${text}</p></div>`;
    box.appendChild(el);
    // at most two cards; Juno's sticky tutorial card is never the one pushed out
    while (box.childElementCount > 2) { const old = [...box.children].find((c) => c.dataset.key !== 'tut' && c !== el) || box.firstElementChild; old.remove(); }
    if (!sticky) el.dataset.until = String(this.game.G.renderTime + ttl);
    audio.sfx('dispatch-blip', { minGap: 0.5 });
    return el;
  }
  clearDispatch(key) { this.root.querySelector(`.dispatch[data-key="${key}"]`)?.remove(); }

  setRiding(l, through = false) {
    const b = $('.ride-banner', this.root);
    if (!l) { b.hidden = true; b.classList.remove('through'); return; }
    b.hidden = false; this.stackBanners();
    b.classList.toggle('through', through);
    b.innerHTML = `${icon('ride')}Riding the ${esc(this.game.lineName(l))} · ${through ? '<button class="btn small primary" data-act="through">Ride on through <kbd>Enter</kbd></button> · ' : ''}any other input exits`;
  }
  setCinematic(on) { $('.letterbox', this.root).hidden = !on; this.root.classList.toggle('cine', on); if (!on) this.caption(null); }

  // ------------------------------------------------------------------ tech tree screen
  openTech(focus = null) {
    const g = this.game; const G = g.G; if (!g.sim) return;
    G.openOverlay('tech', () => this.renderTech(focus));
    g.setPaused(true, 'overlay');
    g.story.onTech?.();
  }
  closeTech() { this.game.G.popOverlay(); this.game.setPaused(false, 'overlay'); }
  renderTech(focus) {
    const g = this.game; const tree = g.sim.techTree(); const st = g.sim.state();
    const el = document.getElementById('tech');
    el.innerHTML = `<div class="panel tech-panel">
      <div class="panel-head"><h2>Tech tree</h2><span class="num money-chip">${money(st.money)}</span><button class="icon-btn" data-act="back" aria-label="Close (T)">${icon('close')}</button></div>
      <div class="tech-cols">${tree.map((br) => `<div class="tech-col"><div class="tech-branch" style="color:${TYPE_COLORS[br.branch]}">${icon(br.branch)}${br.branch === 'deep' ? 'Deep space' : TYPE_NAMES[br.branch]}</div>
        ${br.nodes.map((n) => `<button class="tnode ${n.owned ? 'owned' : n.block ? 'blocked' : st.money >= n.price ? 'can' : 'poor'} ${focus === n.id ? 'focus' : ''}" data-id="${n.id}" style="--tc:${TYPE_COLORS[br.branch]}" ${n.owned || n.block ? 'disabled' : ''}>
          <b>${esc(n.name)}</b><span>${esc(n.text)}</span><span class="tprice num">${n.owned ? 'Owned' : money(n.price)}</span>${n.block && !n.owned ? `<span class="tblock">${esc(n.block)}</span>` : ''}</button>`).join('')}</div>`).join('')}</div>
      <div class="rp-hint" style="margin-top:12px">Each branch is bought from the top down. The clock is paused while this is open.</div></div>`;
    el.querySelector('[data-act=back]').onclick = () => this.closeTech();
    el.querySelectorAll('.tnode').forEach((b) => {
      b.onclick = () => { const r = g.act({ type: 'buyTech', id: b.dataset.id }, 'tech-bought'); if (r.ok) { this.renderTech(b.dataset.id); g.story.onTechBought?.(b.dataset.id); } };
    });
    el.querySelector('.tnode.focus')?.scrollIntoView?.({ block: 'nearest' });
  }

  // ------------------------------------------------------------------ per frame
  frame(dt) {
    // money pop-ups follow their station and rise
    for (let i = this.popList.length - 1; i >= 0; i--) {
      const p = this.popList[i]; p.t += dt;
      const sp = this.game.screenOf(p.pos);
      if (!sp.visible || p.t > 1.6) { p.el.remove(); this.popList.splice(i, 1); continue; }
      p.el.style.transform = `translate(${sp.x - 20}px, ${sp.y - 30 - p.t * 36}px)`; p.el.style.opacity = String(Math.min(1, 2.2 - p.t * 1.4));
    }
    this.frameMarkers();
    if (this.captionUntil != null && this.game.G.renderTime > this.captionUntil) this.caption(null);
    // dispatches fade after their time (render time, so stepping and real play agree)
    const rt = this.game.G.renderTime;
    for (const d of [...$('.dispatches', this.root).children]) {
      if (d.dataset.until && rt > +d.dataset.until && !d.classList.contains('out')) { d.classList.add('out'); d.dataset.gone = String(rt + 0.6); }
      if (d.dataset.gone && rt > +d.dataset.gone) d.remove();
    }
    // toasts fade after 4 s
    const now = performance.now();
    for (const t of [...$('.toasts', this.root).children]) if (now - +t.dataset.t > 4500) t.remove();
    if (this.disaster?.phase === 'warning') { const w = this.game.sim.disasters().warning; if (w) { const s = `${esc(w.name)} in ${Math.ceil(w.secondsLeft)} s!`; const b = this.root.querySelector('.disaster b'); if (b && b.textContent !== s) b.textContent = `${w.name} in ${Math.ceil(w.secondsLeft)} s!`; } else this.renderDisaster(); }
  }
  layout() {}
}
