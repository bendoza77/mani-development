import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createDatabase, type Database } from "../../src/lib/db.js";
import { createLogger } from "../../src/lib/logger.js";
import { startServer } from "../../src/server.js";
import { testConfig } from "../helpers/app.js";

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

describe("startServer", () => {
  it("serves HTTP, then on close stops listening and disconnects the database", async () => {
    const config = testConfig();
    const logger = createLogger("silent");
    const real = createDatabase(config.databaseUrl);
    let disconnected = false;
    const db: Database = { ...real, disconnect: async () => ((disconnected = true), real.disconnect()) };

    const server = await startServer({ app: createApp({ config, logger, db }), port: 0, logger, db });

    const res = await fetch(`http://127.0.0.1:${server.port}/api/health/live`);
    expect(res.status).toBe(200);

    await server.close();

    expect(disconnected).toBe(true);
    expect(await canConnect(server.port)).toBe(false);
  });

  it("can be closed twice without throwing", async () => {
    const config = testConfig();
    const logger = createLogger("silent");
    const db = createDatabase(config.databaseUrl);
    const server = await startServer({ app: createApp({ config, logger, db }), port: 0, logger, db });

    await server.close();
    await expect(server.close()).resolves.toBeUndefined();
  });
});

describe("entry point (src/index.ts)", () => {
  it("exits with code 1 and names the missing variables when configuration is invalid", () => {
    // Run from an empty folder so a developer's local .env can't fill in the missing values.
    const emptyDir = mkdtempSync(join(tmpdir(), "mani-entry-"));
    const entry = fileURLToPath(new URL("../../src/index.ts", import.meta.url));
    const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "development" };
    const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), entry], {
      cwd: emptyDir,
      env,
      encoding: "utf8",
      timeout: 20_000,
    });
    rmSync(emptyDir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL");
    expect(result.stderr).toContain("CORS_ORIGINS");
  });
});
