// names.js — place names for the Oikumene (pure, deterministic, no Math.random). Every cell gets a stable name
// from its region's name lists; stations are named from their cell and kind, lines from their ends and type.
// Names are derived only from the frozen cell table and the network, never stored in the state, so they never
// feed hash().
import { getCells, cellMeta, TERRAIN } from './planet.js';
import { Rng, hashString } from './rng.js';

// ------------------------------------------------------------------ the lists (the world's voice)
// Each region: specials [full, short] (the densest cells get them first), then roots built from prefix+suffix
// syllables with a feature word ("Brasswick Heights"; short "Brasswick").
const REGION_NAMES = {
  capital: {
    start: ['The Capital', 'Capital'],
    specials: [['Brasswick Heights', 'Brasswick'], ['Old Mint', 'Old Mint'], ['Chancery Row', 'Chancery'], ['Gilt Arcade', 'Gilt Arcade'], ['Sigil Cross', 'Sigil Cross'], ['Clockmarket', 'Clockmarket'], ['Lanternside', 'Lanternside'], ['Vellum Yard', 'Vellum']],
    pre: ['Brass', 'Gilt', 'Copper', 'Crown', 'Argent', 'Aurum', 'Quill', 'Orrery', 'Chancel', 'Coin', 'Seal', 'Ledger', 'Lamp', 'Silver'],
    suf: ['wick', 'haven', 'mere', 'gate', 'ford', 'cote', 'stead', 'worth', 'bury', 'hall'],
    feat: ['Heights', 'Row', 'Cross', 'Close', 'Arcade', 'Terrace', 'Quarter', 'Gardens', 'Yard', 'Court'],
  },
  brine: {
    start: ['Saltmarch Island', 'Saltmarch'],
    specials: [['Kelp Row', 'Kelp Row'], ['Netmender\'s Wharf', 'Netmender'], ['Lamplit Strand', 'Lamplit'], ['Gullhaven Quay', 'Gullhaven']],
    pre: ['Salt', 'Kelp', 'Brine', 'Gull', 'Tide', 'Wrack', 'Pearl', 'Drift', 'Spray', 'Shell', 'Foam', 'Reef'],
    suf: ['wick', 'combe', 'mouth', 'haven', 'port', 'holm', 'by', 'sey', 'ness', 'wold'],
    feat: ['Quay', 'Wharf', 'Steps', 'Landing', 'Harbour', 'Point', 'Strand', 'Row'],
    sea: {
      pre: ['Glass', 'Leviathan', 'Siren', 'Moonwater', 'Drowned', 'Inkwell', 'Mirror', 'Storm', 'Lantern', 'Sable', 'Wraith', 'Hollow', 'Gloam', 'Whale', 'Serpent', 'Silver', 'Kraken', 'Bell'],
      feat: ['Sound', 'Shoals', 'Reach', 'Trench', 'Banks', 'Shallows', 'Narrows', 'Gulf', 'Basin', 'Waters'],
    },
  },
  spires: {
    start: ['Hollowgate', 'Hollowgate'],
    specials: [['Eyrie Hold', 'Eyrie'], ['Stormwatch', 'Stormwatch'], ['Skyhook Ledge', 'Skyhook']],
    pre: ['Wyrm', 'Vane', 'Storm', 'High', 'Frost', 'Raven', 'Thorn', 'Gale', 'Cloud', 'Shard', 'Aerie', 'Crow', 'Hawk', 'Rime'],
    suf: ['crag', 'cairn', 'wick', 'mere', 'fell', 'scar', 'holt', 'peak', 'reach', 'stone'],
    feat: ['Ridge', 'Scarp', 'Ledge', 'Terrace', 'Hold', 'Pass', 'Slopes', 'Watch', 'Steps', 'Crest'],
  },
  rift: {
    start: ['Cinder Gate', 'Cinder Gate'],
    specials: [['Brimstone Works', 'Brimstone'], ['Obsidian Fault', 'Obsidian'], ['Kiln Row', 'Kiln Row']],
    pre: ['Ember', 'Slag', 'Ash', 'Scoria', 'Magma', 'Furnace', 'Clinker', 'Pyre', 'Soot', 'Forge', 'Char', 'Smelt', 'Basalt'],
    suf: ['fall', 'pit', 'mouth', 'well', 'vent', 'rock', 'ford', 'heap', 'moor', 'side'],
    feat: ['Fault', 'Vents', 'Works', 'Rise', 'Crossing', 'Ward', 'Pits', 'Rim', 'Gate', 'Flues'],
  },
  flats: {
    start: ['The Flats', 'Flats'],
    specials: [['Granary Cross', 'Granary'], ['Windle Commons', 'Windle'], ['Old Threshing', 'Old Threshing']],
    pre: ['Dust', 'Plain', 'Hay', 'Mill', 'Furrow', 'Loam', 'Sheaf', 'Barrow', 'Fallow', 'Reed', 'Chaff', 'Corn', 'Wheel', 'Stook', 'Haze'],
    suf: ['mere', 'wick', 'ward', 'brook', 'field', 'ley', 'ton', 'hurst', 'stow', 'thorpe'],
    feat: ['Fields', 'Commons', 'End', 'Green', 'Junction', 'Grange', 'Acres', 'Mills', 'Downs', 'Yards'],
  },
  ringside: {
    start: ['Ring Market', 'Ring Market'],
    specials: [['Tether Bazaar', 'Tether'], ['Haloway Docks', 'Haloway'], ['Gantry Square', 'Gantry']],
    pre: ['Halo', 'Arc', 'Orbit', 'Spindle', 'Lift', 'Zenith', 'Spoke', 'Pylon', 'Cable', 'Ring', 'Vault', 'Comet'],
    suf: ['way', 'well', 'gate', 'side', 'reach', 'cross', 'fall', 'mark', 'hold', 'ton'],
    feat: ['Market', 'Bazaar', 'Yards', 'Row', 'Docks', 'Plaza', 'Square', 'Hub', 'Concourse', 'Arcade'],
  },
  farwards: {
    start: null,
    specials: [['Lastlight', 'Lastlight'], ['Wanderhome', 'Wanderhome'], ['Starfall Rest', 'Starfall']],
    pre: ['Far', 'Dusk', 'Out', 'Gloam', 'Hinter', 'Edge', 'Night', 'Way', 'Marrow', 'Beacon', 'Moth', 'Wren', 'Ember', 'Lone', 'Still', 'Shade'],
    suf: ['holt', 'mere', 'wick', 'worth', 'fold', 'moor', 'vale', 'hope', 'stead', 'by'],
    feat: ['Reach', 'Hollow', 'End', 'Rest', 'Watch', 'Moor', 'Fold', 'Vale', 'Mark', 'Crossing'],
  },
};
const ATLANTIS = ['Coral Gate', 'Pearl Vault', 'Lumen Dome', 'Tidewell', 'Nacre Court', 'Abyssal Spire', 'Kelp Cathedral', 'Glasshold',
  'Mirror Pool', 'Siren Hall', 'Deepwell', 'Sunken Archive', 'Brine Throne', 'Shellmarch', 'Moonvault', 'Orrery Dome'];
