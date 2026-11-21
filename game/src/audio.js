// audio.js — Web Audio: music with seam crossfades and track crossfades, sfx with a per-file gain table
// (from assets/audio/manifest.json), unlock on first input, separate music / sound volumes, mute (M).

const BASE = 'assets/audio/';
const MUSIC = ['title', 'build', 'busy', 'disaster', 'fanfare', 'finale'];
const LOOP_SEAM = 1.5;     // each loop crossfades over its own seam
const TRACK_FADE = 2.0;

let ctx = null, master, musicBus, sfxBus, ambBus;
let gains = {};            // file -> gain
const buffers = new Map(); // name -> AudioBuffer
const loading = new Map();
let settings = { music: 0.7, sound: 0.8, muted: false };
let current = null;        // { name, nodes:[{src,g}], timer, loop }
let wantMusic = null;
let unlocked = false;
let lastSfx = new Map();
const ambs = {};           // name -> { src, g, target }
let duckLevel = 1;

export async function initAudio(saved) {
  if (saved) Object.assign(settings, saved);
  try {
    const m = await (await fetch(BASE + 'manifest.json')).json();
    for (const [f, v] of Object.entries(m.files || {})) gains[f] = v.gain ?? 1;
  } catch { /* defaults */ }
}

function makeCtx() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.connect(sfxBus);
  applyVolumes();
}

/** Call on the first pointer or key input. */
export function unlockAudio() {
  makeCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (!unlocked) {
    unlocked = true;
    if (wantMusic) { const w = wantMusic; wantMusic = null; playMusic(w); }
    preloadSfx();
  }
}

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music * duckLevel, t, 0.1);
  sfxBus.gain.setTargetAtTime(settings.sound, t, 0.05);
}

export function setVolumes(v) { Object.assign(settings, v); applyVolumes(); }
export function getSettings() { return { ...settings }; }
export function toggleMute() { settings.muted = !settings.muted; applyVolumes(); return settings.muted; }
export function duck(on) { duckLevel = on ? 0.35 : 1; applyVolumes(); }

const bytes = new Map();   // file -> Promise<ArrayBuffer|null> (fetched before the AudioContext exists)
function fetchBytes(file) {
  if (!bytes.has(file)) bytes.set(file, fetch(BASE + file).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  return bytes.get(file);
}
/** Fetch a music track in the background (no decoding, no AudioContext), so it is ready when it is played. */
export function prefetchMusic(name) { return MUSIC.includes(name) ? fetchBytes(`music/${name}.mp3`) : Promise.resolve(null); }
async function load(file) {
  if (buffers.has(file)) return buffers.get(file);
  if (loading.has(file)) return loading.get(file);
  const p = (async () => {
    try {
      const ab = await fetchBytes(file); bytes.delete(file);
      if (!ab) return null;
      makeCtx();
      const buf = await ctx.decodeAudioData(ab);
      buffers.set(file, buf); return buf;
    } catch { return null; }
  })();
  loading.set(file, p);
  return p;
}

const SFX_PRELOAD = ['ui-click', 'ui-tool', 'ui-cancel', 'ui-error', 'build-station', 'build-rail-grow', 'build-confirm', 'money-chime',
  'build-demolish', 'build-bloom', 'build-train-add', 'dispatch-blip', 'warp-spinup', 'depart-deep', 'warp-return', 'quota-sting'];
function preloadSfx() { for (const n of SFX_PRELOAD) load(`sfx/${n}.mp3`); }

/**
 * Play a sound effect. opts: { rate, gain, minGap (s), reverse }.
 */
export function sfx(name, opts = {}) {
  if (!ctx || !unlocked) return;
  const file = `sfx/${name}.mp3`;
  const now = ctx.currentTime;
  const gap = opts.minGap ?? 0.04;
  if ((lastSfx.get(name) ?? -9) > now - gap) return;
  lastSfx.set(name, now);
  const buf = buffers.get(file);
  if (!buf) { load(file); return; }
  const src = ctx.createBufferSource();
  src.buffer = opts.reverse ? reversed(file, buf) : buf;
  src.playbackRate.value = opts.rate ?? 1;
  const g = ctx.createGain(); g.gain.value = (gains[file] ?? 1) * (opts.gain ?? 1);
  src.connect(g).connect(sfxBus);
  src.start();
}
const revCache = new Map();
function reversed(file, buf) {
  if (revCache.has(file)) return revCache.get(file);
  const r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) { const s = buf.getChannelData(c), d = r.getChannelData(c); for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i]; }
  revCache.set(file, r); return r;
}

