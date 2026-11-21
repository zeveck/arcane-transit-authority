# Arcane Transit Authority: simulation API (for the browser build)

> **Changes (additions only; nothing existing renamed or removed):**
> - `lines()` rows add `income` ($/min attributed to the line: each delivered fare split over its legs, smoothed), `waiting` (riders/exports whose fastest path boards this line, waiting now) and `turnedAway` (riders lost on board this line to disasters, total).
> - New event `deliveries { list: [{ station (destination station id), riders, fare }] }` each tick that trips arrive — put money pop-ups at those stations. (Not saved in snapshots: cosmetic only.)
> - Disaster warnings add `targetRef`: `{ kind: 'line', id }`, `{ kind: 'station', id, cell }` (Core Flare: a Core Exchange; Blackout: the centre station), `{ kind: 'ring', id: 'equator' }` or `{ kind: 'terminal', id, cell }`. Also on the `disasterWarning` event and in `disasters().warning`. `target` is unchanged.
> - **Engine independence:** the grid's cell positions and neighbours are frozen in `tuning.js` (`OIKUMENE_GRID`, positions rounded to 1e-12), so `getGrid()` does no trig at run time; every trig-derived value that feeds a decision (`geo.angleRad/angleDeg/gcDist`, `ringTrackDeg`, max earth angle, line lengths) is quantised (1e-12 rad, 1e-9 ° / units, 1e-6 for line lengths). New exports: `planet.gridFromFrozen`, `planet.roundPos`, `geo.q6/q9/q12`, `tuning.OIKUMENE_GRID`. `design/solutions/start-hashes.json` (from `node tools/starthashes.mjs`) lists `hash()` at the start and after 300 s for all 36 Charter × region terms (seed 11) and the six solution starts: the browser must match it. The frozen table changed with this (bay Atlantis cells are now 161 and 283), so re-read `cellMeta()` rather than caching cell ids.
> - `hash()` uses a faster numeric hash (values differ from earlier builds; the recorded solutions are re-recorded with it). Same rules: action log excluded; backlogs hashed in key order.
> - Balance numbers changed in `tuning.js` (see BUILD_NOTES.md, "Sim tuning"): Charter export ladder, start money IV–VI, fares and freight × Charter price.
> - **Place names (final-review fixes, 2026-11-21)** — new pure module `names.js`: `cellName(id)` ("Brasswick Heights", "Mount Vell", "Atlantis Coral Gate", "Glass Shoals", "Warp Terminal"; region starts keep The Capital, Saltmarch Island, Hollowgate, Cinder Gate, The Flats, Ring Market), `cellShort(id)`, `stationName(game, st|id)` ("Aurumgate Gardens Station", "Mount Vell Sky Port", "Coral Gate Sea Station", "Cinder Gate Core Exchange", "Warp Terminal"), `lineName(game, line|id)` ("Aurumgate–Vaulthold Maglev" surface, "… Skyway" sky, "… Tideway" water, "… Deep" earth, "… Core Run" fire, "… Ring Line" space, "Aurumgate Shaft" for a shaft), `allCellNames()`, `LINE_SUFFIX`, `STATION_SUFFIX`. Same-named stations/lines get " 2", " 3" in id order. Game wrappers: `game.cellName(id)`, `game.stationName(st|id)`, `game.lineName(line|id)`. Rows add `name`: `stations()`, `lines()`, `cells()`, and `places()` (stations, peaks, atlantis, priority). Names are derived, never stored: no hash changes.
> - Player-facing sim strings use names: bottleneck texts ("Limit: Aurumgate–Terminal Core Run is full (100% load, 240/min each way)", "Limit: Aurumgate Gardens Core Exchange's interchange is full (120 of 120 transfers/min)", "Limit: X Station has no open route…", "Limit: X Station is not linked…"), card reasons ("too close to the Aurumgate–Vaulthold Deep", "the Terminal Shaft"), the "same place" reasons now read "<Kind>: both ends are within 1 cell of <station or cell name>". Disasters: `disasterWarning` and `disasterHit` events and `disasters().warning` add `targetName` ("Aurumgate–Vaulthold Deep", "Cinder Gate Core Exchange", "the orbital ring", "the Warp Terminal"); `disasterWarning` adds `text` ("Cave-in: <name> hit in 15 s"); `repaired` adds `lineName`; `disasters().broken[]` adds `lineName`.
> - New bottleneck kind `'travelling'` ("Limit: exports are still travelling to the Terminal"), used only when exports are on board and no line/interchange is ≥ 95% full; otherwise the old empty fallback now names the fullest line (`kind 'line'`) or interchange (`kind 'interchange'`) at ≥ 95%, or falls back to `'districts'`.
> - Route cards add `exportsPotential` (exports/min the card would link, before capacity) and `exportsNote` (string or null; set on feasible cards when `exportsGain` is < 5 or < 25% of the potential): `"not linked to the Terminal"`, `"already served by <station name>"`, `"no new districts to serve here"`, `"limited by the Terminal's shaft (shared with the <line name>)"`, `"limited by the <line name> (already busy)"`, `"limited by <station name>'s interchange (N/min free)"`, `"limited by the new line's capacity (N/min)"`. `exportsGain` (number) is on every card (0 on infeasible ones).
> - `state()` adds `firstCrossingUsed` (the free First Crossing has been built; the tutorial can skip its step), `firstCrossingAvailable` (the mandate is on and unused) and `freePlay`.
> - **Round 2 (2026-11-21):** card `exportsGain` now also checks the existing network from the card's ends to the Terminal (fastest path and alternatives, against the capacity existing exports already use; exports are assigned before commuters): a full interchange or line there caps it and sets `exportsNote` ("limited by <station>'s interchange (N/min free)", "limited by the <line> …"). New sim stats (not state): `game.stats.lineFlowX[lineId*2+dir]`, `game.stats.xferFlowX[stationId]` (exports/min, smoothed). Buying Heat Shielding / Tunnel Bracing / Warp Anchor during a Core Flare / Cave-in / Warp Drift warning cancels it (new event `disasterCancelled { disaster, by }`; `disasters().warning` becomes null). Water from a district next to Atlantis puts its pier on the coast beside it (no longer "within 1 cell of" the dome); land-only cards to Atlantis say "<Kind>: Atlantis is under the sea; only Water reaches it, from a station on the coast next to it"; Water reasons with an Atlantis end add the same hint. Tags (Cheapest / Most capacity) only when at least two cards carry something. The `departure` event adds `firstExports` (true on the first departure that launches exports).
> - **Round 2 card rebalance (numbers in `tuning.js`, recorded solutions and `start-hashes.json` re-recorded):** a Surface station no longer demolishes its own cell (its price is $150 × Charter price, no demolition; its district keeps exporting); `TYPES.surface.track` 8 → 14; new `EARTH_LONG_CHORD { from: 60, per: 60 }` (earth chord track ×(1 + max(0, length − 60)/60)); fire: track 30 → 16, Core Exchange 900 → 450 (Rift 450 → 225), train 800 → 450, upkeep 14 → 12; new `SHAFT_TRAINS = 1` (a through-the-core card's new shafts start with 1 train; the fire chord with 2); `SIM.farePerUnit` 0.04 → 0.035, `SIM.freightFee` 1.5 → 1.1. New export `routes.earthChordMult(units)`.
> - **Round 3 (texts, running cost, miles):** card `reason`s are plain sentences without the "<Kind>:" prefix (the card shows its kind): e.g. "No peak next to A", "Needs the Sea Stations tech", "Too far apart to dig (165°; the crust allows 83°)", "Too close together to go through the core (under 60°)", "Both ends are within 1 cell of <name>", "Too far apart for a sky arc (3,600 miles; range 3,000 miles; Long Arcs reach 4,500 miles)". Card `runningCost` is now exactly what the build adds to the term's upkeep (trains + new stations + added layers, incl. the Full House discount), with `runningBreakdown { trains, stations }`; `lines()` rows add `stationUpkeep` (each end station's upkeep shared over the lines at it) and `runningCost` (= `upkeep` + `stationUpkeep`), so a new line's panel and its card show the same $/min (`upkeep` is still trains only). Lengths for players in miles (1 unit = 50 miles): `lines()[].lengthMiles`, card `trackMiles` and `legs[].lengthMiles`; `milestones()` track goals report `value`/`target` in miles with `unit: 'miles'` (progress unchanged). New `routes.miles(units)` → "2,950 miles". Tech and milestone texts in `tuning.js` reworded (Deep Bore, Long Arcs, Sea Stations, Space Elevators, Sky High). `game.stationUpkeep(st)`.
> - **Galactic** retuned (`CHARTERS.G` export ×3.3, start $22,000; quotas unchanged, Quota III = 69% of the reachable ceiling) and now has a recorded solution, `design/solutions/charter-G.json` (Ringside, seed 717). `start-hashes.json` gains one entry (G ringside 717); the 42 existing entries are unchanged. `tools/replay.mjs` and `solve.mjs --verify` include G.
> - **Undo** reverts only its own action (new lines/stations/trains, added layers, the interchange upgrade, demolished or greened cells) and refunds it; `state().undo` is cleared when another action (removeTrain, closeLine/openLine, repair/repairAll, brace/reroute on its target) or a disaster hit touches what it would restore, and whenever a milestone or quota bonus is paid. `undo` returns `{ ok, refund, kind }`.

