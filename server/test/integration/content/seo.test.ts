import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn } from "../../helpers/auth.js";
import { api, projectInput, uploadImage } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";

/** SEO fields on projects and pages (API_CONTRACTS §8.2) and the projects quick-edit PATCH (§6.1). */

const { app, db, settle, close } = buildTestApp();
const prisma = db.prisma;
afterAll(close);
afterEach(settle);

let cookie: string;
let imageId: string;
let shareImageId: string;
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(prisma);
  cookie = await signIn(app);
  imageId = (await uploadImage(app, cookie)).id;
  shareImageId = (await uploadImage(app, cookie, "share.png")).id;
});

const seo = {
  titleKa: "ვაკის სახლი — MANI",
  titleEn: "Vake House — MANI",
  descriptionKa: "ორსართულიანი სახლი ვაკეში.",
  descriptionEn: null,
  ogImageId: null as string | null,
  robotsIndex: true,
  robotsFollow: true,
};

describe("project SEO", () => {
  it("falls back to the project's own title, summary and cover when nothing is set", async () => {
    await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId));

    const res = await request(app).get("/api/public/projects/vake-house?locale=en");

    expect(res.body.seo).toEqual({
      title: "Vake House",
      description: expect.stringMatching(/\S/),
      image: expect.objectContaining({ id: imageId }),
      index: true,
      follow: true,
    });
  });

  it("saves overrides, returns them to the admin and uses them publicly", async () => {
    const created = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { seo: { ...seo, ogImageId: shareImageId, robotsIndex: false } }));
    expect(created.status).toBe(201);
    expect(created.body.seo).toEqual({ ...seo, ogImageId: shareImageId, robotsIndex: false });

    const en = (await request(app).get("/api/public/projects/vake-house?locale=en")).body.seo;
    expect(en).toEqual({
      title: "Vake House — MANI",
      description: "ორსართულიანი სახლი ვაკეში.",
      image: expect.objectContaining({ id: shareImageId }),
      index: false,
      follow: true,
    });
  });

  it("rejects too-long titles and an unknown share image", async () => {
    const long = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { seo: { ...seo, titleKa: "x".repeat(71) } }));
    expect(long.status).toBe(400);
    expect(long.body.error.details.fieldErrors["seo.titleKa"]).toBeDefined();

    const missing = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { seo: { ...seo, ogImageId: "0196a1b2-0000-7000-8000-000000000000" } }));
    expect(missing.status).toBe(422);
  });

  it("keeps existing SEO when an update leaves it out", async () => {
    const created = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { seo }));
    await api(app, "put", `/api/admin/projects/${created.body.id}`, cookie, projectInput(imageId, { titleEn: "Renamed" }));

    const after = await api(app, "get", `/api/admin/projects/${created.body.id}`, cookie);
    expect(after.body.seo.titleEn).toBe("Vake House — MANI");
  });
});

describe("page SEO", () => {
  it("saves overrides on a page and falls back to the settings description", async () => {
    const page = await api(app, "post", "/api/admin/pages", cookie, {
      slug: "careers", titleKa: "ვაკანსიები", introKa: "", isPublished: true, blocks: [],
    });
    const plain = (await request(app).get("/api/public/pages/careers")).body.seo;
    expect(plain).toMatchObject({ title: "ვაკანსიები", index: true, image: null });

    await api(app, "put", `/api/admin/pages/${page.body.id}`, cookie, {
      slug: "careers", titleKa: "ვაკანსიები", introKa: "", isPublished: true, blocks: [], seo: { ...seo, robotsFollow: false },
    });
    const saved = (await request(app).get("/api/public/pages/careers")).body.seo;
    expect(saved).toMatchObject({ title: "ვაკის სახლი — MANI", description: "ორსართულიანი სახლი ვაკეში.", follow: false });
  });
});

describe("PATCH /api/admin/projects/:id", () => {
  it("changes status, progress, featured or publishing alone", async () => {
    const created = (await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { isPublished: false }))).body;

    const featured = await api(app, "patch", `/api/admin/projects/${created.id}`, cookie, { featured: true, isPublished: true });
    expect(featured.body).toMatchObject({ featured: true, isPublished: true, publishedAt: expect.any(String) });
    expect((await request(app).get("/api/public/projects/vake-house")).status).toBe(200);

    const done = await api(app, "patch", `/api/admin/projects/${created.id}`, cookie, { status: "completed" });
    expect(done.body).toMatchObject({ status: "completed", progress: 100, completionDate: expect.any(String) });
  });

  it("refuses an empty body and unknown fields", async () => {
    const created = (await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId))).body;
    expect((await api(app, "patch", `/api/admin/projects/${created.id}`, cookie, {})).status).toBe(400);
    expect((await api(app, "patch", `/api/admin/projects/${created.id}`, cookie, { slug: "x" })).status).toBe(400);
  });
});
