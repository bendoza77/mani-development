# SEO, Analytics and Performance Plan

**Status:** PROPOSED. Added 2026-11-20 for the client requirements (IDs `CR-SEO-*`, `CR-AN-*`, `CR-PERF-*` in [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md)).

**Why this is a separate document:** none of the earlier plans covered these topics. Most of this work is in the Next.js site (`client/`), fed by data and endpoints defined in [DATABASE_DESIGN.md](DATABASE_DESIGN.md) §3.8–3.12 and [API_CONTRACTS.md](API_CONTRACTS.md) §8.

**Sources:** official Next.js, Google Search Central, web.dev, schema.org, Google Tag Manager / Analytics, WhatsApp, Meta and Vimeo pages, fetched 2026-11-20. URLs are in [INTEGRATIONS.md](INTEGRATIONS.md) §10–13. "VERIFIED" means the cited page says so; "NOT VERIFIED" items are listed in §12.

---

## 1. Language and URL architecture (CR-SEO-15)

A bilingual site needs this settled first, because every other SEO element (canonical, hreflang, sitemap, redirects) depends on the address of each page.

| Decision | Plan | Basis |
|---|---|---|
| One address per language | Georgian and English each get their own URL, in sub-directories of one host | VERIFIED: Google recommends "different URLs for each language version"; sub-directories are "easy to set up" and "low maintenance"; URL parameters are "not recommended" |
| Which language is the default | **Georgian at `/…`, English at `/en/…`** (PROPOSED, Q-02a). Today it's the reverse (`client/i18n/config.ts:12`) | Your answer "mainly Georgian". It must be fixed **before launch**: changing it later means redirecting every address |
| Canonical host | `https://www.manidevelopment.ge`; the bare domain redirects to it (PROPOSED, Q-33) | One host avoids duplicate addresses |
| Language switching | Plain links between the two versions (already so, `client/i18n/LanguageSwitcher.tsx`) | VERIFIED: Google advises against automatic redirection by IP or browser language |
| Returning-visitor redirect | The existing cookie redirect (`client/proxy.ts`) only follows a visitor's **explicit** earlier choice. Keep it, and re-check it in Phase 13 | Googlebot sends no cookies, so crawling is unaffected |
| Slugs | One Latin slug per record, shared by both languages (DATABASE_DESIGN §1) | Keeps redirects and hreflang simple |

**When an English version exists (PROPOSED, Q-32):**
- A record is "available in English" only if its English **title** is filled in.
- If it isn't, the English address returns a real 404, the record is left out of English lists, the sitemap and hreflang, and only the Georgian page exists.
- Reason (VERIFIED): Google treats language versions as duplicates when "the primary content is in the same language". An English address showing Georgian text would be a duplicate of the Georgian page.
- Inside an English-available record, an empty optional field still falls back to Georgian (DATABASE_DESIGN §1).

---

## 2. Page metadata (CR-SEO-01, 03, 05, 06, 12, 14)

Each public route builds its metadata on the server from the API's resolved `seo` object (API_CONTRACTS §8.2).

| Element | Rule | Basis |
|---|---|---|
| `metadataBase` | Set once in the root layout from `NEXT_PUBLIC_SITE_URL` | VERIFIED: a relative URL in metadata without `metadataBase` "will cause a build error". The current code has relative canonicals and no `metadataBase` (audit CR-SEO-05) |
| `<title>` | `seo.title` + " — " + company name. Unique per page | VERIFIED: Google wants distinct titles; there is no official length limit. The 70-character field limit is a practical choice so titles aren't cut off |
| Meta description | `seo.description`. Unique per page | Same; the 200-character limit is practical, not official |
| H1 | Exactly one per page: the record's `title` | Client requirement. Google says heading order "doesn't matter" for ranking (VERIFIED); it matters for screen readers |
| Canonical | Absolute, self-referencing, in the page's own language | VERIFIED: "use absolute paths"; include a self-referential canonical; with hreflang, canonical in the same language |
| `hreflang` | `ka`, `en` (only languages in `seo.locales`) and `x-default` → the Georgian address. Every version lists itself and the other | VERIFIED: each version "must list itself as well as all other language versions"; without return links "the tags will be ignored"; `x-default` is recommended |
| Open Graph + Twitter card | `og:title`, `og:description`, `og:url`, `og:locale` (`ka_GE` / `en_GB`), `og:image` (absolute, 1200×630 via a Cloudflare variant, with alt), `twitter:card = summary_large_image` | VERIFIED: Next.js `openGraph.images` "must be an absolute URL" |
| Robots | `index`/`follow` from `seo.index` / `seo.follow` | VERIFIED: noindex works as a `<meta>` tag or an `X-Robots-Tag` header |
| Search Console token | `verification.google` from settings, on every page including the homepage | VERIFIED: Next.js outputs `<meta name="google-site-verification">`; Google re-checks that the token stays present |

