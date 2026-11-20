import { lang } from "next/root-params";
import { cache } from "react";
import type { Metadata } from "next";
import type { i18n as I18n, TFunction } from "i18next";
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, hasLocale, localizeHref, type Locale } from "./config";
import { createContentLocalizer } from "./content";
import { createFormatters } from "./format";
import { createI18n } from "./instance";
import { CONTENT_OVERLAYS, UI_RESOURCES, type Namespace } from "./resources";

/**
 * Server Component helpers. The locale comes from the `[lang]` root segment via `next/root-params`,
 * so no component needs `lang` passed down as a prop.
 */
const instances = new Map<Locale, I18n>();

function instanceFor(locale: Locale) {
  let instance = instances.get(locale);
  if (!instance) {
    instance = createI18n(locale, UI_RESOURCES[locale]);
    instances.set(locale, instance);
  }
  return instance;
}

export const getLocale = cache(async (): Promise<Locale> => {
  const value = await lang();
  // The proxy only ever routes to known locales; this guards direct internal requests.
  return hasLocale(value) ? value : DEFAULT_LOCALE;
});

export async function getT<N extends Namespace = "common">(ns?: N) {
  const locale = await getLocale();
  const i18n = instanceFor(locale);
  const t = i18n.getFixedT(locale, ns ?? "common") as TFunction<N>;
  return { t, i18n, locale };
}

export async function getFormatters() {
  const { t } = await getT("common");
  return createFormatters(t);
}

/** Canonical URL and hreflang alternates for a locale-free path such as "/projects". */
export async function localeAlternates(path: string): Promise<Metadata["alternates"]> {
  const locale = await getLocale();
  return {
    canonical: localizeHref(path, locale),
    languages: Object.fromEntries(LOCALES.map((l) => [LOCALE_LABELS[l].htmlLang, localizeHref(path, l)])),
  };
}

/** Title, description and alternates for a static page whose copy lives in the `meta` namespace. */
export async function pageMetadata(page: "services" | "projects" | "about" | "contact", path: string): Promise<Metadata> {
  const { t } = await getT("meta");
  return { title: t(`${page}.title`), description: t(`${page}.description`), alternates: await localeAlternates(path) };
}

export async function getContent() {
  return createContentLocalizer(CONTENT_OVERLAYS[await getLocale()]);
}
