import type { Metadata } from "next";
import { ProjectForm } from "@/components/admin/ProjectForm";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return <ProjectForm />;
}
