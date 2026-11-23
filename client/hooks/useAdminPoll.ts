"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_CHANGED_EVENT, api } from "@/lib/api";

/**
 * Keeps a small admin resource fresh (bell, inbox badge): loads it, then again every
 * `intervalMs`, when the tab regains focus, when `refreshKey` changes (e.g. the page) and when
 * another part of the panel announces a change. The last answer stays shown while reloading.
 */
export function useAdminPoll<T>(path: string | null, { intervalMs = 60_000, refreshKey }: { intervalMs?: number; refreshKey?: unknown } = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const ctrl = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (!path) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    api<T>(path, { signal: c.signal }).then(
      (next) => setData(next),
      () => {
        /* keep the last answer; a 401 is handled by the session */
      },
    );
  }, [path]);

  useEffect(() => {
    if (!path) return;
    refresh();
    const id = window.setInterval(refresh, intervalMs);
    const onFocus = () => document.visibilityState === "visible" && refresh();
    window.addEventListener(ADMIN_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(ADMIN_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", onFocus);
      ctrl.current?.abort();
    };
  }, [path, intervalMs, refresh, refreshKey]);

  return { data, setData, refresh };
}
