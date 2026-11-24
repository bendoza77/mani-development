import type { PrismaClient } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { AdminAccountError, createAdminAccount, setAdminPassword } from "./admin-accounts.js";

/**
 * The interactive parts of `npm run admin:create` and `npm run admin:set-password`, kept apart from
 * the terminal so tests can answer the questions. Each returns the process exit code.
 */
export type Prompt = (question: string, options?: { hidden?: boolean }) => Promise<string>;
export type Print = (line: string) => void;

async function askNewPassword(prompt: Prompt, print: Print): Promise<string | undefined> {
  const password = await prompt("New password (12 to 128 characters): ", { hidden: true });
  const again = await prompt("Repeat the password: ", { hidden: true });
  if (password !== again) {
    print("The passwords don't match. Nothing was changed.");
    return undefined;
  }
  return password;
}

async function reportProblems(action: () => Promise<number>, print: Print): Promise<number> {
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof AdminAccountError)) throw error;
    print("Nothing was changed:");
    for (const problem of error.problems) print(`  - ${problem}`);
    return 1;
  }
}

export async function adminCreateCommand(prisma: PrismaClient, prompt: Prompt, print: Print): Promise<number> {
  const email = await prompt("Email address for signing in: ");
  const name = await prompt("Name shown in the admin panel: ");
  const password = await askNewPassword(prompt, print);
  if (password === undefined) return 1;

  return reportProblems(async () => {
    const account = await createAdminAccount(prisma, { email, name, password });
    await recordActivity(prisma, {
      kind: "auth",
      message: `Admin account created (command line): ${account.email}`,
      actorId: account.id,
    });
    print(`Admin account created for ${account.email}.`);
    return 0;
  }, print);
}

export async function adminSetPasswordCommand(prisma: PrismaClient, prompt: Prompt, print: Print): Promise<number> {
  const email = await prompt("Email address of the admin account: ");
  const password = await askNewPassword(prompt, print);
  if (password === undefined) return 1;

  return reportProblems(async () => {
    const account = await setAdminPassword(prisma, { email, password });
    await recordActivity(prisma, {
      kind: "auth",
      message: `Password set (command line): ${account.email}`,
      actorId: account.id,
    });
    print(`Password updated for ${account.email}. Every device has been signed out.`);
    return 0;
  }, print);
}
