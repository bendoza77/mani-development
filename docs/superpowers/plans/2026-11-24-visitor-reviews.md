# Visitor Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors submit a review (full name, text, 1–5 stars); the admin approves, hides or deletes it; approved reviews play in an auto-moving slider on the home page.

**Architecture:** A new `Review` table and `server/src/modules/site/reviews.routes.ts` (public submit + list, admin list/moderate/delete), modelled on the inquiry and testimonial routes. On the client: an admin `ReviewsAdmin` page with a sidebar badge, and a home-page `Reviews` section with a dependency-free auto slider and a dialog form that reuses the contact form's Turnstile logic (extracted to a hook).

**Tech Stack:** Express 5 + Prisma + Postgres + Zod + Vitest/supertest (server); Next.js App Router + React + Tailwind + react-i18next (client).

**Spec:** [docs/superpowers/specs/2026-11-24-visitor-reviews-design.md](../specs/2026-11-24-visitor-reviews-design.md)

## Global Constraints

- Run server tests from **PowerShell**, not Git Bash (Git Bash fails every server test with "reading 'config'").
- Admin testimonials stay untouched: no change to `testimonials.routes.ts`, its table, or `Testimonials.tsx`.
- Limits: fullName 2–100, text 20–1000, rating integer 1–5, locale one of `ka|en|ru` (default `ka`).
- Review status API values: `pending | approved | rejected`. Admin UI labels: Waiting / Approved / Hidden.
- Public list: approved only, newest first, max 30 items, fields `{ id, fullName, text, rating, createdAt }`.
- Rate limits: `review` 3 per hour, `reviewDaily` 10 per day, per IP.
- Public design rules: sentence-case labels in the sans face (no caps, no mono), no arrow icon on the "Write a review" button, no `·` joins, clay accent only for stars and interactive/active state.
- Slider: 1 card under `sm`, 2 from `md`, 3 from `lg`; advance one card every 5000 ms and loop; pause on hover, on focus inside, when `document.hidden`, and when the visitor presses pause; never auto-advance under `prefers-reduced-motion: reduce`.
- No new npm dependencies.
- Every new public string exists in `ka`, `en` and `ru` (`npm run i18n:check` in `client/` must pass).

## Review Focus

1. **Review text with line breaks or very long words** — the card must wrap (`break-words`, `whitespace-pre-line`), not overflow the slide. (Task 5 manual check: submit a 1000-char review with a 60-char word.)
2. **Exactly one approved review, or two on a 3-column screen** — no empty gaps that slide in, no auto-advance, no prev/next buttons when everything fits. (Task 5: `visibleCount >= items.length` disables movement.)
3. **Rating sent as a string or decimal (`"5"`, `4.5`, `0`, `6`)** — rejected with 400 and field error `rating`. (Task 2 test.)
4. **Admin approves a review, then visitor reloads** — it appears within the existing public cache window (≤ 60 s revalidate), not instantly; the admin page says so. (Task 4 copy.)
5. **Name or text with only spaces / HTML** — trimmed and rejected if too short; HTML shown as plain text, never rendered. (Task 2 test for whitespace; React escapes by default — do not use `dangerouslySetInnerHTML`.)

---

### Task 1: Review table and migration

**Files:**
- Modify: `server/prisma/schema.prisma` (add enum `ReviewStatus`, model `Review`, `review` to `ActivityKind`)
- Create: `server/prisma/migrations/<timestamp>_reviews/migration.sql` (generated, then add a CHECK by hand)
- Modify: `server/src/lib/enum-map.ts`
- Test: `server/test/integration/schema/reviews.test.ts`

**Interfaces:**
- Produces: Prisma model `review` with fields `id, fullName, text, rating, locale, status, reviewedAt, createdAt, updatedAt`; enum `ReviewStatus { pending, approved, rejected }` (`@@map("review_status")`); `reviewStatus` enum map in `enum-map.ts` (identity mapping, same shape as `inquiryStatus`); `ActivityKind.review`.

