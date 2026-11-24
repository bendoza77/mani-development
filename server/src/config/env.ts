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
    MAIL_TRANSPORT: z.enum(["none", "console", "smtp"]).optional(),
    // Gmail / Google Workspace SMTP (docs/INTEGRATIONS.md §3.3). The app password is a secret:
    // only in the local .env and in Render, never in Git or chat.
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: integerString(1, 65535).optional(),
    SMTP_USER: z.email("must be the sending account's email address").optional(),
    SMTP_APP_PASSWORD: z.string().min(8, "is too short to be an app password").optional(),
    MAIL_FROM: z.string().min(3).max(200).optional(),
    // Where uploaded photos go: "local" = a folder on this machine (development only),
    // "cloudflare" = Cloudflare Images (docs/INTEGRATIONS.md §1).
    MEDIA_PROVIDER: z.enum(["local", "cloudflare"]).optional(),
    MEDIA_LOCAL_DIR: z.string().min(1).optional(),
    // This API's own public address, for links to locally stored photos.
    API_PUBLIC_URL: z.string().refine(isOrigin, "must be an exact origin such as http://localhost:4000").optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/, "must be the 32-character account ID").optional(),
    CLOUDFLARE_IMAGES_API_TOKEN: z.string().min(20).optional(),
    CLOUDFLARE_IMAGES_ACCOUNT_HASH: z.string().regex(/^[A-Za-z0-9_-]{10,}$/, "must be the Images account hash").optional(),
    // Cloudflare Turnstile secret for the contact form. Unset = no spam check beyond the honeypot
    // and the rate limits (docs/SECURITY_PLAN.md §9).
    TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
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
  if (source.MEDIA_PROVIDER === "cloudflare") {
    for (const name of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_IMAGES_API_TOKEN", "CLOUDFLARE_IMAGES_ACCOUNT_HASH"]) {
      if (!source[name]) problems.push(`${name} is required when MEDIA_PROVIDER=cloudflare`);
    }
  } else if (source.NODE_ENV === "production") {
    problems.push("MEDIA_PROVIDER=cloudflare is required in production (local files are lost on every deploy)");
  }
  if (source.MAIL_TRANSPORT === "smtp") {
    for (const name of ["SMTP_USER", "SMTP_APP_PASSWORD"]) {
      if (!source[name]) problems.push(`${name} is required when MAIL_TRANSPORT=smtp`);
    }
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
  mailTransport: "none" | "console" | "smtp";
  /** Set when mailTransport is "smtp". */
  smtp: { host: string; port: number; user: string; password: string; from: string } | null;
  /**
   * Host-only, HttpOnly, SameSite=Strict session cookie (docs/SECURITY_PLAN.md §2). Development runs on
   * plain http://localhost, where a Secure / __Host- cookie can't be used.
   */
  sessionCookie: { name: "__Host-sid" | "sid"; secure: boolean };
  /** This API's public origin (links to locally stored photos). */
  apiPublicUrl: string;
  /** Contact-form spam check (Cloudflare Turnstile); null = off. */
  turnstileSecret: string | null;
  media:
    | { provider: "local"; dir: string }
    | { provider: "cloudflare"; accountId: string; apiToken: string; accountHash: string };
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
    smtp:
      env.MAIL_TRANSPORT === "smtp"
        ? {
            host: env.SMTP_HOST ?? "smtp.gmail.com",
            port: env.SMTP_PORT ?? 465,
            user: env.SMTP_USER!,
            password: env.SMTP_APP_PASSWORD!,
            from: env.MAIL_FROM ?? `MANI DEVELOPMENT <${env.SMTP_USER}>`,
          }
        : null,
    sessionCookie: secureCookie ? { name: "__Host-sid", secure: true } : { name: "sid", secure: false },
    apiPublicUrl: env.API_PUBLIC_URL ?? `http://localhost:${env.PORT ?? 4000}`,
    turnstileSecret: env.TURNSTILE_SECRET_KEY ?? null,
    media:
      env.MEDIA_PROVIDER === "cloudflare"
        ? {
            provider: "cloudflare",
            accountId: env.CLOUDFLARE_ACCOUNT_ID!,
            apiToken: env.CLOUDFLARE_IMAGES_API_TOKEN!,
            accountHash: env.CLOUDFLARE_IMAGES_ACCOUNT_HASH!,
          }
        : { provider: "local", dir: env.MEDIA_LOCAL_DIR ?? "uploads" },
  };
}
