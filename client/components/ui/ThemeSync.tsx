"use client";

import { useEffect } from "react";
import { useStoredPref } from "@/hooks/useStoredPref";
import { useLocale } from "@/i18n/client";

/** Same key the inline head script reads before first paint (app/[lang]/layout.tsx). */
const THEME_KEY = "lintel:theme";

/**
 * Keeps <html data-theme> in sync with this browser's theme preference (light, dark or system;
 * a per-browser choice, never site data), and keeps the `js` class (set by the inline head script
 * on the first page load) in place.
 *
 * Switching language re-renders the root layout's <html> element, which resets both to their
 * server values, and the head script does not run again on the client, so both are re-applied
 * whenever the locale changes.
 */
export function ThemeSync() {
  const [stored] = useStoredPref(THEME_KEY, "light");
  const theme = stored === "dark" || stored === "system" ? stored : "light";
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
