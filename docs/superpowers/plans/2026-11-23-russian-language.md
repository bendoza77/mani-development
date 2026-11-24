# Russian Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the whole public website work in Georgian, English and Russian, with a Russian field next to every Georgian/English field in the admin panel.

**Architecture:** Mirror the existing `xKa`/`xEn` pattern with a nullable `xRu` twin at every layer: Prisma columns, zod inputs, admin serializers, public serializers (`pick` with a ru → en → ka fallback), client admin forms and the i18n UI files. The client i18n layer is already generic over `LOCALES`, so adding `"ru"` there plus 10 JSON files covers routing, switcher, hreflang and `<html lang>`.

**Tech Stack:** Prisma + PostgreSQL, Express + zod, Vitest + supertest (server); Next.js App Router, i18next / react-i18next, `next/font/google`, Tailwind v4 (client).

**Spec:** [docs/superpowers/specs/2026-11-23-russian-language-design.md](../specs/2026-11-23-russian-language-design.md)

## Global Constraints

- Fallback when Russian is empty: **Russian → English → Georgian**. Same rule for string arrays and rich-text/JSON docs.
- Every `…Ru` column is nullable, same type and length as its `…En` twin; string arrays are `String[] @default([])`. DB column names are snake case `…_ru`.
- Russian inputs use `optionalText(max)` with the same `max` as the `…En` field: empty or whitespace becomes `null`.
- Locale code `ru`; label `{ native: "Русский", short: "RU", htmlLang: "ru", ogLocale: "ru_RU" }`; URLs `/ru/...`.
- Admin panel UI stays English. Admin field labels: `<Label> · Georgian`, `<Label> · English`, `<Label> · Russian`. Russian hint: `Optional. Empty = English text is shown (or Georgian).`
- i18next has no fallback: every UI key must exist in `ru`; `npm run i18n:check` and `tsc` must pass.
- Run server tests from **PowerShell** (`npm test` in `server/`). Git Bash makes every server test fail with "reading 'config'".
- Don't change English (default, unprefixed) or Georgian (required/primary) behaviour.

## Review Focus

1. **Existing rows after the migration** have no Russian. `?locale=ru` must return English, or Georgian when English is null too, never `null` or `""`. Tested in Task 1.
2. **A Russian box left empty or as spaces** in the admin is saved as `null`, not `""`, or the fallback would never kick in. Tested in Task 2.
3. **Feature lists:** `featuresRu: []` shows `featuresEn`; both empty shows `featuresKa`. Tested in Task 1.
4. **Old page sections** (block JSON saved before this change, without `…Ru` keys) still render for `ru` and can be re-saved without Russian. Tested in Task 3.
5. **Russian longer than the limit** gets a 400 with the field error on the `…Ru` field, and the admin form shows it under the Russian box. Tested in Task 2 (server). The client check is manual in Task 8.

---

### Task 1: Database columns, language helpers and public read path

**Files:**
- Modify: `server/prisma/schema.prisma` (every model with a `…En` field: MediaAsset, Project, ProjectSpec, Service, TeamMember, Testimonial, SiteSettings, Page, NavigationItem, HomeSlide; find them all with `grep -n "En " prisma/schema.prisma`)
- Create: `server/prisma/migrations/<timestamp>_russian/migration.sql` (via `npm run db:migrate -- --name russian`)
- Modify: `server/src/modules/media/media.serialize.ts`
- Modify: every public serializer that calls `pick` or checks `locale === "en"`: `content/seo.ts`, `pages/blocks.ts`, `pages/menu.ts`, `pages/pages.routes.ts`, `projects/projects.routes.ts`, `site/services.routes.ts`, `site/settings.routes.ts`, `site/slides.routes.ts`, `site/team.routes.ts`, `site/testimonials.routes.ts`
- Modify: `server/src/modules/content/fields.ts` (`localeQuery`)
- Test: `server/src/modules/media/media.serialize.test.ts` (new, unit)
- Test: `server/test/integration/content/russian.test.ts` (new)

