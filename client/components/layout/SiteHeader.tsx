"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";
import { splitLocale } from "@/i18n/config";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { LocaleLink as Link } from "@/i18n/LocaleLink";
import { useDB } from "@/lib/store";
import { cx } from "@/lib/format";

/** Primary navigation (labels are keys in common:nav). Contact is the header's call-to-action button. */
export const NAV = [
  { href: "/services", key: "services" },
  { href: "/projects", key: "projects" },
  { href: "/about", key: "about" },
] as const;

/** Every public destination, used by the mobile menu and the footer. */
export const SITE_LINKS = [{ href: "/", key: "home" }, ...NAV, { href: "/contact", key: "contact" }] as const;

export function SiteHeader() {
  const { t } = useTranslation("common");
  const rawPathname = usePathname();
  const pathname = splitLocale(rawPathname).path;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useDB((d) => d.settings);
  const dialog = useRef<HTMLDialogElement>(null);

  // The header stays fixed at the top. Once the page scrolls it gets a solid background so
  // content never shows through; the state only re-renders when it actually flips.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 12);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (menuOpen && !d.open) d.showModal();
    if (!menuOpen && d.open) d.close();
    document.documentElement.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  // Close the menu after navigating.
  const [prevPath, setPrevPath] = useState(rawPathname);
  if (prevPath !== rawPathname) {
    setPrevPath(rawPathname);
    setMenuOpen(false);
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-[3px] bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("a11y.skipToContent")}
      </a>
      <header
        className={cx(
          "site-header fixed inset-x-0 top-0 z-50 border-b",
          scrolled ? "border-line bg-paper/[0.97]" : "border-transparent bg-transparent",
        )}
      >
        <div className="shell flex h-(--header-h) items-center justify-between gap-3 sm:gap-6">
          <Link href="/" className="rounded-[2px]" aria-label={t("brand.home", { name: settings.companyName })}>
            <Logo />
          </Link>

          <nav aria-label={t("a11y.primaryNav")} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cx(
                      "relative inline-flex h-10 items-center px-3.5 text-[0.9rem] transition-colors",
                      "after:absolute after:inset-x-3.5 after:bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 after:ease-(--ease-arch) hover:after:scale-x-100",
                      isActive(item.href) ? "text-ink after:scale-x-100" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher className="max-lg:hidden" />
            <ButtonLink
              href="/contact"
              size="sm"
              variant={isActive("/contact") ? "accent" : "primary"}
              aria-current={isActive("/contact") ? "page" : undefined}
              // Phones: the brand name needs the room; Contact stays in the menu, hero and footer.
              className="max-sm:hidden"
            >
              {t("header.cta")}
            </ButtonLink>
            <button
              type="button"
              className="-mr-2 grid size-11 place-items-center rounded-[3px] lg:hidden"
              aria-label={t("a11y.openMenu")}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu aria-hidden className="size-5.5" />
            </button>
          </div>
        </div>
      </header>

      <dialog
        ref={dialog}
        aria-label={t("a11y.siteMenu")}
        onCancel={(e) => {
          e.preventDefault();
          setMenuOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-night p-0 text-night-ink"
      >
        <div className="flex h-full flex-col">
          <div className="shell flex h-(--header-h) shrink-0 items-center justify-between">
            <Link href="/" onClick={() => setMenuOpen(false)} aria-label={t("brand.home", { name: settings.companyName })}>
              <Logo />
            </Link>
            <button
              type="button"
              className="-mr-2 grid size-11 place-items-center rounded-[3px]"
              aria-label={t("a11y.closeMenu")}
              autoFocus
              onClick={() => setMenuOpen(false)}
            >
              <X aria-hidden className="size-5.5" />
            </button>
          </div>
          <nav aria-label={t("a11y.mobileNav")} className="shell flex flex-1 flex-col justify-center">
            <ul className="flex flex-col">
              {SITE_LINKS.map((item, i) => (
                <li
                  key={item.href}
                  className="border-b border-white/10"
                  style={{ animation: menuOpen ? `rise-in .7s var(--ease-arch) ${80 + i * 55}ms both` : undefined }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className="flex items-baseline justify-between py-4 font-display text-[clamp(2rem,9vw,3rem)] leading-none tracking-tight [&:lang(ka)]:text-[clamp(1.6rem,7vw,2.3rem)] [&:lang(ka)]:leading-tight [&:lang(ka)]:tracking-normal aria-[current=page]:text-accent"
                  >
                    {t(`nav.${item.key}`)}
                    <span className="font-mono text-xs text-night-muted">0{i + 1}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="shell grid shrink-0 gap-1 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-night-muted">
            <LanguageSwitcher variant="full" className="mb-5" />
            <a href={`mailto:${settings.email}`} className="text-night-ink">
              {settings.email}
            </a>
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a>
          </div>
        </div>
      </dialog>
    </>
  );
}
