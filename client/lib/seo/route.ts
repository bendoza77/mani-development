// Server helper for each public route's generateMetadata: loads settings, the address's languages
// (sitemap feed) and the fallback description, then calls buildMetadata. All reads are cached
// (lib/public-api.ts), so pages that are otherwise static stay prerenderable.
import type { Metadata } from "next";
import { getLocale, getT } from "@/i18n/server";
import { getSettings, getSitemap } from "@/lib/public-api";
import type { PublicSeo } from "@/lib/public-types";
import { buildMetadata, type MetadataInput } from "./metadata";

type RouteInput = Omit<MetadataInput, "locale" | "settings" | "locales" | "fallbackDescription"> & {
  /** Resolved search fields from the API; they override title, description, image and robots. */
  seo?: PublicSeo | null;
};

export async function routeMetadata({ seo, ...input }: RouteInput): Promise<Metadata> {
  const locale = await getLocale();
  const [settings, sitemap, { t }] = await Promise.all([getSettings(locale), getSitemap(), getT("meta")]);
  return buildMetadata({
    ...input,
    title: seo?.title || input.title,
    description: seo?.description || input.description,
    image: seo?.image ?? input.image,
    index: seo ? seo.index : input.index,
    follow: seo ? seo.follow : input.follow,
    locale,
    settings,
    locales: sitemap?.find((e) => e.path === input.path)?.locales,
    fallbackDescription: t("site.description"),
  });
}
