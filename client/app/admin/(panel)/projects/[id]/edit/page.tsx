import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { seedProjects } from "@/data/seed";

export const metadata: Metadata = { title: "Edit project" };

export function generateStaticParams() {
  return seedProjects.map((p) => ({ id: p.id }));
}

export default function EditProjectPage({ params }: PageProps<"/admin/projects/[id]/edit">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      {params.then(({ id }) => (
        <ProjectForm key={id} projectId={id} />
      ))}
    </Suspense>
  );
}
