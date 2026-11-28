import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

/**
 * Gives every request a fresh UUID (returned as X-Request-Id; a client-supplied value is ignored)
 * and logs one line per request through the shared, redacting logger. The host's health probes
 * (every few seconds) are not logged; a failed readiness check still logs its own warning.
 */
export function requestContext(logger: Logger) {
  return pinoHttp({
    logger,
    autoLogging: { ignore: (req) => (req.url ?? "").startsWith("/api/health/") },
    genReqId: (_req, res) => {
      const id = randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  });
}
