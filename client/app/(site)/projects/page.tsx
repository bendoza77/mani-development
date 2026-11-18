import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { ProjectsExplorer, ProjectsSummary } from "@/components/sections/ProjectsExplorer";

export const metadata: Metadata = {
  title: "Projects",
  description: "Residential, apartment, commercial and renovation projects by Lintel across Georgia.",
};

export default function ProjectsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Projects"
        title={
          <>
            Work in the ground, <em className="text-accent">and on the skyline</em>
          </>
        }
        lead="Private houses, apartment buildings, workplaces and careful renovations. Completed, under construction, and on the drawing board."
        aside={<ProjectsSummary />}
      />
      <ProjectsExplorer />
    </>
  );
}