Everything in `game/src/` listed here is **pure**: no DOM, no three.js, Node-importable, deterministic. The browser
builds rendering, input and UI on top of it. Run the tests with `node --test tools/test/*.test.mjs`.

## Units and coordinates

- **World units:** 1 unit = 50 miles. Planet radius 100, centred at the origin. **y is north**; longitude 0 faces **+z**; east is **+x**:
  `x = cos(lat)·sin(lon)`, `y = sin(lat)`, `z = cos(lat)·cos(lon)` (`geo.latLonToVec`). These are three.js world coordinates as-is.
- Radii (from `PLANET` in `tuning.js`): city ground 100, mountain ground `100 + height` (3..12), sea surface 100, sea floor 94,
  water rail 94.8, pier deck 100.5, Atlantis dome centre on the floor (radius 5), surface rail ground + 1, walkways ground + 1.5,
  earth portals 100, Core Exchanges 37, core 35, orbital ring 130.
- **Time:** game seconds. `game.s.update` = fixed updates (30 per game second); `game.s.time` = whole seconds (sim ticks);
  `game.gameTime` = `update / 30` (fractional, for drawing trains between ticks).
- **Money** in $; **rates** per minute (riders/min, exports/min, $/min).

## The loop

```js
import { Game } from './src/sim.js';
const game = Game.newTerm({ tutorial: true });          // or { termSeed, charter: 'I'..'VI'|'G', region, perks, unlockedMilestones }
// each frame (render time):
acc += realDelta * speed * 30;                          // speed 1 / 2 / 4; paused → 0
let n = Math.min(8, Math.floor(acc)); acc -= n;         // cap 8 updates per frame
if (n === 8) acc = 0;                                   // a slow device runs slower, never steps differently
while (n--) game.update();
for (const e of game.drainEvents()) handle(e);          // UI events (below)
```

