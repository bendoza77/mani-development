# Evidence and Assumptions Register

Every significant fact and decision in the planning package, with its classification and source.

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed from code in this repository, or from official documentation fetched 2026-11-20 |
| **DECIDED** | You stated it |
| **PROPOSED** | An engineering recommendation awaiting review |
| **NEEDS CONFIRMATION** | Waiting on your answer (see OPEN_QUESTIONS) |
| **BLOCKED** | Can't proceed until a dependency is resolved |

**Limits of the documentation checks:**
- Documentation was fetched by research sub-agents. Their fetch tool summarizes pages, so quotes may be paraphrased. The URLs are in INTEGRATIONS.md.
- The Next.js docs bundled in `client/node_modules/next/dist/docs/` (which `client/AGENTS.md` asks agents to read) **could not be used**: `node_modules` isn't installed in this checkout. nextjs.org was used instead.
- domenebi.ge SMTP details could not be found publicly. That became moot once you confirmed the mail is Google Workspace (U-07).
- Google facts (D-23 to D-25) come from search-result summaries of Google's help pages, not full page reads. Phase 10 re-checks them before configuring the account.

---

## 1. Facts from the code (VERIFIED)

| ID | Fact | Evidence |
|---|---|---|
| C-01 | No backend, API calls or server code exist; the repo contains only `client/` | Repo file list; search for `fetch(`, `process.env`, `/api/` |
| C-02 | All data lives in browser `localStorage` (`lintel:db`) | `client/lib/store.ts:3-5`, `:98-111` |
| C-03 | Admin "auth" is a localStorage flag; demo credentials are shown on the login page; a bypass button exists | `client/lib/session.ts:3-8`; `client/components/admin/LoginForm.tsx:74-91` |
| C-04 | The data model is the 9 collections in `client/lib/types.ts` | `client/lib/types.ts` |
| C-05 | Projects publish immediately on save; no draft state | `client/components/admin/ProjectForm.tsx:136`, `:146` |
| C-06 | No video, SEO fields, sitemap, password reset, roles or email anywhere | Repo-wide search; audit §5 |
| C-07 | Uploads are simulated (downscaled data URLs, ≤ 15 MB input, `image/*`) | `client/components/admin/MediaAdmin.tsx:16-37` |
| C-08 | Contact form is simulated (fake delay, failure toggle) | `client/components/sections/ContactForm.tsx:63-75`, `:150-153` |
| C-09 | Public site is bilingual (en, ka); only seed content has Georgian versions; admin edits show in English | `client/i18n/content.ts:5-11`; `client/i18n/resources.ts:62-79` |
| C-10 | Project SEO metadata and static params use seed data only | `client/app/[lang]/(site)/projects/[slug]/page.tsx:7-22` |
| C-11 | Services and team are ordered manually; testimonials newest-first; projects rule-sorted | `ServicesAdmin.tsx:59-60`, `TeamAdmin.tsx:51-52`, `TestimonialsAdmin.tsx:89`, `ProjectsExplorer.tsx:55-71` |
| C-12 | Theme is a per-browser preference stored inside settings | `SettingsAdmin.tsx:127`; `client/app/[lang]/layout.tsx:66` |
| C-13 | Notifications are generated only for new inquiries | `client/lib/store.ts:191-216`; seed-only milestone item `client/data/seed.ts:708-733` |
| C-14 | Seed content is mostly placeholder; company name, address and email are real | `client/data/seed.ts:1-3` |
| C-15 | Client runs Next.js 16.4.6, React 19.3, Node 24.x, `cacheComponents: true`; `proxy.ts` excludes `/api/` | `client/package.json`, `client/next.config.ts`, `client/proxy.ts:66` |
| C-16 | Deleting in-use media is allowed with a warning | `MediaAdmin.tsx:240-242` |
| C-17 | Local toolchain: Node 24.15.0, npm 11.12.1, PostgreSQL 18.6, Docker 29.6.1; Git remote on GitHub | Commands run during this investigation |
| C-18 | Repository unchanged between the two audits (commit `5d41491`; `server/docs/` untracked) | `git status`, `git log`, 2026-11-20 |
| C-19 | Homepage has no slider; it opens with a text hero and a 3D house whose library loads on every homepage visit with WebGL | `home/Hero.tsx`; `3d/house/HouseViewer.tsx:13`, `:70-71` |
| C-20 | Navigation is a hard-coded constant | `client/components/layout/SiteHeader.tsx:16-23` |
| C-21 | No WhatsApp, Messenger, Google Maps link, analytics, consent banner, sitemap, robots file, JSON-LD or verification tag exists; the contact map is a non-clickable illustration | Repo-wide searches; `contact/page.tsx:12-13` |
| C-22 | No generic page route and no block editor; About, Services and Contact are fixed templates with copy in translation files | `client/app/[lang]/(site)/**`; `[...rest]/page.tsx` |
| C-23 | Media-library alt text is not used on public pages | `ProjectCard.tsx:33`; `Gallery.tsx:56`; `ServicesList.tsx:52` |
| C-24 | One H1 per public page; the projects index skips from H1 to H3 | `PageIntro.tsx:24`; `ProjectCard.tsx:45`; `ProjectsExplorer.tsx` |
| C-25 | Canonical and hreflang are relative and `metadataBase` is not set; no `x-default`; no Open Graph image | `client/i18n/server.ts:44-51`; `client/app/[lang]/layout.tsx:54` |
| C-27 | Phase 1: `prisma generate` succeeds with a schema that has no models and no `DATABASE_URL`; the generated client uses `.js` import paths (works with `NodeNext`) | Run on 2026-11-20 |
| C-28 | Phase 1: the Prisma 7.10.1 CLI pulls `effect` 3.20.0 (advisory GHSA-7589-6fvf-x4pw, high). It is counted even by `npm audit --omit=dev`, because `@prisma/client` declares the CLI as a peer. Fixed with an npm `overrides` pin to `effect` 3.22.5 (same major); `npm audit --omit=dev` then reports 0 | `npm audit`, `npm ls effect` |
| C-29 | Phase 1: TypeScript pinned to 6.0.3 because typescript-eslint 8.73 requires `<6.1.0` (npm `latest` is 7.0.2) | `npm view` peer ranges |
| C-30 | Phase 1: Supertest 7.3.2 works with Express 5.3.0 | Test run 2026-11-20 |
| C-31 | Development machine: a PostgreSQL already listens on port 5433 and Docker Desktop was not running. Phase 1 tests ran on a throwaway PostgreSQL 18.6 cluster (port 5544, scratch folder). Docker Compose uses port 5434 | `pg_isready`, `docker info` |
| C-32 | On Windows, Node can't deliver SIGINT/SIGTERM from another process (it terminates the target), so the signal handler in `src/index.ts` was not exercised locally; `close()` is covered by tests. To be checked on Render (Linux) in Phase 3 | Phase 1 manual verification |
| C-33 | Phase 2: with `in_progress @map("in-progress")`, Prisma 7.10.1 generates `ProjectStatus.in_progress === "in_progress"` and stores `'in-progress'` in PostgreSQL. Resolves the D-15 docs conflict | `src/generated/prisma/enums.ts`; `test/integration/schema/relations.test.ts` |
| C-34 | Phase 2: `@default(uuid(7))` works in Prisma 7.10.1 and produces version-7 UUIDs | relations test |
| C-35 | Phase 2: `prisma migrate diff --from-migrations` needs `datasource.shadowDatabaseUrl` in `prisma.config.ts` (an empty scratch database); it reports no difference for the committed migration and exits 2 when the schema drifts | Run 2026-11-21 |
| C-36 | Phase 2: the migration inserts the settings row with the real company name, email and address. **Phone (`+995 32 200 14 14`) and opening hours are the prototype's placeholders** and must be changed in the admin before launch; social links start empty | `prisma/migrations/*_init/migration.sql` |
| C-37 | Phase 2 seed: the prototype never translates project names, so `titleKa` equals the English name for demo projects; images have English alt text only (copied into `altKa`); the sample page has heading, text, image and gallery blocks but no video or embed (no real video to point at) | `prisma/seed.ts`, `prisma/seed-data.json` |
| C-26 | Public DNS for `manidevelopment.ge`: Route 53 nameservers; no records for the bare domain, `www` or `api`; MX to Google; SPF for Google present; no DKIM (`google._domainkey`) and no DMARC record | DNS lookups from the development machine, 2026-11-20 |

