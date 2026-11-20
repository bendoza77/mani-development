import { createInstance, type i18n as I18n } from "i18next";
import { DEFAULT_NS, NAMESPACES, type UIResources } from "./resources";
import type { Locale } from "./config";

/**
 * Creates a synchronous, self-contained i18next instance for one locale.
 * Used by the server (cached per locale) and by the client provider (one per active locale).
 */
export function createI18n(locale: Locale, resources: UIResources): I18n {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    // No fallback: every key exists in both languages (checked by `tsc` and `npm run i18n:check`),
    // so a fallback would only hide a missing translation.
    fallbackLng: false,
    supportedLngs: [locale],
    ns: NAMESPACES,
    defaultNS: DEFAULT_NS,
    resources: { [locale]: resources },
    initAsync: false,
    interpolation: { escapeValue: false }, // React escapes output
    returnNull: false,
    returnEmptyString: false,
    saveMissing: process.env.NODE_ENV !== "production",
    missingKeyHandler: (lngs, ns, key) => {
      console.warn(`[i18n] Missing translation "${ns}:${key}" for ${lngs.join(", ")}`);
    },
  });
  return instance;
}
