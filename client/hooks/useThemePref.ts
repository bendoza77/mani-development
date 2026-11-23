"use client";

import { useEffect } from "react";
import { useStoredPref } from "@/hooks/useStoredPref";

export type ThemePreference = "light" | "dark" | "system";

/** Same key the inline head script reads before first paint (app/[lang]/layout.tsx). */
const THEME_KEY = "lintel:theme";

const isTheme = (v: string): v is ThemePreference => v === "light" || v === "dark" || v === "system";

/** The light/dark preference of this browser (not site data: it is never sent to the API). */
export function useThemePref() {
  const [raw, set] = useStoredPref(THEME_KEY, "light");
  const theme: ThemePreference = isTheme(raw) ? raw : "light";
  return [theme, set as (next: ThemePreference) => void] as const;
}

/** Applies the stored preference to <html data-theme> and follows the system setting for "system". */
export function useApplyTheme() {
  const [theme] = useThemePref();
  useEffect(() => {
    const root = document.documentElement;
    if (theme !== "system") {
      root.setAttribute("data-theme", theme);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.setAttribute("data-theme", mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}
