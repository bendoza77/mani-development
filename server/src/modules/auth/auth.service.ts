import { createHash, randomBytes } from "node:crypto";
import type { Logger } from "pino";
import type { Config } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { EmailMessage, Mailer } from "../../integrations/mailer.js";
import { recordActivity } from "../../lib/activity.js";
import type { BackgroundTasks } from "../../lib/background.js";
import type { Clock } from "../../lib/clock.js";
import { AppError } from "../../lib/errors.js";
import { storeNewPassword } from "./admin-accounts.js";
import { passwordChangedEmail, passwordResetEmail } from "./emails.js";
import { checkPasswordPolicy, hashPassword, needsRehash, verifyPassword } from "./password.js";
import { createSession, type SessionUser } from "./session.js";

/** Sign-in, password change and password reset (docs/SECURITY_PLAN.md §2–3). */

const LOCK_AFTER_FAILURES = 10;
const LOCK_MS = 15 * 60_000;
const RESET_TOKEN_TTL_MS = 30 * 60_000;

const invalidCredentials = () => new AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
const invalidResetToken = () =>
  new AppError(400, "INVALID_OR_EXPIRED_TOKEN", "This reset link is invalid or has expired. Please request a new one.");

/** Turns password-policy problems into the API's field errors (codes, not sentences). */
function assertPasswordPolicy(password: string, email: string) {
  const problems = checkPasswordPolicy(password, email);
  if (problems.length === 0) return;
  throw new AppError(400, "VALIDATION_FAILED", "Request validation failed.", {
    fieldErrors: { newPassword: problems.map((code) => ({ code })) },
  });
}

const resetTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export type AuthDeps = {
  config: Config;
  prisma: PrismaClient;
  clock: Clock;
  mailer: Mailer;
  logger: Logger;
  tasks: BackgroundTasks;
};

export function createAuthService({ config, prisma, clock, mailer, logger, tasks }: AuthDeps) {
  const sessionSettings = { idleMinutes: config.sessionIdleMinutes, maxDays: config.sessionMaxDays };

  /** Emails go out after the response, so a slow or failing mail server never changes what the client sees. */
  function sendLater(message: EmailMessage, purpose: string) {
    tasks.run(async () => {
      try {
        await mailer.send(message);
      } catch (error) {
        logger.error({ err: error, purpose }, "email could not be sent");
      }
    });
  }

  function sendPasswordChangedNotice(to: string, at: Date) {
    const resetPageUrl = `${config.publicSiteUrl}/admin/forgot-password`;
    sendLater(passwordChangedEmail({ to, at, resetPageUrl }), "password-changed");
  }

  async function login(input: { email: string; password: string; userAgent?: string }) {
    const now = clock.now();
    const user = await prisma.adminUser.findUnique({ where: { email: input.email } });

    if (!user) {
      // Same Argon2id work as a real check, so timing doesn't reveal which emails exist.
      await verifyPassword(input.password, null);
      logger.info({ reason: "unknown-email" }, "sign-in failed");
      throw invalidCredentials();
    }

    const lockActive = user.lockedUntil !== null && user.lockedUntil > now;
    const passwordOk = await verifyPassword(input.password, user.passwordHash);

    if (lockActive) {
      logger.info({ userId: user.id, reason: "locked" }, "sign-in failed");
      throw invalidCredentials();
    }

    if (!passwordOk) {
      // A lock that has run out starts a fresh count.
      const lockExpired = user.lockedUntil !== null;
      const { failedLoginCount } = await prisma.adminUser.update({
        where: { id: user.id },
        data: lockExpired ? { failedLoginCount: 1, lockedUntil: null } : { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      if (failedLoginCount >= LOCK_AFTER_FAILURES) {
        await prisma.adminUser.update({ where: { id: user.id }, data: { lockedUntil: new Date(now.getTime() + LOCK_MS) } });
        await recordActivity(prisma, {
          kind: "auth",
          message: `Account locked after ${LOCK_AFTER_FAILURES} failed sign-ins: ${user.email}`,
          actorId: user.id,
          at: now,
        });
        logger.warn({ userId: user.id }, "admin account locked");
      }
      logger.info({ userId: user.id, reason: "wrong-password", failedLoginCount }, "sign-in failed");
      throw invalidCredentials();
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        // Upgrade hashes made with older, weaker parameters while the password is at hand.
        ...(needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(input.password) } : {}),
      },
    });
    const session = await createSession(prisma, user.id, now, sessionSettings, input.userAgent);
    await recordActivity(prisma, { kind: "auth", message: `Signed in: ${user.email}`, actorId: user.id, at: now });

    const sessionUser: SessionUser = { id: user.id, name: user.name, email: user.email };
    return { user: sessionUser, ...session, now };
  }

  /** Changes the password, signs out every session (this one included) and issues a fresh one. */
  async function changePassword(input: {
    user: SessionUser;
    currentPassword: string;
    newPassword: string;
    userAgent?: string;
  }) {
    assertPasswordPolicy(input.newPassword, input.user.email);
    const now = clock.now();
    const account = await prisma.adminUser.findUniqueOrThrow({ where: { id: input.user.id } });
    if (!(await verifyPassword(input.currentPassword, account.passwordHash))) throw invalidCredentials();

    const passwordHash = await hashPassword(input.newPassword);
    await prisma.$transaction((tx) => storeNewPassword(tx, account.id, passwordHash, now));
    const session = await createSession(prisma, account.id, now, sessionSettings, input.userAgent);
    await recordActivity(prisma, { kind: "auth", message: `Password changed: ${account.email}`, actorId: account.id, at: now });
    sendPasswordChangedNotice(account.email, now);
    return { ...session, now };
  }

  /**
   * Returns at once; the lookup and email happen in the background, so the 202 answer and its
   * timing are the same whether or not the email belongs to the admin.
   */
  function requestPasswordReset(email: string): void {
    tasks.run(() => issueResetLink(email));
  }

  async function issueResetLink(email: string): Promise<void> {
    try {
      const now = clock.now();
      const user = await prisma.adminUser.findUnique({ where: { email }, select: { id: true, email: true } });
      if (!user) return;

      const token = randomBytes(32).toString("base64url");
      await prisma.$transaction([
        // Only the newest link works.
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: resetTokenHash(token),
            createdAt: now,
            expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
          },
        }),
      ]);
      const link = `${config.publicSiteUrl}/admin/reset-password#token=${token}`;
      // Sent to the address stored on the account, never the one typed into the form.
      await mailer.send(passwordResetEmail({ to: user.email, link }));
    } catch (error) {
      logger.error({ err: error }, "password reset request failed");
    }
  }

  async function confirmPasswordReset(input: { token: string; newPassword: string }) {
    const now = clock.now();
    const tokenHash = resetTokenHash(input.token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, usedAt: true, expiresAt: true, user: { select: { id: true, email: true } } },
    });
    if (!record || record.usedAt !== null || record.expiresAt <= now) throw invalidResetToken();

    // A weak password doesn't use up the link, so the admin can try again.
    assertPasswordPolicy(input.newPassword, record.user.email);
    const passwordHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      // Claim the token atomically: of two simultaneous requests, only one succeeds.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw invalidResetToken();
      await storeNewPassword(tx, record.user.id, passwordHash, now);
    });
    await recordActivity(prisma, {
      kind: "auth",
      message: `Password reset by email link: ${record.user.email}`,
      actorId: record.user.id,
      at: now,
    });
    sendPasswordChangedNotice(record.user.email, now);
  }

  return { login, changePassword, requestPasswordReset, confirmPasswordReset };
}

export type AuthService = ReturnType<typeof createAuthService>;
