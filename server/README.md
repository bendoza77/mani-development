# MANI DEVELOPMENT API

Express 5 + PostgreSQL 18 + Prisma 7 API for the website and admin panel in `../client`.
Plans and decisions are in [docs/](docs/BACKEND_MASTER_PLAN.md).

**Status:** Phase 4 (admin sign-in) done, plus a first working slice of Phases 5–7 (2026-11-22): photo uploads, projects and pages with content blocks, for the admin panel and the public site. Phase 3 (hosting) is waiting for the Render and Vercel accounts.

## Requirements

- Node.js **24.19 or newer** in the 24.x line (`.node-version` pins the exact version used by Render)
- PostgreSQL 18, either through Docker (`docker-compose.yml`) or a local install

## Setup

```bash
npm ci
cp .env.example .env      # then adjust values if needed
npm run db:up             # PostgreSQL 18 in Docker on localhost:5434
npm run prisma:generate   # generates the database client into src/generated/
npm run db:deploy         # creates the tables, the settings row, the built-in pages and the menu
npm run db:seed           # optional: placeholder demo content (development only, never production)
npm run admin:create      # asks for the admin's email, name and password
npm run dev               # http://localhost:4000
```

Check it's running:

```bash
curl http://localhost:4000/api/health/live    # {"status":"ok"}
curl http://localhost:4000/api/health/ready   # {"status":"ok","checks":{"database":"ok"}}
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the API with automatic restart on changes |
| `npm run build` / `npm start` | Compiles to `dist/` / runs the compiled build |
| `npm test` | All tests (unit + integration) |
| `npm run test:unit` / `npm run test:integration` | One group only |
| `npm run typecheck` / `npm run lint` | Type check / lint |
| `npm run db:up` / `npm run db:down` | Start / stop the Docker database |
| `npm run prisma:generate` | Regenerate the database client |
| `npm run db:migrate` | Create a new migration after changing `prisma/schema.prisma` (development) |
| `npm run db:deploy` | Apply migrations (the same command production runs before each deploy) |
| `npm run db:seed` | Load the placeholder demo content; safe to run repeatedly |
| `npm run db:check-drift` | Confirm the migrations match the schema (needs `SHADOW_DATABASE_URL`) |
| `npm run admin:create` | Create the admin account (asks for email, name, password) |
| `npm run admin:set-password` | Emergency password change when the email reset can't be used; signs every device out |

## Admin sign-in

Details: [docs/SECURITY_PLAN.md](docs/SECURITY_PLAN.md) §2–5 and [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) §4.

- **Sessions** live in the database; the browser holds only a random token in an `HttpOnly` cookie (`__Host-sid`, or `sid` on plain-http local development). A session ends after 12 hours unused or 7 days in any case.
- **Wrong passwords:** 10 in a row lock the account for 15 minutes. The answer is always the same "email or password is incorrect", so nobody can tell which part was wrong or whether the account exists.
- **Forgotten password:** `POST /api/auth/password-reset/request` emails a link valid for 30 minutes, once, to the address stored on the account. Locally, set `MAIL_TRANSPORT=console` and the email (with the link) is printed in the `npm run dev` terminal. Real sending uses Gmail SMTP: `MAIL_TRANSPORT=smtp` with `SMTP_USER` and `SMTP_APP_PASSWORD` (see `.env.example` and `docs/RUNBOOK.md`). Inquiry emails go through a database queue (`email_messages`) and are retried after 1, 5, 30 and 120 minutes.
- **Unsafe requests** (POST, PUT, PATCH, DELETE) to `/api/auth` and `/api/admin` must carry an `Origin` header listed in `CORS_ORIGINS`.
- **In production** (Render shell), run the compiled scripts instead: `node dist/scripts/admin-create.js` and `node dist/scripts/admin-set-password.js`.
- Expired sessions and reset links are deleted by a job that runs at startup and then hourly.

## Photos, projects and pages (first slice of Phases 5–7)

| Area | Admin (`/api/admin/…`, sign-in required) | Public |
|---|---|---|
| Photos | `POST media/uploads` → upload the file → `POST media/:id/complete`; `GET media` | `/media/<file>` (local storage only) |
| Projects | `GET/POST projects`, `GET/PUT/DELETE projects/:id` | `GET /api/public/projects`, `GET /api/public/projects/:slug` (`?locale=ka\|en`) |
| Pages | `GET/POST pages`, `GET/PUT/DELETE pages/:id` (heading, formatted text and photo blocks) | `GET /api/public/pages/:slug` |

- **Photo storage:** `MEDIA_PROVIDER=local` saves files in `server/uploads/` (development only). With `MEDIA_PROVIDER=cloudflare` and the three `CLOUDFLARE_*` settings in `.env`, the browser uploads straight to Cloudflare Images. Production refuses `local`.
- Uploads accept JPEG, PNG, WebP and AVIF up to 10 MB; the file's first bytes must match its type.
- Only published projects and pages are visible publicly; English text falls back to Georgian when empty.
- Formatted text is stored as an allow-listed JSON document (paragraphs, lists, bold, italic, safe links), never as HTML.
- **Not yet built:** gallery/video/embed blocks, SEO fields, drafts preview, redirects on slug change, deleting photos, the Cloudflare upload check against the live service.

## Database

- **Schema:** `prisma/schema.prisma`; design and reasoning in [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md).
- **Migrations:** `prisma/migrations/`. Integrity rules Prisma can't express (35 `CHECK` constraints) and the starting rows (settings, the five built-in pages, the default menu) are hand-written at the end of the first migration. **Never edit a migration that has been applied anywhere shared**; add a new one.
- **Bilingual text:** every translatable field has a required Georgian column (`…Ka`) and an optional English one (`…En`).
- **Seed data:** `prisma/seed-data.json` is a copy of the prototype's placeholder demo content (`client/data/seed.ts` and its Georgian translations). It has no Georgian alt text for images, and no video or embed blocks.

## Tests

- **Integration tests use a real PostgreSQL database** given by `DATABASE_URL_TEST`. The default is `postgresql://postgres:postgres@localhost:5434/mani_test`, matching `docker-compose.yml`.
- On every run the test setup **drops and recreates** that database and applies all migrations. It **refuses to run if the name doesn't end in `_test`**, so tests can never touch real data.
- `resetDb()` (in `test/helpers/db.ts`) empties every table and restores the migration's starting rows; tests that write data call it in `beforeEach`.
- Test files run one at a time because they share the database.
- `test/security/route-walker.test.ts` reads Express's route table and checks that **every** `/api/admin` route answers 401 without a session, so new admin routes are covered automatically.
- On Windows, run the tests from PowerShell or cmd. Started from Git Bash, Vitest can load itself twice and every file fails with `Cannot read properties of undefined (reading 'config')`.

## Configuration

All settings come from environment variables, validated at startup. The process stops with a list of every missing or invalid variable. See `.env.example` and [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) §9.

Never commit `.env`. Real secrets live only in your local `.env` and in Render's settings.

## Layout

```
src/
  index.ts        process entry: config → database → app → listen → graceful shutdown
  app.ts          createApp(): middleware pipeline and routes (used directly by tests)
  server.ts       startServer(): listen and graceful close
  config/env.ts   environment variable contract (the only place that reads process.env)
  lib/            database, logger, errors, validation, clock, activity log, background tasks
  middleware/     request IDs and logging, JSON-only bodies, origin check, rate limits, admin guard, 404, errors
  modules/        one folder per feature: health, auth (sign-in, sessions, password reset), admin
  integrations/   outside services (mailer)
  jobs/           scheduled work (expired-token cleanup)
  scripts/        admin:create and admin:set-password
test/
  setup/          global setup (test database)
  helpers/        test app builder, sign-in helpers
  integration/    HTTP + database tests
  security/       route walker
```
