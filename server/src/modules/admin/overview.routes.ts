import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { Clock } from "../../lib/clock.js";
import { inquiryStatus, projectStatus } from "../../lib/enum-map.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";

/** Notifications, activity, dashboard and search (docs/API_CONTRACTS.md §6.6). */

const toActivity = (a: { id: string; kind: string; message: string; createdAt: Date }) => ({
  id: a.id,
  kind: a.kind,
  message: a.message,
  at: a.createdAt.toISOString(),
});

const toInquirySummary = (i: { id: string; name: string; email: string; phone: string | null; subject: string; message: string; status: Parameters<typeof inquiryStatus.toApi>[0]; createdAt: Date }) => ({
  id: i.id,
  name: i.name,
  email: i.email,
  phone: i.phone,
  subject: i.subject,
  message: i.message,
  status: inquiryStatus.toApi(i.status),
  createdAt: i.createdAt.toISOString(),
});

/** "2026-11" for a date, in UTC. */
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** The last `count` calendar months in UTC, oldest first, ending with the month of `now`. */
export function lastMonths(now: Date, count: number): string[] {
  const months: string[] = [];
  for (let back = count - 1; back >= 0; back--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))));
  }
  return months;
}

export function notificationRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
        include: { inquiry: { select: { name: true, subject: true } } },
      }),
      prisma.notification.count({ where: { read: false } }),
    ]);
    res.json({
      unread,
      // Text is built from the inquiry now, so it can never go stale (DATABASE_DESIGN §3.6).
      items: items.map((n) => ({
        id: n.id,
        title: "New inquiry",
        body: `${n.inquiry.name}: ${n.inquiry.subject}`,
        href: `/admin/inquiries?id=${n.inquiryId}`,
        at: n.createdAt.toISOString(),
        read: n.read,
      })),
    });
  });

  router.post("/read", async (req, res) => {
    const body = parse(z.union([z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) }), z.strictObject({ all: z.literal(true) })]), req.body);
    await prisma.notification.updateMany({ where: "ids" in body ? { id: { in: body.ids } } : {}, data: { read: true } });
    res.status(204).end();
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await prisma.notification.deleteMany({ where: { id: parse(z.uuid(), req.params.id) } });
    if (deleted.count === 0) throw new AppError(404, "NOT_FOUND", "That notification doesn't exist.");
    res.status(204).end();
  });

  return router;
}

const recentActivity = (prisma: PrismaClient, take: number) =>
  prisma.activityLog.findMany({ where: { kind: { not: "auth" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take });

export function activityRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(12) }), req.query);
    res.json({ items: (await recentActivity(prisma, limit)).map(toActivity) });
  });
  return router;
}

export function dashboardRoutes({ prisma, clock }: { prisma: PrismaClient; clock: Clock }) {
  const router = Router();
  router.get("/", async (_req, res) => {
    const months = lastMonths(clock.now(), 6);
    const since = new Date(`${months[0]}-01T00:00:00Z`);
    const [projectGroups, inquiryGroups, recentDates, recentInquiries, recentProjects, activity] = await Promise.all([
      prisma.project.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.inquiry.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.inquiry.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.inquiry.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5 }),
      prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, titleKa: true, locationKa: true, progress: true, status: true, updatedAt: true },
      }),
      recentActivity(prisma, 12),
    ]);

    const projectsByStatus = { planning: 0, "in-progress": 0, completed: 0, "on-hold": 0 };
    for (const g of projectGroups) projectsByStatus[projectStatus.toApi(g.status)] = g._count._all;
    const inquiriesByStatus = { new: 0, "in-progress": 0, resolved: 0 };
    for (const g of inquiryGroups) inquiriesByStatus[inquiryStatus.toApi(g.status)] = g._count._all;
    const perMonth = new Map(months.map((m) => [m, 0]));
    for (const { createdAt } of recentDates) {
      const key = monthKey(createdAt);
      if (perMonth.has(key)) perMonth.set(key, perMonth.get(key)! + 1);
    }
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

    res.json({
      projects: { total: sum(projectsByStatus), byStatus: projectsByStatus },
      inquiries: {
        total: sum(inquiriesByStatus),
        byStatus: inquiriesByStatus,
        perMonth: [...perMonth].map(([month, count]) => ({ month, count })),
      },
      recentInquiries: recentInquiries.map(toInquirySummary),
      recentProjects: recentProjects.map((p) => ({
        id: p.id,
        title: p.titleKa,
        location: p.locationKa,
        progress: p.progress,
        status: projectStatus.toApi(p.status),
        updatedAt: p.updatedAt.toISOString(),
      })),
      activity: activity.map(toActivity),
    });
  });
  return router;
}

const MAX_RESULTS = 8;

export function searchRoutes({ prisma }: { prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { q } = parse(z.object({ q: z.string().trim().min(2).max(100) }), req.query);
    const has = { contains: q, mode: "insensitive" as const };
    const [projects, inquiries, services, team] = await Promise.all([
      prisma.project.findMany({
        where: { OR: [{ titleKa: has }, { titleEn: has }, { titleRu: has }, { slug: has }, { locationKa: has }, { cityKa: has }] },
        orderBy: { updatedAt: "desc" },
        take: MAX_RESULTS,
      }),
      prisma.inquiry.findMany({
        where: { OR: [{ name: has }, { email: has }, { subject: has }] },
        orderBy: { createdAt: "desc" },
        take: MAX_RESULTS,
      }),
      prisma.service.findMany({ where: { OR: [{ titleKa: has }, { titleEn: has }, { titleRu: has }] }, orderBy: { position: "asc" }, take: MAX_RESULTS }),
      prisma.teamMember.findMany({ where: { OR: [{ nameKa: has }, { nameEn: has }, { nameRu: has }] }, orderBy: { position: "asc" }, take: MAX_RESULTS }),
    ]);
    const items = [
      ...projects.map((p) => ({ type: "project", id: p.id, label: p.titleKa, meta: p.cityKa, href: `/admin/projects/${p.id}/edit` })),
      ...inquiries.map((i) => ({ type: "inquiry", id: i.id, label: i.name, meta: i.subject, href: `/admin/inquiries?id=${i.id}` })),
      ...services.map((s) => ({ type: "service", id: s.id, label: s.titleKa, meta: "", href: `/admin/services` })),
      ...team.map((m) => ({ type: "team", id: m.id, label: m.nameKa, meta: m.roleKa, href: `/admin/team` })),
    ].slice(0, MAX_RESULTS);
    res.json({ items });
  });
  return router;
}
