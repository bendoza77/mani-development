import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectDetail, ProjectDetailSkeleton } from "@/components/sections/ProjectDetail";
import { seedProjects } from "@/data/seed";
import { getContent, getT, localeAlternates } from "@/i18n/server";

// Seed projects are prerendered; slugs created in the admin demo render on demand.
export function generateStaticParams() {
  return seedProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const seed = seedProjects.find((x) => x.slug === slug);
  if (!seed) {
    const { t } = await getT("meta");
    return { title: t("project.fallbackTitle") };
  }
  const p = (await getContent()).project(seed);
  return { title: p.title, description: p.summary, alternates: await localeAlternates(`/projects/${slug}`) };
}

export default function ProjectPage({ params }: PageProps<"/[lang]/projects/[slug]">) {
  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      {params.then(({ slug }) => (
        <ProjectDetail slug={slug} />
      ))}
    </Suspense>
  );
}
