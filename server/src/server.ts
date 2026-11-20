import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import type { Logger } from "pino";
import type { Database } from "./lib/db.js";

export type RunningServer = {
  port: number;
  /**
   * Stops accepting connections, lets in-flight requests finish (up to the limit), waits for
   * background work, then disconnects the database.
   */
  close(): Promise<void>;
};

type StartOptions = {
  app: Express;
  port: number;
  logger: Logger;
  db: Database;
  /** Render requires binding to 0.0.0.0 (docs/INTEGRATIONS.md §4). */
  host?: string;
  shutdownTimeoutMs?: number;
  /** Waits for work still running after its response was sent (e.g. emails). */
  drainBackground?: () => Promise<void>;
};

export async function startServer({
  app,
  port,
  logger,
  db,
  host = "0.0.0.0",
  shutdownTimeoutMs = 10_000,
  drainBackground = async () => {},
}: StartOptions): Promise<RunningServer> {
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(port, host, () => resolve(s));
    s.once("error", reject);
  });
  const actualPort = (server.address() as AddressInfo).port;
  logger.info({ port: actualPort }, "server listening");

  let closing: Promise<void> | undefined;

  const close = () => {
    closing ??= (async () => {
      logger.info("shutting down");
      await new Promise<void>((resolve) => {
        const forceTimer = setTimeout(() => {
          logger.warn({ shutdownTimeoutMs }, "forcing open connections closed");
          server.closeAllConnections();
        }, shutdownTimeoutMs);
        forceTimer.unref();
        server.close(() => {
          clearTimeout(forceTimer);
          resolve();
        });
        server.closeIdleConnections();
      });
      await drainBackground();
      await db.disconnect();
      logger.info("shutdown complete");
    })();
    return closing;
  };

  return { port: actualPort, close };
}
