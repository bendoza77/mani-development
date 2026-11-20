"use client";

import { useMemo } from "react";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { Reveal } from "@/components/ui/Reveal";
import { TextLink } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";
import { useDB } from "@/lib/store";

const MAX = 4;

/** Featured projects (the admin "featured" flag), topped up with private houses if fewer than four are flagged. */
export function FeaturedProjects() {
  const { t } = useTranslation("home");
  const projects = useDB((d) => d.projects);
  const featured = useMemo(() => {
    const f = projects.filter((p) => p.featured);
    const houses = projects.filter((p) => !p.featured && p.category === "residential");
    return [...f, ...houses].slice(0, MAX);
  }, [projects]);

  if (!featured.length) return null;

  return (
    <section className="border-t border-line py-[clamp(4rem,9vw,7rem)]" aria-labelledby="featured-title">
      <div className="shell">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="t-eyebrow text-muted">{t("featured.eyebrow")}</p>
            <h2 id="featured-title" className="t-h2 mt-4 max-w-[18ch]">
              {t("featured.title")}
            </h2>
          </div>
          <TextLink href="/projects" className="self-start md:self-auto">
            {t("featured.allProjects", { count: projects.length })}
          </TextLink>
        </div>

        <ul className="mt-10 grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-12 md:mt-14 md:grid-cols-2">
          {featured.map((p) => (
            <Reveal as="li" key={p.id}>
              <ProjectCard project={p} sizes="(min-width: 768px) 46vw, 100vw" />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
