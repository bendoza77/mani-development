import { z } from "zod";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { isReservedSlug } from "../../lib/slug.js";

/** Field rules shared by projects and pages (docs/DATABASE_DESIGN.md §3 limits). */

export const requiredText = (max: number) => z.string().trim().min(1).max(max);

/** Optional English text: empty becomes null, which means "use the Georgian". */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), { message: "invalid date" });

export const slugField = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const localeQuery = z.object({ locale: z.enum(["ka", "en"]).default("ka") });

export const toDate = (value: string) => new Date(`${value}T00:00:00Z`);
export const fromDate = (value: Date) => value.toISOString().slice(0, 10);

export function fieldError(field: string, code: string): AppError {
  return new AppError(400, "VALIDATION_FAILED", "Request validation failed.", { fieldErrors: { [field]: [{ code }] } });
}

export const slugTaken = () => new AppError(409, "SLUG_TAKEN", "That web address is already used.");

/** A page slug may not take over a fixed site address such as /admin or /projects. */
export function assertPageSlugAllowed(slug: string) {
  if (isReservedSlug(slug)) throw fieldError("slug", "reserved_slug");
}

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Every referenced photo must exist and be fully uploaded (422 INVALID_REFERENCE otherwise). */
export async function assertReadyImages(prisma: Pick<PrismaClient, "mediaAsset">, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const found = await prisma.mediaAsset.count({ where: { id: { in: unique }, status: "READY", kind: "IMAGE" } });
  if (found !== unique.length) {
    throw new AppError(422, "INVALID_REFERENCE", "A chosen photo is missing or hasn't finished uploading.");
  }
}
