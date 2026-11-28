// PBR material system for the house. Every part material is a MeshStandardMaterial extended by
// one shared shader patch (so all of them compile to a handful of programs):
//
// - Surface detail projected in metres. Instances are unit shapes scaled per part, so ordinary UVs
//   would stretch a texture across an 8 m wall or squash it on a sill. Instead the fragment shader
//   box-projects world position (continuous across neighbouring pieces: render, masonry, paving)
//   or, for timber, the part's own long axis (grain follows each board). The tangent frame comes
//   from the same projection, so normal maps need no tangents or UVs.
// - Edge bevels in the shader: a 1–2 cm rounded-edge highlight on box parts, only on real edges.
//   Faces that continue into a coplanar neighbour (see `soft` in model.ts) are left sharp.
// - Cavity (from the maps) and ground-contact occlusion darken indirect light in joints and at the
//   foot of walls, standing in for ambient occlusion without a post-processing pass.
// - Glass and water: premultiplied output with Fresnel opacity, so reflections stay at full
//   strength while the interior or pool floor shows through at normal viewing angles.

import * as THREE from "three";
import type { Mat } from "./model";
import { neutralMaps, surfaceMaps, type SurfaceName } from "./textures";

type Spec = {
  color: string;
  roughness: number;
  metalness?: number;
  /** Image-based light; matte materials take little so sun and shadow stay readable. */
  env?: number;
  surface?: SurfaceName;
  /** Real-world size of one texture repeat (m). */
  tile?: number;
  /** Normal-map strength, albedo-variation strength (0–1), roughness-variation strength (0–1). */
  normal?: number;
  albedo?: number;
  rough?: number;
  /** Project along the part's long axis (timber) instead of world axes. */
  local?: boolean;
  /** Edge bevel width (m); 0 for none. */
  bevel?: number;
  /** Ground-contact darkening of indirect light at the foot of vertical faces (0–1). */
  ground?: number;
  /** Glass-like: Fresnel opacity, premultiplied. Value is the head-on opacity. */
  clear?: number;
  emissive?: string;
};

