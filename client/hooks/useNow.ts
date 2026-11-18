"use client";

import { useSyncExternalStore } from "react";

// A shared, minute-granular clock. Server/hydration snapshot is 0 so relative times
// ("5 min ago") render only on the client and never cause hydration mismatches.
const STEP = 30_000;
const read = () => Math.floor(Date.now() / STEP) * STEP;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, STEP);
  return () => window.clearInterval(id);
}

export function useNow() {
  return useSyncExternalStore(subscribe, read, () => 0);
}
