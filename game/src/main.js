// main.js — boot, loading screen, the fixed-update loop, screens and the debug hook.
import * as THREE from 'three';
import { createRenderer, createSky, createEnvironment, createLights, loadTex, setQualityPixelRatio, SKY_DIR } from './scene.js';
import { City } from './city.js';
import { OrbitCam, ZOOM, vecLatLon } from './camera.js';
import { Input } from './input.js';
import { XRAY, setClipDir } from './xray.js';
import * as audio from './audio.js';
import * as save from './save.js';
import { icon } from './icons.js';
import { $, show, hide, isShown, renderSettings, renderHowto, renderCredits, renderPause, renderConfirm } from './menus.js';
import { installDebug } from './debug.js';

const G = window.__ata = {
  screen: 'loading', overlays: [], frozen: false, quiet: false, speed: 1, realTime: 0, renderTime: 0, updates: 0,
  frameLog: [], game: null, net: null, xray: 0, xrayTarget: 0, perfStats: { updMs: [], worstTick: 0, worstRecompute: 0 },
};

function logFrame(name) {
  const last = G.frameLog[G.frameLog.length - 1];
  if (last && last[0] === name) last[1]++;
  else { G.frameLog.push([name, 1]); if (G.frameLog.length > 200) G.frameLog.shift(); }
}
function screenName() {
  const vis = [...document.querySelectorAll('[data-screen]')].filter((e) => !e.hidden && !e.classList.contains('out')).map((e) => e.dataset.screen);
  return vis.join('>') || G.screen;
}

// ------------------------------------------------------------------ boot
const meta = save.meta();
const settings = meta.settings;
const canvas = document.getElementById('c');
const renderer = createRenderer(canvas, settings.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.3, 6000);
const cam = new OrbitCam(camera);
cam.shakeOn = settings.shake;
G.renderer = renderer; G.scene = scene; G.camera = camera; G.cam = cam; G.settings = settings;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  G.game?.onResize?.();
}
addEventListener('resize', resize);
resize();

// loading screen: key art cycling every 4 s with a slow pan
const KEYART = ['globe', 'surface', 'sky', 'atlantis', 'xray', 'ring'];
let kaIndex = 0;
const kaStack = document.querySelector('.ka-stack');
// the other key art is fetched after the title shows (loadLater), so the first load fetches only what the title draws
const kaTimer = setInterval(() => {
  const els = kaStack.querySelectorAll('.ka');
  els[kaIndex].classList.remove('on'); kaIndex = (kaIndex + 1) % els.length; els[kaIndex].classList.add('on');
}, 4000);
let loadParts = { tex: 0, models: 0, audio: 0, fonts: 0 };
function setLoad(k, v, label) {
  loadParts[k] = v;
  const p = loadParts.tex * 0.8 + loadParts.fonts * 0.1 + loadParts.audio * 0.1;
  $('#load-fill').style.width = `${Math.round(p * 100)}%`;
  if (label) $('#load-label').textContent = label;
}

