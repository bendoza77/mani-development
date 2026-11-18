import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectDetail, ProjectDetailSkeleton } from "@/components/sections/ProjectDetail";
import { seedProjects } from "@/data/seed";

// Seed projects are prerendered; slugs created in the admin demo render on demand.
export function generateStaticParams() {
  return seedProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = seedProjects.find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.summary } : { title: "Project" };
}

export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      {params.then(({ slug }) => (
        <ProjectDetail slug={slug} />
      ))}
    </Suspense>
  );
}
