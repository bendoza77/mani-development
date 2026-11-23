import { Img } from "@/components/ui/Img";
import { getT } from "@/i18n/server";
import { getServices } from "@/lib/public-api";

/** Services index (sticky on desktop) + one compact block per service, driven by the admin services list. */
export async function ServicesList() {
  const { t, locale } = await getT("services");
  // Anchor ids are the services' slugs, so /services#… links work in every language.
  const services = await getServices(locale);

  if (!services.length) {
    return <p className="shell py-24 text-center text-muted">{t("list.empty")}</p>;
  }

  return (
    <section className="shell grid gap-12 pb-[clamp(4rem,9vw,7rem)] lg:grid-cols-12" aria-label={t("list.label")}>
      <nav aria-label={t("list.index")} className="hidden lg:col-span-3 lg:block">
        <ol className="sticky top-[calc(var(--header-h)+2rem)] space-y-1 border-l border-line">
          {services.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.slug}`}
                className="-ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-[0.9rem] text-ink-soft hover:border-ink hover:text-ink"
              >
                <span className="t-meta pt-0.5 text-muted">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="border-t border-line lg:col-span-9">
        {services.map((s, i) => (
          <article
            key={s.id}
            id={s.slug}
            className="grid scroll-mt-[calc(var(--header-h)+1.5rem)] gap-6 border-b border-line py-10 sm:grid-cols-12 sm:gap-8 md:py-12"
          >
            <div className="relative aspect-[3/2] overflow-hidden rounded-[2px] sm:col-span-5 sm:aspect-[4/3]">
              <Img src={s.image.src} alt={s.image.alt} sizes="(min-width: 1024px) 28vw, (min-width: 640px) 40vw, 100vw" />
            </div>
            <div className="sm:col-span-7">
              <p className="t-meta text-muted">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="t-h3 mt-2">{s.title}</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{s.summary}</p>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{s.description}</p>
              {s.features.length > 0 && (
                <ul className="mt-5 grid gap-x-6 border-t border-line xl:grid-cols-2">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 border-b border-line py-2.5 text-[0.9rem]">
                      <span aria-hidden className="size-1.5 shrink-0 rotate-45 bg-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
