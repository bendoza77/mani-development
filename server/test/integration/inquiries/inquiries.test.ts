import { Writable } from "node:stream";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../../../src/lib/logger.js";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn, testClock } from "../../helpers/auth.js";
import { api } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";

/** Phase 9: the contact form and the admin inbox (docs/API_CONTRACTS.md §5, §6.5). */

const clock = testClock(new Date("2026-11-21T09:00:00Z"));
const { app, db, settle, close } = buildTestApp({ clock });
const prisma = db.prisma;
afterAll(close);
afterEach(settle);

let cookie: string;
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(prisma);
  cookie = await signIn(app);
});

const inquiry = (overrides: Record<string, unknown> = {}) => ({
  name: "Natia Gogoladze",
  email: "natia@example.com",
  phone: "+995 555 21 44 10",
  subject: "Family house in Tskneti",
  message: "We own a 900 m² plot and would like a two-storey house.",
  website: "",
  ...overrides,
});

const submit = (body: object, target = app) => request(target).post("/api/public/inquiries").set("Origin", ALLOWED_ORIGIN).send(body);

describe("POST /api/public/inquiries", () => {
  it("stores the inquiry with a notification, an activity entry and a queued email, and returns no id", async () => {
    const res = await submit(inquiry());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });
    const stored = await prisma.inquiry.findFirstOrThrow();
    expect(stored).toMatchObject({ name: "Natia Gogoladze", status: "new", phone: "+995 555 21 44 10" });
    expect(await prisma.notification.count({ where: { inquiryId: stored.id, type: "NEW_INQUIRY" } })).toBe(1);
    expect((await prisma.activityLog.findMany({ where: { kind: "inquiry" } })).map((a) => a.message)).toEqual([
      "New inquiry from Natia Gogoladze",
    ]);
    const emails = await prisma.emailMessage.findMany();
    expect(emails).toEqual([expect.objectContaining({ recipient: "info@manidevelopment.ge", template: "inquiry-notification", status: "pending" })]);
  });

  it("treats a filled-in honeypot as success but stores nothing", async () => {
    const res = await submit(inquiry({ website: "http://spam.example" }));

    expect(res.status).toBe(201);
    expect(await prisma.inquiry.count()).toBe(0);
    expect(await prisma.emailMessage.count()).toBe(0);
  });

  it("validates every field with codes", async () => {
    const res = await submit(inquiry({ name: "N", email: "nope", phone: "12ab", subject: "Hi", message: "too short" }));

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["email", "message", "name", "phone", "subject"]);
    expect(await prisma.inquiry.count()).toBe(0);
  });

  it("accepts an empty phone number", async () => {
    expect((await submit(inquiry({ phone: "" }))).status).toBe(201);
    expect((await prisma.inquiry.findFirstOrThrow()).phone).toBeNull();
  });

  it("limits submissions per address", async () => {
    const limited = buildTestApp({ limits: { inquiry: { limit: 2, windowMs: 60_000 } } });
    try {
      await submit(inquiry(), limited.app);
      await submit(inquiry(), limited.app);
      expect((await submit(inquiry(), limited.app)).status).toBe(429);
    } finally {
      await limited.close();
    }
  });

  it("checks the Turnstile token when spam checking is switched on", async () => {
    const checked = buildTestApp({ spamCheck: async (token) => token === "good-token" });
    try {
      const missing = await submit(inquiry(), checked.app);
      const bad = await submit(inquiry({ turnstileToken: "bad" }), checked.app);
      const good = await submit(inquiry({ turnstileToken: "good-token" }), checked.app);

      expect(missing.status).toBe(403);
      expect(bad.body.error.code).toBe("SPAM_CHECK_FAILED");
      expect(good.status).toBe(201);
    } finally {
      await checked.close();
    }
  });

  it("never writes the visitor's message or email to the logs", async () => {
    const lines: string[] = [];
    const logger = createLogger("trace", new Writable({ write: (chunk, _enc, done) => (lines.push(String(chunk)), done()) }));
    const logged = buildTestApp({ logger });
    try {
      await submit(inquiry(), logged.app);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join("")).not.toContain("natia@example.com");
      expect(lines.join("")).not.toContain("900 m²");
    } finally {
      await logged.close();
    }
  });
});

