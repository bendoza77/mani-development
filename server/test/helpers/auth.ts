import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { createAdminAccount } from "../../src/modules/auth/admin-accounts.js";
import { ALLOWED_ORIGIN } from "./app.js";

export const ADMIN_EMAIL = "dev@manidevelopment.ge";
export const ADMIN_PASSWORD = "Tbilisi-rooftops-2026";

/** A clock tests can move forward (sessions, lockouts and reset links depend on time). */
export function testClock(start = new Date("2026-11-21T09:00:00Z")) {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current += ms;
    },
  };
}

export const minutes = (n: number) => n * 60_000;
export const days = (n: number) => n * 86_400_000;

export function createTestAdmin(prisma: PrismaClient, password = ADMIN_PASSWORD) {
  return createAdminAccount(prisma, { email: ADMIN_EMAIL, name: "Site Admin", password });
}

/** Unsafe requests to /api/auth and /api/admin must carry an allowed Origin (CSRF protection). */
export function post(app: Express, path: string, body: object = {}, cookie?: string) {
  const req = request(app).post(path).set("Origin", ALLOWED_ORIGIN).send(body);
  return cookie ? req.set("Cookie", cookie) : req;
}

/** Returns the session cookie pair (`__Host-sid=…`) from a response, or undefined. */
export function sessionCookieFrom(res: { headers: Record<string, unknown> }): string | undefined {
  const cookies = ([] as string[]).concat((res.headers["set-cookie"] as string[] | undefined) ?? []);
  return cookies.find((c) => c.startsWith("__Host-sid="))?.split(";")[0];
}

export async function signIn(app: Express, email = ADMIN_EMAIL, password = ADMIN_PASSWORD): Promise<string> {
  const res = await post(app, "/api/auth/login", { email, password });
  const cookie = sessionCookieFrom(res);
  if (res.status !== 200 || !cookie) throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  return cookie;
}
