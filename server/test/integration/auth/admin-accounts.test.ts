import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminCreateCommand, adminSetPasswordCommand, type Prompt } from "../../../src/modules/auth/admin-cli.js";
import { AdminAccountError, createAdminAccount, setAdminPassword } from "../../../src/modules/auth/admin-accounts.js";
import { verifyPassword } from "../../../src/modules/auth/password.js";
import { createDatabase } from "../../../src/lib/db.js";
import { testConfig } from "../../helpers/app.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD, createTestAdmin, minutes } from "../../helpers/auth.js";
import { resetDb } from "../../helpers/db.js";

const config = testConfig();
const db = createDatabase(config.databaseUrl);
const prisma = db.prisma;
afterAll(() => db.disconnect());
beforeEach(() => resetDb());

const NEW_PASSWORD = "Mtatsminda-at-dusk-77";

describe("createAdminAccount", () => {
  it("stores a normalised email and an Argon2id hash, never the password", async () => {
    const created = await createAdminAccount(prisma, { email: "  Dev@ManiDevelopment.ge ", name: " Site Admin ", password: ADMIN_PASSWORD });

    const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: created.id } });
    expect(created).toEqual({ id: row.id, email: ADMIN_EMAIL, name: "Site Admin" });
    expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(ADMIN_PASSWORD, row.passwordHash)).toBe(true);
  });

  it("refuses a second account with the same email", async () => {
    await createTestAdmin(prisma);

    await expect(createTestAdmin(prisma)).rejects.toThrow(AdminAccountError);
  });

  it("refuses a password that breaks the policy, and an invalid email or name", async () => {
    const attempt = createAdminAccount(prisma, { email: "not-an-email", name: "", password: "short" });

    await expect(attempt).rejects.toMatchObject({
      problems: expect.arrayContaining([
        "Email: not a valid address",
        "Name: required (up to 100 characters)",
        "Password: too short (at least 12 characters)",
      ]),
    });
    expect(await prisma.adminUser.count()).toBe(0);
  });
});

describe("setAdminPassword", () => {
  it("replaces the password, clears any lock and signs every session out", async () => {
    const { id } = await createTestAdmin(prisma);
    const later = new Date(Date.now() + minutes(60));
    await prisma.adminUser.update({ where: { id }, data: { failedLoginCount: 10, lockedUntil: later } });
    await prisma.adminSession.create({
      data: { userId: id, tokenHash: "a".repeat(64), lastSeenAt: new Date(), expiresAt: later },
    });
    await prisma.passwordResetToken.create({ data: { userId: id, tokenHash: "b".repeat(64), expiresAt: later } });

    await setAdminPassword(prisma, { email: "DEV@manidevelopment.ge", password: NEW_PASSWORD });

    const row = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
    expect(await verifyPassword(NEW_PASSWORD, row.passwordHash)).toBe(true);
    expect(row).toMatchObject({ failedLoginCount: 0, lockedUntil: null, passwordChangedAt: expect.any(Date) });
    expect(await prisma.adminSession.count()).toBe(0);
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("fails clearly for an unknown email", async () => {
    await expect(setAdminPassword(prisma, { email: "nobody@example.com", password: NEW_PASSWORD })).rejects.toMatchObject({
      problems: ["No admin account uses this email"],
    });
  });
});

/** Answers prompts in order and records what the command printed. */
function scripted(answers: string[]) {
  const asked: { question: string; hidden: boolean }[] = [];
  const printed: string[] = [];
  const prompt: Prompt = async (question, options) => {
    asked.push({ question, hidden: options?.hidden ?? false });
    const answer = answers.shift();
    if (answer === undefined) throw new Error(`unexpected prompt: ${question}`);
    return answer;
  };
  return { prompt, asked, printed, print: (line: string) => printed.push(line) };
}

describe("admin:create command", () => {
  it("asks for email, name and the password twice (hidden), then creates the account", async () => {
    const io = scripted([ADMIN_EMAIL, "Site Admin", ADMIN_PASSWORD, ADMIN_PASSWORD]);

    const exitCode = await adminCreateCommand(prisma, io.prompt, io.print);

    expect(exitCode).toBe(0);
    expect(io.asked.map((a) => a.hidden)).toEqual([false, false, true, true]);
    expect(io.printed.join("\n")).toContain(`Admin account created for ${ADMIN_EMAIL}`);
    expect(await prisma.adminUser.count()).toBe(1);
    const log = await prisma.activityLog.findMany({ where: { kind: "auth" } });
    expect(log.map((l) => l.message)).toEqual([`Admin account created (command line): ${ADMIN_EMAIL}`]);
  });

  it("stops when the two passwords differ", async () => {
    const io = scripted([ADMIN_EMAIL, "Site Admin", ADMIN_PASSWORD, "something-else-entirely"]);

    expect(await adminCreateCommand(prisma, io.prompt, io.print)).toBe(1);
    expect(io.printed.join("\n")).toContain("The passwords don't match");
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it("prints every problem and exits 1", async () => {
    const io = scripted(["bad", "Site Admin", "short", "short"]);

    expect(await adminCreateCommand(prisma, io.prompt, io.print)).toBe(1);
    expect(io.printed.join("\n")).toContain("Email: not a valid address");
    expect(io.printed.join("\n")).toContain("Password: too short (at least 12 characters)");
  });
});

describe("admin:set-password command", () => {
  it("sets the new password", async () => {
    await createTestAdmin(prisma);
    const io = scripted([ADMIN_EMAIL, NEW_PASSWORD, NEW_PASSWORD]);

    expect(await adminSetPasswordCommand(prisma, io.prompt, io.print)).toBe(0);
    expect(io.asked.map((a) => a.hidden)).toEqual([false, true, true]);
    expect(io.printed.join("\n")).toContain(`Password updated for ${ADMIN_EMAIL}`);
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    expect(await verifyPassword(NEW_PASSWORD, row.passwordHash)).toBe(true);
    const log = await prisma.activityLog.findMany({ where: { kind: "auth" } });
    expect(log.map((l) => l.message)).toEqual([`Password set (command line): ${ADMIN_EMAIL}`]);
  });
});

describe("the admin:create script", () => {
  it("reads answers from standard input and creates the account", () => {
    // Run from an empty folder so a developer's local .env isn't read.
    const emptyDir = mkdtempSync(join(tmpdir(), "mani-script-"));
    const script = fileURLToPath(new URL("../../../src/scripts/admin-create.ts", import.meta.url));
    const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), script], {
      cwd: emptyDir,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: config.databaseUrl },
      input: [ADMIN_EMAIL, "Site Admin", ADMIN_PASSWORD, ADMIN_PASSWORD, ""].join("\n"),
      encoding: "utf8",
      timeout: 30_000,
    });
    rmSync(emptyDir, { recursive: true, force: true });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Admin account created for ${ADMIN_EMAIL}`);
    expect(result.stdout).not.toContain(ADMIN_PASSWORD);
  });

  it("exits 1 when DATABASE_URL is missing", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "mani-script-"));
    const script = fileURLToPath(new URL("../../../src/scripts/admin-create.ts", import.meta.url));
    const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), script], {
      cwd: emptyDir,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
      input: "",
      encoding: "utf8",
      timeout: 30_000,
    });
    rmSync(emptyDir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL");
  });
});
