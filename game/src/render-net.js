// render-net.js — everything the network draws: ley-rails (additive fresnel ribbons, one geometry per
// type), the surface maglev beam and sleepers, sky ring pylons, earth bores and crystal shards (X-ray),
// stations from models (instanced; glowing pins far away), interchanges stacked, capacity rings, the orbital
// ring and elevator cables, the Warp Terminal and its launch ring, trains (lead-car models near, capsules
// far) with their element effects, the flow overlay's white load markers, export dots, route pins, the
// card preview ghost and priority diamonds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TYPE_COLORS, TYPE_ORDER, AVG_CAR_COLORS } from './palette.js';
import { XRAY, XRAY_GLSL, clipMaterial } from './xray.js';
import { getCells, cellMeta, TERRAIN } from './planet.js';
import { demoNetwork } from './demo-net.js';

const R = 100;
const UNDERGROUND = { earth: true, fire: true }; // seen only in X-ray (or riding): capsules are enough otherwise
const NEAR = 160;
const STATION_MODEL_DIST = { low: 95, high: 130 }; // station models within this camera distance (and facing it); pins beyond           // lead-car models, station models and effects within this camera distance
const TYPES = TYPE_ORDER;
const CLIPPED = { surface: 1, sky: 1, water: 1, earth: 0, fire: 0, space: 1, deep: 1 };
const col = (h) => new THREE.Color(h);
const WHITE = new THREE.Color(1, 1, 1);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ------------------------------------------------------------------ ley-rail material
function railMaterial(type) {
  // raw ShaderMaterial output skips the colour-space conversion, so feed sRGB values directly
  const c = col(TYPE_COLORS[type]).convertLinearToSRGB();
  const lifted = c.clone().lerp(new THREE.Color(1, 1, 1), 0.3);
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: c }, uCore: { value: lifted }, uTime: XRAY.uniforms.uTime, uWidth: { value: type === 'surface' ? 0.45 : 0.55 },
      uBright: { value: 1 }, uFlow: { value: 0 }, uClip: { value: CLIPPED[type] }, uGhost: { value: 0 }, uMinPx: { value: 0.0085 },
      uClipOn: XRAY.uniforms.uClipOn, uClipDir: XRAY.uniforms.uClipDir, uClipDist: XRAY.uniforms.uClipDist, uFade: { value: 1 },
      uTrace: { value: 0 }, uEmber: { value: type === 'fire' ? 1 : 0 },
    },
    vertexShader: `
      attribute vec3 tang; attribute float side; attribute float along; attribute vec2 st; attribute vec2 grow;
      uniform float uWidth; uniform float uFlow; uniform float uMinPx; uniform float uTime;
      varying float vSide; varying float vAlong; varying float vLoad; varying float vDim; varying float vGrow; varying vec3 vXWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 Vd = cameraPosition - wp.xyz; float dist = length(Vd); Vd /= dist;
        vec3 T = normalize(mat3(modelMatrix) * tang);
        vec3 S = cross(T, Vd); float sl = length(S); S = sl > 1e-4 ? S / sl : vec3(0.0, 1.0, 0.0);
        float w = max(uWidth, dist * uMinPx) * (1.0 + uFlow * st.x * 1.5);
        wp.xyz += S * side * w * 0.5;
        vSide = side; vAlong = along; vLoad = st.x; vDim = st.y;
        vGrow = clamp((uTime - grow.x) / 1.0, 0.0, 1.0) - grow.y;
        vXWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uCore; uniform float uTime; uniform float uBright; uniform float uFlow; uniform float uClip; uniform float uGhost; uniform float uFade;
      uniform float uClipOn; uniform vec3 uClipDir; uniform float uClipDist; uniform float uTrace; uniform float uEmber;
      varying float vSide; varying float vAlong; varying float vLoad; varying float vDim; varying float vGrow; varying vec3 vXWorld;
      void main(){
        if (vGrow < 0.0) discard;
        if (uClip > 0.5 && uClipOn > 0.5 && dot(vXWorld, uClipDir) > uClipDist) discard;
        if (uGhost > 0.5 && fract(vAlong / 2.4) > 0.55) discard;
        float d = abs(vSide);
        float glow = pow(1.0 - d, 1.6);
        float core = smoothstep(0.22, 0.0, d);
        if (uTrace > 0.5) {
          // the ley-line under the crust: a soft dashed trace drifting along the line, fainter than a rail
          float ph = fract((vAlong - uTime * (2.5 + uFlow * vLoad * 12.0)) / 3.4);
          float dash = 0.3 + 0.7 * smoothstep(0.0, 0.18, ph) * smoothstep(0.7, 0.5, ph);
          float emb = uEmber > 0.5 ? 0.55 + 0.45 * sin(vAlong * 2.3 + uTime * 6.0) * sin(vAlong * 0.71 - uTime * 2.7) : 1.0;
          float tb = uBright * 0.62 * (1.0 + uFlow * vLoad * 1.3) * (1.0 - vDim * 0.78);
          vec3 tc = (uColor * glow * dash * emb + uCore * core * 0.3 * dash) * tb;
          gl_FragColor = vec4(min(tc, vec3(1.0)) * uFade, 1.0);
          return;
        }
        float spd = 6.0 + uFlow * vLoad * 26.0;
        float pulse = pow(0.5 + 0.5 * sin((vAlong - uTime * spd) * 0.55), 6.0) * (0.35 + uFlow * vLoad * 0.9);
        float b = uBright * (1.0 + uFlow * vLoad * 0.9) * (1.0 - vDim * 0.78);
        vec3 c = uColor * (glow * (0.7 + pulse * (1.0 - vDim)) + core * 0.35) * b + vec3(1.0) * smoothstep(0.07, 0.0, d) * 0.12 * b;
        c = min(c, vec3(1.0)) ;
        gl_FragColor = vec4(c * uFade, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/** Build a ribbon geometry for many sample arrays. Returns geometry + per-line vertex ranges. */
function buildRibbon(lines) {
  let nv = 0, ni = 0;
  for (const l of lines) { const n = l.samples.length; nv += n * 2; ni += (n - 1) * 6; }
  const pos = new Float32Array(nv * 3), tang = new Float32Array(nv * 3), side = new Float32Array(nv), along = new Float32Array(nv), st = new Float32Array(nv * 2), grow = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  const ranges = new Map();
  let v = 0, i = 0;
  for (const l of lines) {
    const s = l.samples, n = s.length; const v0 = v;
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const p = s[k], a = s[Math.max(0, k - 1)], b = s[Math.min(n - 1, k + 1)];
      if (k > 0) acc += Math.hypot(p[0] - s[k - 1][0], p[1] - s[k - 1][1], p[2] - s[k - 1][2]);
      const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      for (const sd of [-1, 1]) {
        pos.set(p, v * 3); tang.set(t, v * 3); side[v] = sd; along[v] = acc; st[v * 2] = l.load || 0; st[v * 2 + 1] = l.dim || 0;
        grow[v * 2] = l.born ?? -10; grow[v * 2 + 1] = 0; v++;
      }
      if (k < n - 1) { const q = v0 + k * 2; idx.set([q, q + 1, q + 2, q + 1, q + 3, q + 2], i); i += 6; }
    }
    // grow: fraction along the line goes in grow.y as "−fraction" offset → vGrow = progress − fraction
    for (let k = 0; k < n; k++) for (let q = 0; q < 2; q++) grow[(v0 + k * 2 + q) * 2 + 1] = acc > 0 ? along[v0 + k * 2 + q] / acc : 0;
    ranges.set(l.id, { start: v0, count: v - v0, length: acc });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tang', new THREE.BufferAttribute(tang, 3));
  g.setAttribute('side', new THREE.BufferAttribute(side, 1));
  g.setAttribute('along', new THREE.BufferAttribute(along, 1));
  g.setAttribute('st', new THREE.BufferAttribute(st, 2));
  g.setAttribute('grow', new THREE.BufferAttribute(grow, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return { geometry: g, ranges };
}

/** Arc-length table for a polyline. */
function lengths(samples) {
  const L = new Float32Array(samples.length); let acc = 0;
  for (let i = 1; i < samples.length; i++) { const a = samples[i - 1], b = samples[i]; acc += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); L[i] = acc; }
  return L;
}
/** Point and direction at arc length s. */
function sampleAt(line, s, outP, outD) {
  const L = line.cum, S = line.samples, n = S.length;
  s = Math.max(0, Math.min(L[n - 1], s));
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
  const seg = L[hi] - L[lo] || 1; const t = (s - L[lo]) / seg;
  const a = S[lo], b = S[hi];
  outP.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  if (outD) { outD.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (outD.lengthSq() < 1e-9) outD.set(0, 0, 1); outD.normalize(); }
  return outP;
}

export class NetRenderer {
  constructor(G) {
    this.G = G; this.scene = G.scene; this.models = G.models || {};
    this.cells = getCells();
    this.root = new THREE.Group(); this.root.name = 'network'; this.scene.add(this.root);
    this.mats = {}; this.railMeshes = {};
    for (const t of TYPES) this.mats[t] = railMaterial(t);
    // underground lines outside X-ray: a faint trace on the surface above them (earth chords, fire chords)
    this.traceMats = {}; this.traceMeshes = {};
    for (const t of Object.keys(UNDERGROUND)) { const m = railMaterial(t); m.uniforms.uTrace.value = 1; m.uniforms.uWidth.value = 0.8; m.uniforms.uMinPx.value = 0.0076; m.uniforms.uClip.value = 0; this.traceMats[t] = m; }
    this.layerVisible = Object.fromEntries(TYPES.map((t) => [t, true]));
    this.flow = 0; this.xray = 0; this.quality = G.settings.quality;
    this.lines = []; this.stations = []; this.lineById = new Map(); this.stationById = new Map();
    this.time = 0; this.gameTime = 0; this.useGameTime = false;
    this.buildStatic();
    this.buildInstancers();
    this.buildEffects();
    this.demo = demoNetwork();
    this.showDemo(true);
  }

  // ------------------------------------------------------------------ static world pieces
  buildStatic() {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc9d2e3, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.2 });
    this.chromeMat = clipMaterial(chrome, null, 'chrome');
    // the orbital ring: a chrome torus with a lit segmented track
    const ringG = new THREE.TorusGeometry(129.3, 0.45, 10, 360); ringG.rotateX(Math.PI / 2);
    this.ring = new THREE.Mesh(ringG, this.chromeMat); this.ring.name = 'orbital-ring';
    const segMat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0x30344a, emissive: 0xe3ecf7, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 }), null, 'ringseg');
    const segG = new THREE.BoxGeometry(0.3, 0.25, 1.8);
    const segs = new THREE.InstancedMesh(segG, segMat, 180); const m = new THREE.Matrix4();
    for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2; const p = new THREE.Vector3(Math.sin(a) * 129.3, -0.5, Math.cos(a) * 129.3); m.makeRotationY(a); m.setPosition(p); segs.setMatrixAt(i, m); }
    segs.name = 'ring-segments';
    this.root.add(this.ring, segs);
    // polar ring (tech): hidden until owned
    const pg = new THREE.TorusGeometry(129.3, 0.45, 10, 360); pg.rotateY(Math.PI / 2);
    this.polarRing = new THREE.Mesh(pg, this.chromeMat); this.polarRing.visible = false; this.polarRing.name = 'polar-ring';
    this.root.add(this.polarRing);

    // the Warp Terminal: model + a code launch ring that spins up
    const meta = cellMeta(); this.terminalCell = meta.terminal;
    const tc = this.cells[meta.terminal];
    const up = V(tc.pos); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    this.terminal = new THREE.Group(); this.terminal.name = 'warp-terminal';
    this.terminal.position.copy(up.clone().multiplyScalar(R - 0.1)); this.terminal.quaternion.copy(q);
    this.terminalH = 3; this.terminalMesh = null;
    const lrMat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0x3a1030, emissive: new THREE.Color(TYPE_COLORS.deep), emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.3 }), null, 'launch');
    this.launchRing = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.45, 10, 48), lrMat);
    this.launchRing.position.y = this.terminalH + 5; this.launchRing.rotation.x = Math.PI / 2;
    this.launchMat = lrMat;
    this.terminal.add(this.launchRing);
    this.root.add(this.terminal);
    this.launch = { spin: 0.4, flash: 0, streak: null };

    // warp flash sprite
    this.flashMat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(TYPE_COLORS.deep), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    this.flash = new THREE.Sprite(this.flashMat); this.flash.scale.setScalar(30);
    this.flash.position.copy(up.clone().multiplyScalar(R + this.terminalH + 5));
    this.root.add(this.flash);
    this.termUp = up;
  }
  /** The Warp Terminal model, once it has loaded (models arrive in the background after the title). */
  buildTerminalModel() {
    const wb = this.models['warp-base']; if (!wb || this.terminalMesh) return;
    this.terminalMesh = new THREE.Mesh(wb.geometry, clipMaterial(wb.material, null, 'warp')); this.terminal.add(this.terminalMesh); this.terminalH = wb.size.y;
    this.launchRing.position.y = this.terminalH + 5;
    this.flash.position.copy(this.termUp.clone().multiplyScalar(R + this.terminalH + 5));
  }
  /** Models loaded after the title (models.js loadModels in the background): add what was missing and re-lay the stations. */
  addModels(models) {
    Object.assign(this.models, models);
    this.buildTerminalModel();
    this.buildModelParts();
    if (this.lastLayout) this.layoutStations(...this.lastLayout);
  }

  /** Instanced station and lead-car models for every model loaded so far (idempotent: adds only what is missing). */
  buildModelParts() {
    const M = this.models;
    const mk = (name, model, cap, accent, key) => {
      if (!model) return null;
      const mat = clipMaterial(model.material.clone(), null, key);
      if (accent) { mat.emissive = col(accent); }
      const im = new THREE.InstancedMesh(model.geometry, mat, cap); im.count = 0; im.frustumCulled = false; im.name = name;
      this.root.add(im); return im;
    };
    this.stModels = this.stModels || { surface: null, earth: null, sky: null, water: null, space: null, wheel: null, monument: null, fire: null };
    const want = { surface: ['st-surface', 'station-surface', 128, TYPE_COLORS.surface, 'st-s'], earth: ['st-bore', 'station-surface', 128, TYPE_COLORS.earth, 'st-e'],
      sky: ['st-sky', 'skyport', 64, null, 'st-k'], water: ['st-sea', 'sea-station', 64, null, 'st-w'], space: ['st-ring', 'ring-elevator', 64, null, 'st-r'],
      wheel: ['st-wheel', 'wheel-base', 32, null, 'st-wh'], monument: ['st-mon', 'monument', 32, null, 'st-mo'] };
    for (const [k, [name, model, cap, accent, key]] of Object.entries(want)) if (!this.stModels[k] && M[model]) this.stModels[k] = mk(name, M[model], cap, accent, key);
    // Core Exchanges are inside the planet: never clipped
    if (!this.stModels.fire && M['core-exchange']) { const ce = new THREE.InstancedMesh(M['core-exchange'].geometry, M['core-exchange'].material, 64); ce.count = 0; ce.frustumCulled = false; ce.name = 'st-core'; this.root.add(ce); this.stModels.fire = ce; ce.visible = this.xray > 0.5 && this.layerVisible.fire; }
    // lead cars per type
    this.leads = this.leads || {};
    for (const t of TYPES) {
      const m = M['train-' + t]; if (!m || this.leads[t]) continue;
      const mat = m.material.clone(); mat.emissive = col(TYPE_COLORS[t]);
      const im = new THREE.InstancedMesh(m.geometry, CLIPPED[t] ? clipMaterial(mat, null, 'lead-' + t) : mat, 160); im.count = 0; im.frustumCulled = false; im.name = 'lead-' + t;
      this.leads[t] = im; this.root.add(im);
    }
    // capsule colours: the measured average of each lead car's texture (AVG_CAR_COLORS), so they never change when the models arrive
    this.avgColors = Object.fromEntries(TYPES.map((t) => [t, col(AVG_CAR_COLORS[t] || '#80858f')]));
  }

  buildInstancers() {
    const M = this.models;
    this.buildTerminalModel();
    this.buildModelParts();
    // drill collars (Bore stations) and portal arches
    const collarG = new THREE.TorusGeometry(2.3, 0.22, 6, 24); collarG.rotateX(Math.PI / 2); collarG.translate(0, 0.25, 0);
    const greenTrim = clipMaterial(new THREE.MeshStandardMaterial({ color: 0x1d2a24, emissive: col(TYPE_COLORS.earth), emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.4 }), null, 'collar');
    this.collars = new THREE.InstancedMesh(collarG, greenTrim, 128); this.collars.count = 0; this.collars.name = 'collars'; this.root.add(this.collars);
    const archG = new THREE.TorusGeometry(0.9, 0.22, 6, 12, Math.PI); archG.translate(0, 0, 0);
    this.portals = new THREE.InstancedMesh(archG, greenTrim, 256); this.portals.count = 0; this.portals.name = 'portals'; this.root.add(this.portals);
    // piers (code)
    const pierG = mergeGeometries([new THREE.BoxGeometry(3.2, 0.25, 4.8).translate(0, 0, 0), ...[-1.3, 1.3].flatMap((x) => [-1.9, 1.9].map((z) => new THREE.CylinderGeometry(0.15, 0.15, 6.5, 5).translate(x, -3.2, z)))].map((g) => g.toNonIndexed()));
    this.piers = new THREE.InstancedMesh(pierG, this.chromeMat, 64); this.piers.count = 0; this.piers.name = 'piers'; this.root.add(this.piers);
    // elevator cables
    const cableG = new THREE.CylinderGeometry(0.05, 0.05, 1, 6); cableG.translate(0, 0.5, 0);
    this.cables = new THREE.InstancedMesh(cableG, this.chromeMat, 64); this.cables.count = 0; this.cables.name = 'cables'; this.root.add(this.cables);
    // capacity rings (flat, fill fraction per instance)
    const capG = new THREE.RingGeometry(2.2, 3.5, 40); capG.rotateX(-Math.PI / 2);
    const capMat = new THREE.ShaderMaterial({
      uniforms: { uTime: XRAY.uniforms.uTime, ...XRAY.uniforms },
      vertexShader: `attribute float fill; varying float vFill; varying vec2 vP; ${XRAY_GLSL.vertDecl}
        void main(){ vFill = fill; vP = position.xz; vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vXWorld = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying float vFill; varying vec2 vP; ${XRAY_GLSL.fragDecl}
        void main(){ ${XRAY_GLSL.fragBody} float r = length(vP); bool isFull = vFill >= 0.98;
          // normal: a thin ring (2.6 to 3.0) filling clockwise; full: a thick pulsing rose band (2.2 to 3.5)
          if (!isFull && (r < 2.6 || r > 3.0)) discard;
          float a = atan(vP.x, -vP.y)/6.2831853 + 0.5; float on = step(a, vFill);
          vec3 c = mix(vec3(0.89,0.93,0.97), vec3(1.0,0.43,0.57), smoothstep(0.85,1.0,vFill));
          if (isFull) { float pulse = 0.55 + 0.45*sin(uTime*6.0); float edge = smoothstep(2.2, 2.45, r) * (1.0 - smoothstep(3.25, 3.5, r)); gl_FragColor = vec4(vec3(1.0,0.43,0.57) * edge * (0.5 + 0.9*pulse), 1.0); return; }
          gl_FragColor = vec4(c*(0.18 + on*0.9), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.capRings = new THREE.InstancedMesh(capG, capMat, 256); this.capRings.count = 0; this.capRings.name = 'capacity-rings';
    this.capFill = new THREE.InstancedBufferAttribute(new Float32Array(256), 1); capG.setAttribute('fill', this.capFill);
    this.root.add(this.capRings);
    // portal beacons (outside X-ray): pulsing rings in the type colour, scaled up with camera distance so they read at planet zoom
    const bG = new THREE.RingGeometry(1.7, 2.4, 36); bG.rotateX(-Math.PI / 2);
    this.beaconCol = new THREE.InstancedBufferAttribute(new Float32Array(128 * 3), 3); bG.setAttribute('bcol', this.beaconCol);
    this.beaconHot = new THREE.InstancedBufferAttribute(new Float32Array(128), 1); bG.setAttribute('bhot', this.beaconHot);
    this.beaconMat = new THREE.ShaderMaterial({
      uniforms: { uTime: XRAY.uniforms.uTime, uScale: { value: 1 }, uFade: { value: 1 } },
      vertexShader: `attribute vec3 bcol; attribute float bhot; uniform float uScale; varying vec3 vC; varying vec2 vP; varying float vHot;
        void main(){ vC = bcol; vP = position.xz; vHot = bhot; vec3 p = position * vec3(uScale, 1.0, uScale); gl_Position = projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(p,1.); }`,
      fragmentShader: `uniform float uTime; uniform float uFade; varying vec3 vC; varying vec2 vP; varying float vHot;
        void main(){ float r = length(vP); float edge = 1.0 - abs((r - 2.05) / 0.35);
          // calm (steady, dim) unless the station's interchange is full: then it pulses
          float pulse = mix(0.55, 0.65 + 0.35 * sin(uTime * 5.0 - r), vHot);
          gl_FragColor = vec4(min(vC * (0.4 + edge * 1.1) * pulse, vec3(1.0)) * uFade, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.beacons = new THREE.InstancedMesh(bG, this.beaconMat, 128); this.beacons.count = 0; this.beacons.frustumCulled = false; this.beacons.name = 'portal-beacons'; this.beacons.renderOrder = 7;
    this.root.add(this.beacons);
    // walkways
    this.walkGroup = new THREE.Group(); this.walkGroup.name = 'walkways'; this.root.add(this.walkGroup);
    // surface maglev beam and sleepers, sky pylons, bores, crystals
    const beamG = new THREE.BoxGeometry(0.42, 0.28, 1); // along z, unit length
    this.beamMat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0x4a5266, metalness: 0.85, roughness: 0.3, emissive: col(TYPE_COLORS.surface), emissiveIntensity: 0.12 }), null, 'beam');
    this.beams = new THREE.InstancedMesh(beamG, this.beamMat, 6000); this.beams.count = 0; this.beams.name = 'maglev-beams';
    const slG = new THREE.BoxGeometry(1.3, 0.12, 0.28);
    const gunMat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0x2b3040, metalness: 0.7, roughness: 0.5 }), null, 'gun');
    this.sleepers = new THREE.InstancedMesh(slG, gunMat, 6000); this.sleepers.count = 0; this.sleepers.name = 'sleepers';
    const pyG = new THREE.TorusGeometry(0.75, 0.09, 6, 20);
    const pyMat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0xc9d2e3, metalness: 0.9, roughness: 0.25, emissive: col(TYPE_COLORS.sky), emissiveIntensity: 0.35 }), null, 'pylon');
    this.pylons = new THREE.InstancedMesh(pyG, pyMat, 1500); this.pylons.count = 0; this.pylons.name = 'sky-pylons';
    this.boreMat = new THREE.MeshStandardMaterial({ map: this.G.textures?.rock || null, color: 0x7a6656, roughness: 0.9, metalness: 0.05, side: THREE.BackSide, emissive: 0x12301e, emissiveIntensity: 0.8 });
    this.bores = new THREE.Mesh(new THREE.BufferGeometry(), this.boreMat); this.bores.name = 'earth-bores'; this.bores.visible = false;
    const crG = new THREE.OctahedronGeometry(0.22, 0); crG.scale(0.6, 1.6, 0.6);
    const crMat = new THREE.MeshStandardMaterial({ color: 0x1c5a3a, emissive: col(TYPE_COLORS.earth), emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.3 });
    this.crystals = new THREE.InstancedMesh(crG, crMat, 6000); this.crystals.count = 0; this.crystals.visible = false; this.crystals.name = 'bore-crystals';
    this.root.add(this.beams, this.sleepers, this.pylons, this.bores, this.crystals);

    // trains: lead cars per type (buildModelParts) + capsules for every trailing car (and far lead cars)
    const capsG = new THREE.CapsuleGeometry(0.26, 0.72, 4, 10); capsG.rotateX(Math.PI / 2); capsG.translate(0, 0.3, 0);
    const capsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.3 });
    capsMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec3 band; varying vec3 vBand; varying float vY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBand = band; vY = position.y - 0.3;');
      sh.fragmentShader = 'varying vec3 vBand; varying float vY;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vBand * (smoothstep(0.07,0.0,abs(vY-0.02)) * 1.6 + 0.12);');
    };
    capsMat.customProgramCacheKey = () => 'caps';
    this.caps = new THREE.InstancedMesh(capsG, capsMat, 3000); this.caps.count = 0; this.caps.frustumCulled = false; this.caps.name = 'capsules';
    this.capsBand = new THREE.InstancedBufferAttribute(new Float32Array(3000 * 3), 3); capsG.setAttribute('band', this.capsBand);
    this.root.add(this.caps);
    // water bubbles: one stretched fresnel capsule per water car
    const bubG = new THREE.CapsuleGeometry(0.55, 1.0, 4, 12); bubG.rotateX(Math.PI / 2); bubG.translate(0, 0.3, 0);
    const bubMat = new THREE.ShaderMaterial({
      uniforms: { uTime: XRAY.uniforms.uTime, ...XRAY.uniforms },
      vertexShader: `varying vec3 vN; varying vec3 vW; ${XRAY_GLSL.vertDecl} void main(){ vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; vXWorld=vW; vN=normalize(mat3(modelMatrix*instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vW; ${XRAY_GLSL.fragDecl} void main(){ ${XRAY_GLSL.fragBody} vec3 V=normalize(cameraPosition-vW); float f=pow(1.0-abs(dot(vN,V)),2.0);
        float sw = 0.5+0.5*sin(vW.x*3.0+vW.y*2.0+uTime*5.0); gl_FragColor=vec4(vec3(0.35,0.6,1.0)*(f*0.9+0.08+sw*0.12*f), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.bubbles = new THREE.InstancedMesh(bubG, bubMat, 600); this.bubbles.count = 0; this.bubbles.frustumCulled = false; this.bubbles.name = 'water-bubbles'; this.bubbles.renderOrder = 6;
    this.root.add(this.bubbles);

    // far pins: stations and trains as glowing points
    this.pinGeo = new THREE.BufferGeometry();
    this.pinGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1200 * 3), 3));
    this.pinGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(1200 * 3), 3));
    this.pinGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(1200), 1));
    const pinMat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 }, ...XRAY.uniforms },
      vertexShader: `attribute vec3 color; attribute float size; uniform float uPx; varying vec3 vC; ${XRAY_GLSL.vertDecl}
        void main(){ vC=color; vXWorld=(modelMatrix*vec4(position,1.)).xyz; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=size*uPx; }`,
      fragmentShader: `varying vec3 vC; ${XRAY_GLSL.fragDecl} void main(){ ${XRAY_GLSL.fragBody} float r=length(gl_PointCoord-.5)*2.0; float a=smoothstep(1.0,0.0,r); float c=smoothstep(0.45,0.0,r); gl_FragColor=vec4(vC*a*0.9+vec3(1.0)*c*0.8, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.pins = new THREE.Points(this.pinGeo, pinMat); this.pins.frustumCulled = false; this.pins.name = 'pins'; this.pins.renderOrder = 8;
    this.root.add(this.pins);
    // X-ray: fire trains as glowing dots drawn over the core (no depth test)
    this.xpinGeo = new THREE.BufferGeometry();
    this.xpinGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(200 * 3), 3));
    this.xpinGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(200 * 3), 3));
    this.xpinGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(200), 1));
    const xm = pinMat.clone(); xm.uniforms = { uPx: { value: 1 }, ...XRAY.uniforms }; xm.depthTest = false;
    this.xpins = new THREE.Points(this.xpinGeo, xm); this.xpins.frustumCulled = false; this.xpins.renderOrder = 9; this.xpins.visible = false; this.xpins.name = 'xray-fire-trains';
    this.root.add(this.xpins);
    this.expGeo = new THREE.BufferGeometry(); this.expGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    const em = pinMat.clone(); em.uniforms = { uPx: { value: 1 }, ...XRAY.uniforms };
    em.vertexShader = em.vertexShader.replace('attribute vec3 color; attribute float size;', '').replace('vC=color;', 'vC=vec3(1.0,0.25,0.7);').replace('gl_PointSize=size*uPx;', 'gl_PointSize=11.0*uPx;');
    this.expDots = new THREE.Points(this.expGeo, em); this.expDots.frustumCulled = false; this.expDots.renderOrder = 9; this.expDots.visible = false; this.root.add(this.expDots);

    // load markers (flow overlay): white rings with a dark outline
    const lmG = new THREE.RingGeometry(0.55, 0.85, 20);
    const lmMat = new THREE.ShaderMaterial({
      uniforms: { uTime: XRAY.uniforms.uTime, ...XRAY.uniforms },
      vertexShader: `attribute float full; varying float vFull; varying vec2 vP; ${XRAY_GLSL.vertDecl}
        void main(){ vFull=full; vP=position.xy; vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vXWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying float vFull; varying vec2 vP; ${XRAY_GLSL.fragDecl}
        void main(){ ${XRAY_GLSL.fragBody} float r = length(vP);
          float fillIn = vFull > 0.9 ? 1.0 : vFull > 0.6 ? 0.5 : 0.0;
          float flash = vFull > 0.9 ? step(0.0, sin(uTime*10.0)) : 1.0;
          bool outline = r < 0.6 || r > 0.8;
          vec3 c = outline ? vec3(0.078,0.102,0.227) : vec3(1.0);
          gl_FragColor = vec4(c, flash); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const lmGeo = lmG.clone();
    this.lmFull = new THREE.InstancedBufferAttribute(new Float32Array(3000), 1); lmGeo.setAttribute('full', this.lmFull);
    this.loadMarks = new THREE.InstancedMesh(lmGeo, lmMat, 3000); this.loadMarks.count = 0; this.loadMarks.visible = false; this.loadMarks.frustumCulled = false; this.loadMarks.name = 'load-markers'; this.loadMarks.renderOrder = 9;
    // solid centre disc for the half / full fill
    const dG = new THREE.CircleGeometry(0.55, 16);
    this.lmFill = new THREE.InstancedBufferAttribute(new Float32Array(3000), 1); dG.setAttribute('full', this.lmFill);
    const dMat = new THREE.ShaderMaterial({
      uniforms: { uTime: XRAY.uniforms.uTime, ...XRAY.uniforms },
      vertexShader: `attribute float full; varying float vFull; varying vec2 vP; ${XRAY_GLSL.vertDecl} void main(){ vFull=full; vP=position.xy; vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vXWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying float vFull; varying vec2 vP; ${XRAY_GLSL.fragDecl} void main(){ ${XRAY_GLSL.fragBody} if (vFull <= 0.6) discard; if (vFull <= 0.9 && vP.y > 0.0) discard; float flash = vFull > 0.9 ? step(0.0, sin(uTime*10.0)) : 1.0; if (flash < 0.5) discard; gl_FragColor = vec4(1.0); }`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    });
    this.loadFill = new THREE.InstancedMesh(dG, dMat, 3000); this.loadFill.count = 0; this.loadFill.visible = false; this.loadFill.frustumCulled = false; this.loadFill.name = 'load-fill'; this.loadFill.renderOrder = 9;
    this.root.add(this.loadMarks, this.loadFill);

    // priority diamonds
    const dmG = new THREE.OctahedronGeometry(1.6, 0); dmG.scale(1, 1.6, 1);
    const dmMat = clipMaterial(new THREE.MeshStandardMaterial({ color: 0xc9d2e3, metalness: 0.95, roughness: 0.15, emissive: 0xffd9a0, emissiveIntensity: 0.55 }), null, 'diamond');
    this.diamonds = new THREE.InstancedMesh(dmG, dmMat, 8); this.diamonds.count = 0; this.diamonds.name = 'priority-diamonds'; this.root.add(this.diamonds);
    this.priority = [];

    // route pins A / B and the preview ghost
    this.pinA = makeMarker(0xffd9a0); this.pinB = makeMarker(0xe3ecf7);
    this.root.add(this.pinA, this.pinB); this.pinA.visible = this.pinB.visible = false;
    this.ghosts = new THREE.Group(); this.ghosts.name = 'ghosts'; this.root.add(this.ghosts);
    this.selection = new THREE.Group(); this.root.add(this.selection);
  }

  buildEffects() {
    const N = this.quality === 'low' ? 900 : 2200;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 } },
      vertexShader: 'attribute vec3 color; attribute float size; uniform float uPx; varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize = size*uPx*220.0/max(1.0,-mv.z); }',
      fragmentShader: 'varying vec3 vC; void main(){ float r=length(gl_PointCoord-.5)*2.0; float a=smoothstep(1.0,0.0,r); gl_FragColor=vec4(vC*a, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.fx = new THREE.Points(g, mat); this.fx.frustumCulled = false; this.fx.name = 'train-effects'; this.fx.renderOrder = 9;
    this.fxP = Array.from({ length: N }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), s: 0.3 }));
    this.fxNext = 0;
    this.root.add(this.fx);
    // surface lightning arcs: line segments, rebuilt each frame
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4000 * 3), 3));
    this.bolts = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(TYPE_COLORS.surface).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.bolts.frustumCulled = false; this.bolts.name = 'lightning'; this.root.add(this.bolts);
    // money pop-ups and the build spark use sprites
    this.spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.spark.scale.setScalar(4); this.spark.visible = false; this.root.add(this.spark);
    this.sparks = [];
  }
  emit(p, v, c, life, s) {
    const q = this.fxP[this.fxNext]; this.fxNext = (this.fxNext + 1) % this.fxP.length;
    q.p.copy(p); q.v.copy(v); q.c.copy(c); q.life = q.max = life; q.s = s;
  }

  // ------------------------------------------------------------------ network in
  showDemo(on) { this.demoOn = on; if (on) this.setNetwork(this.demo, { demo: true }); }

  /**
   * net = { stations:[{id, cell, layers:[...], dome?, core?, under?, terminal?, fill?}], lines:[{id, type, samples:[[x,y,z]...], trains, cars?, load?, dim?, speed?, born?, a, b}], walkways:[{a, b}] }
   */
  setNetwork(net, opts = {}) {
    this.net = net;
    const lines = net.lines.filter((l) => l.samples && l.samples.length >= 2);
    for (const l of lines) { l.cum = lengths(l.samples); l.len = l.cum[l.cum.length - 1]; }
    this.lines = lines; this.lineById = new Map(lines.map((l) => [l.id, l]));
    this.stations = net.stations; this.stationById = new Map(net.stations.map((s) => [s.id, s]));
    // rails per type
    for (const t of TYPES) {
      const ls = lines.filter((l) => l.type === t);
      const old = this.railMeshes[t];
      if (old) { this.root.remove(old.mesh); old.mesh.geometry.dispose(); }
      if (!ls.length) { this.railMeshes[t] = null; continue; }
      const { geometry, ranges } = buildRibbon(ls);
      const mesh = new THREE.Mesh(geometry, this.mats[t]); mesh.frustumCulled = false; mesh.renderOrder = 8; mesh.name = 'rail-' + t;
      mesh.visible = this.layerVisible[t];
      this.root.add(mesh);
      this.railMeshes[t] = { mesh, ranges };
    }
    this.buildTraces(lines);
    this.buildTrackExtras(lines, net.wells || []);
    this.layoutStations(net.stations, net.walkways || []);
    this.setupTrains(lines);
    this.buildLoadMarkers();
    this.applyXray();
  }

  /** Update per-line load (0..1) and dim (0 or 1) without rebuilding. loads: Map lineId -> {load, dim} */
  setLineStates(states) {
    const meshes = [...TYPES.map((t) => this.railMeshes[t]), ...Object.values(this.traceMeshes).map((x) => x && { ...x, trace: true })];
    for (const rm of meshes) {
      if (!rm) continue;
      const a = rm.mesh.geometry.attributes.st; let changed = false;
      for (const [id, r] of rm.ranges) {
        const s = states.get(id); if (!s) continue;
        const l = this.lineById.get(id); if (l) { l.load = s.load; l.dim = s.dim; l.stopped = s.stopped; l.speedMult = s.speedMult ?? 1; l.exportDir = s.exportDir || 0; l.flowNow = s.flow || 0; }
        for (let v = r.start; v < r.start + r.count; v++) {
          let dim = s.dim || 0;
          if (s.gaps && l && !rm.trace) { const al = rm.mesh.geometry.attributes.along.array[v]; if (s.gaps.some(([g0, g1]) => al >= g0 && al <= g1)) dim = 1; }
          if (a.array[v * 2] !== s.load || a.array[v * 2 + 1] !== dim) { a.array[v * 2] = s.load; a.array[v * 2 + 1] = dim; changed = true; }
        }
      }
      if (changed) a.needsUpdate = true;
    }
    this.updateLoadMarkerValues();
  }
  setStationFill(fills) { // Map stationId -> 0..1
    this.stationFill = fills; this.applyCapFill(); this.applyBeaconHeat();
  }
  applyBeaconHeat() {
    if (!this.beaconRecs || !this.beaconHot) return;
    this.beaconRecs.forEach((b, i) => this.beaconHot.setX(i, (this.stationFill?.get(b.id) ?? 0) >= 0.98 ? 1 : 0));
    this.beaconHot.needsUpdate = true;
  }

  // ------------------------------------------------------------------ underground traces (outside X-ray)
  /** Ground radius under a unit direction (sea surface over the ocean), from the nearest cell. */
  groundR(n) {
    let best = null, bd = -2;
    for (const c of this.cells) { const d = n.x * c.pos[0] + n.y * c.pos[1] + n.z * c.pos[2]; if (d > bd) { bd = d; best = c; } }
    return best.terrain === TERRAIN.MOUNTAIN ? best.ground : R;
  }
  /** The great-circle projection of an earth or fire chord on the ground (shafts project to a point: their beacon). */
  traceSamples(l) {
    const S = l.samples, n = S.length;
    const a = V(S[0]).normalize(), b = V(S[n - 1]).normalize();
    const midS = V(S[n >> 1]);
    let m = midS.length() > 3 ? midS.normalize() : a.clone().add(b);
    if (m.lengthSq() < 1e-4) m = new THREE.Vector3(0, 1, 0).cross(a); m.normalize();
    const pts = [];
    const arc = (u, v, first) => {
      const ang = u.angleTo(v); const k = Math.max(2, Math.ceil(ang / (1.2 * Math.PI / 180)));
      const sinA = Math.sin(ang) || 1;
      for (let i = first ? 0 : 1; i <= k; i++) {
        const t = i / k;
        const p = ang < 1e-4 ? u.clone() : u.clone().multiplyScalar(Math.sin((1 - t) * ang) / sinA).addScaledVector(v, Math.sin(t * ang) / sinA);
        pts.push(p.normalize());
      }
    };
    arc(a, m, true); arc(m, b, false);
    const rr = pts.map((p) => this.groundR(p));
    // soften the plateau edges of mountains
    return pts.map((p, i) => { const r = Math.max(rr[i], (rr[Math.max(0, i - 1)] + rr[i] + rr[Math.min(rr.length - 1, i + 1)]) / 3); return [p.x * (r + 0.35), p.y * (r + 0.35), p.z * (r + 0.35)]; });
  }
  buildTraces(lines) {
    for (const t of Object.keys(UNDERGROUND)) {
      const old = this.traceMeshes[t];
      if (old) { this.root.remove(old.mesh); old.mesh.geometry.dispose(); }
      this.traceMeshes[t] = null;
      const ls = [];
      for (const l of lines) {
        if (l.type !== t) continue;
        if (l.shaft) { l.trace = null; continue; }
        const smp = this.traceSamples(l); const tl = { id: l.id, samples: smp, load: l.load, dim: l.dim, born: l.born };
        l.trace = { samples: smp, cum: lengths(smp) }; l.trace.len = l.trace.cum[smp.length - 1];
        ls.push(tl);
      }
      if (!ls.length) continue;
      const { geometry, ranges } = buildRibbon(ls);
      const mesh = new THREE.Mesh(geometry, this.traceMats[t]); mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.name = 'trace-' + t;
      this.root.add(mesh);
      this.traceMeshes[t] = { mesh, ranges };
    }
    // portal beacons: a glowing ring on the ground at every Bore station (green) and over every Core Exchange (red-orange)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    let nb = 0; const ec = col(TYPE_COLORS.earth), fc = col(TYPE_COLORS.fire);
    this.beaconRecs = [];
    for (const s of this.net.stations || []) {
      if (s.terminal) continue;
      const isCore = s.core || (s.layers?.includes('fire') && s.kind === 'core');
      if (!isCore && !s.layers?.includes('earth')) continue;
      if (nb >= 128) break;
      const c = this.cells[s.cell]; const n = V(c.pos).normalize();
      const r = this.groundR(n) + (isCore ? 0.7 : 0.55);
      q.setFromUnitVectors(Y, n); m.compose(n.clone().multiplyScalar(r), q, new THREE.Vector3(isCore ? 1.35 : 1, 1, isCore ? 1.35 : 1));
      this.beacons.setMatrixAt(nb, m); const cc = isCore ? fc : ec; this.beaconCol.setXYZ(nb, cc.r, cc.g, cc.b); nb++;
      this.beaconRecs.push({ kind: isCore ? 'fire' : 'earth', id: s.id });
    }
    this.beacons.count = nb; this.beacons.instanceMatrix.needsUpdate = true; this.beaconCol.needsUpdate = true;
    this.applyBeaconHeat();
  }
  /** Train lights: the point on the ground above an underground train. */
  surfaceAbove(p, out) {
    const n = out.copy(p); const L = n.length(); if (L < 1e-3) return null; n.divideScalar(L);
    return n.multiplyScalar(this.groundR(n) + 0.9);
  }

  // ------------------------------------------------------------------ track extras
  buildTrackExtras(lines, wells = []) {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(), tgt = new THREE.Vector3();
    let nb = 0, ns = 0, np = 0;
    for (const l of lines) {
      if (l.type === 'surface') {
        // beam top at ground + 0.5 (rail centre at +1.0): beam centre ~0.36 below the rail
        for (let s = 0; s < l.len && nb < 6000; s += 1.0) {
          sampleAt(l, s + 0.5, p, d); up.copy(p).normalize(); p.addScaledVector(up, -0.64);
          m.lookAt(tgt.copy(p).add(d), p, up); m.setPosition(p); m.scale(new THREE.Vector3(1, 1, 1.02));
          this.beams.setMatrixAt(nb++, m);
        }
        for (let s = 0.75; s < l.len && ns < 6000; s += 1.5) {
          sampleAt(l, s, p, d); up.copy(p).normalize(); p.addScaledVector(up, -0.93);
          m.lookAt(tgt.copy(p).add(d), p, up); m.setPosition(p); this.sleepers.setMatrixAt(ns++, m);
        }
      } else if (l.type === 'sky') {
        for (let s = 4; s < l.len - 2 && np < 1500; s += 8) {
          sampleAt(l, s, p, d); up.copy(p).normalize();
          m.lookAt(tgt.copy(p).add(d), p, up); m.setPosition(p); this.pylons.setMatrixAt(np++, m);
        }
      }
    }
    this.beams.count = nb; this.sleepers.count = ns; this.pylons.count = np;
    for (const im of [this.beams, this.sleepers, this.pylons]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    // earth bores: rock tubes + crystals (X-ray only)
    const tubes = []; let nc = 0; let seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const l of lines) {
      if (l.type !== 'earth') continue;
      const pts = l.samples.filter((_, i) => i % 2 === 0 || i === l.samples.length - 1).map(V);
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
      const tg = new THREE.TubeGeometry(curve, Math.max(4, Math.ceil(l.len / 2)), 0.5, 7, false);
      tg.deleteAttribute('uv'); const uvs = new Float32Array(tg.attributes.position.count * 2);
      for (let i = 0; i < uvs.length / 2; i++) { uvs[i * 2] = (i % 8) / 8; uvs[i * 2 + 1] = Math.floor(i / 8) * 0.25; }
      tg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      tubes.push(tg);
      for (let s = 0.5; s < l.len && nc < 6000; s += 1.1) {
        sampleAt(l, s, p, d); const ang = rnd() * Math.PI * 2;
        const side = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
        side.applyAxisAngle(d, ang);
        p.addScaledVector(side, 0.42);
        m.lookAt(tgt.copy(p).add(side), p, d); m.setPosition(p);
        m.scale(new THREE.Vector3(0.6 + rnd(), 0.6 + rnd(), 0.6 + rnd()));
        this.crystals.setMatrixAt(nc++, m);
      }
    }
    for (const [a, b] of wells) {
      const curve = new THREE.LineCurve3(V(a), V(b));
      const tg = new THREE.TubeGeometry(curve, 4, 0.5, 7, false); tubes.push(tg);
    }
    // round caps on every bore and shaft end, so a tube never shows a cut-open edge (the crossing cinematic, X-ray)
    const cap = (p) => { const g = new THREE.SphereGeometry(0.5, 8, 6); g.deleteAttribute('uv'); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); g.translate(p[0], p[1], p[2]); return g; };
    const ends = [];
    for (const l of lines) if (l.type === 'earth' && l.samples.length >= 2) ends.push(l.samples[0], l.samples[l.samples.length - 1]);
    for (const [a, b] of wells) ends.push(a, b);
    for (const e of ends) tubes.push(cap(e));
    this.bores.geometry.dispose();
    this.bores.geometry = tubes.length ? mergeGeometries(tubes) : new THREE.BufferGeometry();
    this.crystals.count = nc; this.crystals.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ stations
  stationAnchor(s) {
    // where a station sits: { pos (Vector3), up, ground }
    const c = this.cells[s.cell]; const n = V(c.pos);
    if (s.pos && !s.terminal) {
      const p = V(s.pos); const up = p.clone().normalize();
      return { pos: p, up, base: p.length(), dome: s.kind === 'dome', pier: s.kind === 'pier' };
    }
    if (s.terminal) return { pos: n.clone().multiplyScalar(R + this.terminalH * 0.6), up: n, base: R };
    if (s.layers.includes('fire') && s.core) return { pos: n.clone().multiplyScalar(37), up: n, base: 37 };
    const water = c.terrain === TERRAIN.OCEAN || c.terrain === TERRAIN.ATLANTIS;
    if (water) {
      if (c.terrain === TERRAIN.ATLANTIS) {
        // at the dome's edge, 5.5 from its centre, on the sea floor
        const t = new THREE.Vector3(0, 1, 0).cross(n).normalize(); if (t.lengthSq() < 0.1) t.set(1, 0, 0);
        const p = n.clone().multiplyScalar(94).addScaledVector(t, 5.5).normalize();
        return { pos: p.clone().multiplyScalar(94), up: p, base: 94, dome: true };
      }
      return { pos: n.clone().multiplyScalar(100.5), up: n, base: 100.5, pier: true };
    }
    return { pos: n.clone().multiplyScalar(c.ground), up: n, base: c.ground };
  }

  layoutStations(stations, walkways) {
    this.lastLayout = [stations, walkways];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    let nPier = 0, nCable = 0, nCap = 0;
    this.capIndex = new Map();
    this.markers = []; // for picking and pins: { id, pos, kind, layer }
    // station models (and their drill collars and portal arches) are drawn only near the camera, facing it (cullStations)
    this.stRecs = [];
    let curSt = null;
    const rec = (kind, pos, up) => this.stRecs.push({ kind, m: m.clone(), pos: pos.clone(), up: up.clone(), st: curSt });
    const put = (kind, pos, up, scale = 1, yaw = 0) => {
      q.setFromUnitVectors(Y, up); q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
      m.compose(pos, q, new THREE.Vector3(scale, scale, scale)); rec(kind, pos, up);
    };
    for (const s of stations) {
      curSt = s.id;
      if (s.terminal) { this.markers.push({ id: s.id, pos: V(this.cells[s.cell].pos).multiplyScalar(R + 6), kind: 'terminal', layer: 'deep', station: s }); continue; }
      const a = this.stationAnchor(s); const yaw = (s.cell * 2.39) % (Math.PI * 2);
      if (s.layers.includes('fire') && s.core) {
        put('fire', a.pos, a.up, 1, yaw);
        this.markers.push({ id: s.id, pos: a.pos.clone().addScaledVector(a.up, 2), kind: 'core', layer: 'fire', station: s, inside: true });
        this.capIndex.set(s.id, { i: nCap, pos: a.pos.clone(), up: a.up }); nCap++;
        continue;
      }
      const ground = s.layers.filter((l) => ['surface', 'earth', 'sky', 'water'].includes(l));
      const base = ground[0] || (s.layers.includes('space') ? 'surface' : 'surface');
      let h = 0; const mh = (k) => (k === 'sky' ? this.models.skyport?.size.y : k === 'water' ? this.models['sea-station']?.size.y : this.models['station-surface']?.size.y) || 2.5;
      ground.forEach((k, i) => {
        const sc = i === 0 ? 1 : 0.6;
        put(k, a.pos.clone().addScaledVector(a.up, h), a.up, sc, yaw);
        if (k === 'earth' && i === 0) { q.setFromUnitVectors(Y, a.up); m.compose(a.pos, q, new THREE.Vector3(1, 1, 1)); rec('collar', a.pos, a.up); }
        h += mh(k) * sc;
      });
      if (!ground.length && s.layers.includes('space')) { put('surface', a.pos, a.up, 1, yaw); h = mh('surface'); }
      if (a.pier && nPier < this.piers.instanceMatrix.count) { q.setFromUnitVectors(Y, a.up); m.compose(a.pos.clone().addScaledVector(a.up, -0.15), q, new THREE.Vector3(1, 1, 1)); this.piers.setMatrixAt(nPier++, m); }
      // bore portal arch beside the station, on the ground
      if (ground.includes('earth')) {
        const t = new THREE.Vector3().crossVectors(a.up, Y).normalize(); if (t.lengthSq() < 0.1) t.set(1, 0, 0);
        const pp = V(this.cells[s.cell].pos).normalize().multiplyScalar(this.cells[s.cell].ground).addScaledVector(t, 3.2);
        q.setFromUnitVectors(Y, a.up); m.compose(pp, q, new THREE.Vector3(1, 1, 1)); rec('portal', pp, a.up);
      }
      if (s.layers.includes('space')) {
        // elevator cable from the station up to the ring point over the nearest ground-track point, ring station there
        const n = V(this.cells[s.cell].pos); const lo = Math.atan2(n.x, n.z);
        const ringP = new THREE.Vector3(Math.sin(lo) * 130, 0, Math.cos(lo) * 130);
        const from = a.pos.clone().addScaledVector(a.up, h);
        const dir = ringP.clone().sub(from); const len = dir.length(); dir.normalize();
        if (nCable < this.cables.instanceMatrix.count) { q.setFromUnitVectors(Y, dir); m.compose(from, q, new THREE.Vector3(1, len, 1)); this.cables.setMatrixAt(nCable++, m); }
        put('space', ringP.clone().addScaledVector(ringP.clone().normalize(), -2.0), ringP.clone().normalize(), 1, 0);
        this.markers.push({ id: s.id, pos: ringP.clone(), kind: 'ring', layer: 'space', station: s, sky: true });
      }
      const topPos = a.pos.clone().addScaledVector(a.up, h + 0.6);
      // pick point: the station's base (its capacity ring), not the top of a tall interchange stack
      this.markers.push({ id: s.id, pos: topPos, pick: a.pos.clone().addScaledVector(a.up, 0.6), kind: base, layer: base, station: s, water: base === 'water' && a.dome, base: a.base });
      this.capIndex.set(s.id, { i: nCap, pos: a.pos.clone().addScaledVector(a.up, 0.25), up: a.up }); nCap++;
    }
    this.cullKey = null; this.cullStations(this.G.camera.position, true);
    this.piers.count = nPier; this.cables.count = nCable;
    for (const im of [this.piers, this.cables]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    // capacity rings
    this.capRings.count = nCap;
    for (const [, c] of this.capIndex) { q.setFromUnitVectors(Y, c.up); m.compose(c.pos, q, new THREE.Vector3(1, 1, 1)); this.capRings.setMatrixAt(c.i, m); }
    this.capRings.instanceMatrix.needsUpdate = true; this.capRings.computeBoundingSphere();
    this.applyCapFill();
    // walkways: short chrome footbridges with a pale light strip
    disposeChildren(this.walkGroup, this.chromeMat, this.walkStripMat);
    for (const w of walkways) {
      const A = this.stationById.get(w.a), B = this.stationById.get(w.b); if (!A || !B) continue;
      let pts;
      if (w.samples && w.samples.length >= 2) pts = w.samples.map(V);
      else {
        const pa = this.stationAnchor(A).pos.clone(), pb = this.stationAnchor(B).pos.clone();
        pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; const p = pa.clone().lerp(pb, t); const r = (pa.length() * (1 - t) + pb.length() * t) + 1.5 * Math.sin(Math.PI * t) + 0.5; pts.push(p.normalize().multiplyScalar(r)); }
      }
      if (pts.length < 2 || pts[0].distanceTo(pts[pts.length - 1]) < 0.3) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.22, 6), this.chromeMat);
      this.walkStripMat = this.walkStripMat || clipMaterial(new THREE.MeshBasicMaterial({ color: 0xe3ecf7 }), null, 'walk');
      const strip = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.08, 4), this.walkStripMat);
      strip.position.set(0, 0, 0); strip.scale.setScalar(1.0025);
      this.walkGroup.add(tube, strip);
    }
  }
  /** Station models only for stations facing the camera within district distance; the rest are pins (update()). */
  cullStations(camPos, force = false) {
    if (!this.stRecs) return;
    const key = `${Math.round(camPos.x * 2)},${Math.round(camPos.y * 2)},${Math.round(camPos.z * 2)},${this.quality},${this.xray > 0.5}`;
    if (!force && key === this.cullKey) return;
    this.cullKey = key;
    const maxD2 = (this.quality === 'low' ? STATION_MODEL_DIST.low : STATION_MODEL_DIST.high) ** 2;
    const counts = {}; const shown = this.stShown = new Set();
    const to = new THREE.Vector3();
    for (const r of this.stRecs) {
      to.subVectors(camPos, r.pos); const d2 = to.lengthSq();
      // Core Exchanges are inside the planet (seen in X-ray only): distance alone
      const ok = d2 < maxD2 && (r.kind === 'fire' || to.dot(r.up) > -0.1 * Math.sqrt(d2));
      if (!ok) continue;
      const im = r.kind === 'collar' ? this.collars : r.kind === 'portal' ? this.portals : this.stModels[r.kind];
      if (!im) continue;
      counts[r.kind] = counts[r.kind] || 0;
      if (counts[r.kind] >= im.instanceMatrix.count) continue;
      im.setMatrixAt(counts[r.kind]++, r.m);
      if (r.kind !== 'collar' && r.kind !== 'portal') shown.add(r.st);
    }
    for (const k of ['surface', 'earth', 'sky', 'water', 'space', 'fire', 'collar', 'portal']) {
      const im = k === 'collar' ? this.collars : k === 'portal' ? this.portals : this.stModels[k]; if (!im) continue;
      im.count = counts[k] || 0; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    }
  }
  applyCapFill() {
    if (!this.capIndex) return;
    for (const [id, c] of this.capIndex) this.capFill.setX(c.i, this.stationFill?.get(id) ?? 0);
    this.capFill.needsUpdate = true;
  }

  // ------------------------------------------------------------------ trains
  setupTrains(lines) {
    this.trains = [];
    for (const l of lines) {
      const n = l.trains ?? 2;
      const cars = l.cars ?? (l.type === 'sky' ? 2 : l.type === 'space' ? 6 : l.type === 'fire' || l.type === 'earth' ? 4 : 3);
      for (let i = 0; i < n; i++) this.trains.push({ line: l, phase: i / n, cars, i });
    }
  }
  /** Position along a ping-pong line at time t: returns { s, dir (+1/-1) } */
  trainS(tr, t) {
    const l = tr.line;
    if (this.trainSource && this.useGameTime) {
      const arr = this.trainSource(l.id);
      const x = arr && arr[tr.i];
      if (x) { const dir = x.dir || tr.lastDir || 1; tr.lastDir = dir; tr.lastS = x.s; return { s: x.s, dir: x.dir === 0 ? (x.s > l.len / 2 ? 1 : -1) : dir }; }
    } const sp = (l.speed || ({ surface: 3, sky: 4, water: 2.5, earth: 2, fire: 6, space: 8, deep: 8 })[l.type]) * (l.speedMult ?? 1);
    const dwell = 4;
    const leg = l.len / sp; const cycle = 2 * (leg + dwell);
    if (l.stopped) { if (tr.frozenS == null) tr.frozenS = tr.lastS ?? 0; return { s: tr.frozenS, dir: tr.lastDir ?? 1 }; }
    tr.frozenS = null;
    let u = ((t / cycle + tr.phase) % 1 + 1) % 1 * cycle;
    let s, dir;
    if (u < leg) { s = u * sp; dir = 1; } else if (u < leg + dwell) { s = l.len; dir = 1; } else if (u < 2 * leg + dwell) { s = l.len - (u - leg - dwell) * sp; dir = -1; } else { s = 0; dir = -1; }
    tr.lastS = s; tr.lastDir = dir;
    return { s, dir };
  }

  // ------------------------------------------------------------------ per frame
  update(dt, t, camDist) {
    this.time = t;
    const gt = this.useGameTime ? this.gameTime : t;
    const near = camDist < NEAR || this.riding;
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(), tgt = new THREE.Vector3(), pp = new THREE.Vector3();
    const leadCount = {}; for (const k of TYPES) leadCount[k] = 0;
    let nc = 0, nb = 0;
    const camPos = this.G.camera.position;
    let nBolt = 0; const bolt = this.bolts.geometry.attributes.position;
    const pin = this.pinGeo.attributes; let npin = 0;
    const emitBudget = near ? 1 : 0;
    const leadNear2 = (this.quality === 'low' ? 70 : 110) ** 2;
    this.trainPoses = [];
    const xa = this.xpinGeo.attributes; let nx = 0; const fireC = col(TYPE_COLORS.fire).lerp(WHITE, 0.3);
    for (const tr of this.trains) {
      const l = tr.line; if (!this.layerVisible[l.type]) continue;
      const { s, dir } = this.trainS(tr, gt);
      const spacing = 1.35;
      const moving = !(s <= 0.001 || s >= l.len - 0.001) && !l.stopped;
      for (let c = 0; c < tr.cars; c++) {
        const sc = s - dir * c * spacing;
        sampleAt(l, sc, p, d); if (dir < 0) d.negate();
        // up: radial, except on vertical runs (shafts) where we pick a stable perpendicular
        up.copy(p).normalize(); if (Math.abs(up.dot(d)) > 0.95) up.set(0, 1, 0).cross(d).normalize();
        m.lookAt(tgt.copy(p).add(d), p, up); m.setPosition(p.x - up.x * 0.3, p.y - up.y * 0.3, p.z - up.z * 0.3);
        const lead = c === 0;
        if (lead) this.trainPoses.push({ tr, pos: p.clone(), dir: d.clone(), up: up.clone(), s, sdir: dir || 1 });
        // full lead-car models only for trains close to the camera (the rest of a district view, and the far side, are capsules)
        if (lead && near && this.leads[l.type] && leadCount[l.type] < 160 && (this.riding || (p.distanceToSquared(camPos) < leadNear2 && (this.xray > 0.5 || !UNDERGROUND[l.type])))) {
          this.leads[l.type].setMatrixAt(leadCount[l.type]++, m);
        } else if (nc < 3000) {
          this.caps.setMatrixAt(nc, m);
          const ac = this.capsuleOverride || this.avgColors[l.type]; this.caps.setColorAt(nc, ac);
          const tc = col(TYPE_COLORS[l.type]); const ld = 0.5 + (l.load ?? 0.3) * 1.2;
          this.capsBand.setXYZ(nc, tc.r * ld, tc.g * ld, tc.b * ld); nc++;
        }
        if (l.type === 'water' && nb < 600 && near) {
          // each car rides its own stretched bubble
          const mb = m.clone(); this.bubbles.setMatrixAt(nb++, mb);
        }
        // effects (near only)
        if (emitBudget && moving && p.distanceToSquared(camPos) < 120 * 120) {
          this.effect(l.type, p, d, up, c, dt);
          if (l.type === 'surface' && c < tr.cars - 1 && nBolt < 1950) {
            // lightning arc to the next car and down to the seam
            sampleAt(l, sc - dir * spacing, pp, null);
            nBolt = this.boltLine(bolt, nBolt, p, pp, up, 0.25);
            if (Math.random() < 0.5) nBolt = this.boltLine(bolt, nBolt, p, p.clone().addScaledVector(up, -0.9), d, 0.15);
          }
        }
      }
      if (l.type === 'fire' && this.xray > 0.5 && nx < 200) { sampleAt(l, s, p, null); xa.position.setXYZ(nx, p.x, p.y, p.z); xa.color.setXYZ(nx, fireC.r, fireC.g, fireC.b); xa.size.setX(nx, near ? 14 : 10); nx++; }
      const surfLight = UNDERGROUND[l.type] && this.xray < 0.5 && !this.inside && !this.riding;
      if ((!near || surfLight) && npin < 1100) {
        sampleAt(l, s, p, null); const tc = col(TYPE_COLORS[l.type]);
        if (surfLight) { this.surfaceAbove(p, p); tc.lerp(WHITE, 0.35); }
        pin.position.setXYZ(npin, p.x, p.y, p.z); pin.color.setXYZ(npin, tc.r, tc.g, tc.b); pin.size.setX(npin, surfLight ? (near ? 11 : 8) : 6); npin++;
      }
    }
    if (this.cineTrain) {
      const ct = this.cineTrain;
      ct.cars.forEach((car, ci) => {
        let upv = car.p.clone().normalize(); if (Math.abs(upv.dot(car.d)) > 0.95) upv = new THREE.Vector3(0, 1, 0).cross(car.d).normalize();
        m.lookAt(tgt.copy(car.p).add(car.d), car.p, upv); m.setPosition(car.p.x - upv.x * 0.3, car.p.y - upv.y * 0.3, car.p.z - upv.z * 0.3);
        if (ci === 0 && this.leads[ct.type]) this.leads[ct.type].setMatrixAt(leadCount[ct.type]++, m);
        else if (nc < 3000) { this.caps.setMatrixAt(nc, m); this.caps.setColorAt(nc, this.avgColors[ct.type]); const tc = col(TYPE_COLORS[ct.type]); this.capsBand.setXYZ(nc, tc.r * 1.4, tc.g * 1.4, tc.b * 1.4); nc++; }
        this.effect(ct.type, car.p, car.d, upv, ci, dt);
        if (ct.type === 'fire' && Math.random() < 0.8) this.emit(car.p.clone().addScaledVector(car.d, -1.2), car.d.clone().multiplyScalar(-2).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)), new THREE.Color(1, 0.35, 0.08), 0.9, 0.7);
      });
    }
    for (const k of TYPES) if (this.leads[k]) { this.leads[k].count = leadCount[k]; this.leads[k].instanceMatrix.needsUpdate = true; }
    this.caps.count = nc; this.caps.instanceMatrix.needsUpdate = true; if (this.caps.instanceColor) this.caps.instanceColor.needsUpdate = true; this.capsBand.needsUpdate = true;
    this.bubbles.count = nb; this.bubbles.instanceMatrix.needsUpdate = true;
    for (let i = nBolt; i < Math.min(bolt.count, (this._lastBolt || 0)); i++) bolt.setXYZ(i, 0, 0, 0);
    this._lastBolt = nBolt; bolt.needsUpdate = true; this.bolts.geometry.setDrawRange(0, nBolt);
    this.bolts.material.opacity = 0.55 + Math.random() * 0.45;

    // station models near, pins far
    const showModels = near;
    if (showModels) this.cullStations(camPos);
    for (const [k, im] of Object.entries(this.stModels)) if (im && k !== 'fire') im.visible = showModels && this.layerOn(k);
    this.collars.visible = this.portals.visible = showModels && this.layerVisible.earth;
    this.piers.visible = this.layerVisible.water;
    if (this.markers) {
      for (const mk of this.markers) {
        if (npin >= 1150) break; if (mk.inside && this.xray < 0.5) continue; if (!this.layerOn(mk.layer)) continue;
        // near: a pin only where the station's model isn't drawn (the Terminal always has its model)
        if (showModels && (mk.kind === 'terminal' || this.stShown?.has(mk.id))) continue;
        const tc = col(mk.kind === 'terminal' ? TYPE_COLORS.deep : TYPE_COLORS[mk.layer] || '#ffd9a0');
        pin.position.setXYZ(npin, mk.pos.x, mk.pos.y, mk.pos.z); pin.color.setXYZ(npin, tc.r, tc.g, tc.b); pin.size.setX(npin, mk.kind === 'terminal' ? 22 : 13); npin++;
      }
    }
    this.pinGeo.setDrawRange(0, npin); pin.position.needsUpdate = pin.color.needsUpdate = pin.size.needsUpdate = true;
    this.xpinGeo.setDrawRange(0, nx); xa.position.needsUpdate = xa.color.needsUpdate = xa.size.needsUpdate = true; this.xpins.material.uniforms.uPx.value = this.G.renderer.getPixelRatio();
    const px = this.G.renderer.getPixelRatio(); this.pins.material.uniforms.uPx.value = px; this.fx.material.uniforms.uPx.value = px;

    // particles
    const fa = this.fx.geometry.attributes;
    for (let i = 0; i < this.fxP.length; i++) {
      const q = this.fxP[i];
      if (q.life > 0) { q.life -= dt; q.p.addScaledVector(q.v, dt); }
      const a = q.life > 0 ? q.life / q.max : 0;
      fa.position.setXYZ(i, q.p.x, q.p.y, q.p.z); fa.color.setXYZ(i, q.c.r * a, q.c.g * a, q.c.b * a); fa.size.setX(i, q.life > 0 ? q.s : 0);
    }
    fa.position.needsUpdate = fa.color.needsUpdate = fa.size.needsUpdate = true;

    // flow overlay and type uniforms
    for (const t2 of TYPES) { const u = this.mats[t2].uniforms; u.uFlow.value += (this.flow - u.uFlow.value) * Math.min(1, dt * 4); }
    for (const m2 of Object.values(this.traceMats)) m2.uniforms.uFlow.value = this.mats.surface.uniforms.uFlow.value;
    this.beaconMat.uniforms.uScale.value = Math.max(1, Math.min(3.2, (camDist - 100) / 70));
    this.loadMarks.visible = this.loadFill.visible = this.flow > 0.5 && !this.riding && this.G.cam.mode !== 'follow';

    // export dots streaming toward the Warp Terminal (flow overlay)
    if (this.flow > 0.5 && !this.inside) {
      const ea = this.expGeo.attributes; let ne = 0; const mc = col(TYPE_COLORS.deep);
      for (const l of this.lines) {
        if (!l.exportDir || !this.layerVisible[l.type]) continue;
        const k = Math.min(12, 2 + Math.floor(l.flowNow / 25));
        for (let i = 0; i < k && ne < 600; i++) {
          let u = ((t * 6 / Math.max(10, l.len)) + i / k) % 1; if (l.exportDir < 0) u = 1 - u;
          const tl = l.trace && this.xray < 0.5 ? l.trace : l;
          sampleAt(tl, u * tl.len, p, null); ea.position.setXYZ(ne++, p.x, p.y, p.z);
        }
      }
      this.expGeo.setDrawRange(0, ne); ea.position.needsUpdate = true; this.expDots.visible = true;
      this.expDots.material.uniforms.uPx.value = this.G.renderer.getPixelRatio();
    } else this.expDots.visible = false;
    // launch ring
    this.launch.spin = Math.max(0.4, this.launch.spin - dt * 2);
    this.launchRing.rotation.z += dt * this.launch.spin;
    this.launchMat.emissiveIntensity = 1.0 + (this.launch.spin - 0.4) * 0.3;
    if (this.launch.flash > 0) { this.launch.flash = Math.max(0, this.launch.flash - dt * 1.4); }
    this.flashMat.opacity = this.launch.flash;
    this.flash.scale.setScalar(20 + (1 - this.launch.flash) * 30);
    if (this.launch.streak) this.updateStreak(dt);

    // priority diamonds spin
    if (this.priority.length) {
      const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
      this.priority.forEach((cid, i) => {
        const n = V(this.cells[cid].pos); q.setFromUnitVectors(Y, n).multiply(new THREE.Quaternion().setFromAxisAngle(Y, t * 0.8 + i));
        m.compose(n.clone().multiplyScalar(R + 11 + Math.sin(t * 1.5 + i) * 0.6), q, new THREE.Vector3(1, 1, 1)); this.diamonds.setMatrixAt(i, m);
      });
      this.diamonds.count = this.priority.length; this.diamonds.instanceMatrix.needsUpdate = true;
    } else this.diamonds.count = 0;

    if (this.beamAnim && this.beamMesh) {
      const b = this.beamAnim; b.t += dt; this.beamMesh.material.uniforms.uT.value = t;
      const grow = b.short ? Math.min(1, b.t / 0.6) : Math.min(1, b.t / 3.5);
      this.beamMesh.scale.set(b.short ? 1 : 2.2, Math.max(0.01, b.len * grow), b.short ? 1 : 2.2);
      if (b.short && b.t > 2.2) { this.beamMesh.visible = false; this.beamAnim = null; }
    }
    if (this.wheelRecs?.length) {
      const q2 = new THREE.Quaternion();
      this.wheelRecs.forEach((w, i) => { q2.copy(w.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), t * 0.3)); m.compose(w.base.clone().addScaledVector(w.n, 3.2), q2, new THREE.Vector3(1, 1, 1)); this.wheelRims.setMatrixAt(i, m); });
      this.wheelRims.instanceMatrix.needsUpdate = true;
    }
    // build spark(s) running along new rails
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i]; sp.t += dt; const u = Math.min(1, sp.t / 1.0);
      const l = sp.line; if (l.cum) { sampleAt(l, u * l.len, p, null); sp.obj.position.copy(p); }
      if (u >= 1) { this.root.remove(sp.obj); this.sparks.splice(i, 1); }
    }
    // pins pulse
    const pul = 1 + Math.sin(t * 5) * 0.12; this.pinA.scale.setScalar(pul); this.pinB.scale.setScalar(pul);
    if (this.selRing) this.selRing.rotation.z += dt;
  }

  effect(type, p, d, up, c, dt) {
    const r = Math.random;
    const tc = col(TYPE_COLORS[type]);
    const side = new THREE.Vector3().crossVectors(d, up);
    const rate = this.quality === 'low' ? 0.5 : 1;
    if (r() > rate * (c === 0 ? 0.9 : 0.35)) return;
    if (type === 'sky') {
      const a = this.time * 9 + c * 1.7; const off = side.clone().multiplyScalar(Math.cos(a) * 0.6).addScaledVector(up, Math.sin(a) * 0.6 + 0.3);
      this.emit(p.clone().add(off), d.clone().multiplyScalar(-1.2).addScaledVector(off, 0.6), tc.clone().lerp(new THREE.Color(1, 1, 1), 0.4), 0.7, 0.35);
    } else if (type === 'water') {
      if (r() < 0.6) this.emit(p.clone().addScaledVector(side, (r() - 0.5) * 0.8).addScaledVector(up, 0.3 + r() * 0.4), d.clone().multiplyScalar(-0.5).addScaledVector(up, 0.6), new THREE.Color(0.5, 0.7, 1.0), 1.2, 0.18);
    } else if (type === 'earth') {
      if (c === 0) { this.emit(p.clone().addScaledVector(d, 0.7), new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2), r() < 0.5 ? new THREE.Color(0.55, 0.48, 0.4) : tc.clone().lerp(new THREE.Color(1, 1, 0.6), 0.5), 0.5, 0.22); }
    } else if (type === 'fire') {
      this.emit(p.clone().addScaledVector(side, (r() - 0.5) * 0.6), d.clone().multiplyScalar(-1.5).addScaledVector(up, 0.4 + r()), r() < 0.5 ? tc : new THREE.Color(1, 0.75, 0.3), 1.0, c === 0 ? 0.4 : 0.3);
    } else if (type === 'space') {
      this.emit(p.clone().addScaledVector(side, (r() - 0.5) * 0.8).addScaledVector(up, (r() - 0.2) * 0.6), d.clone().multiplyScalar(-0.6), r() < 0.5 ? new THREE.Color(1, 1, 1) : tc, 1.4, 0.2);
    } else if (type === 'deep') {
      this.emit(p.clone(), new THREE.Vector3((r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 3), tc, 0.6, 0.3);
    } else if (type === 'surface') {
      if (r() < 0.3) this.emit(p.clone().addScaledVector(up, -0.8), side.clone().multiplyScalar((r() - 0.5) * 3), tc.clone().lerp(new THREE.Color(1, 1, 1), 0.5), 0.25, 0.2);
    }
  }
  boltLine(attr, n, a, b, perp, amp) {
    const segs = 5; let prev = a.clone();
    const side = new THREE.Vector3().crossVectors(b.clone().sub(a), perp).normalize();
    for (let i = 1; i <= segs; i++) {
      const t = i / segs; const q = a.clone().lerp(b, t);
      if (i < segs) q.addScaledVector(side, (Math.random() - 0.5) * amp * 2).addScaledVector(perp, (Math.random() - 0.5) * amp);
      attr.setXYZ(n++, prev.x, prev.y, prev.z); attr.setXYZ(n++, q.x, q.y, q.z); prev = q;
    }
    return n;
  }

  // ------------------------------------------------------------------ layers, X-ray, flow
  layerOn(kind) { const map = { surface: 'surface', earth: 'earth', sky: 'sky', water: 'water', space: 'space', fire: 'fire', wheel: 'surface', monument: 'surface', terminal: 'deep' }; return this.layerVisible[map[kind] || kind] !== false; }
  setLayer(type, on) {
    this.layerVisible[type] = on;
    if (this.railMeshes[type]) this.railMeshes[type].mesh.visible = on;
    if (type === 'surface') this.beams.visible = this.sleepers.visible = on;
    if (type === 'sky') this.pylons.visible = on;
    if (type === 'water') this.bubbles.visible = on;
    if (type === 'space') this.cables.visible = on;
    this.applyXray();
  }
  setXray(v) { this.xray = v; this.applyXray(); }
  applyXray() {
    const on = this.xray > 0.5;
    // X-ray: the fire chord and its trains draw over the opaque core (outside X-ray the crust must still hide them)
    this.mats.fire.depthTest = !on; this.mats.fire.uniforms.uWidth.value = on && !this.inside ? 0.8 : this.inside ? 1.4 : 0.55;
    if (this.xpins) this.xpins.visible = on && this.layerVisible.fire;
    const fade = Math.max(0, 1 - this.xray * 1.6);
    for (const t of Object.keys(UNDERGROUND)) {
      this.traceMats[t].uniforms.uFade.value = fade;
      const tm = this.traceMeshes?.[t]; if (tm) tm.mesh.visible = fade > 0.01 && this.layerVisible[t] && !this.inside;
    }
    if (this.beacons) { this.beaconMat.uniforms.uFade.value = fade; this.beacons.visible = fade > 0.01 && !this.inside && (this.layerVisible.earth || this.layerVisible.fire); }
    this.bores.visible = this.crystals.visible = on && this.layerVisible.earth;
    if (this.stModels.fire) this.stModels.fire.visible = on && this.layerVisible.fire;
  }
  setFlow(on) { this.flow = on ? 1 : 0; }
  /** Train livery: a tint on every lead car, a palette for the trailing capsules. */
  setLivery(l) {
    for (const im of Object.values(this.leads)) im.material.color.set(l?.tint || '#ffffff');
    this.capsuleOverride = l?.capsule ? col(l.capsule) : null;
  }
  setInside(on) {
    if (this.inside === on) return; this.inside = on;
    this.mats.earth.uniforms.uWidth.value = on ? 0.8 : 0.55;
    for (const o of [this.beams, this.sleepers, this.piers, this.collars, this.portals, this.terminal, this.walkGroup]) o.visible = !on;
    this.applyXray();
  }
  setQuality(q) { this.quality = q; }

  buildLoadMarkers() {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(), tgt = new THREE.Vector3();
    let n = 0; this.lmIndex = [];
    for (const l0 of this.lines) {
      const l = l0.trace || l0; // underground chords: markers ride the surface trace
      for (let s = 5; s < l.len - 2 && n < 3000; s += 10) {
        sampleAt(l, s, p, d); up.copy(p).normalize();
        const off = new THREE.Vector3().crossVectors(d, up).normalize().multiplyScalar(1.4);
        p.add(off);
        m.lookAt(tgt.copy(p).add(up), p, d); m.setPosition(p);
        this.lmIndex.push({ line: l0, i: n, base: m.clone() });
        n++;
      }
    }
    this.loadMarks.count = this.loadFill.count = n;
    this.updateLoadMarkerValues();
  }
  updateLoadMarkerValues() {
    if (!this.lmIndex) return;
    const sv = new THREE.Vector3(), m = new THREE.Matrix4();
    for (const e of this.lmIndex) {
      const f = e.line.load ?? 0;
      const sc = f > 0.9 ? 1.6 : f > 0.6 ? 1.25 : 0.9;
      m.copy(e.base); m.scale(sv.set(sc, sc, sc));
      this.loadMarks.setMatrixAt(e.i, m); this.loadFill.setMatrixAt(e.i, m);
      this.lmFull.setX(e.i, f); this.lmFill.setX(e.i, f);
    }
    this.loadMarks.instanceMatrix.needsUpdate = this.loadFill.instanceMatrix.needsUpdate = true;
    this.lmFull.needsUpdate = this.lmFill.needsUpdate = true;
  }

  // ------------------------------------------------------------------ build juice
  /** A rail just built: grow it over ~1 s with a spark. */
  growLines(ids, startTime) {
    for (const id of ids) {
      const l = this.lineById.get(id); if (!l) continue;
      const rm = this.railMeshes[l.type]; if (!rm) continue;
      const r = rm.ranges.get(id); const g = rm.mesh.geometry.attributes.grow;
      for (let v = r.start; v < r.start + r.count; v++) g.array[v * 2] = startTime;
      g.needsUpdate = true;
      const sp = new THREE.Sprite(this.spark.material.clone()); sp.material.color = col(TYPE_COLORS[l.type]).lerp(new THREE.Color(1, 1, 1), 0.5); sp.scale.setScalar(5);
      this.root.add(sp); this.sparks.push({ line: l, t: Math.min(0, this.time - startTime), obj: sp });
    }
  }
  departure() { this.launch.spin = 9; setTimeout(() => { this.launch.flash = 1; this.startStreak(); }, 900); }
  startStreak() {
    const tc = V(this.cells[this.terminalCell].pos);
    const from = tc.clone().multiplyScalar(R + this.terminalH + 5);
    this.launch.streak = { t: 0, from, dir: tc.clone().lerp(new THREE.Vector3(-0.42, 0.22, -1).normalize(), 0.5).normalize() };
  }
  updateStreak(dt) {
    const s = this.launch.streak; s.t += dt;
    const p = s.from.clone().addScaledVector(s.dir, s.t * s.t * 140);
    const tc = col(TYPE_COLORS.deep);
    for (let i = 0; i < 6; i++) this.emit(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)), s.dir.clone().multiplyScalar(-4), tc, 0.6, 1.4);
    if (s.t > 1.6) this.launch.streak = null;
  }
  returnSparkle() {
    const tc = V(this.cells[this.terminalCell].pos); const p = tc.clone().multiplyScalar(R + this.terminalH + 5);
    for (let i = 0; i < 40; i++) this.emit(p.clone(), new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8), new THREE.Color(1, 0.6, 0.9), 1.2, 0.6);
  }
  burst(pos, color, n = 30, speed = 6, size = 0.8) {
    const c = col(color);
    for (let i = 0; i < n; i++) this.emit(pos.clone(), new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(speed * (0.4 + Math.random())), c, 1.4, size);
  }

  // ------------------------------------------------------------------ route pins and ghosts
  setPin(which, pos) {
    const pin = which === 'A' ? this.pinA : this.pinB;
    if (!pos) { pin.visible = false; return; }
    pin.visible = true; pin.position.copy(pos); pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
  }
  /** Draw a dashed ghost of path samples (array of sample arrays with types). */
  setGhost(paths) {
    disposeChildren(this.ghosts);
    if (!paths) return;
    for (const g of paths) {
      if (!g.samples || g.samples.length < 2) continue;
      const { geometry } = buildRibbon([{ id: 0, samples: g.samples, load: 0, dim: 0 }]);
      const mat = railMaterial(g.type); mat.uniforms.uGhost.value = 1; mat.uniforms.uBright.value = 1.3; mat.uniforms.uClip.value = 0;
      const mesh = new THREE.Mesh(geometry, mat); mesh.renderOrder = 10; mesh.frustumCulled = false;
      this.ghosts.add(mesh);
    }
  }
  /** Highlight a selected line or station. */
  setSelected(sel) {
    for (const t of TYPES) this.mats[t].uniforms.uBright.value = 1;
    disposeChildren(this.selection); this.selRing = null;
    if (!sel) return;
    if (sel.line != null) {
      const l = this.lineById.get(sel.line); if (!l) return;
      // an underground line outside X-ray is highlighted on its surface trace
      const smp = l.trace && this.xray < 0.5 ? l.trace.samples : l.samples;
      const { geometry } = buildRibbon([{ id: 0, samples: smp, load: 0, dim: 0 }]);
      const mat = railMaterial(l.type); mat.uniforms.uWidth.value = 1.3; mat.uniforms.uBright.value = 0.55; mat.uniforms.uClip.value = CLIPPED[l.type];
      const mesh = new THREE.Mesh(geometry, mat); mesh.renderOrder = 7; mesh.frustumCulled = false; this.selection.add(mesh);
    }
    if (sel.station != null) {
      const mk = this.markers?.find((x) => x.id === sel.station); if (!mk) return;
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.8, 48), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      const a = mk.station ? this.stationAnchor(mk.station) : { pos: mk.pos, up: mk.pos.clone().normalize() };
      ring.position.copy(a.pos.clone().addScaledVector(a.up, 0.4)); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.up);
      this.selection.add(ring); this.selRing = ring;
    }
  }
  setPriority(cells) { this.priority = cells || []; }
  /** Attractions: Giant Wheel (model + turning code rim) and Monument models; fountains are parks with a plaza. */
  setAttractions(list) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    let nw = 0, nm = 0;
    if (!this.wheelRims) {
      const rg = new THREE.TorusGeometry(2.6, 0.12, 6, 40); const spokes = [];
      for (let i = 0; i < 8; i++) { const sp = new THREE.BoxGeometry(0.06, 5.2, 0.06); sp.rotateZ(i * Math.PI / 8); spokes.push(sp); }
      const g = mergeGeometries([rg, ...spokes].map((x) => x.toNonIndexed()));
      this.wheelRims = new THREE.InstancedMesh(g, clipMaterial(new THREE.MeshStandardMaterial({ color: 0xc9d2e3, metalness: 0.9, roughness: 0.25, emissive: 0xffd9a0, emissiveIntensity: 0.5 }), null, 'rim'), 32);
      this.wheelRims.count = 0; this.wheelRims.name = 'wheel-rims'; this.root.add(this.wheelRims); this.wheelRecs = [];
    }
    this.wheelRecs = [];
    for (const a of list || []) {
      const c = this.cells[a.cell]; const n = V(c.pos); q.setFromUnitVectors(Y, n);
      const base = n.clone().multiplyScalar(c.ground);
      if (a.look === 'wheel' && this.stModels.wheel && nw < 32) { m.compose(base, q, new THREE.Vector3(1, 1, 1)); this.stModels.wheel.setMatrixAt(nw++, m); this.wheelRecs.push({ base, q: q.clone(), n }); }
      if (a.look === 'monument' && this.stModels.monument && nm < 32) { m.compose(base, q, new THREE.Vector3(1, 1, 1)); this.stModels.monument.setMatrixAt(nm++, m); }
    }
    if (this.stModels.wheel) { this.stModels.wheel.count = nw; this.stModels.wheel.instanceMatrix.needsUpdate = true; this.stModels.wheel.computeBoundingSphere(); }
    if (this.stModels.monument) { this.stModels.monument.count = nm; this.stModels.monument.instanceMatrix.needsUpdate = true; this.stModels.monument.computeBoundingSphere(); }
    this.wheelRims.count = this.wheelRecs.length;
  }
  /** The finale's beam from the Warp Terminal to the galactic core (on), or the short quota beam (pulse). */
  beam(on, short = false) {
    if (!this.beamMesh) {
      const g = new THREE.CylinderGeometry(0.8, 0.8, 1, 12, 1, true); g.translate(0, 0.5, 0);
      const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float e = 1.0 - abs(vUv.x*2.0-1.0); vec3 c = mix(vec3(1.0,0.25,0.7), vec3(1.0,0.95,0.9), 0.5+0.5*sin(vUv.y*60.0-uT*8.0)); gl_FragColor = vec4(c*(0.6+0.4*e), 1.0); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      this.beamMesh = new THREE.Mesh(g, mat); this.beamMesh.visible = false; this.beamMesh.frustumCulled = false; this.root.add(this.beamMesh);
    }
    const b = this.beamMesh; const tc = V(this.cells[this.terminalCell].pos);
    const from = tc.clone().multiplyScalar(R + this.terminalH + 5);
    const to = new THREE.Vector3(-0.42, 0.22, -1).normalize().multiplyScalar(1900);
    const dir = to.clone().sub(from); const len = dir.length(); dir.normalize();
    b.position.copy(from); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    b.visible = !!on; this.beamAnim = on ? { t: 0, len: short ? 160 : len, short } : null;
  }
  setPolarRing(on) { this.polarRing.visible = !!on; }

  // ------------------------------------------------------------------ pick support
  /** Rail sample points of visible layers (every 2nd sample), for picking. */
  pickSamples() {
    const out = [];
    for (const l of this.lines) {
      if (!this.layerVisible[l.type]) continue;
      for (let i = 0; i < l.samples.length; i += 2) out.push({ line: l.id, sample: i, p: l.samples[i], type: l.type });
    }
    return out;
  }
  /** Surface-trace points of underground lines (outside X-ray), for picking. */
  traceSamples2() {
    const out = [];
    for (const l of this.lines) {
      if (!l.trace || !this.layerVisible[l.type]) continue;
      const S = l.trace.samples; for (let i = 0; i < S.length; i++) out.push({ line: l.id, sample: i, p: S[i], type: l.type });
    }
    return out;
  }
  sampleOf(lineId, i) { const l = this.lineById.get(lineId); if (!l) return null; const s = l.samples[Math.max(0, Math.min(l.samples.length - 1, i))]; return s ? V(s) : null; }

  /** Ride: a pose 2 behind and 1 above the lead car of the line's first train, looking 4 samples ahead. */
  ridePose(lineId, trainIdx = 0) {
    const pose = this.trainPoses?.find((x) => x.tr.line.id === lineId && x.tr.i === trainIdx);
    if (!pose) return null;
    const l = pose.tr.line; const ty = l.type;
    const back = ty === 'space' ? 9 : ty === 'sky' ? 8 : 6.5, upo = ty === 'space' ? 4.5 : ty === 'sky' ? 3 : ty === 'water' ? 1.6 : 2.4;
    // positions taken along the path itself (behind and ahead of the train), so the camera bends smoothly with the rail
    const sd = pose.sdir; const at = (ds) => { const q = new THREE.Vector3(); sampleAt(l, pose.s + sd * ds, q, null); return q; };
    const behind = at(-back), ahead = at(9), up = pose.up.clone();
    const upB = behind.clone().normalize(); if (Math.abs(upB.dot(pose.dir)) > 0.95) upB.copy(up);
    const pos = behind.addScaledVector(upB, upo);
    const look = ahead.addScaledVector(ahead.clone().normalize(), 0.4);
    if (ty === 'sky') {
      // look down at the city below and ahead, not at the empty sky the arc climbs into
      const g = look.clone().normalize().multiplyScalar(R + 2); look.lerp(g, 0.55);
    }
    let dome = null;
    if (ty === 'water') {
      // passing Atlantis: turn a little toward the nearest dome so it fills the frame
      for (const mk of this.markers || []) if (mk.water) { const dd = mk.pos.distanceTo(pose.pos); if (dd < 22 && (!dome || dd < dome.d)) dome = { p: mk.pos, d: dd }; }
      if (dome) look.lerp(dome.p, 0.45 * (1 - dome.d / 22));
      if (pos.length() > 98.6) pos.setLength(98.6); // stay under the waves
    }
    // underground: keep the camera underground too, so the cutaway view stays clean
    const below = pose.pos.length() < 99.5;
    if (below && ty !== 'water' && pos.length() > 98) pos.setLength(98);
    return { pos, look, up, below: below && ty !== 'water', water: ty === 'water' && pos.length() < 100 };
  }
  /** Attract camera: ride a random line for 15 s. */
  attractRide(cam) {
    if (!this.lines.length) return false;
    const pick = this.lines[Math.floor(Math.random() * this.lines.length)];
    this.riding = true;
    cam.startFollow(() => this.ridePose(pick.id, 0) || null);
    setTimeout(() => { this.riding = false; }, 15500);
    return true;
  }
}

/** Remove every child of a group, disposing its geometry and its own material (never a shared one in `keep`). */
function disposeChildren(group, ...keep) {
  for (const ch of [...group.children]) {
    group.remove(ch);
    ch.geometry?.dispose();
    if (ch.material && !keep.includes(ch.material) && !ch.material.userData?.shared) ch.material.dispose();
  }
}
function glowTexture() {
  if (glowTexture.t) return glowTexture.t;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTexture.t = new THREE.CanvasTexture(c); return glowTexture.t;
}
function makeMarker(color) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }));
  cone.rotation.x = Math.PI; cone.position.y = 4.3;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6;
  g.add(cone, ring); g.renderOrder = 12; cone.renderOrder = 12; ring.renderOrder = 12;
  return g;
}

export { sampleAt, lengths };
