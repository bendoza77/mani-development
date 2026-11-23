import type { Config } from "../../config/env.js";
import { mediaUrl } from "../../integrations/media-storage.js";

export const LOCALES = ["ka", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export type Image = { id: string; src: string; width: number; height: number; alt: string };

type AssetRow = {
  id: string;
  provider: string;
  providerKey: string;
  width: number;
  height: number;
  altKa: string;
  altEn: string | null;
  altRu: string | null;
};

/**
 * The visitor's language, falling back when it's empty (docs/API_CONTRACTS.md §1):
 * English → Georgian; Russian → English → Georgian.
 */
export function pick(ka: string, en: string | null | undefined, ru: string | null | undefined, locale: Locale): string {
  if (locale === "ru" && ru) return ru;
  if (locale !== "ka" && en) return en;
  return ka;
}

/** The same fallback for lists, where an empty list counts as "not translated". */
export function pickList(ka: string[], en: string[], ru: string[], locale: Locale): string[] {
  if (locale === "ru" && ru.length) return ru;
  if (locale !== "ka" && en.length) return en;
  return ka;
}

/** The same fallback for rich-text documents, where null or undefined counts as "not translated". */
export function pickDoc<T>(ka: T, en: T | null | undefined, ru: T | null | undefined, locale: Locale): T {
  if (locale === "ru" && ru != null) return ru;
  if (locale !== "ka" && en != null) return en;
  return ka;
}

export function toImage(asset: AssetRow, config: Config, locale: Locale = "ka"): Image {
  return {
    id: asset.id,
    src: mediaUrl(asset, config),
    width: asset.width,
    height: asset.height,
    alt: pick(asset.altKa, asset.altEn, asset.altRu, locale),
  };
}

export function toMediaAsset(
  asset: AssetRow & { filename: string; bytes: number; mimeType: string; category: string; createdAt: Date },
  config: Config,
) {
  return {
    ...toImage(asset, config),
    altKa: asset.altKa,
    altEn: asset.altEn,
    altRu: asset.altRu,
    category: asset.category,
    filename: asset.filename,
    bytes: asset.bytes,
    mimeType: asset.mimeType,
    createdAt: asset.createdAt.toISOString(),
  };
}
