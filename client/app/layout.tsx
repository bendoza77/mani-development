import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ThemeSync } from "@/components/ui/ThemeSync";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Lintel — Building & Development",
    template: "%s — Lintel",
  },
  description:
    "Lintel builds and develops considered residential, apartment and commercial architecture across Georgia. (Prototype: fictional company.)",
  applicationName: "Lintel",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2eee7" },
    { media: "(prefers-color-scheme: dark)", color: "#121314" },
  ],
};

// Runs before first paint so a saved dark/light preference never flashes.
const themeScript = `(function(){document.documentElement.classList.add("js");try{var t=localStorage.getItem("lintel:theme")||"light";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <ThemeSync />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
