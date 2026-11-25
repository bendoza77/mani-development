import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { toFieldErrors } from "../lib/validate.js";

/** Errors raised by express.json() (body-parser) carry a `type` and an HTTP status. */
type BodyParserError = Error & { type?: string; status?: number };

const BODY_PARSER_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  "entity.parse.failed": { status: 400, code: "MALFORMED_JSON", message: "The request body is not valid JSON." },
  "entity.too.large": { status: 413, code: "PAYLOAD_TOO_LARGE", message: "The request body is too large." },
  "encoding.unsupported": { status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported body encoding." },
  "charset.unsupported": { status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported body charset." },
};

function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(400, "VALIDATION_FAILED", "Request validation failed.", {
      fieldErrors: toFieldErrors(error),
    });
  }
  const type = (error as BodyParserError | undefined)?.type;
  const known = type ? BODY_PARSER_ERRORS[type] : undefined;
  return known ? new AppError(known.status, known.code, known.message) : undefined;
}

/**
 * The single error middleware. Known errors become the API's error envelope
 * (docs/API_CONTRACTS.md §1); anything else is logged in full and answered with a
 * generic 500 that never exposes messages, stack traces or SQL.
 */
export function errorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId = String(req.id);
    const appError = toAppError(error);
    // Public routes allow shared caching of their answers; an error must never be kept.
    res.set("Cache-Control", "no-store");

    if (!appError) {
      (req.log ?? logger).error({ err: error }, "unhandled error");
      res.status(500).json({ error: { code: "INTERNAL", message: "An unexpected error occurred.", requestId } });
      return;
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details } : {}),
        requestId,
      },
    });
  };
}
