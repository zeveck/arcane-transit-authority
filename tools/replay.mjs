#!/usr/bin/env node
// tools/replay.mjs — replay the recorded solutions (design/solutions/charter-<n>.json) in the browser with
// real input, as the Tech plan's "Recorded solutions and browser replay" describes: quiet mode, stepTo(T),
// then each action as real input (arrow keys to rotate the globe until the target is visible, the mouse
// wheel to zoom, real clicks, the Places list, keys), asserting the pin / selection after every click and
// stopping on a mismatch; the card is picked by its kind. hash() at each quota (from the sim's quota event,
// pushed to window.__runLog) is checked against the solution's expected hashes. Each Charter runs twice.
//
// Needs the game served (python3 <gamegen>/scripts/serve.py 8130 game) and playwright-cli.
//   node tools/replay.mjs [I II ...] [--url http://127.0.0.1:8130/] [--session bb-replay] [--runs 2] [--limit 1500]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { replay as nodeReplay } from './solve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const charters = args.filter((a) => /^(I|II|III|IV|V|VI)$/.test(a));
const URL = opt('url', 'http://127.0.0.1:8130/');
const SESSION = opt('session', 'bb-replay');
const RUNS = +opt('runs', 2);
const LIMIT = +opt('limit', 1500); // seconds of real time per run
const list = charters.length ? charters : ['I', 'II', 'III', 'IV', 'V', 'VI', 'G'];

