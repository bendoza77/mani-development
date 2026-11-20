import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "../lib/logger.js";
import { createConsoleMailer, createDisabledMailer, createFakeMailer } from "./mailer.js";

const message = { to: "info@manidevelopment.ge", subject: "Reset your password", text: "Open https://x/#token=SECRET" };

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _e, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  return { lines, logger: createLogger("info", stream) };
}

describe("fake mailer (tests)", () => {
  it("records every message it is asked to send", async () => {
    const mailer = createFakeMailer();

    await mailer.send(message);

    expect(mailer.sent).toEqual([message]);
  });

  it("can be told to fail", async () => {
    const mailer = createFakeMailer();
    mailer.failNext(new Error("SMTP down"));

    await expect(mailer.send(message)).rejects.toThrow("SMTP down");
    expect(mailer.sent).toEqual([]);
  });
});

describe("console mailer (development only)", () => {
  it("prints the whole message, so a developer can follow a reset link locally", async () => {
    const printed: string[] = [];
    const mailer = createConsoleMailer((text) => printed.push(text));

    await mailer.send(message);

    expect(printed.join("\n")).toContain("info@manidevelopment.ge");
    expect(printed.join("\n")).toContain("#token=SECRET");
  });
});

describe("disabled mailer (no transport yet)", () => {
  it("logs the recipient and subject but never the body", async () => {
    const { lines, logger } = captureLogger();
    const mailer = createDisabledMailer(logger);

    await mailer.send(message);

    const output = lines.join("");
    expect(output).toContain("Reset your password");
    expect(output).not.toContain("SECRET");
  });
});

describe("every mailer", () => {
  it.each([
    ["to", "info@manidevelopment.ge\r\nBcc: victim@example.com"],
    ["subject", "Hello\nBcc: victim@example.com"],
  ] as const)("refuses a line break in %s (header injection)", async (field, value) => {
    for (const mailer of [createFakeMailer(), createConsoleMailer(() => {}), createDisabledMailer(createLogger("silent"))]) {
      await expect(mailer.send({ ...message, [field]: value })).rejects.toThrow(/line break/);
    }
  });
});
