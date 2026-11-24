import type { Metadata } from "next";
import { ContactChannels } from "@/components/contact/ContactChannels";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactDetails } from "@/components/sections/ContactDetails";
import { ContactForm } from "@/components/sections/ContactForm";
import { OfficeMap } from "@/components/sections/OfficeMap";
import { PageIntro } from "@/components/sections/PageIntro";
import { Trans } from "react-i18next/TransWithoutContext";
import { getT } from "@/i18n/server";
import { getPageSeo, getSettings } from "@/lib/public-api";
import { contractorJsonLd } from "@/lib/seo/jsonld";
import { routeMetadata } from "@/lib/seo/route";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT("meta");
  return routeMetadata({
    path: "/contact",
    title: t("contact.title"),
    description: t("contact.description"),
    seo: await getPageSeo("contact", locale),
  });
}

export default async function ContactPage() {
  const { t, i18n, locale } = await getT("contact");
  const settings = await getSettings(locale);
  return (
    <>
      <JsonLd data={[contractorJsonLd(settings, locale)]} />
      <PageIntro
        eyebrow={t("page.eyebrow")}
        title={<Trans t={t} i18n={i18n} i18nKey="page.title" components={{ em: <span /> }} />}
        lead={t("page.lead")}
      />
      <section className="shell grid gap-12 pb-[clamp(4rem,9vw,7rem)] lg:grid-cols-12 lg:gap-14">
        {/* Direct details come first on small screens, where calling is often quicker than a form. */}
        <aside className="space-y-8 lg:order-last lg:col-span-4 lg:col-start-9" aria-label={t("page.detailsLabel")}>
          <ContactDetails />
          <ContactChannels />
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
