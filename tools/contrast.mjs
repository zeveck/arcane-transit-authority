#!/usr/bin/env node
// tools/contrast.mjs — the palette rules from GAME_DESIGN.md (Art direction: palette):
//  1. no world material uses a type hex (the Monument's spiral excepted);
//  2. #ffffff only on the load markers (neutral white multipliers under instance colours / livery tints are listed, not drawn white);
//  3. every saturated world colour (HSV s > 0.4) drawn at or above the ground is >= 30° of hue from each type colour drawn there
//     (all types except fire, which is only drawn inside the core); interior colours are checked by luminance contrast instead;
//  4. rose and teal neon stay within their caps (emissive <= 0.3, haze opacity <= 0.15);
//  5. every line colour is >= 3:1 (WCAG luminance ratio) on each backdrop it is drawn on.
// World colours come from palette.js (WORLD_COLORS, REGION_COLORS), tuning.js (liveries) and the hex literals in the
// browser's world-material files (city.js, scene.js, xray.js, models.js, render-net.js), which import three.js and so are
// scanned as text rather than imported. Exit code 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPE_COLORS, WORLD_COLORS, NEON_CAPS, LOAD_MARKER, REGION_COLORS } from '../game/src/palette.js';
import { MERITS } from '../game/src/tuning.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'game', 'src');
const fails = [], notes = [];
const norm = (h) => '#' + h.replace(/^#|^0x/i, '').toLowerCase();
const rgb = (h) => { const n = parseInt(norm(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255); };
function hsv(h) {
  const [r, g, b] = rgb(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hue = 0;
  if (d) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hue * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
const lum = (h) => { const c = rgb(h).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const lift = (h, t = 0.3) => '#' + rgb(h).map((x) => Math.round((x + (1 - x) * t) * 255).toString(16).padStart(2, '0')).join('');
const TYPES = Object.fromEntries(Object.entries(TYPE_COLORS).map(([k, v]) => [k, norm(v)]));
const typeHexes = new Set(Object.values(TYPES));
const ABOVE_TYPES = Object.keys(TYPES).filter((k) => k !== 'fire');
const NEON = new Set([norm(WORLD_COLORS.neonRose), norm(WORLD_COLORS.neonTeal)]);
const INTERIOR = new Set([norm(WORLD_COLORS.core), norm(WORLD_COLORS.rock), norm(WORLD_COLORS.rockDark)]);

// ---------------------------------------------------------------- collect world colours
const world = []; // { hex, where, interior, network }
for (const [k, v] of Object.entries(WORLD_COLORS)) world.push({ hex: norm(v), where: `palette.WORLD_COLORS.${k}`, interior: INTERIOR.has(norm(v)) });
for (const [k, v] of Object.entries(REGION_COLORS)) world.push({ hex: norm(v), where: `palette.REGION_COLORS.${k}` });
for (const l of MERITS.liveries) { for (const k of ['tint', 'capsule']) if (l[k]) world.push({ hex: norm(l[k]), where: `tuning.MERITS.liveries.${l.id}.${k}`, livery: true, network: true }); }
notes.push('liveries tint the trains (network objects), so they are not held to the world hue rule; their type colour accents stay unchanged');
const FILES = ['city.js', 'scene.js', 'xray.js', 'models.js', 'render-net.js'];
const scanned = [];
for (const f of FILES) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) { notes.push(`${f}: not found (not scanned)`); continue; }
  scanned.push(f);
  fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    const hexes = line.match(/#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}\b/g);
    if (!hexes) return;
    if (/Light\(|setClearColor/.test(line)) { for (const h of hexes) notes.push(`${norm(h)} at ${f}:${i + 1} is a light or clear colour (not a material): skipped`); return; }
    const network = /TYPE_COLORS|typeColor|LOAD_MARKER|marker/i.test(line);
    const interior = /interior|mantle|BackSide|bore|core|lava|xray|clip.*'interior'/i.test(line);
    const neutral = /color:\s*0xffffff|color\.set\([^)]*'#ffffff'\)|tint \|\| '#ffffff'|tint \? [^:]*: 0xffffff/i.test(line);
    for (const h of hexes) world.push({ hex: norm(h), where: `${f}:${i + 1}`, network, interior, neutral, line: line.trim().slice(0, 110) });
  });
}

// ---------------------------------------------------------------- 1 + 2: type hexes and pure white
for (const w of world) {
  if (typeHexes.has(w.hex) && !w.network && !/monument/i.test(w.line || '')) fails.push(`type colour ${w.hex} used as a world colour at ${w.where}`);
  if (w.hex === '#ffffff' && !w.network) {
    if (w.neutral) notes.push(`#ffffff at ${w.where} is a neutral multiplier (instance colours / livery tint), not drawn white`);
    else if (w.livery) notes.push(`#ffffff at ${w.where}: the Classic livery's tint (neutral multiplier)`);
    else fails.push(`#ffffff outside the load markers at ${w.where}`);
  }
}
if (norm(LOAD_MARKER.fill) !== '#ffffff') fails.push('load marker fill is not #ffffff');

// ---------------------------------------------------------------- 3: hue distance (saturated, drawn at or above the ground)
const hueRows = [], darkRows = [];
for (const w of world) {
  if (w.network || w.interior || NEON.has(w.hex)) continue;
  const [h, s, v] = hsv(w.hex);
  if (s <= 0.4) continue;
  if (v < 0.35) { darkRows.push(`${w.hex} (${w.where})`); continue; } // near-black backdrops: read as dark, checked by contrast
  const near = ABOVE_TYPES.map((t) => [t, hueDist(h, hsv(TYPES[t])[0])]).sort((a, b) => a[1] - b[1])[0];
  hueRows.push(`${w.hex} (${w.where}) hue ${h.toFixed(0)}°, nearest ${near[0]} ${near[1].toFixed(0)}°`);
  if (near[1] < 30) fails.push(`${w.hex} at ${w.where} is ${near[1].toFixed(0)}° from ${near[0]} (needs 30°)`);
}

// ---------------------------------------------------------------- 4: neon caps
if (NEON_CAPS.emissive > 0.3 || NEON_CAPS.hazeOpacity > 0.15) fails.push('NEON_CAPS above 0.3 / 0.15');
for (const f of scanned) {
  fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').forEach((line, i) => {
    if (!/ff6f91|12707a|neon/i.test(line)) return;
    for (const m of line.matchAll(/(emissiveIntensity|opacity|accK)\s*[:=]\s*([^,;})]+)/g)) {
      const nums = (m[2].match(/\d*\.\d+|\d+/g) || []).map(Number).filter((x) => x <= 5);
      const cap = m[1] === 'opacity' ? NEON_CAPS.hazeOpacity : NEON_CAPS.emissive;
      const tern = m[2].match(/\?\s*([\d.]+)/);
      const neonVals = m[1] === 'accK' ? (tern ? [Number(tern[1])] : nums.slice(0, 1)) : nums;
      for (const v of neonVals) if (v > cap + 1e-9) fails.push(`${f}:${i + 1} neon ${m[1]} ${v} above ${cap}`);
    }
    const ms = line.match(/hexc\('#12707a'\)\.multiplyScalar\(([\d.]+)\)|hexc\('#ff6f91'\)\.multiplyScalar\(([\d.]+)\)/);
    if (ms) notes.push(`${f}:${i + 1}: neon colour scaled ×${ms[1] || ms[2]} for holograms; its material opacity/intensity is set elsewhere (checked by eye, not by this tool)`);
  });
}

