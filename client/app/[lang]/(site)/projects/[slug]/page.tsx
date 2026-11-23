import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProjectDetail, ProjectDetailSkeleton } from "@/components/sections/ProjectDetail";
import { Unavailable } from "@/components/sections/Unavailable";
import { hasLocale } from "@/i18n/config";
import { getLocale, getT } from "@/i18n/server";
import { getProject, getProjects } from "@/lib/public-api";
import { toProject } from "@/lib/public-types";
import type { Project } from "@/lib/types";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { routeMetadata } from "@/lib/seo/route";

/**
 * Published projects are prerendered; newer slugs render on first visit. With no projects at all,
 * a placeholder keeps the build working (it is not a valid slug, so it renders the not-found page).
 * Unknown or renamed slugs never reach this page: proxy.ts answers them with a 404 or a 308.
 */
export async function generateStaticParams() {
  const projects = await getProjects("ka");
  return projects.length ? projects.map((p) => ({ slug: p.slug })) : [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/projects/[slug]">): Promise<Metadata> {
  const { slug, lang } = await params;
  const project = await getProject(slug, hasLocale(lang) ? lang : "en");
  if (!project) {
    const { t } = await getT("meta");
    return { title: t("project.fallbackTitle"), robots: { index: false } };
  }
  return routeMetadata({
    path: `/projects/${slug}`,
    title: project.title,
    description: project.summary,
    image: project.cover,
    type: "article",
    seo: project.seo,
  });
}

export default function ProjectPage({ params }: PageProps<"/[lang]/projects/[slug]">) {
  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      {params.then(({ slug }) => (
        <ProjectContent slug={slug} />
      ))}
    </Suspense>
  );
}

/** Up to three other projects, same category first. */
function relatedProjects(project: Project, all: Project[]): Project[] {
  const same = all.filter((p) => p.id !== project.id && p.category === project.category);
  const others = all.filter((p) => p.id !== project.id && p.category !== project.category);
  return [...same, ...others].slice(0, 3);
}

async function ProjectContent({ slug }: { slug: string }) {
  const locale = await getLocale();
  const [raw, all, { t }] = await Promise.all([getProject(slug, locale), getProjects(locale), getT("common")]);
  if (raw === null) notFound();
  if (raw === undefined) return <Unavailable />;
  const project = toProject(raw);
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(
            [
              { name: t("nav.home"), path: "/" },
              { name: t("nav.projects"), path: "/projects" },
              { name: project.title, path: `/projects/${project.slug}` },
            ],
            locale,
          ),
        ]}
      />
      <ProjectDetail project={project} related={relatedProjects(project, all)} />
    </>
  );
}
