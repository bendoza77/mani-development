import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn } from "../../helpers/auth.js";
import { paragraph, uploadImage } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";
import { runSeed } from "../../../prisma/seed.js";

const { app, db, close } = buildTestApp();
afterAll(close);
let cookie: string;
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(db.prisma);
  cookie = await signIn(app);
});

const ORIGIN = "https://www.example.test";
const send = (method: "post" | "put" | "delete", path: string, body: object = {}) =>
  request(app)[method](path).set("Origin", ORIGIN).set("Cookie", cookie).send(body);

const page = (overrides: Record<string, unknown> = {}) => ({
  slug: "warranty",
  titleKa: "გარანტია",
  titleEn: "Warranty",
  introKa: "შესავალი",
  isPublished: true,
  blocks: [],
  ...overrides,
});

describe("admin pages", () => {
  it("creates a page with heading, formatted text and photo blocks; the site shows it", async () => {
    const image = await uploadImage(app, cookie);
    const bold = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "10 წლის " },
            { type: "text", text: "გარანტია", marks: [{ type: "bold" }, { type: "link", attrs: { href: "/contact" } }] },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph("ერთი").content[0]] }] },
      ],
    };
    const created = await send("post", "/api/admin/pages", page({
      blocks: [
        { type: "heading", level: 2, textKa: "პირობები", textEn: "Terms" },
        { type: "text", docKa: bold, docEn: paragraph("10-year warranty") },
        { type: "image", mediaId: image.id, captionKa: "ფოტო" },
      ],
    }));

    expect(created.status).toBe(201);
    expect(created.body.blocks.map((b: { type: string }) => b.type)).toEqual(["heading", "text", "image"]);
    expect(created.body.blocks[2]).toMatchObject({ mediaId: image.id, image: { id: image.id } });

    const ka = await request(app).get("/api/public/pages/warranty");
    const en = await request(app).get("/api/public/pages/warranty?locale=en");
    expect(ka.body).toMatchObject({ title: "გარანტია", intro: "შესავალი" });
    expect(ka.body.blocks[1].doc).toEqual(bold);
    expect(en.body.blocks).toMatchObject([
      { type: "heading", level: 2, text: "Terms" },
      { type: "text", doc: paragraph("10-year warranty") },
      { type: "image", caption: "ფოტო", image: { id: image.id } },
    ]);
  });

  it("hides unpublished pages from the site", async () => {
    await send("post", "/api/admin/pages", page({ isPublished: false }));

    expect((await request(app).get("/api/public/pages/warranty")).status).toBe(404);
  });

  it("refuses reserved and used addresses, and unsafe links", async () => {
    await send("post", "/api/admin/pages", page());

    const reserved = await send("post", "/api/admin/pages", page({ slug: "admin" }));
    const taken = await send("post", "/api/admin/pages", page());
    const unsafe = await send("post", "/api/admin/pages", page({
      slug: "x",
      blocks: [{ type: "text", docKa: { type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
      ] }] } }],
    }));
    const html = await send("post", "/api/admin/pages", page({
      slug: "y",
      blocks: [{ type: "text", docKa: { type: "doc", content: [{ type: "html", text: "<script>" }] } }],
    }));

    expect(reserved.body.error.details.fieldErrors.slug).toEqual([{ code: "reserved_slug" }]);
    expect(taken.status).toBe(409);
    expect(unsafe.status).toBe(400);
    expect(html.status).toBe(400);
  });

  it("edits a page, and deletes it", async () => {
    const created = await send("post", "/api/admin/pages", page());

    const edited = await send("put", `/api/admin/pages/${created.body.id}`, page({ titleKa: "ახალი", slug: "warranty-2" }));
    expect(edited.body).toMatchObject({ titleKa: "ახალი", slug: "warranty-2" });

    expect((await send("delete", `/api/admin/pages/${created.body.id}`)).status).toBe(204);
  });

  it("lets built-in pages be edited but not moved, hidden or deleted", async () => {
    const list = await request(app).get("/api/admin/pages").set("Cookie", cookie);
    const about = list.body.items.find((p: { systemKey: string }) => p.systemKey === "about");

    const edited = await send("put", `/api/admin/pages/${about.id}`, page({ slug: "elsewhere", isPublished: false, titleKa: "ჩვენ" }));
    const deleted = await send("delete", `/api/admin/pages/${about.id}`);

    expect(edited.body).toMatchObject({ slug: "about", isPublished: true, titleKa: "ჩვენ" });
    expect(deleted.status).toBe(409);
    expect(deleted.body.error.code).toBe("SYSTEM_PAGE");
  });
});

describe("the demo page from the seed", () => {
  it("renders through the public API in both languages", async () => {
    await runSeed(db.prisma);

    for (const locale of ["ka", "en"]) {
      const res = await request(app).get(`/api/public/pages/sample-blocks?locale=${locale}`);
      expect(res.status).toBe(200);
      expect(res.body.blocks.map((b: { type: string }) => b.type)).toEqual(["heading", "text", "image"]);
      expect(res.body.blocks[0].text.length).toBeGreaterThan(0);
      expect(res.body.blocks[1].doc).toMatchObject({ type: "doc" });
    }
  });
});