- [ ] **Step 1: Write the failing test** — `reviews.test.ts` (use `resetDb` and the db helpers like the other `schema/` tests):
  - `it("defaults a new review to pending")` → create `{ fullName: "Nino", text: "x".repeat(20), rating: 5, locale: "ka" }`, expect `status === "pending"` and `reviewedAt === null`.
  - `it("rejects a rating outside 1 to 5 at the database")` → creating with `rating: 6` rejects (check-constraint violation); same for `0`.
- [ ] **Step 2: Run** `npm run test:integration -- reviews` in `server/` → FAIL (`prisma.review` undefined).
- [ ] **Step 3: Implement** — model in the "Inquiries" area of the schema, matching existing conventions: `@id @default(uuid(7)) @db.Uuid`, snake_case `@map`s, `fullName VarChar(100)`, `text VarChar(1000)`, `rating Int @db.SmallInt`, `locale VarChar(2) @default("ka")`, `status ReviewStatus @default(pending)`, `reviewedAt Timestamptz(3)?`, timestamps as in `Testimonial`, `@@index([status, createdAt(sort: Desc)])`, `@@map("reviews")`. Run `npx prisma migrate dev --name reviews --create-only`, append `ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);`, then `npx prisma migrate dev`. Add `reviewStatus` to `enum-map.ts`.
- [ ] **Step 4: Run** the test → PASS. Also `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(server): reviews table`.

### Task 2: Public review endpoints

**Files:**
- Create: `server/src/modules/site/reviews.routes.ts`
- Modify: `server/src/middleware/rate-limits.ts`, `server/src/middleware/rate-limits.test.ts`, `server/src/app.ts`, `server/test/helpers/app.ts` (add generous `review`/`reviewDaily`)
- Test: `server/test/integration/content/reviews.test.ts`

**Interfaces:**
- Consumes: Task 1 model and `reviewStatus`.
- Produces: `publicReviewRoutes({ prisma, clock, spamCheck, limiters }: { prisma: PrismaClient; clock: Clock; spamCheck: SpamCheck | null; limiters: RequestHandler[] }): Router`, mounted at `/api/public/reviews`. `RateLimits.review` and `RateLimits.reviewDaily`. The spam check instance built in `app.ts` is shared with inquiries (build it once into a `const`).

- [ ] **Step 1: Write failing tests** (`describe("POST /api/public/reviews")` and `describe("GET /api/public/reviews")`; body helper `review(overrides)` = `{ fullName: "Giorgi Beridze", text: "They built our house on time and kept us informed.", rating: 5, locale: "en", website: "" }`):
  - stores a pending review, returns `201 { received: true }`, adds activity `"New review from Giorgi Beridze"` of kind `review`.
  - honeypot filled → 201, nothing stored.
  - spam check returns false (`buildTestApp({ spamCheck: async () => false })`) → 403 `SPAM_CHECK_FAILED`, nothing stored.
  - `rating` of `"5"`, `4.5`, `0`, `6` → 400 each, with a field error for `rating`.
  - `fullName: "   "` and `text` of 19 chars after trim → 400.
  - 4th submission in the hour with `limits: { review: { limit: 3, windowMs: 3_600_000 } }` → 429.
  - GET returns only approved reviews, newest first, exactly the keys `id, fullName, text, rating, createdAt` (ISO string); with 31 approved rows returns 30.
- [ ] **Step 2: Run** `npm run test:integration -- reviews` → FAIL (404s).
- [ ] **Step 3: Implement** — copy the inquiry POST shape (honeypot first, then `parse`, then spam check, then create + `recordActivity` in a transaction with `clock.now()`). Zod: `rating: z.number().int().min(1).max(5)`. Add `review: { limit: 3, windowMs: 60 * MINUTE }` and `reviewDaily: { limit: 10, windowMs: 24 * 60 * MINUTE }` to `DEFAULT_RATE_LIMITS` and to `createRateLimiters`; extend `rate-limits.test.ts` to assert those values.
- [ ] **Step 4: Run** the tests → PASS; then the full `npm test` (PowerShell) → all pass.
- [ ] **Step 5: Commit** — `feat(server): visitors can send reviews`.

### Task 3: Admin review endpoints and docs

