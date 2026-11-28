"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PARTS, PLINTH, MAIN, WING, type Mat, type Motion, type Part, type Shape } from "./model";
import { makeMaterials } from "./materials";

// ── Easing ────────────────────────────────────────────────────────────────────
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/** Materials that never cast shadows: flat ground layers, see-through or thin surfaces. */
const NO_CAST = new Set<Mat>(["soil", "trench", "lawn", "water", "paving", "glass", "membrane", "backing", "gravel", "line", "interior", "floorIn"]);

const MOTION_CODE: Record<Motion, number> = { grow: 0, rise: 1, drop: 2, pop: 3, spread: 4 };
const ALL_SOFT = 63;

/** Deterministic 0–1 hash. */
const hash = (n: number) => {
  const s = Math.sin(n * 91.7 + 47.3) * 43758.5453;
  return s - Math.floor(s);
};

/** Parts grouped by material + shape (one instanced draw each), with per-part rotations precomputed. */
type Group = { key: string; mat: Mat; shape: Shape; parts: Part[]; quats: THREE.Quaternion[]; ups: THREE.Vector3[]; pads: THREE.Vector3[]; tinted: boolean; covered?: number[] };

/**
 * Boxes that continue into a coplanar neighbour are grown 2 mm along that axis, so the shared seam
 * overlaps instead of leaving a hairline crack where two instances' edges round differently. The
 * overlap is coplanar, same material and world-projected texture, so it shades identically.
 */
const SEAM_PAD = 0.002;
const padOf = (p: Part) => {
  const s = p.shape === "box" ? (p.soft ?? 0) : 0;
  const on = (axis: number) => ((s >> (2 * axis)) & 3 ? SEAM_PAD : 0);
  return new THREE.Vector3(on(0), on(1), on(2));
};

const GROUPS: Group[] = (() => {
  const map = new Map<string, Group>();
  const euler = new THREE.Euler();
  const yaw = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  PARTS.forEach((p, i) => {
    const key = `${p.mat}:${p.shape}`;
    let g = map.get(key);
    if (!g) map.set(key, (g = { key, mat: p.mat, shape: p.shape, parts: [], quats: [], ups: [], pads: [], tinted: false }));
    const q = new THREE.Quaternion().setFromEuler(euler.set(p.rx, 0, p.rz, "XYZ"));
    // Foliage masses and trunks share one mesh each: turn every copy so no two look alike.
    if (p.shape === "leaf" || p.shape === "trunk") q.multiply(yaw.setFromAxisAngle(Y, hash(i) * Math.PI * 2));
    g.parts.push(p);
    g.quats.push(q);
    g.ups.push(new THREE.Vector3(0, 1, 0).applyQuaternion(q));
    g.pads.push(padOf(p));
    if (p.shape === "box" && p.coveredBy) (g.covered ??= []).push(g.parts.length - 1);
    if (p.tone !== undefined) g.tinted = true;
  });
  return [...map.values()];
})();

const PART_INDEX = new Map(PARTS.map((p, i) => [p, i]));

const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _m = new THREE.Matrix4();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** Writes all instance matrices of a group for progress p. Returns whether any instance is visible. */
function writeGroup(g: Group, mesh: THREE.InstancedMesh, p: number) {
  let any = false;
  for (let i = 0; i < g.parts.length; i++) {
    const part = g.parts[i];
    const vin = clamp01((p - part.t0) / part.dur);
    const vout = part.out === undefined ? 0 : clamp01((p - part.out) / (part.outDur ?? 0.2));
    const v = Math.min(vin, 1 - vout);
    if (v <= 0) {
      mesh.setMatrixAt(i, HIDDEN);
      continue;
    }
    any = true;
    const { w, h, d } = part;
    const up = g.ups[i];
    _pos.set(part.x, part.y, part.z);
    switch (MOTION_CODE[part.motion]) {
      case 0:
      case 1: {
        const e = Math.max(part.motion === "rise" ? v : easeOut(v), 1e-4);
        _scale.set(w, h * e, d);
        _pos.addScaledVector(up, (-h + h * e) / 2);
        break;
      }
      case 2: {
        const e = easeOut(v);
        const k = 0.96 + 0.04 * e;
        _scale.set(w * k, h, d * k);
        _pos.y += (1 - e) * 1.2;
        break;
      }
      case 3: {
        // Overshoot on the way in only; removal shrinks without bounce.
        const e = Math.max(vout > 0 ? easeOut(v) : easeBack(v), 1e-4);
        _scale.set(w * e, h * e, d * e);
        _pos.addScaledVector(up, (-h + h * e) / 2);
        break;
      }
      default: {
        const e = Math.max(easeOut(v), 1e-4);
        _scale.set(w * e, h, d * e);
      }
    }
    mesh.setMatrixAt(i, _m.compose(_pos, g.quats[i], _scale.add(g.pads[i])));
  }
  mesh.instanceMatrix.needsUpdate = true;
  return any;
}

