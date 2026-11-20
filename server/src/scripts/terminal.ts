import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import dotenv from "dotenv";
import { ConfigError, loadScriptConfig } from "../config/env.js";
import { createDatabase } from "../lib/db.js";
import type { Print, Prompt } from "../modules/auth/admin-cli.js";
import type { PrismaClient } from "../generated/prisma/client.js";

/**
 * Terminal question-and-answer for the admin scripts. Hidden answers (passwords) are not echoed.
 * Piped input works too (one answer per line), which is how the tests drive the scripts.
 */
function createTerminalPrompt(): { prompt: Prompt; close(): void } {
  let muted = false;
  // readline echoes typed characters to its output; this output drops them while a password is typed.
  const output = new Writable({
    write(chunk, encoding, done) {
      if (!muted) process.stdout.write(chunk, encoding);
      done();
    },
  });
  const terminal = Boolean(process.stdin.isTTY);
  const rl = createInterface({ input: process.stdin, output, terminal });
  // The iterator buffers lines, so answers piped in all at once aren't lost between questions.
  const lines = rl[Symbol.asyncIterator]();

  const prompt: Prompt = async (question, options) => {
    process.stdout.write(question);
    muted = options?.hidden ?? false;
    const { value, done } = await lines.next();
    muted = false;
    if (options?.hidden || !terminal) process.stdout.write("\n");
    if (done) throw new Error("Input ended before every question was answered.");
    return String(value);
  };
  return { prompt, close: () => rl.close() };
}

/** Runs an admin command with the database from DATABASE_URL (or .env), then exits with its code. */
export async function runAdminScript(
  command: (prisma: PrismaClient, prompt: Prompt, print: Print) => Promise<number>,
): Promise<never> {
  dotenv.config({ quiet: true });
  let databaseUrl: string;
  try {
    ({ databaseUrl } = loadScriptConfig());
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const db = createDatabase(databaseUrl);
  const terminal = createTerminalPrompt();
  let exitCode = 1;
  try {
    exitCode = await command(db.prisma, terminal.prompt, (line) => console.log(line));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  } finally {
    terminal.close();
    await db.disconnect();
  }
  process.exit(exitCode);
}
