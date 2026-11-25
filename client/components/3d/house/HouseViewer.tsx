"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";
import { HouseDrawing } from "./HouseDrawing";
import { STAGE_COUNT } from "./stages";

// three.js + R3F live in their own chunk, fetched only when the viewer nears the viewport.
const HouseScene = dynamic(() => import("./HouseScene"), { ssr: false });

type Status = "idle" | "loading" | "ready" | "unsupported" | "error";

/** Time each stage gets during the automatic build: its ~1.2 s animation plus a short pause. */
const STEP_MS = 1700;

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

/**
 * The homepage's 3D house. It builds itself automatically, stage by stage, from an empty plot to
 * the finished home, then rests (with a "Build again" button). Visitors who prefer reduced motion
 * see the finished house straight away. Until the first WebGL frame, and permanently when 3D is
 * unavailable, a line drawing of the finished house is shown instead.
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
  const [pageIdle, setPageIdle] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState(1);
  const [building, setBuilding] = useState(true);
  const [replayToken, setReplayToken] = useState(0);

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
  // it reloads when the page is shown again.
  useLayoutEffect(
    () => () => {
      setNear(false);
      setOnScreen(false);
      setStatus((s) => (s === "loading" || s === "ready" ? "idle" : s));
    },
    [],
  );

  // The viewer opens the homepage, so "near" is true at once. three.js (about 266 KB compressed)
  // therefore waits until the page has loaded and the browser is idle, leaving the network and the
  // main thread to the text, fonts and first images; the drawing shows meanwhile.
  useEffect(() => {
    let cancel = () => {};
    const start = () => {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(() => setPageIdle(true), { timeout: 2000 });
        cancel = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(() => setPageIdle(true), 200);
        cancel = () => window.clearTimeout(id);
      }
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      cancel();
    };
  }, []);

  // Decide once the viewer is near: unsupported devices keep the drawing and never download three.js.
  useEffect(() => {
    if (!near || !pageIdle || status !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability check after the viewer nears the viewport
    setStatus(supportsWebGL() ? "loading" : "unsupported");
  }, [near, pageIdle, status]);

  const animate = building && !reducedMotion;
  const ready = status === "ready";

  // The automatic build: one stage at a time while the model is visible, then rest on the finished house.
  useEffect(() => {
    if (!animate || !ready || !onScreen || !docVisible) return;
    const id = window.setTimeout(() => {
      if (stage < STAGE_COUNT) setStage(stage + 1);
      else setBuilding(false);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [animate, ready, onScreen, docVisible, stage]);

  const onReady = useCallback(() => setStatus("ready"), []);
  const onError = useCallback(() => setStatus("error"), []);
  const retry = () => {
    setAttempt((a) => a + 1);
    setStatus("loading");
  };
  const replay = () => {
    setReplayToken((r) => r + 1);
    setStage(1);
    setBuilding(true);
  };

  const shown = reducedMotion ? STAGE_COUNT : stage;
  const mounted = status === "loading" || ready;

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
              stage={shown}
              replayToken={replayToken}
              initialProgress={animate ? 0 : shown}
              cameraStage={STAGE_COUNT}
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

      {/* Bottom bar: status messages while loading, then the stage being built. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 sm:inset-x-4 sm:bottom-4">
        <div aria-live="polite">
          {status === "loading" && (
            <p className="t-meta inline-flex items-center gap-2 rounded-full bg-night/85 px-3 py-1.5 text-night-ink">
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
              {t("ui.loading")}
            </p>
          )}
          {status === "unsupported" && (
            <p className="t-meta rounded-[3px] bg-night/85 px-3 py-2 text-night-ink">{t("ui.unsupported")}</p>
          )}
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
          // Decorative progress readout (the model itself is described by the sr-only text above).
          <div aria-hidden className="t-meta flex min-w-0 items-center gap-2.5 rounded-full bg-paper/85 px-3 py-1.5 text-ink-soft">
            <span className="tabular-nums">
              <span className="text-ink">{pad(shown)}</span> / {pad(STAGE_COUNT)}
            </span>
            <span className="h-px w-10 bg-line-strong sm:w-14">
              <span className="block h-full bg-accent transition-[width] duration-700" style={{ width: `${(shown / STAGE_COUNT) * 100}%` }} />
            </span>
            <span className="truncate text-ink">{labels[shown - 1]?.short}</span>
          </div>
        )}
      </div>

      {ready && !animate && !reducedMotion && (
        <button
          type="button"
          onClick={replay}
          className="absolute top-3 right-3 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper/85 px-3.5 text-[0.82rem] text-ink transition-colors hover:bg-paper sm:top-4 sm:right-4"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          {t("ui.replay")}
        </button>
      )}
      {ready && (
        <p className="t-meta pointer-events-none absolute top-4 left-4 hidden text-muted [@media(pointer:fine)]:sm:block">{t("ui.dragHint")}</p>
      )}
    </div>
  );
}