const bootT0 = performance.now(); G.bootTimes = [];
function bootMark(name) { G.bootTimes.push([name, Math.round(performance.now() - bootT0)]); }
async function boot() {
  await audio.initAudio({ music: settings.music, sound: settings.sound, muted: settings.muted });
  setLoad('audio', 1);
  document.fonts.ready.then(() => setLoad('fonts', 1));
  // only what the title globe draws; the core and lava tiles (never on the title) fill in later (loadLater)
  const texNames = { galaxy: 'bg/galaxy-core.jpg', streets: 'tiles/streets.jpg', windows: 'tiles/windows.jpg', rock: 'tiles/rock.jpg', seafloor: 'tiles/seafloor.jpg' };
  const textures = {};
  let tdone = 0;
  await Promise.all(Object.entries(texNames).map(async ([k, f]) => {
    const el = document.querySelector(`#title-tex img[data-tex="${k}"]`);
    textures[k] = el ? await texFromImg(el, k !== 'galaxy') : await loadTex(`assets/${f}`, { repeat: k !== 'galaxy' });
    tdone++; setLoad('tex', tdone / 5, 'Painting the galactic core…');
  }));
  for (const k of Object.keys(LATER_TEX)) textures[k] = laterTexture();
  G.textures = textures;
  // models are not drawn on the title (stations and lead cars are pins and capsules from that far): loadLater
  G.models = {};
  setLoad('tex', 1, 'Lighting the city…');
  await document.fonts.ready; setLoad('fonts', 1);

  bootMark('fonts');
  scene.environment = createEnvironment(renderer, textures);
  bootMark('env');
  G.sky = createSky(scene, textures);
  G.lights = createLights(scene);
  bootMark('sky+lights');
  G.city = new City(scene, textures, scene.environment, settings.quality);
  bootMark('city');
  G.city.buildBuildings(null);

  bootMark('buildings');
  // the network renderer and the game controller load if present
  try {
    const rn = await import('./render-net.js');
    G.net = new rn.NetRenderer(G);
    // the title's attract crossing: the Core Exchange caption at the first hand-off, until the player's own first crossing
    G.net.onAttractHandoff = (i) => { if (i === 0 && !save.meta().exchangeSeen && G.screen !== 'play') titleCaption('Core Exchange: cargo moves from the earth train to the fire train', 4.5); };
  } catch (e) { console.warn('render-net not ready', e?.message); }
  bootMark('net');
  try {
    const gm = await import('./game.js');
    G.game = new gm.Game(G);
  } catch (e) { console.warn('game not ready', e?.message); }

  bootMark('game');
  // warm up: compile shaders with the planet in view
  cam.jumpTo(new THREE.Vector3(0.42, -0.2, 1), ZOOM.planet);
  setXrayImmediate(1); renderer.compile(scene, camera); setXrayImmediate(0);
  bootMark('compile-xray');
  renderer.compile(scene, camera);
  bootMark('compile');
  renderer.render(scene, camera);

  bootMark('render');
  G.input = new Input(canvas, inputHandlers);
  setupReport();
  installDebug(G, { logFrame, screenName, step, perf, setQuality });
  requestAnimationFrame(frame);

  // crossfade loading → title
  setLoad('tex', 1, 'Ready');
  toTitle(true); bootMark('title');
  setTimeout(loadLater, 0);
}