Determinism depends only on the update count and the actions. Never call `Math.random` in anything that feeds the sim.

## Creating, saving, loading

| Call | Returns |
|---|---|
| `Game.newTerm(opts)` | a Game. `opts`: `termSeed` (int), `charter` (`'I'`..`'VI'`, `'G'` = Galactic), `region` (`'capital'`, `'brine'`, `'rift'`, `'spires'`, `'flats'`, `'ringside'`), `tutorial` (forces Charter I, the Capital, term seed `SOLVER.tutorialTermSeed`, no priority districts, no inherited network, no nudges), `freePlay` (no deadline, no disasters, no Merits), `perks` (ids from `MERITS.perks`), `unlockedMilestones` (card ids bought in the Merit Office). Test-only: `noDisasters`, `noInherited`, `genScale`. |
| `game.snapshot()` | the full sim state as a plain JSON-able object (term seed, Charter, region, geo hash, cells changed, network incl. walkways (derived from stations), money, update count, backlogs, in-flight flows, yard, timers, disaster timeline and active effects, PRNG states, milestones, tech, action log). Train positions are derived from time. |
| `Game.restore(snapOrJson)` | a Game that gives the same `hash()` after the same steps. |
| `game.hash()` | 8-hex hash of the snapshot (action log excluded). |
| `game.clone()` | deep copy (solver lookahead). |
| `snapshot.js`: `SAVE_KEY` (`'arcane-transit-authority'`), `makeSave(meta, game)` → JSON string `{ version, meta, run }`, `readSave(json)` → `{ meta, game }` | localStorage helpers. `meta` (Merits, unlocks, Commended Charters, best grades, regions, settings, tutorial done) is the browser's own object. |

