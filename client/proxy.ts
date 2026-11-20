import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  hasLocale,
  isUnlocalizedPath,
  localizeHref,
} from "./i18n/config";

/**
 * Locale routing (see i18n/config.ts):
 *  - `/ka/...`          → served as is; remembers Georgian in a cookie.
 *  - `/en/...`          → redirected to the unprefixed URL (one canonical English URL).
 *  - `/...` (no prefix) → rewritten to `/en/...`, unless the visitor chose Georgian, then
 *                         redirected to `/ka/...`.
 *  - `/admin...`        → always English (`/ka/admin` redirects to `/admin`).
 * Unknown prefixes (`/fr/x`) fall through to English and render the localized 404.
 * Every redirect target is handled by a non-redirecting branch, so there are no loops.
 */
export function proxy(request: NextRequest) {
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

  const target = url.clone();
  target.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(target);
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
