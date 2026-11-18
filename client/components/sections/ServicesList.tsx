"use client";

import { useMemo } from "react";
import { Img } from "@/components/ui/Img";
import { Reveal } from "@/components/ui/Reveal";
import { useDB } from "@/lib/store";
import { slugify } from "@/lib/format";

/** Services index (sticky on desktop) + detailed blocks, driven by the admin services list. */
export function ServicesList() {
  const all = useDB((d) => d.services);
  const services = useMemo(() => all.filter((s) => s.visible), [all]);

  if (!services.length) {
    return (
      <p className="shell py-24 text-center text-muted">Our services are being updated. Please contact us directly.</p>
    );
  }

  return (
    <section className="shell grid gap-12 pb-[clamp(4.5rem,10vw,8rem)] lg:grid-cols-12" aria-label="Services">
      <nav aria-label="Services index" className="hidden lg:col-span-3 lg:block">
        <ol className="sticky top-[calc(var(--header-h)+2rem)] space-y-1 border-l border-line">
          {services.map((s, i) => (
            <li key={s.id}>
              <a href={`#${slugify(s.title)}`} className="-ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-[0.9rem] text-ink-soft hover:border-ink hover:text-ink">
                <span className="t-meta pt-0.5 text-muted">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="space-y-[clamp(4rem,9vw,7rem)] lg:col-span-9">
        {services.map((s, i) => (
          <Reveal as="article" key={s.id} className="scroll-mt-[calc(var(--header-h)+2rem)]">
            <div id={slugify(s.title)} className="grid gap-8 md:grid-cols-9">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[2px] md:col-span-9">
                <Img src={s.image} alt="" sizes="(min-width: 1024px) 70vw, 100vw" />
                <span className="t-meta absolute top-4 left-4 rounded-full bg-card/90 px-3 py-1.5">{String(i + 1).padStart(2, "0")} / {String(services.length).padStart(2, "0")}</span>
              </div>
              <div className="md:col-span-5">
                <h2 className="t-h2">{s.title}</h2>
                <p className="t-lead mt-5 text-ink-soft">{s.summary}</p>
                <p className="mt-4 leading-relaxed text-ink-soft">{s.description}</p>
              </div>
              <ul className="self-end border-t border-line md:col-span-4">
                {s.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 border-b border-line py-3.5 text-[0.95rem]">
                    <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
