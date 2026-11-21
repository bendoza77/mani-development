"use client";

// Site menus from the API (GET /api/public/navigation), managed per page in the admin.
// Until the answer arrives, or if the API can't be reached, the built-in links are shown,
// so the site never has an empty menu.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useLocale, useTranslation } from "@/i18n/client";
import { api } from "./api";

export type NavLink = { label: string; href: string; newTab: boolean };
type Menus = { header: NavLink[]; footer: NavLink[] };

/** Built-in links (labels are keys in common:nav), as the site had them before the menu was editable. */
const FALLBACK_HEADER = [
  { href: "/services", key: "services" },
  { href: "/projects", key: "projects" },
  { href: "/about", key: "about" },
] as const;
const FALLBACK_FOOTER = [{ href: "/", key: "home" }, ...FALLBACK_HEADER, { href: "/contact", key: "contact" }] as const;

const menus = new Map<string, Menus>();
const requested = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Only the link kinds the site can show safely: on-site paths and https addresses. */
function isUsable(link: NavLink): boolean {
  return (link.href.startsWith("/") && !link.href.startsWith("//")) || /^https:\/\//i.test(link.href);
}

function load(locale: string) {
  if (requested.has(locale)) return;
  requested.add(locale);
  api<Menus>(`/api/public/navigation?locale=${locale}`).then(
    (data) => {
      menus.set(locale, { header: data.header.filter(isUsable), footer: data.footer.filter(isUsable) });
      listeners.forEach((l) => l());
    },
    // Keep the built-in links; try again on the next page that asks.
    () => requested.delete(locale),
  );
}

export const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** Header and footer links for the visitor's language. */
export function useNavigation(): Menus {
  const locale = useLocale();
  const { t } = useTranslation("common");
  const loaded = useSyncExternalStore(
    subscribe,
    () => menus.get(locale),
    () => undefined,
  );
  useEffect(() => load(locale), [locale]);

  const fallback = useMemo<Menus>(
    () => ({
      header: FALLBACK_HEADER.map((l) => ({ href: l.href, label: t(`nav.${l.key}`), newTab: false })),
      footer: FALLBACK_FOOTER.map((l) => ({ href: l.href, label: t(`nav.${l.key}`), newTab: false })),
    }),
    [t],
  );
  return loaded ?? fallback;
}
