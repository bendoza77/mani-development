"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FocusEvent, type PointerEvent } from "react";
import { useReducedMotion } from "./useMediaQuery";

/**
 * Index and timing for a row of `count` items showing `visible` at a time. Moves one item every
 * `intervalMs` and loops (0 … count - visible). Waits while the pointer is over it, focus is inside
 * it, the tab is hidden or the visitor pressed pause, and never moves by itself under reduced motion.
 * Does nothing when every item already fits. Pressing play clears the focus pause, so the play
 * button (which keeps focus after a click) doesn't hold it still.
 */
export function useAutoSlider({ count, visible, intervalMs = 5000 }: { count: number; visible: number; intervalMs?: number }) {
  const reduced = useReducedMotion();
  const [rawIndex, setIndex] = useState(0);
  /** `null` until the visitor presses play or pause. */
  const [choice, setChoice] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);

  const last = Math.max(0, count - visible);
  // Clamped so a wider screen (more visible) never leaves an empty gap at the end.
  const index = Math.min(rawIndex, last);
  const playing = !reduced && (choice ?? true);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (last === 0) return;
      setIndex((i) => (Math.min(i, last) + dir + last + 1) % (last + 1));
    },
    [last],
  );

  // A timeout keyed on `index`, so a manual move also restarts the wait.
  const running = last > 0 && playing && !hovered && !focused && !hidden;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => go(1), intervalMs);
    return () => window.clearTimeout(id);
  }, [running, index, intervalMs, go]);

  const setPlaying = useCallback((v: boolean) => {
    setChoice(v);
    if (v) setFocused(false);
  }, []);

  // Only a real mouse counts as hovering: a tap also fires enter events and would never "leave".
  const pauseProps = {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") setHovered(true);
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") setHovered(false);
    },
    onFocus: () => setFocused(true),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
    },
  };

  return { index, go, playing, setPlaying, pauseProps };
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
