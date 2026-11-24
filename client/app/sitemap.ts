import type { MetadataRoute } from "next";
import { hasLocale, localizeHref, type Locale } from "@/i18n/config";
import { getSitemap } from "@/lib/public-api";
import { absoluteUrl, languageAlternates } from "@/lib/seo/metadata";

/** The fixed pages, listed when the API can't be reached so the sitemap is never empty. */
const FIXED_PATHS = ["/", "/projects", "/services", "/about", "/contact"];

/**
 * One entry per language version of every indexable published address (GET /api/public/sitemap),
 * with absolute URLs and hreflang alternates (each version lists itself, the other and x-default).
 * The feed is a cached read, refreshed about once a minute.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const feed = (await getSitemap()) ?? FIXED_PATHS.map((path) => ({ path, lastModified: undefined, locales: ["ka", "en", "ru"] }));
  return feed.flatMap((entry) => {
    const locales = entry.locales.filter(hasLocale) as Locale[];
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(entry.path, locales)).map(([lang, href]) => [lang, absoluteUrl(href)]),
    );
    return locales.map((locale) => ({
      url: absoluteUrl(localizeHref(entry.path, locale)),
      ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
      alternates: { languages },
    }));
  });
}