describe("page sections", () => {
  it("saves banner, gallery, text + photo and cards sections, and the site shows them", async () => {
    const [a, b, c] = [await uploadImage(app, cookie, "a.png"), await uploadImage(app, cookie, "b.png"), await uploadImage(app, cookie, "c.png")];
    const blocks = [
      { type: "banner", mediaId: a.id, titleKa: "ბანერი", titleEn: "Banner", textKa: "ტექსტი", buttonLabelKa: "კონტაქტი", buttonLabelEn: "Contact", buttonHref: "/contact" },
      { type: "gallery", mediaIds: [a.id, b.id, c.id] },
      { type: "textImage", mediaId: b.id, imageSide: "left", titleKa: "სათაური", docKa: paragraph("აღწერა"), docEn: paragraph("Description") },
      { type: "cards", titleKa: "უპირატესობები", items: [
        { titleKa: "ხარისხი", textKa: "ტექსტი 1", mediaId: c.id },
        { titleKa: "ვადები", titleEn: "On time", textKa: "ტექსტი 2" },
      ] },
    ];

    const created = await send("post", "/api/admin/pages", page({ blocks }));
    expect(created.status).toBe(201);
    expect(created.body.blocks).toMatchObject([
      { type: "banner", mediaId: a.id, image: { id: a.id }, buttonHref: "/contact" },
      { type: "gallery", mediaIds: [a.id, b.id, c.id] },
      { type: "textImage", mediaId: b.id, imageSide: "left" },
      { type: "cards", items: [{ titleKa: "ხარისხი", mediaId: c.id }, { titleKa: "ვადები", mediaId: null, image: null }] },
    ]);

    // Saving what the editor got back keeps everything as it was.
    const resaved = await send("put", `/api/admin/pages/${created.body.id}`, page({
      blocks: created.body.blocks.map(({ id: _id, image: _i, images: _is, ...rest }: Record<string, unknown>) =>
        rest.type === "cards"
          ? { ...rest, items: (rest.items as Record<string, unknown>[]).map(({ image: _x, ...item }) => item) }
          : rest),
    }));
    expect(resaved.status).toBe(200);

    const en = await request(app).get("/api/public/pages/warranty?locale=en");
    expect(en.body.blocks).toMatchObject([
      { type: "banner", title: "Banner", text: "ტექსტი", button: { label: "Contact", href: "/contact" }, image: { id: a.id } },
      { type: "gallery", images: [{ id: a.id }, { id: b.id }, { id: c.id }] },
      { type: "textImage", imageSide: "left", title: "სათაური", doc: paragraph("Description"), image: { id: b.id } },
      { type: "cards", title: "უპირატესობები", items: [
        { title: "ხარისხი", text: "ტექსტი 1", image: { id: c.id } },
        { title: "On time", text: "ტექსტი 2", image: null },
      ] },
    ]);
  });

  it("refuses a gallery of one photo, a button without a link, and an unsafe button link", async () => {
    const a = await uploadImage(app, cookie);
    const one = await send("post", "/api/admin/pages", page({ blocks: [{ type: "gallery", mediaIds: [a.id] }] }));
    const noLink = await send("post", "/api/admin/pages", page({ blocks: [{ type: "banner", mediaId: a.id, titleKa: "x", buttonLabelKa: "y" }] }));
    const unsafe = await send("post", "/api/admin/pages", page({
      blocks: [{ type: "banner", mediaId: a.id, titleKa: "x", buttonLabelKa: "y", buttonHref: "javascript:alert(1)" }],
    }));

    expect([one.status, noLink.status, unsafe.status]).toEqual([400, 400, 400]);
    expect(noLink.body.error.details.fieldErrors["blocks.0.buttonHref"]).toEqual([{ code: "button_needs_label_and_link" }]);
  });
});

