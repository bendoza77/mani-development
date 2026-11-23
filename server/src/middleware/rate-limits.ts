import type { NextFunction, Request, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "../lib/errors.js";

/**
 * Request limits (docs/SECURITY_PLAN.md §3 and §9). Counts are kept in memory, which is right for
 * a single Render instance; a second instance would need a shared store.
 */
export type Limit = { limit: number; windowMs: number };

export type RateLimits = {
  /** Failed sign-ins per IP. Successful ones don't count, so the admin can't lock themselves out. */
  login: Limit;
  resetRequestPerIp: Limit;
  resetRequestPerEmail: Limit;
  resetConfirm: Limit;
  /** Everything else under /api/auth and /api/admin, per IP. */
  admin: Limit;
  /** Contact-form submissions per IP: per hour and per day (SECURITY_PLAN §9). */
  inquiry: Limit;
  inquiryDaily: Limit;
};

const MINUTE = 60_000;

export const DEFAULT_RATE_LIMITS: RateLimits = {
  login: { limit: 10, windowMs: 15 * MINUTE },
  resetRequestPerIp: { limit: 3, windowMs: 60 * MINUTE },
  resetRequestPerEmail: { limit: 3, windowMs: 60 * MINUTE },
  resetConfirm: { limit: 10, windowMs: 60 * MINUTE },
  admin: { limit: 600, windowMs: 15 * MINUTE },
  inquiry: { limit: 5, windowMs: 60 * MINUTE },
  inquiryDaily: { limit: 20, windowMs: 24 * 60 * MINUTE },
};

const tooManyRequests = (_req: Request, _res: Response, next: NextFunction) =>
  next(new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later."));

function limiter({ limit, windowMs }: Limit, extra: Parameters<typeof rateLimit>[0] = {}): RequestHandler {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooManyRequests,
    ...extra,
  });
}

/** Lower-cased email from a JSON body, or undefined when there is none. */
function emailFromBody(req: Request): string | undefined {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : undefined;
}

export function createRateLimiters(limits: RateLimits) {
  return {
    login: limiter(limits.login, { skipSuccessfulRequests: true }),
    resetRequestPerIp: limiter(limits.resetRequestPerIp),
    resetRequestPerEmail: limiter(limits.resetRequestPerEmail, {
      // Malformed bodies have no email; validation rejects them next.
      skip: (req) => emailFromBody(req) === undefined,
      keyGenerator: (req) => `email:${emailFromBody(req)}`,
    }),
    resetConfirm: limiter(limits.resetConfirm),
    admin: limiter(limits.admin),
    inquiry: limiter(limits.inquiry),
    inquiryDaily: limiter(limits.inquiryDaily),
  };
}
