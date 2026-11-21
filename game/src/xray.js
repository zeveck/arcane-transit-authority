// xray.js — the shared X-ray clip: every world material discards fragments on the camera's side of a
// plane perpendicular to the view axis, 40 units in front of the planet centre. Bores, shafts, the core,
// fire rails and their trains are never clipped (they simply don't get the chunk).
import * as THREE from 'three';

export const XRAY = {
  uniforms: {
    uClipOn: { value: 0 },          // 0..1 (animated)
    uClipDir: { value: new THREE.Vector3(0, 0, 1) },
    uClipDist: { value: 40 },
    uTime: { value: 0 },
  },
  on: false,
};

const VERT_DECL = 'varying vec3 vXWorld;\n';
const VERT_BODY = `
  {
    vec4 xw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      xw = instanceMatrix * xw;
    #endif
    vXWorld = (modelMatrix * xw).xyz;
  }
`;
const FRAG_DECL = 'varying vec3 vXWorld;\nuniform float uClipOn;\nuniform vec3 uClipDir;\nuniform float uClipDist;\n';
const FRAG_BODY = 'if (uClipOn > 0.5 && dot(vXWorld, uClipDir) > uClipDist) discard;\n';

/** Add the clip to a built-in material (MeshStandardMaterial etc). `extra(shader)` may patch more. */
export function clipMaterial(mat, extra = null, key = '') {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uClipOn = XRAY.uniforms.uClipOn;
    shader.uniforms.uClipDir = XRAY.uniforms.uClipDir;
    shader.uniforms.uClipDist = XRAY.uniforms.uClipDist;
    shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
    shader.fragmentShader = FRAG_DECL + shader.fragmentShader.replace('void main() {', 'void main() {\n' + FRAG_BODY);
    if (extra) extra(shader);
  };
  const pk = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (pk ? pk() : '') + '|xray' + key;
  return mat;
}

/** GLSL snippets for hand-written ShaderMaterials. */
export const XRAY_GLSL = {
  vertDecl: VERT_DECL,
  vertBody: (posExpr = 'position') => `vXWorld = (modelMatrix * vec4(${posExpr}, 1.0)).xyz;\n`,
  fragDecl: FRAG_DECL,
  fragBody: FRAG_BODY,
};

export function setClipDir(camPos) { XRAY.uniforms.uClipDir.value.copy(camPos).normalize(); }
