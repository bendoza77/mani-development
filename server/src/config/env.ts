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

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: integerString(1, 65535).optional(),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\/\S+$/, "must be a postgresql:// connection URL"),
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
  });

/**
 * Checked separately from the schema: Zod skips object-level refinements when any field
 * fails, and every problem should be reported in one go.
 */
function productionProblems(source: Record<string, string | undefined>): string[] {
  if (source.NODE_ENV === "production" && source.TRUST_PROXY_HOPS === undefined) {
    return ["TRUST_PROXY_HOPS is required in production (number of proxies in front of the app)"];
  }
  return [];
}

export type Config = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  logLevel: (typeof LOG_LEVELS)[number];
  trustProxyHops: number;
};

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const result = schema.safeParse(source);
  const problems = [
    ...(result.success
      ? []
      : result.error.issues.map((issue) => {
          const name = issue.path.join(".") || "environment";
          const message = issue.code === "invalid_type" && issue.input === undefined ? "is required" : issue.message;
          return `${name} ${message}`;
        })),
    ...productionProblems(source),
  ];
  if (!result.success || problems.length > 0) throw new ConfigError(problems);

  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT ?? 4000,
    databaseUrl: env.DATABASE_URL,
    corsOrigins: env.CORS_ORIGINS,
    logLevel: env.LOG_LEVEL ?? "info",
    trustProxyHops: env.TRUST_PROXY_HOPS ?? 0,
  };
}
