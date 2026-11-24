import type { Metadata } from "next";
import { NavigationAdmin } from "@/components/admin/NavigationAdmin";

export const metadata: Metadata = { title: "Menus" };

export default function Page() {
  return <NavigationAdmin />;
}
