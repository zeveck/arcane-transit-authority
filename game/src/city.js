// city.js — Oikumene drawn from the frozen cell table: geodesic ground (streets, rock, lava ridges, sea
// floor), instanced megablocks with lit windows, smokestacks and smoke, the see-through sea with Atlantis
// domes, the molten core and the X-ray interior, region outlines, cell outlines, demolition and greenery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getCells, getGrid, TERRAIN } from './planet.js';
import { clipMaterial, XRAY, XRAY_GLSL } from './xray.js';
import { SUN_DIR } from './scene.js';

const R = 100, SEA_FLOOR = 94;
const REGION_GROUND = { capital: '#5a606c', brine: '#3f4d57', spires: '#454a56', rift: '#2e2626', flats: '#383c45', ringside: '#4a4e58', farwards: '#40444e' };
const REGION_ACCENT = { capital: '#ffd9a0', brine: '#b8d4f0', spires: '#e8f0ff', rift: '#ffb59a', flats: '#d8d0ff', ringside: '#ffd9a0', farwards: '#ffd9a0' };
// building tint bias per region (instance colours; low saturation world colours)
const REGION_BUILD = {
  capital: ['#c9d2e3', '#aab4c8', '#8e98ad'], brine: ['#e8edf2', '#cfd8e2', '#b8c6d4'], spires: ['#e6ecf5', '#c9d2e3', '#aeb8cc'],
  rift: ['#5e5248', '#6e6258', '#4a403a'], flats: ['#3c4150', '#4a4f60', '#2f3442'], ringside: ['#c0c6d6', '#a7aec2', '#d4d9e4'], farwards: ['#9aa2b4', '#7f879a', '#b4bccb'],
};
// block shape mix per region: [tower, slab, dome, spire, factory]
const REGION_MIX = {
  capital: [4, 2, 1, 2, 1], brine: [2, 2, 3, 1, 0.5], spires: [2, 1, 1, 4, 0.5], rift: [1, 2, 1, 0.5, 3],
  flats: [1, 2, 0.5, 0.5, 5], ringside: [3, 2, 2, 1, 1], farwards: [2, 3, 1, 1, 2],
};

function frame(n) {
  const up = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  let e1 = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
  const l = Math.hypot(...e1); e1 = e1.map((x) => x / l);
  const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  return { e1, e2 };
}
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hexc = (h) => new THREE.Color(h);

let seed = 99;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export function cellRadius(c) {
  if (c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS) return SEA_FLOOR;
  return c.ground;
}

export class City {
  constructor(scene, textures, env, quality) {
    this.scene = scene; this.tex = textures; this.quality = quality;
    this.cells = getCells(); this.grid = getGrid();
    this.root = new THREE.Group(); this.root.name = 'city'; scene.add(this.root);
    this.cellVerts = new Map();  // cellId -> { mesh, start, count } (ground vertex range)
    this.state = new Int8Array(this.cells.length); // 0 normal, 1 cleared, 2 grove, 3 park, 4 attraction
    this.buildGround();
    this.buildSea();
    this.buildCore();
    this.buildRegionOutlines();
    this.buildCrags();
    this.outlines = new Map();
    this.anims = [];
    this.buildTrees();
    this.buildSmoke();
  }

