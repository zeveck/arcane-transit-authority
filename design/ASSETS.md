# Assets and spending

Budget: $20 for everything; up to $10 for the shared design's mock pictures.

Price notes (2026-11-17):
- imagegen2 (gpt-image-2.6-flare): about $30 per million image output tokens (third-party pages citing OpenAI's rate card). Measured: 1536×1024 at `--quality medium` used 1,132 output tokens ≈ **$0.034**; reference images add input tokens at about $8 per million.
- nanogen: pro 2K $0.134, pro 4K $0.24, flash 1K ~$0.034 (its SKILL.md).
- Meshy: ~$0.02 per credit; image-to-3D 30 credits, `--draft` 15.
- audiogen: ~$0.30 per minute of music, ~$0.12 per sound effect.

| ID | File | Tool | Prompt (short) | Tries | Est. cost | Kind |
|---|---|---|---|---|---|---|
| anchor-fire-train | design/art/style-anchor.png (was game/assets/), design/mockups/fire-train.png | imagegen2 flare, medium, 1536×1024 | Fire train lead car, Template A | 1 | $0.04 | mockup + style anchor |
| concept-train-surface | design/mockups/surface-train.png | imagegen2 flare, medium, anchor ref | Surface train; v1 came out orange like fire, v2 golden-yellow `#ffc23d` | 2 | $0.10 | mockup + meshgen input |
| concept-train-sky | design/mockups/sky-train.png | imagegen2, as above | Sky train, white and cyan | 1 | $0.05 | mockup + meshgen input |
| concept-train-water | design/mockups/water-train.png | imagegen2, as above | Water train, teal, portholes | 1 | $0.05 | mockup + meshgen input |
| concept-train-earth | design/mockups/earth-train.png | imagegen2, as above | Earth train, ochre, drill nose | 1 | $0.05 | mockup + meshgen input |
| concept-train-space | design/mockups/space-train.png | imagegen2, as above | Space train, violet | 1 | $0.05 | mockup + meshgen input |
| concept-train-deep | design/mockups/deep-space-train.png | imagegen2, as above | Deep space train; v2 added the warp ring | 2 | $0.10 | mockup + meshgen input |

| concept-station-surface | design/mockups/station-surface.png | imagegen2 flare, medium, 1024², anchor ref | Domed station pavilion, golden-yellow | 1 | $0.06 | mockup + meshgen input |
| concept-skyport | design/mockups/skyport.png | as above | Saucer tower on a rock peak, cyan | 1 | $0.06 | mockup + meshgen input |
| concept-sea-station | design/mockups/sea-station.png | as above | Glass dome on sea floor, teal | 1 | $0.06 | mockup + meshgen input |
| concept-core-exchange | design/mockups/core-exchange.png | as above | Armoured drum with shaft, magma | 1 | $0.06 | mockup + meshgen input |
| concept-warp-base | design/mockups/warp-base.png | as above | Stepped launch platform with pylons, magenta | 1 | $0.06 | mockup + meshgen input |
| concept-ring-elevator | design/mockups/ring-elevator.png | as above | Ring Station on a cable, violet | 1 | $0.06 | mockup + meshgen input |
| concept-wheel-base | design/mockups/wheel-base.png | as above | Wheel A-frame and hub | 1 | $0.06 | mockup + meshgen input |
| concept-monument | design/mockups/monument.png | as above | Obelisk wrapped by a tube spiral | 1 | $0.06 | mockup + meshgen input |

Measured with the anchor as reference: trains ~1,690 input + 1,132 output tokens ≈ $0.048; places (1024²) ~1,449 output ≈ $0.057.

| portrait-juno | design/mockups/portrait-juno.png | imagegen2 flare, medium, 1024², transparent (native alpha), anchor ref | Juno Brasswick, Template C | 1 | $0.06 | mockup + game portrait |
| portrait-thrumm | design/mockups/portrait-thrumm.png | as above, anchor + Juno refs | Auditor Ossian Thrumm | 1 | $0.07 | mockup + game portrait |
| portrait-conductor | design/mockups/portrait-conductor.png | as above, anchor + Juno refs | The Warp Conductor | 1 | $0.07 | mockup + game portrait |

| mock-globe | design/mockups/mock-globe.jpg | nanogen pro 2K 16:9, anchor ref | Planet-city with cutaway core, ring, warp flash | 1 | $0.14 | mockup + loading art / icon source |
| mock-surface | design/mockups/mock-surface.jpg | as above | Surface tube through a cleared corridor, park | 1 | $0.14 | mockup + How to Play header |
| mock-atlantis | design/mockups/mock-atlantis.jpg | as above | Atlantis domes, water tube | 1 | $0.14 | mockup + header / loading |
| mock-sky | design/mockups/mock-sky.jpg | as above | Sky arcs between peaks, Sky Ports | 1 | $0.14 | mockup + header / loading |
| mock-xray | design/mockups/mock-xray.jpg | as above | Cutaway: shafts and fire line; v1's tube went around the core, v2 crosses it | 2 | $0.27 | mockup + header / loading |
| mock-ring | design/mockups/mock-ring.jpg | as above | Orbital ring, violet train, elevators | 1 | $0.14 | mockup + header / loading |

**Subtotal, first look (retro chrome-and-enamel): $2.07.** All of it was replaced at the person's request (request 6: elemental, fantasy trains and a cyberpunk lean). The files stay in `.gamegen/candidates/` (`concepts/`, `portraits/`, `keyart/`) and are no longer used.

### Second look: elemental trains, cyberpunk lean (`.gamegen/candidates/v2/`)

| ID | File | Tool | Prompt (short) | Tries | Est. cost | Kind |
|---|---|---|---|---|---|---|
| anchor-fire (v2) | design/art/style-anchor.png (was game/assets/), design/mockups/fire-train.png | imagegen2 flare, medium, 1536×1024 | Magma salamander-dragon fire train, dark charcoal background | 1 | $0.04 | mockup + style anchor |
| train-surface | design/mockups/surface-train.png | imagegen2, anchor ref | Storm-serpent maglev; v1 copied the fire head and had text-like panels | 2 | $0.10 | mockup |
| train-sky | design/mockups/sky-train.png | as above | Feathered wind serpent | 1 | $0.05 | mockup |
| train-water | design/mockups/water-train.png | as above | Bioluminescent leviathan-eel | 1 | $0.05 | mockup |
| train-earth | design/mockups/earth-train.png | as above | Crystal stone wyrm; v1 too orange | 2 | $0.10 | mockup |
| train-space | design/mockups/space-train.png | as above | Celestial star serpent; v1 copied the fire head | 2 | $0.10 | mockup |
| train-deep | design/mockups/deep-space-train.png | as above | Void serpent; v1 copied the fire head | 2 | $0.10 | mockup |
| 8 places | design/mockups/*.png | imagegen2 flare, medium, 1024², anchor ref | Cyberpunk stations and landmarks | 8 | $0.46 | mockup |
| 3 portraits | design/mockups/portrait-*.png | imagegen2, transparent, refs: first portraits + new Juno | Cyberpunk-lean cast | 3 | $0.21 | mockup + game portrait |
| 6 key-art scenes | design/mockups/mock-*.jpg | nanogen pro 2K 16:9, train refs | Globe, surface, Atlantis, sky, X-ray, ring; X-ray took 3 tries (tube ran into space; then a city inside the rock) | 8 | $1.08 | mockup |

**Second look subtotal: ≈ $2.29. Running total: ≈ $4.36** (mockups: ≈ $4.36 of the $10 allowed)

Note for the build: the second-look concepts are on a dark background with baked glow. Before meshgen, each train and station mock gets one re-render (edit, mock as reference) on light grey with even light and no glow (~$0.05 each), as the design's Template A says.

### Third look for the trains: magical vehicles, not creatures (`.gamegen/candidates/v3/`)

Requests 10, 13, 14 and 15: no monsters or dragons, no spikes down the back, one clear colour per element, no halo on the deep space train.

| ID | File | Tries | Est. cost | Notes |
|---|---|---|---|---|
| anchor-fire (v3) | design/art/style-anchor.png (was game/assets/), design/mockups/fire-train.png | 2 | $0.10 | v1 had flame spikes on the roof; v2 has a smooth roof |
| train-surface | design/mockups/surface-train.png | 1 | $0.05 | yellow lightning |
| train-sky | design/mockups/sky-train.png | 2 | $0.10 | v1 had roof vanes; v2 has wind ribbons |
| train-water | design/mockups/water-train.png | 2 | $0.10 | recoloured to deep blue |
| train-earth | design/mockups/earth-train.png | 2 | $0.10 | recoloured to emerald green |
| train-space | design/mockups/space-train.png | 1 | $0.05 | violet stars |
| train-deep | design/mockups/deep-space-train.png | 2 | $0.10 | halo removed |

**Third look subtotal: ≈ $0.60.**

| 6 key-art scenes (edited to the new trains) | design/mockups/mock-*.jpg | nanogen pro 2K edits, scene + train refs | 6 | $0.81 |

Request 18 (ley-rails instead of tubes): the six scenes edited again to remove the tubes (`.gamegen/candidates/v5/`); the globe and X-ray scenes took a second edit (a leftover tube; a line running past the planet).

| 6 key-art scenes (ley-rails) | design/mockups/mock-*.jpg | nanogen pro 2K edits | 8 | $1.08 |

Final review (round 3): the 8 place mocks still had tube ports and the surface and sea stations were in the wrong colours; all 8 remade tube-free in their type colours (`.gamegen/candidates/v6/`), and the globe and X-ray scenes edited once more (tube-like sky arcs and shafts; shafts above the city).

| 8 places (tube-free, type colours) | design/mockups/*.png | imagegen2 flare medium, edit of the second-look mock | 8 | $0.46 |
| mock-globe, mock-xray | design/mockups/mock-*.jpg | nanogen pro 2K edits | 2 | $0.27 |

**Running total: ≈ $7.58** (mockups: ≈ $7.58 of the $10 allowed)

## Build (request 32, budget $50)

| Group | Files | Tool | Tries | Est. cost |
|---|---|---|---|---|
| Music: title 90 s, build 240 s, busy 180 s, disaster 30 s, fanfare 15 s, finale 90 s | game/assets/audio/music/*.mp3 | audiogen music | 6 | $3.23 |
| 42 sound effects + 2 ambience beds | game/assets/audio/sfx/*.mp3 | audiogen sfx | 50 (6 remakes: amb-city, ui-tool ×2, milestone-flip ×2, dis-flare) | $6.00 |

Gains measured into game/assets/audio/manifest.json (set by ear in the build). Detailed log: .gamegen/progress/audio-ledger.md.

**Running total: ≈ $16.81 of $50**

| Group | Files | Tool | Tries | Est. cost |
|---|---|---|---|---|
| Template A′ re-renders (7 lead cars, 8 buildings, + Sky Port v2) | .gamegen/candidates/reref/ | imagegen2 flare medium edits | 16 | $0.82 |
| 15 models (7 trains full quality, 8 buildings incl. Giant Wheel and Monument), shrunk + emissive masks by tools/shrink_glb.py; 7.25 MB total | game/assets/models/*.glb | meshgen image-to-3D, 30 credits each | 16 (Sky Port twice) | $9.60 (480 credits) |
| Galactic core backdrop, finale picture | game/assets/bg/{galaxy-core,finale}.jpg | nanogen pro 2K | 2 | $0.27 |
| 6 tiles: windows, streets, core, seafloor, rock, lava (seams fixed locally on 3) | game/assets/tiles/*.jpg | nanogen flash 1K | 6 | $0.20 |
| Key art, portraits, app-icon source (reused mocks) | game/assets/{keyart,portraits}/ (app-icon source moved to design/art/app-icon-src.png) | copies | — | $0 |

Detailed log: .gamegen/progress/art-ledger.md. **Running total: ≈ $27.70 of $50**
