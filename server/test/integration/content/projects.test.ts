import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn } from "../../helpers/auth.js";
import { projectInput, uploadImage } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";

const { app, db, close } = buildTestApp();
afterAll(close);
let cookie: string;
let coverId: string;
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(db.prisma);
  cookie = await signIn(app);
  coverId = (await uploadImage(app, cookie)).id;
});

const send = (method: "post" | "put", path: string, body: object) =>
  request(app)[method](path).set("Origin", "https://www.example.test").set("Cookie", cookie).send(body);

describe("admin projects", () => {
  it("creates a project with cover, gallery and specs, and lists it", async () => {
    const gallery = await uploadImage(app, cookie, "inside.png");
    const res = await send("post", "/api/admin/projects", projectInput(coverId, { galleryIds: [gallery.id] }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      slug: "vake-house",
      titleKa: "ვაკის სახლი",
      summaryEn: null,
      status: "in-progress",
      cover: { id: coverId, width: 1600 },
      gallery: [{ id: gallery.id }],
      specs: [{ labelKa: "ფართი", labelEn: "Area", valueKa: "240 მ²", valueEn: null }],
      isPublished: true,
      publishedAt: expect.any(String),
    });
    const list = await request(app).get("/api/admin/projects").set("Cookie", cookie);
    expect(list.body.items).toHaveLength(1);
  });

  it("updates a project, replacing its gallery", async () => {
    const extra = await uploadImage(app, cookie, "a.png");
    const created = await send("post", "/api/admin/projects", projectInput(coverId, { galleryIds: [extra.id] }));

    const res = await send("put", `/api/admin/projects/${created.body.id}`, projectInput(coverId, { titleKa: "ახალი", galleryIds: [] }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ titleKa: "ახალი", gallery: [] });
  });

  it("refuses a used web address, impossible dates and missing photos", async () => {
    await send("post", "/api/admin/projects", projectInput(coverId));

    const taken = await send("post", "/api/admin/projects", projectInput(coverId));
    const dates = await send("post", "/api/admin/projects", projectInput(coverId, { slug: "b", estimatedCompletion: "2025-01-01" }));
    const done = await send("post", "/api/admin/projects", projectInput(coverId, { slug: "c", status: "completed" }));
    const photo = await send("post", "/api/admin/projects", projectInput("00000000-0000-7000-8000-000000000000", { slug: "d" }));

    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("SLUG_TAKEN");
    expect(dates.body.error.details.fieldErrors.estimatedCompletion).toEqual([{ code: "before_start" }]);
    expect(Object.keys(done.body.error.details.fieldErrors).sort()).toEqual(["completionDate", "progress"]);
    expect(photo.status).toBe(422);
  });

  it("reorders projects and lists them in that order, putting a new project last", async () => {
    const ids: Record<string, string> = {};
    for (const slug of ["a", "b", "c"]) ids[slug] = (await send("post", "/api/admin/projects", projectInput(coverId, { slug }))).body.id;

    const res = await send("put", "/api/admin/projects/order", { ids: [ids.c, ids.a, ids.b] });
    await send("post", "/api/admin/projects", projectInput(coverId, { slug: "d" }));

    const slugs = (body: { items: { slug: string }[] }) => body.items.map((p) => p.slug);
    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(["c", "a", "b"]);
    expect(slugs((await request(app).get("/api/admin/projects").set("Cookie", cookie)).body)).toEqual(["c", "a", "b", "d"]);
    expect(slugs((await request(app).get("/api/public/projects?locale=ka")).body)).toEqual(["c", "a", "b", "d"]);
  });

  it("refuses an order that misses or repeats a project", async () => {
    const a = (await send("post", "/api/admin/projects", projectInput(coverId, { slug: "a" }))).body.id;
    const b = (await send("post", "/api/admin/projects", projectInput(coverId, { slug: "b" }))).body.id;

    const missing = await send("put", "/api/admin/projects/order", { ids: [a] });
    const repeated = await send("put", "/api/admin/projects/order", { ids: [a, a] });

    expect(missing.status).toBe(400);
    expect(repeated.status).toBe(400);
    const list = await request(app).get("/api/admin/projects").set("Cookie", cookie);
    expect(list.body.items.map((p: { id: string }) => p.id)).toEqual([a, b]);
  });

  it("deletes a project", async () => {
    const created = await send("post", "/api/admin/projects", projectInput(coverId));

    const res = await request(app)
      .delete(`/api/admin/projects/${created.body.id}`)
      .set("Origin", "https://www.example.test")
      .set("Cookie", cookie);

    expect(res.status).toBe(204);
    expect(await db.prisma.project.count()).toBe(0);
  });
});

describe("public projects", () => {
  it("shows only published projects, in the requested language with Georgian fallback", async () => {
    await send("post", "/api/admin/projects", projectInput(coverId));
    await send("post", "/api/admin/projects", projectInput(coverId, { slug: "draft", isPublished: false }));

    const en = await request(app).get("/api/public/projects?locale=en");
    const detail = await request(app).get("/api/public/projects/vake-house?locale=en");
    const draft = await request(app).get("/api/public/projects/draft");

    expect(en.body.items.map((p: { slug: string }) => p.slug)).toEqual(["vake-house"]);
    expect(en.body.items[0]).toMatchObject({ title: "Vake House", summary: "ორსართულიანი სახლი", city: "Tbilisi" });
    expect(detail.body).toMatchObject({ description: "აღწერა", specs: [{ label: "Area", value: "240 მ²" }] });
    expect(en.body.items[0]).not.toHaveProperty("isPublished");
    expect(draft.status).toBe(404);
  });

  it("lists cards with the cover only, while the detail keeps the gallery and specs", async () => {
    const galleryId = (await uploadImage(app, cookie)).id;
    await send("post", "/api/admin/projects", projectInput(coverId, { galleryIds: [galleryId] }));

    const list = await request(app).get("/api/public/projects?locale=ka");
    const detail = await request(app).get("/api/public/projects/vake-house?locale=ka");

    expect(Object.keys(list.body.items[0]).sort()).toEqual(
      ["category", "city", "completionDate", "cover", "estimatedCompletion", "featured", "id", "location", "progress", "slug", "startDate", "status", "summary", "title", "updatedAt"],
    );
    expect(list.body.items[0].cover).toMatchObject({ id: coverId });
    expect(detail.body.gallery.map((g: { id: string }) => g.id)).toEqual([galleryId]);
    expect(detail.body.specs).toHaveLength(1);
  });
});
