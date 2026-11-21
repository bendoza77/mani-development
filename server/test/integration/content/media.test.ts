import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, post, signIn } from "../../helpers/auth.js";
import { PNG, uploadImage } from "../../helpers/content.js";
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