const PEAKS = ['Vell', 'Ashkar', 'Orrin', 'Sable', 'Corvus', 'Harrow', 'Kestrel', 'Oberon', 'Ymir', 'Thane', 'Morrow', 'Brannoch', 'Zephyr',
  'Halcyon', 'Ironcrown', 'Gloam', 'Eldritch', 'Nimbus', 'Talon', 'Vesper', 'Aurel', 'Cairnwell', 'Pallas', 'Draven', 'Lumen', 'Rook', 'Seraph', 'Wyvern', 'Quillon', 'Tessar'];
const REGION_ORDER = ['capital', 'brine', 'spires', 'rift', 'flats', 'ringside', 'farwards'];

/** Line name suffix per type ("Brasswick–Saltmarch Deep"). */
export const LINE_SUFFIX = { surface: 'Maglev', sky: 'Skyway', water: 'Tideway', earth: 'Deep', fire: 'Core Run', space: 'Ring Line' };
/** Station name suffix per kind. */
export const STATION_SUFFIX = { ground: 'Station', sky: 'Sky Port', pier: 'Sea Station', dome: 'Sea Station', core: 'Core Exchange' };

// ------------------------------------------------------------------ the table (built once from the frozen cells)
let TABLE = null;
function shuffled(list, key) { return new Rng(hashString('names:' + key)).shuffle(list.slice()); }
function build() {
  const cells = getCells(), meta = cellMeta();
  const full = new Array(cells.length).fill(null), short = new Array(cells.length).fill(null);
  const used = new Set();
  const take = (id, f, s) => { full[id] = f; short[id] = s; used.add(f); used.add(s); };
  const startOf = {}; for (const [r, c] of Object.entries(meta.starts)) startOf[c] = r;
  const order = (ids) => ids.sort((a, b) => (startOf[b] != null) - (startOf[a] != null) || cells[b].density - cells[a].density || a - b);
  // the Warp Terminal
  take(meta.terminal, 'Warp Terminal', 'Terminal');
  // peaks (region order, then id): "Mount Vell"
  const peaks = []; for (const r of REGION_ORDER) for (const c of cells) if (c.peak && c.areaId === r) peaks.push(c.id);
  peaks.forEach((id, i) => { const n = PEAKS[i] || (PEAKS[i % PEAKS.length] + ' ' + (Math.floor(i / PEAKS.length) + 1)); take(id, 'Mount ' + n, n); });
  // Atlantis domes: "Atlantis Coral Gate" (short "Coral Gate")
  const domes = order(cells.filter((c) => c.terrain === TERRAIN.ATLANTIS).map((c) => c.id));
  domes.forEach((id, i) => { const n = ATLANTIS[i] || ('Dome ' + (i + 1)); take(id, 'Atlantis ' + n, n); });
  for (const r of REGION_ORDER) {
    const L = REGION_NAMES[r];
    // land (city and mountain slopes)
    const land = order(cells.filter((c) => c.areaId === r && full[c.id] == null && c.terrain !== TERRAIN.OCEAN).map((c) => c.id));
    const roots = [];
    for (const p of shuffled(L.pre, r + ':pre')) for (const s of shuffled(L.suf, r + ':' + p)) roots.push(p + s);
    const rootList = shuffled(roots, r + ':roots');
    const rng = new Rng(hashString('names:' + r + ':feat'));
    let k = 0, sp = 0;
    for (const id of land) {
      if (L.start && startOf[id] === r) { take(id, L.start[0], L.start[1]); continue; }
      while (sp < L.specials.length && used.has(L.specials[sp][0])) sp++;
      if (sp < L.specials.length) { take(id, L.specials[sp][0], L.specials[sp][1]); sp++; continue; }
      let root; do root = rootList[k++]; while (root && used.has(root));
      if (!root) { take(id, `${L.start ? L.start[1] : 'Ward'} District ${id}`, `${L.start ? L.start[1] : 'Ward'} ${id}`); continue; }
      const f = L.feat[rng.int(L.feat.length)];
      take(id, root + ' ' + f, root);
    }
    // sea cells: "Glass Shoals"
    const sea = cells.filter((c) => c.areaId === r && full[c.id] == null && c.terrain === TERRAIN.OCEAN).map((c) => c.id);
    if (sea.length) {
      const S = L.sea || REGION_NAMES.brine.sea;
      const combos = []; for (const p of S.pre) for (const f of S.feat) combos.push(p + ' ' + f);
      const list = shuffled(combos, r + ':sea').filter((n) => !used.has(n));
      sea.forEach((id, i) => { const n = list[i] || ('Open Sea ' + (i + 1)); take(id, n, n); });
    }
  }
  TABLE = { full, short };
  return TABLE;
}
const table = () => TABLE || build();

