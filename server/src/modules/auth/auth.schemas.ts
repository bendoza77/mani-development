import { z } from "zod";
import { normalizeEmail } from "./admin-accounts.js";

/** Request bodies for /api/auth (docs/API_CONTRACTS.md §4). */

const email = z.string().max(254).transform(normalizeEmail).pipe(z.email());

// The password rules (12–128 characters, blocklist) are checked by checkPasswordPolicy, which
// reports codes such as too_short. Here only the type is checked.
const newPassword = z.string();

export const loginBody = z.strictObject({
  email,
  // Any length from 1 to 128 on sign-in, so the response gives no hint about the rules.
  password: z.string().min(1).max(128),
});

export const changePasswordBody = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword,
});

export const resetRequestBody = z.strictObject({ email });

export const resetConfirmBody = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  newPassword,
});
