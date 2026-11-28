# Performance audit — 26 November 2026

**Status:** findings and plan only. No source code was changed. Awaiting approval before Phase 1.

**Scope:** `client/` (Next.js 16.4.6, Cache Components, Tailwind 4) on Vercel, `server/` (Express 5, Prisma 7, PostgreSQL 18) on Render Frankfurt, Cloudflare Images for uploads. The site is not live yet, so there is no production traffic or Vercel metrics to read; every number below was measured locally on the development machine against the local Docker PostgreSQL with the seed data, unless marked *estimate*.

How to read the labels:

- **Measured** = a number I produced in this audit and can reproduce.
- **Estimate** = my expectation; it has to be confirmed by a before/after measurement when the change is made.
- **Confirmed bottleneck** = the cost is visible in a measurement or follows directly from the code.
- **Needs investigation** = plausible, not yet proven.

---

## 1. Architecture as found

- The public site renders on the Next.js server. Every public reader in `client/lib/public-api.ts` is a `use cache` function (stale 5 min, revalidate 60 s, expire 1 h) with cache tags, so most page views never reach the API. Menus, settings, slides, testimonials, reviews and the project list are all in the first HTML.
- Exception: admin-built pages (`/[slug]`) are read **uncached** on every request (`fetchPage`, `cache: "no-store"`) so edits show at once. The planned revalidation webhook (INTEGRATIONS.md §8) is not built yet, which is why this workaround exists.
- `client/proxy.ts` asks the API what lives at every dynamic address (`/<slug>`, `/projects/<slug>`) before rendering, with a 60 s in-memory cache per server instance.
- The API has no caching layer and sets no `Cache-Control` on public responses; Express's default weak ETag is on. There is no compression middleware. Rate limits are in memory. One Prisma client with a pool of 10.
- Background work: an email outbox (30 s poll, `FOR UPDATE SKIP LOCKED`) and an hourly token cleanup. Both are small and correct.
- Database: 24 tables, UUID v7 keys, indexes on every filter/sort used by the public routes (`projects(is_published, updated_at desc)`, `reviews(status, created_at desc)`, `home_slides(is_published, position)`, unique slugs, etc.). No N+1 queries anywhere; every list is one `findMany` with `include`.
- Images: local `/images/*` go through `next/image` (AVIF/WebP, responsive). **Uploaded images do not**: `components/ui/Img.tsx` renders them as a plain `<img>` with the single Cloudflare `public` variant URL.
- Fonts: six `next/font` families; Georgian and Russian companions are not preloaded and only download when their script is on the page (good).
- 3D hero: three.js is a separate chunk, loaded when the viewer is within 600 px of the viewport, with a WebGL check, demand-driven frame loop, instanced meshes and unmount on route change. Well engineered, but on the home page the hero is at the top, so the chunk always loads immediately.

## 2. Baseline (measured)

### 2.1 API, compiled build, `LOG_LEVEL=warn`, seed data (11 published projects, 41 gallery rows)

Sequential, 200 requests each, warm:

| Endpoint | Bytes | p50 ms | p95 ms | p99 ms | req/s |
|---|---|---|---|---|---|
| `GET /api/public/projects?locale=ka` | 8 396 | 2.5 | 3.4 | 4.1 | 381 |
| `GET /api/public/projects/:slug` | 2 750 | 1.9 | 2.2 | 3.8 | 524 |
| `GET /api/public/pages/home` | 1 372 | 3.2 | 3.8 | 6.3 | 306 |
| `GET /api/public/services` | 10 069 | 1.5 | 1.8 | 3.1 | 656 |
| `GET /api/public/navigation` | 617 | 1.3 | 1.7 | 2.5 | 750 |
| `GET /api/public/settings` | 605 | 1.2 | 1.7 | 2.3 | 774 |
| `GET /api/public/resolve?path=…` (miss) | 15 | 1.1 | 1.4 | 2.9 | 845 |
| `GET /api/health/ready` | 42 | 0.6 | 0.7 | 0.9 | 1 647 |

20 concurrent clients, 600 requests: projects list p50 59 ms, p95 98 ms, p99 113 ms, 319 req/s; project detail 654 req/s; navigation/settings/slides about 1 300 req/s. No errors.

