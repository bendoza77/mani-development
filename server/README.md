# MANI DEVELOPMENT API

Express 5 + PostgreSQL 18 + Prisma 7 API for the website and admin panel in `../client`.
Plans and decisions are in [docs/](docs/BACKEND_MASTER_PLAN.md).

**Status:** Phase 1 (foundation). The only endpoints are the health checks.

## Requirements

- Node.js **24.19 or newer** in the 24.x line (`.node-version` pins the exact version used by Render)
- PostgreSQL 18, either through Docker (`docker-compose.yml`) or a local install

## Setup

```bash
npm ci
cp .env.example .env      # then adjust values if needed
npm run db:up             # PostgreSQL 18 in Docker on localhost:5434
npm run prisma:generate   # generates the database client into src/generated/
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

## Tests

- **Integration tests use a real PostgreSQL database** given by `DATABASE_URL_TEST`. The default is `postgresql://postgres:postgres@localhost:5434/mani_test`, matching `docker-compose.yml`.
- The test setup creates that database if it's missing, and **refuses to run if its name doesn't end in `_test`**, so tests can never touch real data.
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
