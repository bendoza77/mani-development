"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useContent, useTranslation } from "@/i18n/client";
import { useDB } from "@/lib/store";

export function Testimonials() {
  const { t: tr } = useTranslation("home");
  const content = useContent();
  const all = useDB((d) => d.testimonials);
  const items = useMemo(() => all.filter((x) => x.published), [all]);
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const i = index % items.length;
  const t = content.testimonial(items[i]);
  const go = (dir: 1 | -1) => setIndex((v) => (v + dir + items.length) % items.length);

  return (
    <section className="border-t border-line bg-paper-2/50 py-[clamp(4rem,9vw,7rem)]" aria-labelledby="testimonials-title" aria-roledescription={tr("testimonials.carousel")}>
      <div className="shell grid gap-10 lg:grid-cols-12">
        <div className="flex flex-col justify-between gap-8 lg:col-span-3">
          <div>
            <p className="t-eyebrow text-muted" id="testimonials-title">
              {tr("testimonials.eyebrow")}
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
              aria-label={tr("testimonials.previous")}
            >
              <ArrowLeft aria-hidden className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="grid size-12 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              aria-label={tr("testimonials.next")}
            >
              <ArrowRight aria-hidden className="size-4.5" />
            </button>
          </div>
        </div>
        <div className="relative min-h-[18rem] lg:col-span-9 sm:min-h-[16rem]">
          {/* Keyed so each new quote replays the CSS entrance. */}
          <figure key={t.id} className="rise-in" aria-roledescription={tr("testimonials.slide")}>
            <blockquote className="font-display text-[clamp(1.6rem,1.1rem+2.2vw,3rem)] leading-[1.15] tracking-[-0.02em] text-balance">
              <span aria-hidden className="mr-1 text-accent">{tr("testimonials.openQuote")}</span>
              {t.quote}
              <span aria-hidden className="text-accent">{tr("testimonials.closeQuote")}</span>
            </blockquote>
            <figcaption className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-medium">{t.author}</span>
              <span className="text-[0.9rem] text-muted">{t.role}</span>
              <span className="t-meta text-muted">· {t.project}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