## 2. Facts from documentation (VERIFIED, fetched 2026-11-20)

| ID | Fact | Source (see INTEGRATIONS for URLs) |
|---|---|---|
| D-01 | Render free web services sleep after 15 min, block SMTP ports 25/465/587, and have no shell | Render docs "free" |
| D-02 | Render free Postgres: 1 GB, expires after 30 days, no backups | Render docs "free" |
| D-03 | Render pre-deploy command: paid plans only; a failure aborts the deploy | Render deploys + blueprint docs |
| D-04 | Render paid web $7/mo; Postgres $6/mo; point-in-time recovery 3 days (Hobby) / 7 days (Pro) | Render pricing, backups docs |
| D-05 | Render regions include Frankfurt; region can't be changed later | Render regions |
| D-06 | Render forwards `X-Forwarded-For` with a client-controlled leftmost entry; `CF-Connecting-IP` available | Render *article* (not reference docs) |
| D-07 | `onrender.com` and `vercel.app` are on the Public Suffix List | publicsuffix.org |
| D-08 | Safari blocks third-party cookies; caps CNAME-cloaked first-party cookies at 7 days | webkit.org |
| D-09 | Vercel Hobby plan is personal / non-commercial only | Vercel terms |
| D-10 | Next.js 16 `revalidateTag` callable from Route Handlers; `updateTag` only from Server Actions | nextjs.org |
| D-11 | Cloudflare Images: Direct Creator Upload; 10 MB; JPEG/PNG/GIF/WebP/SVG/HEIC (AVIF Enterprise-only); details have no dimensions; storage needs paid plan, $5 per 100k stored, $1 per 100k delivered | Cloudflare Images docs, pricing |
| D-12 | R2: presigned PUT, no presigned POST; `r2.dev` is development-only; custom domain needs a Cloudflare zone; 10 GB free, egress free | Cloudflare R2 docs |
| D-13 | Turnstile: free, unlimited; siteverify required; tokens 300 s, single use | Cloudflare Turnstile docs |
| D-14 | Prisma 7.10.1 is current stable; the `prisma` CLI `latest` tag is 8.0.0-rc → pin; driver adapter, `prisma.config.ts`, ESM, required generator output | npm registry, Prisma v7 upgrade guide |
| D-15 | Prisma `@map` enum values: generated client uses schema names (7.3.0 release notes). **Docs conflict**, so this gets a Phase 2 test | Prisma GitHub releases vs schema reference |
| D-16 | Express 5.3.0: async errors forwarded automatically; Node ≥ 18; "simple" query parser default | Express migration guide |
| D-17 | Node `crypto.argon2` stable since 24.19.0; type stripping stable in 24.12 (no enums or paths) | Node changelog and docs |
| D-18 | Node 24 in Maintenance LTS since 2026-10-20, end of life 2028-04-30; Node 26 Active LTS | Node release schedule |
| D-19 | OWASP Argon2id minimum m=19 MiB, t=2, p=1 | OWASP cheat sheet |
| D-20 | Current versions: helmet 8.3.0, express-rate-limit 8.7.5, zod 4.6.7, pino 10.4.0, pino-http 11.0.0, vitest 5.1.1, supertest 7.3.2 | npm registry |
| D-21 | Gmail and Yahoo require SPF or DKIM from all senders | Google and Yahoo sender guidelines |
| D-22 | domenebi.ge sells cPanel hosting and resells Google Workspace | domenebi.ge pages |
| D-23 | Google Workspace: password-only ("less secure app") access ended May 2025; use OAuth or an app password (requires 2-Step Verification); app passwords are revoked on password change | Google help (LSA transition, app passwords), via search summaries |
| D-24 | `smtp.gmail.com` on 465 (TLS) / 587 (STARTTLS), supports XOAUTH2; about 2,000 messages per user per day | Google developer docs; Workspace sending limits |
| D-25 | Workspace SPF `include:_spf.google.com`; DKIM generated by a super admin in the Admin console (`google._domainkey`); DMARC after ~48 h | Google Workspace help |
| D-26 | The prototype's `slugify` strips non-Latin characters, so a Georgian title produces an empty slug; service anchors derive from titles | `client/lib/format.ts` (`slugify`); `client/components/sections/ServicesList.tsx:16` |
| D-27 | Next.js 16: relative metadata URLs need `metadataBase` (build error otherwise); with Cache Components a request-time `notFound()` keeps status 200, and the documented fix is a slug check in Proxy; database-driven redirects belong in Proxy; `permanentRedirect` is 308 | nextjs.org (INTEGRATIONS §10) |
| D-28 | Next.js Draft Mode bypasses cached functions per request and sets a bypass cookie; nonce-based CSP is incompatible with partial prerendering; `@next/third-parties` is experimental; `generateStaticParams` must return at least one param with Cache Components | nextjs.org (INTEGRATIONS §10) |
| D-29 | Google: separate URLs per language, sub-directories fine; avoid automatic language redirects; hreflang must be reciprocal and self-listing, `x-default` recommended; canonicals absolute and self-referencing | Google Search Central (INTEGRATIONS §12) |
| D-30 | Google: robots.txt does not keep pages out of the index; noindex must be crawlable; sitemap limit 50,000 URLs / 50 MB; `priority` and `changefreq` ignored | Google Search Central |
| D-31 | Google: 301 and 308 are both permanent redirects; keep redirects at least a year; a "not found" page with status 200 is a soft 404 | Google Search Central |
| D-32 | Google: JSON-LD recommended; LocalBusiness requires `name` and `address`; `GeneralContractor` exists on schema.org; videos are indexed only on dedicated watch pages; heading order doesn't affect ranking | Google Search Central, schema.org |
| D-33 | Core Web Vitals "good": LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile | web.dev |
| D-34 | Google: use the Google tag **or** Tag Manager, not both; `generate_lead` is a recommended GA4 event; no recommended event for phone or chat clicks; enhanced measurement logs outbound clicks and form submits | Google Analytics and Tag Manager help (INTEGRATIONS §13) |
| D-35 | Consent Mode v2 has four signals; defaults must be set before tags fire; in "basic" mode nothing is sent before consent; Google requires consent signals for EEA, UK and Swiss visitors; GA4 doesn't store IP addresses | Google tag platform docs, EU user consent policy |
| D-36 | WhatsApp click-to-chat is `https://wa.me/<international number>`; Messenger is `m.me/<Page name>`; Google Maps URLs need no API key; the Maps Embed API is free but needs a key and a billing-enabled Cloud project | WhatsApp FAQ, Meta docs, Google Maps docs |
| D-37 | Tiptap 3.35.0 is MIT-licensed, stores documents as JSON, supports React 19 (peer dependency), needs `immediatelyRender: false` under Next.js, and advises validating content; Lexical is 0.x; BlockNote's extra packages are GPL or commercial | npm registry, tiptap.dev |
| D-38 | Cloudflare Stream: one-time direct upload URLs; 200 MB simple-upload limit; `readyToStream` signals playability; storage prepaid at $5 per 1,000 minutes per month; one webhook per account | Cloudflare Stream docs (INTEGRATIONS §11) |
| D-39 | Cloudflare Images flexible variants: `w=`, `h=`, `q=`, `fit=`, `f=`; `format=auto` is the default for hosted images | Cloudflare Images docs |

