// snapshot.js — save / load the full sim. A restored Game gives the same hash() after the same steps.
// Save format (localStorage key `arcane-transit-authority`): { version, meta, run: { snapshot, savedAt } }.
import { Game } from './sim.js';

export const SAVE_KEY = 'arcane-transit-authority';
export const SAVE_VERSION = 1;

/** Full sim snapshot as a JSON string. */
export function saveRun(game) { return JSON.stringify(game.snapshot()); }
/** Restore a Game from a JSON string or snapshot object. */
export function loadRun(json) { return Game.restore(json); }

/** Whole save blob (meta is the browser's: Merits, unlocks, Commended Charters, best grades, settings...). */
export function makeSave(meta, game) {
  return JSON.stringify({ version: SAVE_VERSION, meta: meta || {}, run: game ? { snapshot: game.snapshot(), savedAt: game.s.update } : null });
}
export function readSave(json) {
  try {
    const o = JSON.parse(json);
    if (!o || o.version !== SAVE_VERSION) return { meta: o?.meta || {}, game: null };
    return { meta: o.meta || {}, game: o.run ? Game.restore(o.run.snapshot) : null };
  } catch { return { meta: {}, game: null }; }
}
