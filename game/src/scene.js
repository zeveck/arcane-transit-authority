// scene.js — renderer, scene, lights, PMREM environment, starfield, galactic-core backdrop and the
// Homeworld light. Everything that is "the sky".
import * as THREE from 'three';

export const SKY_DIR = new THREE.Vector3(-0.42, 0.22, -1).normalize(); // where the galactic core hangs
export const SUN_DIR = new THREE.Vector3(-0.15, 0.55, 0.85).normalize();

const texLoader = new THREE.TextureLoader();
export function loadTex(url, { srgb = true, repeat = false } = {}) {
  return new Promise((res) => {
    texLoader.load(url, (t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      t.anisotropy = 4;
      res(t);
    }, undefined, () => res(null));
  });
}

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  setQualityPixelRatio(renderer, quality);
  renderer.setClearColor(0x070a1c, 1);
  return renderer;
}
export function setQualityPixelRatio(renderer, quality) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1.5 : 2));
}

export function createSky(scene, textures) {
  const group = new THREE.Group(); group.name = 'sky';
  scene.add(group);

  // --- starfield: 3,000 points on a big sphere, twinkling
  const N = 3000;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N), col = new Float32Array(N * 3);
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.set([r * Math.cos(th) * 2400, u * 2400, r * Math.sin(th) * 2400], i * 3);
    size[i] = 0.6 + Math.pow(rnd(), 6) * 3.2; phase[i] = rnd() * 6.28;
    const w = rnd(); const c = w < 0.7 ? [0.85, 0.9, 1] : w < 0.85 ? [1, 0.85, 0.75] : [0.8, 0.8, 1];
    col.set(c, i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('size', new THREE.BufferAttribute(size, 1));
  sg.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float size; attribute float phase; attribute vec3 color; uniform float uTime; uniform float uPx; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = size*uPx*1.4; vC=color; vA = 0.55+0.45*sin(uTime*1.3+phase*3.0); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); float a=smoothstep(.5,.0,r); gl_FragColor=vec4(vC*a*vA,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; stars.renderOrder = -10;
  group.add(stars);

  // --- galactic core: a camera-independent plane far away, faded at its edges
  const gw = 2600, gh = gw * 1344 / 3168;
  const galMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: textures.galaxy }, uBright: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map; uniform float uBright; varying vec2 vUv;
      void main(){ vec3 c = texture2D(map, vUv).rgb; vec2 d = (vUv-.5)*vec2(2.0,2.0); float e = 1.0-smoothstep(0.55,1.0,length(d*vec2(0.85,1.0)));
        c = max(c - vec3(0.035,0.045,0.11), 0.0)*1.25; gl_FragColor = vec4(c*e*uBright, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const gal = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), galMat);
  gal.position.copy(SKY_DIR).multiplyScalar(2000);
  gal.lookAt(0, 0, 0);
  gal.rotateZ(-0.18);
  gal.renderOrder = -9; gal.frustumCulled = false;
  group.add(gal);

  // --- the Homeworld: a steady white-gold point at the core's heart
  const hc = document.createElement('canvas'); hc.width = hc.height = 128;
  const g2 = hc.getContext('2d'); const grd = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,250,1)'); grd.addColorStop(0.12, 'rgba(255,240,200,0.95)'); grd.addColorStop(0.35, 'rgba(255,210,150,0.25)'); grd.addColorStop(1, 'rgba(255,200,140,0)');
  g2.fillStyle = grd; g2.fillRect(0, 0, 128, 128);
  const hwTex = new THREE.CanvasTexture(hc); hwTex.colorSpace = THREE.SRGBColorSpace;
  const home = new THREE.Sprite(new THREE.SpriteMaterial({ map: hwTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  home.position.copy(SKY_DIR).multiplyScalar(1900);
  home.scale.setScalar(90);
  home.renderOrder = -8;
  group.add(home);

  return {
    group, stars, starMat, gal, galMat, home,
    homeBase: 90,
    update(t, camera) {
      starMat.uniforms.uTime.value = t;
      gal.rotation.z = -0.18 + Math.sin(t * 0.01) * 0.02;
      // keep the sky centred on the camera so it never parallaxes
      group.position.copy(camera.position);
    },
    setHomeBrightness(n) { home.scale.setScalar(this.homeBase * (1 + 0.12 * n)); },
  };
}

/** A PMREM environment made at load from a small scene: gradient sky + galactic core + soft panels. */
export function createEnvironment(renderer, textures) {
  const envScene = new THREE.Scene();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = vP.y*.5+.5; vec3 a = vec3(0.05,0.06,0.16); vec3 b = vec3(0.30,0.34,0.52); vec3 c = mix(a,b,pow(h,1.5));
      c += vec3(0.6,0.45,0.5)*pow(max(dot(vP, normalize(vec3(-0.42,0.22,-1.0))),0.),8.)*0.8; gl_FragColor=vec4(c,1.); }`,
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
  const panel = (x, y, z, w, h, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m); };
  panel(0, 40, 0, 40, 40, 0x8a93b8);
  panel(30, 10, 25, 14, 30, 0xe8d9c0);
  panel(-35, 5, 20, 10, 25, 0x6a7ab0);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(envScene, 0.03);
  pm.dispose();
  return rt.texture;
}

export function createLights(scene) {
  const key = new THREE.DirectionalLight(0xe6ebff, 2.0);
  key.position.copy(SUN_DIR).multiplyScalar(500);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9fb8, 0.25); // faint rose haze from the other side
  rim.position.set(0.6, -0.2, 0.8).multiplyScalar(500);
  scene.add(rim);
  const hemi = new THREE.HemisphereLight(0x6a76b8, 0x2a2440, 0.9);
  scene.add(hemi);
  return { key, rim, hemi };
}
