import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/mani_dev",
  CORS_ORIGINS: "http://localhost:3000, https://www.manidevelopment.ge",
};

function problemsOf(source: Record<string, string | undefined>): string[] {
  try {
    loadConfig(source);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  throw new Error("expected loadConfig to throw a ConfigError");
}

describe("loadConfig", () => {
  it("parses a valid environment and applies defaults", () => {
    const config = loadConfig(valid);

    expect(config).toEqual({
      nodeEnv: "development",
      port: 4000,
      databaseUrl: valid.DATABASE_URL,
      corsOrigins: ["http://localhost:3000", "https://www.manidevelopment.ge"],
      logLevel: "info",
      trustProxyHops: 0,
    });
  });

  it("names every missing required variable at once", () => {
    const problems = problemsOf({});

    expect(problems.join("\n")).toMatch(/NODE_ENV/);
    expect(problems.join("\n")).toMatch(/DATABASE_URL/);
    expect(problems.join("\n")).toMatch(/CORS_ORIGINS/);
  });

  it("rejects a database URL that is not PostgreSQL", () => {
    const problems = problemsOf({ ...valid, DATABASE_URL: "mysql://localhost/db" });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/DATABASE_URL/);
  });

  it.each(["*", "https://www.manidevelopment.ge/path", "not-a-url", "ftp://example.com"])(
    "rejects the CORS origin %s",
    (origin) => {
      const problems = problemsOf({ ...valid, CORS_ORIGINS: origin });

      expect(problems[0]).toMatch(/CORS_ORIGINS/);
    },
  );

  it.each(["0", "70000", "abc", "40.5"])("rejects PORT=%s", (port) => {
    const problems = problemsOf({ ...valid, PORT: port });

    expect(problems[0]).toMatch(/PORT/);
  });

  it("requires TRUST_PROXY_HOPS in production", () => {
    const problems = problemsOf({ ...valid, NODE_ENV: "production" });

    expect(problems[0]).toMatch(/TRUST_PROXY_HOPS/);
  });

  it("lists the production-only requirement together with other problems", () => {
    const problems = problemsOf({ NODE_ENV: "production" });

    expect(problems.join("\n")).toMatch(/DATABASE_URL/);
    expect(problems.join("\n")).toMatch(/CORS_ORIGINS/);
    expect(problems.join("\n")).toMatch(/TRUST_PROXY_HOPS/);
  });

  it("accepts a production environment with TRUST_PROXY_HOPS set", () => {
    const config = loadConfig({ ...valid, NODE_ENV: "production", TRUST_PROXY_HOPS: "2", PORT: "10000" });

    expect(config.trustProxyHops).toBe(2);
    expect(config.port).toBe(10000);
  });
});
