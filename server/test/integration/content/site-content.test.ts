import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn } from "../../helpers/auth.js";
import { api, projectInput, uploadImage } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";

/** Phase 8: services, team, testimonials, homepage slides, menu items and site settings. */

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

const serviceInput = (overrides: Record<string, unknown> = {}) => ({
  titleKa: "კერძო სახლები",
  titleEn: "Private houses",
  summaryKa: "სახლები გასაღების ჩაბარებით",
  summaryEn: null,
  descriptionKa: "ვგეგმავთ, ვაპროექტებთ და ვაშენებთ საოჯახო სახლებს.",
  descriptionEn: "We plan, engineer and build family houses.",
  featuresKa: ["პროექტირება", "მშენებლობა"],
  featuresEn: ["Design", "Construction"],
  imageId,
  visible: true,
  ...overrides,
});

const memberInput = (overrides: Record<string, unknown> = {}) => ({
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

const slideInput = (overrides: Record<string, unknown> = {}) => ({
  imageId,
  headingKa: "სახლები, რომლებიც გრძელდება",
  headingEn: "Houses that last",
  textKa: "",
  textEn: null,
  ctaLabelKa: "პროექტები",
  ctaLabelEn: "Projects",
  ctaUrl: "/projects",
  isPublished: true,
  ...overrides,
});

describe("services", () => {
  it("creates a service with a slug from the Georgian title, appended at the end", async () => {
    const first = await api(app, "post", "/api/admin/services", cookie, serviceInput());
    const second = await api(app, "post", "/api/admin/services", cookie, serviceInput({ titleKa: "რენოვაცია" }));

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ slug: "kerdzo-sakhlebi", titleEn: "Private houses", position: 0 });
    expect(first.body.image.src).toContain("/media/");
    expect(second.body).toMatchObject({ slug: "renovatsia", position: 1 });
  });

  it("rejects short texts, too many features and a taken slug", async () => {
    const bad = await api(app, "post", "/api/admin/services", cookie, serviceInput({ titleKa: "ab", summaryKa: "short", featuresKa: Array(13).fill("x") }));
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.details.fieldErrors)).toEqual(expect.arrayContaining(["titleKa", "summaryKa", "featuresKa"]));

    await api(app, "post", "/api/admin/services", cookie, serviceInput());
    const dup = await api(app, "post", "/api/admin/services", cookie, serviceInput());
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("SLUG_TAKEN");
  });

  it("rejects a photo that doesn't exist", async () => {
    const res = await api(app, "post", "/api/admin/services", cookie, serviceInput({ imageId: "0196a1b2-0000-7000-8000-000000000000" }));
    expect(res.status).toBe(422);
  });

  it("edits, hides and deletes; positions stay contiguous", async () => {
    const a = (await api(app, "post", "/api/admin/services", cookie, serviceInput({ slug: "a" }))).body;
    const b = (await api(app, "post", "/api/admin/services", cookie, serviceInput({ slug: "b" }))).body;
    const c = (await api(app, "post", "/api/admin/services", cookie, serviceInput({ slug: "c" }))).body;

    const edited = await api(app, "put", `/api/admin/services/${b.id}`, cookie, serviceInput({ slug: "b", titleEn: "Renovation" }));
    expect(edited.body).toMatchObject({ titleEn: "Renovation", position: 1 });

    const hidden = await api(app, "patch", `/api/admin/services/${c.id}`, cookie, { visible: false });
    expect(hidden.body.visible).toBe(false);

    expect((await api(app, "delete", `/api/admin/services/${a.id}`, cookie)).status).toBe(204);
    const list = await api(app, "get", "/api/admin/services", cookie);
    expect(list.body.items.map((s: { slug: string; position: number }) => [s.slug, s.position])).toEqual([["b", 0], ["c", 1]]);
  });

  it("reorders the whole list, and refuses a list that doesn't match", async () => {
    const ids: string[] = [];
    for (const slug of ["a", "b", "c"]) ids.push((await api(app, "post", "/api/admin/services", cookie, serviceInput({ slug }))).body.id);

    const res = await api(app, "put", "/api/admin/services/order", cookie, { ids: [ids[2], ids[0], ids[1]] });
    expect(res.status).toBe(200);
    expect(res.body.items.map((s: { slug: string }) => s.slug)).toEqual(["c", "a", "b"]);

    const wrong = await api(app, "put", "/api/admin/services/order", cookie, { ids: [ids[0], ids[1]] });
    expect(wrong.status).toBe(409);
    expect(wrong.body.error.code).toBe("ORDER_MISMATCH");
  });

  it("shows only visible services publicly, in one language", async () => {
    await api(app, "post", "/api/admin/services", cookie, serviceInput({ slug: "shown" }));
    await api(app, "post", "/api/admin/services", cookie, serviceInput({ slug: "hidden", visible: false }));

    const ka = await pub("/api/public/services");
    const en = await pub("/api/public/services?locale=en");

    expect(ka.body.items).toHaveLength(1);
    expect(ka.body.items[0]).toMatchObject({ slug: "shown", title: "კერძო სახლები", features: ["პროექტირება", "მშენებლობა"] });
    expect(en.body.items[0]).toMatchObject({ title: "Private houses", summary: "სახლები გასაღების ჩაბარებით", features: ["Design", "Construction"] });
    expect(ka.body.items[0]).not.toHaveProperty("visible");
  });

  it("logs an activity entry", async () => {
    await api(app, "post", "/api/admin/services", cookie, serviceInput());
    const log = await prisma.activityLog.findMany({ where: { kind: "service" } });
    expect(log.map((l) => l.message)).toEqual(["Service created: კერძო სახლები"]);
  });
});

