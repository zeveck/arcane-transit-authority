# Review log

## Round 1

Reviewers: Player (9 findings), Builder (10), Art and sound director (10). Full findings were kept in the session scratchpad; outcomes below.

| Finding | Severity | Evidence | Outcome |
|---|---|---|---|
| P1 Train type is chosen when placing a station, not when building a line | must-fix | Verified | Fixed: "tap two places → compare route cards" is the core verb; cards auto-build stations, interchanges and shafts; "Through the core" is one card; a Hybrid two-leg card; placing a station by hand stays as a secondary tool |
| P2 The fantasy arrives hours in | must-fix | Verified | Fixed: Tessaly starts with surface, sky, earth, fire and deep space; a ~10 min tutorial ends with a free through-the-core crossing |
| P3 The simulation can't be read | must-fix | Judgment | Fixed: flow overlay; Throughput breakdown names the bottleneck, with Show me; line panels show load, waiting and turned-away numbers; trains on broken lines stop |
| P4 Phone taps, cramped HUD, tilt vs pinch | should-fix | Verified | Fixed: taps snap within 40 px with a ghost and ✓; sheets cover ≤40%; milestones and dispatches become chips; tilt follows zoom |
| P5 Picking far-side stations | should-fix | Judgment | Fixed: X-ray turns on automatically after place A; a Places list |
| P6 No numbers behind the trade-offs | should-fix | Judgment | Fixed: full tuning tables; the Node harness checks that no type carries more than 60% of track and each solution uses ≥3 types |
| P7 A late failure throws away a run | should-fix | Judgment | Fixed: Overtime (+15 min, star lost) and Retry this seed |
| P8 Disaster warnings at fast-forward; fiddly repairs | should-fix | Judgment | Fixed: a warning drops the speed to 1x; Show me; Repair all |
| P9 Long Haul completes on the first line | nice | Verified | Fixed: rescaled to the circumference; other milestones tied to quotas |
| B1 Demand cap kills through-core ridership; assignment undefined | must-fix | Verified | Fixed: all station pairs plus a 15% long-haul share; deterministic assignment with capped waiting crowds; fares paid on delivery |
| B2 Throughput ceiling vs 30 s departures | must-fix | Verified | Fixed: rolling 60 s window; warp capacity per planet; Quota III ≤ 70% of the ceiling; a quota is held when met at 2 departures in a row |
| B3 Tube paths will clip | must-fix | Verified | Fixed: a heights table for every layer; dense samples on the sphere; Chaikin corner cuts; sky arc height rule; coast ramps; lateral slots; chord clearance; cell scale corrected (~15 units) |
| B4 Ring, elevators, crust numbers | must-fix | Verified | Fixed: equatorial ring at radius 130; elevators allowed within 2 cells of it; crust limit as a depth with a max-angle table; shafts exempt; core radius per planet |
| B5 Phone performance | should-fix | Verified | Fixed: polycount limits; instancing; tubes merged per type; setDrawRange growth; flicker in the shader; level of detail; `renderer.info` limits in the done list |
| B6 Recorded solutions infeasible | must-fix | Verified | Fixed: sim modules free of DOM and three.js; `tools/solve.mjs` finds solutions in Node; browser replays as real input; hash checks |
| B7 Determinism | should-fix | Judgment | Fixed: game speed = number of fixed updates; separate PRNG streams; pre-rolled disaster timeline; full snapshot saves |
| B8 Meshy budget, size, moving parts | should-fix | Verified | Fixed: draft trains; texture caps; dry-run and max-credits; code tori for the moving parts; tree and Fountain Plaza in code; model cuts first |
| B9 Picking lines and underground things | should-fix | Judgment | Fixed: a picking order; only visible layers can be picked; interchange tabs; the Places list |
| B10 Numbers a builder would invent | should-fix | Verified | Fixed: per-type, per-planet, demolition, disaster, fare and tech tuning tables |
| A1 No shared material rules | must-fix | Verified | Fixed: a material language (ACES tone mapping, PMREM environment map, `--pbr`, clamps, emissive accents, shared materials) |
| A2 Budget over $20 | must-fix | Verified | Fixed: itemised $17.86 plus a $2.14 reserve; concepts double as mocks |
| A3 Style line vs meshgen input | should-fix | Verified | Fixed: two prompt templates (A for meshgen concepts, B for mocks and key art) |
| A4 Concept list incomplete | should-fix | Verified | Fixed: 15 concepts matched one to one with 15 models |
| A5 Promised things without a spec | must-fix | Verified | Fixed: Atlantis domes, stacked interchanges, ring, cable, portals, shaft, X-ray, smokestacks |
| A6 Planets look alike | should-fix | Judgment | Fixed: a per-planet look table; a lava texture; a brighter Homeworld core; code planet spheres on the galaxy map |
| A7 Equirectangular galaxy can't be made | should-fix | Verified | Fixed: a code starfield plus a 21:9 4K core painting |
| A8 Missing sound effects | should-fix | Verified | Fixed: 36 effects plus an ambience; a rate rule for departure sounds |
| A9 Music crossfade and loops | should-fix | Verified | Fixed: Build and Busy share a key and tempo; a disaster bed plus an all-clear sound; crossfades at every seam |
| A10 Screens and finale lack pictures | nice | Judgment | Fixed: How to Play from screenshots; a finale picture; portraits at 1024 |

