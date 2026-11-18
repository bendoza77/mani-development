"use client";

// Demo-only admin "session". It is a flag in localStorage, not authentication:
// anyone with the browser can toggle it. Never reuse this pattern for real access control.
import { useSyncExternalStore } from "react";

const KEY = "lintel:session";
export const DEMO_CREDENTIALS = { email: "demo@lintel.example", password: "lintel-demo" } as const;

export type DemoSession = { name: string; email: string; since: string };
/** `undefined` while unknown (server render / before hydration), `null` when signed out. */
type SessionState = DemoSession | null | undefined;

let cached: { raw: string | null; value: DemoSession | null } = { raw: null, value: null };
const listeners = new Set<() => void>();

function read(): DemoSession | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cached.raw) return cached.value;
  let value: DemoSession | null = null;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.email === "string" && typeof parsed.name === "string") value = parsed;
  } catch {
    value = null;
  }
  cached = { raw, value };
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export function signIn(email: string) {
  const session: DemoSession = { name: "Demo Administrator", email, since: new Date().toISOString() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable: session will not persist */
  }
  listeners.forEach((l) => l());
}

export function signOut() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
