"use client";

import { useEffect } from "react";
import { useLocale } from "@/i18n/client";
import { useDB } from "@/lib/store";

/**
 * Keeps <html data-theme> in sync with the theme preference stored in prototype settings, and
 * keeps the `js` class (set by the inline head script on the first page load) in place.
 *
 * Switching language re-renders the root layout's <html> element, which resets both to their
 * server values, and the head script does not run again on the client, so both are re-applied
 * whenever the locale changes.
 */
export function ThemeSync() {
  const theme = useDB((d) => d.settings.theme);
  const locale = useLocale();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");
    if (theme !== "system") {
      root.setAttribute("data-theme", theme);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.setAttribute("data-theme", mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, locale]);

  return null;
}
