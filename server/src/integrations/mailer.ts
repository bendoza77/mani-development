import type { Logger } from "pino";
import type { Config } from "../config/env.js";
import { createSmtpMailer } from "./smtp-mailer.js";

/**
 * Sending email: Gmail SMTP in staging and production (smtp-mailer.ts), printed to the terminal
 * in development, or only logged when no transport is set (docs/INTEGRATIONS.md §3).
 * Emails are plain text, so no HTML escaping is needed.
 */
/** `replyTo` lets the company answer an inquiry straight to the visitor. */
export type EmailMessage = { to: string; subject: string; text: string; replyTo?: string };

export type Mailer = { send(message: EmailMessage): Promise<void> };

/** A CR or LF in a header value would let someone add headers such as Bcc (SECURITY_PLAN §6). */
function assertSafeHeaders({ to, subject, replyTo }: EmailMessage) {
  if ([to, subject, replyTo ?? ""].some((value) => /[\r\n]/.test(value))) {
    throw new Error("Email header contains a line break");
  }
}

/** Prints the full email, reset links included. Allowed in development only (enforced by config). */
export function createConsoleMailer(print: (text: string) => void = console.log): Mailer {
  return {
    async send(message) {
      assertSafeHeaders(message);
      print(`\n──── email (development) ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n─────────────────────────────\n`);
    },
  };
}

/** Logs that an email would be sent, without its body (which may hold a reset link). */
export function createDisabledMailer(logger: Logger): Mailer {
  return {
    async send(message) {
      assertSafeHeaders(message);
      logger.warn({ to: message.to, subject: message.subject }, "email not sent: no mail transport configured");
    },
  };
}

export type FakeMailer = Mailer & { sent: EmailMessage[]; failNext(error: Error): void };

/** In-memory mailer for tests. */
export function createFakeMailer(): FakeMailer {
  const sent: EmailMessage[] = [];
  let failure: Error | undefined;
  return {
    sent,
    failNext(error) {
      failure = error;
    },
    async send(message) {
      assertSafeHeaders(message);
      if (failure) {
        const error = failure;
        failure = undefined;
        throw error;
      }
      sent.push(message);
    },
  };
}

/** The transport named by MAIL_TRANSPORT (docs/INTEGRATIONS.md §3). */
export function createMailer(config: Pick<Config, "mailTransport" | "smtp">, logger: Logger): Mailer {
  if (config.mailTransport === "smtp" && config.smtp) return createSmtpMailer(config.smtp);
  return config.mailTransport === "console" ? createConsoleMailer() : createDisabledMailer(logger);
}
