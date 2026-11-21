"use client";

import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { useContent, useTranslation } from "@/i18n/client";
import { formatPhone, mapsHref, telHref } from "@/lib/contact";
import { useDB } from "@/lib/store";

export function ContactDetails() {
  const { t } = useTranslation("contact");
  const { t: tc } = useTranslation("common");
  const s = useContent().settings(useDB((d) => d.settings));
  const rows = [
    { icon: Mail, label: t("details.email"), value: s.email, href: `mailto:${s.email}` },
    { icon: Phone, label: t("details.phone"), value: formatPhone(s.phone), href: telHref(s.phone) },
    { icon: MapPin, label: t("details.studio"), value: s.address, href: mapsHref(), maps: true },
    { icon: Clock, label: t("details.hours"), value: s.hours },
  ];
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-4 py-4">
          <r.icon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="t-meta text-muted">{r.label}</p>
            {r.maps ? (
              // One link for the address and its action: clicking either opens Google Maps.
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="group mt-1 block">
                <span className="block break-words text-[1rem] transition-colors group-hover:text-accent">{r.value}</span>
                <span className="mt-2 inline-flex items-center gap-1 border-b border-current pb-0.5 text-[0.88rem] font-medium text-accent">
                  {t("details.viewOnMap")}
                  <ArrowUpRight
                    aria-hidden
                    className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>
                <span className="sr-only"> {tc("a11y.opensInNewTab")}</span>
              </a>
            ) : r.href ? (
              <a href={r.href} className="mt-1 block break-words text-[1rem] hover:text-accent">
                {r.value}
              </a>
            ) : (
              <p className="mt-1 text-[1rem]">{r.value}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
