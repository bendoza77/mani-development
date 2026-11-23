# API Contracts (REST, Express 5)

**Status:** PROPOSED. Every endpoint maps to a frontend feature (`F-xx` in [FRONTEND_REQUIREMENTS_AUDIT.md](FRONTEND_REQUIREMENTS_AUDIT.md)). The field limits referenced here are defined once in [DATABASE_DESIGN.md](DATABASE_DESIGN.md) §3 and enforced by Zod.

---

## 1. Conventions

### Transport and format

| Topic | Rule |
|---|---|
| Base URL | `https://api.manidevelopment.ge/api` (topology A, INTEGRATIONS §7). The `/api` prefix also makes the proxy topology possible without changing routes |
| Versioning | **None.** There is one client, deployed with the API. Changes are additive; breaking changes ship as coordinated releases. Introduce `/v2` only if a second, independently released client appears |
| Format | JSON in and out (`Content-Type: application/json`). Unsafe methods with another content type get `415` |
| Field names | camelCase, matching `client/lib/types.ts` where the concept is the same |
| Enum values | Exactly the frontend's strings: `in-progress`, `on-hold`, `completed`, `new`, `resolved`, … (the mapping from Prisma names happens in one serializer, DATABASE_DESIGN §1) |
| Dates | Calendar dates as `YYYY-MM-DD`; timestamps as ISO-8601 UTC (`2026-11-17T15:42:00.000Z`) |
| IDs | UUID strings. Public project URLs use `slug` |
| Locale | Public `GET`s accept `?locale=ka\|en\|ru`; **default `ka`** (Georgian is primary, Q-02). Each text field returns the requested language, falling back to Georgian when the English value is empty; Russian falls back to English, then Georgian. Admin bodies carry a `…Ru` twin of every `…En` field |

### Lists, auth, caching, headers

| Topic | Rule |
|---|---|
| Lists | `{ "items": [...] }`. Paginated lists add `page`, `pageSize`, `total`. `?page` starts at 1; `pageSize` defaults to 25, max 100 |
| Auth | Session cookie (SECURITY_PLAN §2). `/api/admin/*` and `/api/auth/session|logout|password` need it |
| Caching | `/api/auth/*` and `/api/admin/*` → `Cache-Control: no-store`. Public `GET`s → `Cache-Control: no-cache`; the Next.js server caches them with tags (INTEGRATIONS §8) |
| Request ID | Every response carries `X-Request-Id` |

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": {
      "fieldErrors": {
        "summary": [{ "code": "too_big", "maximum": 180 }],
        "specs.0.label": [{ "code": "too_small", "minimum": 1 }]
      }
    },
    "requestId": "6f0c…"
  }
}
```

- `fieldErrors` uses **codes plus parameters, not sentences**, so the frontend can show its own translated messages. The contact form already looks messages up per field (`contact:validation.<field>`).

### Status codes

| Status | `code` values | When |
|---|---|---|
| 200 / 201 / 202 / 204 | — | OK / created / accepted (password-reset request, always) / no body |
| 400 | `VALIDATION_FAILED`, `MALFORMED_JSON`, `INVALID_OR_EXPIRED_TOKEN` | Schema failure, unknown keys, bad JSON; bad reset token |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | No or expired session; failed login (also used when the account is locked) |
| 403 | `ORIGIN_NOT_ALLOWED`, `SPAM_CHECK_FAILED` | Origin check (SECURITY_PLAN §5); Turnstile failure |
| 404 | `NOT_FOUND` | Unknown resource, or a public lookup of a non-public record |
| 409 | `SLUG_TAKEN`, `MEDIA_IN_USE`, `ORDER_MISMATCH`, `UPLOAD_NOT_FINISHED` | Conflicts |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 kB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Non-JSON body on an unsafe method |
| 422 | `INVALID_REFERENCE` | Referenced media/project doesn't exist or media isn't `READY` |
| 429 | `RATE_LIMITED` | With `Retry-After` and `RateLimit` headers |
| 500 | `INTERNAL` | Unexpected; details only in logs |
| 502 | `UPSTREAM_UNAVAILABLE` | Cloudflare (or another provider) failed or timed out |
| 503 | `NOT_READY` | Readiness check failed |

---

## 2. Shared shapes

```ts
type Image = {                 // replaces the bare URL strings in client/lib/types.ts
  id: string;
  src: string;                 // Cloudflare: https://imagedelivery.net/<hash>/<id>/public ; dev seed: /images/x.jpg
  width: number;
  height: number;
  alt: string;
};

