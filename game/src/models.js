// models.js — load the Meshy GLBs (facing +Z, standing on y=0, emissive masks baked in) and bake each
// into a single geometry + material, scaled to game units, ready for InstancedMesh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TYPE_COLORS } from './palette.js';

// target sizes in game units (design: a train car 1.2 long, a station ~4 across, the Warp Terminal ~14)
export const MODEL_SPECS = {
  'train-surface': { len: 1.3, accent: TYPE_COLORS.surface },
  'train-sky': { len: 1.3, accent: TYPE_COLORS.sky },
  'train-water': { len: 1.3, accent: TYPE_COLORS.water },
  'train-earth': { len: 1.3, accent: TYPE_COLORS.earth },
  'train-fire': { len: 1.3, accent: TYPE_COLORS.fire },
  'train-space': { len: 1.3, accent: TYPE_COLORS.space },
  'train-deep': { len: 1.3, accent: TYPE_COLORS.deep },
  'station-surface': { width: 4.0, accent: TYPE_COLORS.surface },
  skyport: { width: 4.4, accent: TYPE_COLORS.sky },
  'sea-station': { width: 4.0, accent: TYPE_COLORS.water },
  'core-exchange': { width: 4.2, accent: TYPE_COLORS.fire },
  'warp-base': { width: 14, accent: TYPE_COLORS.deep },
  'ring-elevator': { width: 4.0, accent: TYPE_COLORS.space },
  'wheel-base': { width: 4.5, accent: '#ffd9a0' },
  monument: { width: 3.2, accent: null },
};

export { AVG_CAR_COLORS } from './palette.js';

/** Load the named models (default: all). The title needs none of them; main.js loads them after the title shows. */
const CAR_DIAMETER = 0.56; // a touch over the capsules' 0.52, so the lead car reads as the head of the train
const CAR_AXIS_Y = 0.3;

export async function loadModels(onProgress, names = Object.keys(MODEL_SPECS)) {
  const loader = new GLTFLoader();
  const out = {};
  let done = 0;
  await Promise.all(names.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
      out[name] = bake(gltf.scene, name);
    } catch (e) {
      console.warn('model failed', name, e?.message);
      out[name] = null;
    }
    done++; onProgress?.(done / names.length);
  }));
  return out;
}

function bake(root, name) {
  root.updateMatrixWorld(true);
  let mesh = null;
  root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  g.computeBoundingBox();
  const bb = g.boundingBox; const size = new THREE.Vector3(); bb.getSize(size);
  const spec = MODEL_SPECS[name];
  let s;
  if (spec.len) s = spec.len / size.z; // trains: length along +Z
  else s = spec.width / Math.max(size.x, size.z);
  // stand on y=0, centred in x/z
  const c = new THREE.Vector3(); bb.getCenter(c);
  g.translate(-c.x, -bb.min.y, -c.z);
  g.scale(s, s, s);
  if (spec.len) {
    // lead cars match the trailing capsules (render-net: CapsuleGeometry radius 0.26, centred 0.3 above the car's origin):
    // cross-section scaled up to the capsule's diameter, length kept, and centred on the same axis
    g.computeBoundingBox(); const b = g.boundingBox; const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
    const k = CAR_DIAMETER / Math.max(w, h);
    g.scale(k, k, 1); g.translate(0, CAR_AXIS_Y - (h * k) / 2, 0);
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  const src = mesh.material;
  const mat = src.clone();
  mat.metalness = Math.min(0.9, mat.metalness ?? 0.5);
  mat.roughness = Math.max(0.15, mat.roughness ?? 0.5);
  mat.envMapIntensity = 1.0;
  if (spec.accent) mat.emissive = new THREE.Color(spec.accent);
  mat.emissiveIntensity = name === 'monument' ? 1.0 : 0.8;
  if (!mat.emissiveMap) mat.emissiveIntensity = 0.0;
  const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
  const sz = new THREE.Vector3(); box.getSize(sz);
  // average base colour (for trailing capsules), from the base texture
  let avg = new THREE.Color(0.5, 0.52, 0.58);
  try {
    const img = mat.map?.image;
    if (img) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 16;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 16, 16);
      const d = cx.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4; avg = new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
    }
  } catch { /* keep default */ }
  return { geometry: g, material: mat, size: sz, avgColor: avg, tris: (g.index ? g.index.count : g.attributes.position.count) / 3 };
}