Other API facts: no `Content-Encoding` on any response; no `Cache-Control` on public routes; weak `ETag` present. Cold start to ready: 1.17 s. One request log line at `info` level is about 1.3 KB and includes the health probes.

### 2.2 API at scale (scratch database `mani_perf`, 311 published projects, 2 441 gallery rows)

| Endpoint | Bytes | gzip | p50 ms | p95 ms | req/s (sequential) |
|---|---|---|---|---|---|
| `GET /api/public/projects` | **180 441** | 21 172 | 25.4 | 72.1 | 31 |
| `GET /api/public/projects/:slug` | 3 155 | — | 2.5 | 3.6 | 391 |
| `GET /api/public/sitemap` | 33 649 | — | — | — | — |

`EXPLAIN ANALYZE` on the list's SQL: 0.55 ms for the projects scan and sort, 1.6 ms for the gallery join. The 25 ms is spent in Prisma hydration and JSON serialization of gallery and spec rows the list endpoint never sends (see finding 6). Slug lookups for `resolve` are index scans at 0.02 ms.

### 2.3 Next.js production build (local `next start`, API on 127.0.0.1)

| Page | HTML gz | TTFB (warm) | Note |
|---|---|---|---|
| `/` (English home) | 29.4 KB | 7–30 ms | |
| `/ka` | 34.5 KB | 7–22 ms | Georgian text is longer |
| `/projects` | 20.4 KB | 7–24 ms | |
| `/projects/tskneti-forest-house` | 19.8 KB | 8–50 ms | first hit of an unprerendered slug 51 ms |
| `/sample-blocks` (admin-built page) | 29.1 KB | 4–22 ms, **total 45–67 ms** | two uncached API calls per request |
| `/does-not-exist` | 14.5 KB | 8–19 ms | real 404 via proxy |

Static routes are served with `Cache-Control: s-maxage=60, stale-while-revalidate=3540` and gzip.

Browser load of `/` (Chrome, desktop, local, cold cache):

| Asset type | Files | Transferred | Note |
|---|---|---|---|
| JavaScript | 19 | **521 KB** gz (1.77 MB decoded) | three.js/R3F chunk alone 266 KB gz; everything else 255 KB gz |
| Fonts | 9 | **464 KB** | two Newsreader files are 132 KB + 147 KB (normal + italic, optical-size axis) |
| Images | 4 | 608 KB | icon + three slider images (all three load although one is visible) |
| CSS | 1 | 19 KB gz (101 KB raw) | |
| RSC prefetches | 4 | 10 KB | links in the hero |

CLS 0.0002, zero long tasks, DOMContentLoaded 123 ms, load 360 ms. `/ka` adds one Georgian font (66 KB). A project page downloads 11 images (about 700 KB decoded) and 18 JS files (no three.js). LCP could not be measured reliably here (the automated tab was in the background, which defers paint timing); a Lighthouse mobile run on staging is the right tool for that and is part of Phase 5.

Production client JS, all 54 chunks: 3.63 MB raw. Admin-only libraries (Tiptap 135 KB gz, Recharts 115 KB gz, dnd-kit, motion) are correctly split and not on public pages.

### 2.4 Development-only observation

Requests to `http://localhost:4000` take ~210 ms each on this machine versus 2 ms to `http://127.0.0.1:4000`: the API binds IPv4 only and Windows tries `::1` first. `client/.env.local` uses `localhost`, so local dev pages pay this on every server-side fetch. Production is not affected.

---

## 3. Findings

Each item: problem, where, root cause, evidence, impact, fix, expected gain, effort, risk, priority.

### Confirmed bottlenecks

