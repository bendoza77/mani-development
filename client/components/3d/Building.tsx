"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CRANE, PARTS, PLINTH, type Motion, type PartKind } from "./buildingModel";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const MOTION_CODE: Record<Motion, number> = { grow: 0, drop: 1, pop: 2, spread: 3 };
const STRIDE = 9; // x y z w h d t0 dur motion

/** Parts grouped by material, packed into flat arrays once at module load. */
const GROUPS = (() => {
  const map = new Map<PartKind, number[]>();
  for (const p of PARTS) {
    const arr = map.get(p.kind) ?? [];
    arr.push(p.x, p.y, p.z, p.w, p.h, p.d, p.t0, p.dur, MOTION_CODE[p.motion]);
    map.set(p.kind, arr);
  }
  return [...map.entries()].map(([kind, data]) => ({ kind, data: Float32Array.from(data), count: data.length / STRIDE }));
})();

/** Writes every instance matrix for progress p directly into the buffer (translate + scale only). */
function writeMatrices(data: Float32Array, out: Float32Array, p: number) {
  const n = data.length / STRIDE;
  for (let i = 0; i < n; i++) {
    const s = i * STRIDE;
    const x = data[s], y = data[s + 1], z = data[s + 2];
    const w = data[s + 3], h = data[s + 4], d = data[s + 5];
    const local = clamp01((p - data[s + 6]) / data[s + 7]);
    const motion = data[s + 8];
    let sx = 0, sy = 0, sz = 0, cy = y;
    if (local > 0) {
      if (motion === 0) {
        const e = easeOut(local);
        sx = w; sz = d; sy = Math.max(h * e, 1e-4); cy = y + sy / 2;
      } else if (motion === 1) {
        const e = easeOut(local);
        const k = 0.92 + 0.08 * e;
        sx = w * k; sz = d * k; sy = h; cy = y + h / 2 + (1 - e) * 1.1;
      } else if (motion === 2) {
        const e = Math.max(easeBack(local), 1e-4);
        sx = w * e; sy = h * e; sz = d * e; cy = y + (h * e) / 2;
      } else {
        const e = Math.max(easeOut(local), 1e-4);
        sx = w * e; sz = d * e; sy = h; cy = y + h / 2;
      }
    }
    const o = i * 16;
    out[o] = sx; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
    out[o + 4] = 0; out[o + 5] = sy; out[o + 6] = 0; out[o + 7] = 0;
    out[o + 8] = 0; out[o + 9] = 0; out[o + 10] = sz; out[o + 11] = 0;
    out[o + 12] = x; out[o + 13] = cy; out[o + 14] = z; out[o + 15] = 1;
  }
}

function useMaterials() {
  const mats = useMemo(() => {
    // Matte surfaces take little image-based fill so the sun's shadows read; glass and water
    // take a lot, so they pick up the sky gradient instead of rendering as black voids.
    const std = (color: string, roughness: number, metalness = 0, envMapIntensity = 0.38) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity });
    const canopy = std("#ffffff", 0.86); // tinted per tree via instance colours
    canopy.flatShading = true; // faceted, like a hand-cut model tree
    return {
      concrete: std("#bdb6ab", 0.92),
      white: std("#f4f0e8", 0.8),
      glass: std("#5f7480", 0.14, 0.15, 2.4),
      timber: std("#b27a4b", 0.66),
      green: std("#8f9d7b", 0.95),
      paving: std("#e4ddd1", 0.9),
      water: std("#5d7c88", 0.05, 0.15, 2),
      canopy,
      trunk: std("#8c6b4b", 0.8),
      figure: std("#f6f3ee", 0.7),
      plinth: std("#d6cdbf", 0.96),
      plinthEdge: std("#c4baab", 0.96),
      crane: std("#ad4e28", 0.55, 0.1),
      dark: std("#3a3b3d", 0.6, 0.2),
    } satisfies Record<string, THREE.MeshStandardMaterial>;
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

function useGeometries() {
  const geos = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.IcosahedronGeometry(0.5, 1),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      figure: new THREE.CapsuleGeometry(0.5, 1.4, 3, 8).scale(1, 0.4, 1),
    }),
    [],
  );
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  return geos;
}