// ── Geometry ──────────────────────────────────────────────────────────────────
/** Smooth 3D value noise for the foliage masses. */
function noise3(x: number, y: number, z: number) {
  const h = (i: number, j: number, k: number) => hash(i * 157 + j * 113 + k * 37);
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const s = (t: number) => t * t * (3 - 2 * t);
  const tx = s(x - xi), ty = s(y - yi), tz = s(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), tx), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), tx), ty),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), tx), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), tx), ty),
    tz,
  );
}

/** A lumpy foliage mass: a sphere pushed in and out by two octaves of noise, flatter underneath. */
function makeLeaf(detail: number) {
  const base = new THREE.IcosahedronGeometry(0.5, detail);
  base.deleteAttribute("normal");
  base.deleteAttribute("uv");
  const g = mergeVertices(base);
  base.dispose();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = noise3(v.x * 2.4 + 5, v.y * 2.4 + 5, v.z * 2.4 + 5) * 0.7 + noise3(v.x * 6 + 9, v.y * 6 + 9, v.z * 6 + 9) * 0.3;
    const r = 0.5 * (0.84 + 0.3 * n);
    v.multiplyScalar(r);
    if (v.y < 0) v.y *= 0.82;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function makeGeometries(mobile: boolean) {
  const tri = new THREE.Shape([new THREE.Vector2(-0.5, -0.5), new THREE.Vector2(0.5, -0.5), new THREE.Vector2(0, 0.5)]);
  const prism = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false });
  prism.translate(0, 0, -0.5);
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    prism,
    tube: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    trunk: new THREE.CylinderGeometry(0.33, 0.5, 1, 12),
    leaf: makeLeaf(mobile ? 2 : 3),
  } satisfies Record<Shape, THREE.BufferGeometry>;
}

/**
 * Each group gets its own copy of its shape so it can carry per-instance data for the shader:
 * which box sides are soft (see markSoftEdges) and a seed that offsets the texture per part.
 */
function groupGeometry(g: Group, base: THREE.BufferGeometry) {
  const geo = base.clone();
  const data = new Float32Array(g.parts.length * 2);
  g.parts.forEach((p, i) => {
    data[i * 2] = p.shape === "box" ? (p.soft ?? 0) : ALL_SOFT;
    data[i * 2 + 1] = PART_INDEX.get(p)! + 1;
  });
  geo.setAttribute("aPart", new THREE.InstancedBufferAttribute(data, 2));
  return geo;
}

/** Fully built (and not yet removed) at progress p. */
const built = (part: Part, p: number) => p >= part.t0 + part.dur && (part.out === undefined || p < part.out);

/**
 * Updates the "covered faces" bits (6–11) of aPart for progress p: a face is skipped only while
 * every neighbour covering it is fully built, so growing walls never look hollow.
 */
function writeCovered(g: Group, geo: THREE.BufferGeometry, p: number) {
  if (!g.covered) return;
  const attr = geo.getAttribute("aPart") as THREE.InstancedBufferAttribute;
  const data = attr.array as Float32Array;
  let changed = false;
  for (const i of g.covered) {
    const part = g.parts[i];
    let hidden = 0;
    if (built(part, p) || p >= part.t0) for (const { bit, by } of part.coveredBy!) if (by.every((n) => built(n, p))) hidden |= 1 << bit;
    const v = (part.soft ?? 0) + hidden * 64;
    if (data[i * 2] !== v) {
      data[i * 2] = v;
      changed = true;
    }
  }
  if (changed) attr.needsUpdate = true;
}

