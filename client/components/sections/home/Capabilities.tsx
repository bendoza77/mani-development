"use client";

import { useMemo, useState } from "react";
import { Img } from "@/components/ui/Img";
import { TextLink } from "@/components/ui/Button";
import { useDB } from "@/lib/store";
import { cx } from "@/lib/format";

/**
 * Index-style capability list. On desktop the active row (hover or keyboard focus)
 * swaps a sticky preview image; on mobile each row shows its own thumbnail.
 */
export function Capabilities() {
  const all = useDB((d) => d.services);
  const services = useMemo(() => all.filter((s) => s.visible), [all]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = services.find((s) => s.id === activeId) ?? services[0];

  if (!services.length) return null;

  return (
    <section className="py-[clamp(4.5rem,11vw,9rem)]" aria-labelledby="capabilities-title">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)]">
            <p className="t-eyebrow text-muted">Capabilities</p>
            <h2 id="capabilities-title" className="t-h2 mt-4 max-w-[14ch]">
              One team, from feasibility to handover
            </h2>
            <div className="relative mt-10 hidden aspect-[4/3] overflow-hidden rounded-[2px] lg:block">
              {services.map((s) => (
                <div
                  key={s.id}
                  className={cx(
                    "absolute inset-0 transition-[opacity,transform] duration-700 ease-(--ease-arch)",
                    s.id === active?.id ? "scale-100 opacity-100" : "scale-[1.03] opacity-0",
                  )}
                >
                  <Img src={s.image} alt="" sizes="40vw" />
                </div>
              ))}
              <p className="t-meta absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1.5 text-ink">{active?.title}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <ul className="border-t border-line">
            {services.map((s, i) => (
              <li key={s.id} className="border-b border-line">
                <div
                  tabIndex={0}
                  onMouseEnter={() => setActiveId(s.id)}
                  onFocus={() => setActiveId(s.id)}
                  className="group grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 py-7 outline-offset-4 sm:grid-cols-[3rem_1fr_auto] sm:py-8"
                >
                  <span className="t-meta pt-2 text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3
                      className={cx(
                        "t-h3 transition-[color,transform] duration-500 ease-(--ease-arch)",
                        s.id === active?.id ? "lg:translate-x-2 lg:text-accent" : "",
                      )}
                    >
                      {s.title}
                    </h3>
                    <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-ink-soft">{s.summary}</p>
                  </div>
                  <div className="relative col-span-2 aspect-[16/9] overflow-hidden rounded-[2px] sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:aspect-square sm:w-24 lg:hidden">
                    <Img src={s.image} alt="" sizes="(min-width: 640px) 6rem, 100vw" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <TextLink href="/services" className="mt-10">
            All services in detail
          </TextLink>
        </div>
      </div>
    </section>
  );
}
