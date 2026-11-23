import { describe, expect, it } from "vitest";
import { DEFAULT_RATE_LIMITS } from "./rate-limits.js";

const minutes = (n: number) => n * 60_000;

describe("DEFAULT_RATE_LIMITS", () => {
  it("match docs/SECURITY_PLAN.md §3 (sign-in), §2 (password reset) and §9 (contact form)", () => {
    expect(DEFAULT_RATE_LIMITS).toEqual({
      login: { limit: 10, windowMs: minutes(15) },
      resetRequestPerIp: { limit: 3, windowMs: minutes(60) },
      resetRequestPerEmail: { limit: 3, windowMs: minutes(60) },
      resetConfirm: { limit: 10, windowMs: minutes(60) },
      admin: { limit: 600, windowMs: minutes(15) },
      inquiry: { limit: 5, windowMs: minutes(60) },
      inquiryDaily: { limit: 20, windowMs: minutes(24 * 60) },
      review: { limit: 3, windowMs: minutes(60) },
      reviewDaily: { limit: 10, windowMs: minutes(24 * 60) },
    });
  });
});
