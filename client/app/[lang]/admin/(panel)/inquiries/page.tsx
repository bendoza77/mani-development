import type { Metadata } from "next";
import { Suspense } from "react";
import { InquiriesAdmin } from "@/components/admin/InquiriesAdmin";

export const metadata: Metadata = { title: "Inquiries" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      <InquiriesAdmin />
    </Suspense>
  );
}
