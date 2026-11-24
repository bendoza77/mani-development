import type { EmailMessage } from "../../integrations/mailer.js";

/** Emails about inquiries, built when they are sent (plain text, so nothing needs escaping). */

export const INQUIRY_NOTIFICATION = "inquiry-notification";

/** Visitor text in a header: line breaks and runs of spaces become one space. */
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

export function inquiryNotification(
  inquiry: { id: string; name: string; email: string; phone: string | null; subject: string; message: string; createdAt: Date },
  to: string,
  publicSiteUrl: string,
): EmailMessage {
  return {
    to,
    replyTo: oneLine(inquiry.email),
    subject: oneLine(`New inquiry: ${inquiry.subject}`).slice(0, 200),
    text: [
      `A new message arrived through the website contact form.`,
      ``,
      `Name:    ${inquiry.name}`,
      `Email:   ${inquiry.email}`,
      `Phone:   ${inquiry.phone ?? "—"}`,
      `Subject: ${inquiry.subject}`,
      `Sent:    ${inquiry.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC`,
      ``,
      inquiry.message,
      ``,
      `Open it in the admin panel: ${publicSiteUrl}/admin/inquiries?id=${inquiry.id}`,
      `Reply to this email to answer ${inquiry.name} directly.`,
    ].join("\n"),
  };
}
