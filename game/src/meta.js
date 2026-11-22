// meta.js — between terms: the Charter board (stamped Charter documents + region picker on the live globe),
// term setup (mandates, priority districts, dealt milestones, perks, inherited network), the Merit Office,
// and the end screens (Charter Commended, Term over, the finale and credits).
import * as THREE from 'three';
import { Game as Sim } from './sim.js';
import { CHARTERS, CHARTER_IDS, REGIONS, UNLOCKS, MANDATES, MILESTONES, MERITS } from './tuning.js';
import { cellMeta, getCells } from './planet.js';
import { icon } from './icons.js';
import { esc } from './menus.js';
import { FINALE_DISPATCH } from './story.js';
import { cellName } from './names.js';
import * as save from './save.js';
import * as audio from './audio.js';
import { fmtMoney } from './fmt.js';

const BOARD_DIST = 420; // the board and setup show the whole globe between their columns
const ROMAN = { I: 'I', II: 'II', III: 'III', IV: 'IV', V: 'V', VI: 'VI', G: 'Galactic' };
const REGION_ORDER = ['capital', 'brine', 'rift', 'spires', 'flats', 'ringside'];
const money = (v) => fmtMoney(v);
// one line for each perk and livery (the Merit Office)
const PERK_TEXT = {
  cash: `Start the term with ${fmtMoney(MERITS.perks.find((p) => p.id === 'cash')?.effect?.cash ?? 0)} more to build with.`,
  freeTech: 'Buy any one tech node for nothing.',
  corePair: 'Your first two Core Exchanges cost nothing (one through-the-core route).',
  elevator: 'Start with a Space Elevator already standing at your start district.',
  reroll: 'The term\'s milestone cards are dealt again: a fresh hand.',
};
const LIVERY_TEXT = {
  classic: 'The Authority\'s standard chrome and type colours.',
  gilded: 'Brass-gold lead cars with burnished gold carriages.',
  midnight: 'Blued steel and night-navy carriages.',
  pearl: 'Pale pearl lead cars and ivory carriages.',
  rust: 'Copper-red lead cars over foundry-brown carriages.',
  verdigris: 'Weathered green copper, sea-green carriages.',
};
// Charter I's document (requests 35–37: no free crossing)
const NO_MANDATE = ['Founding Charter: no mandate', 'Your first crossing is yours to fund.'];
/** A perk's name; the cash perk's amount comes from its number, formatted. */
const perkName = (p) => (p.id === 'cash' && p.effect?.cash ? `${fmtMoney(p.effect.cash, { sign: true })} starting money` : p.name);
/** An icon for a milestone card, from what its goal asks for. */
export function milestoneIcon(c) {
  const g = c.goal || {};
  if (g.type) return g.type;
  return ({ cash: 'money', quotaBy: 'throughput', launchedTotal: 'deep', stations: 'station', maxLayers: 'station', coreExchanges: 'fire', greeneryShare: 'park', attractions: 'wheel', servedShare: 'places', islandServed: 'water', noDamageSeconds: 'shield', noTurnAwaySeconds: 'shield', skyPortsAllPeaks: 'peak', routeAngle: 'route', trackUnits: 'route', trainsEachType: 'speed' })[g.kind] || 'card';
}
const stars = (n, of = 3) => Array.from({ length: of }, (_, i) => `<span class="star ${i < n ? 'on' : ''}">${icon('star')}</span>`).join('');

export class Meta {
  constructor(game) { this.game = game; this.G = game.G; }