**Interfaces:**
- Produces (in `media.serialize.ts`):
  - `export const LOCALES = ["ka", "en", "ru"] as const; export type Locale = (typeof LOCALES)[number];`
  - `pick(ka: string, en: string | null | undefined, ru: string | null | undefined, locale: Locale): string`: for `en`, returns en || ka; for `ru`, returns ru || en || ka; for `ka`, returns ka.
  - `pickList(ka: string[], en: string[], ru: string[], locale: Locale): string[]`: same chain, where "empty" means length 0.
  - `pickDoc<T>(ka: T, en: T | null | undefined, ru: T | null | undefined, locale: Locale): T`: same chain, where "empty" means null or undefined.
  - `AssetRow` gains `altRu: string | null`; `toMediaAsset` also returns `altRu`.
- Produces (in `fields.ts`): `localeQuery = z.object({ locale: z.enum(LOCALES).default("ka") })`.
- Produces (DB): every `xEn` has an `xRu` twin. Later tasks rely on the Prisma client having these fields.

- [ ] **Step 1: Write unit tests** in `media.serialize.test.ts`:
  - `pick("ქ", "E", "Р", "ru") === "Р"`, `pick("ქ", "E", null, "ru") === "E"`, `pick("ქ", null, null, "ru") === "ქ"`, `pick("ქ", "E", "", "ru") === "E"`, `pick("ქ", "E", "Р", "en") === "E"`, `pick("ქ", "E", "Р", "ka") === "ქ"`.
  - `pickList(["ქ"], ["E"], [], "ru")` → `["E"]`; `pickList(["ქ"], [], [], "ru")` → `["ქ"]`; `pickList(["ქ"], ["E"], ["Р"], "ru")` → `["Р"]`.
  - `pickDoc({k:1}, null, {r:1}, "ru")` → `{r:1}`; `pickDoc({k:1}, {e:1}, null, "ru")` → `{e:1}`.
- [ ] **Step 2: Run** `npx vitest run --project unit src/modules/media` (PowerShell). Expected: FAIL (`pickList` is not exported, and `pick` has the wrong arity).
- [ ] **Step 3: Add the `…Ru` columns** to `schema.prisma`, mirroring each `…En` line (`@map("…_ru")`, same `@db` type). Run `npm run db:migrate -- --name russian`, then `npm run db:check-drift`. Expected: drift check exits 0.
- [ ] **Step 4: Implement the helpers** and change every `pick(ka, en, locale)` call to `pick(ka, en, ru, locale)` using the matching `…Ru` column. Replace the hand-rolled checks: `doc()` in `blocks.ts` becomes `pickDoc`, `features` in `services.routes.ts` becomes `pickList`, and `t()` in `blocks.ts` reads `data.<x>Ru`. Every `toImage(…, locale)` passes through unchanged. Update `localeQuery`.
- [ ] **Step 5: Run** `npx tsc --noEmit` and the unit tests. Expected: no type errors, unit tests PASS.
- [ ] **Step 6: Write integration tests** in `russian.test.ts`, using `buildTestApp`, `resetDb`, `createTestAdmin`, `signIn`, `uploadImage` and `projectInput` as in `site-content.test.ts`. Write rows straight through `prisma` so this task doesn't depend on Task 2:
  - `GET /api/v1/team?locale=ru` (use the real public path from `app.ts`): a member with `nameRu: "Нино"` returns `name: "Нино"`; with `nameRu: null, nameEn: "Nino"` returns `"Nino"`; with both null returns `nameKa`.
  - A service with `featuresRu: []`, `featuresEn: ["Design"]` returns `features: ["Design"]` for `ru`.
  - A project with only Georgian fields returns the Georgian `title` for `ru` (Review Focus 1).
  - `?locale=xx` returns 400 (the existing validation behaviour).
- [ ] **Step 7: Run** `npm test` (PowerShell). Expected: all tests PASS, old and new.
- [ ] **Step 8: Commit** `feat(server): add Russian columns and ru→en→ka fallback`.

### Task 2: Admin write path for site content and media

**Files:**
- Modify: `server/src/modules/site/{team,testimonials,services,slides,navigation,settings}.routes.ts`, `server/src/modules/media/media.routes.ts`
- Test: `server/test/integration/content/russian.test.ts` (extend), plus Ru fields in the existing input builders in `site-content.test.ts` where tests compare whole objects

