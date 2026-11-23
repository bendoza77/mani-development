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

/** A link a visitor may follow: an internal path (one leading "/") or an https address. */
export const siteLink = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/(?!\/)\S*|https:\/\/[^\s/]+\.\S+)$/, "unsafe_link");

/** Body of a whole-list reorder: every id, in the new order. */
export const orderInput = z.strictObject({ ids: z.array(z.uuid()).max(200) });

/**
 * Checks a reorder request names exactly the stored items (409 ORDER_MISMATCH otherwise), so
 * a stale list from another browser tab can't drop or duplicate anything.
 */
export function assertSameItems(stored: string[], wanted: string[]) {
  const same = stored.length === wanted.length && new Set(wanted).size === wanted.length && wanted.every((id) => stored.includes(id));
  if (!same) throw new AppError(409, "ORDER_MISMATCH", "The list changed meanwhile. Reload and try again.");
}

/** Writes positions 0, 1, 2… in the given order (after a reorder or a delete). */
export async function writePositions(ids: string[], setPosition: (id: string, position: number) => Promise<unknown>) {
  for (const [position, id] of ids.entries()) await setPosition(id, position);
}

export const localeQuery =z.object({ locale: z.enum(["ka", "en"]).default("ka") });

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
