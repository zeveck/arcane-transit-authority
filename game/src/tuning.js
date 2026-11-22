// tuning.js — every number of the simulation (GAME_DESIGN.md "Tuning", Charters, regions, tech,
// milestones, disasters, Merit Office) plus the frozen Oikumene cell table written by tools/oikumene.mjs.
// Pure data. Units: 1 unit = 50 miles; planet radius 100. Money in sim $ (shown as $ millions by fmt.js). Rates "per minute" unless named.
// Texts never write money by hand: they carry numbers (bonus.cash, goal.amount, effect.cash) and any text with money is made by fmtMoney.

import { fmtMoney } from './fmt.js';

export const VERSION = 1;

// ---------------------------------------------------------------- planet
export const PLANET = {
  radius: 100,
  cells: 642,
  coreRadius: 35,
  coreExchangeRadius: 37,      // core radius + 2
  portalRadius: 100,           // the one earth rule: every portal at radius 100 under its station
  baseCrust: 25,               // depth below 100 at a chord's deepest point
  minChordRadius: 37,          // earth chords never go below core radius + 2
  ringRadius: 130,
  seaSurface: 100,
  seaFloor: 94,
  waterRail: 94.8,
  pierDeck: 100.5,
  domeRadius: 5,
  domeClearance: 6,            // water rails keep >= 6 units (along the sea floor) from a dome centre
  surfaceRailLift: 1.0,        // surface ley-rail centre at ground + 1.0
  walkwayLift: 1.5,
  buildingHeight: [1, 8],      // ground + 1..8 by density
  cellSpacing: 15,             // neighbouring centres ~15 units (8.6°)
  ringReachDeg: 17.6,          // "within 2 cells (30 units, 17.2°)" of the ring's ground track (+0.4° grid slack)
  terminal: { lat: 0, lon: 180 },
  sampleStep: 1.0,             // path samples ~1 unit apart
};

// ---------------------------------------------------------------- train types
// track $/unit, station $, train $, upkeep $/min per train, speed units/s, cars, car capacity
export const TYPES = {
  surface: { track: 14, station: 150, train: 300, upkeep: 6, speed: 3.0, cars: 3, carCap: 20, layer: 'surface' },
  sky:     { track: 4, station: 300, train: 350, upkeep: 5, speed: 4.0, cars: 2, carCap: 15, range: 60, rangeTech: 90, layer: 'sky' },
  water:   { track: 14, station: 350, stationDome: 500, train: 450, upkeep: 8, speed: 2.5, cars: 3, carCap: 20, layer: 'water' },
  earth:   { track: 30, station: 450, train: 500, upkeep: 10, speed: 2.0, cars: 3, shaftCars: 4, carCap: 25, layer: 'earth' }, // earth chords 3 cars; shafts keep 4 (core capacity)
  fire:    { track: 16, station: 350, stationRift: 175, train: 450, upkeep: 12, speed: 6.0, cars: 4, carCap: 30, minAngle: 60, layer: 'fire' },
  space:   { track: 6, station: 2500, stationCheap: 1250, train: 1200, upkeep: 18, speed: 8.0, elevatorSpeed: 3.0, cars: 6, carCap: 30, layer: 'space' },
  deep:    { interval: 30, intervalTwin: 20, intervalNarrow: 60, carCap: 50 },
};
/** Earth track price per unit ×(1 + max(0, length − from) / per): long chords bite, so the core wins long hauls. */
export const EARTH_LONG_CHORD = { from: 45, per: 60 };
export const TRAINS_PER_NEW_LINE = 2;
/** A through-the-core card's new shafts start with 1 train each (the fire chord with 2): add shaft trains as flow grows. */
export const SHAFT_TRAINS = 1;
export const DWELL_PER_ROUND_TRIP = 8;   // seconds
export const TRAIN_REFUND = 0.75;        // selling a train
export const STATION_UPKEEP = 2;         // $/min per station
export const LAYER_UPKEEP = 2;           // $/min per extra interchange layer
export const INTERCHANGE_LAYER_FEE = 250; // + that layer's station price
export const VIADUCT_TRACK_MULT = 3;     // Elevated Viaducts: ocean cells at 3x track cost
export const VIADUCT_MAX_OCEAN = 2;

/** Demolition per cell by density (index = density). x Charter demolition x region demolition. */
export const DEMOLITION = [0, 100, 250, 800, 1300, 1800];

// ---------------------------------------------------------------- transfers
export const TRANSFER = {
  ordinary: 120,
  core: 360,
  elevator: 360,
  terminal: Infinity,
  upgradePrice: 600,
  upgradeMult: 2,
  biggerInterchangesMult: 1.5,
  wideShaftsMult: 1.5,
  seconds: 4,                // a transfer (same station or walkway) takes 4 s
};

// ---------------------------------------------------------------- simulation
export const SIM = {
  updatesPerSecond: 30,      // fixed update 1/30 s
  updatesPerTick: 30,        // a sim tick every game second
  commutersPerDensity: 2,    // per cell per minute
  exportsPerDensity: 1.2,    // per cell per minute (x Charter x region)
  gravityScale: 150,         // G_t / (1 + d/150)
  longHaulShare: 0.15,       // of each station's commuters, to same-component stations > 90° away
  longHaulDeg: 90,
  waitingCapMinutes: 10,     // waiting crowd cap = 10 x per-minute generation
  fareBase: 1,
  farePerUnit: 0.035,
  freightFee: 1.1,           // per export launched (x Charter price multiplier, like fares)
  incomeScalesWithPrice: true, // fares and freight x the Charter's price multiplier (BUILD_NOTES)
  throughputWindow: 60,      // seconds, half-open (t-60, t]
  priorityExportMult: 1.5,
  atlanteanTradeMult: 2,
  bankruptcySeconds: 60,
  overtimeMinutes: 15,
  quotaBonus: 2000,          // x Charter price multiplier
  undoSeconds: 10,
  altPenalties: [2, 4],      // penalty re-runs for alternative paths
  surfaceLostFareMinutes: 10, surfaceLostFareShare: 0.2, surfaceAvgFare: 3, // A* lost-fares term
};

// ---------------------------------------------------------------- greenery
export const GREEN = {
  grove: { price: 80, genBonus: 0.05, greenery: 0.5, radius: 1 },
  park: { price: 150, genBonus: 0.10, greenery: 1, radius: 1 },
  attraction: { price: 1500, genBonus: 0.30, greenery: 3, radius: 2, looks: ['wheel', 'fountain', 'monument'] },
  gradeShare: 0.08,          // Greenery star: score >= 8% of city cells
};

// ---------------------------------------------------------------- regions
// Area ids in cell-table order: 0 capital, 1 brine, 2 spires, 3 rift, 4 flats, 5 ringside, 6 farwards.
export const AREA_IDS = ['capital', 'brine', 'spires', 'rift', 'flats', 'ringside', 'farwards'];
export const REGIONS = {
  capital: { name: 'The Capital', centre: [20, 0], baseDensity: 3.4, demolition: 1.0, export: 1.0, crust: 25,
    start: { name: 'The Capital', lat: 20, lon: 0 }, startAngle: 160, signature: 'earth', cells: 37, starting: true },
  brine: { name: 'The Brine', centre: [-25, 60], weight: 1.0, reach: 66, baseDensity: 2.6, atlantisDensity: 4, demolition: 1.1, export: 1.0, crust: 25,
    start: { name: 'Saltmarch Island', lat: -30, lon: 65 }, startAngle: 112, signature: 'water', cells: 146, starting: true },
  spires: { name: 'The Spires', centre: [50, -60], weight: 1.0, reach: 48, baseDensity: 2.4, demolition: 1.2, export: 1.0, crust: 30,
    start: { name: 'Hollowgate', lat: 50, lon: -60 }, startAngle: 109, signature: 'sky', cells: 90, starting: true },
  rift: { name: 'The Rift', centre: [-20, -100], weight: 1.0, reach: 38, baseDensity: 2.4, demolition: 1.0, export: 1.1, crust: 15,
    start: { name: 'Cinder Gate', lat: -20, lon: -100 }, startAngle: 81, signature: 'fire', cells: 65, starting: true,
    riftRule: { coreExchangeMult: 0.5, shaftSpeedMult: 1.5 } },
  flats: { name: 'The Flats', centre: [-45, -30], weight: 1.1, reach: 50, baseDensity: 3.6, demolition: 1.8, export: 1.2, crust: 25,
    start: { name: 'The Flats', lat: -45, lon: -30 }, startAngle: 128, signature: 'earth', cells: 92, starting: true },
  ringside: { name: 'The Ringside', centre: [0, -30], baseDensity: 2.2, demolition: 1.0, export: 1.0, crust: 25,
    start: { name: 'Ring Market', lat: 0, lon: -30 }, startAngle: 150, signature: 'space', cells: 60, starting: true },
  farwards: { name: 'The Far Wards', centre: [0, 180], baseDensity: 2.0, demolition: 1.0, export: 1.0, crust: 25,
    start: null, startAngle: null, signature: null, cells: 152, starting: false },
};
export const DEEP_BORE_CRUST = 15;   // Deep Bore tech: crust limit +15

// ---------------------------------------------------------------- Charters
export const CHARTER_IDS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'G'];
export const CHARTERS = {
  I:   { name: 'Charter I',   price: 1.0, demolition: 1.0, export: 1.0, start: 8000,  debt: -3000, deadline: 45, warpCars: 6,  quotas: [90, 240, 360],    mandates: [], natives: ['surface', 'sky', 'earth', 'fire', 'deep'], milestoneSlots: 3 },
  II:  { name: 'Charter II',  price: 1.1, demolition: 1.1, export: 1.15, start: 9000,  debt: -3000, deadline: 45, warpCars: 6,  quotas: [120, 320, 480],   mandates: ['atlanteanTrade'], natives: ['surface', 'sky', 'earth', 'fire', 'deep', 'water'], milestoneSlots: 3 },
  III: { name: 'Charter III', price: 1.2, demolition: 1.2, export: 1.35, start: 9000,  debt: -3000, deadline: 42, warpCars: 6,  quotas: [150, 400, 600],   mandates: ['heritageCapital'], natives: ['surface', 'sky', 'earth', 'fire', 'deep', 'water'], milestoneSlots: 3 },
  IV:  { name: 'Charter IV',  price: 1.3, demolition: 1.2, export: 1.6, start: 12000, debt: -4000, deadline: 40, warpCars: 6,  quotas: [180, 480, 720],   mandates: ['frontierLink'], natives: ['surface', 'sky', 'earth', 'fire', 'deep', 'water', 'space'], milestoneSlots: 3 },
  V:   { name: 'Charter V',   price: 1.4, demolition: 1.3, export: 2.0, start: 14000, debt: -4000, deadline: 38, warpCars: 6,  quotas: [210, 560, 840],   mandates: ['narrowYard'], natives: ['surface', 'sky', 'earth', 'fire', 'deep', 'water', 'space'], milestoneSlots: 3 },
  VI:  { name: 'Charter VI',  price: 1.5, demolition: 1.4, export: 2.5, start: 18000, debt: -5000, deadline: 35, warpCars: 8,  quotas: [250, 660, 1000],  mandates: 'dealt2', natives: ['surface', 'sky', 'earth', 'fire', 'deep', 'water', 'space'], milestoneSlots: 3 },
  G:   { name: 'Galactic',    price: 1.5, demolition: 1.4, export: 3.3, start: 22000, debt: -5000, deadline: 35, warpCars: 10, quotas: [310, 840, 1250],  mandates: 'dealt2', natives: ['surface', 'sky', 'earth', 'fire', 'deep', 'water', 'space'], milestoneSlots: 3 },
};
/** Number of priority districts dealt: 2 in Charters I-III, 3 from IV on. */
export const PRIORITY_COUNT = { I: 2, II: 2, III: 2, IV: 3, V: 3, VI: 3, G: 3 };
export const PRIORITY_MIN_DEG = 45;
export const PRIORITY_FRONTIER_DEG = 90;
export const PRIORITY_MIN_DENSITY = 3;

export const MANDATES = {
  atlanteanTrade: { name: 'Atlantean Trade', text: 'Exports from Atlantis cells x2.' },
  heritageCapital: { name: 'Heritage Capital', text: 'No new demolition in the Capital.' },
  frontierLink: { name: 'Frontier Link', text: 'The priority district farthest from your start (always at least 90° away) must be linked to the Terminal before Quota I counts.' },
  narrowYard: { name: 'Narrow Yard', text: "The Terminal's yard holds one departure's load and the launch ring fires every 60 s until Twin Launch Ring is bought." },
};
/** The tutorial term (Charter I, the Capital): its own start money; builds can't take money below zero (no debt);
 *  no disasters until `firstDisasterAfterQuotaI` minutes after Quota I. Tuned with tools/solve.mjs's tutorial script. */
export const TUTORIAL = { start: 7800, firstDisasterAfterQuotaI: 3, firstLineTrains: 1 };
/** Charter I is the founding Charter: no mandate (requests 35-37: the First Crossing Grant is gone). */
export const NO_MANDATE_TEXT = 'Founding Charter: no mandate. Your first crossing is yours to fund.';
/** Charter VI and Galactic deal two mandates from these (term stream). */
export const DEALT_MANDATE_POOL = ['atlanteanTrade', 'heritageCapital', 'frontierLink', 'narrowYard'];

/** Unlock order: Commending a Charter unlocks the next Charter and this starting region. */
export const UNLOCKS = {
  I: { charter: 'II', region: 'brine' }, II: { charter: 'III', region: 'rift' }, III: { charter: 'IV', region: 'spires' },
  IV: { charter: 'V', region: 'flats' }, V: { charter: 'VI', region: 'ringside' }, VI: { charter: 'G', region: null }, G: { charter: null, region: null },
};
/** The region each Charter's recorded solution starts from. */
export const SOLUTION_REGION = { I: 'capital', II: 'brine', III: 'rift', IV: 'spires', V: 'flats', VI: 'ringside', G: 'ringside' };