## 3. Decisions you made (DECIDED)

| ID | Decision | Date |
|---|---|---|
| U-01 | Stack: Node.js + Express, PostgreSQL, Prisma, Vercel (frontend), Render (backend), Cloudflare (media) | Brief |
| U-02 | Email provider: **domenebi.ge** | 2026-11-20 |
| U-03 | Planning first; no implementation before explicit approval | Brief |
| U-04 | Domains are available for hosting → custom sub-domains (`www.`, `api.`) | 2026-11-20 |
| U-05 | Content must be bilingual, **mainly Georgian** (Georgian primary) | 2026-11-20 |
| U-06 | One admin account for now; forgotten password → **reset link emailed to the registered admin address** | 2026-11-20 |
| U-07 | Email is **Gmail (Google Workspace)** bought through domenebi.ge (refines U-02) | 2026-11-20 |
| U-08 | You will buy the hosting plans and share the resource details | 2026-11-20 |
| U-09 | Domain: `manidevelopment.ge`. Mailboxes: `info@` and `dev@manidevelopment.ge` | 2026-11-20 |
| U-10 | Client requirements (second brief): admin-managed slider, navigation, pages and block editor; video and embeds; draft, preview and publish; full SEO set; GA4 and Tag Manager with click tracking and consent; WhatsApp, Messenger, call and Google Maps links | 2026-11-20 |
| U-12 | No separate product catalogue for now; projects are the product pages (Q-19) | 2026-11-20 |
| U-13 | The slider is a separate homepage section; the current opening with the 3D house stays (Q-20) | 2026-11-20 |
| U-14 | Hybrid CMS accepted (Q-21); text formatting in text blocks: yes (Q-22) | 2026-11-20 |
| U-15 | Georgian first: required, default at `/`; English optional at `/en/` (Q-02a) | 2026-11-20 |
| U-16 | Video: both uploaded (Cloudflare Stream) and embedded links (Q-25) | 2026-11-20 |
| U-17 | `info@manidevelopment.ge` is the admin login, sender and inquiry inbox (Q-29); you manage DNS (Q-28) | 2026-11-20 |
| U-11 | The first release stays lightweight; plans are updated, not rewritten; no application code during planning | 2026-11-20 |

