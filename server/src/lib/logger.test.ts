import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  return { lines, stream };
}

describe("createLogger", () => {
  it("redacts cookies, authorization and set-cookie headers", () => {
    const { lines, stream } = capture();
    const logger = createLogger("info", stream);

    logger.info(
      {
        req: { headers: { cookie: "sid=secret-session", authorization: "Bearer secret-token", accept: "*/*" } },
        res: { headers: { "set-cookie": "sid=secret-session; HttpOnly" } },
      },
      "request completed",
    );

    const output = lines.join("");
    expect(output).not.toContain("secret-session");
    expect(output).not.toContain("secret-token");
    expect(output).toContain("[Redacted]");
    expect(output).toContain('"accept":"*/*"');
  });

  it.each(["password", "currentPassword", "newPassword", "token", "secret"])(
    "redacts a %s field at the top level and one level down",
    (field) => {
      const { lines, stream } = capture();
      const logger = createLogger("info", stream);

      logger.info({ [field]: "top-level-value", body: { [field]: "nested-value" } }, "event");

      const output = lines.join("");
      expect(output).not.toContain("top-level-value");
      expect(output).not.toContain("nested-value");
    },
  );

  it("respects the configured level", () => {
    const { lines, stream } = capture();
    const logger = createLogger("warn", stream);

    logger.info("hidden");
    logger.warn("shown");

    expect(lines.join("")).not.toContain("hidden");
    expect(lines.join("")).toContain("shown");
  });
});
