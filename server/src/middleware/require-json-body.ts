import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasBody(req: Request): boolean {
  const length = req.headers["content-length"];
  return req.headers["transfer-encoding"] !== undefined || (length !== undefined && length !== "0");
}

/**
 * The API only accepts JSON bodies. A body of any other type on an unsafe method is refused
 * with 415 instead of being silently ignored (docs/SECURITY_PLAN.md §5).
 */
/** The one route that takes raw image bytes: the local photo storage's upload URL. */
const RAW_UPLOAD = /^\/api\/admin\/media\/[^/]+\/file$/;

export function requireJsonBody(req: Request, _res: Response, next: NextFunction) {
  if (UNSAFE_METHODS.has(req.method) && hasBody(req) && !req.is("application/json") && !RAW_UPLOAD.test(req.path)) {
    next(new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Request bodies must be JSON."));
    return;
  }
  next();
}
