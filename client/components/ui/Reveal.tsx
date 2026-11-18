"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

// One shared observer for every reveal on the page; elements are unobserved once shown.
let observer: IntersectionObserver | null = null;
function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-shown", "");
            observer?.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
  }
  return observer;
}

type Props = {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  variant?: "rise" | "fade";
  className?: string;
};

/** Scroll-triggered entrance. Styling lives in globals.css; reduced motion collapses it to instant. */
export function Reveal({ children, as: Tag = "div", delay = 0, variant = "rise", className }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);
  return (
    <Tag
      ref={ref}
      data-reveal={variant === "fade" ? "fade" : ""}
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
