import { ArrowUpRight } from "lucide-react";
import { Img } from "@/components/ui/Img";
import { TextLink } from "@/components/ui/Button";
import { IMAGES } from "@/data/images";
import { LocaleLink as Link } from "@/i18n/LocaleLink";
import { getT } from "@/i18n/server";
import { getServices } from "@/lib/public-api";

/** Compact list of the visible services (managed in the admin), each linking to its detail on /services. */
export async function ServicesOverview() {
  const { t, locale } = await getT("home");
  const services = await getServices(locale);

  if (!services.length) return null;

  return (
    <section className="border-t border-line py-[clamp(4rem,9vw,7rem)]" aria-labelledby="services-title">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)]">
            <p className="t-eyebrow text-muted">{t("services.eyebrow")}</p>
            <h2 id="services-title" className="t-h2 mt-4 max-w-[16ch]">
              {t("services.title")}
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-ink-soft">{t("services.lead")}</p>
            <div className="relative mt-10 hidden aspect-[4/3] overflow-hidden rounded-[2px] lg:block">
              <Img src={IMAGES["villa-modern-white"].src} alt={t("services.imageAlt")} sizes="38vw" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <ul className="border-t border-line">
            {services.map((s, i) => (
              <li key={s.id} className="border-b border-line">
                <Link
                  // Anchors are the service's slug, the same in every language (see ServicesList).
                  href={`/services#${s.slug}`}
                  className="group grid grid-cols-[2.25rem_1fr_auto] gap-x-4 py-6 sm:grid-cols-[3rem_1fr_auto] sm:py-7"
                >
                  <span className="t-meta pt-2 text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="t-h3 block transition-colors group-hover:text-accent">{s.title}</span>
                    <span className="mt-2 block max-w-lg text-[0.95rem] leading-relaxed text-ink-soft">{s.summary}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="mt-2 size-5 text-muted transition-[color,transform] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <TextLink href="/services" className="mt-10">
            {t("services.link")}
          </TextLink>
        </div>
      </div>
    </section>
  );
}
