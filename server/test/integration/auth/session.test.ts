import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/app.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createTestAdmin,
  days,
  minutes,
  post,
  sessionCookieFrom,
  signIn,
  testClock,
} from "../../helpers/auth.js";
import { resetDb } from "../../helpers/db.js";

const clock = testClock();
const { app, db, mailer, settle, close } = buildTestApp({ clock });
const prisma = db.prisma;
afterAll(close);
afterEach(settle);
beforeEach(async () => {
  await resetDb();
  mailer.sent.length = 0;
  await createTestAdmin(prisma);
});

const session = (cookie?: string) => {
  const req = request(app).get("/api/auth/session");
  return cookie ? req.set("Cookie", cookie) : req;
};

describe("GET /api/auth/session", () => {
  it("returns the signed-in admin", async () => {
    const cookie = await signIn(app);
    const res = await session(cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: "Site Admin", email: ADMIN_EMAIL });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it.each([
    ["no cookie", undefined],
    ["an unknown token", "__Host-sid=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    ["a malformed cookie", "__Host-sid=%%%"],
  ])("answers 401 UNAUTHENTICATED with %s", async (_label, cookie) => {
    const res = await session(cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("session lifetime", () => {
  it("ends after 12 hours without activity", async () => {
    const cookie = await signIn(app);

    clock.advance(minutes(12 * 60) + 1);

    expect((await session(cookie)).status).toBe(401);
  });

  it("stays alive while used, until the 7-day maximum", async () => {
    const cookie = await signIn(app);

    for (let elapsed = 0; elapsed < days(7) - minutes(11 * 60); elapsed += minutes(11 * 60)) {
      clock.advance(minutes(11 * 60));
      expect((await session(cookie)).status).toBe(200);
    }
    clock.advance(minutes(11 * 60));

    expect((await session(cookie)).status).toBe(401);
  });

  it("records activity at most once every 5 minutes", async () => {
    const cookie = await signIn(app);
    const lastSeen = async () => (await prisma.adminSession.findFirstOrThrow()).lastSeenAt.getTime();
    const first = await lastSeen();

    clock.advance(minutes(2));
    await session(cookie);
    expect(await lastSeen()).toBe(first);

    clock.advance(minutes(4));
    await session(cookie);
    expect(await lastSeen()).toBe(first + minutes(6));
  });
});

describe("POST /api/auth/logout", () => {
  it("ends the session on the server and clears the cookie", async () => {
    const cookie = await signIn(app);

    const res = await post(app, "/api/auth/logout", {}, cookie);

    expect(res.status).toBe(204);
    const cleared = ([] as string[]).concat(res.headers["set-cookie"] ?? [])[0];
    expect(cleared).toMatch(/^__Host-sid=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await prisma.adminSession.count()).toBe(0);
    expect((await session(cookie)).status).toBe(401);
  });

  it("answers 204 even without a session", async () => {
    expect((await post(app, "/api/auth/logout")).status).toBe(204);
  });
});

describe("POST /api/auth/password", () => {
  const NEW_PASSWORD = "Mtatsminda-at-dusk-77";

  it("changes the password, ends other sessions and keeps this one signed in", async () => {
    const other = await signIn(app);
    const current = await signIn(app);

    const res = await post(app, "/api/auth/password", { currentPassword: ADMIN_PASSWORD, newPassword: NEW_PASSWORD }, current);

    expect(res.status).toBe(204);
    const renewed = sessionCookieFrom(res)!;
    expect(renewed).toBeDefined();
    expect((await session(other)).status).toBe(401);
    expect((await session(current)).status).toBe(401);
    expect((await session(renewed)).status).toBe(200);
    expect((await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: NEW_PASSWORD })).status).toBe(200);
    expect((await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).status).toBe(401);
    const log = await prisma.activityLog.findMany({ where: { kind: "auth" } });
    expect(log.map((l) => l.message)).toContain(`Password changed: ${ADMIN_EMAIL}`);
  });

  it("sends a 'password changed' notice to the admin", async () => {
    const cookie = await signIn(app);

    await post(app, "/api/auth/password", { currentPassword: ADMIN_PASSWORD, newPassword: NEW_PASSWORD }, cookie);

    await settle();
    expect(mailer.sent.map((m) => [m.to, m.subject])).toEqual([
      [ADMIN_EMAIL, "Your MANI DEVELOPMENT admin password was changed"],
    ]);
  });

  it("rejects a wrong current password with 401", async () => {
    const cookie = await signIn(app);
    const res = await post(app, "/api/auth/password", { currentPassword: "nope-nope-nope", newPassword: NEW_PASSWORD }, cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a weak new password with field codes", async () => {
    const cookie = await signIn(app);
    const res = await post(app, "/api/auth/password", { currentPassword: ADMIN_PASSWORD, newPassword: "short" }, cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.newPassword).toEqual([{ code: "too_short" }]);
  });

  it("requires a session", async () => {
    const res = await post(app, "/api/auth/password", { currentPassword: ADMIN_PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(401);
  });
});
