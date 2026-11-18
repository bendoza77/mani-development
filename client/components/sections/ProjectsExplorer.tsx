"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { Button } from "@/components/ui/Button";
import { useDB } from "@/lib/store";
import { CATEGORY_LABEL, STATUS_LABEL, cx } from "@/lib/format";
import type { ProjectCategory, ProjectStatus } from "@/lib/types";

type Filters = { category: ProjectCategory | "all"; status: ProjectStatus | "all"; q: string; sort: "recent" | "az" };
const DEFAULTS: Filters = { category: "all", status: "all", q: "", sort: "recent" };
const KEY = "lintel:project-filters";

export function ProjectsExplorer() {
  const projects = useDB((d) => d.projects);
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [restored, setRestored] = useState(false);

  // Filters persist for the browsing session.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore session filters after hydration
      if (saved && typeof saved === "object") setF({ ...DEFAULTS, ...saved });
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
    const list = projects.filter(
      (p) =>
        (f.category === "all" || p.category === f.category) &&
        (f.status === "all" || p.status === f.status) &&
        (!q || `${p.title} ${p.location} ${p.summary}`.toLowerCase().includes(q)),
    );
    return f.sort === "az"
      ? [...list].sort((a, b) => a.title.localeCompare(b.title))
      : [...list].sort((a, b) => (b.completionDate ?? b.estimatedCompletion).localeCompare(a.completionDate ?? a.estimatedCompletion));
  }, [projects, f]);

  const dirty = f.category !== "all" || f.status !== "all" || f.q !== "";
  const categories: (ProjectCategory | "all")[] = ["all", ...(Object.keys(CATEGORY_LABEL) as ProjectCategory[])];

  return (
    <section className="pb-[clamp(4.5rem,10vw,8rem)]" aria-label="Project list">
      <div className="sticky-under-header z-20 border-y border-line bg-paper">
        <div className="shell flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar -mx-(--gutter) flex gap-1 overflow-x-auto px-(--gutter) lg:mx-0 lg:px-0" role="group" aria-label="Filter by category">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={f.category === c}
                onClick={() => setF((x) => ({ ...x, category: c }))}
                className={cx(
                  "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[0.88rem] transition-colors",
                  f.category === c ? "text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink",
                )}
              >
                {f.category === c && (
                  <motion.span layoutId="cat-pill" className="absolute inset-0 -z-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <span className="relative">{c === "all" ? "All" : CATEGORY_LABEL[c]}</span>
                <span className={cx("t-meta relative", f.category === c ? "text-paper/70" : "text-muted")}>{counts[c] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <label className="relative col-span-2 sm:w-64">
              <span className="sr-only">Search projects</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={f.q}
                onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
                placeholder="Search name or place"
                className="h-10 w-full rounded-full border border-line-strong bg-card pr-4 pl-9 text-[0.88rem] placeholder:text-muted focus:border-ink focus:outline-none"
              />
            </label>
            <label className="sr-only" htmlFor="status-filter">
              Status
            </label>
            <select
              id="status-filter"
              value={f.status}
              onChange={(e) => setF((x) => ({ ...x, status: e.target.value as Filters["status"] }))}
              className="h-10 rounded-full border border-line-strong bg-card px-4 text-[0.88rem] focus:border-ink focus:outline-none"
            >
              <option value="all">Any status</option>
              {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="sort-filter">
              Sort
            </label>
            <select
              id="sort-filter"
              value={f.sort}
              onChange={(e) => setF((x) => ({ ...x, sort: e.target.value as Filters["sort"] }))}
              className="h-10 rounded-full border border-line-strong bg-card px-4 text-[0.88rem] focus:border-ink focus:outline-none"
            >
              <option value="recent">Newest first</option>
              <option value="az">A–Z</option>
            </select>
          </div>
        </div>
      </div>

      <div className="shell pt-8">
        <div className="flex items-center justify-between" aria-live="polite">
          <p className="t-meta text-muted">
            Showing {results.length} of {projects.length}
          </p>
          {dirty && (
            <button type="button" onClick={() => setF(DEFAULTS)} className="inline-flex items-center gap-1 text-[0.85rem] text-muted hover:text-ink">
              <X aria-hidden className="size-3.5" /> Clear filters
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-[3px] border border-dashed border-line-strong px-6 py-20 text-center">
            <p className="font-display text-2xl">No projects match those filters.</p>
            <p className="mt-2 max-w-sm text-muted">Try a different category or status, or clear your search.</p>
            <Button className="mt-6" variant="outline" onClick={() => setF(DEFAULTS)}>
              Reset filters
            </Button>
          </div>
        ) : (
          <ul className="mt-6 grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {results.map((p, i) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.5, ease: [0.22, 0.7, 0.12, 1] }}
                >
                  <ProjectCard project={p} priority={i < 3} aspect={i % 3 === 1 ? "aspect-[4/5]" : "aspect-[4/3]"} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw" />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}

/** Live portfolio numbers for the page intro, derived from the same store the admin edits. */
export function ProjectsSummary() {
  const projects = useDB((d) => d.projects);
  const stats: [string, number][] = [
    ["Cities", new Set(projects.map((p) => p.city)).size],
    ["Projects", projects.length],
    ["On site now", projects.filter((p) => p.status === "in-progress").length],
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
