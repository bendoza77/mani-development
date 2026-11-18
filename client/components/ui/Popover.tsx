"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "@/lib/format";

type Props = {
  trigger: (props: { "aria-expanded": boolean; "aria-controls": string; onClick: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  label: string;
};

/** Lightweight disclosure popover: closes on outside click, Escape (returning focus), and route change via unmount. */
export function Popover({ trigger, children, align = "end", className, label }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLElement>("[aria-expanded]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {trigger({ "aria-expanded": open, "aria-controls": id, onClick: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="region"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 0.7, 0.12, 1] }}
            className={cx(
              "absolute top-[calc(100%+0.5rem)] z-50 rounded-md border border-line bg-card text-ink shadow-card",
              align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
              className,
            )}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