**Files:**
- Modify: `server/src/modules/site/reviews.routes.ts`, `server/src/app.ts`, `server/docs/API_CONTRACTS.md`
- Test: `server/test/integration/content/reviews.test.ts` (append)

**Interfaces:**
- Produces (mounted at `/api/admin/reviews`, behind the existing guard — the route walker covers it automatically):
  - `GET /?status=pending|approved|rejected` → `{ items: AdminReview[]; counts: { all; pending; approved; rejected } }`, newest first. `AdminReview = { id, fullName, text, rating, locale, status, reviewedAt: string | null, createdAt: string }`.
  - `PATCH /:id` body `{ status: "approved" | "rejected" | "pending" }` → `AdminReview`; sets `reviewedAt = clock.now()`; activity `"Review approved: <name>"` / `"Review hidden: <name>"` / `"Review moved back to waiting: <name>"` with `actorId`.
  - `DELETE /:id` → 204; activity `"Review deleted: <name>"`.
  - Unknown id → 404 `NOT_FOUND` "That review doesn't exist."
  - Export: `adminReviewRoutes({ prisma, clock }): Router`.

- [ ] **Step 1: Write failing tests**: list with filter and counts (seed 2 pending, 1 approved, 1 rejected → counts `{ all: 4, pending: 2, approved: 1, rejected: 1 }`); approve makes it appear in public GET; hide removes it from public GET; delete → 204 then 404; PATCH with `{ status: "published" }` → 400; unknown id → 404; no cookie → 401.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** in the same routes file, following `adminInquiryRoutes` (`updateMany` count check for 404, `groupBy` for counts). Add a "Reviews" section to `API_CONTRACTS.md` next to testimonials, with both public and admin endpoints and the limits.
- [ ] **Step 4: Run** full `npm test`, `npm run typecheck`, `npm run lint` → all pass.
- [ ] **Step 5: Commit** — `feat(server): admin can approve, hide and delete reviews`.

### Task 4: Admin Reviews page

**Files:**
- Modify: `client/lib/api.ts` (types), `client/components/admin/AdminShell.tsx`
- Create: `client/components/admin/ReviewsAdmin.tsx`, `client/app/[lang]/admin/(panel)/reviews/page.tsx`

**Interfaces:**
- Consumes: Task 3 endpoints.
- Produces: types `ReviewStatus = "pending" | "approved" | "rejected"`, `AdminReview`, `ReviewList` in `client/lib/api.ts`.

- [ ] **Step 1: Types** in `api.ts` matching Task 3 exactly.
- [ ] **Step 2: `ReviewsAdmin`** — follow `TestimonialsAdmin.tsx` / the inquiries page for layout, data loading and toasts. Tabs Waiting / Approved / Hidden with counts (default Waiting). Row: name, stars (5 icons, filled = rating, `aria-label="4 out of 5 stars"`), full text, language (`Georgian`/`English`/`Russian`), sent date. Actions: Approve (if not approved), Hide (if not rejected), Delete via `ConfirmDialog`. Empty state per tab. A one-line note under the title: "Approved reviews appear on the home page within a minute."
- [ ] **Step 3: Sidebar** — nav item `{ href: "/admin/reviews", label: "Reviews", icon: Star, badge: "reviews" }` right after Testimonials; `SEGMENT_LABEL.reviews = "Reviews"`; a second `useAdminPoll<ReviewList>("/api/admin/reviews?status=pending")` feeding the badge with `counts.pending`, same pattern as inquiries.
- [ ] **Step 4: Page** `reviews/page.tsx` with `metadata.title = "Reviews"`, rendering `<ReviewsAdmin />`.
- [ ] **Step 5: Verify** — `npx tsc --noEmit` and `npm run lint` in `client/` pass. Run both apps, submit a review with curl, see the badge show 1, approve it, badge clears.
- [ ] **Step 6: Commit** — `feat(admin): reviews page with approve, hide and delete`.

### Task 5: Home-page reviews slider and form

