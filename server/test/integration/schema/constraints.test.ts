import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../../src/lib/db.js";
import { resetDb } from "../../helpers/db.js";
import * as make from "../../helpers/fixtures.js";
import { inject } from "vitest";

/**
 * CHECK constraints from docs/DATABASE_DESIGN.md §3. Each test names the constraint it expects,
 * so a test fails for the right reason, not because of some other error.
 */

const db = createDatabase(inject("databaseUrl"));
const prisma = db.prisma;
afterAll(() => db.disconnect());
beforeEach(() => resetDb());

const violates = (name: string) => new RegExp(name);

describe("projects", () => {
  it.each([101, -1])("rejects progress %i", async (progress) => {
    await expect(make.project(prisma, { progress })).rejects.toThrow(violates("projects_progress_range"));
  });

  it("rejects an estimated completion before the start date", async () => {
    await expect(
      make.project(prisma, { startDate: new Date("2026-05-01"), estimatedCompletion: new Date("2026-04-30") }),
    ).rejects.toThrow(violates("projects_estimated_after_start"));
  });

  it("rejects a completion date before the start date", async () => {
    await expect(
      make.project(prisma, { startDate: new Date("2026-05-01"), completionDate: new Date("2026-04-01") }),
    ).rejects.toThrow(violates("projects_completion_after_start"));
  });

  it("rejects a completed project without a completion date", async () => {
    await expect(make.project(prisma, { status: "completed", progress: 100 })).rejects.toThrow(
      violates("projects_completed_requires_completion"),
    );
  });

  it("rejects a completed project below 100% progress", async () => {
    await expect(
      make.project(prisma, { status: "completed", progress: 90, completionDate: new Date("2027-01-01") }),
    ).rejects.toThrow(violates("projects_completed_requires_completion"));
  });

  it("accepts a completed project with a completion date and 100%", async () => {
    await expect(
      make.project(prisma, { status: "completed", progress: 100, completionDate: new Date("2027-01-01") }),
    ).resolves.toBeDefined();
  });

  it.each(["Bad Slug", "a--b", "-start", "end-", "ვაკე"])("rejects the slug %j", async (slug) => {
    await expect(make.project(prisma, { slug })).rejects.toThrow(violates("projects_slug_format"));
  });
});

describe("pages", () => {
  it("rejects a malformed page slug", async () => {
    await expect(make.page(prisma, { slug: "Privacy Policy" })).rejects.toThrow(violates("pages_slug_format"));
  });

  it("rejects a custom page that claims a system key", async () => {
    // Free the key first so the unique index can't be what rejects it.
    await prisma.page.delete({ where: { systemKey: "about" } });
    await expect(make.page(prisma, { kind: "CUSTOM", systemKey: "about" })).rejects.toThrow(
      violates("pages_system_consistency"),
    );
  });

  it("rejects a system page without a system key", async () => {
    await expect(make.page(prisma, { kind: "SYSTEM", isPublished: true })).rejects.toThrow(
      violates("pages_system_consistency"),
    );
  });

  it("rejects unpublishing a system page", async () => {
    await expect(
      prisma.page.update({ where: { systemKey: "home" }, data: { isPublished: false } }),
    ).rejects.toThrow(violates("pages_system_published"));
  });
});

describe("services and positions", () => {
  it("rejects a malformed service slug", async () => {
    const image = await make.media(prisma);
    await expect(
      prisma.service.create({
        data: { slug: "Not OK", titleKa: "x", summaryKa: "x", descriptionKa: "x", imageId: image.id, position: 0 },
      }),
    ).rejects.toThrow(violates("services_slug_format"));
  });

  it("rejects a negative position", async () => {
    const image = await make.media(prisma);
    await expect(
      prisma.service.create({
        data: { slug: "ok", titleKa: "x", summaryKa: "x", descriptionKa: "x", imageId: image.id, position: -1 },
      }),
    ).rejects.toThrow(violates("services_position_nonnegative"));
  });
});

describe("content blocks", () => {
  it("rejects a block that belongs to nothing", async () => {
    await expect(prisma.contentBlock.create({ data: { position: 0, type: "heading", data: {} } })).rejects.toThrow(
      violates("content_blocks_one_owner"),
    );
  });

  it("rejects a block that belongs to both a page and a project", async () => {
    const owner = await make.page(prisma);
    const proj = await make.project(prisma);
    await expect(
      prisma.contentBlock.create({
        data: { pageId: owner.id, projectId: proj.id, position: 0, type: "heading", data: {} },
      }),
    ).rejects.toThrow(violates("content_blocks_one_owner"));
  });
});

describe("navigation items", () => {
  it("rejects an item with neither a page nor a URL", async () => {
    await expect(
      prisma.navigationItem.create({ data: { location: "HEADER", labelKa: "x", position: 0 } }),
    ).rejects.toThrow(violates("navigation_items_one_target"));
  });

  it.each(["//evil.example", "javascript:alert(1)", "http://plain-http.example", "projects"])(
    "rejects the URL %j",
    async (url) => {
      await expect(
        prisma.navigationItem.create({ data: { location: "HEADER", labelKa: "x", url, position: 0 } }),
      ).rejects.toThrow(violates("navigation_items_url_format"));
    },
  );

  it.each(["/", "/privacy-policy", "https://www.facebook.com/example"])("accepts the URL %j", async (url) => {
    await expect(
      prisma.navigationItem.create({ data: { location: "FOOTER", labelKa: "x", url, position: 9 } }),
    ).resolves.toBeDefined();
  });
});