/** Crossfade to a music track (loops with a seam crossfade). once: play a single time then return to `after`. */
export function playMusic(name, { once = false, after = null } = {}) {
  if (!MUSIC.includes(name)) return;
  if (!ctx || !unlocked) { wantMusic = name; return; }
  if (current && current.name === name && !once) return;
  const file = `music/${name}.mp3`;
  const token = {};
  const prev = current;
  current = { name, token, nodes: [], timer: null, once, after };
  if (prev) fadeOutTrack(prev, TRACK_FADE);
  load(file).then((buf) => {
    if (!buf || current?.token !== token) return;
    startVoice(current, buf, file, prev ? TRACK_FADE : 0.8);
  });
}
function startVoice(track, buf, file, fadeIn) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); const level = gains[file] ?? 0.6;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + fadeIn);
  src.connect(g).connect(musicBus); src.start(t);
  track.nodes.push({ src, g });
  if (track.once) {
    track.timer = setTimeout(() => { if (current === track) { const a = track.after; current = null; fadeOutTrack(track, 1.5); if (a) playMusic(a); } }, (buf.duration - 1.5) * 1000);
    return;
  }
  // schedule the next voice so it overlaps the seam
  const next = Math.max(0.5, buf.duration - LOOP_SEAM);
  track.timer = setTimeout(() => {
    if (current !== track) return;
    const old = track.nodes.shift();
    if (old) { const tt = ctx.currentTime; old.g.gain.setValueAtTime(old.g.gain.value, tt); old.g.gain.linearRampToValueAtTime(0.0001, tt + LOOP_SEAM); old.src.stop(tt + LOOP_SEAM + 0.1); }
    startVoice(track, buf, file, LOOP_SEAM);
  }, next * 1000);
}
function fadeOutTrack(track, secs) {
  clearTimeout(track.timer);
  const t = ctx.currentTime;
  for (const { src, g } of track.nodes) {
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.linearRampToValueAtTime(0.0001, t + secs);
    try { src.stop(t + secs + 0.1); } catch { /* already stopped */ }
  }
}
export function stopMusic() { if (current && ctx) fadeOutTrack(current, 1); current = null; wantMusic = null; }
export function musicName() { return current?.name ?? wantMusic ?? null; }

/** Ambience beds ('amb-city', 'amb-deep'): level 0..1, smoothly. */
export function ambience(name, level) {
  if (!ctx || !unlocked) return;
  let a = ambs[name];
  const file = `sfx/${name}.mp3`;
  if (!a) {
    a = ambs[name] = { src: null, g: ctx.createGain(), level: 0 };
    a.g.gain.value = 0; a.g.connect(ambBus);
    load(file).then((buf) => { if (!buf) return; const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(a.g); s.start(); a.src = s; });
  }
  if (Math.abs(a.level - level) < 0.02) return;
  a.level = level;
  a.g.gain.setTargetAtTime(level * (gains[file] ?? 1), ctx.currentTime, 0.6);
}

export function audioState() {
  return { context: ctx?.state ?? 'none', unlocked, music: current?.name ?? null, musicMuted: settings.muted || settings.music === 0, sfxMuted: settings.muted || settings.sound === 0, muted: settings.muted, volumes: { music: settings.music, sound: settings.sound } };
}
