"use client";

import { useEffect, useRef } from "react";

/**
 * Number that counts up once when scrolled into view. The final value is server-rendered,
 * so it reads correctly without JS and under reduced motion. Updates the DOM directly (no re-renders).
 */
export function Counter({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) return; // already visible: keep the final value
    el.textContent = format(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min((now - start) / 1600, 1);
        el.textContent = format(value * (1 - Math.pow(1 - k, 4)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = format(value);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- format is derived from the same props
  }, [value, decimals, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(value)}
    </span>
  );
}
