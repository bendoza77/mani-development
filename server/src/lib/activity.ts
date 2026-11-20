import type { ActivityKind, PrismaClient } from "../generated/prisma/client.js";

type ActivityWriter = Pick<PrismaClient, "activityLog">;

const MAX_MESSAGE_LENGTH = 300;

/** Adds an entry to the admin activity feed (docs/DATABASE_DESIGN.md §3.7). */
export async function recordActivity(
  db: ActivityWriter,
  entry: { kind: ActivityKind; message: string; actorId?: string | null; at?: Date },
): Promise<void> {
  const message =
    entry.message.length > MAX_MESSAGE_LENGTH ? `${entry.message.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : entry.message;
  await db.activityLog.create({
    data: { kind: entry.kind, message, actorId: entry.actorId ?? null, ...(entry.at ? { createdAt: entry.at } : {}) },
  });
}