describe("team", () => {
  it("creates, reorders, hides and lists members", async () => {
    const a = await api(app, "post", "/api/admin/team", cookie, memberInput());
    const b = await api(app, "post", "/api/admin/team", cookie, memberInput({ nameKa: "გიორგი", visible: false }));
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ nameEn: "Nino Beridze", position: 0 });

    const order = await api(app, "put", "/api/admin/team/order", cookie, { ids: [b.body.id, a.body.id] });
    expect(order.body.items.map((m: { nameKa: string }) => m.nameKa)).toEqual(["გიორგი", "ნინო ბერიძე"]);

    const publicList = await pub("/api/public/team?locale=en");
    expect(publicList.body.items).toEqual([
      expect.objectContaining({ name: "Nino Beridze", role: "Architect", bio: "ნინო ხელმძღვანელობს ყველა პროექტის დაგეგმვას." }),
    ]);
  });

  it("requires a bio of 20+ characters", async () => {
    const res = await api(app, "post", "/api/admin/team", cookie, memberInput({ bioKa: "მოკლე" }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.bioKa).toBeDefined();
  });
});

describe("testimonials", () => {
  it("creates testimonials linked to a project and counts published and drafts", async () => {
    const project = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId));
    const quote = "გუნდმა სახლი დროულად და ბიუჯეტში ააშენა, ყველაფერი გამჭვირვალე იყო.";

    const created = await api(app, "post", "/api/admin/testimonials", cookie, {
      quoteKa: quote, quoteEn: null, authorKa: "ლევან", authorEn: "Levan", roleKa: "მესაკუთრე", roleEn: null,
      projectId: project.body.id, published: true,
    });
    await api(app, "post", "/api/admin/testimonials", cookie, {
      quoteKa: quote, authorKa: "ანა", roleKa: "მესაკუთრე", projectId: null, published: false,
    });

    expect(created.status).toBe(201);
    expect(created.body.project).toMatchObject({ id: project.body.id, title: "ვაკის სახლი" });
    const list = await api(app, "get", "/api/admin/testimonials", cookie);
    expect(list.body.counts).toEqual({ all: 2, published: 1, draft: 1 });
    const drafts = await api(app, "get", "/api/admin/testimonials?published=false", cookie);
    expect(drafts.body.items.map((t: { authorKa: string }) => t.authorKa)).toEqual(["ანა"]);

    const publicList = await pub("/api/public/testimonials?locale=en");
    expect(publicList.body.items).toEqual([
      { id: created.body.id, quote, author: "Levan", role: "მესაკუთრე", project: { slug: "vake-house", title: "Vake House" } },
    ]);
  });

  it("publishes with PATCH, rejects an unknown project, and keeps the quote when its project is deleted", async () => {
    const quote = "ძალიან კმაყოფილი ვართ შედეგით, გირჩევთ ყველას ამ გუნდს.";
    const bad = await api(app, "post", "/api/admin/testimonials", cookie, {
      quoteKa: quote, authorKa: "ანა", roleKa: "მესაკუთრე", projectId: "0196a1b2-0000-7000-8000-000000000000", published: true,
    });
    expect(bad.status).toBe(422);

    const project = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId));
    const t = await api(app, "post", "/api/admin/testimonials", cookie, {
      quoteKa: quote, authorKa: "ანა", roleKa: "მესაკუთრე", projectId: project.body.id, published: false,
    });
    const published = await api(app, "patch", `/api/admin/testimonials/${t.body.id}`, cookie, { published: true });
    expect(published.body.published).toBe(true);

    await api(app, "delete", `/api/admin/projects/${project.body.id}`, cookie);
    const after = await api(app, "get", `/api/admin/testimonials`, cookie);
    expect(after.body.items[0].project).toBeNull();
  });

  it("doesn't reveal a draft project through a published testimonial", async () => {
    const draft = await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, { isPublished: false }));
    await api(app, "post", "/api/admin/testimonials", cookie, {
      quoteKa: "ძალიან კმაყოფილი ვართ შედეგით, გირჩევთ ყველას.", authorKa: "ანა", roleKa: "მესაკუთრე", projectId: draft.body.id, published: true,
    });

    const items = (await pub("/api/public/testimonials")).body.items;
    expect(items[0].project).toBeNull();
  });

  it("requires a quote of 20–400 characters", async () => {
    const res = await api(app, "post", "/api/admin/testimonials", cookie, { quoteKa: "მოკლე", authorKa: "ა", roleKa: "ბ", projectId: null, published: true });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.quoteKa).toBeDefined();
  });
});

