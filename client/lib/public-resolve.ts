// What lives at a dynamic site address (GET /api/public/resolve, API_CONTRACTS §8.6), for proxy.ts.
// Pure apart from the injected `fetch`, so it can be tested without Next.js.

export type Resolution = { kind: "page" | "project" } | { kind: "redirect"; to: string } | { kind: "none" };

/** Fixed routes under app/[lang]/(site) (and the admin): they never need the API lookup. */
const FIXED = new Set(["", "projects", "services", "about", "contact", "admin"]);

/**
 * True for the addresses served by the dynamic routes: `/<slug>` (custom pages) and
 * `/projects/<slug>`. Paths are locale-free (`/ka` already removed).
 */
export function isDynamicPath(path: string): boolean {
  const parts = path.replace(/\/+$/, "").split("/").slice(1);
  if (parts.length === 1) return !FIXED.has(parts[0]);
  return parts.length === 2 && parts[0] === "projects" && parts[1] !== "";
}

/** Server-to-API address (same rule as lib/public-api.ts). */
export const RESOLVE_API_BASE = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const TTL_MS = 60_000;
const MAX_ENTRIES = 1000;
const TIMEOUT_MS = 1500;

type Entry = { value: Resolution; expires: number };

/**
 * A resolver with a 60-second in-memory cache (hits and misses alike). Returns `null` when the
 * API can't answer (unreachable, slow, error status, unexpected body): the caller then lets the
 * request through, and the page decides (fail open). Failures are not cached.
 */
export function createResolver(apiBase: string, fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, Entry>();

  return async function resolve(path: string): Promise<Resolution | null> {
    const t = now();
    const hit = cache.get(path);
    if (hit && hit.expires > t) return hit.value;
    if (hit) cache.delete(path);

    let value: Resolution | null = null;
    try {
      const res = await fetchImpl(`${apiBase}/api/public/resolve?path=${encodeURIComponent(path)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) value = parse(await res.json());
    } catch {
      value = null;
    }
    if (!value) return null;

    if (cache.size >= MAX_ENTRIES) {
      // Oldest first (Map keeps insertion order).
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(path, { value, expires: t + TTL_MS });
    return value;
  };
}

function parse(body: unknown): Resolution | null {
  if (!body || typeof body !== "object") return null;
  const { kind, to } = body as { kind?: unknown; to?: unknown };
  if (kind === "page" || kind === "project" || kind === "none") return { kind };
  // Only same-site paths are followed (never "//host" or a full URL).
  if (kind === "redirect" && typeof to === "string" && /^\/(?!\/)[^\s?#]*$/.test(to)) return { kind, to };
  return null;
}
