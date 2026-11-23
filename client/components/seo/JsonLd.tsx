import { serializeJsonLd } from "@/lib/seo/jsonld";

/** Structured data as a server-rendered JSON-LD script. Falsy entries are skipped. */
export function JsonLd({ data }: { data: (Record<string, unknown> | null | undefined | false)[] }) {
  const items = data.filter(Boolean);
  if (!items.length) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(items.length === 1 ? items[0] : items) }}
    />
  );
}