// ---------------------------------------------------------------- disasters
export const DISASTER_IDS = ['meteor', 'seaquake', 'caveIn', 'coreFlare', 'solarStorm', 'blackout', 'warpDrift'];
export const DISASTERS = {
  meteor:     { name: 'Meteor Shower', home: 'spires', hits: 'sky', segments: 2, repairPerSegment: 200, repairSeconds: 15 },
  seaquake:   { name: 'Seaquake', home: 'brine', hits: 'water', repair: 300, repairSeconds: 15, hullsSpeed: 0.5, hullsSeconds: 60 },
  caveIn:     { name: 'Cave-in', home: null, hits: 'earth', repair: 400, repairSeconds: 20 },
  coreFlare:  { name: 'Core Flare', home: 'rift', hits: 'fire', capacityMult: 0.5, seconds: 60, coolant: 500 },
  solarStorm: { name: 'Solar Storm', home: 'ringside', hits: 'space', speedMult: 0.5, shieldMult: 0.75, seconds: 60 },
  blackout:   { name: 'Blackout', home: null, hits: 'stations', radius: 2, bracedRadius: 1, seconds: 45, restore: 300 },
  warpDrift:  { name: 'Warp Drift', home: 'terminal', hits: 'deep', departures: 2, delay: 15 },
};
export const DISASTER_WARNING_SECONDS = 15;
export const DISASTER_TIMELINE_LENGTH = 40;
export const DISASTER_JITTER = 0.4;
export const BRACE_SHARE = 0.5;
/** first: minutes until the first disaster; gap / gapLate: mean gap before / after Quota II (minutes). */
export const DISASTER_PACING = {
  I:   { first: 12, gap: 5, gapLate: 4, pool: ['blackout', 'meteor', 'caveIn'] },
  II:  { first: 8, gap: 5, gapLate: 4, pool: ['blackout', 'meteor', 'caveIn', 'seaquake'] },
  III: { first: 7, gap: 4.5, gapLate: 3.5, pool: ['blackout', 'meteor', 'caveIn', 'seaquake', 'coreFlare'] },
  IV:  { first: 6, gap: 4.5, gapLate: 3.5, pool: ['blackout', 'meteor', 'caveIn', 'seaquake', 'coreFlare', 'solarStorm'] },
  V:   { first: 5, gap: 4, gapLate: 3, pool: DISASTER_IDS.slice() },
  VI:  { first: 4, gap: 3.5, gapLate: 2.5, pool: DISASTER_IDS.slice() },
  G:   { first: 4, gap: 3.5, gapLate: 2.5, pool: DISASTER_IDS.slice() },
};

// ---------------------------------------------------------------- tech tree
export const TECH_PRICES = [600, 1200, 2000, 3000];   // x Charter price multiplier
export const TECH_BRANCHES = ['surface', 'sky', 'water', 'earth', 'fire', 'space', 'deep'];
/** 28 nodes; `tier` 1..4 within its branch; bought left to right. `price` overrides the tier price. */
export const TECH = [
  { id: 'expressCars', branch: 'surface', tier: 1, name: 'Express Cars', text: '+25% surface speed', effect: { speed: { surface: 1.25 } } },
  { id: 'longConsists', branch: 'surface', tier: 2, name: 'Long Consists', text: '+1 surface car', effect: { cars: { surface: 1 } } },
  { id: 'cutAndCover', branch: 'surface', tier: 3, name: 'Cut-and-Cover', text: '-25% demolition for surface lines', effect: { surfaceDemolition: 0.75 } },
  { id: 'elevatedViaducts', branch: 'surface', tier: 4, name: 'Elevated Viaducts', text: 'Surface lines cross up to 2 ocean cells at 3x track cost', effect: { viaducts: true } },
  { id: 'longArcs', branch: 'sky', tier: 1, name: 'Long Arcs', text: 'Sky arcs reach 4,500 miles (was 3,000)', effect: { skyRange: 90 } },
  { id: 'meteorNetting', branch: 'sky', tier: 2, name: 'Meteor Netting', text: 'Meteors break 1 segment, not 2', effect: { meteorSegments: 1 } },
  { id: 'cloudLiners', branch: 'sky', tier: 3, name: 'Cloud Liners', text: '+50% sky car capacity', effect: { carCap: { sky: 1.5 } } },
  { id: 'skyLifts', branch: 'sky', tier: 4, name: 'Sky Lifts', text: 'Sky Port catchment 2 rings', effect: { skyCatchment: 2 } },
  { id: 'seaStations', branch: 'water', tier: 1, price: 1200, unlock: 'water', name: 'Sea Stations', text: 'Unlocks water routes (free from Charter II)', effect: {} },
  { id: 'atlantisCharter', branch: 'water', tier: 2, name: 'Atlantis Charter', text: 'Atlantis density +1', effect: { atlantisDensity: 1 } },
  { id: 'pressureHulls', branch: 'water', tier: 3, name: 'Pressure Hulls', text: 'Seaquakes slow water lines (x0.5) instead of stopping them', effect: { pressureHulls: true } },
  { id: 'abyssalExpress', branch: 'water', tier: 4, name: 'Abyssal Express', text: '+30% water speed', effect: { speed: { water: 1.3 } } },
  { id: 'deepBore', branch: 'earth', tier: 1, name: 'Deep Bore', text: 'Earth lines dig deeper and reach farther: 83° → 106° apart (the Rift 64° → 91°, the Spires 91° → 113°)', effect: { crust: 15 } },
  { id: 'drillHeads', branch: 'earth', tier: 2, name: 'Drill Heads', text: '-30% earth track cost', effect: { trackCost: { earth: 0.7 } } },
  { id: 'tunnelBracing', branch: 'earth', tier: 3, name: 'Tunnel Bracing', text: 'No cave-ins', effect: { noCaveIn: true } },
  { id: 'fastShafts', branch: 'earth', tier: 4, name: 'Fast Shafts', text: '+50% speed in shafts', effect: { shaftSpeed: 1.5 } },
  { id: 'heatShielding', branch: 'fire', tier: 1, name: 'Heat Shielding', text: 'No core flares', effect: { noCoreFlare: true } },
  { id: 'plasmaDrive', branch: 'fire', tier: 2, name: 'Plasma Drive', text: '+40% fire speed', effect: { speed: { fire: 1.4 } } },
  { id: 'wideShafts', branch: 'fire', tier: 3, name: 'Wide Shafts', text: 'Core Exchange transfer x1.5', effect: { wideShafts: true } },
  { id: 'magmaExpress', branch: 'fire', tier: 4, name: 'Magma Express', text: '+1 fire car', effect: { cars: { fire: 1 } } },
  { id: 'spaceElevators', branch: 'space', tier: 1, price: 3000, unlock: 'space', name: 'Space Elevators', text: 'Unlocks space routes (free from Charter IV)', effect: {} },
  { id: 'cheapElevators', branch: 'space', tier: 2, name: 'Cheap Elevators', text: 'Elevator price halved', effect: { cheapElevators: true } },
  { id: 'magneticShield', branch: 'space', tier: 3, name: 'Magnetic Shield', text: 'Solar storms slow the ring x0.75 instead of x0.5', effect: { magneticShield: true } },
  { id: 'polarRing', branch: 'space', tier: 4, name: 'Polar Ring', text: "A second ring along the Warp Terminal's meridian", effect: { polarRing: true } },
  { id: 'biggerInterchanges', branch: 'deep', tier: 1, name: 'Bigger Interchanges', text: '+50% transfer capacity', effect: { biggerInterchanges: true } },
  { id: 'warpConsists', branch: 'deep', tier: 2, name: 'Warp Consists', text: '+2 warp cars', effect: { warpCars: 2 } },
  { id: 'warpAnchor', branch: 'deep', tier: 3, name: 'Warp Anchor', text: 'No warp drift', effect: { noWarpDrift: true } },
  { id: 'twinLaunchRing', branch: 'deep', tier: 4, name: 'Twin Launch Ring', text: 'Deep space departures every 20 s', effect: { twinLaunch: true } },
];

// ---------------------------------------------------------------- milestones
// goal: { kind, n } evaluated by milestones.js. `scaleQ3` goals multiply by the Charter's Quota III.
// bonus: applied once when completed. `pool`: 'base' (starting pool of 10) or 'unlock' (Merit Office, price in Merits).
export const MILESTONES = [
  { id: 'longHaul', pool: 'base', name: 'Long Haul', text: 'Track equal to the circumference: 31,400 miles', goal: { kind: 'trackUnits', n: 628 }, bonus: { fareMult: 1.1 }, bonusText: '+10% fares' },
  { id: 'skyFleet', pool: 'base', name: 'Sky Fleet', text: '6 sky trains running', goal: { kind: 'trainsOfType', type: 'sky', n: 6 }, bonus: { speed: { sky: 1.2 } }, bonusText: 'Sky trains +20% speed' },
  { id: 'coreCommuter', pool: 'base', name: 'Core Commuter', text: '3 through-the-core routes', goal: { kind: 'coreRoutes', n: 3 }, bonus: { freeCoreExchange: 1 }, bonusText: 'A free Core Exchange' },
  { id: 'greenBelt', pool: 'base', name: 'Green Belt', text: '10 park or tree cells', goal: { kind: 'greenCells', n: 10 }, bonus: { parksDouble: true }, bonusText: 'Parks count double for Greenery' },
  { id: 'atlanteanFriend', pool: 'base', name: 'Atlantean Friend', text: 'Serve 3 Atlantis cells', goal: { kind: 'atlantisServed', n: 3 }, bonus: { atlantisDensity: 1 }, bonusText: '+1 density on every Atlantis cell', needs: 'water' },
  { id: 'rushHour', pool: 'base', name: 'Rush Hour', text: 'Commuters delivered per minute >= 1.5 x Quota III', goal: { kind: 'commutersPerMin', q3: 1.5 }, bonus: { carsAll: 1 }, bonusText: '+1 car on every line' },
  { id: 'ringOfFire', pool: 'base', name: 'Ring of Fire', text: '4 fire trains', goal: { kind: 'trainsOfType', type: 'fire', n: 4 }, bonus: { freeTech: 'heatShielding' }, bonusText: 'Heat Shielding free' },
  { id: 'cleanSweep', pool: 'base', name: 'Clean Sweep', text: 'Demolish 25 cells', goal: { kind: 'demolished', n: 25 }, bonus: { demolitionMult: 0.7 }, bonusText: 'Demolition -30%' },
  { id: 'interchangeMaster', pool: 'base', name: 'Interchange Master', text: '4 interchanges of 3+ layers', goal: { kind: 'interchanges3', n: 4 }, bonus: { transferMult: 1.5 }, bonusText: '+50% transfer everywhere' },
  { id: 'steadyExports', pool: 'base', name: 'Steady Exports', text: 'Throughput >= Quota II for 3 min', goal: { kind: 'throughputHold', quota: 1, seconds: 180 }, bonus: { warpCars: 1 }, bonusText: '+1 warp car' },
  // 20 unlockable cards (Merit Office)
  { id: 'tenOfEach', pool: 'unlock', price: 4, name: 'Ten of Each', text: '10 trains of each available type', goal: { kind: 'trainsEachType', n: 10 }, bonus: { speedAll: 1.1 }, bonusText: 'Every train +10% speed' },
  { id: 'everyPeak', pool: 'unlock', price: 4, name: 'Every Peak', text: 'A Sky Port on every peak', goal: { kind: 'skyPortsAllPeaks' }, bonus: { cars: { sky: 1 } }, bonusText: '+1 sky car' },
  { id: 'untouchable', pool: 'unlock', price: 3, name: 'Untouchable', text: 'No disaster damage for 10 min', goal: { kind: 'noDamageSeconds', n: 600 }, bonus: { cash: 3000 }, bonusText: fmtMoney(3000, { sign: true }) },
  { id: 'everyDistrict', pool: 'unlock', price: 4, name: 'Every District', text: '80% of city cells served', goal: { kind: 'servedShare', n: 0.8 }, bonus: { exportMult: 1.1 }, bonusText: 'Exports +10%' },
  { id: 'fiveAttractions', pool: 'unlock', price: 3, name: 'Five Attractions', text: 'Five attractions', goal: { kind: 'attractions', n: 5 }, bonus: { attractionMult: 1.5 }, bonusText: 'Attractions +50% stronger' },
  { id: 'halfWayRound', pool: 'unlock', price: 2, name: 'Half Way Round', text: 'A working route between two places 170°+ apart', goal: { kind: 'routeAngle', n: 170 }, bonus: { fareMult: 1.1 }, bonusText: '+10% fares' },
  { id: 'deepDiver', pool: 'unlock', price: 3, name: 'Deep Diver', text: '4 Core Exchanges', goal: { kind: 'coreExchanges', n: 4 }, bonus: { coreTransferMult: 1.25 }, bonusText: 'Core Exchange transfer +25%' },
  { id: 'islandHopper', pool: 'unlock', price: 2, name: 'Island Hopper', text: 'Serve 10 island-city cells', goal: { kind: 'islandServed', n: 10 }, bonus: { speed: { water: 1.2 } }, bonusText: 'Water trains +20% speed', needs: 'water' },
  { id: 'ringMaster', pool: 'unlock', price: 3, name: 'Ring Master', text: '3 space lines', goal: { kind: 'linesOfType', type: 'space', n: 3 }, bonus: { elevatorMult: 0.75 }, bonusText: 'Elevators -25%', needs: 'space' },
  { id: 'greenWave', pool: 'unlock', price: 2, name: 'Green Wave', text: 'Greenery score >= 4% of city cells', goal: { kind: 'greeneryShare', n: 0.04 }, bonus: { genMult: 1.05 }, bonusText: '+5% generation everywhere' },
  { id: 'noTurnAway', pool: 'unlock', price: 3, name: 'Nobody Left Behind', text: '5 min with nobody turned away (after Quota I)', goal: { kind: 'noTurnAwaySeconds', n: 300 }, bonus: { cash: 2000 }, bonusText: fmtMoney(2000, { sign: true }) },
  { id: 'megaHub', pool: 'unlock', price: 3, name: 'Mega Hub', text: 'One interchange with 4 layers', goal: { kind: 'maxLayers', n: 4 }, bonus: { transferMult: 1.25 }, bonusText: '+25% transfer everywhere' },
  { id: 'grandTour', pool: 'unlock', price: 3, name: 'Grand Tour', text: 'Track twice the circumference (62,800 miles)', goal: { kind: 'trackUnits', n: 1256 }, bonus: { cars: { surface: 1 } }, bonusText: '+1 surface car' },
  { id: 'quickStart', pool: 'unlock', price: 2, name: 'Quick Start', text: 'Quota I before 8 minutes', goal: { kind: 'quotaBy', quota: 0, seconds: 480 }, bonus: { cash: 2000 }, bonusText: fmtMoney(2000, { sign: true }) },
  { id: 'fullHouse', pool: 'unlock', price: 3, name: 'Full House', text: '30 stations', goal: { kind: 'stations', n: 30 }, bonus: { stationUpkeepMult: 0.5 }, bonusText: 'Station upkeep halved' },
  { id: 'deepRoots', pool: 'unlock', price: 2, name: 'Deep Roots', text: '5 earth chords', goal: { kind: 'linesOfType', type: 'earth', n: 5, chordsOnly: true }, bonus: { trackCost: { earth: 0.8 } }, bonusText: 'Earth track -20%' },
  { id: 'skyHigh', pool: 'unlock', price: 2, name: 'Sky High', text: '15,000 miles of sky arcs', goal: { kind: 'trackOfType', type: 'sky', n: 300 }, bonus: { skyRangeAdd: 15 }, bonusText: 'Sky arcs reach 750 miles farther' },
  { id: 'tidewater', pool: 'unlock', price: 2, name: 'Tidewater', text: '3 water lines', goal: { kind: 'linesOfType', type: 'water', n: 3 }, bonus: { cars: { water: 1 } }, bonusText: '+1 water car', needs: 'water' },
  { id: 'exportBaron', pool: 'unlock', price: 4, name: 'Export Baron', text: 'Launch 10,000 exports', goal: { kind: 'launchedTotal', n: 10000 }, bonus: { warpCars: 1 }, bonusText: '+1 warp car' },
  { id: 'solvent', pool: 'unlock', price: 2, name: 'Solvent', text: 'Hold ' + fmtMoney(20000), goal: { kind: 'cash', n: 20000, amount: 20000 }, bonus: { fareMult: 1.1 }, bonusText: '+10% fares' },
];
export const MILESTONES_DEALT = 3;

