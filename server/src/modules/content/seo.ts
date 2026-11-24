import { z } from "zod";
import type { Config } from "../../config/env.js";
import { pick, toImage, type Image, type Locale } from "../media/media.serialize.js";
import { optionalText } from "./fields.js";

/**
 * Search-engine fields shared by projects and pages (docs/API_CONTRACTS.md §8.2). Every field is
 * an optional override: empty means "use the record's own title, summary and picture".
 */

export const seoInput = z.strictObject({
  titleKa: z.string().trim().max(70).default(""),
  titleEn: optionalText(70),
  titleRu: optionalText(70),
  descriptionKa: z.string().trim().max(200).default(""),
  descriptionEn: optionalText(200),
  descriptionRu: optionalText(200),
  ogImageId: z.uuid().nullable().default(null),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
});

export type SeoInput = z.output<typeof seoInput>;

type SeoColumns = {
  seoTitleKa: string;
  seoTitleEn: string | null;
  seoTitleRu: string | null;
  seoDescriptionKa: string;
  seoDescriptionEn: string | null;
  seoDescriptionRu: string | null;
  ogImageId: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

export const seoColumns = (seo: SeoInput): SeoColumns => ({
  seoTitleKa: seo.titleKa,
  seoTitleEn: seo.titleEn,
  seoTitleRu: seo.titleRu,
  seoDescriptionKa: seo.descriptionKa,
  seoDescriptionEn: seo.descriptionEn,
  seoDescriptionRu: seo.descriptionRu,
  ogImageId: seo.ogImageId,
  robotsIndex: seo.robotsIndex,
  robotsFollow: seo.robotsFollow,
});

/** The stored overrides, for the admin editor. */
export const adminSeo = (row: SeoColumns): SeoInput => ({
  titleKa: row.seoTitleKa,
  titleEn: row.seoTitleEn,
  titleRu: row.seoTitleRu,
  descriptionKa: row.seoDescriptionKa,
  descriptionEn: row.seoDescriptionEn,
  descriptionRu: row.seoDescriptionRu,
  ogImageId: row.ogImageId,
  robotsIndex: row.robotsIndex,
  robotsFollow: row.robotsFollow,
});

type AssetRow = Parameters<typeof toImage>[0];

/**
 * What the website puts in <title>, the description and the share card: the override if set,
 * otherwise the fallbacks the caller passes (already in the visitor's language).
 */
export function publicSeo(
  row: SeoColumns & { ogImage?: AssetRow | null },
  locale: Locale,
  fallback: { title: string; description: string; image: AssetRow | null },
  config: Config,
): { title: string; description: string; image: Image | null; index: boolean; follow: boolean } {
  const image = row.ogImage ?? fallback.image;
  return {
    title: pick(row.seoTitleKa, row.seoTitleEn, row.seoTitleRu, locale) || fallback.title,
    description: pick(row.seoDescriptionKa, row.seoDescriptionEn, row.seoDescriptionRu, locale) || fallback.description,
    image: image ? toImage(image, config, locale) : null,
    index: row.robotsIndex,
    follow: row.robotsFollow,
  };
}