## The action API (browser and solver use the same one)

`game.act(action)` → `{ ok: true, cost?, ... }` or `{ ok: false, reason }`. Successful actions are logged in `game.s.log` as `[update, action]`.

| `type` | fields | notes |
|---|---|---|
| `buildRoute` | `a`, `b`, `kind` | `a`/`b` are a **place**: a cell id (number), `{ cell }` or `{ station }`. `kind` ∈ `surface sky water earth core space hybrid`. Builds everything on the card (stations, interchange upgrades, Core Exchanges, shafts, demolition, lines, 2 trains each). Returns `{ lines, stations, cost, carries, free }`. |
| `addTrain` / `removeTrain` | `line` | removing refunds 75%; a line with 0 trains is closed |
| `upgradeInterchange` | `station` | paid transfer upgrade ×2 ($600 × Charter price) |
| `placeStation` | `cell`, `layer` | manual Station tool (`surface sky water earth space`); adds a layer to a station on the cell if one can take it ($250 + layer price) |
| `buyTech` | `id` | ids in `TECH` (`tuning.js`), bought left to right per branch |
| `demolish` | `cell` or `cells: []` | city cells without a station; Heritage Capital blocks the Capital |
| `green` | `cell`, `kind` (`grove`/`park`/`attraction`), `look` (`wheel`/`fountain`/`monument`) | cleared cells only; attractions next to a line |
| `closeLine` / `openLine` | `line` | |
| `brace` / `reroute` | — | answer the current disaster warning |
| `repair` | `line` | starts the repair (price and seconds on `line.broken`) |
| `repairAll`, `coolant` (ends a Core Flare), `restorePower` (ends a Blackout) | — | |
| `undo` | — | within 10 s of the last build: full refund, demolished cells rise back, lines and stations removed (not after a disaster hit what was built) |

## Queries (map 1:1 onto the debug hook `window.__game`)

