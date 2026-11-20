import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader, Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { InlineScript } from "@/components/ui/InlineScript";
import { ThemeSync } from "@/components/ui/ThemeSync";
import { ToastProvider } from "@/components/ui/Toast";
import { I18nProvider } from "@/i18n/client";
import { LOCALE_LABELS, LOCALES, hasLocale } from "@/i18n/config";
import { CONTENT_OVERLAYS, UI_RESOURCES } from "@/i18n/resources";
import { getT } from "@/i18n/server";
import { seedSettings } from "@/data/seed";
import "../globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

// Georgian companions for the Latin faces. They only cover the Georgian block (unicode-range), so
// the browser downloads them only when Georgian text is on the page. No metric fallback face is
// generated, otherwise its local() font would also claim Latin glyphs ahead of Newsreader/Geist.
const kaSerif = Noto_Serif_Georgian({
  variable: "--font-ka-serif",
  subsets: ["georgian"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
const kaSans = Noto_Sans_Georgian({
  variable: "--font-ka-sans",
  subsets: ["georgian"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT("meta");
  return {
    title: { default: t("site.title"), template: t("site.template") },
    description: t("site.description"),
    applicationName: seedSettings.companyName,
    openGraph: { locale: LOCALE_LABELS[locale].ogLocale },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2eee7" },
    { media: "(prefers-color-scheme: dark)", color: "#121314" },
  ],
};

// Runs before first paint so a saved dark/light preference never flashes.
const themeScript = `(function(){document.documentElement.classList.add("js");try{var t=localStorage.getItem("lintel:theme")||"light";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  // Root param getter rather than `params`: it is known in every prerendered shell, including
  // fallback shells for paths that are not prerendered (unknown project slugs, the 404 catch-all).
  const lang = await rootLang();
  if (!hasLocale(lang)) notFound();

  return (
    <html
      lang={LOCALE_LABELS[lang].htmlLang}
      data-theme="light"
      suppressHydrationWarning
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} ${kaSerif.variable} ${kaSans.variable} antialiased`}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-dvh">
        <I18nProvider locale={lang} resources={UI_RESOURCES[lang]} overlay={CONTENT_OVERLAYS[lang]}>
          <ThemeSync />
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