function pageScript(sol) {
  return `async page => {
  const SOL = ${JSON.stringify(sol)};
  const URL = ${JSON.stringify(URL)};
  const LIMIT = ${LIMIT * 1000};
  const t0 = Date.now();
  const out = { charter: SOL.charter, done: 0, of: SOL.actions.length, fail: null, quotas: [], seconds: 0 };
  const ev = (f, a) => page.evaluate(f, a);
  const step = (s) => ev((s) => { __game.step(s); return 1; }, s);
  const st = () => ev(() => __game.state());
  const W = 1280, H = 800;
  const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
  const samePlace = (a, b) => (typeof a === 'object' && a) ? (b && typeof b === 'object' && a.station === b.station) : a === b;
  const fail = (msg) => { throw new Error(msg); };
  try {
    await page.setViewportSize({ width: W, height: H });
    await page.goto(URL);
    await page.waitForFunction(() => window.__game && __game.state().screen === 'title', null, { timeout: 120000 });
    await ev(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__game && __game.state().screen === 'title', null, { timeout: 120000 });
    await ev(() => { __game.quiet(true); window.__runLog.length = 0; });
    if (SOL.tutorial) {
      await page.click('#title-menu [data-act=new]'); await step(0);
      await page.click('.dispatch.tut [data-skip]'); await step(0);
    } else {
      await ev(([c, r, s]) => __game.startTerm(c, r, s), [SOL.charter, SOL.region, SOL.termSeed]);
    }
    await step(0);
    const s0 = await st(); if (s0.screen !== 'play') fail('term did not start');
    if (s0.time !== 0) fail('term started at time ' + s0.time);
    await page.mouse.move(W / 2, H / 2);

    // ---------------------------------------------------------------- helpers (all real input)
    const clearUi = async () => {
      for (let i = 0; i < 4; i++) {
        const s = await st();
        if (s.overlays.includes('tech')) { await page.keyboard.press('KeyT'); await step(0); continue; }
        if (!s.pins.a && !s.selection && s.tool === 'route' && !(await ev(() => !!document.querySelector('#hud-root .rpanel')))) return;
        await page.mouse.click(W / 2, 140, { button: 'right' }); await step(0);
      }
    };
    const cellOf = (t) => ev((t) => { if (typeof t === 'number') return t; if (t.station != null) return __game.stations().find((s) => s.id === t.station)?.cell; return t.cell; }, t);
    const aim = async (cell, dist = 175) => {
      const ll = await ev((c) => { const x = __game.cells((q) => q.id === c)[0]; return [x.lat, x.lon]; }, cell);
      for (let i = 0; i < 120; i++) {
        const cam = (await st()).camera;
        const dlat = ll[0] - cam.lat; let dlon = ll[1] - cam.lon; dlon = ((dlon + 540) % 360) - 180;
        const lonOk = Math.abs(dlon) <= 3 || Math.abs(ll[0]) > 86;
        const latOk = Math.abs(dlat) <= 3 || (Math.abs(cam.lat) >= 81.9 && Math.sign(dlat) === Math.sign(cam.lat));
        if (latOk && lonOk) break;
        if (Math.abs(dlat) > 3 && !latOk) { await page.keyboard.press(dlat > 0 ? 'ArrowUp' : 'ArrowDown'); await step(0); continue; }
        if (Math.abs(dlat) > 3) await page.keyboard.press(dlat > 0 ? 'ArrowUp' : 'ArrowDown');
        else await page.keyboard.press(dlon > 0 ? 'ArrowRight' : 'ArrowLeft');
        await step(0);
      }
      const d = (await st()).camera.dist;
      if (Math.abs(d - dist) > 6) { await page.mouse.move(W / 2, H / 2); await page.mouse.wheel(0, Math.log((dist - 100) / (d - 100)) / 0.0015); await step(0); }
    };
    // a screen point that picks exactly this place (route tool picking rules)
    const findPoint = async (place) => {
      if (typeof place === 'object' && place.station != null) {
        const p = await ev((id) => __game.project({ station: id }), place.station);
        if (p && p.visible && (await ev(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.id; }, [p.x, p.y])) === 'c') { const k = await ev(([x, y]) => __game.pickAt(x, y), [p.x, p.y]); if (k && k.kind === 'station' && k.id === place.station) return p; }
        // stations the globe hides show as HUD markers while choosing B: click the marker itself
        const mk = await ev((id) => { const e = document.querySelector('#hud-root .hud-marker[data-station="' + id + '"]'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }, place.station);
        if (mk) { const top = await ev(([x, y, id]) => { const e = document.elementFromPoint(x, y); const m = e && e.closest && e.closest('.hud-marker'); return m && m.dataset.station === String(id); }, [mk.x, mk.y, place.station]); if (top) return mk; }
        return null;
      }
      const pts = await ev((c) => __game.cellOffsets(c), place);
      for (const q of pts) {
        const p = await ev((q) => __game.projectPoint(q), q);
        if (!p || !p.visible || p.y < 90 || p.y > H - 110 || p.x > W - 420) continue;
        const el = await ev(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.id; }, [p.x, p.y]);
        if (el !== 'c') continue;
        const k = await ev(([x, y]) => __game.pickAt(x, y), [p.x, p.y]);
        if (k && k.kind === 'cell' && k.id === place) return p;
      }
      return null;
    };
    const cellPoint = async (cell) => {
      const pts = await ev((c) => __game.cellOffsets(c, 2.5), cell);
      for (const q of pts) {
        const p = await ev((q) => __game.projectPoint(q), q);
        if (!p || !p.visible || p.y < 90 || p.y > H - 110 || p.x > W - 420) continue;
        const el = await ev(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.id; }, [p.x, p.y]);
        if (el !== 'c') continue;
        if (await ev(([x, y]) => __game.cellAt(x, y), [p.x, p.y]) === cell) return p;
      }
      return null;
    };
    const clickPlace = async (place) => {
      const cell = await cellOf(place);
      for (const dist of [175, 140, 125, 220, 270]) {
        await aim(cell, dist);
        const p = await findPoint(place);
        if (p) { await page.mouse.click(p.x, p.y); await step(0); return true; }
      }
      return false;
    };
    const logLen = () => ev(() => __game.simLog().length);
    const expectLogged = async (n0, a) => {
      const log = await ev(() => __game.simLog());
      if (log.length !== n0 + 1) fail('action not performed: ' + JSON.stringify(a) + ' (log ' + n0 + ' -> ' + log.length + ')');
      const got = log[log.length - 1][1];
      if (canon(got) !== canon(a)) fail('different action: wanted ' + JSON.stringify(a) + ' got ' + JSON.stringify(got));
    };

    // ---------------------------------------------------------------- the actions
    for (const [T, a] of SOL.actions) {
      if (Date.now() - t0 > LIMIT) fail('time limit');
      const now = (await st()).time;
      if (now < T) await ev((T) => { __game.stepTo(T); return 1; }, T);
      if ((await st()).time !== T) fail('stepTo(' + T + ') landed at ' + (await st()).time);
      const n0 = await logLen();
      if (a.type === 'buildRoute') {
        await clearUi(); await page.keyboard.press('KeyR'); await step(0);
        if (!(await clickPlace(a.a))) fail('could not find a click for A ' + JSON.stringify(a.a));
        let s = await st(); if (!samePlace(a.a, s.pins.a)) fail('pin A mismatch: wanted ' + JSON.stringify(a.a) + ' got ' + JSON.stringify(s.pins.a));
        if (!(await clickPlace(a.b))) fail('could not find a click for B ' + JSON.stringify(a.b));
        s = await st(); if (!samePlace(a.b, s.pins.b)) fail('pin B mismatch: wanted ' + JSON.stringify(a.b) + ' got ' + JSON.stringify(s.pins.b));
        const cards = await ev(() => __game.routeCards());
        const i = cards.findIndex((c) => c.kind === a.kind && c.feasible);
        if (i < 0) fail('no feasible ' + a.kind + ' card');
        await page.hover('.rcard[data-i="' + i + '"]'); await step(0);
        // the card's Build button (Plan it sits beside it; a click on the card body could land on it)
        await page.click('.rcard[data-i="' + i + '"] [data-build]'); await step(0);
        if ((await logLen()) === n0) fail('card click did not build: ' + JSON.stringify(await ev((i) => ({ card: __game.routeCards()[i], hi: __game.state().highlighted, cardsOpen: __game.state().cards, money: Math.round(__game.state().money), toasts: [...document.querySelectorAll('#hud-root .toast')].map((t) => t.textContent), dispatch: [...document.querySelectorAll('#hud-root .dispatch')].map((t) => t.innerText.slice(0, 120)) }), i)));
      } else if (a.type === 'addTrain' || a.type === 'removeTrain') {
        await clearUi(); await page.keyboard.press('Slash'); await step(0);
        await page.click('.rpanel [data-line="' + a.line + '"]'); await step(0);
        const s = await st(); if (!s.selection || s.selection.kind !== 'line' || s.selection.id !== a.line) fail('line selection mismatch: ' + JSON.stringify(s.selection));
        await page.keyboard.press(a.type === 'addTrain' ? 'Equal' : 'Minus'); await step(0);
      } else if (a.type === 'upgradeInterchange') {
        await clearUi(); await page.keyboard.press('KeyR'); await step(0);
        const inside = await ev((id) => __game.stations().find((x) => x.id === id)?.kind === 'core', a.station);
        if (inside && !(await st()).xrayOn) { await page.keyboard.press('KeyV'); await step(0); }
        if (!(await clickPlace({ station: a.station }))) {
          // nothing needs a precise tap: every station is in the Places list
          await clearUi(); await page.keyboard.press('KeyR'); await page.keyboard.press('Slash'); await step(0);
          await page.click('.rpanel .place[data-sid="' + a.station + '"]'); await step(0);
        }
        if (inside && (await st()).xrayOn) { await page.keyboard.press('KeyV'); await step(0); }
        const s = await st(); if (!samePlace({ station: a.station }, s.pins.a)) fail('station pin mismatch: ' + JSON.stringify(s.pins.a));
        if (!(await page.$('.rpanel [data-a=upgrade]'))) fail('no upgrade button: ' + JSON.stringify(await ev(() => { const e = document.querySelector('#hud-root .rpanel'); return [e && e.dataset.kind, e && e.innerText.slice(0, 160), __game.state().pins, __game.state().selection, __game.state().overlays]; })));
        await page.click('.rpanel [data-a=upgrade]'); await step(0);
      } else if (a.type === 'buyTech') {
        await clearUi(); await page.keyboard.press('KeyT'); await step(0);
        await page.click('#tech .tnode[data-id="' + a.id + '"]'); await step(0);
        await page.keyboard.press('KeyT'); await step(0);
      } else if (a.type === 'green') {
        await clearUi(); await page.keyboard.press('KeyG'); await step(0);
        await page.click('.rpanel .pick[data-k="' + a.kind + '"]'); await step(0);
        if (a.look) { await page.click('.rpanel [data-look="' + a.look + '"]'); await step(0); }
        let p = null; for (const dist of [175, 140]) { await aim(a.cell, dist); p = await cellPoint(a.cell); if (p) break; }
        if (!p) fail('could not find cell ' + a.cell);
        await page.mouse.click(p.x, p.y); await step(0);
        await page.keyboard.press('KeyR'); await step(0);
      } else if (a.type === 'brace' || a.type === 'reroute') {
        await clearUi();
        if (!(await ev(() => !document.querySelector('#hud-root .disaster').hidden))) fail('no disaster banner for ' + a.type);
        await page.keyboard.press(a.type === 'brace' ? 'Digit1' : 'Digit2'); await step(0);
      } else if (['repairAll', 'coolant', 'restorePower'].includes(a.type)) {
        await clearUi();
        await ev(() => __ata.game.hud.disasterRefresh());
        await page.click('#hud-root .disaster [data-d="' + a.type + '"]'); await step(0);
      } else fail('unsupported action ' + a.type);
      await expectLogged(n0, a);
      out.done++;
    }
    const end = SOL.commendedAt ?? SOL.finalTime;
    await ev((T) => { __game.stepTo(T); return 1; }, end);
  } catch (e) { out.fail = String(e && e.message || e).slice(0, 400); }
  out.quotas = await ev(() => window.__runLog.slice());
  out.state = await ev(() => { const s = __game.state(); return { time: s.time, quotaStage: s.quotaStage, money: Math.round(s.money), hash: __game.hash() }; });
  out.seconds = Math.round((Date.now() - t0) / 1000);
  return JSON.stringify(out);
}`;
}

