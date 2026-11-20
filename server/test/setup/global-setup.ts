import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import type { TestProject } from "vitest/node";

const DEFAULT_TEST_URL = "postgresql://postgres:postgres@localhost:5434/mani_test";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Runs once before the integration tests:
 * 1. Refuses any database whose name does not end in "_test", so tests can never touch real data.
 * 2. Drops and recreates the test database, then applies every migration with `prisma migrate deploy`
 *    (the same command production uses).
 * 3. Copies the rows the migrations insert (settings, built-in pages, default menu) into a
 *    `test_baseline` schema, so `resetDb()` can restore exactly that starting state.
 * 4. Hands the URL to the tests through `inject("databaseUrl")`.
 */
export default async function setup(project: TestProject) {
  dotenv.config({ quiet: true });
  const url = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL;

  const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^[a-z0-9_]+_test$/.test(databaseName)) {
    throw new Error(`Refusing to run integration tests against "${databaseName}": the name must end in "_test".`);
  }

  await recreateDatabase(url, databaseName);
  migrate(url);
  await snapshotBaseline(url);

  project.provide("databaseUrl", url);
}

async function recreateDatabase(url: string, databaseName: string) {
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }
}

function migrate(url: string) {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("prisma/package.json")), "build", "index.js");
  const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function snapshotBaseline(url: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("CREATE SCHEMA test_baseline");
    const { rows } = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    for (const { tablename } of rows) {
      const count = await client.query(`SELECT 1 FROM "public"."${tablename}" LIMIT 1`);
      if (count.rowCount) {
        await client.query(`CREATE TABLE "test_baseline"."${tablename}" AS SELECT * FROM "public"."${tablename}"`);
      }
    }
  } finally {
    await client.end();
  }
}