**Interfaces:**
- Consumes: Task 1 columns and `optionalText`.
- Produces: every admin input schema accepts `<field>Ru` (`optionalText(sameMax)`; `featuresRu: z.array(…same item rule as featuresEn…).default([])` or whatever `featuresEn` uses), and every `toAdmin` returns `<field>Ru`. Task 7 relies on these exact names, which are the `…En` names with `En` swapped for `Ru`.

- [ ] **Step 1: Write failing tests:**
  - `POST` team member with `nameRu: "Нино"` → 201, and the response has `nameRu: "Нино"`.
  - `PUT` with `nameRu: "   "` → stored `null` (Review Focus 2).
  - `bioRu` of 601 chars → 400 with `fieldErrors.bioRu` (Review Focus 5).
  - Settings `PUT` with `taglineRu`, `addressRu`, `hoursRu`, `defaultSeoDescriptionRu` → round-trips.
  - Media alt update with `altRu` → round-trips.
  - One round-trip each for testimonials, services (`featuresRu`), slides and navigation.
- [ ] **Step 2: Run** `npm test -- test/integration/content/russian.test.ts`. Expected: FAIL (`strictObject` rejects the unknown `…Ru` keys with 400).
- [ ] **Step 3: Add the `…Ru` fields** to each input schema and `toAdmin`, next to their `…En` twins.
- [ ] **Step 4: Run** `npm test`. Expected: all tests PASS.
- [ ] **Step 5: Commit** `feat(server): accept Russian in site content and media admin`.

### Task 3: Admin write path for projects, pages, sections, SEO and menu labels

