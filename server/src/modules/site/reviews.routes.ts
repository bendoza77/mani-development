import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { Prisma, PrismaClient, ReviewStatus } from "../../generated/prisma/client.js";
import type { SpamCheck } from "../../integrations/turnstile.js";
import { recordActivity } from "../../lib/activity.js";
import type { Clock } from "../../lib/clock.js";
import { reviewStatus } from "../../lib/enum-map.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { LOCALES } from "../media/media.serialize.js";

/** Visitor reviews: the public form and the list of approved ones. */

const PUBLIC_LIMIT = 30;

const reviewInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  text: z.string().trim().min(20).max(1000),
  rating: z.number().int().min(1).max(5),
  locale: z.enum(LOCALES).default("ka"),
  turnstileToken: z.string().max(2048).optional(),
});

export function publicReviewRoutes({
  prisma,
  clock,
  spamCheck,
  limiters,
}: {
  prisma: PrismaClient;
  clock: Clock;
  spamCheck: SpamCheck | null;
  limiters: RequestHandler[];
}) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const reviews = await prisma.review.findMany({
      where: { status: reviewStatus.fromApi("approved") },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PUBLIC_LIMIT,
    });
    res.json({
      items: reviews.map((r) => ({ id: r.id, fullName: r.fullName, text: r.text, rating: r.rating, createdAt: r.createdAt.toISOString() })),
    });
  });

  router.post("/", ...limiters, async (req, res) => {
    // Honeypot: a hidden field people never fill in. Bots get the same answer, and nothing is kept.
    const honeypot = (req.body as { website?: unknown } | undefined)?.website;
    if (typeof honeypot === "string" && honeypot.trim() !== "") {
      res.status(201).json({ received: true });
      return;
    }
    const input = parse(reviewInput, req.body);
    if (spamCheck && !(await spamCheck(input.turnstileToken, req.ip))) {
      throw new AppError(403, "SPAM_CHECK_FAILED", "The spam check failed. Please try again.");
    }

    const now = clock.now();
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: { fullName: input.fullName, text: input.text, rating: input.rating, locale: input.locale, createdAt: now },
      });
      await recordActivity(tx, { kind: "review", message: `New review from ${input.fullName}`, at: now });
    });
    res.status(201).json({ received: true });
  });

  return router;
}

const idParam = z.uuid();
const notFound = () => new AppError(404, "NOT_FOUND", "That review doesn't exist.");
const statusValues = reviewStatus.apiValues as [string, ...string[]];

const toAdmin = (r: Prisma.ReviewGetPayload<object>) => ({
  id: r.id,
  fullName: r.fullName,
  text: r.text,
  rating: r.rating,
  locale: r.locale,
  status: reviewStatus.toApi(r.status),
  reviewedAt: r.reviewedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

const ACTIVITY: Record<string, string> = { approved: "approved", rejected: "hidden", pending: "moved back to waiting" };

export function adminReviewRoutes({ prisma, clock }: { prisma: PrismaClient; clock: Clock }) {
  const router = Router();
  const actor = (req: { session?: { user: { id: string } } }) => req.session!.user.id;

  router.get("/", async (req, res) => {
    const query = parse(z.object({ status: z.enum(statusValues).optional() }), req.query);
    const [items, grouped] = await Promise.all([
      prisma.review.findMany({
        where: query.status ? { status: reviewStatus.fromApi(query.status) as ReviewStatus } : {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const row of grouped) {
      counts[reviewStatus.toApi(row.status) as keyof typeof counts] = row._count._all;
      counts.all += row._count._all;
    }
    res.json({ items: items.map(toAdmin), counts });
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { status } = parse(z.strictObject({ status: z.enum(statusValues) }), req.body);
    const updated = await prisma.review.updateMany({
      where: { id },
      data: { status: reviewStatus.fromApi(status) as ReviewStatus, reviewedAt: clock.now() },
    });
    if (updated.count === 0) throw notFound();
    const review = await prisma.review.findUniqueOrThrow({ where: { id } });
    await recordActivity(prisma, { kind: "review", message: `Review ${ACTIVITY[status]}: ${review.fullName}`, actorId: actor(req) });
    res.json(toAdmin(review));
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const review = await prisma.review.findUnique({ where: { id }, select: { fullName: true } });
    if (!review) throw notFound();
    await prisma.review.delete({ where: { id } });
    await recordActivity(prisma, { kind: "review", message: `Review deleted: ${review.fullName}`, actorId: actor(req) });
    res.status(204).end();
  });

  return router;
}
