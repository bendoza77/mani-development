import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection for cookie-authenticated routes (docs/SECURITY_PLAN.md §5): a state-changing
 * request must come from one of our own origins. This also blocks sibling sub-domains, which
 * count as "same-site" for the SameSite cookie rule.
 */
export function originCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get("origin");
    if (origin !== undefined && allowed.has(origin)) return next();
    next(new AppError(403, "ORIGIN_NOT_ALLOWED", "This request must come from the website."));
  };
}
