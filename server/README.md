# MANI DEVELOPMENT API

Express 5 + PostgreSQL 18 + Prisma 7 API for the website and admin panel in `../client`.
Plans and decisions are in [docs/](docs/BACKEND_MASTER_PLAN.md).

**Status:** Phase 2 (database schema). The only endpoints are still the health checks; all 22 tables, their integrity rules and the development seed exist.

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
  lib/            database, logger, errors, validation
  middleware/     request IDs and logging, JSON-only bodies, 404, error envelope
  modules/        one folder per feature (health so far)
test/
  setup/          global setup (test database)
  helpers/        test app builder
  integration/    HTTP + database tests
```
