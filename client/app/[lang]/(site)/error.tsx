"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="shell flex min-h-[80svh] flex-col justify-center pt-(--header-h)">
      <p className="t-eyebrow text-muted">{t("error.eyebrow")}</p>
      <h1 className="t-h1 mt-5 max-w-[16ch]">{t("error.title")}</h1>
      <p className="t-lead mt-5 max-w-xl text-ink-soft">
        {t("error.body")}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset} size="lg">
          {t("error.retry")}
        </Button>
        <ButtonLink href="/" variant="outline" size="lg">
          {t("error.home")}
        </ButtonLink>
      </div>
    </div>
  );
}