// ---------------------------------------------------------------- Merit Office (meta, used by the browser)
export const MERITS = {
  perQuota: 1, perMilestone: 1, perStar: 1, overtimePenalty: 1,
  perks: [
    { id: 'cash', name: fmtMoney(3000, { sign: true }) + ' starting money', price: 3, effect: { cash: 3000 } },
    { id: 'freeTech', name: 'One free tech node', price: 4, effect: { freeTechNode: 1 } },
    { id: 'corePair', name: 'A free Core Exchange pair', price: 5, effect: { freeCorePair: true } },
    { id: 'elevator', name: 'A Space Elevator already built', price: 5, effect: { freeElevator: true } },
    { id: 'reroll', name: 'Reroll the dealt milestones', price: 2, effect: { reroll: true } },
  ],
  liveries: [
    { id: 'classic', name: 'Classic', price: 0, tint: '#ffffff', capsule: null },
    { id: 'gilded', name: 'Gilded', price: 1, tint: '#ffe6b0', capsule: '#c9a24a' },
    { id: 'midnight', name: 'Midnight', price: 1, tint: '#9aa6c8', capsule: '#1c2238' },
    { id: 'pearl', name: 'Pearl', price: 1, tint: '#f4f1ea', capsule: '#e9e4da' },
    { id: 'rust', name: 'Foundry Rust', price: 1, tint: '#d9a48a', capsule: '#6b3b2a' },
    { id: 'verdigris', name: 'Verdigris', price: 1, tint: '#b6d6c8', capsule: '#3f6b5e' },
  ],
};

// ---------------------------------------------------------------- solver (tools/solve.mjs)
/** Each starting region's fixed tech priority list. */
export const SOLVER_TECH_PRIORITY = {
  capital: ['biggerInterchanges', 'deepBore', 'warpConsists', 'drillHeads', 'twinLaunchRing', 'warpAnchor', 'heatShielding'],
  brine: ['biggerInterchanges', 'atlantisCharter', 'warpConsists', 'deepBore', 'twinLaunchRing', 'warpAnchor', 'heatShielding'],
  rift: ['biggerInterchanges', 'heatShielding', 'warpConsists', 'wideShafts', 'twinLaunchRing', 'warpAnchor', 'deepBore'],
  spires: ['biggerInterchanges', 'longArcs', 'warpConsists', 'deepBore', 'twinLaunchRing', 'warpAnchor', 'cloudLiners'],
  flats: ['biggerInterchanges', 'twinLaunchRing', 'warpConsists', 'deepBore', 'drillHeads', 'warpAnchor', 'heatShielding'],
  ringside: ['biggerInterchanges', 'warpConsists', 'twinLaunchRing', 'cheapElevators', 'warpAnchor', 'deepBore', 'magneticShield'],
};
export const SOLVER = {
  everySeconds: 30, lookahead: 180, sweepLookahead: 180, clusters: 5, sweepClusters: 5,
  minMoney: 500, parkMoney: 1000, idleGapLimit: 180,
  sweepRealLimitMs: 400000, // a sweep run's real-time budget before its lookahead is shortened (was 90 s: under machine load that cut quality)
  tutorialTermSeed: 1,
};

// ---------------------------------------------------------------- Oikumene build parameters (tools/oikumene.mjs)
export const OIKUMENE = {
  mapSeed: 'oikumene-1',
  gridDetail: 3,                 // icosphere subdivisions → 642 cells
  orientation: {anchor: 15, twistDeg: 18}, // tuned by tools/oikumene.mjs --tune
  regionTuning: {"brine":{"weight":0.997,"reach":67},"spires":{"weight":1,"reach":47.08},"rift":{"weight":1,"reach":38.47},"flats":{"weight":1.1,"reach":52.19}},
  overrides: [[268,"area",5],[288,"area",5],[296,"area",5],[317,"area",5],[323,"area",5],[339,"area",5],[344,"area",5],[348,"area",5],[368,"area",5],[374,"area",5],[387,"area",5],[395,"area",5],[400,"area",5],[417,"area",5],[373,"area",6],[345,"area",6],[297,"area",6],[324,"area",6],[318,"area",6],[273,"area",6],[267,"area",6],[363,"area",6],[390,"area",6],[246,"area",6],[293,"area",6],[302,"area",6],[637,"area",4],[626,"area",4],[627,"area",4],[617,"area",4],[601,"area",4],[577,"area",4],[608,"area",4],[612,"area",4],[611,"area",4],[598,"area",4]], // [cellId, 'area', areaIndex] boundary fixes found by --tune
};

