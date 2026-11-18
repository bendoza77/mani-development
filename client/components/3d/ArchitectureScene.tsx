"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Building } from "./Building";

export type SceneVariant = "hero" | "process";

export type SceneProps = {
  variant: SceneVariant;
  /** Whether the canvas is on screen and the tab visible. Offscreen scenes stop rendering. */
  active: boolean;
  reducedMotion: boolean;
  /** process: target stage index 0–4. */
  stage?: number;
  /** hero: incrementing token restarts the build animation. */
  replay?: number;
  /** hero: notified when the build crosses into a new stage (0–4) or completes (5). */
  onStage?: (stage: number) => void;
  /** process: extra azimuth in radians from the rotate buttons (drag rotation is handled internally). */
  orbit?: number;
  onReady?: () => void;
};

type RefObjectLike<T> = { current: T };

const TARGET = new THREE.Vector3(0.2, 1.7, 0);
const HERO_BUILD_SECONDS = 5.2;

// Camera pose per construction stage in the process section: [azimuth, elevation, distance, targetY]
// Distances leave room for the stage HUD (title above, stage legend below) and the crane jib.
const STAGE_POSES: [number, number, number, number][] = [
  [0.62, 0.56, 43, 1.0],
  [0.95, 0.42, 42, 2.0],
  [0.32, 0.36, 41, 2.1],
  [-0.38, 0.32, 40, 2.0],
  [0.55, 0.46, 42, 1.7],
];

const damp = THREE.MathUtils.damp;

/** Distance multiplier so the plinth always fits, including portrait viewports. */
function fitFactor(aspect: number) {
  return aspect >= 1.25 ? 1 : Math.pow(1.25 / aspect, 0.85);
}

function HeroRig({ progressRef, reducedMotion, replay, onStage, onReady }: {
  progressRef: RefObjectLike<number>;
  reducedMotion: boolean;
  replay: number;
  onStage?: (s: number) => void;
  onReady?: () => void;
}) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const start = useRef<number | null>(null);
  const lastStage = useRef(-1);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const readyFired = useRef(false);
  const setDpr = useThree((s) => s.setDpr);
  const perf = useRef({ frames: 0, time: 0, checked: false });

  // Restart the construction sequence.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    start.current = null;
    lastStage.current = -1;
    progressRef.current = reducedMotion ? 5 : 0;
    invalidate();
  }, [replay, reducedMotion, progressRef, invalidate]);

  // Desktop-only pointer parallax, read from the window so the overlaid copy never blocks it.
  useEffect(() => {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
      invalidate(); // demand-driven: frames run only while the camera eases toward the pointer
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reducedMotion, invalidate]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
    let building = false;
    if (!reducedMotion) {
      if (start.current === null) start.current = t + 0.35;
      const k = THREE.MathUtils.clamp((t - start.current) / HERO_BUILD_SECONDS, 0, 1);
      // ease-in-out so the groundworks and landscaping get a little more time
      progressRef.current = 5 * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      building = k < 1;
      // Adaptive resolution: the build is the one stretch of continuous frames, so measure there.
      // If the GPU can't hold ~45 fps at this pixel ratio, drop to 1x for the rest of the session.
      const m = perf.current;
      if (building && !m.checked && t > start.current + 0.5) {
        m.frames++;
        m.time += delta;
        if (m.frames >= 90) {
          m.checked = true;
          if (m.time / m.frames > 1 / 45) setDpr(1);
        }
      }
    }
    const stage = Math.min(5, Math.floor(progressRef.current + 1e-6));
    if (stage !== lastStage.current) {
      lastStage.current = stage;
      onStage?.(stage);
    }

    const p = pointer.current;
    const dt = Math.min(delta, 1 / 20); // demand frames can arrive after long idle gaps
    p.x = damp(p.x, p.tx, 3, dt);
    p.y = damp(p.y, p.ty, 3, dt);
    // A slow camera move-in accompanies the build (cinematic, not decorative), then holds still.
    const k = reducedMotion || start.current === null ? 1 : THREE.MathUtils.clamp((t - start.current) / (HERO_BUILD_SECONDS + 0.8), 0, 1);
    const ease = 1 - Math.pow(1 - k, 3);
    const az = 0.68 + (1 - ease) * 0.22 + p.x * 0.12;
    const el = 0.42 + (1 - ease) * 0.05 - p.y * 0.045;
    const r = (37 + (1 - ease) * 3) * fitFactor(size.width / size.height);
    camera.position.set(
      TARGET.x + r * Math.cos(el) * Math.sin(az),
      TARGET.y + r * Math.sin(el),
      TARGET.z + r * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(TARGET);

    // Keep rendering only while something is still moving.
    // 0.002 of the parallax range is well under a pixel of camera movement.
    const easing = Math.abs(p.x - p.tx) > 0.002 || Math.abs(p.y - p.ty) > 0.002;
    if (building || k < 1 || easing) invalidate();
  });
  return null;
}

