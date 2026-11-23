import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import {
  assertPageSlugAllowed,
  assertReadyImages,
  isUniqueViolation,
  localeQuery,
  optionalText,
  requiredText,
  slugField,
  slugTaken,
} from "../content/fields.js";
import { pageStyle, pageStyleInput } from "../content/style.js";
import { pick, toImage } from "../media/media.serialize.js";
import { customPagePath, recordAddressChange } from "../content/redirects.js";
import { adminSeo, publicSeo, seoColumns, seoInput } from "../content/seo.js";
import { blockInput, blocksInclude, imageIdsOf, toAdminBlock, toPublicBlock, writeBlocks } from "./blocks.js";
import { applyMenu, menuInput, readMenu } from "./menu.js";

/** Pages with ordered sections and their menu placement (docs/API_CONTRACTS.md §8.1, §8.3, §8.4). */

const pageInput = z.strictObject({
  slug: slugField,
  titleKa: requiredText(120),
  titleEn: optionalText(120),
  introKa: z.string().trim().max(400).default(""),
  introEn: optionalText(400),
  isPublished: z.boolean(),
  style: pageStyleInput.optional(),
  blocks: z.array(blockInput).max(60),
  /** Omitted = leave the page's menu entries as they are. */
  menu: menuInput.optional(),
  /** Omitted = leave the stored search-engine fields as they are. */
  seo: seoInput.optional(),
});

const withBlocks = { blocks: blocksInclude, ogImage: true } satisfies Prisma.PageInclude;

const imagesOf = (input: z.output<typeof pageInput>) => [
  ...imageIdsOf(input.blocks),
  ...(input.seo?.ogImageId ? [input.seo.ogImageId] : []),
];

type PageRow = Prisma.PageGetPayload<{ include: typeof withBlocks }>;

const kindOf = (kind: string) => (kind === "SYSTEM" ? "system" : "custom");

function toAdminPage(page: PageRow, config: Config, menu: Awaited<ReturnType<typeof readMenu>>) {
  return {
    id: page.id,
    kind: kindOf(page.kind),
    systemKey: page.systemKey,
    slug: page.slug,
    titleKa: page.titleKa,
    titleEn: page.titleEn,
    introKa: page.introKa,
    introEn: page.introEn,
    isPublished: page.isPublished,
    style: pageStyle(page.style),
    blocks: page.blocks.map((b) => toAdminBlock(b, config)),
    menu,
    seo: adminSeo(page),
    /** Preview of seo.ogImageId for the editor. */
    ogImage: page.ogImage ? toImage(page.ogImage, config) : null,
    updatedAt: page.updatedAt.toISOString(),
  };
}

const notFound = () => new AppError(404, "NOT_FOUND", "That page doesn't exist.");
const idParam = z.uuid();

