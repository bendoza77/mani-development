import type { Logger } from "pino";

/**
 * Sending email. Phase 4 has no real transport yet: development prints emails to the terminal,
 * other environments log that an email would have been sent. Gmail SMTP arrives in Phase 10
 * (docs/INTEGRATIONS.md §3). Emails are plain text, so no HTML escaping is needed.
 */
export type EmailMessage = { to: string; subject: string; text: string };

export type Mailer = { send(message: EmailMessage): Promise<void> };

/** A CR or LF in a header value would let someone add headers such as Bcc (SECURITY_PLAN §6). */
function assertSafeHeaders({ to, subject }: EmailMessage) {
  if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) {
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

export function createMailer(transport: "none" | "console", logger: Logger): Mailer {
  return transport === "console" ? createConsoleMailer() : createDisabledMailer(logger);
}
