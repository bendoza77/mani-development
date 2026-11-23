import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { projectStatus } from "../../lib/enum-map.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import {
  assertReadyImages,
  fromDate,
  isoDate,
  isUniqueViolation,
  localeQuery,
  optionalText,
  requiredText,
  slugField,
  slugTaken,
  toDate,
} from "../content/fields.js";
import { projectPath, recordAddressChange } from "../content/redirects.js";
import { adminSeo, publicSeo, seoColumns, seoInput } from "../content/seo.js";
import { pick, toImage, type Locale } from "../media/media.serialize.js";

/** Projects (docs/API_CONTRACTS.md §6.1 and §5). Admin routes sit behind requireAdmin. */

const CATEGORIES = ["residential", "apartments", "commercial", "hospitality", "renovation"] as const;

const projectInput = z
  .strictObject({
    slug: slugField,
    titleKa: requiredText(120),
    titleEn: optionalText(120),
    summaryKa: requiredText(180),
    summaryEn: optionalText(180),
    descriptionKa: requiredText(20_000),
    descriptionEn: optionalText(20_000),
    locationKa: requiredText(120),
    locationEn: optionalText(120),
    cityKa: requiredText(80),
    cityEn: optionalText(80),
    category: z.enum(CATEGORIES),
    status: z.enum(projectStatus.apiValues as [string, ...string[]]),
    progress: z.number().int().min(0).max(100),
    startDate: isoDate,
    estimatedCompletion: isoDate,
    completionDate: isoDate.nullable(),
    featured: z.boolean(),
    architect: z.string().trim().max(120).default(""),
    coverId: z.uuid(),
    galleryIds: z.array(z.uuid()).max(30).default([]),
    specs: z
      .array(
        z.strictObject({
          labelKa: requiredText(60),
          labelEn: optionalText(60),
          valueKa: requiredText(120),
          valueEn: optionalText(120),
        }),
      )
      .max(20)
      .default([]),
    isPublished: z.boolean(),
    /** Omitted on update = keep the stored values. */
    seo: seoInput.optional(),
  })
  .superRefine((p, ctx) => {
    if (p.estimatedCompletion < p.startDate) {
      ctx.addIssue({ code: "custom", path: ["estimatedCompletion"], message: "before_start" });
    }
    if (p.completionDate && p.completionDate < p.startDate) {
      ctx.addIssue({ code: "custom", path: ["completionDate"], message: "before_start" });
    }
    if (p.status === "completed" && !p.completionDate) {
      ctx.addIssue({ code: "custom", path: ["completionDate"], message: "required_when_completed" });
    }
    if (p.status === "completed" && p.progress !== 100) {
      ctx.addIssue({ code: "custom", path: ["progress"], message: "must_be_100_when_completed" });
    }
    if (new Set(p.galleryIds).size !== p.galleryIds.length) {
      ctx.addIssue({ code: "custom", path: ["galleryIds"], message: "duplicate" });
    }
  });

type ProjectInput = z.output<typeof projectInput>;

const withMedia = {
  cover: true,
  ogImage: true,
  gallery: { orderBy: { position: "asc" }, include: { media: true } },
  specs: { orderBy: { position: "asc" } },
} satisfies Prisma.ProjectInclude;

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof withMedia }>;