## 4. Engineering proposals (PROPOSED)

| ID | Proposal | Where argued |
|---|---|---|
| P-01 | TypeScript, ESM, `tsc` build for production, `tsx` for dev and seed | BACKEND_MASTER_PLAN §3.2 |
| P-02 | Feature-module layout (routes + service + schemas); no controller/repository layers | BACKEND_MASTER_PLAN §3.2–3.3 |
| P-03 | Server-side DB sessions, opaque hashed tokens, `__Host-sid` cookie, SameSite=Strict | SECURITY_PLAN §2 |
| P-04 | Argon2id via built-in `node:crypto`; Node ≥ 24.19 | SECURITY_PLAN §3 |
| P-05 | Media referenced by foreign key (not URL); RESTRICT on delete | DATABASE_DESIGN §3–4 |
| P-06 | Specs and gallery as ordered child tables; services/team `position` with whole-list reorder | DATABASE_DESIGN §3 |
| P-07 | Testimonials link to projects by ID (not title) | DATABASE_DESIGN §3.5 |
| P-08 | Theme stays browser-only, not stored on the server | Audit F-11 |
| P-09 | Cloudflare Images for all images; Direct Creator Upload; flexible variants + Next.js custom loader | INTEGRATIONS §1 |
| P-10 | SMTP via `nodemailer` to `smtp.gmail.com` (app password); durable outbox for inquiry emails; direct send for reset emails | INTEGRATIONS §3 |
| P-16 | Bilingual columns `xKa` (required) / `xEn` (optional, falls back to Georgian); Georgian→Latin transliterated slugs; `Service.slug` | DATABASE_DESIGN §1, §3.4 |
| P-17 | Email password reset: hashed single-use 30-min token in the URL fragment, always-202 request, sessions revoked on reset, CLI fallback | SECURITY_PLAN §2 |
| P-18 | Hybrid CMS: existing designed pages stay, with editable heading, intro, SEO and added blocks; new pages are fully block-based | DATABASE_DESIGN §3.9; Q-21 |
| P-19 | Blocks as ordered rows with a media link table (not one JSON blob); six block types; H2/H3 only | DATABASE_DESIGN §3.9 |
| P-20 | Rich text as allow-listed Tiptap JSON, validated on the server, rendered by a custom React renderer | SECURITY_PLAN §17.1; API_CONTRACTS §8.1 |
| P-21 | Publishing as a boolean per record; preview through Next.js Draft Mode with one-time tokens; no version history in the first release | DATABASE_DESIGN §3.9; API_CONTRACTS §8.8 |
| P-22 | SEO fields optional with automatic defaults; canonical and hreflang generated, not stored; redirects created automatically on slug change | DATABASE_DESIGN §3.9, §3.12; SEO_ANALYTICS_PERFORMANCE §2 |
| P-23 | Redirects and real 404s decided in `proxy.ts` through a cached path lookup | SEO_ANALYTICS_PERFORMANCE §6 |
| P-24 | Georgian at `/`, English at `/en/`; a record exists in English only when it has an English title | SEO_ANALYTICS_PERFORMANCE §1 |
| P-25 | Uploaded video on Cloudflare Stream with polling; embeds stored as provider + ID; click-to-play posters | INTEGRATIONS §11; SEO_ANALYTICS_PERFORMANCE §7 |
| P-26 | Analytics only through Tag Manager, loaded after consent; two custom events from one helper; IDs kept in settings | SEO_ANALYTICS_PERFORMANCE §9 |
| P-27 | Static Content-Security-Policy header with an allow-list of hosts | SECURITY_PLAN §17.4 |
| P-28 | Clickable map link instead of an embedded map; WhatsApp and Messenger links built from settings | SEO_ANALYTICS_PERFORMANCE §10 |
| P-29 | 16 phases: media moved before content; new CMS, SEO and analytics/performance phases; frontend integration split into public and admin | BACKEND_MASTER_PLAN §4 |
| P-11 | Public pages fetch on the Next.js server with cache tags; API triggers revalidation | INTEGRATIONS §8 |
| P-12 | No API versioning; `/api` prefix; error envelope with field codes | API_CONTRACTS §1 |
| P-13 | Integration tests against real PostgreSQL 18; fakes only for third parties | TESTING_STRATEGY |
| P-14 | Add a staging-deployment phase early (Phase 3) and split the content APIs into their own phases | BACKEND_MASTER_PLAN §4.1 |
| P-15 | Render region Frankfurt; paid web + Postgres for production | INTEGRATIONS §4 |

