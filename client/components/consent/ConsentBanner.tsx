"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";
import { useStoredPref } from "@/hooks/useStoredPref";
import { useTranslation } from "@/i18n/client";
import { CONSENT_KEY, CONSENT_OPEN_EVENT } from "@/lib/analytics";

/** Opens the banner again (footer "Cookie settings" link). */
export function openConsentBanner() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

/**
 * A small first-party consent banner (SEO_ANALYTICS_PERFORMANCE §9.4). Shown only when the site
 * has analytics configured and this browser hasn't chosen yet, or when reopened from the footer.
 * Nothing is sent to Google before "Accept"; the choice stays in this browser.
 */
export function ConsentBanner({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation("common");
  const hydrated = useHydrated();
  const [choice, setChoice] = useStoredPref(CONSENT_KEY, "");
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  if (!enabled || !hydrated || (choice && !reopened)) return null;

  const decide = (value: "granted" | "denied") => {
    setChoice(value);
    setReopened(false);
  };

  return (
    <section
      aria-labelledby="consent-title"
      className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-xl rounded-[3px] border border-line bg-card p-5 text-ink shadow-lg sm:inset-x-5 sm:bottom-5 sm:p-6"
    >
      <h2 id="consent-title" className="text-[1rem] font-semibold">
        {t("consent.title")}
      </h2>
      <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-soft">{t("consent.body")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => decide("granted")}>
          {t("consent.accept")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => decide("denied")}>
          {t("consent.decline")}
        </Button>
      </div>
    </section>
  );
}
