# Testing Strategy and Quality Gates

**Status:** PROPOSED. The per-phase acceptance criteria live in [BACKEND_MASTER_PLAN.md](BACKEND_MASTER_PLAN.md) §5. This document defines **how** we test and what "verified" means.

---

## 1. Rules

1. **Nothing is "done" without evidence.** A phase is complete only when its listed commands have been run and their output shows a pass (test summary, type check, lint, manual checklist results). Writing code is not completion.
2. **Never weaken a test to make it pass.** A failing test is investigated to its root cause. If the test itself is wrong, the fix and the reason go in the commit message.
3. **Test against real PostgreSQL**, never a mocked Prisma client. The bugs that matter here (constraints, cascades, transactions, enum mapping, `CHECK` rules) only show up in a real database.
4. **Fake only what we don't own.** Cloudflare, SMTP, Turnstile and the frontend revalidation hook sit behind small interfaces with in-memory fakes in tests. Each real adapter is exercised separately (§6).
5. **Tests are deterministic.** Time comes from an injectable `now()`; random tokens come from injectable generators where a test needs to assert on them. No sleeps.

---

## 2. Tooling

| Tool | Version checked 2026-11-20 | Purpose |
|---|---|---|
| Vitest | 5.1.1 (needs a `vite` peer dependency; Node `^24`) | Test runner |
| Supertest | 7.3.2 | HTTP assertions against the Express app object. Works with Express 5: **verified in Phase 1** (2026-11-20) |
| PostgreSQL | 18 (local 18.6 installed; Docker 29 also available) | Test database, same major version as Render's default |
| TypeScript `tsc --noEmit` | **6.0.3** (pinned in Phase 1). TypeScript 7 is the npm "latest", but typescript-eslint 8.73 supports only `<6.1.0`; Prisma 7 needs ≥ 5.4 | Type gate |
| ESLint + typescript-eslint | current at Phase 1 | Lint gate, including a ban on unsafe raw-SQL APIs |

All versions are pinned in `server/package.json` when Phase 1 is implemented; the numbers above are the versions checked today.

---

## 3. Test database

- `docker-compose.yml` in `server/` runs `postgres:18` on host port **5434** (5433 is taken by a local PostgreSQL on the development machine). A local PostgreSQL 18 install works too: set `DATABASE_URL_TEST`.
- A `globalSetup` file:
  - creates the `mani_test` database if missing
  - runs `prisma migrate deploy` (the same command production uses)
  - **refuses to run if the URL's database name doesn't end in `_test`**, so tests can never truncate a real database
- `TRUNCATE … RESTART IDENTITY CASCADE` on all tables before each test file, plus the single settings row re-inserted.
- **Integration tests run one file at a time** (`fileParallelism: false`) to avoid cross-file interference on the shared database. Unit tests run in parallel. If the suite gets slow, switch to one schema per worker.

---

## 4. Test layers

| Layer | What | Examples | Location |
|---|---|---|---|
| **Unit** | Pure functions | Env parsing; Zod schemas (every rule from the audit); serializers (enum `in_progress` → `in-progress`); slug rule; password hash/verify and PHC encoding; session expiry math; dashboard month bucketing in UTC | `src/**/*.test.ts` |
| **Integration (HTTP + DB)** | Real app, real database, fake providers | Each endpoint's matrix (§5) | `test/integration/**` |
| **Contract** | Response bodies match the published shapes | Every integration test parses its response with the response Zod schema that mirrors API_CONTRACTS §2. Unknown or missing fields fail | Shared helper `expectShape(schema, body)` |
| **Security** | Cross-cutting checks | Route-table walker (every `/api/admin/*` → 401 without a session); public filters never leak hidden, unpublished or private data; Origin and content-type enforcement; cookie attributes; log redaction; banned-API grep | `test/security/**` + CI script |
| **Adapter** | Real HTTP formatting of Cloudflare, SMTP, Turnstile and revalidation clients | Each adapter pointed at a local stub HTTP server (or a local SMTP sink) that records requests; asserts URL, auth header, body and timeout handling | `test/adapters/**` |
| **Staging spikes** | The real third-party behaviour that can't be faked faithfully | Cloudflare upload → complete → deliver → delete; Turnstile siteverify with test keys; SMTP send to a test inbox; revalidation round trip on Vercel | Scripted steps in Phases 5, 9, 10 and 11, run manually and recorded |
| **End-to-end (frontend)** | Critical journeys in a real browser | Login → create project → see it on the public page; contact form → inquiry in inbox; upload image → use as cover | Phases 11–12 and 15. Playwright is **PROPOSED** (new dev dependency for `client/`, Q-17); otherwise a written manual script |
| **Performance** | Query plans and modest load | `EXPLAIN (ANALYZE, BUFFERS)` on list, search and dashboard queries with 10× seed data; short load test of public reads and inquiry POST on **staging only** | Phase 15 |