**1. Uploaded images have no responsive sizes or modern formats — HIGH**
- Where: `client/components/ui/Img.tsx:41-49`; `server/src/integrations/media-storage.ts:135`.
- Cause: non-local sources render as a plain `<img src>`; the API builds `imagedelivery.net/<hash>/<id>/public`, one variant for every screen. INTEGRATIONS.md §1.5 planned a custom `next/image` loader with Cloudflare flexible variants; it was never built.
- Evidence: code; in the local build these images happen to go through `next/image` because the seed uses the STATIC provider, so the local numbers understate the production cost.
- Impact: every phone downloads the desktop-size cover, slide and gallery images. This is the single biggest risk to the 2.5 s LCP target on mobile, since the project cover and slides are the largest visible elements.
- Fix: enable flexible variants on the Cloudflare account (one PATCH call, documented in INTEGRATIONS §1.5), add `images.loader: "custom"` + `loaderFile` that emits `/w=<width>,q=<quality>,f=auto` for `imagedelivery.net` URLs and passes `/images/*` through unchanged, and render uploaded media with `next/image` so the existing `sizes` props produce a `srcset`. Keep `preload` on the one above-the-fold image.
- Expected gain: *estimate* 3–6× fewer image bytes on phones; measured after the change with the same browser script.
- Effort: small (one loader file, one branch in `Img.tsx`, one Cloudflare setting). Risk: low; needs the Cloudflare account hash on staging to verify. Image Optimization on Vercel is bypassed (no metered transformations).

**2. Fonts: 464 KB on the first visit — HIGH**
- Where: `client/app/[lang]/layout.tsx:17-57`.
- Cause: Newsreader is requested with `style: ["normal", "italic"]` and `axes: ["opsz"]`; variable axes and italic each add a full file. Geist Mono (latin + cyrillic) is loaded on every page but used only for the logo tagline and the language-switcher label (`components/brand/Logo.tsx:33`, `i18n/LanguageSwitcher.tsx:59`). No public component uses italic text (grep: none; `<em>` is rendered as a plain `<span>`).
- Evidence: measured 9 font files, 464 KB; the two Newsreader files are 279 KB of that.
- Fix: drop the `opsz` axis (static optical size), drop `italic` unless the design needs it, and either remove Geist Mono (fall back to the sans stack for those two labels, keeping the letter-spacing) or keep only the latin subset.
- Expected gain: *estimate* 250–330 KB less per first visit; exact figure from the rebuilt font manifest.
- Effort: tiny. Risk: visual; needs a look at the logo tagline and headings after the change (design rule memory: no mono labels on the public site, so this also aligns with the design direction).

**3. Vercel functions default to Washington (iad1) while the API and database are in Frankfurt — HIGH (infrastructure, free)**
- Where: `client/vercel.json` has no `regions`; no route exports `preferredRegion`.
- Cause: Vercel's default function region is `iad1`. Hobby projects may choose one region.
- Impact: every server-side fetch that misses the cache, every uncached custom-page read, and the proxy's `resolve` lookup crosses the Atlantic. *Estimate* 90–120 ms per round trip; a custom page does two of them in series (finding 4), the proxy adds another before rendering starts.
- Fix: `"regions": ["fra1"]` in `vercel.json`. Verify after the first staging deploy by comparing TTFB of `/sample-blocks` with and without it.
- Effort: one line. Risk: none. Cost: none. Also closes the "function region" open item in SEO_ANALYTICS_PERFORMANCE §12.

**4. Admin-built pages read the API twice per request, uncached — HIGH**
- Where: `client/lib/public-api.ts:131-144` (`fetchPage`, `cache: "no-store"`); called from both `generateMetadata` and `PageContent` in `client/app/[lang]/(site)/[slug]/page.tsx:29,49`; the API also runs a second sequential query for settings (`server/src/modules/pages/pages.routes.ts:215`).
- Evidence: locally `/sample-blocks` takes 45–67 ms total against 10 ms for cached pages. In production each of the two calls is a cross-region round trip plus the API's two queries.
- Fix, step 1 (now): wrap `fetchPage` in React `cache()` so metadata and body share one request. Step 2 (Phase 3): build the planned revalidation webhook (`POST /api/revalidate` on the frontend, called by the API after page/project/settings/menu/slide mutations, with `revalidateTag`), then switch `fetchPage` to `use cache` like every other reader. Also parallelise the settings query on the server with `Promise.all`.
- Expected gain: step 1 halves the API work per custom-page view (measured locally after the change); step 2 makes custom pages as fast as the rest (*estimate* TTFB from hundreds of ms to tens of ms in production).
- Effort: step 1 tiny; step 2 medium (frontend route handler, API hook after each mutation, shared secret in both environments). Risk: step 2 touches every admin mutation path; needs tests that each mutation triggers the right tag.

