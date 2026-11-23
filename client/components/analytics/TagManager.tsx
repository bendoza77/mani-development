"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useStoredPref } from "@/hooks/useStoredPref";
import { isUnlocalizedPath, splitLocale } from "@/i18n/config";
import { CONSENT_KEY, gtag } from "@/lib/analytics";

const GTM_ID = /^GTM-[A-Z0-9]+$/;

/**
 * Google Tag Manager, loaded only when all three hold (SEO_ANALYTICS_PERFORMANCE §9.1, §9.4):
 * a container ID is set in the admin settings, the visitor accepted analytics, and the page is not
 * part of the admin. Consent Mode v2 defaults ("denied" for everything) are set before the
 * container loads; then analytics storage is granted, because the visitor accepted. The advertising
 * signals stay denied: the site runs no ads. GA4 is configured inside the container, never here.
 */
export function TagManager({ containerId }: { containerId: string }) {
  const [consent] = useStoredPref(CONSENT_KEY, "");
  const pathname = usePathname();
  const admin = isUnlocalizedPath(splitLocale(pathname).path);
  const enabled = GTM_ID.test(containerId) && consent === "granted" && !admin;

  // Accepted earlier in this visit, then declined from the footer link: the container can't be
  // unloaded, so tell it to stop storing analytics data.
  useEffect(() => {
    if (consent === "denied" && Array.isArray((window as Window & { dataLayer?: unknown[] }).dataLayer)) {
      gtag("consent", "update", { analytics_storage: "denied" });
    }
  }, [consent]);

  if (!enabled) return null;

  const init = [
    "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}",
    "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});",
    "gtag('consent','update',{analytics_storage:'granted'});",
    "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});",
    "var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;",
    "j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);",
    `})(window,document,'script','dataLayer','${containerId}');`,
  ].join("");

  return <Script id="gtm-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: init }} />;
}