function runOnce(sol) {
  const code = pageScript(sol);
  const file = path.join(ROOT, '.playwright', `replay-${sol.charter}.js`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, code);
  let txt;
  try {
    txt = execFileSync('playwright-cli', [`-s=${SESSION}`, 'run-code', code], { cwd: ROOT, encoding: 'utf8', timeout: (LIMIT + 300) * 1000, maxBuffer: 1 << 26 });
  } catch (e) { return { fail: 'playwright-cli: ' + String(e.message).slice(0, 300) }; }
  const m = txt.match(/### Result\s*\n"(.*)"\s*\n/);
  if (!m) return { fail: 'no result: ' + txt.slice(0, 300) };
  return JSON.parse(JSON.parse('"' + m[1] + '"'));
}

const report = [];
let failsInRow = 0;
execFileSync('playwright-cli', [`-s=${SESSION}`, 'open', 'about:blank'], { cwd: ROOT, encoding: 'utf8' });
try {
  for (const n of list) {
    const sol = JSON.parse(fs.readFileSync(path.join(ROOT, 'design', 'solutions', `charter-${n}.json`), 'utf8'));
    const runs = [];
    // the same solution replayed by the current sim in Node (tools/solve.mjs replay): the reference hashes
    const ref = nodeReplay(sol).got.map((q) => ({ quota: q.quota, time: q.time, hash: q.hash }));
    const recordedOk = sol.quotas.every((q, i) => ref[i] && ref[i].hash === q.hash);
    console.log(`${n} node replay: ${ref.map((q) => `Q${q.quota}@${q.time}s ${q.hash}`).join(' ')} · recorded ${sol.quotas.map((q) => q.hash).join(' ')} (${recordedOk ? 'same' : 'STALE: the sim changed since the solution was written'})`);
    for (let r = 0; r < RUNS; r++) {
      const res = runOnce(sol);
      const want = recordedOk ? sol.quotas : ref;
      const got = res.quotas || [];
      const match = want.length === sol.quotas.length && want.every((q, i) => got[i] && got[i].hash === q.hash && got[i].time === q.time);
      const matchRecorded = sol.quotas.every((q, i) => got[i] && got[i].hash === q.hash && got[i].time === q.time);
      runs.push({ ...res, match, matchRecorded });
      console.log(`${n} run ${r + 1}: ${res.fail ? 'FAIL ' + res.fail : 'ok'} · actions ${res.done ?? '?'}/${res.of ?? sol.actions.length} · quotas ${got.map((q) => `Q${q.quota}@${q.time}s ${q.hash}`).join(' ')} · ${match ? 'MATCH' : 'DIFFER'} (node) · ${matchRecorded ? 'MATCH' : 'DIFFER'} (recorded) · ${res.seconds}s`);
      if (res.fail || !match) failsInRow++; else failsInRow = 0;
      if (failsInRow >= 3) break;
    }
    const same = runs.length === 2 && runs[0].quotas && runs[1].quotas && JSON.stringify(runs[0].quotas.map((q) => q.hash)) === JSON.stringify(runs[1].quotas.map((q) => q.hash));
    const pass = runs.length === RUNS && runs.every((r) => !r.fail && r.match) && (RUNS < 2 || same);
    report.push({ charter: n, pass, bothRunsSame: same, recordedHashesCurrent: recordedOk, nodeHashes: ref, recorded: sol.quotas.map((q) => ({ quota: q.quota, time: q.time, hash: q.hash })), runs: runs.map((r) => ({ fail: r.fail, match: r.match, matchRecorded: r.matchRecorded, seconds: r.seconds, quotas: r.quotas, state: r.state })) });
    console.log(`${n}: ${pass ? 'PASS' : 'FAIL'} (runs agree: ${same})`);
    if (failsInRow >= 3) { console.log('stopping: 3 failures in a row'); break; }
  }
} finally {
  try { execFileSync('playwright-cli', [`-s=${SESSION}`, 'close'], { cwd: ROOT }); } catch { /* closed */ }
}
fs.writeFileSync(path.join(ROOT, 'design', 'solutions', 'replay-report.json'), JSON.stringify(report, null, 1));
console.log('report: design/solutions/replay-report.json');