// ---------------------------------------------------------------- frozen cell table
// Written by tools/oikumene.mjs. Row: [area, terrain, density, height, peak]
//   area: index in AREA_IDS; terrain: 0 city, 1 mountain, 2 ocean, 3 atlantis, 4 warp terminal;
//   density: base density (0 for peaks, ocean, terminal; 4 for Atlantis); height: ground above 100 (mountains 3..12); peak: 0/1.
// BEGIN OIKUMENE_CELLS
// generated by tools/oikumene.mjs — do not edit by hand. geo table hash 80f20b20
export const OIKUMENE_GRID = {
  pos: [
    [-0.063615539927,0.996942372726,0.045375858589],[0.030461846637,0.996203036225,-0.081557259126],[0.080629495735,0.995557687753,0.048618666916],[-0.112494177699,0.990112406991,-0.083800247653],
    [-0.013520430782,0.984708571046,0.17368427695],[0.172794056473,0.981892870122,-0.077644096055],[-0.020310518873,0.976346358209,-0.215256292903],[-0.216870288248,0.976112630335,0.013092401481],
    [-0.167221595417,0.97542512785,0.143466922964],[0.140513651731,0.969745221163,0.199624947613],[0.123865604311,0.969486537557,-0.21154944],[0.235063724201,0.96927486384,0.072465742885],
    [-0.159221675247,0.964349278057,-0.211373905776],[-0.265524742173,0.956427986994,-0.121417119832],[0.036833219233,0.953644939594,0.298671463563],[-0.107337439421,0.949612661259,0.294473203661],
    [0.260703854069,0.944050591312,-0.201995003694],[0.329827789436,0.94216927317,-0.059419609644],[-0.316805209396,0.942123480756,0.109716937195],[-0.06588187153,0.937651072291,-0.341277080442],
    [0.072400563973,0.937226524853,-0.341122557812],[0.2910878218,0.930903525534,0.220650189548],[-0.368000742842,0.929532996693,-0.023320834593],[-0.261127363193,0.928970031031,0.262349350366],
    [0.190738199806,0.927117516981,0.322601997579],[-0.202904498331,0.920145634558,-0.334905622169],[0.209298538798,0.918880110541,-0.334445009096],[-0.310248650165,0.917801537692,-0.247762209549],
    [0.389771008453,0.916331348054,0.091735606729],[-0.056593935079,0.907027111091,0.417251658186],[0.086482535734,0.904345484465,0.417947383938],[-0.411660154066,0.897907023142,-0.155881029464],
    [0.415258702737,0.891159241627,-0.182744126758],[-0.198511444069,0.891134136169,0.408011222798],[-0.020310518873,0.886288780251,-0.462687454795],[-0.458588027704,0.885623626837,0.073265356302],
    [0.342194257552,0.88296265382,-0.321372123959],[-0.414458841654,0.881712023957,0.225405801578],[0.123865604311,0.878651133642,-0.461117661143],[0.478098100495,0.877412531317,-0.039616362664],
    [0.343224710942,0.87493398827,0.341595248749],[-0.159221675247,0.874602933325,-0.457949961405],[0.434494443632,0.869139895615,0.236242291521],[0.240530749426,0.863913337965,0.44249147231],
    [-0.310248650165,0.862335246282,-0.40015459274],[-0.505199795313,0.860842518512,-0.061019055533],[-0.354515622637,0.855874098841,0.37656101795],[-0.417075466698,0.854060178623,-0.310852483291],
    [0.260703854069,0.85302459509,-0.452086872895],[-0.004683473875,0.843994966749,0.536330645381],[0.529165136303,0.842061012521,0.104486887759],[0.134478112769,0.837752921478,0.529231215765],
    [-0.14864163621,0.834980447407,0.529823854156],[0.468546456926,0.830160976777,-0.302153885196],[0.537522390433,0.827926011226,-0.160025622069],[-0.520860408711,0.826281039091,-0.214392348456],
    [0.030461846637,0.815559795764,-0.577870483268],[-0.551884270188,0.812599717249,0.187364489286],[-0.112494177699,0.812335868318,-0.572237273364],[-0.284797438142,0.810712931141,0.511502651517],
    [-0.265524742173,0.810711764912,-0.52176914965],[-0.589078886803,0.807316780009,0.035009739184],[0.596605143896,0.802458981183,-0.011040190025],[0.172794056473,0.802082239804,-0.57166974263],
    [0.482379701956,0.801171206018,0.354167364093],[0.388332855112,0.801047070132,0.455544932002],[0.415258702737,0.800133245405,-0.43283599596],[-0.501100431242,0.797873752586,0.335105703835],
    [-0.411660154066,0.78803507984,-0.457751712717],[0.567202370256,0.785975156957,0.246017324233],[0.286860215732,0.785605123056,0.548211462174],[-0.611768426185,0.782155024315,-0.118207066888],
    [-0.520860408711,0.770776743649,-0.366889146865],[0.042493437097,0.765755588456,0.641726333067],[-0.437977836622,0.763501488143,0.474595503803],[-0.095727862927,0.761727568421,0.640786460349],
    [0.585939000333,0.761484765546,-0.277157788506],[0.329827789436,0.759937725041,-0.560096673241],[0.641178860924,0.755749505386,0.133162883018],[0.179902167584,0.755140649345,0.630394963341],
    [0.652893971989,0.745964105936,-0.131404010572],[-0.232118632155,0.743133613989,0.627593317656],[-0.216870288248,0.739330022873,-0.637462465839],[-0.661693472747,0.738353339443,0.130369069403],
    [-0.61939419657,0.737734016099,-0.268513222666],[0.537522390433,0.737090607311,-0.409593843211],[-0.063615539927,0.734535125057,-0.675582129084],[-0.617702542275,0.734088880829,0.282058654025],
    [0.080629495735,0.731389957815,-0.677176206039],[-0.368000742842,0.727053930336,-0.579627497321],[0.499675199794,0.716662165667,0.486538831968],[0.702894578039,0.711072233351,0.017762069716],
    [0.591273199417,0.710535984526,0.3814899977],[-0.364070774099,0.710329283146,0.602399187376],[-0.705064668669,0.709131114727,-0.004107933904],[-0.558619788813,0.708621850786,0.431044086069],
    [0.395641548622,0.706996801146,0.586193899809],[-0.505199795313,0.698665920558,-0.506595596375],[0.478098100495,0.697601900999,-0.53364200924],[0.235063724201,0.695927541646,-0.678549852511],
    [0.685943892088,0.683457101432,0.249734593938],[0.289052858968,0.68137867817,0.67243701687],[0.692127079844,0.678247262853,-0.246861815151],[-0.611768426185,0.675147548007,-0.412207691757],
    [-0.001123399204,0.674768199519,0.738028871313],[-0.721121798578,0.67457071924,-0.15791673869],[0.13802588405,0.669110991127,0.730232385536],[-0.145050813228,0.664292071116,0.733264144654],
    [-0.489061068749,0.663941868053,0.565685837617],[0.652893971989,0.655906527977,-0.378835172465],[-0.721654999888,0.655270932005,0.223235451499],[-0.167221595417,0.655000238387,-0.736893225467],
    [0.751169379089,0.652797670196,-0.097978394077],[-0.316805209396,0.651183769363,-0.689633350279],[0.753055632747,0.64418715858,0.133903393194],[0.389771008453,0.64298402586,-0.659279988668],
    [-0.013520430782,0.64268842772,-0.766008343836],[-0.281199080837,0.639666413751,0.715369803707],[-0.671901183693,0.638353049203,0.375571809279],[-0.458588027704,0.631332994783,-0.625392413245],
    [-0.770562208144,0.630836923226,0.090987140161],[0.596605143896,0.621815740723,-0.507353414167],[-0.721121798578,0.618258073957,-0.312634460036],[0.600784920085,0.617601058022,0.50756912133],
    [0.140513651731,0.614551495003,-0.776261794543],[0.50186934537,0.612364307587,0.610849502718],[-0.604699422182,0.60485839981,0.518155309721],[0.703637778021,0.598810667622,0.382517531211],
    [-0.589078886803,0.595936706597,-0.545752239439],[0.392676213342,0.594587223047,0.70162057101],[-0.803689418416,0.593484287929,-0.043124456025],[-0.434379479317,0.592454970753,0.678462655994],
    [0.246291071246,0.59009867678,0.76884605734],[0.808004771185,0.589047569118,0.012298416927],[0.785080141932,0.582040155875,-0.211845291886],[0.529165136303,0.577893282583,-0.621307985195],
    [0.2910878218,0.571282264899,-0.767401103604],[0.093510236975,0.570286434569,0.816106131657],[-0.049452909977,0.567581255472,0.821830839121],[0.78779519878,0.564110063805,0.247302569118],
    [0.751169379089,0.563051325464,-0.344554449706],[-0.767816869748,0.559658279105,0.311833072588],[-0.191403332957,0.553252834317,0.810725641295],[-0.705064668669,0.545866478894,-0.45267383425],
    [-0.814510058023,0.545162141767,-0.198422792452],[-0.261127363193,0.542997418271,-0.798101687721],[0.036833219233,0.538552090539,-0.841786766193],[-0.107337439421,0.538161775575,-0.835978813971],
    [-0.55502896583,0.537933474495,0.634484376567],[-0.823451908217,0.535985240833,0.18613644582],[-0.708774570502,0.534208686448,0.460716493662],[0.702894578039,0.533295694679,-0.470674955995],
    [-0.414458841654,0.530542539977,-0.739424426056],[0.846701826042,0.521873019545,-0.103656014046],[0.434494443632,0.513946169455,-0.739644450635],[-0.347311809994,0.513443661822,0.784697465762],
    [0.848653535998,0.513172801832,0.12822188307],[0.59550332213,0.50945874377,0.621150208668],[-0.862609909275,0.503285964101,0.051062537724],[0.190738199806,0.502848655097,-0.843067120223],
    [-0.551884270188,0.50205192567,-0.665858555738],[0.488790720458,0.496425930671,0.717387570948],[0.351228930152,0.494456535867,0.795079224205],[0.641178860924,0.493342257717,-0.587795104655],
    [0.705863878552,0.492993843192,0.508638629609],[-0.803689418416,0.482355206854,-0.348449096923],[0.200098475559,0.48218044333,0.852914192723],[-0.661693472747,0.48181185024,-0.574472879336],
    [-0.668341109022,0.469126281973,0.577270035212],[0.846701826042,0.466406728134,-0.256048397237],[0.800627943786,0.465888252522,0.37675327708],[-0.88252466739,0.4632239083,-0.081079110918],
    [0.047206465073,0.460556726172,0.886374103657],[-0.493992320131,0.459992450735,0.737820122332],[-0.799296364154,0.453343708464,0.394467748043],[-0.096894599789,0.453216333962,0.88611872295],
    [0.892132677941,0.451726504128,0.006515398566],[0.343224710942,0.450665126387,-0.824073869054],[0.567202370256,0.443955013631,-0.693675296553],[0.808004771185,0.443331347036,-0.388053612891],
    [-0.859801545421,0.432194654673,0.271935806698],[0.870248373136,0.430872764234,0.238781134297],[-0.056593935079,0.426618882206,-0.902659102794],[-0.770562208144,0.424763713215,-0.475194351099],
    [0.086482535734,0.424117433138,-0.901468343272],[-0.198511444069,0.420383794458,-0.885364711252],[-0.250321644228,0.415324375503,0.874554022084],[-0.354515622637,0.413588840797,-0.838607741483],
    [0.753055632747,0.407404551118,-0.516651474126],[-0.88252466739,0.406966748775,-0.235644386394],[-0.903865398549,0.40278107266,0.144203844657],[0.90386851711,0.402010238008,-0.146319760505],
    [-0.501100431242,0.395804960118,-0.769569224537],[-0.610561517173,0.394643025211,0.686637834961],[0.444546830768,0.391303576065,0.805766483923],[-0.764269098467,0.391016348754,0.512834242358],
    [0.575558456022,0.388771864449,0.719436516389],[0.482379701956,0.386078356963,-0.786290865663],[0.302588987174,0.384200094975,0.872255806436],[-0.617702542275,0.381040899902,-0.687932701555],
    [0.240530749426,0.377367976091,-0.894280922977],[0.69239792192,0.376667299271,0.61539163415],[0.920503958151,0.372941967853,0.116562222189],[-0.40365312269,0.368066368428,0.837610473296],
    [0.153180398481,0.367636332461,0.917267296144],[-0.930645324135,0.365665415884,0.013714382653],[0.685943892088,0.363032211968,-0.630625554493],[-0.721654999888,0.358473673934,-0.592208313209],
    [0.792188253043,0.355287935098,0.496193767509],[-0.862609909275,0.352717049531,-0.362622155128],[0,0.342020143326,0.939692620786],[0.892132677941,0.341854560826,-0.295355284687],
    [-0.857608902185,0.327968209787,0.396161361395],[0.872472280254,0.32516020283,0.36477796354],[0.945345255665,0.324520032087,-0.031766277191],[-0.939629230121,0.321557418697,-0.117037329013],
    [-0.714627298647,0.321211882109,0.621394199217],[0.388332855112,0.320819018805,-0.863870795208],[-0.541441430557,0.316203389952,0.779010008575],[0.848653535998,0.310693735475,-0.428084779658],
    [-0.153180398481,0.307982283162,0.938979594442],[-0.913555332323,0.303491688676,0.270757178464],[-0.004683473875,0.301790960753,-0.953362617833],[0.134478112769,0.301572702051,-0.943911829867],
    [0.591273199417,0.299085098841,-0.748962019933],[-0.14864163621,0.299067923081,-0.942583705232],[-0.284797438142,0.292254569148,-0.912949990985],[-0.823451908217,0.290942314249,-0.487113461765],
    [0.931273144356,0.287025947223,0.22438011548],[-0.437977836622,0.279811962847,-0.854330544974],[0.651320226908,0.273683610852,0.707728226915],[0.78779519878,0.273170352412,-0.552047718356],
    [-0.930645324135,0.271300524635,-0.245551025243],[0.945345255665,0.269015736646,-0.1842630756],[-0.953491555309,0.268784368606,0.136414138372],[-0.302588987174,0.266360877053,0.915145774189],
    [-0.558619788813,0.265766033313,-0.785692272511],[-0.817691586398,0.262170579648,0.51249103085],[0.541441430557,0.258512131566,0.800007909404],[0.761201932391,0.256955967897,0.595437023274],
    [0.40365312269,0.256450437745,0.878235349734],[0.286860215732,0.249424903629,-0.924931583459],[-0.671901183693,0.247593900538,-0.698030128124],[-0.651320226908,0.245265126021,0.718071709496],
    [0.250321644228,0.243995559452,0.936912611399],[0.967142972925,0.241824160211,0.078457284302],[0.499675199794,0.236253936783,-0.833371929012],[0.854605690066,0.23023946923,0.4654448424],
    [-0.767816869748,0.228280679404,-0.598619399904],[-0.973597002756,0.228230277783,0.004451575833],[0.096894599789,0.222402281661,0.970128167637],[-0.444546830768,0.21818078215,0.868778027781],
    [-0.047206465073,0.216943370553,0.975042113772],[-0.903865398549,0.21585575789,-0.369369236797],[0.703637778021,0.212838054862,-0.677933506876],[0.920503958151,0.210765369899,-0.329014318654],
    [-0.899522040319,0.196321225574,0.390279483665],[0.924234305633,0.195621348666,0.32790735923],[0.979198531738,0.190667859806,-0.069397425601],[-0.761201932391,0.185899849576,0.621299335306],
    [-0.200098475559,0.178871026015,0.963309792399],[0.870248373136,0.17658213218,-0.459876635251],[0.042493437097,0.174109077619,-0.983809095757],[0.179902167584,0.173261226559,-0.968305611607],
    [-0.973597002756,0.171973118258,-0.150113699644],[-0.095727862927,0.171627573792,-0.980499950114],[-0.232118632155,0.16586416698,-0.958441452943],[0.395641548622,0.164792795149,-0.903499363404],
    [-0.575558456022,0.164628352289,0.80101808302],[-0.951297409732,0.164486510527,0.260724809122],[-0.364070774099,0.156929066408,-0.918055412033],[-0.859801545421,0.156283346382,-0.486124282603],
    [0.714627298647,0.153361914635,0.6824865912],[0.600784920085,0.146850716312,-0.78580681272],[-0.489061068749,0.14499313118,-0.860114098794],[0.610561517173,0.139048196177,0.779666744761],
    [0.969366880043,0.136111598806,0.204454113545],[0.967142972925,0.134816683902,-0.215543340568],[-0.351228930152,0.132291392374,0.926896556325],[-0.604699422182,0.130284603066,-0.785725480697],
    [-0.983591586,0.129283349976,0.125830868108],[0.817691586398,0.128588569018,0.561110906553],[-0.854605690065,0.122808511697,0.50454651318],[0.493992320131,0.121886972051,0.860880452616],
    [-0.953491555309,0.118215454037,-0.27727055448],[0.800627943786,0.114718768543,-0.588076950554],[-0.708774570502,0.113084742015,-0.696312034459],[0.347311809994,0.111073144351,0.931148357268],
    [-0.69239792192,0.107022226025,0.713534414628],[0.899522040319,0.100476032497,0.425164281042],[0.191403332957,0.097308137711,0.976675939331],[-0.799296364154,0.093722447829,-0.593583545108],
    [0.049452909977,0.093470213873,0.994393146001],[0.289052858968,0.089732167333,-0.953098411953],[-0.093510236975,0.087718155431,0.991746621264],[0.994608275318,0.087418131754,0.055789326127],
    [-0.488790720458,0.080843516338,0.86864719965],[0.50186934537,0.076451783261,-0.86155805667],[0.931273144356,0.07564587381,-0.356381863143],[-0.996834375849,0.074711337959,-0.027192703179],
    [-0.924234305633,0.060920140537,0.376934589509],[-0.913555332323,0.058448762092,-0.402492729121],[0.705863878552,0.050708585148,-0.706530129824],[-0.792188253043,0.04678085737,0.608481160863],
    [0.13802588405,0.043184426968,-0.989486715727],[-0.001123399204,0.042506615563,-0.999095553792],[-0.246291071246,0.042162907176,0.968278367766],[0.951297409732,0.041586699485,0.305456682138],
    [-0.145050813228,0.037544142875,-0.988711635877],[0.994608275318,0.031105486471,-0.098928395219],[-0.281199080837,0.030182055536,-0.959174707997],[0.764269098467,0.030107595679,0.644194285763],
    [-0.969366880043,0.027153037027,0.244111786801],[-0.983591586,0.018154268901,-0.17949377279],[-0.434379479317,0.017739449236,-0.900555261985],[0.872472280254,0.014612411251,-0.488445081484],
    [0.668341109022,0.011690444651,0.743763064084],[-0.59550332213,0.008999618223,0.803302433834],[0.392676213342,0.004487228418,-0.919665839453],[-0.55502896583,0.004242253107,-0.831820203156],
    [0.857608902185,0.003409389914,0.514291111097],[-0.857608902185,-0.003409389914,-0.514291111097],[0.55502896583,-0.004242253107,0.831820203156],[-0.392676213342,-0.004487228418,0.919665839453],
    [0.59550332213,-0.008999618223,-0.803302433834],[-0.668341109022,-0.011690444651,-0.743763064084],[-0.872472280254,-0.014612411251,0.488445081484],[0.434379479317,-0.017739449236,0.900555261985],
    [0.983591586,-0.018154268901,0.17949377279],[0.969366880043,-0.027153037027,-0.244111786801],[-0.764269098467,-0.030107595679,-0.644194285763],[0.281199080837,-0.030182055536,0.959174707997],
    [-0.994608275318,-0.031105486471,0.098928395219],[0.145050813228,-0.037544142875,0.988711635877],[-0.951297409732,-0.041586699485,-0.305456682138],[0.246291071246,-0.042162907176,-0.968278367766],
    [0.001123399204,-0.042506615563,0.999095553792],[-0.13802588405,-0.043184426968,0.989486715727],[0.792188253043,-0.04678085737,-0.608481160863],[-0.705863878552,-0.050708585148,0.706530129824],
    [0.913555332323,-0.058448762092,0.402492729121],[0.924234305633,-0.060920140537,-0.376934589509],[0.996834375849,-0.074711337959,0.027192703179],[-0.931273144356,-0.07564587381,0.356381863143],
    [-0.50186934537,-0.076451783261,0.86155805667],[0.488790720458,-0.080843516338,-0.86864719965],[-0.994608275318,-0.087418131754,-0.055789326127],[0.093510236975,-0.087718155431,-0.991746621264],
    [-0.289052858968,-0.089732167333,0.953098411953],[-0.049452909977,-0.093470213873,-0.994393146001],[0.799296364154,-0.093722447829,0.593583545108],[-0.191403332957,-0.097308137711,-0.976675939331],
    [-0.899522040319,-0.100476032497,-0.425164281042],[0.69239792192,-0.107022226025,-0.713534414628],[-0.347311809994,-0.111073144351,-0.931148357268],[0.708774570502,-0.113084742015,0.696312034459],
    [-0.800627943786,-0.114718768543,0.588076950554],[0.953491555309,-0.118215454037,0.27727055448],[-0.493992320131,-0.121886972051,-0.860880452616],[0.854605690065,-0.122808511697,-0.50454651318],
    [-0.817691586398,-0.128588569018,-0.561110906553],[0.983591586,-0.129283349976,-0.125830868108],[0.604699422182,-0.130284603066,0.785725480697],[0.351228930152,-0.132291392374,-0.926896556325],
    [-0.967142972925,-0.134816683902,0.215543340568],[-0.969366880043,-0.136111598806,-0.204454113545],[-0.610561517173,-0.139048196177,-0.779666744761],[0.489061068749,-0.14499313118,0.860114098794],
    [-0.600784920085,-0.146850716312,0.78580681272],[-0.714627298647,-0.153361914635,-0.6824865912],[0.859801545421,-0.156283346382,0.486124282603],[0.364070774099,-0.156929066408,0.918055412033],
    [0.951297409732,-0.164486510527,-0.260724809122],[0.575558456022,-0.164628352289,-0.80101808302],[-0.395641548622,-0.164792795149,0.903499363404],[0.232118632155,-0.16586416698,0.958441452943],
    [0.095727862927,-0.171627573792,0.980499950114],[0.973597002756,-0.171973118258,0.150113699644],[-0.179902167584,-0.173261226559,0.968305611607],[-0.042493437097,-0.174109077619,0.983809095757],
    [-0.870248373136,-0.17658213218,0.459876635251],[0.200098475559,-0.178871026015,-0.963309792399],[0.761201932391,-0.185899849576,-0.621299335306],[-0.979198531738,-0.190667859806,0.069397425601],
    [-0.924234305633,-0.195621348666,-0.32790735923],[0.899522040319,-0.196321225574,-0.390279483665],[-0.920503958151,-0.210765369899,0.329014318654],[-0.703637778021,-0.212838054862,0.677933506876],
    [0.903865398549,-0.21585575789,0.369369236797],[0.047206465073,-0.216943370553,-0.975042113772],[0.444546830768,-0.21818078215,-0.868778027781],[-0.096894599789,-0.222402281661,-0.970128167637],
    [0.973597002756,-0.228230277783,-0.004451575833],[0.767816869748,-0.228280679404,0.598619399904],[-0.854605690066,-0.23023946923,-0.4654448424],[-0.499675199794,-0.236253936783,0.833371929012],
    [-0.967142972925,-0.241824160211,-0.078457284302],[-0.250321644228,-0.243995559452,-0.936912611399],[0.651320226908,-0.245265126021,-0.718071709496],[0.671901183693,-0.247593900538,0.698030128124],
    [-0.286860215732,-0.249424903629,0.924931583459],[-0.40365312269,-0.256450437745,-0.878235349734],[-0.761201932391,-0.256955967897,-0.595437023274],[-0.541441430557,-0.258512131566,-0.800007909404],
    [0.817691586398,-0.262170579648,-0.51249103085],[0.558619788813,-0.265766033313,0.785692272511],[0.302588987174,-0.266360877053,-0.915145774189],[0.953491555309,-0.268784368606,-0.136414138372],
    [-0.945345255665,-0.269015736646,0.1842630756],[0.930645324135,-0.271300524635,0.245551025243],[-0.78779519878,-0.273170352412,0.552047718356],[-0.651320226908,-0.273683610852,-0.707728226915],
    [0.437977836622,-0.279811962847,0.854330544974],[-0.931273144356,-0.287025947223,-0.22438011548],[0.823451908217,-0.290942314249,0.487113461765],[0.284797438142,-0.292254569148,0.912949990985],
    [0.14864163621,-0.299067923081,0.942583705232],[-0.591273199417,-0.299085098841,0.748962019933],[-0.134478112769,-0.301572702051,0.943911829867],[0.004683473875,-0.301790960753,0.953362617833],
    [0.913555332323,-0.303491688676,-0.270757178464],[0.153180398481,-0.307982283162,-0.938979594442],[-0.848653535998,-0.310693735475,0.428084779658],[0.541441430557,-0.316203389952,-0.779010008575],
    [-0.388332855112,-0.320819018805,0.863870795208],[0.714627298647,-0.321211882109,-0.621394199217],[0.939629230121,-0.321557418697,0.117037329013],[-0.945345255665,-0.324520032087,0.031766277191],
    [-0.872472280254,-0.32516020283,-0.36477796354],[0.857608902185,-0.327968209787,-0.396161361395],[-0.892132677941,-0.341854560826,0.295355284687],[0,-0.342020143326,-0.939692620786],
    [0.862609909275,-0.352717049531,0.362622155128],[-0.792188253043,-0.355287935098,-0.496193767509],[0.721654999888,-0.358473673934,0.592208313209],[-0.685943892088,-0.363032211968,0.630625554493],
    [0.930645324135,-0.365665415884,-0.013714382653],[-0.153180398481,-0.367636332461,-0.917267296144],[0.40365312269,-0.368066368428,-0.837610473296],[-0.920503958151,-0.372941967853,-0.116562222189],
    [-0.69239792192,-0.376667299271,-0.61539163415],[-0.240530749426,-0.377367976091,0.894280922977],[0.617702542275,-0.381040899902,0.687932701555],[-0.302588987174,-0.384200094975,-0.872255806436],
    [-0.482379701956,-0.386078356963,0.786290865663],[-0.575558456022,-0.388771864449,-0.719436516389],[0.764269098467,-0.391016348754,-0.512834242358],[-0.444546830768,-0.391303576065,-0.805766483923],
    [0.610561517173,-0.394643025211,-0.686637834961],[0.501100431242,-0.395804960118,0.769569224537],[-0.90386851711,-0.402010238008,0.146319760505],[0.903865398549,-0.40278107266,-0.144203844657],
    [0.88252466739,-0.406966748775,0.235644386394],[-0.753055632747,-0.407404551118,0.516651474126],[0.354515622637,-0.413588840797,0.838607741483],[0.250321644228,-0.415324375503,-0.874554022084],
    [0.198511444069,-0.420383794458,0.885364711252],[-0.086482535734,-0.424117433138,0.901468343272],[0.770562208144,-0.424763713215,0.475194351099],[0.056593935079,-0.426618882206,0.902659102794],
    [-0.870248373136,-0.430872764234,-0.238781134297],[0.859801545421,-0.432194654673,-0.271935806698],[-0.808004771185,-0.443331347036,0.388053612891],[-0.567202370256,-0.443955013631,0.693675296553],
    [-0.343224710942,-0.450665126387,0.824073869054],[-0.892132677941,-0.451726504128,-0.006515398566],[0.096894599789,-0.453216333962,-0.88611872295],[0.799296364154,-0.453343708464,-0.394467748043],
    [0.493992320131,-0.459992450735,-0.737820122332],[-0.047206465073,-0.460556726172,-0.886374103657],[0.88252466739,-0.4632239083,0.081079110918],[-0.800627943786,-0.465888252522,-0.37675327708],
    [-0.846701826042,-0.466406728134,0.256048397237],[0.668341109022,-0.469126281973,-0.577270035212],[0.661693472747,-0.48181185024,0.574472879336],[-0.200098475559,-0.48218044333,-0.852914192723],
    [0.803689418416,-0.482355206854,0.348449096923],[-0.705863878552,-0.492993843192,-0.508638629609],[-0.641178860924,-0.493342257717,0.587795104655],[-0.351228930152,-0.494456535867,-0.795079224205],
    [-0.488790720458,-0.496425930671,-0.717387570948],[0.551884270188,-0.50205192567,0.665858555738],[-0.190738199806,-0.502848655097,0.843067120223],[0.862609909275,-0.503285964101,-0.051062537724],
    [-0.59550332213,-0.50945874377,-0.621150208668],[-0.848653535998,-0.513172801832,-0.12822188307],[0.347311809994,-0.513443661822,-0.784697465762],[-0.434494443632,-0.513946169455,0.739644450635],
    [-0.846701826042,-0.521873019545,0.103656014046],[0.414458841654,-0.530542539977,0.739424426056],[-0.702894578039,-0.533295694679,0.470674955995],[0.708774570502,-0.534208686448,-0.460716493662],
    [0.823451908217,-0.535985240833,-0.18613644582],[0.55502896583,-0.537933474495,-0.634484376567],[0.107337439421,-0.538161775575,0.835978813971],[-0.036833219233,-0.538552090539,0.841786766193],
    [0.261127363193,-0.542997418271,0.798101687721],[0.814510058023,-0.545162141767,0.198422792452],[0.705064668669,-0.545866478894,0.45267383425],[0.191403332957,-0.553252834317,-0.810725641295],
    [0.767816869748,-0.559658279105,-0.311833072588],[-0.751169379089,-0.563051325464,0.344554449706],[-0.78779519878,-0.564110063805,-0.247302569118],[0.049452909977,-0.567581255472,-0.821830839121],
    [-0.093510236975,-0.570286434569,-0.816106131657],[-0.2910878218,-0.571282264899,0.767401103604],[-0.529165136303,-0.577893282583,0.621307985195],[-0.785080141932,-0.582040155875,0.211845291886],
    [-0.808004771185,-0.589047569118,-0.012298416927],[-0.246291071246,-0.59009867678,-0.76884605734],[0.434379479317,-0.592454970753,-0.678462655994],[0.803689418416,-0.593484287929,0.043124456025],
    [-0.392676213342,-0.594587223047,-0.70162057101],[0.589078886803,-0.595936706597,0.545752239439],[-0.703637778021,-0.598810667622,-0.382517531211],[0.604699422182,-0.60485839981,-0.518155309721],
    [-0.50186934537,-0.612364307587,-0.610849502718],[-0.140513651731,-0.614551495003,0.776261794543],[-0.600784920085,-0.617601058022,-0.50756912133],[0.721121798578,-0.618258073957,0.312634460036],
    [-0.596605143896,-0.621815740723,0.507353414167],[0.770562208144,-0.630836923226,-0.090987140161],[0.458588027704,-0.631332994783,0.625392413245],[0.671901183693,-0.638353049203,-0.375571809279],
    [0.281199080837,-0.639666413751,-0.715369803707],[0.013520430782,-0.64268842772,0.766008343836],[-0.389771008453,-0.64298402586,0.659279988668],[-0.753055632747,-0.64418715858,-0.133903393194],
    [0.316805209396,-0.651183769363,0.689633350279],[-0.751169379089,-0.652797670196,0.097978394077],[0.167221595417,-0.655000238387,0.736893225467],[0.721654999888,-0.655270932005,-0.223235451499],
    [-0.652893971989,-0.655906527977,0.378835172465],[0.489061068749,-0.663941868053,-0.565685837617],[0.145050813228,-0.664292071116,-0.733264144654],[-0.13802588405,-0.669110991127,-0.730232385536],
    [0.721121798578,-0.67457071924,0.15791673869],[0.001123399204,-0.674768199519,-0.738028871313],[0.611768426185,-0.675147548007,0.412207691757],[-0.692127079844,-0.678247262853,0.246861815151],
    [-0.289052858968,-0.68137867817,-0.67243701687],[-0.685943892088,-0.683457101432,-0.249734593938],[-0.235063724201,-0.695927541646,0.678549852511],[-0.478098100495,-0.697601900999,0.53364200924],
    [0.505199795313,-0.698665920558,0.506595596375],[-0.395641548622,-0.706996801146,-0.586193899809],[0.558619788813,-0.708621850786,-0.431044086069],[0.705064668669,-0.709131114727,0.004107933904],
    [0.364070774099,-0.710329283146,-0.602399187376],[-0.591273199417,-0.710535984526,-0.3814899977],[-0.702894578039,-0.711072233351,-0.017762069716],[-0.499675199794,-0.716662165667,-0.486538831968],
    [0.368000742842,-0.727053930336,0.579627497321],[-0.080629495735,-0.731389957815,0.677176206039],[0.617702542275,-0.734088880829,-0.282058654025],[0.063615539927,-0.734535125057,0.675582129084],
    [-0.537522390433,-0.737090607311,0.409593843211],[0.61939419657,-0.737734016099,0.268513222666],[0.661693472747,-0.738353339443,-0.130369069403],[0.216870288248,-0.739330022873,0.637462465839],
    [0.232118632155,-0.743133613989,-0.627593317656],[-0.652893971989,-0.745964105936,0.131404010572],[-0.179902167584,-0.755140649345,-0.630394963341],[-0.641178860924,-0.755749505386,-0.133162883018],
    [-0.329827789436,-0.759937725041,0.560096673241],[-0.585939000333,-0.761484765546,0.277157788506],[0.095727862927,-0.761727568421,-0.640786460349],[0.437977836622,-0.763501488143,-0.474595503803],
    [-0.042493437097,-0.765755588456,-0.641726333067],[0.520860408711,-0.770776743649,0.366889146865],[0.611768426185,-0.782155024315,0.118207066888],[-0.286860215732,-0.785605123056,-0.548211462174],
    [-0.567202370256,-0.785975156957,-0.246017324233],[0.411660154066,-0.78803507984,0.457751712717],[0.501100431242,-0.797873752586,-0.335105703835],[-0.415258702737,-0.800133245405,0.43283599596],
    [-0.388332855112,-0.801047070132,-0.455544932002],[-0.482379701956,-0.801171206018,-0.354167364093],[-0.172794056473,-0.802082239804,0.57166974263],[-0.596605143896,-0.802458981183,0.011040190025],
    [0.589078886803,-0.807316780009,-0.035009739184],[0.265524742173,-0.810711764912,0.52176914965],[0.284797438142,-0.810712931141,-0.511502651517],[0.112494177699,-0.812335868318,0.572237273364],
    [0.551884270188,-0.812599717249,-0.187364489286],[-0.030461846637,-0.815559795764,0.577870483268],[0.520860408711,-0.826281039091,0.214392348456],[-0.537522390433,-0.827926011226,0.160025622069],
    [-0.468546456926,-0.830160976777,0.302153885196],[0.14864163621,-0.834980447407,-0.529823854156],[-0.134478112769,-0.837752921478,-0.529231215765],[-0.529165136303,-0.842061012521,-0.104486887759],
    [0.004683473875,-0.843994966749,-0.536330645381],[-0.260703854069,-0.85302459509,0.452086872895],[0.417075466698,-0.854060178623,0.310852483291],[0.354515622637,-0.855874098841,-0.37656101795],
    [0.505199795313,-0.860842518512,0.061019055533],[0.310248650165,-0.862335246282,0.40015459274],[-0.240530749426,-0.863913337965,-0.44249147231],[-0.434494443632,-0.869139895615,-0.236242291521],
    [0.159221675247,-0.874602933325,0.457949961405],[-0.343224710942,-0.87493398827,-0.341595248749],[-0.478098100495,-0.877412531317,0.039616362664],[-0.123865604311,-0.878651133642,0.461117661143],
    [0.414458841654,-0.881712023957,-0.225405801578],[-0.342194257552,-0.88296265382,0.321372123959],[0.458588027704,-0.885623626837,-0.073265356302],[0.020310518873,-0.886288780251,0.462687454795],
    [0.198511444069,-0.891134136169,-0.408011222798],[-0.415258702737,-0.891159241627,0.182744126758],[0.411660154066,-0.897907023142,0.155881029464],[-0.086482535734,-0.904345484465,-0.417947383938],
    [0.056593935079,-0.907027111091,-0.417251658186],[-0.389771008453,-0.916331348054,-0.091735606729],[0.310248650165,-0.917801537692,0.247762209549],[-0.209298538798,-0.918880110541,0.334445009096],
    [0.202904498331,-0.920145634558,0.334905622169],[-0.190738199806,-0.927117516981,-0.322601997579],[0.261127363193,-0.928970031031,-0.262349350366],[0.368000742842,-0.929532996693,0.023320834593],
    [-0.2910878218,-0.930903525534,-0.220650189548],[-0.072400563973,-0.937226524853,0.341122557812],[0.06588187153,-0.937651072291,0.341277080442],[0.316805209396,-0.942123480756,-0.109716937195],
    [-0.329827789436,-0.94216927317,0.059419609644],[-0.260703854069,-0.944050591312,0.201995003694],[0.107337439421,-0.949612661259,-0.294473203661],[-0.036833219233,-0.953644939594,-0.298671463563],
    [0.265524742173,-0.956427986994,0.121417119832],[0.159221675247,-0.964349278057,0.211373905776],[-0.235063724201,-0.96927486384,-0.072465742885],[-0.123865604311,-0.969486537557,0.21154944],
    [-0.140513651731,-0.969745221163,-0.199624947613],[0.167221595417,-0.97542512785,-0.143466922964],[0.216870288248,-0.976112630335,-0.013092401481],[0.020310518873,-0.976346358209,0.215256292903],
    [-0.172794056473,-0.981892870122,0.077644096055],[0.013520430782,-0.984708571046,-0.17368427695],[0.112494177699,-0.990112406991,0.083800247653],[-0.080629495735,-0.995557687753,-0.048618666916],
    [-0.030461846637,-0.996203036225,0.081557259126],[0.063615539927,-0.996942372726,-0.045375858589],
  ],
  neighbours: [
    [8,4,2,1,3,7],[6,3,0,2,5,10],[11,5,1,0,4,9],[13,7,0,1,6,12],[14,9,2,0,8,15],[16,10,1,2,11,17],[19,12,3,1,10,20],[18,8,0,3,13,22],
    [23,15,4,0,7,18],[21,11,2,4,14,24],[20,6,1,5,16,26],[28,17,5,2,9,21],[27,13,3,6,19,25],[31,22,7,3,12,27],[30,24,9,4,15,29],[29,14,4,8,23,33],
    [36,26,10,5,17,32],[32,16,5,11,28,39],[37,23,8,7,22,35],[41,25,12,6,20,34],[34,19,6,10,26,38],[42,28,11,9,24,40],[35,18,7,13,31,45],[46,33,15,8,18,37],
    [40,21,9,14,30,43],[44,27,12,19,41],[48,38,20,10,16,36],[47,31,13,12,25,44],[50,39,17,11,21,42],[49,30,14,15,33,52],[51,43,24,14,29,49],[45,22,13,27,47,55],
    [53,36,16,17,39,54],[52,29,15,23,46,59],[58,41,19,20,38,56],[57,37,18,22,45,61],[66,48,26,16,32,53],[67,46,23,18,35,57],[56,34,20,26,48,63],[54,32,17,28,50,62],
    [64,42,21,24,43,65],[60,44,25,19,34,58],[69,50,28,21,40,64],[65,40,24,30,51,70],[68,47,27,25,41,60],[61,35,22,31,55,71],[74,59,33,23,37,67],[72,55,31,27,44,68],
    [63,38,26,36,66,77],[73,51,30,29,52,75],[62,39,28,42,69,78],[79,70,43,30,49,73],[75,49,29,33,59,81],[85,66,36,32,54,76],[76,53,32,39,62,80],[71,45,31,47,72,84],
    [86,58,34,38,63,88],[87,67,37,35,61,83],[82,60,41,34,56,86],[81,52,33,46,74,93],[89,68,44,41,58,82],[83,57,35,45,71,94],[80,54,39,50,78,91],[88,56,38,48,77,99],
    [92,69,42,40,65,90],[90,64,40,43,70,96],[98,77,48,36,53,85],[95,74,46,37,57,87],[97,72,47,44,60,89],[100,78,50,42,64,92],[96,65,43,51,79,101],[94,61,45,55,84,105],
    [103,84,55,47,68,97],[106,79,51,49,75,104],[108,93,59,46,67,95],[104,73,49,52,81,107],[109,85,53,54,80,102],[99,63,48,66,98,115],[114,91,62,50,69,100],[101,70,51,73,106],
    [102,76,54,62,91,112],[107,75,52,59,93,117],[113,89,60,58,86,111],[110,87,57,61,94,120],[105,71,55,72,103,122],[121,98,66,53,76,109],[111,82,58,56,88,116],[118,95,67,57,83,110],
    [116,86,56,63,99,124],[119,97,68,60,82,113],[123,92,64,65,96,125],[133,112,80,62,78,114],[127,100,69,64,90,123],[117,81,59,74,108,131],[120,83,61,71,105,130],[126,108,74,67,87,118],
    [125,90,65,70,101,129],[128,103,72,68,89,119],[135,115,77,66,85,121],[124,88,63,77,115,136],[139,114,78,69,92,127],[129,96,70,79,106,132],[140,109,76,80,112,134],[143,122,84,72,97,128],
    [137,106,73,75,107,138],[130,94,71,84,122,144],[132,101,79,73,104,137],[138,104,75,81,117,142],[131,93,74,95,126,148],[151,121,85,76,102,140],[141,118,87,83,120,149],[145,113,82,86,116,147],
    [134,102,80,91,133,153],[152,119,89,82,111,145],[156,133,91,78,100,139],[154,136,99,77,98,135],[147,111,86,88,124,146],[142,107,81,93,131,155],[150,126,95,87,110,141],[160,128,97,89,113,152],
    [149,110,83,94,130,158],[163,135,98,85,109,151],[144,105,84,103,143,165],[164,127,92,90,125,157],[146,116,88,99,136,159],[157,123,90,96,129,161],[168,148,108,95,118,150],[170,139,100,92,123,164],
    [167,143,103,97,119,160],[161,125,96,101,132,162],[158,120,94,105,144,171],[155,117,93,108,148,173],[162,129,101,106,137,166],[176,153,112,91,114,156],[169,140,102,112,153],[178,154,115,98,121,163],
    [159,124,99,115,154,177],[166,132,106,104,138,172],[172,137,104,107,142,175],[181,156,114,100,127,170],[179,151,109,102,134,169],[174,150,118,110,149,180],[175,138,107,117,155,186],[183,165,122,103,128,167],
    [171,130,105,122,165,189],[187,152,113,111,147,185],[182,147,116,124,159,184],[185,145,111,116,146,182],[173,131,108,126,168,193],[180,141,110,120,158,190],[195,168,126,118,141,174],[188,163,121,109,140,179],
    [192,160,119,113,145,187],[191,169,134,112,133,176],[177,136,115,135,178,197],[186,142,117,131,173,203],[202,176,133,114,139,181],[201,164,123,125,161,196],[190,149,120,130,171,205],[184,146,124,136,177,200],
    [199,167,128,119,152,192],[196,157,125,129,162,194],[194,161,129,132,166,198],[206,178,135,121,151,188],[208,170,127,123,157,201],[209,189,144,122,143,183],[198,162,132,137,172,204],[207,183,143,128,160,199],
    [216,193,148,126,150,195],[211,179,140,134,153,191],[213,181,139,127,164,208],[205,158,130,144,189,215],[204,166,137,138,175,210],[203,155,131,148,193,218],[195,150,141,180,212],[210,172,138,142,186,220],
    [214,191,153,133,156,202],[200,159,136,154,197,217],[224,197,154,135,163,206],[219,188,151,140,169,211],[212,174,141,149,190,221],[228,202,156,139,170,213],[225,185,147,146,184,222],[227,209,165,143,167,207],
    [222,182,146,159,200,223],[226,187,145,147,182,225],[220,175,142,155,203,235],[229,192,152,145,185,226],[231,206,163,151,179,219],[232,215,171,144,165,209],[221,180,149,158,205,234],[233,211,169,153,176,214],
    [236,199,160,152,187,229],[218,173,148,168,216,243],[238,196,161,162,198,240],[216,168,150,174,212,237],[230,201,157,161,194,238],[246,217,177,154,178,224],[240,194,162,166,204,244],[242,207,167,160,192,236],
    [223,184,159,177,217,241],[239,208,164,157,196,230],[245,214,176,156,181,228],[235,186,155,173,218,251],[244,198,166,172,210,250],[234,190,158,171,215,249],[254,224,178,163,188,231],[248,227,183,167,199,242],
    [247,213,170,164,201,239],[253,232,189,165,183,227],[250,204,172,175,220,252],[255,219,179,169,191,233],[237,195,174,180,221,256],[257,228,181,170,208,247],[258,233,191,176,202,245],[249,205,171,189,232,264],
    [243,193,168,195,237,259],[267,241,200,177,197,246],[251,203,173,193,243,268],[261,231,188,179,211,255],[252,210,175,186,235,260],[256,212,180,190,234,269],[265,225,182,184,223,262],[262,222,184,200,241,263],
    [273,246,197,178,206,254],[266,226,185,182,222,265],[270,229,187,185,225,266],[271,253,209,183,207,248],[276,245,202,181,213,257],[274,236,192,187,226,270],[272,239,201,196,238,275],[285,254,206,188,219,261],
    [264,215,189,209,253,284],[277,255,211,191,214,258],[269,221,190,205,249,280],[260,220,186,203,251,278],[279,242,199,192,229,274],[259,216,195,212,256,282],[275,230,196,194,240,283],[281,247,208,201,230,272],
    [283,238,194,198,244,287],[293,263,223,200,217,267],[286,248,207,199,236,279],[268,218,193,216,259,288],[287,240,198,204,250,290],[295,258,214,202,228,276],[297,267,217,197,224,273],[289,257,213,208,239,281],
    [291,271,227,207,242,286],[280,234,205,215,264,299],[290,244,204,210,252,292],[278,235,203,218,268,296],[292,250,210,220,260,294],[284,232,209,227,271,301],[302,273,224,206,231,285],[298,261,219,211,233,277],
    [282,237,212,221,269,300],[307,276,228,213,247,289],[309,277,233,214,245,295],[288,243,216,237,282,303],[294,252,220,235,278,306],[315,285,231,219,255,298],[305,265,222,223,263,304],[304,262,223,241,293],
    [299,249,215,232,284,313],[308,266,225,222,262,305],[310,270,226,225,265,308],[318,293,241,217,246,297],[296,251,218,243,288,317],[300,256,221,234,280,312],[314,274,229,226,266,310],[301,253,227,248,291,321],
    [311,281,239,230,275,316],[324,297,246,224,254,302],[319,279,236,229,270,314],[316,272,230,238,283,322],[328,295,245,228,257,307],[329,298,255,233,258,309],[306,260,235,251,296,323],[325,286,242,236,274,319],
    [312,269,234,249,299,332],[320,289,247,239,272,311],[303,259,237,256,300,326],[322,275,238,240,287,327],[313,264,232,253,301,334],[338,302,254,231,261,315],[330,291,248,242,279,325],[327,283,240,244,290,331],
    [317,268,243,259,303,339],[340,307,257,247,281,320],[331,287,244,250,292,333],[321,271,248,286,330],[333,290,250,252,294,336],[335,304,263,241,267,318],[336,292,252,260,306,337],[342,309,258,245,276,328],
    [323,278,251,268,317,344],[345,318,267,246,273,324],[341,315,261,255,277,329],[332,280,249,264,313,346],[326,282,256,269,312,343],[334,284,253,271,321,352],[353,324,273,254,285,338],[339,288,259,282,326,356],
    [347,305,262,263,293,335],[349,308,265,262,304,347],[337,294,260,278,323,348],[357,328,276,257,289,340],[351,310,266,265,305,349],[361,329,277,258,295,342],[354,314,270,266,308,351],[350,320,281,272,316,355],
    [343,300,269,280,332,364],[346,299,264,284,334,365],[358,319,274,270,310,354],[359,338,285,261,298,341],[355,311,272,275,322,362],[344,296,268,288,339,368],[363,335,293,267,297,345],[366,325,279,274,314,358],
    [370,340,289,281,311,350],[352,301,271,291,330,360],[362,316,275,283,327,367],[348,306,278,296,344,374],[373,345,297,273,302,353],[369,330,286,279,319,366],[356,303,282,300,343,380],[367,322,283,287,331,371],
    [377,342,295,276,307,357],[372,341,298,277,309,361],[360,321,291,286,325,369],[371,327,287,290,333,375],[364,312,280,299,346,383],[375,331,290,292,336,376],[365,313,284,301,352,384],[381,347,304,293,318,363],
    [376,333,292,294,337,379],[379,336,294,306,348,378],[382,353,302,285,315,359],[368,317,288,303,356,387],[388,357,307,289,320,370],[385,359,315,298,329,372],[392,361,309,295,328,377],[380,326,300,312,364,386],
    [374,323,296,317,368,395],[390,363,318,297,324,373],[383,332,299,313,365,396],[389,349,305,304,335,381],[378,337,306,323,374,400],[391,351,308,305,347,389],[370,320,311,355,393],[397,354,310,308,349,391],
    [384,334,301,321,360,394],[398,373,324,302,338,382],[401,358,314,310,351,397],[393,350,311,316,362,399],[387,339,303,326,380,410],[409,377,328,307,340,388],[403,366,319,314,354,401],[404,382,338,315,341,385],
    [394,352,321,330,369,402],[407,372,329,309,342,392],[399,355,316,322,367,405],[406,381,335,318,345,390],[386,343,312,332,383,408],[396,346,313,334,384,413],[411,369,325,319,358,403],[405,362,322,327,371,412],
    [395,344,317,339,387,417],[402,360,330,325,366,411],[388,340,320,350,393,414],[412,367,327,331,375,415],[420,385,341,329,361,407],[423,390,345,324,353,398],[400,348,323,344,395,424],[415,371,331,333,376,416],
    [416,375,333,336,379,419],[426,392,342,328,357,409],[418,379,337,348,400],[419,376,336,337,378,418],[410,356,326,343,386,422],[421,389,347,335,363,406],[425,398,353,338,359,404],[408,364,332,346,396,427],
    [413,365,334,352,394,428],[429,404,359,341,372,420],[422,380,343,364,408,430],[417,368,339,356,410,435],[409,357,340,370,414,432],[431,391,349,347,381,421],[438,406,363,345,373,423],[437,397,351,349,389,431],
    [436,407,361,342,377,426],[414,370,350,355,399,434],[428,384,352,360,402,433],[424,374,344,368,417,444],[427,383,346,365,413,439],[443,401,354,351,391,437],[448,423,373,353,382,425],[434,393,355,362,405,442],
    [441,418,378,348,374,424],[447,403,358,354,397,443],[433,394,360,369,411,440],[445,411,366,358,401,447],[446,425,382,359,385,429],[442,399,362,367,412,449],[455,421,381,363,390,438],[451,420,372,361,392,436],
    [430,386,364,383,427,450],[426,377,357,388,432,452],[435,387,356,380,422,453],[440,402,369,366,403,445],[449,405,367,371,415,454],[439,396,365,384,428,460],[432,388,370,393,434,458],[454,412,371,375,416,456],
    [456,415,375,376,419,459],[444,395,368,387,435,463],[457,419,379,378,400,441],[459,416,376,379,418,457],[461,429,385,372,407,451],[466,431,389,381,406,455],[453,410,380,386,430,462],[468,438,390,373,398,448],
    [464,441,400,374,395,444],[448,398,382,404,446,473],[470,436,392,377,409,452],[450,408,383,396,439,465],[460,413,384,394,433,471],[467,446,404,385,420,461],[462,422,386,408,450,472],[469,437,391,389,421,466],
    [452,409,388,414,458,476],[471,428,394,402,440,477],[458,414,393,399,442,474],[463,417,387,410,453,478],[483,451,407,392,426,470],[475,443,397,391,431,469],[486,455,406,390,423,468],[465,427,396,413,460,485],
    [477,433,402,411,445,484],[482,457,418,400,424,464],[474,434,399,405,449,481],[479,447,401,397,437,475],[487,464,424,395,417,463],[484,440,411,403,447,480],[473,425,404,429,467,491],[480,445,403,401,443,479],
    [493,468,423,398,425,473],[481,442,405,412,454,489],[472,430,408,427,465,488],[492,461,420,407,436,483],[497,470,426,409,432,476],[478,435,410,422,462,490],[489,449,412,415,456,496],[499,466,421,406,438,486],
    [496,454,415,416,459,494],[495,459,419,418,441,482],[476,432,414,434,474,498],[494,456,416,419,457,495],[485,439,413,428,471,502],[500,467,429,420,451,492],[490,453,422,430,472,501],[487,444,417,435,478,506],
    [505,482,441,424,444,487],[488,450,427,439,485,508],[503,469,431,421,455,499],[491,446,429,461,500],[510,486,438,423,448,493],[504,475,437,431,466,503],[511,483,436,426,452,497],[502,460,428,433,477,514],
    [501,462,430,450,488,507],[493,448,425,446,491,515],[498,458,434,442,481,513],[509,479,443,437,469,504],[519,497,452,432,458,498],[514,471,433,440,484,518],[506,463,435,453,490,520],[512,480,447,443,475,509],
    [516,484,445,447,479,512],[513,474,442,449,489,522],[517,495,457,441,464,505],[521,492,451,436,470,511],[518,477,440,445,480,516],[508,465,439,460,502,527],[524,499,455,438,468,510],[505,464,444,463,506,526],
    [529,507,472,450,465,508],[522,481,449,454,496,528],[520,478,453,462,501,532],[515,473,446,467,500,523],[531,500,461,451,483,521],[533,510,468,448,473,515],[530,496,456,459,495,525],[525,494,459,457,482,517],
    [528,489,454,456,494,530],[536,511,470,452,476,519],[519,476,458,474,513,538],[534,503,466,455,486,524],[523,491,467,461,492,531],[532,490,462,472,507,539],[527,485,460,471,514,541],[537,504,469,466,499,534],
    [535,509,475,469,503,537],[542,517,482,464,487,526],[526,487,463,478,520,543],[539,501,472,488,529],[529,488,465,485,527,550],[540,512,479,475,504,535],[548,524,486,468,493,533],[547,521,483,470,497,536],
    [545,516,480,479,509,540],[538,498,474,481,522,544],[541,502,471,477,518,549],[533,493,473,491,523,546],[551,518,484,480,512,545],[553,525,495,482,505,542],[549,514,477,484,516,551],[557,536,497,476,498,538],
    [543,506,478,490,532,556],[558,531,492,483,511,547],[544,513,481,489,528,552],[546,515,491,500,531,554],[560,534,499,486,510,548],[555,530,494,495,517,553],[564,542,505,487,506,543],[550,508,485,502,541,563],
    [552,522,489,496,530,559],[561,539,507,488,508,550],[559,528,496,494,525,555],[554,523,500,492,521,558],[556,520,490,501,539,565],[548,510,493,515,546,567],[566,537,503,499,524,560],[562,540,509,504,537,568],
    [570,547,511,497,519,557],[568,535,504,503,534,566],[557,519,498,513,544,569],[565,532,501,507,529,561],[571,545,512,509,535,562],[563,527,502,514,549,572],[578,553,517,505,526,564],[564,526,506,520,556,575],
    [569,538,513,522,552,573],[576,551,516,512,540,571],[567,533,515,523,554,574],[580,558,521,511,536,570],[582,560,524,510,533,567],[572,541,514,518,551,577],[579,561,529,508,527,563],[577,549,518,516,545,576],
    [573,544,522,528,559,581],[585,555,525,517,542,578],[574,546,523,531,558,584],[583,559,530,525,553,585],[575,543,520,532,565,588],[586,570,536,519,538,569],[584,554,531,521,547,580],[581,552,528,530,555,583],
    [589,566,534,524,548,582],[587,565,539,529,550,579],[571,540,535,568,590],[591,579,550,527,541,572],[593,578,542,526,543,575],[588,556,532,539,561,587],[592,568,537,534,560,589],[582,548,533,546,574,595],
    [590,562,535,537,566,592],[586,557,538,544,573,594],[596,580,547,536,557,586],[598,576,545,540,562,590],[591,563,541,549,577,599],[594,569,544,552,581,597],[595,567,546,554,584,604],[593,564,543,556,588,605],
    [601,577,551,545,571,598],[599,572,549,551,576,601],[603,585,553,542,564,593],[602,587,561,550,563,591],[606,584,558,547,570,596],[597,573,552,559,583,600],[608,589,560,548,567,595],[600,581,559,555,585,607],
    [604,574,554,558,580,606],[607,583,555,553,578,603],[610,596,570,557,569,594],[609,588,565,561,579,602],[605,575,556,565,587,609],[612,592,566,560,582,608],[598,571,562,568,592,611],[602,579,563,572,599,613],
    [611,590,568,566,589,612],[603,578,564,575,605,615],[610,586,569,573,597,614],[608,582,567,574,604,618],[619,606,580,570,586,610],[614,594,573,581,600,616],[617,601,576,571,590,611],[613,591,572,577,601,620],
    [616,597,581,583,607,622],[620,599,577,576,598,617],[624,609,587,579,591,613],[621,607,585,578,593,615],[618,595,574,584,606,623],[615,593,575,588,609,625],[623,604,584,580,596,619],[622,600,583,585,603,621],
    [626,612,589,582,595,618],[625,605,588,587,602,624],[619,596,586,594,614,628],[617,598,590,592,612,627],[627,611,592,589,608,626],[624,602,591,599,620,630],[628,610,594,597,616,629],[631,621,603,593,605,625],
    [629,614,597,600,622],[632,620,601,598,611,627],[626,608,595,604,623,633],[634,623,606,596,610,628],[630,613,599,601,617,632],[635,622,607,603,615,631],[629,616,600,607,621,635],[633,618,604,606,619,634],
    [636,625,609,602,613,630],[631,615,605,609,624,636],[637,627,612,608,618,633],[632,617,611,612,626,637],[634,619,610,614,629,638],[638,628,614,616,622,635],[636,624,613,620,632,639],[640,635,621,615,625,636],
    [639,630,620,617,627,637],[637,626,618,623,634,641],[641,633,623,619,628,638],[638,629,622,621,631,640],[640,631,625,624,630,639],[639,632,627,626,633,641],[641,634,628,629,635,640],[640,636,630,632,637,641],
    [641,638,635,631,636,639],[639,637,633,634,638,640],
  ],
};
export const OIKUMENE_META = {"capitalCentre":210,"terminal":305,"starts":{"capital":210,"brine":476,"spires":67,"rift":439,"flats":564,"ringside":344},"tutorial":{"a":306,"b":417,"path":[323,374,395],"peaks":[172,198],"atlantis":[161,283]},"capitalHeights":[172,166,198,137]};
export const OIKUMENE_CELLS = [
  [2,1,2,7,0],[2,1,1,6,0],[2,1,0,11,1],[2,1,1,6,0],[2,0,3,0,0],[6,0,2,0,0],[2,1,0,11,1],[2,0,3,0,0],[2,1,0,10,1],[2,1,4,7,0],[6,0,1,0,0],[6,0,4,0,0],
  [2,1,1,7,0],[2,1,2,7,0],[2,1,4,7,0],[2,1,3,7,0],[6,0,1,0,0],[6,0,3,0,0],[2,1,4,6,0],[6,0,1,0,0],[6,0,1,0,0],[6,0,4,0,0],[2,1,0,8,1],[2,1,3,6,0],
  [2,1,0,10,1],[2,1,1,5,0],[6,0,1,0,0],[2,1,2,5,0],[6,0,3,0,0],[2,1,3,5,0],[2,1,4,6,0],[2,1,3,6,0],[6,0,2,0,0],[2,1,2,6,0],[6,0,1,0,0],[2,0,4,0,0],
  [6,0,1,0,0],[2,1,0,9,1],[6,0,1,0,0],[6,0,2,0,0],[6,0,3,0,0],[6,0,2,0,0],[6,0,3,0,0],[6,0,3,0,0],[2,1,1,5,0],[2,1,3,6,0],[2,1,3,7,0],[2,1,2,7,0],
  [6,0,1,0,0],[2,1,3,7,0],[6,0,3,0,0],[2,1,0,9,1],[2,1,2,7,0],[6,0,3,0,0],[6,0,2,0,0],[2,1,0,9,1],[6,0,2,0,0],[2,1,4,6,0],[6,0,2,0,0],[2,1,0,12,1],
  [6,0,2,0,0],[2,1,0,8,1],[6,0,3,0,0],[6,0,1,0,0],[6,0,2,0,0],[6,0,3,0,0],[6,0,3,0,0],[2,0,3,0,0],[2,1,1,5,0],[6,0,2,0,0],[6,0,2,0,0],[2,0,2,0,0],
  [2,1,2,7,0],[2,1,2,6,0],[2,0,2,0,0],[2,1,0,10,1],[6,0,3,0,0],[6,0,2,0,0],[6,0,2,0,0],[6,0,2,0,0],[6,0,3,0,0],[2,1,2,7,0],[6,0,3,0,0],[2,1,3,6,0],
  [2,1,2,7,0],[6,0,3,0,0],[6,0,3,0,0],[2,0,3,0,0],[6,0,2,0,0],[6,0,3,0,0],[6,0,3,0,0],[6,0,2,0,0],[6,0,2,0,0],[2,1,2,7,0],[2,1,1,7,0],[2,0,4,0,0],
  [6,0,2,0,0],[6,0,2,0,0],[6,0,3,0,0],[6,0,2,0,0],[6,0,1,0,0],[6,0,2,0,0],[6,0,2,0,0],[2,1,0,9,1],[0,0,3,0,0],[2,1,0,9,1],[0,0,3,0,0],[0,0,3,0,0],
  [2,1,3,6,0],[6,0,2,0,0],[2,1,0,10,1],[6,0,4,0,0],[6,0,2,0,0],[6,0,4,0,0],[6,0,2,0,0],[6,0,3,0,0],[6,0,3,0,0],[0,0,3,0,0],[2,0,4,0,0],[6,0,2,0,0],
  [2,0,2,0,0],[6,0,3,0,0],[2,1,1,6,0],[1,2,0,0,0],[6,0,3,0,0],[1,2,0,0,0],[2,1,0,8,1],[1,2,0,0,0],[6,0,2,0,0],[6,0,2,0,0],[2,1,1,6,0],[2,1,0,12,1],
  [0,0,3,0,0],[1,2,0,0,0],[6,0,2,0,0],[6,0,3,0,0],[6,0,3,0,0],[0,1,4,7,0],[0,0,3,0,0],[1,2,0,0,0],[6,0,1,0,0],[2,1,4,7,0],[0,0,4,0,0],[6,0,1,0,0],
  [2,1,1,6,0],[6,0,4,0,0],[6,0,3,0,0],[6,0,4,0,0],[2,1,4,7,0],[2,1,3,7,0],[2,1,4,6,0],[6,0,1,0,0],[6,0,3,0,0],[1,2,0,0,0],[6,0,3,0,0],[0,0,3,0,0],
  [1,2,0,0,0],[1,0,5,0,0],[2,1,1,5,0],[6,0,3,0,0],[6,0,2,0,0],[1,3,4,0,0],[0,0,3,0,0],[6,0,2,0,0],[1,2,0,0,0],[2,1,0,12,1],[0,1,4,6,0],[6,0,1,0,0],
  [2,1,4,7,0],[6,0,1,0,0],[1,3,4,0,0],[2,0,1,0,0],[0,1,0,11,1],[2,1,3,6,0],[2,1,3,6,0],[0,0,4,0,0],[1,0,3,0,0],[6,0,3,0,0],[6,0,3,0,0],[6,0,1,0,0],
  [2,1,0,10,1],[1,2,0,0,0],[6,0,3,0,0],[6,0,1,0,0],[6,0,3,0,0],[6,0,3,0,0],[0,0,4,0,0],[6,0,3,0,0],[6,0,1,0,0],[2,1,1,7,0],[2,0,2,0,0],[1,2,0,0,0],
  [6,0,2,0,0],[2,1,0,11,1],[0,0,3,0,0],[2,1,3,5,0],[1,2,0,0,0],[6,0,3,0,0],[0,1,0,12,1],[6,0,1,0,0],[6,0,3,0,0],[1,0,5,0,0],[1,0,3,0,0],[0,0,3,0,0],
  [0,0,5,0,0],[2,0,1,0,0],[6,0,2,0,0],[6,0,1,0,0],[1,2,0,0,0],[6,0,1,0,0],[0,0,5,0,0],[1,2,0,0,0],[2,1,2,6,0],[1,2,0,0,0],[1,0,2,0,0],[2,1,0,10,1],
  [2,1,3,6,0],[6,0,3,0,0],[2,1,2,6,0],[6,0,1,0,0],[0,0,4,0,0],[2,1,1,6,0],[5,0,3,0,0],[5,0,4,0,0],[5,0,4,0,0],[5,0,3,0,0],[5,0,3,0,0],[5,0,2,0,0],
  [1,3,4,0,0],[5,0,3,0,0],[1,0,5,0,0],[5,0,2,0,0],[3,0,1,0,0],[1,2,0,0,0],[2,1,0,9,1],[0,0,4,0,0],[5,0,2,0,0],[2,1,3,6,0],[1,2,0,0,0],[1,2,0,0,0],
  [0,0,3,0,0],[5,0,4,0,0],[5,0,3,0,0],[2,1,2,6,0],[0,0,4,0,0],[1,2,0,0,0],[6,0,3,0,0],[1,2,0,0,0],[5,0,3,0,0],[3,0,1,0,0],[0,0,5,0,0],[0,0,3,0,0],
  [0,0,5,0,0],[3,0,1,0,0],[5,0,2,0,0],[1,2,0,0,0],[2,1,2,5,0],[1,0,2,0,0],[1,2,0,0,0],[2,1,0,9,1],[0,0,3,0,0],[1,2,0,0,0],[5,0,2,0,0],[5,0,3,0,0],
  [3,0,1,0,0],[5,0,2,0,0],[5,0,2,0,0],[6,0,2,0,0],[5,0,3,0,0],[2,0,1,0,0],[5,0,2,0,0],[3,1,2,6,0],[1,2,0,0,0],[6,0,2,0,0],[5,0,2,0,0],[1,2,0,0,0],
  [1,2,0,0,0],[1,0,2,0,0],[0,0,3,0,0],[5,0,3,0,0],[3,0,1,0,0],[1,2,0,0,0],[2,1,2,7,0],[1,3,4,0,0],[3,0,1,0,0],[5,0,1,0,0],[5,0,3,0,0],[0,0,3,0,0],
  [5,0,4,0,0],[1,2,0,0,0],[0,0,4,0,0],[3,1,0,12,1],[0,0,3,0,0],[6,0,2,0,0],[0,0,3,0,0],[1,2,0,0,0],[5,0,3,0,0],[6,0,2,0,0],[1,2,0,0,0],[3,0,1,0,0],
  [2,0,2,0,0],[3,1,1,5,0],[6,0,1,0,0],[4,0,5,0,0],[5,0,1,0,0],[5,4,0,0,0],[0,0,2,0,0],[1,0,1,0,0],[5,0,1,0,0],[1,0,3,0,0],[5,0,1,0,0],[1,2,0,0,0],
  [3,0,3,0,0],[3,0,1,0,0],[5,0,2,0,0],[1,2,0,0,0],[1,2,0,0,0],[5,0,3,0,0],[6,0,2,0,0],[5,0,1,0,0],[1,3,4,0,0],[3,1,2,6,0],[1,2,0,0,0],[5,0,2,0,0],
  [6,0,1,0,0],[5,0,2,0,0],[4,0,5,0,0],[1,2,0,0,0],[1,2,0,0,0],[1,2,0,0,0],[3,0,2,0,0],[0,0,3,0,0],[3,0,3,0,0],[0,0,3,0,0],[3,1,1,6,0],[5,0,1,0,0],
  [0,0,2,0,0],[0,0,2,0,0],[5,0,1,0,0],[5,0,4,0,0],[1,2,0,0,0],[1,2,0,0,0],[1,2,0,0,0],[3,0,4,0,0],[5,0,4,0,0],[6,0,2,0,0],[3,0,2,0,0],[5,0,1,0,0],
  [5,0,3,0,0],[5,0,1,0,0],[1,2,0,0,0],[5,0,1,0,0],[3,1,1,5,0],[5,0,1,0,0],[5,0,1,0,0],[1,2,0,0,0],[4,0,5,0,0],[1,2,0,0,0],[5,0,1,0,0],[1,2,0,0,0],
  [3,0,2,0,0],[1,2,0,0,0],[1,2,0,0,0],[6,0,2,0,0],[3,0,4,0,0],[3,0,1,0,0],[5,0,1,0,0],[1,0,2,0,0],[5,0,4,0,0],[3,0,2,0,0],[1,2,0,0,0],[1,2,0,0,0],
  [1,3,4,0,0],[6,0,1,0,0],[5,0,2,0,0],[1,2,0,0,0],[4,0,3,0,0],[1,0,2,0,0],[4,0,3,0,0],[4,0,3,0,0],[3,0,5,0,0],[5,0,2,0,0],[1,2,0,0,0],[3,0,3,0,0],
  [3,1,1,6,0],[1,2,0,0,0],[3,0,4,0,0],[5,0,4,0,0],[1,2,0,0,0],[5,0,1,0,0],[6,0,2,0,0],[5,0,1,0,0],[1,0,3,0,0],[1,2,0,0,0],[3,0,2,0,0],[5,0,2,0,0],
  [3,0,2,0,0],[5,0,1,0,0],[5,0,2,0,0],[1,2,0,0,0],[5,0,3,0,0],[5,0,1,0,0],[3,0,2,0,0],[5,0,1,0,0],[1,2,0,0,0],[1,0,1,0,0],[5,0,3,0,0],[1,2,0,0,0],
  [3,0,3,0,0],[1,2,0,0,0],[4,0,5,0,0],[3,0,1,0,0],[1,0,3,0,0],[3,1,0,10,1],[1,3,4,0,0],[1,3,4,0,0],[4,0,4,0,0],[5,0,2,0,0],[4,0,4,0,0],[4,0,5,0,0],
  [1,2,0,0,0],[6,0,1,0,0],[3,0,4,0,0],[6,0,2,0,0],[4,0,5,0,0],[1,2,0,0,0],[1,2,0,0,0],[3,0,2,0,0],[3,0,2,0,0],[1,2,0,0,0],[3,0,3,0,0],[6,0,1,0,0],
  [1,2,0,0,0],[3,0,2,0,0],[1,0,1,0,0],[4,0,4,0,0],[1,2,0,0,0],[6,0,1,0,0],[6,0,2,0,0],[3,0,2,0,0],[3,0,2,0,0],[4,0,5,0,0],[1,2,0,0,0],[6,0,1,0,0],
  [4,0,5,0,0],[3,0,3,0,0],[1,2,0,0,0],[6,0,1,0,0],[6,0,2,0,0],[1,3,4,0,0],[3,0,2,0,0],[1,2,0,0,0],[1,2,0,0,0],[4,0,4,0,0],[1,2,0,0,0],[6,0,2,0,0],
  [4,0,5,0,0],[4,0,5,0,0],[1,0,2,0,0],[4,0,5,0,0],[3,0,3,0,0],[1,2,0,0,0],[4,0,4,0,0],[4,0,3,0,0],[4,0,5,0,0],[3,1,2,6,0],[6,0,1,0,0],[1,2,0,0,0],
  [6,0,1,0,0],[6,0,1,0,0],[1,2,0,0,0],[3,0,3,0,0],[3,0,3,0,0],[1,2,0,0,0],[1,2,0,0,0],[6,0,1,0,0],[1,0,3,0,0],[3,0,3,0,0],[4,0,2,0,0],[6,0,1,0,0],
  [6,0,2,0,0],[1,0,2,0,0],[4,0,5,0,0],[1,2,0,0,0],[3,0,4,0,0],[3,0,3,0,0],[6,0,1,0,0],[4,0,4,0,0],[3,1,2,6,0],[1,2,0,0,0],[4,0,4,0,0],[1,2,0,0,0],
  [1,3,4,0,0],[6,0,2,0,0],[4,0,5,0,0],[4,0,5,0,0],[4,0,5,0,0],[1,3,4,0,0],[1,2,0,0,0],[6,0,1,0,0],[1,2,0,0,0],[4,0,5,0,0],[3,0,3,0,0],[6,0,1,0,0],
  [6,0,1,0,0],[4,0,5,0,0],[4,0,2,0,0],[3,1,0,12,1],[3,0,2,0,0],[6,0,2,0,0],[6,0,1,0,0],[1,2,0,0,0],[6,0,3,0,0],[1,2,0,0,0],[3,0,4,0,0],[1,3,4,0,0],
  [6,0,3,0,0],[4,0,4,0,0],[3,0,4,0,0],[1,2,0,0,0],[4,0,2,0,0],[1,2,0,0,0],[1,0,2,0,0],[1,2,0,0,0],[6,0,1,0,0],[4,0,4,0,0],[4,0,3,0,0],[3,0,2,0,0],
  [1,2,0,0,0],[3,1,3,7,0],[4,0,3,0,0],[1,2,0,0,0],[4,0,4,0,0],[1,2,0,0,0],[6,0,1,0,0],[6,0,2,0,0],[1,2,0,0,0],[6,0,1,0,0],[1,2,0,0,0],[4,0,4,0,0],
  [6,0,2,0,0],[3,0,4,0,0],[4,0,4,0,0],[4,0,2,0,0],[1,0,3,0,0],[6,0,3,0,0],[1,2,0,0,0],[1,2,0,0,0],[6,0,1,0,0],[3,0,4,0,0],[3,0,2,0,0],[3,0,4,0,0],
  [1,2,0,0,0],[4,0,4,0,0],[1,2,0,0,0],[4,0,3,0,0],[4,0,2,0,0],[1,2,0,0,0],[1,2,0,0,0],[4,0,2,0,0],[6,0,1,0,0],[4,0,3,0,0],[6,0,2,0,0],[3,0,3,0,0],
  [4,0,3,0,0],[4,0,3,0,0],[6,0,1,0,0],[1,2,0,0,0],[6,0,1,0,0],[1,2,0,0,0],[1,0,4,0,0],[6,0,2,0,0],[3,0,3,0,0],[1,2,0,0,0],[1,0,2,0,0],[4,0,2,0,0],
  [6,0,1,0,0],[4,0,4,0,0],[4,0,5,0,0],[3,0,2,0,0],[1,2,0,0,0],[4,0,3,0,0],[6,0,1,0,0],[4,0,3,0,0],[1,2,0,0,0],[4,0,5,0,0],[1,0,2,0,0],[4,0,2,0,0],
  [4,0,2,0,0],[6,0,1,0,0],[6,0,1,0,0],[3,0,3,0,0],[6,0,1,0,0],[4,0,4,0,0],[1,2,0,0,0],[1,2,0,0,0],[1,0,3,0,0],[1,2,0,0,0],[4,0,3,0,0],[4,0,3,0,0],
  [4,0,4,0,0],[4,0,3,0,0],[4,0,2,0,0],[4,0,5,0,0],[1,0,2,0,0],[4,0,2,0,0],[1,3,4,0,0],[4,0,5,0,0],[4,0,2,0,0],[4,0,2,0,0],[1,2,0,0,0],[4,0,2,0,0],
  [4,0,2,0,0],[4,0,3,0,0],[4,0,3,0,0],[4,0,4,0,0],[4,0,4,0,0],[4,0,3,0,0],[1,3,4,0,0],[1,2,0,0,0],[4,0,4,0,0],[4,0,5,0,0],[4,0,5,0,0],[1,2,0,0,0],
  [4,0,3,0,0],[4,0,3,0,0],[4,0,2,0,0],[4,0,3,0,0],[4,0,3,0,0],[4,0,4,0,0],[4,0,3,0,0],[4,0,4,0,0],[4,0,3,0,0],[1,2,0,0,0],[1,2,0,0,0],[4,0,4,0,0],
  [4,0,3,0,0],[4,0,3,0,0],[4,0,3,0,0],[4,0,4,0,0],[4,0,3,0,0],[4,0,3,0,0],
];
// END OIKUMENE_CELLS
