import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";
import { afterEach, describe, expect, it } from "vitest";
import { createSmtpMailer } from "./smtp-mailer.js";

/**
 * Phase 10: the Gmail SMTP adapter, tested against a local SMTP server over implicit TLS
 * (port 465 style). The server uses smtp-server's built-in self-signed certificate, so only these
 * tests turn certificate checking off.
 */

const USER = "info@manidevelopment.ge";
const APP_PASSWORD = "abcd efgh ijkl mnop";

type Received = { from: string; to: string[]; raw: string; secure: boolean };

let server: SMTPServer | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

async function startSink(password = APP_PASSWORD) {
  const received: Received[] = [];
  server = new SMTPServer({
    secure: true,
    authMethods: ["PLAIN", "LOGIN"],
    logger: false,
    onAuth(auth, _session, callback) {
      if (auth.username === USER && auth.password === password) callback(null, { user: USER });
      else callback(Object.assign(new Error("Invalid login"), { responseCode: 535 }));
    },
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk: Buffer) => (raw += chunk.toString("utf8")));
      stream.on("end", () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          raw,
          secure: session.secure,
        });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const port = (server.server.address() as AddressInfo).port;
  return { port, received };
}

const mailerFor = (port: number, password = APP_PASSWORD) =>
  createSmtpMailer({
    host: "127.0.0.1",
    port,
    user: USER,
    password,
    from: `MANI DEVELOPMENT <${USER}>`,
    insecureTlsForTests: true,
  });

describe("SMTP mailer", () => {
  it("sends over TLS with the From, To, Reply-To and subject set", async () => {
    const { port, received } = await startSink();

    await mailerFor(port).send({
      to: "info@manidevelopment.ge",
      replyTo: "natia@example.com",
      subject: "New inquiry: ახალი სახლი",
      text: "Hello\nსალამი",
    });

    expect(received).toHaveLength(1);
    const [mail] = received;
    expect(mail!.secure).toBe(true);
    expect(mail!.from).toBe(USER);
    expect(mail!.to).toEqual(["info@manidevelopment.ge"]);
    expect(mail!.raw).toMatch(/^From: MANI DEVELOPMENT <info@manidevelopment\.ge>/m);
    expect(mail!.raw).toMatch(/^Reply-To: natia@example\.com/m);
    expect(mail!.raw).toMatch(/^Subject: =\?UTF-8\?/m);
  });

  it("explains a refused sign-in without revealing the password", async () => {
    const { port } = await startSink("a-different-password");

    const error = await mailerFor(port).send({ to: USER, subject: "x", text: "y" }).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/sign-in refused.*app password/i);
    expect((error as Error).message).not.toContain(APP_PASSWORD);
  });

  it("refuses a line break in a header before connecting", async () => {
    const mailer = mailerFor(1);
    await expect(mailer.send({ to: USER, subject: "a\r\nBcc: x@example.com", text: "y" })).rejects.toThrow(/line break/);
  });

  it("reports an unreachable server as a temporary failure", async () => {
    const error = await mailerFor(1).send({ to: USER, subject: "x", text: "y" }).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/could not reach the mail server/i);
  });
});
