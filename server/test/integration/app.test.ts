import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../helpers/app.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const { app, close } = buildTestApp();
afterAll(close);

describe("GET /api/health/live", () => {
  it("answers 200 without checking dependencies", async () => {
    const res = await request(app).get("/api/health/live");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("request IDs", () => {
  it("adds a fresh X-Request-Id to every response", async () => {
    const res = await request(app).get("/api/health/live");

    expect(res.headers["x-request-id"]).toMatch(UUID);
  });

  it("ignores a client-supplied X-Request-Id", async () => {
    const res = await request(app).get("/api/health/live").set("X-Request-Id", "attacker-chosen");

    expect(res.headers["x-request-id"]).toMatch(UUID);
  });
});

describe("error envelope", () => {
  it("answers unknown routes with 404 NOT_FOUND and the request ID", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found.", requestId: res.headers["x-request-id"] },
    });
  });

  it("answers malformed JSON with 400 MALFORMED_JSON", async () => {
    const res = await request(app)
      .post("/api/does-not-exist")
      .set("Content-Type", "application/json")
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MALFORMED_JSON");
  });

  it("answers a body over 100 kB with 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await request(app)
      .post("/api/does-not-exist")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ text: "x".repeat(101 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("answers a non-JSON body on an unsafe method with 415 UNSUPPORTED_MEDIA_TYPE", async () => {
    const res = await request(app).post("/api/does-not-exist").set("Content-Type", "text/plain").send("hello");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("lets an unsafe method without a body through to routing", async () => {
    const res = await request(app).delete("/api/does-not-exist");

    expect(res.status).toBe(404);
  });
});

describe("security headers", () => {
  it("sets helmet's headers and hides the framework", async () => {
    const res = await request(app).get("/api/health/live");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("echoes an allowed origin", async () => {
    const res = await request(app).get("/api/health/live").set("Origin", ALLOWED_ORIGIN);

    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("gives no CORS header to other origins", async () => {
    const res = await request(app).get("/api/health/live").set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers a preflight from an allowed origin", async () => {
    const res = await request(app)
      .options("/api/health/live")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });
});