Decision: not converged (many must-fix findings were fixed with large changes), so round 2 runs.

## Round 2

Reviewers: Player (8 findings), Builder (10), Art and sound director (10). Full findings were kept in the session scratchpad.

| Finding | Severity | Evidence | Outcome |
|---|---|---|---|
| P1 Core route capped at 120/min = Tessaly Quota I | must-fix | Verified | Fixed: Core Exchanges and elevators transfer 360/min; boarding at the origin and arriving at the destination aren't transfers; Tessaly Quota I = 90 |
| P2 Cards hide the deciding number | must-fix | Judgment | Fixed: cards lead with Cost, "carries N/min" and "+N exports/min"; fixed order; Cheapest and Most capacity tags |
| P3 Phone card sheet leaves ~130 px of globe | must-fix | Verified | Fixed: right-hand column (~38% wide) with the toolbar hidden; path framed in the left 60% |
| P4 Tutorial teaches the wrong lesson; timing inconsistent | should-fix | Verified | Fixed: density-2 start; Earth under dense blocks; crossing at ~5 min everywhere |
| P5 Too much at once | should-fix | Judgment | Fixed: staged toolbar; Station tool under More; one flow number; one attraction rule |
| P6 No way to ride a train | should-fix | Verified | Fixed: Ride chase camera; attract camera on title and pause |
| P7 Disaster warnings give nothing to do | should-fix | Judgment | Fixed: Brace and Reroute; 15 s warning |
| P8 Water and space unseen early | nice | Judgment | Fixed: scenic ring train on Tessaly; Juno points at Atlantis; a visible pause button |
| B1 Piers and Sky Ports form separate networks | must-fix | Verified | Fixed: walkway rule; cards reuse nearby stations; demand only within a connected component; Hybrid card defined |
| B2 Transfer cap = Quota I | must-fix | Verified | Fixed: as P1; card numbers checked against the sim |
| B3 Speed = updates per frame | must-fix | Verified | Fixed: real-time accumulator (30/60/120 updates a second, cap 8 per frame) |
| B4 Replay underspecified | should-fix | Judgment | Fixed: render-time camera; timed actions; selection asserts; expected hashes from the solver |
| B5 Yen's method freezes | should-fix | Verified | Fixed: one Dijkstra per origin plus penalty re-runs; worst-tick and worst-recompute budgets |
| B6 Solver strategy undefined | should-fix | Verified | Fixed: strategy written out |
| B7 Model sizes | should-fix | Verified | Fixed: `shrink_glb.py`; all models ≤ 15 MB |
| B8 Vulkara tunnels into the core | should-fix | Verified | Fixed: chord deepest point ≥ core + 2 (Vulkara 64° / 79°) |
| B9 Too few buildings; X-ray clip | should-fix | Verified | Fixed: street and window hex texture; block meshes; clip-plane shader chunk |
| B10 Small guesses | should-fix | Verified | Fixed: half-open window; scaled disaster gaps; label wording; fire routes need ≥ 60°; Undo rules |
| A1 Type colours = world colours | must-fix | Verified | Fixed: world palette moved off the type colours; contrast table |
| A2 Reserve and image price | must-fix | Verified (measured) | Fixed: pinned flare/medium; retry lines; optional models made last; $3.27 reserve |
| A3 Emissive tints whole model | should-fix | Verified | Fixed: per-model emissive masks |
| A4 Stations look alike | should-fix | Verified | Fixed: Bore collar in code; one sea dome model with the pier in code; front view |
| A5 Portraits | should-fix | Judgment | Fixed: Template C, Juno first |
| A6 Sound gaps and rate rule | should-fix | Verified | Fixed: +3 SFX; warp sounds exempt from the rate rule |
| A7 Music repeats | should-fix | Verified | Fixed: Build 240 s, Busy 180 s |
| A8 4K backdrop heavy | should-fix | Judgment | Fixed: 2K |
| A9 Cast not in mocks | nice | Judgment | Fixed: portraits are Mock pictures |
| A10 Liveries | nice | Verified | Fixed: tint uniform plus capsule palette |

