import { Router } from "express";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { pageHref } from "../pages/menu.js";
import { fieldError, isUniqueViolation } from "./fields.js";

/**
 * Site addresses, redirects and the sitemap feed (docs/API_CONTRACTS.md §8.6–8.7,
 * docs/DATABASE_DESIGN.md §3.12). Paths are locale-free: the website applies them to /en too.
 */

/** A path on this site: one leading "/", no "//", no spaces, query or fragment; at most 300 characters. */
export const sitePath = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/(?!\/)[^\s?#]*$/, "invalid_path")
  .refine((p) => !p.includes("//"), { message: "invalid_path" })
  .transform((p) => (p.length > 1 ? p.replace(/\/+$/, "") : p));

export const projectPath = (slug: string) => `/projects/${slug}`;
export const customPagePath = (slug: string) => `/${slug}`;

/**
 * Called in the same transaction as a slug change of a published record:
 * 1. a redirect from the new address would hide the live record, so it goes;
 * 2. redirects that led to the old address now lead to the new one (no chains);
 * 3. the old address redirects to the new one.
 */
export async function recordAddressChange(tx: Prisma.TransactionClient, fromPath: string, toPath: string) {
  if (fromPath === toPath) return;
  await tx.redirect.deleteMany({ where: { fromPath: toPath } });
  await tx.redirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
  await tx.redirect.upsert({ where: { fromPath }, create: { fromPath, toPath }, update: { toPath } });
}

/** What lives at a path: a published project, a published page, or nothing. */
async function liveKind(prisma: PrismaClient, path: string): Promise<"project" | "page" | null> {
  if (path === "/") return "page";
  const parts = path.slice(1).split("/");
  if (parts.length === 2 && parts[0] === "projects") {
    const found = await prisma.project.findFirst({ where: { slug: parts[1], isPublished: true }, select: { id: true } });
    return found ? "project" : null;
  }
  if (parts.length === 1) {
    const found = await prisma.page.findFirst({
      // The home page lives at "/", not "/home". (systemKey is null for custom pages, and
      // SQL's NOT on a null is not true, hence the explicit OR.)
      where: { slug: parts[0], isPublished: true, OR: [{ systemKey: null }, { systemKey: { not: "home" } }] },
      select: { id: true },
    });
    return found ? "page" : null;
  }
  return null;
}

/** GET /api/public/resolve and GET /api/public/sitemap. */
export function publicPathRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();

  router.get("/resolve", async (req, res) => {
    const { path } = parse(z.object({ path: sitePath }), req.query);
    // A live record always wins over a redirect.
    const kind = await liveKind(prisma, path);
    if (kind) {
      res.json({ kind });
      return;
    }
    const redirect = await prisma.redirect.findUnique({ where: { fromPath: path } });
    res.json(redirect ? { kind: "redirect", to: redirect.toPath } : { kind: "none" });
  });

  router.get("/sitemap", async (_req, res) => {
    const [pages, projects] = await Promise.all([
      prisma.page.findMany({
        where: { isPublished: true, robotsIndex: true },
        select: { systemKey: true, slug: true, titleEn: true, updatedAt: true },
      }),
      prisma.project.findMany({
        where: { isPublished: true, robotsIndex: true },
        select: { slug: true, titleEn: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const locales = (titleEn: string | null) => (titleEn ? ["ka", "en"] : ["ka"]);
    res.json({
      items: [
        ...pages.map((p) => ({ path: pageHref(p), lastModified: p.updatedAt.toISOString(), locales: locales(p.titleEn) })),
        ...projects.map((p) => ({ path: projectPath(p.slug), lastModified: p.updatedAt.toISOString(), locales: locales(p.titleEn) })),
      ],
    });
  });

  return router;
}

const redirectInput = z.strictObject({ fromPath: sitePath, toPath: sitePath });
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const toRedirect = (r: { id: string; fromPath: string; toPath: string; createdAt: Date }) => ({
  id: r.id,
  fromPath: r.fromPath,
  toPath: r.toPath,
  createdAt: r.createdAt.toISOString(),
});

export function adminRedirectRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  const actor = (req: { session?: { user: { id: string } } }) => req.session!.user.id;

  router.get("/", async (req, res) => {
    const query = parse(listQuery, req.query);
    const where: Prisma.RedirectWhereInput = query.q
      ? { OR: [{ fromPath: { contains: query.q, mode: "insensitive" } }, { toPath: { contains: query.q, mode: "insensitive" } }] }
      : {};
    const [items, total] = await Promise.all([
      prisma.redirect.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.redirect.count({ where }),
    ]);
    res.json({ items: items.map(toRedirect), page: query.page, pageSize: query.pageSize, total });
  });

  router.post("/", async (req, res) => {
    const input = parse(redirectInput, req.body);
    if (input.fromPath === input.toPath) throw fieldError("toPath", "same_as_from");
    if (await liveKind(prisma, input.fromPath)) throw fieldError("fromPath", "live_address");
    try {
      const created = await prisma.redirect.create({ data: input });
      await recordActivity(prisma, { kind: "redirect", message: `Redirect added: ${input.fromPath} → ${input.toPath}`, actorId: actor(req) });
      res.status(201).json(toRedirect(created));
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, "REDIRECT_EXISTS", "That address already redirects somewhere.");
      throw error;
    }
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(z.uuid(), req.params.id);
    const found = await prisma.redirect.findUnique({ where: { id } });
    if (!found) throw new AppError(404, "NOT_FOUND", "That redirect doesn't exist.");
    await prisma.redirect.delete({ where: { id } });
    await recordActivity(prisma, { kind: "redirect", message: `Redirect removed: ${found.fromPath}`, actorId: actor(req) });
    res.status(204).end();
  });

  return router;
}
