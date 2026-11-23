// Server-side reads of the public API for Server Components, generateMetadata, sitemap and robots.
//
// Every reader is a `use cache` function (Cache Components, node_modules/next/dist/docs/01-app/
// 01-getting-started/08-caching.md): the result joins the prerendered page and is refreshed in the
// background about once a minute (`cacheLife`), and each carries a `cacheTag` so a future
// /api/revalidate handler can refresh it on demand. Nothing here throws: when the API can't be
// reached the site renders with empty lists and default settings instead of failing.
import { cacheLife, cacheTag } from "next/cache";
import type { ProjectCard, ProjectDetail, PublicPage } from "./api";
import {
  EMPTY_SETTINGS,
  SLUG_RE,
  isSafeLink,
  toProject,
  type Menus,
  type PublicReview,
  type PublicService,
  type PublicSettings,
  type PublicSeo,
  type PublicSlide,
  type PublicTeamMember,
  type PublicTestimonial,
  type SitemapEntry,
} from "./public-types";
import type { Project } from "./types";
import type { Locale } from "@/i18n/config";

/** Server-to-API address. API_INTERNAL_URL lets a deployment use a private network address. */
export const API_BASE = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

/**
 * The server refreshes in the background about once a minute (`revalidate`); never older than an
 * hour. `stale` (how long a browser may reuse it) must stay at 5 minutes or more: Next.js leaves
 * shorter-lived entries out of the shared page shell and then treats reading them like reading the
 * URL, which blocks metadata ("encountered URL data in generateMetadata()").
 */
const LIFE = { stale: 300, revalidate: 60, expire: 3600 } as const;
const TIMEOUT_MS = 8000;

/** `null` = the API answered 404; `undefined` = failed (unreachable, error status, bad JSON). */
async function getJson<T>(path: string): Promise<T | null | undefined> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

async function getItems<T>(path: string): Promise<T[]> {
  const data = await getJson<{ items?: T[] }>(path);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getSettings(locale: Locale): Promise<PublicSettings> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("settings");
  const data = await getJson<Partial<PublicSettings>>(`/api/public/settings?locale=${locale}`);
  if (!data) return EMPTY_SETTINGS;
  const merged = { ...EMPTY_SETTINGS };
  for (const key of Object.keys(EMPTY_SETTINGS) as (keyof PublicSettings)[]) {
    const value = data[key];
    if (value !== undefined && value !== null) (merged as Record<string, unknown>)[key] = value;
  }
  if (!merged.companyName) merged.companyName = EMPTY_SETTINGS.companyName;
  return merged;
}

export async function getServices(locale: Locale): Promise<PublicService[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("services");
  return getItems<PublicService>(`/api/public/services?locale=${locale}`);
}

export async function getTeam(locale: Locale): Promise<PublicTeamMember[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("team");
  return getItems<PublicTeamMember>(`/api/public/team?locale=${locale}`);
}

export async function getTestimonials(locale: Locale): Promise<PublicTestimonial[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("testimonials");
  return getItems<PublicTestimonial>(`/api/public/testimonials?locale=${locale}`);
}

/** Approved visitor reviews, newest first (at most 30). Shown as written, so no locale. */
export async function getReviews(): Promise<PublicReview[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("reviews");
  // Unlike the other lists, this endpoint answers with a bare array (API_CONTRACTS §6.3a).
  const data = await getJson<PublicReview[]>("/api/public/reviews");
  return Array.isArray(data) ? data : [];
}

export async function getSlides(locale: Locale): Promise<PublicSlide[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("slides");
  const slides = await getItems<PublicSlide>(`/api/public/slides?locale=${locale}`);
  return slides.map((s) => ({ ...s, cta: s.cta && isSafeLink(s.cta.href) ? s.cta : null }));
}

/** Published projects, newest first, mapped for the website components. */
export async function getProjects(locale: Locale): Promise<Project[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("projects");
  return (await getItems<ProjectCard>(`/api/public/projects?locale=${locale}`)).map(toProject);
}

export type ProjectWithSeo = ProjectDetail & { seo?: PublicSeo };

/** One published project: `null` when it doesn't exist, `undefined` when the API failed. */
export async function getProject(slug: string, locale: Locale): Promise<ProjectWithSeo | null | undefined> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("projects", `project:${slug}`);
  if (!SLUG_RE.test(slug)) return null;
  return getJson<ProjectWithSeo>(`/api/public/projects/${slug}?locale=${locale}`);
}

export type PageWithSeo = PublicPage & { seo?: PublicSeo };

/** Uncached page read: custom pages render on each request so admin edits show at once. */
export async function fetchPage(slug: string, locale: Locale): Promise<PageWithSeo | null | undefined> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const res = await fetch(`${API_BASE}/api/public/pages/${slug}?locale=${locale}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return (await res.json()) as PageWithSeo;
  } catch {
    return undefined;
  }
}

/** Search fields of a page record (the fixed pages have one too: home, services, projects…). */
export async function getPageSeo(slug: string, locale: Locale): Promise<PublicSeo | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("pages", `page:${slug}`);
  if (!SLUG_RE.test(slug)) return null;
  const page = await getJson<PageWithSeo>(`/api/public/pages/${slug}?locale=${locale}`);
  return page?.seo ?? null;
}

export async function getNavigation(locale: Locale): Promise<Menus | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("navigation");
  const data = await getJson<Menus>(`/api/public/navigation?locale=${locale}`);
  if (!data || !Array.isArray(data.header) || !Array.isArray(data.footer)) return null;
  return { header: data.header.filter((l) => isSafeLink(l.href)), footer: data.footer.filter((l) => isSafeLink(l.href)) };
}

/** Every indexable published address; `undefined` when the API failed. */
export async function getSitemap(): Promise<SitemapEntry[] | undefined> {
  "use cache";
  cacheLife(LIFE);
  cacheTag("sitemap", "pages", "projects");
  const data = await getJson<{ items?: SitemapEntry[] }>("/api/public/sitemap");
  return Array.isArray(data?.items) ? data.items : undefined;
}
