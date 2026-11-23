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

describe("admin saves Russian", () => {
  const memberBody = (overrides: Record<string, unknown> = {}) => ({
    nameKa: "ნინო ბერიძე",
    nameEn: "Nino Beridze",
    roleKa: "არქიტექტორი",
    roleEn: "Architect",
    bioKa: "ნინო ხელმძღვანელობს ყველა პროექტის დაგეგმვას.",
    bioEn: null,
    photoId: imageId,
    visible: true,
    ...overrides,
  });

  it("stores a team member's Russian text and returns it to the admin", async () => {
    const res = await api(app, "post", "/api/admin/team", cookie, memberBody({ nameRu: "Нино Беридзе", roleRu: "Архитектор", bioRu: null }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nameRu: "Нино Беридзе", roleRu: "Архитектор", bioRu: null });
  });

  it("saves a blank Russian box as empty, so the English shows", async () => {
    const created = await api(app, "post", "/api/admin/team", cookie, memberBody({ nameRu: "Нино" }));
    const edited = await api(app, "put", `/api/admin/team/${created.body.id}`, cookie, memberBody({ nameRu: "   " }));

    expect(edited.body.nameRu).toBeNull();
    expect((await pub("/api/public/team?locale=ru")).body.items[0].name).toBe("Nino Beridze");
  });

  it("rejects Russian text over the length limit on the Russian field", async () => {
    const res = await api(app, "post", "/api/admin/team", cookie, memberBody({ bioRu: "б".repeat(601) }));

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(["bioRu"]);
  });

  it("stores Russian for testimonials", async () => {
    const res = await api(app, "post", "/api/admin/testimonials", cookie, {
      quoteKa: "გუნდმა სახლი დროულად და ბიუჯეტში ააშენა, ყველაფერი გამჭვირვალე იყო.",
      quoteRu: "Команда построила дом вовремя и в рамках бюджета.",
      authorKa: "ლევან",
      authorRu: "Леван",
      roleKa: "მესაკუთრე",
      roleRu: "Владелец",
      projectId: null,
      published: true,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ quoteRu: "Команда построила дом вовремя и в рамках бюджета.", authorRu: "Леван", roleRu: "Владелец" });
  });

  it("stores Russian for services, including the feature list", async () => {
    const res = await api(app, "post", "/api/admin/services", cookie, {
      titleKa: "კერძო სახლები",
      titleRu: "Частные дома",
      summaryKa: "სახლები გასაღების ჩაბარებით",
      summaryRu: "Дома под ключ",
      descriptionKa: "ვგეგმავთ, ვაპროექტებთ და ვაშენებთ საოჯახო სახლებს.",
      descriptionRu: "Планируем, проектируем и строим семейные дома.",
      featuresKa: ["პროექტირება"],
      featuresEn: [],
      featuresRu: ["Проектирование"],
      imageId,
      visible: true,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ titleRu: "Частные дома", summaryRu: "Дома под ключ", featuresRu: ["Проектирование"] });
    expect((await pub("/api/public/services?locale=ru")).body.items[0].features).toEqual(["Проектирование"]);
  });

  it("stores Russian for homepage slides", async () => {
    const res = await api(app, "post", "/api/admin/slides", cookie, {
      imageId,
      headingKa: "სახლები, რომლებიც გრძელდება",
      headingRu: "Дома, которые служат долго",
      textKa: "",
      textRu: "Строим с 2010 года.",
      ctaLabelKa: "პროექტები",
      ctaLabelRu: "Проекты",
      ctaUrl: "/projects",
      isPublished: true,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ headingRu: "Дома, которые служат долго", textRu: "Строим с 2010 года.", ctaLabelRu: "Проекты" });
  });

  it("stores Russian menu labels", async () => {
    const res = await api(app, "post", "/api/admin/navigation", cookie, {
      location: "footer",
      labelKa: "ბლოგი",
      labelRu: "Блог",
      url: "/blog",
      newTab: false,
      visible: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.labelRu).toBe("Блог");
  });

  it("stores Russian site settings and shows them publicly", async () => {
    const current = (await api(app, "get", "/api/admin/settings", cookie)).body;
    const res = await api(app, "put", "/api/admin/settings", cookie, {
      companyName: current.companyName,
      taglineKa: current.taglineKa,
      taglineRu: "Строительство частных домов",
      email: current.email,
      phone: "+995 32 200 14 14",
      addressKa: "ილია ჭავჭავაძის გამზ. 37მ",
      addressRu: "просп. Ильи Чавчавадзе, 37м",
      hoursKa: "ორშ–პარ, 09:00–18:00",
      hoursRu: "Пн–Пт, 09:00–18:00",
      defaultSeoDescriptionRu: "Строим частные дома в Тбилиси.",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ taglineRu: "Строительство частных домов", defaultSeoDescriptionRu: "Строим частные дома в Тбилиси." });
    expect((await pub("/api/public/settings?locale=ru")).body).toMatchObject({ address: "просп. Ильи Чавчавадзе, 37м", hours: "Пн–Пт, 09:00–18:00" });
  });

  it("stores a photo's Russian description", async () => {
    const res = await api(app, "patch", `/api/admin/media/${imageId}`, cookie, { altRu: "Фасад дома" });

    expect(res.status).toBe(200);
    expect(res.body.altRu).toBe("Фасад дома");
  });
});
