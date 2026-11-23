import type { Logger } from "pino";

/**
 * Contact-form spam check with Cloudflare Turnstile (docs/SECURITY_PLAN.md §9). Returns true when
 * the visitor passed. Tests inject their own function instead of calling Cloudflare.
 */
export type SpamCheck = (token: string | undefined, ip: string | undefined) => Promise<boolean>;

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5_000;

export function createTurnstileCheck(secret: string, logger: Logger, fetchImpl: typeof fetch = fetch): SpamCheck {
  return async (token, ip) => {
    if (!token || token.length > 2048) return false;
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    try {
      const res = await fetchImpl(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const result = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
      if (!result.success) logger.info({ codes: result["error-codes"] }, "turnstile rejected a submission");
      return result.success === true;
    } catch (error) {
      // If Cloudflare can't be reached the submission is refused; the visitor can retry or call.
      logger.warn({ err: error }, "turnstile verification failed");
      return false;
    }
  };
}
