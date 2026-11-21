#!/usr/bin/env node
// tools/starthashes.mjs — engine-independence reference: for every Charter × starting region (term seed 11) and
// each recorded solution's own start, the hash() at the term start and after 300 s of game time with no actions.
// Writes design/solutions/start-hashes.json; the browser (tools/replay.mjs) runs the same terms and compares.
//   node tools/starthashes.mjs           write the file
//   node tools/starthashes.mjs --check   recompute and compare with the file (exit 1 on a difference)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../game/src/sim.js';
import { SOLVER } from '../game/src/tuning.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'design', 'solutions', 'start-hashes.json');
export const STEP_SECONDS = 300;
const CHARTERS = ['I', 'II', 'III', 'IV', 'V', 'VI'], REGIONS = ['capital', 'brine', 'rift', 'spires', 'flats', 'ringside'];
const SOLUTION_STARTS = [['I', 'capital', SOLVER.tutorialTermSeed, true], ['II', 'brine', 202], ['III', 'rift', 303], ['IV', 'spires', 404], ['V', 'flats', 515], ['VI', 'ringside', 626], ['G', 'ringside', 717]];

export function computeStartHashes() {
  const rows = [];
  const one = (charter, region, termSeed, tutorial = false) => {
    const g = Game.newTerm(tutorial ? { tutorial: true } : { charter, region, termSeed });
    const start = g.hash(), priority = g.s.priority.slice(), mandates = g.s.mandates.slice();
    g.step(STEP_SECONDS);
    rows.push({ charter, region, termSeed, tutorial, start, after: g.hash(), afterSeconds: STEP_SECONDS, priority, mandates, geoHash: g.geoHash() });
  };
  for (const c of CHARTERS) for (const r of REGIONS) one(c, r, 11);
  for (const [c, r, s, t] of SOLUTION_STARTS) one(c, r, s, !!t);
  return rows;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rows = computeStartHashes();
  if (process.argv.includes('--check')) {
    const want = JSON.parse(fs.readFileSync(OUT, 'utf8')).rows;
    const bad = rows.filter((r, i) => !want[i] || want[i].start !== r.start || want[i].after !== r.after);
    console.log(bad.length ? `MISMATCH in ${bad.length} terms` : `OK: ${rows.length} term starts match`);
    process.exit(bad.length ? 1 : 0);
  }
  fs.writeFileSync(OUT, JSON.stringify({ note: 'hash() at term start and after afterSeconds of game time with no actions (Node). The browser must produce the same.', rows }, null, 1));
  console.log(`wrote ${rows.length} term starts to ${OUT}`);
}
