"use client";

import type { ComponentProps } from "react";
import { track, type ContactChannel } from "@/lib/analytics";

/**
 * A phone, email, WhatsApp, Messenger or map link that reports a `contact_click` event (only the
 * channel name, nothing personal). Outside addresses open in a new tab.
 */
export function ContactLink({
  channel,
  href,
  onClick,
  ...rest
}: { channel: ContactChannel; href: string } & Omit<ComponentProps<"a">, "href">) {
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
      onClick={(e) => {
        track("contact_click", { channel });
        onClick?.(e);
      }}
    />
  );
}
