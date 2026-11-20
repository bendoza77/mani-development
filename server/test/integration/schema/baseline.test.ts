import { afterAll, describe, expect, inject, it } from "vitest";
import { createDatabase } from "../../../src/lib/db.js";

/**
 * The rows the migration itself creates, so every environment (including production)
 * starts with settings, the five built-in pages and today's menu (DATABASE_DESIGN §3.8–3.10).
 * Read-only: no reset needed.
 */

const db = createDatabase(inject("databaseUrl"));
const prisma = db.prisma;
afterAll(() => db.disconnect());

describe("baseline rows created by the migration", () => {
  it("creates the single settings row with the real company details", async () => {
    const settings = await prisma.siteSettings.findMany();

    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({
      id: 1,
      companyName: "MANI DEVELOPMENT",
      email: "info@manidevelopment.ge",
      taglineKa: "კერძო სახლების მშენებლობა",
      taglineEn: "Private house construction",
      addressKa: "ილია ჭავჭავაძის გამზ. 37მ, მე-5 სართული, Terminal, თბილისი",
      whatsappNumber: "",
      gtmContainerId: "",
    });
  });

  it("creates the five built-in pages, published, with Georgian and English headings", async () => {
    const pages = await prisma.page.findMany({ orderBy: { slug: "asc" } });

    expect(pages.map((p) => [p.systemKey, p.slug, p.kind, p.isPublished])).toEqual([
      ["about", "about", "SYSTEM", true],
      ["contact", "contact", "SYSTEM", true],
      ["home", "home", "SYSTEM", true],
      ["projects", "projects", "SYSTEM", true],
      ["services", "services", "SYSTEM", true],
    ]);
    for (const p of pages) {
      expect(p.titleKa.length).toBeGreaterThan(0);
      expect(p.titleEn?.length).toBeGreaterThan(0);
      expect(p.publishedAt).not.toBeNull();
    }
    expect(pages.find((p) => p.systemKey === "home")?.titleKa).toBe(
      "კერძო სახლები, დაგეგმილი და აშენებული ერთი გუნდის მიერ.",
    );
  });

  it("recreates today's header and footer menus, pointing at the built-in pages", async () => {
    const items = await prisma.navigationItem.findMany({
      orderBy: [{ location: "asc" }, { position: "asc" }],
      include: { page: { select: { systemKey: true } } },
    });
    const menu = (location: "HEADER" | "FOOTER") =>
      items.filter((i) => i.location === location).map((i) => [i.page?.systemKey, i.labelKa, i.labelEn]);

    expect(menu("HEADER")).toEqual([
      ["services", "მომსახურება", "Services"],
      ["projects", "პროექტები", "Projects"],
      ["about", "ჩვენ შესახებ", "About"],
    ]);
    expect(menu("FOOTER")).toEqual([
      ["home", "მთავარი", "Home"],
      ["services", "მომსახურება", "Services"],
      ["projects", "პროექტები", "Projects"],
      ["about", "ჩვენ შესახებ", "About"],
      ["contact", "კონტაქტი", "Contact"],
    ]);
    expect(items.every((i) => i.visible && i.url === null)).toBe(true);
  });

  it("creates no content: projects, media and users start empty", async () => {
    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.mediaAsset.count()).toBe(0);
    expect(await prisma.adminUser.count()).toBe(0);
  });
});
