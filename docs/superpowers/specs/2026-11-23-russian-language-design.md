# Russian language — design

Date: 2026-11-23 · Status: approved by owner 2026-11-23

## Intent

The public website must work fully in three languages: Georgian, English and Russian. A
visitor can switch to Russian and see every page in Russian: menus, buttons, forms, errors,
SEO text, and all content the owner manages in the admin panel (projects, services, team,
testimonials, pages, home slider, navigation, settings, photo alt text).

Every place in the admin panel that today has a Georgian box and an English box gets a third
Russian box, so the owner can type Russian translations of their own content.

## Goals

- Russian at `/ru/...` URLs, same as Georgian at `/ka/...`. English stays unprefixed (default).
- Russian in the language switcher, `<html lang="ru">`, `og:locale` `ru_RU`, hreflang and sitemap.
- All fixed UI text translated into Russian (10 namespace files in `client/i18n/locales/ru/`).
- A Russian field next to every Georgian/English field in the admin panel and in the on-page
  (live) editor.
- Server API accepts, stores, validates and returns Russian for every bilingual field.
- Seed/sample content gets Russian text too.
- Russian text renders in the site's own type style (needs Cyrillic font coverage).

## Non-goals

- The admin panel's own interface stays English only (as today).
- No machine-translation button in the admin.
- No restructuring of how languages are stored (no translation table). See Approaches.
- No change to which language is default (English, unprefixed) or which is "primary" in the
  data (Georgian is required, others optional).

## Anti-goals (would be a failure even if it technically works)

- A Russian page showing blank text, raw keys, or a mix of empty boxes where the owner hasn't
  translated yet.
- Breaking existing Georgian/English content or URLs.
- Russian headings falling back to a random system serif that clashes with the design.

## Approaches considered

- **A. Add `xRu` columns next to every `xKa`/`xEn` pair (chosen).** Mirrors the existing
  pattern exactly; each layer (schema, zod schemas, serializers, admin forms, site) gets a
  third copy of what's already there. Typed, validated, searchable. Cost: a fourth language
  later repeats the exercise.
- **B. Generic translations table (entity, field, locale).** Easy future languages, but
  rewrites every read/write path in working code. Too much risk for the gain.
- **C. Per-item JSON bundle of translations.** Loses per-field length/required validation
  and makes admin search harder.

Owner picked A.

## Decisions (owner's)

- Whole site in Georgian / English / Russian, including all admin-managed content.
- Storage approach A.
- **Fallback when a Russian field is empty:** show English; if English is empty too, show
  Georgian. (Today: English empty → Georgian.) Same rule for string arrays
  (`featuresRu` empty → `featuresEn` → `featuresKa`) and rich-text/JSON block content.
- Existing uncommitted work was committed first (`90b89ff`), so the Russian work is reviewed
  on its own.

## Decisions (my calls — owner may override)

- **Russian columns are optional (nullable)**, like the English ones. Empty input → `null`.
  Same max lengths as the matching Georgian/English column.
- **Fixed UI translations into Russian are written by Claude**; flag in the handover that a
  native speaker should review before launch.
- **Admin field labels**: `… · Georgian`, `… · English`, `… · Russian`. Russian hint:
  "Optional. Empty = English text is shown (or Georgian)."
- **Fonts:** Newsreader has no Cyrillic. Add a Cyrillic serif companion the same way Georgian
  is handled (separate `next/font` face, Cyrillic subset only, not preloaded), and request the
  `cyrillic` subset for Geist/Geist Mono if Google Fonts offers it. The builder picks the
  specific serif (candidates: Noto Serif, Source Serif 4, Literata) by checking it against the
  Newsreader look in the rendered page.
- **Dates:** add Russian month names to `common.json` `date.months` (genitive/nominative as
  the existing format string needs).
- **Emails:** inquiry `locale` accepts `ru`. The only inquiry email is the staff
  notification, which stays as it is (no visitor-facing email exists to translate).
- **Sitemap/hreflang:** a page/project is listed for `ru` when it has Russian (or English) title,
  matching the fallback — builder may choose the simplest consistent rule.
- **Reserved slugs:** add `ru` to the reserved list (`server/src/lib/slug.ts`).

## Scope — what changes

### Database (`server/prisma/schema.prisma` + one new migration)

Add a nullable `…Ru` column (snake `…_ru`, same type/length as the `…En` twin) for every
bilingual pair on: `MediaAsset` (alt), `Project` (title, summary, description, location,
city, seoTitle, seoDescription), `ProjectSpec` (label, value), `Service` (title, summary,
description, features — `String[] @default([])`), `TeamMember` (name, role, bio),
`Testimonial` (quote, author, role), `SiteSettings` (tagline, address, hours,
defaultSeoDescription and any other `…En`), `Page` (title, intro, seoTitle, seoDescription),
`NavigationItem` (label), `HomeSlide` (heading, text, ctaLabel). Builder greps for every
`En\b` field so none is missed. `EmailMessage.locale` already a 2-char string; just allow `ru`.

Content blocks (`ContentBlock` JSON data with `titleKa/titleEn`-style keys, and rich-text
documents) get matching `…Ru` keys in their zod schemas; old rows without them stay valid.

### Server (`server/src`)

- `Locale` type and `pick()` in `modules/media/media.serialize.ts` → three languages with the
  fallback chain above. Same for `doc()` in `pages/blocks.ts`, `features` in
  `site/services.routes.ts`, and any other hand-rolled `locale === "en"` check.
- `localeQuery` and inquiry `locale` enums → `["ka", "en", "ru"]`.
- Every admin create/update zod schema and admin serializer adds the `…Ru` fields
  (`optionalText(max)`), in projects, pages, blocks, seo, services, team, testimonials,
  slides, navigation, settings, media.
- Admin search (`admin/overview.routes.ts`) also matches Russian titles.
- `redirects.ts` sitemap locales include `ru`.
- Seed (`prisma/seed.ts`, `seed-data.json`) gets Russian values.
- Tests: extend existing integration tests to cover Russian round-trip and fallback. Run
  Vitest from PowerShell (Git Bash breaks server tests).

### Client (`client/`)

- `i18n/config.ts`: `LOCALES = ["en","ka","ru"]`, `LOCALE_LABELS.ru = { native: "Русский",
  short: "RU", htmlLang: "ru", ogLocale: "ru_RU" }`.
- `i18n/locales/ru/*.json` (10 files) and wire them in `i18n/resources.ts`; type checking
  and `npm run i18n:check` must pass for all three.
- `proxy.ts`, `LanguageSwitcher`, `lib/seo/metadata.ts`, `app/sitemap.ts`,
  `lib/public-api.ts`: handle `ru` wherever `ka` is special-cased.
- Fonts in `app/[lang]/layout.tsx` as above.
- Admin: `BiField` grows into a three-language field (Georgian / English / Russian) used by
  every admin form; forms, `RichTextEditor`, `SeoPanel`, `PageSections`, `LiveEditor` and the
  admin API types in `lib/api.ts` carry the Russian values. Layout: three columns on wide
  screens, stacked on narrow.

## Constraints

- No fallback in i18next (`fallbackLng: false`): every UI key must exist in `ru`.
- Existing data must migrate cleanly (new columns nullable / default empty array).

## Left to the builder

- Exact Cyrillic serif choice (verify visually).
- Order of work and how to split commits.
- Exact admin three-column layout details within the existing admin style.
- Simplest consistent sitemap/hreflang rule for `ru`.
