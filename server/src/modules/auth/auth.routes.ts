import { Router, type RequestHandler } from "express";
import type { Config } from "../../config/env.js";
import { parse } from "../../lib/validate.js";
import type { createRateLimiters } from "../../middleware/rate-limits.js";
import type { AuthService } from "./auth.service.js";
import { changePasswordBody, loginBody, resetConfirmBody, resetRequestBody } from "./auth.schemas.js";
import { clearSessionCookie, readCookie, setSessionCookie } from "./cookies.js";
import { deleteSessionByToken } from "./session.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

type Deps = {
  config: Config;
  prisma: PrismaClient;
  auth: AuthService;
  requireAdmin: RequestHandler;
  limiters: ReturnType<typeof createRateLimiters>;
};

/** /api/auth (docs/API_CONTRACTS.md §4). Origin check, CORS and no-store are applied in app.ts. */
export function authRoutes({ config, prisma, auth, requireAdmin, limiters }: Deps) {
  const router = Router();

  router.post("/login", limiters.login, async (req, res) => {
    const body = parse(loginBody, req.body);
    const result = await auth.login({ ...body, userAgent: req.get("user-agent") });
    setSessionCookie(res, config, result.token, result.expiresAt, result.now);
    res.json({ user: result.user });
  });

  router.post("/logout", async (req, res) => {
    const token = readCookie(req, config.sessionCookie.name);
    if (token) await deleteSessionByToken(prisma, token);
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  router.get("/session", requireAdmin, (req, res) => {
    res.json({ user: req.session!.user });
  });

  // Wrong current passwords count toward the same per-IP limit as failed sign-ins.
  router.post("/password", requireAdmin, limiters.login, async (req, res) => {
    const body = parse(changePasswordBody, req.body);
    const result = await auth.changePassword({ ...body, user: req.session!.user, userAgent: req.get("user-agent") });
    setSessionCookie(res, config, result.token, result.expiresAt, result.now);
    res.status(204).end();
  });

  router.post("/password-reset/request", limiters.resetRequestPerIp, limiters.resetRequestPerEmail, (req, res) => {
    const { email } = parse(resetRequestBody, req.body);
    // Always 202, and the lookup runs in the background, so neither the answer nor its timing
    // reveals whether the account exists.
    auth.requestPasswordReset(email);
    res.status(202).end();
  });

  router.post("/password-reset/confirm", limiters.resetConfirm, async (req, res) => {
    const body = parse(resetConfirmBody, req.body);
    await auth.confirmPasswordReset(body);
    res.status(204).end();
  });

  return router;
}
