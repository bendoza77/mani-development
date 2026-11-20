"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { HouseModel } from "./HouseModel";
import { HOUSE_STAGES, STAGE_COUNT } from "./stages";

export type HouseSceneProps = {
  /** Target stage, 1…STAGE_COUNT. The model animates from wherever it is toward this stage. */
  stage: number;
  /** Changing this restarts the build from an empty site ("Build again"). */
  replayToken: number;
  /** Build progress on first render (0 = empty plot). Defaults to `stage`, i.e. already built. */
  initialProgress?: number;
  /** Stage whose camera framing is used. Defaults to `stage`, so the camera follows the build. */
  cameraStage?: number;
  /** Multiplies the camera distance; above 1 pulls back so the whole plot fits with room around it. */
  distanceScale?: number;
  /** False when offscreen or the tab is hidden: the render loop stops entirely. */
  active: boolean;
  reducedMotion: boolean;
  onReady: () => void;
  onError: (reason: string) => void;
};

const TARGET_X = 0;
const TARGET_Z = 0.8;
const BASE_DISTANCE = 44;
const MAX_DRAG = 1.3;
const damp = THREE.MathUtils.damp;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Pulls the camera back on narrower viewports so the plot stays in frame. */
const fitFactor = (aspect: number) => (aspect >= 1.6 ? 1 : Math.pow(1.6 / aspect, 0.8));

type Ref<T> = { current: T };

/**
 * Owns build progress. Every stage change starts one tween from the *current* progress, so
 * rapid clicks simply retarget it: animations never stack and the model is always consistent.
 */
