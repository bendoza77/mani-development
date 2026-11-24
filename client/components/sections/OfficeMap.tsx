"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Maximize2, X } from "lucide-react";
import { ContactLink } from "@/components/contact/ContactLink";
import { useSiteSettings } from "@/components/layout/SiteSettings";
import { buttonClass } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";
import { mapsEmbedSrc, mapsHref } from "@/lib/contact";

/**
 * Embedded Google Map of the office with an "Enlarge" view. The inline map loads lazily, and the
 * large map only loads when the visitor opens it. Placed from the coordinates or address in
 * Admin → Settings; with neither set, nothing renders.
 */
export function OfficeMap() {
  const { t, i18n } = useTranslation("contact");
  const { t: tc } = useTranslation("common");
  const s = useSiteSettings();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const iframeTitle = t("map.iframeTitle", { company: s.companyName });
  const embed = mapsEmbedSrc(s, i18n.language);
  const largeEmbed = mapsEmbedSrc(s, i18n.language, 17);
  const href = mapsHref(s);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      d.close();
      opener.current?.focus();
    }
    // The native modal does not stop the page behind it from scrolling.
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  useEffect(() => {
    const d = dialog.current;
    return () => {
      d?.close();
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (!embed) return null;

  return (
    <>
      <figure className="overflow-hidden rounded-[3px] border border-line bg-paper-2">
        <iframe
          src={embed}
          title={iframeTitle}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="block aspect-[4/3] w-full border-0 sm:aspect-video lg:aspect-[4/3]"
        />
        <figcaption className="border-t border-line">
          <button
            ref={opener}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="flex h-11 w-full items-center gap-2 px-4 text-[0.88rem] font-medium transition-colors hover:bg-paper hover:text-accent"
          >
            <Maximize2 aria-hidden strokeWidth={1.75} className="size-4" />
            {t("map.expand")}
          </button>
        </figcaption>
      </figure>

      <dialog
        ref={dialog}
        aria-label={t("map.title")}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="modal m-auto h-[calc(100dvh-2rem)] max-h-[60rem] w-[calc(100%-2rem)] max-w-7xl overflow-visible rounded-md bg-transparent p-0 text-ink"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-line bg-card shadow-card">
          <header className="flex items-center gap-3 border-b border-line py-2.5 pr-2.5 pl-4 sm:pl-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-[1rem] font-semibold">{t("map.title")}</h2>
              <p className="truncate text-[0.82rem] text-muted">{s.address}</p>
            </div>
            {href && (
              <ContactLink channel="map" href={href} className={buttonClass("outline", "sm", "max-sm:px-3")}>
                <span className="max-sm:hidden">{t("map.open")}</span>
                <span className="sm:hidden">Google Maps</span>
                <ArrowUpRight aria-hidden className="size-4" />
                <span className="sr-only"> {tc("a11y.opensInNewTab")}</span>
              </ContactLink>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tc("a11y.closeDialog")}
              className="grid size-11 shrink-0 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          {/* Mounted only while open, so the large map costs nothing until it is asked for. */}
          {open && largeEmbed && (
            <iframe
              src={largeEmbed}
              title={iframeTitle}
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="block min-h-0 w-full flex-1 border-0"
            />
          )}
        </div>
      </dialog>
    </>
  );
}