- **Metadata and caching:** `generateMetadata` uses the same cached fetch as the page (`'use cache'` + tags). With this project's caching mode, uncached metadata on an otherwise static page raises an error (VERIFIED), so they must share the cached data.
- **Social crawlers:** Next.js streams metadata for browsers but waits for it for "HTML-limited bots" such as Facebook's crawler (VERIFIED), so share previews get the tags in the initial HTML.

---

## 3. Heading and content structure (CR-SEO-03, CR-SEO-04)

- **One H1 per page**, always the record's title: homepage (home page record), listing pages, project, custom page.
- **Slider headings are not H1s** (DATABASE_DESIGN §3.11).
- **Blocks can only add H2 and H3** (API_CONTRACTS §8.1), so editors can't create a second H1 or skip from H1 to H4.
- **Fix found in the audit:** the projects index goes from H1 straight to H3 cards. Phase 13 adds the missing H2 level (or makes the cards H2).
- **A test** renders each page type and asserts: exactly one `<h1>`, and no heading level is skipped.

## 4. Sitemap and robots (CR-SEO-08, CR-SEO-09)

**Sitemap** (`client/app/sitemap.ts`, from `GET /api/public/sitemap`):
- One entry per language version of every indexable published address, with absolute URLs, an accurate `lastModified`, and language alternates.
  - VERIFIED: Next.js supports `alternates.languages` in sitemap entries; Google requires each `<url>` to list "every alternate version of the page, including itself".
- No `priority` or `changeFrequency` (VERIFIED: Google ignores both).
- Limits are far away: 50,000 URLs or 50 MB per file (VERIFIED).
- Regenerated through the same cache tags as the pages, so publishing updates it.
- Submitted in Search Console at launch, and referenced from robots.txt (VERIFIED: both are supported; the old "ping" endpoint is deprecated).

**robots.txt** (`client/app/robots.ts`):

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Sitemap: https://www.manidevelopment.ge/sitemap.xml
```

- **Pages marked noindex are not disallowed here.** VERIFIED: a crawler that can't fetch a page "will never see the noindex rule".
- robots.txt "is not a mechanism for keeping a web page out of Google" (VERIFIED), so the admin area keeps its existing `X-Robots-Tag: noindex` header (`client/vercel.json`) as well.

**Staging and preview deployments must never be indexed:**
- Every response from a non-production deployment carries `X-Robots-Tag: noindex, nofollow` (set from an environment flag).
- Google's guidance for private content is password protection (VERIFIED). Vercel's own protection for preview deployments is **NOT VERIFIED**; Phase 3 checks what the chosen plan offers.
- A launch checklist item confirms production does **not** send the noindex header (VERIFIED: Google warns about leftover development noindex rules).

## 5. Structured data (CR-SEO-10)

JSON-LD rendered by the server as a `<script type="application/ld+json">`, with `<` escaped (VERIFIED: Next.js's recommendation, including the escaping).

| Type | Where | Fields | Basis |
|---|---|---|---|
| `WebSite` | Homepage | `name`, `url`, `alternateName` | VERIFIED: this is how Google takes a site-name preference; it only works at the site root, not per language directory |
| `GeneralContractor` (a `LocalBusiness` subtype) | Homepage and contact page | `name`, `address` (required), `telephone`, `url`, `email`, `geo` (if latitude/longitude are set), `sameAs` (social links), `logo` | VERIFIED: `address` and `name` are required; "use the most specific LocalBusiness sub-type possible"; `GeneralContractor` exists on schema.org; geo needs at least 5 decimal places (we store 6) |
| `BreadcrumbList` | Project pages and custom pages | Home → Projects → project title | VERIFIED: needs at least two items |

**Not in the MVP, with reasons:**
- **Opening hours** in structured data need machine-readable days and times. Settings hold free text today ("Mon–Fri, 09:00–18:00"). Future enhancement.
- **`VideoObject`**: Google indexes a video only on a "watch page" whose main purpose is that one video (VERIFIED). Project pages aren't watch pages, so the markup would bring nothing.
- **Reviews / ratings**: Google's review markup is for sites that collect reviews of other businesses (VERIFIED), not for a company's own testimonials.

**Validation:** Google's Rich Results Test and the Schema Markup Validator (VERIFIED as the official tools), run on staging pages in Phase 13.

## 6. Redirects and real 404s (CR-SEO-13)

**The problem (VERIFIED):** with this project's caching mode, a "not found" decided inside the page is sent **after** the response has started, so the status stays `200` with a noindex tag. Google calls that a soft 404. Next.js documents the fix: "check the slug in Proxy, then rewrite it to a not-found route or return a 404 response. Keep Proxy checks fast."

**The design:** for the dynamic routes only (`/projects/<slug>`, `/<custom-page-slug>`, and their `/en` versions), `client/proxy.ts` asks the API before rendering:

```
GET /api/public/resolve?path=/projects/old-slug      (API_CONTRACTS §8.6)
  → project | page   → continue to the page
  → redirect, to     → 308 to the new address (same language prefix)
  → none             → real 404 (rewrite to the not-found page with status 404)
