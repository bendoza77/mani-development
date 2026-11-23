// Page metadata for every public route (SEO_ANALYTICS_PERFORMANCE §2). Pure: callers pass the data.
import type { Metadata } from "next";
import { LOCALE_LABELS, LOCALES, hasLocale, localizeHref, type Locale } from "@/i18n/config";
import type { ApiImage } from "@/lib/api";
import type { PublicSettings } from "@/lib/public-types";

/** The public address of the site, e.g. https://www.manidevelopment.ge (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Staging and previews set SITE_NOINDEX=1: every page then asks search engines not to index it. */
export const SITE_NOINDEX = process.env.SITE_NOINDEX === "1";

/** `x-default` (visitors whose language matches neither version) gets the Georgian address. */
export const X_DEFAULT_LOCALE: Locale = "ka";

/** Used when neither the page nor the settings provide a share image. */
export const FALLBACK_OG_IMAGE = { src: "/images/villa-modern-white.jpg", width: 2000, height: 1334, alt: "" };

/** Absolute URL for a site path or an already absolute address. */
export function absoluteUrl(pathOrUrl: string): string {
  // The home page without a trailing slash, matching the canonical Next.js writes.
  if (pathOrUrl === "/") return SITE_URL;
  return new URL(pathOrUrl, `${SITE_URL}/`).toString();
}

/** hreflang map for a locale-free path: every available language plus x-default. */
export function languageAlternates(path: string, locales: readonly Locale[]): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[LOCALE_LABELS[l].htmlLang] = localizeHref(path, l);
  const xDefault = locales.includes(X_DEFAULT_LOCALE) ? X_DEFAULT_LOCALE : locales[0];
  if (xDefault) languages["x-default"] = localizeHref(path, xDefault);
  return languages;
}

export type MetadataInput = {
  locale: Locale;
  /** Locale-free path, e.g. "/projects/vake-terraces". */
  path: string;
  settings: PublicSettings;
  /** Page title without the company suffix (the root layout's template adds it). */
  title?: string;
  /** Use the title as is (the homepage title already names the company). */
  absoluteTitle?: boolean;
  description?: string;
  /** When the page and the settings have none (meta:site.description). */
  fallbackDescription?: string;
  image?: Pick<ApiImage, "src" | "width" | "height" | "alt"> | null;
  /** Languages this address exists in (from the sitemap feed); both when unknown. */
  locales?: readonly string[];
  index?: boolean;
  follow?: boolean;
  type?: "website" | "article";
};

export function buildMetadata(input: MetadataInput): Metadata {
  const { locale, path, settings } = input;
  const available = (input.locales ?? LOCALES).filter(hasLocale);
  const locales: Locale[] = available.length ? available : [...LOCALES];
  // An address without its own version in this language points search engines at one that exists.
  const canonicalLocale = locales.includes(locale) ? locale : locales.includes(X_DEFAULT_LOCALE) ? X_DEFAULT_LOCALE : locales[0];
  const canonical = localizeHref(path, canonicalLocale);

  const description =
    input.description?.trim() || settings.defaultSeoDescription.trim() || input.fallbackDescription?.trim() || undefined;
  const fullTitle = input.title ? (input.absoluteTitle ? input.title : `${input.title} — ${settings.companyName}`) : undefined;
  const image = input.image ?? settings.defaultOgImage ?? FALLBACK_OG_IMAGE;
  const ogImage = { url: absoluteUrl(image.src), width: image.width, height: image.height, alt: image.alt || fullTitle || settings.companyName };

  const index = !SITE_NOINDEX && input.index !== false;
  const follow = !SITE_NOINDEX && input.follow !== false;

  return {
    ...(input.title ? { title: input.absoluteTitle ? { absolute: input.title } : input.title } : {}),
    description,
    alternates: { canonical, languages: languageAlternates(path, locales) },
    openGraph: {
      type: input.type ?? "website",
      siteName: settings.companyName,
      title: fullTitle,
      description,
      url: canonical,
      locale: LOCALE_LABELS[locale].ogLocale,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => LOCALE_LABELS[l].ogLocale),
      images: [ogImage],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [ogImage] },
    robots: { index, follow },
    ...(settings.googleSiteVerification ? { verification: { google: settings.googleSiteVerification } } : {}),
  };
}
