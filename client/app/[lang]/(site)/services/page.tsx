import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Trans } from "react-i18next/TransWithoutContext";
import { PageIntro } from "@/components/sections/PageIntro";
import { ServicesList } from "@/components/sections/ServicesList";
import { getT, pageMetadata } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("services", "/services");
}

export default async function ServicesPage() {
  const { t, i18n } = await getT("services");
  // The client journey, assembled from commitments made elsewhere on the site (FAQ, service and About copy).
  const steps = t("steps.items", { returnObjects: true });
  const models = t("models.items", { returnObjects: true });
  const faq = t("faq.items", { returnObjects: true });
  return (
    <>
      <PageIntro
        eyebrow={t("page.eyebrow")}
        title={<Trans t={t} i18n={i18n} i18nKey="page.title" components={{ em: <em className="text-accent" /> }} />}
        lead={t("page.lead")}
      />
      <ServicesList />

      <section id="how-we-work" className="bg-night py-[clamp(4rem,9vw,7rem)] text-night-ink" aria-labelledby="steps-title">
        <div className="shell">
          <p className="t-eyebrow text-night-muted">{t("steps.eyebrow")}</p>
          <h2 id="steps-title" className="t-h2 mt-4 max-w-[20ch]">
            {t("steps.title")}
          </h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-[2px] bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
            {steps.map(({ title, body }, i) => (
              <li key={title} className="bg-night p-6 lg:p-7">
                <p className="t-meta text-accent">0{i + 1}</p>
                <h3 className="mt-3 text-[1.05rem] font-semibold">{title}</h3>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-night-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-[clamp(4rem,9vw,7rem)]" aria-labelledby="models-title">
        <div className="shell">
          <p className="t-eyebrow text-muted">{t("models.eyebrow")}</p>
          <h2 id="models-title" className="t-h2 mt-4 max-w-[18ch]">
            {t("models.title")}
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[2px] border border-line bg-line lg:grid-cols-3">
            {models.map((m, i) => (
              <div key={m.name} className="flex flex-col bg-paper p-7 sm:p-9">
                <p className="t-meta text-accent">0{i + 1}</p>
                <h3 className="t-h3 mt-4">{m.name}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{m.body}</p>
                <p className="t-meta mt-auto border-t border-line pt-4 text-muted">{t("models.bestFor", { audience: m.best })}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="shell grid gap-10 border-t border-line py-[clamp(4rem,9vw,7rem)] lg:grid-cols-12" aria-labelledby="faq-title">
        <h2 id="faq-title" className="t-h2 lg:col-span-4">
          {t("faq.title")}
        </h2>
        <div className="border-t border-line lg:col-span-8">
          {faq.map(({ q, a }) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.05rem] font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <Plus aria-hidden className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="max-w-2xl pb-6 leading-relaxed text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
