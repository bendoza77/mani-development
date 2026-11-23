import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { HomeSlide, MediaAsset, PrismaClient } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import {
  assertReadyImages,
  assertSameItems,
  localeQuery,
  optionalText,
  orderInput,
  siteLink,
  writePositions,
} from "../content/fields.js";
import { pick, toImage, type Locale } from "../media/media.serialize.js";

/** Homepage slider (docs/API_CONTRACTS.md §8.5). */

const MAX_SLIDES = 8;

const slideInput = z
  .strictObject({
    imageId: z.uuid(),
    headingKa: z.string().trim().min(1).max(120),
    headingEn: optionalText(120),
    textKa: z.string().trim().max(300).nullish().transform((v) => v ?? ""),
    textEn: optionalText(300),
    ctaLabelKa: z.string().trim().max(40).nullish().transform((v) => v ?? ""),
    ctaLabelEn: optionalText(40),
    ctaUrl: z.union([z.literal(""), siteLink]).nullish().transform((v) => v ?? ""),
    isPublished: z.boolean(),
  })
  .refine((s) => !s.ctaLabelKa === !s.ctaUrl, { path: ["ctaUrl"], message: "button_needs_label_and_link" });

type Row = HomeSlide & { image: MediaAsset };

const toAdmin = (s: Row, config: Config) => ({
  id: s.id,
  imageId: s.imageId,
  image: toImage(s.image, config),
  headingKa: s.headingKa,
  headingEn: s.headingEn,
  textKa: s.textKa,
  textEn: s.textEn,
  ctaLabelKa: s.ctaLabelKa,
  ctaLabelEn: s.ctaLabelEn,
  ctaUrl: s.ctaUrl,
  isPublished: s.isPublished,
  position: s.position,
  updatedAt: s.updatedAt.toISOString(),
});

const toPublic = (s: Row, config: Config, locale: Locale) => ({
  id: s.id,
  image: toImage(s.image, config, locale),
  heading: pick(s.headingKa, s.headingEn, locale),
  text: pick(s.textKa, s.textEn, locale),
  cta: s.ctaUrl ? { label: pick(s.ctaLabelKa, s.ctaLabelEn, locale), href: s.ctaUrl } : null,
});

const notFound = () => new AppError(404, "NOT_FOUND", "That slide doesn't exist.");
const idParam = z.uuid();
const include = { image: true } as const;

export function adminSlideRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();
  const list = async () =>
    (await prisma.homeSlide.findMany({ include, orderBy: { position: "asc" } })).map((s) => toAdmin(s, config));
  const actor = (req: { session?: { user: { id: string } } }) => req.session!.user.id;

  router.get("/", async (_req, res) => {
    res.json({ items: await list() });
  });

  router.put("/order", async (req, res) => {
    const { ids } = parse(orderInput, req.body);
    await prisma.$transaction(async (tx) => {
      const stored = await tx.homeSlide.findMany({ select: { id: true } });
      assertSameItems(stored.map((s) => s.id), ids);
      await writePositions(ids, (id, position) => tx.homeSlide.update({ where: { id }, data: { position } }));
    });
    await recordActivity(prisma, { kind: "slide", message: "Slides reordered", actorId: actor(req) });
    res.json({ items: await list() });
  });

  router.post("/", async (req, res) => {
    const input = parse(slideInput, req.body);
    await assertReadyImages(prisma, [input.imageId]);
    const slide = await prisma.$transaction(async (tx) => {
      const count = await tx.homeSlide.count();
      if (count >= MAX_SLIDES) throw new AppError(409, "SLIDE_LIMIT", `The slider holds at most ${MAX_SLIDES} slides.`);
      const last = await tx.homeSlide.aggregate({ _max: { position: true } });
      return tx.homeSlide.create({ data: { ...input, position: (last._max.position ?? -1) + 1 }, include });
    });
    await recordActivity(prisma, { kind: "slide", message: `Slide added: ${slide.headingKa}`, actorId: actor(req) });
    res.status(201).json(toAdmin(slide, config));
  });

  router.put("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(slideInput, req.body);
    await assertReadyImages(prisma, [input.imageId]);
    if (!(await prisma.homeSlide.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
    const slide = await prisma.homeSlide.update({ where: { id }, data: input, include });
    await recordActivity(prisma, { kind: "slide", message: `Slide updated: ${slide.headingKa}`, actorId: actor(req) });
    res.json(toAdmin(slide, config));
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { isPublished } = parse(z.strictObject({ isPublished: z.boolean() }), req.body);
    if ((await prisma.homeSlide.updateMany({ where: { id }, data: { isPublished } })).count === 0) throw notFound();
    const slide = await prisma.homeSlide.findUniqueOrThrow({ where: { id }, include });
    await recordActivity(prisma, {
      kind: "slide",
      message: `Slide ${isPublished ? "published" : "unpublished"}: ${slide.headingKa}`,
      actorId: actor(req),
    });
    res.json(toAdmin(slide, config));
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const deleted = await prisma.$transaction(async (tx) => {
      const slide = await tx.homeSlide.findUnique({ where: { id } });
      if (!slide) return null;
      await tx.homeSlide.delete({ where: { id } });
      const rest = await tx.homeSlide.findMany({ select: { id: true }, orderBy: { position: "asc" } });
      await writePositions(rest.map((s) => s.id), (sid, position) => tx.homeSlide.update({ where: { id: sid }, data: { position } }));
      return slide;
    });
    if (!deleted) throw notFound();
    await recordActivity(prisma, { kind: "slide", message: `Slide deleted: ${deleted.headingKa}`, actorId: actor(req) });
    res.status(204).end();
  });

  return router;
}

export function publicSlideRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const slides = await prisma.homeSlide.findMany({ where: { isPublished: true }, include, orderBy: { position: "asc" } });
    res.json({ items: slides.map((s) => toPublic(s, config, locale)) });
  });
  return router;
}
