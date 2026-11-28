"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Focus, LoaderCircle, Pause, Play, RotateCcw, SkipBack } from "lucide-react";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";
import { HouseDrawing } from "./HouseDrawing";
import { STAGE_COUNT, stageAt, type BuildState } from "./stages";

// three.js + R3F live in their own chunk, fetched only when the viewer nears the viewport.
const HouseScene = dynamic(() => import("./HouseScene"), { ssr: false });

type Status = "idle" | "loading" | "ready" | "unsupported" | "error";

const pad = (n: number) => String(n).padStart(2, "0");

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Catches failures while loading or running the scene (chunk errors, shader compile errors). */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[house-3d]", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function IconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx("inline-grid size-9 shrink-0 place-items-center rounded-full transition-colors [&_svg]:size-4", className ?? "text-ink hover:bg-ink/8")}
    >
      {children}
    </button>
  );
}

/**
 * The homepage's 3D house. It builds itself automatically, stage by stage, from an empty plot to
 * the finished home, then rests on the completed house. A compact control bar plays, pauses and
 * restarts the build, scrubs through it (the track is a slider; arrow keys step a whole stage) and
 * resets the view. Visitors who prefer reduced motion see the finished house straight away. Until
 * the first WebGL frame, and permanently when 3D is unavailable, a line drawing is shown instead.
 */
