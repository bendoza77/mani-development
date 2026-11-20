import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, needsRehash, verifyPassword } from "./password.js";

const PHC = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;

describe("hashPassword", () => {
  it("produces an Argon2id PHC string with the OWASP parameters", async () => {
    expect(await hashPassword("correct horse battery staple")).toMatch(PHC);
  });

  it("uses a fresh salt every time", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");

    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(await verifyPassword("correct horse battery stapler", hash)).toBe(false);
  });

  it("returns false for a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "$argon2id$v=19$garbage")).toBe(false);
    expect(await verifyPassword("anything", "plain-text")).toBe(false);
  });

  it("still does the full hashing work when there is no account (no timing hint)", async () => {
    const started = performance.now();
    const result = await verifyPassword("anything", null);
    const elapsed = performance.now() - started;

    expect(result).toBe(false);
    expect(elapsed).toBeGreaterThan(10); // a real Argon2id run, not an instant return
  });
});

describe("needsRehash", () => {
  it("is false for a hash made with the current parameters", async () => {
    expect(needsRehash(await hashPassword("correct horse battery staple"))).toBe(false);
  });

  it("is true for a hash made with weaker parameters", () => {
    expect(needsRehash("$argon2id$v=19$m=9216,t=4,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g")).toBe(
      true,
    );
  });
});

describe("checkPasswordPolicy", () => {
  const email = "info@manidevelopment.ge";

  it("accepts a long, uncommon password", () => {
    expect(checkPasswordPolicy("Tbilisi-rooftops-2026", email)).toEqual([]);
  });

  it.each([
    ["short-pass1", "too_short"],
    ["x".repeat(129), "too_long"],
    ["info@manidevelopment.ge", "same_as_email"],
    ["INFO@MANIDEVELOPMENT.GE", "same_as_email"],
    ["password1234", "too_common"],
    ["123456789012", "too_common"],
    ["aaaaaaaaaaaaaaa", "repeated_character"],
  ])("rejects %j as %s", (password, code) => {
    expect(checkPasswordPolicy(password, email)).toContain(code);
  });

  it("counts characters, not bytes, so 12 Georgian letters are enough", () => {
    expect(checkPasswordPolicy("საიდუმლოპაროლი", email)).toEqual([]);
  });
});