function ProcessRig({ progressRef, stage, orbit = 0, reducedMotion, onReady }: {
  progressRef: RefObjectLike<number>;
  stage: number;
  orbit?: number;
  reducedMotion: boolean;
  onReady?: () => void;
}) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const dom = useThree((s) => s.gl.domElement);
  const pose = useRef({ az: STAGE_POSES[0][0], el: STAGE_POSES[0][1], r: STAGE_POSES[0][2] * fitFactor(size.width / size.height), ty: STAGE_POSES[0][3] });
  const drag = useRef(0);
  const readyFired = useRef(false);

  // Demand-driven: kick a frame whenever the target changes; frames chain while settling.
  useEffect(() => invalidate(), [stage, orbit, invalidate]);

  // Horizontal drag orbits the model. touch-action: pan-y keeps vertical page scrolling native.
  useEffect(() => {
    let startX: number | null = null;
    let base = 0;
    const down = (e: PointerEvent) => {
      startX = e.clientX;
      base = drag.current;
    };
    const move = (e: PointerEvent) => {
      if (startX === null) return;
      drag.current = THREE.MathUtils.clamp(base + ((e.clientX - startX) / dom.clientWidth) * 2.4, -1.4, 1.4);
      invalidate();
    };
    const up = () => {
      startX = null;
    };
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dom, invalidate]);

  useFrame((_, rawDelta) => {
    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
    const delta = Math.min(rawDelta, 1 / 20);
    const target = stage + 1;
    const [az, el, r, ty] = STAGE_POSES[stage];
    const q = pose.current;
    const rate = reducedMotion ? 1000 : 2.4;
    progressRef.current = damp(progressRef.current, target, reducedMotion ? 1000 : 1.6, delta);
    q.az = damp(q.az, az + (orbit + drag.current), rate, delta);
    q.el = damp(q.el, el, rate, delta);
    q.r = damp(q.r, r * fitFactor(size.width / size.height), rate, delta);
    q.ty = damp(q.ty, ty, rate, delta);
    camera.position.set(
      TARGET.x + q.r * Math.cos(q.el) * Math.sin(q.az),
      q.ty + q.r * Math.sin(q.el),
      TARGET.z + q.r * Math.cos(q.el) * Math.cos(q.az),
    );
    camera.lookAt(TARGET.x, q.ty, TARGET.z);
    const settled =
      Math.abs(progressRef.current - target) < 0.002 &&
      Math.abs(q.az - (az + (orbit + drag.current))) < 0.0008 &&
      Math.abs(q.r - r * fitFactor(size.width / size.height)) < 0.01;
    if (settled) progressRef.current = target;
    else invalidate();
  });
  return null;
}

/** Requests a frame whenever the scene becomes active again (a frameloop switch alone doesn't draw). */
function ResumeKick({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  return null;
}

function Lights({ mobile }: { mobile: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const cam = sun.current?.shadow.camera;
    if (!cam) return;
    cam.left = -11;
    cam.right = 11;
    cam.top = 11;
    cam.bottom = -11;
    cam.near = 1;
    cam.far = 60;
    cam.updateProjectionMatrix();
  }, []);
  return (
    <>
      {/* Late-morning sun from the left: long shadows rake across the plinth toward the viewer. */}
      <hemisphereLight args={["#fff6ea", "#a99d8b", 0.55]} />
      <directionalLight
        ref={sun}
        position={[-13, 11.5, 7]}
        intensity={3.1}
        color="#ffeeda"
        castShadow
        shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={3}
      />
      {/* Cool bounce from the opposite side keeps shadowed facades legible. */}
      <directionalLight position={[12, 6, 4]} intensity={0.35} color="#dbe5f0" />
      {/* Procedural studio environment for glass and water reflections: rendered once, no HDRI download. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.6} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffe6cc" position={[-12, 3, 8]} rotation-y={Math.PI / 3} scale={[14, 5, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#dbe6f3" position={[12, 2, -6]} rotation-y={-Math.PI / 2} scale={[12, 4, 1]} />
        <Lightformer form="ring" intensity={0.6} position={[0, 4, -14]} scale={6} />
        {/* Sky gradient in front of the model: what the street-facing glazing reflects. */}
        <Lightformer form="rect" intensity={1.1} color="#e8eff6" position={[5, 4, 18]} rotation-y={Math.PI} scale={[30, 7, 1]} />
      </Environment>
    </>
  );
}

export default function ArchitectureScene({ variant, active, reducedMotion, stage = 0, replay = 0, onStage, orbit, onReady }: SceneProps) {
  const progressRef = useRef(variant === "hero" ? (reducedMotion ? 5 : 0) : 1);
  // Client-only module (loaded with ssr:false), so window is available during the first render.
  const [mobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  // Conservative device-pixel-ratio ceiling: crisp on retina without rendering 9x the pixels.
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));

  // Both scenes render on demand: the rigs request frames only while something moves.
  const frameloop = active ? "demand" : "never";

  return (
    <Canvas
      frameloop={frameloop}
      dpr={dpr}
      shadows="percentage"
      camera={{ fov: 24, near: 1, far: 140, position: [18, 14, 22] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.02;
        // Shadows are re-rendered only when geometry moves (see Building).
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = true;
      }}
      aria-hidden
      style={{ touchAction: "pan-y" }}
    >
      <ResumeKick active={active} />
      <Lights mobile={mobile} />
      <Building progressRef={progressRef} />
      {variant === "hero" ? (
        <HeroRig progressRef={progressRef} reducedMotion={reducedMotion} replay={replay} onStage={onStage} onReady={onReady} />
      ) : (
        <ProcessRig progressRef={progressRef} stage={stage} orbit={orbit} reducedMotion={reducedMotion} onReady={onReady} />
      )}
    </Canvas>
  );
}
