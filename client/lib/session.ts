"use client";

// The admin session lives on the API server (an HttpOnly cookie the browser sends along).
// This module asks the server who is signed in and shares the answer with every component.
import { useEffect, useSyncExternalStore } from "react";
import { api, UNAUTHENTICATED_EVENT } from "./api";

export type SessionUser = { id: string; name: string; email: string };
/** `undefined` while unknown (server render / first check pending), `null` when signed out. */
type SessionState = SessionUser | null | undefined;

let state: SessionState = undefined;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Asks the server for the current session (once at a time). */
export function refreshSession(): Promise<void> {
  pending ??= api<{ user: SessionUser }>("/api/auth/session")
    .then(({ user }) => set(user))
    .catch(() => set(null))
    .finally(() => {
      pending = null;
    });
  return pending;
}

const onUnauthenticated = () => set(null);

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  };
}

export function useSession(): SessionState {
  const session = useSyncExternalStore(
    subscribe,
    () => state,
    () => undefined,
  );
  useEffect(() => {
    if (state === undefined) void refreshSession();
  }, []);
  return session;
}

/** Signs in on the server. Throws ApiError (e.g. INVALID_CREDENTIALS, RATE_LIMITED) on failure. */
export async function signIn(email: string, password: string): Promise<SessionUser> {
  const { user } = await api<{ user: SessionUser }>("/api/auth/login", { method: "POST", body: { email, password } });
  set(user);
  return user;
}

export async function signOut(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST", body: {} });
  } finally {
    set(null);
  }
}
