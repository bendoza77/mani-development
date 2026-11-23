import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
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
    res.json(reviews.map((r) => ({ id: r.id, fullName: r.fullName, text: r.text, rating: r.rating, createdAt: r.createdAt.toISOString() })));
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
