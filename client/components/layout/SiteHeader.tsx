"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ContactLink } from "@/components/contact/ContactLink";
import { ButtonLink } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";
import { splitLocale } from "@/i18n/config";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { LocaleLink as Link } from "@/i18n/LocaleLink";
import { formatPhone } from "@/lib/contact";
import { cx } from "@/lib/format";
import { isExternal, useNavigation, type Menus, type NavLink } from "@/lib/navigation";
import { contactHref } from "@/lib/public-types";
import { useSiteSettings } from "./SiteSettings";

/** A menu link: site paths keep the visitor's language; outside addresses open as plain links. */
export function MenuLink({ link, className, onClick, current }: { link: NavLink; className?: string; onClick?: () => void; current?: boolean }) {
  if (isExternal(link.href)) {
    return (
      <a href={link.href} className={className} onClick={onClick} {...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {link.label}
      </a>
    );
  }
  return (
    <Link
      href={link.href}
      className={className}
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      {...(link.newTab ? { target: "_blank", rel: "noopener" } : {})}
    >
      {link.label}
    </Link>
  );
}

export function SiteHeader({ menus }: { menus?: Menus | null }) {
  const { t } = useTranslation("common");
  // The top menu is edited per page in the admin (Pages → Menu). Contact is the call-to-action button.
  const { header } = useNavigation(menus);
  // The mobile menu lists every destination: home, the top menu, and contact.
  const mobileLinks: NavLink[] = [
    { href: "/", label: t("nav.home"), newTab: false },
    ...header.filter((l) => l.href !== "/" && l.href !== "/contact"),
    { href: "/contact", label: t("nav.contact"), newTab: false },
  ];
  const rawPathname = usePathname();
  const pathname = splitLocale(rawPathname).path;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useSiteSettings();
  const mail = contactHref("email", settings);
  const tel = contactHref("phone", settings);
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
          // A page with its own colors (admin "Page colors") could hide the transparent header's
          // links, so on such pages the header is solid from the start.
          "[body:has(.page-has-colors)_&]:border-line [body:has(.page-has-colors)_&]:bg-paper/[0.97]",
        )}
      >
        <div className="shell flex h-(--header-h) items-center justify-between gap-3 sm:gap-6 lg:max-xl:gap-4">
          <Link href="/" className="rounded-[2px]" aria-label={t("brand.home", { name: settings.companyName })}>
            <Logo />
          </Link>

          {/* The full menu needs xl, in every language; below that the menu button covers it. */}
          <nav aria-label={t("a11y.primaryNav")} className="hidden xl:block">
            <ul className="flex items-center gap-1">
              {header.map((item) => (
                <li key={item.href}>
                  <MenuLink
                    link={item}
                    current={isActive(item.href)}
                    className={cx(
                      "relative inline-flex h-10 items-center px-3.5 text-[0.9rem] whitespace-nowrap transition-colors",
                      "after:absolute after:inset-x-3.5 after:bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 after:ease-(--ease-arch) hover:after:scale-x-100",
                      isActive(item.href) ? "text-ink after:scale-x-100" : "text-ink-soft hover:text-ink",
                    )}
                  />
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher className="max-xl:hidden" />
            {/* Icon-only below xl (44px tap target on phones); the full number shows on wide screens.
                Under 360px the brand name needs the room, and the number stays in the menu. */}
            {tel && (
              <ContactLink
                channel="phone"
                href={tel}
                aria-label={t("header.call", { phone: formatPhone(settings.phone) })}
                className="inline-flex size-11 items-center max-[359px]:hidden justify-center gap-2 rounded-[3px] text-[0.82rem] font-medium whitespace-nowrap text-ink transition-colors duration-300 hover:bg-paper-2 hover:text-accent sm:size-9 xl:w-auto xl:px-3"
              >
                <Phone aria-hidden strokeWidth={1.75} className="size-4.5" />
                <span className="tabular-nums max-xl:hidden">{formatPhone(settings.phone)}</span>
              </ContactLink>
            )}
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
              className="-mr-2 grid size-11 place-items-center rounded-[3px] xl:hidden"
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
              {mobileLinks.map((item, i) => (
                <li
                  key={item.href}
                  className="border-b border-white/10"
                  style={{ animation: menuOpen ? `rise-in .7s var(--ease-arch) ${80 + i * 55}ms both` : undefined }}
                >
                  <MenuLink
                    link={item}
                    onClick={() => setMenuOpen(false)}
                    current={isActive(item.href)}
                    className="block py-4 font-display text-[clamp(2rem,9vw,3rem)] leading-none tracking-tight [&:lang(ka)]:text-[clamp(1.6rem,7vw,2.3rem)] [&:lang(ka)]:leading-tight [&:lang(ka)]:tracking-normal aria-[current=page]:text-accent"
                  />
                </li>
              ))}
            </ul>
          </nav>
          <div className="shell grid shrink-0 gap-1 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-night-muted">
            <LanguageSwitcher variant="full" className="mb-5" />
            {mail && (
              <ContactLink channel="email" href={mail} className="text-night-ink">
                {settings.email}
              </ContactLink>
            )}
            {tel && (
              <ContactLink channel="phone" href={tel}>
                {settings.phone}
              </ContactLink>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
