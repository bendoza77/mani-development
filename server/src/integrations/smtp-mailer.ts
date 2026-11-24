import nodemailer from "nodemailer";
import type { Mailer } from "./mailer.js";

/**
 * Real email through Gmail / Google Workspace SMTP (docs/INTEGRATIONS.md §3.3): smtp.gmail.com on
 * port 465 with TLS from the first byte, signed in with an app password. There is no plaintext
 * fallback. Error messages are our own, so they can never contain the password.
 */
export type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  /** e.g. "MANI DEVELOPMENT <info@manidevelopment.ge>" */
  from: string;
  /** Tests only: accept the local test server's self-signed certificate. */
  insecureTlsForTests?: boolean;
};

const UNREACHABLE = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ECONNRESET"]);

function describe(error: unknown): Error {
  const { code, responseCode } = (error ?? {}) as { code?: string; responseCode?: number };
  if (code === "EAUTH" || responseCode === 535) {
    return new Error("SMTP sign-in refused: check the Gmail app password (it may have been revoked or the account password changed)");
  }
  if ((code && UNREACHABLE.has(code)) || (error as { syscall?: string } | null)?.syscall === "connect") {
    return new Error("Could not reach the mail server (temporary; will retry)");
  }
  return new Error(`SMTP error ${responseCode ?? code ?? "unknown"}`);
}

export function createSmtpMailer(options: SmtpOptions): Mailer {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: true,
    auth: { user: options.user, pass: options.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: !options.insecureTlsForTests },
  });

  return {
    async send(message) {
      if ([message.to, message.subject, message.replyTo ?? ""].some((value) => /[\r\n]/.test(value))) {
        throw new Error("Email header contains a line break");
      }
      try {
        await transport.sendMail({
          from: options.from,
          to: message.to,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          subject: message.subject,
          text: message.text,
        });
      } catch (error) {
        throw describe(error);
      }
    },
  };
}
