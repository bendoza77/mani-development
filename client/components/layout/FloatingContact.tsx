"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MessengerIcon, WhatsAppIcon } from "@/components/brand/ChannelIcons";
import { ContactLink } from "@/components/contact/ContactLink";
import { splitLocale } from "@/i18n/config";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";
import { contactHref } from "@/lib/public-types";
import { useSiteSettings } from "./SiteSettings";

const circle =
  "peer grid size-13 place-items-center rounded-full shadow-card transition-[transform,filter] duration-300 ease-(--ease-arch) hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0";

/**
 * WhatsApp and Messenger buttons fixed to the bottom-right corner of every public page. Each one
 * appears only when its number or username is filled in under Admin → Settings. The Contact page
 * lists the same channels in its own content, so the buttons stay off it rather than cover its map.
 */
export function FloatingContact() {
  const { t } = useTranslation("common");
  const { t: tc } = useTranslation("contact");
  const settings = useSiteSettings();
  const onContactPage = splitLocale(usePathname()).path === "/contact";
  const whatsapp = contactHref("whatsapp", settings);

  const channels = [
    {
      key: "whatsapp" as const,
      name: "WhatsApp",
      label: t("chat.whatsapp"),
      icon: <WhatsAppIcon className="size-6" strokeWidth={1.75} />,
      // Darker WhatsApp green keeps the white icon at 4:1 contrast.
      color: "bg-[#128c7e] text-white",
      href: whatsapp && `${whatsapp}?text=${encodeURIComponent(tc("actions.whatsappMessage", { company: settings.companyName }))}`,
    },
    {
      key: "messenger" as const,
      name: "Messenger",
      label: t("chat.messenger"),
      icon: <MessengerIcon className="size-6" strokeWidth={1.75} />,
      color: "bg-[#0866ff] text-white",
      href: contactHref("messenger", settings),
    },
  ];

  if (onContactPage) return null;
  if (!channels.some((c) => c.href) && process.env.NODE_ENV !== "development") return null;

  return (
    <aside
      aria-label={t("chat.region")}
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-col gap-3 sm:right-6 sm:bottom-6"
    >
      {channels.map((c) => (
        <Item key={c.key} tooltip={c.label}>
          {c.href ? (
            <ContactLink channel={c.key} href={c.href} aria-label={`${c.label} ${t("a11y.opensInNewTab")}`} className={cx(circle, c.color)}>
              {c.icon}
            </ContactLink>
          ) : process.env.NODE_ENV === "development" ? (
            // Dev-only placeholder for a channel with no destination yet.
            <span
              title={`Not configured: set ${c.name} in Admin → Settings (hidden in production builds).`}
              className={cx(circle, "border-2 border-dashed border-line-strong bg-card text-muted")}
            >
              {c.icon}
            </span>
          ) : null}
        </Item>
      ))}
    </aside>
  );
}

/** Wraps a button with a label that slides out on hover or keyboard focus (pointer devices only). */
function Item({ tooltip, children }: { tooltip: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="relative flex items-center justify-end">
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute right-full mr-3 translate-x-1 rounded-[3px] bg-ink px-2.5 py-1.5 text-[0.8rem] whitespace-nowrap text-paper opacity-0 shadow-card transition-[opacity,transform] duration-200 peer-hover:translate-x-0 peer-hover:opacity-100 peer-focus-visible:translate-x-0 peer-focus-visible:opacity-100 max-[480px]:hidden"
      >
        {tooltip}
      </span>
    </div>
  );
}