---

## 5. Minimum matrix per endpoint

Every endpoint gets at least the tests below that apply:

| Case | Expected |
|---|---|
| Happy path | Correct status, body matches the contract, database state changed as intended (queried directly) |
| Auth | `401` without a session (admin) |
| Validation | One test per rule from the audit, plus maximum length, unknown key, wrong type → `400` with the right `fieldErrors` path and code |
| Not found | Random UUID → `404`; malformed UUID → `400` |
| Conflict | Slug taken, media in use, order mismatch → `409` |
| Side effects | Activity entry written (exactly one), notification created, cache revalidation requested (fake records the call) |
| Transaction | Forced failure mid-operation (e.g. invalid gallery reference) leaves **no** partial rows |
| Public visibility | Hidden, unpublished or private rows absent from public responses; `404` on direct slug lookup |

---

## 6. External services in tests

| Service | Test double | Real-world verification |
|---|---|---|
| Cloudflare Images | `FakeImageStorage` (in-memory: createUpload, getImage, delete; can be told to fail or time out) | Adapter test with a stub server + Phase 5 staging spike with a real token |
| SMTP (Gmail / Google Workspace) | `FakeMailer` capturing messages | Adapter test against a local SMTP sink + Phase 10 send to a real test inbox, checking SPF/DKIM results in the received headers |
| Turnstile | `FakeCaptcha` (pass, fail, timeout) | Cloudflare's published test keys on staging (Phase 9) |
| Frontend revalidation | `FakeRevalidator` recording tags | Phase 11 round trip on staging |

---

## 7. Continuous integration (GitHub Actions, PROPOSED; Q-18)

On every push and pull request touching `server/`:

1. `npm ci`
2. `npx prisma generate`
3. `npx tsc --noEmit`
4. `npm run lint`
5. Start a `postgres:18` service container → `npx prisma migrate deploy` → `npm test` (unit + integration + security + adapter)
6. Schema drift check: the committed migrations must reproduce `schema.prisma`. The exact `prisma migrate diff` invocation for Prisma 7 is fixed in Phase 2
7. `npm audit --omit=dev --audit-level=high`
8. Banned-API grep (`$queryRawUnsafe`, `$executeRawUnsafe`, `eval(`)

- A Render deploy happens only after CI passes. The Render setting for this is checked in Phase 3; if no such setting exists, auto-deploy stays off and deploys are triggered manually after a green CI run.
- The client keeps its existing `npm run lint` and `npm run i18n:check`. Phase 11 adds them to CI too.

---

## 8. Quality gates (summary)

Every phase ends with this checklist. The phase-specific items are in BACKEND_MASTER_PLAN §5.

- [ ] All tests pass locally **and** in CI (paste the summary into the phase report)
- [ ] `tsc --noEmit` and lint are clean
- [ ] New endpoints satisfy the §5 matrix
- [ ] The phase's security checks pass (SECURITY_PLAN §15)
- [ ] The manual verification steps were performed, with results recorded (what was done, what was observed)
- [ ] Docs are updated where the implementation differed from the plan (EVIDENCE_REGISTER and the affected design doc)
- [ ] No open `BLOCKED` item for this phase

---

## 9. Manual verification records

Each phase report includes a short table: **Step | Command or action | Expected | Observed | Pass/Fail**. Observations are copied from real output. If a step couldn't be run (missing credentials, for example), it is reported as **not run**, never as passed.

---

## 10. Tests for the CMS, SEO, analytics and performance scope (added 2026-11-20)

These extend the layers in §4. Every item is a pass/fail check with a number or an exact condition.

### 10.1 CMS (Phases 6–8, 12)

