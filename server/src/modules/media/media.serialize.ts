import type { Config } from "../../config/env.js";
import { mediaUrl } from "../../integrations/media-storage.js";

export type Locale = "ka" | "en";

export type Image = { id: string; src: string; width: number; height: number; alt: string };

type AssetRow = {
  id: string;
  provider: string;
  providerKey: string;
  width: number;
  height: number;
  altKa: string;
  altEn: string | null;
};

/** English falls back to Georgian when it's empty (docs/API_CONTRACTS.md §1). */
export const pick = (ka: string, en: string | null | undefined, locale: Locale) =>
  locale === "en" && en ? en : ka;

export function toImage(asset: AssetRow, config: Config, locale: Locale = "ka"): Image {
  return {
    id: asset.id,
    src: mediaUrl(asset, config),
    width: asset.width,
    height: asset.height,
    alt: pick(asset.altKa, asset.altEn, locale),
  };
}

export function toMediaAsset(
  asset: AssetRow & { filename: string; bytes: number; mimeType: string; createdAt: Date },
  config: Config,
) {
  return {
    ...toImage(asset, config),
    filename: asset.filename,
    bytes: asset.bytes,
    mimeType: asset.mimeType,
    createdAt: asset.createdAt.toISOString(),
  };
}
