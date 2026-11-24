"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Trans } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { ContactChannels } from "@/components/contact/ContactChannels";
import { ContactLink } from "@/components/contact/ContactLink";
import { openConsentBanner } from "@/components/consent/ConsentBanner";
import { ButtonLink } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";
import { splitLocale } from "@/i18n/config";
import { LocaleLink } from "@/i18n/LocaleLink";
import { useNavigation, type Menus } from "@/lib/navigation";
import { contactHref } from "@/lib/public-types";
import { MenuLink } from "./SiteHeader";
import { useSiteSettings } from "./SiteSettings";

export function SiteFooter({ menus, analytics = false }: { menus?: Menus | null; analytics?: boolean }) {
  const { t } = useTranslation("common");
  const s = useSiteSettings();
  const pathname = splitLocale(usePathname()).path;
  // The footer menu is edited per page in the admin (Pages → Menu).
  const { footer } = useNavigation(menus);
  const tel = contactHref("phone", s);
  const mail = contactHref("email", s);
  const socials = [
    { label: "Instagram", href: s.instagramUrl },
    { label: "LinkedIn", href: s.linkedinUrl },
    { label: "Facebook", href: s.facebookUrl },
  ].filter((x) => /^https?:\/\//i.test(x.href));

  return (
    <footer className="bg-night text-night-ink">
      {/* Site-wide contact call to action; the contact page already is one. */}
      {pathname !== "/contact" && (
        <div className="shell grid gap-10 border-b border-white/10 py-[clamp(3.5rem,8vw,6rem)] md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="t-eyebrow text-night-muted">{t("footer.ctaEyebrow")}</p>
            <h2 className="t-h2 mt-4 max-w-[16ch] lg:max-w-[18ch]">
              <Trans t={t} i18nKey="footer.ctaTitle" components={{ em: <span /> }} />
            </h2>
            <p className="mt-5 max-w-md text-night-muted">{t("footer.ctaBody")}</p>
          </div>
          <div className="flex flex-col items-start gap-5">
            <ButtonLink href="/contact" variant="light" size="lg">
              {t("footer.ctaButton")}
            </ButtonLink>
            {tel && (
              <p className="text-[0.95rem] text-night-muted">
                {t("footer.orCall")}{" "}
                <ContactLink channel="phone" href={tel} className="text-night-ink underline-offset-4 hover:text-accent hover:underline">
                  {s.phone}
                </ContactLink>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="shell grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4 md:py-14">
        <div className="col-span-2 md:col-span-1">
          <LocaleLink href="/" aria-label={t("brand.home", { name: s.companyName })} className="inline-block rounded-[2px]">
            <Logo />
          </LocaleLink>
          {(s.address || s.hours) && (
            <address className="mt-5 text-[0.92rem] leading-relaxed text-night-muted not-italic">
              {s.address}
              {s.address && s.hours && <br />}
              {s.hours}
            </address>
          )}
        </div>
        {/* Full width on phones so the email address fits on one line instead of breaking mid-word. */}
        <div className="max-sm:col-span-2">
          <p className="t-eyebrow text-night-muted">{t("footer.contact")}</p>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            {mail && (
              <li>
                <ContactLink channel="email" className="wrap-anywhere hover:text-accent" href={mail}>
                  {s.email}
                </ContactLink>
              </li>
            )}
            {tel && (
              <li>
                <ContactLink channel="phone" className="hover:text-accent" href={tel}>
                  {s.phone}
                </ContactLink>
              </li>
            )}
          </ul>
          <ContactChannels tone="night" className="mt-5" />
        </div>
        <nav aria-label={t("a11y.footerNav")}>
          <p className="t-eyebrow text-night-muted">{t("footer.explore")}</p>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            {footer.map((n) => (
              <li key={n.href}>
                <MenuLink link={n} className="hover:text-accent" />
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
        <span className="flex flex-wrap gap-x-5 gap-y-2">
          {analytics && (
            <button type="button" onClick={openConsentBanner} className="text-left hover:text-night-ink">
              {t("consent.settings")}
            </button>
          )}
          {/* The admin is English-only, so this link is never localized. */}
          <Link href="/admin" className="hover:text-night-ink">
            {t("footer.admin")}
          </Link>
        </span>
      </div>
    </footer>
  );
}