**Files:**
- Modify: `server/src/modules/projects/projects.routes.ts` (project + specs), `server/src/modules/pages/{pages.routes,blocks,menu}.ts`, `server/src/modules/content/seo.ts`
- Test: `server/test/integration/content/russian.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces:
  - `seoInput` gains `titleRu: optionalText(70)` and `descriptionRu: optionalText(200)`; `SeoColumns`, `seoColumns`, `adminSeo` and `publicSeo` carry `seoTitleRu`/`seoDescriptionRu`.
  - `blockInput` gains `<x>Ru: optionalText(sameMax)` next to each `<x>En`, `docRu: richTextDoc.nullish()` next to each `docEn`, and card `titleRu`/`textRu`.
  - Page `menu` gains `labelRu`.
  - Spec rows gain `labelRu`/`valueRu`.

- [ ] **Step 1: Write failing tests:**
  - Project create with `titleRu`, `descriptionRu` (rich text, if `descriptionEn` is), one spec with `labelRu`/`valueRu`, and `seo.titleRu` → the admin GET returns them; the public `?locale=ru` returns them.
  - A page with a `text` block `docRu` and a `cards` block with a card `titleRu` → the public `ru` render shows them.
  - Old block (Review Focus 4): insert a `ContentBlock` row through `prisma` with `data` lacking any `…Ru` key → the public `ru` render falls back to English/Georgian. Re-saving that page through the admin `PUT` without `…Ru` keys → 200.
  - Page menu `labelRu` round-trips.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** the schema, serializer and SEO changes.
- [ ] **Step 4: Run** `npm test`. Expected: all tests PASS.
- [ ] **Step 5: Commit** `feat(server): accept Russian in projects, pages, sections and SEO`.

### Task 4: Sitemap, admin search, reserved slug and inquiry locale

**Files:**
- Modify: `server/src/modules/content/redirects.ts` (sitemap), `server/src/modules/admin/overview.routes.ts` (search), `server/src/lib/slug.ts`, `server/src/modules/inquiries/inquiries.routes.ts`
- Test: extend `test/integration/content/redirects.test.ts` (sitemap), `test/integration/inquiries/inquiries.test.ts`, and the admin search test (find it with `grep -rn "search" test/integration`)

**Interfaces:**
- Produces:
  - Sitemap `locales` = `["ka"]`, plus `"en"` when `titleEn` is set, plus `"ru"` when `titleRu` is set. (My call: listing `ru` only when Russian exists keeps duplicate English pages out of search engines.)
  - Search also matches `titleRu` (projects, services, pages).
  - `"ru"` is a reserved slug.
  - Inquiry `locale` enum = `LOCALES`.

- [ ] **Step 1: Write failing tests:**
  - The sitemap item for a project with `titleRu` has `locales` containing `"ru"`; without it, it doesn't.
  - Admin search `"Терраса"` finds a project whose `titleRu` contains it.
  - Creating a page with slug `ru` → 400 `reserved_slug`.
  - `POST` inquiry with `locale: "ru"` → 201.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: all tests PASS.
- [ ] **Step 5: Commit** `feat(server): Russian in sitemap, search, slugs and inquiries`.

### Task 5: Russian sample content

**Files:**
- Modify: `server/prisma/seed-data.json` (add a `ru` bundle with the same shape as `ka`: settings, projects, services, testimonials, team; add `samplePage.headingRu`, `paragraphsRu`, `imageCaptionRu`; add `slideCta.ru`)
- Modify: `server/prisma/seed.ts` (`SeedData` type; write each `…Ru` field from `data.ru`, the same way `…Ka` is written from `data.ka`)
- Test: `server/test/integration/seed.test.ts` (extend)

- [ ] **Step 1: Write a failing test** next to "stores Georgian as the primary language…": after seeding, the Vake project's `titleRu` and `locationRu` are non-empty Cyrillic (`/[А-Яа-яЁё]/`), and every seeded service has `featuresRu.length === featuresEn.length`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Write natural Russian translations** of the English seed text into `ru`. Media alt text stays English only (`altRu` null, so English shows).
- [ ] **Step 4: Run** `npm test`. Expected: all tests PASS. Then run `npm run db:seed` twice. Expected: both succeed (the seed must be safe to re-run).
- [ ] **Step 5: Commit** `feat(server): add Russian sample content`.

### Task 6: Public site in Russian (UI text, routing, fonts)

**Files:**
- Modify: `client/i18n/config.ts` (`LOCALES = ["en", "ka", "ru"]`, `LOCALE_LABELS.ru`, header comment)
- Create: `client/i18n/locales/ru/{about,common,company,contact,errors,home,house,meta,projects,services}.json`
- Modify: `client/i18n/resources.ts` (import the ru files; `const ru: UIResources`; `UI_RESOURCES = { en, ka, ru }`)
- Modify: `client/lib/public-api.ts` (replace the local `type Locale = "ka" | "en"` with the import from `@/i18n/config`)
- Modify: `client/app/sitemap.ts` (fallback `locales: ["ka", "en", "ru"]`)
- Modify: `client/app/[lang]/layout.tsx` (Geist and Geist Mono `subsets: ["latin", "cyrillic"]`; a new Cyrillic-only serif face `--font-ru-serif`, `subsets: ["cyrillic"]`, `preload: false`, `adjustFontFallback: false`, with its variable added to the `<html>` className)
- Modify: `client/app/globals.css` (`--font-display` gets `var(--font-ru-serif)` right after `var(--font-ka-serif)`; the `:root:lang(en)` and `body:lang(en)` rules also match `:lang(ru)`)
- Modify: `client/proxy.ts` (doc comment only: mention `/ru`)

**Interfaces:**
- Produces: `Locale` includes `"ru"`; Tasks 7–8 use it.

- [ ] **Step 1: Run** `npm run i18n:check` after adding `"ru"` to `LOCALES` and creating an empty `locales/ru/` folder. Expected: FAIL, listing the 10 missing ru files.
- [ ] **Step 2: Write the 10 Russian files**, translated from English: same keys, the same array lengths (e.g. 12 entries in `common.date.months`, in the case `date.monthYear` needs), and the same `{{placeholders}}` and `<tags>`. Use the formal «вы» register, the one a construction company uses with clients.
- [ ] **Step 3: Run** `npm run i18n:check`, `npx tsc --noEmit` and `npm run lint`. Expected: "i18n check passed: ka, ru match en (10 namespaces)", no type errors, no lint errors.
- [ ] **Step 4: Pick the Cyrillic serif** (Source Serif 4 or Literata; both have an `opsz` axis like Newsreader). Wire the fonts and CSS.
- [ ] **Step 5: Verify in the running site** (server and client dev servers, with seeded data). Open `/ru`, `/ru/projects`, one project page, `/ru/services`, `/ru/about` and `/ru/contact` at 375px and 1440px:
  - every visible string is Russian or fallback content, with no raw keys;
  - headings render in the chosen serif, not a system font;
  - the switcher shows Русский and moves between `/ka/x`, `/x` and `/ru/x` on the same page;
  - after picking Russian, opening `/` redirects to `/ru` (cookie);
  - `<html lang="ru">`, and the hreflang links include `ru`.
- [ ] **Step 6: Commit** `feat(client): Russian site language`.

### Task 7: Russian fields in the admin forms

**Files:**
- Modify: `client/components/admin/BiField.tsx`: new required props `ru: string; onRu: (v: string) => void`, optional `errorRu?: string`. The grid becomes three columns at `lg`, two at `sm` (Georgian | English, with Russian under them), one on mobile. The doc comment says three languages.
- Modify: `client/components/admin/RichTextEditor.tsx` (the paired editor near line 369 gets the same `ru`/`onRu`/`errorRu` props)
- Modify: `client/lib/api.ts`: every `…En` property gets a `…Ru` twin of the same type (`altRu`, `titleRu`, `featuresRu: string[]`, `docRu?: RichTextDoc | null`, …)
- Modify: `client/components/admin/{ProjectForm,PageForm,PageSections,SeoPanel,ServicesAdmin,TeamAdmin,TestimonialsAdmin,SlidesAdmin,NavigationAdmin,SettingsAdmin,MediaAdmin,PagesAdmin,ProjectsAdmin}.tsx`: drafts, `blank()`, to-draft/to-input mappers (`orNull` for Ru), client-side length checks with the same limits as En, the `KNOWN` field sets, and the spec rows in `ProjectForm` (Russian label/value inputs with `lang="ru"`)
- Where a list shows a "No English" badge, also show "No Russian" when `…Ru` is empty.

**Interfaces:**
- Consumes: Task 2/3 field names (`…En` with `En` swapped for `Ru`) and the Task 6 `Locale`.

- [ ] **Step 1: Make the `BiField` and paired rich-text props required**, then run `npx tsc --noEmit`. Expected: FAIL, listing every caller. That list is the work list.
- [ ] **Step 2: Update each form** until `npx tsc --noEmit` and `npm run lint` pass.
- [ ] **Step 3: Verify in the browser**, signed in to `/admin`:
  - create a team member with Russian, then check `/ru/about` shows it;
  - edit a project's Russian title, description and a spec, then check `/ru/projects/<slug>`;
  - leave a Russian box empty, then check the English shows on `/ru`;
  - type 601 characters into Russian bio, then check the error shows under the Russian box (Review Focus 5);
  - check the three-column layout at 1440px and stacking at 375px.
- [ ] **Step 4: Commit** `feat(admin): Russian fields in every content form`.

### Task 8: Russian in the on-page (live) editor

**Files:**
- Modify: `client/components/live-edit/LiveEditor.tsx`: `type Lang = Locale`; the language toggle maps over `["ka", "en", "ru"]` with labels ქართული / English / Русский; every `lang === "ka" ? …Ka : …En` choice becomes a three-way lookup (add a small `field(base, lang)` helper returning `` `${base}${"Ka" | "En" | "Ru"}` ``); the empty-English hint at ~line 838 applies to `ru` too, with "Empty = English text is shown (or Georgian)."

- [ ] **Step 1: Run** `npx tsc --noEmit` after changing `Lang`. Expected: FAIL at each two-way branch.
- [ ] **Step 2: Implement** until `tsc` and `lint` pass.
- [ ] **Step 3: Verify in the browser:** open a page in the live editor, switch to Русский, edit the title and a text section, save, then check `/ru/<slug>` shows the change and `/ka/<slug>` is unchanged.
- [ ] **Step 4: Commit** `feat(admin): Russian in the live page editor`.

### Task 9: Whole-branch check

- [ ] **Step 1: Run** `npm test` in `server/` (PowerShell), plus `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` and `npm run build` in `client/`. Expected: all pass.
- [ ] **Step 2: Do a final click-through** of `/ru` and `/ka` at 375px and 1440px, to confirm Georgian and English pages look exactly as before.
- [ ] **Step 3:** Update `server/docs/API_CONTRACTS.md` §1 (the fallback rule now reads ru → en → ka) if that file states the rule. Commit `docs: Russian fallback rule`.
