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
 * Runs once before the integration tests.
 * - Refuses any database whose name does not end in "_test", so tests can never touch real data.
 * - Creates the test database if it does not exist yet.
 * - Hands the URL to the tests through `inject("databaseUrl")`.
 */
export default async function setup(project: TestProject) {
  dotenv.config({ quiet: true });
  const url = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL;

  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (!/^[a-z0-9_]+_test$/.test(databaseName)) {
    throw new Error(`Refusing to run integration tests against "${databaseName}": the name must end in "_test".`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }

  project.provide("databaseUrl", url);
}