// ------------------------------------------------------------------ background loading (after the title shows)
const LATER_TEX = { core: 'tiles/core.jpg', lava: 'tiles/lava.jpg' };
function laterTexture() {
  const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
async function texFromImg(img, repeat) {
  if (!img.complete) await new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
  if (!img.naturalWidth) return null;
  const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
function loadImage(url) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }
/** Everything the title doesn't draw, in two lanes: music in the order it's needed (title, then build for the first
 *  term), and visuals (models, the core and lava tiles, the rest of the key art, the finale picture). */
function loadLater() {
  if (G.loadLater) return G.loadLater;
  const music = (async () => { for (const n of ['title', 'build', 'busy', 'disaster', 'fanfare', 'finale']) await audio.prefetchMusic(n); })();
  const visuals = (async () => {
    const { loadModels } = await import('./models.js'); // GLTFLoader too: not needed for the title
    const models = await loadModels(null);
    G.models = models; G.net?.addModels?.(models);
    renderer.compile(scene, camera);
    await Promise.all(Object.entries(LATER_TEX).map(async ([k, f]) => { const im = await loadImage(`assets/${f}`); if (im) { G.textures[k].image = im; G.textures[k].needsUpdate = true; } }));
    for (const k of KEYART.slice(1)) {
      const im = await loadImage(`assets/keyart/${k}.jpg`); if (!im) continue;
      const d = document.createElement('div'); d.className = 'ka'; d.style.backgroundImage = `url(assets/keyart/${k}.jpg)`; kaStack.appendChild(d);
    }
    await loadImage('assets/bg/finale.jpg');
  })();
  G.loadLater = Promise.all([music, visuals]).then(() => { G.loadedAll = true; });
  return G.loadLater;
}

function setXrayImmediate(v) { G.xray = G.xrayTarget = v; XRAY.uniforms.uClipOn.value = v > 0.01 ? 1 : 0; G.city?.setXray(v); G.net?.setXray?.(v); }

// ------------------------------------------------------------------ screens
function toTitle(fromLoading = false) {
  G.screen = 'title';
  G.game?.leavePlay?.();
  for (const id of ['settings', 'howto', 'credits', 'pause', 'tech', 'charters', 'setup', 'merit', 'slots', 'result', 'finale', 'confirm']) hide(id);
  G.overlays = [];
  // nothing on the title is paused: undo the pause menu's music duck (Reset progress, Save and Quit, Replay Tutorial…)
  audio.duck(false); window.gameReport?.resumed?.();
  document.getElementById('hud-root').hidden = true;
  refreshTitle();
  show('title');
  updateMuteButtons();
  startAttract();
  G.net?.showDemo?.(true);
  audio.playMusic('title');
  if (fromLoading) {
    const ld = $('#loading'); ld.classList.add('out');
    setTimeout(() => { ld.hidden = true; clearInterval(kaTimer); }, 850);
    window.otherDevices?.show?.({ kind: 'desktop-only', key: 'arcane-transit-authority', heading: 'Made for a computer',
      text: 'Arcane Transit Authority is built for a mouse and keyboard. On a phone or tablet you can spin the planet and look around, but building a network needs a computer.',
      main: 'Send link to yourself', quiet: 'Look around anyway', copied: 'Link copied', shared: 'Link sent', onClose: () => audio.unlockAudio() });
  }
}
G.toTitle = toTitle;
/** Continue (the most recently played save) and Load (when any save exists). */
function refreshTitle() {
  const cont = $('#title-menu [data-act=continue]');
  cont.hidden = !G.game?.canContinue?.();
  $('#title-menu [data-act=new]').classList.toggle('primary', cont.hidden);
  $('#title-menu [data-act=load]').hidden = !save.listSlots().length;
}
G.refreshTitle = refreshTitle;

function startAttract() {
  cam.exitFollow();
  cam.mode = 'attract';
  const [lat, lon] = vecLatLon(SKY_DIR.clone().negate());
  G.attract = { t: 0, baseLat: lat + 6, baseLon: lon, ride: null, nextRide: 20 };
  cam.lat = lat + 6; cam.lon = lon; cam.dist = 330; cam.tiltManual = 0;
  cam.viewShiftTarget = innerWidth > 900 ? 0.16 : 0;
}
function updateAttract(dt) {
  const a = G.attract; if (!a) return;
  a.t += dt;
  if (a.ride) {
    a.ride.t += dt;
    if (a.ride.t > (a.ride.dur || 15) || cam.mode !== 'follow') { cam.exitFollow(); cam.mode = 'attract'; a.ride = null; a.nextRide = a.t + 20; cam.dist = 330; cam.tiltManual = 0; endAttractRide(); }
    return;
  }
  cam.lon = a.baseLon + Math.sin(a.t * 0.05) * 30;
  cam.lat = a.baseLat + Math.sin(a.t * 0.031) * 10;
  cam.dist = 330 + Math.sin(a.t * 0.07) * 12;
  if (a.t > a.nextRide && G.net?.attractRide) {
    const r = G.net.attractRide(cam);
    if (r) a.ride = { t: 0, dur: r.dur || 15 }; else a.nextRide = a.t + 20;
  }
}
/**
 * An attract ride below ground or under the sea gets exactly the scene Ride and the crossing cinematic use: below
 * ground the X-ray (rock interior, cutaway bores, the lava core; the city surface hidden by setInside), under the
 * sea the underwater look. Never stars and nothing else (request 34).
 */
function attractScene() {
  const p = G.net?.attractActive ? G.net.attractPose : null;
  if (!p) return;
  const below = !!p.below, water = !!p.water;
  if (below !== !!G.attractBelow) { G.attractBelow = below; G.xrayTarget = below ? 1 : baseXray(); }
  G.game?.setUnderwater?.(water);
}
const baseXray = () => (G.screen === 'play' && G.game ? ((G.game.xrayUser || G.game.xrayAuto) ? 1 : 0) : 0);
/** A caption at the bottom of the title screen (the attract crossing's hand-off). */
function titleCaption(text, secs) {
  let el = document.getElementById('title-caption');
  if (!el) { el = document.createElement('div'); el.id = 'title-caption'; document.body.appendChild(el); }
  clearTimeout(titleCaption.t);
  el.textContent = text; el.hidden = false;
  titleCaption.t = setTimeout(() => { el.hidden = true; }, secs * 1000);
}
function endAttractRide() {
  const tc = document.getElementById('title-caption'); if (tc) tc.hidden = true;
  if (!G.net?.attractActive) return;
  G.net.endAttractRide();
  if (G.attractBelow) { G.attractBelow = false; G.xrayTarget = baseXray(); }
  G.game?.setUnderwater?.(false);
}
G.endAttractRide = endAttractRide;

const menuCtx = {
  settings: () => ({ ...settings, ...audio.getSettings() }),
  setSetting(k, v) {
    settings[k] = v;
    if (k === 'music' || k === 'sound') audio.setVolumes({ [k]: v });
    if (k === 'muted') { audio.setVolumes({ muted: v }); updateMuteButtons(); }
    if (k === 'quality') setQuality(v);
    if (k === 'shake') cam.shakeOn = v;
    save.saveMeta({ settings });
  },
  click: () => audio.sfx('ui-click'),
  back: () => popOverlay(),
  confirm: (t, x, ok, fn) => renderConfirm(t, x, ok, fn),
  resetProgress: () => { save.resetProgress(); popOverlay(); toTitle(); },
  canReplayTutorial: () => !!G.game,
  replayTutorial: () => {
    const go = () => {
      if (G.screen === 'play' && G.game?.sim) { closePause(); G.game.endTermForTutorial?.(); }
      closeOverlays(); G.game?.startTutorial?.(); // from the title, startTutorial asks before replacing a saved term
    };
    // from a term in progress: ask first, then end the term properly (Merits banked, as Abandon does)
    if (G.screen === 'play' && G.game?.sim) renderConfirm('Replay the tutorial?', 'You leave this term for the tutorial. The term stays in its Autosave: Continue or Load brings it back.', 'Replay the tutorial', go);
    else go();
  },
  muted: () => audio.getSettings().muted,
  pauseAction: (act) => pauseAction(act),
};
G.menuCtx = menuCtx;

function openOverlay(id, render) {
  audio.sfx('ui-click');
  if (render) render();
  // one overlay replaces another of the same stack: open the next before hiding the current
  show(id);
  const top = G.overlays[G.overlays.length - 1];
  if (top && top !== id) hide(top);
  G.overlays.push(id);
  if (id !== 'pause') hide('title');
}
function popOverlay() {
  audio.sfx('ui-cancel');
  const id = G.overlays.pop();
  const next = G.overlays[G.overlays.length - 1];
  if (next) show(next);
  else if (G.screen === 'title') show('title');
  if (id) hide(id);
  if (!next && G.screen === 'play') G.game?.overlaysClosed?.();
}
function closeOverlays() { for (const id of G.overlays) hide(id); G.overlays = []; }
G.openOverlay = openOverlay; G.popOverlay = popOverlay; G.closeOverlays = closeOverlays;

$('#title-menu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  audio.unlockAudio();
  const act = b.dataset.act;
  if (act === 'settings') openOverlay('settings', () => renderSettings(menuCtx));
  else if (act === 'howto') openOverlay('howto', () => renderHowto(menuCtx));
  else if (act === 'credits') openOverlay('credits', () => renderCredits(menuCtx));
  else if (act === 'new') { audio.sfx('ui-click'); G.game?.newTerm?.(); }
  else if (act === 'continue') { audio.sfx('ui-click'); G.game?.continueTerm?.(); }
  else if (act === 'merit') { audio.sfx('ui-click'); G.game?.openMerit?.(); }
  else if (act === 'load') G.game?.metaUi?.openSlots('load');
});
$('#title [data-act=mute]').addEventListener('click', () => { audio.unlockAudio(); toggleMute(); });