| Call | Returns |
|---|---|
| `game.state()` | `{ charter, mandates, region, termSeed, tutorial, money, moneyPerMin, throughput, quotaStage (0..3), quotas, nextQuota, time, update, deadline (s), stations, lines (counts), priority (cells), termOver ({reason:'bankrupt'|'overtime', at} or null), won, overtime, commendedAt, quotaMetAt [], yard, nextDeparture, natives, undo, disaster, geoHash }` — add `screen`, `selection`, `pins` in the browser |
| `game.routeCards(a, b)` | ordered cards (feasible first in the fixed order Surface, Sky, Water, Earth, Through the core, Space, Hybrid; then locked/impossible). Card: `{ kind, name, type, feasible, locked, lockTech, reason, cost, free, carries, exportsGain, demolishes, demolishCells, tripTime (s), runningCost ($/min), breakdown {track, stations, demolition, blocks, trains}, legs [{type, shaft, line, length, time, capacity, isNew}], transfers [{station, kind, capacity}], bestAt, tags ['Cheapest','Most capacity'], preview [{type, shaft, samples: Float32Array}], line (the one short line: "demolishes 9 blocks" / "FREE…" / reason), via }`. ~5–15 ms. Previews use the **same sample code** the built line will use. |
| `game.stations()` | `[{ id, cell, kind ('terminal'|'ground'|'sky'|'pier'|'dome'|'core'), layers [], upgraded, parent (Core Exchange → its Bore station), inherited, pos [x,y,z], capacity (transfer/min, Infinity at the Terminal), linkedToTerminal, closed, waiting, transferFlow, turnedAway, lines [] }]`. Model stack for interchanges: base = `layers[0]`, then each added layer's module above it. |
| `game.lines()` | `[{ id, type, shaft, a, b, trains, cars, length, time (one way, s), capacity (each way/min), flow, flowEach [a→b, b→a], load (0..1, for the flow overlay), open, closed, broken ({by, cost, seconds, repairAt}|null), inherited, ring, cells, upkeep, linkedToTerminal }]` |
| `game.lineSamples(id)` | **path samples** (below) |
| `game.trains(lineId)` | `[{ train, s (distance along the samples), dir (+1 a→b, −1 b→a, 0 dwelling), pos [x,y,z] }]` at `gameTime`; trains on closed/broken lines stop |
| `game.walkways()` | `[{ a, b, geo }]` (geo = path samples, kind `walk`) |
| `game.stationWells()` | `[{ station, from [x,y,z] (station on the mountain), to (portal at radius 100) }]`: draw in X-ray only |
| `game.cells(filter)` | `[{ id, area, terrain ('city'|'mountain'|'ocean'|'atlantis'|'terminal'), peak, height, ground, lat, lon, density (now), baseDensity (term), demolished, green, served, priority, coastal, stations [], demolitionPrice }]`; `filter` = function or `{ key: value }` |
| `game.regions()` | per-area counts as `tools/oikumene.mjs` prints them |
| `game.geoHash()` | geography hash (same for every term) |
| `game.places()` | Places list: `{ terminal, stations, peaks, atlantis, priority, starts }` |
| `game.breakdown()` | `{ made, reaching, launched, ceiling, bottleneck: { kind ('warp'|'line'|'interchange'|'noPath'|'unlinked'|'districts'), text, target ({line}|{station}|null) } }` |
| `game.techTree()` | 7 branches × 4 nodes with `owned, price, block` |
| `game.milestones()` | dealt cards `{ id, name, text, bonus, value, target, progress, done, doneAt }` |
| `game.disasters()` | `{ warning {type, name, target, hitAt, secondsLeft, bracePrice, canReroute, braced, rerouted} | null, broken [...], repairAllPrice, flare, ringSlow, blackoutUntil, driftDelays, nextAt, history }` |
| `game.grade()` | `{ stars {deadline, efficiency, greenery}, nStars, quotas, milestones, merits, commended, unlocks {charter, region} }` |
| `game.perfStats()` | `{ worstTick, avgTick, worstRecompute, avgUpdate, recomputes }` (ms) |
| `Game.charterInfo(id)` | Charter row + mandate texts + disaster pacing (Charter documents) |

`game.s` is the raw state (read-only for the browser). Useful fields: `s.stations[]`, `s.lines[]` (ids are array indices; removed = `null`), `s.demolished[642]`, `s.green[642]` (0 none, 1 grove, 2 park, 3 attraction), `s.attractions [{cell, look}]`, `s.densities[642]`, `s.tech {id:true}`, `s.priority`, `s.dis.warning`, `s.launches [[t, n]]`, `s.quota {stage, metAt}`.

## Events (`game.drainEvents()`)

`{ t, type, ... }`: `built {kind, lines, stations, cost, firstCrossing}` (play the first-crossing cinematic when `kind === 'core'` and it is the first core route), `action {action, cost}`, `departure {launched, throughput}` (deep space train launch), `quota {quota (1..3), throughput, hash}` (push to `window.__runLog` with time and money), `milestone {id, name, bonus}`, `disasterWarning {disaster, name, target, hitAt, bracePrice}` (drop speed to 1x, banner), `disasterHit`, `disasterSkipped`, `repaired {line}`, `debtWarning`, `overtime`, `termOver {reason}`.

## Path samples (what the renderer draws)

