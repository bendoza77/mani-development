import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env files itself. Locally, values come from .env;
// on Render they are real environment variables and this is a no-op.
dotenv.config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Development only: placeholder demo content (docs/DATABASE_DESIGN.md §8).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read directly (not with prisma's env(), which throws when missing) so that
    // `prisma generate` works in builds that have no database URL.
    url: process.env.DATABASE_URL,
    // An empty scratch database Prisma may wipe; only needed for the CI drift check
    // (`prisma migrate diff --from-migrations`). Never point it at real data.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
