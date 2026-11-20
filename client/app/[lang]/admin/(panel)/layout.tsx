import { AdminShell } from "@/components/admin/AdminShell";

export default function PanelLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
