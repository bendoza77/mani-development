import { Router } from "express";

/**
 * Admin API. Mounted behind requireAdmin in app.ts, so nothing here can be reached without a
 * session (proved by test/security/route-walker.test.ts).
 */
export function adminRoutes() {
  const router = Router();

  // Placeholder until the first real admin endpoints arrive in Phase 5.
  router.get("/ping", (req, res) => {
    res.json({ user: req.session!.user });
  });

  return router;
}
