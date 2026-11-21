# Arcane Transit Authority (ATA)

*A planet-wide city with no room to spare, so run your rails through earth, water, fire and air.*

## Pitch

You're the Chief Engineer of the **Arcane Transit Authority** on **Oikumene**, a planet covered pole to pole in a single glittering city. Tap two places and the game deals you **route cards**: across the rooftops (if you pay to clear the buildings), between mountain peaks, under the sea, through the rock, straight through the molten core, or around the planet on an orbital ring. Each card leads with two numbers: what it **costs** and how many riders a minute it **carries**. Pick one and a glowing **ley-rail** (a rail of arcane energy in that train's colour) draws itself into place, and an elemental train rides it straight through the sky, the sea, the rock or the magma. Every district's goods flow through your network to the Warp Terminal, where deep space trains carry them to the Homeworld at the centre of the galaxy: a light in the sky you will never visit. Each game is one **term** as Chief Engineer under a **Homeworld Charter**: meet its quotas, survive the disasters, turn demolished corridors into parks, and leave the planet humming like a perfect machine. Commend all six Charters and the Homeworld answers.

## Build changes (request 32, 2026-11-20): read these first

The build run was started with `--budget 50 --platform desktop --3d --publish --art-sheet --feedback on`. Where the rest of this document disagrees, **this section wins**:

- **Desktop only.** The game is made for a computer with a mouse and keyboard (1280×800 and up; also checked at 1920×1080 and 1024×700). The Touch column of the Controls table, the phone layout (bottom toolbar 56 px buttons, side column on phones, snap-and-confirm, landscape lock, "turn your phone" overlay, Low as the default on phones) and every phone-size check in the Definition of done are **cut**. Route cards and selection panels still open in the right-hand column (desktop). Pointer events stay, so a touchscreen laptop works with taps as clicks, but nothing is built for touch.
- **On other devices:** a touch-only device (phone or tablet with no keyboard) shows the other-devices notice: heading "Made for a computer", text "Arcane Transit Authority is built for a mouse and keyboard. On a phone or tablet you can spin the planet and look around, but building a network needs a computer." Buttons: "Send link to yourself" and "Look around anyway".
- **Budget $50** (≈ $42.42 left after the mock pictures). The cuts in Effort are not needed: make the full plan, **full-quality train models** (not `--draft`), and the **Giant Wheel and Monument models**. Spend in the order in Effort. If the budget runs short, the Cut list still applies, in its order.
- **Report a bug (feedback on):** "Report a bug" sits in the **pause menu** and the **Settings** screen, styled like the other menu buttons; **Ctrl+Shift+F** opens it from anywhere (the game uses F alone for speed and Shift+1..7 for layers, but never Ctrl and Shift together, so the letter stays F). The Controls page in How to Play and Settings lists "Ctrl+Shift+F: report a bug". The button shows only once the game is published in a public repo.
- **Art sheet:** made once every asset is accepted, on the plans page (`synapticnoise.com/plans/arcane-transit-authority/art/`).
- **Save slots (request 33).** Terms are saved in **slots**, not one global save: an **Autosave** slot for each term in progress plus **6 manual slots**. Pause menu: **Save** (pick a slot; each shows Charter, region, game time, Throughput, date and a small picture of the planet; overwriting asks first) and **Load**; the title: **Continue** (the most recently played term) and **Load** (all slots, with Delete). Merits, unlocks, Commended Charters and settings stay in one profile shared by all slots. **Every term has an id, and its Merits are banked once**: loading an older save of an already-banked term plays on without banking again (the result screen says so). Starting a new term never destroys a saved one: the term in progress keeps its autosave slot until the player deletes it or it ends.
- **Publishing:** when finished, published to its own address on synapticnoise.com, added to the gallery, with the making-of README.

## Settings

- Platform: **desktop** (mouse and keyboard; see Build changes)
- Target: web, 3D, three.js r186 (vendored from meshgen: `three.module.js`, `three.core.js`, addons `OrbitControls`, `GLTFLoader`, `BufferGeometryUtils`, `SkeletonUtils`), plain ES modules, no build step
- Scope: **large** (judged from the request: seven train types, interchanges, a tech tree, random milestones, unlocks between games, disasters, a ladder of six Homeworld Charters with mandates on one planet with six starting regions)
- Budget: **$20 for all generated art and audio**. Up to $10 goes on the shared design's mock pictures. The accepted mocks (7 trains, 8 places, 3 portraits, 6 scenes) are reused as the game's concept art, portraits and loading art. **≈ $7.58 spent on mocks; ≈ $16.30 still to make, so the full plan needs about $23.88.** **`--budget 25` is the floor**; the cuts that fit $20 are listed in Effort and cost
- Tools available: imagegen2 (OpenAI, `gpt-image-2.6-flare`, pinned to `--quality medium`), nanogen (Gemini), audiogen (ElevenLabs, creator plan), meshgen (Meshy, 1,441 credits on the account; the $20 budget is the real limit), playwright-cli, python3 + Pillow, node. No ffmpeg/sox (loudness is set by a gain table in code). anim8gen is not used (3D game)
- Credit: Rich Conlan
- Decisions made on the player's behalf:
  - Name **Arcane Transit Authority**: the logo shows **"ATA"** large with the full name beneath; the short name **"Arcane Transit"** is used for the app icon and manifest. The player is the Chief Engineer of the ATA. "Ecumenopolis" is the word for the planet-city.
  - **One planet.** The request is about a single planet-wide city. The Homeworld at the centre of the galaxy is never visited: like the far end of the deep space trains, it exists only as a light in the sky and voices in dispatches.
  - Routes are built by **tapping two places (stations or cells) and picking a route card**. The game works out every feasible path (one card per kind of route), and builds the stations, interchanges and shafts it needs. No free-hand 3D track laying. Placing a station by hand is still possible (a secondary tool, in the More menu).
  - Each game, a **term**, is one term as Chief Engineer on the one planet, **Oikumene**, whose geography is **the same every game** (players learn it like a home city). Variety comes from the starting region, the term seed and the Charter.
  - "Victory is a job well done": each term is played under one of six **Homeworld Charters** (difficulty tiers), each with **three Homeworld Quotas**. Meet Quota III and the Charter is Commended. Commend Charter VI and the Homeworld answers: you've won.
  - Trains carry **commuters** (who pay fares: your money) and **exports** (goods bound for the Warp Terminal: your Throughput, the score that matters).
  - **Ley-rails.** Each train carries its own element's protection, so it travels **straight through its environment**, riding a **ley-rail**: a glowing rail of arcane energy in its type's colour (ley lines are lines of power across a world, which fits the Arcane Transit Authority). Surface trains ride a physical maglev rail with a glowing seam; sky trains ride a ley-rail arc between peaks with floating ring pylons; water trains ride a sea-floor ley-rail inside their own bubble of swirling water; earth trains bore their own tunnel; fire trains swim through open lava on their ley-rail; space trains ride the orbital ring's ley-rail; deep space trains warp from the launch ring with no rail. Trains are articulated (linked cars on flexible joints that bend smoothly along curves), a nod to the request's "wormy" retro-future trains; nothing is copied from Futurama.
  - **Elemental trains.** Each train is an advanced machine built around its element, never a creature (no monster or dragon shapes), with one clear colour per element so the element reads at a glance, and the whole world leans a bit cyberpunk (see Art direction).
  - The "Robotnik would love it" mood is an original **neon-and-chrome machine city with a cyberpunk edge**: dense megablocks, smokestacks, cables, holographic signs (shapes, never text) and rain-slick reflections. Nothing is copied from Sonic.
  - Charter I already has surface, sky and earth trains, and its tutorial (starting in the Capital) has a **free, scripted first trip through the core about 5 minutes in**, so the game's best idea arrives in the first session. The orbital ring already circles Oikumene with a scenic train on it, and Juno points out Atlantis in the Brine's northern bay, so space and water are seen on day one.
  - Tools appear as the tutorial introduces them (the toolbar grows), so the first minutes are "tap two places, pick a card".

## The player's fantasy

You're the genius engineer who looks at a planet with no room left for a single new rail and says "fine, we'll go through the core." You watch a whole world light up with your lines, ride along one of them, and slowly make it greener and happier as you go. Term after term it is the same planet, your planet: you learn its seas, peaks and rift like a home city, and get better at threading them.

## Core loop