type ProjectCard = {           // enough for ProjectCard, ProjectsExplorer, FeaturedProjects, ProjectsSummary, related list
  id: string; slug: string; title: string; summary: string;
  location: string; city: string;
  category: "residential" | "apartments" | "commercial" | "hospitality" | "renovation";
  status: "planning" | "in-progress" | "completed" | "on-hold";
  progress: number; startDate: string; estimatedCompletion: string; completionDate: string | null;
  featured: boolean; cover: Image; updatedAt: string;
};

type ProjectDetail = ProjectCard & {
  description: string; architect: string;
  specs: { id: string; label: string; value: string }[];   // ordered
  gallery: Image[];                                       // ordered
  blocks: Block[];                                        // ordered free content, may be empty (§8.1)
  seo: Seo;                                               // resolved values, defaults already applied (§8.2)
};
// Admin project responses also carry: isPublished, publishedAt, and the raw SEO inputs (§8.2).

type Service = { id: string; title: string; summary: string; description: string;
                 features: string[]; image: Image; visible: boolean; position: number };
type TeamMember = { id: string; name: string; role: string; bio: string;
                    photo: Image; visible: boolean; position: number };
type Testimonial = { id: string; quote: string; author: string; role: string;
                     project: { id: string; slug: string; title: string } | null;
                     published: boolean; createdAt: string };

type InquirySummary = { id: string; name: string; email: string; subject: string;
                        excerpt: string;            // first 160 chars of message
                        status: "new" | "in-progress" | "resolved"; createdAt: string };
type Inquiry = InquirySummary & { phone: string | null; message: string;
                                  notes: { id: string; text: string; createdAt: string }[] };

type MediaAsset = Image & { kind: "image" | "video";
                            filename: string; category: "exterior" | "interior" | "construction" | "team" | "uploads";
                            bytes: number; mimeType: string;
                            status: "pending" | "processing" | "ready" | "failed";
                            durationSeconds: number | null;      // video only
                            createdAt: string };
// For kind "video": `src` is the Cloudflare Stream player address, and `poster` (thumbnail URL) is added.
type MediaUsage = { type: "project-cover" | "project-gallery" | "project-block" | "page-block" | "service" | "team"
                          | "slide" | "social-image";
                    id: string; label: string };

type SiteSettings = { companyName: string; tagline: string; email: string; phone: string;
                      address: string; hours: string;
                      instagramUrl: string; linkedinUrl: string; facebookUrl: string;
                      whatsappNumber: string; messengerUsername: string; mapUrl: string;
                      latitude: number | null; longitude: number | null;
                      defaultSeoDescription: string; defaultOgImage: Image | null;
                      googleSiteVerification: string; gtmContainerId: string;
                      updatedAt: string };

type ActivityItem = { id: string; kind: "project" | "inquiry" | "service" | "testimonial" | "team" | "media" | "settings"
                            | "page" | "navigation" | "slide" | "redirect";
                      message: string; at: string };
type Notification = { id: string; title: string; body: string; href: string; at: string; read: boolean };
type AdminUser = { id: string; name: string; email: string };
```

- **Public responses never include `visible`, `published` or `position`.** They list only visible or published records, already in display order.
- **Admin responses include them.**
- **Bilingual fields (Q-02):**
  - **Public outputs** keep the single field names above (`title`, `summary`, …), already resolved for `?locale`.
  - **Admin inputs and outputs** use language-suffixed pairs for every translatable field: `titleKa` (required) / `titleEn` (optional, `null` or `""` = use Georgian), likewise `summary*`, `description*`, `location*`, `city*`, spec `label*`/`value*`, `features*`, `quote*`, `author*`, `role*`, `name*`, `bio*`, `alt*`, `tagline*`, `address*`, `hours*`. The lists in DATABASE_DESIGN §3 mark them 🌐.
  - So in §6 below, read `title` in an admin body as the pair `titleKa`/`titleEn`.
- **`Service` also has `slug`** (stable `/services#<slug>` anchor, DATABASE_DESIGN §3.4).

---