  // ------------------------------------------------------------------ Charter board
  openCharterBoard() {
    const m = save.meta();
    this.pick = this.pick || { charter: m.unlockedCharters[m.unlockedCharters.length - 1] || 'I', region: 'capital', free: false };
    this.G.closeOverlays(); audio.duck(false);
    document.getElementById('title').hidden = true;
    this.G.city.regionLines.visible = true;
    this.G.cam.mode = 'orbit'; this.G.attract = null; this.G.cam.viewShiftTarget = 0;
    this.G.cam.flyTo(this.regionVec(this.pick.region), BOARD_DIST, 1.2);
    this.renderBoard();
    this.G.openOverlay('charters');
    this.boardShift();
    audio.playMusic('title');
  }
  /** The globe centred in the gap between the board's two columns. */
  boardShift() {
    const el = document.getElementById('charters');
    const l = el.querySelector('.board-left')?.getBoundingClientRect(), r = el.querySelector('.board-right')?.getBoundingClientRect();
    if (l?.width && r?.width && innerWidth > 900) this.G.cam.viewShiftTarget = ((l.right + r.left) / 2 - innerWidth / 2) / innerWidth;
  }
  regionVec(r) { const c = getCells()[cellMeta().starts[r]]; return new THREE.Vector3(...c.pos); }
  renderBoard() {
    const m = save.meta(); const el = document.getElementById('charters');
    const charters = [...CHARTER_IDS];
    const docs = charters.map((id) => {
      const ch = CHARTERS[id]; const unlocked = m.unlockedCharters.includes(id); const com = m.commended[id];
      const none = Array.isArray(ch.mandates) && !ch.mandates.length; // Charter I: the founding Charter
      const mand = ch.mandates === 'dealt2' ? 'Two mandates, dealt by the term seed' : none ? NO_MANDATE[0] : ch.mandates.map((k) => MANDATES[k].name).join(' + ');
      const rule = ch.mandates === 'dealt2' ? 'You see them in the term setup.' : none ? NO_MANDATE[1] : ch.mandates.map((k) => MANDATES[k].text).join(' ');
      return `<button class="charter-doc ${unlocked ? '' : 'sealed'} ${this.pick.charter === id && !this.pick.free ? 'on' : ''}" data-ch="${id}" ${unlocked ? '' : 'disabled'}>
        <span class="cd-title">${id === 'G' ? 'Charter Galactic' : 'Charter ' + ROMAN[id]}</span>
        <span class="cd-mand">${unlocked ? esc(mand) : 'Sealed'}</span>
        ${unlocked ? `<span class="cd-rule" title="${esc(rule)}">${esc(rule)}</span>` : ''}
        <span class="cd-q num">${unlocked ? ch.quotas.join(' / ') + '/min' : ''}</span>
        ${com ? `<span class="stamp">${icon('medal')}Commended</span><span class="cd-stars">${stars(com.stars || 0)}</span>` : ''}
        ${!unlocked ? `<span class="seal">${icon('lock')}</span>` : ''}
      </button>`;
    }).join('');
    const free = m.finaleSeen ? `<button class="charter-doc ${this.pick.free ? 'on' : ''}" data-ch="free"><span class="cd-title">Free play</span><span class="cd-mand">Any Commended Charter's numbers, no deadline, no Merits</span></button>` : '';
    const regions = REGION_ORDER.map((r) => {
      const un = m.unlockedRegions.includes(r);
      return `<button class="region-btn ${this.pick.region === r ? 'on' : ''}" data-r="${r}" ${un ? '' : 'disabled'}>${un ? '' : icon('lock')}<b>${esc(REGIONS[r].name)}</b><span class="sub">${un ? (REGIONS[r].start?.name && REGIONS[r].start.name !== REGIONS[r].name ? esc(REGIONS[r].start.name) + ' · ' : '') + REGIONS[r].startAngle + '° to the Terminal' : 'Commend Charter ' + ROMAN[Object.keys(UNLOCKS).find((k) => UNLOCKS[k].region === r)] + ' to unlock'}</span></button>`;
    }).join('') + '<div class="region-btn far"><b>The Far Wards</b><span class="sub">Not a starting region</span></div>';
    const ch = CHARTERS[this.pick.charter];
    el.innerHTML = `
      <div class="board-left panel">
        <div class="panel-head"><h2>Charter board</h2><button class="icon-btn" data-act="back" aria-label="Back">${icon('close')}</button></div>
        <h3>Starting region</h3><div class="regions">${regions}</div>
      </div>
      <div class="board-right panel">
        <div class="merits-chip">${icon('medal')}<span class="num">${m.merits}</span> Merits</div>
        <div class="docs">${docs}${free}</div>
        <div class="row board-foot" style="margin-top:14px"><span class="sub">${this.pick.free ? 'Free play' : `Charter ${ROMAN[this.pick.charter]} · ${esc(REGIONS[this.pick.region].name)} · ${ch.deadline} min`}</span><span class="spacer"></span><button class="btn primary" data-act="start">Start${icon('next')}</button></div>
      </div>`;
    this.boardShift();
    el.querySelector('[data-act=back]').onclick = () => { this.G.city.regionLines.visible = false; this.G.cam.viewShiftTarget = 0; this.G.toTitle(); };
    el.querySelectorAll('[data-ch]').forEach((b) => { b.onclick = () => { audio.sfx('ui-click'); if (b.dataset.ch === 'free') this.pick.free = true; else { this.pick.free = false; this.pick.charter = b.dataset.ch; } this.renderBoard(); }; });
    el.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => { audio.sfx('ui-click'); this.pick.region = b.dataset.r; this.G.cam.flyTo(this.regionVec(b.dataset.r), BOARD_DIST, 1.0); this.renderBoard(); }; });
    el.querySelector('[data-act=start]').onclick = () => {
      this.G.city.regionLines.visible = false; this.G.cam.viewShiftTarget = 0;
      let charter = this.pick.charter;
      if (this.pick.free) charter = [...CHARTER_IDS].reverse().find((c) => m.commended[c]) || 'I';
      this.openSetup({ charter, region: this.pick.region, freePlay: this.pick.free });
    };
  }

  // ------------------------------------------------------------------ term setup
  openSetup(opts) {
    const m = save.meta();
    // one pending deal per Charter × region (kept in the profile) until that term starts: reopening setup shows the same deal
    const key = `${opts.charter}|${opts.region}${opts.freePlay ? '|free' : ''}`; const seeds = { ...(m.pendingSeeds || {}) };
    if (opts.termSeed == null && seeds[key] == null) { seeds[key] = (Date.now() % 1e9) | 0; save.saveMeta({ pendingSeeds: seeds }); }
    this.setup = { ...opts, termSeed: opts.termSeed ?? seeds[key], perk: null, seedKey: key };
    this.G.closeOverlays();
    document.getElementById('title').hidden = true;
    this.makePending();
    this.G.cam.mode = 'orbit'; this.G.attract = null;
    this.G.openOverlay('setup', () => this.renderSetup());
    this.centreGlobeLeftOf(document.querySelector('#setup .setup-panel'));
    void m;
  }
  makePending() {
    const s = this.setup; const m = save.meta();
    this.pending = Sim.newTerm({ termSeed: s.termSeed, charter: s.charter, region: s.region, freePlay: !!s.freePlay, perks: s.perk ? [s.perk] : [], unlockedMilestones: m.ownedMilestones });
    // show the priority districts and the inherited network on the live globe
    const st = this.pending.state();
    const net = this.G.net; const toArr = (f) => { const o = []; for (let i = 0; i < f.length; i += 3) o.push([f[i], f[i + 1], f[i + 2]]); return o; };
    net.setNetwork({ stations: this.pending.stations().map((x) => ({ ...x, terminal: x.kind === 'terminal', core: x.kind === 'core' })), lines: this.pending.lines().map((l) => ({ id: l.id, type: l.type, samples: toArr(this.pending.lineSamples(l.id).samples), trains: l.trains, cars: l.cars, born: -10 })), walkways: [] });
    net.showDemo(false); net.setPriority(st.priority);
    this.G.city.outlineCells('setup-priority', st.priority, '#ffd9a0', { pulse: true, lift: 2 });
    // frame the start and the priority districts together, so their outlines show
    const look = this.regionVec(s.region).normalize().multiplyScalar(2);
    for (const c of st.priority) look.add(new THREE.Vector3(...getCells()[c].pos).normalize());
    this.G.cam.flyTo(look.lengthSq() > 0.01 ? look : this.regionVec(s.region), BOARD_DIST, 1.0);
  }
  /** Keep the globe in the free space left of a right-hand column (setup), so its outlines can be seen. */
  centreGlobeLeftOf(panel) {
    const w = innerWidth; const pw = panel?.getBoundingClientRect().width || 0;
    this.G.cam.viewShiftTarget = w > 900 && pw ? -(pw + 40) / 2 / w : 0;
  }
  renderSetup() {
    const s = this.setup; const m = save.meta(); const p = this.pending; const st = p.state();
    const el = document.getElementById('setup');
    const mand = st.mandates.map((k) => `<div class="mandate"><b>${esc(MANDATES[k].name)}</b><span>${esc(MANDATES[k].text)}</span></div>`).join('');
    const ms = p.milestones().map((c) => `<div class="mcard">${icon(milestoneIcon(c))}<b>${esc(c.name)}</b><span>${esc(c.text)}</span><span class="ms-bonus">${esc(c.bonus)}</span></div>`).join('');
    const perks = MERITS.perks.filter((k) => m.ownedPerks.includes(k.id));
    const perkN = (id) => m.ownedPerks.filter((x) => x === id).length;
    const inh = p.lines().filter((l) => l.inherited);
    const getC = getCells();
    el.innerHTML = `<div class="panel setup-panel side-col">
      <div class="panel-head"><h2>Charter ${ROMAN[s.charter]}${s.freePlay ? ' · Free play' : ''} · ${esc(REGIONS[s.region].name)}</h2><button class="icon-btn" data-act="back" aria-label="Back">${icon('close')}</button></div>
      <h3>Mandate${st.mandates.length > 1 ? 's' : ''}</h3>${mand || `<div class="mandate"><b>${NO_MANDATE[0]}.</b><span>${NO_MANDATE[1]}</span></div>`}
      <div class="setup-grid">
        <div><h3>Quotas</h3><p class="num">${st.quotas.join(' / ')} exports/min</p><p class="sub">${s.freePlay ? 'No deadline' : `Audit in ${Math.round(st.deadline / 60)} min`} · start ${money(st.money)}</p></div>
        <div><h3>Priority districts</h3><p>${st.priority.length ? st.priority.map((c) => `${esc(cellName(c))} <span class="sub">(${esc(REGIONS[getC[c].areaId].name)})</span>`).join(', ') : 'None'}</p><p class="sub">Outlined on the globe: ×1.5 exports when linked to the Terminal</p></div>
        <div><h3>Inherited network</h3><p>${inh.length ? `${inh.length} line${inh.length > 1 ? 's' : ''}, ${p.stations().filter((x) => x.inherited).length} stations` : 'Nothing: a clean slate'}</p><p class="sub">Free, but pays upkeep; never linked to the Terminal</p></div>
      </div>
      <h3>Milestone cards</h3><div class="mcards">${ms}</div>
      ${perks.length ? `<h3>Starting perk</h3><div class="row wrap">${['none', ...perks.map((k) => k.id)].map((id) => { const pk = MERITS.perks.find((k) => k.id === id); return `<button class="chip ${(s.perk || 'none') === id ? 'on' : ''}" data-perk="${id}">${pk ? esc(perkName(pk)) + (perkN(id) > 1 ? ` ×${perkN(id)}` : '') : 'No perk'}</button>`; }).join('')}</div>` : ''}
      <div class="row board-foot" style="margin-top:16px"><span class="spacer"></span><button class="btn primary" data-act="go">Begin the term${icon('next')}</button></div>
    </div>`;
    this.centreGlobeLeftOf(el.querySelector('.setup-panel'));
    el.querySelector('[data-act=back]').onclick = () => { this.G.cam.viewShiftTarget = 0; this.G.city.clearOutlines('setup'); this.G.net.setPriority([]); this.G.closeOverlays(); if (save.meta().commended?.I) this.openCharterBoard(); else this.G.toTitle(); };
    el.querySelectorAll('[data-perk]').forEach((b) => { b.onclick = () => { audio.sfx('ui-click'); s.perk = b.dataset.perk === 'none' ? null : b.dataset.perk; this.makePending(); this.renderSetup(); }; });
    el.querySelector('[data-act=go]').onclick = () => {
      audio.sfx('ui-click');
      this.G.city.clearOutlines('setup');
      const opts = { termSeed: s.termSeed, charter: s.charter, region: s.region, freePlay: !!s.freePlay, perks: s.perk ? [s.perk] : [], unlockedMilestones: m.ownedMilestones };
      if (s.perk) { const i = m.ownedPerks.indexOf(s.perk); if (i >= 0) m.ownedPerks.splice(i, 1); save.saveMeta({ ownedPerks: m.ownedPerks }); }
      { const seeds = { ...(save.meta().pendingSeeds || {}) }; delete seeds[s.seedKey]; save.saveMeta({ pendingSeeds: seeds }); } // the next term here gets a new deal
      this.game.begin(this.pending, { fresh: true, opts });
      this.pending = null;
    };
  }

  // ------------------------------------------------------------------ Merit Office
  openMerit(tab = 'milestones') {
    this.meritTab = tab;
    this.G.openOverlay('merit', () => this.renderMerit());
  }
  renderMerit() {
    const m = save.meta(); const el = document.getElementById('merit'); const tab = this.meritTab;
    let items = '';
    if (tab === 'milestones') items = MILESTONES.filter((c) => c.pool === 'unlock').map((c) => this.shopItem(milestoneIcon(c), c.name, `${c.text} · bonus: ${c.bonusText}`, c.price, m.ownedMilestones.includes(c.id), `ms:${c.id}`)).join('');
    // perks are one-use: the save keeps one entry per perk bought, and a term that starts with it uses one up
    if (tab === 'perks') items = MERITS.perks.map((p) => { const n = m.ownedPerks.filter((x) => x === p.id).length; return this.shopItem('perk', perkName(p), `${PERK_TEXT[p.id] || ''} Choose it in term setup; one is used up per term.`, p.price, n > 0, `pk:${p.id}`, n > 0 ? `×${n} ready` : null); }).join('');
    if (tab === 'liveries') items = MERITS.liveries.map((l) => this.shopItem('palette', l.name, LIVERY_TEXT[l.id] || 'A tint for every lead car and its carriages.', l.price, m.ownedLiveries.includes(l.id), `lv:${l.id}`, m.livery === l.id ? 'Wearing' : m.ownedLiveries.includes(l.id) ? 'Wear' : null, l.tint)).join('');
    el.innerHTML = `<div class="panel merit-panel">
      <div class="panel-head"><h2>Merit Office</h2><div class="merits-chip">${icon('medal')}<span class="num">${m.merits}</span> Merits</div><button class="icon-btn" data-act="back" aria-label="Back">${icon('close')}</button></div>
      <p class="sub">Finish a term under a Charter to earn Merits: one per Quota met, one per milestone, one per grade star.</p>
      <div class="tabs">${[['milestones', 'Milestones'], ['perks', 'Perks'], ['liveries', 'Liveries']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
      <div class="shop">${items}</div></div>`;
    el.querySelector('[data-act=back]').onclick = () => this.G.popOverlay();
    el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { audio.sfx('ui-click'); this.meritTab = b.dataset.tab; this.renderMerit(); }; });
    el.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => this.buy(b.dataset.buy); });
  }
  shopItem(ic, name, text, price, owned, key, stateLabel = null, swatch = null) {
    const m = save.meta(); const can = m.merits >= price;
    const lv = key.startsWith('lv:'); const pk = key.startsWith('pk:');
    let btn;
    if (lv && owned) btn = `<button class="btn small" data-buy="${key}" ${stateLabel === 'Wearing' ? 'disabled' : ''}>${stateLabel}</button>`;
    else if (owned && !pk) btn = `<span class="owned">${icon('check')}Owned</span>`;
    else btn = `<button class="btn small ${can ? 'primary' : ''}" data-buy="${key}" ${can ? '' : 'disabled'}>${pk && owned ? 'Buy another' : 'Buy'} · ${price} ${icon('medal')}</button>`;
    return `<div class="shop-item"><span class="frame" ${swatch ? `style="background:${swatch}"` : ''}>${icon(ic)}</span><div><b>${esc(name)}</b>${pk && owned ? ` <span class="ready-count">${esc(stateLabel)}</span>` : ''}<p class="sub">${esc(text)}</p></div>${btn}</div>`;
  }
  buy(key) {
    const m = save.meta(); const [kind, id] = key.split(':');
    if (kind === 'lv' && m.ownedLiveries.includes(id)) { save.saveMeta({ livery: id }); audio.sfx('ui-click'); this.renderMerit(); return; }
    const price = kind === 'ms' ? MILESTONES.find((c) => c.id === id).price : kind === 'pk' ? MERITS.perks.find((p) => p.id === id).price : MERITS.liveries.find((l) => l.id === id).price;
    if (m.merits < price) { audio.sfx('ui-error'); return; }
    m.merits -= price;
    if (kind === 'ms') m.ownedMilestones.push(id);
    if (kind === 'pk') m.ownedPerks.push(id);
    if (kind === 'lv') { m.ownedLiveries.push(id); m.livery = id; }
    save.saveMeta(m); audio.sfx('tech-bought');
    this.renderMerit();
  }

  // ------------------------------------------------------------------ save slots (Save from the pause menu; Load from the pause menu and the title)
  openSlots(mode) { this.slotMode = mode; this.G.openOverlay('slots', () => this.renderSlots()); }
  renderSlots() {
    const mode = this.slotMode; const el = document.getElementById('slots');
    const all = save.listSlots(); const byId = new Map(all.map((s) => [s.id, s]));
    const rows = mode === 'save' ? save.MANUAL_SLOTS.map((id) => byId.get(id) || { id, empty: true }) : all;
    const clock = (t) => { t = Math.floor(t || 0); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
    const when = (ms) => ms ? new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const title = (s) => s.damaged ? 'Damaged save' : s.empty ? 'Empty slot' : s.info?.tutorial ? 'Tutorial' : `${s.info?.charter === 'G' ? 'Charter Galactic' : 'Charter ' + (ROMAN[s.info?.charter] || s.info?.charter || '?')}${s.info?.freePlay ? ' · Free play' : ''}`;
    const row = (s) => {
      const label = s.kind === 'auto' ? 'Autosave' : `Slot ${s.id}`;
      const sub = s.damaged ? 'This save can\'t be read. You can delete it.' : s.empty ? '' : `${esc(REGIONS[s.info?.region]?.name || '')} · ${clock(s.info?.time)} · ${s.info?.throughput != null ? Math.round(s.info.throughput) + '/min · ' : ''}${esc(when(s.savedAt))}`;
      const pic = s.thumb ? `<img class="slot-pic" src="${s.thumb}" alt="">` : `<span class="slot-pic none">${icon(s.damaged ? 'warning' : 'scroll')}</span>`;
      const acts = mode === 'save'
        ? `<button class="btn small primary" data-save="${s.id}">${s.empty ? 'Save here' : 'Overwrite'}</button>`
        : `${s.damaged ? '' : `<button class="btn small primary" data-load="${s.id}">Load</button>`}<button class="btn small" data-del="${s.id}" aria-label="Delete ${esc(label)}">Delete</button>`;
      return `<div class="slot-row ${s.damaged ? 'damaged' : ''}">${pic}<div class="slot-txt"><span class="slot-label">${esc(label)}</span><b>${esc(title(s))}</b><span class="sub">${sub}</span></div><div class="slot-acts">${acts}</div></div>`;
    };
    el.innerHTML = `<div class="panel slots-panel">
      <div class="panel-head"><h2>${mode === 'save' ? 'Save the term' : 'Load a term'}</h2><button class="icon-btn" data-act="back" aria-label="Back (Esc)">${icon('close')}</button></div>
      <p class="sub">${mode === 'save' ? 'Six slots of your own. Every term in progress also keeps its Autosave.' : 'Autosaves keep each term in progress (the eight most recent); your own saves stay until you delete them. Merits are banked once per term.'}</p>
      <div class="slot-list">${rows.length ? rows.map(row).join('') : '<p class="sub">No saved terms yet.</p>'}</div></div>`;
    el.querySelector('[data-act=back]').onclick = () => this.G.popOverlay();
    el.querySelectorAll('[data-save]').forEach((b) => { b.onclick = () => {
      const id = b.dataset.save; const go = () => { const r = this.game.saveToSlot(id); if (r.ok) { audio.sfx('ui-click'); this.game.hud.toast(`Saved to slot ${id}.`, 'good'); } this.renderSlots(); };
      if (byId.get(id)) this.G.menuCtx.confirm(`Overwrite slot ${id}?`, `It holds ${title(byId.get(id))}${byId.get(id).savedAt ? ', saved ' + when(byId.get(id).savedAt) : ''}. That save will be replaced.`, 'Overwrite', go);
      else go();
    }; });
    el.querySelectorAll('[data-load]').forEach((b) => { b.onclick = () => { audio.sfx('ui-click'); if (this.G.overlays.includes('pause')) this.G.closePause?.(); this.G.closeOverlays(); this.game.loadSlot(b.dataset.load); }; });
    el.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => {
      const id = b.dataset.del; const s = byId.get(id);
      this.G.menuCtx.confirm('Delete this save?', `${s?.kind === 'auto' ? 'Autosave' : 'Slot ' + id}: ${title(s || {})}. It can't be brought back.`, 'Delete', () => { save.deleteSlot(id); audio.sfx('ui-cancel'); this.renderSlots(); if (this.G.screen === 'title') this.G.refreshTitle?.(); });
    }; });
    el.querySelector('.slot-list button')?.focus();
  }

  // ------------------------------------------------------------------ end screens
  /** Bank Merits and unlocks for a finished term. Returns the grade. */
  bank(sim, { abandoned = false } = {}) {
    const g = sim.grade(); const st = sim.state(); const m = save.meta();
    if (this.banked === sim) return { ...g, alreadyBanked: this.bankedBefore };
    this.banked = sim;
    // a term's Merits are banked once: an older save of a term that already ended plays on, but banks nothing again
    const termId = this.game.termId; this.bankedBefore = save.isBanked(termId);
    if (this.bankedBefore) { save.deleteSlot('auto-' + termId); return { ...g, alreadyBanked: true }; }
    save.markBanked(termId);
    {
      if (!st.freePlay) { m.merits += g.merits || 0; m.meritsEarned = (m.meritsEarned || 0) + (g.merits || 0); }
      if (g.commended) {
        const prev = m.commended[st.charter]; const best = Math.max(prev?.stars || 0, g.nStars || 0);
        m.commended[st.charter] = { stars: best, at: Date.now() };
        const u = UNLOCKS[st.charter];
        if (u?.charter && !m.unlockedCharters.includes(u.charter)) m.unlockedCharters.push(u.charter);
        if (u?.region && !m.unlockedRegions.includes(u.region)) m.unlockedRegions.push(u.region);
      }
    }
    if (st.tutorial && !abandoned) m.tutorialDone = true; // an abandoned tutorial is offered again
    save.saveMeta(m); save.deleteSlot('auto-' + termId); // the term is over: its autosave goes (manual saves stay)
    return g;
  }
  charterCommended() {
    const sim = this.game.sim; if (!sim) return;
    this.game.stopCameraModes(); this.G.closePause?.();
    this.game.setPaused(true, 'result');
    this.game.deadlineDone = true; // (Commended in Overtime: this screen is already the last one)
    if (sim.s.time < (sim.state().deadline ?? Infinity)) this.game.deadlineDone = false;
    this.G.net.departure();
    setTimeout(() => this.showCommended(), 2200);
  }
  showCommended() {
    const sim = this.game.sim; if (!sim) return;
    const st = sim.state(); const g = sim.grade(); const u = UNLOCKS[st.charter];
    const finale = st.charter === 'VI';
    // at or past the Audit deadline there are no more stars to play for: no Keep playing
    const over = st.deadline != null && st.time >= st.deadline;
    const el = document.getElementById('result');
    el.innerHTML = `<div class="panel result-panel commended">
      <div class="doc"><div class="doc-title">Homeworld Charter ${ROMAN[st.charter]}</div><div class="doc-body">The Office of Throughput finds the Chief Engineer of Oikumene's Arcane Transit Authority to have met Quota III.</div>
        <div class="stamp big slam">${icon('medal')}Commended</div></div>
      <div class="grade">${stars(g.nStars)}</div>
      <div class="gl">${['deadline', 'efficiency', 'greenery'].map((k) => `<span class="${g.stars[k] ? 'ok' : ''}">${icon(g.stars[k] ? 'check' : 'close')}${{ deadline: 'Quota III before the deadline', efficiency: 'More money than at the start', greenery: 'Greenery' }[k]}</span>`).join('')}</div>
      <p>Quotas ${g.quotas} · Milestones ${g.milestones} · ${save.isBanked(this.game.termId) ? '<b>Merits for this term were already banked.</b>' : `<b>${g.merits} Merit${g.merits === 1 ? '' : 's'}</b>${finale || over ? '' : ' (if you finish now)'}`}</p>${over && !finale ? '<p class="sub">The Audit deadline has come: the term is done.</p>' : ''}
      ${u?.charter ? `<p class="unlock">${icon('star')}Unlocked: ${u.charter === 'G' ? 'Charter Galactic and free play' : `Charter ${ROMAN[u.charter]}`}${u.region ? ` and a start in ${esc(REGIONS[u.region].name.replace(/^The /, 'the '))}` : ''}</p>` : ''}
      <div class="row" style="justify-content:center;margin-top:14px">
        ${finale || over ? '' : '<button class="btn" data-act="keep">Keep playing for stars</button>'}
        <button class="btn primary" data-act="finish">${finale ? 'The Homeworld answers…' : 'Continue'}</button>
      </div></div>`;
    this.G.openOverlay('result');
    audio.sfx('milestone-flip'); audio.sfx('fireworks');
    this.fireworks();
    el.querySelector('[data-act=finish]').onclick = () => { this.bank(sim); this.G.closeOverlays(); if (finale) this.finale(); else { this.game.leavePlay(); this.openCharterBoard(); } };
    const k = el.querySelector('[data-act=keep]'); if (k) k.onclick = () => { this.G.popOverlay(); this.game.setPaused(false, 'result'); this.keepPlaying = true; };
  }
  fireworks() {
    const net = this.G.net; const sim = this.game.sim; if (!sim) return;
    const st = sim.stations().filter((s) => s.kind !== 'core');
    const cols = ['#ffd9a0', '#e3ecf7', '#ff6f91', '#ffffff'];
    st.slice(0, 16).forEach((s, i) => setTimeout(() => { const p = new THREE.Vector3(...s.pos); p.multiplyScalar(1.12); net.burst(p, cols[i % cols.length], 40, 7, 1.0); }, i * 160));
  }
  showTermOver(e) {
    const sim = this.game.sim; if (!sim) return;
    this.game.stopCameraModes(); if (this.G.overlays.includes('pause')) this.G.closePause?.();
    this.game.setPaused(true, 'result');
    const g = this.bank(sim, { abandoned: e.reason === 'abandoned' }); const st = sim.state(); const m = save.meta();
    const why = { bankrupt: 'The Authority went bankrupt: a minute below the debt limit.', overtime: 'Overtime ran out before Quota III.', abandoned: 'You abandoned the term.' }[e.reason] || 'The term is over.';
    const el = document.getElementById('result');
    el.innerHTML = `<div class="panel result-panel">
      <h2>Term over</h2><p>${esc(why)}</p>
      <div class="grade">${stars(g.nStars)}</div>
      <p>Quotas met ${g.quotas} of 3 · Milestones ${g.milestones} · Throughput ${Math.round(st.throughput)}/min</p>
      <p><b>${st.freePlay ? 'Free play earns no Merits.' : g.alreadyBanked ? 'Merits for this term were already banked.' : `+${g.merits} Merit${g.merits === 1 ? '' : 's'}`}</b> (you have ${m.merits})</p>
      <div class="row" style="justify-content:center;margin-top:14px">
        <button class="btn" data-act="retry">Retry this term</button>
        <button class="btn" data-act="new">New Term</button>
        ${m.commended?.I ? '<button class="btn primary" data-act="board">Charter board</button>' : ''}
        <button class="btn" data-act="title">Title</button>
      </div></div>`;
    this.G.openOverlay('result');
    // a perk is used up by the term that started with it: Retry starts without it
    const opts = { ...this.game.termOpts, termSeed: st.termSeed, charter: st.charter, region: st.region, tutorial: st.tutorial, perks: [] };
    el.querySelector('[data-act=retry]').onclick = () => { this.G.closeOverlays(); this.game.leavePlay(); this.game.startTerm(opts); };
    el.querySelector('[data-act=new]').onclick = () => { this.G.closeOverlays(); this.game.leavePlay(); this.game.newTerm(); };
    el.querySelector('[data-act=title]').onclick = () => { this.G.closeOverlays(); this.G.toTitle(); };
    const b = el.querySelector('[data-act=board]'); if (b) b.onclick = () => { this.G.closeOverlays(); this.game.leavePlay(); this.openCharterBoard(); };
  }
  finale() {
    // every line pulses outward from the Terminal; a beam climbs to the galactic core; then the picture and the Conductor
    const G = this.G; const net = G.net;
    this.game.setPaused(true, 'result');
    this.game.hud.setCinematic(true);
    audio.playMusic('finale');
    G.cam.flyTo(new THREE.Vector3(...getCells()[cellMeta().terminal].pos), 420, 3);
    net.beam?.(true);
    G.sky.setHomeBrightness(8);
    setTimeout(() => {
      const el = document.getElementById('finale');
      el.innerHTML = `<div class="finale-pic"></div><div class="finale-text panel"><img src="assets/portraits/conductor.png" alt="" class="portrait"><div><b>The Warp Conductor</b><p>${esc(FINALE_DISPATCH)}</p></div></div>
        <button class="btn primary finale-next" data-act="credits">Credits${icon('next')}</button>`;
      el.hidden = false;
      el.querySelector('[data-act=credits]').onclick = () => {
        el.innerHTML = '<div class="finale-pic dim"></div><div class="panel credits-panel finale-credits"></div>';
        import('./menus.js').then((mm) => { const box = el.querySelector('.finale-credits'); const tmp = document.getElementById('credits'); mm.renderCredits({ back: () => { el.hidden = true; this.game.hud.setCinematic(false); save.saveMeta({ finaleSeen: true }); G.sky.setHomeBrightness(Object.keys(save.meta().commended).length); net.beam?.(false); this.game.leavePlay(); G.toTitle(); } }); box.innerHTML = tmp.querySelector('.credits-panel')?.innerHTML || ''; box.querySelector('[data-act=back]').textContent = 'Continue'; box.querySelector('[data-act=back]').onclick = () => tmp.querySelector('[data-act=back]').onclick(); });
      };
    }, 5200);
  }
}
