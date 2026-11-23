import { Router } from "express";
import { z } from "zod";
import type { NavLocation, Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { parse } from "../../lib/validate.js";
import { fieldError, localeQuery, optionalText } from "../content/fields.js";
import { pick } from "../media/media.serialize.js";

/**
 * Where a page appears in the site menus, set on the page itself: top menu (HEADER), footer
 * menu (FOOTER), both or neither; its label; and its position (1 = first). Stored as
 * navigation_items rows (docs/DATABASE_DESIGN.md §3.10).
 */

const MAX_ITEMS = 12;
const LABEL_MAX = 40;

const placement = z.strictObject({
  show: z.boolean(),
  /** 1-based; omitted = keep the current place, or add at the end. */
  position: z.number().int().min(1).max(MAX_ITEMS).nullish(),
});

export const menuInput = z.strictObject({
  labelKa: optionalText(LABEL_MAX),
  labelEn: optionalText(LABEL_MAX),
  labelRu: optionalText(LABEL_MAX),
  header: placement,
  footer: placement,
});

export type MenuInput = z.output<typeof menuInput>;

const LOCATIONS = { header: "HEADER", footer: "FOOTER" } as const satisfies Record<string, NavLocation>;

/** Puts (or removes) the page in each menu and renumbers that menu 0, 1, 2… */
export async function applyMenu(
  tx: Prisma.TransactionClient,
  page: { id: string; titleKa: string; titleEn: string | null; titleRu: string | null },
  menu: MenuInput,
) {
  const labelKa = menu.labelKa ?? page.titleKa.slice(0, LABEL_MAX);
  const labelEn = menu.labelEn ?? page.titleEn?.slice(0, LABEL_MAX) ?? null;
  const labelRu = menu.labelRu ?? page.titleRu?.slice(0, LABEL_MAX) ?? null;

  for (const [key, location] of Object.entries(LOCATIONS) as [keyof typeof LOCATIONS, NavLocation][]) {
    const wanted = menu[key];
    const items = await tx.navigationItem.findMany({ where: { location }, orderBy: { position: "asc" } });
    const currentIndex = items.findIndex((item) => item.pageId === page.id);
    const others = items.filter((item) => item.pageId !== page.id);

    let order: { id?: string }[] = others;
    if (wanted.show) {
      if (others.length >= MAX_ITEMS) throw fieldError(`menu.${key}`, "menu_full");
      const at = wanted.position ? wanted.position - 1 : currentIndex >= 0 ? currentIndex : others.length;
      const index = Math.min(at, others.length);
      const existing = items[currentIndex];
      const mine = existing
        ? await tx.navigationItem.update({ where: { id: existing.id }, data: { labelKa, labelEn, labelRu, visible: true } })
        : await tx.navigationItem.create({ data: { location, pageId: page.id, labelKa, labelEn, labelRu, position: others.length } });
      order = [...others.slice(0, index), mine, ...others.slice(index)];
    } else if (currentIndex >= 0) {
      await tx.navigationItem.delete({ where: { id: items[currentIndex]!.id } });
    }

    for (const [position, item] of order.entries()) {
      await tx.navigationItem.update({ where: { id: item.id! }, data: { position } });
    }
  }
}

/**
 * The page's current menu settings, for the admin editor. A label equal to the page title counts
 * as "no custom label" (null), so the editor shows it empty and it follows the page if renamed.
 */
export async function readMenu(prisma: Pick<PrismaClient, "navigationItem" | "page">, pageId: string) {
  const items = await prisma.navigationItem.findMany({ orderBy: { position: "asc" } });
  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { titleKa: true, titleEn: true, titleRu: true } });
  const placementIn = (location: NavLocation) => {
    const list = items.filter((i) => i.location === location);
    const index = list.findIndex((i) => i.pageId === pageId);
    return { show: index >= 0 && list[index]!.visible, position: index >= 0 ? index + 1 : null };
  };
  const mine = items.find((i) => i.pageId === pageId);
  const custom = (label: string | null | undefined, title: string | null | undefined) =>
    label && label !== title?.slice(0, LABEL_MAX) ? label : null;
  return {
    labelKa: custom(mine?.labelKa, page?.titleKa),
    labelEn: custom(mine?.labelEn, page?.titleEn),
    labelRu: custom(mine?.labelRu, page?.titleRu),
    header: placementIn("HEADER"),
    footer: placementIn("FOOTER"),
  };
}

/** A page's address on the website (locale-free; the website adds /en). */
export const pageHref = (page: { systemKey: string | null; slug: string }) =>
  page.systemKey === "home" ? "/" : `/${page.slug}`;

/** GET /api/public/navigation: both menus, visible items whose page is published. */
export function publicNavigationRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const items = await prisma.navigationItem.findMany({
      where: { visible: true, OR: [{ pageId: null }, { page: { isPublished: true } }] },
      orderBy: { position: "asc" },
      include: { page: { select: { systemKey: true, slug: true } } },
    });
    const links = (location: NavLocation) =>
      items
        .filter((i) => i.location === location)
        .map((i) => ({ label: pick(i.labelKa, i.labelEn, i.labelRu, locale), href: i.page ? pageHref(i.page) : i.url!, newTab: i.newTab }));
    res.json({ header: links("HEADER"), footer: links("FOOTER") });
  });
  return router;
}