function ProgressDriver({ progressRef, stage, replayToken, reducedMotion }: { progressRef: Ref<number>; stage: number; replayToken: number; reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const tween = useRef({ from: stage, to: stage, start: -1, dur: 0 });
  const lastReplay = useRef(replayToken);
  const setDpr = useThree((s) => s.setDpr);
  const perf = useRef({ frames: 0, time: 0, done: false });

  useEffect(() => {
    if (replayToken !== lastReplay.current) {
      lastReplay.current = replayToken;
      progressRef.current = 0;
    }
    const from = progressRef.current;
    const span = Math.abs(stage - from);
    tween.current = { from, to: stage, start: -1, dur: reducedMotion ? 0 : Math.min(0.8 + 0.38 * span, 2.4) };
    invalidate();
  }, [stage, replayToken, reducedMotion, progressRef, invalidate]);

  useFrame((state, delta) => {
    const tw = tween.current;
    if (progressRef.current === tw.to) return;
    const t = state.clock.elapsedTime;
    if (tw.start < 0) tw.start = t;
    const k = tw.dur > 0 ? Math.min((t - tw.start) / tw.dur, 1) : 1;
    progressRef.current = k >= 1 ? tw.to : tw.from + (tw.to - tw.from) * easeInOut(k);
    if (k < 1) invalidate();
    // Adaptive resolution: builds are the only stretches of continuous frames, so measure there.
    // If the GPU cannot hold ~40 fps at this pixel ratio, render at 1x for the rest of the visit.
    const m = perf.current;
    if (!m.done && k > 0 && k < 1) {
      m.frames++;
      m.time += delta;
      if (m.frames >= 60) {
        m.done = true;
        if (m.time / m.frames > 1 / 40) setDpr(1);
      }
    }
  });
  return null;
}

/** Eases the camera toward the stage's framing; horizontal drag adds a clamped orbit. */
function CameraRig({ stage, distanceScale, reducedMotion, onReady }: { stage: number; distanceScale: number; reducedMotion: boolean; onReady: () => void }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const dom = useThree((s) => s.gl.domElement);
  const [az0, el0, ty0, z0] = HOUSE_STAGES[stage - 1].pose;
  const pose = useRef({ az: az0, el: el0, ty: ty0, r: BASE_DISTANCE * z0 * distanceScale * fitFactor(size.width / size.height) });
  const drag = useRef(0);
  const ready = useRef(false);

  useEffect(() => invalidate(), [stage, distanceScale, size.width, size.height, invalidate]);

  // Horizontal drag orbits the model; touch-action: pan-y on the canvas keeps vertical page scroll native.
  useEffect(() => {
    let startX: number | null = null;
    let base = 0;
    const down = (e: PointerEvent) => {
      startX = e.clientX;
      base = drag.current;
    };
    const move = (e: PointerEvent) => {
      if (startX === null) return;
      drag.current = THREE.MathUtils.clamp(base - ((e.clientX - startX) / dom.clientWidth) * 2.6, -MAX_DRAG, MAX_DRAG);
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
    if (!ready.current) {
      ready.current = true;
      onReady();
    }
    const dt = Math.min(rawDelta, 1 / 20); // demand frames can arrive after long idle gaps
    const [az, el, ty, zoom] = HOUSE_STAGES[stage - 1].pose;
    const goal = { az: az + drag.current, el, ty, r: BASE_DISTANCE * zoom * distanceScale * fitFactor(size.width / size.height) };
    const q = pose.current;
    const rate = reducedMotion ? 1000 : 2.2;
    q.az = damp(q.az, goal.az, rate, dt);
    q.el = damp(q.el, goal.el, rate, dt);
    q.ty = damp(q.ty, goal.ty, rate, dt);
    q.r = damp(q.r, goal.r, rate, dt);
    camera.position.set(
      TARGET_X + q.r * Math.cos(q.el) * Math.sin(q.az),
      q.ty + q.r * Math.sin(q.el),
      TARGET_Z + q.r * Math.cos(q.el) * Math.cos(q.az),
    );
    camera.lookAt(TARGET_X, q.ty, TARGET_Z);
    const moving = Math.abs(q.az - goal.az) > 5e-4 || Math.abs(q.el - goal.el) > 5e-4 || Math.abs(q.ty - goal.ty) > 2e-3 || Math.abs(q.r - goal.r) > 1e-2;
    if (moving) invalidate();
  });
  return null;
}

/** Requests a frame when the scene becomes active again, and reports a lost WebGL context. */
function Lifecycle({ active, onError }: { active: boolean; onError: (reason: string) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const dom = useThree((s) => s.gl.domElement);
  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  useEffect(() => {
    const lost = (e: Event) => {
      e.preventDefault();
      onError("context-lost");
    };
    dom.addEventListener("webglcontextlost", lost);
    return () => dom.removeEventListener("webglcontextlost", lost);
  }, [dom, onError]);
  return null;
}

function Lights({ mobile }: { mobile: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const cam = sun.current?.shadow.camera;
    if (!cam) return;
    Object.assign(cam, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 80 });
    cam.updateProjectionMatrix();
  }, []);
  return (
    <>
      <hemisphereLight args={["#fff6ea", "#a79a86", 0.6]} />
      {/* Late-afternoon sun from the front left: the street facade is lit, shadows fall behind the house. */}
      <directionalLight
        ref={sun}
        position={[-18, 22, 16]}
        intensity={3.0}
        color="#ffeedb"
        castShadow
        shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      {/* Cool fill from the opposite side keeps shaded facades legible. */}
      <directionalLight position={[16, 8, -6]} intensity={0.4} color="#dce6f2" />
      {/* Procedural studio environment for glass, metal and water reflections: rendered once, no HDRI download. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.6} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
        <Lightformer form="rect" intensity={1.3} color="#ffe6cc" position={[-14, 4, 10]} rotation-y={Math.PI / 3} scale={[16, 6, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#dbe6f3" position={[14, 3, -8]} rotation-y={-Math.PI / 2} scale={[14, 5, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#e8eff6" position={[6, 5, 22]} rotation-y={Math.PI} scale={[36, 8, 1]} />
      </Environment>
    </>
  );
}

const clampStage = (n: number) => Math.min(Math.max(Math.round(n), 1), STAGE_COUNT);

export default function HouseScene({ stage, replayToken, initialProgress, cameraStage, distanceScale = 1, active, reducedMotion, onReady, onError }: HouseSceneProps) {
  const safeStage = clampStage(stage);
  const progressRef = useRef(initialProgress ?? safeStage);
  // Client-only module (loaded with ssr:false), so window is available during the first render.
  const [mobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));

  return (
    <Canvas
      frameloop={active ? "demand" : "never"}
      dpr={dpr}
      shadows="percentage"
      camera={{ fov: 26, near: 1, far: 200, position: [30, 22, 30] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.shadowMap.autoUpdate = false; // HouseModel requests a shadow pass only when geometry moves
        gl.shadowMap.needsUpdate = true;
      }}
      aria-hidden
      style={{ touchAction: "pan-y", cursor: "grab" }}
    >
      <Lifecycle active={active} onError={onError} />
      <Lights mobile={mobile} />
      {/* Order matters: frame callbacks run in mount order, so progress is advanced before the model reads it. */}
      <ProgressDriver progressRef={progressRef} stage={safeStage} replayToken={replayToken} reducedMotion={reducedMotion} />
      <HouseModel progressRef={progressRef} />
      <CameraRig stage={clampStage(cameraStage ?? safeStage)} distanceScale={distanceScale} reducedMotion={reducedMotion} onReady={onReady} />
    </Canvas>
  );
}
