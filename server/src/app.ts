import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { Config } from "./config/env.js";
import type { Database } from "./lib/db.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { requireJsonBody } from "./middleware/require-json-body.js";
import { healthRoutes } from "./modules/health/health.routes.js";

export type AppDeps = {
  config: Config;
  logger: Logger;
  db: Database;
};

/**
 * Builds the Express app without starting a server, so tests can use it directly.
 * Pipeline: docs/BACKEND_MASTER_PLAN.md §3.2.
 */
export function createApp({ config, logger, db }: AppDeps) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);

  app.use(helmet());
  app.use(requestContext(logger));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin !== undefined && config.corsOrigins.includes(origin)),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type"],
      maxAge: 600,
    }),
  );
  app.use(requireJsonBody);
  app.use(express.json({ limit: "100kb", strict: true }));

  app.use("/api/health", healthRoutes(db));

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