**5. Public project list serialises data the cards never use — MEDIUM**
- Where: `server/src/modules/projects/projects.routes.ts:94-99` (`withMedia` includes `gallery` with media rows, `specs`, `ogImage`) used by the public list at `:337-344`, whose `toCard` returns only the cover.
- Evidence: at 311 projects the response is 180 KB and p50 25 ms (31 req/s); at 11 projects 8 KB and 2.5 ms. SQL is under 2 ms in both cases; the rest is Prisma hydration and JSON of unused rows.
- Fix: a `cardInclude = { cover: true }` for the public list (and for the admin list, which also only shows summaries). Keep `withMedia` for detail routes.
- Expected gain: *estimate* response size and time proportional to gallery size disappear; measured with the scratch database before/after.
- Effort: small. Risk: low; `toCard` already only reads `cover`. Run the server tests.

**6. Every visitor of a custom page probes the admin session — MEDIUM**
- Where: `client/components/live-edit/EditablePage.tsx:31-41`.
- Cause: the "Edit page" button needs to know whether an admin is signed in, so every browser sends `GET /api/auth/session` with credentials. Visitors get a 401, and because 4xx is logged at `warn` (`server/src/middleware/request-context.ts:17-21`), every custom-page view writes a warning to the production log.
- Fix: probe only when a cheap hint says it is worth it, for example a non-sensitive `admin-ui=1` cookie (not HttpOnly, no auth value) set by the admin shell at sign-in and cleared at sign-out, or `localStorage` from `useAdminSession`. Security is unchanged: the API still decides.
- Expected gain: one fewer cross-origin request per custom-page view and a quiet log; *estimate* a few hundred ms less network contention on slow phones.
- Effort: small. Risk: low.

**7. No compression or cache headers on the API — MEDIUM**
- Where: `server/src/app.ts` (no compression middleware); public routes set no `Cache-Control`.
- Evidence: all responses `Content-Encoding: none`; largest public payloads 8–10 KB today, 180 KB at scale (21 KB gzipped).
- Context: a Render community thread states Render's proxy compresses responses by default (Brotli). This is not in Render's official docs, so treat it as unverified until checked on staging (`curl -I --compressed`).
- Fix: if staging shows no compression, add Node's built-in zlib via a small middleware or the `compression` package for `application/json`. Add `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` to public GETs (the Next.js server already caches; this helps the browser-side fallbacks in `lib/navigation.ts`, `lib/public-projects.ts` and any future CDN in front of the API). Keep `no-store` on auth/admin as it is.
- Expected gain: modest today; it matters once content grows. Effort: small. Risk: none for public, read-only data. Cache invalidation: `s-maxage=60` is the same freshness window the site already accepts.

**8. The three.js chunk (266 KB gz) always loads with the home page — MEDIUM (product decision)**
- Where: `client/components/3d/house/HouseViewer.tsx:69,95-99`; the hero sits at the top (decision Q-20), so the 600 px "near" margin is met on load.
- Evidence: measured 266 KB gz of the 521 KB total; it is the largest single download on the home page and competes with fonts and the first images during the LCP window.
- Options: (a) keep the position but start the import after the page is idle (`requestIdleCallback` or `window.load`), keeping the SVG drawing as the first paint; (b) keep as is and measure on staging first. The plan already names (a) as the fallback if targets are missed.
- Expected gain: *estimate* removes 266 KB from the critical window; LCP effect to be measured with Lighthouse on staging.
- Effort: tiny. Risk: the house appears a moment later on fast connections; the drawing covers it.

### Opportunities that need more investigation or a larger change

**9. i18next on the client — MEDIUM, Phase 4**
- `i18next` + `react-i18next` cost about 39 KB gz on every public page, and the full active-locale resources (30–45 KB raw) travel in the RSC payload. Several sections are client components only to call `t()` (for example `Hero.tsx`). Converting them to server components that receive strings (or only the few keys they need) would shrink both. Larger refactor; do after Phases 1–3 and measure with the build manifest.