describe("homepage slides", () => {
  it("creates, publishes and reorders slides; the public list has only published ones", async () => {
    const a = await api(app, "post", "/api/admin/slides", cookie, slideInput());
    const b = await api(app, "post", "/api/admin/slides", cookie, slideInput({ headingKa: "მეორე", headingEn: null, ctaLabelKa: "", ctaLabelEn: null, ctaUrl: "", isPublished: false }));
    expect(a.status).toBe(201);

    await api(app, "put", "/api/admin/slides/order", cookie, { ids: [b.body.id, a.body.id] });
    expect((await pub("/api/public/slides")).body.items).toHaveLength(1);

    await api(app, "patch", `/api/admin/slides/${b.body.id}`, cookie, { isPublished: true });
    const en = await pub("/api/public/slides?locale=en");
    expect(en.body.items.map((s: { heading: string; cta: unknown }) => [s.heading, s.cta])).toEqual([
      ["მეორე", null],
      ["Houses that last", { label: "Projects", href: "/projects" }],
    ]);
  });

  it("allows at most 8 slides", async () => {
    for (let i = 0; i < 8; i++) await api(app, "post", "/api/admin/slides", cookie, slideInput());
    const ninth = await api(app, "post", "/api/admin/slides", cookie, slideInput());
    expect(ninth.status).toBe(409);
    expect(ninth.body.error.code).toBe("SLIDE_LIMIT");
  });

  it("needs a button label and link together, and only safe links", async () => {
    const half = await api(app, "post", "/api/admin/slides", cookie, slideInput({ ctaUrl: "" }));
    expect(half.status).toBe(400);
    const unsafe = await api(app, "post", "/api/admin/slides", cookie, slideInput({ ctaUrl: "javascript:alert(1)" }));
    expect(unsafe.status).toBe(400);
    const external = await api(app, "post", "/api/admin/slides", cookie, slideInput({ ctaUrl: "https://example.com/x" }));
    expect(external.status).toBe(201);
  });
});

