"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "@/i18n/client";
import type { PublicTestimonial } from "@/lib/public-types";

const controlClass =
  "grid size-12 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-paper";

/**
 * Published testimonials (read on the server, see the homepage), one at a time. On large screens
 * the label and counter sit top-left with the arrows pinned bottom-left beside the quote; on
 * smaller screens the arrows follow the quote, so it is read before the controls.
 */
export function Testimonials({ items }: { items: PublicTestimonial[] }) {
  const { t: tr } = useTranslation("home");
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const i = index % items.length;
  const t = items[i];
  const go = (dir: 1 | -1) => setIndex((v) => (v + dir + items.length) % items.length);

  return (
    <section className="border-t border-line bg-paper-2/50 py-[clamp(4rem,9vw,7rem)]" aria-labelledby="testimonials-title" aria-roledescription={tr("testimonials.carousel")}>
      <div className="shell grid gap-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-8">
        <div className="lg:col-span-3">
          <p className="t-eyebrow text-muted" id="testimonials-title">
            {tr("testimonials.eyebrow")}
          </p>
          <p className="t-meta mt-4 text-muted tabular-nums" aria-live="polite">
            {i + 1} / {items.length}
          </p>
        </div>

        <div className="relative min-h-72 sm:min-h-64 lg:col-span-9 lg:col-start-4 lg:row-span-2 lg:row-start-1">
          {/* Keyed so each new quote replays the CSS entrance. */}
          <figure key={t.id} className="rise-in" aria-roledescription={tr("testimonials.slide")}>
            <blockquote className="relative font-display text-[clamp(1.6rem,1.1rem+2.2vw,3rem)] leading-[1.15] tracking-[-0.02em] text-balance">
              {/* Hung into the margin on large screens so every line of the quote starts on the same edge. */}
              <span aria-hidden className="mr-1 text-accent lg:absolute lg:right-full lg:mr-[0.08em]">
                {tr("testimonials.openQuote")}
              </span>
              {t.quote}
              <span aria-hidden className="text-accent">{tr("testimonials.closeQuote")}</span>
            </blockquote>
            <figcaption className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-medium">{t.author}</span>
              {t.role && <span className="text-[0.9rem] text-muted">{t.role}</span>}
              {t.project?.title && <span className="text-[0.9rem] text-muted">{t.project.title}</span>}
            </figcaption>
          </figure>
        </div>

        <div className="flex gap-2 lg:col-span-3 lg:self-end">
          <button type="button" onClick={() => go(-1)} className={controlClass} aria-label={tr("testimonials.previous")}>
            <ArrowLeft aria-hidden className="size-4.5" />
          </button>
          <button type="button" onClick={() => go(1)} className={controlClass} aria-label={tr("testimonials.next")}>
            <ArrowRight aria-hidden className="size-4.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