function toggleMute() { const m = audio.toggleMute(); settings.muted = m; save.saveMeta({ settings }); updateMuteButtons(); }
function updateMuteButtons() {
  const m = audio.getSettings().muted;
  document.querySelectorAll('[data-act=mute]').forEach((b) => { b.innerHTML = icon(m ? 'mute' : 'sound'); b.setAttribute('aria-label', m ? 'Unmute (M)' : 'Mute (M)'); });
  G.game?.onMute?.(m);
}
G.toggleMute = toggleMute;

// ------------------------------------------------------------------ pause
/** An end screen (Commended / Term over), the finale, or the moments just before them: nothing else may open. */
function endScreenUp() { return G.overlays.includes('result') || isShown('finale') || !!G.game?.pauseReasons?.has('result'); }
G.endScreenUp = endScreenUp;
function openPause() {
  if (G.screen !== 'play' || isShown('pause') || endScreenUp()) return;
  G.game?.stopCameraModes?.(); // a Ride or the crossing cinematic ends under the pause menu
  G.game?.saveNow?.(); // pausing autosaves the term
  window.gameReport?.snapshot();
  G.game?.setPaused?.(true, 'menu');
  renderPause(menuCtx);
  openOverlay('pause');
  audio.duck(true);
  G.pauseIdle = 0;
}
function closePause() {
  hide('pause'); G.overlays = G.overlays.filter((x) => x !== 'pause');
  // the overlay the pause menu covered (Tech tree, an end screen) comes back
  const under = G.overlays[G.overlays.length - 1]; if (under) show(under);
  window.gameReport?.resumed();
  audio.duck(false);
  G.game?.setPaused?.(false, 'menu');
  if (cam.mode === 'attract' || cam.mode === 'follow') { cam.exitFollow(); G.attract = null; }
}
G.openPause = openPause; G.closePause = closePause;
function pauseAction(act) {
  if (act === 'resume') { audio.sfx('ui-click'); closePause(); }
  else if (act === 'howto') openOverlay('howto', () => renderHowto(menuCtx));
  else if (act === 'settings') openOverlay('settings', () => renderSettings(menuCtx));
  else if (act === 'report') window.gameReport?.open();
  else if (act === 'mute') { toggleMute(); renderPause(menuCtx); }
  else if (act === 'save') G.game?.metaUi?.openSlots('save');
  else if (act === 'load') G.game?.metaUi?.openSlots('load');
  else if (act === 'savequit') { G.game?.saveNow?.(); closePause(); toTitle(); }
  else if (act === 'abandon') renderConfirm('Abandon this term?', 'The term ends now. Merits already earned are kept; the term in progress is lost.', 'Abandon', () => { closePause(); G.game?.abandon?.(); });
}

