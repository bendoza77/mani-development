import { lang } from "next/root-params";
import { cache } from "react";
import type { i18n as I18n, TFunction } from "i18next";
import { DEFAULT_LOCALE, hasLocale, type Locale } from "./config";
import { createFormatters } from "./format";
import { createI18n } from "./instance";
import { UI_RESOURCES, type Namespace } from "./resources";

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
