import type { z } from "zod";
import { AppError } from "./errors.js";

export type FieldIssue = { code: string; minimum?: number; maximum?: number };
export type FieldErrors = Record<string, FieldIssue[]>;

const ROOT = "_root";

/**
 * Converts Zod issues into the API's field-error map: dotted paths → codes and limits.
 * Codes (not sentences) let the frontend show its own translated messages.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const add = (path: string, issue: FieldIssue) => {
    (fieldErrors[path] ??= []).push(issue);
  };

  for (const issue of error.issues) {
    const base = issue.path.map(String).join(".");

    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) add(base ? `${base}.${key}` : key, { code: "unrecognized_key" });
      continue;
    }

    // Custom rules (superRefine) carry their code in the message, e.g. "before_start".
    const entry: FieldIssue = { code: issue.code === "custom" ? issue.message : issue.code };
    if (issue.code === "too_small") entry.minimum = Number(issue.minimum);
    if (issue.code === "too_big") entry.maximum = Number(issue.maximum);
    add(base || ROOT, entry);
  }

  return fieldErrors;
}

/** Parses untrusted input with a schema; throws a 400 VALIDATION_FAILED AppError on failure. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError(400, "VALIDATION_FAILED", "Request validation failed.", {
    fieldErrors: toFieldErrors(result.error),
  });
}
