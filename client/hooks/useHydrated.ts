"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during SSR and hydration, true afterwards. Use to avoid acting on seed-only server data. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