// ------------------------------------------------------------------ the API
/** The cell's place name ("Brasswick Heights", "Mount Vell", "Atlantis Coral Gate", "Glass Shoals"). */
export function cellName(id) { return table().full[id] ?? `Cell ${id}`; }
/** The short form used in line names ("Brasswick", "Vell", "Coral Gate"). */
export function cellShort(id) { return table().short[id] ?? `Cell ${id}`; }

function stationBase(g, st) {
  if (st.kind === 'terminal') return 'Warp Terminal';
  if (st.kind === 'core') { const p = g.s.stations[st.parent]; return (p && p.kind === 'terminal' ? 'Warp Terminal' : cellShortForStation(p || st)) + ' Core Exchange'; }
  return cellShortForStation(st) + ' ' + (STATION_SUFFIX[st.kind] || 'Station');
}
/** Stations on Atlantis drop the "Atlantis" prefix ("Coral Gate Sea Station"); others use the full cell name. */
function cellShortForStation(st) { const n = cellName(st.cell); return n.startsWith('Atlantis ') ? n.slice(9) : n; }

/** Cache key for a list (stations or lines): its length, live count and last entry (undo truncates and rebuilds). */
function listKey(arr) { let n = 0, last = null; for (const x of arr) if (x) { n++; last = x; } return [arr.length, n, last]; }
const sameKey = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** All station names by id (one pass), cached on the game until the station list changes. */
function stationNames(g) {
  const c = g._names || (g._names = {});
  const k = listKey(g.s.stations);
  if (sameKey(c.sKey, k)) return c.sNames;
  const seen = new Map(), out = [];
  for (const st of g.s.stations) {
    if (!st) { out.push(null); continue; }
    const base = stationBase(g, st), n = (seen.get(base) || 0) + 1; seen.set(base, n);
    out.push(n > 1 ? `${base} ${n}` : base);
  }
  c.sKey = k; c.sNames = out; c.lKey = null;
  return out;
}
/** A station's name ("Brasswick Heights Station", "Mount Vell Sky Port", "Coral Gate Sea Station", "Cinder Gate Core Exchange").
 *  Two live stations with the same name are numbered from the second in id order ("… Station 2"). */
