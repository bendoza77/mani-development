"use client";

import { useCallback, useSyncExternalStore } from "react";

// Small per-browser UI preferences (e.g. collapsed sidebar). Not app data: that lives in lib/store.
const EVENT = "lintel:pref";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useStoredPref(key: string, fallback: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        /* storage unavailable: preference simply won't persist */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set] as const;
}
