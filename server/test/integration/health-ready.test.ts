import net from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/lib/db.js";
import { buildTestApp, testConfig } from "../helpers/app.js";

describe("GET /api/health/ready", () => {
  describe("with the database up", () => {
    const { app, close } = buildTestApp();
    afterAll(close);

    it("answers 200 with the database check", async () => {
      const res = await request(app).get("/api/health/ready");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", checks: { database: "ok" } });
      expect(res.headers["cache-control"]).toBe("no-store");
    });
  });

  describe("with the database unreachable", () => {
    // Port 1 on localhost: nothing listens there, so the connection is refused at once.
    const url = "postgresql://postgres@127.0.0.1:1/nowhere_test";
    const { app, close } = buildTestApp({ config: testConfig({ DATABASE_URL: url }), db: createDatabase(url) });
    afterAll(close);

    it("answers 503 with the database marked down", async () => {
      const res = await request(app).get("/api/health/ready");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: "unavailable", checks: { database: "down" } });
    });
  });

  describe("with a database that never answers", () => {
    // A TCP server that accepts connections and stays silent, like a hung database.
    const silent = net.createServer(() => {});
    const sockets = new Set<net.Socket>();
    silent.on("connection", (socket) => sockets.add(socket));
    let app: ReturnType<typeof buildTestApp>;

    beforeAll(async () => {
      await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
      const { port } = silent.address() as net.AddressInfo;
      const url = `postgresql://postgres@127.0.0.1:${port}/silent_test`;
      app = buildTestApp({ config: testConfig({ DATABASE_URL: url }), db: createDatabase(url) });
    });

    afterAll(async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
      await app.close();
    });

    it("gives up after about 2 seconds and answers 503", async () => {
      const started = Date.now();
      const res = await request(app.app).get("/api/health/ready");
      const elapsed = Date.now() - started;

      expect(res.status).toBe(503);
      expect(elapsed).toBeGreaterThanOrEqual(1900);
      expect(elapsed).toBeLessThan(2500);
    });
  });
});
