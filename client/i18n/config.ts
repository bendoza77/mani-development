/**
 * Locale configuration shared by the proxy, Server Components and Client Components.
 * Keep this file free of server-only or client-only imports.
 *
 * URL strategy: English (the default) lives at unprefixed paths (`/projects`), Georgian
 * under `/ka` (`/ka/projects`). Internally every route sits under `app/[lang]`, and the
 * proxy rewrites unprefixed requests to `/en/...`.
 */
export const LOCALES = ["en", "ka"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Remembers an explicit language choice so a refresh or an unprefixed link keeps it. */
export const LOCALE_COOKIE = "lintel-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Native names are shown in the switcher; `short` is the compact label. */
export const LOCALE_LABELS: Record<Locale, { native: string; short: string; htmlLang: string; ogLocale: string }> = {
  en: { native: "English", short: "EN", htmlLang: "en", ogLocale: "en_GB" },
  ka: { native: "ქართული", short: "ქა", htmlLang: "ka", ogLocale: "ka_GE" },
};

/** Sections that are never localized (internal CMS). */
export const UNLOCALIZED_PREFIXES = ["/admin"];

export function hasLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Splits a browser pathname into its locale and the locale-free path (always starting with "/"). */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (hasLocale(first) && first !== DEFAULT_LOCALE) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  if (first === DEFAULT_LOCALE) return { locale: DEFAULT_LOCALE, path: `/${rest.join("/")}` };
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

export function isUnlocalizedPath(path: string): boolean {
  return UNLOCALIZED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Turns a locale-free internal href (`/projects?x=1#y`) into the public URL for `locale`.
 * External links, hash-only links and unlocalized sections are returned unchanged.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const pathEnd = href.search(/[?#]/);
  const path = pathEnd === -1 ? href : href.slice(0, pathEnd);
  const suffix = pathEnd === -1 ? "" : href.slice(pathEnd);
  if (locale === DEFAULT_LOCALE || isUnlocalizedPath(path)) return href;
  return `/${locale}${path === "/" ? "" : path}${suffix}`;
}
