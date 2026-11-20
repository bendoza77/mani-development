import cors, { type CorsOptions } from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { Config } from "./config/env.js";
import { createMailer, type Mailer } from "./integrations/mailer.js";
import { createBackgroundTasks, type BackgroundTasks } from "./lib/background.js";
import { systemClock, type Clock } from "./lib/clock.js";
import type { Database } from "./lib/db.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { originCheck } from "./middleware/origin-check.js";
import { createRateLimiters, DEFAULT_RATE_LIMITS, type RateLimits } from "./middleware/rate-limits.js";
import { requestContext } from "./middleware/request-context.js";
import { requireAdmin } from "./middleware/require-admin.js";
import { requireJsonBody } from "./middleware/require-json-body.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { healthRoutes } from "./modules/health/health.routes.js";

export type AppDeps = {
  config: Config;
  logger: Logger;
  db: Database;
  /** Defaults to the transport named by MAIL_TRANSPORT. */
  mailer?: Mailer;
  clock?: Clock;
  /** Overrides for individual rate limits (tests use small or large values). */
  limits?: Partial<RateLimits>;
  /** Work that outlives its request (emails). Pass one in to be able to wait for it at shutdown. */
  tasks?: BackgroundTasks;
};

/** Routes that use the session cookie: credentialed CORS, origin check, no caching. */
const COOKIE_ROUTES = ["/api/auth", "/api/admin"];
const usesCookie = (path: string) => COOKIE_ROUTES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const noStore = (_req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "no-store");
  next();
};

/**
 * Builds the Express app without starting a server, so tests can use it directly.
 * Pipeline: docs/BACKEND_MASTER_PLAN.md §3.2.
 */
export function createApp({ config, logger, db, mailer, clock = systemClock, limits = {}, tasks }: AppDeps) {
  const app = express();
  const prisma = db.prisma;
  const limiters = createRateLimiters({ ...DEFAULT_RATE_LIMITS, ...limits });
  const guard = requireAdmin({ config, prisma, clock });
  const auth = createAuthService({
    config,
    prisma,
    clock,
    mailer: mailer ?? createMailer(config.mailTransport, logger),
    logger,
    tasks: tasks ?? createBackgroundTasks(logger),
  });

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);

  app.use(helmet());
  app.use(requestContext(logger));
  // Exact allow-list; credentials only where the session cookie is used (docs/SECURITY_PLAN.md §5).
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      const options: CorsOptions = {
        origin: origin !== undefined && config.corsOrigins.includes(origin),
        credentials: usesCookie(req.url ?? ""),
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type"],
        maxAge: 600,
      };
      callback(null, options);
    }),
  );
  app.use(requireJsonBody);
  app.use(express.json({ limit: "100kb", strict: true }));

  app.use("/api/health", healthRoutes(db));

  app.use(COOKIE_ROUTES, noStore, originCheck(config.corsOrigins), limiters.admin);
  app.use("/api/auth", authRoutes({ config, prisma, auth, requireAdmin: guard, limiters }));
  // Every admin route sits behind the guard, so a new one can't accidentally be public.
  app.use("/api/admin", guard, adminRoutes());

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
