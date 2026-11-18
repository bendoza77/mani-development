"use client";

import { useEffect } from "react";
import { useDB } from "@/lib/store";

/** Keeps <html data-theme> in sync with the theme preference stored in prototype settings. */
export function ThemeSync() {
  const theme = useDB((d) => d.settings.theme);

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

  return null;
}
