import { z } from "zod";

/**
 * Reads and validates configuration from environment variables, once, at startup.
 * Nothing else in the code base reads process.env (enforced by ESLint).
 * Contract: docs/INTEGRATIONS.md §9.
 */

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

/** An exact browser origin: http(s) scheme, host, optional port, nothing else. */
function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch {
    return false;
  }
}

const integerString = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

const databaseUrl = z.string().regex(/^postgres(ql)?:\/\/\S+$/, "must be a postgresql:// connection URL");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: integerString(1, 65535).optional(),
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.string().refine(isOrigin, "each entry must be an exact origin such as https://www.example.com"))
          .min(1, "must list at least one origin"),
      ),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    TRUST_PROXY_HOPS: integerString(0, 10).optional(),
    PUBLIC_SITE_URL: z.string().refine(isOrigin, "must be an exact origin such as https://www.example.com"),
    SESSION_IDLE_MINUTES: integerString(5, 10_080).optional(),
    SESSION_MAX_DAYS: integerString(1, 30).optional(),
    // "smtp" arrives in Phase 10. "none" logs that an email would be sent, without its content.
    MAIL_TRANSPORT: z.enum(["none", "console"]).optional(),
  });

/**
 * Checked separately from the schema: Zod skips object-level refinements when any field
 * fails, and every problem should be reported in one go.
 */
function environmentProblems(source: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  if (source.NODE_ENV === "production" && source.TRUST_PROXY_HOPS === undefined) {
    problems.push("TRUST_PROXY_HOPS is required in production (number of proxies in front of the app)");
  }
  if (source.MAIL_TRANSPORT === "console" && source.NODE_ENV !== "development") {
    problems.push("MAIL_TRANSPORT=console is only allowed in development (it prints password-reset links)");
  }
  return problems;
}

export type Config = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  logLevel: (typeof LOG_LEVELS)[number];
  trustProxyHops: number;
  /** The public website, used for links in emails (e.g. the password-reset page). */
  publicSiteUrl: string;
  sessionIdleMinutes: number;
  sessionMaxDays: number;
  mailTransport: "none" | "console";
  /**
   * Host-only, HttpOnly, SameSite=Strict session cookie (docs/SECURITY_PLAN.md §2). Development runs on
   * plain http://localhost, where a Secure / __Host- cookie can't be used.
   */
  sessionCookie: { name: "__Host-sid" | "sid"; secure: boolean };
};

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

const describeIssues = (error: z.ZodError) =>
  error.issues.map((issue) => {
    const name = issue.path.join(".") || "environment";
    const message = issue.code === "invalid_type" && issue.input === undefined ? "is required" : issue.message;
    return `${name} ${message}`;
  });

/** For command-line scripts (admin:create, admin:set-password), which only talk to the database. */
export function loadScriptConfig(source: Record<string, string | undefined> = process.env): { databaseUrl: string } {
  const result = z.object({ DATABASE_URL: databaseUrl }).safeParse(source);
  if (!result.success) throw new ConfigError(describeIssues(result.error));
  return { databaseUrl: result.data.DATABASE_URL };
}

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const result = schema.safeParse(source);
  const problems = [...(result.success ? [] : describeIssues(result.error)), ...environmentProblems(source)];
  if (!result.success || problems.length > 0) throw new ConfigError(problems);

  const env = result.data;
  const secureCookie = env.NODE_ENV !== "development";
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT ?? 4000,
    databaseUrl: env.DATABASE_URL,
    corsOrigins: env.CORS_ORIGINS,
    logLevel: env.LOG_LEVEL ?? "info",
    trustProxyHops: env.TRUST_PROXY_HOPS ?? 0,
    publicSiteUrl: env.PUBLIC_SITE_URL,
    sessionIdleMinutes: env.SESSION_IDLE_MINUTES ?? 720,
    sessionMaxDays: env.SESSION_MAX_DAYS ?? 7,
    mailTransport: env.MAIL_TRANSPORT ?? "none",
    sessionCookie: secureCookie ? { name: "__Host-sid", secure: true } : { name: "sid", secure: false },
  };
}
