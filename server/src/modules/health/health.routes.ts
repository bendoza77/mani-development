import { Router } from "express";
import type { Database } from "../../lib/db.js";

/** Health endpoints (docs/API_CONTRACTS.md §3). `/ready` is Render's health check path. */
export function healthRoutes(db: Database) {
  const router = Router();

  router.get("/live", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ status: "ok" });
  });

  router.get("/ready", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await db.ping(2_000);
      res.json({ status: "ok", checks: { database: "ok" } });
    } catch (error) {
      req.log.warn({ err: error }, "readiness check failed");
      res.status(503).json({ status: "unavailable", checks: { database: "down" } });
    }
  });

  return router;
}
