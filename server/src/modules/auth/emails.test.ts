import { describe, expect, it } from "vitest";
import { passwordChangedEmail, passwordResetEmail } from "./emails.js";

const LINK = "https://www.manidevelopment.ge/admin/reset-password#token=abc";

describe("passwordResetEmail", () => {
  it("addresses the registered admin, contains the link and says it lasts 30 minutes, in Georgian then English", () => {
    const email = passwordResetEmail({ to: "dev@manidevelopment.ge", link: LINK });

    expect(email.to).toBe("dev@manidevelopment.ge");
    expect(email.subject).toBe("Reset your MANI DEVELOPMENT admin password");
    expect(email.text).toContain(LINK);
    expect(email.text).toContain("30");
    const georgian = email.text.search(/[ა-ჿ]/);
    const english = email.text.indexOf("To reset");
    expect(georgian).toBeGreaterThanOrEqual(0);
    expect(english).toBeGreaterThan(georgian);
  });
});

describe("passwordChangedEmail", () => {
  it("gives the time of the change and tells the admin what to do if it wasn't them", () => {
    const email = passwordChangedEmail({
      to: "dev@manidevelopment.ge",
      at: new Date("2026-11-21T09:05:00Z"),
      resetPageUrl: "https://www.manidevelopment.ge/admin/forgot-password",
    });

    expect(email.subject).toBe("Your MANI DEVELOPMENT admin password was changed");
    // Shown in Tbilisi time (UTC+4).
    expect(email.text).toContain("2026-11-21 13:05");
    expect(email.text).toContain("https://www.manidevelopment.ge/admin/forgot-password");
    expect(email.text).not.toContain("#token=");
  });
});