## 5. Waiting on you (NEEDS CONFIRMATION)

**Answered:** Q-01 (domain), Q-02 (main part), Q-03 (video required), Q-05 (product and mailboxes), Q-06, Q-07 (drafts and SEO fields required), Q-08 (you are purchasing).

**Still open** (details in OPEN_QUESTIONS):
- **Before Phase 2 (defaults apply if unanswered):** Q-32 pages without English · Q-23 navigation depth
- **Later phases:** Q-28 DNS access · Q-33 main address · Q-14 staging · Q-29 mailbox roles · Q-04 Cloudflare Images · Q-25 video hosting · Q-11 delete in-use media · Q-24 contact buttons · Q-09 Turnstile · Q-26 analytics and consent · Q-27 Search Console · Q-31 earlier website · Q-10 launch content
- **Before launch:** Q-12 retention · Q-13 monitoring · Q-15 Node version · Q-16 theme · Q-17 Playwright · Q-18 CI

## 6. Blocked items (BLOCKED)

| ID | Item | Blocked by |
|---|---|---|
| B-01 | Final database schema (Phase 2) | Unblocked on 2026-11-20. Q-32 and Q-23 use their defaults unless changed |
| B-02 | Auth cookie configuration (Phase 4) | DNS records for `api.` and staging (Q-28) |
| B-08 | Video upload design details (Phase 5) | Q-25; a Cloudflare account with Stream |
| B-09 | Analytics verification (Phase 14) | GA4 property and Tag Manager container (Q-26) |
| B-10 | Final Content-Security-Policy host list | Report-only run on staging (Phase 14) |
| B-03 | Production rate-limit key (`trust proxy` hop count) | Phase 3 measurement on Render |
| B-04 | Cloudflare upload-completion detection (`draft` flag vs 404) | Phase 5 spike with a real token |
| B-05 | Live email (Gmail SMTP credentials, DKIM) | Q-29 |
| B-06 | Vercel cache persistence for `'use cache'` | Phase 11 spike |
| B-07 | Any deployment | Accounts and plans you are purchasing (Q-08) |

