import type { Metadata } from "next";
import { ContactDetails } from "@/components/sections/ContactDetails";
import { ContactForm } from "@/components/sections/ContactForm";
import { OfficeMap } from "@/components/sections/OfficeMap";
import { PageIntro } from "@/components/sections/PageIntro";
import { Trans } from "react-i18next/TransWithoutContext";
import { getT, pageMetadata } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("contact", "/contact");
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
          <OfficeMap />
        </aside>
        <div className="lg:col-span-7 lg:row-start-1">
          <h2 className="t-h3 mb-6">{t("page.formTitle")}</h2>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