export function adminPageRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const pages = await prisma.page.findMany({
      orderBy: [{ kind: "desc" }, { updatedAt: "desc" }],
      include: { navItems: { select: { location: true, visible: true } } },
    });
    res.json({
      items: pages.map((p) => ({
        id: p.id,
        kind: kindOf(p.kind),
        systemKey: p.systemKey,
        slug: p.slug,
        titleKa: p.titleKa,
        titleEn: p.titleEn,
        isPublished: p.isPublished,
        inHeader: p.navItems.some((n) => n.location === "HEADER" && n.visible),
        inFooter: p.navItems.some((n) => n.location === "FOOTER" && n.visible),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  });

  router.get("/:id", async (req, res) => {
    const page = await prisma.page.findUnique({ where: { id: parse(idParam, req.params.id) }, include: withBlocks });
    if (!page) throw notFound();
    res.json(toAdminPage(page, config, await readMenu(prisma, page.id)));
  });

  router.post("/", async (req, res) => {
    const input = parse(pageInput, req.body);
    assertPageSlugAllowed(input.slug);
    await assertReadyImages(prisma, imagesOf(input));
    try {
      const page = await prisma.$transaction(async (tx) => {
        const created = await tx.page.create({
          data: {
            kind: "CUSTOM",
            slug: input.slug,
            titleKa: input.titleKa,
            titleEn: input.titleEn,
            introKa: input.introKa,
            introEn: input.introEn,
            style: pageStyle(input.style),
            isPublished: input.isPublished,
            publishedAt: input.isPublished ? new Date() : null,
            ...(input.seo ? seoColumns(input.seo) : {}),
          },
        });
        await writeBlocks(tx, { pageId: created.id }, input.blocks);
        if (input.menu) await applyMenu(tx, created, input.menu);
        return tx.page.findUniqueOrThrow({ where: { id: created.id }, include: withBlocks });
      });
      await recordActivity(prisma, { kind: "page", message: `Page created: ${page.titleKa}`, actorId: req.session!.user.id });
      res.status(201).json(toAdminPage(page, config, await readMenu(prisma, page.id)));
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  });

  router.put("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(pageInput, req.body);
    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) throw notFound();
    const isSystem = existing.kind === "SYSTEM";
    // Built-in pages keep their address and are always published.
    if (!isSystem) assertPageSlugAllowed(input.slug);
    await assertReadyImages(prisma, imagesOf(input));
    try {
      const page = await prisma.$transaction(async (tx) => {
        await tx.page.update({
          where: { id },
          data: {
            titleKa: input.titleKa,
            titleEn: input.titleEn,
            introKa: input.introKa,
            introEn: input.introEn,
            ...(input.style ? { style: pageStyle(input.style) } : {}),
            ...(input.seo ? seoColumns(input.seo) : {}),
            ...(isSystem
              ? {}
              : {
                  slug: input.slug,
                  isPublished: input.isPublished,
                  publishedAt: input.isPublished ? (existing.publishedAt ?? new Date()) : null,
                }),
          },
        });
        if (!isSystem && existing.isPublished && existing.slug !== input.slug) {
          await recordAddressChange(tx, customPagePath(existing.slug), customPagePath(input.slug));
        }
        await writeBlocks(tx, { pageId: id }, input.blocks);
        if (input.menu) await applyMenu(tx, { id, titleKa: input.titleKa, titleEn: input.titleEn }, input.menu);
        return tx.page.findUniqueOrThrow({ where: { id }, include: withBlocks });
      });
      await recordActivity(prisma, { kind: "page", message: `Page updated: ${page.titleKa}`, actorId: req.session!.user.id });
      res.json(toAdminPage(page, config, await readMenu(prisma, page.id)));
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const page = await prisma.page.findUnique({ where: { id }, select: { kind: true, titleKa: true } });
    if (!page) throw notFound();
    if (page.kind === "SYSTEM") throw new AppError(409, "SYSTEM_PAGE", "Built-in pages can't be deleted.");
    await prisma.page.delete({ where: { id } });
    await recordActivity(prisma, { kind: "page", message: `Page deleted: ${page.titleKa}`, actorId: req.session!.user.id });
    res.status(204).end();
  });

  return router;
}

export function publicPageRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();

  router.get("/:slug", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const page = await prisma.page.findFirst({
      where: { slug: String(req.params.slug), isPublished: true },
      include: withBlocks,
    });
    if (!page) throw notFound();
    const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: 1 }, include: { defaultOgImage: true } });
    const title = pick(page.titleKa, page.titleEn, page.titleRu, locale);
    const intro = pick(page.introKa, page.introEn, page.introRu, locale);
    res.json({
      id: page.id,
      slug: page.slug,
      title,
      intro,
      seo: publicSeo(
        page,
        locale,
        {
          title,
          description: intro || pick(settings.defaultSeoDescriptionKa, settings.defaultSeoDescriptionEn, settings.defaultSeoDescriptionRu, locale),
          image: settings.defaultOgImage,
        },
        config,
      ),
      style: pageStyle(page.style),
      blocks: page.blocks.map((b) => toPublicBlock(b, config, locale)).filter((b) => b !== null),
      updatedAt: page.updatedAt.toISOString(),
    });
  });

  return router;
}
