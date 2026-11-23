import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, post, signIn } from "../../helpers/auth.js";
import { api, PNG, projectInput, uploadImage } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";

const { app, db, close } = buildTestApp();
afterAll(close);
let cookie: string;
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(db.prisma);
  cookie = await signIn(app);
});

describe("photo upload (local storage)", () => {
  it("uploads, marks ready, lists and serves the photo to other sites", async () => {
    const image = await uploadImage(app, cookie);

    const list = await request(app).get("/api/admin/media").set("Cookie", cookie);
    expect(list.body.items).toMatchObject([{ id: image.id, width: 1600, height: 900, filename: "house.png", bytes: PNG.length }]);

    const file = await request(app).get(new URL(image.src).pathname);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/png");
    expect(file.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("refuses bytes that aren't the announced image type", async () => {
    const start = await post(app, "/api/admin/media/uploads", { filename: "x.png", mimeType: "image/png", bytes: 10 }, cookie);
    const sent = await request(app)
      .post(new URL(start.body.uploadUrl).pathname)
      .set("Origin", ALLOWED_ORIGIN)
      .set("Cookie", cookie)
      .set("Content-Type", "image/png")
      .send(Buffer.from("<script>alert(1)</script>"));

    expect(sent.status).toBe(400);
  });

  it("won't mark a photo ready before its file arrives", async () => {
    const start = await post(app, "/api/admin/media/uploads", { filename: "x.png", mimeType: "image/png", bytes: 10 }, cookie);
    const done = await post(app, `/api/admin/media/${start.body.id}/complete`, { width: 10, height: 10 }, cookie);

    expect(done.status).toBe(409);
    expect(done.body.error.code).toBe("UPLOAD_NOT_FINISHED");
  });

  it("accepts only image types up to 10 MB", async () => {
    const svg = await post(app, "/api/admin/media/uploads", { filename: "x.svg", mimeType: "image/svg+xml", bytes: 10 }, cookie);
    const huge = await post(app, "/api/admin/media/uploads", { filename: "x.png", mimeType: "image/png", bytes: 11 * 1024 * 1024 }, cookie);

    expect(svg.status).toBe(400);
    expect(huge.status).toBe(400);
  });
});

describe("photo library management", () => {
  it("edits the description and category, and filters by category", async () => {
    const image = await uploadImage(app, cookie);

    const edited = await api(app, "patch", `/api/admin/media/${image.id}`, cookie, { altKa: "სახლის ფასადი", altEn: "House front", category: "exterior" });

    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ altKa: "სახლის ფასადი", altEn: "House front", category: "exterior" });
    expect((await api(app, "get", "/api/admin/media?category=exterior", cookie)).body.items).toHaveLength(1);
    expect((await api(app, "get", "/api/admin/media?category=team", cookie)).body.items).toHaveLength(0);
  });

  it("lists where a photo is used and refuses to delete it while in use", async () => {
    const image = await uploadImage(app, cookie);
    const project = await api(app, "post", "/api/admin/projects", cookie, projectInput(image.id));

    const usage = await api(app, "get", `/api/admin/media/${image.id}/usage`, cookie);
    expect(usage.body.usedBy).toEqual([{ type: "project", id: project.body.id, label: "ვაკის სახლი", href: `/admin/projects/${project.body.id}/edit` }]);

    const blocked = await api(app, "delete", `/api/admin/media/${image.id}`, cookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("MEDIA_IN_USE");
    expect(blocked.body.error.details.usedBy).toHaveLength(1);
  });

  it("deletes an unused photo and its file", async () => {
    const image = await uploadImage(app, cookie);

    expect((await api(app, "delete", `/api/admin/media/${image.id}`, cookie)).status).toBe(204);
    expect(await db.prisma.mediaAsset.count()).toBe(0);
    expect((await request(app).get(new URL(image.src).pathname)).status).toBe(404);
  });
});
