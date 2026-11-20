"use client";

import { Mail, MapPin, Phone, Clock } from "lucide-react";
import { useContent, useTranslation } from "@/i18n/client";
import { useDB } from "@/lib/store";

export function ContactDetails() {
  const { t } = useTranslation("contact");
  const s = useContent().settings(useDB((d) => d.settings));
  const rows = [
    { icon: Mail, label: t("details.email"), value: s.email, href: `mailto:${s.email}` },
    { icon: Phone, label: t("details.phone"), value: s.phone, href: `tel:${s.phone.replace(/\s/g, "")}` },
    { icon: MapPin, label: t("details.studio"), value: s.address },
    { icon: Clock, label: t("details.hours"), value: s.hours },
  ];
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-4 py-4">
          <r.icon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="t-meta text-muted">{r.label}</p>
            {r.href ? (
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
