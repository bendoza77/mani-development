import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { Img } from "@/components/ui/Img";
import { Trans } from "react-i18next/TransWithoutContext";
import { IMAGES } from "@/data/images";
import { getT, pageMetadata } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("about", "/about");
}

export default async function AboutPage() {
  const { t, i18n } = await getT("about");
  const { t: tc } = await getT("company");
  const em = { em: <em className="text-accent" /> };
  const stats = tc("stats", { returnObjects: true });
  return (
    <>
      <PageIntro
        eyebrow={t("page.eyebrow")}
        title={<Trans t={t} i18n={i18n} i18nKey="page.title" components={em} />}
        lead={t("page.lead")}
      />

      <section className="shell grid gap-10 pb-[clamp(4rem,9vw,7rem)] lg:grid-cols-12" aria-labelledby="story-title">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2px] lg:col-span-5 lg:aspect-[4/5]">
          <Img src={IMAGES.drawings.src} alt={t("story.imageAlt")} sizes="(min-width: 1024px) 40vw, 100vw" />
        </div>
        <div className="flex flex-col justify-center lg:col-span-6 lg:col-start-7">
          <p className="t-eyebrow text-muted">{t("story.eyebrow")}</p>
          <h2 id="story-title" className="t-h2 mt-4">{t("story.title")}</h2>
          <div className="mt-6 space-y-4 leading-[1.75] text-ink-soft">
            {t("story.paragraphs", { returnObjects: true }).map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
          <blockquote className="mt-10 border-l-2 border-accent pl-6">
            <p className="font-display text-[1.5rem] leading-snug">
              {t("story.quote")}
            </p>
            <footer className="t-meta mt-3 text-muted">{t("story.quoteAuthor")}</footer>
          </blockquote>
        </div>
      </section>

      <section className="bg-night py-[clamp(4rem,9vw,7rem)] text-night-ink" aria-labelledby="mission-title">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="t-eyebrow text-night-muted">{t("mission.eyebrow")}</p>
            <h2 id="mission-title" className="t-h2 mt-4">
              <Trans t={t} i18n={i18n} i18nKey="mission.title" components={em} />
            </h2>
            <p className="t-lead mt-6 text-night-muted">{t("mission.lead")}</p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-[2px] bg-white/10 sm:grid-cols-2 lg:col-span-7">
            {t("mission.values", { returnObjects: true }).map((v, i) => (
              <li key={v.title} className="bg-night p-7">
                <p className="t-meta text-accent">0{i + 1}</p>
                <h3 className="mt-4 text-[1.1rem] font-semibold">{v.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-night-muted">{v.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line" aria-label={t("numbers.label")}>
        <dl className="shell grid grid-cols-2 gap-x-6 gap-y-10 py-[clamp(3rem,7vw,5rem)] lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="t-eyebrow text-muted">{s.label}</dt>
              <dd className="mt-3 font-display text-[clamp(2.6rem,1.8rem+3vw,4.5rem)] leading-none tabular-nums tracking-[-0.04em]">
                {s.value}
              </dd>
              <dd className="mt-2 text-[0.85rem] text-muted">{s.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="shell grid gap-12 py-[clamp(4rem,9vw,7rem)] lg:grid-cols-12" aria-labelledby="philosophy-title">
        <div className="lg:col-span-4">
          <p className="t-eyebrow text-muted">{t("standards.eyebrow")}</p>
          <h2 id="philosophy-title" className="t-h2 mt-4">{t("standards.title")}</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8">
          {t("standards.items", { returnObjects: true }).map((item) => (
            <div key={item.title} className="border-t border-ink pt-5">
              <h3 className="text-[1.05rem] font-semibold">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
          <p className="text-[0.8rem] text-muted sm:col-span-2">{t("standards.note")}</p>
        </div>
      </section>

      <section className="border-t border-line bg-paper-2/50 py-[clamp(4rem,9vw,7rem)]" aria-labelledby="milestones-title">
        <div className="shell">
          <p className="t-eyebrow text-muted">{t("milestones.eyebrow")}</p>
          <h2 id="milestones-title" className="t-h2 mt-4">{t("milestones.title")}</h2>
          <ol className="relative mt-14 border-l border-line-strong lg:mt-16 xl:grid xl:grid-cols-7 xl:border-t xl:border-l-0">
            {t("milestones.items", { returnObjects: true }).map(({ year, title, body }) => (
              <li key={year} className="relative pb-10 pl-7 xl:pt-8 xl:pr-5 xl:pb-0 xl:pl-0">
                <span aria-hidden className="absolute top-1.5 -left-[5px] size-[9px] rotate-45 bg-accent xl:-top-[5px] xl:left-0" />
                <p className="font-display text-3xl tabular-nums">{year}</p>
                <h3 className="mt-3 text-[0.98rem] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell py-[clamp(4rem,9vw,7rem)]" aria-labelledby="team-title">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="t-eyebrow text-muted">{t("team.eyebrow")}</p>
            <h2 id="team-title" className="t-h2 mt-4">{t("team.title")}</h2>
          </div>
        </div>
        <TeamGrid />
      </section>
    </>
  );
}
