"use client";

// Prototype data store. One in-memory DB object is the single source of truth for
// the public site and the admin panel. It is persisted to localStorage so demo edits
// survive reloads. Nothing here talks to a server.
import { useSyncExternalStore } from "react";
import { createSeed, DB_VERSION } from "@/data/seed";
import type { ActivityItem, DB, Settings } from "./types";

const DB_KEY = "lintel:db";
export const THEME_KEY = "lintel:theme";

const SERVER_SNAPSHOT: DB = createSeed();
let state: DB = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isEntityArray = (v: unknown) => Array.isArray(v) && v.every((x) => isObj(x) && typeof x.id === "string");

/** Accepts stored data only when its shape is plausible; falls back per field to seed data. */
function sanitize(raw: unknown): DB | null {
  if (!isObj(raw) || raw.version !== DB_VERSION) return null;
  const seed = createSeed();
  const pick = <K extends keyof DB>(key: K): DB[K] => (isEntityArray(raw[key]) ? (raw[key] as DB[K]) : seed[key]);
  const settings = isObj(raw.settings) ? ({ ...seed.settings, ...raw.settings } as Settings) : seed.settings;
  return {
    version: DB_VERSION,
    projects: pick("projects"),
    services: pick("services"),
    testimonials: pick("testimonials"),
    team: pick("team"),
    inquiries: pick("inquiries"),
    media: pick("media"),
    activity: pick("activity"),
    notifications: pick("notifications"),
    settings,
  };
}

function readStorage(): DB {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) return SERVER_SNAPSHOT;
    return sanitize(JSON.parse(raw)) ?? SERVER_SNAPSHOT;
  } catch {
    return SERVER_SNAPSHOT;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = readStorage();
  window.addEventListener("storage", (e) => {
    if (e.key !== DB_KEY) return;
    state = readStorage();
    emit();
  });
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  ensureLoaded();
  return state;
}

/**
 * Subscribe to a slice of the DB. Selectors must return a value that already exists
 * on the state (e.g. `d => d.projects`), not a newly derived array; derive with useMemo.
 */
export function useDB<T>(selector: (db: DB) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(SERVER_SNAPSHOT),
  );
}

export class StorageFullError extends Error {
  constructor() {
    super("Browser storage is full. Remove some uploaded images and try again.");
  }
}

/** Apply an immutable update and persist it. Throws StorageFullError if the quota is exceeded. */
export function commit(recipe: (db: DB) => DB) {
  ensureLoaded();
  const prev = state;
  const next = recipe(prev);
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(next));
    window.localStorage.setItem(THEME_KEY, next.settings.theme);
  } catch (err) {
    if (err instanceof DOMException && /quota/i.test(err.name + err.message)) throw new StorageFullError();
    // Storage unavailable (private mode etc.): keep working in memory.
  }
  state = next;
  emit();
}

export function nowISO() {
  return new Date().toISOString();
}

export function uid(prefix: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

const withActivity = (db: DB, kind: ActivityItem["kind"], message: string): DB => ({
  ...db,
  activity: [{ id: uid("ac"), kind, message, at: nowISO() }, ...db.activity].slice(0, 60),
});

type CollectionKey = "projects" | "services" | "testimonials" | "team" | "inquiries" | "media";
type Item<K extends CollectionKey> = DB[K][number];

/** Generic CRUD helpers for the array collections, each logging to the activity feed. */
export function collection<K extends CollectionKey>(key: K, kind: ActivityItem["kind"]) {
  const list = (db: DB) => db[key] as Item<K>[];
  const set = (db: DB, items: Item<K>[]): DB => ({ ...db, [key]: items });
  return {
    add(item: Item<K>, message: string, position: "start" | "end" = "start") {
      commit((db) =>
        withActivity(set(db, position === "start" ? [item, ...list(db)] : [...list(db), item]), kind, message),
      );
    },
    update(id: string, patch: Partial<Item<K>>, message?: string) {
      commit((db) => {
        const next = set(
          db,
          list(db).map((x) => (x.id === id ? ({ ...x, ...patch } as Item<K>) : x)),
        );
        return message ? withActivity(next, kind, message) : next;
      });
    },
    remove(id: string, message: string) {
      commit((db) => withActivity(set(db, list(db).filter((x) => x.id !== id)), kind, message));
    },
    move(id: string, direction: -1 | 1) {
      commit((db) => {
        const items = [...list(db)];
        const i = items.findIndex((x) => x.id === id);
        const j = i + direction;
        if (i < 0 || j < 0 || j >= items.length) return db;
        [items[i], items[j]] = [items[j], items[i]];
        return set(db, items);
      });
    },
  };
}

export const projectsDB = collection("projects", "project");
export const servicesDB = collection("services", "service");
export const testimonialsDB = collection("testimonials", "testimonial");
export const teamDB = collection("team", "team");
export const inquiriesDB = collection("inquiries", "inquiry");
export const mediaDB = collection("media", "media");

export function updateSettings(patch: Partial<Settings>, message = "Settings updated") {
  commit((db) => withActivity({ ...db, settings: { ...db.settings, ...patch } }, "settings", message));
}

export function markNotifications(ids: string[] | "all", read = true) {
  commit((db) => ({
    ...db,
    notifications: db.notifications.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read } : n)),
  }));
}

export function dismissNotification(id: string) {
  commit((db) => ({ ...db, notifications: db.notifications.filter((n) => n.id !== id) }));
}

/** Called by the public contact form: stores the message locally so it appears in the admin inbox. */
export function recordInquiry(input: { name: string; email: string; phone: string; subject: string; message: string }) {
  const id = uid("q");
  const at = nowISO();
  commit((db) =>
    withActivity(
      {
        ...db,
        inquiries: [{ id, ...input, status: "new", createdAt: at, notes: [] }, ...db.inquiries],
        notifications: [
          {
            id: uid("nt"),
            title: "New inquiry",
            body: `${input.name}: ${input.subject}`,
            href: `/admin/inquiries?id=${id}`,
            at,
            read: false,
          },
          ...db.notifications,
        ],
      },
      "inquiry",
      `New inquiry from ${input.name}`,
    ),
  );
  return id;
}

export function resetDemoData() {
  try {
    window.localStorage.removeItem(DB_KEY);
    window.localStorage.removeItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  state = createSeed();
  emit();
}
