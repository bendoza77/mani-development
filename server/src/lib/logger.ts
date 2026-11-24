import { pino, type DestinationStream, type Logger } from "pino";
import type { Config } from "../config/env.js";

/** Values that must never reach the logs (docs/SECURITY_PLAN.md §8). */
const SENSITIVE_FIELDS = ["password", "currentPassword", "newPassword", "token", "secret"];

const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
  ...SENSITIVE_FIELDS,
  ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
];

/** JSON logs to stdout (collected by Render), or to a given stream in tests. */
export function createLogger(level: Config["logLevel"], destination?: DestinationStream): Logger {
  const options = { level, redact: { paths: REDACT_PATHS, censor: "[Redacted]" } };
  return destination ? pino(options, destination) : pino(options);
}