Lead's change after round 2: the surface train came out deep orange like the fire train in its first concept, so its type colour moved from amber to golden yellow `#ffc23d` (concept remade to match).

Decision: converged. No must-fix or should-fix design changes remain. The refiner's open questions are checks for the build: the solver confirms the tutorial's Quota I time; the first playtest checks that Brace and Reroute feel like choices. Round limit (2) reached.

## Between rounds 2 and 3: the person's direction

Requests 6–28 (STATUS.md) reshaped the design: elemental trains (advanced machines, one colour each), a cyberpunk lean, the name Arcane Transit Authority, one planet (Oikumene) with regions, terms and Homeworld Charters instead of six planets, ley-rails instead of glass tubes, the tagline, and a self-contained shared design. The concept pictures were remade along the way (ASSETS.md).

## Round 3 (final check after the reshaping)

Reviewers: Player (7), Builder (7), Art and sound director (8).

| Finding | Severity | Outcome |
|---|---|---|
| P1/B2 Place mocks had tubes and wrong colours | must-fix | Fixed: all 8 remade tube-free in type colours; design updated |
| P2 Charters play alike on one map | should-fix | Fixed: a signature mandate per Charter; 2–3 priority districts per term |
| P3 Region lesson depends on a locked type | should-fix | Fixed: each region's signature type is native when starting there |
| P4 Charter board before the tutorial | should-fix | Fixed: the first New Term goes straight to the tutorial |
| P5 Document refers to old versions | should-fix | Fixed: self-contained wording throughout |
| P6/A4 Load-marker colours | should-fix | Fixed: white markers with a dark outline; size, fill and flashing, never hue |
| P7 Commend vs Commendations; run vs term | nice | Fixed: currency renamed Merits; "term" everywhere |
| B1 Region map can't exist as written | must-fix | Fixed: ordered cell→region rule, a seventh non-start area (the Far Wards), counts total 642, `tools/oikumene.mjs` checks and freezes the map |
| B3 Two earth-depth rules | should-fix | Fixed: portals at radius 100; station wells on mountains |
| B4 Water hidden on Low; rails through domes | must-fix | Fixed: see-through sea on every quality; paths skirt domes; per-car bubbles |
| B5 No picking occlusion | should-fix | Fixed: occlusion test for rail samples |
| B6 Inherited networks vague; little solver coverage | should-fix | Fixed: generator specified; land start cells; quick sweep of all Charter × region pairs |
| B7 Stale text | nice | Fixed (ASSETS history kept as a log) |
| A1 Re-render prompts | must-fix | Fixed: separate train and place prompts |
| A2 Hue masks; shared Surface/Bore model | must-fix | Fixed: neutral trim, code emissive supplies the colour |
| A3 Tube-like shapes in scenes | should-fix | Fixed: globe and X-ray edited |
| A5 Capital gold under yellow rails | should-fix | Fixed: silver Capital; hue-distance rule in contrast.mjs (documented exceptions) |
| A6 Ring-elevator model optional | should-fix | Fixed: now a must model |
| A7 Thin reserve | should-fix | Fixed: $25 floor; models before audio |
| A8 Audio gaps | nice | Fixed: +3 SFX and a sea/core bed |

Decision: converged. Accepted the refiner's judgment calls (Rift lava hue exception, rose/teal intensity cap, Narrow Yard's slower launches). Cost: ≈ $7.58 spent + ≈ $16.30 to make ≈ $23.88; `--budget 25` is the floor.

