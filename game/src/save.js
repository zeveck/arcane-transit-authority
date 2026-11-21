// save.js — the profile and the term save slots, in localStorage.
// Profile, under 'arcane-transit-authority': { version, meta, banked: [termId…], lastPlayed: slotId }.
//   meta: Merits, unlocks, Commended Charters and best grades, unlocked regions, settings, tutorial done.
//   banked: every term whose Merits are already banked (a term's Merits are banked once, whichever save it ends from).
// Slots, under 'arcane-transit-authority:slot:<id>' (one key each, so a full store can never take the profile with it):
//   { version, id, kind ('auto'|'manual'), termId, savedAt, info: { charter, region, time, throughput, tutorial, freePlay },
//     thumb (small JPEG data URL), data: { sim (snapshot), opts, story } }.
//   Autosaves: 'auto-<termId>', one per term in progress (written once the term has progress), at most AUTO_KEEP: past
//   that, autosaves of terms that also have a manual save go first, then the oldest; the caller is told what went.
//   Manual slots: '1' … '6', changed only when the player saves there.
// Version 1 (a single { meta, run }) is migrated on first load: the run becomes an autosave.

export const SAVE_KEY = 'arcane-transit-authority';
export const SAVE_VERSION = 2;
export const SLOT_VERSION = 1;
export const MANUAL_SLOTS = ['1', '2', '3', '4', '5', '6'];
export const AUTO_KEEP = 8;
const SLOT_PREFIX = SAVE_KEY + ':slot:';

export function defaultMeta() {
  return {
    merits: 0,
    meritsEarned: 0,
    commended: {},            // charterId -> { stars, best: {grade...} }
    unlockedCharters: ['I'],
    unlockedRegions: ['capital'],
    ownedMilestones: [],      // unlock-pool milestone ids bought
    ownedPerks: [],           // one entry per perk bought (a perk is used up by the term that starts with it)
    ownedLiveries: ['classic'],
    livery: 'classic',
    tutorialDone: false,
    finaleSeen: false,
    termsPlayed: 0,
    settings: { music: 0.7, sound: 0.8, muted: false, quality: 'high', shake: true, hints: true },
  };
}

let cache = null;
let lastError = null;
export function lastSaveError() { return lastError; }
export function newTermId() { return Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); }

function setItem(k, v) {
  try { localStorage.setItem(k, v); return true; } catch (e) { lastError = e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '') ? 'quota' : 'write'; return false; }
}

export function loadSave() {
  if (cache) return cache;
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { data = null; }
  if (!data || typeof data !== 'object') data = { version: SAVE_VERSION, meta: defaultMeta(), banked: [], lastPlayed: null };
  // version 1: one global { meta, run } → the run becomes an autosave slot
  if (data.version === 1) {
    const run = data.run;
    data = { version: SAVE_VERSION, meta: data.meta, banked: [], lastPlayed: null };
    cache = data;
    if (run?.sim) {
      const termId = newTermId();
      const r = writeSlotRaw('auto-' + termId, { kind: 'auto', termId, info: infoFromSnapshot(run.sim), thumb: null, data: { sim: run.sim, opts: run.opts, story: run.story } });
      if (r.ok) data.lastPlayed = 'auto-' + termId;
    }
  }
  if (data.version !== SAVE_VERSION) data = { version: SAVE_VERSION, meta: data.meta || defaultMeta(), banked: data.banked || [], lastPlayed: data.lastPlayed || null };
  const d = defaultMeta();
  data.meta = { ...d, ...(data.meta || {}), settings: { ...d.settings, ...(data.meta?.settings || {}) } };
  data.banked = Array.isArray(data.banked) ? data.banked : [];
  delete data.run;
  cache = data;
  writeSave();
  return data;
}

export function meta() { return loadSave().meta; }
export function writeSave() { return setItem(SAVE_KEY, JSON.stringify(loadSave())); }
export function saveMeta(patch) { Object.assign(loadSave().meta, patch || {}); writeSave(); }
export function resetProgress() {
  const keepSettings = meta().settings;
  for (const s of listSlots()) localStorage.removeItem(SLOT_PREFIX + s.id);
  cache = { version: SAVE_VERSION, meta: { ...defaultMeta(), settings: keepSettings }, banked: [], lastPlayed: null };
  writeSave();
}

// ------------------------------------------------------------------ banking once per term
export function isBanked(termId) { return !!termId && loadSave().banked.includes(termId); }
export function markBanked(termId) { if (!termId || isBanked(termId)) return; const b = loadSave().banked; b.push(termId); if (b.length > 500) b.splice(0, b.length - 500); writeSave(); }

