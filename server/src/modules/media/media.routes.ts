import express, { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  IMAGE_TYPES,
  LOCAL_MEDIA_PREFIX,
  MAX_IMAGE_BYTES,
  type ImageType,
  type MediaStorage,
} from "../../integrations/media-storage.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { toMediaAsset } from "./media.serialize.js";

const imageType = z.enum(Object.keys(IMAGE_TYPES) as [ImageType, ...ImageType[]]);

const uploadBody = z.strictObject({
  filename: z.string().trim().min(1).max(255),
  mimeType: imageType,
  bytes: z.number().int().min(1).max(MAX_IMAGE_BYTES),
  category: z.enum(["exterior", "interior", "construction", "team", "uploads"]).optional(),
  altKa: z.string().trim().max(300).optional(),
  altEn: z.string().trim().max(300).optional(),
  altRu: z.string().trim().max(300).optional(),
});

const completeBody = z.strictObject({
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
});

const idParam = z.uuid();

const categoryField = z.enum(["exterior", "interior", "construction", "team", "uploads"]);

const editBody = z
  .strictObject({
    altKa: z.string().trim().max(300).optional(),
    altEn: z.string().trim().max(300).nullish(),
    altRu: z.string().trim().max(300).nullish(),
    category: categoryField.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "empty_update" });

type Usage = { type: string; id: string; label: string; href: string };

/** Every place a photo appears, so the admin knows what to change before deleting it. */
async function usageOf(prisma: PrismaClient, mediaId: string): Promise<Usage[]> {
  const [projects, services, team, slides, pages, blocks, settings] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ coverId: mediaId }, { ogImageId: mediaId }, { gallery: { some: { mediaId } } }] },
      select: { id: true, titleKa: true },
    }),
    prisma.service.findMany({ where: { imageId: mediaId }, select: { id: true, titleKa: true } }),
    prisma.teamMember.findMany({ where: { photoId: mediaId }, select: { id: true, nameKa: true } }),
    prisma.homeSlide.findMany({ where: { imageId: mediaId }, select: { id: true, headingKa: true } }),
    prisma.page.findMany({ where: { ogImageId: mediaId }, select: { id: true, titleKa: true } }),
    prisma.contentBlockMedia.findMany({
      where: { mediaId },
      select: { block: { select: { page: { select: { id: true, titleKa: true } }, project: { select: { id: true, titleKa: true } } } } },
    }),
    prisma.siteSettings.count({ where: { defaultOgImageId: mediaId } }),
  ]);
  const found = new Map<string, Usage>();
  const add = (u: Usage) => found.set(`${u.type}:${u.id}`, u);
  for (const p of projects) add({ type: "project", id: p.id, label: p.titleKa, href: `/admin/projects/${p.id}/edit` });
  for (const s of services) add({ type: "service", id: s.id, label: s.titleKa, href: "/admin/services" });
  for (const m of team) add({ type: "team", id: m.id, label: m.nameKa, href: "/admin/team" });
  for (const s of slides) add({ type: "slide", id: s.id, label: s.headingKa, href: "/admin/slider" });
  for (const p of pages) add({ type: "page", id: p.id, label: p.titleKa, href: `/admin/pages/${p.id}/edit` });
  for (const { block } of blocks) {
    if (block.page) add({ type: "page", id: block.page.id, label: block.page.titleKa, href: `/admin/pages/${block.page.id}/edit` });
    if (block.project) add({ type: "project", id: block.project.id, label: block.project.titleKa, href: `/admin/projects/${block.project.id}/edit` });
  }
  if (settings > 0) add({ type: "settings", id: "settings", label: "Site settings (default share image)", href: "/admin/settings" });
  return [...found.values()];
}

/** The first bytes of each accepted format, so a renamed file of another kind is refused. */
function looksLike(type: ImageType, bytes: Buffer): boolean {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString("latin1");
  switch (type) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "image/avif":
      return ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12));
  }
}

const notFound = () => new AppError(404, "NOT_FOUND", "That photo doesn't exist.");

