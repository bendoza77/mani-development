import cors, { type CorsOptions } from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { Config } from "./config/env.js";
import { createMailer, type Mailer } from "./integrations/mailer.js";
import { createMediaStorage, type MediaStorage } from "./integrations/media-storage.js";
import { createTurnstileCheck, type SpamCheck } from "./integrations/turnstile.js";
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
import { activityRoutes, dashboardRoutes, notificationRoutes, searchRoutes } from "./modules/admin/overview.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { adminRedirectRoutes, publicPathRoutes } from "./modules/content/redirects.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { adminInquiryRoutes, publicInquiryRoutes } from "./modules/inquiries/inquiries.routes.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { publicNavigationRoutes } from "./modules/pages/menu.js";
import { adminPageRoutes, publicPageRoutes } from "./modules/pages/pages.routes.js";
import { adminProjectRoutes, publicProjectRoutes } from "./modules/projects/projects.routes.js";
import { adminNavigationRoutes } from "./modules/site/navigation.routes.js";
import { adminServiceRoutes, publicServiceRoutes } from "./modules/site/services.routes.js";
import { adminSettingsRoutes, publicSettingsRoutes } from "./modules/site/settings.routes.js";
import { adminSlideRoutes, publicSlideRoutes } from "./modules/site/slides.routes.js";
import { adminTeamRoutes, publicTeamRoutes } from "./modules/site/team.routes.js";
import { adminTestimonialRoutes, publicTestimonialRoutes } from "./modules/site/testimonials.routes.js";

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
  /** Photo storage; defaults to the one named by MEDIA_PROVIDER. */
  storage?: MediaStorage;
  /** Contact-form spam check; defaults to Cloudflare Turnstile when TURNSTILE_SECRET_KEY is set, else none. */
  spamCheck?: SpamCheck | null;
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
export function createApp({ config, logger, db, mailer, clock = systemClock, limits = {}, tasks, storage, spamCheck }: AppDeps) {
  const app = express();
  const prisma = db.prisma;
  const limiters = createRateLimiters({ ...DEFAULT_RATE_LIMITS, ...limits });
  const guard = requireAdmin({ config, prisma, clock });
  const auth = createAuthService({
    config,
    prisma,
    clock,
    mailer: mailer ?? createMailer(config, logger),
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

  // Locally stored photos (development). Other sites (the website on another port) may show them.
  if (config.media.provider === "local") {
    app.use(
      "/media",
      (_req, res, next) => {
        res.set("Cross-Origin-Resource-Policy", "cross-origin");
        next();
      },
      // A missing file falls through to the JSON 404 below (not a 500).
      express.static(config.media.dir, { fallthrough: true, immutable: true, maxAge: "365d", index: false }),
    );
  }

  app.use("/api/public/projects", publicProjectRoutes({ config, prisma }));
  app.use("/api/public/pages", publicPageRoutes({ config, prisma }));
  app.use("/api/public/navigation", publicNavigationRoutes({ prisma }));
  app.use("/api/public", publicPathRoutes({ prisma }));
  app.use("/api/public/services", publicServiceRoutes({ config, prisma }));
  app.use("/api/public/team", publicTeamRoutes({ config, prisma }));
  app.use("/api/public/testimonials", publicTestimonialRoutes({ prisma }));
  app.use("/api/public/slides", publicSlideRoutes({ config, prisma }));
  app.use("/api/public/settings", publicSettingsRoutes({ config, prisma }));
  app.use(
    "/api/public/inquiries",
    publicInquiryRoutes({
      prisma,
      clock,
      spamCheck: spamCheck !== undefined ? spamCheck : config.turnstileSecret ? createTurnstileCheck(config.turnstileSecret, logger) : null,
      limiters: [limiters.inquiry, limiters.inquiryDaily],
    }),
  );

  app.use(COOKIE_ROUTES, noStore, originCheck(config.corsOrigins), limiters.admin);
  app.use("/api/auth", authRoutes({ config, prisma, auth, requireAdmin: guard, limiters }));
  // Every admin route sits behind the guard, so a new one can't accidentally be public.
  app.use("/api/admin", guard);
  app.use("/api/admin", adminRoutes());
  app.use("/api/admin/media", mediaRoutes({ config, prisma, storage: storage ?? createMediaStorage(config) }));
  app.use("/api/admin/projects", adminProjectRoutes({ config, prisma }));
  app.use("/api/admin/pages", adminPageRoutes({ config, prisma }));
  app.use("/api/admin/services", adminServiceRoutes({ config, prisma }));
  app.use("/api/admin/team", adminTeamRoutes({ config, prisma }));
  app.use("/api/admin/testimonials", adminTestimonialRoutes({ prisma }));
  app.use("/api/admin/slides", adminSlideRoutes({ config, prisma }));
  app.use("/api/admin/navigation", adminNavigationRoutes({ prisma }));
  app.use("/api/admin/settings", adminSettingsRoutes({ config, prisma }));
  app.use("/api/admin/inquiries", adminInquiryRoutes({ prisma }));
  app.use("/api/admin/redirects", adminRedirectRoutes({ prisma }));
  app.use("/api/admin/notifications", notificationRoutes({ prisma }));
  app.use("/api/admin/activity", activityRoutes({ prisma }));
  app.use("/api/admin/dashboard", dashboardRoutes({ prisma, clock }));
  app.use("/api/admin/search", searchRoutes({ prisma }));

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
