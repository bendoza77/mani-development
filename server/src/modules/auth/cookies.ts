import type { CookieOptions, Request, Response } from "express";
import type { Config } from "../../config/env.js";

/** Reads one cookie from the Cookie header. Returns undefined for a missing or undecodable value. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Host-only (no Domain), Path=/, HttpOnly, SameSite=Strict, and Secure everywhere but local
 * development, as the `__Host-` prefix requires (docs/SECURITY_PLAN.md §2).
 */
function baseOptions(config: Config): CookieOptions {
  return { httpOnly: true, secure: config.sessionCookie.secure, sameSite: "strict", path: "/" };
}

export function setSessionCookie(res: Response, config: Config, token: string, expiresAt: Date, now: Date) {
  res.cookie(config.sessionCookie.name, token, {
    ...baseOptions(config),
    maxAge: Math.max(0, expiresAt.getTime() - now.getTime()),
  });
}

export function clearSessionCookie(res: Response, config: Config) {
  res.clearCookie(config.sessionCookie.name, baseOptions(config));
}
