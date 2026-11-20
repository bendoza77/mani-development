import type { Metadata } from "next";

import { MediaAdmin } from "@/components/admin/MediaAdmin";

export const metadata: Metadata = { title: "Media" };

export default function Page() {
  return <MediaAdmin />;
}
