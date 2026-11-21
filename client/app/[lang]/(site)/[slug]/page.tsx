import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageIntro } from "@/components/sections/PageIntro";
import { EditablePage } from "@/components/live-edit/EditablePage";
import { PageBlocks } from "@/components/sections/PageBlocks";
import { API_URL, type PublicPage } from "@/lib/api";
import { cleanPageStyle, pageColorStyle } from "@/lib/style";

/**
 * Pages created in the admin panel, at /<slug> (English) and /ka/<slug> (Georgian).
 * Fixed routes (/about, /projects, …) take precedence; an unknown or unpublished slug shows
 * the normal not-found page. Rendered on the server on each request, so changes show at once.
 */
// Cache Components needs one sample param to prerender the route's shell (header, footer).
// The placeholder is not a valid slug, so it renders the not-found page; real slugs render on request.
export function generateStaticParams() {
  return [{ slug: "__placeholder__" }];
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

async function fetchPage(slug: string, lang: string): Promise<PublicPage | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/public/pages/${slug}?locale=${lang === "ka" ? "ka" : "en"}`, { cache: "no-store" });
  } catch {
    throw new Error("The content server can't be reached.");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The content server answered ${res.status}.`);
  return (await res.json()) as PublicPage;
}

async function PageContent({ lang, slug }: { lang: string; slug: string }) {
  const page = await fetchPage(slug, lang);
  if (!page) notFound();
  const colors = pageColorStyle(cleanPageStyle(page.style));
  return (
    <>
      <title>{`${page.title} · MANI DEVELOPMENT`}</title>
      {page.intro && <meta name="description" content={page.intro} />}
      {/* For a signed-in admin this adds in-place editing; for everyone else it renders the page as is. */}
      <EditablePage pageId={page.id}>
        {/* Page colors (validated hex values only) apply to the page body; header and footer keep the site's. */}
        <div style={colors} className={colors ? "page-has-colors" : undefined}>
          <PageIntro eyebrow="MANI DEVELOPMENT" title={page.title} lead={page.intro || undefined} />
          <article>
            <PageBlocks blocks={page.blocks} pageTitle={page.title} />
          </article>
        </div>
      </EditablePage>
    </>
  );
}

