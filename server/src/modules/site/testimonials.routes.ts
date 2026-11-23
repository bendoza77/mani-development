import { Router } from "express";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { localeQuery, optionalText } from "../content/fields.js";
import { pick } from "../media/media.serialize.js";

/** Client testimonials (docs/API_CONTRACTS.md §6.3). */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const testimonialInput = z.strictObject({
  quoteKa: text(20, 400),
  quoteEn: optionalText(400),
  authorKa: text(1, 100),
  authorEn: optionalText(100),
  roleKa: text(1, 100),
  roleEn: optionalText(100),
  projectId: z.uuid().nullable(),
  published: z.boolean(),
});

const include = { project: { select: { id: true, slug: true, titleKa: true, titleEn: true, isPublished: true } } } as const;
type Row = Prisma.TestimonialGetPayload<{ include: typeof include }>;

const toAdmin = (t: Row) => ({
  id: t.id,
  quoteKa: t.quoteKa,
  quoteEn: t.quoteEn,
  authorKa: t.authorKa,
  authorEn: t.authorEn,
  roleKa: t.roleKa,
  roleEn: t.roleEn,
  projectId: t.projectId,
  project: t.project ? { id: t.project.id, slug: t.project.slug, title: t.project.titleKa } : null,
  published: t.published,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

const notFound = () => new AppError(404, "NOT_FOUND", "That testimonial doesn't exist.");
const idParam = z.uuid();
const listQuery = z.object({ published: z.enum(["true", "false"]).optional() });

async function assertProject(prisma: PrismaClient, projectId: string | null) {
  if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) {
    throw new AppError(422, "INVALID_REFERENCE", "The chosen project doesn't exist.");
  }
}

export function adminTestimonialRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  const actor = (req: { session?: { user: { id: string } } }) => req.session!.user.id;

  router.get("/", async (req, res) => {
    const { published } = parse(listQuery, req.query);
    const where = published ? { published: published === "true" } : {};
    const [items, all, publishedCount] = await Promise.all([
      prisma.testimonial.findMany({ where, include, orderBy: { createdAt: "desc" } }),
      prisma.testimonial.count(),
      prisma.testimonial.count({ where: { published: true } }),
    ]);
    res.json({ items: items.map(toAdmin), counts: { all, published: publishedCount, draft: all - publishedCount } });
  });

  router.post("/", async (req, res) => {
    const input = parse(testimonialInput, req.body);
    await assertProject(prisma, input.projectId);
    const t = await prisma.testimonial.create({ data: input, include });
    await recordActivity(prisma, { kind: "testimonial", message: `Testimonial added: ${t.authorKa}`, actorId: actor(req) });
    res.status(201).json(toAdmin(t));
  });

  router.put("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(testimonialInput, req.body);
    await assertProject(prisma, input.projectId);
    if (!(await prisma.testimonial.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
    const t = await prisma.testimonial.update({ where: { id }, data: input, include });
    await recordActivity(prisma, { kind: "testimonial", message: `Testimonial updated: ${t.authorKa}`, actorId: actor(req) });
    res.json(toAdmin(t));
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { published } = parse(z.strictObject({ published: z.boolean() }), req.body);
    if ((await prisma.testimonial.updateMany({ where: { id }, data: { published } })).count === 0) throw notFound();
    const t = await prisma.testimonial.findUniqueOrThrow({ where: { id }, include });
    await recordActivity(prisma, {
      kind: "testimonial",
      message: `Testimonial ${published ? "published" : "unpublished"}: ${t.authorKa}`,
      actorId: actor(req),
    });
    res.json(toAdmin(t));
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const t = await prisma.testimonial.findUnique({ where: { id } });
    if (!t) throw notFound();
    await prisma.testimonial.delete({ where: { id } });
    await recordActivity(prisma, { kind: "testimonial", message: `Testimonial deleted: ${t.authorKa}`, actorId: actor(req) });
    res.status(204).end();
  });

  return router;
}

/** Published testimonials, newest first. A linked project shows only if it is published. */
export function publicTestimonialRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const items = await prisma.testimonial.findMany({ where: { published: true }, include, orderBy: { createdAt: "desc" } });
    res.json({
      items: items.map((t) => ({
        id: t.id,
        quote: pick(t.quoteKa, t.quoteEn, locale),
        author: pick(t.authorKa, t.authorEn, locale),
        role: pick(t.roleKa, t.roleEn, locale),
        project: t.project?.isPublished ? { slug: t.project.slug, title: pick(t.project.titleKa, t.project.titleEn, locale) } : null,
      })),
    });
  });
  return router;
}
