import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { ProjectStatus } from "../../../src/generated/prisma/client.js";
import { createDatabase } from "../../../src/lib/db.js";
import { resetDb, sql } from "../../helpers/db.js";
import * as make from "../../helpers/fixtures.js";

/** Foreign-key behaviour (docs/DATABASE_DESIGN.md §4), unique keys, enum storage and IDs. */

const db = createDatabase(inject("databaseUrl"));
const prisma = db.prisma;
afterAll(() => db.disconnect());
beforeEach(() => resetDb());

const FOREIGN_KEY = /Foreign key constraint violated|foreign key constraint/i;
const UNIQUE = /Unique constraint failed/i;

describe("CASCADE: owned rows disappear with their owner", () => {
  it("deleting a project removes its specs, gallery rows and blocks", async () => {
    const p = await make.project(prisma);
    const image = await make.media(prisma);
    await prisma.projectSpec.create({ data: { projectId: p.id, position: 0, labelKa: "ფართი", valueKa: "100 მ²" } });
    await prisma.projectImage.create({ data: { projectId: p.id, mediaId: image.id, position: 0 } });
    await prisma.contentBlock.create({ data: { projectId: p.id, position: 0, type: "heading", data: {} } });

    await prisma.project.delete({ where: { id: p.id } });

    expect(await prisma.projectSpec.count()).toBe(0);
    expect(await prisma.projectImage.count()).toBe(0);
    expect(await prisma.contentBlock.count()).toBe(0);
    expect(await prisma.mediaAsset.count()).toBe(2); // media itself stays
  });

  it("deleting a page removes its blocks, their media links and its menu items", async () => {
    const pg = await make.page(prisma);
    const image = await make.media(prisma);
    const block = await prisma.contentBlock.create({ data: { pageId: pg.id, position: 0, type: "image", data: {} } });
    await prisma.contentBlockMedia.create({ data: { blockId: block.id, mediaId: image.id, position: 0 } });
    await prisma.navigationItem.create({ data: { location: "FOOTER", labelKa: "x", pageId: pg.id, position: 9 } });

    await prisma.page.delete({ where: { id: pg.id } });

    expect(await prisma.contentBlock.count()).toBe(0);
    expect(await prisma.contentBlockMedia.count()).toBe(0);
    expect(await prisma.navigationItem.count({ where: { pageId: pg.id } })).toBe(0);
  });

  it("deleting an inquiry removes its notes and notification", async () => {
    const q = await make.inquiry(prisma);
    await prisma.inquiryNote.create({ data: { inquiryId: q.id, text: "Called back." } });
    await prisma.notification.create({ data: { type: "NEW_INQUIRY", inquiryId: q.id } });

    await prisma.inquiry.delete({ where: { id: q.id } });

    expect(await prisma.inquiryNote.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("deleting an admin removes their sessions and reset tokens", async () => {
    const user = await make.adminUser(prisma);
    const soon = new Date(Date.now() + 60_000);
    await prisma.adminSession.create({
      data: { userId: user.id, tokenHash: "a".repeat(64), lastSeenAt: new Date(), expiresAt: soon },
    });
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: "b".repeat(64), expiresAt: soon } });

    await prisma.adminUser.delete({ where: { id: user.id } });

    expect(await prisma.adminSession.count()).toBe(0);
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });
});

describe("RESTRICT: media in use can't be deleted", () => {
  const cases: [string, (mediaId: string) => Promise<unknown>][] = [
    ["a project cover", (id) => make.project(prisma, { coverId: id })],
    [
      "a gallery image",
      async (id) => prisma.projectImage.create({ data: { projectId: (await make.project(prisma)).id, mediaId: id, position: 0 } }),
    ],
    [
      "an image in a content block",
      async (id) => {
        const block = await prisma.contentBlock.create({
          data: { pageId: (await make.page(prisma)).id, position: 0, type: "image", data: {} },
        });
        return prisma.contentBlockMedia.create({ data: { blockId: block.id, mediaId: id, position: 0 } });
      },
    ],
    ["a homepage slide", (id) => prisma.homeSlide.create({ data: { imageId: id, headingKa: "x", position: 0 } })],
    [
      "a service image",
      (id) => prisma.service.create({ data: { slug: "s", titleKa: "x", summaryKa: "x", descriptionKa: "x", imageId: id, position: 0 } }),
    ],
    [
      "a team photo",
      (id) => prisma.teamMember.create({ data: { nameKa: "x", roleKa: "x", bioKa: "x", photoId: id, position: 0 } }),
    ],
  ];

  it.each(cases)("refuses to delete %s", async (_label, use) => {
    const image = await make.media(prisma);
    await use(image.id);

    await expect(prisma.mediaAsset.delete({ where: { id: image.id } })).rejects.toThrow(FOREIGN_KEY);
  });
});

