"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PARTS, PLINTH, type Mat, type Motion, type Part, type Shape } from "./model";

// ── Easing ────────────────────────────────────────────────────────────────────
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

// ── Materials: one palette, matte surfaces take little image-based light so shadows read ──
const PALETTE: Record<Mat, { color: string; roughness: number; metalness?: number; env?: number }> = {
  soil: { color: "#a58f72", roughness: 1 },
  concrete: { color: "#b3b0a8", roughness: 0.92 },
  rebar: { color: "#7a5a43", roughness: 0.55, metalness: 0.4 },
  block: { color: "#d3cab9", roughness: 0.95 },
  render: { color: "#f3f0ea", roughness: 0.86 },
  rafter: { color: "#c9a576", roughness: 0.72 },
  roof: { color: "#3b3e42", roughness: 0.42, metalness: 0.45, env: 0.7 },
  membrane: { color: "#55585b", roughness: 0.85 },
  frame: { color: "#2b2d30", roughness: 0.48, metalness: 0.25 },
  glass: { color: "#5e7684", roughness: 0.06, metalness: 0.2, env: 2.4 },
  sill: { color: "#dcd6cb", roughness: 0.8 },
  door: { color: "#6f4b31", roughness: 0.6 },
  cladding: { color: "#9b6b43", roughness: 0.68 },
  backing: { color: "#35302b", roughness: 0.9 },
  scaffold: { color: "#a3a8ad", roughness: 0.4, metalness: 0.6 },
  plank: { color: "#b89a6c", roughness: 0.85 },
  deck: { color: "#a4744b", roughness: 0.7 },
  lawn: { color: "#8c9c6c", roughness: 1 },
  paving: { color: "#ddd6ca", roughness: 0.9 },
  water: { color: "#4e8296", roughness: 0.04, metalness: 0.1, env: 2.2 },
  hedge: { color: "#6c8258", roughness: 1 },
  canopy: { color: "#8b9f6e", roughness: 0.95 },
  trunk: { color: "#7a5d45", roughness: 0.85 },
};

const NO_CAST = new Set<Mat>(["soil", "lawn", "water", "paving", "glass", "membrane", "deck", "backing"]);

const MOTION_CODE: Record<Motion, number> = { grow: 0, drop: 1, pop: 2, spread: 3 };

/** Parts grouped by material + shape, with per-part transforms precomputed once. */
type Group = {
  key: string;
  mat: Mat;
  shape: Shape;
  parts: Part[];
  quats: THREE.Quaternion[];
  ups: THREE.Vector3[];
  tinted: boolean;
};

const GROUPS: Group[] = (() => {
  const map = new Map<string, Group>();
  const euler = new THREE.Euler();
  for (const p of PARTS) {
    const key = `${p.mat}:${p.shape}`;
    let g = map.get(key);
    if (!g) {
      g = { key, mat: p.mat, shape: p.shape, parts: [], quats: [], ups: [], tinted: false };
      map.set(key, g);
    }
    const q = new THREE.Quaternion().setFromEuler(euler.set(p.rx, 0, p.rz, "XYZ"));
    g.parts.push(p);
    g.quats.push(q);
    g.ups.push(new THREE.Vector3(0, 1, 0).applyQuaternion(q));
    if (p.tone !== undefined) g.tinted = true;
  }
  return [...map.values()];
})();

export const PART_COUNT = PARTS.length;
export const DRAW_GROUPS = GROUPS.length;

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
      case 0: {
        const e = Math.max(easeOut(v), 1e-4);
        _scale.set(w, h * e, d);
        _pos.addScaledVector(up, (-h + h * e) / 2);
        break;
      }
      case 1: {
        const e = easeOut(v);
        const k = 0.94 + 0.06 * e;
        _scale.set(w * k, h, d * k);
        _pos.y += (1 - e) * 1.2;
        break;
      }
      case 2: {
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
    mesh.setMatrixAt(i, _m.compose(_pos, g.quats[i], _scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  return any;
}

function makeGeometries() {
  const tri = new THREE.Shape([new THREE.Vector2(-0.5, -0.5), new THREE.Vector2(0.5, -0.5), new THREE.Vector2(0, 0.5)]);
  const prism = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false });
  prism.translate(0, 0, -0.5);
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    prism,
    tube: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
    ico: new THREE.IcosahedronGeometry(0.5, 4),
  } satisfies Record<Shape, THREE.BufferGeometry>;
}

function makeMaterials() {
  const out = {} as Record<Mat, THREE.MeshStandardMaterial>;
  for (const [mat, s] of Object.entries(PALETTE) as [Mat, (typeof PALETTE)[Mat]][]) {
    out[mat] = new THREE.MeshStandardMaterial({
      color: s.color,
      roughness: s.roughness,
      metalness: s.metalness ?? 0,
      envMapIntensity: s.env ?? 0.35,
    });
  }
  return out;
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

const PW = PLINTH.x1 - PLINTH.x0;
const PD = PLINTH.z1 - PLINTH.z0;
const PCX = (PLINTH.x0 + PLINTH.x1) / 2;
const PCZ = (PLINTH.z0 + PLINTH.z1) / 2;

/**
 * The house on its presentation plinth. Reads build progress from a ref every frame and only
 * touches GPU buffers (and requests a shadow pass) while that progress is actually changing.
 */
export function HouseModel({ progressRef }: { progressRef: RefObject<number> }) {
  const resources = useMemo(
    () => ({
      geos: makeGeometries(),
      mats: makeMaterials(),
      plinth: new THREE.MeshStandardMaterial({ color: "#c4bdb1", roughness: 0.96, envMapIntensity: 0.3 }),
      plinthEdge: new THREE.MeshStandardMaterial({ color: "#a9a196", roughness: 0.96, envMapIntensity: 0.3 }),
      shadow: makeGroundShadow(),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(resources.geos).forEach((g) => g.dispose());
      Object.values(resources.mats).forEach((m) => m.dispose());
      resources.plinth.dispose();
      resources.plinthEdge.dispose();
      resources.shadow.dispose();
    },
    [resources],
  );

  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const last = useRef(Number.NaN);

  useFrame((state) => {
    const p = progressRef.current ?? 0;
    if (p === last.current) return;
    last.current = p;
    GROUPS.forEach((g, i) => {
      const mesh = meshes.current[i];
      if (mesh) mesh.visible = writeGroup(g, mesh, p);
    });
    // Shadow maps are rendered on demand only (autoUpdate is off in the scene).
    state.gl.shadowMap.needsUpdate = true;
  });

  const { geos, mats } = resources;
  return (
    <group>
      {/* Stone presentation plinth with a recessed base course and a soft contact shadow. */}
      <mesh position={[PCX, -PLINTH.h / 2 + 0.05, PCZ]} scale={[PW, PLINTH.h - 0.1, PD]} geometry={geos.box} material={resources.plinth} receiveShadow />
      <mesh position={[PCX, -PLINTH.h + 0.05, PCZ]} scale={[PW - 0.4, 0.1, PD - 0.4]} geometry={geos.box} material={resources.plinthEdge} />
      <mesh position={[PCX, -PLINTH.h - 0.01, PCZ + 0.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[PW * 1.5, PD * 1.6]} />
        <meshBasicMaterial map={resources.shadow} transparent depthWrite={false} toneMapped={false} />
      </mesh>

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
          args={[geos[g.shape], mats[g.mat], g.parts.length]}
          castShadow={!NO_CAST.has(g.mat)}
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
