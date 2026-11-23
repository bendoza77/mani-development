import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn } from "../../helpers/auth.js";
import { api, paragraph, projectInput, uploadImage } from "../../helpers/content.js";
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

describe("admin saves Russian for projects and pages", () => {
  const page = (overrides: Record<string, unknown> = {}) => ({
    slug: "warranty",
    titleKa: "გარანტია",
    titleEn: "Warranty",
    introKa: "შესავალი",
    isPublished: true,
    blocks: [],
    ...overrides,
  });

  it("stores a project's Russian text, specs and SEO and shows them publicly", async () => {
    const created = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, {
      titleRu: "Дом в Ваке",
      summaryRu: "Двухэтажный дом",
      descriptionRu: "Описание",
      locationRu: "Ваке",
      cityRu: "Тбилиси",
      specs: [{ labelKa: "ფართი", labelEn: "Area", labelRu: "Площадь", valueKa: "240 მ²", valueRu: "240 м²" }],
      seo: { titleKa: "", titleRu: "Дом в Ваке — MANI", descriptionKa: "", descriptionRu: "Дом в Тбилиси." },
    }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      titleRu: "Дом в Ваке",
      cityRu: "Тбилиси",
      specs: [{ labelRu: "Площадь", valueRu: "240 м²" }],
      seo: { titleRu: "Дом в Ваке — MANI", descriptionRu: "Дом в Тбилиси." },
    });

    const ru = (await pub("/api/public/projects/vake-house?locale=ru")).body;
    expect(ru).toMatchObject({ title: "Дом в Ваке", summary: "Двухэтажный дом", city: "Тбилиси", specs: [{ label: "Площадь", value: "240 м²" }] });
    expect(ru.seo).toMatchObject({ title: "Дом в Ваке — MANI", description: "Дом в Тбилиси." });
  });

  it("stores Russian page text and sections and shows them publicly", async () => {
    const created = await api(app, "post", "/api/admin/pages", cookie, page({
      titleRu: "Гарантия",
      introRu: "Введение",
      blocks: [
        { type: "heading", level: 2, textKa: "პირობები", textRu: "Условия" },
        { type: "text", docKa: paragraph("ქართ."), docEn: paragraph("English"), docRu: paragraph("Русский") },
        { type: "cards", titleKa: "უპირატესობები", items: [{ titleKa: "ხარისხი", titleRu: "Качество", textKa: "ტექსტი", textRu: "Текст" }] },
      ],
    }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ titleRu: "Гарантия", introRu: "Введение" });

    const ru = (await pub("/api/public/pages/warranty?locale=ru")).body;
    expect(ru).toMatchObject({ title: "Гарантия", intro: "Введение" });
    expect(ru.blocks).toMatchObject([
      { type: "heading", text: "Условия" },
      { type: "text", doc: paragraph("Русский") },
      { type: "cards", title: "უპირატესობები", items: [{ title: "Качество", text: "Текст" }] },
    ]);
  });

  it("still shows and re-saves page sections stored before Russian existed", async () => {
    const created = await api(app, "post", "/api/admin/pages", cookie, page({
      blocks: [{ type: "text", docKa: paragraph("ქართ."), docEn: paragraph("English") }],
    }));
    // A section as it was stored before this change: no Russian keys at all.
    await prisma.contentBlock.updateMany({
      where: { pageId: created.body.id },
      data: { data: { docKa: paragraph("ქართ."), docEn: paragraph("English") } },
    });

    const ru = (await pub("/api/public/pages/warranty?locale=ru")).body;
    expect(ru.blocks[0].doc).toEqual(paragraph("English"));

    const admin = (await api(app, "get", `/api/admin/pages/${created.body.id}`, cookie)).body;
    const resaved = await api(app, "put", `/api/admin/pages/${created.body.id}`, cookie, page({
      blocks: admin.blocks.map(({ id: _id, ...rest }: Record<string, unknown>) => rest),
    }));
    expect(resaved.status).toBe(200);
  });

  it("stores a Russian menu label for a page", async () => {
    const created = await api(app, "post", "/api/admin/pages", cookie, page({
      titleRu: "Гарантия",
      menu: { labelKa: null, labelEn: null, labelRu: "Гарантии", header: { show: true, position: null }, footer: { show: false, position: null } },
    }));
    expect(created.status).toBe(201);
    expect(created.body.menu.labelRu).toBe("Гарантии");

    const nav = await api(app, "get", "/api/admin/navigation", cookie);
    expect(nav.body.header.find((i: { pageId: string | null }) => i.pageId === created.body.id).labelRu).toBe("Гарантии");
  });
});

describe("Russian around the site", () => {
  it("lists a page for Russian in the sitemap only when it has a Russian title", async () => {
    await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { slug: "with-ru", titleRu: "Дом" }));
    await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { slug: "without-ru" }));

    const items = (await pub("/api/public/sitemap")).body.items as { path: string; locales: string[] }[];

    expect(items.find((i) => i.path.endsWith("/with-ru"))!.locales).toEqual(["ka", "en", "ru"]);
    expect(items.find((i) => i.path.endsWith("/without-ru"))!.locales).toEqual(["ka", "en"]);
  });

  it("finds a project by its Russian title in the admin search", async () => {
    await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { titleRu: "Терраса в Ваке" }));

    const res = await api(app, "get", "/api/admin/search?q=Терраса", cookie);

    expect(res.body.items.map((i: { type: string }) => i.type)).toEqual(["project"]);
  });

  it("keeps the /ru address free for the Russian site", async () => {
    const res = await api(app, "post", "/api/admin/pages", cookie, { slug: "ru", titleKa: "გვერდი", introKa: "", isPublished: true, blocks: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.slug[0].code).toBe("reserved_slug");
  });

  it("accepts a contact form sent from the Russian site", async () => {
    const res = await request(app).post("/api/public/inquiries").set("Origin", ALLOWED_ORIGIN).send({
      name: "Наталья",
      email: "natalia@example.com",
      subject: "Дом в Цхнети",
      message: "У нас участок 900 м², хотим двухэтажный дом.",
      website: "",
      locale: "ru",
    });

    expect(res.status).toBe(201);
  });
});