describe("admin inbox", () => {
  async function seedInquiries() {
    await submit(inquiry({ name: "Ana", email: "ana@example.com", subject: "Villa in Kojori" }));
    clock.advance(1000);
    await submit(inquiry({ name: "Beka", email: "beka@example.com", subject: "Renovation" }));
    clock.advance(1000);
    await submit(inquiry({ name: "Ciuri", email: "ciuri@example.com", subject: "Office building" }));
  }

  it("lists newest first with counts, filters by status, searches and pages", async () => {
    await seedInquiries();
    const all = await api(app, "get", "/api/admin/inquiries", cookie);
    expect(all.body.items.map((i: { name: string }) => i.name)).toEqual(["Ciuri", "Beka", "Ana"]);
    expect(all.body).toMatchObject({ page: 1, pageSize: 20, total: 3, counts: { all: 3, new: 3, "in-progress": 0, resolved: 0 } });

    const beka = all.body.items[1];
    await api(app, "patch", `/api/admin/inquiries/${beka.id}`, cookie, { status: "in-progress" });
    const inProgress = await api(app, "get", "/api/admin/inquiries?status=in-progress", cookie);
    expect(inProgress.body.items.map((i: { name: string }) => i.name)).toEqual(["Beka"]);
    expect(inProgress.body.counts).toMatchObject({ new: 2, "in-progress": 1 });

    const search = await api(app, "get", "/api/admin/inquiries?q=KOJORI", cookie);
    expect(search.body.items.map((i: { name: string }) => i.name)).toEqual(["Ana"]);

    const page2 = await api(app, "get", "/api/admin/inquiries?page=2&pageSize=2", cookie);
    expect(page2.body.items.map((i: { name: string }) => i.name)).toEqual(["Ana"]);
  });

  it("keeps notes per inquiry and refuses another inquiry's note", async () => {
    await seedInquiries();
    const [first, second] = (await api(app, "get", "/api/admin/inquiries", cookie)).body.items;

    const note = await api(app, "post", `/api/admin/inquiries/${first.id}/notes`, cookie, { text: "Called back, site visit Monday." });
    expect(note.status).toBe(201);
    expect(note.body).toMatchObject({ text: "Called back, site visit Monday." });

    const detail = await api(app, "get", `/api/admin/inquiries/${first.id}`, cookie);
    expect(detail.body.notes.map((n: { text: string }) => n.text)).toEqual(["Called back, site visit Monday."]);
    expect(detail.body.message).toContain("900 m²");

    expect((await api(app, "delete", `/api/admin/inquiries/${second.id}/notes/${note.body.id}`, cookie)).status).toBe(404);
    expect((await api(app, "delete", `/api/admin/inquiries/${first.id}/notes/${note.body.id}`, cookie)).status).toBe(204);
  });

  it("deletes an inquiry with its notes and notification", async () => {
    await seedInquiries();
    const [first] = (await api(app, "get", "/api/admin/inquiries", cookie)).body.items;
    await api(app, "post", `/api/admin/inquiries/${first.id}/notes`, cookie, { text: "note" });

    expect((await api(app, "delete", `/api/admin/inquiries/${first.id}`, cookie)).status).toBe(204);
    expect(await prisma.inquiry.count()).toBe(2);
    expect(await prisma.notification.count()).toBe(2);
    expect(await prisma.inquiryNote.count()).toBe(0);
    expect((await api(app, "get", `/api/admin/inquiries/${first.id}`, cookie)).status).toBe(404);
  });

  it("rejects an unknown status", async () => {
    await seedInquiries();
    const [first] = (await api(app, "get", "/api/admin/inquiries", cookie)).body.items;
    expect((await api(app, "patch", `/api/admin/inquiries/${first.id}`, cookie, { status: "done" })).status).toBe(400);
  });
});

