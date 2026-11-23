import dotenv from "dotenv";
import { createApp } from "./app.js";
import { ConfigError, loadConfig, type Config } from "./config/env.js";
import { createMailer } from "./integrations/mailer.js";
import { startEmailOutbox } from "./jobs/email-outbox.js";
import { startTokenCleanup } from "./jobs/token-cleanup.js";
import { createBackgroundTasks } from "./lib/background.js";
import { systemClock } from "./lib/clock.js";
import { createDatabase } from "./lib/db.js";
import { createLogger } from "./lib/logger.js";
import { startServer } from "./server.js";

// Local development reads .env; on Render the variables are real environment variables.
dotenv.config({ quiet: true });

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const logger = createLogger(config.logLevel);
if (config.mailTransport === "none") {
  logger.warn("MAIL_TRANSPORT=none: password-reset and notice emails are logged, not sent");
}
const db = createDatabase(config.databaseUrl);
const tasks = createBackgroundTasks(logger);
const mailer = createMailer(config, logger);
const server = await startServer({
  app: createApp({ config, logger, db, tasks, mailer }),
  port: config.port,
  logger,
  db,
  drainBackground: tasks.drain,
});
const stopTokenCleanup = startTokenCleanup({
  prisma: db.prisma,
  logger,
  clock: systemClock,
  sessionIdleMinutes: config.sessionIdleMinutes,
});
const stopEmailOutbox = startEmailOutbox({ prisma: db.prisma, mailer, clock: systemClock, logger, config });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "signal received");
    Promise.all([stopTokenCleanup(), stopEmailOutbox()])
      .then(() => server.close())
      .then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error({ err: error }, "shutdown failed");
        process.exit(1);
      },
    );
  });
}

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled promise rejection");
  process.exit(1);
});
