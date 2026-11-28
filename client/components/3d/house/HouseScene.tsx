"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { HouseModel } from "./HouseModel";
import { HOUSE_STAGES, STAGE_COUNT, STAGE_SECONDS, stageAt, type BuildState } from "./stages";

export type HouseSceneProps = {
  /** Shared build progress: the scene advances it while `playing` and renders whatever it holds. */
  buildRef: { current: BuildState };
  /** Called on every frame in which progress changed (keep it cheap: no React state per call). */
  onProgress: (p: number) => void;
  /** Stage whose camera framing is used. Omit to have the camera follow the build. */
  cameraStage?: number;
  /** Changing this eases the view back to the standard framing (rotation and zoom). */
  viewResetToken?: number;
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
const damp = THREE.MathUtils.damp;
const TAU = Math.PI * 2;

// ── Free orbit tuning ─────────────────────────────────────────────────────────
/** Radians turned by dragging across the full canvas width (same scale on both axes). */
const TURN_PER_WIDTH = Math.PI * 1.15;
/** How tightly the view follows the pointer (1/s). Smooths input jitter with ~45 ms of lag. */
const FOLLOW_RATE = 22;
/** Coasting decay after a flick (1/s): higher stops sooner. */
const FRICTION = 3.2;
/** Fastest flick spin, rad/s. */
const MAX_SPIN = 12;
/** Pointer samples newer than this (ms) give the release velocity. */
const VELOCITY_WINDOW = 80;
/** Zoom limits as multiples of the standard distance: close enough for details, never inside the house. */
const ZOOM_MIN = 0.42;
const ZOOM_MAX = 1.5;

/** Pulls the camera back on narrower viewports so the plot stays in frame. */
const fitFactor = (aspect: number) => (aspect >= 1.6 ? 1 : Math.pow(1.6 / aspect, 0.8));

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Advances build progress. While playing it moves at a steady pace, slowing briefly through each
 * stage boundary so the stage change reads; an animated seek (stage navigation) eases toward its
 * target. The model is a pure function of progress, so seeking, pausing and replaying can never
 * leave parts half-placed or accumulate state.
 */
function ProgressDriver({ buildRef, onProgress, reducedMotion }: { buildRef: { current: BuildState }; onProgress: (p: number) => void; reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const reported = useRef(Number.NaN);

  useEffect(() => {
    const b = buildRef.current;
    b.invalidate = invalidate;
    invalidate();
    return () => {
      b.invalidate = () => {};
    };
  }, [buildRef, invalidate]);

  useFrame((_, rawDelta) => {
    const b = buildRef.current;
    const dt = Math.min(rawDelta, 1 / 20);
    let p = b.p;
    if (b.target !== null) {
      const goal = b.target;
      if (reducedMotion) p = goal;
      else {
        // Exponential approach with a minimum speed, so it lands instead of crawling.
        const step = Math.sign(goal - p) * Math.max(Math.abs(damp(p, goal, 4.5, dt) - p), 0.25 * dt);
        p = Math.abs(goal - p) <= Math.abs(step) ? goal : p + step;
      }
      if (p === goal) b.target = null;
    } else if (b.playing) {
      const f = p - Math.floor(p);
      const edge = Math.min(f, 1 - f);
      p = Math.min(STAGE_COUNT, p + (dt / STAGE_SECONDS) * (0.35 + 0.65 * smoothstep(0, 0.1, edge)));
      if (p >= STAGE_COUNT) b.playing = false;
    }
    b.p = p;
    if (p !== reported.current) {
      reported.current = p;
      onProgress(p);
    }
    if (b.playing || b.target !== null) invalidate();
  });
  return null;
}

/**
 * Adaptive resolution. Frames only run back to back while something moves (a build, a drag or a
 * coasting spin), so those stretches are measured. If the GPU cannot hold ~40 fps at this pixel
 * ratio, the rest of the visit renders at 1x.
 */
function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr);
  const perf = useRef({ frames: 0, time: 0, done: false });
  useFrame((_, delta) => {
    const m = perf.current;
    // A long delta is the first frame after an idle gap, not a measure of rendering speed.
    if (m.done || delta > 1 / 15) return;
    m.frames++;
    m.time += delta;
    if (m.frames >= 90) {
      m.done = true;
      if (m.time / m.frames > 1 / 40) setDpr(1);
    }
  });
  return null;
}