```

- **308 is a permanent redirect for Google**, the same as 301 (VERIFIED). `NextResponse.redirect` in the proxy is the documented way to serve redirects that live in a database.
- **Speed:** answers are cached in the proxy's memory per path for 60 seconds (hits and misses). The lookup is one indexed query. Fixed routes (home, services, about, contact, the projects index) never call the API.
- **The English rule from §1** uses the same call: if a record has no English version, the `/en` address resolves to `none`.
- **Redirects are kept indefinitely** (VERIFIED: Google says "at least 1 year"). Chains can't form (DATABASE_DESIGN §3.12).
- **Old website:** DNS shows no site is live on the domain today (INTEGRATIONS §7). If an older site ever had indexed addresses, they can be added as manual redirects (Q-31).

## 7. Images and video for SEO and speed (CR-SEO-07, CR-PERF-03)

- **Alt text** comes from the media library, in the page's language (Georgian required, English optional). Decorative images keep `alt=""`. This fixes the disconnect found in the audit.
- **Formats and sizes:** Cloudflare Images serves AVIF, then WebP, then the original, automatically (VERIFIED), at the width the layout asks for, through a Next.js custom image loader (INTEGRATIONS §1.5).
- **Loading:** the first visible image of each page loads eagerly with high priority; everything else is lazy (the default).
  - VERIFIED: Google and web.dev say not to lazy-load images that are in the viewport on load, especially the LCP image.
- **Uploaded video** (Cloudflare Stream) and **embeds** (YouTube, Vimeo) use a "click to play" poster: an image and a play button, with the player loaded only on click.
  - Benefit: no third-party player code on page load.
  - Trade-off (VERIFIED): Google won't index a video that needs a click to load. That's acceptable here, because these pages aren't video watch pages (§5).
- **Embeds use privacy-friendly players:** `youtube-nocookie.com` (VERIFIED) and Vimeo with `dnt=1` (VERIFIED).

## 8. Performance plan (CR-PERF-01 to CR-PERF-05)

**Targets.** Google's "good" thresholds, at the 75th percentile of real visits (VERIFIED):

| Metric | Target |
|---|---|
| Largest Contentful Paint (LCP) | ≤ 2.5 s |
| Interaction to Next Paint (INP) | ≤ 200 ms |
| Cumulative Layout Shift (CLS) | ≤ 0.1 |

Real-visit data only exists after launch. Before launch, Phase 14 uses a lab gate on staging (§11).

**Measures:**

| Area | Measure |
|---|---|
| Server rendering | Public pages fetch data on the server and are cached with tags (INTEGRATIONS §8). Sections that have no interaction become server components; only interactive parts (filters, lightbox, slider controls, forms) stay client components. Today every section is a client component |
| Homepage slider | No slider library. CSS scroll-snap plus a small script, like the existing testimonials rotator. **Decided (Q-20): the slider is a section below the opening**, so all its images load lazily with a fixed aspect ratio |
| 3D house | **Decided (Q-20): it stays at the top of the homepage.** Its graphics library therefore loads on every homepage visit (audit CR-PERF-04). Phase 14 measures the effect; if the speed targets are missed, the options are delaying the 3D load until the page is idle, or revisiting its position with you |
| Third-party scripts | None on page load without consent: Tag Manager loads only after consent (§9); video players load on click; Turnstile loads only on the contact page |
| Images | §7. Fixed `width`/`height` or aspect ratio on every image to prevent layout shift |
| Fonts | Already `next/font` with `display: swap`, and Georgian fonts loaded only when needed (`client/app/[lang]/layout.tsx`) |
| API | Small JSON payloads, list endpoints without per-row queries (DATABASE_DESIGN §6), cached on the Next.js server so most page views never reach the API |
| Region | API and database in Frankfurt. Running the site's server functions near Frankfurt is **NOT VERIFIED** for the Vercel plan; checked in Phase 3 |
| Dependencies | No new runtime dependency on the public site for the slider, blocks, consent banner or analytics. The rich-text editor is admin-only and lazy-loaded |

## 9. Analytics and consent (CR-AN-01 to CR-AN-05)

### 9.1 Setup

| Item | Plan | Basis |
|---|---|---|
| Tag Manager | One container for the site. Its ID comes from settings (`gtmContainerId`); empty = no analytics (staging, development) | VERIFIED: one container per website |
| How it loads | The standard Tag Manager snippet through `next/script` (`afterInteractive`), added only after consent | VERIFIED: tag managers are the documented use of `afterInteractive`. `@next/third-parties` is **not** used, because Next.js still marks it experimental |
| Google Analytics 4 | Configured **inside** Tag Manager (a "Google tag" with the GA4 ID, on the "Initialization – All pages" trigger). The site's code never loads `gtag.js` itself | VERIFIED: "You should only use either the Google tag or Tag Manager, not both. Using both… will have unintended consequences, such as overcounting" |
| Who owns the accounts | The client creates (or grants access to) the GA4 property and the Tag Manager container (Q-26) | — |

### 9.2 Events

The site pushes two custom events to the Tag Manager data layer through **one** helper function (`track()`), and nothing else sends events.

| Event | When | Parameters |
|---|---|---|
| `contact_click` | A visitor clicks a phone, WhatsApp, Messenger, email or map link | `method`: `phone` \| `whatsapp` \| `messenger` \| `email` \| `map`; `placement`: `header` \| `footer` \| `contact_page` \| `floating` \| `project_page` |
| `generate_lead` | The contact form is accepted by the API (HTTP 201), not on button press | `lead_source`: `contact_form` |

- `generate_lead` is Google's recommended event for a submitted enquiry (VERIFIED). No recommended event exists for phone or chat clicks (VERIFIED), hence the custom `contact_click`.
- Names follow GA4's rules: letters, digits and underscores, under 40 characters, not a reserved name (VERIFIED).
- In GA4, `generate_lead` and `contact_click` are marked as **key events** (VERIFIED: "key events" is the current name for conversions).

### 9.3 Avoiding duplicate events (CR-AN-04)

| Risk | Rule |
|---|---|
| GA4 loaded twice | Only through Tag Manager (§9.1) |
| A click counted by both a Tag Manager click trigger and our custom event | Tag Manager uses **Custom Event triggers only** for these actions; no "Just Links" click trigger on the same links. Google publishes no guidance on this combination (NOT VERIFIED), so it is our rule, checked in Tag Manager's preview mode |
| Form counted twice | `generate_lead` fires once, on API success. GA4's automatic `form_submit` (enhanced measurement) also fires on submit (VERIFIED). It is a different event; it is **not** marked as a key event, and "form interactions" can be switched off in GA4 (VERIFIED) |
| Outbound clicks | GA4's enhanced measurement logs a generic `click` for links leaving the site (VERIFIED), so WhatsApp, Messenger and Maps clicks also appear there. Reports use `contact_click`. Whether `tel:` links are covered is NOT VERIFIED |
| Client-side page changes | Next.js navigations don't reload the page. Page views rely on GA4's history-based page view tracking; Phase 14 verifies in GA4 DebugView that each navigation produces exactly one `page_view` |

### 9.4 Consent (CR-AN-05)

**Recommendation (PROPOSED, Q-26): no analytics until the visitor accepts.**
- A small first-party banner (no third-party consent library) offers Accept and Decline. The choice is remembered, and a footer link reopens it.
- Before a choice, and after Decline, Tag Manager is **not loaded at all**. This is Google's "basic" consent mode: "no data is transferred to Google at all" (VERIFIED).
- After Accept, the site sets Consent Mode v2 defaults (`analytics_storage: granted`; `ad_storage`, `ad_user_data`, `ad_personalization`: `denied`) **before** the Tag Manager snippet runs, then loads it.
  - VERIFIED: the consent default must be set "before any commands that send measurement data".
  - The three advertising signals stay denied because the site runs no ads.
- **Why this option:** it is the simplest to reason about, the most private, and the fastest (no third-party script for visitors who don't accept). The cost is fewer measured visits.

**What is and isn't settled:**
- VERIFIED: Google's own policy requires consent signals for visitors from the European Economic Area, the UK and Switzerland.
- **Requires clarification:** what Georgian law requires for cookies and analytics on this site. That is a legal question for the client; this plan gives no legal advice.
- VERIFIED: GA4 does not log or store IP addresses.
- A short privacy page (a custom CMS page) should describe analytics, Turnstile and the contact form. Its wording is the client's.

## 10. Contact channels (CR-PW-04 to CR-PW-07)

All from settings (DATABASE_DESIGN §3.8). Each button appears only when its value is set, and each click sends `contact_click`.

| Channel | Link | Basis |
|---|---|---|
| Phone | `tel:<number>` (already present) | — |
| WhatsApp | `https://wa.me/<digits>`, optionally with a prefilled message | VERIFIED: full international number, no zeros, brackets, dashes or "+" |
| Messenger | `https://m.me/<page-username>` | Meta documents `m.me/PAGE-NAME` for a Facebook Page. The exact `https://` form and behaviour for a plain Page link are NOT VERIFIED; tested by hand in Phase 11 |
| Google Maps | A link that opens the office in Google Maps: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` or a pasted share link | VERIFIED: Maps URLs need no API key |

- **Map on the contact page (MVP):** the existing illustration becomes a clickable link to Google Maps. That meets "clickable Google Maps location" with no key, no third-party script and no extra load time.
- **Embedded interactive map (future, optional):** Google's Maps Embed API is free with unlimited use (VERIFIED), but needs an API key from a Google Cloud project with billing enabled (VERIFIED).
- **Where the buttons appear** (header, footer, contact page, a floating button on phones) is a design choice (Q-24).

## 11. How this is verified (summary; details in TESTING_STRATEGY §10)

| Check | Pass condition |
|---|---|
| Unknown address | HTTP status is exactly `404` |
| Changed slug | Old address answers `308` with the new address in `Location`, in both languages |
| Canonical and hreflang | Every page type: one absolute canonical; `ka`, `en` (when available) and `x-default` present and reciprocal |
| Headings | Exactly one `<h1>`; no skipped levels |
| Sitemap | Valid XML; contains every published indexable address and no draft or noindex address |
| Structured data | Zero errors in the Rich Results Test and Schema Markup Validator |
| Staging | Every response has `X-Robots-Tag: noindex`; production has none |
| Analytics | Each tracked action yields exactly one event in Tag Manager preview and GA4 DebugView; no request to Google before consent |
| Performance (lab, staging, mobile profile) | LCP ≤ 2.5 s and CLS ≤ 0.1 on the homepage, projects index, a project page, a custom page and the contact page; Total Blocking Time ≤ 200 ms (our lab stand-in for INP, PROPOSED) |

## 12. Not verified, and where it gets settled

| Item | Settled in |
|---|---|
| Whether the current frontend build fails for lack of `metadataBase` | Phase 11 (first build with dependencies installed) |
| `x-default` in Next.js sitemap and metadata alternates (present in Next.js's types, absent from its docs) | Phase 13 test of the generated output |
| Sitemap revalidation behaviour under this caching mode | Phase 13 |
| Proxy lookup latency from Vercel to the API | Phase 11 measurement on staging |
| Messenger link behaviour for the client's Page | Phase 11 manual test |
| `tel:` clicks in GA4 enhanced measurement | Phase 14 (DebugView) |
| Vercel protection for preview deployments; function region | Phase 3 |
| Georgian legal requirements for analytics consent | Client (Q-26) |
| Google's acceptance of an SVG-only favicon (`client/app/icon.svg`); Google asks for a square icon, preferably larger than 48×48 | Phase 13 |