## 3. Health (Phase 1)

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/health/live` | none | `200 {"status":"ok"}`. The process is up; no dependencies are checked |
| GET | `/api/health/ready` | none | `200 {"status":"ok","checks":{"database":"ok"}}` or `503 {"status":"unavailable","checks":{"database":"down"}}`. Runs `SELECT 1` with a 2 s timeout. This is Render's `healthCheckPath` |

---

## 4. Authentication (Phase 4, F-01)

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | `200 { user: AdminUser }` + `Set-Cookie` | 400, 401 `INVALID_CREDENTIALS`, 403 origin, 429 |
| POST | `/api/auth/logout` | — | `204` + cookie cleared (idempotent, also `204` without a session) | 403 origin |
| GET | `/api/auth/session` | — | `200 { user: AdminUser }` | 401 |
| POST | `/api/auth/password` | `{ currentPassword, newPassword }` | `204`. All sessions revoked, a new one issued | 400, 401, 403, 429 |
| POST | `/api/auth/password-reset/request` | `{ email }` | **always `202`** (no account discovery). Sends a reset link to the registered address if it matches | 400 (malformed email only), 403 origin, 429 |
| POST | `/api/auth/password-reset/confirm` | `{ token, newPassword }` | `204`. Password changed, all sessions revoked, "password changed" email sent; **no automatic login** | 400 `INVALID_OR_EXPIRED_TOKEN` (same for unknown, expired or used), 400 validation, 403 origin, 429 |

**Validation:**
- `email`: valid email, ≤ 254 characters.
- `password`: 1–128 characters on login (so no hints are given); 12–128 for `newPassword`.
- `token`: 43-character base64url (32 bytes).

**Reset link:** `https://www.manidevelopment.ge/admin/reset-password#token=<token>`. The token stays in the URL fragment so it is never sent to a server or in a `Referer` header (SECURITY_PLAN §2).

**Frontend pages needed (Phase 12):**
- `/admin/forgot-password` (email form; always shows "If that address is registered, we've sent a link")
- `/admin/reset-password` (new password form)
- a "Forgot password?" link on the login page

---

## 5. Public endpoints (no auth)

| Method | Path | Feature | Response | Notes |
|---|---|---|---|---|
| GET | `/api/public/settings` | F-10 | `SiteSettings` (minus `updatedAt`) | |
| GET | `/api/public/projects` | F-03 | `{ items: ProjectCard[] }` | All public projects, newest `updatedAt` first. Not paginated (DATABASE_DESIGN §6). The frontend applies its own filter and sort rules (`ProjectsExplorer.tsx:55-71`) |
| GET | `/api/public/projects/:slug` | F-03 | `ProjectDetail` | `404` for unknown or unpublished slugs |
| GET | `/api/public/pages/:key` | CR-CMS-03 | `PageDetail` (§8.3) | `:key` is a custom page slug or a system page key (`home`, `projects`, `services`, `about`, `contact`). Published only |
| GET | `/api/public/navigation` | CR-PW-08 | `{ header: NavLink[], footer: NavLink[] }` (§8.4) | Visible items whose target page is published |
| GET | `/api/public/slides` | CR-PW-02 | `{ items: Slide[] }` (§8.5) | Published only, by `position` |
| GET | `/api/public/resolve?path=` | CR-SEO-13 | `{ kind: "project" \| "page" \| "redirect" \| "none", to?: string }` (§8.6) | Lets the frontend return a real 404 or a redirect before rendering |
| GET | `/api/public/sitemap` | CR-SEO-08 | `{ items: SitemapEntry[] }` (§8.7) | Every indexable published address |
| GET | `/api/public/services` | F-04 | `{ items: Service[] }` | Visible only, by `position` |
| GET | `/api/public/team` | F-05 | `{ items: TeamMember[] }` | Visible only, by `position` |
| GET | `/api/public/testimonials` | F-06 | `{ items: Testimonial[] }` | Published only, newest first |
| POST | `/api/public/inquiries` | F-07 | `201 { "received": true }` | See below |

### `POST /api/public/inquiries`

**Request:**

```json
{
  "name": "Natia Gogoladze",
  "email": "natia@example.com",
  "phone": "+995 555 21 44 10",
  "subject": "Family house in Tskneti",
  "message": "We own a 900 m² plot …",
  "locale": "ka",
  "turnstileToken": "…",
  "website": ""
}
```