## 7. Assumptions (stated, not verified)

| ID | Assumption | How it will be checked |
|---|---|---|
| A-01 | Data volumes stay small (≤ a few hundred projects/images; thousands of inquiries) | Reviewed at Phase 15 with `EXPLAIN` on 10× data |
| A-02 | One production API instance is enough (in-memory rate limiting relies on this) | Render metrics after launch; switch to a shared store if scaled |
| A-03 | Cloudflare Images billing has a $5 minimum (whole 100k blocks) | Cloudflare billing page before approval |
| A-04 | ~~Supertest works with Express 5~~ **Resolved in Phase 1: confirmed** (C-30) | Phase 1 health tests |
| A-05 | Latency from Frankfurt to Georgia is acceptable | Phase 3 measurement |
| A-06 | "Products" in the client requirements means the existing projects | Q-19 |
| A-07 | The existing designed pages keep their layouts; only headings, intros, SEO and added blocks are editable in the first release | Q-21 |
| A-08 | The public site is responsive on phone, tablet and desktop (seen in the code's responsive classes, not viewed running) | Phase 11 manual pass at three widths |
| A-09 | The path check in `proxy.ts` is fast enough (one cached API call per uncached dynamic path) | Phase 11 measurement on staging |
| A-10 | The record-level English rule (Q-32, option A) is acceptable to the business | Q-32 |
