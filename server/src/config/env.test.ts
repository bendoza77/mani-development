import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, loadScriptConfig } from "./env.js";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/mani_dev",
  CORS_ORIGINS: "http://localhost:3000, https://www.manidevelopment.ge",
  PUBLIC_SITE_URL: "http://localhost:3000",
};

const cloudflare = {
  MEDIA_PROVIDER: "cloudflare",
  CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  CLOUDFLARE_IMAGES_API_TOKEN: "test-token-0123456789abcdef",
  CLOUDFLARE_IMAGES_ACCOUNT_HASH: "AbCdEf123456",
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
      publicSiteUrl: "http://localhost:3000",
      sessionIdleMinutes: 720,
      sessionMaxDays: 7,
      mailTransport: "none",
      // Development runs on plain http://localhost, so the cookie can't be Secure or __Host-.
      sessionCookie: { name: "sid", secure: false },
      apiPublicUrl: "http://localhost:4000",
      turnstileSecret: null,
      smtp: null,
      media: { provider: "local", dir: "uploads" },
    });
  });

  it("uses a Secure __Host- cookie everywhere except development", () => {
    for (const NODE_ENV of ["test", "production"]) {
      const config = loadConfig({ ...valid, ...cloudflare, NODE_ENV, TRUST_PROXY_HOPS: "1" });

      expect(config.sessionCookie).toEqual({ name: "__Host-sid", secure: true });
    }
  });

  it("requires PUBLIC_SITE_URL to be an exact origin", () => {
    expect(problemsOf({ ...valid, PUBLIC_SITE_URL: undefined })[0]).toMatch(/PUBLIC_SITE_URL/);
    expect(problemsOf({ ...valid, PUBLIC_SITE_URL: "https://www.manidevelopment.ge/admin" })[0]).toMatch(
      /PUBLIC_SITE_URL/,
    );
  });

  it("refuses the console mail transport outside development (it would print reset links to logs)", () => {
    expect(loadConfig({ ...valid, MAIL_TRANSPORT: "console" }).mailTransport).toBe("console");
    expect(problemsOf({ ...valid, NODE_ENV: "test", MAIL_TRANSPORT: "console" })[0]).toMatch(/MAIL_TRANSPORT/);
  });

  it("reads the Gmail SMTP settings, with Gmail's server and port 465 by default", () => {
    const config = loadConfig({ ...valid, MAIL_TRANSPORT: "smtp", SMTP_USER: "info@manidevelopment.ge", SMTP_APP_PASSWORD: "abcd efgh ijkl mnop" });

    expect(config.mailTransport).toBe("smtp");
    expect(config.smtp).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      user: "info@manidevelopment.ge",
      password: "abcd efgh ijkl mnop",
      from: "MANI DEVELOPMENT <info@manidevelopment.ge>",
    });
    expect(loadConfig(valid).smtp).toBeNull();
  });

  it("names the missing SMTP settings and never repeats the password in a problem", () => {
    expect(problemsOf({ ...valid, MAIL_TRANSPORT: "smtp" })).toEqual([
      "SMTP_USER is required when MAIL_TRANSPORT=smtp",
      "SMTP_APP_PASSWORD is required when MAIL_TRANSPORT=smtp",
    ]);
    const problems = problemsOf({ ...valid, MAIL_TRANSPORT: "smtp", SMTP_USER: "not-an-email", SMTP_APP_PASSWORD: "secret-pass-1234" });
    expect(problems.join("\n")).toMatch(/SMTP_USER/);
    expect(problems.join("\n")).not.toContain("secret-pass-1234");
  });

  it("accepts session lengths within limits", () => {
    const config = loadConfig({ ...valid, SESSION_IDLE_MINUTES: "60", SESSION_MAX_DAYS: "3" });

    expect(config.sessionIdleMinutes).toBe(60);
    expect(config.sessionMaxDays).toBe(3);
    expect(problemsOf({ ...valid, SESSION_MAX_DAYS: "90" })[0]).toMatch(/SESSION_MAX_DAYS/);
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
    const config = loadConfig({ ...valid, ...cloudflare, NODE_ENV: "production", TRUST_PROXY_HOPS: "2", PORT: "10000" });

    expect(config.trustProxyHops).toBe(2);
    expect(config.port).toBe(10000);
  });
});

describe("media storage", () => {
  it("uses Cloudflare Images when its three settings are given", () => {
    expect(loadConfig({ ...valid, ...cloudflare }).media).toEqual({
      provider: "cloudflare",
      accountId: cloudflare.CLOUDFLARE_ACCOUNT_ID,
      apiToken: cloudflare.CLOUDFLARE_IMAGES_API_TOKEN,
      accountHash: cloudflare.CLOUDFLARE_IMAGES_ACCOUNT_HASH,
    });
  });

  it("names each missing Cloudflare setting", () => {
    const problems = problemsOf({ ...valid, MEDIA_PROVIDER: "cloudflare" });
    const all = problems.join(" | ");
    expect(all).toMatch(/CLOUDFLARE_ACCOUNT_ID/);
    expect(all).toMatch(/CLOUDFLARE_IMAGES_API_TOKEN/);
    expect(all).toMatch(/CLOUDFLARE_IMAGES_ACCOUNT_HASH/);
  });

  it("refuses local photo storage in production", () => {
    expect(problemsOf({ ...valid, NODE_ENV: "production", TRUST_PROXY_HOPS: "1" })[0]).toMatch(/MEDIA_PROVIDER/);
  });
});

describe("loadScriptConfig (command-line scripts need only the database)", () => {
  it("reads DATABASE_URL alone", () => {
    expect(loadScriptConfig({ DATABASE_URL: valid.DATABASE_URL })).toEqual({ databaseUrl: valid.DATABASE_URL });
  });

  it("names DATABASE_URL when it is missing or wrong", () => {
    for (const DATABASE_URL of [undefined, "mysql://localhost/db"]) {
      expect(() => loadScriptConfig({ DATABASE_URL })).toThrow(/DATABASE_URL/);
    }
  });
});