export const SPECS: Record<Mat, Spec> = {
  // Site and structure
  soil: { color: "#8b7359", roughness: 1, surface: "soil", tile: 2.2, normal: 1, albedo: 1, bevel: 0.02 },
  trench: { color: "#6b5644", roughness: 1, surface: "soil", tile: 1.6, normal: 1, albedo: 1 },
  concrete: { color: "#aaa79f", roughness: 0.88, surface: "concrete", tile: 2.4, normal: 0.8, albedo: 1, rough: 1, bevel: 0.012, ground: 0.35 },
  rebar: { color: "#6e4b36", roughness: 0.62, metalness: 0.5, env: 0.5 },
  block: { color: "#bcb6aa", roughness: 0.92, surface: "block", tile: 1.6, normal: 1, albedo: 1, rough: 1, bevel: 0.008, ground: 0.35 },
  rafter: { color: "#c9a273", roughness: 0.74, surface: "wood", tile: 1.4, local: true, normal: 0.7, albedo: 1, rough: 1, bevel: 0.006 },
  plank: { color: "#b99665", roughness: 0.85, surface: "wood", tile: 1.4, local: true, normal: 0.8, albedo: 1, rough: 1, bevel: 0.005 },
  scaffold: { color: "#a9adb1", roughness: 0.45, metalness: 0.75, env: 0.8 },
  line: { color: "#d9542f", roughness: 0.7 },

  // Envelope
  render: { color: "#ebe7df", roughness: 0.9, surface: "plaster", tile: 1.6, normal: 0.55, albedo: 1, rough: 1, bevel: 0.012, ground: 0.3 },
  base: { color: "#55544f", roughness: 0.86, surface: "plaster", tile: 0.9, normal: 0.9, albedo: 1, rough: 1, bevel: 0.01, ground: 0.4 },
  stoneclad: { color: "#bfb19b", roughness: 0.84, surface: "ashlar", tile: 1.2, normal: 0.9, albedo: 1, rough: 1, bevel: 0.006, ground: 0.3 },
  backing: { color: "#2b2926", roughness: 0.92, surface: "plaster", tile: 1.2, normal: 0.4, albedo: 0.6 },
  cladding: { color: "#986741", roughness: 0.72, surface: "wood", tile: 1.6, local: true, normal: 0.9, albedo: 1, rough: 1, bevel: 0.006, ground: 0.25 },
  roof: { color: "#3a3d41", roughness: 0.42, metalness: 0.55, env: 0.9, surface: "metal", tile: 2.5, normal: 0.6, albedo: 1, rough: 1, bevel: 0.006 },
  membrane: { color: "#4b4e51", roughness: 0.9, surface: "concrete", tile: 0.8, normal: 0.6, albedo: 0.8 },
  sill: { color: "#d6d0c3", roughness: 0.68, surface: "concrete", tile: 1.1, normal: 0.35, albedo: 0.7, rough: 1, bevel: 0.006 },

  // Openings
  frame: { color: "#2c2e31", roughness: 0.5, metalness: 0.3, env: 0.6, surface: "metal", tile: 1.5, normal: 0.3, albedo: 0.5, rough: 0.6, bevel: 0.004 },
  steel: { color: "#c8cbcd", roughness: 0.28, metalness: 0.95, env: 1, surface: "metal", tile: 0.6, normal: 0.3, rough: 1, bevel: 0.003 },
  glass: { color: "#202c31", roughness: 0.04, metalness: 0, env: 1.5, clear: 0.3 },
  door: { color: "#68452b", roughness: 0.55, surface: "wood", tile: 1.2, local: true, normal: 0.6, albedo: 1, rough: 1, bevel: 0.004 },
  interior: { color: "#d8d0c3", roughness: 0.92, surface: "plaster", tile: 1.2, normal: 0.2, albedo: 0.5 },
  floorIn: { color: "#a17c58", roughness: 0.55, surface: "wood", tile: 1.2, local: true, normal: 0.4, albedo: 1 },
  curtain: { color: "#e6e0d3", roughness: 1, surface: "plaster", tile: 0.4, normal: 0.6, albedo: 0.4 },
  lamp: { color: "#f3efe4", roughness: 0.3, env: 0.6, emissive: "#3a3125" },

  // Garden
  lawn: { color: "#77894f", roughness: 1, surface: "grass", tile: 5, normal: 0.8, albedo: 1, bevel: 0.02 },
  gravel: { color: "#bab4a8", roughness: 0.95, surface: "gravel", tile: 0.7, normal: 1, albedo: 1, bevel: 0.01 },
  paving: { color: "#d3ccbe", roughness: 0.82, surface: "paving", tile: 2.4, normal: 0.8, albedo: 1, rough: 1, bevel: 0.01, ground: 0.2 },
  stone: { color: "#c8c0b0", roughness: 0.82, surface: "concrete", tile: 1.4, normal: 0.6, albedo: 1, rough: 1, bevel: 0.012 },
  deck: { color: "#9b704a", roughness: 0.7, surface: "wood", tile: 1.6, local: true, normal: 0.9, albedo: 1, rough: 1, bevel: 0.005 },
  water: { color: "#3a9fb0", roughness: 0.03, env: 1.4, surface: "pool", tile: 3, normal: 0.25, albedo: 1, clear: 0.72 },
  hedge: { color: "#4c6834", roughness: 0.95, surface: "foliage", tile: 1.1, normal: 1, albedo: 1, bevel: 0.08, ground: 0.4 },
  shrub: { color: "#5b783c", roughness: 0.95, surface: "foliage", tile: 0.9, normal: 1, albedo: 1, ground: 0.3 },
  canopy: { color: "#6a8742", roughness: 0.95, surface: "foliage", tile: 1.3, normal: 1, albedo: 1 },
  trunk: { color: "#6b5543", roughness: 0.95, surface: "bark", tile: 0.9, normal: 1, albedo: 1, ground: 0.3 },
  fabric: { color: "#d8d2c5", roughness: 1, surface: "plaster", tile: 0.3, normal: 0.5, albedo: 0.4, bevel: 0.015 },
};

// ── Shader patch ──────────────────────────────────────────────────────────────
const VERT_PARS = /* glsl */ `
// x: bits 0–5 soft sides (no bevel), bits 6–11 covered faces (not drawn); 2 bits per axis
// (negative side, positive side). y: per-part seed.
attribute vec2 aPart;
varying vec3 vPWorld;
varying vec3 vPLocal;
flat varying vec3 vPScale;
flat varying vec4 vPAxX;
flat varying vec4 vPAxY;
flat varying vec3 vPAxZ;
flat varying vec3 vPEdge;
`;