| Area | Automated checks |
|---|---|
| Block validation | Each block type: valid input accepted; unknown type, unknown key, wrong media kind, too many blocks → `400`. Rich text: every disallowed node, mark and attribute rejected; `javascript:`, `data:` and `//` links rejected; depth and length limits enforced |
| Embeds | A table of real YouTube and Vimeo address shapes parses to the right ID; look-alike hosts, extra paths and pasted iframe code are rejected |
| Media integrity | An image or video used in a block, slide or as a social image can't be deleted (`409`), and appears in "used by" |
| Publishing | A draft project or page is absent from every public endpoint, the sitemap feed and `resolve`; publishing makes it appear; unpublishing removes it again |
| Preview | A token works once; a second use, an expired token and a token for another record fail; drafts are returned only with the internal key **and** the preview flag |
| Redirects | A slug change on a published record creates exactly one redirect; a second change leaves no chain; a draft's slug change creates none; a redirect never points at itself or outside the site |
| Navigation and slides | Reorder stays contiguous; an item whose page is unpublished is absent publicly; limits (12 items, 8 slides) enforced |
| Bilingual rules | Georgian required; a record without an English title is absent from English responses; optional English fields fall back to Georgian |
| Block renderer (frontend) | Unit tests render each block type and assert the output contains no raw HTML injection path and the expected elements |

### 10.2 SEO (Phase 13)

Run against staging with a script (plain HTTP requests plus an HTML parser) so the checks are repeatable:

| Check | Pass condition |
|---|---|
| Status codes | An unknown slug returns `404`. A changed slug returns `308` with the right `Location`, in both languages. A record without English returns `404` at its `/en` address |
| Titles and descriptions | Every indexable page has a non-empty, unique `<title>` and meta description (compared across the whole sitemap) |
| Canonical | Exactly one, absolute, on the production host, equal to the page's own address |
| hreflang | Present for every available language plus `x-default`; every alternate links back |
| Headings | Exactly one `<h1>`; no skipped level |
| Open Graph | `og:title`, `og:description`, `og:url`, `og:image` (absolute, loads with status 200) |
| Robots | A record with `robotsIndex = false` carries a noindex tag and is absent from the sitemap |
| Sitemap | Valid XML; lists every published indexable address exactly once per language; no draft, redirected or noindex address |
| robots.txt | Matches the planned content; the sitemap line points at the production host |
| Staging | Every staging response has `X-Robots-Tag: noindex`; **production has none** |
| Structured data | Zero errors for the homepage, contact page and a project page in Google's Rich Results Test and the Schema Markup Validator (manual, recorded) |
| Alt text | Every content image has an `alt` attribute; images from the library show the library's alt text |

### 10.3 Analytics and consent (Phase 14)

| Check | Pass condition |
|---|---|
| Before consent | Zero network requests to any Google host on first load (browser network log) |
| After Decline | Still zero |
| After Accept | Tag Manager loads once; exactly one `page_view` per page view, including client-side navigations (GA4 DebugView) |
| Tracked actions | Each of phone, WhatsApp, Messenger, email, map click → exactly one `contact_click` with the right `method` and `placement`. A successful form → exactly one `generate_lead`; a failed or invalid form → none |
| No personal data | Unit test: `track()` rejects any key outside the allow-list |
| Admin area | No analytics request from any `/admin` page |

### 10.4 Performance (Phase 14)

- **Tool:** Lighthouse, mobile profile, three runs per page on staging, median taken. Whether to add it as an automated CI step is decided in Phase 14; a manual, recorded run is the minimum.
- **Pages:** homepage, projects index, one project page with a gallery and a video, one custom block page, contact page.

| Metric | Pass |
|---|---|
| Largest Contentful Paint | ≤ 2.5 s |
| Cumulative Layout Shift | ≤ 0.1 |
| Total Blocking Time | ≤ 200 ms |
| Third-party requests before consent or interaction | 0 (Turnstile on the contact page excepted) |
| Images | Every content image is served as AVIF or WebP at a width appropriate to its slot (checked in the network log) |

- **Baseline first:** the same measurements are taken at the start of Phase 11, before integration, so improvements and regressions are visible.
- **After launch:** real-visit Core Web Vitals (75th percentile) are checked in Search Console once enough data exists. That check is outside the build phases.

### 10.5 Responsiveness and accessibility (Phases 11, 12, 15)

- Manual pass on phone, tablet and desktop widths (360, 768, 1280 px) for every public page type and the new admin screens; screenshots recorded.
- Keyboard-only pass through the slider, navigation menu, block editor and consent banner.
- An automated accessibility scan (axe, through Playwright if Q-17 = yes) on the five pages above, with zero serious or critical findings.
