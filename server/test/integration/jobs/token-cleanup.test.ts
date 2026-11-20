import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupExpiredTokens, startTokenCleanup } from "../../../src/jobs/token-cleanup.js";
import { createDatabase } from "../../../src/lib/db.js";
import { createLogger } from "../../../src/lib/logger.js";
import { createTestAdmin, days, minutes } from "../../helpers/auth.js";
import { testConfig } from "../../helpers/app.js";
import { resetDb } from "../../helpers/db.js";

const db = createDatabase(testConfig().databaseUrl);
const prisma = db.prisma;
afterAll(() => db.disconnect());

const NOW = new Date("2026-11-21T12:00:00Z");
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);
const IDLE_MINUTES = 720;

let userId: string;
let counter = 0;
const hash = () => (counter++).toString(16).padStart(64, "0");

beforeEach(async () => {
  await resetDb();
  userId = (await createTestAdmin(prisma)).id;
});

const addSession = (label: string, lastSeenAt: Date, expiresAt: Date) =>
  prisma.adminSession.create({ data: { userId, tokenHash: hash(), lastSeenAt, expiresAt, userAgent: label } });

const addResetToken = (expiresAt: Date, usedAt: Date | null = null) =>
  prisma.passwordResetToken.create({ data: { userId, tokenHash: hash(), expiresAt, usedAt } });

const addPreviewToken = (expiresAt: Date) =>
  prisma.previewToken.create({ data: { tokenHash: hash(), targetType: "page", targetId: randomUUID(), expiresAt } });

describe("cleanupExpiredTokens", () => {
  it("deletes sessions past their absolute or idle limit and keeps live ones", async () => {
    await addSession("live", at(-minutes(5)), at(days(6)));
    await addSession("absolute-expired", at(-minutes(5)), at(-1));
    await addSession("idle-expired", at(-minutes(IDLE_MINUTES) - 1), at(days(6)));

    const result = await cleanupExpiredTokens(prisma, { now: NOW, sessionIdleMinutes: IDLE_MINUTES });

    expect(result.sessions).toBe(2);
    expect((await prisma.adminSession.findMany()).map((s) => s.userAgent)).toEqual(["live"]);
  });

  it("deletes expired or used reset tokens and expired preview tokens", async () => {
    const liveReset = await addResetToken(at(minutes(10)));
    await addResetToken(at(-1));
    await addResetToken(at(minutes(10)), at(-minutes(1)));
    const livePreview = await addPreviewToken(at(minutes(10)));
    await addPreviewToken(at(-1));

    const result = await cleanupExpiredTokens(prisma, { now: NOW, sessionIdleMinutes: IDLE_MINUTES });

    expect(result).toMatchObject({ resetTokens: 2, previewTokens: 1 });
    expect((await prisma.passwordResetToken.findMany()).map((t) => t.id)).toEqual([liveReset.id]);
    expect((await prisma.previewToken.findMany()).map((t) => t.id)).toEqual([livePreview.id]);
  });
});

describe("startTokenCleanup", () => {
  const addExpired = () => addSession("expired", new Date(Date.now() - minutes(5)), new Date(Date.now() - 1));

  it("runs at start and then on an interval, until stopped", async () => {
    await addExpired();
    const stop = startTokenCleanup({
      prisma,
      logger: createLogger("silent"),
      clock: { now: () => new Date() },
      sessionIdleMinutes: IDLE_MINUTES,
      intervalMs: 50,
    });
    try {
      await expect.poll(() => prisma.adminSession.count()).toBe(0);
      await addExpired();
      await expect.poll(() => prisma.adminSession.count()).toBe(0);
    } finally {
      stop();
    }

    await addExpired();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await prisma.adminSession.count()).toBe(1);
  });
});
