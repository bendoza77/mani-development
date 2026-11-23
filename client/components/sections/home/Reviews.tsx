"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Stars } from "@/components/ui/Stars";
import { useAutoSlider } from "@/hooks/useAutoSlider";
import { useMediaQuery, useReducedMotion } from "@/hooks/useMediaQuery";
import { useLocale, useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";
import type { PublicReview } from "@/lib/public-types";
import { ReviewForm } from "./ReviewForm";

const SWIPE_PX = 40;

const controlClass =
  "grid size-11 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-paper";

/**
 * Approved visitor reviews (read on the server, see the homepage) in a row that moves one card at
 * a time: 1 card on phones, 2 from md, 3 from lg. Card widths come from CSS, so the server render
 * (which can't know the screen) already lays out correctly; only the offset uses `visible`.
 */
export function Reviews({ items }: { items: PublicReview[] }) {
  const { t } = useTranslation("home");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const md = useMediaQuery("(min-width: 48rem)");
  const lg = useMediaQuery("(min-width: 64rem)");
  const visible = lg ? 3 : md ? 2 : 1;
  const count = items.length;
  const { index, go, playing, setPlaying, pauseProps } = useAutoSlider({ count, visible });
  const reduced = useReducedMotion();
  const swipeX = useRef<number | null>(null);
  const track = useRef<HTMLUListElement>(null);
  /** Height of the tallest card on screen, so one long review doesn't leave a gap under short ones. */
  const [height, setHeight] = useState<number | null>(null);

  // Observing again on every move also gives the first measurement (ResizeObserver reports on observe).
  useEffect(() => {
    const ul = track.current;
    if (!ul) return;
    const ro = new ResizeObserver(() => {
      const shown = [...ul.children].slice(index, index + visible);
      setHeight(Math.max(...shown.map((li) => li.getBoundingClientRect().height)));
    });
    ro.observe(ul);
    return () => ro.disconnect();
  }, [index, visible, count]);

  // Fixed time zone so the server and the browser print the same month.
  const date = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "Asia/Tbilisi" });

  const onPointerDown = (e: PointerEvent) => {
    swipeX.current = e.pointerType === "mouse" ? null : e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipeX.current === null) return;
    const dx = e.clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
  };

  return (
    <section className="border-t border-line py-[clamp(4rem,9vw,7rem)]" aria-labelledby="reviews-title" aria-roledescription={count ? t("reviews.carousel") : undefined}>
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div>
            <h2 id="reviews-title" className="t-h2">
              {t("reviews.title")}
            </h2>
            {!count && <p className="mt-4 max-w-md leading-relaxed text-ink-soft">{t("reviews.empty")}</p>}
          </div>
          <Button variant="outline" onClick={() => setOpen(true)}>
            {t("reviews.write")}
          </Button>
        </div>

        {count > 0 && (
          <div className="mt-10 lg:mt-12" {...pauseProps}>
            <div
              className={cx("-mx-2.5 touch-pan-y overflow-hidden", !reduced && "transition-[height] duration-600 ease-(--ease-arch)")}
              style={height ? { height } : undefined}
              onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipeX.current = null)}>
              <ul
                ref={track}
                className={cx("flex items-start", !reduced && "transition-transform duration-600 ease-(--ease-arch)")}
                style={{ transform: `translateX(-${(index * 100) / visible}%)` }}
              >
                {items.map((r, i) => {
                  const offscreen = i < index || i >= index + visible;
                  return (
                    <li
                      key={r.id}
                      className="min-w-0 shrink-0 basis-full px-2.5 md:basis-1/2 lg:basis-1/3"
                      aria-roledescription={t("reviews.slide")}
                      aria-label={t("reviews.position", { n: i + 1, total: count })}
                      aria-hidden={offscreen || undefined}
                    >
                      <figure className="flex flex-col rounded-[3px] border border-line bg-card p-6 sm:p-8">
                        <Stars value={r.rating} />
                        {/* Plain text as written: line breaks kept, long words wrap. */}
                        <blockquote className="mt-5 leading-relaxed break-words whitespace-pre-line text-ink-soft">{r.text}</blockquote>
                        <figcaption className="mt-6 flex flex-col gap-0.5">
                          <span className="font-medium">{r.fullName}</span>
                          <time className="t-meta text-muted" dateTime={r.createdAt}>
                            {date.format(new Date(r.createdAt))}
                          </time>
                        </figcaption>
                      </figure>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Hidden by CSS where everything fits, so the server render matches every screen. */}
            {count > 1 && (
              <div className={cx("mt-6 flex justify-end gap-2", count === 2 && "md:hidden", count === 3 && "lg:hidden")}>
                <p className="sr-only" aria-live={playing ? "off" : "polite"}>
                  {t("reviews.position", { n: index + 1, total: count })}
                </p>
                {!reduced && (
                  <button type="button" className={controlClass} onClick={() => setPlaying(!playing)} aria-label={playing ? t("reviews.pause") : t("reviews.play")}>
                    {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                  </button>
                )}
                <button type="button" className={controlClass} onClick={() => go(-1)} aria-label={t("reviews.previous")}>
                  <ArrowLeft aria-hidden className="size-4.5" />
                </button>
                <button type="button" className={controlClass} onClick={() => go(1)} aria-label={t("reviews.next")}>
                  <ArrowRight aria-hidden className="size-4.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={t("reviews.write")}>
        {open && <ReviewForm onClose={() => setOpen(false)} />}
      </Dialog>
    </section>
  );
}
