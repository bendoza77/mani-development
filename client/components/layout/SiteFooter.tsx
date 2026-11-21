"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Trans } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { useContent, useTranslation } from "@/i18n/client";
import { splitLocale } from "@/i18n/config";
import { LocaleLink } from "@/i18n/LocaleLink";
import { useDB } from "@/lib/store";
import { SITE_LINKS } from "./SiteHeader";

export function SiteFooter() {
  const { t } = useTranslation("common");
  const s = useContent().settings(useDB((d) => d.settings));
  const pathname = splitLocale(usePathname()).path;
  const tel = `tel:${s.phone.replace(/\s/g, "")}`;
  const socials = [
    { label: "Instagram", href: s.instagram },
    { label: "LinkedIn", href: s.linkedin },
    { label: "Facebook", href: s.facebook },
  ].filter((x) => x.href);

  return (
    <footer className="bg-night text-night-ink">
      {/* Site-wide contact call to action; the contact page already is one. */}
      {pathname !== "/contact" && (
        <div className="shell grid gap-10 border-b border-white/10 py-[clamp(3.5rem,8vw,6rem)] md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="t-eyebrow text-night-muted">{t("footer.ctaEyebrow")}</p>
            <h2 className="t-h2 mt-4 max-w-[16ch] lg:max-w-[18ch]">
              <Trans t={t} i18nKey="footer.ctaTitle" components={{ em: <em className="text-accent" /> }} />
            </h2>
            <p className="mt-5 max-w-md text-night-muted">{t("footer.ctaBody")}</p>
          </div>
          <div className="flex flex-col items-start gap-5">
            <ButtonLink href="/contact" variant="light" size="lg" arrow>
              {t("footer.ctaButton")}
            </ButtonLink>
            <p className="text-[0.95rem] text-night-muted">
              {t("footer.orCall")}{" "}
              <a href={tel} className="text-night-ink underline-offset-4 hover:text-accent hover:underline">
                {s.phone}
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="shell grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4 md:py-14">
        <div className="col-span-2 md:col-span-1">
          <LocaleLink href="/" aria-label={t("brand.home", { name: s.companyName })} className="inline-block rounded-[2px]">
            <Logo />
          </LocaleLink>
          <address className="mt-5 text-[0.92rem] leading-relaxed text-night-muted not-italic">
            {s.address}
            <br />
            {s.hours}
          </address>
        </div>
        <div>
          <p className="t-eyebrow text-night-muted">{t("footer.contact")}</p>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            <li>
              <a className="break-all hover:text-accent" href={`mailto:${s.email}`}>
                {s.email}
              </a>
            </li>
            <li>
              <a className="hover:text-accent" href={tel}>
                {s.phone}
              </a>
            </li>
          </ul>
        </div>
        <nav aria-label={t("a11y.footerNav")}>
          <p className="t-eyebrow text-night-muted">{t("footer.explore")}</p>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            {SITE_LINKS.map((n) => (
              <li key={n.href}>
                <LocaleLink href={n.href} className="hover:text-accent">
                  {t(`nav.${n.key}`)}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </nav>
        {socials.length > 0 && (
          <div>
            <p className="t-eyebrow text-night-muted">{t("footer.follow")}</p>
            <ul className="mt-4 space-y-2 text-[0.95rem]">
              {socials.map((x) => (
                <li key={x.label}>
                  <a href={x.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                    {x.label}
                    <ArrowUpRight aria-hidden className="size-3.5" />
                    <span className="sr-only">{t("a11y.opensInNewTab")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Leaves room on the right for the floating chat buttons so they never cover this row. */}
      <div className="shell flex flex-col gap-2 border-t border-white/10 pt-6 pb-36 text-[0.78rem] text-night-muted sm:flex-row sm:justify-between sm:pe-20 sm:pb-6">
        <span>{t("footer.copyright", { company: s.companyName })}</span>
        {/* The admin demo is English-only, so this link is never localized. */}
        <Link href="/admin" className="hover:text-night-ink">
          {t("footer.admin")}
        </Link>
      </div>
    </footer>
  );
}
