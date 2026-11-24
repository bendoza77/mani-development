import type { Metadata } from "next";
import { RedirectsAdmin } from "@/components/admin/RedirectsAdmin";

export const metadata: Metadata = { title: "Redirects" };

export default function Page() {
  return <RedirectsAdmin />;
}