- **10 seconds (hands):** tap a place, tap another (anywhere on the globe, or from the Places list). Route cards appear in a fixed order: "Surface · $4,100 · carries 170/min · demolishes 9 blocks", "Earth · $2,600 · carries 160/min", "Through the core · $8,300 · carries 169/min · +90 exports/min to the Terminal". Each card previews its path on the globe. Pick one; the ley-rail grows and the first train glides out.
- **1 minute:** watch the flow overlay (ley-rails brighten, thicken and pulse faster with load, and small white load markers along them grow, fill and flash where they're full; export dots stream to the Warp Terminal). Fix the named bottleneck: add a train, upgrade an interchange, buy a tech, build a second route, or clear a block for a park. Answer a disaster warning (Brace or Reroute). Ride a train to see it work.
- **A term (30 to 45 minutes):** grow from your starting region to the whole planet, meeting the Charter's Quota I, II and III before the Audit deadline. Finish with a grade and Merits.
- **The session loop:** spend Merits on unlocks (milestone cards, starting perks, liveries), pick a Charter and a starting region on the Charter board, and start the next term, a little different each time (its Charter's mandate, its priority districts, its milestones).

**The mechanic the game lives or dies by:** comparing route cards between two places. Every card is a real, visible trade-off between build cost (including the buildings you'd have to demolish), how much it carries, trip time and running cost, and the best answer changes with distance, density and terrain. See "Balance: what each train is best at".

## The world

### The planet: Oikumene

There is **one planet**: **Oikumene** ("the inhabited world"), a single ecumenopolis. The Homeworld at the centre of the galaxy is never visited; it is a bright point at the heart of the galactic core in the sky, and a voice in dispatches.

- A sphere of radius **100 units** (1 unit = 50 miles; circumference 628 units ≈ **31,400 miles**). Core radius **35**; base crust limit **25**; orbital ring at radius **130** over the equator.
- A **geodesic grid**: the dual of an icosphere subdivided 3 times: **642 cells** (12 pentagons). Each cell's area ≈ 196 units², so a cell is **about 15 units (750 miles) across**, inradius about 7.5; neighbouring cell centres are about 15 units (8.6°) apart.
- Every cell has a **terrain**: city (most), mountain (city climbing the slopes; a **peak** is a mountain cell higher than all its neighbours, bare at the top), ocean (some with an undersea city: **Atlantis domes**), and one **landmark** cell: the Warp Terminal. Totals: **120 ocean cells** (19%, all in the Brine; 14 of them Atlantis cells), **522 land cells** (city, mountain slopes included), **91 mountain cells** (~14%) with **27 peaks**.
- Every city cell has a **density** 1 to 5: buildings, commuters and exports made, and demolition price. Each region has a base density map; the term seed nudges it (see Terms).
- **The geography is the same every game.** `tools/oikumene.mjs` builds it once from a fixed map seed, the region centres and weights, and a short list of hand-set cell overrides (all in `OIKUMENE` in `tuning.js`), checks it (below), and writes the result as a **frozen cell table** (`OIKUMENE_CELLS` in `tuning.js`: 642 rows of region, terrain, base density, height and peak flag). The game reads only the frozen table and never rebuilds the map; the geography hash is the hash of that table. Players learn it like a home city.
- **The Warp Terminal** is a fixed landmark on the equator at 180° longitude, **160° from the Capital's centre**: reaching it is the first big problem from most starting regions.

### The regions

Every cell belongs to exactly one area: one of **six starting regions** or **the Far Wards**, a seventh area you never start in. Regional differences are **modifiers** on the one set of planet numbers (Tuning: regions). Positions are latitude/longitude; the Capital's centre is 20°N 0°.

**Cell → region, in this order** (by `tools/oikumene.mjs`):
1. **The Capital:** its centre cell and the 3 rings around it (37 cells; the grid is oriented so no pentagon falls inside).
2. **The Brine, the Spires, the Rift, the Flats: weighted nearest centre.** Each remaining cell goes to the region with the lowest (angle to its centre ÷ its weight), counting only regions whose reach covers the cell (angle to the centre ≤ the region's reach; weights and reaches in Tuning: regions).
3. **The Ringside:** every cell still unassigned within 2 cells (30 units, 17.2°) of the equator, the orbital ring's ground track.
4. **The Far Wards:** everything left: the city hinterland north and south of the Warp Terminal on the far side.

Then terrain: the Brine is ocean except 26 island-city cells (island clusters of 2 to 4 cells from the map seed, plus its start cell); 14 of its ocean cells are Atlantis (2 by override in its northern bay within 30° of the Capital); the Spires are mountain except 15 valley cells; the Rift has a 12-cell ridge through its centre; the Capital Heights are 4 override cells. Peaks are the mountain cells higher than all their neighbours (the map seed's heights are tuned until the counts below hold).

| Area | Centre | Cells | What it is | Start cell (land) | Angle from start to Terminal | Signature type |
|---|---|---|---|---|---|---|
| **The Capital** | 20°N 0° | 37 (centre + 3 rings) | the densest, oldest district cluster; 4 mountain cells with 2 peaks (the **Capital Heights**) | its centre, 20°N 0° | 160° | earth |
| **The Brine** | 25°S 60°E | 146 (120 ocean incl. 14 **Atlantis**, 26 island-city) | a great ocean with Atlantis domes and island cities; its northern bay reaches within 30° of the Capital | Saltmarch Island, 30°S 65°E | 112° | **water** (Sea Stations native) |
| **The Spires** | 50°N 60°W | 90 (75 mountain, 22 peaks) | a mountain range with peaks for Sky Ports; deep crust roots under it | Hollowgate valley, 50°N 60°W | 109° | sky |
| **The Rift** | 20°S 100°W | 65 (12 ridge cells, 3 peaks) | a volcanic rift where the crust is thin: half-price Core Exchanges and ×1.5 shaft speed (the **Rift rule**, Tuning: regions), earth chords shallow; **Core Flares** start here | Cinder Gate, 20°S 100°W | 81° | fire (through the core) |
| **The Flats** | 45°S 30°W | 92 (no mountains) | wide, flat, very dense industrial blocks; demolition is ruinous | its centre, 45°S 30°W | 128° | earth |
| **The Ringside** | the equatorial band left after the others | 60, incl. the Warp Terminal | the belt under the orbital ring: every cell can host a Space Elevator | Ring Market, 0° 30°W | 150° | **space** (Space Elevators native) |
| **The Far Wards** (not a starting region) | — | 152 (no mountains) | ordinary city hinterland around the Warp Terminal on the far side | — | — | — |
| **Total** | | **642** | | | | |

Start angles are measured from the start cell's centre after it snaps to the grid; `tools/oikumene.mjs` fails if any is more than 5° off the table.

**`tools/oikumene.mjs` (Node) fails the build unless:** the counts per area match the table (cells exactly; ocean 120, Atlantis 14, mountains 91 ± 3, peaks exactly 2 / 22 / 3 in the Capital / Spires / Rift and 27 in all); every start cell is land and in its region; every start angle is within 5° of the table; the tutorial geography below holds; and the frozen table in `tuning.js` equals a fresh build. It prints per area: cells, ocean, Atlantis, mountains, peaks, start cell and start angle.

**Signature types:** starting in a region makes its signature type **native for that term** (its unlock node is owned free). This matters for the two types that are otherwise locked early: water (the Brine) and space (the Ringside); the other regions' signatures are native in every Charter already.

The **Polar Ring** (tech) runs along the Terminal's meridian, which also passes through the Capital.

### Terms (what changes each game)

- The player picks a **Charter** (I to VI, then Galactic) and a **starting region** (unlocked over time; see Structure). The camera starts at the region's start cell, and any inherited network is there.
- Each Charter has a **mandate** that changes what you build (Tuning: Charters).
- A **term seed** varies, never the geography:
  - **Densities:** each city cell's density ±1 around its region's base map (clamped 1 to 5). **Rebalancing:** the `term` stream rolls a nudge of −1, 0 or +1 for every city cell in id order; then, for each area whose average is more than 0.2 above its base average, nudges of +1 are set to 0 in cell id order until it is within 0.2 (and the same with −1 nudges when it is more than 0.2 below). One pass always suffices, because with every +1 nudge removed the average cannot be above the base. Tutorial cells are never nudged.
  - **Priority districts:** 2 (Charters I–III) or 3 (IV and later) city cells of density ≥ 3, each in a different area (the Far Wards included), none in the starting region, each at least 45° from the start cell and from each other (under the Frontier Link mandate, one is always dealt at least 90° from the start cell). While a priority district is served by a station in the Terminal's component, **exports from its cell and its neighbours are ×1.5**. Each shows a slowly turning chrome-and-warm-white holo-diamond above it and is listed in Places. The tutorial term deals none.
  - **The inherited network** (from the previous Chief Engineer): stations at the **2 to 4 densest city cells of the starting region** (ties by cell id; each at least 2 cells from the others), linked into 1 or 2 lines between neighbours in that list, each line the **cheapest feasible card that `routes.js` offers using only the term's native types and no Surface** (so no corridor is pre-demolished; a pair with no such card is skipped). Inherited stations and lines are free but pay normal upkeep, are never linked to the Terminal, and **don't count toward milestones**. The tutorial term inherits nothing.
  - The 3 dealt milestones, the disaster timeline and the dispatches.
- **Tutorial geography (fixed; Charter I, the Capital, first term, fixed term seed with no density nudges on these cells):** a density-2 edge district on the Capital's south-west edge (3 cells from its centre, ~160° from the Terminal) with a density-2 district 4 cells beyond it (no peaks between), the two Capital Heights peaks within 4 cells of the centre (one within 1 cell of a city cell next to the centre), and 2 Atlantis cells in the Brine's northern bay within 30° of the Capital.

### Heights and radii (every layer, so ley-rails and trains never clip)

The radius given for a line is its **ley-rail** (the path the train's centre follows); trains ride on it, nothing encloses them.

| Thing | Radius from the planet centre |
|---|---|
| City ground | 100 |
| Mountain ground | 100 + 3 to 12 (by mountain level); peaks 8 to 12 |
| Buildings | ground + 1 to 8 (by density) |
| Surface ley-rail (train centre) | ground + 1.0; the chrome maglev beam's top at ground + 0.5, sleepers on the cleared ground |
| Sea surface (see-through shell, on every quality) | 100 |
| Sea floor; Atlantis domes (radius 5) sit on it, centred on their cell | 94 |
| Water ley-rail (train centre; each car in its own water bubble, radius ~0.6) | 94.8; never within 6 units (along the sea floor) of an Atlantis dome's centre |
| Coastal pier deck (code) | 100.5 |
| Sky ley-rail arc (ring pylons every ~8 units along it) | 100 + lerp(peak A height, peak B height, t) + 2 + h·sin(πt), h = max(12, 0.25 × arc length) |
| **Earth portals** (chord ends and shaft tops) | **100**, directly under their station, whatever the ground height |
| Earth bores (bore radius 0.5) | straight chords between portals; deepest point ≥ max(100 − crust limit, core radius + 2) (crust limit by region: Tuning) |
| Core surface; Core Exchanges sit at core radius + 2 | 35; Core Exchanges at 37 (so every shaft, portal 100 to 37, is 63 units long) |

**One earth rule:** every chord end and shaft top is a **portal at radius 100 under its station**, so a chord's length and depth depend only on the angle between its stations, the max-angle table holds in every region, and every shaft is 63 units. A station on a mountain (ground 103 to 112) connects down to its portal by a short vertical **station well**: drawn like a shaft (the same rock-and-crystal bore, seen only in X-ray, inside the mountain), part of the station (no track cost, no travel time, not in any line's length). From outside, the bore portal arch is drawn beside the station on the slope, as on flat ground.
| Fire ley-rail | straight chords between Core Exchanges, through open lava inside the core |
| Orbital ring (equatorial; its violet ley-rail runs along it) | 130 |
| Polar Ring (tech, the meridian through the Warp Terminal and the Capital) | 130 |

### Layers (and the seven trains)

Type colours are **reserved for the network** (ley-rails, trains' accent bands and element effects, icons, cards, overlay legend). No world material uses a type hex (see Art direction: palette).

| Train | Colour | Links | Path (what it rides) | Strengths | Weaknesses |
|---|---|---|---|---|---|
| **Surface** (lightning) | yellow `#ffc23d` | two surface stations | a chrome maglev rail with a glowing yellow seam, along the ground cell to cell in the corridor of demolished cells | fast, cheapest to run | must **demolish** every city cell it crosses (and loses their demand); can't cross ocean |
| **Sky** (wind) | ice-cyan `#4fe3ff` | two **Sky Ports** on peaks | a ley-rail of light arcing high between peaks, with floating ring pylons | cheapest to build, nothing to demolish | peaks only; range 60 units (90 with tech); meteors |
| **Water** | deep blue `#2f6bff` | two **Sea Stations** (coastal pier or Atlantis dome) | a blue ley-rail along the sea floor, the train in its own bubble of swirling water | the only way to serve Atlantis (dense, no demolition) | ocean only; seaquakes |
| **Earth** | emerald green `#2fd67b` | two **Bore Stations** on land, or a Bore Station and its **Core Exchange** (the shaft) | a straight chord through rock: it bores its own tunnel (green-crystal-lined, seen in X-ray) | goes under anything, nothing to demolish | slow; max angle set by the crust limit; cave-ins |
| **Fire** | red-orange `#ff5a1f` | two **Core Exchanges** at least 60° apart | a red-orange ley-rail chord across the molten core, the train swimming through open lava | the far side for a fair price | only in the core; core flares |
| **Space** | violet `#9b6bff` | two **Ring Stations**, each on a **Space Elevator** | the orbital ring itself (chrome structure with the violet ley-rail on it) | fastest and biggest | elevators are costly and only near the ring's ground track; solar storms |
| **Deep space** | magenta `#ff3fb4` | the **Warp Terminal** | no rail: warps away and back from the Terminal's launch ring | the only way exports reach the Homeworld | its capacity is the planet's Throughput ceiling; warp drift |

### Route cards (the core verb)

1. **Route tool** (the default tool): tap place A (a station, or any cell). A becomes a pin; far-side stations show as clickable markers through the globe (X-ray stays off: it is the player's choice, V); a "Pick from list" button opens the **Places** list (stations, peaks, Atlantis, the Warp Terminal); dragging the globe still works.
2. Tap place B. `routes.js` builds one card per feasible kind of route (at most 7), in a **fixed order**: Surface, Sky, Water, Earth, Through the core, Space, Hybrid. Possible-but-locked and impossible kinds follow, greyed. Tags: **Cheapest** (lowest cost) and **Most capacity** (highest "carries").
3. **Each card leads with two big numbers:**
   - **Cost** (everything it builds, including 2 trains per line and demolition).
   - **Carries N/min**: riders per minute each way, the **minimum over every leg and every transfer** on the card's path (each new line with its 2 trains; each interchange's remaining transfer capacity). A line card for a single leg is that line's capacity.
   - **"+N exports/min to the Terminal"** when building it would let more exports reach the Terminal: computed with the sim's own path code on a cloned network (exports newly routable, capped by "carries").
   - One short line under them: "demolishes 9 blocks" (Surface) or a lock/impossible reason.
   - **Details** (an expand arrow): cost breakdown (track, stations, interchange upgrades, demolition and blocks), trip time A to B, running cost per minute, the legs and transfers with their own capacities, and a "Best at" hint.
4. Highlighting a card (hover, or the first tap on phones) draws its path on the globe as a dashed ghost and outlines the cells it would demolish in red; the camera frames the path (on phones within the left 60% of the screen).
5. Locked kinds show what unlocks them ("Water: needs Sea Stations, Tech $1,200"; tapping opens that tech node). Impossible kinds show one line of reason ("Sky: no peak within 1 cell of B"; "Earth: 97° apart, the crust allows 83°"; "Earth: 70° apart, the Rift's thin crust allows 64°"; "Through the core: under 60° apart").
6. Picking a card (second tap, or "Build") **builds everything**: stations at A and B if needed, interchange upgrades, shafts and Core Exchanges, the line or lines, and 2 trains on each. Undo within 10 s reverses all of it (see Undo).

**Station reuse (the walkway rule, part 1):** a card never builds a new station within 1 cell of an existing one if that station can serve the layer (it adds the layer as an interchange upgrade instead). If the layer can't be added there (a Sky Port needs a peak; a Sea Station needs ocean), the new station is built and **auto-linked by a walkway** (part 2, below).

| Card | Feasible when | What it builds |
|---|---|---|
| Surface | both ends on land (Elevated Viaducts: up to 2 ocean cells) | A* path over land cells; surface stations; demolition of the path cells; the maglev rail laid in the cleared corridor |
| Sky | each end is a peak or within 1 cell of one; arc within range | Sky Ports on the two peaks (walkway-linked to a station within 1 cell); ley-rail arc and its ring pylons |
| Water | each end is coastal ocean, an Atlantis cell, or within 1 cell of one | Sea Stations (pier or dome; walkway-linked); sea-floor ley-rail |
| Earth | both on land, angle ≤ the max earth angle of the **stricter** end's region (Tuning: regions) | Bore Stations; bored chord |
| **Through the core** | both on land, **at least 60° apart** (so the fire chord really crosses the core) | Bore Station + shaft + Core Exchange at each end; three lines: shaft A (earth), core (fire), shaft B (earth); an end in the Rift follows the Rift rule (Tuning: regions) |
| Space via the ring | Space Elevators owned; each end within 2 cells of the ring's ground track | Space Elevator + Ring Station at each end; ring line |
| **Hybrid** (see below) | one end is ≤ 4 cells (by Surface) from an existing non-surface station S | a Surface leg (end → S) + a leg of S's layer from S to the other end |

**Hybrid, exactly:** for each end E and each existing station S within 4 cells of E (by a Surface path) whose layer L ≠ surface, the game checks whether an L card from S to the other end is feasible. Among those, it keeps the cheapest Hybrid (Surface leg + L leg + interchange upgrade at S). If the other end has no station of layer L, the L leg builds one there by L's own rules (with reuse and walkways). The Hybrid card is shown only if it is cheaper than every feasible single-type card, or if no single-type card is feasible.

- **Manual Station tool** (secondary; More menu): pick a kind, tap a lit cell. For planning catchment, interchanges and Atlantis coverage.
- **Lines are point-to-point** (one type, two end stations). Networks form at stations and walkways; transfers happen there.

### Stations and interchanges

- **Catchment:** a station serves its own cell and its 6 (or 5) neighbours. Atlantis cells count only for Sea Stations. A cell in several catchments splits its demand evenly.
- **Surface stations demolish their own cell.** Bore Stations are built into existing buildings, Sky Ports sit on bare peaks, Sea Station piers sit on the ocean cell next to the coast: none of these demolish.
- **Interchanges:** a station that serves more than one layer. Any station can be upgraded to add a layer ($250 + that layer's station price).
- **Walkways (the walkway rule, part 2):** any two stations whose cells are the same or neighbours are **auto-linked as one interchange** (a short code-drawn chrome footbridge with a pale light strip between them). A walkway transfer takes 4 s like any transfer and counts against the transfer capacity of the station being boarded. This is how a pier joins a coastal city station and a Sky Port joins the district below its peak.
- **What counts as a transfer:** changing line at a station or across a walkway. **Boarding at the origin and arriving at the destination are not transfers.**
- **Transfer capacity** (passengers and goods changing lines there, per minute):

| Station | Base | Paid upgrade ($600) | Bigger Interchanges tech | Wide Shafts tech |
|---|---|---|---|---|
| Ordinary station or interchange | 120 | ×2 | ×1.5 | — |
| **Core Exchange** | **360** | ×2 | ×1.5 | ×1.5 |
| **Space Elevator station** (ground station of an elevator) | **360** | ×2 | ×1.5 | — |
| Warp Terminal | no limit | — | — | — |

  Shown as a ring around the station that fills; full = red pulse, and the bottleneck readout names it.
- **Look of an interchange:** the base station model with each added layer's module **stacked above it**, scaled to 60%, in a vertical column, and a code-drawn capacity ring around the base (see Art direction).
- **The Core Exchange:** a Bore Station sinks a vertical **shaft** to a Core Exchange on the core's surface directly below it. Shafts are armoured: **exempt from the crust limit**. A far-side trip is earth (down the shaft) → fire (across the core) → earth (up). The first one is a big moment (see Juice).
- **Space Elevators:** allowed from any station within **2 cells (30 units) of the ring's ground track** (the equator; for the Polar Ring, the Warp Terminal's meridian). The elevator cable (with the violet ley-rail running up it) leans from the station up to the ring point above the nearest ground-track point; the elevator ride is part of the space line (speed 3.0 on that segment).
- **The Warp Terminal:** already built on its landmark cell. It counts as a station that accepts surface, earth (with a shaft, so through-the-core routes can end there) and space lines; other layers reach it through interchanges and walkways. No transfer limit: exports wait in its **yard** for the next deep space train (the yard is unlimited except under the Narrow Yard mandate, Tuning: Charters).

### What moves, and why (the simulation)

All numbers live in `tuning.js` (see Tuning). The simulation ticks once per **game second** (every 30 fixed updates).

- **Connected components:** stations joined by lines and walkways form components (recomputed on network change). **Demand exists only within a component.** Exports are made only by stations in the **Terminal's component**; a station outside it shows "No link to the Terminal" and makes commuters only.
- **Generation (served cells only):** commuters `2 × density` per cell per minute; exports `1.2 × density × Charter export multiplier × region export multiplier` per cell per minute, × 1.5 in a served priority district and its neighbours, × 2 on Atlantis cells under the Atlantean Trade mandate. Parks, groves and attractions multiply generation nearby (Greenery).
- **Demand (no nearest-N cap):** for each pair of served stations (s, t) in the same component, commuters from s go to t in proportion to `G_t / (1 + d_st / 150)` (d = great-circle distance in units), plus an extra **15% long-haul share** of each station's commuters split among same-component stations more than 90° away. With up to ~100 stations that is ≤ 10,000 pairs, cheap at one tick a second.
- **Exports** from every station in the Terminal's component are bound for the Warp Terminal. Exports made at the Terminal's own catchment go straight to the yard.
- **Paths:** recomputed only when the network changes, over an **expanded graph**: nodes = (station, line) pairs; ride edges weighted by travel time; transfer edges (same station or walkway) 4 s. For each origin station, **one Dijkstra** (seeded from all its (station, line) nodes) gives the fastest path to every destination; **two penalty re-runs** (every edge on the first tree costs ×2, then ×4) give up to 2 alternatives per pair, kept only if distinct. ~100 stations → ~300 Dijkstras on a ~300-node graph.
- **Assignment (deterministic):** each tick, new demand is added to per-pair backlogs. Pairs are processed in a fixed order: exports first (origin station id ascending), then commuters (origin id, then destination id ascending). Each pair takes as much of its backlog as fits on its fastest path (every leg's remaining line capacity and every transfer's remaining station capacity this tick), then its alternatives. What doesn't fit waits at the origin station (a crowd ring). Each station's waiting crowd is capped at 10 × its per-minute generation; overflow is **turned away** (counted, shown in the line/station panel).
- **Travel:** assigned flows arrive after their path's travel time (an in-flight list). **Fares are paid on delivery**: `$1 + $0.04 × great-circle distance (units)` per commuter. Exports pay a **$1.50 freight fee** when they launch.
- **Line capacity** (riders per minute **each way**) = `trains × cars × car capacity × 60 / (2 × length / speed + 8)` (8 s of dwell per round trip). Example: a shaft (63 units, 2 trains) carries 169/min (a Rift shaft, speed 2.0 × 1.5 = 3.0 by the Rift rule: 240/min); a 160° fire chord (73 units, 2 trains) 446/min.
- **Deep space:** a deep space train leaves every **30 s** (20 s with Twin Launch Ring; 60 s under the Narrow Yard mandate until Twin Launch Ring is bought) and carries up to `warp cars × 50` exports from the yard.
- **Throughput** = exports launched in the half-open window **(t − 60 s, t]** of game time. With 30 s departures that window always holds exactly 2 departures (3 with Twin Launch Ring; 1 with the Narrow Yard's 60 s departures). This is the Quota meter.
- **Trains are visual**: they ride their line's ley-rail at the line's speed, spaced evenly, wrapped in their element effect, and their cars glow by the line's actual load. A broken or closed line's trains visibly stop.

### Making the simulation readable

- **Flow overlay** (O, or the Flow button): **a ley-rail always keeps its type colour** (so the type stays readable). Load shows as **width, brightness and pulse speed**: the glow ribbon widens from ×1 to ×2.5 and brightens with flow, and light pulses run along it faster the more it carries. **Fullness** shows as small **load markers**: instanced rings around the rail every ~10 units, always **pure white `#ffffff` with a dark outline** (`#141a3a`), a colour used nowhere else in the game, so they never look like a type colour or the city's lights. Fullness is carried by **size, fill and flashing**, never hue: under 60% full, a small hollow ring; 60–90%, a larger, half-filled ring; over 90%, the largest ring, solid and **flashing**. A broken or closed line's rail dims and stops pulsing. Exports appear as magenta dots streaming toward the Warp Terminal; crowded stations pulse rose; turned-away counts float over stations.
- **One number:** the top bar shows **Throughput/min** against the next Quota. Line and station panels show one **flow/min** (riders of both kinds). Commuters and exports are split only in the breakdown and in panel details.
- **Throughput breakdown** (tap the meter): "Made 420/min · reaching terminal 310/min · launched 300/min" and **the bottleneck, named, with a Show me button**:
  - launched < 95% of reaching → "Limit: the Warp ring (deep space capacity 300/min). Tech: Warp Consists, Twin Launch Ring."
  - else reaching < 90% of made → the line or interchange holding the most waiting exports ("Limit: Bore 7 interchange, 120/min").
  - else any station has "No link to the Terminal" → "Limit: 3 stations not linked to the Terminal."
  - else → "Limit: districts served. Connect more of the city."
- **Line panel:** load %, flow/min, income and running cost per minute, waiting and turned away, trains (+/−), **Ride**.

### Ride and attract cameras

- **Ride** (line panel, or C with a line selected): a chase camera 2 units behind and 1 above the lead car of the line's first train, looking 4 samples ahead along the ley-rail's path samples, so you see the train's element effect around it and the rail running on ahead (through the clouds, the sea, the bore or the lava); X-ray turns on automatically while the car is below the ground radius (shafts, bores, the core, the sea floor) and off when it comes back up. At the line's end it rides the next train back. Any input (drag, tap, key) exits to the orbit camera at the same spot. The lead car is always the full model while riding.
- **Attract camera:** on the title screen, and on the pause screen after 10 s idle, the camera slowly orbits and every 20 s rides a random line for 15 s (on the title: a fixed demo network on Oikumene).
- Both reuse the first-crossing cinematic's "follow path" code in `camera.js`.

### The "inverted ecumenopolis": demolish and rebuild greener

- **Demolish:** clear any city cell, or a line of cells (drag, or on touch tap a start and an end). Price by density (Tuning). A demolished cell makes no demand.
- **Green:** on cleared cells: **Tree grove** ($80, +5% generation in neighbouring cells, Greenery 0.5), **Park** ($150, +10% in neighbours, Greenery 1).
- **Attraction** ($1,500, Greenery 3, on a cleared cell next to a line): **one rule, +30% generation (commuters and exports) within 2 cells.** Pick one of three looks: **Giant Wheel**, **Fountain Plaza**, **Monument to the Engineers** (cosmetic only).
- Surface lines leave a cleared corridor; the cells beside it are cheap to green.

### Disasters

The pool and pacing come from the Charter (Tuning: time and disasters); the timeline is drawn from the term seed: at the start of a term, the disaster stream pre-rolls a timeline of **(unit gap, roll) pairs**; each gap is scaled at run time by the mean gap in force at that moment (before or after Quota II) and its jitter. When a time arrives, the roll picks from the disaster types that **threaten something you've built at that moment**, sorted by type id, and a second roll picks the target from eligible targets sorted by id. **Regional disasters prefer their region:** if any eligible target lies in the disaster's home region (table below), only those are eligible; otherwise any. If nothing is eligible, that slot is skipped. Same term seed and same actions, same disasters.

Each gives a **15 s warning**: a banner with Juno's portrait, a pulsing outline on what's at risk, a siren, and **if the game is at 2x or 4x it drops to 1x** (it returns to the chosen speed when the hit is dealt with or 30 s after it). The banner offers three buttons:

| Button | What it does |
|---|---|
| **Show me** | flies the camera there |
| **Brace ($)** | costs 50% of the repair price now; **halves the damage**: broken lines' repair price and time halved; timed effects last half as long; Meteor breaks 1 segment fewer; Blackout radius 1 instead of 2 |
| **Reroute** (free) | closes the threatened line at once: riders on board are delivered, waiting riders re-path to other routes, nobody is lost. The line reopens when repaired (or at once if the hit misses nothing) |

If neither is chosen, riders on board a line when it breaks are **lost** (counted as turned away, no fare). After a hit, the banner offers **Repair all ($X)**; every repair is also one tap on the outlined segment.

| Disaster | Home region | Hits | Effect | Response |
|---|---|---|---|---|
| Meteor Shower | over the Spires | a sky line (with a Sky Port in the Spires, if any) | 2 segments of its ley-rail broken (gaps, pylons knocked askew): line stops | Repair $200 per segment, 15 s |
| Seaquake | the Brine | a water line (all water is in the Brine) | line stops | Repair $300, 15 s |
| Cave-in | anywhere | an earth line or shaft | line closed | Repair $400, 20 s |
| Core Flare | erupts from the Rift | fire lines and Core Exchanges (Core Exchanges under the Rift and the fire lines touching them, if any; else all) | capacity halved, 60 s | Heat Shielding prevents it; Coolant Dump $500 ends it at once |
| Solar Storm | the ring (over the Ringside) | the ring | ring speed halved, 60 s | Magnetic Shield: speed ×0.75 instead |
| Blackout | anywhere | stations within 2 cells of a target | closed 45 s | Restore Power $300, or wait |
| Warp Drift | the Warp Terminal | deep space | next 2 departures each 15 s late | Warp Anchor prevents it |

### The tech tree

Seven branches, four nodes each (28), bought with money during the term, left to right. Prices: tier 1 $600, tier 2 $1,200, tier 3 $2,000, tier 4 $3,000, × the Charter's price multiplier. Unlock nodes are owned for free when that type is native: by the Charter, or as the starting region's signature type (water from the Brine, space from the Ringside).

| Branch | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Surface | Express Cars (+25% speed) | Long Consists (+1 car) | Cut-and-Cover (−25% demolition for surface lines) | Elevated Viaducts (cross up to 2 ocean cells at 3× track cost) |
| Sky | Long Arcs (range 60 → 90) | Meteor Netting (1 segment broken, not 2) | Cloud Liners (+50% car capacity) | Sky Lifts (Sky Port catchment 2 rings) |
| Water | Sea Stations (unlock; $1,200; native from Charter II on) | Atlantis Charter (Atlantis density +1) | Pressure Hulls (no seaquake stop: speed ×0.5 instead) | Abyssal Express (+30% speed) |
| Earth | Deep Bore (crust limit +15, never below core radius + 2) | Drill Heads (−30% earth track cost) | Tunnel Bracing (no cave-ins) | Fast Shafts (+50% speed in shafts) |
| Fire | Heat Shielding (no core flares) | Plasma Drive (+40% speed) | Wide Shafts (Core Exchange transfer ×1.5) | Magma Express (+1 car) |
| Space | Space Elevators (unlock; $3,000; native from Charter IV on) | Cheap Elevators (elevator price halved) | Magnetic Shield | Polar Ring (second ring along the Warp Terminal's meridian) |
| Deep space and stations | Bigger Interchanges (+50% transfer) | Warp Consists (+2 warp cars) | Warp Anchor (no warp drift) | Twin Launch Ring (departures every 20 s) |

Surface, sky, earth, fire (through the core) and deep space are available in every Charter from the start. Full-screen panel with seven columns (on phones, tabs, one branch at a time).

### Milestones (random each term)

At the start of a term you're dealt **3 milestone cards** (from the milestone stream of the term seed) from your unlocked pool. Optional goals with a bonus; a completed card flips with fanfare and its bonus applies at once. Targets scale with the Charter (Q3 = its Quota III):

| Card (starting pool of 10) | Goal | Bonus |
|---|---|---|
| Long Haul | track equal to the circumference: 31,400 miles (628 units) | +10% fares |
| Sky Fleet | 6 sky trains running | sky trains +20% speed |
| Core Commuter | 3 through-the-core routes (the tutorial's free one counts as 1) | a free Core Exchange |
| Green Belt | 10 park or tree cells | parks count double for Greenery |
| Atlantean Friend | serve 3 Atlantis cells | +1 density on every Atlantis cell |
| Rush Hour | commuters delivered per minute ≥ 1.5 × Q3 | +1 car on every line |
| Ring of Fire | 4 fire trains | Heat Shielding free |
| Clean Sweep | demolish 25 cells | demolition −30% |
| Interchange Master | 4 interchanges of 3+ layers | +50% transfer everywhere |
| Steady Exports | Throughput ≥ Quota II for 3 min | +1 warp car |

Cards that don't fit the term are never dealt (Atlantean Friend is not dealt in the tutorial term, which doesn't introduce water). **20 unlockable cards** (bought between terms), for example "Ten of Each" (10 trains of each available type), "Every Peak" (a Sky Port on every peak), "Untouchable" (no disaster damage for 10 min), "Every District" (80% of city cells served), "Five Attractions", "Half Way Round" (a working route between two places 170°+ apart). Mileage counts all track, chords and shafts included (1 unit = 50 miles). Inherited stations, lines and trains never count toward a milestone.

### Unlocks between terms (the roguelike part)

Finishing a term under a Charter (win or lose; free play earns none) earns **Merits**: 1 per Quota met, +1 per milestone completed, +1 per grade star (Overtime: see Win, lose). The **Merit Office** sells:

- **Milestone cards** added to the pool (20, 2 to 4 Merits each).
- **Starting perks** (choose one per term once owned): +$3,000 starting money, one free tech node, a free Core Exchange pair, a Space Elevator already built, a reroll of the dealt milestones.
- **Train liveries** (cosmetic, 1 Merit each): a livery = a **tint** for each type's lead-car material (a uniform multiplied into the base colour via `onBeforeCompile`; emissive accent unchanged) + a **palette** for the code trailing capsules and their emissive band. No new assets.
- **Charters and starting regions** are not bought: Commending a Charter (meeting its Quota III) unlocks the next Charter and a new starting region (Structure and difficulty).

## Tuning (all in `tuning.js`; starting values, balanced with `tools/solve.mjs`)

### Per train type

| Type | Track $/unit | Station $ | Train $ | Upkeep $/min per train | Speed (units/s) | Cars × capacity | Range / limit |
|---|---|---|---|---|---|---|---|
| Surface | 8 | 150 + its cell's demolition | 300 | 6 | 3.0 | 3 × 20 | land |
| Sky | 4 | 300 (Sky Port) | 350 | 5 | 4.0 | 2 × 15 | 60 units of arc (90) |
| Water | 14 | 350 pier / 500 dome | 450 | 8 | 2.5 | 3 × 20 | ocean |
| Earth | 30 | 400 (Bore) | 500 | 10 | 2.0 | 4 × 25 | max earth angle |
| Fire | 30 | 900 (Core Exchange, shaft included) | 800 | 14 | 6.0 | 4 × 30 | core; ends ≥ 60° apart |
| Space | 6 | 2,500 (Elevator + Ring Station; 1,250 with tech) | 1,200 | 18 | 8.0 (elevators 3.0) | 6 × 30 | ring reach |
| Deep space | — | built | — | — | every 30 s (20) | warp cars × 50 | — |

Station upkeep $2/min each; interchange layers +$2/min each; walkways free.

**Demolition per cell:** density 1 $100 · 2 $250 · 3 $450 · 4 $700 · 5 $1,000, × the Charter's demolition multiplier × the cell's region demolition multiplier.

### The planet (one set of numbers, every term)

Radius 100 · 642 cells (frozen cell table) · core radius 35 (Core Exchanges at 37; earth portals at 100, so every shaft is 63 units) · base crust limit 25 (max earth angle 83°, Deep Bore 106°) · orbital ring 130 · 120 ocean cells (19%) · 91 mountain cells (~14%) · 27 peaks · 14 Atlantis cells (base density 4) · Warp Terminal at 0° 180°.

### Regions (modifiers on the planet numbers)

| Area | Map weight / reach | Base avg density (term ±1 per cell) | Demolition × | Export × | Crust limit (depth) | Max earth angle (Deep Bore) | Other |
|---|---|---|---|---|---|---|---|
| The Capital | centre + 3 rings | 3.4 (centre 5, edges 2) | 1.0 | 1.0 | 25 | 83° (106°) | 2 peaks (Capital Heights) |
| The Brine | 1.0 / 66° | 2.6 on island cities; Atlantis 4 | 1.1 | 1.0 | 25 | 83° (106°) | all 120 ocean cells and 14 Atlantis cells; signature: water |
| The Spires | 1.0 / 48° | 2.4 | 1.2 (slopes) | 1.0 | 30 (mountain roots) | 91° (113°) | 22 peaks |
| The Rift | 1.0 / 38° | 2.4 | 1.0 | 1.1 (foundries) | **15** (thin crust) | **64° (91°)** | **the Rift rule** (below); 3 peaks |
| The Flats | 1.1 / 50° | 3.6 | **1.8** | 1.2 | 25 | 83° (106°) | no mountains |
| The Ringside | the band left after the others | 2.2 | 1.0 | 1.0 | 25 | 83° (106°) | every cell within Space Elevator reach (2 cells of the equator); signature: space |
| The Far Wards | everything left | 2.0 | 1.0 | 1.0 | 25 | 83° (106°) | not a starting region; no mountains |

The weights and reaches were sketched on the 642-cell grid (giving the counts in The regions); `tools/oikumene.mjs` tunes them only if its checks fail, and the frozen cell table is what the game uses.

- **The Rift rule (the one statement of it):** in the Rift, **Core Exchanges are half price** ($450 base instead of $900, shaft included, × the Charter's price multiplier) and **shafts run at ×1.5 speed** (3.0 instead of 2.0; with Fast Shafts 4.5 instead of 3.0). A Rift shaft with 2 trains carries 240/min instead of 169. It applies per end: on a through-the-core route only the Rift end gets it.
- **An earth chord uses the stricter end's crust limit** (a Capital-to-Rift chord is limited to 64°). Shafts are armoured and exempt everywhere. A through-the-core card prices each end's Core Exchange by its own region.
- **Cost of a cell's buildings** = base demolition × Charter × region (a density-5 Flats block under Charter VI: $1,000 × 1.4 × 1.8 = $2,520).

### Charters (the difficulty ladder)

| Charter | Price × | Demolition × | Export × | Start $ | Debt limit | Deadline | Warp cars (base) | Quota I / II / III per min |
|---|---|---|---|---|---|---|---|---|
| I | 1.0 | 1.0 | 1.0 | 8,000 | −3,000 | 45 min | 6 | **90** / 240 / 360 |
| II | 1.1 | 1.1 | 1.0 | 9,000 | −3,000 | 45 min | 6 | 120 / 320 / 480 |
| III | 1.2 | 1.2 | 1.1 | 9,000 | −3,000 | 42 min | 6 | 150 / 400 / 600 |
| IV | 1.3 | 1.2 | 1.1 | 10,000 | −4,000 | 40 min | 6 | 180 / 480 / 720 |
| V | 1.4 | 1.3 | 1.2 | 10,000 | −4,000 | 38 min | 6 | 210 / 560 / 840 |
| VI | 1.5 | 1.4 | 1.3 | 12,000 | −5,000 | 35 min | 8 | 250 / 660 / 1,000 |
| Galactic (after the finale) | 1.5 | 1.4 | 1.3 | 12,000 | −5,000 | 35 min | 10 | 310 / 840 / 1,250 |

**Mandates** (one signature rule per Charter, shown on its Charter document and in term setup; all values in `tuning.js`, every one exercised by the solver):

| Charter | Mandate | What it changes |
|---|---|---|
| I | **First Crossing Grant:** your first through-the-core route is free (the Homeworld funds it) | the core comes first; it is the tutorial's free crossing |
| II | **Atlantean Trade:** exports from Atlantis cells ×2 | water and Sea Stations become a main export source, not a side trip |
| III | **Heritage Capital:** no new demolition in the Capital (Surface cards and Demolish skip it; a Surface card that would cross it shows "The Capital is protected") | the Capital is served from below, above and around |
| IV | **Frontier Link:** the priority district farthest from your start (always ≥ 90° away) must be linked to the Terminal before Quota I counts | an early long-distance build to a place the seed picks |
| V | **Narrow Yard:** the Terminal's yard holds one departure's load (warp cars × 50; the rest are turned away) and the launch ring fires every 60 s until **Twin Launch Ring** is bought | the ceiling is 300/min until then, so Quota II (560) needs Twin Launch: deep space tech matters early |
| VI | **two mandates**, dealt by the term seed from II–V | each Charter VI term plays differently |
| Galactic | two dealt mandates, as VI | |

- **Quota rule:** Quota I = 25% of Quota III, Quota II ≈ 67%. Charter I's Quota I (90) sits under one through-the-core route (its shafts carry 169/min with 2 trains; its Core Exchanges transfer 360/min) and under an ordinary interchange (120/min), so the tutorial network can meet it without upgrades.
- **Crust limit** is a depth below the 100 surface at the chord's deepest point. **Earth chords also never go below core radius + 2 (37).** Max angle = 2·acos(max(100 − limit, 37)/100): crust 25 → 83° (Deep Bore 40 → 106°); Spires 30 → 91° (45 → 113°); Rift 15 → 64° (30 → 91°). Between an earth chord's floor and the core is the **mantle**; only shafts pass through it to the core.
- **Throughput ceiling** = warp cars × 50 × departures per window (2 base, 3 with Twin Launch Ring). Base 600/min (Charter VI 800, Galactic 1,000). Reachable (Warp Consists + Twin Launch Ring) = (base + 2) × 50 × 3: 1,200/min (Charter VI 1,500; Galactic 1,800). Under the Narrow Yard (1 departure per window until Twin Launch Ring) the ceiling is warp cars × 50: 300/min in Charter V (400 in VI, 500 in Galactic), above every Quota I (210, 250, 310) and below every Quota II, and the reachable ceiling is unchanged.
- **70% rule:** every Quota III ≤ 70% of the reachable ceiling: I 30%, II 40%, III 50%, IV 60%, V 70%, VI 67%, Galactic 69%. Charter I's 360 also fits under the base ceiling (600), so Charter I needs no deep space tech.
- **Free play** (after the finale): any unlocked region with any Commended Charter's numbers, no Audit deadline, no Merits.

### Time and disasters per Charter

| Charter | First disaster | Mean gap (after Quota II) | Types in the pool |
|---|---|---|---|
| I | 12 min (after the tutorial) | 5 min (4) | Blackout, Meteor Shower, Cave-in |
| II | 8 | 5 (4) | + Seaquake |
| III | 7 | 4.5 (3.5) | + Core Flare |
| IV | 6 | 4.5 (3.5) | + Solar Storm |
| V | 5 | 4 (3) | all + Warp Drift |
| VI and Galactic | 4 | 3.5 (2.5) | all |

Gaps jitter ±40% (rolled into the unit gaps at pre-roll). Where each disaster strikes depends on its home region (Disasters).

### Balance: what each train is best at (worked from the numbers above, Charter I, in a region with demolition ×1.0 (the Capital, the Ringside); build cost without the trains a card adds)

| Trip | Surface | Earth | Other | Best |
|---|---|---|---|---|
| 4 cells (60 u), density 2 | $1,780 · 28 s · carries ~150 | $2,600 · 38 s · ~170 | Sky (peaks) $920 · 23 s · ~95 | Surface (Sky if peaks and light flow) |
| 4 cells, density 4–5 | $3,580–4,780 | $2,600 | — | Earth |
| 83° (145 u), mixed density | ~$4,500 + lost demand · 56 s | $4,800 · 74 s | — | close: Surface if cheap blocks, Earth under dense ones |
| 150°+ to the far side | ~$8,800 + 21 lost blocks · 105 s | impossible | **Through the core** ~$4,700 + trains · 85 s · carries 169; Space ~$7,400 · 71 s · ~350 (equator only) | Core; Space late, near the equator |
| Atlantis | impossible | impossible | Water $1,500–2,000 | Water |
| The Flats, 4 cells, density 4–5 (×1.8) | $5,820–7,980 | $2,600 | — | Earth, always |
| From the Rift, 80°+ away | — | impossible beyond 64° | **Through the core** with a $450 Rift Core Exchange and a 240/min shaft at that end | Core |

Targets the harness checks: no single type carries more than 60% of track in the solver's runs; every Charter's recorded solution uses at least 3 train types; Quota I by ~8–12 min, Quota II by ~20 min, Quota III by ~30–40 min; **no stretch longer than 3 min of game time where the solver can afford nothing on its candidate list** (no "fast-forward and wait" gaps).

**Quick sweep (`tools/solve.mjs --sweep`):** besides the six full recorded solutions, every Charter × starting region pair (6 × 6 = 36, each with its mandate) on 2 fixed term seeds (72 runs), with a short lookahead (1 min instead of 3, top 3 clusters instead of 5; ≤ 20 s of real time a run). It prints a table of Quota I / II / III times, the longest idle gap and type shares per run, and fails if any run misses Quota III before its deadline + Overtime or has an idle gap over 3 min. Pairs that need Overtime are listed for tuning.

## Controls

Landscape on phones (a management game around a globe needs the width): a "turn your phone" overlay in portrait and landscape in the manifest.

**Camera:** orbit camera around the globe, from whole planet to district. Tilt follows zoom automatically (straight down at planet zoom, tilted toward the horizon when close). Selecting something flies the camera to it. Camera and UI animations run on **render time**, never on game time.

| Action | Keyboard and mouse | Touch |
|---|---|---|
| Spin the globe | left-drag on empty space, or arrow keys / WASD (5° per press) | one-finger drag |
| Zoom | mouse wheel, or + / − | pinch |
| Tilt (manual) | right-drag, or Q / E | automatic with zoom (no two-finger tilt, so it never fights pinch) |
| Select (station, line, cell) | left-click | tap |
| **Build a route** | Route tool (R, the default): click A, click B, pick a card (click again or Enter) | tap A, tap B, tap a card to preview, tap again (or Build) |
| Card details | click the card's expand arrow, or Tab | tap the expand arrow |
| Pick a far place from a list | Places (/) | the Places button |
| Place a station by hand | Station tool (B, or More menu), pick a kind, click a lit cell | More menu (or long-press Route) → Station |
| Add or remove trains | select a line, + / − | the same |
| **Ride a train** | select a line, C (any input exits) | Ride in the line panel (tap exits) |
| Demolish | X, click a cell or drag across cells | tap the tool, tap a cell, or tap start and end |
| Green | G, pick, click a cleared cell | the same |
| Disaster: Brace / Reroute | buttons on the banner (or 1 / 2 while it shows) | banner buttons |
| X-ray | V | X-ray button |
| Flow overlay | O | Flow button |
| Layer filter | Shift+1 to 7 toggle each layer | layer chips (in the X-ray bar) |
| Tech tree | T | Tech |
| Milestones | K | the milestone chips |
| Game speed | Space pause/resume; F cycles 1x / 2x / 4x | **pause button** and speed button (both in the top bar) |
| Undo (10 s) | Ctrl+Z / U | the Undo toast button |
| Cancel the current tool or selection | Esc or right-click | the X on the tool banner |
| Pause menu | Esc with nothing active, or P | the menu button |
| Mute | M | button in the pause menu and on the title |

**Picking** (one function for mouse and touch), in order: HUD element → station markers within 24 px of the tap (projected to screen) → ley-rail sample points (the same path samples the rails are drawn from) of the visible layers within 16 px → the cell under the ray (ray-sphere). **Occlusion:** a station marker or rail sample is pickable only if the camera ray reaches it before hitting the ground sphere (radius 100; radius 94, the sea floor, for water rail samples and Sea Stations, so the see-through sea never blocks them). Sky arcs, elevator cables and the ring beyond the limb still count, because the ray reaches them first; far-side samples never steal a tap. In X-ray only the clipped-in layers (earth bores and shafts, the core, fire rails) skip the test, and only the shown layers are pickable; the far-side station markers the Route tool shows after the first tap are drawn and picked as HUD markers. `project()` (Debug hook) uses the same visible rule for cells, stations and rail samples. A cell with a multi-layer interchange opens the interchange panel with one tab per layer. Every line and station is also in the Places list, so nothing needs a precise tap.

**Staged toolbar (all platforms):** a first-time player sees only **Route** and **Places**. The tutorial adds Flow (step 2), X-ray (step 3), Demolish and Green (step 5), Tech (step 8), and More (Station, layer filter; at the end). Skipping the tutorial, or any later term, shows the full toolbar.

**Phone layout (844×390 and up):**
- Bottom toolbar (full): Route, Demolish, Green, Tech, X-ray, Flow, Places, More: 8 buttons of 56×56 px inside the safe area. Top bar: money (and per minute), Throughput meter with the next Quota, Audit timer, pause, speed, menu.
- **Side column:** route cards and every selection panel open in a **right-hand column ~38% of the width, full height**, and the **bottom toolbar hides** while it is open. The camera frames the highlighted path (or selection) in the **left 60%**. Phone cards show icon, cost and "carries N/min" (plus the exports line when true); details expand within the column.
- **Snap and confirm:** when a tool needs a cell, the tap snaps to the nearest valid target within 40 px and shows a ghost with a ✓ button. If nothing valid is within 40 px, the camera zooms toward the tap.
- Milestones collapse to 3 small chips (top right); dispatches to one chip (left) that expands on tap. Nothing sits in the middle of the screen.

## Structure and difficulty

**One planet, a ladder of six Homeworld Charters.** The geography of Oikumene never changes; each term is played under a Charter (a difficulty tier: Tuning: Charters) from a starting region. Every type is available from Charter I except water and space (by tech there, or native from the start when you start in the Brine or the Ringside); later Charters and regions **deepen** types rather than introduce them, and each Charter's mandate changes what you build first (Tuning: Charters). Commending a Charter (meeting its Quota III) unlocks the next Charter and a new starting region. Any Charter can be played from any unlocked region, and replayed for better grades.

| Charter | Native types | Disasters added | Commending it unlocks |
|---|---|---|---|
| I | surface, sky, earth, fire, deep space (water and space by tech) | Blackout, Meteor Shower, Cave-in | Charter II + start in **the Brine** |
| II | + water | + Seaquake | Charter III + start in **the Rift** |
| III | as II | + Core Flare | Charter IV + start in **the Spires** |
| IV | + space | + Solar Storm | Charter V + start in **the Flats** |
| V | all | + Warp Drift | Charter VI + start in **the Ringside** |
| VI | all | all, more often | **the finale**, then the Galactic charter and free play |

| Starting region | Available from | What starting there teaches |
|---|---|---|
| **The Capital** | Charter I (the tutorial) | the basics; dense blocks (dig under them); the first core crossing (160° to the Terminal) |
| **The Brine** | Commending I | coasts, piers and Atlantis: water is native when you start here and becomes essential (an island start, 112° to the Terminal) |
| **The Rift** | Commending II | the core is the main highway: earth chords stop at 64°, but the Rift rule makes Core Exchanges half price and shafts ×1.5 speed; Core Flares erupt here |
| **The Spires** | Commending III | sky networks between 22 peaks; deep crust lets earth reach 91° |
| **The Flats** | Commending IV | go under and around rather than through (demolition ×1.8, no peaks; 128° to the Terminal) |
| **The Ringside** | Commending V | the orbital ring: Space Elevators are native when you start here, 150° along the equator from the Terminal, so an elevator is the natural first big build |

**The finale:** Commending Charter VI. The Homeworld answers: every line pulses, a beam from the Warp Terminal reaches the galactic core, and the Warp Conductor's last dispatch finally says where the trains go, over the finale picture; then the credits. You never travel to the Homeworld. After it, the **Galactic** charter and **free play** remain.

**Within a term:** Quota I gentle (~8–12 min), Quota II needs a planet-spanning network (~20 min), Quota III needs everything working at once (~30–40 min).

**The tutorial (Charter I, starting in the Capital, first term on a fixed term seed; about 12 minutes; skippable; replayable from How to Play).** Juno guides each step and highlights the control. Times are game time at 1x.

**First terms:** while the tutorial isn't done, **New Term goes straight into the tutorial** in the Capital under Charter I: no Charter board, no term setup (Skip drops you into the same term with the full toolbar). Until Charter I is first Commended, New Term starts Charter I in the Capital (term setup shows, the Charter board doesn't, since there is nothing else to pick). **The Charter board first appears from the Charter I Commended screen** (its Continue button), and from then on New Term opens it.

| Step | What happens | About |
|---|---|---|
| 1 | Tap the highlighted **density-2 edge district next to the Capital**, then a density-2 district 4 cells away. Cards: Surface ($1,780 + trains, 4 blocks, **Cheapest**) vs Earth ($2,600 + trains). Pick Surface. Juno, pointing at the Earth card: "Under dense blocks, dig. Remember that." | 0:00–1:30 |
| 2 | Add a train to the line; the **Flow** button appears; see the load. | 1:30–2:30 |
| 3 | "The Warp Terminal is on the far side of the planet." Tap your first station, then the Terminal (Places list). Cards: Surface ($9,000+, 22 blocks), Earth (greyed: "~160° apart; the crust allows 83°"), Space (locked), **Through the core: FREE · carries 169/min · +34 exports/min to the Terminal** (Charter I's mandate: the Homeworld funds your first crossing). Pick it. **The first-crossing cinematic plays (reached at about 5:00).** | 2:30–5:00 |
| 4 | Exports stream to the Terminal; the first deep space train launches. | 5:00–6:00 |
| 5 | Demolish and Green appear: plant a park on the cleared corridor. | 6:00–7:00 |
| 6 | Connect the Capital (its centre is 3 cells from your first station): tap it, then your first station. Cards: Surface (~$3,200, demolishes dense blocks) vs **Earth** (~$2,400, **Cheapest**). Juno: "Dense? Dig." Pick Earth. | 7:00–8:30 |
| 7 | Build the peak-to-peak Sky line next to the Capital (its Sky Port joins the district below by a walkway). | 8:30–10:00 |
| 8 | Tech appears. Juno points up at the orbital ring ("Space Elevators, one day") and at an Atlantis dome in the Brine's northern bay ("Sea Stations in the Tech tree reach them"). | 10:00–10:30 |
| 9 | Meet **Quota I (90/min)**. Juno: "You're on your own now." Tutorial done. | ~11–12 min |

The tutorial network makes about 110 exports/min (two density-2 stations ~34, the Terminal's own catchment ~18, the Capital ~38, the Sky Ports ~20); the busiest transfer (feeders onto shaft A at the first station) is ~80/min of 120. `tools/solve.mjs` replays the tutorial script and checks Quota I by 12 min.

**Avoiding frustration:**
- Audit deadline 45 min in Charter I down to 35 in Charter VI (game time), with fast-forward.
- Debt is allowed to the Charter's limit; bankruptcy only after 60 s below it, with a warning, so you can sell trains (75% refund) or close a line.
- Every action shows its price first; **Undo** reverses the last build within 10 s: full refund, demolished cells' buildings **rise back** (their demand returns), lines and stations removed; fares and exports already delivered in those seconds are kept. Undo is not offered once a disaster has hit what was built.
- Disasters drop the speed to 1x, offer Show me, Brace, Reroute and Repair all.
- Juno hints when something has been wrong for 60 s (a full interchange, an unserved Atlantis, a station with no link to the Terminal, Throughput limited by the Warp ring).
- **Overtime:** if the deadline passes before Quota III, the term continues for up to 15 more minutes. The deadline star is lost; Commending in Overtime still earns its Merits minus 1 (and still unlocks the next Charter).
- The Term over screen offers **Retry this term** (same term seed) as well as a new term.

## Win, lose and progress

- **A Charter is Commended** when Throughput (window (t − 60, t]) is at or above its Quota III at **two deep space departures in a row**; the term may continue to the deadline for grade stars. Quotas I and II are met the same way and each pays a cash bonus ($2,000 × the Charter's price multiplier).
- **Grade (3 stars):** Quota III before the deadline; **Efficiency** (more money at the end than at the start); **Greenery** (Greenery score ≥ 8% of city cells; score = parks + 0.5 × groves + 3 × attractions).
- **Losing:** bankruptcy, or Overtime running out. You keep the Merits earned.
- **Winning the game:** Commend Charter VI. The Homeworld answers: every line pulses, a beam from the Warp Terminal reaches the galactic core, the Warp Conductor's last dispatch finally says where the trains go, over the finale picture; then the credits. The Homeworld is never visited or shown as a place. After that every Charter stays playable for better grades, the **Galactic** charter opens (quotas 310 / 840 / 1,250), and **free play** (no deadline) is available.
- **Saved:** the term in progress (a full sim snapshot every 30 s of play, when paused and when the tab hides), Merits, unlocks, Commended Charters, unlocked regions, best grades per Charter, settings, tutorial done.

## Story: dispatches from beyond the warp

Each returning deep space train brings a **dispatch**: two or three lines from somewhere you'll never see, on a small card with a portrait that slides in at the left (fades after 8 s; on phones it lands as a chip). They're the story: a light, funny, slightly melancholy picture of a galaxy run on throughput. Picked from the dispatch stream of the term seed. Neither the Homeworld nor any far end of the warp is ever shown: they are voices.

- **Dispatcher Juno Brasswick**, an ATA dispatcher and your cheerful assistant: tutorial, hints, disaster warnings.
- **Auditor Ossian Thrumm**, Homeworld Office of Throughput: dry, exacting, secretly fond of you. Quotas, the deadline, the grade.
- **The Warp Conductor**, a mysterious voice who rides the deep space trains: the dispatches (a planet of gardens that wants to know what a "building" is; a world where all the trains run backwards; a station at the galaxy's edge where one passenger has waited a thousand years).

About 60 dispatches (10 per Charter), plus quota and finale lines. Charter VI's build toward the finale, where the Conductor finally says where the trains go.

## Screens

All menus and panels are HTML over the 3D canvas.

- **Loading:** the key art cycling (mock-globe, then the five layer scenes, 4 s each with a slow pan) with a progress bar while models load; when ready it **crossfades (0.8 s) to the live title globe**.
- **Title:** Oikumene in front of the galactic core (the Homeworld a bright point at its heart), its lines glowing, under the **attract camera**; the logo: **"ATA"** large in Orbitron with "Arcane Transit Authority" beneath. Continue (when a term exists), New Term, Merit Office, How to Play, Settings, Credits; mute.
- **Charter board** (first shown from the Charter I Commended screen): the live planet in the centre with the six starting regions outlined (locked regions dimmed, unlocked ones tappable: the **region picker**, also as a list; the Far Wards shaded as "not a starting region"), and the Charters I–VI (then Galactic and Free play) around it as **stamped documents** that state their mandate: locked ones sealed, the current one open, Commended ones stamped with their best stars. Pick a Charter and a region, then Start.
- **Term setup** (skipped for the tutorial): the Charter's mandate (two in VI), the priority districts on the globe, the three dealt milestone cards (reroll if owned), starting perk choice, and a glance at the inherited network.
- **In play:** the globe; top bar (money and per minute, Throughput meter with the next Quota marked, Audit timer, pause, speed, menu); bottom toolbar (staged); milestone chips (top right); route cards and selection panel (right column on desktop and phones); dispatches (left); disaster banners (top centre).
- **Throughput breakdown:** a small panel from the meter (made / reaching / launched, the bottleneck, Show me).
- **Places list:** stations, peaks, Atlantis cells, priority districts, the Terminal; tap to fly there or to use as route end A/B.
- **Tech tree:** full screen (above).
- **Pause:** Resume, How to Play, Settings, Save and Quit, Abandon Term; attract camera after 10 s.
- **Quota met:** banner and a short Auditor dispatch.
- **Charter Commended:** the planet lights up; the Charter document gets its stamp; grade, stars, Merits, milestones, what unlocked (next Charter, new region), Continue (to the Charter board).
- **Term over:** why (bankrupt, or Overtime ended), what you achieved, Merits, **Retry this term**, New term, and Charter board (once Charter I has been Commended).
- **Victory:** the finale (beam to the galactic core, finale picture + the Conductor's closing dispatch), then credits.
- **Merit Office:** your Merits; tabs Milestones, Perks, Liveries; each with price and Buy; code SVG icons in chrome frames.
- **How to Play:** 8 pages (camera, route cards, the seven trains, interchanges and the core, flow and bottlenecks, demolish and green, Charters, mandates, quotas and grades, disasters). Four pages have a **key-art header** (seven trains: mock-sky; interchanges and the core: mock-xray; flow: mock-ring; demolish and green: mock-surface; plus mock-atlantis on the seven trains page's water section), and every page has **in-game screenshots** taken during the build; Replay Tutorial.
- **Settings:** music and sound volumes, mute, graphics quality (Low / High; Low is the default on phones), screen shake, hints, reset progress (confirm).
- **Credits:** the idea by Rich Conlan; made with gamegen; font licences; three.js (MIT).

## Juice

Must-haves are marked ★.

- ★ The ley-rail **grows** from A to B over about a second (`setDrawRange`), a bright spark drawing it, with a rising whoosh (surface: the chrome beam and sleepers slide in behind the spark; sky: ring pylons pop into place along the arc; earth: the bore grinds open in X-ray); the first train **glides** out (cars follow the lead car along the curve, each a beat behind), already wrapped in its element effect.
- ★ Demolition: buildings in the cleared cells **sink** with dust puffs and a rumble; the cost ticks down.
- ★ **Money pop-ups** rise from stations as trips complete (at most 3 a second on screen).
- ★ **Through the core, first time:** the camera swoops into X-ray, follows the train down its green-crystal bore, hands over at the Core Exchange to the fire train swimming the red-orange ley-rail through the open lava, and back up the far side, a core-dive whoosh and **its own core-crossing sting**, then a dispatch from Juno.
- ★ **Quota met:** a short beam from the Warp Terminal toward the galactic core (only the finale's beam reaches it); the meter flashes; quota sting.
- ★ **Charter Commended:** a stamp slams onto the Charter document; every line pulses in sequence around the globe, fireworks over the cities, the camera pulls back to the planet against the galaxy; fanfare.
- **The finale (Charter VI Commended):** every line pulses in one wave from the Warp Terminal outward, the beam climbs from the Terminal all the way to the bright point of the Homeworld at the galactic core, the core flares white, then the finale picture with the Conductor's last dispatch.
- ★ **Deep space departure:** the Terminal's ring spins up, the train streaks out and vanishes in a magenta flash; it returns with a sparkle trail and the dispatch.
- ★ **Ride** a train: the chase camera dives into shafts and along the sea floor with X-ray switching itself on.
- ★ Every action has a sound (Audio direction), and the flow overlay and crowd rings make the network's state visible at a glance.
- ★ **Each train wears its element in motion**: surface lightning arcs between cars and along the rail's seam; sky wind ribbons spiralling round it; water a bubble of swirling water with trailing bubbles; earth rock dust and sparks at portals; fire embers and a lava wake; space trailing stars; deep space warp sparks (Art direction: the seven trains).
- Smokestacks puff on industrial blocks; unserved districts' lights flicker; crowded stations pulse rose; interchange rings fill.
- Parks **bloom** (trees pop up with a bounce, the cell turns green).
- Disasters: meteors streak; the sea ripples; the core flares; the ring crackles; a district goes dark; a **gentle screen shake** on hits (Settings can turn it off). Brace shows a shimmering shield over the target (with its own shimmer sound); Reroute dims the closed line with a switch-clunk.
- Milestone cards **flip** with a shine.
- The night side glows with city lights; line colours read clearly on it.
- Eased camera flights.

## Art direction

### Style and prompts

- **Wording:** call them **elemental trains** (advanced machines), never "magical"; "arcane" is the flavour of the technology (the Authority, ley-rails of arcane energy, the warp). The tagline is the line under the title.
- **Direction:** the trains are **elemental trains: advanced machines built around their elements (arcane engineering), fused with cyberpunk technology (not creatures)**, and the whole world leans **a bit cyberpunk**: a dense neon megacity at night, chrome and gunmetal, cables and conduits, holographic shapes, wet reflective streets, rose and deep-teal haze (kept off the train colours). It stays playful and readable (a game you want to look at), not grim.
- **Style line (mock and key-art pictures only):** "Stylised glossy 3D render, a neon-lit cyberpunk megacity with a playful fantasy edge, chrome and gunmetal megastructures, glowing conduits and cables, holographic light shapes, wet reflective surfaces, deep indigo night with rose and deep-teal haze, crisp readable silhouettes, no text, no letters."
- **Style anchor (made):** `design/art/style-anchor.png` (moved out of game/: not shipped): the **fire train**: a sleek articulated train of obsidian armour with glowing lava channels, windows full of molten magma, a smooth roof, embers, on plain dark charcoal (imagegen2 `gpt-image-2.6-flare`, `--quality medium`, 1536×1024). Passed as a reference to every other picture.
- **The seven trains (one look each, used for concepts, models and code effects).** Each is an **elemental train, an advanced machine, not a creature**: a sleek streamlined nose and windscreen, linked capsule cars on flexible joints (so it bends smoothly along its rail's curves), smooth rounded roofs with **nothing sticking up** (no spikes, fins or vanes), and its element shown through materials, windows, light and effects. **No heads, eyes, mouths, teeth, tails or wings.** Each has one colour that names its element at a glance. Each train carries its own element's protection and rides its ley-rail straight through its environment, so the code effect below is part of the train's look whenever it moves.

| Train | Colour | Look | What it rides | Code effects in game (its look in motion) |
|---|---|---|---|---|
| Surface (lightning, the city) | yellow `#ffc23d` | gunmetal maglev, yellow neon strips, windows of crackling electric light, coil rings at the joints | a chrome maglev rail with a glowing yellow seam, in the demolished corridor | small lightning arcs between cars and down to the seam |
| Sky (wind) | white and ice-cyan `#4fe3ff` | pearl-white body, ice-cyan neon edges, turbine rings at the joints | a ley-rail of light arcing between peaks, floating ring pylons every ~8 units | glowing ribbons of wind and cloud spiralling round it (it rides on them) |
| Water | deep blue `#2f6bff` | navy hull, blue portholes and strips | a blue ley-rail on the sea floor, over coral, past Atlantis domes | a bubble of swirling water round each car (one stretched capsule per car, overlapping into one), trailing bubbles |
| Earth | emerald green `#2fd67b` | grey granite and slate armour, green crystal drill nose, green crystals set in the sides | its own bore: rough rock lined with green crystal, a glowing seam along its floor (X-ray) | rock dust and sparks at portals and at the drill nose |
| Fire | red-orange `#ff5a1f` (the anchor) | obsidian armour, lava channels between panels, windows full of molten magma | a red-orange ley-rail through open lava in the core | heat shimmer, drifting embers, a glowing lava wake |
| Space | violet `#9b6bff` | dark glass panels full of stars and nebula, violet rings at the joints | the orbital ring (chrome, with the violet ley-rail on it) | trailing star sparkles |
| Deep space | magenta `#ff3fb4` | matte black like a hole in space, magenta rift light in its panels and windows, the last car dissolving into warp sparks (no halo: the Warp Terminal has the ring) | no rail: it warps from the Warp Terminal's launch ring | warp sparks, the magenta flash |

- **The places (concepts made, one per model; each in its type colour):**

| Place | Look |
|---|---|
| Surface station (also the Bore station base) | a gunmetal-and-chrome pavilion with golden-yellow `#ffc23d` neon trim, open portals at its sides where the rails enter |
| Sky Port | a chrome saucer tower with ice-cyan trim, built to sit on a bare peak |
| Sea Station | a deep-blue `#2f6bff` glass-and-chrome dome with a blue light ring at its base |
| Core Exchange | an obsidian drum with red-orange lava seams, an emerald-crystal bore collar on top (where the shaft arrives) and open portals at its sides |
| Warp Terminal base | a stepped launch platform with chrome pylons and magenta trim (the launch ring is code) |
| Ring Station / elevator head | a violet-trimmed chrome station clamped round the cable |
| Giant Wheel base | a chrome A-frame and hub with warm-white lights (the rim is code) |
| Monument to the Engineers | a dark obelisk wound by a spiral of light in the seven type colours, a tribute to the network (the one world object allowed the type colours) |

- **Template A, concept pictures** (imagegen2 `gpt-image-2.6-flare --quality medium`, 1536×1024 for trains, 1024×1024 for places, anchor as reference image): "<subject from the table>, a single object, complete and centred, three-quarter front view, on a plain dark charcoal background, even soft studio key light, its own glow only from its elemental features and neon lines, no scenery, no text." **The mock pictures are made this way** (glow included, so reviewers see the look; train mocks show the whole consist).
- **Template A′, meshgen inputs:** each accepted mock is re-rendered once as an edit with the mock as reference (about $0.05 each), so the texture isn't baked dark and Meshy models only what the game needs; the glow comes back in code through the emissive masks.
  - **Trains:** "the lead car only, cut cleanly behind the first joint, three-quarter front view, plain light-grey background, even light, glowing parts as flat bright paint, no glow, no scenery." (Trailing cars are code capsules.)
  - **Places:** "the building only, on a flat ground plate, no mountain, clouds, holograms, lightning or docked vehicles, three-quarter view, plain light-grey background, even light, glowing parts as flat bright paint, no glow." The **surface station** re-render (the shared Surface/Bore model) also says "trim and window strips painted neutral white-chrome", so code emissive can light the same trim yellow (surface) or green (Bore).
- **Template B, mock and key art** (nanogen pro, 16:9 2K, anchor as reference): the style line + the scene. Mocks show what the code can really draw: hex tiles with neon street-grid ground, instanced megablock towers, domes, smokestacks and cable bundles, holographic light shapes, **glowing ley-rails in the type colours** (a thin bright line with a soft glow; for surface a chrome maglev beam with a yellow seam; for sky floating ring pylons along the arc), the elemental trains riding them **in the open, wrapped in their element effects** (nothing encloses them), haze and the indigo sky; no detail the build can't make.
- **Template C, portraits** (imagegen2 `gpt-image-2.6-flare --quality medium`, 1024×1024, `--background transparent` (native alpha)): the style line + "head-and-shoulders bust of <look>, facing the camera, plain transparent background, no text." **Juno is made first** (anchor as reference); Thrumm and the Conductor then use the anchor + Juno as references.

| Character | One-line look (cyberpunk lean) |
|---|---|
| Juno Brasswick | cheerful young dispatcher, short asymmetric bob with a streak of cyan, a sleek cream-and-gunmetal jacket with neon piping, a glowing earpiece mic and a small holographic display floating over one wrist |
| Ossian Thrumm | stern older auditor, charcoal high-collared coat with chrome inlays, a glowing cybernetic monocle over one eye, holding a slim data-ledger with faint light lines |
| The Warp Conductor | tall figure in a long midnight-indigo conductor's coat and peaked cap, face hidden in a void-dark shadow with two magenta eyes, holding a lantern that glows with swirling magenta warp light |

### Material language (one look across code, Meshy and 2D)

- `renderer.toneMapping = ACESFilmicToneMapping`, sRGB output. One **PMREM environment map** made at load from a small scene (the code starfield sphere + the galactic core plane), set as `scene.environment` so every chrome surface reflects the same sky.
- meshgen models use `--pbr`. On load, every model material: metalness clamped to ≤ 0.9, roughness ≥ 0.15, `envMapIntensity` 1.0.
- **Emissive masks (per model, at asset time, Pillow):** for each model's base-colour texture, pixels near its accent colour (hue within 20° and saturation > 0.4) → white, everything else → black; saved as a small JPEG `emissiveMap` (same size as the base map). In code `emissive` = the accent colour, intensity 0.8, so only trim and windows glow. Accents: each type station and train → its type colour; Warp Terminal base → magenta; Giant Wheel base → warm white `#ffd9a0`. Two exceptions: the **shared Surface/Bore model**'s mask takes its painted neutral trim (value > 0.85 and saturation < 0.15), and the **Monument**'s mask takes every pixel with saturation > 0.4, its emissive map keeping their own colours (the seven-colour spiral).
- **Shared surface/Bore model:** its trim is neutral white-chrome in the texture; two `InstancedMesh`es on the same geometry, one material with yellow `#ffc23d` emissive (surface), one with emerald green `#2fd67b` (Bore), so the same trim lights in either colour; the Bore one also gets a code **drill collar** (green toothed torus round the base) and the portal arch. **Stacked interchange modules** keep their own type's material and accent.
- Code buildings, ground, ring and portals use `MeshStandardMaterial` with the world palette and the same env map.
- **Trailing cars** are code capsules whose base colour is the lead car texture's average colour (sampled once at load), with the same metal/roughness and the type colour emissive band (livery palette overrides both).
- **Ley-rail material:** one small `ShaderMaterial` per type: additive blending, no depth write, depth test on; a bright **core line** (the type colour lifted ~30% toward white) and a soft **glow ribbon** (the type colour, alpha falling off by a fresnel term toward the edges), with a time uniform for the flow pulses and a per-type uniform for width and brightness (flow overlay). Because it is additive and never sorted, it costs almost nothing. The surface rail's **maglev beam and sleepers** are ordinary chrome `MeshStandardMaterial` (gunmetal sleepers), with only the seam using the ley-rail material. The **earth bore** is a dark rough rock `MeshStandardMaterial` (tex-rock, near `#2a2320`) with instanced green crystal shards and the green seam in ley-rail material.
- **X-ray clip:** one shared shader chunk (`onBeforeCompile` on every world material, Meshy ones included) discards fragments on the camera's side of a **clip plane perpendicular to the view axis**, 40 units in front of the planet centre; the clipped ground is redrawn as a faint fresnel shell (opacity 0.25). Earth bores (chords and shafts), the fire ley-rails, the core and their trains are never clipped.

### Palette (world colours kept off the type colours)

| Use | Colour |
|---|---|
| Night sky indigo | `#141a3a` |
| Chrome | `#c9d2e3` |
| City lights and windows | warm white `#ffd9a0` |
| Cyberpunk neon (signage shapes, haze, street grid) | rose `#ff6f91` and deep teal `#12707a`, always at low intensity (emissive ≤ 0.3, haze opacity ≤ 0.15) so lines stay brightest |
| Gunmetal (megablocks, cables) | `#2b3040` |
| Walkway light strips, X-ray shell edge | pale blue-white `#e3ecf7` |
| Ley-rail glow (rule, not a world colour) | each rail is drawn only in its own type colour (core line lifted toward white, additive glow); the only world parts allowed near a rail are chrome (the surface beam, sky pylons, the ring) and dark rock (the earth bore) |
| Park green | `#7aa84a` |
| Rock (mountains, X-ray interior) | dark brown `#5a4a40` / `#2a2320` |
| Core | deep red `#7a1a0c` with crimson veins (tex-core tinted toward it); fire ley-rails stay bright red-orange on it |
| Sea | deep navy `#0a2c47` (the Brine), shallow coastal cells `#0f3557` |
| Ring structure, sky ring pylons, surface maglev beam | chrome; only the ley-rail on them is in a type colour (violet on the ring, cyan on the pylons, the yellow seam on the beam) |
| Load markers (flow overlay) | pure white `#ffffff` with a dark `#141a3a` outline: used for nothing else |
| Type colours | the seven in the Layers table: network only (and the Monument's spiral) |

**Rules (all checked by `tools/contrast.mjs`, which scans `tuning.js` and `palette.js`):** no world material uses a type hex (the Monument's spiral is the one listed exception) or the load markers' `#ffffff`. **Hue distance:** every saturated world colour (HSV saturation > 0.4) drawn at or above the ground is at least **30° of hue** from each type colour drawn there (all seven except fire, which is only ever drawn inside the core); colours at saturation ≤ 0.4 (chrome, warm white, pale blue, lilac-white, the ground greys) read as tinted whites and greys and pass. Interior colours (the core, X-ray rock) are checked by luminance contrast instead (below). The two neon colours are the other exception: rose (22° from magenta) and deep teal (4° from sky cyan) stay because they are capped at low intensity, and the script checks that cap. Measured now: park green 48° from surface; the Rift's lava `#a3281a` 35° from surface and 43° from deep space. **Contrast check:** every line colour against the backdrop it is drawn on must be ≥ 3:1 (WCAG luminance ratio); `tools/contrast.mjs` prints the table. Worked now: Surface and Sky on every ground ≥ 4.3:1; Water on every sea ≥ 4.9:1; Earth and Fire on the X-ray rock ≥ 5:1; Fire on the core 3.4:1; Space and Deep space on the night sky ≥ 5.4:1. Every ley-rail's core line is lifted toward white, so it reads even where its glow is faint. The flow overlay's load markers are small white rings beside the rail, never the rail itself.

### Per-region look

One planet, one sky (the galactic core plane at a fixed angle, the Homeworld a bright code sprite at its heart). Regions read apart by ground tint, buildings, sea and accent light; borders blend over one cell.

| Region | Ground / hex tint | Building bias | Sea | Accent light |
|---|---|---|---|---|
| The Capital | silver steel `#5a606c` | silver and chrome, the tallest towers | — | warm white `#ffd9a0` |
| The Brine | blue-grey `#3f4d57` on the islands | white enamel, pale-blue windows | deep navy `#0a2c47`, shallows `#0f3557`, many Atlantis domes | pale blue `#b8d4f0` |
| The Spires | slate `#454a56`, snow on peaks | white chrome spires | — | cold white `#e8f0ff` |
| The Rift | basalt `#2e2626` + tex-lava (deep red `#a3281a`) on the ridges | bronze-grey `#5e5248` and basalt | — | deep red `#a3281a` glow from the ridges |
| The Flats | gunmetal `#383c45` | dark chrome factory blocks, lilac-white windows, the most smokestacks | — | lilac-white `#d8d0ff` |
| The Ringside | warm grey `#4a4e58` | chrome, warm-white windows | — | warm white `#ffd9a0`, with the ring's shadow band across it |
| The Far Wards | gunmetal-grey `#40444e` | the ordinary mix | — | warm white `#ffd9a0` |

### What's drawn how

- **The city (code), "pole to pole":** every city hex gets a **street-grid ground texture** (tex-streets: roads, roofs and tiny lit windows, tinted per region; at planet zoom the lights alone read as a continuous city). On it, **block meshes**: 5 shapes (tower cluster, slab block, dome block, spire block, factory block; each region biases the mix), each a merged cluster of 3–6 towers of ~60–100 triangles, footprint 40–60% of a cell's area per block, 1 to 3 blocks per cell by density; window texture (tex-windows) whose lit windows glow at night. About 520 land cells → ~1,100 block instances on Low, ~2,200 on High. **Smokestacks** (instanced cylinders on density ≥ 3 factory blocks) with pooled smoke sprites (60 on Low, 200 on High). Mountains raise the hex with tex-rock and snow on peaks.
- **Atlantis (code):** a translucent glass hemisphere (radius 5, centred on its cell) on the sea floor over small glowing instanced buildings, with a pale-blue rim light; the Sea Station sits at its edge when served.
- **Sea Stations:** one Meshy model (the Sea Station dome). At an Atlantis cell it sits on the sea floor (94) at the glass dome's edge, 5.5 units from the dome's centre; the line's last stretch is a short **spur** from the water rail (which keeps ≥ 6 units from the dome centre) to the station. At a coast it sits on a **code pier** (deck at 100.5, posts down to the sea floor, a ramp to the land cell); the water ley-rail dives from it down to the sea floor, and the cars' water bubbles form as they enter the sea.
- **Ocean (code):** a glossy see-through shell over tex-seafloor on every quality: about 35% opaque facing the camera, rising to ~85% at the fresnel edge, no depth write, so the sea floor, Atlantis domes, Sea Stations, water rails and water trains always show through it (on Low it is the same shell with a cheaper shader: no reflections).
- **Core (code):** a sphere with tex-core flowing (UV scroll), additive glow shell.
- **Ley-rails (code):** every line is drawn along its sampled path (Tech plan: path geometry) as a thin bright **core line** plus a soft **glow ribbon**, both **camera-facing strips** (the ribbon ~0.5 wide, its alpha falling off toward its edges) in the additive ley-rail material. All rails of one type are merged into one geometry (~7 draw calls), rebuilt only when the network changes; a new rail grows with `setDrawRange`. Trains sit on nothing and inside nothing: their element effect is part of their look. Per type:
  - **Surface:** the most literal track: an instanced **chrome maglev beam** (a low rounded box section) with gunmetal **sleepers** every ~1.5 units along the cleared corridor, the yellow ley-rail as a glowing seam along the beam's top. Demolition visibly makes room for it. With Elevated Viaducts the beam stands on chrome piers over the water.
  - **Sky:** the cyan ley-rail arcing between peaks, with small floating **ring pylons** (instanced chrome-and-cyan tori around the rail) every ~8 units; the train rides its wind ribbons along the arc.
  - **Water:** the blue ley-rail on the sea floor, over coral (tex-seafloor) and past Atlantis domes (never closer than 6 units to a dome's centre); each car rides inside its own stretched bubble of swirling water, the bubbles overlapping into one.
  - **Earth:** the train **bores its own tunnel**: a dark rough rock tunnel (radius 0.5) lined with instanced green crystal shards and a glowing green seam along its floor, drawn **only in X-ray** (inside the planet it is never seen otherwise). Shafts and mountain station wells are the same bore, vertical. Portals show at the surface.
  - **Fire:** the red-orange ley-rail through the core's open lava; the train swims through the magma, embers and a lava wake behind it.
  - **Space:** the orbital ring itself (below) with the violet ley-rail on it; up the elevator cables too.
  - **Deep space:** no rail; it launches from the Warp Terminal's ring and warps away.
- **Walkways (code):** short chrome footbridges between linked stations, with a pale blue-white light strip.
- **Orbital ring (code):** a chrome torus (radius 130, cross-section radius 0.6) with a lit segmented track; space lines run as violet ley-rails along it. Until Space Elevators are owned, a **scenic train** circles it (no cargo). The Polar Ring the same on a meridian.
- **Elevator cable (code):** a thin chrome cylinder from station to ring with the violet ley-rail running up it and a capsule climbing it.
- **Bore portals (code):** a dark half-torus arch with green trim where a chord leaves a station; Bore stations also get the drill collar.
- **Core Exchange shaft (code):** an earth bore (as above) running straight down from the Bore station's portal (radius 100) to the Core Exchange, seen in X-ray.
- **X-ray (code):** the clip plane above; earth bores (chords and shafts), the core and the fire ley-rails in its lava show inside.
- **Interchanges:** stacked station modules (60% scale, in a column) + a code capacity ring.
- **Warp Terminal:** a Meshy base and a **code torus launch ring** on it that spins up. **Giant Wheel:** a Meshy base (if made) and a **code wheel rim** that turns. **Tree groves and Fountain Plaza:** code.
- **Sky:** a code **starfield** sphere (3,000 points) + the **galactic core**, a nanogen 21:9 **2K** JPG on a large camera-facing plane far behind the planet, slowly rotating. **The Homeworld** is only a code sprite: a steady white-gold point of light at the core's heart (it brightens a little with each Commended Charter). Deep space trains vanish toward it; nothing beyond the Terminal is ever modelled.
- **Priority districts (code):** a slowly turning chrome holo-diamond with a warm-white glow over the cell.
- **Charter board (code):** the live globe with region outlines (a code line along region borders), Charter documents as HTML cards with a parchment-and-chrome frame and SVG wax-seal stamps.
- **Portraits:** Template C, downscaled to 256 px; framed in round chrome bezels in code.
- **Icons:** code SVG in one rounded-line style (tools, train types, stats, milestone cards, shop items).
- **Fonts:** Orbitron (titles, numbers) and Exo 2 (body), SIL Open Font License, bundled with their licences.
- **Scale:** planet radius 100; a cell ~15 units across; a train car 1.2 units long; a station ~4 units across; the Warp Terminal ~14. Meshy models are made in meters and scaled in code.

### Model post-processing (`tools/shrink_glb.py`, Python + Pillow)

meshgen shrinks only PNG textures and leaves Meshy's JPEGs as they are, so every GLB goes through one step after download: read the GLB's JSON and binary chunk, decode each image, resize (**256 px for trains, 512 px for stations and landmarks**), re-encode as JPEG (quality 82; normal maps 85), write the emissive mask (above), repack the buffer views, and check the result with `meshgen inspect`. **Download budget: all models together ≤ 15 MB** (target ~0.3 MB a train, ~1 MB a station).

## Audio direction

- **Music** (instrumental; every loop played with a 1.5 s crossfade over its own seam in code; track changes crossfade over 2 s):
  - Title and Charter board (90 s): wide, wondrous synthwave pads and strings, slow, "a neon galaxy humming".
  - **Build (240 s)** and **Busy (180 s)**: both prompted **"118 BPM, D major, upbeat synthwave with a bouncy bass and a playful cyberpunk shimmer"**; Busy adds drive and percussion. Busy plays when Quota II is met or 3+ stations are crowded.
  - Disaster bed (30 s, loopable): "118 BPM, D minor, tense pulsing synth"; ends with the all-clear SFX and a crossfade back.
  - Fanfare (15 s): Quota III / Charter Commended. Finale and credits (90 s).
- **Sound effects** (short, punchy; **42 + 2 ambience beds**):
  - UI: click, tool select, cancel, error.
  - Build: place station, rail grow, line confirm, demolish, plant/bloom, train add, interchange upgrade (a layer module locking on) (train remove and Undo play the add and grow sounds reversed in code).
  - Departures (7): surface clack-hum, sky whoosh, water bubble-glide, earth rumble, fire roar-whoosh, space hum-zip, deep space warp zap.
  - Progress: money chime (max 3 a second), tech bought (also Merit Office purchases), milestone flip (also a Charter or region unlocking on the Charter board, and the Commended stamp), quota sting, dispatch blip, **core-crossing sting** (first crossing only; distinct from the quota sting and the fanfare).
  - Disasters: warning siren (also played at 0.7 rate for the bankruptcy warning), meteor impact, seaquake rumble, cave-in crash, core flare roar, solar storm crackle, blackout power-down, warp drift warble, repair clank, all clear, **Brace shield shimmer**, **Reroute** (a switch-clunk as the line closes).
  - Term states: **term-over sting** (bankrupt or Overtime ended), **Overtime chime** (an alarm-ish clock chime when Overtime starts).
  - Big moments: warp ring spin-up, warp return sparkle, fireworks, core dive whoosh.
  - Ambience: city hum (`--loop`, 30 s), louder when zoomed in; a **low sea and core bed** (`--loop`, 30 s, a deep muffled rumble) that crossfades in while riding below the ground radius or in X-ray.
  - **If sound effects must be cut,** merge the disaster hits into two families (impact rumble, energy crackle) first, then the seven departures into three families.
- **Rate rule:** a train departure sound plays only for the first train on a newly built line, for trains on the selected line, and for the ridden train; at most one per second overall; volume by distance to the camera. **Exempt:** the warp ring spin-up and warp zap play once per deep space departure (at most every 20 s).
- **Loudness:** no ffmpeg/sox here, so `audio.js` holds a **per-sound gain table** (one number per file, set by ear during the build, default 1.0; music 0.6).

## Asset list

**Mock** marks pictures shown in the shared design.

| ID | What it is | Tool | Size and format | Transparent | Animation | Priority |
|---|---|---|---|---|---|---|
| anchor-fire-train | Style anchor: the full fire consist on plain dark charcoal (made) (Mock) | imagegen2 flare medium | 1536×1024 PNG | no | — | must (done) |
| concept-train-{surface,sky,water,earth,fire,space,deep} | 7 train concepts, the whole consist with glow (made) (Mock); each re-rendered as its lead car only for meshgen (Template A′) | imagegen2 flare medium, Template A, anchor ref | 1536×1024 PNG | no | — | must (done) |
| concept-{station-surface,skyport,sea-station,core-exchange,warp-base,ring-elevator,wheel-base,monument} | 8 place concepts in their type colours (made) (Mock); each re-rendered as the building only on a ground plate for meshgen (Template A′) | imagegen2 flare medium, Template A, anchor ref | 1024×1024 PNG | no | — | must (done) |
| portrait-juno, portrait-thrumm, portrait-conductor | Characters (Mock) | imagegen2 flare medium, Template C; Juno first, then anchor + Juno refs | 1024×1024 → 256 PNG | yes | — | must |
| mock-globe | Key art: the planet-city with glowing ley-rails in the seven type colours over, under and through it, X-ray cutaway to the core; loading art and app icon source (Mock) | nanogen pro, Template B | 16:9 2K PNG | no | — | must |
| mock-surface | Key art: a district, a chrome maglev rail with a glowing yellow seam laid along a demolished corridor, a yellow surface train crackling with lightning on it, a park beside it (Mock; How to Play header) | nanogen pro, Template B | 16:9 2K | no | — | must |
| mock-atlantis | Key art: Atlantis glass domes on the sea floor, a blue ley-rail running over coral between them, the deep-blue water train riding it inside its own bubble of swirling water, a dome Sea Station on a pier above (Mock; header, loading) | nanogen pro, Template B | 16:9 2K | no | — | must |
| mock-sky | Key art: cyan ley-rails of light arcing between snowy mountain peaks above the city, small floating ring pylons along them, a white-and-cyan sky train riding its wind ribbons, Sky Ports on the peaks (Mock; header, loading) | nanogen pro, Template B | 16:9 2K | no | — | must |
| mock-xray | Key art: X-ray cutaway: faint ground shell, rough rock bores lined with green crystal (a glowing green seam along their floors) running down to the glowing red core, a red-orange ley-rail across it with the fire train swimming through the open lava (Mock; header, loading) | nanogen pro, Template B | 16:9 2K | no | — | must |
| mock-ring | Key art: the chrome orbital ring with its violet ley-rail and violet space trains on it, space elevator cables down to the city, the galactic core behind (Mock; header, loading) | nanogen pro, Template B | 16:9 2K | no | — | must |
| model-train-{7 types} | Lead cars, `--draft --polycount 1500 --pbr --max-texture 256 --height 0.6`, facing +Z; then shrink_glb | meshgen (from concepts) | GLB ≤ 0.3 MB | — | moved along curves in code | must |
| model-station-surface | Surface station; also the Bore base (code collar), `--polycount 4000 --pbr --max-texture 512 --height 4` | meshgen | GLB ≤ 1 MB | — | — | must |
| model-skyport | Sky Port (same flags, `--height 5`) | meshgen | GLB | — | — | must |
| model-sea-station | Sea Station dome (pier in code) (`--height 4`) | meshgen | GLB | — | — | must |
| model-core-exchange | Core Exchange (`--height 4`) | meshgen | GLB | — | glow pulse in code | must |
| model-warp-base | Warp Terminal base (ring is code) (`--height 6`) | meshgen | GLB | — | ring spins (code) | must |
| model-ring-elevator | Ring Station with elevator head (`--height 4`) | meshgen | GLB | — | capsule climbs (code) | must (the Ringside teaches elevators) |
| model-wheel-base | Giant Wheel base (rim is code) (`--height 5`) | meshgen | GLB | — | rim turns (code) | made last from what's left (else code) |
| model-monument | Monument to the Engineers (`--height 5`) | meshgen | GLB | — | — | made last from what's left (else code) |
| bg-galaxy-core | Galactic core painting for the backdrop plane | nanogen pro | 21:9 2K JPG | no | slow rotation (code) | must |
| starfield | Star sphere | code | — | — | twinkle | must |
| tex-windows | Window atlas (lit and unlit) | nanogen flash | 1K, tileable | no | — | must |
| tex-streets | Street-grid ground for city hexes (roads, roofs, lit dots) | nanogen flash | 1K, tileable | no | — | must |
| tex-core | Magma, tileable (tinted deep red in code) | nanogen flash | 1K | no | UV flow (code) | must |
| tex-seafloor | Sea floor, tileable | nanogen flash | 1K | no | — | should |
| tex-rock | Mountain rock, tileable | nanogen flash | 1K | no | — | should |
| tex-lava | The Rift's lava ridges, tileable | nanogen flash | 1K | no | UV flow | should |
| finale-picture | Oikumene from orbit, every line lit, a magenta-white beam from the Warp Terminal reaching the galactic core, the Homeworld only a blinding point of light at its end (finale; the Homeworld itself is never shown) | nanogen pro, Template B | 16:9 2K | no | slow zoom (code) | should |
| emissive masks | One per model | code (Pillow, shrink_glb.py) | JPEG 256/512 | — | — | must |
| app-icon | Crop of mock-globe (the core cutaway) + code frame with "ATA"; manifest short name "Arcane Transit" | code (Pillow) | 512, 192, 180 PNG | no | — | must |
| ui-icons | Tools, types, stats, milestone cards, shop items | code (SVG) | — | — | — | must |
| charter-board | Charter documents (parchment-and-chrome cards), wax-seal stamps, region outlines on the live globe, the Homeworld light sprite | code (HTML/SVG, three.js lines) | — | — | stamp slam, seal break | must |
| logo | "ATA" large in Orbitron with "Arcane Transit Authority" beneath | code (HTML/SVG) | — | — | — | must |
| buildings, smokestacks, Atlantis domes, trees, Fountain Plaza, piers, walkways | City and greenery | code (instanced) | — | — | lights flicker, smoke, sway | must |
| ley-rails (core line + glow ribbon), surface maglev beam and sleepers, sky ring pylons, earth bores and shafts (X-ray), flow load markers (white), priority-district diamonds, mountain station wells, cars, ring, cable, portals, drill collars, X-ray | Network visuals | code | — | — | — | must |
| effects | Train element effects (surface lightning arcs, sky wind ribbons, the water bubbles (one stretched capsule per car) and trailing bubbles, earth dust and sparks, fire embers and lava wake, space star sparkles, deep space warp sparks), demolition dust, smoke, meteors, warp flash, fireworks, brace shield | code (particles, ribbons, an instanced fresnel capsule) | — | — | — | must |
| howto-shots | How to Play screenshots | code (screenshots in the build) | 960×540 JPG | no | — | must |
| music-title / build / busy / disaster / fanfare / finale | 90 / 240 / 180 / 30 / 15 / 90 s | audiogen music | MP3 | — | loop (code crossfade) | must / must / should / should / must / should |
| sfx-* | 42 effects listed in Audio direction | audiogen sfx | MP3 | — | — | must (UI, build, departures, quota, core-crossing, siren, term-over, Brace, Reroute); should (rest) |
| amb-city, amb-deep | City hum; low sea and core bed | audiogen sfx `--loop` | MP3 30 s each | — | loop | should |
| social-card, github-social | Link previews | code (screenshot) | 1200×630 JPG, 1280×640 PNG | — | — | must |

## Tech plan

- **Files:** `game/index.html` (canvas, HTML HUD and menus, import map), `game/src/`:
  - **Pure sim (no DOM, no three.js; Node-importable):** `rng.js` (mulberry32 streams), `tuning.js`, `palette.js`, `planet.js` (geodesic grid; Oikumene's fixed terrain and regions read from the frozen cell table in `tuning.js`; the term's density nudges, priority districts and inherited network from the term seed; a geography hash of the table), `network.js` (stations, walkways, interchanges, lines, components, path sampling), `routes.js` (route cards, carries and exports numbers; also builds inherited networks and applies mandates), `paths.js` (expanded graph, Dijkstra + penalty alternatives), `sim.js` (demand, assignment, money, Throughput, bottleneck), `disasters.js`, `tech.js`, `milestones.js`, `snapshot.js` (save/load the full sim).
  - **Browser:** `main.js` (boot, loop, screens), `city.js`, `render-net.js` (ley-rails, surface beam and sleepers, sky pylons, earth bores, trains and their element effects, flow load markers, ring, portals, walkways), `xray.js` (shared clip chunk), `camera.js` (orbit, flights, follow-path: first crossing, Ride, attract), `input.js` (picking, gestures, keys), `ui.js`, `story.js` (dispatches, tutorial, toolbar staging), `meta.js`, `audio.js` (gain table), `save.js`, `debug.js`.
  - `tools/solve.mjs` (Node): plays a Charter from a starting region with the greedy strategy below, prints quota times, money curve, idle gaps and type shares, and writes `design/solutions/charter-<n>.json`; `--sweep` runs the quick sweep (Balance). `tools/oikumene.mjs` (builds and checks the map, prints per-area counts, writes the frozen cell table into `tuning.js`; see The regions). `tools/contrast.mjs` (palette rules: type hexes, the load-marker white, hue distance, neon caps, contrast). `tools/shrink_glb.py` (model textures and emissive masks).
  - `game/vendor/`: three.js r186 from meshgen with LICENSE and the four addons.
- **Loop and determinism:** fixed update 1/30 s of game time. A **real-time accumulator** drives it: each frame adds `realDelta × speed × 30` updates' worth of time (1x = 30 updates per real second, 2x = 60, 4x = 120), runs whole updates, and **caps at 8 updates per frame** (a slow device runs the game slower rather than stepping differently). The sim ticks every 30 updates. Determinism depends only on the update count and the actions. Camera and UI animations run on render time. Pauses when the tab is hidden. The geography uses its own fixed map seed (never the term seed). Separate term streams (mulberry32, seeded from hash(term seed, name)): `term` (density nudges, priority districts, Charter VI's dealt mandates, inherited network), `milestones`, `disasters`, `dispatches`, `cosmetic`. No `Math.random` outside `cosmetic`, and nothing cosmetic feeds the sim.
- **Path geometry** (so ley-rails and trains never clip; the same samples drive the drawn rail, the trains, Ride and picking), all as dense sample points about 1 unit apart:
  - Surface: A* over land cells (cost = track + demolition + 20% of the cell's lost fares for 10 min), then the cell-centre polyline is corner-rounded by Chaikin cuts at 25% (cut points stay within 3.75 units of a centre, inside the cell's 7.5 inradius), slerped on the sphere at ground radius + 1. The demolished set is exactly the path's cells.
  - Sky: slerp between peaks at the sky-arc radius (Heights table).
  - Water: A* over ocean cells; slerp at 94.8; at a pier the ley-rail ramps from the deck (100.5) down to 94.8 with a smoothstep. Through or past an Atlantis cell the path bends round the dome: any sample closer than 6 units (measured along the sea floor) to a dome centre is pushed out to 6 (the cell's inradius is 7.5, so it stays in the cell), then the polyline is re-smoothed; a line ending at an Atlantis Sea Station leaves the rail with a straight spur to the station at the dome's edge.
  - Earth: the straight chord between portals (radius 100, under each station; the one earth rule); valid if its deepest point is ≥ max(100 − crust limit, core radius + 2). A mountain station adds its station well (station to portal), drawn but not part of the line.
  - Shaft: straight radial from the Bore station's portal (radius 100) to the Core Exchange (37): 63 units.
  - Fire: the chord between two Core Exchanges at least 60° apart (so it passes inside the core).
  - Space: the ring arc between Ring Stations; elevators are straight leaning segments.
  - Walkways: a short arc between the two station positions at ground radius + 1.5.
  - **Shared corridors:** lines sharing consecutive cells get lateral slots 1.2 units apart (centred). Sky arcs between nearby peaks add 3 units of h per existing arc.
  - **Chord clearance:** a new chord or shaft within 1.2 units of an existing one moves its portal to the station's next portal slot (up to 4 slots, 1.5 units apart); if none clears, the card shows "Too close to the <line>". Fire chords may cross inside the core (drawn additive, no depth write).
- **Rendering and performance:**
  - City: ~6 `InstancedMesh`es of block meshes (~1,100 instances on Low, ~2,200 on High) over per-hex street-textured ground (one merged mesh). Lights flicker via a time uniform in the shader.
  - **Ley-rails:** per type, the core line and glow ribbon (camera-facing strips) along the path samples, merged into **one geometry per type (~7 draw calls)** in the additive fresnel ley-rail material, rebuilt on network change; growth via `setDrawRange`. Width, brightness and pulse speed are per-type uniforms plus a per-vertex load attribute (flow overlay); load markers are one `InstancedMesh` of small rings. Extras: the surface maglev beam and sleepers (2 `InstancedMesh`es along the corridors), sky ring pylons (1 `InstancedMesh` of tori), earth bores and station wells (1 merged dark rock tunnel geometry, radius 0.5, drawn only in X-ray, + 1 `InstancedMesh` of green crystal shards). About 13 draw calls for the whole network's track. No translucent sorting or overdraw problem: the glow is additive without depth write, the bores and beams are opaque.
  - **Train element effects:** pooled and instanced per type (lightning arcs as short line segments, wind ribbons as trail strips, the water bubble as one instanced fresnel capsule per water car, stretched along the car, embers, dust, stars and warp sparks as pooled points); effects are drawn only within district zoom or while riding, and as a simple glow beyond it.
  - Trains: one `InstancedMesh` per type for lead cars + one for all trailing capsules. Lead car models only within district zoom (camera distance < 160) or while riding; beyond it, lead cars are capsules too.
  - Stations: one `InstancedMesh` per station model and material (GLB primitives merged per material with `BufferGeometryUtils`); beyond camera distance 160 they draw as glowing code pins.
  - Ocean: the see-through fresnel shell on every quality (one draw call; no reflections on Low); no shadows on Low; pixel ratio capped at 2 (1.5 on Low).
  - **Budgets at end state, checked by `__game.perf()`, measured at two named camera distances (planet: 350; district: 140):** Low ≤ 150 draw calls and ≤ 300k triangles; `update()` ≤ 4 ms average per fixed update in quiet mode; **worst sim tick ≤ 8 ms** and **worst path recompute ≤ 50 ms** (desktop, 100 stations). CPU and draw counts only (headless WebGL is software-rendered, so frame time isn't a valid measure). **All models ≤ 15 MB download.**
- **Input:** pointer events for mouse and touch; tap vs drag by 8 px and 250 ms; pinch zoom; picking as in Controls.
- **Audio:** Web Audio, unlocked on the first tap or key; crossfades; separate music and sound volumes; gain table.
- **Saving:** `localStorage` key `arcane-transit-authority`, versioned JSON: `meta` (Merits, unlocks, Commended Charters and best grades, unlocked regions, settings) and `run`: a **full sim snapshot** (term seed, Charter, starting region, geography hash, cells changed, network incl. walkways, money, update count, backlogs, waiting crowds, in-flight flows, yard, timers, disaster timeline index and active disasters, PRNG states, milestones, tech, train positions as line + parameter) plus the action log. Saved every 30 s of play, on pause and on `visibilitychange`.
- **Install and offline:** manifest (name "Arcane Transit Authority", short_name "Arcane Transit", landscape), icons from app-icon, the service worker from web-target.md.
- **Debug hook** (`window.__game`): `state()` (screen, Charter, mandates, region, term seed, money, throughput, quota stage, time, update count, stations, lines, priority districts, selection, pins, termOver, won, overtime), `frames()`, `step(seconds, draw)`, `stepTo(gameTime)`, `quiet(on)`, `resume()`, `startTerm(charter, region, termSeed)`, `geoHash()` (geography hash), `project(target)` (a cell id, a station id, or `{line, sample}`) → `{x, y, visible}` (visible = the camera ray reaches it before the ground sphere, as in Picking, and it isn't under the HUD), `regions()` (per-area counts, as `tools/oikumene.mjs` prints), `cells(filter)`, `stations()`, `lines()`, `routeCards()`, `hash()` (hash of the sim snapshot), `perf()` (draw calls, triangles, avg update, worst tick, worst recompute), `audioState()`. `window.__runLog` gets an entry at each quota (time, money, throughput, hash).
- **The solver's greedy strategy (`tools/solve.mjs`):** every 30 s of game time (and right after each quota), on a snapshot clone:
  1. **Candidates:** route cards from each of the top 5 unserved dense clusters (by generation) to the nearest network station (all feasible cards each); route cards to the Terminal's component for any station not linked; route cards from each priority district to the nearest network station; the named bottleneck's fix (add a train to the line, or the interchange upgrade); Repair all when something is broken; the next tech on the starting region's fixed priority list (in `tuning.js`) when the bottleneck names it or money > 2× its price; a park on a cleared corridor cell when Greenery is under target and money > $1,000.
  2. **Score:** simulate each affordable candidate 3 min ahead on a clone; score = Δ(Throughput × 10 + income per min) per $ spent. Pick the best; repeat while money stays above $500 and the best score is positive.
  3. Answer every disaster warning: Brace if affordable, else Reroute.
  4. Stop at Quota III or the deadline. Time limit **≤ 2 min of real time per Charter** in Node.
  The tutorial's script is replayed as a fixed prefix on Charter I (the Capital). Mandates apply to the solver as to the player. `--sweep` uses the same strategy with a 1 min lookahead and the top 3 clusters.
- **Recorded solutions and browser replay:** `solve.mjs` writes **one solution per Charter** on a fixed term seed, starting in the region that Charter's predecessor unlocks (I the Capital, II the Brine, III the Rift, IV the Spires, V the Flats, VI the Ringside, so every region is exercised), as a list of **(absolute game time, action)** pairs (route A cell, B cell, card kind; trains; upgrades; techs; parks; Brace/Reroute; repairs) plus the **expected `hash()` at each quota**. The browser replay, in quiet mode: `stepTo(T)` exactly, then performs the action as **real input**: rotate the globe with real arrow-key presses (5° each) until `project(cell).visible`, or use the Places list; click or tap; **after each click, assert the selection or pin via `state()` and stop with an error on a mismatch** (picking order can steal a cell click near a station or a ley-rail); then pick the card by its kind. It replays twice and checks: the same hash both times, the same hash as the solver's expected hashes, and Quota III met.

## Cut list

In order, first to go (model cuts before gameplay cuts):

1. Monument model, then Giant Wheel base model: made last from what's left; if not made, code versions (simple shapes; the Monument's spiral as a code light ribbon).
2. The sea and core ambience bed, then the city hum, then the finale music (reuse the title theme).
3. Draft train models for sky, water and space (code capsule lead cars with type-colour bands; nothing sticking up).
4. Train liveries.
5. Ley-rail extras: the earth bore's crystal shards, then the surface sleepers (the glowing rails, the surface maglev beam, the sky pylons and each train's element effect stay).
6. The Polar Ring tech (replace with "Ring Express", +30% ring speed).
7. Half the dispatches (5 per Charter).
8. Inherited networks (every term starts with only the Warp Terminal).
9. The Galactic charter (free play stays).
10. Per-region building bias (one block mix everywhere; ground tints and accent lights stay).

Never cut: the one fixed planet with its six starting regions and the Far Wards, the seven train types riding their ley-rails with their element effects, route cards, interchanges, walkways and the through-the-core route, demolish and green, the tech tree, random milestones, unlocks between terms, disasters, Charters I–VI with their mandates and the finale.

## Effort and cost estimate

A forecast, not a promise.

- **Effort:** 1 planet with six starting regions and the Far Wards (fixed geography built and checked by `tools/oikumene.mjs`, frozen as a cell table; term-seed variations, priority districts, inherited networks), 6 Charters with mandates (+ Galactic and free play), a Charter board, 7 train types, route cards with carries/exports numbers, 6 station kinds + walkways, seven kinds of ley-rail (the surface maglev beam, sky pylons, earth bores) and seven train element effects, 28 tech nodes, 30 milestone cards, 7 disasters with Brace/Reroute, ~60 dispatches, 3 characters, 15 screens and panels, Ride and attract cameras, a Node solver with six recorded solutions and a 72-run sweep. Art: 1 anchor + 15 concept pictures (made) and 15 meshgen re-renders, 6 key-art scenes, 13 models (+2 if money is left), 1 backdrop painting, 6 textures, 1 finale picture, 3 portraits; 6 music tracks (645 s), 42 sounds and 2 ambience beds.
- **Biggest and riskiest work:** the flow simulation staying fast, readable and deterministic; route-card generation and clean ley-rail geometry through every layer; the trains' element effects reading clearly in the open and staying cheap; the map tool hitting every count; the city staying smooth on phones; X-ray readability; Node-found solutions replaying in the browser.
- **Prices used (2026-11-17):** imagegen2 `gpt-image-2.6-flare --quality medium` **measured** at 1,132 output tokens ≈ $0.034 for 1536×1024; with reference-image input (~$0.01) about **$0.05 a picture** (1024×1024 is no more). nanogen pro 2K $0.134, flash 1K $0.034 (nanogen SKILL.md). Meshy ~$0.02 a credit (image-to-3D 30, `--draft` 15). audiogen ~$0.30 per music minute, ~$0.12 per sound.
- **Cost.** **Already spent** on the shared design's mock pictures: **≈ $7.58** of the $10 mock allowance, all logged in `design/ASSETS.md`. The accepted mocks (anchor, 7 trains, 8 places, 3 portraits, 6 scenes) are the game's concept art, portraits and loading/How-to-Play art, so they aren't made again.
- **Order of making:** meshgen re-renders → models → backdrop, finale picture and textures → music → sound effects. Models come before audio, so any overrun is paid for by the audio cuts below, never by a missing model.

**Still to make** (itemised):

| Item | Count × unit | Cost |
|---|---|---|
| imagegen2 meshgen re-renders (Template A′: lead cars; buildings on a ground plate) | 15 × $0.05 | $0.75 |
| imagegen2 re-render retries | 3 × $0.05 | $0.15 |
| nanogen pro 2K: galactic core backdrop, finale picture | 2 × $0.134 | $0.27 |
| nanogen flash 1K textures | 6 × $0.034 | $0.20 |
| Meshy trains, draft | 7 × 15 credits = 105 | $2.10 |
| Meshy stations and landmarks (must: surface/Bore, Sky Port, Sea Station, Core Exchange, Warp base, ring-elevator) | 6 × 30 credits = 180 | $3.60 |
| Music | 645 s at $0.30/min | $3.23 |
| SFX (42) + ambience beds (2) | 44 × $0.12 | $5.28 |
| SFX re-takes (~15%) | 6 × $0.12 | $0.72 |
| **To make** | | **$16.30** |
| **Already spent** | | **$7.58** |
| **Total without a reserve** | | **$23.88** |

  - **This is over the $20 budget. `--budget 25` is the floor:** it leaves ≈ $1.12 of reserve, so a Meshy redo or the remesh fallback is paid for by the audio cuts below (models are made first). **`--budget 30`** adds full-quality trains (+105 credits, $2.10), the Giant Wheel and Monument models ($1.20) and leaves ≈ $2.82 of reserve.
  - **If the budget stays at $20** (≈ $12.42 left), the cuts, in order: Build music 240 → 150 s and Busy 180 → 120 s (−$0.75); the finale reuses the title theme (−$0.45); sound effects merged, disaster hits into two families first (−5 sounds, −$0.60), then the seven departures into three (−4, −$0.48); the sea and core bed reuses the city hum pitched down (−$0.12); no SFX re-take or re-render retry lines (−$0.87); station models 6 → 4 (Sky Port and Sea Station drawn in code, with their re-renders, −$1.30). That reaches ≈ $11.73 to make, leaving ≈ $0.69 of reserve; the ring-elevator model stays, and the Giant Wheel and Monument stay in code.
  - Meshy: run `--dry-run` and `--max-credits 35` (`--max-credits 20` for drafts) on every model. If `--draft` refuses `--polycount` or `--pbr`, drop that flag and `remesh --polycount 1500` (5 credits) or set materials in code. Drafts are fine for trains: they're at most ~60 px tall at district zoom and simple capsules beyond it.

## Definition of done

- [ ] Starts with no errors at desktop (1280×800) and phone landscape (844×390).
- [ ] The first New Term goes straight into the tutorial (no Charter board, no term setup); the tutorial reaches its free through-the-core crossing by **6 minutes** of game time and ends at Quota I (90) by 12 minutes; the toolbar grows step by step; the Charter board first appears from the Charter I Commended screen.
- [ ] `tools/oikumene.mjs` passes: all 642 cells have an area; per-area counts match The regions table (37 / 146 / 90 / 65 / 92 / 60 / 152; ocean 120, Atlantis 14, mountains 91 ± 3, peaks 2 / 22 / 3); every start cell is land, in its region and within 5° of its table angle to the Terminal; the tutorial geography holds; and the frozen cell table in `tuning.js` equals a fresh build. `__game.regions()` prints the same counts in the browser.
- [ ] The geography is identical in every term: `geoHash()` (the frozen table's hash) is the same for any term seed, Charter and starting region; term seeds change only densities (±1, every area's average within ±0.2 after rebalancing), priority districts, inherited networks, milestones, disasters, dispatches and Charter VI's dealt mandates.
- [ ] Inherited networks use only the term's native types and no Surface line, sit at the starting region's densest cells, cost nothing, pay upkeep, never link to the Terminal and never count toward a milestone; the tutorial inherits nothing.
- [ ] Every mandate works and shows on its Charter document and in term setup (First Crossing Grant, Atlantean Trade, Heritage Capital, Frontier Link, Narrow Yard; two dealt in VI); priority districts are dealt 2 or 3 per term in different areas and pay ×1.5 exports when linked.
- [ ] Starting in the Brine makes Sea Stations native and starting in the Ringside makes Space Elevators native, in every Charter.
- [ ] Every Charter I–VI can be Commended: its Node-found solution (one per Charter, from its unlock-order region) replays in the browser with real input, twice, with every click's selection asserted and `hash()` at each quota matching both runs and the solver's expected hashes; Commending each unlocks the next Charter and region; and the Charter VI finale (beam to the galactic core, Conductor's last dispatch) and credits play, with the Homeworld never shown as a place.
- [ ] Every recorded solution uses at least 3 train types and has no idle gap over 3 min; in every Charter (and Galactic) Quota III ≤ 70% of the reachable deep space ceiling (checked by `tools/solve.mjs`).
- [ ] `tools/solve.mjs --sweep` passes: all 36 Charter × starting region pairs on 2 term seeds reach Quota III before deadline + Overtime with no idle gap over 3 min, and its table of quota times and idle gaps is saved with the solutions.
- [ ] Regional modifiers work: a Rift earth card stops at 64° and names the Rift's crust; the Rift rule holds (a Rift Core Exchange costs half and its shaft, at ×1.5 speed, carries 240/min with 2 trains); Flats demolition is ×1.8; regional disasters hit their home region first.
- [ ] Each of the seven train types can be built from a route card, runs, carries cargo, and shows in the layer filter, flow overlay and X-ray; locked cards name their tech; each card's "carries" equals the flow the sim then achieves on that route when saturated (±5%).
- [ ] A through-the-core route works and plays its first-time moment; Ride works on every type.
- [ ] One earth rule: every chord ends and every shaft starts at a portal at radius 100 under its station, so every shaft is 63 units (169/min with 2 trains, 240/min in the Rift) including from mountain stations, whose station wells draw in X-ray.
- [ ] Every line draws only as its ley-rail, in its type colour (surface on its chrome maglev beam in the cleared corridor; sky with floating ring pylons; water on the sea floor; earth as a green-crystal bore in X-ray, and outside X-ray every underground line (earth chords, fire chords) as a faint dashed trace on the surface above it in its type colour, with portal beacons at Bore stations and Core Exchanges and moving train lights; fire through the core's lava; space on the ring; deep space with no rail); every moving train shows its element effect; the flow overlay changes rail width, brightness and pulse speed and the white load markers' size, fill and flashing, never the rail's type colour.
- [ ] Picking: rail samples and stations within 16 / 24 px are pickable only where the camera ray reaches them before the ground sphere (sky arcs and the ring past the limb included); a tap over a far-side rail never selects it; in X-ray only clipped-in layers skip the test; `project()` agrees with picking for cells, stations and rail samples.
- [ ] On Low quality on a phone, the sea is see-through: the sea floor, Atlantis domes, Sea Stations, water rails and water trains are visible and tappable without X-ray; water rails keep ≥ 6 units from every Atlantis dome centre; each water car has its own bubble.
- [ ] Walkways link a pier and a Sky Port to neighbouring stations; a station outside the Terminal's component makes no exports and says so.
- [ ] The Throughput breakdown names the right bottleneck in four set-ups (warp ring, an interchange, unlinked stations, too few districts).
- [ ] Every disaster can happen, drops speed to 1x, can be shown, braced, rerouted, and repaired or waited out.
- [ ] Tech tree, milestone cards, Merit Office and the Charter board (Charter documents with mandates, region picker, the Far Wards shown as not a starting region) work; unlocks persist between terms. Player-facing text says "term" (never "run") and "Merits" for the currency.
- [ ] Losing (bankrupt; Overtime ended), Retry this term and Undo (cells restored) work; nothing gets stuck.
- [ ] Every control works with mouse and keyboard and with touch; on phones every pick uses snap-and-confirm, cards and panels open in the right column with the toolbar hidden, and the path stays in the left 60%.
- [ ] Every screen looks finished at every targeted size, from the first load; loading crossfades to the title.
- [ ] Music and sound play (after the first tap or key), loops are seamless, mute works, the warp departure is heard every time.
- [ ] A term in progress (full snapshot), Merits and settings are saved and restored; a restored term gives the same `hash()` after the same steps as an unbroken one.
- [ ] Game speed: 1x = 30 updates per real second at both 60 Hz and 120 Hz displays.
- [ ] Low quality at end state, at planet and district distance: ≤ 150 draw calls, ≤ 300k triangles, `update()` ≤ 4 ms average, worst tick ≤ 8 ms, worst recompute ≤ 50 ms (from `__game.perf()`); all models ≤ 15 MB.
- [ ] `tools/contrast.mjs` passes: no type hex in world materials (the Monument spiral excepted) and `#ffffff` only on load markers; every saturated world colour drawn at or above the ground ≥ 30° of hue from each type colour drawn there; rose and teal neon within their intensity cap; every line colour ≥ 3:1 on its backdrop.
- [ ] Installs as an app ("Arcane Transit", ATA icon) and works offline; saves under `arcane-transit-authority`.
