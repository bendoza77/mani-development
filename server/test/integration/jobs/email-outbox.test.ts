import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createFakeMailer, type Mailer } from "../../../src/integrations/mailer.js";
import { createEmailOutbox } from "../../../src/jobs/email-outbox.js";
import { createLogger } from "../../../src/lib/logger.js";
import { ALLOWED_ORIGIN, buildTestApp } from "../../helpers/app.js";
import { minutes, testClock } from "../../helpers/auth.js";
import { resetDb } from "../../helpers/db.js";

/** Phase 9: inquiry emails go through a database queue and are retried until delivered. */

const clock = testClock(new Date("2026-11-21T09:00:00Z"));
const { app, db, config, close } = buildTestApp({ clock });
const prisma = db.prisma;
const logger = createLogger("silent");
afterAll(close);
beforeEach(() => resetDb());

const submit = (overrides: Record<string, unknown> = {}) =>
  request(app)
    .post("/api/public/inquiries")
    .set("Origin", ALLOWED_ORIGIN)
    .send({
      name: "Natia Gogoladze",
      email: "natia@example.com",
      phone: "",
      subject: "Family house in Tskneti",
      message: "We own a 900 m² plot and would like a two-storey house.",
      ...overrides,
    });

const outbox = (mailer: Mailer) => createEmailOutbox({ prisma, mailer, clock, logger, config });
const failing: Mailer = {
  async send() {
    throw new Error("SMTP down");
  },
};

describe("email outbox", () => {
  it("sends the company notification with the visitor as Reply-To and a link to the inbox", async () => {
    await submit();
    const mailer = createFakeMailer();

    const result = await outbox(mailer).runOnce();

    expect(result).toEqual({ sent: 1, retried: 0, failed: 0 });
    const [email] = mailer.sent;
    const inquiry = await prisma.inquiry.findFirstOrThrow();
    expect(email).toMatchObject({
      to: "info@manidevelopment.ge",
      replyTo: "natia@example.com",
      subject: "New inquiry: Family house in Tskneti",
    });
    expect(email!.text).toContain("Natia Gogoladze");
    expect(email!.text).toContain("900 m²");
    expect(email!.text).toContain(`${config.publicSiteUrl}/admin/inquiries?id=${inquiry.id}`);
    expect(await prisma.emailMessage.findFirstOrThrow()).toMatchObject({ status: "sent", attempts: 1 });
    expect((await outbox(mailer).runOnce()).sent).toBe(0);
  });

  it("retries with growing delays and gives up after 5 attempts", async () => {
    await submit();
    const delays: number[] = [];

    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await outbox(failing).runOnce();
      const row = await prisma.emailMessage.findFirstOrThrow();
      expect(row.attempts).toBe(attempt);
      if (attempt < 5) {
        expect(result).toEqual({ sent: 0, retried: 1, failed: 0 });
        expect(row.status).toBe("pending");
        expect(row.lastError).toBe("SMTP down");
        delays.push(row.nextAttemptAt.getTime() - clock.now().getTime());
        // Not due yet: nothing happens.
        expect((await outbox(failing).runOnce()).retried).toBe(0);
        clock.advance(row.nextAttemptAt.getTime() - clock.now().getTime());
      } else {
        expect(result).toEqual({ sent: 0, retried: 0, failed: 1 });
        expect(row.status).toBe("failed");
      }
    }
    expect(delays).toEqual([minutes(1), minutes(5), minutes(30), minutes(120)]);
  });

  it("delivers queued mail once the transport works again", async () => {
    await submit();
    await outbox(failing).runOnce();
    clock.advance(minutes(1));
    const mailer = createFakeMailer();

    expect((await outbox(mailer).runOnce()).sent).toBe(1);
    expect(mailer.sent).toHaveLength(1);
  });

  it("never sends a message twice when two workers run at once", async () => {
    for (let i = 0; i < 6; i++) await submit({ subject: `Inquiry number ${i}` });
    const mailer = createFakeMailer();

    await Promise.all([outbox(mailer).runOnce(), outbox(mailer).runOnce(), outbox(mailer).runOnce()]);

    expect(mailer.sent.map((m) => m.subject).sort()).toEqual([0, 1, 2, 3, 4, 5].map((i) => `New inquiry: Inquiry number ${i}`));
  });

  it("keeps line breaks out of the subject even if the visitor typed some", async () => {
    await submit({ subject: "Hello\r\nBcc: victim@example.com" });
    const mailer = createFakeMailer();

    await outbox(mailer).runOnce();

    expect(mailer.sent[0]!.subject).toBe("New inquiry: Hello Bcc: victim@example.com");
  });
});
