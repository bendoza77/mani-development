import type { Metadata } from "next";
import { Trans } from "react-i18next/TransWithoutContext";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { LocaleLink as Link } from "@/i18n/LocaleLink";
import { getT } from "@/i18n/server";
import { seedSettings } from "@/data/seed";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("meta");
  return { title: t("notFound.title") };
}

export default async function NotFound() {
  const { t, i18n } = await getT("errors");
  const { t: tc } = await getT("common");
  return (
    <main className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden className="drafting-grid absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="shell flex h-(--header-h) items-center">
        <Link href="/" aria-label={tc("brand.home", { name: seedSettings.companyName })} className="inline-flex items-center gap-2.5 text-ink">
          <LogoMark className="size-7" />
          <span lang="en" className="text-[1.05rem] font-semibold tracking-[0.2em] uppercase">
            {seedSettings.companyName}
          </span>
        </Link>
      </div>
      <div className="shell flex flex-1 flex-col justify-center py-16">
        <p className="t-eyebrow text-muted">{t("notFound.eyebrow")}</p>
        <h1 className="t-display mt-6 max-w-[14ch]">
          <Trans t={t} i18n={i18n} i18nKey="notFound.title" components={{ em: <em className="text-accent" /> }} />
        </h1>
        <p className="t-lead mt-6 max-w-xl text-ink-soft">{t("notFound.body")}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href="/" arrow size="lg">
            {t("notFound.home")}
          </ButtonLink>
          <ButtonLink href="/projects" variant="outline" size="lg">
            {t("notFound.projects")}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
