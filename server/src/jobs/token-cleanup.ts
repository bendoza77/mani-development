import type { Logger } from "pino";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { Clock } from "../lib/clock.js";

/**
 * Deletes ended admin sessions, used or expired password-reset tokens and expired preview tokens
 * (docs/SECURITY_PLAN.md §2). Expired rows are already refused when used; this keeps the tables small.
 */
export async function cleanupExpiredTokens(
  prisma: PrismaClient,
  { now, sessionIdleMinutes }: { now: Date; sessionIdleMinutes: number },
) {
  const idleCutoff = new Date(now.getTime() - sessionIdleMinutes * 60_000);
  const [sessions, resetTokens, previewTokens] = await prisma.$transaction([
    prisma.adminSession.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { lastSeenAt: { lte: idleCutoff } }] } }),
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] } }),
    prisma.previewToken.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);
  return { sessions: sessions.count, resetTokens: resetTokens.count, previewTokens: previewTokens.count };
}

/** Runs the cleanup now and then every `intervalMs` (hourly by default). Returns an async function that stops it. */
export function startTokenCleanup({
  prisma,
  logger,
  clock,
  sessionIdleMinutes,
  intervalMs = 60 * 60_000,
}: {
  prisma: PrismaClient;
  logger: Logger;
  clock: Clock;
  sessionIdleMinutes: number;
  intervalMs?: number;
}): () => Promise<void> {
  let current: Promise<void> | undefined;
  let stopped = false;
  const run = () => {
    if (current || stopped) return;
    current = (async () => {
      try {
        const deleted = await cleanupExpiredTokens(prisma, { now: clock.now(), sessionIdleMinutes });
        logger.debug({ deleted }, "expired tokens cleaned up");
      } catch (error) {
        logger.error({ err: error }, "token cleanup failed");
      } finally {
        current = undefined;
      }
    })();
  };

  run();
  const timer = setInterval(run, intervalMs);
  // Never keeps the process alive on its own.
  timer.unref();
  /** Stops the schedule and waits for a run still in progress, so nothing runs after this resolves. */
  return async () => {
    stopped = true;
    clearInterval(timer);
    await current;
  };
}