describe("site settings", () => {
  it("allows exactly one settings row", async () => {
    await expect(
      prisma.siteSettings.create({
        data: { id: 2, companyName: "X", taglineKa: "x", email: "a@b.ge", phone: "1234567", addressKa: "x", hoursKa: "x" },
      }),
    ).rejects.toThrow(violates("site_settings_singleton"));
  });

  it.each([
    ["whatsappNumber", "+995 555 12 34 56", "site_settings_whatsapp_format"],
    ["messengerUsername", "bad name!", "site_settings_messenger_format"],
    ["mapUrl", "http://maps.google.com/?q=1", "site_settings_map_url_format"],
    ["gtmContainerId", "UA-12345", "site_settings_gtm_format"],
    ["googleSiteVerification", "<meta>", "site_settings_verification_format"],
  ] as const)("rejects %s = %j", async (field, value, constraint) => {
    await expect(prisma.siteSettings.update({ where: { id: 1 }, data: { [field]: value } })).rejects.toThrow(
      violates(constraint),
    );
  });

  it("accepts well-formed contact and analytics values", async () => {
    await expect(
      prisma.siteSettings.update({
        where: { id: 1 },
        data: {
          whatsappNumber: "995555123456",
          messengerUsername: "mani.development",
          mapUrl: "https://maps.app.goo.gl/abc123",
          gtmContainerId: "GTM-ABC1234",
          googleSiteVerification: "AbC-123_xyz",
        },
      }),
    ).resolves.toBeDefined();
  });
});

describe("homepage slides", () => {
  it("rejects a button label without a link", async () => {
    const image = await make.media(prisma);
    await expect(
      prisma.homeSlide.create({ data: { imageId: image.id, headingKa: "x", ctaLabelKa: "ნახვა", position: 0 } }),
    ).rejects.toThrow(violates("home_slides_cta_complete"));
  });

  it("rejects a button link to another scheme", async () => {
    const image = await make.media(prisma);
    await expect(
      prisma.homeSlide.create({
        data: { imageId: image.id, headingKa: "x", ctaLabelKa: "ნახვა", ctaUrl: "javascript:alert(1)", position: 0 },
      }),
    ).rejects.toThrow(violates("home_slides_cta_url_format"));
  });
});

describe("redirects", () => {
  it.each(["no-slash", "//evil.example", "https://evil.example"])("rejects the source path %j", async (fromPath) => {
    await expect(prisma.redirect.create({ data: { fromPath, toPath: "/projects" } })).rejects.toThrow(
      violates("redirects_from_path_format"),
    );
  });

  it.each(["//evil.example", "https://evil.example"])("rejects the target %j (no open redirects)", async (toPath) => {
    await expect(prisma.redirect.create({ data: { fromPath: "/old", toPath } })).rejects.toThrow(
      violates("redirects_to_path_format"),
    );
  });

  it("rejects a redirect to itself", async () => {
    await expect(prisma.redirect.create({ data: { fromPath: "/same", toPath: "/same" } })).rejects.toThrow(
      violates("redirects_not_self"),
    );
  });
});

describe("positions can't be negative (every ordered table)", () => {
  it.each([
    "team_members",
    "navigation_items",
    "home_slides",
    "content_blocks",
    "project_images",
    "project_specs",
    "content_block_media",
  ])("%s", async (table) => {
    const image = await make.media(prisma);
    const proj = await make.project(prisma);
    const block = await prisma.contentBlock.create({ data: { projectId: proj.id, position: 0, type: "image", data: {} } });
    const attempts: Record<string, () => Promise<unknown>> = {
      team_members: () =>
        prisma.teamMember.create({ data: { nameKa: "x", roleKa: "x", bioKa: "x", photoId: image.id, position: -1 } }),
      navigation_items: () =>
        prisma.navigationItem.create({ data: { location: "FOOTER", labelKa: "x", url: "/x", position: -1 } }),
      home_slides: () => prisma.homeSlide.create({ data: { imageId: image.id, headingKa: "x", position: -1 } }),
      content_blocks: () =>
        prisma.contentBlock.create({ data: { projectId: proj.id, position: -1, type: "heading", data: {} } }),
      project_images: () => prisma.projectImage.create({ data: { projectId: proj.id, mediaId: image.id, position: -1 } }),
      project_specs: () =>
        prisma.projectSpec.create({ data: { projectId: proj.id, position: -1, labelKa: "x", valueKa: "x" } }),
      content_block_media: () =>
        prisma.contentBlockMedia.create({ data: { blockId: block.id, mediaId: image.id, position: -1 } }),
    };

    await expect(attempts[table]!()).rejects.toThrow(violates(`${table}_position_nonnegative`));
  });
});

describe("media", () => {
  it("rejects zero dimensions", async () => {
    await expect(make.media(prisma, { width: 0 })).rejects.toThrow(violates("media_assets_dimensions_positive"));
  });

  it("rejects a negative file size", async () => {
    await expect(make.media(prisma, { bytes: -1 })).rejects.toThrow(violates("media_assets_bytes_nonnegative"));
  });

  it("rejects a zero video duration", async () => {
    await expect(make.media(prisma, { kind: "VIDEO", durationSeconds: 0 })).rejects.toThrow(
      violates("media_assets_duration_positive"),
    );
  });
});

describe("preview tokens", () => {
  it("rejects an unknown target type", async () => {
    await expect(
      prisma.previewToken.create({
        data: { tokenHash: "a".repeat(64), targetType: "user", targetId: crypto.randomUUID(), expiresAt: new Date() },
      }),
    ).rejects.toThrow(violates("preview_tokens_target_type"));
  });
});