const VERT_MAIN = /* glsl */ `
{
  mat4 pM = modelMatrix * instanceMatrix;
  vPWorld = (pM * vec4(transformed, 1.0)).xyz;
  vec3 sx = pM[0].xyz, sy = pM[1].xyz, sz = pM[2].xyz;
  vPScale = vec3(length(sx), length(sy), length(sz));
  vPAxX = vec4(sx / max(vPScale.x, 1e-6), fract(aPart.y * 0.618034) * 17.0);
  vPAxY = vec4(sy / max(vPScale.y, 1e-6), fract(aPart.y * 0.754878) * 11.0);
  vPAxZ = sz / max(vPScale.z, 1e-6);
  vPLocal = transformed;
  int pm = int(aPart.x + 0.5);
  vPEdge = vec3(float(pm & 3), float((pm >> 2) & 3), float((pm >> 4) & 3));
  // A face fully covered by a neighbour collapses to a point outside the view (no fragments).
  vec3 an = abs(normal);
  int axis = an.x > 0.5 ? 0 : (an.y > 0.5 ? 1 : (an.z > 0.5 ? 2 : -1));
  if (axis >= 0) {
    int side = 2 * axis + ((axis == 0 ? normal.x : (axis == 1 ? normal.y : normal.z)) > 0.0 ? 1 : 0);
    if (((pm >> 6) & (1 << side)) != 0) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
  }
}
`;

const FRAG_PARS = /* glsl */ `
uniform sampler2D uAlb;
uniform sampler2D uDat;
uniform vec4 uSurf;  // x: repeats per metre, y: normal strength, z: albedo strength, w: local projection
uniform vec4 uSurf2; // x: roughness variation, y: bevel width (m), z: ground occlusion, w: head-on opacity (clear materials)
varying vec3 vPWorld;
varying vec3 vPLocal;
flat varying vec3 vPScale;
flat varying vec4 vPAxX;
flat varying vec4 vPAxY;
flat varying vec3 vPAxZ;
flat varying vec3 vPEdge;
vec2 pUv;
vec3 pT;
vec3 pB;
vec4 pDat;
`;

const FRAG_MAP = /* glsl */ `
{
  vec3 nW = (vec4(normalize(vNormal), 0.0) * viewMatrix).xyz;
  vec3 an = abs(nW);
  if (uSurf.w < 0.5) {
    if (an.y > an.x && an.y > an.z) { pUv = vPWorld.xz; pT = vec3(1.0, 0.0, 0.0); pB = vec3(0.0, 0.0, 1.0); }
    else if (an.x > an.z) { pUv = vPWorld.zy; pT = vec3(0.0, 0.0, 1.0); pB = vec3(0.0, 1.0, 0.0); }
    else { pUv = vPWorld.xy; pT = vec3(1.0, 0.0, 0.0); pB = vec3(0.0, 1.0, 0.0); }
  } else {
    // u runs along the longer in-plane axis of the face, so grain follows each board.
    vec3 L = vPLocal * vPScale;
    vec3 aL = abs(vPLocal);
    vec3 ax0; vec3 ax1; float u0; float u1; float l0; float l1;
    if (aL.x >= aL.y && aL.x >= aL.z) { ax0 = vPAxY.xyz; u0 = L.y; l0 = vPScale.y; ax1 = vPAxZ; u1 = L.z; l1 = vPScale.z; }
    else if (aL.y >= aL.z) { ax0 = vPAxX.xyz; u0 = L.x; l0 = vPScale.x; ax1 = vPAxZ; u1 = L.z; l1 = vPScale.z; }
    else { ax0 = vPAxX.xyz; u0 = L.x; l0 = vPScale.x; ax1 = vPAxY.xyz; u1 = L.y; l1 = vPScale.y; }
    if (l1 > l0) { pUv = vec2(u1, u0); pT = ax1; pB = ax0; }
    else { pUv = vec2(u0, u1); pT = ax0; pB = ax1; }
    pUv += vec2(vPAxX.w, vPAxY.w);
  }
  pUv *= uSurf.x;
  vec3 pAlb = texture2D(uAlb, pUv).rgb * 2.0;
  diffuseColor.rgb *= mix(vec3(1.0), pAlb, uSurf.z);
  pDat = texture2D(uDat, pUv);
}
`;

const FRAG_ROUGH = /* glsl */ `
roughnessFactor = clamp(roughnessFactor * mix(1.0, pDat.b * 2.0, uSurf2.x), 0.03, 1.0);
`;

