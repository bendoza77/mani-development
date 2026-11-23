"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Img } from "@/components/ui/Img";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";
import type { PublicSlide } from "@/lib/public-types";

const INTERVAL_MS = 6500;

const controlClass =
  "grid size-11 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-paper";

/**
 * Homepage slider (admin → Slider), without a library: a CSS scroll-snap track (swipe and
 * trackpad work natively), previous/next, dots and a pause button. Auto-advances only while the
 * visitor isn't hovering or focused inside it, the tab is visible, the pause button isn't pressed
 * and reduced motion isn't requested. Every slide has the same fixed aspect ratio (no layout
 * shift). Slide headings are h3 under the section's h2; the page's h1 stays in the hero.
 */
export function Slider({ slides, priority = false }: { slides: PublicSlide[]; priority?: boolean }) {
  const { t } = useTranslation("home");
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      const el = track.current;
      if (!el || !count) return;
      const target = (next + count) % count;
      el.scrollTo({ left: target * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
      setIndex(target);
    },
    [count, reduced],
  );

  // The visible slide follows the scroll position (swipes, trackpads, keyboard scrolling).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (el.clientWidth) setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [count]);

  const autoplay = count > 1 && !reduced && !paused && !hovered && !focused;
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      if (!document.hidden) go(index + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoplay, go, index]);

  if (!count) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    }
  };

  return (
    <section
      className="border-t border-line py-[clamp(3rem,7vw,5rem)]"
      aria-roledescription={t("slider.carousel")}
      aria-labelledby="slider-title"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div className="shell">
        <h2 id="slider-title" className="sr-only">
          {t("slider.title")}
        </h2>
        <ul
          ref={track}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[2px]"
          aria-live={autoplay ? "off" : "polite"}
        >
          {slides.map((s, i) => (
            <li
              key={s.id}
              className="relative aspect-[4/5] w-full shrink-0 snap-start overflow-hidden sm:aspect-[16/9] lg:aspect-[21/9]"
              aria-roledescription={t("slider.slide")}
              aria-label={t("slider.position", { n: i + 1, total: count })}
              inert={i !== index}
            >
              <Img
                src={s.image.src}
                alt={s.image.alt}
                sizes="(min-width: 1440px) 1360px, 100vw"
                preload={priority && i === 0}
                quality={80}
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              {/* A second, sideways scrim behind the caption so it stays legible over bright, busy photos. */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent max-sm:hidden" />
              <div className="absolute inset-x-0 bottom-0 p-[clamp(1.25rem,4vw,3rem)] text-white">
                <h3 className="max-w-[22ch] font-display text-[clamp(1.6rem,1.1rem+2.2vw,3rem)] leading-[1.1] tracking-[-0.02em] text-balance">
                  {s.heading}
                </h3>
                {s.text && <p className="mt-3 max-w-xl text-[0.98rem] leading-relaxed text-white/85 max-sm:line-clamp-3">{s.text}</p>}
                {s.cta && (
                  <ButtonLink href={s.cta.href} variant="light" className="mt-6" arrow>
                    {s.cta.label}
                  </ButtonLink>
                )}
              </div>
            </li>
          ))}
        </ul>

        {count > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="t-meta tabular-nums text-muted" aria-hidden>
                {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </p>
              <ol className="flex items-center gap-1">
                {slides.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => go(i)}
                      aria-label={t("slider.goTo", { n: i + 1, total: count })}
                      aria-current={i === index ? "true" : undefined}
                      className="grid size-7 place-items-center"
                    >
                      <span className={cx("h-1 rounded-full transition-all", i === index ? "w-5 bg-ink" : "w-2 bg-line-strong")} />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex gap-2">
              {!reduced && (
                <button type="button" className={controlClass} onClick={() => setPaused((p) => !p)} aria-label={paused ? t("slider.play") : t("slider.pause")}>
                  {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
                </button>
              )}
              <button type="button" className={controlClass} onClick={() => go(index - 1)} aria-label={t("slider.previous")}>
                <ArrowLeft aria-hidden className="size-4.5" />
              </button>
              <button type="button" className={controlClass} onClick={() => go(index + 1)} aria-label={t("slider.next")}>
                <ArrowRight aria-hidden className="size-4.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
