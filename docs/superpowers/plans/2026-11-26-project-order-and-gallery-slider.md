# Project order and gallery slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-chosen project order on the website, and a one-photo-plus-thumbnails slider on the project page.

**Architecture:** A `position` column on `projects`, set as a whole list through `PUT /api/admin/projects/order`. Both list endpoints sort by it. The admin list gets a number column. `Gallery.tsx` is rebuilt as a slider and keeps its lightbox.

**Tech Stack:** Express + Prisma (Postgres), Vitest + supertest, Next.js + Tailwind.

**Spec:** docs/superpowers/specs/2026-11-26-project-order-and-gallery-slider-design.md

## Global Constraints

- Run server tests from PowerShell (`npx vitest run` in `server/`). Git Bash breaks them.
- Public-site copy goes in all three locales (ka, en, ru). Follow the public-site design rules: no all-caps labels, no mono labels.
- Admin copy is English only (the existing admin is English).

## Review Focus

- Order list missing a project or holding a duplicate → 400 `VALIDATION_ERROR`, nothing changes.
- A project created after ordering → goes last, not first.
- Typing 0, a negative number or a number past the end → clamps to the first or last place.
- A gallery with one photo → no arrows and no thumbnails, only the photo.
- A project deleted in another tab, then a reorder sent → 400 (the list no longer matches), and the admin list reloads.

---

### Task 1: Server: position column, order endpoint, sorted lists

**Files:**
- Modify: `server/prisma/schema.prisma` (Project: `position Int @default(0)`, `@@index([position])`)
- Create: `server/prisma/migrations/20261126120000_project_position/migration.sql`. It adds the column and the index, then backfills: `ROW_NUMBER() OVER (ORDER BY (category <> 'residential'), COALESCE(completion_date, estimated_completion) DESC) - 1`.
- Modify: `server/src/modules/projects/projects.routes.ts`
- Test: `server/test/integration/content/projects.test.ts`

**Interfaces:**
- Produces: `PUT /api/admin/projects/order` with body `{ ids: string[] }` and response `{ items: AdminProject[] }` in the new order. `AdminProject.position: number`.

- [ ] Tests: `"reorders projects and lists them in that order (admin and public)"`. It creates a, b and c, then PUTs order [c, a, b]. The admin and public slugs are then `["c","a","b"]`, and a new project d goes last. A second test, `"refuses an order that misses or repeats a project"`, expects 400 for both cases.
- [ ] Run them: FAIL (404 on the route).
- [ ] Implement: `orderInput = z.strictObject({ ids: z.array(z.uuid()).max(500) })`. Register the route before `/:id`. Check that the set of ids equals all project ids and has the same length, else `AppError(400, "VALIDATION_ERROR", …)`. Write the positions in a `$transaction` of updates and call `recordActivity`. On create, `position = (max position) + 1`. Both `findMany` calls use `orderBy: [{ position: "asc" }, { updatedAt: "desc" }]`.
- [ ] Run `npx prisma migrate dev` and the project tests: PASS.

### Task 2: Admin list number column

**Files:** Modify `client/lib/api.ts` (`AdminProject.position`) and `client/components/admin/ProjectsAdmin.tsx`.

- [ ] The default sort becomes `{ key: "position", dir: "asc" }`. `orderMode = status==="all" && category==="all" && !q && sort.key==="position"`.
- [ ] When `orderMode` is on, a first "#" column shows a number input (`w-14`, `aria-label="Place of {title}"`). On Enter or blur, clamp to 1..n, move the row, set the list optimistically, PUT `/api/admin/projects/order`, then toast "Order saved", or toast the error and reload. When it's off, the column header is a SortHeader "#" that resets the filters. The mobile list gets the same input.
- [ ] `npx tsc --noEmit` and `npm run lint` in `client/`: clean.

### Task 3: Public order + gallery slider

**Files:** Modify `client/components/sections/ProjectsExplorer.tsx` (drop the house/date sort, keep the server order), `client/components/sections/Gallery.tsx`, and the `client/i18n/locales/{ka,en,ru}/projects.json` `gallery.*` keys (add `thumb`, `slider`).

- [ ] Gallery: a `16/10` main slide inside a `button` that opens the lightbox, prev/next buttons and an `n / total` counter over it, and a swipe on touch (pointer start/end dx > 40px). Under it, a horizontal thumbnail `ul` with `aria-current` on the active one, which `scrollIntoView({block:"nearest", inline:"nearest"})` on change. ArrowLeft/ArrowRight work on the slider region. A single image shows no controls.
- [ ] Check it in the browser at 1440 and 390 widths. Then run tsc and lint: clean.
- [ ] Commit all tasks.
