"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { useDB } from "@/lib/store";
import { cx } from "@/lib/format";

export const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useDB((d) => d.settings);
  const dialog = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);

  // Hide on scroll down / reveal on scroll up, without re-rendering React on every frame:
  // the hidden state is written straight to data attributes (CSS does the motion). A direction
  // change must travel a few pixels before it flips the header, so small trackpad deltas never
  // make it flicker. <html data-header-hidden> lets sticky bars follow the header.
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const root = document.documentElement;
    let raf = 0;
    let last = Math.max(0, window.scrollY);
    let anchor = last;
    let dir = 0;
    let hidden = false;

    const setHidden = (next: boolean) => {
      if (next === hidden) return;
      hidden = next;
      el.dataset.hidden = String(next);
      root.toggleAttribute("data-header-hidden", next);
    };

    const update = () => {
      raf = 0;
      const y = Math.max(0, window.scrollY);
      setScrolled(y > 12); // bails out unless the value actually changes
      const d = y > last ? 1 : y < last ? -1 : 0;
      if (d !== 0 && d !== dir) {
        dir = d;
        anchor = last;
      }
      if (y < 240) setHidden(false);
      else if (dir === 1 && y - anchor > 24) setHidden(true);
      else if (dir === -1 && anchor - y > 24) setHidden(false);
      last = y;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-header-hidden");
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
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMenuOpen(false);
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const overHero = pathname === "/" && !scrolled;

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-[3px] bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header
        ref={header}
        data-hidden="false"
        className={cx(
          "site-header fixed inset-x-0 top-0 z-50 border-b",
          scrolled ? "border-line bg-paper/[0.97]" : "border-transparent bg-transparent",
          menuOpen && "!translate-y-0",
        )}
      >
        <div className="shell flex h-(--header-h) items-center justify-between gap-6">
          <Link href="/" className="rounded-[2px]" aria-label={`${settings.companyName} home`}>
            <Logo />
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
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
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink href="/contact" size="sm" variant={overHero ? "outline" : "primary"} className="hidden sm:inline-flex">
              Start a project
            </ButtonLink>
            <button
              type="button"
              className="-mr-2 grid size-11 place-items-center rounded-[3px] md:hidden"
              aria-label="Open menu"
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
        aria-label="Site menu"
        onCancel={(e) => {
          e.preventDefault();
          setMenuOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-night p-0 text-night-ink"
      >
        <div className="flex h-full flex-col">
          <div className="shell flex h-(--header-h) shrink-0 items-center justify-between">
            <Link href="/" onClick={() => setMenuOpen(false)} aria-label={`${settings.companyName} home`}>
              <Logo />
            </Link>
            <button
              type="button"
              className="-mr-2 grid size-11 place-items-center rounded-[3px]"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X aria-hidden className="size-5.5" />
            </button>
          </div>
          <nav aria-label="Mobile" className="shell flex flex-1 flex-col justify-center">
            <ul className="flex flex-col">
              {[{ href: "/", label: "Home" }, ...NAV].map((item, i) => (
                <li
                  key={item.href}
                  className="border-b border-white/10"
                  style={{ animation: menuOpen ? `rise-in .7s var(--ease-arch) ${80 + i * 55}ms both` : undefined }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={(item.href === "/" ? pathname === "/" : isActive(item.href)) ? "page" : undefined}
                    className="flex items-baseline justify-between py-4 font-display text-[clamp(2rem,9vw,3rem)] leading-none tracking-tight aria-[current=page]:text-accent"
                  >
                    {item.label}
                    <span className="font-mono text-xs text-night-muted">0{i + 1}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="shell grid shrink-0 gap-1 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-night-muted">
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
