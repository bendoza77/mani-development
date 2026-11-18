"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SceneMount } from "@/components/3d/SceneMount";
import { STAGE_NAMES } from "@/components/3d/buildingModel";
import { cx } from "@/lib/format";

const STAGES = [
  {
    title: "Groundworks",
    lead: "Survey, excavation, footings and the raft. We test the ground before we promise a programme.",
    items: ["Geotechnical survey", "Footings & piling", "Raft slab", "Drainage & utilities"],
    span: "6–10 weeks",
  },
  {
    title: "Structure",
    lead: "A reinforced concrete frame rises floor by floor, modelled and checked by our in-house engineers.",
    items: ["Column & slab cycles", "Seismic detailing", "Tower crane logistics", "Concrete testing"],
    span: "4–7 days per floor",
  },
  {
    title: "Walls & cores",
    lead: "Lift and stair cores, shear walls and solid enclosure. The frame becomes rooms.",
    items: ["Stair & lift cores", "Shear walls", "Roof upstands", "First-fix services"],
    span: "8–14 weeks",
  },
  {
    title: "Facade",
    lead: "Glazing, timber fins and balustrades go on, and the building is sealed against the weather.",
    items: ["Glazing & frames", "Solar-shading fins", "Balustrades", "Air-tightness testing"],
    span: "10–16 weeks",
  },
  {
    title: "Landscape",
    lead: "Terraces, gardens and trees are planted as carefully as the building was built. Then we hand over.",
    items: ["Terrace planting", "Courtyard & water", "Snagging", "Handover & aftercare"],
    span: "6–8 weeks",
  },
];

export function ProcessSection({ blueprint }: { blueprint: ReactNode }) {
  const [stage, setStage] = useState(0);
  const [orbit, setOrbit] = useState(0);
  const articles = useRef<(HTMLElement | null)[]>([]);
  const stageBox = useRef<HTMLDivElement>(null);

  // The stage is derived from scroll position (not scroll-jacked): the last article whose top has
  // passed the reading line wins. Unlike a thin IntersectionObserver band, this can't skip a stage
  // when frames drop during a fast scroll. On mobile the model is pinned above the text, so the
  // reading line sits in the middle of the space left below it.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const box = stageBox.current?.getBoundingClientRect();
      const pinnedAbove = !!box && window.matchMedia("(max-width: 1023px)").matches;
      const line = pinnedAbove ? (Math.max(0, box.bottom) + vh) / 2 : vh / 2;
      let next = 0;
      articles.current.forEach((a, i) => {
        if (a && a.getBoundingClientRect().top <= line) next = i;
      });
      setStage(next);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Scroll the chosen article to the same reading line the tracker uses; the scroll handler sets the stage.
  const goTo = (i: number) => {
    const a = articles.current[i];
    if (!a) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const vh = window.innerHeight;
    const box = stageBox.current?.getBoundingClientRect();
    const line = box && window.matchMedia("(max-width: 1023px)").matches ? (Math.max(0, box.bottom) + vh) / 2 : vh / 2;
    window.scrollTo({ top: window.scrollY + a.getBoundingClientRect().top - line + 12, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section className="relative bg-night text-night-ink" aria-labelledby="process-title">
      <div className="shell pt-[clamp(4.5rem,10vw,8rem)]">
        <div className="grid gap-6 md:grid-cols-12">
          <p className="t-eyebrow text-night-muted md:col-span-3">How we build</p>
          <div className="md:col-span-9">
            <h2 id="process-title" className="t-h2 max-w-[20ch]">
              From the first footing to the last tree planted.
            </h2>
            <p className="t-lead mt-5 max-w-2xl text-night-muted">
              Every Lintel building moves through the same five stages, with the same team accountable at each one.
              Scroll to assemble the model.
            </p>
          </div>
        </div>
      </div>

      <div className="shell grid lg:grid-cols-12 lg:gap-12">
        {/* Sticky model stage */}
        <div ref={stageBox} className="sticky-under-header z-20 -mx-(--gutter) h-[46svh] shadow-[0_18px_30px_-12px_rgb(0_0_0/0.6)] lg:z-0 lg:shadow-none lg:order-2 lg:col-span-7 lg:mx-0 lg:h-[calc(100svh-var(--header-h))] lg:py-8">
          <div className="relative h-full overflow-hidden bg-night lg:rounded-[3px] lg:border lg:border-white/10">
            <div aria-hidden className="drafting-grid absolute inset-0 opacity-[0.35] [--line:rgb(255_255_255/0.07)]" />
            <SceneMount
              variant="process"
              stage={stage}
              orbit={orbit}
              placeholder={blueprint}
              className="absolute inset-0 text-night-ink/60"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-night/90 to-transparent p-4 pb-10 sm:p-5 sm:pb-12">
              <div>
                <p className="t-meta text-night-muted">Stage 0{stage + 1} / 05</p>
                <p className="mt-1 font-display text-xl">{STAGE_NAMES[stage]}</p>
              </div>
              <div className="pointer-events-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => setOrbit((o) => Math.max(o - 0.45, -1.35))}
                  className="grid size-10 place-items-center rounded-full border border-white/15 hover:bg-white/10"
                  aria-label="Rotate model left"
                >
                  <ChevronLeft aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOrbit((o) => Math.min(o + 0.45, 1.35))}
                  className="grid size-10 place-items-center rounded-full border border-white/15 hover:bg-white/10"
                  aria-label="Rotate model right"
                >
                  <ChevronRight aria-hidden className="size-4" />
                </button>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night via-night/80 to-transparent p-4 pt-10 sm:p-5 sm:pt-12">
              <ol className="flex gap-1.5" aria-label="Construction stages">
                {STAGE_NAMES.map((n, i) => (
                  <li key={n} className="flex-1">
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={stage === i ? "step" : undefined}
                      className="group flex w-full flex-col gap-2 py-2 text-left"
                    >
                      <span
                        className={cx(
                          "h-[3px] rounded-full transition-colors duration-500",
                          i < stage ? "bg-night-ink" : i === stage ? "bg-accent" : "bg-white/20 group-hover:bg-white/40",
                        )}
                      />
                      <span className={cx("t-meta hidden truncate sm:block", i === stage ? "text-night-ink" : "text-night-muted")}>
                        {n}
                      </span>
                      <span className="sr-only sm:hidden">{n}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Stage narrative */}
        <div className="relative z-0 lg:z-10 lg:order-1 lg:col-span-5">
          {STAGES.map((s, i) => (
            <article
              key={s.title}
              ref={(el) => {
                articles.current[i] = el;
              }}
              data-stage={i}
              className={cx(
                "flex min-h-[62svh] flex-col justify-center py-12 transition-opacity duration-700 lg:min-h-[78svh]",
                stage === i ? "opacity-100" : "opacity-40 lg:opacity-35",
              )}
            >
              <div className="py-2">
                <p className="t-meta text-accent">0{i + 1}</p>
                <h3 className="t-h2 mt-3">{s.title}</h3>
                <p className="t-lead mt-4 max-w-md text-night-muted">{s.lead}</p>
                <ul className="mt-7 grid max-w-md grid-cols-2 gap-x-6 border-t border-white/10">
                  {s.items.map((it) => (
                    <li key={it} className="border-b border-white/10 py-3 text-[0.9rem]">
                      {it}
                    </li>
                  ))}
                </ul>
                <p className="t-meta mt-5 text-night-muted">Typical duration · {s.span}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="h-[clamp(3rem,8vw,6rem)]" />
    </section>
  );
}
