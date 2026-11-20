import { inject } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig, type Config } from "../../src/config/env.js";
import { createDatabase, type Database } from "../../src/lib/db.js";
import { createLogger } from "../../src/lib/logger.js";

export const ALLOWED_ORIGIN = "https://www.example.test";

/** Configuration for integration tests: the test database, one allowed origin, silent logs. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: inject("databaseUrl"),
    CORS_ORIGINS: ALLOWED_ORIGIN,
    LOG_LEVEL: "silent",
    ...overrides,
  });
}

/** Builds the real app against a real database. Call `close()` in afterAll. */
export function buildTestApp(options: { config?: Config; db?: Database } = {}) {
  const config = options.config ?? testConfig();
  const logger = createLogger(config.logLevel);
  const db = options.db ?? createDatabase(config.databaseUrl);
  const app = createApp({ config, logger, db });
  return { app, db, config, close: () => db.disconnect() };
}
