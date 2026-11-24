import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectForm } from "@/components/admin/ProjectForm";

export const metadata: Metadata = { title: "Edit project" };

// Cache Components needs one sample param to prerender the shell; the placeholder is never a real id
// (the form shows "not found" for it). Real ids render on request.
export function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function EditProjectPage({ params }: PageProps<"/[lang]/admin/projects/[id]/edit">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      {params.then(({ id }) => (
        <ProjectForm key={id} projectId={id} />
      ))}
    </Suspense>
  );
}
