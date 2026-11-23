import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  hasLocale,
  isUnlocalizedPath,
  localizeHref,
  type Locale,
} from "./i18n/config";
import { RESOLVE_API_BASE, createResolver, isDynamicPath } from "./lib/public-resolve";

/** Staging and previews: ask search engines not to index any page (SEO_ANALYTICS_PERFORMANCE §4). */
const NOINDEX = process.env.SITE_NOINDEX === "1";

/** Rewrite target for unknown addresses: an invalid slug, so the [slug] route renders the not-found page. */
const NOT_FOUND_SLUG = "__placeholder__";

const resolve = createResolver(RESOLVE_API_BASE);

/**
 * Locale routing (see i18n/config.ts):
 *  - `/ka/...`          → served as is; remembers Georgian in a cookie.
 *  - `/en/...`          → redirected to the unprefixed URL (one canonical English URL).
 *  - `/...` (no prefix) → rewritten to `/en/...`, unless the visitor chose Georgian, then
 *                         redirected to `/ka/...`.
 *  - `/admin...`        → always English (`/ka/admin` redirects to `/admin`).
 * Unknown prefixes (`/fr/x`) fall through to English and render the localized 404.
 * Every redirect target is handled by a non-redirecting branch, so there are no loops.
 *
 * Dynamic addresses (`/<slug>`, `/projects/<slug>`, in either language) are looked up first
 * (lib/public-resolve.ts, cached 60 s), so the status code is right before rendering starts:
 *  - a live page or project → served as usual;
 *  - a renamed address      → 308 to the new one, in the same language;
 *  - nothing there          → the not-found page with a real 404 status.
 * If the API can't answer, the request goes through unchanged (the page itself shows not-found).
 */
export async function proxy(request: NextRequest) {
  const response = await route(request);
  if (NOINDEX) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

async function route(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const { pathname } = url;
  const first = pathname.split("/")[1];
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;

  if (hasLocale(first)) {
    const rest = pathname.slice(first.length + 1) || "/";
    if (first === DEFAULT_LOCALE || isUnlocalizedPath(rest)) {
      const target = url.clone();
      target.pathname = rest;
      const response = NextResponse.redirect(target);
      if (first === DEFAULT_LOCALE && isPageLoad(request)) remember(response, DEFAULT_LOCALE);
      return response;
    }
    const decided = await routeDynamic(request, first, rest);
    if (decided) return decided;
    const response = NextResponse.next();
    // Only a page load (e.g. opening a shared /ka link) records the preference. Background RSC
    // prefetches of /ka links must not, or they could undo a switch to English made a moment earlier.
    if (cookie !== first && isPageLoad(request)) remember(response, first);
    return response;
  }

  if (!isUnlocalizedPath(pathname) && hasLocale(cookie) && cookie !== DEFAULT_LOCALE) {
    const target = url.clone();
    target.pathname = localizeHref(pathname, cookie);
    return NextResponse.redirect(target);
  }

  const decided = await routeDynamic(request, DEFAULT_LOCALE, pathname);
  if (decided) return decided;

  const target = url.clone();
  target.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(target);
}

/** Redirect or 404 for a dynamic address; null to continue normally. `path` is locale-free. */
async function routeDynamic(request: NextRequest, locale: Locale, path: string): Promise<NextResponse | null> {
  if (!isDynamicPath(path)) return null;
  const found = await resolve(path.replace(/\/+$/, ""));
  if (!found || found.kind === "page" || found.kind === "project") return null;
  const target = request.nextUrl.clone();
  if (found.kind === "redirect") {
    target.pathname = localizeHref(found.to, locale);
    return NextResponse.redirect(target, 308);
  }
  target.pathname = `/${locale}/${NOT_FOUND_SLUG}`;
  return NextResponse.rewrite(target, { status: 404 });
}

/** A top-level document request. Next.js strips its own navigation headers before Proxy, so this
 *  uses the browser's Fetch Metadata header: "document" for page loads, "empty" for RSC fetches. */
function isPageLoad(request: NextRequest) {
  return request.headers.get("sec-fetch-dest") === "document";
}

function remember(response: NextResponse, locale: string) {
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
}

export const config = {
  // Everything except Next internals, API routes and files with an extension (icons, images…).
  matcher: ["/((?!_next/|api/|.*\\.[^/]+$).*)"],
};
