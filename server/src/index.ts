import dotenv from "dotenv";
import { createApp } from "./app.js";
import { ConfigError, loadConfig, type Config } from "./config/env.js";
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
const db = createDatabase(config.databaseUrl);
const server = await startServer({ app: createApp({ config, logger, db }), port: config.port, logger, db });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "signal received");
    server.close().then(
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