function setupReport() {
  window.gameReport?.setup?.({
    game: 'Arcane Transit Authority', key: 'arcane-transit-authority', visibility: 'on',
    state: () => { try { const s = window.__game.state(); return { screen: s.screen, charter: s.charter, region: s.region, time: s.time, money: s.money, throughput: s.throughput, stations: s.stations?.length ?? s.stations, lines: s.lines?.length ?? s.lines }; } catch { return {}; } },
    pause: () => { if (G.screen === 'play' && !isShown('pause')) openPause(); },
    grab: () => new Promise((r) => { renderer.render(scene, camera); canvas.toBlob(r, 'image/png'); }),
    releaseAll: () => G.input?.releaseAll(),
  });
}

// ------------------------------------------------------------------ input
const inputHandlers = {
  anyInput(kind, code) {
    audio.unlockAudio();
    G.pauseIdle = 0;
    if (G.screen === 'title' && G.attract?.ride && kind !== 'none') { cam.exitFollow(); cam.mode = 'attract'; G.attract.ride = null; G.attract.nextRide = G.attract.t + 20; endAttractRide(); }
    if (isShown('pause') && (cam.mode === 'attract' || (cam.mode === 'follow' && G.attract?.ride))) { cam.exitFollow(); G.attract = null; cam.mode = 'orbit'; endAttractRide(); }
    return !!G.game?.anyInput?.(kind, code);
  },
  pointerDown(x, y, b) { G.game?.pointerDown?.(x, y, b); },
  drag(dx, dy, x, y, b) {
    if (G.game?.drag?.(dx, dy, x, y, b)) return;
    if (cam.mode === 'attract' && G.screen === 'title') { cam.mode = 'orbit'; G.attract = null; }
    if (cam.mode === 'attract') return;
    G.titleIdle = 0;
    cam.drag(dx, dy, innerHeight);
  },
  dragStart(x, y, b) { G.game?.dragStart?.(x, y, b); },
  dragEnd(x, y, b) { G.game?.dragEnd?.(x, y, b); },
  tilt(dy) { if (cam.mode === 'orbit') cam.tiltBy(dy * 0.004); },
  zoom(f) { if (G.screen === 'title' && cam.mode === 'orbit') { G.titleIdle = 0; cam.zoomBy(f); return; } if (cam.mode === 'attract' || G.screen !== 'play') return; if (cam.mode === 'follow') { G.game?.exitRide?.(); } cam.zoomBy(f); },
  tap(x, y, b) { G.game?.tap?.(x, y, b); },
  rightClick(x, y) { G.game?.rightClick?.(x, y); },
  hover(x, y) { G.game?.hover?.(x, y); },
  key(e) {
    if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) { toggleMute(); if (isShown('pause')) renderPause(menuCtx); return true; }
    if (isShown('confirm')) { if (e.code === 'Escape') { $('#confirm [data-act=cancel]')?.click(); return true; } return false; }
    // the end screens (Commended, Term over) and the finale are left only by their own buttons: Esc would strand a paused term
    const top = G.overlays[G.overlays.length - 1];
    if (top === 'result' || isShown('finale')) return e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space';
    // the 2 to 5 s before Commended or the finale: the term is already paused for them, so no key does anything
    if (G.screen === 'play' && G.game?.pauseReasons?.has('result')) return true;
    // the Charter board and term setup leave through their Back buttons (they restore the title's globe)
    if (e.code === 'Escape' && (top === 'setup' || top === 'charters')) { audio.sfx('ui-cancel'); $(`#${top} [data-act=back]`)?.click(); return true; }
    if (G.game?.key?.(e)) return true;
    // P toggles pause: it closes the pause menu it opened (while playing)
    if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && G.overlays[G.overlays.length - 1] === 'pause') { closePause(); return true; }
    if (e.code === 'Escape') {
      if (G.overlays.length) { if (G.overlays[G.overlays.length - 1] === 'pause') closePause(); else popOverlay(); return true; }
      return false;
    }
    return false;
  },
};

