"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { cx } from "@/lib/format";
import type { SceneProps } from "./ArchitectureScene";

// three.js + R3F are split into their own chunk and only fetched on routes that mount a scene.
const ArchitectureScene = dynamic(() => import("./ArchitectureScene"), { ssr: false });

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Props = Omit<SceneProps, "active" | "reducedMotion" | "onReady"> & {
  /** Server-rendered placeholder (blueprint drawing); also the permanent fallback without WebGL. */
  placeholder: ReactNode;
  /** Must establish positioning (relative/absolute): layers inside are absolutely positioned. */
  className?: string;
  /** Mount distance before entering the viewport. */
  eager?: boolean;
};

/**
 * Lazy, visibility-aware host for the WebGL scene:
 * - fetches the 3D chunk only when the stage approaches the viewport (or immediately when eager)
 * - stops the render loop when offscreen or when the tab is hidden
 * - unmounts the canvas when the route is hidden by <Activity>, so contexts are never leaked
 * - keeps the blueprint visible until the first frame, then cross-fades
 */
export function SceneMount({ placeholder, className, eager = false, ...scene }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [live, setLive] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [near, setNear] = useState(eager);
  const [onScreen, setOnScreen] = useState(false);
  const [docVisible, setDocVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state after hydration
    setWebgl(supportsWebGL());
    setLive(true);
    return () => {
      setLive(false);
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nearIO = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    const seenIO = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "80px 0px" });
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

  const showCanvas = live && webgl && near;

  return (
    <div ref={ref} className={className}>
      <div
        className={cx(
          "absolute inset-0 transition-opacity duration-1000 ease-(--ease-arch)",
          ready ? "opacity-0" : "opacity-100",
        )}
        aria-hidden={webgl ? true : undefined}
      >
        {placeholder}
      </div>
      {showCanvas && (
        <div
          className={cx(
            "absolute inset-0 transition-opacity duration-1000 ease-(--ease-arch)",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          <ArchitectureScene
            {...scene}
            active={onScreen && docVisible}
            reducedMotion={reducedMotion}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}
