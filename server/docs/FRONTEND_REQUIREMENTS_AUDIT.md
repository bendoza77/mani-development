# Frontend Requirements Audit

**Status:** Planning document. No backend code exists yet.
**Audit date:** 2026-11-20 · **Repository state:** commit `5d41491` (branch `main`, clean tree)

This document lists every feature in `client/` that needs backend support. Each claim cites the file (and line, where useful) it comes from. Labels (VERIFIED, PROPOSED, NEEDS CONFIRMATION, BLOCKED) follow [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md). Question IDs (`Q-…`) point to [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

---

## 1. How the audit was done

**Opened and read in full:**

- Data and state: `client/lib/types.ts`, `client/lib/store.ts`, `client/lib/session.ts`, `client/lib/format.ts`, `client/data/seed.ts`, `client/data/images.ts`
- Admin UI: every file in `client/components/admin/` (`AdminShell`, `Dashboard`, `DashboardCharts`, `InquiriesAdmin`, `LoginForm`, `MediaAdmin`, `MediaPicker`, `ProjectForm`, `ProjectsAdmin`, `ServicesAdmin`, `SettingsAdmin`, `TeamAdmin`, `TestimonialsAdmin`)
- Public UI: every file in `client/components/sections/` and `client/components/sections/home/`, plus `client/components/layout/SiteHeader.tsx`, `SiteFooter.tsx`, `client/components/brand/Logo.tsx`, `client/components/ui/Img.tsx`, `client/components/ui/ThemeSync.tsx`, `client/hooks/useStoredPref.ts`
- Routes: every `page.tsx` / `layout.tsx` / `error.tsx` / `not-found.tsx` under `client/app/[lang]/`
- i18n core: `client/i18n/config.ts`, `resources.ts`, `content.ts`, `server.ts`, `client.tsx`, `instance.ts`, `format.ts`; `client/i18n/locales/en/contact.json`, `en/meta.json`
- Configuration: `client/package.json`, `next.config.ts`, `tsconfig.json`, `proxy.ts`, `vercel.json`, `.vercelignore`, `.gitignore`, `eslint.config.mjs`, `AGENTS.md`, `README.md`

**Not opened (with evidence that they don't affect the backend):** the 3D house components (`client/components/3d/house/*`), UI primitives (`Button`, `Dialog`, `Field`, `Popover`, `Reveal`, `StatusBadge`, `Toast`, `InlineScript`), hooks `useHydrated` / `useMediaQuery` / `useNow`, `i18n/LanguageSwitcher.tsx`, `i18n/LocaleLink.tsx`, the remaining locale JSON files, and `app/globals.css`. A repository-wide search shows that none of them imports `lib/store` or `lib/session`, the only two data modules. Only `client/components/ui/InlineScript.tsx:16` uses `dangerouslySetInnerHTML`, and it renders the static theme script defined in `client/app/[lang]/layout.tsx:66`.

**Repository-wide searches** for `fetch(`, `process.env`, `axios`, `/api/`, `video`, `mp4`, `youtube`, `vimeo`, SEO field names, `sitemap` and `robots` matched only:
- `client/i18n/instance.ts:24` (`process.env.NODE_ENV`)
- `client/app/[lang]/layout.tsx:54` (Open Graph locale)
- `client/app/[lang]/admin/layout.tsx:5` (`robots: noindex` for the admin)

---

## 2. Current state (VERIFIED)

| Area | What the code actually does | Evidence |
|---|---|---|
| Backend | **None.** No API calls, no server code, no `server/` directory. | Repo file list; search results above |
| Data storage | A single in-memory `DB` object, saved to `localStorage` under key `lintel:db`. Each browser has its own copy. | `client/lib/store.ts:3-5`, `:10`, `:98-111` |
| Admin "auth" | A `localStorage` flag. The demo credentials are hard-coded **and shown on the login page**. An "Enter demo without signing in" button skips the check. | `client/lib/session.ts:3-4`, `:8`; `client/components/admin/LoginForm.tsx:31`, `:74-76`, `:79-91` |
| Admin route guard | Client-side only: redirects to `/admin/login` when the flag is missing. | `client/components/admin/AdminShell.tsx:73-75`, `:94` |
| Uploads | Simulated: images are downscaled in the browser to a JPEG data URL (max edge 1600 px) and stored in `localStorage`. | `client/components/admin/MediaAdmin.tsx:16-37`, `:100` |
| Contact form | Simulated: 1.1 s fake delay, a "simulate failure" checkbox, then the message is saved to the local inbox. | `client/components/sections/ContactForm.tsx:63-75`, `:150-153`; `client/i18n/locales/en/contact.json` (`form.note`, `success.note`) |
| Email | **Not implemented anywhere.** The contact page says "nothing was emailed or sent to a server". | `client/i18n/locales/en/contact.json` (`success.note`) |
| Public pages | All content sections are client components that read the browser's local store. Server-rendered HTML therefore contains the **seed** data, not live data. | `useDB` usages in `client/components/sections/**`, `layout/**`, `brand/Logo.tsx` |
| Project SEO | `generateMetadata` and `generateStaticParams` read only `seedProjects`. A project created in the admin gets the fallback title `"Project"`; the browser tab title is patched client-side afterwards. | `client/app/[lang]/(site)/projects/[slug]/page.tsx:7-22`; `client/components/sections/ProjectDetail.tsx:29-30` |
| Localization | Public site in English (`/`) and Georgian (`/ka`). Georgian versions of **content** exist only for the seed records (`i18n/content/ka.json`). A Georgian translation is shown only while the English field is unchanged; anything edited or created in the admin appears in English on the Georgian site. Admin is English-only. | `client/i18n/content.ts:5-11`, `:20-36`; `client/i18n/resources.ts:62-79`; `client/i18n/config.ts:24-25` |
| Placeholder data | The seed header says only the company name, address and email are real; projects, team, testimonials, figures, phone and hours are placeholders. | `client/data/seed.ts:1-3` |
| Environment variables | None used (other than `NODE_ENV`). `.env*` is ignored by git and Vercel. | `client/.gitignore`, `client/.vercelignore` |
| Runtime | Next.js 16.4.6, React 19.3, Node `24.x`, `cacheComponents: true`. | `client/package.json`, `client/next.config.ts` |
| Proxy | `client/proxy.ts` handles locale routing; its matcher **excludes `/api/`** paths. | `client/proxy.ts:66` |

---

## 3. Data model the frontend expects (VERIFIED)

From `client/lib/types.ts` (complete file):

| Type | Fields | Notes |
|---|---|---|
| `Project` | `id, slug, title, summary, description, location, city, category, status, progress (0–100), startDate, estimatedCompletion, completionDate?, featured, cover, gallery: string[], specs: Spec[], architect, updatedAt` | `cover` and `gallery` are **image URLs**, not media IDs |
| `ProjectCategory` | `residential, apartments, commercial, hospitality, renovation` | Fixed list; labels come from translation files |
| `ProjectStatus` | `planning, in-progress, completed, on-hold` | **Construction** status, not publication status |
| `Spec` | `id, label, value` | Ordered list |
| `Service` | `id, title, summary, description, image, features: string[], visible` | Display order = array order |
| `Testimonial` | `id, quote, author, role, project, published` | `project` is a **project title string** |
| `TeamMember` | `id, name, role, bio, photo, visible` | Display order = array order |
| `Inquiry` | `id, name, email, phone, subject, message, status, createdAt, notes: InquiryNote[]` | `phone` may be `""` |
| `InquiryStatus` | `new, in-progress, resolved` | |
| `InquiryNote` | `id, text, createdAt` | No author field |
| `MediaAsset` | `id, name, src, alt, category, width, height, size, createdAt` | |
| `MediaCategory` | `exterior, interior, construction, team, uploads` | |
| `Settings` | `companyName, tagline, email, phone, address, hours, instagram, linkedin, facebook, theme` | Singleton |
| `ActivityItem` | `id, kind, message, at` | `kind` ∈ project, inquiry, service, testimonial, team, media, settings |
| `Notification` | `id, title, body, href, at, read` | |

---

## 4. Feature inventory

Each feature is described with the 10 required attributes. "API" lists capabilities; exact routes are in [API_CONTRACTS.md](API_CONTRACTS.md), entities in [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

### F-01 · Admin sign-in, sign-out and session

1. **Feature:** Admin authentication and access to `/admin/*`.
2. **Frontend files:** `client/components/admin/LoginForm.tsx`, `client/lib/session.ts`, `client/components/admin/AdminShell.tsx` (redirect at `:73-75`, profile menu with "Sign out" at `:562-571`, user name and email shown at `:527-530`), `client/app/[lang]/admin/login/page.tsx`.
3. **Expected behaviour:** Admin enters email and password and is taken to `/admin`. Signed-out visitors are redirected to the login page. "Sign out" ends the session. The panel shows the signed-in user's name and email.
4. **API:** log in, log out, get the current session (name, email). Every admin endpoint must reject requests without a valid session.
5. **Entities:** `AdminUser`, `AdminSession`.
6. **Auth:** Login is public but rate-limited. Everything else under admin requires a session. The UI shows **no roles or permissions**: one kind of admin.
7. **External deps:** none (cookie topology depends on domains, Q-01).
8. **Validation:** The frontend does no validation beyond the demo comparison. Backend: email format, password length limits, generic error message (no user enumeration).
9. **Testing:** login success and failure, lockout or rate limit, logout invalidates the session, expired session rejected, every admin route returns 401 without a session, cookie flags.
10. **Decided (2026-11-20):**
    - one admin, single role
    - forgotten password → reset link emailed to the registered address. This needs **new** frontend pages that don't exist today: "Forgot password?" link, `/admin/forgot-password`, `/admin/reset-password`.
    - custom domains available (Q-01)

    The demo-only "Enter demo without signing in" button and credential box must be removed (Phases 11–12).

### F-02 · Projects management (admin)

1. **Feature:** Create, edit, delete projects; change status; toggle "featured"; filter, search and sort the list.
2. **Frontend files:** `client/components/admin/ProjectsAdmin.tsx`, `client/components/admin/ProjectForm.tsx`, `client/app/[lang]/admin/(panel)/projects/**`, `client/lib/store.ts:168`.
3. **Expected behaviour:**
   - The list filters by status (URL `?status=`), category and free text over title, location and slug. It sorts by title, status, progress or `updatedAt` (`ProjectsAdmin.tsx:25-56`).
   - Status changes inline, and setting `completed` forces progress to 100 (`:60-67`). Featured toggles inline (`:69-72`).
   - The form edits every field; specs can be added and removed. The cover image and gallery are chosen from the media library, and gallery order is editable (`ProjectForm.tsx:287-375`).
   - The slug is auto-generated from the title until edited (`:175`, `client/lib/format.ts` `slugify`).
   - **Saving publishes immediately:** "Projects appear on the public website as soon as they are saved" (`ProjectForm.tsx:146`, toast at `:136`).
   - Deletion asks for confirmation (`:384-396`, `ProjectsAdmin.tsx:245-257`).
4. **API:** list (admin view, all projects), get by id, create, full update, partial update (status / featured / progress), delete. Slug uniqueness check (409 on conflict).
5. **Entities:** `Project`, `ProjectSpec`, `ProjectImage` (gallery order), references to `MediaAsset` (cover, gallery), `ActivityLog`.
6. **Auth:** admin only.
7. **External deps:** none directly (images come from the media library, F-09).
8. **Validation (from `ProjectForm.tsx:43-61`):**
   - title ≥ 3 characters (trimmed)
   - slug matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` and is unique
   - summary 10–180 characters; description ≥ 30
   - location and city required; cover required
   - progress is an integer 0–100; status `completed` forces 100
   - start date and estimated completion required, with estimated completion ≥ start date
   - `completed` requires a completion date, and completion date ≥ start date
   - The backend must repeat all of these and add **maximum lengths** (the frontend has none for most fields).
9. **Testing:** validation matrix for every rule above, slug conflict (409), create/update/delete round trip, gallery order preserved, specs order preserved, `completed`→100 rule, activity entry written, 401 without a session.
10. **Decided since:** projects get a Published switch and a preview link (client requirement); every text field is bilingual (Q-02); no manual project ordering exists, so none is planned (Q-19 revisits it).

### F-03 · Public projects

1. **Feature:** Projects index with filters, project detail pages, homepage "featured" grid, portfolio summary numbers.
2. **Frontend files:** `client/components/sections/ProjectsExplorer.tsx` (filters and sort at `:55-288`, `ProjectsSummary` at `:176`), `ProjectDetail.tsx`, `ProjectCard.tsx`, `Gallery.tsx`, `home/FeaturedProjects.tsx:16-20`, `client/app/[lang]/(site)/projects/page.tsx`, `projects/[slug]/page.tsx`.
3. **Expected behaviour:**
   - The explorer filters by category and status, searches title, location and summary, and sorts by "houses first", "recent" or A–Z. It shows counts per category and "showing X of Y".
   - The summary shows the number of distinct cities, total projects and projects "on site" (in progress).
   - The detail page renders all fields, specs, gallery, construction stages derived from `progress` (`client/lib/format.ts` `stageState`), and 3 related projects (same category first, `ProjectDetail.tsx:33-38`).
   - The homepage shows up to 4 projects: featured ones first, topped up with residential ones.
4. **API:** list public projects (all fields needed by cards and filters), get one project by slug, including resolved image URLs, dimensions and alt text. Unknown slug returns 404.
5. **Entities:** `Project`, `ProjectSpec`, `ProjectImage`, `MediaAsset`.
6. **Auth:** public, read-only. Must never expose admin-only fields (drafts are hidden from every public response).
7. **External deps:** image delivery (Cloudflare, F-09).
8. **Validation:** slug format check on the route parameter.
9. **Testing:** list shape, detail by slug, 404, only public fields returned, and unpublished projects hidden.
10. **Unresolved:**
    - Server-side rendering of live data for SEO: the current metadata uses seed data only. Plan in Phases 11–12 with Next.js caching.
    - Project volume is small (12 seed records), so the plan returns the full list without pagination (PROPOSED, see API_CONTRACTS).

### F-04 · Services (admin and public)

1. **Feature:** Manage the services list (create, edit, delete, reorder, hide/show). Public services page and homepage list.
2. **Frontend files:** `client/components/admin/ServicesAdmin.tsx`, `client/components/sections/ServicesList.tsx:16`, `client/components/sections/home/ServicesOverview.tsx:18`, `client/app/[lang]/(site)/services/page.tsx`.
3. **Expected behaviour:**
   - Order in the admin is the public order ("Order here is the order on the public Services page", `ServicesAdmin.tsx:33`). Move up/down (`:59-60`); new services are appended at the end (`:76`).
   - Hidden services are not shown publicly. Features are entered one per line (`:131`).
   - Public anchors are derived from the English title (`slugify(s.title)`), so a renamed service changes its `#anchor`.
4. **API:** admin list, create, update, delete, toggle visibility, reorder. Public list of visible services in order.
5. **Entities:** `Service` (with `position`), reference to `MediaAsset` (image).
6. **Auth:** admin for writes; public read of visible services only.
7. **External deps:** image delivery.
8. **Validation (`ServicesAdmin.tsx:105-110`):** title ≥ 3, summary ≥ 10, description ≥ 20, image required; features are non-empty trimmed lines. The backend adds maximum lengths and a maximum number of features.
9. **Testing:** CRUD, reorder persists and stays contiguous, hidden services excluded from the public endpoint, validation.
10. **Decided since:** services have no page of their own, so they get no SEO fields; they do get a stored slug for their anchor; fields are bilingual (Q-02); videos live in content blocks on pages and projects, not on services.

### F-05 · Team members (admin and public)

1. **Feature:** Manage team profiles (add, edit, remove, reorder, hide/show). Public About page grid.
2. **Frontend files:** `client/components/admin/TeamAdmin.tsx`, `client/components/sections/TeamGrid.tsx:13`, `client/app/[lang]/(site)/about/page.tsx`.
3. **Expected behaviour:** "Visible members appear on the About page, in this order" (`TeamAdmin.tsx:28`). Move earlier/later (`:51-52`); new members are appended (`:75`).
4. **API:** admin list, create, update, delete, toggle visibility, reorder. Public list of visible members in order.
5. **Entities:** `TeamMember` (with `position`), reference to `MediaAsset` (photo).
6. **Auth:** admin for writes; public read of visible members only.
7. **External deps:** image delivery.
8. **Validation (`TeamAdmin.tsx:102-107`):** name ≥ 2, role required, bio ≥ 20, photo required.
9. **Testing:** as F-04, including that hidden members never appear in the public response.
10. **Unresolved:** bilingual fields (Q-02).

### F-06 · Testimonials (admin and public)

1. **Feature:** Manage client quotes (create, edit, delete, publish/unpublish, filter by published/draft). Homepage carousel.
2. **Frontend files:** `client/components/admin/TestimonialsAdmin.tsx`, `client/components/sections/home/Testimonials.tsx:12`.
3. **Expected behaviour:** Only published quotes rotate on the homepage. The editor offers a "Related project" select filled with **current project titles** (`TestimonialsAdmin.tsx:86`, `:166-176`). New testimonials are added at the start of the list (`:89`, store default `position: "start"`). There is no manual reordering.
4. **API:** admin list, create, update, delete, toggle published. Public list of published testimonials.
5. **Entities:** `Testimonial`, optional reference to `Project`.
6. **Auth:** admin for writes; public read of published only.
7. **External deps:** none.
8. **Validation (`TestimonialsAdmin.tsx:125-129`):** quote 20–400 characters; author required; role required.
9. **Testing:** CRUD, publish toggle, drafts excluded publicly, project link behaviour when the project is deleted.
10. **Unresolved:** linking by project ID instead of title is PROPOSED (DATABASE_DESIGN §4). Public display order today is "newest first"; the plan keeps that.

### F-07 · Contact form → inquiry submission (public)

1. **Feature:** Visitors send a message from `/contact`. It must reach the admin inbox.
2. **Frontend files:** `client/components/sections/ContactForm.tsx`, `client/app/[lang]/(site)/contact/page.tsx`, `client/lib/store.ts:191-216` (`recordInquiry` also creates a notification and an activity entry), `client/i18n/locales/en/contact.json`.
3. **Expected behaviour:**
   - The visitor fills name, email, phone (optional), subject and message, and sees a success state or a failure state with retry.
   - The subject can be prefilled from `?subject=` (project page call-to-action, `ContactForm.tsx:37-42`; `ProjectDetail.tsx` CTA link).
   - The page promises "We read every message and usually reply within two working days" (`contact.json` `page.lead`).
4. **API:** public "create inquiry" endpoint. Stores the inquiry, creates the admin notification and activity entry, and (if approved) triggers email (F-15).
5. **Entities:** `Inquiry`, `Notification`, `ActivityLog`.
6. **Auth:** public, so it **must** have abuse protection: rate limiting, a body size limit, spam protection (Q-09).
7. **External deps:** spam protection (Turnstile, if approved), email provider (if approved).
8. **Validation (`ContactForm.tsx:18-26`):**
   - name ≥ 2
   - email matches `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`
   - phone optional; if present, ≥ 7 digits and only `\d \s + ( ) -`
   - subject ≥ 3 (input `maxLength` 120)
   - message ≥ 20
   - The backend adds maximum lengths for all fields.
9. **Testing:** valid submission stored, notification created, validation errors (400 with field details), rate limit (429), spam check failure, oversize body (413), and the email failure path (inquiry still saved).
10. **Unresolved:** spam protection approach (Q-09); which emails to send (Q-05); privacy notice and retention (Q-12). The demo-only "simulate failure" checkbox and "prototype" copy must be removed in Phases 11–12.

### F-08 · Inquiries inbox (admin)

1. **Feature:** Read, search and filter inquiries, change status, add and remove internal notes, delete.
2. **Frontend files:** `client/components/admin/InquiriesAdmin.tsx`, `client/app/[lang]/admin/(panel)/inquiries/page.tsx`.
3. **Expected behaviour:**
   - The list is newest first, with counts per status. Search covers name, email, subject and message (`InquiriesAdmin.tsx:30-41`).
   - The selected inquiry is held in the URL (`?id=`). Status is set through a 3-way control (`:107-110`).
   - Notes can be added (non-empty, `:140-149`) and removed (`:231`). Deleting removes the inquiry and its notes (`:122`).
   - The sidebar badge shows the count of `new` inquiries (`AdminShell.tsx:163`).
4. **API:** list with status filter, text search and pagination; counts per status; get one; update status; add note; delete note; delete inquiry.
5. **Entities:** `Inquiry`, `InquiryNote`, `ActivityLog`.
6. **Auth:** admin only. Inquiries contain personal data and must never be reachable publicly.
7. **External deps:** none.
8. **Validation:** status from the enum; note text non-empty with a maximum length.
9. **Testing:** filters, search, counts, pagination, status transitions, note add/remove, cascade delete, 401/404.
10. **Unresolved:** retention policy (Q-12); whether notes record an author (depends on Q-06).

### F-09 · Media library and image picker (admin)

1. **Feature:** Upload images (button or drag-and-drop, multiple files), browse, filter by category, search name and alt text, edit alt text and category, see "used by", delete (single or bulk), copy path. A picker dialog is used by the project, service and team forms.
2. **Frontend files:** `client/components/admin/MediaAdmin.tsx`, `client/components/admin/MediaPicker.tsx`, `client/components/ui/Img.tsx`, `client/data/images.ts`, `client/data/seed.ts:659-683`.
3. **Expected behaviour:**
   - Accepts `image/*` up to 15 MB input (`MediaAdmin.tsx:17`, `:21-22`). Uploads go to category `uploads` (`:84`).
   - "Used by" lists the projects (cover or gallery), services and team members that reference the image (`:39-45`).
   - Deleting an image that is in use is **allowed with a warning**: "Those pages will keep showing the image until you replace it" (`:240-242`).
   - The picker selects by image URL (`MediaPicker.tsx:43-44`).
   - `Img` sends local `/…` paths through `next/image` and renders anything else as a plain `<img>` (`client/components/ui/Img.tsx:27-42`).
4. **API:** list (filter, search, pagination), start an upload (authorized upload URL), confirm or complete an upload, update metadata (alt, category), delete (single and bulk), usage lookup.
5. **Entities:** `MediaAsset`, referenced by `Project`, `ProjectImage`, `Service`, `TeamMember`.
6. **Auth:** admin only for all operations. Public delivery of image files goes through Cloudflare, not this API.
7. **External deps:** Cloudflare media product (Q-04).
8. **Validation:** allowed image types (the frontend accepts any `image/*`; the backend will allow-list), size ≤ 15 MB (current frontend limit), alt text non-empty on save (`MediaAdmin.tsx:316`), category from the enum.
9. **Testing:** upload authorization flow (with a fake provider in tests), metadata update, usage computation, delete in use (behaviour per Q-11), bulk delete, provider errors, orphan cleanup.
10. **Unresolved:**
    - Storage product (Q-04); behaviour when deleting in-use media (Q-11); video is now required, and its hosting needs approval (Q-25).
    - The 38 seed images in `client/public/images` must either be migrated to storage or kept as static files (Q-10).
    - `next/image` needs configuration for remote image hosts (Phases 11–12).

### F-10 · Company settings (admin) and their public use

1. **Feature:** Edit company name, tagline, contact email, phone, address, opening hours and social links. Used by the header, footer, logo, contact details and mobile menu.
2. **Frontend files:** `client/components/admin/SettingsAdmin.tsx`; consumers `client/components/layout/SiteHeader.tsx:31`, `SiteFooter.tsx:17`, `client/components/brand/Logo.tsx:25-26`, `client/components/sections/ContactDetails.tsx:9`.
3. **Expected behaviour:** Saving updates the public site ("The website header, footer and contact page now use these details", `SettingsAdmin.tsx:65`). Discard reverts. Social links with an empty value are hidden in the footer.
4. **API:** get settings (public subset is all fields except theme), update settings (admin).
5. **Entities:** `SiteSettings` (single row).
6. **Auth:** public read; admin write.
7. **External deps:** none.
8. **Validation (`SettingsAdmin.tsx:19-29`):**
   - company name 2–24 characters; tagline ≤ 40
   - email valid; phone ≥ 7 digits; address ≥ 5
   - social links empty or matching `^https?://…` (the backend should also reject non-HTTP schemes so a `javascript:` URL can never reach an `href`)
9. **Testing:** get/update, validation, public response shape.
10. **Unresolved:**
    - Root layout metadata and the 404 page read `seedSettings.companyName` directly (`client/app/[lang]/layout.tsx:53`, `client/app/[lang]/not-found.tsx:21-24`), which needs wiring in Phases 11–12.
    - Whether the settings `email` is also the inquiry notification recipient (Q-05).

### F-11 · Theme preference — **no backend needed** (PROPOSED)

- `Settings.theme` (light, dark, system) is edited in Settings and in the profile menu (`AdminShell.tsx:540`). It is applied by `ThemeSync` and by an inline script that reads `localStorage['lintel:theme']` (`client/app/[lang]/layout.tsx:66`).
- The UI describes it as "Theme for the website and admin **in this browser**" (`SettingsAdmin.tsx:127`).
- Storing it on the server would change the theme for every visitor, so the plan keeps it as a browser preference and leaves it out of the database (Q-16 for confirmation).

### F-12 · Dashboard (admin)

1. **Feature:** KPI tiles, "projects by status" chart, "inquiries per month" (last 6 months), recent inquiries (5), recent project updates (5), activity (12), shortcuts.
2. **Frontend files:** `client/components/admin/Dashboard.tsx`, `DashboardCharts.tsx`.
3. **Expected behaviour:** Figures are "calculated live" (`Dashboard.tsx:83`): totals by project status (`:27-38`), inquiries per calendar month in UTC (`:46-59`).
4. **API:** one aggregate endpoint returning counts, the monthly series, and recent items (PROPOSED: avoids downloading every inquiry to count them).
5. **Entities:** reads `Project`, `Inquiry`, `ActivityLog`.
6. **Auth:** admin only.
7. **External deps:** none.
8. **Validation:** none (read-only).
9. **Testing:** aggregates match seeded fixtures, including month boundaries in UTC.
10. **Unresolved:** none.

### F-13 · Activity feed (admin)

1. **Feature:** A chronological list of admin changes ("Vake Terraces updated", "New inquiry from …").
2. **Frontend files:** `client/lib/store.ts:125-128` (`withActivity`, keeps the last 60), every `collection().add/update/remove` call with a message, `Dashboard.tsx:179`.
3. **Expected behaviour:** Created, updated, deleted and status-change events across projects, services, testimonials, team, media, settings and inquiries appear newest first.
4. **API:** list recent activity (limit). Entries are written by the server inside each mutation.
5. **Entities:** `ActivityLog` (doubles as a lightweight audit log; with real users it can record the acting admin).
6. **Auth:** admin read only. No public or client write endpoint.
7. **External deps:** none.
8. **Validation:** n/a (server-generated).
9. **Testing:** each mutation writes exactly one entry, in the same transaction as the change.
10. **Unresolved:** retention (PROPOSED: keep all, query the latest N; prune later if needed).

### F-14 · Notifications (admin)

1. **Feature:** A bell with an unread dot. List, mark one read on open, "mark all read", dismiss.
2. **Frontend files:** `client/components/admin/AdminShell.tsx:427-497`, `client/lib/store.ts:179-188`, `:199-208`.
3. **Expected behaviour:** A new inquiry creates a notification linking to `/admin/inquiries?id=…`. The seed also contains a "Milestone approaching" notification, but **no code generates milestone notifications** (`client/data/seed.ts:708-733`, verified by reading `store.ts`).
4. **API:** list, mark read (one, many or all), dismiss (delete).
5. **Entities:** `Notification`.
6. **Auth:** admin only.
7. **External deps:** none.
8. **Validation:** ids must exist.
9. **Testing:** created on inquiry submission, read state, dismiss.
10. **Unresolved:** read state is global (shared by all admins) unless multiple admins need separate state (Q-06). Milestone notifications are out of scope unless requested.

### F-15 · Email — **no existing requirement in code** (NEEDS CONFIRMATION)

No feature sends email today (§2). Likely needs, inferred from the business but **not** present in code:

- **(a)** Notify the company when an inquiry arrives.
- **(b)** Acknowledge the visitor's inquiry.
- **(c)** Password-reset email, only if chosen over a command-line reset.

(a) and (c) are decided (inquiry notification; email reset link). (b) is Q-29(4).

### F-16 · Admin global search

1. **Feature:** Ctrl/⌘+K search over projects (title, location), inquiries (name, email, subject), team (name, role) and services (title). At most 8 results.
2. **Frontend files:** `client/components/admin/AdminShell.tsx:304-341`.
3. **Expected behaviour:** Starts at 2 characters, results are grouped, and each result links to its admin page.
4. **API:** one search endpoint (PROPOSED), or reuse of the list endpoints. Both are viable; the plan proposes one endpoint so the admin doesn't download every inquiry.
5. **Entities:** reads `Project`, `Inquiry`, `TeamMember`, `Service`.
6. **Auth:** admin only.
7. **External deps:** none.
8. **Validation:** `q` length 2–100.
9. **Testing:** matching across types, case-insensitive matching, result cap, 401.
10. **Unresolved:** none.

### F-17 · Demo-only features to remove (no backend)

These must be removed or hidden in Phases 11–12. They exist only because there is no backend:

- "Reset demo data" in Settings and the profile menu (`SettingsAdmin.tsx:145-150`, `AdminShell.tsx:552-561`, `client/lib/store.ts:218-227`)
- Demo credentials and the "Enter demo" button (`LoginForm.tsx`)
- "Prototype · data is stored in this browser only" (`AdminShell.tsx:222`)
- The contact form "simulate failure" toggle and prototype copy (`ContactForm.tsx:150-153`; `contact.json` `form.note`, `form.failed`, `toast.*`, `success.note`)
- "Stored in this browser only (simulated upload)" (`MediaAdmin.tsx:100`, `:126`)

### F-18 · Content localization (cross-cutting, DECIDED: bilingual, mainly Georgian)

- Public pages are bilingual. Admin-entered content is single-language (English) today, and Georgian appears only for unchanged seed text (§2).
- **Decision (Q-02):** content becomes editable in both languages, with **Georgian primary**. Every admin content form needs Georgian and English inputs. Details (required language, default URL language, admin UI language) are in Q-02a.
- **Related code finding (VERIFIED):** `slugify` in `client/lib/format.ts` keeps only `a-z0-9`, so a Georgian title yields an **empty** slug.
  - It's used for project URLs (`ProjectForm.tsx:175`) and for service anchors (`ServicesList.tsx:16`, `home/ServicesOverview.tsx:48`).
  - The plan adds Georgian→Latin transliteration and a stored service slug (DATABASE_DESIGN §1, §3.4).
- The default site language is English today (`client/i18n/config.ts:12`, `DEFAULT_LOCALE = "en"`). Making Georgian the default is a frontend routing change (Q-02a, Phases 11–12).

---

## 5. Requested capabilities that are **not** present in the frontend

From the first planning brief, checked against the code. The "Plan stance" column was updated on 2026-11-20 after your answers and the client requirements (§7).

| Requested topic | Found in frontend? | Plan stance |
|---|---|---|
| Project publish/unpublish, drafts | **No.** Saving publishes immediately (`ProjectForm.tsx:146`). | **Required** by the client requirements (CR-CMS-06). In scope |
| Project SEO metadata fields | **No.** Metadata uses title and summary (`projects/[slug]/page.tsx:20-21`). | **Required** (CR-SEO-01), with automatic defaults. In scope |
| Project categories management | **No.** Fixed list of 5 with translated labels. | Fixed enum, no table |
| Project manual ordering | **No.** Sorted by rules (`ProjectsExplorer.tsx:55-71`). | No ordering column (see Q-19 if "products" need manual order) |
| Videos | **No.** No video anywhere. | **Required** (CR-CMS-04). In scope |
| Password reset | **No.** | **Decided:** email reset link |
| Multiple roles / permissions | **No.** A single "Demo Administrator". | **Decided:** single role, one admin |
| Email of any kind | **No.** | **Decided:** Gmail / Google Workspace |
| Sitemap / robots.txt | **No.** | **Required** (CR-SEO-08, CR-SEO-09). Phase 13 |

---

## 6. Frontend changes the backend will require (input to Phases 11–12)

1. Replace `client/lib/store.ts` and `client/lib/session.ts` with an API client. Public content components move to server-side data fetching so HTML and metadata are real (fixes the seed-only SEO in F-03 and F-10).
2. Change image references from URL strings to media objects (`{ id, url, width, height, alt }`). Update `MediaPicker` to return media IDs.
3. Configure `next/image` for the Cloudflare delivery host (remote patterns or a custom loader), since `Img` currently optimizes local paths only.
4. Remove the demo-only features in F-17.
5. Replace `useDB` reads of `settings` in the header, footer, logo, contact details and root metadata.
6. Mirror the backend's maximum lengths in form validation.
7. Add Georgian/English inputs to every content form (projects incl. specs, services incl. features, team, testimonials, settings, media alt text).
8. Replace `slugify` with a transliterating version; use the stored service slug for anchors.
9. Add "Forgot password?", `/admin/forgot-password` and `/admin/reset-password` pages.
10. If Q-02a(2) = yes, switch `DEFAULT_LOCALE` to `ka` and move English under `/en` (routing in `client/proxy.ts` and `client/i18n/config.ts`).

The second brief adds more frontend work; it is listed in §7.7.

---

## 7. Audit against the client requirements (second brief, 2026-11-20)

The repository was re-checked on 2026-11-20: it is unchanged since commit `5d41491` (`server/docs/` is the only addition, uncommitted). Each client requirement is compared with what the code does **today**. Requirement IDs (`CR-…`) are the ones used in [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md), which maps each to its design section and phase.

**Status labels:**
- **Present:** the frontend already does it (as a prototype).
- **Partial:** some of it exists.
- **Missing:** nothing in the code.

"Present" never means production-ready: all data is still browser-local (§2).

### 7.1 Public website

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CR-PW-01 | Modern, minimalist, responsive corporate site | **Present** (design). Responsiveness is **assumed from code** (responsive Tailwind classes throughout); it was not run or viewed, because `node_modules` isn't installed | `client/app/[lang]/(site)/**`, `client/components/sections/**` |
| CR-PW-02 | Homepage with an admin-managed slider | **Missing.** The homepage opens with a text hero beside a self-building 3D house; its copy comes from translation files. The only carousel is the testimonials rotator | `client/app/[lang]/(site)/page.tsx`; `client/components/sections/home/Hero.tsx`; `client/i18n/locales/en/home.json` (`hero.*`); `home/Testimonials.tsx` |
| CR-PW-03 | Contact information | **Present** (from settings) | `client/components/sections/ContactDetails.tsx:9-16`; `SiteFooter.tsx` |
| CR-PW-04 | Clickable Google Maps location | **Missing.** The contact page draws a stylised, non-clickable SVG ("no map API or key required", "Illustrative map · not to scale") | `client/app/[lang]/(site)/contact/page.tsx:12-13`; `contact.json` `map.caption` |
| CR-PW-05 | WhatsApp integration | **Missing.** No WhatsApp reference anywhere; settings have no such field | Repo-wide search; `client/lib/types.ts:96-107` |
| CR-PW-06 | Facebook Messenger integration | **Missing.** Only a plain Facebook profile URL in settings | Repo-wide search; `client/lib/types.ts:105` |
| CR-PW-07 | Direct-call integration | **Present.** `tel:` links in the mobile menu, footer and contact details | `SiteHeader.tsx:185`; `SiteFooter.tsx:19`; `ContactDetails.tsx:12` |
| CR-PW-08 | Dynamic navigation | **Missing.** Menu items are a hard-coded constant | `client/components/layout/SiteHeader.tsx:16-23` |
| CR-PW-09 | Dynamic product/project pages | **Partial.** `/projects/[slug]` exists, but its content is browser-local and fixed-layout. Whether "products" means these projects is Q-19 | `client/app/[lang]/(site)/projects/[slug]/page.tsx` |

### 7.2 Content management system

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CR-CMS-01 | Admin-managed homepage | **Partial.** Featured projects, services and testimonials are admin-driven. The hero, "about" block and figures are fixed copy in translation files | `home/FeaturedProjects.tsx:16-20`; `home/Hero.tsx`; `i18n/locales/*/home.json`, `company.json` |
| CR-CMS-02 | Admin-managed navigation | **Missing** | `SiteHeader.tsx:16-23` |
| CR-CMS-03 | Admin-managed pages | **Missing.** About, Services and Contact are fixed templates with copy in translation files. There is no generic page route; unknown paths go to a 404 | `client/app/[lang]/(site)/about/page.tsx`, `services/page.tsx`; `client/app/[lang]/[...rest]/page.tsx` |
| CR-CMS-04 | Text, images, galleries, videos, embedded video links | **Partial.** Text (plain paragraphs), cover image and gallery exist for projects. **No video and no embeds** | `ProjectDetail.tsx:91-96`; `Gallery.tsx`; repo-wide search |
| CR-CMS-05 | Flexible block-based page editor | **Missing.** Every form is a fixed set of fields | `client/components/admin/*` |
| CR-CMS-06 | Create, edit, delete, reorder, publish, unpublish | **Partial.** Create/edit/delete for all types. Reorder for services and team. Hide/show for services and team; publish toggle for testimonials. **Projects have no publish state** | audit F-02, F-04 to F-06 |
| CR-CMS-07 | Draft, preview and publishing workflow | **Missing**, apart from a small "card preview" inside the project form | `ProjectForm.tsx:359` |
| CR-CMS-08 | Media library with secure uploads and automatic optimization | **Partial.** The library UI exists. Uploads are simulated in the browser, with no server, security or optimization pipeline | audit F-09 |
| CR-CMS-09 | Global company and contact settings | **Present** (prototype) | audit F-10 |

### 7.3 SEO

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CR-SEO-01 | Individual SEO title and meta description | **Partial.** Fixed pages have a title and description in translation files; project pages take them from **seed data only**. Nothing is editable in the admin | `client/i18n/server.ts:53-57`; `projects/[slug]/page.tsx:12-22` |
| CR-SEO-02 | Editable URL slugs | **Partial.** Projects only, and a Georgian title gives an empty slug (F-18) | `ProjectForm.tsx:181-193` |
| CR-SEO-03 | Editable H1 headings | **Partial.** A project's H1 is its title. Fixed pages' H1s are in translation files | `ProjectDetail.tsx:70`; `PageIntro.tsx:24`; `Hero.tsx:23` |
| CR-SEO-04 | Correct H1/H2/H3 hierarchy | **Partial.** Each public page has one H1. The projects index jumps from the H1 straight to H3 project cards, with no H2 between | `PageIntro.tsx:24`; `ProjectCard.tsx:45`; no `<h2` in `ProjectsExplorer.tsx` |
| CR-SEO-05 | Canonical URLs | **Partial.** Canonical and language alternates are generated as **relative** paths, and no `metadataBase` is set anywhere. Next.js documents that combination as a build error (INTEGRATIONS §10). Whether the current build actually fails was **not verified**, because the project can't be built here | `client/i18n/server.ts:44-51`; search for `metadataBase` (no matches) |
| CR-SEO-06 | Open Graph metadata and social images | **Missing**, except the Open Graph locale. No image, no Twitter card | `client/app/[lang]/layout.tsx:54` |
| CR-SEO-07 | Image alt text management | **Partial, and disconnected.** The media library edits alt text, but public pages **don't use it**. They build alt text from templates (project title + location, "image n") or leave it empty (services) | `MediaAdmin.tsx:287-289`; `ProjectCard.tsx:33`; `Gallery.tsx:56`; `ServicesList.tsx:52` |
| CR-SEO-08 | XML sitemap | **Missing** | `client/app/` listing (no `sitemap.*`) |
| CR-SEO-09 | robots.txt | **Missing.** Only the admin area is marked noindex | `client/app/[lang]/admin/layout.tsx:5`; `client/vercel.json` |
| CR-SEO-10 | Structured data (JSON-LD) | **Missing** | Repo-wide search for `ld+json` |
| CR-SEO-11 | Search Console verification support | **Missing** | Repo-wide search for `verification` |
| CR-SEO-12 | Index/follow controls | **Missing** (admin noindex only) | as CR-SEO-09 |
| CR-SEO-13 | Redirects when published URLs change | **Missing.** Changing a slug simply breaks the old address | `client/proxy.ts` (locale redirects only) |
| CR-SEO-14 | Automatic SEO defaults with manual overrides | **Partial.** Defaults exist for seed projects; there are no overrides | as CR-SEO-01 |
| CR-SEO-15 | Multilingual SEO | **Partial.** `hreflang` alternates for `en` and `ka` exist (no `x-default`). English is the default URL today, while the business wants mainly Georgian (Q-02a) | `client/i18n/server.ts:45-51`; `client/i18n/config.ts:12` |

### 7.4 Performance

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CR-PERF-01 | Responsive across desktop, tablet, mobile | **Present in code**, not visually verified (see CR-PW-01) | as CR-PW-01 |
| CR-PERF-02 | Core Web Vitals optimization | **Not measured.** Nothing can be measured until the site runs against real data (Phase 14) | — |
| CR-PERF-03 | Efficient media loading, formats, caching | **Partial.** Local images go through `next/image` (AVIF/WebP, lazy by default, `sizes` set, one preloaded image per page). Uploaded images bypass it. Image cache headers exist | `client/components/ui/Img.tsx:27-42`; `client/next.config.ts`; `client/vercel.json` |
| CR-PERF-04 | Minimal JavaScript and dependencies | **Partial.** The homepage loads three.js, React Three Fiber and drei for the 3D house. The chunk is lazy, but the viewer sits at the top of the homepage, so it loads on every homepage visit where WebGL works. Every public section is a client component | `client/components/3d/house/HouseViewer.tsx:13`, `:70-71`; `client/package.json`; `"use client"` in `client/components/sections/**` |
| CR-PERF-05 | Efficient database queries and API responses | **Missing** (no backend) | — |

### 7.5 Analytics

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CR-AN-01 | Google Analytics 4 | **Missing** | Repo-wide search for `gtag`, `googletagmanager`, `dataLayer` |
| CR-AN-02 | Google Tag Manager | **Missing** | same |
| CR-AN-03 | Tracking of calls, WhatsApp, Messenger and other actions | **Missing** | same |
| CR-AN-04 | No duplicate events | Not applicable until analytics exists | — |
| CR-AN-05 | Consent / privacy handling | **Missing.** No consent banner or privacy page | Repo-wide search |

### 7.6 Security and reliability

All of these are **Missing** in the code today, and all were already planned before this brief:
- authentication (SECURITY_PLAN §2–3) and authorization (§4)
- validation (§6), uploads (§12), rate limits (§9)
- headers and HTTPS (§10), secrets (§11)
- backups (DATABASE_DESIGN §9)
- logging and monitoring (SECURITY_PLAN §8), testing (TESTING_STRATEGY)

The new scope adds rich-text and embed sanitization, preview-link security and a site-wide Content-Security-Policy (SECURITY_PLAN §17).

### 7.7 What this means for the frontend

The second brief adds these frontend work items to the list in §6:

11. A homepage slider fed by the API (and a decision about the 3D hero, Q-20).
12. Navigation rendered from the API instead of the `NAV` constant.
13. A generic page route and a **block renderer** (text, image, gallery, video, embed).
14. A block editor, slide manager, navigation manager, page manager and redirect list in the admin.
15. Publish/draft controls and a preview link on projects and pages.
16. SEO fields in the project and page forms; alt text from the media library actually used on public images.
17. WhatsApp, Messenger and Google Maps links from settings, with tracked contact clicks.
18. `metadataBase`, sitemap, robots, JSON-LD, redirect handling and real 404 responses.
19. Tag Manager loading with consent handling.