// ------------------------------------------------------------------ quality
function setQuality(q) {
  settings.quality = q;
  setQualityPixelRatio(renderer, q);
  resize();
  if (G.city) { G.city.quality = q; G.city.buildBuildings(G.game?.densities?.() ?? null); G.game?.reapplyCityState?.(); }
  G.net?.setQuality?.(q);
}

// ------------------------------------------------------------------ loop
let last = performance.now(), acc = 0;
function update() {
  // one fixed update = 1/30 s of real (or stepped) time; the sim runs `speed` updates per fixed update in play
  G.updates++;
  logFrame(screenName());
}
function visuals(dt) {
  G.renderTime += dt;
  const t = G.renderTime;
  XRAY.uniforms.uTime.value = t;
  if (G.screen === 'title' && cam.mode === 'orbit' && !G.overlays.length) { G.titleIdle = (G.titleIdle || 0) + dt; if (G.titleIdle > 10) startAttract(); }
  if (G.screen === 'title' || cam.mode === 'attract' || (G.attract?.ride && cam.mode === 'follow')) updateAttract(dt);
  if (isShown('pause') && G.screen === 'play') {
    G.pauseIdle = (G.pauseIdle || 0) + dt;
    if (G.pauseIdle > 10 && cam.mode === 'orbit') { cam.mode = 'attract'; const [la, lo] = [cam.lat, cam.lon]; G.attract = { t: 0, baseLat: la, baseLon: lo, ride: null, nextRide: 20 }; }
  }
  G.game?.visuals?.(dt, t);
  // an attract ride ended some other way (a term started, the pause menu closed, an end screen): drop its scene
  if (G.net?.attractActive && !(G.attract?.ride && cam.mode === 'follow')) endAttractRide();
  cam.update(dt);
  attractScene();
  // X-ray fade
  if (Math.abs(G.xray - G.xrayTarget) > 0.001) {
    G.xray += Math.sign(G.xrayTarget - G.xray) * Math.min(Math.abs(G.xrayTarget - G.xray), dt * 4);
    XRAY.uniforms.uClipOn.value = G.xray > 0.01 ? 1 : 0;
    G.city.setXray(G.xray); G.net?.setXray?.(G.xray);
  }
  setClipDir(camera.position);
  const inside = cam.mode === 'follow' && !G.underwater && (camera.position.length() < 100.5 || (camera.position.length() < 104 && G.xrayTarget > 0.5));
  XRAY.uniforms.uClipDist.value = inside ? 1e5 : 40;
  G.city.setInside(inside); G.net?.setInside?.(inside);
  const d = camera.position.length();
  G.sky.update(t, camera);
  G.city.update(dt, t, d);
  G.net?.update?.(dt, t, d);
}
function draw() {
  const w = innerWidth, h = innerHeight;
  if (Math.abs(cam.viewShift) > 0.002) camera.setViewOffset(w, h, -w * cam.viewShift, 0, w, h);
  else if (camera.view) camera.clearViewOffset();
  G.sky.starMat.uniforms.uPx.value = renderer.getPixelRatio();
  renderer.render(scene, camera);
}
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
  if (document.hidden) return;
  if (!G.frozen) {
    acc += realDt * 30;
    let n = 0;
    const t0 = performance.now();
    while (acc >= 1 && n < 8) {
      update();
      G.game?.fixedUpdate?.(G.speed, false);
      acc -= 1; n++;
    }
    if (n) { const ms = (performance.now() - t0) / n; const a = G.perfStats.updMs; a.push(ms); if (a.length > 120) a.shift(); }
    if (n >= 8) acc = Math.min(acc, 1);
    visuals(realDt);
  }
  if (!G.quiet) draw();
}