const FRAG_NORMAL = /* glsl */ `
{
  vec2 nxy = (pDat.rg * 2.0 - 1.0) * uSurf.y;
  vec3 T = (viewMatrix * vec4(pT, 0.0)).xyz;
  vec3 B = (viewMatrix * vec4(pB, 0.0)).xyz;
  T = normalize(T - normal * dot(normal, T));
  B = normalize(B - normal * dot(normal, B));
  normal = normalize(T * nxy.x + B * nxy.y + normal);
  if (uSurf2.y > 0.0) {
    vec3 dist = (0.5 - abs(vPLocal)) * vPScale;
    // At least ~1 px wide, so distant edges get an anti-aliased highlight instead of sparkle.
    float px = length(fwidth(vPWorld)) * 0.7;
    float bw = min(max(uSurf2.y, px), 0.45 * min(vPScale.x, min(vPScale.y, vPScale.z)));
    vec3 w = 1.0 - smoothstep(vec3(0.0), vec3(bw), dist);
    vec3 negSoft = mod(vPEdge, 2.0);
    vec3 posSoft = floor(vPEdge * 0.5);
    vec3 allow = 1.0 - mix(negSoft, posSoft, step(0.0, vPLocal));
    vec3 tilt = sign(vPLocal) * w * allow;
    vec3 tW = vPAxX.xyz * tilt.x + vPAxY.xyz * tilt.y + vPAxZ * tilt.z;
    normal = normalize(normal + (viewMatrix * vec4(tW, 0.0)).xyz * 0.85);
  }
}
`;

const FRAG_AO = /* glsl */ `
{
  vec3 nW2 = (vec4(normal, 0.0) * viewMatrix).xyz;
  float upright = 1.0 - abs(nW2.y);
  float ground = mix(1.0 - uSurf2.z * upright, 1.0, smoothstep(0.0, 0.9, vPWorld.y));
  float cav = mix(1.0, pDat.a, min(uSurf.z, 1.0));
  reflectedLight.indirectDiffuse *= ground * cav;
  reflectedLight.indirectSpecular *= ground * mix(1.0, cav, 0.5);
}
`;

// Fresnel opacity, premultiplied: diffuse (what shows through) scales with alpha, reflections do not.
const FRAG_CLEAR = /* glsl */ `
{
  float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 5.0);
  float a = clamp(uSurf2.w + (1.0 - uSurf2.w) * fres, 0.0, 1.0);
  vec3 diff = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
  vec3 spec = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
  gl_FragColor = vec4(diff * a + spec + totalEmissiveRadiance, a);
}
`;

function patch(material: THREE.MeshStandardMaterial, uniforms: Record<string, THREE.IUniform>, clear: boolean) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_PARS}`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${VERT_MAIN}`);
    let frag = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_PARS}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${FRAG_MAP}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>\n${FRAG_AO}`);
    if (clear) frag = frag.replace("#include <opaque_fragment>", FRAG_CLEAR);
    shader.fragmentShader = frag;
  };
  // Same source for every material: they share programs, differing only in uniforms.
  material.customProgramCacheKey = () => (clear ? "house-pbr-clear" : "house-pbr");
}

export type MaterialSet = { mats: Record<Mat, THREE.MeshStandardMaterial>; dispose: () => void };

/** Builds all part materials and their detail maps. `anisotropy` comes from the renderer. */
export function makeMaterials(anisotropy: number, quality: "high" | "low"): MaterialSet {
  const textures: THREE.Texture[] = [];
  const maps = new Map<SurfaceName, ReturnType<typeof surfaceMaps>>();
  const neutral = neutralMaps();
  textures.push(neutral.alb, neutral.dat);
  const mats = {} as Record<Mat, THREE.MeshStandardMaterial>;

  for (const [mat, s] of Object.entries(SPECS) as [Mat, Spec][]) {
    let m = s.surface ? maps.get(s.surface) : neutral;
    if (!m && s.surface) {
      m = surfaceMaps(s.surface, quality === "high" ? anisotropy : Math.min(anisotropy, 4));
      maps.set(s.surface, m);
      textures.push(m.alb, m.dat);
    }
    const clear = s.clear !== undefined;
    const material = new THREE.MeshStandardMaterial({
      color: s.color,
      roughness: s.roughness,
      metalness: s.metalness ?? 0,
      envMapIntensity: s.env ?? 0.4,
      emissive: s.emissive ?? "#000000",
      transparent: clear,
      premultipliedAlpha: clear,
      depthWrite: !clear || mat === "water",
    });
    const uniforms = {
      uAlb: { value: m!.alb },
      uDat: { value: m!.dat },
      uSurf: { value: new THREE.Vector4(1 / (s.tile ?? 1), s.surface ? (s.normal ?? 1) : 0, s.surface ? (s.albedo ?? 1) : 0, s.local ? 1 : 0) },
      uSurf2: { value: new THREE.Vector4(s.surface ? (s.rough ?? 0) : 0, s.bevel ?? 0, s.ground ?? 0, s.clear ?? 1) },
    };
    patch(material, uniforms, clear);
    mats[mat] = material;
  }

  return {
    mats,
    dispose: () => {
      Object.values(mats).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