function toAdminProject(p: ProjectRow, config: Config) {
  return {
    id: p.id,
    slug: p.slug,
    titleKa: p.titleKa,
    titleEn: p.titleEn,
    summaryKa: p.summaryKa,
    summaryEn: p.summaryEn,
    descriptionKa: p.descriptionKa,
    descriptionEn: p.descriptionEn,
    locationKa: p.locationKa,
    locationEn: p.locationEn,
    cityKa: p.cityKa,
    cityEn: p.cityEn,
    category: p.category,
    status: projectStatus.toApi(p.status),
    progress: p.progress,
    startDate: fromDate(p.startDate),
    estimatedCompletion: fromDate(p.estimatedCompletion),
    completionDate: p.completionDate ? fromDate(p.completionDate) : null,
    featured: p.featured,
    architect: p.architect,
    cover: toImage(p.cover, config),
    gallery: p.gallery.map((g) => toImage(g.media, config)),
    specs: p.specs.map((s) => ({ labelKa: s.labelKa, labelEn: s.labelEn, valueKa: s.valueKa, valueEn: s.valueEn })),
    isPublished: p.isPublished,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    seo: adminSeo(p),
    /** Preview of seo.ogImageId for the editor. */
    ogImage: p.ogImage ? toImage(p.ogImage, config) : null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toCard(p: ProjectRow, config: Config, locale: Locale) {
  return {
    id: p.id,
    slug: p.slug,
    title: pick(p.titleKa, p.titleEn, locale),
    summary: pick(p.summaryKa, p.summaryEn, locale),
    location: pick(p.locationKa, p.locationEn, locale),
    city: pick(p.cityKa, p.cityEn, locale),
    category: p.category,
    status: projectStatus.toApi(p.status),
    progress: p.progress,
    startDate: fromDate(p.startDate),
    estimatedCompletion: fromDate(p.estimatedCompletion),
    completionDate: p.completionDate ? fromDate(p.completionDate) : null,
    featured: p.featured,
    cover: toImage(p.cover, config, locale),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toDetail(p: ProjectRow, config: Config, locale: Locale) {
  return {
    ...toCard(p, config, locale),
    description: pick(p.descriptionKa, p.descriptionEn, locale),
    architect: p.architect,
    specs: p.specs.map((s) => ({ id: s.id, label: pick(s.labelKa, s.labelEn, locale), value: pick(s.valueKa, s.valueEn, locale) })),
    gallery: p.gallery.map((g) => toImage(g.media, config, locale)),
    seo: publicSeo(
      p,
      locale,
      { title: pick(p.titleKa, p.titleEn, locale), description: pick(p.summaryKa, p.summaryEn, locale), image: p.cover },
      config,
    ),
  };
}

function columns(input: ProjectInput) {
  return {
    slug: input.slug,
    titleKa: input.titleKa,
    titleEn: input.titleEn,
    summaryKa: input.summaryKa,
    summaryEn: input.summaryEn,
    descriptionKa: input.descriptionKa,
    descriptionEn: input.descriptionEn,
    locationKa: input.locationKa,
    locationEn: input.locationEn,
    cityKa: input.cityKa,
    cityEn: input.cityEn,
    category: input.category,
    status: projectStatus.fromApi(input.status)!,
    progress: input.progress,
    startDate: toDate(input.startDate),
    estimatedCompletion: toDate(input.estimatedCompletion),
    completionDate: input.completionDate ? toDate(input.completionDate) : null,
    featured: input.featured,
    architect: input.architect,
    coverId: input.coverId,
    isPublished: input.isPublished,
    ...(input.seo ? seoColumns(input.seo) : {}),
  };
}

const children = (input: ProjectInput) => ({
  gallery: { create: input.galleryIds.map((mediaId, position) => ({ mediaId, position })) },
  specs: { create: input.specs.map((s, position) => ({ ...s, position })) },
});

const imagesOf = (input: ProjectInput) => [
  input.coverId,
  ...input.galleryIds,
  ...(input.seo?.ogImageId ? [input.seo.ogImageId] : []),
];

const notFound = () => new AppError(404, "NOT_FOUND", "That project doesn't exist.");

/** Quick changes from the projects list (API_CONTRACTS §6.1). */
const projectPatch = z
  .strictObject({
    status: z.enum(projectStatus.apiValues as [string, ...string[]]).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    featured: z.boolean().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "empty_update" });
const idParam = z.uuid();

export function adminProjectRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const projects = await prisma.project.findMany({ include: withMedia, orderBy: { updatedAt: "desc" } });
    res.json({ items: projects.map((p) => toAdminProject(p, config)) });
  });

  router.get("/:id", async (req, res) => {
    const project = await prisma.project.findUnique({ where: { id: parse(idParam, req.params.id) }, include: withMedia });
    if (!project) throw notFound();
    res.json(toAdminProject(project, config));
  });

  router.post("/", async (req, res) => {
    const input = parse(projectInput, req.body);
    await assertReadyImages(prisma, imagesOf(input));
    try {
      const project = await prisma.project.create({
        data: { ...columns(input), publishedAt: input.isPublished ? new Date() : null, ...children(input) },
        include: withMedia,
      });
      await recordActivity(prisma, { kind: "project", message: `Project created: ${project.titleKa}`, actorId: req.session!.user.id });
      res.status(201).json(toAdminProject(project, config));
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  });

  router.put("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(projectInput, req.body);
    const existing = await prisma.project.findUnique({ where: { id }, select: { slug: true, isPublished: true, publishedAt: true } });
    if (!existing) throw notFound();
    await assertReadyImages(prisma, imagesOf(input));
    try {
      const project = await prisma.$transaction(async (tx) => {
        // Saving replaces the gallery and specs as a whole.
        await tx.projectImage.deleteMany({ where: { projectId: id } });
        await tx.projectSpec.deleteMany({ where: { projectId: id } });
        // A published project's old address keeps working (docs/DATABASE_DESIGN.md §3.12).
        if (existing.isPublished && existing.slug !== input.slug) {
          await recordAddressChange(tx, projectPath(existing.slug), projectPath(input.slug));
        }
        return tx.project.update({
          where: { id },
          data: {
            ...columns(input),
            publishedAt: input.isPublished ? (existing.publishedAt ?? new Date()) : null,
            ...children(input),
          },
          include: withMedia,
        });
      });
      await recordActivity(prisma, { kind: "project", message: `Project updated: ${project.titleKa}`, actorId: req.session!.user.id });
      res.json(toAdminProject(project, config));
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(projectPatch, req.body);
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) throw notFound();
    const status = body.status ? projectStatus.fromApi(body.status)! : existing.status;
    const completed = status === "completed";
    const project = await prisma.project.update({
      where: { id },
      data: {
        status,
        // A completed project is at 100% and has a completion date (the form's rules).
        progress: completed ? 100 : (body.progress ?? existing.progress),
        ...(completed && !existing.completionDate ? { completionDate: toDate(new Date().toISOString().slice(0, 10)) } : {}),
        ...(body.featured !== undefined ? { featured: body.featured } : {}),
        ...(body.isPublished !== undefined
          ? { isPublished: body.isPublished, publishedAt: body.isPublished ? (existing.publishedAt ?? new Date()) : null }
          : {}),
      },
      include: withMedia,
    });
    await recordActivity(prisma, { kind: "project", message: `Project updated: ${project.titleKa}`, actorId: req.session!.user.id });
    res.json(toAdminProject(project, config));
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const deleted = await prisma.project.deleteMany({ where: { id } });
    if (deleted.count === 0) throw notFound();
    await recordActivity(prisma, { kind: "project", message: "Project deleted", actorId: req.session!.user.id });
    res.status(204).end();
  });

  return router;
}

/** Published projects only; anything else is indistinguishable from "not found". */
export function publicProjectRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const projects = await prisma.project.findMany({
      where: { isPublished: true },
      include: withMedia,
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    });
    res.json({ items: projects.map((p) => toCard(p, config, locale)) });
  });

  router.get("/:slug", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const project = await prisma.project.findFirst({
      where: { slug: String(req.params.slug), isPublished: true },
      include: withMedia,
    });
    if (!project) throw notFound();
    res.json(toDetail(project, config, locale));
  });

  return router;
}
