import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { testClock } from "../../helpers/auth.js";
import { resetDb } from "../../helpers/db.js";

/** Visitor reviews: the public form and the public list of approved reviews. */

const clock = testClock(new Date("2026-11-24T09:00:00Z"));
const { app, db, settle, close } = buildTestApp({ clock });
const prisma = db.prisma;
afterAll(close);
afterEach(settle);
beforeEach(async () => {
  await resetDb();
});

const review = (overrides: Record<string, unknown> = {}) => ({
  fullName: "Giorgi Beridze",
  text: "They built our house on time and kept us informed.",
  rating: 5,
  locale: "en",
  website: "",
  ...overrides,
});

const submit = (body: object, target = app) => request(target).post("/api/public/reviews").set("Origin", ALLOWED_ORIGIN).send(body);

describe("POST /api/public/reviews", () => {
  it("stores a pending review and records activity", async () => {
    const res = await submit(review());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });
    expect(await prisma.review.findFirstOrThrow()).toMatchObject({ fullName: "Giorgi Beridze", rating: 5, locale: "en", status: "pending" });
    const activity = await prisma.activityLog.findMany({ where: { kind: "review" } });
    expect(activity.map((a) => a.message)).toEqual(["New review from Giorgi Beridze"]);
  });

  it("treats a filled-in honeypot as success but stores nothing", async () => {
    const res = await submit(review({ website: "http://spam.example" }));

    expect(res.status).toBe(201);
    expect(await prisma.review.count()).toBe(0);
  });

  it("rejects the submission when the spam check fails", async () => {
    const checked = buildTestApp({ spamCheck: async () => false });
    try {
      const res = await submit(review(), checked.app);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SPAM_CHECK_FAILED");
      expect(await prisma.review.count()).toBe(0);
    } finally {
      await checked.close();
    }
  });

  it.each([["5"], [4.5], [0], [6]])("rejects the rating %j", async (rating) => {
    const res = await submit(review({ rating }));

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors)).toContain("rating");
    expect(await prisma.review.count()).toBe(0);
  });

  it("rejects a blank name and a text under 20 characters", async () => {
    expect((await submit(review({ fullName: "   " }))).status).toBe(400);
    expect((await submit(review({ text: `  ${"a".repeat(19)}  ` }))).status).toBe(400);
    expect(await prisma.review.count()).toBe(0);
  });

  it("limits submissions per address", async () => {
    const limited = buildTestApp({ limits: { review: { limit: 3, windowMs: 3_600_000 } } });
    try {
      for (let i = 0; i < 3; i++) expect((await submit(review(), limited.app)).status).toBe(201);
      expect((await submit(review(), limited.app)).status).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe("GET /api/public/reviews", () => {
  it("lists only approved reviews, newest first, with only public fields", async () => {
    const base = new Date("2026-11-01T00:00:00Z").getTime();
    const row = (fullName: string, status: "pending" | "approved" | "rejected", day: number) => ({
      fullName,
      text: "A review text that is long enough.",
      rating: 4,
      status,
      createdAt: new Date(base + day * 86_400_000),
    });
    await prisma.review.createMany({
      data: [row("Old", "approved", 1), row("Waiting", "pending", 2), row("New", "approved", 3), row("Nope", "rejected", 4)],
    });

    const res = await request(app).get("/api/public/reviews");

    expect(res.status).toBe(200);
    expect(res.body.map((r: { fullName: string }) => r.fullName)).toEqual(["New", "Old"]);
    expect(Object.keys(res.body[0]).sort()).toEqual(["createdAt", "fullName", "id", "rating", "text"]);
    expect(res.body[0].createdAt).toBe("2026-11-04T00:00:00.000Z");
  });

  it("returns at most 30", async () => {
    const base = new Date("2026-10-01T00:00:00Z").getTime();
    await prisma.review.createMany({
      data: Array.from({ length: 31 }, (_, i) => ({
        fullName: `Visitor ${i}`,
        text: "A review text that is long enough.",
        rating: 5,
        status: "approved" as const,
        createdAt: new Date(base + i * 60_000),
      })),
    });

    const res = await request(app).get("/api/public/reviews");

    expect(res.body).toHaveLength(30);
    expect(res.body[0].fullName).toBe("Visitor 30");
    expect(res.body[29].fullName).toBe("Visitor 1");
  });
});
