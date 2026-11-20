import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · MANI DEVELOPMENT Admin" },
  robots: { index: false, follow: false },
};

// The admin area deliberately shares nothing with the public site chrome (header, footer, 3D).
export default function AdminRootLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return <div className="min-h-dvh bg-paper">{children}</div>;
}
