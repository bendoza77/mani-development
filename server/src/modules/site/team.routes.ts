import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { MediaAsset, PrismaClient, TeamMember } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { assertReadyImages, assertSameItems, localeQuery, optionalText, orderInput, writePositions } from "../content/fields.js";
import { pick, toImage, type Locale } from "../media/media.serialize.js";

/** Team members (docs/API_CONTRACTS.md §6.2), shown on the about page. */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const memberInput = z.strictObject({
  nameKa: text(2, 100),
  nameEn: optionalText(100),
  roleKa: text(1, 100),
  roleEn: optionalText(100),
  bioKa: text(20, 600),
  bioEn: optionalText(600),
  photoId: z.uuid(),
  visible: z.boolean(),
});

type Row = TeamMember & { photo: MediaAsset };

const toAdmin = (m: Row, config: Config) => ({
  id: m.id,
  nameKa: m.nameKa,
  nameEn: m.nameEn,
  roleKa: m.roleKa,
  roleEn: m.roleEn,
  bioKa: m.bioKa,
  bioEn: m.bioEn,
  photoId: m.photoId,
  photo: toImage(m.photo, config),
  visible: m.visible,
  position: m.position,
  updatedAt: m.updatedAt.toISOString(),
});

const toPublic = (m: Row, config: Config, locale: Locale) => ({
  id: m.id,
  name: pick(m.nameKa, m.nameEn, locale),
  role: pick(m.roleKa, m.roleEn, locale),
  bio: pick(m.bioKa, m.bioEn, locale),
  photo: toImage(m.photo, config, locale),
});

const notFound = () => new AppError(404, "NOT_FOUND", "That team member doesn't exist.");
const idParam = z.uuid();
const include = { photo: true } as const;

export function adminTeamRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();
  const list = async () =>
    (await prisma.teamMember.findMany({ include, orderBy: { position: "asc" } })).map((m) => toAdmin(m, config));
  const actor = (req: { session?: { user: { id: string } } }) => req.session!.user.id;

  router.get("/", async (_req, res) => {
    res.json({ items: await list() });
  });

  router.put("/order", async (req, res) => {
    const { ids } = parse(orderInput, req.body);
    await prisma.$transaction(async (tx) => {
      const stored = await tx.teamMember.findMany({ select: { id: true } });
      assertSameItems(stored.map((m) => m.id), ids);
      await writePositions(ids, (id, position) => tx.teamMember.update({ where: { id }, data: { position } }));
    });
    await recordActivity(prisma, { kind: "team", message: "Team reordered", actorId: actor(req) });
    res.json({ items: await list() });
  });

  router.post("/", async (req, res) => {
    const input = parse(memberInput, req.body);
    await assertReadyImages(prisma, [input.photoId]);
    const member = await prisma.$transaction(async (tx) => {
      const last = await tx.teamMember.aggregate({ _max: { position: true } });
      return tx.teamMember.create({ data: { ...input, position: (last._max.position ?? -1) + 1 }, include });
    });
    await recordActivity(prisma, { kind: "team", message: `Team member added: ${member.nameKa}`, actorId: actor(req) });
    res.status(201).json(toAdmin(member, config));
  });

  router.put("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(memberInput, req.body);
    await assertReadyImages(prisma, [input.photoId]);
    if (!(await prisma.teamMember.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
    const member = await prisma.teamMember.update({ where: { id }, data: input, include });
    await recordActivity(prisma, { kind: "team", message: `Team member updated: ${member.nameKa}`, actorId: actor(req) });
    res.json(toAdmin(member, config));
  });

  router.patch("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { visible } = parse(z.strictObject({ visible: z.boolean() }), req.body);
    if ((await prisma.teamMember.updateMany({ where: { id }, data: { visible } })).count === 0) throw notFound();
    const member = await prisma.teamMember.findUniqueOrThrow({ where: { id }, include });
    await recordActivity(prisma, { kind: "team", message: `Team member ${visible ? "shown" : "hidden"}: ${member.nameKa}`, actorId: actor(req) });
    res.json(toAdmin(member, config));
  });

  router.delete("/:id", async (req, res) => {
    const id = parse(idParam, req.params.id);
    const deleted = await prisma.$transaction(async (tx) => {
      const member = await tx.teamMember.findUnique({ where: { id } });
      if (!member) return null;
      await tx.teamMember.delete({ where: { id } });
      const rest = await tx.teamMember.findMany({ select: { id: true }, orderBy: { position: "asc" } });
      await writePositions(rest.map((m) => m.id), (mid, position) => tx.teamMember.update({ where: { id: mid }, data: { position } }));
      return member;
    });
    if (!deleted) throw notFound();
    await recordActivity(prisma, { kind: "team", message: `Team member removed: ${deleted.nameKa}`, actorId: actor(req) });
    res.status(204).end();
  });

  return router;
}

export function publicTeamRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const members = await prisma.teamMember.findMany({ where: { visible: true }, include, orderBy: { position: "asc" } });
    res.json({ items: members.map((m) => toPublic(m, config, locale)) });
  });
  return router;
}
