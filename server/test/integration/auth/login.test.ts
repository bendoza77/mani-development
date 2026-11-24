import { argon2Sync, createHash, randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createTestAdmin,
  minutes,
  post,
  sessionCookieFrom,
  signIn,
  testClock,
} from "../../helpers/auth.js";
import { resetDb, sql } from "../../helpers/db.js";

const clock = testClock();
const { app, db, close } = buildTestApp({ clock });
const prisma = db.prisma;
afterAll(close);
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(prisma);
});

describe("POST /api/auth/login", () => {
  it("signs in and sets a host-only, Secure, HttpOnly, SameSite=Strict cookie", async () => {
    const res = await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { id: expect.any(String), name: "Site Admin", email: ADMIN_EMAIL } });
    const cookie = ([] as string[]).concat(res.headers["set-cookie"] ?? [])[0]!;
    expect(cookie).toMatch(/^__Host-sid=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).not.toMatch(/Domain=/i);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("stores only a SHA-256 hash of the session token", async () => {
    const cookie = await signIn(app);
    const token = cookie.split("=")[1]!;

    const rows = await sql<{ token_hash: string }>("SELECT token_hash FROM admin_sessions");

    expect(rows).toEqual([{ token_hash: createHash("sha256").update(token).digest("hex") }]);
  });

  it("accepts the email in any letter case", async () => {
    const res = await post(app, "/api/auth/login", { email: "DEV@ManiDevelopment.ge", password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrongPassword = await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: "not-the-password" });
    const unknownEmail = await post(app, "/api/auth/login", { email: "nobody@example.com", password: ADMIN_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
    expect({ ...wrongPassword.body.error, requestId: 0 }).toEqual({ ...unknownEmail.body.error, requestId: 0 });
    expect(sessionCookieFrom(wrongPassword)).toBeUndefined();
  });

  it("rejects a malformed body with 400", async () => {
    const res = await post(app, "/api/auth/login", { email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["email", "password"]);
  });

  it("refuses a request without an allowed Origin (CSRF protection)", async () => {
    const noOrigin = await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const otherOrigin = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(noOrigin.status).toBe(403);
    expect(otherOrigin.status).toBe(403);
    expect(otherOrigin.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("records the sign-in in the activity log", async () => {
    await signIn(app);

    const log = await prisma.activityLog.findMany({ where: { kind: "auth" } });
    expect(log.map((l) => l.message)).toEqual([`Signed in: ${ADMIN_EMAIL}`]);
  });

  it("upgrades a hash made with weaker parameters", async () => {
    // A genuine Argon2id hash with OWASP's weaker equivalent settings (9 MiB, 4 passes), made directly with Node.
    const salt = randomBytes(16);
    const key = argon2Sync("argon2id", {
      message: ADMIN_PASSWORD, nonce: salt, memory: 9216, passes: 4, parallelism: 1, tagLength: 32,
    });
    const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "");
    const weakHash = `$argon2id$v=19$m=9216,t=4,p=1$${b64(salt)}$${b64(key)}`;
    await prisma.adminUser.update({ where: { email: ADMIN_EMAIL }, data: { passwordHash: weakHash } });

    await signIn(app);

    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    expect(user.passwordHash).toContain("m=19456,t=2,p=1");
  });
});

describe("account lock after repeated failures", () => {
  it("locks the account for 15 minutes after 10 wrong passwords, with the same generic answer", async () => {
    for (let i = 0; i < 10; i++) {
      await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: `wrong-${i}` });
    }

    const whileLocked = await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(whileLocked.status).toBe(401);
    expect(whileLocked.body.error.code).toBe("INVALID_CREDENTIALS");

    const log = await prisma.activityLog.findMany({ where: { kind: "auth" } });
    expect(log.map((l) => l.message)).toContain(`Account locked after 10 failed sign-ins: ${ADMIN_EMAIL}`);

    clock.advance(minutes(15) + 1);
    const afterLock = await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(afterLock.status).toBe(200);
  });

  it("resets the failure count after a successful sign-in", async () => {
    for (let i = 0; i < 9; i++) await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: "wrong" });
    await signIn(app);
    for (let i = 0; i < 9; i++) await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: "wrong" });

    expect((await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).status).toBe(200);
  });
});

describe("per-IP rate limit on sign-in", () => {
  it("answers 429 with Retry-After once the limit is reached", async () => {
    const limited = buildTestApp({ limits: { login: { limit: 3, windowMs: minutes(15) } } });
    try {
      for (let i = 0; i < 3; i++) await post(limited.app, "/api/auth/login", { email: ADMIN_EMAIL, password: "wrong" });
      const res = await post(limited.app, "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("RATE_LIMITED");
      expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    } finally {
      await limited.close();
    }
  });
});

describe("CORS for credentialed routes", () => {
  it("allows credentials on /api/auth for an allowed origin, and not on public routes", async () => {
    const auth = await request(app)
      .options("/api/auth/login")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Access-Control-Request-Method", "POST");
    const health = await request(app).get("/api/health/live").set("Origin", ALLOWED_ORIGIN);

    expect(auth.headers["access-control-allow-credentials"]).toBe("true");
    expect(auth.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(health.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
