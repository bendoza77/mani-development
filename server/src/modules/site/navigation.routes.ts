import { Router } from "express";
import { z } from "zod";
import type { NavLocation, Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { assertSameItems, optionalText, siteLink, writePositions } from "../content/fields.js";
import { pageHref } from "../pages/menu.js";

/**
 * Both site menus as one editable list each (docs/API_CONTRACTS.md §8.4). An item points at a
 * page or at a link (internal path or https). Pages can also be placed from the page editor.
 */

const MAX_ITEMS = 12;
const location = z.enum(["header", "footer"]).transform((l) => l.toUpperCase() as NavLocation);

const itemInput = z
  .strictObject({
    location,
    labelKa: z.string().trim().min(1).max(40),
    labelEn: optionalText(40),
    pageId: z.uuid().nullish().transform((v) => v ?? null),
    url: siteLink.nullish().transform((v) => v || null),
    newTab: z.boolean().default(false),
    visible: z.boolean().default(true),
  })
  .refine((i) => !i.pageId !== !i.url, { path: ["url"], message: "page_or_link_required" });

const orderBody = z.strictObject({ location, ids: z.array(z.uuid()).max(MAX_ITEMS) });

const include = { page: { select: { id: true, titleKa: true, slug: true, systemKey: true, isPublished: true } } } as const;
type Row = Prisma.NavigationItemGetPayload<{ include: typeof include }>;

const toAdmin = (i: Row) => ({
  id: i.id,
  location: i.location.toLowerCase(),
  labelKa: i.labelKa,
  labelEn: i.labelEn,
  pageId: i.pageId,
  page: i.page ? { id: i.page.id, title: i.page.titleKa, isPublished: i.page.isPublished } : null,
  url: i.url,
  href: i.page ? pageHref(i.page) : i.url,
  newTab: i.newTab,
  visible: i.visible,
  position: i.position,
});

const notFound = () => new AppError(404, "NOT_FOUND", "That menu item doesn't exist.");
const idParam = z.uuid();

export function adminNavigationRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  const actor = (req: { session?: { user: { id: string } } }) => req.session!.user.id;

  const menus = async () => {
    const items = await prisma.navigationItem.findMany({ include, orderBy: { position: "asc" } });
    return {
      header: items.filter((i) => i.location === "HEADER").map(toAdmin),
      footer: items.filter((i) => i.location === "FOOTER").map(toAdmin),
    };
  };

  async function checkTarget(
    tx: Prisma.TransactionClient,
    input: z.output<typeof itemInput>,
    selfId?: string,
  ) {
    if (!input.pageId) return;
    if (!(await tx.page.findUnique({ where: { id: input.pageId }, select: { id: true } }))) {
      throw new AppError(422, "INVALID_REFERENCE", "The chosen page doesn't exist.");
    }
    const twin = await tx.navigationItem.findFirst({
      where: { location: input.location, pageId: input.pageId, ...(selfId ? { NOT: { id: selfId } } : {}) },
    });
    if (twin) throw new AppError(409, "ALREADY_IN_MENU", "That page is already in this menu.");
  }

  /** Renumbers one menu 0, 1, 2… (after a move between menus or a delete). */
  const compact = async (tx: Prisma.TransactionClient, loc: NavLocation) => {
    const rest = await tx.navigationItem.findMany({ where: { location: loc }, select: { id: true }, orderBy: { position: "asc" } });
    await writePositions(rest.map((i) => i.id), (id, position) => tx.navigationItem.update({ where: { id }, data: { position } }));
  };

  router.get("/", async (_req, res) => {
    res.json(await menus());
  });

  router.put("/order", async (req, res) => {
    const body = parse(orderBody, req.body);
    await prisma.$transaction(async (tx) => {
      const stored = await tx.navigationItem.findMany({ where: { location: body.location }, select: { id: true } });
      assertSameItems(stored.map((i) => i.id), body.ids);
      await writePositions(body.ids, (id, position) => tx.navigationItem.update({ where: { id }, data: { position } }));
    });
    await recordActivity(prisma, { kind: "navigation", message: `Menu reordered: ${body.location.toLowerCase()}`, actorId: actor(req) });
    res.json(await menus());
  });

  router.post("/", async (req, res) => {
    const input = parse(itemInput, req.body);
    const item = await prisma.$transaction(async (tx) => {
      await checkTarget(tx, input);
      const count = await tx.navigationItem.count({ where: { location: input.location } });
      if (count >= MAX_ITEMS) throw new AppError(409, "MENU_FULL", `A menu holds at most ${MAX_ITEMS} items.`);
      return tx.navigationItem.create({ data: { ...input, position: count }, include });
    });
    await recordActivity(prisma, { kind: "navigation", message: `Menu item added: ${item.labelKa}`, actorId: actor(req) });
    res.status(201).json(toAdmin(item));
  });

  router.put("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(itemInput, req.body);
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.navigationItem.findUnique({ where: { id } });
      if (!existing) throw notFound();
      await checkTarget(tx, input, id);
      const moving = existing.location !== input.location;
      if (moving) {
        const count = await tx.navigationItem.count({ where: { location: input.location } });
        if (count >= MAX_ITEMS) throw new AppError(409, "MENU_FULL", `A menu holds at most ${MAX_ITEMS} items.`);
        await tx.navigationItem.update({ where: { id }, data: { ...input, position: count } });
        await compact(tx, existing.location);
      } else {
        await tx.navigationItem.update({ where: { id }, data: input });
      }
      return tx.navigationItem.findUniqueOrThrow({ where: { id }, include });
    });
    await recordActivity(prisma, { kind: "navigation", message: `Menu item updated: ${item.labelKa}`, actorId: actor(req) });
    res.json(toAdmin(item));
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const deleted = await prisma.$transaction(async (tx) => {
      const item = await tx.navigationItem.findUnique({ where: { id } });
      if (!item) return null;
      await tx.navigationItem.delete({ where: { id } });
      await compact(tx, item.location);
      return item;
    });
    if (!deleted) throw notFound();
    await recordActivity(prisma, { kind: "navigation", message: `Menu item removed: ${deleted.labelKa}`, actorId: actor(req) });
    res.status(204).end();
  });

  return router;
}
