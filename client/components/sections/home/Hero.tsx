"use client";

import { Trans } from "react-i18next";
import { HouseViewer } from "@/components/3d/house/HouseViewer";
import { ButtonLink } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";

/**
 * Homepage opening: what the company does, the two main actions and three key facts, beside a
 * 3D house that builds itself. A client component so its text always follows the active language
 * (it reads the same translation provider as the header when the language is switched in place).
 */
export function Hero() {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("company");
  const { t: th } = useTranslation("house");
  const facts = tc("heroFacts", { returnObjects: true });
  return (
    <section className="pt-(--header-h)" aria-labelledby="hero-title">
      <div className="shell grid gap-10 py-[clamp(2rem,6vw,4.5rem)] lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="lg:col-span-6 xl:col-span-5">
          <p className="t-eyebrow rise-in text-muted">{t("hero.eyebrow")}</p>
          <h1 id="hero-title" className="t-h1 rise-in mt-6" style={{ "--d": "60ms" } as React.CSSProperties}>
            <Trans t={t} i18nKey="hero.title" components={{ em: <em className="text-accent" /> }} />
          </h1>
          <p className="t-lead leading-relaxed rise-in mt-6 max-w-[34rem] text-ink-soft" style={{ "--d": "120ms" } as React.CSSProperties}>
            {t("hero.lead")}
          </p>
          <div className="rise-in leading-relaxed mt-8 flex flex-wrap gap-3" style={{ "--d": "180ms" } as React.CSSProperties}>
            <ButtonLink href="/contact" size="lg" arrow>
              {t("hero.primaryCta")}
            </ButtonLink>
            <ButtonLink href="/projects" size="lg" variant="outline">
              {t("hero.secondaryCta")}
            </ButtonLink>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-x-4 border-t border-line pt-5 sm:gap-x-6">
            {facts.map(({ label, value }) => (
              <div key={label}>
                <dt className="t-meta text-muted">{label}</dt>
                <dd className="mt-1 text-[0.85rem] leading-snug sm:text-[0.95rem]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="min-w-0 lg:col-span-6 lg:self-start xl:col-span-7">
          <HouseViewer className="aspect-[4/3] text-ink/45 [--drawing-bg:var(--paper)] lg:aspect-[6/5] xl:aspect-[5/4]" />
          <figcaption className="t-meta mt-3 text-muted">{th("ui.disclaimer")}</figcaption>
        </figure>
      </div>
    </section>
  );
}
