import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn, testClock } from "../../helpers/auth.js";
import { api } from "../../helpers/content.js";
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
    expect(res.body.items.map((r: { fullName: string }) => r.fullName)).toEqual(["New", "Old"]);
    expect(Object.keys(res.body.items[0]).sort()).toEqual(["createdAt", "fullName", "id", "rating", "text"]);
    expect(res.body.items[0].createdAt).toBe("2026-11-04T00:00:00.000Z");
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

    expect(res.body.items).toHaveLength(30);
    expect(res.body.items[0].fullName).toBe("Visitor 30");
    expect(res.body.items[29].fullName).toBe("Visitor 1");
  });
});

describe("admin reviews", () => {
  let cookie: string;
  beforeEach(async () => {
    await createTestAdmin(prisma);
    cookie = await signIn(app);
  });

  const seed = async () => {
    const row = (fullName: string, status: "pending" | "approved" | "rejected", day: number) => ({
      fullName,
      text: "A review text that is long enough.",
      rating: 4,
      status,
      createdAt: new Date(new Date("2026-11-01T00:00:00Z").getTime() + day * 86_400_000),
    });
    await prisma.review.createMany({
      data: [row("P1", "pending", 1), row("P2", "pending", 2), row("A1", "approved", 3), row("R1", "rejected", 4)],
    });
  };
  const first = async (fullName: string) => prisma.review.findFirstOrThrow({ where: { fullName } });

  it("lists newest first with counts, and filters by status", async () => {
    await seed();

    const all = await api(app, "get", "/api/admin/reviews", cookie);
    expect(all.status).toBe(200);
    expect(all.body.items.map((r: { fullName: string }) => r.fullName)).toEqual(["R1", "A1", "P2", "P1"]);
    expect(all.body.counts).toEqual({ all: 4, pending: 2, approved: 1, rejected: 1 });
    expect(Object.keys(all.body.items[0]).sort()).toEqual(["createdAt", "fullName", "id", "locale", "rating", "reviewedAt", "status", "text"]);
    expect(all.body.items[0].reviewedAt).toBeNull();

    const pending = await api(app, "get", "/api/admin/reviews?status=pending", cookie);
    expect(pending.body.items.map((r: { fullName: string }) => r.fullName)).toEqual(["P2", "P1"]);
    expect(pending.body.counts.all).toBe(4);
  });

  it("approving shows it publicly and hiding removes it", async () => {
    await seed();
    const p1 = await first("P1");

    const approved = await api(app, "patch", `/api/admin/reviews/${p1.id}`, cookie, { status: "approved" });
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ id: p1.id, status: "approved", reviewedAt: "2026-11-24T09:00:00.000Z" });
    const publicList = await request(app).get("/api/public/reviews");
    expect(publicList.body.items.map((r: { fullName: string }) => r.fullName)).toContain("P1");

    const hidden = await api(app, "patch", `/api/admin/reviews/${p1.id}`, cookie, { status: "rejected" });
    expect(hidden.body.status).toBe("rejected");
    expect((await request(app).get("/api/public/reviews")).body.items.map((r: { fullName: string }) => r.fullName)).not.toContain("P1");

    await api(app, "patch", `/api/admin/reviews/${p1.id}`, cookie, { status: "pending" });
    const messages = (await prisma.activityLog.findMany({ where: { kind: "review" }, orderBy: { createdAt: "asc" } })).map((a) => a.message);
    expect(messages).toEqual(["Review approved: P1", "Review hidden: P1", "Review moved back to waiting: P1"]);
    expect((await prisma.activityLog.findFirstOrThrow({ where: { kind: "review" } })).actorId).not.toBeNull();
  });

  it("deletes a review, then reports it missing", async () => {
    await seed();
    const p1 = await first("P1");

    expect((await api(app, "delete", `/api/admin/reviews/${p1.id}`, cookie)).status).toBe(204);
    const again = await api(app, "delete", `/api/admin/reviews/${p1.id}`, cookie);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe("NOT_FOUND");
    expect((await prisma.activityLog.findFirstOrThrow({ where: { message: "Review deleted: P1" } })).kind).toBe("review");
  });

  it("rejects an unknown status and an unknown id", async () => {
    await seed();
    const p1 = await first("P1");

    expect((await api(app, "patch", `/api/admin/reviews/${p1.id}`, cookie, { status: "published" })).status).toBe(400);
    const missing = await api(app, "patch", "/api/admin/reviews/6f1c1c0e-6f0e-4a55-9d58-0d9e6a0f1a11", cookie, { status: "approved" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe("That review doesn't exist.");
  });

  it("needs a session", async () => {
    expect((await request(app).get("/api/admin/reviews")).status).toBe(401);
  });
});
