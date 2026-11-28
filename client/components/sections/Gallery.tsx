"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { Img } from "@/components/ui/Img";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";

/**
 * One large photo with previous/next arrows (swipe on touch) and a thumbnail strip below.
 * Clicking the large photo opens the full-screen view (native dialog, arrow-key navigation).
 */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const { t } = useTranslation("projects");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLUListElement>(null);
  const swipe = useRef<{ x: number; moved: boolean } | null>(null);
  const total = images.length;
  const many = total > 1;

  const step = useCallback((dir: number) => setActive((i) => (i + dir + total) % total), [total]);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      d.close();
      opener.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const d = dialog.current;
    return () => d?.close();
  }, []);

  // Keep the active thumbnail in view inside the strip, without scrolling the page.
  useEffect(() => {
    const list = strip.current;
    const thumb = list?.children[active] as HTMLElement | undefined;
    if (!list || !thumb) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: thumb.offsetLeft - (list.clientWidth - thumb.clientWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  if (!total) return null;
  const current = Math.min(active, total - 1);
  const src = images[current];

  return (
    <>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t("gallery.slider", { title })}
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        <div
          className="relative aspect-[4/3] touch-pan-y overflow-hidden rounded-[2px] bg-paper-2 sm:aspect-[16/10]"
          onPointerDown={(e) => {
            if (many && e.pointerType !== "mouse") swipe.current = { x: e.clientX, moved: false };
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 40) {
              s.moved = true;
              step(dx < 0 ? 1 : -1);
            }
          }}
          onPointerCancel={() => (swipe.current = null)}
        >
          <button
            ref={opener}
            type="button"
            className="group absolute inset-0 cursor-zoom-in"
            onClick={() => {
              // A swipe ends in a click on some browsers; it should only change the photo.
              if (swipe.current?.moved) {
                swipe.current = null;
                return;
              }
              swipe.current = null;
              setOpen(true);
            }}
            aria-label={t("gallery.open", { n: current + 1, total })}
          >
            <Img
              key={src}
              src={src}
              alt={t("gallery.imageAlt", { title, n: current + 1 })}
              sizes="(min-width: 1280px) 1200px, 100vw"
              quality={80}
              imgClassName="zoom-media group-hover:scale-[1.02]"
            />
            <span className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-card/90 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand aria-hidden className="size-4" />
            </span>
          </button>

          {many && (
            <>
              <SlideButton side="left" label={t("gallery.previous")} onClick={() => step(-1)} />
              <SlideButton side="right" label={t("gallery.next")} onClick={() => step(1)} />
              <p aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1 text-[0.82rem] tabular-nums text-ink">
                {current + 1} / {total}
              </p>
            </>
          )}
        </div>

        {many && (
          <ul ref={strip} className="relative mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {images.map((img, i) => (
              <li key={`${img}-${i}`} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={i === current ? "true" : undefined}
                  aria-label={t("gallery.show", { n: i + 1, total })}
                  className={cx(
                    "relative block aspect-[4/3] w-20 overflow-hidden rounded-[2px] outline-offset-2 transition-opacity sm:w-28",
                    i === current ? "opacity-100 ring-2 ring-ink ring-offset-2 ring-offset-paper" : "opacity-60 hover:opacity-100",
                  )}
                >
                  <Img src={img} alt="" sizes="112px" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-label={t("gallery.dialog", { title })}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-black/95 p-0 text-white"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <p className="t-meta flex gap-4 text-white/70">
                <span>{title}</span>
                <span>
                  {current + 1} / {total}
                </span>
              </p>
              <button type="button" onClick={close} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={t("gallery.close")}>
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="relative flex-1">
              <Img key={src} src={src} alt={t("gallery.imageAlt", { title, n: current + 1 })} sizes="100vw" quality={80} noTone imgClassName="object-contain!" />
            </div>
            {many && (
              <div className="flex justify-center gap-2 py-4">
                <button type="button" onClick={() => step(-1)} className="grid size-12 place-items-center rounded-full border border-white/25 hover:bg-white/10" aria-label={t("gallery.previous")}>
                  <ChevronLeft aria-hidden className="size-5" />
                </button>
                <button type="button" onClick={() => step(1)} className="grid size-12 place-items-center rounded-full border border-white/25 hover:bg-white/10" aria-label={t("gallery.next")}>
                  <ChevronRight aria-hidden className="size-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

function SlideButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-ink shadow-sm transition-colors hover:bg-card",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