  // ------------------------------------------------------------------ ground
  buildGround() {
    const cells = this.cells, grid = this.grid;
    // corner -> cells sharing it
    const key = (v) => `${Math.round(v[0] * 2e4)},${Math.round(v[1] * 2e4)},${Math.round(v[2] * 2e4)}`;
    const share = new Map();
    cells.forEach((c) => grid.corners[c.id].forEach((k) => { const s = key(k); if (!share.has(s)) share.set(s, []); share.get(s).push(c.id); }));
    const cornerR = (k) => { const ids = share.get(key(k)) || []; return ids.reduce((s, i) => s + cellRadius(cells[i]), 0) / Math.max(1, ids.length); };
    // night-lights glow per vertex: the cell's density (0..1), averaged at shared corners so it fades softly across borders
    const glowOf = (i) => (cells[i].isCity ? Math.min(1, (cells[i].density || 0) / 5) : 0);
    const cornerGlow = (k) => { const ids = share.get(key(k)) || []; return ids.reduce((s, i) => s + glowOf(i), 0) / Math.max(1, ids.length); };
    this._glowCorner = cornerGlow;
    const cornerTint = (k) => {
      const ids = share.get(key(k)) || []; const col = new THREE.Color(0, 0, 0);
      ids.forEach((i) => col.add(hexc(REGION_GROUND[cells[i].areaId]))); return col.multiplyScalar(1 / Math.max(1, ids.length));
    };
    const buckets = { city: [], rock: [], lava: [], sea: [] };
    for (const c of cells) {
      const b = c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS ? 'sea'
        : c.terrain === TERRAIN.MOUNTAIN ? (c.areaId === 'rift' ? 'lava' : 'rock') : 'city';
      buckets[b].push(c);
    }
    this.groundMeshes = {};
    this.groundGeo = {};
    const mats = {
      city: this.groundMaterial(this.tex.streets, 'city'),
      rock: this.groundMaterial(this.tex.rock, 'rock'),
      lava: this.groundMaterial(this.tex.lava, 'lava'),
      sea: this.groundMaterial(this.tex.seafloor, 'sea'),
    };
    for (const [b, list] of Object.entries(buckets)) {
      const P = [], N = [], UV = [], C = [], S = [], GL = [];
      let vcount = 0;
      for (const c of list) {
        const start = vcount;
        const Cn = c.pos, rc = cellRadius(c);
        const { e1, e2 } = frame(Cn);
        const corners = grid.corners[c.id];
        const n = corners.length;
        const mountain = c.terrain === TERRAIN.MOUNTAIN;
        const innerR = mountain ? R + (c.height) * 0.9 : rc;
        const centreR = rc;
        const tint = hexc(REGION_GROUND[c.areaId]);
        const uvs = (p) => { const d = [p[0] * R - Cn[0] * R, p[1] * R - Cn[1] * R, p[2] * R - Cn[2] * R]; const sc = b === 'city' ? 1 / 9 : 1 / 14; return [(d[0] * e1[0] + d[1] * e1[1] + d[2] * e1[2]) * sc + c.id * 0.37, (d[0] * e2[0] + d[1] * e2[1] + d[2] * e2[2]) * sc + c.id * 0.61]; };
        const gc = glowOf(c.id);
        const push = (u, r, col, snow, gl = gc) => { P.push(u[0] * r, u[1] * r, u[2] * r); const t = uvs(u); UV.push(t[0], t[1]); C.push(col.r, col.g, col.b); S.push(snow); GL.push(gl); vcount++; };
        const inner = corners.map((k) => nrm(mix3(Cn, k, 0.74)));
        const jit = corners.map((_, j) => mountain ? (0.82 + 0.18 * Math.abs(Math.sin(c.id * 12.9898 + j * 78.233) * 43758.5453 % 1)) : 1);
        const snowC = c.peak ? 1 : mountain && c.height > 7 ? 0.5 : 0;
        const snowI = c.peak ? 0.6 : mountain && c.height > 7 ? 0.2 : 0;
        for (let j = 0; j < n; j++) {
          const j2 = (j + 1) % n;
          const k1 = corners[j], k2 = corners[j2];
          // centre fan
          const r1 = mountain ? R + (innerR - R) * jit[j] : innerR, r2 = mountain ? R + (innerR - R) * jit[j2] : innerR;
          push(Cn, centreR, tint, snowC); push(inner[j], r1, tint, snowI); push(inner[j2], r2, tint, snowI);
          // skirt quad
          const t1 = cornerTint(k1), t2 = cornerTint(k2);
          const g1 = cornerGlow(k1), g2 = cornerGlow(k2);
          push(inner[j], r1, tint, snowI); push(k1, cornerR(k1), t1, 0, g1); push(k2, cornerR(k2), t2, 0, g2);
          push(inner[j], r1, tint, snowI); push(k2, cornerR(k2), t2, 0, g2); push(inner[j2], r2, tint, snowI);
        }
        this.cellVerts.set(c.id, { bucket: b, start, count: vcount - start });
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setAttribute('snow', new THREE.Float32BufferAttribute(S, 1));
      g.setAttribute('glow', new THREE.Float32BufferAttribute(GL, 1));
      g.computeVertexNormals();
      // fix winding so faces point outward
      const pos = g.attributes.position.array;
      for (let i = 0; i < pos.length; i += 9) {
        const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
        const ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az, vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (nx * ax + ny * ay + nz * az < 0) { for (const att of Object.values(g.attributes)) { const s = att.itemSize, a = att.array, o = (i / 3); for (let q = 0; q < s; q++) { const t = a[(o + 1) * s + q]; a[(o + 1) * s + q] = a[(o + 2) * s + q]; a[(o + 2) * s + q] = t; } } }
      }
      g.computeVertexNormals();
      this.origColors = this.origColors || {};
      this.origColors[b] = g.attributes.color.array.slice();
      this.origGlow = this.origGlow || {}; this.origGlow[b] = g.attributes.glow.array.slice();
      const mesh = new THREE.Mesh(g, mats[b]);
      mesh.name = 'ground-' + b;
      this.root.add(mesh);
      this.groundMeshes[b] = mesh; this.groundGeo[b] = g;
    }
  }

  groundMaterial(map, kind) {
    const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: kind === 'sea' ? 0.9 : kind === 'city' ? 0.6 : 0.8, metalness: kind === 'city' ? 0.3 : 0.05, envMapIntensity: kind === 'city' ? 0.8 : 0.6 });
    const uni = this.groundUniforms = this.groundUniforms || { uLights: { value: 1 }, uFar: { value: 0 }, uTime: XRAY.uniforms.uTime };
    clipMaterial(m, (sh) => {
      sh.uniforms.uLights = uni.uLights; sh.uniforms.uFar = uni.uFar; sh.uniforms.uTime = uni.uTime;
      sh.vertexShader = 'attribute float snow; attribute float glow; varying float vSnow; varying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSnow = snow; vGlow = glow;');
      sh.fragmentShader = 'varying float vSnow; varying float vGlow; uniform float uLights; uniform float uFar; uniform float uTime;\n' + sh.fragmentShader;
      if (kind === 'city') {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
          vec4 texel = texture2D(map, vMapUv);
          float lum = dot(texel.rgb, vec3(0.3,0.5,0.2));
          diffuseColor.rgb *= texel.rgb * 13.0;
        `).replace('#include <emissivemap_fragment>', `
          float lit = smoothstep(0.12, 0.32, lum);
          totalEmissiveRadiance += vec3(1.0,0.78,0.52) * lit * 1.1 * uLights;
          // Night lights, pre-filtered so nothing shimmers as the globe turns (request 34). Every detail fades to its
          // own average once it would be smaller than a few pixels (screen-space derivatives), and nothing twinkles.
          // 1) district lights: hashed dots on a fine grid, warm white with a few pale-blue and rose neon; drawn only
          //    while a dot covers >= ~3 px, then replaced by their mean glow
          vec2 gg = vMapUv * 16.0; vec2 gid = floor(gg); float hh = fract(sin(dot(gid, vec2(127.1, 311.7))) * 43758.5453);
          // soft clusters: smooth value noise at ~4 units (many pixels wide even from orbit, so it never aliases)
          vec2 cq = vMapUv * 2.2; vec2 ci = floor(cq); vec2 cf = fract(cq); cf = cf * cf * (3.0 - 2.0 * cf);
          float h00 = fract(sin(dot(ci, vec2(41.3, 289.1))) * 43758.5453), h10 = fract(sin(dot(ci + vec2(1.0, 0.0), vec2(41.3, 289.1))) * 43758.5453);
          float h01 = fract(sin(dot(ci + vec2(0.0, 1.0), vec2(41.3, 289.1))) * 43758.5453), h11 = fract(sin(dot(ci + vec2(1.0, 1.0), vec2(41.3, 289.1))) * 43758.5453);
          float cn = mix(mix(h00, h10, cf.x), mix(h01, h11, cf.x), cf.y);
          // 2) from orbit: the dots' mean light as a smooth glow, brighter toward dense districts and in soft clusters
          float dens = 0.1 + 3.4 * vGlow * vGlow * (0.25 + 1.6 * cn * cn);
          vec3 dotsAvg = mix(vec3(0.85, 0.88, 1.0), vec3(1.0, 0.78, 0.5), vGlow) * 0.017 * dens;
          float fwG = max(fwidth(gg).x, fwidth(gg).y);
          float dotDetail = 1.0 - smoothstep(0.05, 0.12, fwG);
          vec3 dots = dotsAvg;
          if (dotDetail > 0.0) {
            vec2 jo = vec2(fract(hh * 13.7), fract(hh * 7.3)) * 0.5 - 0.25;
            float dm = smoothstep(0.2, 0.0, length(fract(gg) - 0.5 - jo)) * step(0.4, hh);
            vec3 lc = hh > 0.95 ? vec3(1.0, 0.43, 0.57) : hh > 0.88 ? vec3(0.72, 0.85, 1.0) : vec3(1.0, 0.82, 0.58);
            dots = mix(dotsAvg, lc * dm * 0.75, dotDetail);
          }
          totalEmissiveRadiance += dots * uFar * 2.6;
          // 3) neon street lines (rose and teal, capped low): anti-aliased, and faded out before they get thinner
          //    than a pixel or their grid starts to beat against the pixel grid (no moire at any angle or zoom)
          vec2 sc2 = vMapUv * 2.0; vec2 fwS = max(fwidth(sc2), vec2(1e-5));
          vec2 sl = abs(fract(sc2) - 0.5);
          vec2 lxy = 1.0 - smoothstep(vec2(0.0), vec2(0.015) + fwS, sl);
          float lineDetail = 1.0 - smoothstep(0.012, 0.03, max(fwS.x, fwS.y));
          float line = max(lxy.x, lxy.y);
          vec3 nc = fract(hh * 3.1) > 0.5 ? vec3(1.0, 0.435, 0.569) : vec3(0.07, 0.44, 0.48) * 2.0;
          // far away the lines become their mean: a faint, even rose-teal haze (their average colour, never per-pixel)
          totalEmissiveRadiance += mix(vec3(0.57, 0.66, 0.76) * 0.035, nc * line, lineDetail) * 0.3;
        `);
      } else if (kind === 'lava') {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
          vec4 texel = texture2D(map, vMapUv + vec2(uTime*0.004, 0.0));
          diffuseColor.rgb *= texel.rgb * 6.0;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92,0.95,1.0), vSnow*0.0);
        `).replace('#include <emissivemap_fragment>', `
          float hot = smoothstep(0.18, 0.5, texel.r - texel.b);
          totalEmissiveRadiance += vec3(0.64,0.16,0.10) * hot * 1.6;
        `);
      } else {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
          vec4 texel = texture2D(map, vMapUv);
          diffuseColor.rgb *= texel.rgb * ${kind === 'sea' ? '7.0' : '7.5'};
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86,0.9,0.98), smoothstep(0.25, 0.8, vSnow));
        `);
      }
    }, 'ground-' + kind);
    return m;
  }

  /** Recolour one cell's ground (park green, cleared concrete, or back to normal). */
  tintCell(id, color, amount = 1) {
    const v = this.cellVerts.get(id); if (!v) return;
    const g = this.groundGeo[v.bucket]; const arr = g.attributes.color.array; const orig = this.origColors[v.bucket];
    const col = color ? hexc(color) : null;
    for (let i = v.start; i < v.start + v.count; i++) {
      // only the cell's inner vertices (keep skirt corners blending)
      for (let q = 0; q < 3; q++) arr[i * 3 + q] = col ? orig[i * 3 + q] * (1 - amount) + [col.r, col.g, col.b][q] * amount : orig[i * 3 + q];
    }
    g.attributes.color.needsUpdate = true;
    // cleared corridors and parks have no night lights: dim the cell's glow by the same amount
    const ga = g.attributes.glow, og = this.origGlow?.[v.bucket];
    if (ga && og) { for (let i = v.start; i < v.start + v.count; i++) ga.array[i] = col ? og[i] * (1 - amount) : og[i]; ga.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ mountains: rock crags with snow
  buildCrags() {
    const cg = new THREE.ConeGeometry(1, 1, 5, 3); cg.translate(0, 0.5, 0);
    // jag the cone a little and paint snow toward the tip
    const pos = cg.attributes.position; const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); const k = 1 + Math.sin(i * 7.31) * 0.18 * (y < 0.95 ? 1 : 0);
      pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
      const snow = Math.max(0, Math.min(1, (y - 0.55) / 0.3));
      const c = [0.40 + snow * 0.5, 0.39 + snow * 0.53, 0.42 + snow * 0.55]; col.set(c, i * 3);
    }
    cg.setAttribute('color', new THREE.BufferAttribute(col, 3)); cg.computeVertexNormals();
    const mat = clipMaterial(new THREE.MeshStandardMaterial({ map: this.tex.rock, vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: true }), (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', 'vec4 texel = texture2D(map, vMapUv); diffuseColor.rgb *= mix(texel.rgb*2.4, vec3(1.0), smoothstep(0.75,0.95,vColor.b));');
    }, 'crags');
    const list = [];
    seed = 31337;
    for (const c of this.cells) {
      if (c.terrain !== TERRAIN.MOUNTAIN) continue;
      const { e1, e2 } = frame(c.pos);
      const n = c.peak ? 5 : 2 + (c.height > 7 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(); const r = c.peak ? 3.2 + rnd() * 2.2 : 3 + rnd() * 2.6;
        const p = nrm([c.pos[0] * R + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r, c.pos[1] * R + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r, c.pos[2] * R + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r]);
        const f = Math.min(1, r / 5.5);
        const base = c.ground + (R + c.height * 0.75 - c.ground) * f - 0.8;
        const hgt = (c.peak ? 2.6 + rnd() * 2.6 : 1.0 + rnd() * 1.6) * (0.7 + c.height / 24);
        list.push({ p, base, w: (c.peak ? 2.4 : 2.0) + rnd() * 1.6, h: hgt, yaw: rnd() * 6.28 });
      }
    }
    const im = new THREE.InstancedMesh(cg, mat, list.length); im.name = 'crags';
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    list.forEach((k, i) => { const pv = new THREE.Vector3(...k.p); q.setFromUnitVectors(up, pv).multiply(qy.setFromAxisAngle(up, k.yaw)); m.compose(pv.multiplyScalar(k.base), q, new THREE.Vector3(k.w * 1.5, k.h, k.w * 0.75)); im.setMatrixAt(i, m); });
    this.root.add(im); this.crags = im;
  }

  // ------------------------------------------------------------------ buildings
  /** (Re)build every block from the term's densities (Int8Array or array per cell). */
  buildBuildings(densities) {
    if (this.blocks) { for (const m of this.blocks.meshes) { this.root.remove(m); m.geometry.dispose(); } }
    seed = 4242;
    const shapes = blockShapes();
    const mat = this.buildingMaterial();
    const perShape = [[], [], [], [], []];
    const cellInst = new Map(); // cellId -> [{shape, index}]
    const hi = this.quality !== 'low';
    const stacks = [];
    const holos = [];
    for (const c of this.cells) {
      if (!c.isCity) continue;
      const d = densities ? densities[c.id] : c.density;
      if (!d) continue;
      let n = hi ? 2 + d : Math.ceil((1 + d) / 2);
      const slots = [[0, 0]];
      for (let k = 0; k < 6; k++) slots.push([k * Math.PI / 3, 3.3]);
      for (let k = 0; k < 6; k++) slots.push([k * Math.PI / 3 + Math.PI / 6, 5.4]);
      const rot = rnd() * Math.PI * 2; const order = slots.map((x, i) => [x, rnd() + (i === 0 ? -0.3 : i < 7 ? 0 : 0.4)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      const { e1, e2 } = frame(c.pos);
      const mixw = REGION_MIX[c.areaId];
      const tints = REGION_BUILD[c.areaId];
      const mountain = c.terrain === TERRAIN.MOUNTAIN;
      const list = [];
      for (let i = 0; i < n; i++) {
        // pick a shape by the region's mix
        let w = rnd() * mixw.reduce((a, b) => a + b, 0), s = 0;
        for (; s < 4; s++) { w -= mixw[s]; if (w <= 0) break; }
        const sl = order[i % order.length];
        const ang = sl[0] + rot + (rnd() - 0.5) * 0.3;
        const rad = sl[1] + (rnd() - 0.5) * 0.8;
        const off = [e1[0] * Math.cos(ang) * rad + e2[0] * Math.sin(ang) * rad, e1[1] * Math.cos(ang) * rad + e2[1] * Math.sin(ang) * rad, e1[2] * Math.cos(ang) * rad + e2[2] * Math.sin(ang) * rad];
        const p = nrm([c.pos[0] * R + off[0], c.pos[1] * R + off[1], c.pos[2] * R + off[2]]);
        const f = Math.min(1, rad / 5.5);
        const base = mountain ? (c.ground + (R + c.height * 0.8 - c.ground) * f) - 0.4 : R - 0.15;
        const foot = (hi ? 2.5 : 3.2) * (0.8 + rnd() * 0.4) * (s === 4 ? 1.25 : 1);
        const h = (1 + (d - 1) * 1.35) * (0.7 + rnd() * 0.6) * (s === 3 ? 1.35 : s === 4 ? 0.55 : 1) * (c.areaId === 'capital' ? 1.15 : 1);
        const col = hexc(tints[(rnd() * tints.length) | 0]).multiplyScalar(0.6);
        const yaw = rnd() * Math.PI * 2;
        const neon = rnd(); const acc = neon < 0.18 ? '#ff6f91' : neon < 0.32 ? '#12707a' : REGION_ACCENT[c.areaId];
        const accK = neon < 0.32 ? 0.3 : 0.9;
        perShape[s].push({ p, base, foot, h, col, yaw, cell: c.id, acc: hexc(acc).multiplyScalar(accK) });
        if (rnd() < (hi ? 0.09 : 0.05) && d >= 2) holos.push({ p, top: base + h + 1.2 + rnd() * 1.5, s: 0.9 + rnd() * 0.8, kind: neon < 0.5 ? 0 : 1, cell: c.id });
        list.push({ s, i: perShape[s].length - 1 });
        if (s === 4 && d >= 3) stacks.push({ p, base, h: h + foot * 0.9, cell: c.id });
      }
      cellInst.set(c.id, list);
    }
    const meshes = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const info = [];
    perShape.forEach((arr, s) => {
      const geo = shapes[s];
      const accA = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, arr.length) * 3), 3); geo.setAttribute('accent', accA);
      arr.forEach((b, i) => accA.setXYZ(i, b.acc.r, b.acc.g, b.acc.b));
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, arr.length));
      im.count = arr.length;
      const recs = [];
      arr.forEach((b, i) => {
        const pv = new THREE.Vector3(...b.p);
        q.setFromUnitVectors(up, pv); qy.setFromAxisAngle(up, b.yaw); q.multiply(qy);
        const pos = pv.clone().multiplyScalar(b.base);
        m4.compose(pos, q, new THREE.Vector3(b.foot, b.h, b.foot));
        im.setMatrixAt(i, m4); im.setColorAt(i, b.col);
        recs.push({ pos, q: q.clone(), scale: new THREE.Vector3(b.foot, b.h, b.foot), cell: b.cell, k: 1 });
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.name = 'blocks-' + s; im.frustumCulled = false;
      this.root.add(im); meshes.push(im); info.push(recs);
    });
    this.blocks = { meshes, info, cellInst };
    this.buildHolos(holos);
    this.stacks = stacks;
    this.resetSmoke();
  }

  buildHolos(list) {
    if (this.holos) { this.root.remove(this.holos); }
    const g = new THREE.RingGeometry(0.55, 0.8, 6);
    const g2 = new THREE.PlaneGeometry(1.4, 0.7);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: XRAY.uniforms.uTime, ...XRAY.uniforms },
      vertexShader: `attribute vec3 hcol; varying vec3 vC; varying vec2 vU; ${XRAY_GLSL.vertDecl} void main(){ vC = hcol; vU = position.xy; vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vXWorld = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vC; varying vec2 vU; ${XRAY_GLSL.fragDecl} void main(){ ${XRAY_GLSL.fragBody} float scan = 0.6 + 0.4*sin(vU.y*40.0 - uTime*6.0); gl_FragColor = vec4(vC*scan*0.55, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const geo = mergeGeometries([g.toNonIndexed(), g2.toNonIndexed().translate(0, 0, 0)].map((x) => { x.deleteAttribute('uv'); x.deleteAttribute('normal'); return x; }));
    const n = Math.max(1, list.length);
    const hc = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute('hcol', hc);
    const im = new THREE.InstancedMesh(geo, mat, n); im.count = list.length; im.name = 'holograms'; im.frustumCulled = false;
    const cols = [hexc('#ff6f91'), hexc('#12707a').multiplyScalar(2.2)];
    list.forEach((h, i) => { const c = cols[h.kind]; hc.setXYZ(i, c.r, c.g, c.b); });
    this.holoList = list; this.holos = im; this.root.add(im);
    this.updateHolos(0);
  }
  updateHolos(t) {
    if (!this.holos) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), qy = new THREE.Quaternion();
    this.holoList.forEach((h, i) => {
      const n = new THREE.Vector3(...h.p); q.setFromUnitVectors(up, n); qy.setFromAxisAngle(up, t * 0.6 + i); q.multiply(qy);
      const on = this.state[h.cell] === 0 ? h.s : 0.0001;
      m.compose(n.clone().multiplyScalar(h.top + Math.sin(t * 1.3 + i) * 0.2), q, new THREE.Vector3(on, on, on)); this.holos.setMatrixAt(i, m);
    });
    this.holos.instanceMatrix.needsUpdate = true;
  }
  buildingMaterial(tint = null) {
    if (!tint && this._bmat) return this._bmat;
    if (tint && this._bmatT?.[tint]) return this._bmatT[tint];
    const win = this.tex.windows;
    const m = new THREE.MeshStandardMaterial({ color: tint ? new THREE.Color(tint) : 0xffffff, roughness: 0.28, metalness: 0.7, envMapIntensity: 1.3 });
    const uni = this.buildUniforms = this.buildUniforms || { uWin: { value: win }, uLit: { value: 1 }, uTime: XRAY.uniforms.uTime, uFar: { value: 0 } };
    clipMaterial(m, (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'attribute vec3 accent; varying vec3 vAcc; varying float vBand; varying vec2 vWinUv; varying float vWall; varying float vSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vAcc = accent;
        {
          float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz), sz = length(instanceMatrix[2].xyz);
          float u = abs(normal.x) > 0.5 ? position.z*sz : position.x*sx;
          vWinUv = vec2(u, position.y*sy) * 0.42;
          vWall = (abs(normal.y) < 0.5) ? 1.0 : 0.0;
          vBand = position.y*sy;
          vSeed = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898,78.233,37.719)))*43758.5453);
        }`);
      sh.fragmentShader = 'uniform sampler2D uWin; uniform float uLit; uniform float uTime; uniform float uFar; varying vec3 vAcc; varying float vBand; varying vec2 vWinUv; varying float vWall; varying float vSeed;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec4 wc = texture2D(uWin, vWinUv + vec2(vSeed*7.0, vSeed*3.0));
          float wl = dot(wc.rgb, vec3(0.33));
          diffuseColor.rgb *= mix(vec3(0.2), mix(vec3(0.22), wc.rgb*1.2, 0.7), vWall);
        `)
        .replace('#include <emissivemap_fragment>', `
          // window flicker only up close: from orbit a block is a few pixels and a flicker reads as twinkling noise
          float flick = 0.85 + 0.15*sin(uTime*(1.0+vSeed*3.0) + vSeed*40.0) * (1.0 - uFar);
          vec3 warm = vec3(1.0, 0.85, 0.62);
          totalEmissiveRadiance += mix(wc.rgb, warm * wl * 1.6, 0.35) * smoothstep(0.26, 0.6, wl) * 2.1 * uLit * vWall * flick;
          float band = smoothstep(0.86, 0.94, fract(vBand / 2.2)) * (1.0 - smoothstep(0.94, 1.0, fract(vBand / 2.2)));
          totalEmissiveRadiance += vAcc * band * vWall * 1.6;
          totalEmissiveRadiance += vAcc * (1.0 - vWall) * (0.1 + (uLit - 1.0) * 0.35) * (1.0 - uFar * 0.6);
        `)
        // from orbit, rougher metal: sub-pixel sun and env highlights on thousands of tiny blocks sparkle as the globe turns
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.75, uFar);');
    }, 'blocks');
    if (tint) { this._bmatT = this._bmatT || {}; this._bmatT[tint] = m; } else this._bmat = m;
    return m;
  }

  /** Sink (cleared) or raise (restored) a cell's blocks. */
  setCellCleared(id, cleared, animate = true) {
    this.state[id] = cleared ? 1 : 0;
    const list = this.blocks?.cellInst.get(id); if (!list) return;
    for (const { s, i } of list) {
      const rec = this.blocks.info[s][i];
      const from = rec.k, to = cleared ? 0 : 1;
      if (!animate) { rec.k = to; this.applyBlock(s, i); continue; }
      this.anims.push({ t: 0, dur: 0.9, fn: (u) => { rec.k = from + (to - from) * (cleared ? u * u : 1 - (1 - u) * (1 - u)); this.applyBlock(s, i); } });
    }
    if (cleared && animate) this.dust(id);
  }
  applyBlock(s, i) {
    const rec = this.blocks.info[s][i], im = this.blocks.meshes[s];
    const k = rec.k;
    const sc = rec.scale.clone(); sc.y = Math.max(0.0001, sc.y * k); if (k <= 0.001) sc.set(0.0001, 0.0001, 0.0001);
    const pos = rec.pos.clone().addScaledVector(rec.pos.clone().normalize(), -(1 - k) * 0.5);
    im.setMatrixAt(i, new THREE.Matrix4().compose(pos, rec.q, sc));
    im.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ greenery
  buildTrees() {
    const trunk = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5); trunk.translate(0, 0.3, 0);
    const crown = new THREE.ConeGeometry(0.5, 1.2, 7); crown.translate(0, 1.1, 0);
    const crown2 = new THREE.SphereGeometry(0.45, 7, 5); crown2.translate(0, 0.95, 0);
    const g = mergeGeometries([trunk.toNonIndexed(), crown.toNonIndexed()]);
    const mat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0x7aa84a, roughness: 0.8, metalness: 0.0, emissive: 0x1f3a12, emissiveIntensity: 0.4 }), null, 'trees');
    this.trees = new THREE.InstancedMesh(g, mat, 900); this.trees.count = 0; this.trees.frustumCulled = false;
    this.trees.name = 'trees';
    this.treeRecs = [];
    this.root.add(this.trees);
    void crown2;
  }
  /** kind: 'grove' | 'park' | null (remove). */
  setGreen(id, kind) {
    const c = this.cells[id];
    // remove existing trees on this cell
    const keep = this.treeRecs.filter((r) => r.cell !== id);
    this.treeRecs = keep;
    if (kind) {
      const { e1, e2 } = frame(c.pos);
      const n = kind === 'park' ? 14 : 7;
      seed = 1000 + id;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 5;
        const p = nrm([c.pos[0] * R + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r, c.pos[1] * R + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r, c.pos[2] * R + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r]);
        this.treeRecs.push({ cell: id, p: new THREE.Vector3(...p), base: c.terrain === TERRAIN.MOUNTAIN ? c.ground - 1 : R, s: 0.9 + rnd() * 0.9, t: -i * 0.05 });
      }
      this.tintCell(id, kind === 'park' ? '#4c7a30' : '#4f6f3a', kind === 'park' ? 0.85 : 0.6);
    }
    this.refreshTrees();
  }
  refreshTrees() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    this.trees.count = Math.min(900, this.treeRecs.length);
    for (let i = 0; i < this.trees.count; i++) {
      const r = this.treeRecs[i];
      const grow = Math.max(0, Math.min(1, r.t / 0.5));
      const bounce = grow < 1 ? 1 + Math.sin(grow * Math.PI) * 0.35 : 1;
      q.setFromUnitVectors(up, r.p);
      m.compose(r.p.clone().multiplyScalar(r.base), q, new THREE.Vector3(1, 1, 1).multiplyScalar(Math.max(0.0001, r.s * grow * bounce)));
      this.trees.setMatrixAt(i, m);
    }
    this.trees.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ smoke and dust
  buildSmoke() {
    const n = this.quality === 'low' ? 60 : 200;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 }, ...XRAY.uniforms },
      vertexShader: `attribute float alpha; attribute float size; varying float vA; uniform float uPx; ${XRAY_GLSL.vertDecl}
        void main(){ vA=alpha; ${XRAY_GLSL.vertBody()} vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize = size*uPx*300.0/max(1.0,-mv.z); }`,
      fragmentShader: `varying float vA; ${XRAY_GLSL.fragDecl} void main(){ ${XRAY_GLSL.fragBody} float r=length(gl_PointCoord-.5); float a=smoothstep(.5,.1,r)*vA; gl_FragColor=vec4(vec3(0.55,0.56,0.64)*a, a); }`,
      transparent: true, depthWrite: false,
    });
    this.smoke = new THREE.Points(g, mat); this.smoke.frustumCulled = false; this.smoke.name = 'smoke';
    this.smokeP = Array.from({ length: n }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 1, kind: 0 }));
    this.root.add(this.smoke);
  }
  resetSmoke() { for (const p of this.smokeP) p.life = 0; this._smokeAcc = 0; }
  spawnParticle(pos, vel, life, size, kind) {
    const p = this.smokeP.find((q) => q.life <= 0); if (!p) return;
    p.p.copy(pos); p.v.copy(vel); p.life = p.max = life; p.s = size; p.kind = kind;
  }
  dust(id) {
    const c = this.cells[id];
    const n = new THREE.Vector3(...c.pos);
    for (let i = 0; i < 14; i++) {
      const j = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(7);
      this.spawnParticle(n.clone().multiplyScalar(R + 0.5).add(j), n.clone().multiplyScalar(0.6 + rnd()), 1.6, 1.6 + rnd(), 1);
    }
  }
  updateParticles(dt, camDist) {
    // smokestacks (only near enough to see)
    if (this.stacks?.length && camDist < 260) {
      this._smokeAcc = (this._smokeAcc || 0) + dt * Math.min(30, this.stacks.length) * 0.6;
      while (this._smokeAcc > 1) {
        this._smokeAcc -= 1;
        const s = this.stacks[(rnd() * this.stacks.length) | 0];
        if (this.state[s.cell] !== 0) continue;
        const n = new THREE.Vector3(...s.p);
        this.spawnParticle(n.clone().multiplyScalar(s.base + s.h), n.clone().multiplyScalar(0.5).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.2)), 3.5, 0.8, 0);
      }
    }
    const pa = this.smoke.geometry.attributes;
    this.smokeP.forEach((p, i) => {
      if (p.life > 0) { p.life -= dt; p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 0.4); }
      const a = p.life > 0 ? Math.min(1, p.life / p.max * 1.5) * (p.kind ? 0.7 : 0.35) : 0;
      pa.position.setXYZ(i, p.p.x, p.p.y, p.p.z); pa.alpha.setX(i, a); pa.size.setX(i, p.s * (1 + (1 - p.life / p.max) * 1.5));
    });
    pa.position.needsUpdate = pa.alpha.needsUpdate = pa.size.needsUpdate = true;
  }

  // ------------------------------------------------------------------ sea, Atlantis
  buildSea() {
    const cells = this.cells, grid = this.grid;
    const P = [], SH = [];
    for (const c of cells) {
      if (!(c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS)) continue;
      const k = grid.corners[c.id]; const n = k.length;
      const sh = c.coastal ? 1 : 0;
      for (let j = 0; j < n; j++) {
        const a = k[j], b = k[(j + 1) % n];
        // subdivide the fan a little so the shell stays round
        const m1 = nrm(mix3(c.pos, a, 0.5)), m2 = nrm(mix3(c.pos, b, 0.5)), m3 = nrm(mix3(a, b, 0.5));
        const tri = (p, q, r) => { for (const v of [p, q, r]) { P.push(v[0] * R, v[1] * R, v[2] * R); SH.push(sh); } };
        tri(c.pos, m1, m2); tri(m1, a, m3); tri(m1, m3, m2); tri(m2, m3, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('shallow', new THREE.Float32BufferAttribute(SH, 1));
    // outward winding
    const pos = g.attributes.position.array;
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      const ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az, vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
      if ((uy * vz - uz * vy) * ax + (uz * vx - ux * vz) * ay + (ux * vy - uy * vx) * az < 0) {
        for (const att of [g.attributes.position, g.attributes.shallow]) { const s = att.itemSize, a = att.array, o = i / 3; for (let q = 0; q < s; q++) { const t = a[(o + 1) * s + q]; a[(o + 1) * s + q] = a[(o + 2) * s + q]; a[(o + 2) * s + q] = t; } }
      }
    }
    const low = this.quality === 'low';
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: XRAY.uniforms.uTime, uSun: { value: SUN_DIR.clone() }, uRipple: { value: 0 }, uRippleAt: { value: new THREE.Vector3() }, ...XRAY.uniforms },
      vertexShader: `attribute float shallow; varying float vSh; varying vec3 vN; varying vec3 vW; ${XRAY_GLSL.vertDecl}
        void main(){ vSh=shallow; vN=normalize(position); vW=(modelMatrix*vec4(position,1.)).xyz; vXWorld=vW; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uSun; uniform float uRipple; uniform vec3 uRippleAt; varying float vSh; varying vec3 vN; varying vec3 vW; ${XRAY_GLSL.fragDecl}
        void main(){ ${XRAY_GLSL.fragBody}
          vec3 V = normalize(cameraPosition - vW);
          vec3 N = vN;
          ${low ? '' : 'N = normalize(N + 0.025*vec3(sin(vW.x*0.9+uTime*0.8), sin(vW.y*1.1+uTime*0.7), sin(vW.z*0.8-uTime*0.9)));'}
          if (uRipple > 0.0) { float d = distance(vW, uRippleAt); N = normalize(N + 0.08*uRipple*sin(d*1.4 - uTime*6.0)*normalize(vW-uRippleAt)); }
          float f = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          float alpha = mix(0.35, 0.85, f);
          vec3 deep = vec3(0.039,0.172,0.278), sh = vec3(0.059,0.208,0.341);
          vec3 col = mix(deep, sh, vSh) * 1.3;
          col += vec3(0.25,0.35,0.5) * f * 0.6;
          ${low ? '' : 'vec3 H = normalize(uSun + V); col += vec3(0.8,0.85,1.0)*pow(max(dot(N,H),0.0),80.0)*0.8;'}
          gl_FragColor = vec4(col, alpha);
        }`,
      transparent: true, depthWrite: false,
    });
    this.seaMat = mat;
    const sea = new THREE.Mesh(g, mat); sea.renderOrder = 5; sea.name = 'sea';
    this.root.add(sea); this.sea = sea;

    // Atlantis: glass domes on the sea floor with small glowing towers and a pale-blue rim
    const atl = cells.filter((c) => c.terrain === TERRAIN.ATLANTIS);
    this.atlantis = atl.map((c) => c.id);
    const domeG = new THREE.SphereGeometry(5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.ShaderMaterial({
      uniforms: { ...XRAY.uniforms },
      vertexShader: `varying vec3 vN; varying vec3 vW; ${XRAY_GLSL.vertDecl} void main(){ vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; vXWorld=vW; vN=normalize(mat3(modelMatrix*instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vW; ${XRAY_GLSL.fragDecl} void main(){ ${XRAY_GLSL.fragBody} vec3 V=normalize(cameraPosition-vW); float f=pow(1.0-abs(dot(vN,V)),2.5); gl_FragColor=vec4(vec3(0.72,0.83,0.94)*(0.12+f*0.9), 0.15+f*0.55); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const domes = new THREE.InstancedMesh(domeG, domeMat, Math.max(1, atl.length)); domes.renderOrder = 4; domes.name = 'atlantis-domes';
    const rimG = new THREE.TorusGeometry(5, 0.18, 6, 40); rimG.rotateX(Math.PI / 2);
    const rimMat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0xb8d4f0, emissiveIntensity: 1.4 }), null, 'rim');
    const rims = new THREE.InstancedMesh(rimG, rimMat, Math.max(1, atl.length)); rims.name = 'atlantis-rims';
    // the city's own megablocks (lit windows, accent bands), pearl-teal, under the domes
    const shapes = blockShapes();
    const towG = shapes[0], spG = shapes[2];
    const atlN = Math.max(1, atl.length * 9);
    for (const g2 of [towG, spG]) { const acc = new THREE.InstancedBufferAttribute(new Float32Array(atlN * 3), 3); for (let i = 0; i < atlN; i++) acc.setXYZ(i, 0.35, 0.85, 0.8); g2.setAttribute('accent', acc); }
    const towMat = this.buildingMaterial('#a8e6df');
    const tows = new THREE.InstancedMesh(towG, towMat, atlN); tows.name = 'atlantis-towers';
    const tows2 = new THREE.InstancedMesh(spG, towMat, atlN); tows2.name = 'atlantis-towers-2';
    let ti2 = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    let ti = 0; seed = 777;
    atl.forEach((c, i) => {
      const n = new THREE.Vector3(...c.pos); q.setFromUnitVectors(up, n);
      m.compose(n.clone().multiplyScalar(SEA_FLOOR), q, new THREE.Vector3(1, 1, 1)); domes.setMatrixAt(i, m); rims.setMatrixAt(i, m);
      const { e1, e2 } = frame(c.pos);
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * 6.283 + rnd(), r = k === 0 ? 0 : 1.3 + rnd() * 2.0;
        const p = nrm([c.pos[0] * R + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r, c.pos[1] * R + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r, c.pos[2] * R + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r]);
        const pv = new THREE.Vector3(...p);
        const h = k === 0 ? 3.6 : 0.8 + rnd() * 2.2 * (1 - r / 4);
        const qq = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(...p)).multiply(new THREE.Quaternion().setFromAxisAngle(up, rnd() * 6.283));
        if (k % 3 === 2) { m.compose(pv.multiplyScalar(SEA_FLOOR), qq, new THREE.Vector3(1.4, Math.max(0.9, h * 0.8), 1.4)); tows2.setMatrixAt(ti2++, m); }
        else { m.compose(pv.multiplyScalar(SEA_FLOOR), qq, new THREE.Vector3(1.3, Math.max(0.8, h * 1.1), 1.3)); tows.setMatrixAt(ti++, m); }
      }
    });
    tows.count = ti; tows2.count = ti2;
    this.root.add(domes, rims, tows, tows2);
  }

  // ------------------------------------------------------------------ core and X-ray interior
  buildCore() {
    const coreTex = this.tex.core;
    const coreMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: coreTex }, uTime: XRAY.uniforms.uTime, uFlare: { value: 0 }, uCut: { value: new THREE.Vector4(0, 0, 0, 0) } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv=uv; vN=normalize(normal); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
      fragmentShader: `uniform sampler2D map; uniform float uTime; uniform float uFlare; uniform vec4 uCut; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ float cd = uCut.w > 0.0 ? length(vW - uCut.xyz) : 1e9; if (cd < uCut.w) discard; vec2 uv = vUv*(gl_FrontFacing ? vec2(4.0,2.0) : vec2(14.0,7.0)); vec3 a = texture2D(map, uv + vec2(uTime*0.01, uTime*0.004)).rgb; vec3 b = texture2D(map, uv*1.7 - vec2(uTime*0.006, 0.0)).rgb;
          vec3 c = (a*0.6+b*0.5); float hot = smoothstep(0.35, 0.9, c.r);
          vec3 base = vec3(0.478,0.102,0.047); vec3 col = base*0.55 + vec3(0.86,0.12,0.18)*hot*0.65 + vec3(1.0,0.55,0.2)*pow(hot,3.0)*0.45;
          vec3 V = normalize(cameraPosition - vW); float f = pow(1.0-max(dot(normalize(vW),V),0.0),2.0);
          col += vec3(0.9,0.25,0.1)*f*0.4; col = mix(col, vec3(1.2,1.1,1.0), uFlare*0.5);
          if (!gl_FrontFacing) { float dd = length(cameraPosition - vW); col *= 0.55 + 0.45*smoothstep(70.0, 10.0, dd); col = mix(col*0.7, col*1.25, smoothstep(0.3,0.8,hot)); }
          col += vec3(1.0,0.6,0.25) * smoothstep(uCut.w + 1.5, uCut.w, cd) * 0.8; // a glowing rim round the chamber's opening
          gl_FragColor = vec4(col, 1.0); }`,
    });
    coreMat.side = THREE.DoubleSide;
    const core = new THREE.Mesh(new THREE.SphereGeometry(35, 48, 24), coreMat); core.name = 'core';
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uFlare: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(normal); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
      fragmentShader: 'uniform float uFlare; varying vec3 vN; varying vec3 vW; void main(){ vec3 V=normalize(cameraPosition-vW); float f=pow(1.0-abs(dot(vN,V)),3.0); gl_FragColor=vec4(vec3(1.0,0.3,0.12)*f*(0.8+uFlare), 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(40, 40, 20), glowMat); glow.name = 'core-glow';
    // the inside of the crust (seen through the cut): dark rock, lit faintly from the core
    const rockMat = new THREE.MeshStandardMaterial({ map: this.tex.rock, color: 0x6a5a50, roughness: 0.95, metalness: 0, side: THREE.BackSide, emissive: 0x7a3418, emissiveIntensity: 1.2, emissiveMap: this.tex.rock });
    clipMaterial(rockMat, null, 'interior');
    const interior = new THREE.Mesh(new THREE.SphereGeometry(93.6, 64, 32), rockMat); interior.name = 'interior';
    const mantleMat = new THREE.MeshBasicMaterial({ color: 0x150806, side: THREE.BackSide });
    clipMaterial(mantleMat, null, 'mantle');
    // X-ray shell: the clipped-away ground redrawn as a faint fresnel shell
    const shellMat = new THREE.ShaderMaterial({
      uniforms: { ...XRAY.uniforms, uAmt: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
      fragmentShader: `uniform vec3 uClipDir; uniform float uClipDist; uniform float uAmt; varying vec3 vW;
        void main(){ if (uClipDist < 1000.0 && dot(vW, uClipDir) <= uClipDist) discard; vec3 V=normalize(cameraPosition-vW); float f=pow(1.0-abs(dot(normalize(vW),V)),2.0);
          float grid = 0.0; gl_FragColor=vec4(vec3(0.89,0.925,0.97)*(0.06+f*0.6)*0.25*uAmt*4.0, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(100.3, 64, 32), shellMat); shell.name = 'xray-shell'; shell.renderOrder = 6;
    this.coreGroup = new THREE.Group(); this.coreGroup.add(core, glow); this.coreGroup.name = 'core-group';
    this.interior = interior; this.xshell = shell; this.coreMat = coreMat; this.glowMat = glowMat; this.shellMat = shellMat;
    this.root.add(this.coreGroup, interior, shell);
    void mantleMat;
    this.setXray(0);
  }
  setXray(a) {
    const on = a > 0.01;
    this.coreGroup.visible = on; this.interior.visible = on; this.xshell.visible = on;
    this.shellMat.uniforms.uAmt.value = a;
  }
  /** Camera below the ground: hide the city's surface layers, keep the rock interior, core and a faint shell. */
  setInside(on) {
    if (this._inside === on) return; this._inside = on;
    for (const m of Object.values(this.groundMeshes)) m.visible = !on;
    if (this.blocks) for (const m of this.blocks.meshes) m.visible = !on;
    for (const o of [this.sea, this.trees, this.smoke, this.holos, this.crags]) if (o) o.visible = !on;
    this.xshell.scale.setScalar(on ? 0.0001 : 1);
    this.interior.scale.setScalar(on ? 99.2 / 93.6 : 1);
    this.root.children.filter((o) => o.name?.startsWith('atlantis')).forEach((o) => { o.visible = !on; });
  }
  /** Water Ride: the sea surface drawn from below too. */
  setUnderwater(on) { if (!this.seaMat) return; this.seaMat.side = on ? THREE.DoubleSide : THREE.FrontSide; this.seaMat.needsUpdate = true; }
  /** The crossing's hand-off: open the lava round a Core Exchange (a sphere of radius r at pos; r 0 closes it). */
  setCoreCut(pos, r = 0) { const u = this.coreMat?.uniforms.uCut.value; if (!u) return; if (pos && r > 0) u.set(pos.x, pos.y, pos.z, r); else u.w = 0; }
  setFlare(v) { this.coreMat.uniforms.uFlare.value = v; this.glowMat.uniforms.uFlare.value = v; }

  // ------------------------------------------------------------------ outlines
  buildRegionOutlines() {
    const cells = this.cells, grid = this.grid; const P = [];
    for (const c of cells) {
      const k = grid.corners[c.id]; const n = k.length;
      for (const m of c.neighbours) {
        if (m < c.id || cells[m].area === c.area) continue;
        // shared edge: the two corners of c that are also corners of m
        const km = grid.corners[m];
        const sh = k.filter((a) => km.some((b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-4));
        if (sh.length === 2) { const r = 101.2; P.push(sh[0][0] * r, sh[0][1] * r, sh[0][2] * r, sh[1][0] * r, sh[1][1] * r, sh[1][2] * r); }
      }
      void n;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xe3ecf7, transparent: true, opacity: 0.7, depthWrite: false });
    this.regionLines = new THREE.LineSegments(g, mat); this.regionLines.visible = false; this.regionLines.name = 'region-outlines';
    this.root.add(this.regionLines);
  }

  /** Outline a set of cells (key replaces an earlier outline with the same key). color hex string. */
  outlineCells(key, ids, color = '#e3ecf7', { lift = 1.2, opacity = 0.9, pulse = false } = {}) {
    const old = this.outlines.get(key);
    if (old) { this.root.remove(old.obj); old.obj.geometry.dispose(); this.outlines.delete(key); }
    if (!ids || !ids.length) return;
    const P = [];
    const W = 0.75;
    for (const id of ids) {
      const c = this.cells[id]; const k = this.grid.corners[id]; const n = k.length;
      const r = Math.max(cellRadius(c), c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS ? R : 0) + lift + (c.terrain === TERRAIN.MOUNTAIN ? 0.5 : 0);
      for (let j = 0; j < n; j++) {
        const a = k[j], b = k[(j + 1) % n];
        // every outlined cell gets its whole outline (each is a separate thing: a block to demolish, a target);
        // the inset keeps neighbouring outlines side by side instead of overlapping
        // (skipping shared edges left adjacent cells looking like hexagons with a side missing: request 35)
        const ia = nrm(mix3(c.pos, a, 0.95)), ib = nrm(mix3(c.pos, b, 0.95));
        const ja = nrm(mix3(c.pos, a, 0.95 - W / 7.5)), jb = nrm(mix3(c.pos, b, 0.95 - W / 7.5));
        for (const v of [ia, ib, jb, ia, jb, ja]) P.push(v[0] * r, v[1] * r, v[2] * r);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const mat = outlineMaterial(color, opacity);
    const obj = new THREE.Mesh(g, mat); obj.renderOrder = 11; obj.name = 'outline-' + key; obj.frustumCulled = false;
    this.root.add(obj); this.outlines.set(key, { obj, pulse, base: opacity });
  }
  clearOutlines(prefix = '') { for (const k of [...this.outlines.keys()]) if (k.startsWith(prefix)) this.outlineCells(k, null); }

  // ------------------------------------------------------------------ per frame
  update(dt, t, camDist) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i]; a.t += dt; const u = Math.min(1, a.t / a.dur); a.fn(u); if (u >= 1) this.anims.splice(i, 1);
    }
    let treesMoving = false;
    for (const r of this.treeRecs) if (r.t < 0.6) { r.t += dt; treesMoving = true; }
    if (treesMoving) this.refreshTrees();
    for (const o of this.outlines.values()) if (o.pulse) o.obj.material.uniforms.uOpacity.value = o.base * (0.55 + 0.45 * Math.sin(t * 6));
    this.updateParticles(dt, camDist);
    if (camDist < 260) this.updateHolos(t);
    // window lights brighter when close; ground lights dimmer when close (blocks carry it)
    const far = Math.min(1, Math.max(0, (camDist - 160) / 170));
    if (this.groundUniforms) { this.groundUniforms.uLights.value = 0.6 + far * 0.8; this.groundUniforms.uFar.value = far; }
    if (this.buildUniforms) { this.buildUniforms.uLit.value = 1 + far * 0.7; this.buildUniforms.uFar.value = far; }
  }
}

