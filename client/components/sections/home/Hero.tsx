"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { SceneMount } from "@/components/3d/SceneMount";
import { STAGE_NAMES } from "@/components/3d/buildingModel";
import { ButtonLink } from "@/components/ui/Button";
import { useDB } from "@/lib/store";
import { cx } from "@/lib/format";

/**
 * Hero: editorial copy on the left, the live maquette assembling on the right.
 * All copy is HTML (never in the canvas), and the scene is decorative (aria-hidden).
 */
export function Hero({ blueprint }: { blueprint: ReactNode }) {
  const [stage, setStage] = useState(0);
  const [replay, setReplay] = useState(0);
  const projects = useDB((d) => d.projects);
  const onSite = useMemo(
    () => projects.find((p) => p.featured && p.status === "in-progress") ?? projects.find((p) => p.status === "in-progress"),
    [projects],
  );
  const done = stage >= 5;

  return (
    <section className="relative isolate overflow-hidden pt-(--header-h)" aria-labelledby="hero-title">
      <div aria-hidden className="drafting-grid absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_70%_45%,black,transparent_75%)]" />

      <div className="shell relative grid min-h-[min(100svh,64rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] lg:grid-cols-12 lg:grid-rows-[1fr_auto]">
        {/* Copy */}
        <div className="relative z-10 pt-[clamp(2.5rem,7vh,5rem)] lg:col-span-6 lg:self-center lg:py-14 xl:col-span-5">
          <p className="t-eyebrow rise-in flex items-center gap-3 text-muted" style={{ "--d": "60ms" } as React.CSSProperties}>
            <span className="h-px w-8 bg-current max-sm:hidden" />
            Building &amp; development · Est. 2009
          </p>
          <h1 id="hero-title" className="t-display rise-in mt-8 leading-[1.04] lg:mt-10" style={{ "--d": "120ms" } as React.CSSProperties}>
            Considered buildings, <em className="font-[350] text-accent">built to last.</em>
          </h1>
          <p className="t-lead rise-in mt-8 max-w-[36rem] leading-[1.7] text-ink-soft md:max-w-[25rem] lg:mt-10 lg:max-w-[36rem]" style={{ "--d": "220ms" } as React.CSSProperties}>
            We design, engineer and build homes, apartment buildings and workplaces across Georgia, with one
            accountable team from the first footing to the last tree planted.
          </p>
          <div className="rise-in mt-10 flex flex-wrap gap-3 lg:mt-12" style={{ "--d": "320ms" } as React.CSSProperties}>
            <ButtonLink href="/projects" size="lg" arrow>
              Explore our projects
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="outline">
              Start a project
            </ButtonLink>
          </div>
        </div>

        {/* Maquette: its own framed stage on mobile, bleeding right on desktop */}
        <SceneMount
          variant="hero"
          eager
          replay={replay}
          onStage={setStage}
          placeholder={blueprint}
          className="relative -mx-(--gutter) mt-10 mb-8 h-[clamp(20rem,62vw,34rem)] text-ink/70 [mask-image:linear-gradient(to_bottom,black_88%,transparent)] md:-mt-64 md:ml-[44%] md:h-[30rem] md:[mask-image:linear-gradient(to_right,transparent,black_22%)] lg:absolute lg:[mask-image:linear-gradient(to_right,transparent,black_14%,black_92%,transparent)] lg:top-0 lg:bottom-32 lg:right-[calc(-1*var(--gutter))] lg:mx-0 lg:mt-0 lg:mb-0 lg:ml-0 lg:h-auto lg:w-[64%]"
        />

        {/* Live caption strip */}
        <div className="relative z-10 flex flex-col gap-4 border-t border-line py-6 sm:flex-row lg:mt-12 sm:items-center sm:justify-between lg:col-span-12">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-live="polite">
            <span className="t-meta tabular-nums text-muted">{done ? "05/05" : `0${Math.min(stage + 1, 5)}/05`}</span>
            <div className="flex gap-1" aria-hidden>
              {STAGE_NAMES.map((n, i) => (
                <span
                  key={n}
                  className={cx(
                    "h-[3px] w-5 rounded-full transition-colors duration-500 sm:w-10",
                    i < stage || done ? "bg-ink" : i === stage ? "bg-accent" : "bg-line-strong",
                  )}
                />
              ))}
            </div>
            <span className="text-[0.88rem] whitespace-nowrap">
              {done ? "Handover ready" : <>Assembling: {STAGE_NAMES[Math.min(stage, 4)]}</>}
            </span>
            <button
              type="button"
              onClick={() => setReplay((r) => r + 1)}
              disabled={!done}
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-[3px] px-2 text-[0.82rem] text-muted transition-opacity hover:text-ink disabled:pointer-events-none disabled:opacity-0"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              Rebuild
            </button>
          </div>
          {onSite && (
            <Link
              href={`/projects/${onSite.slug}`}
              className="group flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.88rem] text-ink-soft hover:text-ink"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              On site now: <span className="font-medium text-ink underline-offset-4 group-hover:underline">{onSite.title}</span>
              <span className="t-meta text-muted">
                {onSite.city} · {onSite.progress}%
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
