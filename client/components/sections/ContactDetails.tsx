import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactLink } from "@/components/contact/ContactLink";
import { getT } from "@/i18n/server";
import { formatPhone, mapsHref } from "@/lib/contact";
import { getSettings } from "@/lib/public-api";
import { contactHref, type ContactChannel } from "@/lib/public-types";

/** Email, phone, address and hours from the site settings; empty settings are left out. */
export async function ContactDetails() {
  const { t, locale } = await getT("contact");
  const { t: tc } = await getT("common");
  const s = await getSettings(locale);
  const rows: { icon: typeof Mail; label: string; value: string; channel?: ContactChannel; href?: string | null; maps?: boolean }[] = [
    { icon: Mail, label: t("details.email"), value: s.email, channel: "email", href: contactHref("email", s) },
    { icon: Phone, label: t("details.phone"), value: formatPhone(s.phone), channel: "phone", href: contactHref("phone", s) },
    { icon: MapPin, label: t("details.studio"), value: s.address, channel: "map", href: mapsHref(s), maps: true },
    { icon: Clock, label: t("details.hours"), value: s.hours },
  ];
  const shown = rows.filter((r) => r.value);
  if (!shown.length) return null;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {shown.map((r) => (
        <li key={r.label} className="flex items-start gap-4 py-4">
          <r.icon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="t-meta text-muted">{r.label}</p>
            {r.maps && r.href && r.channel ? (
              // One link for the address and its action: clicking either opens Google Maps.
              <ContactLink channel={r.channel} href={r.href} className="group mt-1 block">
                <span className="block break-words text-[1rem] transition-colors group-hover:text-accent">{r.value}</span>
                <span className="mt-2 inline-flex items-center gap-1 border-b border-current pb-0.5 text-[0.88rem] font-medium text-accent">
                  {t("details.viewOnMap")}
                  <ArrowUpRight
                    aria-hidden
                    className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>
                <span className="sr-only"> {tc("a11y.opensInNewTab")}</span>
              </ContactLink>
            ) : r.href && r.channel ? (
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
