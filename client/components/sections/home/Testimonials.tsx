"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useDB } from "@/lib/store";

export function Testimonials() {
  const all = useDB((d) => d.testimonials);
  const items = useMemo(() => all.filter((t) => t.published), [all]);
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const i = index % items.length;
  const t = items[i];
  const go = (dir: 1 | -1) => setIndex((v) => (v + dir + items.length) % items.length);

  return (
    <section className="border-t border-line bg-paper-2/50 py-[clamp(4.5rem,11vw,9rem)]" aria-labelledby="testimonials-title" aria-roledescription="carousel">
      <div className="shell grid gap-10 lg:grid-cols-12">
        <div className="flex flex-col justify-between gap-8 lg:col-span-3">
          <div>
            <p className="t-eyebrow text-muted" id="testimonials-title">
              Clients
            </p>
            <p className="t-meta mt-4 text-muted tabular-nums" aria-live="polite">
              {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              className="grid size-12 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              aria-label="Previous testimonial"
            >
              <ArrowLeft aria-hidden className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="grid size-12 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              aria-label="Next testimonial"
            >
              <ArrowRight aria-hidden className="size-4.5" />
            </button>
          </div>
        </div>
        <div className="relative min-h-[18rem] lg:col-span-9 sm:min-h-[16rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.figure
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.22, 0.7, 0.12, 1] }}
              aria-roledescription="slide"
            >
              <blockquote className="font-display text-[clamp(1.6rem,1.1rem+2.2vw,3rem)] leading-[1.15] tracking-[-0.02em] text-balance">
                <span aria-hidden className="mr-1 text-accent">&ldquo;</span>
                {t.quote}
                <span aria-hidden className="text-accent">&rdquo;</span>
              </blockquote>
              <figcaption className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-medium">{t.author}</span>
                <span className="text-[0.9rem] text-muted">{t.role}</span>
                <span className="t-meta text-muted">· {t.project}</span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