/** Debug: move the game on in fixed steps of 1/30 s with real time frozen. */
function step(seconds, drawIt = false) {
  G.frozen = true;
  const n = Math.round(seconds * 30);
  if (n === 0) visuals(0); // camera and HUD catch up with input without moving the game
  const visFrom = Math.max(0, n - 150); // only the last 5 s of visuals run per update; earlier ones in one go
  if (visFrom > 0) visuals(Math.min(5, visFrom / 30));
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    update();
    G.game?.fixedUpdate?.(1, true);
    const ms = performance.now() - t0; const a = G.perfStats.updMs; a.push(ms); if (a.length > 600) a.shift();
    if (i >= visFrom) visuals(1 / 30);
  }
  if (!G.quiet || drawIt) draw();
}

function perf() {
  const out = {};
  const keep = { lat: cam.lat, lon: cam.lon, dist: cam.dist, mode: cam.mode, tilt: cam.tiltManual };
  for (const [name, d] of [['planet', ZOOM.planet], ['district', ZOOM.district]]) {
    if (cam.mode !== 'orbit') cam.mode = 'orbit';
    cam.dist = d; cam.apply(); visuals(0);
    renderer.info.autoReset = false; renderer.info.reset();
    draw();
    out[name] = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    renderer.info.autoReset = true;
  }
  Object.assign(cam, { lat: keep.lat, lon: keep.lon, dist: keep.dist, tiltManual: keep.tilt }); cam.mode = keep.mode; cam.apply();
  const u = G.perfStats.updMs;
  out.avgUpdateMs = u.length ? +(u.reduce((a, b) => a + b, 0) / u.length).toFixed(3) : 0;
  const simPerf = G.game?.simPerf?.() || {};
  out.worstTickMs = simPerf.worstTick ?? null;
  out.worstRecomputeMs = simPerf.worstRecompute ?? null;
  out.quality = settings.quality;
  out.programs = renderer.info.programs?.length;
  return out;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { G.game?.onHidden?.(); }
});
addEventListener('pointerdown', () => audio.unlockAudio(), { capture: true });
addEventListener('keydown', () => audio.unlockAudio(), { capture: true });

// service worker: only when not running locally, or with ?sw=1
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!local || new URLSearchParams(location.search).has('sw'))) navigator.serviceWorker.register('sw.js');

boot().catch((e) => { console.error(e); $('#load-label').textContent = 'Something went wrong while loading. Please reload.'; });
export { G };