describe("menu items", () => {
  it("lists both menus with page and link items, adds an external link and reorders", async () => {
    const before = await api(app, "get", "/api/admin/navigation", cookie);
    expect(before.body.header.map((i: { labelEn: string }) => i.labelEn)).toEqual(["Services", "Projects", "About"]);

    const link = await api(app, "post", "/api/admin/navigation", cookie, {
      location: "header", labelKa: "ინსტაგრამი", labelEn: "Instagram", url: "https://instagram.com/mani", newTab: true, visible: true,
    });
    expect(link.status).toBe(201);

    const ids = [link.body.id, ...before.body.header.map((i: { id: string }) => i.id)];
    const reordered = await api(app, "put", "/api/admin/navigation/order", cookie, { location: "header", ids });
    expect(reordered.status).toBe(200);

    const header = (await pub("/api/public/navigation?locale=en")).body.header;
    expect(header[0]).toEqual({ label: "Instagram", href: "https://instagram.com/mani", newTab: true });
  });

  it("rejects unsafe links and edits and deletes link items", async () => {
    const bad = await api(app, "post", "/api/admin/navigation", cookie, { location: "footer", labelKa: "x", url: "javascript:alert(1)", newTab: false, visible: true });
    expect(bad.status).toBe(400);

    const item = await api(app, "post", "/api/admin/navigation", cookie, { location: "footer", labelKa: "ბლოგი", url: "/blog", newTab: false, visible: true });
    const edited = await api(app, "put", `/api/admin/navigation/${item.body.id}`, cookie, { location: "footer", labelKa: "ბლოგი", url: "/news", newTab: false, visible: false });
    expect(edited.body).toMatchObject({ url: "/news", visible: false });
    expect((await pub("/api/public/navigation")).body.footer.map((l: { href: string }) => l.href)).not.toContain("/news");
    expect((await api(app, "delete", `/api/admin/navigation/${item.body.id}`, cookie)).status).toBe(204);
  });
});

describe("site settings", () => {
  const settingsInput = (overrides: Record<string, unknown> = {}) => ({
    companyName: "MANI DEVELOPMENT",
    taglineKa: "კერძო სახლების მშენებლობა",
    taglineEn: "Private house construction",
    email: "info@manidevelopment.ge",
    phone: "+995 32 200 14 14",
    addressKa: "ილია ჭავჭავაძის გამზ. 37მ",
    addressEn: "37m Ilia Chavchavadze Ave",
    hoursKa: "ორშ–პარ, 09:00–18:00",
    hoursEn: null,
    instagramUrl: "https://instagram.com/mani",
    linkedinUrl: "",
    facebookUrl: "",
    whatsappNumber: "995555123456",
    messengerUsername: "mani.development",
    mapUrl: "https://maps.app.goo.gl/abc123",
    latitude: 41.7151,
    longitude: 44.7471,
    defaultSeoDescriptionKa: "",
    defaultSeoDescriptionEn: null,
    defaultOgImageId: null,
    googleSiteVerification: "",
    gtmContainerId: "GTM-AB12CD3",
    ...overrides,
  });

  it("returns the settings the migration created", async () => {
    const res = await api(app, "get", "/api/admin/settings", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ companyName: "MANI DEVELOPMENT", email: "info@manidevelopment.ge", whatsappNumber: "" });
  });

  it("saves settings and shows them publicly in one language", async () => {
    const saved = await api(app, "put", "/api/admin/settings", cookie, settingsInput({ defaultOgImageId: imageId }));
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ whatsappNumber: "995555123456", latitude: 41.7151 });

    const en = await pub("/api/public/settings?locale=en");
    expect(en.body).toMatchObject({
      companyName: "MANI DEVELOPMENT",
      tagline: "Private house construction",
      hours: "ორშ–პარ, 09:00–18:00",
      whatsappNumber: "995555123456",
      gtmContainerId: "GTM-AB12CD3",
    });
    expect(en.body.defaultOgImage.id).toBe(imageId);
    expect(en.body).not.toHaveProperty("updatedAt");
    expect(await prisma.activityLog.count({ where: { kind: "settings" } })).toBe(1);
  });

  it.each([
    ["instagramUrl", "javascript:alert(1)"],
    ["mapUrl", "https://evil.example.com/maps"],
    ["whatsappNumber", "+995 555"],
    ["messengerUsername", "bad name!"],
    ["gtmContainerId", "UA-12345"],
    ["googleSiteVerification", "<meta>"],
    ["email", "not-an-email"],
    ["companyName", "A name much too long for the header"],
  ])("rejects a bad %s", async (field, value) => {
    const res = await api(app, "put", "/api/admin/settings", cookie, settingsInput({ [field]: value }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors[field]).toBeDefined();
  });
});

describe("access", () => {
  it.each(["/api/admin/services", "/api/admin/team", "/api/admin/testimonials", "/api/admin/slides", "/api/admin/navigation", "/api/admin/settings"])(
    "%s needs a session",
    async (path) => {
      expect((await request(app).get(path)).status).toBe(401);
    },
  );
});
