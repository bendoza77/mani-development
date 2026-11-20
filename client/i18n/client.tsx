"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import type { Locale } from "./config";
import { createContentLocalizer, type ContentLocalizer } from "./content";
import { createFormatters } from "./format";
import { createI18n } from "./instance";
import type { ContentOverlay, UIResources } from "./resources";

type LocaleContextValue = { locale: Locale; content: ContentLocalizer };

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Client-side i18n. The root layout passes only the active language's resources, so the
 * other language is never shipped to the browser. Switching language re-renders the root
 * layout with the new locale, which creates a fresh instance here.
 */
export function I18nProvider({
  locale,
  resources,
  overlay,
  children,
}: {
  locale: Locale;
  resources: UIResources;
  overlay: ContentOverlay;
  children: ReactNode;
}) {
  const i18n = useMemo(() => createI18n(locale, resources), [locale, resources]);
  const value = useMemo(() => ({ locale, content: createContentLocalizer(overlay) }), [locale, overlay]);
  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    </I18nextProvider>
  );
}

function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <I18nProvider>");
  return ctx;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

/** Localizers for records from the demo database (see `i18n/content`). */
export function useContent(): ContentLocalizer {
  return useLocaleContext().content;
}

export function useFormatters() {
  const { t } = useTranslation("common");
  return useMemo(() => createFormatters(t), [t]);
}

export { useTranslation };
