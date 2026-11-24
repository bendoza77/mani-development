import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { checkPasswordPolicy, hashPassword, type PasswordProblem } from "./password.js";

/**
 * Creating the admin account and setting its password from the command line
 * (docs/SECURITY_PLAN.md §2: no self-registration).
 */

export class AdminAccountError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("; "));
    this.name = "AdminAccountError";
  }
}

const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  too_short: "Password: too short (at least 12 characters)",
  too_long: "Password: too long (at most 128 characters)",
  same_as_email: "Password: must not be the email address",
  too_common: "Password: too common, choose another",
  repeated_character: "Password: must not be one character repeated",
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const emailSchema = z.email().max(254);

function emailProblems(email: string): string[] {
  return emailSchema.safeParse(email).success ? [] : ["Email: not a valid address"];
}

const passwordProblems = (password: string, email: string) =>
  checkPasswordPolicy(password, email).map((problem) => PASSWORD_MESSAGES[problem]);

export type AdminAccount = { id: string; email: string; name: string };

export async function createAdminAccount(
  prisma: PrismaClient,
  input: { email: string; name: string; password: string },
): Promise<AdminAccount> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const problems = [
    ...emailProblems(email),
    ...(name.length === 0 || name.length > 100 ? ["Name: required (up to 100 characters)"] : []),
    ...passwordProblems(input.password, email),
  ];
  if (problems.length > 0) throw new AdminAccountError(problems);

  if (await prisma.adminUser.findUnique({ where: { email }, select: { id: true } })) {
    throw new AdminAccountError(["An admin account with this email already exists"]);
  }
  return prisma.adminUser.create({
    data: { email, name, passwordHash: await hashPassword(input.password) },
    select: { id: true, email: true, name: true },
  });
}

/**
 * Saves a new password hash, clears any lock, and ends every session and pending reset link,
 * so whoever knew the old password (or holds an old link) is shut out. Run it inside a transaction.
 */
export async function storeNewPassword(tx: Prisma.TransactionClient, userId: string, passwordHash: string, now: Date) {
  await tx.adminUser.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null },
  });
  await tx.adminSession.deleteMany({ where: { userId } });
  await tx.passwordResetToken.deleteMany({ where: { userId } });
}

/** The emergency fallback when email reset isn't possible (`npm run admin:set-password`). */
export async function setAdminPassword(
  prisma: PrismaClient,
  input: { email: string; password: string },
  now: Date = new Date(),
): Promise<AdminAccount> {
  const email = normalizeEmail(input.email);
  const user = await prisma.adminUser.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (!user) throw new AdminAccountError(["No admin account uses this email"]);

  const problems = passwordProblems(input.password, email);
  if (problems.length > 0) throw new AdminAccountError(problems);

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction((tx) => storeNewPassword(tx, user.id, passwordHash, now));
  return user;
}
