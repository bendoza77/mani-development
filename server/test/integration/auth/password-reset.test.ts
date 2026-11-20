import { createHash } from "node:crypto";
import { Writable } from "node:stream";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../../../src/lib/logger.js";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD, createTestAdmin, minutes, post, signIn, testClock } from "../../helpers/auth.js";
import { resetDb, sql } from "../../helpers/db.js";

const clock = testClock();
const { app, db, mailer, settle, close } = buildTestApp({ clock });
const prisma = db.prisma;
afterAll(close);
// Reset emails are sent after the response; let them finish so they can't spill into the next test.
afterEach(settle);
beforeEach(async () => {
  await resetDb();
  mailer.sent.length = 0;
  await createTestAdmin(prisma);
});

const NEW_PASSWORD = "Mtatsminda-at-dusk-77";
const LINK = new RegExp(`${ALLOWED_ORIGIN}/admin/reset-password#token=([A-Za-z0-9_-]{43})`);

async function requestReset(email = ADMIN_EMAIL) {
  return post(app, "/api/auth/password-reset/request", { email });
}

/** Waits for the reset email and returns the token from its link. */
async function tokenFromEmail(index = 0): Promise<string> {
  await expect.poll(() => mailer.sent.length).toBeGreaterThan(index);
  const match = LINK.exec(mailer.sent[index]!.text);
  if (!match) throw new Error(`no reset link in: ${mailer.sent[index]!.text}`);
  return match[1]!;
}

const confirm = (token: string, newPassword = NEW_PASSWORD) =>
  post(app, "/api/auth/password-reset/confirm", { token, newPassword });

describe("POST /api/auth/password-reset/request", () => {
  it("always answers 202 and emails only a registered address", async () => {
    const unknown = await requestReset("nobody@example.com");
    const known = await requestReset("DEV@manidevelopment.ge");

    expect(unknown.status).toBe(202);
    expect(known.status).toBe(202);
    await expect.poll(() => mailer.sent.map((m) => m.to)).toEqual([ADMIN_EMAIL]);
    expect(mailer.sent[0]!.subject).toBe("Reset your MANI DEVELOPMENT admin password");
  });

  it("puts the token in the link's fragment and stores only its hash", async () => {
    await requestReset();
    const token = await tokenFromEmail();

    const rows = await sql<{ token_hash: string }>("SELECT token_hash FROM password_reset_tokens");
    expect(rows).toEqual([{ token_hash: createHash("sha256").update(token).digest("hex") }]);
  });

  it("still answers 202 when the email can't be sent", async () => {
    mailer.failNext(new Error("SMTP down"));

    expect((await requestReset()).status).toBe(202);
  });

  it("rejects a malformed email with 400", async () => {
    expect((await requestReset("not-an-email")).status).toBe(400);
  });

  it("limits requests per email address", async () => {
    const limited = buildTestApp({ limits: { resetRequestPerEmail: { limit: 2, windowMs: minutes(60) } } });
    try {
      const send = (email: string) =>
        request(limited.app).post("/api/auth/password-reset/request").set("Origin", ALLOWED_ORIGIN).send({ email });
      await send(ADMIN_EMAIL);
      await send(ADMIN_EMAIL.toUpperCase());

      expect((await send(ADMIN_EMAIL)).status).toBe(429);
      expect((await send("someone-else@example.com")).status).toBe(202);
    } finally {
      await limited.close();
    }
  });
});

describe("POST /api/auth/password-reset/confirm", () => {
  it("sets the new password, ends every session and sends a notice", async () => {
    const existing = await signIn(app);
    await requestReset();
    const token = await tokenFromEmail();

    const res = await confirm(token);

    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"]).toBeUndefined(); // no automatic sign-in
    expect((await request(app).get("/api/auth/session").set("Cookie", existing)).status).toBe(401);
    expect((await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: NEW_PASSWORD })).status).toBe(200);
    expect((await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).status).toBe(401);
    await expect.poll(() => mailer.sent.map((m) => m.subject)).toContain(
      "Your MANI DEVELOPMENT admin password was changed",
    );
    const log = await prisma.activityLog.findMany({ where: { kind: "auth" } });
    expect(log.map((l) => l.message)).toContain(`Password reset by email link: ${ADMIN_EMAIL}`);
  });

  it("never writes the token or the new password to the logs", async () => {
    const lines: string[] = [];
    const logger = createLogger("trace", new Writable({ write: (chunk, _enc, done) => (lines.push(String(chunk)), done()) }));
    const logged = buildTestApp({ clock, logger });
    try {
      await post(logged.app, "/api/auth/password-reset/request", { email: ADMIN_EMAIL });
      await expect.poll(() => logged.mailer.sent.length).toBe(1);
      const token = LINK.exec(logged.mailer.sent[0]!.text)![1]!;
      await post(logged.app, "/api/auth/password-reset/confirm", { token, newPassword: NEW_PASSWORD });

      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join("")).not.toContain(token);
      expect(lines.join("")).not.toContain(NEW_PASSWORD);
    } finally {
      await logged.close();
    }
  });

  it("works only once", async () => {
    await requestReset();
    const token = await tokenFromEmail();
    await confirm(token);

    const second = await confirm(token, "Another-strong-pass-1");

    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("expires after 30 minutes", async () => {
    await requestReset();
    const token = await tokenFromEmail();

    clock.advance(minutes(30) + 1);

    expect((await confirm(token)).body.error.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("is invalidated by a newer request", async () => {
    await requestReset();
    const first = await tokenFromEmail(0);
    await requestReset();
    const second = await tokenFromEmail(1);

    expect((await confirm(first)).status).toBe(400);
    expect((await confirm(second)).status).toBe(204);
  });

  it("gives the same answer for an unknown, used or expired token", async () => {
    const res = await confirm("A".repeat(43));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "INVALID_OR_EXPIRED_TOKEN" });
  });

  it("rejects a weak password without using up the token", async () => {
    await requestReset();
    const token = await tokenFromEmail();

    const weak = await confirm(token, "short");

    expect(weak.status).toBe(400);
    expect(weak.body.error.details.fieldErrors.newPassword).toEqual([{ code: "too_short" }]);
    expect((await confirm(token)).status).toBe(204);
  });

  it("unlocks a locked account", async () => {
    await prisma.adminUser.update({
      where: { email: ADMIN_EMAIL },
      data: { failedLoginCount: 10, lockedUntil: new Date(clock.now().getTime() + minutes(15)) },
    });
    await requestReset();
    await confirm(await tokenFromEmail());

    expect((await post(app, "/api/auth/login", { email: ADMIN_EMAIL, password: NEW_PASSWORD })).status).toBe(200);
  });
});
