"use client";

import { Img } from "@/components/ui/Img";
import { TextLink } from "@/components/ui/Button";
import { IMAGES } from "@/data/images";
import { useTranslation } from "@/i18n/client";

/**
 * Who the company is: one statement, three differentiators and the key numbers. A client
 * component so its text follows the active language when it is switched in place.
 */
export function AboutSection() {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("company");
  const pillars = tc("pillars", { returnObjects: true });
  const stats = tc("stats", { returnObjects: true });
  return (
    <section className="py-[clamp(4rem,9vw,7rem)]" aria-labelledby="about-title">
      <div className="shell grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2px] lg:col-span-5 lg:aspect-auto">
          <Img
            src={IMAGES["site-team"].src}
            alt={t("about.imageAlt")}
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
        </div>

        <div className="lg:col-span-7">
          <p className="t-eyebrow text-muted">{t("about.eyebrow")}</p>
          <h2 id="about-title" className="t-h2 mt-4 max-w-[20ch]">
            {t("about.title")}
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">
            {t("about.body")}
          </p>

          <ul className="mt-10 grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
            {pillars.map(({ title, body }) => (
              <li key={title}>
                <h3 className="text-[1.02rem] font-semibold">{title}</h3>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="t-meta text-muted">{s.label}</dt>
                <dd className="mt-2 font-display text-[clamp(2rem,1.6rem+1.6vw,3rem)] leading-none tabular-nums tracking-[-0.03em]">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          <TextLink href="/about" className="mt-10">
            {t("about.link")}
          </TextLink>
        </div>
      </div>
    </section>
  );
}
