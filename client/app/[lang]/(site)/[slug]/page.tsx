import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageIntro } from "@/components/sections/PageIntro";
import { EditablePage } from "@/components/live-edit/EditablePage";
import { PageBlocks } from "@/components/sections/PageBlocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { hasLocale } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { fetchPage, getSettings } from "@/lib/public-api";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { routeMetadata } from "@/lib/seo/route";
import { cleanPageStyle, pageColorStyle } from "@/lib/style";

/**
 * Pages created in the admin panel, at /<slug> (English) and /ka/<slug> (Georgian).
 * Fixed routes (/about, /projects, …) take precedence; proxy.ts answers unknown or renamed slugs
 * with a real 404 or a 308 before this page runs. Rendered on the server on each request, so
 * changes show at once.
 */
// Cache Components needs one sample param to prerender the route's shell (header, footer).
// The placeholder is not a valid slug, so it renders the not-found page; real slugs render on request.
export function generateStaticParams() {
  return [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = await fetchPage(slug, hasLocale(lang) ? lang : "en");
  if (!page) {
    const { t } = await getT("meta");
    return { title: t("notFound.title"), robots: { index: false } };
  }
  return routeMetadata({ path: `/${page.slug}`, title: page.title, description: page.intro, seo: page.seo });
}

export default function CustomPage({ params }: PageProps<"/[lang]/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-[60dvh]" aria-busy="true" />}>
      {params.then(({ lang, slug }) => (
        <PageContent lang={lang} slug={slug} />
      ))}
    </Suspense>
  );
}

async function PageContent({ lang, slug }: { lang: string; slug: string }) {
  const locale = hasLocale(lang) ? lang : "en";
  const page = await fetchPage(slug, locale);
  if (page === null) notFound();
  // The content server can't be reached: the site's error boundary offers a retry.
  if (page === undefined) throw new Error("The content server can't be reached.");
  const [settings, { t }] = await Promise.all([getSettings(locale), getT("common")]);
  const colors = pageColorStyle(cleanPageStyle(page.style));
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(
            [
              { name: t("nav.home"), path: "/" },
              { name: page.title, path: `/${page.slug}` },
            ],
            locale,
          ),
        ]}
      />
      {/* For a signed-in admin this adds in-place editing; for everyone else it renders the page as is. */}
      <EditablePage pageId={page.id}>
        {/* Page colors (validated hex values only) apply to the page body; header and footer keep the site's. */}
        <div style={colors} className={colors ? "page-has-colors" : undefined}>
          <PageIntro eyebrow={settings.companyName} title={page.title} lead={page.intro || undefined} />
          <article>
            <PageBlocks blocks={page.blocks} pageTitle={page.title} />
          </article>
        </div>
      </EditablePage>
    </>
  );
}
