import type { Metadata } from "next";
import { ContactDetails } from "@/components/sections/ContactDetails";
import { ContactForm } from "@/components/sections/ContactForm";
import { PageIntro } from "@/components/sections/PageIntro";
import { Trans } from "react-i18next/TransWithoutContext";
import { getT, pageMetadata } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("contact", "/contact");
}

/** Stylised site-plan map (static SVG, no map API or key required). */
async function StudioMap() {
  const { t } = await getT("contact");
  return (
    <figure className="relative overflow-hidden rounded-[3px] border border-line bg-paper-2">
      <svg viewBox="0 0 400 260" className="block h-auto w-full text-ink" role="img" aria-label={t("map.label")}>
        <defs>
          <pattern id="blocks" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <rect width="20" height="20" x="3" y="3" fill="currentColor" opacity="0.06" />
          </pattern>
        </defs>
        <rect width="400" height="260" fill="url(#blocks)" />
        <path d="M-10 210 C 80 170, 120 230, 200 190 S 330 120, 420 150" fill="none" stroke="var(--info)" strokeOpacity="0.35" strokeWidth="16" strokeLinecap="round" />
        <g fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="5" strokeLinecap="round">
          <path d="M20 40 L 380 120" />
          <path d="M60 250 L 150 10" />
          <path d="M210 250 L 260 0" />
          <path d="M0 120 C 120 110, 200 80, 400 60" />
        </g>
        <g fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2">
          <path d="M0 170 L 400 230" />
          <path d="M320 0 L 300 260" />
          <path d="M0 70 L 200 0" />
        </g>
        <circle cx="215" cy="92" r="26" fill="var(--accent)" opacity="0.12" />
        <g transform="translate(215 92)">
          <path d="M0 -22 C 12 -22, 14 -10, 0 6 C -14 -10, -12 -22, 0 -22 Z" fill="var(--accent)" />
          <circle cy="-14" r="4" fill="var(--accent-ink)" />
        </g>
        <text x="236" y="86" fontFamily="var(--font-mono)" fontSize="9" fill="currentColor" letterSpacing="1">{t("map.studio")}</text>
        <text x="236" y="99" fontFamily="var(--font-mono)" fontSize="8" fill="currentColor" opacity="0.6">{t("map.district")}</text>
        <text x="40" y="232" fontFamily="var(--font-mono)" fontSize="8" fill="var(--info)" letterSpacing="2" opacity="0.8">{t("map.river")}</text>
      </svg>
      <figcaption className="t-meta border-t border-line px-4 py-3 text-muted">{t("map.caption")}</figcaption>
    </figure>
  );
}

export default async function ContactPage() {
  const { t, i18n } = await getT("contact");
  return (
    <>
      <PageIntro
        eyebrow={t("page.eyebrow")}
        title={<Trans t={t} i18n={i18n} i18nKey="page.title" components={{ em: <em className="text-accent" /> }} />}
        lead={t("page.lead")}
      />
      <section className="shell grid gap-12 pb-[clamp(4rem,9vw,7rem)] lg:grid-cols-12 lg:gap-14">
        {/* Direct details come first on small screens, where calling is often quicker than a form. */}
        <aside className="space-y-8 lg:order-last lg:col-span-4 lg:col-start-9" aria-label={t("page.detailsLabel")}>
          <ContactDetails />
          <div className="max-lg:hidden">
            <StudioMap />
          </div>
        </aside>
        <div className="lg:col-span-7 lg:row-start-1">
          <h2 className="t-h3 mb-6">{t("page.formTitle")}</h2>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
