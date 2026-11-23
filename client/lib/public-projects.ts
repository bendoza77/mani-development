"use client";

// Published projects from the API, already in the visitor's language, mapped to the shape the
// existing website components use (client/lib/types.ts `Project`). One request per language is
// shared by every component on the page.
import { useEffect, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/client";
import { api, ApiError, type ProjectCard, type ProjectDetail } from "./api";
import { toProject } from "./public-types";
import type { Project } from "./types";

type ListState = { projects?: Project[]; error?: string };
const lists = new Map<string, ListState>();
const requested = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY: ListState = {};

function loadList(locale: string) {
  if (requested.has(locale)) return;
  requested.add(locale);
  api<{ items: ProjectCard[] }>(`/api/public/projects?locale=${locale}`).then(
    ({ items }) => {
      lists.set(locale, { projects: items.map(toProject) });
      emit();
    },
    (error: unknown) => {
      requested.delete(locale);
      lists.set(locale, { error: error instanceof Error ? error.message : "Could not load projects." });
      emit();
    },
  );
}

/**
 * Published projects, newest first as the API returns them. `projects` is undefined while loading.
 * Pass the list the server already rendered with (`initial`) to skip the browser request.
 */
export function usePublicProjects(initial?: Project[]): ListState {
  const locale = useLocale();
  const state = useSyncExternalStore(
    subscribe,
    () => lists.get(locale) ?? EMPTY,
    () => EMPTY,
  );
  const hasInitial = initial !== undefined;
  useEffect(() => {
    if (!hasInitial) loadList(locale);
  }, [locale, hasInitial]);
  return hasInitial ? { projects: initial } : state;
}

type DetailState = { project?: Project | null; error?: string };
const details = new Map<string, DetailState>();
const detailRequested = new Set<string>();

function loadDetail(key: string, slug: string, locale: string) {
  if (detailRequested.has(key)) return;
  detailRequested.add(key);
  api<ProjectDetail>(`/api/public/projects/${encodeURIComponent(slug)}?locale=${locale}`).then(
    (p) => {
      details.set(key, { project: toProject(p) });
      emit();
    },
    (error: unknown) => {
      detailRequested.delete(key);
      details.set(key, error instanceof ApiError && error.status === 404 ? { project: null } : { error: error instanceof Error ? error.message : "Could not load the project." });
      emit();
    },
  );
}

/** One published project: undefined while loading, null when it doesn't exist (or isn't published). */
export function usePublicProject(slug: string): DetailState {
  const locale = useLocale();
  const key = `${locale}:${slug}`;
  const state = useSyncExternalStore(
    subscribe,
    () => details.get(key) ?? EMPTY,
    () => EMPTY,
  );
  useEffect(() => loadDetail(key, slug, locale), [key, slug, locale]);
  return state;
}
