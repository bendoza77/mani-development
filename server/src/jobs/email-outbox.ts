import type { Logger } from "pino";
import type { Config } from "../config/env.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { EmailMessage, Mailer } from "../integrations/mailer.js";
import type { Clock } from "../lib/clock.js";
import { INQUIRY_NOTIFICATION, inquiryNotification } from "../modules/inquiries/emails.js";
import { repeatEvery } from "./schedule.js";

/**
 * Sends queued emails (docs/DATABASE_DESIGN.md §3.6). A lost inquiry notification can't be
 * re-sent by the visitor, so failures are retried: after 1, 5, 30 and 120 minutes, then the
 * message is marked failed (5 attempts in all).
 *
 * Several workers may run at once (e.g. during a deploy). Each claims its messages with
 * `FOR UPDATE SKIP LOCKED` and pushes their next attempt into the future, so no message is
 * picked up twice.
 */

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MIN = [1, 5, 30, 120];
/** How long a claimed message stays reserved while it is being sent. */
const LEASE_MS = 10 * 60_000;
const BATCH = 20;

type Deps = { prisma: PrismaClient; mailer: Mailer; clock: Clock; logger: Logger; config: Pick<Config, "publicSiteUrl"> };

class PermanentFailure extends Error {}

async function render(prisma: PrismaClient, config: Deps["config"], row: { template: string; recipient: string; payload: unknown }): Promise<EmailMessage> {
  if (row.template === INQUIRY_NOTIFICATION) {
    const { inquiryId } = row.payload as { inquiryId: string };
    const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) throw new PermanentFailure("inquiry was deleted before the email was sent");
    return inquiryNotification(inquiry, row.recipient, config.publicSiteUrl);
  }
  throw new PermanentFailure(`unknown email template: ${row.template}`);
}

export function createEmailOutbox({ prisma, mailer, clock, logger, config }: Deps) {
  return {
    async runOnce() {
      const now = clock.now();
      const claimed = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE email_messages
           SET attempts = attempts + 1, next_attempt_at = ${new Date(now.getTime() + LEASE_MS)}, updated_at = ${now}
         WHERE id IN (
           SELECT id FROM email_messages
            WHERE status = 'pending' AND next_attempt_at <= ${now}
            ORDER BY next_attempt_at
            LIMIT ${BATCH}
            FOR UPDATE SKIP LOCKED)
        RETURNING id`;
      const result = { sent: 0, retried: 0, failed: 0 };
      if (claimed.length === 0) return result;

      const rows = await prisma.emailMessage.findMany({ where: { id: { in: claimed.map((c) => c.id) } } });
      for (const row of rows) {
        try {
          await mailer.send(await render(prisma, config, row));
          await prisma.emailMessage.update({ where: { id: row.id }, data: { status: "sent", sentAt: now, lastError: null } });
          result.sent++;
        } catch (error) {
          const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
          const giveUp = error instanceof PermanentFailure || row.attempts >= MAX_ATTEMPTS;
          if (giveUp) {
            await prisma.emailMessage.update({ where: { id: row.id }, data: { status: "failed", lastError: message } });
            result.failed++;
            logger.error({ emailId: row.id, template: row.template, attempts: row.attempts, reason: message }, "email gave up");
          } else {
            const delay = RETRY_DELAYS_MIN[row.attempts - 1]! * 60_000;
            await prisma.emailMessage.update({
              where: { id: row.id },
              data: { lastError: message, nextAttemptAt: new Date(now.getTime() + delay) },
            });
            result.retried++;
            logger.warn({ emailId: row.id, template: row.template, attempts: row.attempts, reason: message }, "email failed, will retry");
          }
        }
      }
      return result;
    },
  };
}

/** Checks the queue every 30 seconds. Returns an async stop function. */
export function startEmailOutbox(deps: Deps, intervalMs = 30_000) {
  const outbox = createEmailOutbox(deps);
  return repeatEvery(
    intervalMs,
    async () => {
      const result = await outbox.runOnce();
      if (result.sent + result.retried + result.failed > 0) deps.logger.info(result, "email outbox run");
    },
    { logger: deps.logger, name: "email outbox" },
  );
}
