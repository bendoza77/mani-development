// Structured data builders (SEO_ANALYTICS_PERFORMANCE §5). Values come only from settings,
// API records and the configured site address.
import { localizeHref, type Locale } from "@/i18n/config";
import type { PublicSettings } from "@/lib/public-types";
import { absoluteUrl } from "./metadata";

type Json = Record<string, unknown>;

export function websiteJsonLd(settings: PublicSettings, locale: Locale): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.companyName,
    url: absoluteUrl(localizeHref("/", locale)),
    inLanguage: locale,
  };
}

/** The company as a `GeneralContractor` (a LocalBusiness type). Needs at least a name and address. */
export function contractorJsonLd(settings: PublicSettings, locale: Locale): Json | null {
  if (!settings.address) return null;
  const sameAs = [settings.instagramUrl, settings.linkedinUrl, settings.facebookUrl].filter((u) => /^https?:\/\//i.test(u));
  return {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    name: settings.companyName,
    url: absoluteUrl(localizeHref("/", locale)),
    logo: absoluteUrl("/icon.svg"),
    ...(settings.defaultOgImage ? { image: absoluteUrl(settings.defaultOgImage.src) } : {}),
    address: { "@type": "PostalAddress", streetAddress: settings.address, addressCountry: "GE" },
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.latitude !== null && settings.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: settings.latitude, longitude: settings.longitude } }
      : {}),
    ...(/^https:\/\//i.test(settings.mapUrl) ? { hasMap: settings.mapUrl } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Home → … → current page. Each item is a locale-free path and its visible name. */
export function breadcrumbJsonLd(items: { name: string; path: string }[], locale: Locale): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(localizeHref(item.path, locale)),
    })),
  };
}

/** JSON for a <script type="application/ld+json">: `<` is escaped so no value can close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\u003c");
}
