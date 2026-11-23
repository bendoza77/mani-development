import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { InquiryStatus, Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { SpamCheck } from "../../integrations/turnstile.js";
import { recordActivity } from "../../lib/activity.js";
import type { Clock } from "../../lib/clock.js";
import { inquiryStatus } from "../../lib/enum-map.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { LOCALES } from "../media/media.serialize.js";
import { INQUIRY_NOTIFICATION } from "./emails.js";

/** The contact form (docs/API_CONTRACTS.md §5) and the admin inbox (§6.5). */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const inquiryInput = z.object({
  name: text(2, 100),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || (/^[\d\s+()-]+$/.test(v) && v.replace(/\D/g, "").length >= 7), { message: "invalid_phone" })
    .nullish()
    .transform((v) => v || null),
  subject: text(3, 120),
  message: text(20, 5000),
  locale: z.enum(LOCALES).default("ka"),
  turnstileToken: z.string().max(2048).optional(),
});

type InquiryRow = Prisma.InquiryGetPayload<object>;

const toSummary = (i: InquiryRow) => ({
  id: i.id,
  name: i.name,
  email: i.email,
  phone: i.phone,
  subject: i.subject,
  message: i.message,
  status: inquiryStatus.toApi(i.status),
  createdAt: i.createdAt.toISOString(),
});

const toNote = (n: { id: string; text: string; createdAt: Date }) => ({ id: n.id, text: n.text, createdAt: n.createdAt.toISOString() });

/** A visitor's message: one transaction stores it, notifies the admin and queues the email. */
export function publicInquiryRoutes({
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

  router.post("/", ...limiters, async (req, res) => {
    // Honeypot: a hidden field people never fill in. Bots get the same answer, and nothing is kept.
    const honeypot = (req.body as { website?: unknown } | undefined)?.website;
    if (typeof honeypot === "string" && honeypot.trim() !== "") {
      res.status(201).json({ received: true });
      return;
    }
    // Unknown fields (including the empty honeypot) are dropped by the schema.
    const input = parse(inquiryInput, req.body);
    if (spamCheck && !(await spamCheck(input.turnstileToken, req.ip))) {
      throw new AppError(403, "SPAM_CHECK_FAILED", "The spam check failed. Please try again.");
    }

    const now = clock.now();
    await prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({
        data: { name: input.name, email: input.email, phone: input.phone, subject: input.subject, message: input.message, createdAt: now },
      });
      await tx.notification.create({ data: { type: "NEW_INQUIRY", inquiryId: inquiry.id, createdAt: now } });
      await recordActivity(tx, { kind: "inquiry", message: `New inquiry from ${inquiry.name}`, at: now });
      const settings = await tx.siteSettings.findUniqueOrThrow({ where: { id: 1 }, select: { email: true } });
      // Only the id is queued: the email is built from the inquiry when it is sent.
      await tx.emailMessage.create({
        data: { recipient: settings.email, template: INQUIRY_NOTIFICATION, locale: input.locale, payload: { inquiryId: inquiry.id }, nextAttemptAt: now },
      });
    });
    res.status(201).json({ received: true });
  });

  return router;
}

const listQuery = z.object({
  status: z.enum(inquiryStatus.apiValues as [string, ...string[]]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const idParam = z.uuid();
const notFound = () => new AppError(404, "NOT_FOUND", "That inquiry doesn't exist.");

export function adminInquiryRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  const actor = (req: { session?: { user: { id: string } } }) => req.session!.user.id;

  router.get("/", async (req, res) => {
    const query = parse(listQuery, req.query);
    const search: Prisma.InquiryWhereInput = query.q
      ? {
          OR: (["name", "email", "subject", "message"] as const).map((field) => ({
            [field]: { contains: query.q, mode: "insensitive" },
          })),
        }
      : {};
    const where: Prisma.InquiryWhereInput = {
      ...search,
      ...(query.status ? { status: inquiryStatus.fromApi(query.status) } : {}),
    };
    const [items, total, grouped] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.inquiry.count({ where }),
      prisma.inquiry.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
    ]);
    const counts = { all: 0, new: 0, "in-progress": 0, resolved: 0 };
    for (const row of grouped) {
      counts[inquiryStatus.toApi(row.status)] = row._count._all;
      counts.all += row._count._all;
    }
    res.json({ items: items.map(toSummary), page: query.page, pageSize: query.pageSize, total, counts });
  });

  router.get("/:id", async (req, res) => {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: parse(idParam, req.params.id) },
      include: { notes: { orderBy: { createdAt: "asc" } } },
    });
    if (!inquiry) throw notFound();
    res.json({ ...toSummary(inquiry), notes: inquiry.notes.map(toNote) });
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { status } = parse(z.strictObject({ status: z.enum(inquiryStatus.apiValues as [string, ...string[]]) }), req.body);
    const updated = await prisma.inquiry.updateMany({ where: { id }, data: { status: inquiryStatus.fromApi(status) as InquiryStatus } });
    if (updated.count === 0) throw notFound();
    const inquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id }, include: { notes: { orderBy: { createdAt: "asc" } } } });
    await recordActivity(prisma, { kind: "inquiry", message: `Inquiry from ${inquiry.name} marked ${status}`, actorId: actor(req) });
    res.json({ ...toSummary(inquiry), notes: inquiry.notes.map(toNote) });
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const inquiry = await prisma.inquiry.findUnique({ where: { id }, select: { name: true } });
    if (!inquiry) throw notFound();
    await prisma.inquiry.delete({ where: { id } });
    await recordActivity(prisma, { kind: "inquiry", message: `Inquiry from ${inquiry.name} deleted`, actorId: actor(req) });
    res.status(204).end();
  });

  router.post("/:id/notes", async (req, res) => {
    const inquiryId = parse(idParam, req.params.id);
    const { text: noteText } = parse(z.strictObject({ text: text(1, 2000) }), req.body);
    if (!(await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { id: true } }))) throw notFound();
    const note = await prisma.inquiryNote.create({ data: { inquiryId, text: noteText } });
    res.status(201).json(toNote(note));
  });

  router.delete("/:id/notes/:noteId", async (req, res) => {
    const inquiryId = parse(idParam, req.params.id);
    const noteId = parse(idParam, req.params.noteId);
    const deleted = await prisma.inquiryNote.deleteMany({ where: { id: noteId, inquiryId } });
    if (deleted.count === 0) throw new AppError(404, "NOT_FOUND", "That note doesn't exist.");
    res.status(204).end();
  });

  return router;
}
