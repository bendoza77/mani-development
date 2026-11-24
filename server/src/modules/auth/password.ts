import { argon2, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Argon2id from Node's built-in crypto (stable since Node 24.19).
 * Parameters are OWASP's minimum: 19 MiB memory, 2 passes, parallelism 1 (docs/SECURITY_PLAN.md §3).
 * Stored as a PHC string so parameters can be raised later and old hashes upgraded at next login.
 */

const PARAMS = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 } as const;
const SALT_BYTES = 16;
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

const b64 = (buf: Buffer) => buf.toString("base64").replace(/=+$/, "");

function derive(password: string, salt: Buffer, memory: number, passes: number, parallelism: number, tagLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    argon2(
      "argon2id",
      { message: password, nonce: salt, memory, passes, parallelism, tagLength },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, PARAMS.memory, PARAMS.passes, PARAMS.parallelism, PARAMS.tagLength);
  return `$argon2id$v=19$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$${b64(salt)}$${b64(key)}`;
}

/** A hash of a random secret, used when the account doesn't exist so the response takes just as long. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(32).toString("hex")));

/**
 * Checks a password against a stored PHC hash. Pass `null` when there is no such account:
 * the same Argon2id work is still done, and the result is always false.
 */
export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const hash = storedHash ?? (await getDummyHash());
  const match = PHC.exec(hash);
  if (!match) return false;

  const [, m, t, p, saltB64, keyB64] = match;
  const expected = Buffer.from(keyB64!, "base64");
  const actual = await derive(password, Buffer.from(saltB64!, "base64"), Number(m), Number(t), Number(p), expected.length);
  return storedHash !== null && actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when the stored hash was made with weaker (older) parameters than today's. */
export function needsRehash(storedHash: string): boolean {
  const match = PHC.exec(storedHash);
  if (!match) return true;
  const [, m, t, p] = match;
  return Number(m) < PARAMS.memory || Number(t) < PARAMS.passes || Number(p) !== PARAMS.parallelism;
}

export type PasswordProblem = "too_short" | "too_long" | "same_as_email" | "too_common" | "repeated_character";

/** A short list of very common passwords that satisfy the length rule. */
const COMMON = new Set([
  "123456789012", "1234567890123", "12345678901234", "password1234", "password12345", "password123456",
  "qwerty123456", "qwertyuiop12", "qwertyuiop123", "1q2w3e4r5t6y", "administrator", "admin1234567",
  "letmein12345", "welcome12345", "iloveyou1234", "abc123456789", "passwordpassword", "123123123123",
  "manidevelopment", "mani-development",
]);

/** Password rules (docs/SECURITY_PLAN.md §3): 12–128 characters, no composition rules, a small blocklist. */
export function checkPasswordPolicy(password: string, email: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  const length = Array.from(password).length;
  if (length < 12) problems.push("too_short");
  if (length > 128) problems.push("too_long");
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) problems.push("same_as_email");
  if (COMMON.has(password.toLowerCase())) problems.push("too_common");
  if (length > 0 && new Set(password).size === 1) problems.push("repeated_character");
  return problems;
}
