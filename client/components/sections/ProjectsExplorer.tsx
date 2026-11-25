"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/i18n/client";
import { usePublicProjects } from "@/lib/public-projects";
import { CATEGORY_LABEL, cx } from "@/lib/format";
import type { Project, ProjectCategory } from "@/lib/types";

type Filters = { category: ProjectCategory | "all"; q: string };
const DEFAULTS: Filters = { category: "all", q: "" };
const CATEGORIES = new Set<string>(["all", ...Object.keys(CATEGORY_LABEL)]);
const KEY = "lintel:project-filters";

/** `initialProjects` is the list the server rendered with (app/[lang]/(site)/projects/page.tsx). */
export function ProjectsExplorer({ initialProjects }: { initialProjects?: Project[] }) {
  const { t } = useTranslation("projects");
  const { t: tc } = useTranslation("common");
  // Published projects from the API, already in the visitor's language (so search works on visible text).
  const { projects: loaded, error: loadError } = usePublicProjects(initialProjects);
  const projects = useMemo(() => loaded ?? [], [loaded]);
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [restored, setRestored] = useState(false);

  // Filters persist for the browsing session.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      // Read only the filters the bar still shows, so an old saved status or sort can't hide projects.
      if (saved && typeof saved === "object")
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore session filters after hydration
        setF({
          category: CATEGORIES.has(saved.category) ? saved.category : DEFAULTS.category,
          q: typeof saved.q === "string" ? saved.q : DEFAULTS.q,
        });
    } catch {
      /* ignore malformed */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(f));
    } catch {
      /* ignore */
    }
  }, [f, restored]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const p of projects) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [projects]);

  const results = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    // The API already returns projects in the order chosen in the admin.
    return projects.filter(
      (p) =>
        (f.category === "all" || p.category === f.category) &&
        (!q || `${p.title} ${p.location} ${p.summary}`.toLowerCase().includes(q)),
    );
  }, [projects, f]);

  const dirty = f.category !== "all" || f.q !== "";
  const categories: (ProjectCategory | "all")[] = ["all", ...(Object.keys(CATEGORY_LABEL) as ProjectCategory[])];

  return (
    <section className="pb-[clamp(4.5rem,10vw,8rem)]" aria-label={t("explorer.label")}>
      <div className="z-20 border-y border-line bg-paper lg:sticky-under-header">
        <div className="shell flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          {/* Phones: one row that scrolls, faded at the edge so the hidden chips are hinted. Wider: chips wrap, none hidden. */}
          <div
            className="no-scrollbar -mx-(--gutter) flex gap-1 overflow-x-auto px-(--gutter) max-sm:mask-[linear-gradient(to_right,black_calc(100%-3rem),transparent)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            role="group"
            aria-label={t("explorer.filterByCategory")}
          >
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={f.category === c}
                onClick={() => setF((x) => ({ ...x, category: c }))}
                className={cx(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[0.88rem] transition-colors",
                  f.category === c ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink",
                )}
              >
                {c === "all" ? t("explorer.all") : tc(`category.${c}`)}
                <span className={cx("t-meta", f.category === c ? "text-paper/70" : "text-muted")}>{counts[c] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="relative block shrink-0 sm:w-72">
            <span className="sr-only">{t("explorer.search")}</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={f.q}
              onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
              placeholder={t("explorer.searchPlaceholder")}
              className="h-10 w-full rounded-full border border-line-strong bg-card pr-4 pl-9 text-[0.88rem] placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="shell pt-8">
        {/* Keeps the heading order h1 → h2 → h3 (project cards). */}
        <h2 className="sr-only">{t("explorer.label")}</h2>
        <div className="flex items-center justify-between" aria-live="polite">
          <p className="t-meta text-muted">
            {t("explorer.showing", { shown: results.length, total: projects.length })}
          </p>
          {dirty && (
            <button type="button" onClick={() => setF(DEFAULTS)} className="inline-flex items-center gap-1 text-[0.85rem] text-muted hover:text-ink">
              <X aria-hidden className="size-3.5" /> {t("explorer.clear")}
            </button>
          )}
        </div>

        {loadError ? (
          <p role="alert" className="mt-10 rounded-[3px] border border-dashed border-line-strong px-6 py-20 text-center text-muted">
            {loadError}
          </p>
        ) : !loaded ? (
          <div className="mt-6 grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-12 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-[2px] bg-paper-2" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="mt-10 rounded-[3px] border border-dashed border-line-strong px-6 py-20 text-center text-muted">{t("explorer.none")}</p>
        ) : results.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-[3px] border border-dashed border-line-strong px-6 py-20 text-center">
            <p className="font-display text-2xl">{t("explorer.emptyTitle")}</p>
            <p className="mt-2 max-w-sm text-muted">{t("explorer.emptyBody")}</p>
            <Button className="mt-6" variant="outline" onClick={() => setF(DEFAULTS)}>
              {t("explorer.reset")}
            </Button>
          </div>
        ) : (
          <ul className="mt-6 grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Live portfolio numbers for the page intro, from the published projects. */
export function ProjectsSummary({ initialProjects }: { initialProjects?: Project[] }) {
  const { t } = useTranslation("projects");
  const projects = usePublicProjects(initialProjects).projects ?? [];
  const stats: [string, number][] = [
    [t("summary.cities"), new Set(projects.map((p) => p.city)).size],
    [t("summary.projects"), projects.length],
    [t("summary.onSite"), projects.filter((p) => p.status === "in-progress").length],
  ];
  return (
    <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4">
      {stats.map(([k, v]) => (
        <div key={k}>
          <dt className="t-meta text-muted">{k}</dt>
          <dd className="mt-1 font-display text-3xl tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
