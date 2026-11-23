"use client";

import { ArrowLeft, Check } from "lucide-react";
import { Gallery } from "@/components/sections/Gallery";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { ButtonLink } from "@/components/ui/Button";
import { Img } from "@/components/ui/Img";
import { Reveal } from "@/components/ui/Reveal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useFormatters, useTranslation } from "@/i18n/client";
import { LocaleLink as Link } from "@/i18n/LocaleLink";
import type { Project } from "@/lib/types";
import { cx, stageState } from "@/lib/format";

/** One published project, read on the server (app/[lang]/(site)/projects/[slug]/page.tsx). */
export function ProjectDetail({ project: p, related }: { project: Project; related: Project[] }) {
  const { t } = useTranslation("projects");
  const { t: tc } = useTranslation("common");
  const fmt = useFormatters();
  const facts: [string, string][] = [
    [t("detail.facts.location"), p.location],
    [t("detail.facts.type"), tc(`category.${p.category}`)],
    [t("detail.facts.architect"), p.architect || "—"],
    [t("detail.facts.started"), fmt.month(p.startDate)],
    [
      p.status === "completed" ? t("detail.facts.completed") : t("detail.facts.estimatedCompletion"),
      fmt.month(p.completionDate ?? p.estimatedCompletion),
    ],
  ];
  const stages = t("detail.stages", { returnObjects: true });

  return (
    <article>
      <header className="pt-[calc(var(--header-h)+clamp(1.5rem,4vw,3rem))]">
        <div className="shell">
          <Link href="/projects" className="inline-flex items-center gap-2 text-[0.88rem] text-muted hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" /> {t("detail.back")}
          </Link>
          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <div className="rise-in flex flex-wrap items-center gap-3">
                <StatusBadge status={p.status} label={tc(`status.${p.status}`)} />
                <span className="t-meta text-muted">{tc(`category.${p.category}`)}</span>
                <span className="t-meta text-muted">{p.city}</span>
              </div>
              <h1 className="t-h1 rise-in mt-5" style={{ "--d": "80ms" } as React.CSSProperties}>
                {p.title}
              </h1>
            </div>
            <p className="t-lead rise-in text-ink-soft lg:col-span-4" style={{ "--d": "160ms" } as React.CSSProperties}>
              {p.summary}
            </p>
          </div>
        </div>
        <div className="shell mt-[clamp(2rem,5vw,3.5rem)]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2px] sm:aspect-[16/9] lg:aspect-[21/9]">
            <Img src={p.cover} alt={t("card.imageAlt", { title: p.title, location: p.location })} sizes="100vw" preload quality={80} />
          </div>
        </div>
      </header>

      <section className="shell grid gap-12 py-[clamp(3.5rem,8vw,7rem)] lg:grid-cols-12" aria-label={t("detail.overview")}>
        <div className="lg:col-span-7">
          <p className="t-eyebrow text-muted">{t("detail.theProject")}</p>
          <div className="mt-6 space-y-5 text-[1.06rem] leading-[1.75] text-ink-soft">
            {p.description.split(/\n\n+/).map((para, i) => (
              <p key={i} className={i === 0 ? "font-display text-[clamp(1.35rem,1.1rem+0.9vw,1.75rem)] leading-[1.4] text-ink" : ""}>
                {para}
              </p>
            ))}
          </div>
        </div>
        <aside className="lg:col-span-4 lg:col-start-9">
          <dl className="divide-y divide-line border-y border-line">
            {[...facts, ...p.specs.map((s) => [s.label, s.value] as [string, string])].map(([k, v], i) => (
              <div key={`${k}-${i}`} className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-4 py-3.5">
                <dt className="t-meta pt-0.5 text-muted">{k}</dt>
                <dd className="text-[0.95rem]">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="border-y border-line bg-paper-2/50 py-[clamp(3rem,7vw,5.5rem)]" aria-labelledby="timeline-title">
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="t-eyebrow text-muted">{t("detail.stagesEyebrow")}</p>
              <h2 id="timeline-title" className="t-h3 mt-3">
                {t(`detail.state.${p.status}`)}
              </h2>
            </div>
            <p className="font-display text-5xl tabular-nums">
              {p.progress}
              <span className="text-2xl text-muted">%</span>
            </p>
          </div>
          <div className="mt-8 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("detail.progress")}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${p.progress}%` }} />
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-5">
            {stages.map((s, i) => {
              const st = stageState(p.progress, i);
              return (
                <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start">
                  <span
                    className={cx(
                      "grid size-7 shrink-0 place-items-center rounded-full border text-[0.7rem]",
                      st === "done" && "border-ink bg-ink text-paper",
                      st === "active" && "border-accent text-accent",
                      st === "upcoming" && "border-line-strong text-muted",
                    )}
                  >
                    {st === "done" ? <Check aria-hidden className="size-3.5" /> : i + 1}
                  </span>
                  <span>
                    <span className={cx("block text-[0.95rem]", st === "upcoming" && "text-muted")}>{s}</span>
                    <span className="t-meta text-muted">{t(`detail.stageState.${st}`)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {p.gallery.length > 0 && (
        <section className="shell py-[clamp(3.5rem,8vw,7rem)]" aria-labelledby="gallery-title">
          <h2 id="gallery-title" className="t-eyebrow mb-8 text-muted">
            {t("detail.gallery", { count: p.gallery.length })}
          </h2>
          <Gallery images={p.gallery} title={p.title} />
        </section>
      )}

      <section className="bg-night py-[clamp(3.5rem,8vw,6rem)] text-night-ink">
        <div className="shell flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="t-h2 max-w-[18ch]">{t("detail.ctaTitle", { title: p.title })}</h2>
          <ButtonLink
            href={`/contact?subject=${encodeURIComponent(t("detail.ctaSubject", { title: p.title }))}`}
            variant="light"
            size="lg"
          >
            {t("detail.ctaButton")}
          </ButtonLink>
        </div>
      </section>

      {related.length > 0 && (
        <section className="shell py-[clamp(3.5rem,8vw,7rem)]" aria-labelledby="related-title">
          <h2 id="related-title" className="t-h2">
            {t("detail.related")}
          </h2>
          <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r, i) => (
              <Reveal key={r.id} delay={i * 80}>
                <ProjectCard project={r} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw" />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

export function ProjectDetailSkeleton() {
  const { t } = useTranslation("projects");
  return (
    <div className="shell animate-pulse pt-[calc(var(--header-h)+3rem)] pb-24" aria-busy="true" aria-label={t("detail.loading")}>
      <div className="h-4 w-28 rounded bg-paper-2" />
      <div className="mt-10 h-14 w-2/3 rounded bg-paper-2" />
      <div className="mt-10 aspect-[21/9] rounded-[2px] bg-paper-2" />
    </div>
  );
}
