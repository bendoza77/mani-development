import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn } from "../../helpers/auth.js";
import { api, projectInput, uploadImage } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";

/** Russian (docs/superpowers/specs/2026-11-23-russian-language-design.md): Russian → English → Georgian. */

const { app, db, settle, close } = buildTestApp();
const prisma = db.prisma;
afterAll(close);
afterEach(settle);

let cookie: string;
let imageId: string;
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(prisma);
  cookie = await signIn(app);
  imageId = (await uploadImage(app, cookie)).id;
});

const pub = (path: string) => request(app).get(path);

const member = (position: number, names: { nameEn?: string | null; nameRu?: string | null }) =>
  prisma.teamMember.create({
    data: {
      nameKa: `ნინო ${position}`,
      roleKa: "არქიტექტორი",
      bioKa: "ნინო ხელმძღვანელობს ყველა პროექტის დაგეგმვას.",
      photoId: imageId,
      visible: true,
      position,
      ...names,
    },
  });

describe("public content in Russian", () => {
  it("shows Russian, then English, then Georgian for team members", async () => {
    await member(0, { nameEn: "Nino", nameRu: "Нино" });
    await member(1, { nameEn: "Nino", nameRu: null });
    await member(2, { nameEn: null, nameRu: null });

    const res = await pub("/api/public/team?locale=ru");

    expect(res.status).toBe(200);
    expect(res.body.items.map((m: { name: string }) => m.name)).toEqual(["Нино", "Nino", "ნინო 2"]);
  });

  it("falls back to the English feature list when the Russian one is empty", async () => {
    await prisma.service.create({
      data: {
        slug: "houses",
        titleKa: "სახლები",
        summaryKa: "სახლები გასაღების ჩაბარებით",
        descriptionKa: "ვგეგმავთ და ვაშენებთ.",
        featuresKa: ["პროექტირება"],
        featuresEn: ["Design"],
        featuresRu: [],
        imageId,
        visible: true,
        position: 0,
      },
    });

    const res = await pub("/api/public/services?locale=ru");

    expect(res.body.items[0].features).toEqual(["Design"]);
  });

  it("shows Georgian for a project that has no English or Russian yet", async () => {
    const created = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { titleEn: null, cityEn: null }));
    expect(created.status).toBe(201);

    const list = await pub("/api/public/projects?locale=ru");

    expect(list.body.items[0]).toMatchObject({ title: "ვაკის სახლი", city: "თბილისი" });
  });

  it("shows a project's Russian text and specs", async () => {
    const created = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId));
    await prisma.project.update({ where: { id: created.body.id }, data: { titleRu: "Дом в Ваке", seoTitleRu: "Дом в Ваке — SEO" } });
    await prisma.projectSpec.updateMany({ where: { projectId: created.body.id }, data: { labelRu: "Площадь" } });

    const detail = await pub("/api/public/projects/vake-house?locale=ru");

    expect(detail.body).toMatchObject({ title: "Дом в Ваке", specs: [{ label: "Площадь", value: "240 მ²" }] });
    expect(detail.body.seo.title).toBe("Дом в Ваке — SEO");
  });

  it("rejects an unknown language", async () => {
    const res = await pub("/api/public/team?locale=xx");

    expect(res.status).toBe(400);
  });
});