**Validation** (the frontend's rules, `ContactForm.tsx:18-26`, plus maximums):

| Field | Rule |
|---|---|
| `name` | 2–100 |
| `email` | valid, ≤ 254 |
| `phone` | optional; ≤ 40; ≥ 7 digits; only digits, spaces and `+ ( ) -` |
| `subject` | 3–120 |
| `message` | 20–5000 |
| `locale` | `ka`\|`en`, optional (default `ka`). Used only for the visitor acknowledgement email language if Q-29(4) enables it; not stored otherwise |
| `turnstileToken` | required if Q-09 = yes |
| `website` | **Honeypot.** It must be empty. If it is filled in, the API returns the same `201`, but stores and sends nothing |

**Effects (one transaction):**
- `Inquiry`, `Notification(NEW_INQUIRY)`, `ActivityLog("New inquiry from <name>")`
- `EmailMessage` outbox row for the company notification (plus the visitor acknowledgement if Q-29(4) = yes)

**Errors:** 400 (field details), 403 `SPAM_CHECK_FAILED`, 413, 415, 429.

**No inquiry ID is returned to the public.** The visitor has no use for it, and it would let them probe the store.

---

## 6. Admin endpoints (session required; all → `401` without it)

### 6.1 Projects (Phase 7, F-02)

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/admin/projects` | `?status=&category=&q=&sort=title\|status\|progress\|updatedAt&dir=asc\|desc` | `{ items: ProjectCard[], counts: { all, planning, "in-progress", completed, "on-hold" } }`. Not paginated |
| GET | `/api/admin/projects/:id` | — | `ProjectDetail` |
| POST | `/api/admin/projects` | `ProjectInput` | `201 ProjectDetail` |
| PUT | `/api/admin/projects/:id` | `ProjectInput` | `200 ProjectDetail` |
| PATCH | `/api/admin/projects/:id` | `{ status?, progress?, featured? }` (≥ 1 key) | `200 ProjectDetail`. Covers the inline status and featured actions (`ProjectsAdmin.tsx:60-72`) |
| DELETE | `/api/admin/projects/:id` | — | `204`. Specs and gallery rows cascade; testimonials keep `project: null` |

```ts
type ProjectInput = {
  slug: string; title: string; summary: string; description: string;
  location: string; city: string; category: ProjectCategory; status: ProjectStatus;
  progress: number;                       // integer 0–100; forced to 100 when status = completed
  startDate: string; estimatedCompletion: string; completionDate: string | null;
  featured: boolean; architect: string;   // architect may be ""
  coverId: string;                        // READY media
  galleryIds: string[];                   // ≤ 30, unique, READY media, in display order
  specs: { label: string; value: string }[];   // ≤ 20, in display order
  blocks: BlockInput[];                   // ≤ 60, in display order (§8.1); may be empty
  isPublished: boolean;                   // false = draft
  seo: SeoInput;                          // all optional overrides (§8.2)
};
```

- The `PATCH` route also accepts `{ isPublished }` for a one-click publish or unpublish from the list.
- **Validation:** every rule in `ProjectForm.tsx:43-61`, plus the maximum lengths, the block rules (§8.1) and the SEO rules (§8.2).
- **Slug change on a published project:** the response is normal, and a redirect from the old address is created automatically (§8.6).
- **Errors:**
  - `409 SLUG_TAKEN`
  - `422 INVALID_REFERENCE` (cover, gallery, block or social-image media missing or not ready)
  - `400` for date-order and `completed` rules, with field paths matching the form (`estimatedCompletion`, `completionDate`)

### 6.2 Services (Phase 8, F-04) and Team (Phase 8, F-05)

Identical patterns. Team uses `/api/admin/team` with `{ name, role, bio, photoId, visible }`.

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/admin/services` | — | `{ items: Service[] }` by position |
| POST | `/api/admin/services` | `{ slug?, title, summary, description, features: string[], imageId, visible }` (`slug` defaults to the transliterated Georgian title) | `201 Service`, appended at the end (`ServicesAdmin.tsx:76`); `409 SLUG_TAKEN` |
| PUT | `/api/admin/services/:id` | same as POST | `200 Service` |
| PATCH | `/api/admin/services/:id` | `{ visible }` | `200 Service` |
| DELETE | `/api/admin/services/:id` | — | `204`; remaining positions re-compacted |
| PUT | `/api/admin/services/order` | `{ ids: string[] }` (the complete list, new order) | `200 { items }`; `409 ORDER_MISMATCH` if the set differs from the stored set |

- **Why a whole-list reorder instead of "move up/down":** it's a single idempotent request that can't be interrupted halfway. The UI computes the new order locally from its up/down buttons.
- **Validation:** services follow `ServicesAdmin.tsx:105-110` (`features` ≤ 12, each 1–100 characters). Team follows `TeamAdmin.tsx:102-107`.

### 6.3 Testimonials (Phase 8, F-06)

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/admin/testimonials` | `?published=true\|false` | `{ items, counts: { all, published, draft } }`, newest first |
| POST | `/api/admin/testimonials` | `{ quote, author, role, projectId: string \| null, published }` | `201` |
| PUT | `/api/admin/testimonials/:id` | same | `200` |
| PATCH | `/api/admin/testimonials/:id` | `{ published }` | `200` |
| DELETE | `/api/admin/testimonials/:id` | — | `204` |

- **Validation:** quote 20–400; author and role 1–100; `projectId` must exist (`422`).

### 6.4 Site settings (Phase 8, F-10)

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/admin/settings` | — | `SiteSettings` |
| PUT | `/api/admin/settings` | all `SiteSettings` fields except `updatedAt` | `200 SiteSettings` |

- **Validation:** `SettingsAdmin.tsx:19-29`. Social URLs must be empty or an absolute `http(s)` URL ≤ 300 characters.
- **New fields** (contact channels, SEO, analytics) follow the format checks in DATABASE_DESIGN §3.8. The body sends `defaultOgImageId` (a ready image, or `null`).
- **Public settings** include the contact channels, `googleSiteVerification` and `gtmContainerId`, because the site needs them to render. None of them is a secret.

### 6.5 Inquiries (Phase 9, F-08)

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/admin/inquiries` | `?status=&q=&page=&pageSize=` | `{ items: InquirySummary[], page, pageSize, total, counts: { all, new, "in-progress", resolved } }`, newest first. `q` matches name, email, subject, message (case-insensitive) |
| GET | `/api/admin/inquiries/:id` | — | `Inquiry` |
| PATCH | `/api/admin/inquiries/:id` | `{ status }` | `200 Inquiry` |
| DELETE | `/api/admin/inquiries/:id` | — | `204`; notes and notification cascade |
| POST | `/api/admin/inquiries/:id/notes` | `{ text }` (1–2000 characters) | `201 { id, text, createdAt }` |
| DELETE | `/api/admin/inquiries/:id/notes/:noteId` | — | `204`; `404` if the note belongs to another inquiry |

### 6.6 Notifications, activity, dashboard, search (Phase 9, F-12–F-14, F-16)

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/admin/notifications` | — | `{ items: Notification[], unread: number }`, newest first, max 50 |
| POST | `/api/admin/notifications/read` | `{ ids: string[] }` or `{ all: true }` | `204` |
| DELETE | `/api/admin/notifications/:id` | — | `204` |
| GET | `/api/admin/activity` | `?limit=` (1–100, default 12) | `{ items: ActivityItem[] }`; `auth` entries excluded |
| GET | `/api/admin/dashboard` | — | see below |
| GET | `/api/admin/search` | `?q=` (2–100 characters) | `{ items: { type: "project"\|"inquiry"\|"team"\|"service", id, label, meta, href }[] }`, max 8 |

**Dashboard response:**

```json
{
  "projects": { "total": 12, "byStatus": { "planning": 1, "in-progress": 5, "completed": 5, "on-hold": 1 } },
  "inquiries": {
    "total": 10,
    "byStatus": { "new": 4, "in-progress": 3, "resolved": 3 },
    "perMonth": [{ "month": "2026-06", "count": 0 }, "…6 calendar months in UTC, oldest first…"]
  },
  "recentInquiries": ["…5 × InquirySummary…"],
  "recentProjects": ["…5 × { id, title, location, progress, status, updatedAt }…"],
  "activity": ["…12 × ActivityItem…"]
}
```

These are the figures `Dashboard.tsx:27-62` computes today.

### 6.7 Media (Phase 5, F-09)

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/admin/media` | `?category=&q=&page=&pageSize=` | `{ items: MediaAsset[] (ready only), page, pageSize, total, counts }`; `q` matches filename and alt |
| GET | `/api/admin/media/:id` | — | `MediaAsset & { usedBy: MediaUsage[] }` |
| POST | `/api/admin/media/uploads` | `{ filename, mimeType, bytes, width, height, category?, alt? }` | `201 { media: { id, status: "pending" }, uploadUrl, expiresAt }` |
| POST | `/api/admin/media/:id/complete` | — | `200 MediaAsset` (ready); `409 UPLOAD_NOT_FINISHED`; idempotent once ready |
| PATCH | `/api/admin/media/:id` | `{ alt?, category? }` | `200 MediaAsset` |
| DELETE | `/api/admin/media/:id` | — | `204`; `409 MEDIA_IN_USE` with `details.usedBy` (Q-11) |
| POST | `/api/admin/media/delete` | `{ ids: string[] }` (≤ 100) | `200 { deleted: string[], blocked: { id, usedBy: MediaUsage[] }[] }` (bulk delete from `MediaAdmin.tsx:110-118`; per item, not all-or-nothing) |

**Image upload validation:**
- `mimeType` ∈ `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- `bytes` 1…10,485,760
- `width`/`height` 1…12,000
- `filename` ≤ 255 characters
- `alt` ≤ 300 characters (default derived from the filename, as `MediaAdmin.tsx:35-36` does)

**Video uploads (Cloudflare Stream, CR-CMS-04; needs Q-25 approval).** The same two endpoints are used, with `kind: "video"` in the request:

| Step | Call | Result |
|---|---|---|
| 1 | `POST /api/admin/media/uploads` with `{ kind: "video", filename, mimeType, bytes, durationSeconds, alt? }` | `201 { media: { id, status: "pending" }, uploadUrl, expiresAt }`. The server asks Cloudflare Stream for a one-time upload URL with `maxDurationSeconds` set from the declared duration |
| 2 | The browser uploads the file straight to `uploadUrl` | — |
| 3 | `POST /api/admin/media/:id/complete` | `200 MediaAsset` with `status: "processing"` while Cloudflare encodes, then `"ready"` (or `"failed"`). The admin UI polls `GET /api/admin/media/:id` every few seconds until it settles |

- **Video validation:**
  - `mimeType` ∈ `video/mp4`, `video/quicktime`, `video/webm`
  - `bytes` ≤ 200 MB (Cloudflare's limit for a simple upload; larger files need a resumable protocol, which is a future enhancement)
  - `durationSeconds` 1…600 (10 minutes, PROPOSED)
- The list endpoint gains `?kind=image|video`.
- A video can be used in a block only when it is `ready`.

**Upstream errors:** `502 UPSTREAM_UNAVAILABLE`.

---

## 7. Endpoint → frontend usage map

| Frontend file | Today (`client/lib/store.ts` / `session.ts`) | After Phases 11–12 |
|---|---|---|
| `LoginForm.tsx`, `AdminShell.tsx` | `signIn`, `signOut`, `useSession` | `/api/auth/*` |
| `ProjectsAdmin.tsx`, `ProjectForm.tsx` | `projectsDB.*` | `/api/admin/projects*` |
| `ServicesAdmin.tsx` / `TeamAdmin.tsx` / `TestimonialsAdmin.tsx` | `servicesDB` / `teamDB` / `testimonialsDB` | `/api/admin/services*` / `team*` / `testimonials*` |
| `InquiriesAdmin.tsx` | `inquiriesDB` | `/api/admin/inquiries*` |
| `MediaAdmin.tsx`, `MediaPicker.tsx` | `mediaDB`, data URLs | `/api/admin/media*` + Cloudflare upload |
| `SettingsAdmin.tsx` | `updateSettings` | `/api/admin/settings` |
| `Dashboard.tsx` | derived in browser | `/api/admin/dashboard` |
| `AdminShell.tsx` (search, bell, badge) | derived / `markNotifications` | `/api/admin/search`, `/api/admin/notifications*`, `counts.new` |
| `ContactForm.tsx` | `recordInquiry` | `POST /api/public/inquiries` |
| Public sections, header, footer, logo, project page metadata | `useDB` + seed | `/api/public/*` fetched on the Next.js server with cache tags |
| `SiteHeader.tsx`, `SiteFooter.tsx` (menus) | hard-coded `NAV` constant | `/api/public/navigation` |
| `home/Hero.tsx` (homepage opening) | fixed copy + 3D house | `/api/public/slides` (Q-20) |
| *(new)* generic page route + block renderer | — | `/api/public/pages/:key` |
| *(new)* admin screens: pages, navigation, slider, redirects | — | `/api/admin/pages*`, `navigation*`, `slides*`, `redirects*` |
| `client/proxy.ts` | locale routing only | also calls `/api/public/resolve` for redirects and real 404s |
| *(new)* `sitemap.ts`, `robots.ts`, preview route | — | `/api/public/sitemap`, `/api/preview/verify` |

---

## 8. CMS, SEO and preview contracts (added 2026-11-20 for the client requirements)

Entities are in DATABASE_DESIGN §3.9–3.12. The validation and sanitization rules are in SECURITY_PLAN §17.

### 8.1 Content blocks (Phase 6; CR-CMS-04, CR-CMS-05)

Pages and projects carry an ordered `blocks` array. Public responses return resolved, single-language blocks. Admin bodies send both languages.

```ts
// Public (already resolved for ?locale)
type Block =
  | { id: string; type: "heading"; level: 2 | 3; text: string }
  | { id: string; type: "text"; doc: RichTextDoc }
  | { id: string; type: "image"; image: Image; caption: string }
  | { id: string; type: "gallery"; images: Image[] }
  | { id: string; type: "video"; video: { src: string; poster: string; durationSeconds: number; title: string }; caption: string }
  | { id: string; type: "embed"; provider: "youtube" | "vimeo"; videoId: string; title: string };

// Admin input (🌐 = { ka: …; en?: … })
type BlockInput =
  | { type: "heading"; level: 2 | 3; text: Localized<string> }
  | { type: "text"; doc: Localized<RichTextDoc> }
  | { type: "image"; mediaId: string; caption?: Localized<string> }
  | { type: "gallery"; mediaIds: string[] }                       // 2–30 images
  | { type: "video"; mediaId: string; caption?: Localized<string> }   // a READY video
  | { type: "embed"; url: string; title: Localized<string> };     // a YouTube or Vimeo link; the server extracts provider + id
```

**`RichTextDoc`** is the editor's structured JSON (Tiptap / ProseMirror format, Q-22), restricted to this allow-list. Anything else is rejected with `400`:

| Allowed nodes | Allowed marks |
|---|---|
| `doc`, `paragraph`, `bulletList`, `orderedList`, `listItem`, `hardBreak`, `text` | `bold`, `italic`, `link` (`href` must be `https:`, `http:`, `mailto:`, `tel:` or an internal path starting with one `/`) |

- Headings are **not** allowed inside a text block; use a `heading` block. That keeps the H2/H3 structure visible and checkable.
- Limits: 60 blocks; each rich-text document ≤ 20,000 characters of text and ≤ 6 levels deep; captions ≤ 200; heading text ≤ 150.
- **Embed errors:** a link that isn't a recognised YouTube or Vimeo video address → `400` with `fieldErrors["blocks.N.url"] = [{ code: "unsupported_embed" }]`.
- Saving a page or project **replaces** its whole block list. Block `id`s are stable only until the next save.

### 8.2 SEO fields (Phases 6–7; CR-SEO-01, CR-SEO-06, CR-SEO-12, CR-SEO-14)

```ts
type SeoInput = {                      // every field optional; empty = automatic default
  seoTitle?: Localized<string>;        // ≤ 70
  seoDescription?: Localized<string>;  // ≤ 200
  ogImageId?: string | null;           // a READY image
  robotsIndex?: boolean;               // default true
  robotsFollow?: boolean;              // default true
};

type Seo = {                           // public: final values after defaults (DATABASE_DESIGN §3.9)
  title: string;
  description: string;
  image: Image | null;
  index: boolean;
  follow: boolean;
  locales: ("ka" | "en")[];            // languages this record is available in (drives hreflang and the sitemap)
};
```

- The admin response returns both the raw inputs and the resolved `Seo`, so the form can show "what Google will see" next to the override fields.
- Canonical URLs are **not** stored. The frontend builds them from the route (SEO_ANALYTICS_PERFORMANCE §2).

### 8.3 Pages (Phase 6; CR-CMS-03, CR-CMS-06, CR-CMS-07)

```ts
type PageDetail = { id: string; kind: "system" | "custom"; systemKey: string | null; slug: string;
                    title: string;      // the H1
                    intro: string; blocks: Block[]; seo: Seo; updatedAt: string };
```

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/admin/pages` | `?kind=&published=&q=` | `{ items: { id, kind, systemKey, slug, title, isPublished, updatedAt }[] }` |
| GET | `/api/admin/pages/:id` | — | admin `PageDetail` (both languages, raw SEO, `isPublished`) |
| POST | `/api/admin/pages` | `{ slug, title 🌐, intro? 🌐, blocks: BlockInput[], isPublished, seo: SeoInput }` | `201`. Custom pages only |
| PUT | `/api/admin/pages/:id` | same | `200`. For a system page, `slug` and `isPublished` are ignored |
| PATCH | `/api/admin/pages/:id` | `{ isPublished }` | `200`; `409 SYSTEM_PAGE` for system pages |
| DELETE | `/api/admin/pages/:id` | — | `204`; `409 SYSTEM_PAGE` for system pages. Its navigation items are removed |

- **Errors:** `409 SLUG_TAKEN`; `400` with `code: "reserved_slug"` for a reserved slug; `422 INVALID_REFERENCE` for bad media.

### 8.4 Navigation (Phase 8; CR-PW-08, CR-CMS-02)

```ts
type NavLink = { label: string; href: string; newTab: boolean };   // public; href is a locale-free path or an https URL
```

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/admin/navigation` | — | `{ header: NavItem[], footer: NavItem[] }` (with ids, both languages, `visible`, `pageId` or `url`) |
| POST | `/api/admin/navigation` | `{ location, label 🌐, pageId? , url?, newTab, visible }` (exactly one of `pageId` / `url`) | `201` |
| PUT | `/api/admin/navigation/:id` | same | `200` |
| DELETE | `/api/admin/navigation/:id` | — | `204` |
| PUT | `/api/admin/navigation/order` | `{ location, ids: string[] }` | `200`; `409 ORDER_MISMATCH` |

- `url` must be an internal path (one leading `/`) or an absolute `https:` URL. Maximum 12 items per location.

### 8.5 Homepage slides (Phase 8; CR-PW-02, CR-CMS-01)

```ts
type Slide = { id: string; image: Image; heading: string; text: string;
               cta: { label: string; href: string } | null };
```

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/admin/slides` | — | `{ items }` (both languages, `isPublished`, `position`) |
| POST | `/api/admin/slides` | `{ imageId, heading 🌐, text? 🌐, ctaLabel? 🌐, ctaUrl?, isPublished }` | `201`; `409 SLIDE_LIMIT` above 8 |
| PUT | `/api/admin/slides/:id` | same | `200` |
| PATCH | `/api/admin/slides/:id` | `{ isPublished }` | `200` |
| DELETE | `/api/admin/slides/:id` | — | `204` |
| PUT | `/api/admin/slides/order` | `{ ids: string[] }` | `200`; `409 ORDER_MISMATCH` |

- A button needs both `ctaLabel` and `ctaUrl`, or neither.

### 8.6 Redirects and path resolution (Phase 6; CR-SEO-13)

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/public/resolve` | `?path=/projects/old-slug` (locale-free) | `{ kind: "project" }`, `{ kind: "page" }`, `{ kind: "redirect", to: "/projects/new-slug" }` or `{ kind: "none" }` |
| GET | `/api/admin/redirects` | `?q=&page=&pageSize=` | `{ items: { id, fromPath, toPath, createdAt }[], page, pageSize, total }` |
| POST | `/api/admin/redirects` | `{ fromPath, toPath }` | `201`; `409 REDIRECT_EXISTS`; `400` if `fromPath` is a live address or equals `toPath` |
| DELETE | `/api/admin/redirects/:id` | — | `204` |

- `resolve` is a single indexed lookup. It answers `project` or `page` only for **published** records.
- Automatic redirect creation on slug change is described in DATABASE_DESIGN §3.12.
- Both paths must start with one `/`, contain no `//`, and be at most 300 characters.

### 8.7 Sitemap feed (Phase 6; CR-SEO-08)

```ts
type SitemapEntry = { path: string;              // locale-free, e.g. /projects/vake-terraces
                      lastModified: string;      // ISO timestamp
                      locales: ("ka" | "en")[] };
```

- Includes: the five system pages, every published custom page and every published project, **excluding** records with `robotsIndex = false`.
- The frontend turns each entry into absolute URLs with language alternates (SEO_ANALYTICS_PERFORMANCE §4).

### 8.8 Preview of drafts (Phases 6 and 11; CR-CMS-07)

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/api/admin/preview-links` | admin session | `{ type: "project" \| "page", id }` | `201 { url, expiresAt }`. `url` is `https://www.manidevelopment.ge/api/preview?token=…` |
| POST | `/api/preview/verify` | `X-Internal-Key` (the Next.js server only) | `{ token }` | `200 { path }`, the address of the record; `401` for a bad, expired or reused token |

**How a preview works:**
1. The admin clicks "Preview". The API issues a random, single-use token valid for 5 minutes (stored hashed).
2. The browser opens the preview URL on the website. The website's server verifies the token with the API and receives the record's path **from the API**, never from the URL. That prevents open redirects.
3. The website switches on Next.js Draft Mode for that browser and redirects to the page.
4. While Draft Mode is on, the website's server reads content with `?preview=1` and its internal key. Only then does the API include drafts.

- Drafts are never returned to a browser directly, and never without the internal key.
- A "Leave preview" button turns Draft Mode off (a `POST`, so link prefetching can't trigger it).
