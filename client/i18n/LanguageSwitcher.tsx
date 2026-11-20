"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/format";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_LABELS, LOCALES, localizeHref, splitLocale, type Locale } from "./config";
import { useLocale } from "./client";

function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Language links. Each is a real link to the same page in the other language (so it works
 * without JavaScript and can be opened in a new tab); a normal click switches in place with a
 * client-side navigation, keeping the query string, hash and scroll position.
 */
export function LanguageSwitcher({ variant = "compact", className }: { variant?: "compact" | "full"; className?: string }) {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const router = useRouter();
  const { path } = splitLocale(usePathname());

  const onClick = (e: MouseEvent<HTMLAnchorElement>, target: Locale) => {
    rememberLocale(target);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (target === locale) return;
    const { search, hash } = window.location;
    router.replace(`${localizeHref(path, target)}${search}${hash}`, { scroll: false });
  };

  return (
    <nav aria-label={t("language.label")} className={className}>
      <ul
        className={cx(
          "flex items-center",
          variant === "compact" ? "gap-0.5 rounded-[3px] border border-line p-0.5" : "gap-2",
        )}
      >
        {LOCALES.map((l) => {
          const active = l === locale;
          const label = LOCALE_LABELS[l];
          return (
            <li key={l}>
              <a
                href={localizeHref(path, l)}
                hrefLang={label.htmlLang}
                lang={label.htmlLang}
                aria-current={active ? "true" : undefined}
                aria-label={variant === "compact" ? label.native : undefined}
                title={variant === "compact" ? label.native : undefined}
                onClick={(e) => onClick(e, l)}
                className={cx(
                  "inline-flex items-center justify-center rounded-[2px] font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  variant === "compact"
                    ? "h-8 min-w-9 px-2 font-mono text-[0.72rem] tracking-[0.06em]"
                    : "h-11 min-w-11 border px-4 text-[0.95rem]",
                  variant === "compact" &&
                    (active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink"),
                  variant === "full" &&
                    (active
                      ? "border-night-ink bg-night-ink text-night"
                      : "border-white/20 text-night-ink hover:border-white/50"),
                )}
              >
                {variant === "compact" ? label.short : label.native}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
