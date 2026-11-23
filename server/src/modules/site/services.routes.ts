import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { PrismaClient, Service, MediaAsset } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { slugify } from "../../lib/slug.js";
import { parse } from "../../lib/validate.js";
import {
  assertReadyImages,
  assertSameItems,
  isUniqueViolation,
  localeQuery,
  optionalText,
  orderInput,
  slugField,
  slugTaken,
  writePositions,
} from "../content/fields.js";
import { pick, pickList, toImage, type Locale } from "../media/media.serialize.js";

/** Company services (docs/API_CONTRACTS.md §6.2), shown on the services page and the homepage. */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const features = z.array(z.string().trim().min(1).max(100)).max(12).default([]);

const serviceInput = z.strictObject({
  slug: slugField.nullish(),
  titleKa: text(3, 80),
  titleEn: optionalText(80),
  summaryKa: text(10, 200),
  summaryEn: optionalText(200),
  descriptionKa: text(20, 2000),
  descriptionEn: optionalText(2000),
  featuresKa: features,
  featuresEn: features,
  imageId: z.uuid(),
  visible: z.boolean(),
});

type Row = Service & { image: MediaAsset };

const toAdmin = (s: Row, config: Config) => ({
  id: s.id,
  slug: s.slug,
  titleKa: s.titleKa,
  titleEn: s.titleEn,
  summaryKa: s.summaryKa,
  summaryEn: s.summaryEn,
  descriptionKa: s.descriptionKa,
  descriptionEn: s.descriptionEn,
  featuresKa: s.featuresKa,
  featuresEn: s.featuresEn,
  imageId: s.imageId,
  image: toImage(s.image, config),
  visible: s.visible,
  position: s.position,
  updatedAt: s.updatedAt.toISOString(),
});

const toPublic = (s: Row, config: Config, locale: Locale) => ({
  id: s.id,
  slug: s.slug,
  title: pick(s.titleKa, s.titleEn, s.titleRu, locale),
  summary: pick(s.summaryKa, s.summaryEn, s.summaryRu, locale),
  description: pick(s.descriptionKa, s.descriptionEn, s.descriptionRu, locale),
  features: pickList(s.featuresKa, s.featuresEn, s.featuresRu, locale),
  image: toImage(s.image, config, locale),
});

const notFound = () => new AppError(404, "NOT_FOUND", "That service doesn't exist.");
const idParam = z.uuid();
const include = { image: true } as const;

export function adminServiceRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();
  const list = async () =>
    (await prisma.service.findMany({ include, orderBy: { position: "asc" } })).map((s) => toAdmin(s, config));

  const columns = (input: z.output<typeof serviceInput>) => {
    const slug = input.slug || slugify(input.titleKa) || slugify(input.titleEn ?? "");
    if (!slug) throw new AppError(400, "VALIDATION_FAILED", "Request validation failed.", { fieldErrors: { slug: [{ code: "required" }] } });
    return { ...input, slug };
  };

  router.get("/", async (_req, res) => {
    res.json({ items: await list() });
  });

  router.put("/order", async (req, res) => {
    const { ids } = parse(orderInput, req.body);
    await prisma.$transaction(async (tx) => {
      const stored = await tx.service.findMany({ select: { id: true } });
      assertSameItems(stored.map((s) => s.id), ids);
      await writePositions(ids, (id, position) => tx.service.update({ where: { id }, data: { position } }));
    });
    await recordActivity(prisma, { kind: "service", message: "Services reordered", actorId: req.session!.user.id });
    res.json({ items: await list() });
  });

  router.post("/", async (req, res) => {
    const input = parse(serviceInput, req.body);
    await assertReadyImages(prisma, [input.imageId]);
    try {
      const service = await prisma.$transaction(async (tx) => {
        const last = await tx.service.aggregate({ _max: { position: true } });
        return tx.service.create({ data: { ...columns(input), position: (last._max.position ?? -1) + 1 }, include });
      });
      await recordActivity(prisma, { kind: "service", message: `Service created: ${service.titleKa}`, actorId: req.session!.user.id });
      res.status(201).json(toAdmin(service, config));
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  });

  router.put("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(serviceInput, req.body);
    await assertReadyImages(prisma, [input.imageId]);
    if (!(await prisma.service.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
    try {
      const service = await prisma.service.update({ where: { id }, data: columns(input), include });
      await recordActivity(prisma, { kind: "service", message: `Service updated: ${service.titleKa}`, actorId: req.session!.user.id });
      res.json(toAdmin(service, config));
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { visible } = parse(z.strictObject({ visible: z.boolean() }), req.body);
    const updated = await prisma.service.updateMany({ where: { id }, data: { visible } });
    if (updated.count === 0) throw notFound();
    const service = await prisma.service.findUniqueOrThrow({ where: { id }, include });
    await recordActivity(prisma, {
      kind: "service",
      message: `Service ${visible ? "shown" : "hidden"}: ${service.titleKa}`,
      actorId: req.session!.user.id,
    });
    res.json(toAdmin(service, config));
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const deleted = await prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({ where: { id } });
      if (!service) return null;
      await tx.service.delete({ where: { id } });
      const rest = await tx.service.findMany({ select: { id: true }, orderBy: { position: "asc" } });
      await writePositions(rest.map((s) => s.id), (sid, position) => tx.service.update({ where: { id: sid }, data: { position } }));
      return service;
    });
    if (!deleted) throw notFound();
    await recordActivity(prisma, { kind: "service", message: `Service deleted: ${deleted.titleKa}`, actorId: req.session!.user.id });
    res.status(204).end();
  });

  return router;
}

export function publicServiceRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const services = await prisma.service.findMany({ where: { visible: true }, include, orderBy: { position: "asc" } });
    res.json({ items: services.map((s) => toPublic(s, config, locale)) });
  });
  return router;
}
