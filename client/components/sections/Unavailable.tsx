import { ButtonLink } from "@/components/ui/Button";
import { getT } from "@/i18n/server";

/** Shown in place of content the API couldn't deliver (the rest of the page still works). */
export async function Unavailable() {
  const { t } = await getT("errors");
  return (
    <div className="shell flex min-h-[70svh] flex-col items-start justify-center pt-(--header-h)">
      <p className="t-eyebrow text-muted">{t("unavailable.eyebrow")}</p>
      <h1 className="t-h1 mt-5 max-w-[18ch]">{t("unavailable.title")}</h1>
      <p className="t-lead mt-5 max-w-xl text-ink-soft">{t("unavailable.body")}</p>
      <ButtonLink href="/" className="mt-8" variant="outline">
        {t("error.home")}
      </ButtonLink>
    </div>
  );
}