// ------------------------------------------------------------------ block shapes (unit footprint, height 1)
function box(w, h, d, x = 0, z = 0, y = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g.toNonIndexed(); }
function cyl(r, h, x = 0, z = 0, y = 0, seg = 8) { const g = new THREE.CylinderGeometry(r, r, h, seg, 1); g.translate(x, y + h / 2, z); return g.toNonIndexed(); }
function strip(g) { g.deleteAttribute('uv'); return g; }
function blockShapes() {
  const T = (arr) => mergeGeometries(arr.map(strip));
  const tower = T([box(0.45, 1, 0.45, -0.2, -0.2), box(0.38, 0.72, 0.38, 0.24, -0.18), box(0.34, 0.55, 0.4, -0.18, 0.25), box(0.3, 0.86, 0.3, 0.26, 0.26), box(0.2, 0.12, 0.2, -0.2, -0.2, 1)]);
  const slab = T([box(0.95, 0.42, 0.55, 0, -0.15), box(0.32, 1, 0.3, 0.25, 0.28), box(0.3, 0.6, 0.3, -0.28, 0.3)]);
  const domeTop = new THREE.SphereGeometry(0.42, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); domeTop.translate(0, 0.45, 0);
  const dome = T([cyl(0.42, 0.45, 0, 0, 0, 10), domeTop.toNonIndexed(), box(0.25, 0.75, 0.25, 0.4, 0.3), box(0.22, 0.6, 0.22, -0.38, -0.32)]);
  const cone = new THREE.ConeGeometry(0.16, 0.35, 6); cone.translate(0, 1.0 + 0.175, 0);
  const spire = T([box(0.3, 1.0, 0.3, 0, 0), cone.toNonIndexed(), box(0.4, 0.45, 0.25, 0.28, -0.1), box(0.22, 0.66, 0.22, -0.28, 0.2)]);
  const factory = T([box(0.9, 0.38, 0.6, 0, -0.1), box(0.45, 0.55, 0.35, -0.2, 0.28), cyl(0.07, 0.9, 0.3, 0.3, 0, 6), cyl(0.06, 0.8, 0.12, 0.32, 0, 6)]);
  return [tower, slab, dome, spire, factory];
}

export { REGION_ACCENT };

/** Outline strips: drawn over buildings (no depth test) but hidden behind the planet (sphere test). */
function outlineMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.); }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vW;
      void main(){ vec3 d = vW - cameraPosition; float L = length(d); d /= L; float b = dot(cameraPosition, d); float c = dot(cameraPosition, cameraPosition) - 99.0*99.0; float disc = b*b - c;
        if (disc > 0.0) { float t0 = -b - sqrt(disc); if (t0 > 0.0 && t0 < L - 1.5) discard; }
        gl_FragColor = vec4(uColor, uOpacity); }`,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  });
}
