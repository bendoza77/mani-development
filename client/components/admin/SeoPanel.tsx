"use client";

import { useState } from "react";
import { ChevronDown, ImagePlus, X } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Button } from "@/components/ui/Button";
import { Img } from "@/components/ui/Img";
import { useApiData } from "@/hooks/useApiData";
import type { ApiImage, MediaAsset, SeoFields } from "@/lib/api";
import { cx } from "@/lib/format";

/** The form's copy of the search-engine fields (plain strings while editing). */
export type SeoDraft = {
  titleKa: string;
  titleEn: string;
  descriptionKa: string;
  descriptionEn: string;
  ogImageId: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

export const blankSeo = (): SeoDraft => ({ titleKa: "", titleEn: "", descriptionKa: "", descriptionEn: "", ogImageId: null, robotsIndex: true, robotsFollow: true });

export const seoDraftFrom = (seo: SeoFields | undefined): SeoDraft =>
  seo
    ? {
        titleKa: seo.titleKa,
        titleEn: seo.titleEn ?? "",
        descriptionKa: seo.descriptionKa,
        descriptionEn: seo.descriptionEn ?? "",
        ogImageId: seo.ogImageId,
        robotsIndex: seo.robotsIndex,
        robotsFollow: seo.robotsFollow,
      }
    : blankSeo();

export const seoInputFrom = (d: SeoDraft): SeoFields => ({
  titleKa: d.titleKa.trim(),
  titleEn: d.titleEn.trim() || null,
  descriptionKa: d.descriptionKa.trim(),
  descriptionEn: d.descriptionEn.trim() || null,
  ogImageId: d.ogImageId,
  robotsIndex: d.robotsIndex,
  robotsFollow: d.robotsFollow,
});

/** Browser-side checks matching the API limits; keys are the API's (`seo.titleKa` …). */
export function validateSeo(d: SeoDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.titleKa.trim().length > 70) e["seo.titleKa"] = "At most 70 characters.";
  if (d.titleEn.trim().length > 70) e["seo.titleEn"] = "At most 70 characters.";
  if (d.descriptionKa.trim().length > 200) e["seo.descriptionKa"] = "At most 200 characters.";
  if (d.descriptionEn.trim().length > 200) e["seo.descriptionEn"] = "At most 200 characters.";
  return e;
}

/**
 * Collapsible "Search engines" section for projects and pages: optional title, description and
 * share image overrides, plus the two robots switches. Empty fields fall back to the record's own.
 */
export function SeoPanel({
  value,
  onChange,
  error,
  fallbackTitle,
  fallbackDescription,
  path,
}: {
  value: SeoDraft;
  onChange: (patch: Partial<SeoDraft>) => void;
  /** Error for an API key such as `seo.titleKa`. */
  error: (key: string) => string | undefined;
  fallbackTitle: string;
  fallbackDescription: string;
  /** Public address, shown in the preview. */
  path: string;
}) {
  const hasError = ["titleKa", "titleEn", "descriptionKa", "descriptionEn", "ogImageId"].some((k) => error(`seo.${k}`));
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [picked, setPicked] = useState<ApiImage | null>(null);
  const expanded = open || hasError;

  // The API returns only the image id; find its preview in the media library.
  const needsLookup = expanded && !!value.ogImageId && picked?.id !== value.ogImageId;
  const media = useApiData<{ items: MediaAsset[] }>(needsLookup ? "/api/admin/media" : null);
  const image = value.ogImageId ? (picked?.id === value.ogImageId ? picked : (media.data?.items.find((m) => m.id === value.ogImageId) ?? null)) : null;

  const shownTitle = value.titleKa.trim() || fallbackTitle || "Page title";
  const shownDescription = value.descriptionKa.trim() || fallbackDescription;

  return (
    <section className="min-w-0 rounded-md border border-line bg-card">
      <h2>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        >
          <span>
            <span className="block text-[0.95rem] font-semibold">Search engines</span>
            <span className="mt-0.5 block text-[0.82rem] font-normal text-muted">
              {value.robotsIndex ? "Shown in Google" : "Hidden from Google"}
              {value.titleKa || value.descriptionKa || value.ogImageId ? " · custom text or image" : " · uses the title and summary"}
            </span>
          </span>
          <ChevronDown aria-hidden className={cx("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
        </button>
      </h2>
      {expanded && (
        <div className="grid gap-5 border-t border-line p-5 sm:grid-cols-2 [&>*]:min-w-0">
          <div className="rounded-[3px] bg-paper-2 px-4 py-3 sm:col-span-2" aria-label="What Google may show">
            <p className="t-meta text-muted">What Google may show</p>
            <p className="mt-1.5 truncate text-[0.78rem] text-muted">{path}</p>
            <p className="truncate text-[1rem] text-info">{shownTitle}</p>
            <p className="line-clamp-2 text-[0.82rem] text-ink-soft">{shownDescription || <span className="text-muted">No description yet.</span>}</p>
          </div>
          <BiField
            label="Search title"
            maxLength={70}
            hint="Empty = the page title"
            ka={value.titleKa}
            en={value.titleEn}
            onKa={(v) => onChange({ titleKa: v })}
            onEn={(v) => onChange({ titleEn: v })}
            errorKa={error("seo.titleKa")}
            errorEn={error("seo.titleEn")}
          />
          <BiField
            label="Search description"
            multiline
            rows={3}
            maxLength={200}
            hint="Empty = the summary"
            ka={value.descriptionKa}
            en={value.descriptionEn}
            onKa={(v) => onChange({ descriptionKa: v })}
            onEn={(v) => onChange({ descriptionEn: v })}
            errorKa={error("seo.descriptionKa")}
            errorEn={error("seo.descriptionEn")}
          />
          <div className="sm:col-span-2">
            <p className="text-[0.82rem] font-medium text-ink-soft">Share image</p>
            <p className="mt-0.5 text-[0.8rem] text-muted">Shown when the link is shared on social media. Empty = the main photo. Best at 1200×630.</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="relative aspect-[1200/630] w-44 overflow-hidden rounded-[3px] border border-line bg-paper-2">
                {image && <Img src={image.src} alt="Share image" sizes="176px" />}
                {value.ogImageId && !image && <span className="absolute inset-0 grid place-items-center text-[0.75rem] text-muted">{media.error ? "Preview unavailable" : "Loading…"}</span>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                <ImagePlus aria-hidden className="size-4" /> {value.ogImageId ? "Change" : "Choose image"}
              </Button>
              {value.ogImageId && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ogImageId: null })}>
                  <X aria-hidden className="size-4" /> Remove
                </Button>
              )}
            </div>
            {error("seo.ogImageId") && (
              <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                {error("seo.ogImageId")}
              </p>
            )}
          </div>
          <label className="flex items-start gap-2.5 text-[0.88rem]">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={value.robotsIndex} onChange={(e) => onChange({ robotsIndex: e.target.checked })} />
            <span>
              Show in Google
              <span className="block text-[0.8rem] text-muted">Off = search engines are asked not to list it.</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[0.88rem]">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={value.robotsFollow} onChange={(e) => onChange({ robotsFollow: e.target.checked })} />
            <span>
              Follow links
              <span className="block text-[0.8rem] text-muted">Off = search engines ignore the links on it.</span>
            </span>
          </label>
        </div>
      )}
      <ImagePicker
        open={picker}
        onClose={() => setPicker(false)}
        initial={image ? [image] : []}
        onSelect={([img]) => {
          if (!img) return;
          setPicked(img);
          onChange({ ogImageId: img.id });
        }}
        title="Choose a share image"
      />
    </section>
  );
}
