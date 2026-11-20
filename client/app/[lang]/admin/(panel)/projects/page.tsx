import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsAdmin } from "@/components/admin/ProjectsAdmin";

export const metadata: Metadata = { title: "Projects" };

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      <ProjectsAdmin />
    </Suspense>
  );
}
