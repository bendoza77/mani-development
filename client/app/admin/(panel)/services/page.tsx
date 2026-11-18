import type { Metadata } from "next";

import { ServicesAdmin } from "@/components/admin/ServicesAdmin";

export const metadata: Metadata = { title: "Services" };

export default function Page() {
  return <ServicesAdmin />;
}
