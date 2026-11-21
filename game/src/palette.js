// palette.js — colours from GAME_DESIGN.md "Art direction: palette".
// Type colours are reserved for the network (ley-rails, train accents, icons, cards, legend).

/** The seven train-type colours (network only). Keys match layer/type ids used by the sim. */
export const TYPE_COLORS = {
  surface: '#ffc23d', // lightning, yellow
  sky: '#4fe3ff',     // wind, ice-cyan
  water: '#2f6bff',   // deep blue
  earth: '#2fd67b',   // emerald green
  fire: '#ff5a1f',    // red-orange
  space: '#9b6bff',   // violet
  deep: '#ff3fb4',    // deep space, magenta
};

/** Display order of types everywhere (cards, legend, layer filter Shift+1..7). */
export const TYPE_ORDER = ['surface', 'sky', 'water', 'earth', 'fire', 'space', 'deep'];

export const TYPE_NAMES = {
  surface: 'Surface', sky: 'Sky', water: 'Water', earth: 'Earth', fire: 'Fire', space: 'Space', deep: 'Deep space',
};

/** World colours (never a type hex). */
export const WORLD_COLORS = {
  nightSky: '#141a3a',
  chrome: '#c9d2e3',
  cityLights: '#ffd9a0',     // warm white
  neonRose: '#ff6f91',       // emissive <= 0.3, haze opacity <= 0.15
  neonTeal: '#12707a',       // emissive <= 0.3, haze opacity <= 0.15
  gunmetal: '#2b3040',
  walkway: '#e3ecf7',        // walkway light strips, X-ray shell edge
  park: '#7aa84a',
  rock: '#5a4a40',
  rockDark: '#2a2320',
  core: '#7a1a0c',
  sea: '#0a2c47',
  seaShallow: '#0f3557',
  riftLava: '#a3281a',
};

/** Neon intensity caps (checked by tools/contrast.mjs). */
export const NEON_CAPS = { emissive: 0.3, hazeOpacity: 0.15 };

/** Flow-overlay load markers: pure white with a dark outline (used for nothing else). */
export const LOAD_MARKER = { fill: '#ffffff', outline: '#141a3a' };

/** Region tint hints for UI outlines (world colours, saturation kept low or far from type hues). */
export const REGION_COLORS = {
  capital: '#d8c9a8', brine: '#0f3557', spires: '#8a7f8f', rift: '#a3281a', flats: '#9a8f7a', ringside: '#b8c0d8', farwards: '#6d7385',
};

/** Hex '#rrggbb' → [r,g,b] in 0..1. */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// each lead car's average base colour (measured from its texture by bake()), used for the trailing capsules,
// so capsules look the same before and after the train models arrive in the background
export const AVG_CAR_COLORS = { surface: '#554e2f', sky: '#76acb7', water: '#495970', earth: '#47574c', fire: '#3c2517', space: '#5e5671', deep: '#422a3a' };