/** /api/admin/media (docs/API_CONTRACTS.md §6.7). Behind requireAdmin. */
export function mediaRoutes({ config, prisma, storage }: { config: Config; prisma: PrismaClient; storage: MediaStorage }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const { category } = parse(z.object({ category: categoryField.optional() }), req.query);
    const assets = await prisma.mediaAsset.findMany({
      where: { status: "READY", kind: "IMAGE", ...(category ? { category } : {}) },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ items: assets.map((a) => toMediaAsset(a, config)) });
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(editBody, req.body);
    const data = {
      ...(body.altKa !== undefined ? { altKa: body.altKa } : {}),
      ...(body.altEn !== undefined ? { altEn: body.altEn || null } : {}),
      ...(body.altRu !== undefined ? { altRu: body.altRu || null } : {}),
      ...(body.category ? { category: body.category } : {}),
    };
    if ((await prisma.mediaAsset.updateMany({ where: { id, status: "READY" }, data })).count === 0) throw notFound();
    res.json(toMediaAsset(await prisma.mediaAsset.findUniqueOrThrow({ where: { id } }), config));
  });

  router.get("/:id/usage", async (req, res) => {
    const id = parse(idParam, req.params.id);
    if (!(await prisma.mediaAsset.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
    res.json({ usedBy: await usageOf(prisma, id) });
  });

  /** A photo in use can't be deleted (the pages using it would break); the answer lists where it is used. */
  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw notFound();
    const usedBy = await usageOf(prisma, id);
    if (usedBy.length > 0) {
      throw new AppError(409, "MEDIA_IN_USE", "This photo is still used. Remove it from those places first.", { usedBy });
    }
    try {
      await prisma.mediaAsset.delete({ where: { id } });
    } catch (error) {
      // Linked by something in the meantime: the database's RESTRICT rule refused the delete.
      if (error instanceof Error && "code" in error && error.code === "P2003") {
        throw new AppError(409, "MEDIA_IN_USE", "This photo is still used. Remove it from those places first.", {
          usedBy: await usageOf(prisma, id),
        });
      }
      throw error;
    }
    // After the row is gone: a failure here leaves an orphan file, never a broken page.
    await storage.remove(asset.providerKey).catch(() => undefined);
    await recordActivity(prisma, { kind: "media", message: `Photo deleted: ${asset.filename}`, actorId: req.session!.user.id });
    res.status(204).end();
  });

  router.post("/uploads", async (req, res) => {
    const body = parse(uploadBody, req.body);
    const asset = await prisma.mediaAsset.create({
      data: {
        provider: storage.provider,
        // Replaced right below, once the storage has given the real key.
        providerKey: `pending/${crypto.randomUUID()}`,
        status: "PENDING",
        filename: body.filename,
        mimeType: body.mimeType,
        bytes: body.bytes,
        category: body.category ?? "uploads",
        altKa: body.altKa ?? "",
        altEn: body.altEn || null,
        altRu: body.altRu || null,
        width: 1,
        height: 1,
        uploadedById: req.session!.user.id,
      },
    });
    try {
      const target = await storage.createUpload(asset.id, body.mimeType);
      await prisma.mediaAsset.update({ where: { id: asset.id }, data: { providerKey: target.providerKey } });
      res.status(201).json({ id: asset.id, uploadUrl: target.uploadUrl, uploadMethod: target.uploadMethod });
    } catch (error) {
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
      throw error;
    }
  });

  // The local storage's upload URL: the raw file bytes, with the image type as Content-Type.
  router.post(
    "/:id/file",
    express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
      if (!storage.saveLocal) throw notFound();
      const id = parse(idParam, req.params.id);
      const asset = await prisma.mediaAsset.findUnique({ where: { id } });
      if (!asset || asset.status !== "PENDING" || !asset.providerKey.startsWith(LOCAL_MEDIA_PREFIX)) throw notFound();

      const bytes = req.body as unknown;
      const type = asset.mimeType as ImageType;
      if (!Buffer.isBuffer(bytes) || bytes.length === 0 || !req.is(type) || !looksLike(type, bytes)) {
        throw new AppError(400, "VALIDATION_FAILED", "The file isn't the image type that was announced.", {
          fieldErrors: { file: [{ code: "invalid_image" }] },
        });
      }
      await storage.saveLocal(asset.providerKey, bytes);
      await prisma.mediaAsset.update({ where: { id }, data: { bytes: bytes.length } });
      res.status(204).end();
    },
  );

  router.post("/:id/complete", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { width, height } = parse(completeBody, req.body);
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw notFound();
    if (asset.status === "READY") {
      res.json(toMediaAsset(asset, config));
      return;
    }
    if (!(await storage.isUploaded(asset.providerKey))) {
      throw new AppError(409, "UPLOAD_NOT_FINISHED", "The photo hasn't finished uploading yet.");
    }
    const ready = await prisma.mediaAsset.update({ where: { id }, data: { status: "READY", width, height } });
    await recordActivity(prisma, {
      kind: "media",
      message: `Photo uploaded: ${ready.filename}`,
      actorId: req.session!.user.id,
    });
    res.json(toMediaAsset(ready, config));
  });

  return router;
}