**10. All slider images load although one is visible — LOW**
- `components/sections/home/Slider.tsx:115-121`: three slides in a horizontal scroll-snap row, all with `loading="lazy"`, yet all three downloaded (Chrome's lazy-load distance applies horizontally). 608 KB locally. Finding 1 shrinks each; rendering only the current and next slide's `src` would remove the rest. Low priority because the slider is below the hero.

**11. Request logging — LOW**
- `server/src/middleware/request-context.ts`: every request, including every Render health probe, writes a ~1.3 KB JSON line at `info`. Add `autoLogging.ignore` for `/api/health/*` and trim the request serializer to method, url, status, duration and request id. Saves log volume and a little CPU; no functional change.

**12. Admin media list has no pagination — LOW**
- `server/src/modules/media/media.routes.ts:102-110` returns up to 500 assets; `ImagePicker` reloads it each time it opens. Fine for the next year; paginate or search when the library passes a few hundred images.

**13. Proxy lookup per dynamic address — LOW, mitigated by finding 3**
- `client/proxy.ts` + `lib/public-resolve.ts`: the 60 s cache is per server instance, so on Vercel many requests still pay one API round trip before rendering. Putting functions in `fra1` makes that round trip short. A shared cache would need infrastructure the project has decided not to add; not recommended now.

**14. Development loopback latency — LOW (dev only)**
- Change `client/.env.local` to `http://127.0.0.1:4000`, or bind the API host to `::`. Measured 210 ms vs 2 ms per connection.

### Checked and fine (no action)

- Database indexes, query plans (all sub-millisecond; no sequential scans on filtered lookups), no N+1, pool of 10 is right for the 0.1 CPU Postgres plan.
- `use cache` reads are deduplicated (root layout, site layout and pages all call `getSettings` once per render).
- Admin polling: three small requests per minute per open admin tab.
- Server components for featured projects, team, services; menus in the first HTML; fonts with `display: swap`; reduced-motion handled everywhere; no third-party script before consent; Tag Manager after interaction.
- Rate limits in memory are correct for one Render instance (documented).
- Email outbox and token cleanup: lock-safe, small batches, `unref`'d timers, graceful shutdown.
- Build: 159 static pages prerender in 2.9 s; Turbopack compile 5 s.
- Redis or another cache tier: **not justified**. The Next.js data cache already keeps the API out of almost every page view, and the API itself answers in 1–3 ms.

---

## 4. Implementation roadmap

**Phase 1 — quick wins (hours, low risk):** findings 3 (`fra1`), 2 (fonts), 4 step 1 (`cache()` around `fetchPage`, parallel settings query), 5 (card include), 6 (session probe hint), 11 (health-probe logging), 14 (dev `.env.local`). Benchmarks: rerun `bench.mjs` against the scratch database, rebuild and re-read font/JS totals in the browser, run server tests (from PowerShell) and `tsc`/`eslint` in both packages.

**Phase 2 — frontend, backend, delivery (a day):** finding 1 (Cloudflare loader + flexible variants, verified on staging with the real account hash), finding 7 (API `Cache-Control`; compression only if staging shows Render does not compress), finding 10 (slider `src` gating). Benchmarks: image bytes per page at 390 px and 1440 px viewports; API header check on staging.

**Phase 3 — architecture:** finding 4 step 2 (revalidation webhook; custom pages become cached), finding 8 if you choose option (a). Benchmarks: custom-page TTFB on staging before/after; cache-tag tests for each admin mutation.

**Phase 4 — advanced:** finding 9 (client i18n footprint, more server components), finding 12 (media pagination), finding 13 only if staging numbers show the proxy lookup matters after `fra1`.

**Phase 5 — final benchmarking and regression:** same API benchmark (seed and scratch database), same browser script on the production build, Lighthouse mobile on staging for home, projects, a project, a custom page and contact (targets LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms per the plan), full server test suite, client `tsc`, `eslint`, `i18n:check`, and a before/after report.

## 5. Reproduction notes

- API benchmark script: `C:\Users\User\AppData\Local\Temp\claude\be57a635ed8e1112\61a54084-ac0c-4b11-b3fd-be6fd7f19f5f\scratchpad\bench.mjs` (`node bench.mjs http://127.0.0.1:<port> <requests> <concurrency>`). Copy it somewhere durable if you want to keep it.
- Scratch database `mani_perf` (mani_dev plus 300 synthetic published projects, 8 gallery images each) is in the local Docker PostgreSQL. Remove with `docker exec mani-development-postgres-1 psql -U postgres -c "DROP DATABASE mani_perf"` when no longer needed.
- The temporary production build (`client/.next-audit`) and the two local servers were removed/stopped. The `include` lines the build added to `client/tsconfig.json` were reverted.

---

## 6. Implementation results (26 November 2026, uncommitted)

Same machine, same tools and data as the baseline. "Staging" marks what can only be measured after deployment.

### Before and after (measured)

| What | Before | After |
|---|---|---|
| Public project list, 311 projects: p50 / p95 / req/s | 25.4 ms / 72.1 ms / 31 | 9.6 ms / 30.0 ms / 78 |
| Public page read (`/pages/home`) p50 | 3.2 ms | 1.8 ms |
| API reads per admin-built page view | 2 | 1 |
| Fonts on the English home page | 9 files, 464 KB | 7 files, 336 KB |
| Font files preloaded on every page | 6 | 3 |
| three.js (259 KB gz) starts | with the page | after the load event and idle time |
| JS requested before the load event, home | 521 KB (all) | 229 KB |
| Slider images on first view (3 slides) | 3 | 2 |
| Session probes per admin-built page view, visitor | 1 | 0 |
| Health-probe log lines | one ~1.3 KB line per probe | none |
| Public API `Cache-Control` | none | `public, max-age=0, s-maxage=60, stale-while-revalidate=300` with `Vary: Origin`; errors, page reads and the address lookup `no-store` |

Correction to finding 5: the list's bytes were already card-only (180 KB at 311 projects, 21 KB gzipped, unchanged); the cost was Prisma loading gallery and spec rows the cards never used.

### Changed files

- Server: `src/app.ts`, `src/middleware/error-handler.ts`, `src/middleware/request-context.ts`, `src/modules/projects/projects.routes.ts`, `src/modules/pages/pages.routes.ts`; tests in `test/integration/app.test.ts` and `test/integration/content/projects.test.ts`.
- Client: `app/[lang]/layout.tsx`, `vercel.json`, `lib/public-api.ts`, `components/ui/Img.tsx`, `components/sections/home/Slider.tsx`, `components/3d/house/HouseViewer.tsx`, `components/live-edit/EditablePage.tsx`, `hooks/useAdminSession.ts`; new `lib/admin-hint.ts`, `lib/cloudflare-image.ts`, `components/ui/CloudflareImage.tsx`.
- Local only (gitignored): `client/.env.local` gains `API_INTERNAL_URL=http://127.0.0.1:4000` for server-side reads.

### Checks run

- Server: full vitest suite 451/451, `tsc --noEmit`, `eslint .` clean.
- Client: `tsc --noEmit`, `eslint` on source folders, `i18n:check`, production build (159 pages).
- Browser and curl measurements on a production build; a scratch-database render showing Cloudflare covers with `srcSet` from `w=640` up and a matching preload.

### Still to verify on staging

- Function region `fra1` in effect, and custom-page TTFB.
- Cloudflare flexible variants enabled (RUNBOOK setup step and go-live check); image bytes per page at 390 px and 1440 px. Without them each uploaded photo falls back to its full-size original, so the site still works but loses the saving.
- Whether Cloudflare enlarges photos smaller than the requested width; add `fit=scale-down` if it does.
- Whether Render compresses API responses (`curl -sI --compressed`); add compression only if it doesn't.
- Lighthouse mobile on home, projects, a project, a custom page and contact.

### Not done, by decision

- Revalidation webhook (finding 4 step 2): deferred; after `fra1` and one read per view the remaining cost is one same-region API call.
- Client i18n footprint (finding 9) and media pagination (finding 12): deferred as planned.
