"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { useDB } from "@/lib/store";
import { NAV } from "./SiteHeader";

export function SiteFooter() {
  const s = useDB((d) => d.settings);
  const socials = [
    { label: "Instagram", href: s.instagram },
    { label: "LinkedIn", href: s.linkedin },
    { label: "Facebook", href: s.facebook },
  ].filter((x) => x.href);

  return (
    <footer className="relative overflow-hidden bg-night text-night-ink" data-theme-surface="night">
      <div className="shell grid gap-12 border-b border-white/10 py-16 md:grid-cols-[1.4fr_1fr] md:py-24">
        <div>
          <p className="t-eyebrow text-night-muted">Next project</p>
          <h2 className="t-h2 mt-5 max-w-[16ch]">
            A plot, a sketch or just a question? <em className="text-accent">Let&rsquo;s talk.</em>
          </h2>
        </div>
        <div className="flex flex-col items-start justify-end gap-6">
          <p className="max-w-sm text-night-muted">
            We usually reply within two working days. First conversations and site visits are free.
          </p>
          <ButtonLink href="/contact" variant="light" size="lg" arrow>
            Start a project
          </ButtonLink>
        </div>
      </div>

      <div className="shell grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="t-eyebrow text-night-muted">Studio</p>
          <address className="mt-4 text-[0.95rem] leading-relaxed not-italic">
            {s.address}
            <br />
            {s.hours}
          </address>
        </div>
        <div>
          <p className="t-eyebrow text-night-muted">Contact</p>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            <li>
              <a className="break-all hover:text-accent" href={`mailto:${s.email}`}>
                {s.email}
              </a>
            </li>
            <li>
              <a className="hover:text-accent" href={`tel:${s.phone.replace(/\s/g, "")}`}>
                {s.phone}
              </a>
            </li>
          </ul>
        </div>
        <nav aria-label="Footer">
          <p className="t-eyebrow text-night-muted">Explore</p>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-accent">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="t-eyebrow text-night-muted">Follow</p>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            {socials.map((x) => (
              <li key={x.label}>
                <a href={x.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                  {x.label}
                  <ArrowUpRight aria-hidden className="size-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="shell flex flex-col gap-6 pb-8 md:flex-row md:items-end md:justify-between">
        <p
          aria-hidden
          className="flex items-center gap-[0.12em] font-sans text-[clamp(4.5rem,19vw,17rem)] leading-[0.8] font-semibold tracking-[-0.04em] text-white/[0.07] uppercase select-none"
        >
          <LogoMark className="h-[0.7em] w-[0.7em] text-white/[0.07]" />
          {s.companyName}
        </p>
        <div className="flex flex-col gap-1 pb-2 text-[0.78rem] text-night-muted md:items-end">
          <span>© 2026 {s.companyName}. Design prototype: a fictional company.</span>
          <Link href="/admin" className="hover:text-night-ink">
            Admin demo
          </Link>
        </div>
      </div>
    </footer>
  );
}
