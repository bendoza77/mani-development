import type { Logger } from "pino";
import { inject } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig, type Config } from "../../src/config/env.js";
import { createFakeMailer, type FakeMailer } from "../../src/integrations/mailer.js";
import { createBackgroundTasks } from "../../src/lib/background.js";
import type { Clock } from "../../src/lib/clock.js";
import { createDatabase, type Database } from "../../src/lib/db.js";
import { createLogger } from "../../src/lib/logger.js";
import type { RateLimits } from "../../src/middleware/rate-limits.js";

export const ALLOWED_ORIGIN = "https://www.example.test";

/**
 * Tests send many requests from one address, so every limit is raised unless a test sets its own.
 * The real values are checked in src/middleware/rate-limits.test.ts.
 */
const GENEROUS_LIMITS: RateLimits = {
  login: { limit: 10_000, windowMs: 60_000 },
  resetRequestPerIp: { limit: 10_000, windowMs: 60_000 },
  resetRequestPerEmail: { limit: 10_000, windowMs: 60_000 },
  resetConfirm: { limit: 10_000, windowMs: 60_000 },
  admin: { limit: 10_000, windowMs: 60_000 },
};

/** Configuration for integration tests: the test database, one allowed origin, silent logs. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: inject("databaseUrl"),
    CORS_ORIGINS: ALLOWED_ORIGIN,
    PUBLIC_SITE_URL: ALLOWED_ORIGIN,
    LOG_LEVEL: "silent",
    ...overrides,
  });
}

/** Builds the real app against a real database. Call `close()` in afterAll. */
export function buildTestApp(
  options: {
    config?: Config;
    db?: Database;
    clock?: Clock;
    limits?: Partial<RateLimits>;
    mailer?: FakeMailer;
    logger?: Logger;
  } = {},
) {
  const config = options.config ?? testConfig();
  const logger = options.logger ?? createLogger(config.logLevel);
  const db = options.db ?? createDatabase(config.databaseUrl);
  const mailer = options.mailer ?? createFakeMailer();
  const limits = { ...GENEROUS_LIMITS, ...options.limits };
  const tasks = createBackgroundTasks(logger);
  const app = createApp({ config, logger, db, mailer, clock: options.clock, limits, tasks });
  return {
    app,
    db,
    config,
    mailer,
    /** Waits for emails and other work still running after a response. Use in afterEach. */
    settle: () => tasks.drain(),
    close: async () => {
      await tasks.drain();
      await db.disconnect();
    },
  };
}
