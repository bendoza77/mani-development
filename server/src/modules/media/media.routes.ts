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
});

const completeBody = z.strictObject({
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
});

const idParam = z.uuid();

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

  router.get("/", async (_req, res) => {
    const assets = await prisma.mediaAsset.findMany({
      where: { status: "READY", kind: "IMAGE" },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ items: assets.map((a) => toMediaAsset(a, config)) });
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
