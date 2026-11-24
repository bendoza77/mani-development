# Visitor reviews — design

Date: 2026-11-24
Status: approach chosen by the owner ("Both"); the rest are builder calls, marked *(call)*.

## Intent

Visitors can leave a review of the company: full name, review text and 1–5 stars. Nothing is shown
until the admin approves it. Approved reviews play in a modern slider that moves by itself.

## Approaches

1. **Reuse Testimonials.** Visitor reviews land in the existing testimonials table as drafts; stars added.
   One list, one slider. Less to build, but mixes admin-written trilingual quotes with visitor text.
2. **Separate Reviews list (chosen by the owner).** Admin testimonials stay exactly as they are. A new
   `Review` table, admin page and home-page slider sit beside them. More to build and look after, but the
   two kinds of content never mix.
3. Third-party review widget (Google reviews embed). Rejected: no moderation in the admin, adds a
   tracker, breaks the site's look.

## Goals

- Public form: full name (2–100 chars), review (20–1000 chars), stars (whole 1–5). Required, all three.
- New reviews wait for the admin. Admin can approve, hide (reject) and delete.
- Approved reviews show on the home page in an auto-playing slider.

## Non-goals

- No email, phone or account for reviewers *(call: the owner listed only name, text, stars)*.
- No admin editing of a visitor's words — approve, hide or delete only *(call: keeps reviews honest)*.
- No translation of reviews. A review shows as written on every language version *(call)*.
- No star-rating rich results / `AggregateRating` JSON-LD. Google ignores self-hosted reviews of the
  business itself, and fake-looking markup is a risk *(call)*.
- No bell notification or email for new reviews in this pass. The `Notification` table is tied to
  inquiries (`inquiryId` not null); a sidebar badge with the waiting count covers it *(call)*.

## Anti-goals

- Spam reaching the public page without review.
- The slider looking like a template: follow the public design rules (sentence-case labels, no mono,
  no arrows on internal buttons, clay only for interactive/active states and the stars).
- Motion that ignores `prefers-reduced-motion` or can't be paused.

## Data

New Prisma model `Review` (table `reviews`):

| field | type | notes |
|---|---|---|
| id | uuid v7 | |
| fullName | varchar(100) | |
| text | varchar(1000) | |
| rating | smallint | 1–5, DB check constraint |
| locale | varchar(2) | site language it was sent from (ka/en/ru), shown to the admin |
| status | enum `review_status` PENDING / APPROVED / REJECTED | default PENDING |
| createdAt, updatedAt | timestamptz(3) | |
| reviewedAt | timestamptz(3)? | when the admin last approved/hid it |

Index `(status, createdAt desc)`. One migration.

## API

Public:
- `POST /api/public/reviews` — body `{ fullName, text, rating, locale, turnstileToken?, website? }`.
  Same spam handling as the contact form: honeypot `website` (silent fake success), Turnstile when
  configured, rate limits *(call: 3 per hour, 10 per day per IP, new `review`/`reviewDaily` limits)*.
  Returns `201 { received: true }`. Records an activity entry.
- `GET /api/public/reviews` — approved only, newest first, capped at 30 *(call)*:
  `{ items: [{ id, fullName, text, rating, createdAt }] }`.

Admin (behind the existing guard):
- `GET /api/admin/reviews?status=pending|approved|rejected` → `{ items, counts: { all, pending, approved, rejected } }`.
- `PATCH /api/admin/reviews/:id` `{ status }` — approve or hide; sets `reviewedAt`; activity entry.
- `DELETE /api/admin/reviews/:id` — activity entry.
- Sidebar badge: waiting (pending) count, same mechanism as the inquiries badge.

Docs: add the endpoints to `server/docs/API_CONTRACTS.md`.

## Public site

- New home-page section **Reviews**, placed after Testimonials *(call)*.
- Slider *(calls)*: a horizontal row of review cards — 1 card on phones, 2 on tablets, 3 on desktop.
  Moves one card every 5 s, loops. Pauses on hover, keyboard focus, and when the tab is hidden; stops
  entirely under reduced motion. Swipe/drag on touch, previous/next buttons, a play/pause button
  (WCAG 2.2.2). No new dependency: CSS transform track + small hook.
- Card: stars (clay, with text "4 out of 5" for screen readers), review text, full name, month and year.
- "Write a review" button opens a dialog with the form; Turnstile widget as on the contact form.
  On success: thank-you message saying it will appear after a check.
- With no approved reviews yet, the section shows only a short invitation and the button.
- New strings in `home.json` for ka/en/ru.

## Admin

- New page `/admin/reviews` ("Reviews", star icon) next to Testimonials in the sidebar, with the badge.
- Tabs: Waiting / Approved / Hidden, with counts. Each row: name, stars, text, language, date, and
  Approve / Hide / Delete actions (delete asks to confirm).

## Tests

- Server integration tests: submit (valid, invalid, honeypot, spam check fail, rate limit), public list
  only shows approved, admin list/filter/counts, approve/hide/delete, guard (route walker).
- Client: type check and lint; a manual check of the slider at 1440 and 390 widths.

## Left to the builder

Exact card styling within the design rules, slide timing within 4–7 s, dialog component choice
(reuse what the site already has if any).
