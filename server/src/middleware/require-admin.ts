import type { NextFunction, Request, Response } from "express";
import type { Config } from "../config/env.js";
import type { Clock } from "../lib/clock.js";
import { AppError } from "../lib/errors.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { readCookie } from "../modules/auth/cookies.js";
import { findSession } from "../modules/auth/session.js";

export const unauthenticated = () => new AppError(401, "UNAUTHENTICATED", "Please sign in.");

/** Lets the request through only with a live admin session, which it puts on `req.session`. */
export function requireAdmin({ config, prisma, clock }: { config: Config; prisma: PrismaClient; clock: Clock }) {
  const settings = { idleMinutes: config.sessionIdleMinutes, maxDays: config.sessionMaxDays };
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = readCookie(req, config.sessionCookie.name);
    const session = token ? await findSession(prisma, token, clock.now(), settings) : null;
    if (!session) throw unauthenticated();
    req.session = session;
    next();
  };
}
