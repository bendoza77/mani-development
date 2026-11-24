import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../helpers/app.js";
import { ADMIN_EMAIL, createTestAdmin, signIn } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

/**
 * Proves every admin route needs a session (docs/SECURITY_PLAN.md §4). It reads Express's own route
 * table, so a route added later is checked without anyone remembering to add a test for it.
 */

type Layer = {
  rawPath?: unknown;
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
};

function listRoutes(stack: Layer[], prefix = ""): { method: string; path: string }[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      return Object.keys(layer.route.methods).map((method) => ({ method, path: prefix + layer.route!.path }));
    }
    if (layer.handle?.stack) {
      const mount = typeof layer.rawPath === "string" && layer.rawPath !== "/" ? layer.rawPath : "";
      return listRoutes(layer.handle.stack, prefix + mount);
    }
    return [];
  });
}

const routesOf = (app: Express) => listRoutes((app as unknown as { router: { stack: Layer[] } }).router.stack);
const adminRoutesOf = (app: Express) => routesOf(app).filter((r) => r.path.startsWith("/api/admin"));

const { app, db, close } = buildTestApp();
afterAll(close);
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(db.prisma);
});

describe("admin routes", () => {
  it("are found by the route walker (it would pass vacuously otherwise)", () => {
    expect(adminRoutesOf(app)).toContainEqual({ method: "get", path: "/api/admin/ping" });
    expect(routesOf(app)).toContainEqual({ method: "get", path: "/api/auth/session" });
  });

  it("all answer 401 without a session", async () => {
    for (const { method, path } of adminRoutesOf(app)) {
      const url = path.replace(/:\w+/g, "00000000-0000-7000-8000-000000000000");
      const agent = request(app);
      const res = await agent[method as "get"](url)
        .set("Origin", ALLOWED_ORIGIN)
        .set("Content-Type", "application/json")
        .send(method === "get" || method === "head" ? undefined : "{}");

      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  });

  it("answer 401 for unknown admin paths too, so they don't reveal which routes exist", async () => {
    const res = await request(app).get("/api/admin/does-not-exist");

    expect(res.status).toBe(401);
  });

  it("refuse unsafe requests from a foreign origin before checking the session", async () => {
    const res = await request(app).post("/api/admin/ping").set("Origin", "https://evil.example").send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("let a signed-in admin through, with no-store caching", async () => {
    const cookie = await signIn(app);

    const res = await request(app).get("/api/admin/ping").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: ADMIN_EMAIL });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