/** Soft radial contact shadow under the plinth, drawn once to a small canvas texture. */
function useGroundShadowTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grd.addColorStop(0, "rgba(20,18,15,0.32)");
    grd.addColorStop(0.5, "rgba(20,18,15,0.12)");
    grd.addColorStop(1, "rgba(20,18,15,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/**
 * Baked ambient occlusion: soft darkening where the blocks meet the plinth, drawn once to a
 * canvas in plan (plinth coordinates). Costs one textured quad instead of an SSAO pass.
 */
function useFootprintAOTexture() {
  const tex = useMemo(() => {
    const W = 512;
    const H = Math.round((W * PLINTH.d) / PLINTH.w);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    const sx = W / PLINTH.w;
    const sz = H / PLINTH.d;
    // Draw each footprint far off-canvas and let only its blurred shadow land in place
    // (shadowBlur works in every browser, unlike ctx.filter).
    const OFF = 4000;
    g.shadowOffsetX = OFF;
    g.shadowBlur = 22;
    g.shadowColor = "rgba(30,24,16,0.55)";
    for (const [x0, x1, z0, z1] of FOOTPRINTS) {
      g.fillRect((x0 + PLINTH.w / 2) * sx - OFF, (z0 + PLINTH.d / 2) * sz, (x1 - x0) * sx, (z1 - z0) * sz);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

// Raft outlines (x0, x1, z0, z1) of the three blocks, matching buildingModel.
const FOOTPRINTS: [number, number, number, number][] = [
  [-5.02, -0.58, -2.22, 2.2],
  [0.48, 5.52, -2.82, 1.02],
  [-0.82, 0.72, -1.62, 0.62],
];

// Per-tree canopy tones (sage, olive, moss), assigned by instance index.
const CANOPY_TONES = ["#93a47e", "#a2ac84", "#82966f", "#9aa883", "#8b9b74"].map((c) => new THREE.Color(c));

const NO_SHADOW_CAST = new Set<PartKind>(["paving", "water", "green"]);

export function Building({ progressRef }: { progressRef: RefObject<number> }) {
  const mats = useMaterials();
  const geos = useGeometries();
  const shadowTex = useGroundShadowTexture();
  const aoTex = useFootprintAOTexture();
  const aoMat = useRef<THREE.MeshBasicMaterial>(null);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const crane = useRef<THREE.Group>(null);
  const jib = useRef<THREE.Group>(null);
  const last = useRef(-1);

  useFrame((state) => {
    const p = progressRef.current ?? 0;
    // Geometry only changes while the build progresses; skip all work otherwise.
    if (Math.abs(p - last.current) > 1e-4) {
      last.current = p;
      GROUPS.forEach((g, i) => {
        const mesh = meshes.current[i];
        if (!mesh) return;
        writeMatrices(g.data, mesh.instanceMatrix.array as Float32Array, p);
        mesh.instanceMatrix.needsUpdate = true;
      });
      // Occlusion arrives with the structure (stage 2) rather than sitting on an empty site.
      if (aoMat.current) aoMat.current.opacity = clamp01((p - 1.1) / 1.4);
      if (crane.current) {
        const up = easeOut(clamp01((p - CRANE.in0) / (CRANE.in1 - CRANE.in0)));
        const down = easeOut(clamp01((p - CRANE.out0) / (CRANE.out1 - CRANE.out0)));
        const s = Math.max(up * (1 - down), 1e-4);
        crane.current.scale.set(1, s, 1);
        crane.current.visible = s > 0.002;
      }
      // Shadows are rendered on demand only (autoUpdate is off); flag this frame for a shadow pass.
      state.gl.shadowMap.needsUpdate = true;
    }
    // The jib slews slowly while the crane is on site.
    if (jib.current && crane.current?.visible) {
      jib.current.rotation.y = 0.9 + Math.sin(state.clock.elapsedTime * 0.25) * 0.55;
      state.gl.shadowMap.needsUpdate = true;
    }
  });

  const geoFor = (kind: PartKind) =>
    kind === "canopy" ? geos.sphere : kind === "trunk" ? geos.cylinder : kind === "figure" ? geos.figure : geos.box;

  return (
    <group>
      {/* Stone plinth with a darker chamfer course and a soft contact shadow */}
      <mesh position={[0, -PLINTH.h / 2 + 0.06, 0]} receiveShadow material={mats.plinth} geometry={geos.box} scale={[PLINTH.w, PLINTH.h - 0.12, PLINTH.d]} />
      <mesh position={[0, -PLINTH.h + 0.03, 0]} material={mats.plinthEdge} geometry={geos.box} scale={[PLINTH.w - 0.3, 0.12, PLINTH.d - 0.3]} />
      <mesh position={[0, -PLINTH.h - 0.02, 0.4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[PLINTH.w * 1.45, PLINTH.d * 1.7]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[PLINTH.w, PLINTH.d]} />
        <meshBasicMaterial ref={aoMat} map={aoTex} transparent opacity={0} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {GROUPS.map((g, i) => (
        <instancedMesh
          key={g.kind}
          ref={(m) => {
            meshes.current[i] = m;
            // Tint each tree once, before the first render compiles the instancing shader.
            if (m && g.kind === "canopy" && !m.instanceColor) {
              for (let k = 0; k < g.count; k++) m.setColorAt(k, CANOPY_TONES[k % CANOPY_TONES.length]);
            }
          }}
          args={[geoFor(g.kind), mats[g.kind], g.count]}
          castShadow={!NO_SHADOW_CAST.has(g.kind)}
          receiveShadow
          frustumCulled={false}
        />
      ))}

      {/* Tower crane (fired-clay accent), scaled in/out by build progress */}
      <group ref={crane} position={[CRANE.x, 0, CRANE.z]} visible={false}>
        <mesh material={mats.crane} geometry={geos.box} position={[0, CRANE.height / 2, 0]} scale={[0.2, CRANE.height, 0.2]} castShadow />
        <mesh material={mats.dark} geometry={geos.box} position={[0, 0.08, 0]} scale={[0.7, 0.16, 0.7]} castShadow />
        <group ref={jib} position={[0, CRANE.height, 0]}>
          <mesh material={mats.crane} geometry={geos.box} position={[2.4, 0.1, 0]} scale={[7.2, 0.16, 0.16]} castShadow />
          <mesh material={mats.dark} geometry={geos.box} position={[-1.05, -0.05, 0]} scale={[0.55, 0.38, 0.42]} castShadow />
          <mesh material={mats.dark} geometry={geos.box} position={[0.25, -0.1, 0]} scale={[0.32, 0.3, 0.3]} castShadow />
          <mesh material={mats.crane} geometry={geos.box} position={[0, 0.55, 0]} scale={[0.1, 0.9, 0.1]} />
          <mesh material={mats.dark} geometry={geos.box} position={[4.3, -1.2, 0]} scale={[0.015, 2.4, 0.015]} />
          <mesh material={mats.dark} geometry={geos.box} position={[4.3, -2.45, 0]} scale={[0.14, 0.14, 0.14]} castShadow />
        </group>
      </group>
    </group>
  );
}