describe("notifications", () => {
  it("builds the text from the inquiry, counts unread, marks read and deletes", async () => {
    await submit(inquiry({ name: "Ana", subject: "Villa" }));
    await submit(inquiry({ name: "Beka", subject: "Renovation" }));

    const list = await api(app, "get", "/api/admin/notifications", cookie);
    expect(list.body.unread).toBe(2);
    const inquiryId = (await prisma.inquiry.findFirstOrThrow({ where: { name: "Beka" } })).id;
    expect(list.body.items[0]).toMatchObject({ title: "New inquiry", body: "Beka: Renovation", href: `/admin/inquiries?id=${inquiryId}`, read: false });

    expect((await api(app, "post", "/api/admin/notifications/read", cookie, { ids: [list.body.items[0].id] })).status).toBe(204);
    expect((await api(app, "get", "/api/admin/notifications", cookie)).body.unread).toBe(1);
    await api(app, "post", "/api/admin/notifications/read", cookie, { all: true });
    expect((await api(app, "get", "/api/admin/notifications", cookie)).body.unread).toBe(0);

    expect((await api(app, "delete", `/api/admin/notifications/${list.body.items[1].id}`, cookie)).status).toBe(204);
    expect((await api(app, "get", "/api/admin/notifications", cookie)).body.items).toHaveLength(1);
  });
});

describe("activity, dashboard and search", () => {
  it("lists recent activity without sign-in entries", async () => {
    await submit(inquiry());
    const res = await api(app, "get", "/api/admin/activity?limit=5", cookie);
    expect(res.body.items.map((a: { kind: string }) => a.kind)).toEqual(["inquiry"]);
    expect(res.body.items[0]).toEqual({ id: expect.any(String), kind: "inquiry", message: "New inquiry from Natia Gogoladze", at: expect.any(String) });
  });

  it("summarises inquiries per month over six UTC months", async () => {
    await submit(inquiry());
    await prisma.inquiry.create({ data: { name: "Sept", email: "s@example.com", subject: "September", message: "x".repeat(20), createdAt: new Date("2026-09-30T23:59:59Z") } });
    await prisma.inquiry.create({ data: { name: "Old", email: "o@example.com", subject: "Old one", message: "x".repeat(20), createdAt: new Date("2026-05-31T12:00:00Z") } });

    const res = await api(app, "get", "/api/admin/dashboard", cookie);
    expect(res.status).toBe(200);
    expect(res.body.inquiries.perMonth).toEqual([
      { month: "2026-06", count: 0 },
      { month: "2026-07", count: 0 },
      { month: "2026-08", count: 0 },
      { month: "2026-09", count: 1 },
      { month: "2026-10", count: 0 },
      { month: "2026-11", count: 1 },
    ]);
    expect(res.body.inquiries).toMatchObject({ total: 3, byStatus: { new: 3, "in-progress": 0, resolved: 0 } });
    expect(res.body.projects).toEqual({ total: 0, byStatus: { planning: 0, "in-progress": 0, completed: 0, "on-hold": 0 } });
    expect(res.body.recentInquiries).toHaveLength(3);
    expect(res.body.activity.length).toBeGreaterThan(0);
  });

  it("searches inquiries, team and services case-insensitively, at most 8 results", async () => {
    for (let i = 0; i < 10; i++) await submit(inquiry({ name: `Tamar ${i}`, subject: "House" }));
    const res = await api(app, "get", "/api/admin/search?q=tamar", cookie);
    expect(res.body.items).toHaveLength(8);
    expect(res.body.items[0]).toMatchObject({ type: "inquiry", label: expect.stringMatching(/^Tamar/), href: expect.stringMatching(/^\/admin\/inquiries\?id=/) });

    expect((await api(app, "get", "/api/admin/search?q=t", cookie)).status).toBe(400);
  });
});