## Final review (2026-11-21, build run)

Two fresh reviewers: a playtester (tutorial + Charter I by hand to Commended, ~23 min of Charter II with its own plan) and a bug hunter (code + browser + Node). Findings checked by the coordinator against the code and screenshots before fixing.

| Finding | Severity (by The bar) | Outcome |
|---|---|---|
| Built network mostly invisible outside X-ray (earth/shaft/fire lines) | should-fix (most players, core fantasy) | Fixing: surface traces, portal beacons, train lights outside X-ray |
| Esc on Commended / Term over leaves a dead paused term | must-fix | Fixing |
| Replay Tutorial in pause discards the term | must-fix | Fixing |
| Merit Office "Buy another" takes Merits for nothing | must-fix | Fixing |
| Undo reverts unrelated actions (money exploit) | should-fix | Fixing (sim) |
| Tutorial steps 3/5/6/7 don't frame their targets; Places fly-to into a mountain | should-fix | Fixing |
| Throughput breakdown names nothing useful in its fallback | should-fix | Fixing (sim) |
| Cards hide a +0 exports result; "same place" wording | should-fix | Fixing |
| Second blackout shows no damage report after one "Later" | should-fix | Fixing |
| Water Ride shows X-ray rock, no sea or Atlantis | should-fix | Fixing |
| Places, stations and lines are only numbers | should-fix | Fixing: generated names per region |
| Walkway/selection meshes leak; music stays ducked; Esc from setup/board leaves wrong title | should-fix | Fixing |
| Free crossing spendable early in tutorial; free play shows a deadline; retry reuses a perk; abandoning the tutorial marks it done; disaster music on real time; instance caps | nice / should-fix (cheap) | Fixing |
| Terminal spokes dominate Charter II | nice | Sim fixer to judge with the solver |
| Service worker shows updates one launch late | nice (gamegen template) | Not changed |

### Final review round 2 (2026-11-21)

| Finding | Severity | Outcome |
|---|---|---|
| Tab hidden on Commended/Term over soft-locks the game | must-fix | Fixing (browser) |
| Replay Tutorial / New Term from the title overwrite a saved term | must-fix | Fixing: confirm + bank |
| Ride never ends when play is left (tint, banner stick) | should-fix | Fixing |
| Card "+N exports" ignores a full end interchange | should-fix (core verb) | Fixing (sim) |
| Earth both Cheapest and Most capacity in ~17/21 comparisons | should-fix (core verb) | Retuning + a dominance metric in the sweep |
| Fire chord through the core invisible even in X-ray | should-fix | Fixing |
| Clicking a busy interchange as B cancels the route | should-fix | Fixing |
| Tutorial "click the green line" can't be clicked; dead waits | should-fix | Fixing |
| Bottlenecks hard to spot; portal beacons read as alarms | should-fix | Fixing: Limit chip, stronger full ring, calmer beacons |
| Atlantis interior plain white boxes; Atlantis hard to link | should-fix / nice | Fixing |
| Input live before Commended/finale; sticky tutorial card evicted; Heat Shielding vs pending flare; warp-return unused; 800×600 layout | nice / cheap | Fixing |

### Final review round 3 (verification) and the polish pass (2026-11-21)

Round 3 re-ran every must-fix with real input: 9/9 checks pass (hidden-tab on end screens, Esc/P/Space on end screens, leaving play mid-Ride, Replay Tutorial / New Term, save slots, perks, tutorial timing: crossing 2:32 and Quota I 10:30, untested items, console). New: no HUD after the finale (must-fix), autosaves pruned too eagerly and deleted on a full store (should-fix, lost progress), step-6 tutorial line contradicts the cards (should-fix).
Polish pass (fresh reviewer, own screenshots at 1280×800, 800×600, 1920×1080, iPhone notice; frame log clean; first load clean): Limit chip truncated everywhere, opening Limit message, tutorial text vs cards and keyboard highlight, 800×600 title, finale credits doubled panel, naming/capitalisation, keycap font, repeated/developer text, Report a bug styling, help text/pictures, overlapping pop-ups, plus lone words and small layout items. All being fixed (polish rule: fix everything it finds).