// ── Ground occlusion decals ──────────────────────────────────────────────────
// Soft darkening where the house and garden meet the ground, painted once into small canvases.
// Two layers so each appears with what casts it: the building from the slab pour, planting at the end.
const AO_PX = 20; // pixels per metre

function aoCanvas(draw: (rect: (x0: number, x1: number, z0: number, z1: number, blur: number, alpha: number) => void, blob: (x: number, z: number, r: number, alpha: number) => void) => void) {
  const w = PLINTH.x1 - PLINTH.x0, d = PLINTH.z1 - PLINTH.z0;
  const c = document.createElement("canvas");
  c.width = Math.round(w * AO_PX);
  c.height = Math.round(d * AO_PX);
  const g = c.getContext("2d")!;
  const px = (x: number) => (x - PLINTH.x0) * AO_PX;
  const pz = (z: number) => (z - PLINTH.z0) * AO_PX;
  // Intensity in the colour channels (alphaMap reads green): white occlusion on black.
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  // shadowBlur works in every browser (canvas `filter` does not): draw off-canvas, keep the shadow.
  const OFF = 10000;
  g.shadowOffsetX = OFF;
  draw(
    (x0, x1, z0, z1, blur, alpha) => {
      g.shadowBlur = blur * AO_PX;
      g.shadowColor = `rgba(255,255,255,${alpha})`;
      g.fillStyle = "#000";
      g.fillRect(px(x0) - OFF, pz(z0), (x1 - x0) * AO_PX, (z1 - z0) * AO_PX);
    },
    (x, z, r, alpha) => {
      const grd = g.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), r * AO_PX);
      grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.shadowColor = "transparent";
      g.fillStyle = grd;
      g.fillRect(px(x - r), pz(z - r), 2 * r * AO_PX, 2 * r * AO_PX);
    },
  );
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const buildingAO = () =>
  aoCanvas((rect) => {
    rect(MAIN.x0, MAIN.x1, MAIN.z0, MAIN.z1, 0.9, 0.55);
    rect(WING.x0, WING.x1, WING.z0, WING.z1, 0.9, 0.55);
    rect(MAIN.x0 - 0.3, MAIN.x1 + 0.25, MAIN.z1, MAIN.z1 + 2.76, 0.35, 0.3); // terrace and step
    rect(WING.x0, WING.x1, WING.z1, MAIN.z1 + 0.4, 0.35, 0.3); // deck
  });

const gardenAO = () =>
  aoCanvas((rect, blob) => {
    // Tree crowns shade a wide soft disc; shrubs and hedges a tighter one.
    for (const p of PARTS) {
      if (p.mat === "trunk" && p.shape === "trunk") blob(p.x, p.z, 2.4 * (p.w / 0.28), 0.32);
      if (p.mat === "shrub") blob(p.x, p.z, p.w * 0.75, 0.38);
      if (p.mat === "hedge") rect(p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2, 0.45, 0.4);
    }
  });

const PW = PLINTH.x1 - PLINTH.x0;
const PD = PLINTH.z1 - PLINTH.z0;
const PCX = (PLINTH.x0 + PLINTH.x1) / 2;
const PCZ = (PLINTH.z0 + PLINTH.z1) / 2;

/** When each ground-occlusion layer fades in (progress units): with the slab, and with the planting. */
const AO_FADE = { building: [1.45, 1.75], garden: [7.5, 7.8] } as const;

type BuildProgress = { current: { readonly p: number } };

/**
 * The house on its presentation plinth. Reads build progress every frame and only touches GPU
 * buffers (and requests a shadow pass) while that progress is actually changing.
 */
