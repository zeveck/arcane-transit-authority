// tech.js — the 28-node tech tree and the modifier set (tech + milestone bonuses) every system reads.
import { TECH, TECH_PRICES, TECH_BRANCHES, CHARTERS, TYPES, PLANET } from './tuning.js';

export const TECH_BY_ID = Object.fromEntries(TECH.map((t) => [t.id, t]));

/** Price of a node under the term's Charter (before free credits). */
export function techPrice(state, id) {
  const t = TECH_BY_ID[id];
  return Math.round((t.price ?? TECH_PRICES[t.tier - 1]) * CHARTERS[state.charter].price);
}

/** Why a node can't be bought now (null if it can). */
export function techBlock(state, id) {
  const t = TECH_BY_ID[id];
  if (!t) return 'No such tech';
  if (state.tech[id]) return 'Owned';
  for (const o of TECH) if (o.branch === t.branch && o.tier < t.tier && !state.tech[o.id]) return `Needs ${o.name} first`;
  return null;
}

/** Nodes owned free at term start: unlock nodes of native types. */
export function nativeTech(natives) {
  const out = {};
  for (const t of TECH) if (t.unlock && natives.includes(t.unlock)) out[t.id] = true;
  return out;
}

/** Tech tree for the UI: branches in order with nodes, owned flag, price and block reason. */
export function techTree(state) {
  return TECH_BRANCHES.map((b) => ({
    branch: b,
    nodes: TECH.filter((t) => t.branch === b).sort((x, y) => x.tier - y.tier).map((t) => ({
      id: t.id, tier: t.tier, name: t.name, text: t.text, owned: !!state.tech[t.id], price: techPrice(state, t.id), block: techBlock(state, t.id),
    })),
  }));
}

/**
 * Every modifier in force, from owned tech and completed milestone bonuses.
 * Read-only object; recomputed when tech or milestones change.
 */
export function computeMods(state) {
  const m = {
    speed: { surface: 1, sky: 1, water: 1, earth: 1, fire: 1, space: 1 },
    cars: { surface: 0, sky: 0, water: 0, earth: 0, fire: 0, space: 0 },
    carCap: { surface: 1, sky: 1, water: 1, earth: 1, fire: 1, space: 1 },
    trackCost: { surface: 1, sky: 1, water: 1, earth: 1, fire: 1, space: 1 },
    surfaceDemolition: 1, demolition: 1, viaducts: false,
    skyRange: TYPES.sky.range, skyCatchment: 1, meteorSegments: 2,
    atlantisDensity: 0, pressureHulls: false, crust: 0, noCaveIn: false, shaftSpeed: 1,
    noCoreFlare: false, wideShafts: false, cheapElevators: false, elevatorMult: 1, magneticShield: false, polarRing: false,
    transferMult: 1, coreTransferMult: 1, warpCars: 0, noWarpDrift: false, twinLaunch: false,
    fareMult: 1, exportMult: 1, genMult: 1, attractionMult: 1, parksDouble: false, stationUpkeepMult: 1, speedAll: 1, carsAll: 0,
    water: !!state.tech.seaStations, space: !!state.tech.spaceElevators,
  };
  const apply = (e) => {
    if (!e) return;
    if (e.speed) for (const k in e.speed) m.speed[k] *= e.speed[k];
    if (e.cars) for (const k in e.cars) m.cars[k] += e.cars[k];
    if (e.carCap) for (const k in e.carCap) m.carCap[k] *= e.carCap[k];
    if (e.trackCost) for (const k in e.trackCost) m.trackCost[k] *= e.trackCost[k];
    if (e.surfaceDemolition) m.surfaceDemolition *= e.surfaceDemolition;
    if (e.demolitionMult) m.demolition *= e.demolitionMult;
    if (e.viaducts) m.viaducts = true;
    if (e.skyRange) m.skyRange = Math.max(m.skyRange, e.skyRange);
    if (e.skyRangeAdd) m.skyRangeAdd = (m.skyRangeAdd || 0) + e.skyRangeAdd;
    if (e.meteorSegments) m.meteorSegments = Math.min(m.meteorSegments, e.meteorSegments);
    if (e.skyCatchment) m.skyCatchment = e.skyCatchment;
    if (e.atlantisDensity) m.atlantisDensity += e.atlantisDensity;
    if (e.pressureHulls) m.pressureHulls = true;
    if (e.crust) m.crust += e.crust;
    if (e.noCaveIn) m.noCaveIn = true;
    if (e.shaftSpeed) m.shaftSpeed *= e.shaftSpeed;
    if (e.noCoreFlare) m.noCoreFlare = true;
    if (e.wideShafts) m.wideShafts = true;
    if (e.cheapElevators) m.cheapElevators = true;
    if (e.elevatorMult) m.elevatorMult *= e.elevatorMult;
    if (e.magneticShield) m.magneticShield = true;
    if (e.polarRing) m.polarRing = true;
    if (e.biggerInterchanges) m.transferMult *= 1.5;
    if (e.transferMult) m.transferMult *= e.transferMult;
    if (e.coreTransferMult) m.coreTransferMult *= e.coreTransferMult;
    if (e.warpCars) m.warpCars += e.warpCars;
    if (e.noWarpDrift) m.noWarpDrift = true;
    if (e.twinLaunch) m.twinLaunch = true;
    if (e.fareMult) m.fareMult *= e.fareMult;
    if (e.exportMult) m.exportMult *= e.exportMult;
    if (e.genMult) m.genMult *= e.genMult;
    if (e.attractionMult) m.attractionMult *= e.attractionMult;
    if (e.parksDouble) m.parksDouble = true;
    if (e.stationUpkeepMult) m.stationUpkeepMult *= e.stationUpkeepMult;
    if (e.speedAll) m.speedAll *= e.speedAll;
    if (e.carsAll) m.carsAll += e.carsAll;
  };
  for (const t of TECH) if (state.tech[t.id]) apply(t.effect);
  for (const b of state.milestones?.bonuses || []) apply(b);
  if (m.skyRangeAdd) m.skyRange += m.skyRangeAdd;
  return m;
}

/** Max earth chord angle (deg) for a crust depth. */
export function maxEarthAngle(crust) {
  const r = Math.max(PLANET.radius - crust, PLANET.minChordRadius);
  return Math.round(2 * Math.acos(r / PLANET.radius) * 180 / Math.PI * 1e9) / 1e9; // quantised: engine-independent
}
