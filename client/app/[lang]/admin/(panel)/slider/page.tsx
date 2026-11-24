import type { Metadata } from "next";
import { SlidesAdmin } from "@/components/admin/SlidesAdmin";

export const metadata: Metadata = { title: "Homepage slider" };

export default function Page() {
  return <SlidesAdmin />;
}
