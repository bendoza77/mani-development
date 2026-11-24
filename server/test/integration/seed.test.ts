import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runSeed } from "../../prisma/seed.js";
import { createDatabase } from "../../src/lib/db.js";
import { resetDb } from "../helpers/db.js";

/** The development seed (prisma/seed.ts): placeholder demo content, Georgian first. */

const db = createDatabase(inject("databaseUrl"));
const prisma = db.prisma;

async function counts() {
  return {
    media: await prisma.mediaAsset.count(),
    projects: await prisma.project.count(),
    specs: await prisma.projectSpec.count(),
    gallery: await prisma.projectImage.count(),
    services: await prisma.service.count(),
    team: await prisma.teamMember.count(),
    testimonials: await prisma.testimonial.count(),
    inquiries: await prisma.inquiry.count(),
    notes: await prisma.inquiryNote.count(),
    notifications: await prisma.notification.count(),
    activity: await prisma.activityLog.count(),
    slides: await prisma.homeSlide.count(),
    pages: await prisma.page.count(),
    blocks: await prisma.contentBlock.count(),
    navigation: await prisma.navigationItem.count(),
  };
}

let first: Awaited<ReturnType<typeof counts>>;

beforeAll(async () => {
  await resetDb();
  await runSeed(prisma);
  first = await counts();
});
afterAll(async () => {
  await resetDb();
  await db.disconnect();
});

describe("runSeed", () => {
  it("loads the prototype's demo content", () => {
    expect(first).toMatchObject({
      media: 38,
      projects: 12,
      services: 7,
      team: 8,
      testimonials: 5,
      inquiries: 10,
      notes: 4,
      notifications: 2,
      activity: 7,
      slides: 3,
      pages: 6, // five built-in pages from the migration + one sample page
      navigation: 8, // the migration's menu, untouched
    });
    expect(first.specs).toBeGreaterThan(0);
    expect(first.gallery).toBeGreaterThan(0);
    expect(first.blocks).toBe(3);
  });

  it("can run again without errors or duplicates", async () => {
    await runSeed(prisma);

    expect(await counts()).toEqual(first);
  });

  it("stores Georgian as the primary language and English as the second", async () => {
    const vake = await prisma.project.findUniqueOrThrow({ where: { slug: "vake-terraces" } });

    // The prototype never translates project names (client/i18n/content.ts:10), so both are the same.
    expect(vake.titleKa).toBe("Vake Terraces");
    expect(vake.titleEn).toBe("Vake Terraces");
    expect(vake.locationKa).toBe("ვაკე, თბილისი");
    expect(vake.locationEn).toBe("Vake, Tbilisi");
    expect(vake.status).toBe("in_progress");
  });

  it("adds Russian as the third language", async () => {
    const vake = await prisma.project.findUniqueOrThrow({ where: { slug: "vake-terraces" }, include: { specs: true } });
    const services = await prisma.service.findMany();
    const cyrillic = /[А-Яа-яЁё]/;

    // Project names stay untranslated, as in Georgian.
    expect(vake.titleRu).toBe("Vake Terraces");
    expect(vake.locationRu).toMatch(cyrillic);
    expect(vake.summaryRu).toMatch(cyrillic);
    expect(vake.specs.every((s) => s.labelRu && cyrillic.test(s.labelRu))).toBe(true);
    for (const s of services) {
      expect(s.titleRu).toMatch(cyrillic);
      expect(s.featuresRu).toHaveLength(s.featuresEn.length);
    }
    expect(await prisma.teamMember.count({ where: { bioRu: null } })).toBe(0);
    expect(await prisma.testimonial.count({ where: { quoteRu: null } })).toBe(0);
    expect(await prisma.homeSlide.count({ where: { ctaLabelRu: "Проекты" } })).toBeGreaterThan(0);
  });

  it("publishes every demo project except one draft", async () => {
    const drafts = await prisma.project.findMany({ where: { isPublished: false }, select: { slug: true } });

    expect(drafts).toEqual([{ slug: "gudauri-alpine-lodge" }]);
  });

  it("links testimonials to projects by id", async () => {
    const t = await prisma.testimonial.findFirstOrThrow({
      where: { authorEn: "Eka Beridze" },
      include: { project: { select: { slug: true } } },
    });

    expect(t.project?.slug).toBe("vake-terraces");
  });

  it("leaves the migration's settings row as it was", async () => {
    const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: 1 } });

    expect(settings.companyName).toBe("MANI DEVELOPMENT");
    expect(settings.email).toBe("info@manidevelopment.ge");
  });
});
