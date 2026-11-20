import type { EmailMessage } from "../../integrations/mailer.js";

/**
 * Admin account emails: plain text, Georgian first, then English (docs/BACKEND_MASTER_PLAN.md
 * Phase 4). They go only to the address stored on the account, never to one typed into a form.
 */

const SEPARATOR = "\n\n— — —\n\n";

/** "2026-11-21 13:05" in Tbilisi time. */
function tbilisiTime(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tbilisi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function passwordResetEmail({ to, link }: { to: string; link: string }): EmailMessage {
  const georgian = [
    "გამარჯობა,",
    "მივიღეთ მოთხოვნა MANI DEVELOPMENT-ის ადმინისტრატორის პაროლის აღდგენაზე. ახალი პაროლის დასაყენებლად გახსენით ეს ბმული 30 წუთის განმავლობაში:",
    link,
    "თუ ეს თქვენ არ მოგითხოვიათ, უბრალოდ უგულებელყავით ეს წერილი — პაროლი არ შეიცვლება.",
  ].join("\n\n");
  const english = [
    "Hello,",
    "To reset the password of your MANI DEVELOPMENT admin account, open this link within 30 minutes:",
    link,
    "If you didn't ask for this, ignore this email. Your password stays the same.",
  ].join("\n\n");
  return { to, subject: "Reset your MANI DEVELOPMENT admin password", text: georgian + SEPARATOR + english };
}

export function passwordChangedEmail({ to, at, resetPageUrl }: { to: string; at: Date; resetPageUrl: string }): EmailMessage {
  const when = tbilisiTime(at);
  const georgian = [
    "გამარჯობა,",
    `MANI DEVELOPMENT-ის ადმინისტრატორის პაროლი შეიცვალა ${when}-ზე (თბილისის დროით). ყველა მოწყობილობაზე სესია დასრულდა.`,
    `თუ ეს თქვენ არ გაგიკეთებიათ, დაუყოვნებლივ აღადგინეთ პაროლი: ${resetPageUrl}`,
    "და შეცვალეთ ამ ელფოსტის პაროლიც.",
  ].join("\n\n");
  const english = [
    "Hello,",
    `The password of your MANI DEVELOPMENT admin account was changed on ${when} (Tbilisi time). All devices have been signed out.`,
    `If this wasn't you, reset the password now: ${resetPageUrl}`,
    "and change the password of this email account too.",
  ].join("\n\n");
  return { to, subject: "Your MANI DEVELOPMENT admin password was changed", text: georgian + SEPARATOR + english };
}
