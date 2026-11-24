import type { MetadataRoute } from "next";
import { SITE_NOINDEX, SITE_URL } from "@/lib/seo/metadata";

/**
 * robots.txt. The admin is never crawled (`/admin`, and `/ka/admin` style addresses).
 * Staging (SITE_NOINDEX=1): crawling stays allowed on purpose, because every page carries
 * "noindex" (meta tag and X-Robots-Tag header) and a crawler that may not fetch a page never sees
 * that rule (Google Search Central); the sitemap is not advertised there.
 */
export default function robots(): MetadataRoute.Robots {
  const rules = { userAgent: "*", allow: "/", disallow: ["/admin", "/*/admin"] };
  if (SITE_NOINDEX) return { rules };
  return { rules, sitemap: `${SITE_URL}/sitemap.xml` };
}
