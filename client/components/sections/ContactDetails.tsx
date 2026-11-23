import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactLink } from "@/components/contact/ContactLink";
import { getT } from "@/i18n/server";
import { getSettings } from "@/lib/public-api";
import { contactHref, type ContactChannel } from "@/lib/public-types";

/** Email, phone, address and hours from the site settings; empty settings are left out. */
export async function ContactDetails() {
  const { t, locale } = await getT("contact");
  const s = await getSettings(locale);
  const rows: { icon: typeof Mail; label: string; value: string; channel?: ContactChannel; href?: string | null }[] = [
    { icon: Mail, label: t("details.email"), value: s.email, channel: "email", href: contactHref("email", s) },
    { icon: Phone, label: t("details.phone"), value: s.phone, channel: "phone", href: contactHref("phone", s) },
    { icon: MapPin, label: t("details.studio"), value: s.address, channel: "map", href: contactHref("map", s) },
    { icon: Clock, label: t("details.hours"), value: s.hours },
  ];
  const shown = rows.filter((r) => r.value);
  if (!shown.length) return null;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {shown.map((r) => (
        <li key={r.label} className="flex items-start gap-4 py-4">
          <r.icon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="t-meta text-muted">{r.label}</p>
            {r.href && r.channel ? (
              <ContactLink channel={r.channel} href={r.href} className="mt-1 block break-words text-[1rem] hover:text-accent">
                {r.value}
              </ContactLink>
            ) : (
              <p className="mt-1 text-[1rem]">{r.value}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
