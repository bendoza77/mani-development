import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader, Noto_Sans_Georgian, Noto_Serif_Georgian, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { SiteSettingsProvider } from "@/components/layout/SiteSettings";
import { InlineScript } from "@/components/ui/InlineScript";
import { ThemeSync } from "@/components/ui/ThemeSync";
import { ToastProvider } from "@/components/ui/Toast";
import { I18nProvider } from "@/i18n/client";
import { LOCALE_LABELS, LOCALES, hasLocale } from "@/i18n/config";
import { UI_RESOURCES } from "@/i18n/resources";
import { getT } from "@/i18n/server";
import { getSettings } from "@/lib/public-api";
import { SITE_NOINDEX, SITE_URL } from "@/lib/seo/metadata";
import "../globals.css";

// Upright only: a preloaded italic file (about 147 KB) downloaded on every visit, and nothing on the
// site sets Newsreader in italics except an italic word inside an admin-written quote, which the
// browser now slants itself. Russian quotes keep real italics from Source Serif 4 below.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

// Geist covers Cyrillic itself, so Russian body text needs no companion face.
const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"], display: "swap" });
// Only the language switcher uses the mono face, so it isn't preloaded: the browser fetches just the
// part it draws, after the fonts the page's text needs.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"], display: "swap", preload: false });

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

// Russian companion for Newsreader, which has no Cyrillic: same approach as the Georgian faces
// (Cyrillic block only, not preloaded). Source Serif 4 has an optical-size axis like Newsreader.
const ruSerif = Source_Serif_4({
  variable: "--font-ru-serif",
  subsets: ["cyrillic"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Defaults for every page (admin included); public routes add their own through lib/seo.
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT("meta");
  const settings = await getSettings(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("site.title"), template: `%s — ${settings.companyName}` },
    description: settings.defaultSeoDescription || t("site.description"),
    applicationName: settings.companyName,
    openGraph: { locale: LOCALE_LABELS[locale].ogLocale, siteName: settings.companyName },
    ...(SITE_NOINDEX ? { robots: { index: false, follow: false } } : {}),
    ...(settings.googleSiteVerification ? { verification: { google: settings.googleSiteVerification } } : {}),
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
  const settings = await getSettings(lang);

  return (
    <html
      lang={LOCALE_LABELS[lang].htmlLang}
      data-theme="light"
      suppressHydrationWarning
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} ${kaSerif.variable} ${kaSans.variable} ${ruSerif.variable} antialiased`}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-dvh">
        <I18nProvider locale={lang} resources={UI_RESOURCES[lang]}>
          <SiteSettingsProvider settings={settings}>
            <ThemeSync />
            <ToastProvider>{children}</ToastProvider>
          </SiteSettingsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