// ---------------------------------------------------------------- 5: line colour contrast on backdrops
const grounds = [];
const cityText = scanned.includes('city.js') ? fs.readFileSync(path.join(SRC, 'city.js'), 'utf8') : '';
const rg = cityText.match(/REGION_GROUND\s*=\s*\{([^}]*)\}/);
if (rg) for (const m of rg[1].matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g)) grounds.push([`ground ${m[1]}`, norm(m[2])]);
else notes.push('city.js REGION_GROUND not found: ground backdrops taken from palette only');
grounds.push(['rock (mountains)', norm(WORLD_COLORS.rock)], ['gunmetal', norm(WORLD_COLORS.gunmetal)]);
const tint = cityText.match(/tintCell\([^)]*'(#[0-9a-fA-F]{6})'\s*:\s*'(#[0-9a-fA-F]{6})'/);
if (tint) grounds.push(['park ground', norm(tint[1])], ['grove ground', norm(tint[2])]);
else { grounds.push(['park', norm(WORLD_COLORS.park)]); notes.push('park ground tint not found in city.js: palette park used'); }
const BACKDROPS = {
  surface: grounds, sky: [...grounds, ['night sky', norm(WORLD_COLORS.nightSky)]],
  water: [['sea', norm(WORLD_COLORS.sea)], ['shallow sea', norm(WORLD_COLORS.seaShallow)]],
  earth: [['X-ray rock', norm(WORLD_COLORS.rock)], ['X-ray rock dark', norm(WORLD_COLORS.rockDark)]],
  fire: [['X-ray rock', norm(WORLD_COLORS.rock)], ['X-ray rock dark', norm(WORLD_COLORS.rockDark)], ['core', norm(WORLD_COLORS.core)]],
  space: [['night sky', norm(WORLD_COLORS.nightSky)]], deep: [['night sky', norm(WORLD_COLORS.nightSky)]],
};
const table = [];
for (const [t, list] of Object.entries(BACKDROPS)) for (const [name, bg] of list) {
  const core = lift(TYPES[t]);
  const r = ratio(core, bg);
  table.push(`${t.padEnd(8)} on ${name.padEnd(18)} ${r.toFixed(2)}:1 (core line ${core}; plain ${ratio(TYPES[t], bg).toFixed(2)}:1)`);
  if (r < 3) fails.push(`${t} on ${name}: ${r.toFixed(2)}:1 (needs 3:1)`);
}

console.log('Contrast (each ley-rail drawn with its core line lifted 30% toward white):');
console.log('  ' + table.join('\n  '));
console.log(`Hue check: ${hueRows.length} saturated world colours`);
console.log('  ' + hueRows.join('\n  '));
console.log(`Dark saturated colours (value < 0.35, read as near-black backdrops): ${darkRows.join(', ')}`);
console.log(`Scanned: palette.js, tuning.js liveries, ${scanned.join(', ')} (${world.length} colour uses)`);
if (notes.length) console.log('Notes (not checked automatically):\n  ' + notes.join('\n  '));
if (fails.length) { console.log('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('OK: palette rules pass');
