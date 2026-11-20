import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/lib/errors.js";
import { createLogger } from "../../src/lib/logger.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";

/**
 * The real request-context and error middleware around routes that fail on purpose.
 * The routes live here, in the test, so production code has no test-only endpoints.
 */
function appWithFailingRoutes() {
  const logger = createLogger("silent");
  const app = express();
  app.use(requestContext(logger));

  app.get("/async-crash", async () => {
    await Promise.resolve();
    throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");
  });
  app.get("/sync-crash", () => {
    throw new TypeError("Cannot read properties of undefined (reading 'id')");
  });
  app.get("/conflict", () => {
    throw new AppError(409, "SLUG_TAKEN", "Another project already uses this URL.");
  });
  app.get("/zod", () => {
    z.object({ title: z.string().min(3) }).parse({ title: "ab" });
  });

  app.use(errorHandler(logger));
  return app;
}

const app = appWithFailingRoutes();

describe("errorHandler", () => {
  it.each(["/async-crash", "/sync-crash"])("turns an unexpected error at %s into a generic 500", async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL", message: "An unexpected error occurred.", requestId: res.headers["x-request-id"] },
    });
  });

  it("never leaks the original message or a stack trace", async () => {
    const res = await request(app).get("/async-crash");

    expect(res.text).not.toContain("ECONNREFUSED");
    expect(res.text).not.toContain("hunter2");
    expect(res.text).not.toMatch(/\bat .+\(.+:\d+:\d+\)/);
  });

  it("passes an AppError through with its status, code and message", async () => {
    const res = await request(app).get("/conflict");

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "SLUG_TAKEN", message: "Another project already uses this URL." });
  });

  it("turns a thrown ZodError into 400 VALIDATION_FAILED with field codes", async () => {
    const res = await request(app).get("/zod");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details).toEqual({ fieldErrors: { title: [{ code: "too_small", minimum: 3 }] } });
  });
});