export function HouseModel({ buildRef, mobile }: { buildRef: BuildProgress; mobile: boolean }) {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const resources = useMemo(() => {
    const geos = makeGeometries(mobile);
    return {
      geos,
      groupGeos: GROUPS.map((g) => groupGeometry(g, geos[g.shape])),
      materials: makeMaterials(anisotropy, mobile ? "low" : "high"),
      plinth: new THREE.MeshStandardMaterial({ color: "#c7c0b4", roughness: 0.94, envMapIntensity: 0.35 }),
      plinthEdge: new THREE.MeshStandardMaterial({ color: "#a59d91", roughness: 0.94, envMapIntensity: 0.3 }),
      shadow: makeGroundShadow(),
      aoBuilding: buildingAO(),
      aoGarden: gardenAO(),
    };
  }, [anisotropy, mobile]);
  useEffect(
    () => () => {
      Object.values(resources.geos).forEach((g) => g.dispose());
      resources.groupGeos.forEach((g) => g.dispose());
      resources.materials.dispose();
      resources.plinth.dispose();
      resources.plinthEdge.dispose();
      resources.shadow.dispose();
      resources.aoBuilding.dispose();
      resources.aoGarden.dispose();
    },
    [resources],
  );

  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const aoMats = useRef<{ building: THREE.MeshBasicMaterial | null; garden: THREE.MeshBasicMaterial | null }>({ building: null, garden: null });
  const last = useRef(Number.NaN);

  useFrame((state) => {
    const p = buildRef.current.p;
    if (p === last.current) return;
    last.current = p;
    GROUPS.forEach((g, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = writeGroup(g, mesh, p);
      writeCovered(g, resources.groupGeos[i], p);
    });
    for (const key of ["building", "garden"] as const) {
      const m = aoMats.current[key];
      const [a, b] = AO_FADE[key];
      if (m) {
        m.opacity = clamp01((p - a) / (b - a));
        m.visible = m.opacity > 0;
      }
    }
    // Shadow maps are rendered on demand only (autoUpdate is off in the scene).
    state.gl.shadowMap.needsUpdate = true;
  });

  const { geos, groupGeos, materials } = resources;
  return (
    <group>
      {/* Stone presentation plinth with a recessed base course and a soft contact shadow. */}
      <mesh position={[PCX, -PLINTH.h / 2 + 0.05, PCZ]} scale={[PW, PLINTH.h - 0.1, PD]} geometry={geos.box} material={resources.plinth} receiveShadow />
      <mesh position={[PCX, -PLINTH.h + 0.05, PCZ]} scale={[PW - 0.4, 0.1, PD - 0.4]} geometry={geos.box} material={resources.plinthEdge} />
      <mesh position={[PCX, -PLINTH.h - 0.01, PCZ + 0.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[PW * 1.5, PD * 1.6]} />
        <meshBasicMaterial map={resources.shadow} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Ground occlusion, just above the lawn; anything standing on it hides it by depth. */}
      {(["building", "garden"] as const).map((key, i) => (
        <mesh key={key} position={[PCX, 0.043 + i * 0.001, PCZ]} rotation-x={-Math.PI / 2} renderOrder={1}>
          <planeGeometry args={[PW, PD]} />
          <meshBasicMaterial
            ref={(m) => {
              aoMats.current[key] = m;
            }}
            color="#000"
            alphaMap={key === "building" ? resources.aoBuilding : resources.aoGarden}
            transparent
            opacity={0}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {GROUPS.map((g, i) => (
        <instancedMesh
          key={g.key}
          ref={(m) => {
            meshes.current[i] = m;
            // Natural materials get a subtle per-instance brightness variation, set before first render.
            if (m && g.tinted && !m.instanceColor) {
              const c = new THREE.Color();
              g.parts.forEach((part, k) => m.setColorAt(k, c.setScalar(0.9 + 0.2 * (part.tone ?? 0.5))));
            }
          }}
          args={[groupGeos[i], materials.mats[g.mat], g.parts.length]}
          castShadow={!NO_CAST.has(g.mat)}
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

/** Soft contact shadow under the plinth, drawn once to a small canvas (no texture download). */
function makeGroundShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.42)");
  grd.addColorStop(0.55, "rgba(0,0,0,0.16)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