describe("SET NULL: optional links are cleared, rows stay", () => {
  it("deleting a project keeps its testimonial, without the link", async () => {
    const p = await make.project(prisma);
    const t = await prisma.testimonial.create({
      data: { quoteKa: "შესანიშნავი გუნდი", authorKa: "ეკა", roleKa: "დეველოპერი", projectId: p.id },
    });

    await prisma.project.delete({ where: { id: p.id } });

    expect((await prisma.testimonial.findUniqueOrThrow({ where: { id: t.id } })).projectId).toBeNull();
  });

  it("deleting an admin keeps their activity and uploads, without the link", async () => {
    const user = await make.adminUser(prisma);
    const log = await prisma.activityLog.create({ data: { kind: "auth", message: "Signed in", actorId: user.id } });
    const image = await make.media(prisma, { uploadedById: user.id });

    await prisma.adminUser.delete({ where: { id: user.id } });

    expect((await prisma.activityLog.findUniqueOrThrow({ where: { id: log.id } })).actorId).toBeNull();
    expect((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: image.id } })).uploadedById).toBeNull();
  });

  it("deleting a social image clears it on pages, projects and settings", async () => {
    const social = await make.media(prisma);
    const pg = await make.page(prisma, { ogImageId: social.id });
    const p = await make.project(prisma, { ogImageId: social.id });
    await prisma.siteSettings.update({ where: { id: 1 }, data: { defaultOgImageId: social.id } });

    await prisma.mediaAsset.delete({ where: { id: social.id } });

    expect((await prisma.page.findUniqueOrThrow({ where: { id: pg.id } })).ogImageId).toBeNull();
    expect((await prisma.project.findUniqueOrThrow({ where: { id: p.id } })).ogImageId).toBeNull();
    expect((await prisma.siteSettings.findUniqueOrThrow({ where: { id: 1 } })).defaultOgImageId).toBeNull();
  });
});

describe("unique keys", () => {
  it("rejects a duplicate project slug", async () => {
    await make.project(prisma, { slug: "vake-terraces" });
    await expect(make.project(prisma, { slug: "vake-terraces" })).rejects.toThrow(UNIQUE);
  });

  it("rejects a duplicate page slug, including a system page's", async () => {
    await expect(make.page(prisma, { slug: "contact" })).rejects.toThrow(UNIQUE);
  });

  it("rejects a second redirect from the same path", async () => {
    await prisma.redirect.create({ data: { fromPath: "/old", toPath: "/new" } });
    await expect(prisma.redirect.create({ data: { fromPath: "/old", toPath: "/other" } })).rejects.toThrow(UNIQUE);
  });

  it("rejects the same file registered twice with one provider", async () => {
    await make.media(prisma, { providerKey: "/images/a.jpg" });
    await expect(make.media(prisma, { providerKey: "/images/a.jpg" })).rejects.toThrow(UNIQUE);
  });

  it("rejects the same image twice in one gallery", async () => {
    const p = await make.project(prisma);
    const image = await make.media(prisma);
    await prisma.projectImage.create({ data: { projectId: p.id, mediaId: image.id, position: 0 } });
    await expect(
      prisma.projectImage.create({ data: { projectId: p.id, mediaId: image.id, position: 1 } }),
    ).rejects.toThrow(UNIQUE);
  });
});

describe("enum storage and IDs", () => {
  it("uses schema names in TypeScript and the frontend's hyphenated values in the database (D-15)", async () => {
    expect(ProjectStatus.in_progress).toBe("in_progress");

    const p = await make.project(prisma, { status: ProjectStatus.in_progress });
    const [row] = await sql<{ status: string }>("SELECT status::text AS status FROM projects WHERE id = $1", [p.id]);

    expect(row?.status).toBe("in-progress");
    expect((await prisma.project.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("in_progress");
  });

  it("generates time-ordered version 7 UUIDs", async () => {
    const first = await make.inquiry(prisma);
    const second = await make.inquiry(prisma);

    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // The first 48 bits are a millisecond timestamp; two IDs in the same millisecond may tie.
    const timestamp = (id: string) => id.replace(/-/g, "").slice(0, 12);
    expect(timestamp(second.id) >= timestamp(first.id)).toBe(true);
  });
});
