"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { Button } from "@/components/ui/Button";
import { useContent, useLocale, useTranslation } from "@/i18n/client";
import { useDB } from "@/lib/store";
import { CATEGORY_LABEL, STATUS_LABEL, cx } from "@/lib/format";
import type { Project, ProjectCategory, ProjectStatus } from "@/lib/types";

type Sort = "houses" | "recent" | "az";
type Filters = { category: ProjectCategory | "all"; status: ProjectStatus | "all"; q: string; sort: Sort };
const DEFAULTS: Filters = { category: "all", status: "all", q: "", sort: "houses" };
const SORTS = new Set<Sort>(["houses", "recent", "az"]);
const KEY = "lintel:project-filters";

export function ProjectsExplorer() {
  const { t } = useTranslation("projects");
  const { t: tc } = useTranslation("common");
  const locale = useLocale();
  const content = useContent();
  const stored = useDB((d) => d.projects);
  // Localized copies, so search and A–Z sorting work on the text the visitor actually sees.
  const projects = useMemo(() => stored.map(content.project), [stored, content]);
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [restored, setRestored] = useState(false);

  // Filters persist for the browsing session.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore session filters after hydration
      if (saved && typeof saved === "object") setF({ ...DEFAULTS, ...saved, sort: SORTS.has(saved.sort) ? saved.sort : DEFAULTS.sort });
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
    const byDate = (a: Project, b: Project) =>
      (b.completionDate ?? b.estimatedCompletion).localeCompare(a.completionDate ?? a.estimatedCompletion);
    if (f.sort === "az") return [...list].sort((a, b) => a.title.localeCompare(b.title, locale));
    if (f.sort === "recent") return [...list].sort(byDate);
    // Default: the company's core work (private houses) first, each group newest first.
    const house = (p: Project) => (p.category === "residential" ? 0 : 1);
    return [...list].sort((a, b) => house(a) - house(b) || byDate(a, b));
  }, [projects, f, locale]);

  const dirty = f.category !== "all" || f.status !== "all" || f.q !== "";
  const categories: (ProjectCategory | "all")[] = ["all", ...(Object.keys(CATEGORY_LABEL) as ProjectCategory[])];

  return (
    <section className="pb-[clamp(4.5rem,10vw,8rem)]" aria-label={t("explorer.label")}>
      <div className="z-20 border-y border-line bg-paper lg:sticky-under-header">
        <div className="shell flex flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="no-scrollbar -mx-(--gutter) flex gap-1 overflow-x-auto px-(--gutter) xl:mx-0 xl:px-0" role="group" aria-label={t("explorer.filterByCategory")}>
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
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <label className="relative col-span-2 sm:w-64">
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
            <label className="sr-only" htmlFor="status-filter">
              {t("explorer.status")}
            </label>
            <select
              id="status-filter"
              value={f.status}
              onChange={(e) => setF((x) => ({ ...x, status: e.target.value as Filters["status"] }))}
              className="h-10 rounded-full border border-line-strong bg-card px-4 text-[0.88rem] focus:border-ink focus:outline-none"
            >
              <option value="all">{t("explorer.anyStatus")}</option>
              {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {tc(`status.${s}`)}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="sort-filter">
              {t("explorer.sort")}
            </label>
            <select
              id="sort-filter"
              value={f.sort}
              onChange={(e) => setF((x) => ({ ...x, sort: e.target.value as Filters["sort"] }))}
              className="h-10 rounded-full border border-line-strong bg-card px-4 text-[0.88rem] focus:border-ink focus:outline-none"
            >
              <option value="houses">{t("explorer.sortHouses")}</option>
              <option value="recent">{t("explorer.sortRecent")}</option>
              <option value="az">{t("explorer.sortAz")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="shell pt-8">
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

        {results.length === 0 ? (
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

/** Live portfolio numbers for the page intro, derived from the same store the admin edits. */
export function ProjectsSummary() {
  const { t } = useTranslation("projects");
  const projects = useDB((d) => d.projects);
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
