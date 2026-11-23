"use client";

import { MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { useSiteSettings } from "@/components/layout/SiteSettings";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";
import { contactHref, type ContactChannel } from "@/lib/public-types";
import { ContactLink } from "./ContactLink";

const CHANNELS: { channel: ContactChannel; icon: typeof Phone }[] = [
  { channel: "phone", icon: Phone },
  { channel: "whatsapp", icon: MessageCircle },
  { channel: "messenger", icon: Send },
  { channel: "map", icon: MapPin },
];

/**
 * Call, WhatsApp, Messenger and Google Maps buttons from the site settings. A button appears only
 * when its setting is filled in; with none set, nothing renders.
 */
export function ContactChannels({ className, tone = "paper" }: { className?: string; tone?: "paper" | "night" }) {
  const { t } = useTranslation("contact");
  const settings = useSiteSettings();
  const items = CHANNELS.map((c) => ({ ...c, href: contactHref(c.channel, settings) })).filter(
    (c): c is typeof c & { href: string } => c.href !== null,
  );
  if (!items.length) return null;
  return (
    <ul className={cx("flex flex-wrap gap-2", className)} aria-label={t("channels.label")}>
      {items.map(({ channel, icon: Icon, href }) => (
        <li key={channel}>
          <ContactLink
            channel={channel}
            href={href}
            className={cx(
              "inline-flex h-10 items-center gap-2 rounded-[3px] border px-3.5 text-[0.85rem] font-medium transition-colors",
              tone === "night"
                ? "border-white/20 text-night-ink hover:border-night-ink hover:bg-night-ink hover:text-night"
                : "border-line-strong text-ink hover:border-ink hover:bg-ink hover:text-paper",
            )}
          >
            <Icon aria-hidden strokeWidth={1.6} className="size-4" />
            {t(`channels.${channel}`)}
            {/^https?:/i.test(href) && <span className="sr-only">{t("channels.newTab")}</span>}
          </ContactLink>
        </li>
      ))}
    </ul>
  );
}