export function stationName(g, st) {
  const id = typeof st === 'number' ? st : st?.id;
  return (id != null && stationNames(g)[id]) || 'a station';
}
/** Short place of a line end (a Core Exchange uses its Bore station's cell). */
function endShort(g, id) {
  const st = g.s.stations[id]; if (!st) return '?';
  if (st.kind === 'terminal') return 'Terminal';
  const base = st.kind === 'core' ? g.s.stations[st.parent] || st : st;
  if (base.kind === 'terminal') return 'Terminal';
  return cellShort(base.cell);
}
function lineBase(g, l) {
  if (l.shaft) { const bore = g.s.stations[l.a]?.kind === 'core' ? l.b : l.a; return `${endShort(g, bore)} Shaft`; }
  const a = endShort(g, l.a), b = endShort(g, l.b);
  return `${a === b ? a : a + '–' + b} ${LINE_SUFFIX[l.type] || 'Line'}`;
}
/** All line names by id (one pass), cached until the line or station list changes. */
function lineNames(g) {
  stationNames(g);
  const c = g._names, k = listKey(g.s.lines);
  if (sameKey(c.lKey, k)) return c.lNames;
  const seen = new Map(), out = [];
  for (const l of g.s.lines) {
    if (!l) { out.push(null); continue; }
    const base = lineBase(g, l), n = (seen.get(base) || 0) + 1; seen.set(base, n);
    out.push(n > 1 ? `${base} ${n}` : base);
  }
  c.lKey = k; c.lNames = out;
  return out;
}
/** A line's name from its ends and type ("Brasswick–Saltmarch Deep", "Vell–Ashkar Skyway", "Cinder Gate Shaft").
 *  Same-named live lines are numbered from the second in id order ("… Deep 2"). */
export function lineName(g, l) {
  const id = typeof l === 'number' ? l : l?.id;
  return (id != null && lineNames(g)[id]) || 'a line';
}
/** All cell names (index = cell id), for the browser's labels. */
export function allCellNames() { return table().full.slice(); }
