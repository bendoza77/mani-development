"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { Img } from "@/components/ui/Img";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";

/** Editorial gallery grid with an accessible lightbox (native dialog, arrow-key navigation). */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const { t } = useTranslation("projects");
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((dir: number) => setIndex((i) => (i === null ? i : (i + dir + images.length) % images.length)), [images.length]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    if (index === null && d.open) {
      d.close();
      opener.current?.focus();
    }
  }, [index]);

  useEffect(() => {
    const d = dialog.current;
    return () => d?.close();
  }, []);

  if (!images.length) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-[clamp(0.5rem,1.2vw,1rem)] md:grid-cols-6">
        {images.map((src, i) => (
          <li
            key={`${src}-${i}`}
            className={cx(
              "relative",
              i % 4 === 0 ? "col-span-2 aspect-[16/10] md:col-span-4" : i % 4 === 1 ? "aspect-[4/5] md:col-span-2" : "aspect-[4/3] md:col-span-3",
            )}
          >
            <button
              type="button"
              className="group absolute inset-0 overflow-hidden rounded-[2px]"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setIndex(i);
              }}
              aria-label={t("gallery.open", { n: i + 1, total: images.length })}
            >
              <Img src={src} alt={t("gallery.imageAlt", { title, n: i + 1 })} sizes="(min-width: 768px) 60vw, 100vw" imgClassName="zoom-media group-hover:scale-[1.03]" />
              <span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-card/90 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Expand aria-hidden className="size-4" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={t("gallery.dialog", { title })}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-black/95 p-0 text-white"
      >
        {index !== null && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <p className="t-meta text-white/70">
                {index + 1} / {images.length} · {title}
              </p>
              <button type="button" onClick={close} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={t("gallery.close")}>
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="relative flex-1">
              <Img key={images[index]} src={images[index]} alt={t("gallery.imageAlt", { title, n: index + 1 })} sizes="100vw" quality={80} noTone imgClassName="object-contain!" />
            </div>
            <div className="flex justify-center gap-2 py-4">
              <button type="button" onClick={() => step(-1)} className="grid size-12 place-items-center rounded-full border border-white/25 hover:bg-white/10" aria-label={t("gallery.previous")}>
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <button type="button" onClick={() => step(1)} className="grid size-12 place-items-center rounded-full border border-white/25 hover:bg-white/10" aria-label={t("gallery.next")}>
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