// ------------------------------------------------------------------ slots
/** Header info for a slot list, read from a sim snapshot (best effort). */
export function infoFromSnapshot(snap) {
  const s = snap?.s || snap?.state || snap || {};
  return { charter: s.charter ?? null, region: s.region ?? null, time: s.time ?? 0, throughput: null, tutorial: !!s.tutorial, freePlay: !!s.freePlay };
}
function writeSlotRaw(id, rec) {
  const full = { version: SLOT_VERSION, id, savedAt: Date.now(), ...rec };
  const ok = setItem(SLOT_PREFIX + id, JSON.stringify(full));
  return ok ? { ok: true, slot: full } : { ok: false, error: lastError };
}
/** Autosaves that may make room, least valuable first: those whose term also has a manual save, then the oldest.
 *  Never the slot being written or the autosave of the term being saved. */
function spareAutos(keep) {
  const all = listSlots(); const manualTerms = new Set(all.filter((s) => s.kind === 'manual' && s.termId).map((s) => s.termId));
  return all.filter((s) => s.kind === 'auto' && !keep.includes(s.id))
    .sort((a, b) => (manualTerms.has(b.termId) - manualTerms.has(a.termId)) || ((a.savedAt || 0) - (b.savedAt || 0)));
}
/** Write a slot. On a full store, make room from spare autosaves one at a time; if that still isn't enough, put them
 *  all back and report the failure. The profile is never touched. Returns { ok, error, removed: [slot headers] }. */
export function writeSlot(id, rec) {
  const keep = [id, rec.termId ? 'auto-' + rec.termId : null].filter(Boolean);
  let r = writeSlotRaw(id, rec); const removed = [];
  if (!r.ok && r.error === 'quota') {
    const stash = [];
    for (const a of spareAutos(keep)) {
      const raw = localStorage.getItem(SLOT_PREFIX + a.id); stash.push([a, raw]);
      localStorage.removeItem(SLOT_PREFIX + a.id);
      r = writeSlotRaw(id, rec); if (r.ok) break;
    }
    if (r.ok) removed.push(...stash.map(([a]) => a));
    else for (const [a, raw] of stash.reverse()) if (raw != null) setItem(SLOT_PREFIX + a.id, raw); // nothing gained: put them back
  }
  if (r.ok) { loadSave().lastPlayed = id; writeSave(); if (rec.kind === 'auto') removed.push(...pruneAutos(keep)); }
  return { ...r, removed };
}
/** At most AUTO_KEEP autosaves (manual slots are never touched). Returns the slots removed. */
function pruneAutos(keep) {
  const autos = listSlots().filter((s) => s.kind === 'auto');
  if (autos.length <= AUTO_KEEP) return [];
  const drop = spareAutos(keep).slice(0, autos.length - AUTO_KEEP);
  drop.forEach((s) => deleteSlot(s.id));
  return drop;
}
/** How many autosaves the next new term would push out (New Term warns about it). */
export function autosToDrop() { return Math.max(0, listSlots().filter((s) => s.kind === 'auto').length + 1 - AUTO_KEEP); }
export function readSlot(id) {
  let raw = null;
  try { raw = localStorage.getItem(SLOT_PREFIX + id); } catch { raw = null; }
  if (raw == null) return null;
  try {
    const r = JSON.parse(raw);
    if (!r || typeof r !== 'object' || r.version !== SLOT_VERSION || !r.data?.sim) return { id, damaged: true };
    return r;
  } catch { return { id, damaged: true }; }
}
export function deleteSlot(id) { try { localStorage.removeItem(SLOT_PREFIX + id); } catch { /* ignore */ } if (loadSave().lastPlayed === id) { cache.lastPlayed = null; writeSave(); } }
/** Every slot, newest first: headers only ({ id, kind, termId, savedAt, info, thumb } or { id, damaged }). */
export function listSlots() {
  const out = [];
  let keys = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(SLOT_PREFIX)) keys.push(k.slice(SLOT_PREFIX.length)); } } catch { keys = []; }
  for (const id of keys) {
    const r = readSlot(id); if (!r) continue;
    out.push(r.damaged ? { id, kind: id.startsWith('auto-') ? 'auto' : 'manual', damaged: true, savedAt: 0 } : { id, kind: r.kind, termId: r.termId, savedAt: r.savedAt, info: r.info, thumb: r.thumb });
  }
  return out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}
/** The slot Continue loads: the last one played or saved, else the newest. */
export function latestSlot() {
  const lp = loadSave().lastPlayed;
  if (lp) { const r = readSlot(lp); if (r && !r.damaged) return lp; }
  return listSlots().find((s) => !s.damaged)?.id ?? null;
}
export function setLastPlayed(id) { loadSave().lastPlayed = id; writeSave(); }
