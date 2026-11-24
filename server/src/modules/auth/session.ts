import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Server-side admin sessions (docs/SECURITY_PLAN.md §2). The cookie holds 32 random bytes; the
 * database holds only their SHA-256, so a leaked database doesn't hand out live sessions.
 */

const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60_000;

export const newSessionToken = () => randomBytes(32).toString("base64url");

export const sessionTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A session ends after `idleMinutes` without use, or at its absolute expiry, whichever comes first. */
export function isSessionLive(
  session: { lastSeenAt: Date; expiresAt: Date },
  now: Date,
  idleMinutes: number,
): boolean {
  const idleDeadline = session.lastSeenAt.getTime() + idleMinutes * 60_000;
  return now.getTime() < idleDeadline && now.getTime() < session.expiresAt.getTime();
}

/** `lastSeenAt` is written at most once every 5 minutes, so reads don't each cost a database write. */
export const shouldRecordActivity = (lastSeenAt: Date, now: Date) =>
  now.getTime() - lastSeenAt.getTime() >= ACTIVITY_WRITE_INTERVAL_MS;

export type SessionUser = { id: string; name: string; email: string };
export type ActiveSession = { id: string; expiresAt: Date; user: SessionUser };

export type SessionSettings = { idleMinutes: number; maxDays: number };

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  settings: SessionSettings,
  userAgent: string | undefined,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + settings.maxDays * 86_400_000);
  await prisma.adminSession.create({
    data: {
      userId,
      tokenHash: sessionTokenHash(token),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      userAgent: userAgent?.slice(0, 400) || null,
    },
  });
  return { token, expiresAt };
}

/** Looks up a live session by its cookie token, refreshing `lastSeenAt` when due. Ended sessions are deleted. */
export async function findSession(
  prisma: PrismaClient,
  token: string,
  now: Date,
  settings: SessionSettings,
): Promise<ActiveSession | null> {
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    select: {
      id: true,
      lastSeenAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!session) return null;

  if (!isSessionLive(session, now, settings.idleMinutes)) {
    await prisma.adminSession.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (shouldRecordActivity(session.lastSeenAt, now)) {
    await prisma.adminSession.updateMany({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return { id: session.id, expiresAt: session.expiresAt, user: session.user };
}

export async function deleteSessionByToken(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.adminSession.deleteMany({ where: { tokenHash: sessionTokenHash(token) } });
}
