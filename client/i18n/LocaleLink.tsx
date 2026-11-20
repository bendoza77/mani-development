"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { localizeHref } from "./config";
import { useLocale } from "./client";

type Href = ComponentProps<typeof Link>["href"];

/** Hook form of `localizeHref` for the current locale (for `router.push`, etc.). */
export function useLocalizeHref() {
  const locale = useLocale();
  return (href: string) => localizeHref(href, locale);
}

/**
 * `next/link` that keeps the visitor in their language. Components always write locale-free
 * hrefs (`/projects`); this adds the `/ka` prefix when needed.
 */
export function LocaleLink({ href, ...rest }: ComponentProps<typeof Link>) {
  const locale = useLocale();
  let localized: Href = href;
  if (typeof href === "string") localized = localizeHref(href, locale);
  else if (href.pathname) localized = { ...href, pathname: localizeHref(href.pathname, locale) };
  return <Link href={localized} {...rest} />;
}
