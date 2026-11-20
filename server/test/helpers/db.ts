import pg from "pg";
import { inject } from "vitest";

/**
 * Empties every table, then restores the rows the migrations insert (copied by the global setup
 * into the `test_baseline` schema). Call it in `beforeEach` of tests that write data.
 *
 * Restoring with `session_replication_role = replica` skips foreign-key checks while the baseline
 * rows go back in, so table order doesn't matter. That needs a superuser, which the local Docker
 * database, the throwaway test cluster and the CI service container all provide.
 */
export async function resetDb(url: string = inject("databaseUrl")): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    const baseline = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'test_baseline'",
    );

    await client.query("BEGIN");
    await client.query(
      `TRUNCATE ${tables.rows.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
    await client.query("SET LOCAL session_replication_role = replica");
    for (const { tablename } of baseline.rows) {
      await client.query(`INSERT INTO "public"."${tablename}" SELECT * FROM "test_baseline"."${tablename}"`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

/** Runs one SQL statement with a short-lived connection (for checks that bypass Prisma). */
export async function sql<T extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
  url: string = inject("databaseUrl"),
): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}
