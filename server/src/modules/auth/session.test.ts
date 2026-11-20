import { describe, expect, it } from "vitest";
import { isSessionLive, newSessionToken, sessionTokenHash, shouldRecordActivity } from "./session.js";

const minutes = (n: number) => n * 60_000;
const NOW = new Date("2026-11-21T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

describe("isSessionLive", () => {
  const idleMinutes = 720;

  it("is live when used recently and before the absolute expiry", () => {
    expect(isSessionLive({ lastSeenAt: ago(minutes(719)), expiresAt: ahead(1) }, NOW, idleMinutes)).toBe(true);
  });

  it("ends exactly at the idle limit", () => {
    expect(isSessionLive({ lastSeenAt: ago(minutes(720)), expiresAt: ahead(minutes(60)) }, NOW, idleMinutes)).toBe(false);
  });

  it("ends exactly at the absolute expiry, however recent the activity", () => {
    expect(isSessionLive({ lastSeenAt: NOW, expiresAt: NOW }, NOW, idleMinutes)).toBe(false);
  });
});

describe("shouldRecordActivity", () => {
  it("writes lastSeenAt at most once every 5 minutes", () => {
    expect(shouldRecordActivity(ago(minutes(5) - 1), NOW)).toBe(false);
    expect(shouldRecordActivity(ago(minutes(5)), NOW)).toBe(true);
  });
});

describe("session tokens", () => {
  it("are 32 random bytes in base64url (43 characters), different every time", () => {
    const a = newSessionToken();
    const b = newSessionToken();

    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("are stored as a lowercase hex SHA-256", () => {
    expect(sessionTokenHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
