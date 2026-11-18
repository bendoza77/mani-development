"use client";

import { useMemo } from "react";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { Reveal } from "@/components/ui/Reveal";
import { TextLink } from "@/components/ui/Button";
import { useDB } from "@/lib/store";

/** Editorial, asymmetric grid of featured projects (driven by the admin "featured" flag). */
export function FeaturedProjects() {
  const projects = useDB((d) => d.projects);
  const featured = useMemo(() => {
    const f = projects.filter((p) => p.featured);
    return (f.length >= 3 ? f : [...f, ...projects.filter((p) => !p.featured)]).slice(0, 5);
  }, [projects]);
  const [a, b, ...rest] = featured;

  return (
    <section className="py-[clamp(4.5rem,11vw,9rem)]" aria-labelledby="featured-title">
      <div className="shell">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="t-eyebrow text-muted">Selected work · {projects.length} projects</p>
            <h2 id="featured-title" className="t-h2 mt-4 max-w-[18ch]">
              Buildings we&rsquo;re proud to put our name on
            </h2>
          </div>
          <TextLink href="/projects" className="self-start md:self-auto">
            View all projects
          </TextLink>
        </div>

        <div className="mt-12 grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-14 md:mt-16 md:grid-cols-12">
          {a && (
            <Reveal className="md:col-span-7">
              <ProjectCard project={a} index={0} aspect="aspect-[4/3] md:aspect-[7/5]" sizes="(min-width: 768px) 58vw, 100vw" />
            </Reveal>
          )}
          {b && (
            <Reveal className="md:col-span-5 md:mt-28" delay={120}>
              <ProjectCard project={b} index={1} aspect="aspect-[4/5]" sizes="(min-width: 768px) 40vw, 100vw" />
            </Reveal>
          )}
          {rest.map((p, i) => (
            <Reveal key={p.id} className="md:col-span-4" delay={i * 90}>
              <ProjectCard project={p} index={i + 2} sizes="(min-width: 768px) 32vw, 100vw" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
