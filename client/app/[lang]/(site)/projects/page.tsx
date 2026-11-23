import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { ProjectsExplorer, ProjectsSummary } from "@/components/sections/ProjectsExplorer";
import { Trans } from "react-i18next/TransWithoutContext";
import { getT } from "@/i18n/server";
import { getPageSeo, getProjects } from "@/lib/public-api";
import { routeMetadata } from "@/lib/seo/route";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT("meta");
  return routeMetadata({
    path: "/projects",
    title: t("projects.title"),
    description: t("projects.description"),
    seo: await getPageSeo("projects", locale),
  });
}

export default async function ProjectsPage() {
  const { t, i18n, locale } = await getT("projects");
  // Rendered on the server (cached), so the project list is in the first HTML.
  const projects = await getProjects(locale);
  return (
    <>
      <PageIntro
        eyebrow={t("page.eyebrow")}
        title={<Trans t={t} i18n={i18n} i18nKey="page.title" components={{ em: <em className="text-accent" /> }} />}
        lead={t("page.lead")}
        aside={<ProjectsSummary initialProjects={projects} />}
      />
      <ProjectsExplorer initialProjects={projects} />
    </>
  );
}