`game.lineSamples(id)` → `{ samples: Float32Array [x0,y0,z0, x1,y1,z1, ...], count, cum: Float32Array (distance from the start at each sample), length, segs: [{ i0, i1, len, kind }] }`.
- Samples are ~1 unit apart, in world units, **the ley-rail centre** (where the train's centre runs). Build ribbons, pylons (sky, every ~8 units of `cum`), sleepers (surface), bores (earth, radius 0.5) and pick points from these exact samples.
- `kind`: `main`, `shaft` (earth shaft, portal → Core Exchange), `elevator` (space line's two leaning elevator segments), `walk` (walkways).
- Per type: **surface** Chaikin-rounded cell polyline at ground + 1 (lateral slot offsets 1.2 apart for shared corridors); **sky** slerp arc `100 + lerp(hA,hB,t) + 2 + h·sin(πt)`; **water** sea-floor A* at 94.8, ≥ 6 units from every dome centre, pier ends ramp from 100.5, Atlantis ends end with a straight spur to the dome edge; **earth** straight chord between portals (radius 100, portal slots 1.5 apart); **shaft** radial 100 → 37 (63 units); **fire** chord between Core Exchanges at 37 (may cross; draw additive, no depth write); **space** elevator up, ring arc at 130, elevator down.
- `network.sampleAt(geo, s)` → point at distance `s`. Ride camera: follow `trains(line)[0].s` and look 4 samples ahead.
- Station model positions: `stations()[i].pos` (Core Exchanges at radius 37, domes at 94, piers at 100.5, others on the ground).

## Geometry of the planet (`planet.js`)

- `getGrid()` → `{ count: 642, pos [unit vec], lat [], lon [], neighbours [[ids]], corners [[unit vecs], angularly sorted], pentagon [] }`. Cell polygons = `corners` × radius. Cell ids are sorted north→south.
- `getCells()` → static rows `{ id, area, areaId, terrain, terrainName, density (base), height, peak, ground, pos, lat, lon, neighbours, coastal, land, isCity }` from the frozen table `OIKUMENE_CELLS` (written by `node tools/oikumene.mjs --write`).
- `cellMeta()` → `{ capitalCentre, terminal, starts {region: cell}, tutorial {a, b, path, peaks, atlantis}, capitalHeights }`.
- `nearestCell(lat, lon)`, `hexDistances(cell, max)`, `cellsWithin(cell, rings)`, `ringTrackPoint(p, ring)`, `regionCounts()`, `geoHash()`, `termSetup(seed, charter, region)`.

## Data tables (`tuning.js`, `palette.js`)

- `tuning.js`: `PLANET`, `TYPES`, `TRANSFER`, `SIM`, `GREEN`, `DEMOLITION`, `REGIONS`, `AREA_IDS`, `CHARTERS`, `CHARTER_IDS`, `MANDATES`, `UNLOCKS`, `PRIORITY_COUNT`, `DISASTERS`, `DISASTER_PACING`, `TECH` (28), `TECH_PRICES`, `MILESTONES` (30: `pool: 'base'|'unlock'`, `price` in Merits), `MERITS` (`perks`, `liveries` with tint and capsule palette), `SOLVER`, `OIKUMENE`, `OIKUMENE_CELLS`, `OIKUMENE_META`.
- `palette.js`: `TYPE_COLORS` (`surface sky water earth fire space deep`), `TYPE_ORDER`, `TYPE_NAMES`, `WORLD_COLORS`, `NEON_CAPS`, `LOAD_MARKER`, `REGION_COLORS`, `hexToRgb`.
- `rng.js`: `Rng` (mulberry32), `termStream(seed, name)`, `hashString`, `hashValue`. Use `termStream(seed, 'cosmetic')` (or your own Rng) for anything cosmetic; never feed it to the sim. Dispatches: `termStream(seed, 'dispatches')`.

## Tutorial facts the story code needs

`cellMeta().tutorial`: `a` (the density-2 edge district, Capital ring 3, SW), `b` (density-2 district 4 cells beyond), `peaks` (the two Capital Heights peaks; `peaks[0]` is next to the Capital centre, so its Sky Port walkway-links to a station there), `atlantis` (2 bay Atlantis cells). The free crossing is `routeCards({station: <station at a>}, cellMeta().terminal)` → card `core` with `free: true`. The solver's tutorial prefix (in `tools/solve.mjs`) is the reference script.
