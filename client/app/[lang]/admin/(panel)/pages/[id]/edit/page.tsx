import type { Metadata } from "next";
import { Suspense } from "react";
import { PageForm } from "@/components/admin/PageForm";

export const metadata: Metadata = { title: "Edit page" };

// Cache Components needs one sample param to prerender the shell; the placeholder is never a real id
// (the form shows "not found" for it). Real ids render on request.
export function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function EditPagePage({ params }: PageProps<"/[lang]/admin/pages/[id]/edit">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      {params.then(({ id }) => (
        <PageForm key={id} pageId={id} />
      ))}
    </Suspense>
  );
}
