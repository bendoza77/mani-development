import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env files itself. Locally, values come from .env;
// on Render they are real environment variables and this is a no-op.
dotenv.config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read directly (not with prisma's env(), which throws when missing) so that
    // `prisma generate` works in builds that have no database URL.
    url: process.env.DATABASE_URL,
  },
});