/** User rotation and zoom added on top of the stage framing. Angles in radians. */
type Orbit = {
  /** Where the pointer (or a coasting flick) wants the view. */
  yaw: number;
  pitch: number;
  /** What is on screen: eased toward yaw/pitch every frame. */
  shownYaw: number;
  shownPitch: number;
  /** Coasting speed after a flick, rad/s. */
  spinYaw: number;
  spinPitch: number;
  dragging: boolean;
  /** Total pitch currently on screen (stage + user), used to keep drags intuitive upside down. */
  viewPitch: number;
  /** Distance multiplier the visitor asked for, and the one on screen (eased). */
  zoom: number;
  shownZoom: number;
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const _qYaw = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _offset = new THREE.Vector3();
/** Nearest whole turn to `a`, so resets take the short way round. */
const nearestTurn = (a: number) => Math.round(a / TAU) * TAU;

type RigProps = { buildRef: { current: BuildState }; stage?: number; distanceScale: number; reducedMotion: boolean; viewResetToken: number; onReady: () => void };

/**
 * Camera around the house. It eases toward the stage's framing, and the visitor can turn it freely:
 * all the way round left/right and over the top and underneath, with no limits and no flipping at
 * the poles. Built as a turntable (yaw around the vertical axis, then pitch) from quaternions, so
 * the house never rolls sideways. A flick keeps the house spinning and slowing down.
 *
 * - Mouse/pen: drag in any direction; Ctrl/⌘ + wheel (or a trackpad pinch) zooms, while a plain
 *   wheel keeps scrolling the page. Double-click goes back to the standard view.
 * - Touch: one finger turns left/right (vertical swipes still scroll the page), two fingers turn
 *   in any direction and pinch to zoom. Double-tap goes back to the standard view.
 *
 * Only the camera moves. Lights and geometry stay put, so the shadow map is never re-rendered
 * while rotating: each frame is one plain scene pass.
 */
function CameraRig({ buildRef, stage, distanceScale, reducedMotion, viewResetToken, onReady }: RigProps) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const dom = useThree((s) => s.gl.domElement);
  const poseOf = (p: number) => HOUSE_STAGES[(stage ?? stageAt(p)) - 1].pose;
  // Starts exactly on the framing at the first frame (null until then).
  const pose = useRef<{ az: number; el: number; ty: number; r: number } | null>(null);
  const orbit = useRef<Orbit>({ yaw: 0, pitch: 0, shownYaw: 0, shownPitch: 0, spinYaw: 0, spinPitch: 0, dragging: false, viewPitch: 0, zoom: 1, shownZoom: 1 });
  const ready = useRef(false);
  const motionRef = useRef(reducedMotion);
  const resetRef = useRef(() => {});
  const firstReset = useRef(viewResetToken);

  useEffect(() => {
    motionRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => invalidate(), [stage, distanceScale, size.width, size.height, invalidate]);
  useEffect(() => {
    if (viewResetToken !== firstReset.current) resetRef.current();
  }, [viewResetToken]);

  // Development only: lets scripted visual checks drive the view and progress (window.__house).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const w = window as unknown as { __house?: object };
    // snap(): renders one frame synchronously and returns it as a PNG data URL.
    const snap = () => {
      advance(performance.now());
      return dom.toDataURL("image/png");
    };
    w.__house = { build: buildRef.current, orbit: orbit.current, camera, scene, invalidate, snap };
    return () => {
      delete w.__house;
    };
  }, [buildRef, camera, dom, invalidate, scene]);

  useEffect(() => {
    const o = orbit.current;
    const pointers = new Map<number, { x: number; y: number; touch: boolean }>();
    let last = { x: 0, y: 0 };
    let lastSpread = 0;
    let samples: { t: number; yaw: number; pitch: number }[] = [];
    // Upside down, a world-axis turntable would turn the "wrong" way: flip yaw for that drag.
    let yawSign = 1;

    const centroid = () => {
      let x = 0;
      let y = 0;
      for (const p of pointers.values()) {
        x += p.x;
        y += p.y;
      }
      return { x: x / pointers.size, y: y / pointers.size };
    };
    const spread = (c: { x: number; y: number }) => {
      let s = 0;
      for (const p of pointers.values()) s += Math.hypot(p.x - c.x, p.y - c.y);
      return s / pointers.size;
    };
    const zoomBy = (k: number) => {
      o.zoom = THREE.MathUtils.clamp(o.zoom * k, ZOOM_MIN, ZOOM_MAX);
    };
    // Called whenever the set of fingers changes, so the centroid and spread never jump.
    const restart = () => {
      last = centroid();
      lastSpread = pointers.size > 1 ? spread(last) : 0;
      samples = [];
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" });
      try {
        dom.setPointerCapture(e.pointerId); // keep receiving moves when the pointer leaves the canvas
      } catch {
        // The pointer was already released; the gesture simply ends on its own.
      }
      if (!o.dragging) {
        o.dragging = true;
        o.spinYaw = o.spinPitch = 0; // grabbing stops a coasting spin
        yawSign = Math.cos(o.viewPitch) < 0 ? -1 : 1;
        dom.style.cursor = "grabbing";
      }
      restart();
    };

    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      const c = centroid();
      const k = TURN_PER_WIDTH / Math.max(dom.clientWidth, 1);
      o.yaw -= (c.x - last.x) * k * yawSign;
      // One finger only turns sideways: vertical one-finger swipes belong to page scrolling.
      if (!p.touch || pointers.size > 1) o.pitch += (c.y - last.y) * k;
      // Two fingers: the change in their spread is a pinch zoom.
      if (pointers.size > 1) {
        const sp = spread(c);
        if (lastSpread > 0 && sp > 0) zoomBy(lastSpread / sp);
        lastSpread = sp;
      }
      last = c;
      samples.push({ t: e.timeStamp, yaw: o.yaw, pitch: o.pitch });
      while (samples.length > 2 && e.timeStamp - samples[0].t > VELOCITY_WINDOW) samples.shift();
      invalidate();
    };

    const end = (e: PointerEvent, fling: boolean) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size > 0) return restart();
      o.dragging = false;
      dom.style.cursor = "grab";
      const first = samples[0];
      const lastSample = samples[samples.length - 1];
      // A pause before letting go means "put it here", not "throw it".
      if (fling && !motionRef.current && first && lastSample && e.timeStamp - lastSample.t < 50) {
        const span = (lastSample.t - first.t) / 1000;
        if (span > 0.008) {
          o.spinYaw = THREE.MathUtils.clamp((lastSample.yaw - first.yaw) / span, -MAX_SPIN, MAX_SPIN);
          o.spinPitch = THREE.MathUtils.clamp((lastSample.pitch - first.pitch) / span, -MAX_SPIN, MAX_SPIN);
        }
      }
      samples = [];
      invalidate();
    };
    const up = (e: PointerEvent) => end(e, true);
    // The browser took the gesture (page scroll): stop without a fling.
    const cancel = (e: PointerEvent) => end(e, false);

    const reset = () => {
      o.spinYaw = o.spinPitch = 0;
      o.yaw = nearestTurn(o.shownYaw);
      o.pitch = nearestTurn(o.shownPitch);
      o.zoom = 1;
      invalidate();
    };
    resetRef.current = reset;

    // A plain wheel scrolls the page as usual; Ctrl/⌘ + wheel (also what a trackpad pinch sends) zooms.
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomBy(Math.exp(THREE.MathUtils.clamp(delta, -120, 120) * 0.0025));
      invalidate();
    };

    // touch-action: pan-y keeps one-finger vertical swipes as page scroll. A two-finger gesture is
    // a rotation or pinch, so the page must not scroll or zoom under it.
    const blockScroll = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    };

    dom.addEventListener("pointerdown", down);
    dom.addEventListener("pointermove", move);
    dom.addEventListener("pointerup", up);
    dom.addEventListener("pointercancel", cancel);
    dom.addEventListener("lostpointercapture", cancel);
    dom.addEventListener("dblclick", reset);
    dom.addEventListener("wheel", wheel, { passive: false });
    dom.addEventListener("touchstart", blockScroll, { passive: false });
    dom.addEventListener("touchmove", blockScroll, { passive: false });
    return () => {
      dom.removeEventListener("pointerdown", down);
      dom.removeEventListener("pointermove", move);
      dom.removeEventListener("pointerup", up);
      dom.removeEventListener("pointercancel", cancel);
      dom.removeEventListener("lostpointercapture", cancel);
      dom.removeEventListener("dblclick", reset);
      dom.removeEventListener("wheel", wheel);
      dom.removeEventListener("touchstart", blockScroll);
      dom.removeEventListener("touchmove", blockScroll);
    };
  }, [dom, invalidate]);

  useFrame((_, rawDelta) => {
    if (!ready.current) {
      ready.current = true;
      onReady();
    }
    // Frame-rate independent: identical motion at 60, 120 or 144 Hz. Demand frames can arrive
    // after long idle gaps, so cap the step.
    const dt = Math.min(rawDelta, 1 / 20);
    const [az, el, ty, zoom] = poseOf(buildRef.current.p);
    const goal = { az, el, ty, r: BASE_DISTANCE * zoom * distanceScale * fitFactor(size.width / size.height) };
    if (!pose.current) pose.current = { ...goal };
    const q = pose.current;
    const rate = reducedMotion ? 1000 : 2.2;
    q.az = damp(q.az, goal.az, rate, dt);
    q.el = damp(q.el, goal.el, rate, dt);
    q.ty = damp(q.ty, goal.ty, rate, dt);
    q.r = damp(q.r, goal.r, rate, dt);

    const o = orbit.current;
    if (!o.dragging && (o.spinYaw !== 0 || o.spinPitch !== 0)) {
      o.yaw += o.spinYaw * dt;
      o.pitch += o.spinPitch * dt;
      const decay = Math.exp(-FRICTION * dt);
      o.spinYaw = Math.abs(o.spinYaw) < 0.01 ? 0 : o.spinYaw * decay;
      o.spinPitch = Math.abs(o.spinPitch) < 0.01 ? 0 : o.spinPitch * decay;
    }
    const follow = reducedMotion ? 1000 : FOLLOW_RATE;
    o.shownYaw = damp(o.shownYaw, o.yaw, follow, dt);
    o.shownPitch = damp(o.shownPitch, o.pitch, follow, dt);
    o.shownZoom = Math.abs(o.shownZoom - o.zoom) < 1e-4 || reducedMotion ? o.zoom : damp(o.shownZoom, o.zoom, 9, dt);
    // Keep the angles small after many turns (float precision). Not mid-drag: the velocity
    // samples hold absolute angles.
    if (!o.dragging) {
      const wy = nearestTurn(o.shownYaw);
      const wp = nearestTurn(o.shownPitch);
      o.yaw -= wy;
      o.shownYaw -= wy;
      o.pitch -= wp;
      o.shownPitch -= wp;
    }

    // Turntable from quaternions: yaw around world Y, then pitch around the camera's own X axis.
    // Unlike lookAt with a fixed "up", this stays smooth straight over the top and underneath.
    const yaw = q.az + o.shownYaw;
    const pitch = q.el + o.shownPitch;
    o.viewPitch = pitch;
    _qYaw.setFromAxisAngle(Y_AXIS, yaw);
    _qPitch.setFromAxisAngle(X_AXIS, -pitch);
    camera.quaternion.multiplyQuaternions(_qYaw, _qPitch);
    _offset.set(0, 0, q.r * o.shownZoom).applyQuaternion(camera.quaternion);
    camera.position.set(TARGET_X + _offset.x, q.ty + _offset.y, TARGET_Z + _offset.z);

    const moving =
      Math.abs(q.az - goal.az) > 5e-4 ||
      Math.abs(q.el - goal.el) > 5e-4 ||
      Math.abs(q.ty - goal.ty) > 2e-3 ||
      Math.abs(q.r - goal.r) > 1e-2 ||
      Math.abs(o.shownYaw - o.yaw) > 1e-4 ||
      Math.abs(o.shownPitch - o.pitch) > 1e-4 ||
      o.shownZoom !== o.zoom ||
      o.spinYaw !== 0 ||
      o.spinPitch !== 0;
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

/** Sun direction: late morning from the front left, so the street facade is lit and shadows fall behind. */
const SUN: [number, number, number] = [-18, 24, 15];
const SUN_GLINT = new THREE.Vector3(...SUN).normalize().multiplyScalar(60).toArray();

/**
 * Sky dome for image-based light and reflections: blue zenith, bright hazy horizon, darker ground
 * below it. Rendered once into the environment map (no HDRI download), so glass and metal reflect
 * a believable sky instead of a studio box.
 */
function SkyDome() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 48, 24);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const zenith = new THREE.Color("#6f97c4").multiplyScalar(1.15);
    const horizon = new THREE.Color("#e8edf0").multiplyScalar(1.45);
    const ground = new THREE.Color("#8f8a74").multiplyScalar(0.55);
    const nadir = new THREE.Color("#4f4d42").multiplyScalar(0.35);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y >= 0) c.copy(horizon).lerp(zenith, Math.pow(y, 0.6));
      else c.copy(ground).lerp(nadir, Math.min(1, -y * 2));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} scale={80}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function Lights({ mobile }: { mobile: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const cam = sun.current?.shadow.camera;
    if (!cam) return;
    // Fitted to the plot (25 × 21 m plinth plus tree crowns) as seen from the sun.
    Object.assign(cam, { left: -17, right: 17, top: 16, bottom: -16, near: 8, far: 75 });
    cam.updateProjectionMatrix();
  }, []);
  return (
    <>
      <hemisphereLight args={["#e9eef5", "#8c8471", 0.55]} />
      <directionalLight
        ref={sun}
        position={SUN}
        intensity={3.1}
        color="#fff1df"
        castShadow
        shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
        shadow-radius={mobile ? 2 : 3.5}
      />
      {/* Weak cool bounce from the opposite side keeps shaded facades legible without flattening them. */}
      <directionalLight position={[16, 7, -10]} intensity={0.32} color="#dbe5f2" />
      <Environment resolution={mobile ? 128 : 256} frames={1}>
        <SkyDome />
        {/* The sun's glint for glass and metal, and a soft bright overcast panel overhead. */}
        <Lightformer form="circle" intensity={30} color="#fff3e0" position={SUN_GLINT} scale={5} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[60, 60, 1]} />
      </Environment>
    </>
  );
}

const clampStage = (n: number) => Math.min(Math.max(Math.round(n), 1), STAGE_COUNT);

export default function HouseScene({ buildRef, onProgress, cameraStage, viewResetToken = 0, distanceScale = 1, active, reducedMotion, onReady, onError }: HouseSceneProps) {
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
      <AdaptiveResolution />
      <Lights mobile={mobile} />
      {/* Order matters: frame callbacks run in mount order, so progress is advanced before the model reads it. */}
      <ProgressDriver buildRef={buildRef} onProgress={onProgress} reducedMotion={reducedMotion} />
      <HouseModel buildRef={buildRef} mobile={mobile} />
      <CameraRig
        buildRef={buildRef}
        stage={cameraStage === undefined ? undefined : clampStage(cameraStage)}
        distanceScale={distanceScale}
        reducedMotion={reducedMotion}
        viewResetToken={viewResetToken}
        onReady={onReady}
      />
    </Canvas>
  );
}
