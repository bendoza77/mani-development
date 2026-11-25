"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, Quote } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Stars } from "@/components/ui/Stars";
import { useAutoSlider } from "@/hooks/useAutoSlider";
import { useMediaQuery, useReducedMotion } from "@/hooks/useMediaQuery";
import { useLocale, useTranslation } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { cx } from "@/lib/format";
import type { PublicReview } from "@/lib/public-types";
import { EMPTY_REVIEW, ReviewForm, type ReviewDraft } from "./ReviewForm";

/** A review with its month already written out by the server (see the homepage). */
export type ReviewItem = PublicReview & { dateText: string };

const SWIPE_PX = 40;
const INTERVAL_MS = 6000;

const controlClass =
  "grid size-11 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-paper";

/**
 * "4.8" in English, "4,8" in Georgian and Russian. Written by hand rather than with Intl, because
 * some browsers (Chrome among them) have no Georgian number data and would print a different text
 * than the server.
 */
function formatAverage(value: number, locale: Locale) {
  const text = value.toFixed(1);
  return locale === "en" ? text : text.replace(".", ",");
}

/** First letters of the first two words, for the round badge beside the name. */
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Approved visitor reviews (read on the server, see the homepage). On large screens the title, the
 * average rating and the "Write a review" button sit on the left, the moving row of cards on the right.
 * The row moves one card every few seconds and loops; a thin bar under it shows where you are and
 * fills while it waits for the next move. Two cards show side by side where there is room and there
 * are at least three reviews, otherwise one wide card. Card widths come from CSS, so the server render
 * (which can't know the screen) already lays out correctly; only the offset uses `visible`.
 */
export function Reviews({ items }: { items: ReviewItem[] }) {
  const { t } = useTranslation("home");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  /** Kept while the dialog is closed, so an accidental Escape or outside click doesn't lose the text. */
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_REVIEW);
  const count = items.length;
  const md = useMediaQuery("(min-width: 48rem)");
  const lg = useMediaQuery("(min-width: 64rem)");
  const xl = useMediaQuery("(min-width: 80rem)");
  // At lg the row has only 8 of 12 columns, so it drops back to one card until xl.
  const pair = count >= 3;
  const visible = pair && ((md && !lg) || xl) ? 2 : 1;
  const { index, go, playing, running, setPlaying, pauseProps } = useAutoSlider({ count, visible, intervalMs: INTERVAL_MS });
  const reduced = useReducedMotion();
  const swipeX = useRef<number | null>(null);
  const track = useRef<HTMLUListElement>(null);
  /**
   * Content height of the tallest card on screen. Cards on screen get it as their minimum, so they
   * line up, and the window clips any taller card waiting off screen.
   */
  const [cardHeight, setCardHeight] = useState<number | null>(null);

  // Measures the card contents (never the stretched cards themselves), so the result doesn't feed back
  // into itself. Observing again on every move also gives the first measurement.
  useEffect(() => {
    const ul = track.current;
    if (!ul) return;
    const measure = () => {
      const shown = [...ul.children].slice(index, index + visible);
      const heights = shown.map((li) => {
        const parts = li.firstElementChild?.children;
        return parts ? [...parts].reduce((sum, el) => sum + (el as HTMLElement).offsetHeight, 0) : 0;
      });
      setCardHeight(Math.max(...heights));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    for (const li of ul.children) for (const part of li.firstElementChild?.children ?? []) ro.observe(part);
    return () => ro.disconnect();
  }, [index, visible, count]);

  const average = count ? items.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  const averageText = formatAverage(average, locale);

  const positions = Math.max(1, count - visible + 1);
  const canMove = positions > 1;

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
    <section className="border-t border-line py-[clamp(4rem,9vw,7rem)]" aria-labelledby="reviews-title">
      <div className="shell grid gap-10 lg:grid-cols-12 lg:gap-x-10">
        <div className="flex flex-col items-start lg:col-span-4">
          <h2 id="reviews-title" className="t-h2">
            {t("reviews.title")}
          </h2>
          {count > 0 ? (
            <div className="mt-6 flex items-center gap-4">
              <span className="font-display text-[3.25rem] leading-none tracking-[-0.03em] tabular-nums">{averageText}</span>
              <span className="flex flex-col gap-1.5">
                <Stars value={Math.round(average)} />
                <span className="t-meta text-muted">{t("reviews.average")}</span>
              </span>
            </div>
          ) : (
            <p className="mt-4 max-w-sm leading-relaxed text-ink-soft">{t("reviews.empty")}</p>
          )}
          <Button variant="outline" className="mt-8" onClick={() => setOpen(true)}>
            {t("reviews.write")}
          </Button>
        </div>

        {count > 0 && (
          <div className="min-w-0 lg:col-span-8" aria-roledescription={t("reviews.carousel")} aria-label={t("reviews.title")} {...pauseProps}>
            <div
              className={cx(
                "-mx-2.5 touch-pan-y overflow-hidden",
                cardHeight !== null && "h-[calc(var(--card-h)+3.5rem+2px)] sm:h-[calc(var(--card-h)+4.5rem+2px)]",
                !reduced && "transition-[height] duration-600 ease-(--ease-arch)",
              )}
              style={cardHeight !== null ? ({ "--card-h": `${cardHeight}px` } as CSSProperties) : undefined}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (swipeX.current = null)}
            >
              <ul
                ref={track}
                className={cx("flex items-start", !reduced && "transition-transform duration-700 ease-(--ease-arch)")}
                style={{ transform: `translateX(-${(index * 100) / visible}%)` }}
              >
                {items.map((r, i) => {
                  const offscreen = i < index || i >= index + visible;
                  return (
                    <li
                      key={r.id}
                      className={cx(
                        "min-w-0 shrink-0 basis-full px-2.5",
                        pair && "md:basis-1/2 lg:basis-full xl:basis-1/2",
                        !reduced && "transition-opacity duration-700",
                        offscreen && "opacity-40",
                      )}
                      aria-roledescription={t("reviews.slide")}
                      aria-label={t("reviews.position", { n: i + 1, total: count })}
                      aria-hidden={offscreen || undefined}
                      inert={offscreen || undefined}
                    >
                      {/* Content box sizing: the measured height is the contents only, padding comes on top. */}
                      <figure
                        className="box-content flex flex-col rounded-[3px] border border-line bg-card p-7 sm:p-9"
                        style={cardHeight !== null ? { minHeight: cardHeight } : undefined}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <Quote aria-hidden strokeWidth={0} className="size-8 -scale-x-100 fill-accent" />
                            <Stars value={r.rating} />
                          </div>
                          {/* Plain text as written: line breaks kept, long words wrap. */}
                          <blockquote className="mt-5 text-[1.0625rem] leading-relaxed break-words whitespace-pre-line text-ink sm:text-lg">
                            {r.text}
                          </blockquote>
                        </div>
                        <figcaption className="mt-auto pt-7">
                          <div className="flex items-center gap-3.5 border-t border-line pt-5">
                            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-paper-2 text-[0.9rem] font-medium text-ink-soft">
                              {initials(r.fullName)}
                            </span>
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate font-medium">{r.fullName}</span>
                              <time className="t-meta text-muted" dateTime={r.createdAt}>
                                {r.dateText}
                              </time>
                            </span>
                          </div>
                        </figcaption>
                      </figure>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Two reviews show one at a time, so from two up the row can always move, on every screen. */}
            {canMove && (
              // Buttons on the left: the floating chat buttons sit over the right edge on phones.
              <div className="mt-7 flex items-center gap-5">
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={controlClass} onClick={() => go(-1)} aria-label={t("reviews.previous")}>
                    <ArrowLeft aria-hidden className="size-4.5" />
                  </button>
                  <button type="button" className={controlClass} onClick={() => go(1)} aria-label={t("reviews.next")}>
                    <ArrowRight aria-hidden className="size-4.5" />
                  </button>
                  {!reduced && (
                    <button type="button" className={controlClass} onClick={() => setPlaying(!playing)} aria-label={playing ? t("reviews.pause") : t("reviews.play")}>
                      {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                    </button>
                  )}
                </div>
                {/* Where you are in the row; the filled part grows while it waits for the next move. */}
                <div aria-hidden className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={cx("absolute inset-y-0 left-0", !reduced && "transition-transform duration-700 ease-(--ease-arch)")}
                    style={{ width: `${100 / positions}%`, transform: `translateX(${index * 100}%)` }}
                  >
                    <div
                      key={`${index}-${running}`}
                      className={cx("h-full origin-left bg-ink", running && "review-progress")}
                      style={running ? { animationDuration: `${INTERVAL_MS}ms` } : undefined}
                    />
                  </div>
                </div>
                <p className="t-meta shrink-0 text-muted tabular-nums" aria-live={running ? "off" : "polite"}>
                  {t("reviews.position", { n: index + 1, total: positions })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={t("reviews.write")}>
        {/* Mounted only while open, so Turnstile starts fresh each time; the draft lives here. */}
        {open && <ReviewForm values={draft} setValues={setDraft} onSent={() => setDraft(EMPTY_REVIEW)} onClose={() => setOpen(false)} />}
      </Dialog>
    </section>
  );
}