**Files:**
- Create: `client/hooks/useTurnstile.ts`, `client/hooks/useAutoSlider.ts`, `client/components/sections/home/Reviews.tsx`, `client/components/sections/home/ReviewForm.tsx`, `client/components/ui/Stars.tsx`
- Modify: `client/components/sections/ContactForm.tsx` (use the hook), `client/lib/public-types.ts`, `client/lib/public-api.ts`, `client/app/[lang]/(site)/page.tsx`, `client/i18n/locales/{ka,en,ru}/home.json`

**Interfaces:**
- Consumes: `GET`/`POST /api/public/reviews`.
- Produces:
  - `PublicReview = { id: string; fullName: string; text: string; rating: number; createdAt: string }`.
  - `getReviews(): Promise<PublicReview[]>` in `public-api.ts` — `"use cache"`, `cacheLife(LIFE)`, `cacheTag("reviews")`, no locale param.
  - `useTurnstile(locale: Locale): { enabled: boolean; token: string; widgetRef: (el: HTMLDivElement | null) => void; reset: () => void; onScriptLoad: () => void }` — the exact logic now inside `ContactForm` (lines ~56–97), moved, not rewritten. `ContactForm` must behave the same after.
  - `useAutoSlider({ count, visible, intervalMs = 5000 }): { index: number; go: (dir: 1 | -1) => void; playing: boolean; setPlaying: (v: boolean) => void; pauseProps: { onMouseEnter; onMouseLeave; onFocus; onBlur } }` — pauses while hovered/focused/`document.hidden`; `playing` starts `false` under reduced motion; does nothing when `visible >= count`; index loops `0..count - visible`.
  - `<Stars value={n} className? />` — 5 star icons, filled ones in clay, `role="img"` with translated label.

- [ ] **Step 1: Extract `useTurnstile`** and switch `ContactForm` to it. Verify the contact page still renders the widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set and submits normally. `npx tsc --noEmit` passes. Commit: `refactor(client): share the Turnstile logic`.
- [ ] **Step 2: Data** — `PublicReview`, `getReviews`, and fetch it in the home page `Promise.all`; render `<Reviews items={reviews} />` right after `<Testimonials />`.
- [ ] **Step 3: Strings** — add `reviews` to each `home.json`: `title` ("What our clients say" variant distinct from testimonials, e.g. en "Reviews"), `empty` (invitation when none), `write` ("Write a review"), `previous`, `next`, `pause`, `play`, `stars` ("{{count}} out of 5 stars"), `carousel`, `slide`, and a `form` group: `name`, `text`, `rating`, `send`, `sending`, `thanksTitle`, `thanksBody` ("It will appear here after we check it."), `close`, `validation.name|text|rating`, `errors.failed|rateLimited|spam|verify`. Translate for ka and ru. `npm run i18n:check` passes.
- [ ] **Step 4: `Reviews` section** — heading + "Write a review" button (opens `Dialog` with `ReviewForm`). Track = flex row translated by `-(index * 100 / visible)%` with a 600 ms ease transition (none under reduced motion); `visible` from `useMediaQuery` (1 / 2 / 3 per Global Constraints). Card: `Stars`, text (`whitespace-pre-line break-words`), name, month + year via `Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })`. Controls: prev, next, play/pause (all with `aria-label`s), hidden when everything fits. Touch swipe: pointer down/up delta > 40 px calls `go`. Section `aria-roledescription` carousel; slides `aria-roledescription` slide and `aria-hidden` when off-screen. With zero items: heading, `empty` text and the button only.
- [ ] **Step 5: `ReviewForm`** — fields name, text (with character count toward 20 minimum), star picker as a radio group of 5 (keyboard arrows work, label per star). Honeypot `website`, `useTurnstile`, POST via `api` with `locale`. Mirrors `ContactForm` handling of 400 field errors, 403, 429. Success replaces the form with `thanksTitle`/`thanksBody` and a close button.
- [ ] **Step 6: Verify** — `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` pass. In the browser (iframes at 1440 and 390 wide): approve 5 seeded reviews and watch it auto-advance and pause on hover; with 1 review no controls show; submit through the dialog and see it land under Waiting in admin; turn on reduced motion and confirm it doesn't move; check the Review Focus #1 long-word case.
- [ ] **Step 7: Commit** — `feat(client): reviews slider and review form on the home page`.