export function HouseViewer({ className }: { className?: string }) {
  const { t } = useTranslation("house");
  const labels = t("stages", { returnObjects: true });
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState<Status>("idle");
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [docVisible, setDocVisible] = useState(true);
  const [attempt, setAttempt] = useState(0);
  // React only hears about whole-stage changes; per-frame progress goes straight to the DOM.
  const [stage, setStage] = useState(1);
  const [complete, setComplete] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [viewResetToken, setViewResetToken] = useState(0);
  const build = useRef<BuildState>({ p: 0, playing: false, target: null, invalidate: () => {} });
  const started = useRef(false);
  const rangeRef = useRef<HTMLInputElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nearIO = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    const seenIO = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "100px 0px" });
    nearIO.observe(el);
    seenIO.observe(el);
    const onVis = () => setDocVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      nearIO.disconnect();
      seenIO.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Next.js keeps visited routes mounted in a hidden <Activity>, and R3F deliberately keeps its root
  // alive there. Unmount the scene when hidden so the WebGL context and GPU memory are released;
  // it reloads when the page is shown again, at the same build progress.
  useLayoutEffect(
    () => () => {
      setNear(false);
      setOnScreen(false);
      setStatus((s) => (s === "loading" || s === "ready" ? "idle" : s));
    },
    [],
  );

  // Decide once the viewer is near: unsupported devices keep the drawing and never download three.js.
  useEffect(() => {
    if (!near || status !== "idle") return;
    // The first time the scene loads, start from the empty plot (or the finished house for reduced motion).
    if (!started.current) {
      started.current = true;
      Object.assign(build.current, { p: reducedMotion ? STAGE_COUNT : 0, playing: !reducedMotion, target: null });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability check after the viewer nears the viewport
    setStatus(supportsWebGL() ? "loading" : "unsupported");
  }, [near, status, reducedMotion]);

  // Turning reduced motion on mid-build finishes the house at once.
  useEffect(() => {
    const b = build.current;
    if (!reducedMotion || !b.playing) return;
    Object.assign(b, { p: STAGE_COUNT, playing: false, target: null });
    b.invalidate();
  }, [reducedMotion]);

  const syncTrack = useCallback((p: number) => {
    const frac = p / STAGE_COUNT;
    if (rangeRef.current) rangeRef.current.value = String(p);
    if (fillRef.current) fillRef.current.style.clipPath = `inset(0 ${(1 - frac) * 100}% 0 0)`;
    if (knobRef.current) knobRef.current.style.left = `${frac * 100}%`;
  }, []);

  const onProgress = useCallback((p: number) => {
    syncTrack(p);
    setStage(stageAt(p));
    setComplete(p >= STAGE_COUNT);
    setPlaying(build.current.playing);
  }, [syncTrack]);

  const ready = status === "ready";
  // The control bar mounts after the first frames have already reported progress.
  useLayoutEffect(() => {
    if (ready) syncTrack(build.current.p);
  }, [ready, syncTrack]);

  const onReady = useCallback(() => setStatus("ready"), []);
  const onError = useCallback(() => setStatus("error"), []);
  const retry = () => {
    setAttempt((a) => a + 1);
    setStatus("loading");
  };

  const control = (patch: Partial<BuildState>) => {
    const b = build.current;
    Object.assign(b, patch);
    setPlaying(b.playing);
    b.invalidate();
  };
  const restart = () => control({ p: 0, target: null, playing: true });
  const togglePlay = () => {
    if (complete) restart();
    else control({ playing: !build.current.playing, target: null });
  };
  const seek = (p: number) => control({ p, target: null, playing: false });
  // Arrow keys and Page Up/Down step to the end of the next/previous stage; Home/End jump to the ends.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const p = build.current.target ?? build.current.p;
    const to: Record<string, number> = {
      ArrowRight: Math.floor(p + 1e-3) + 1,
      ArrowUp: Math.floor(p + 1e-3) + 1,
      PageUp: Math.floor(p + 1e-3) + 1,
      ArrowLeft: Math.ceil(p - 1e-3) - 1,
      ArrowDown: Math.ceil(p - 1e-3) - 1,
      PageDown: Math.ceil(p - 1e-3) - 1,
      Home: 0,
      End: STAGE_COUNT,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    control({ target: Math.min(STAGE_COUNT, Math.max(0, to[e.key])), playing: false });
  };

  const mounted = status === "loading" || ready;
  const stageName = complete ? t("ui.completed") : (labels[stage - 1]?.short ?? "");
  const segments = Array.from({ length: STAGE_COUNT }, (_, i) => <span key={i} className="h-full flex-1 rounded-full bg-current" />);

  return (
    <div ref={ref} className={cx("relative overflow-hidden", className)}>
      <p className="sr-only">{t("ui.modelLabel")}</p>

      {/* Drawing: visible until the first WebGL frame, and permanently if 3D is unavailable. */}
      <div className={cx("absolute inset-0 grid place-items-center p-6 transition-opacity duration-700", ready ? "opacity-0" : "opacity-100")} aria-hidden={ready || undefined}>
        <HouseDrawing className="size-full" label={t("ui.drawingLabel")} />
      </div>

      {mounted && (
        <div className={cx("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
          <SceneBoundary key={attempt} onError={onError}>
            <HouseScene
              buildRef={build}
              onProgress={onProgress}
              cameraStage={STAGE_COUNT}
              viewResetToken={viewResetToken}
              // No frame around the hero model, so leave room for the whole plot and its shadow.
              distanceScale={1.32}
              active={onScreen && docVisible}
              reducedMotion={reducedMotion}
              onReady={onReady}
              onError={onError}
            />
          </SceneBoundary>
        </div>
      )}

      {/* Bottom: status messages while loading, then the construction controls. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
        <div aria-live="polite">
          {status === "loading" && (
            <p className="t-meta inline-flex items-center gap-2 rounded-full bg-night/85 px-3 py-1.5 text-night-ink">
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
              {t("ui.loading")}
            </p>
          )}
          {status === "unsupported" && <p className="t-meta rounded-[3px] bg-night/85 px-3 py-2 text-night-ink">{t("ui.unsupported")}</p>}
          {status === "error" && (
            <p className="t-meta pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[3px] bg-night/85 px-3 py-2 text-night-ink">
              {t("ui.error")}
              <button type="button" onClick={retry} className="underline underline-offset-4 hover:text-accent">
                {t("ui.retry")}
              </button>
            </p>
          )}
        </div>

        {ready && (
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-paper/85 p-1 pr-2 shadow-[0_6px_20px_-12px_rgb(0_0_0/0.35)] backdrop-blur-sm sm:gap-1.5 sm:pr-3">
            <IconButton
              label={complete ? t("ui.replay") : playing ? t("ui.pause") : t("ui.play")}
              onClick={togglePlay}
              className="bg-ink text-paper hover:bg-ink-soft"
            >
              {complete ? <RotateCcw aria-hidden /> : playing ? <Pause aria-hidden /> : <Play aria-hidden className="translate-x-px" />}
            </IconButton>
            <IconButton label={t("ui.restart")} onClick={restart} className="text-ink hover:bg-ink/8 max-[359px]:hidden">
              <SkipBack aria-hidden />
            </IconButton>

            {/* Stage track: eight segments, the built part in accent. The slider on top does the work. */}
            <div className="relative mx-1.5 h-9 min-w-0 flex-1 rounded-sm has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent">
              <div aria-hidden className="absolute inset-x-0 top-1/2 flex h-[3px] -translate-y-1/2 gap-[3px] text-line-strong">
                {segments}
              </div>
              <div ref={fillRef} aria-hidden className="absolute inset-x-0 top-1/2 flex h-[3px] -translate-y-1/2 gap-[3px] text-accent" style={{ clipPath: "inset(0 100% 0 0)" }}>
                {segments}
              </div>
              <span ref={knobRef} aria-hidden className="absolute top-1/2 size-2.5 -translate-1/2 rounded-full border-2 border-accent bg-paper" style={{ left: "0%" }} />
              <input
                ref={rangeRef}
                type="range"
                min={0}
                max={STAGE_COUNT}
                step="any"
                defaultValue={0}
                aria-label={t("ui.progress")}
                aria-valuetext={complete ? t("ui.completed") : t("ui.stageValue", { n: stage, total: STAGE_COUNT, name: stageName })}
                onInput={(e) => seek(Number(e.currentTarget.value))}
                onKeyDown={onKey}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </div>

            <p aria-hidden className="t-meta flex min-w-0 items-baseline gap-2 whitespace-nowrap text-ink-soft">
              <span className="tabular-nums">
                <span className="text-ink">{pad(stage)}</span>/{pad(STAGE_COUNT)}
              </span>
              <span className="hidden max-w-[11rem] truncate text-ink min-[420px]:inline">{stageName}</span>
            </p>
            <IconButton label={t("ui.resetView")} onClick={() => setViewResetToken((n) => n + 1)}>
              <Focus aria-hidden />
            </IconButton>
          </div>
        )}
      </div>

      {ready && (
        <>
          <p className="t-meta pointer-events-none absolute top-4 left-4 hidden pr-4 text-muted [@media(pointer:fine)]:sm:block">{t("ui.dragHint")}</p>
          <p className="t-meta pointer-events-none absolute top-4 left-4 hidden pr-4 text-muted [@media(pointer:coarse)]:block">{t("ui.touchHint")}</p>
        </>
      )}
    </div>
  );
}