describe("page menu settings", () => {
  const nav = async (locale = "ka") => (await request(app).get(`/api/public/navigation?locale=${locale}`)).body;

  it("starts with today's menus", async () => {
    expect((await nav("en")).header.map((l: { label: string }) => l.label)).toEqual(["Services", "Projects", "About"]);
  });

  it("adds a page to the top menu at a chosen position and to the footer at the end", async () => {
    const created = await send("post", "/api/admin/pages", page({
      menu: { labelKa: "გარანტია", labelEn: "Warranty", header: { show: true, position: 2 }, footer: { show: true } },
    }));

    // The labels equal the page titles, so they count as "no custom label".
    expect(created.body.menu).toEqual({
      labelKa: null,
      labelEn: null,
      labelRu: null,
      header: { show: true, position: 2 },
      footer: { show: true, position: 6 },
    });
    const menus = await nav("en");
    expect(menus.header).toEqual([
      { label: "Services", href: "/services", newTab: false },
      { label: "Warranty", href: "/warranty", newTab: false },
      { label: "Projects", href: "/projects", newTab: false },
      { label: "About", href: "/about", newTab: false },
    ]);
    expect(menus.footer.at(-1)).toEqual({ label: "Warranty", href: "/warranty", newTab: false });
    expect(menus.footer[0].href).toBe("/");
  });

  it("uses the page title when no menu label is given, moves and removes the entry", async () => {
    const created = await send("post", "/api/admin/pages", page({ menu: { header: { show: true }, footer: { show: false } } }));
    expect((await nav()).header.at(-1).label).toBe("გარანტია");

    const moved = await send("put", `/api/admin/pages/${created.body.id}`, page({ menu: { header: { show: true, position: 1 }, footer: { show: false } } }));
    expect(moved.body.menu.header).toEqual({ show: true, position: 1 });
    expect((await nav()).header[0].href).toBe("/warranty");

    await send("put", `/api/admin/pages/${created.body.id}`, page({ menu: { header: { show: false }, footer: { show: false } } }));
    expect((await nav()).header.map((l: { href: string }) => l.href)).toEqual(["/services", "/projects", "/about"]);
  });

  it("hides menu entries of unpublished pages, and lists menu flags in the admin", async () => {
    await send("post", "/api/admin/pages", page({ isPublished: false, menu: { header: { show: true }, footer: { show: false } } }));

    expect((await nav()).header).toHaveLength(3);
    const list = await request(app).get("/api/admin/pages").set("Cookie", cookie);
    expect(list.body.items.find((p: { slug: string }) => p.slug === "warranty")).toMatchObject({ inHeader: true, inFooter: false });
  });

  it("can take a built-in page out of the top menu", async () => {
    const list = await request(app).get("/api/admin/pages").set("Cookie", cookie);
    const about = list.body.items.find((p: { systemKey: string }) => p.systemKey === "about");

    await send("put", `/api/admin/pages/${about.id}`, page({ slug: "about", titleKa: "ჩვენ შესახებ", menu: { header: { show: false }, footer: { show: true } } }));

    expect((await nav()).header.map((l: { href: string }) => l.href)).toEqual(["/services", "/projects"]);
  });
});

describe("page and section styling", () => {
  const styled = {
    background: "#1F2A44",
    textColor: "#ffffff",
    align: "center",
    padding: "large",
    width: "wide",
  };

  it("saves a look for each section and for the whole page, and the site gets it", async () => {
    const created = await send("post", "/api/admin/pages", page({
      style: { background: "#FAF7F2", textColor: "#222222", accent: "#C8102E" },
      blocks: [
        { type: "heading", level: 2, textKa: "სათაური", style: styled },
        { type: "text", docKa: paragraph("ტექსტი") },
      ],
    }));

    expect(created.status).toBe(201);
    expect(created.body.style).toEqual({ background: "#faf7f2", textColor: "#222222", accent: "#c8102e" });
    expect(created.body.blocks[0].style).toEqual({ ...styled, background: "#1f2a44" });

    const pub = await request(app).get("/api/public/pages/warranty");
    expect(pub.body.style).toEqual({ background: "#faf7f2", textColor: "#222222", accent: "#c8102e" });
    expect(pub.body.blocks[0].style).toEqual({ ...styled, background: "#1f2a44" });
    // A section without its own look gets the defaults.
    expect(pub.body.blocks[1].style).toEqual({ background: null, textColor: null, align: "left", padding: "medium", width: "normal" });
  });

  it("starts a page with no colors of its own", async () => {
    const created = await send("post", "/api/admin/pages", page());

    expect(created.body.style).toEqual({ background: null, textColor: null, accent: null });
  });

  it.each([
    ["a color name", { background: "red" }],
    ["CSS that isn't a color", { background: "url(https://evil.example/x.png)" }],
    ["a short hex color", { textColor: "#fff" }],
    ["an unknown alignment", { align: "justify" }],
  ])("refuses %s", async (_label, style) => {
    const res = await send("post", "/api/admin/pages", page({ blocks: [{ type: "heading", level: 2, textKa: "x", style }] }));

    expect(res.status).toBe(400);
  });
});

describe("small editor details", () => {
  it("accepts a card whose text is empty (null)", async () => {
    const res = await send("post", "/api/admin/pages", page({
      blocks: [{ type: "cards", items: [{ titleKa: "ხარისხი", textKa: null, textEn: null }] }],
    }));

    expect(res.status).toBe(201);
    expect(res.body.blocks[0].items[0]).toMatchObject({ titleKa: "ხარისხი", textKa: "" });
  });

  it("reports an empty menu label as empty, and the menu follows a renamed page", async () => {
    const created = await send("post", "/api/admin/pages", page({ menu: { header: { show: true }, footer: { show: false } } }));
    expect(created.body.menu).toMatchObject({ labelKa: null, labelEn: null });

    await send("put", `/api/admin/pages/${created.body.id}`, page({ titleKa: "ახალი სახელი", menu: created.body.menu }));
    const menus = (await request(app).get("/api/public/navigation")).body;
    expect(menus.header.at(-1).label).toBe("ახალი სახელი");
  });

  it("keeps a custom menu label", async () => {
    const created = await send("post", "/api/admin/pages", page({ menu: { labelKa: "გარანტიები", header: { show: true }, footer: { show: false } } }));

    expect(created.body.menu.labelKa).toBe("გარანტიები");
  });
});
