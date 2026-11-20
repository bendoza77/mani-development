import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { ProjectsExplorer, ProjectsSummary } from "@/components/sections/ProjectsExplorer";
import { Trans } from "react-i18next/TransWithoutContext";
import { getT, pageMetadata } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("projects", "/projects");
}

export default async function ProjectsPage() {
  const { t, i18n } = await getT("projects");
  return (
    <>
      <PageIntro
        eyebrow={t("page.eyebrow")}
        title={<Trans t={t} i18n={i18n} i18nKey="page.title" components={{ em: <em className="text-accent" /> }} />}
        lead={t("page.lead")}
        aside={<ProjectsSummary />}
      />
      <ProjectsExplorer />
    </>
  );
}
