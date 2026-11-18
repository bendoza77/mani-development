"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Gallery } from "@/components/sections/Gallery";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { ButtonLink } from "@/components/ui/Button";
import { Img } from "@/components/ui/Img";
import { Reveal } from "@/components/ui/Reveal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHydrated } from "@/hooks/useHydrated";
import { useDB } from "@/lib/store";
import { CATEGORY_LABEL, STAGES, cx, formatMonth, stageState } from "@/lib/format";

export function ProjectDetail({ slug }: { slug: string }) {
  const projects = useDB((d) => d.projects);
  const hydrated = useHydrated();
  const project = projects.find((p) => p.slug === slug);
  const company = useDB((d) => d.settings.companyName);

  // Server metadata is built from the seed data; keep the tab title in sync with admin edits.
  useEffect(() => {
    if (project) document.title = `${project.title} — ${company}`;
  }, [project, company]);
  const related = useMemo(() => {
    if (!project) return [];
    const same = projects.filter((p) => p.id !== project.id && p.category === project.category);
    const others = projects.filter((p) => p.id !== project.id && p.category !== project.category);
    return [...same, ...others].slice(0, 3);
  }, [projects, project]);

  // Admin-created projects exist only in this browser: wait for the client store before declaring a 404.
  if (!project) return hydrated ? <ProjectMissing /> : <ProjectDetailSkeleton />;

  const p = project;
  const facts: [string, string][] = [
    ["Location", p.location],
    ["Type", CATEGORY_LABEL[p.category]],
    ["Architect", p.architect || "—"],
    ["Started", formatMonth(p.startDate)],
    [p.status === "completed" ? "Completed" : "Est. completion", formatMonth(p.completionDate ?? p.estimatedCompletion)],
  ];

  return (
    <article>
      <header className="pt-[calc(var(--header-h)+clamp(1.5rem,4vw,3rem))]">
        <div className="shell">
          <Link href="/projects" className="inline-flex items-center gap-2 text-[0.88rem] text-muted hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" /> All projects
          </Link>
          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <div className="rise-in flex flex-wrap items-center gap-3">
                <StatusBadge status={p.status} />
                <span className="t-meta text-muted">
                  {CATEGORY_LABEL[p.category]} · {p.city}
                </span>
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
            <Img src={p.cover} alt={`${p.title}, ${p.location}`} sizes="100vw" priority quality={80} />
          </div>
        </div>
      </header>

      <section className="shell grid gap-12 py-[clamp(3.5rem,8vw,7rem)] lg:grid-cols-12" aria-label="Project overview">
        <div className="lg:col-span-7">
          <p className="t-eyebrow text-muted">The project</p>
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
              <p className="t-eyebrow text-muted">Construction stages</p>
              <h2 id="timeline-title" className="t-h3 mt-3">
                {p.status === "completed" ? "Delivered" : p.status === "planning" ? "In design and permitting" : p.status === "on-hold" ? "Paused by the client" : "On site now"}
              </h2>
            </div>
            <p className="font-display text-5xl tabular-nums">
              {p.progress}
              <span className="text-2xl text-muted">%</span>
            </p>
          </div>
          <div className="mt-8 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
            <div className="h-full rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${p.progress}%` }} />
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-5">
            {STAGES.map((s, i) => {
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
                    <span className="t-meta text-muted">{st === "done" ? "Complete" : st === "active" ? "In progress" : "Upcoming"}</span>
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
            Gallery · {p.gallery.length} images
          </h2>
          <Gallery images={p.gallery} title={p.title} />
        </section>
      )}

      <section className="bg-night py-[clamp(3.5rem,8vw,6rem)] text-night-ink">
        <div className="shell flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="t-h2 max-w-[18ch]">Planning something like {p.title}?</h2>
          <ButtonLink href={`/contact?subject=${encodeURIComponent(`Project like ${p.title}`)}`} variant="light" size="lg" arrow>
            Talk to our team
          </ButtonLink>
        </div>
      </section>

      {related.length > 0 && (
        <section className="shell py-[clamp(3.5rem,8vw,7rem)]" aria-labelledby="related-title">
          <h2 id="related-title" className="t-h2">
            Related projects
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
  return (
    <div className="shell animate-pulse pt-[calc(var(--header-h)+3rem)] pb-24" aria-busy="true" aria-label="Loading project">
      <div className="h-4 w-28 rounded bg-paper-2" />
      <div className="mt-10 h-14 w-2/3 rounded bg-paper-2" />
      <div className="mt-10 aspect-[21/9] rounded-[2px] bg-paper-2" />
    </div>
  );
}

function ProjectMissing() {
  return (
    <div className="shell flex min-h-[70svh] flex-col items-start justify-center pt-(--header-h)">
      <p className="t-eyebrow text-muted">404 · Project not found</p>
      <h1 className="t-h1 mt-5 max-w-[16ch]">This project isn&rsquo;t in our portfolio.</h1>
      <p className="t-lead mt-5 max-w-xl text-ink-soft">It may have been renamed or removed in the admin demo.</p>
      <ButtonLink href="/projects" className="mt-8" arrow>
        Browse all projects
      </ButtonLink>
    </div>
  );
}
