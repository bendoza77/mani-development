import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "./errors.js";
import { parse } from "./validate.js";

const schema = z
  .object({
    summary: z.string().min(10).max(180),
    specs: z.array(z.object({ label: z.string().min(1) }).strict()),
  })
  .strict();

function validationErrorOf(input: unknown): AppError {
  try {
    parse(schema, input);
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("expected parse to throw");
}

describe("parse", () => {
  it("returns the parsed value when the input is valid", () => {
    const value = parse(schema, { summary: "A long enough summary", specs: [{ label: "Area" }] });

    expect(value).toEqual({ summary: "A long enough summary", specs: [{ label: "Area" }] });
  });

  it("throws a 400 VALIDATION_FAILED error", () => {
    const error = validationErrorOf({ summary: "short", specs: [] });

    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
  });

  it("reports codes and limits per dotted field path, not sentences", () => {
    const error = validationErrorOf({ summary: "x".repeat(181), specs: [{ label: "" }] });

    expect(error.details).toEqual({
      fieldErrors: {
        summary: [{ code: "too_big", maximum: 180 }],
        "specs.0.label": [{ code: "too_small", minimum: 1 }],
      },
    });
  });

  it("reports each unknown key under its own path", () => {
    const error = validationErrorOf({ summary: "A long enough summary", specs: [], role: "admin" });

    expect(error.details).toEqual({ fieldErrors: { role: [{ code: "unrecognized_key" }] } });
  });

  it("reports a wrong top-level type under _root", () => {
    const error = validationErrorOf("not an object");

    expect(error.details).toEqual({ fieldErrors: { _root: [{ code: "invalid_type" }] } });
  });
});
