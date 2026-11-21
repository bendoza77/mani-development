"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type Loaded<T> = { key: string; data?: T; error?: ApiError };

/**
 * Loads `path` from the API in the browser. Pass `null` to skip loading.
 * `reload()` fetches again; `update()` changes the loaded data locally after a save.
 */
export function useApiData<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Loaded<T> | null>(null);
  const key = `${path}#${version}`;

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    api<T>(path, { signal: ctrl.signal }).then(
      (data) => setState({ key, data }),
      (error: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ key, error: error instanceof ApiError ? error : new ApiError(0, "UNKNOWN", "Something went wrong.") });
      },
    );
    return () => ctrl.abort();
  }, [path, key]);

  const current = state?.key === key ? state : null;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const update = useCallback(
    (fn: (data: T) => T) => setState((s) => (s?.data === undefined ? s : { ...s, data: fn(s.data) })),
    [],
  );
  return { data: current?.data, error: current?.error, loading: !!path && !current, reload, update };
}
