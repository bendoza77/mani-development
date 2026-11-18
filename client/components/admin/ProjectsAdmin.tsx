"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Building2, ExternalLink, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { EmptyState, FilterTabs, IconButton, PageHeader, Panel, SortHeader, rowClass, tableClass, theadClass, type SortDir } from "@/components/admin/ui";
import { ButtonLink, Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Img } from "@/components/ui/Img";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { nowISO, projectsDB, useDB } from "@/lib/store";
import { CATEGORY_LABEL, STATUS_LABEL, cx, formatDate } from "@/lib/format";
import type { Project, ProjectCategory, ProjectStatus } from "@/lib/types";

type SortKey = "title" | "status" | "progress" | "updatedAt";
const STATUSES = Object.keys(STATUS_LABEL) as ProjectStatus[];

export function ProjectsAdmin() {
  const projects = useDB((d) => d.projects);
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const statusParam = params.get("status") as ProjectStatus | null;
  const status: ProjectStatus | "all" = statusParam && STATUSES.includes(statusParam) ? statusParam : "all";
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<ProjectCategory | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "updatedAt", dir: "desc" });
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const setStatus = (s: ProjectStatus | "all") => router.replace(s === "all" ? "/admin/projects" : `/admin/projects?status=${s}`, { scroll: false });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = projects.filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (category === "all" || p.category === category) &&
        (!s || `${p.title} ${p.location} ${p.slug}`.toLowerCase().includes(s)),
    );
    const order = { planning: 0, "in-progress": 1, "on-hold": 2, completed: 3 };
    const cmp = (a: Project, b: Project) => {
      switch (sort.key) {
        case "title":
          return a.title.localeCompare(b.title);
        case "status":
          return order[a.status] - order[b.status];
        case "progress":
          return a.progress - b.progress;
        default:
          return a.updatedAt.localeCompare(b.updatedAt);
      }
    };
    return [...list].sort((a, b) => (sort.dir === "asc" ? cmp(a, b) : -cmp(a, b)));
  }, [projects, q, status, category, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const changeStatus = (p: Project, next: ProjectStatus) => {
    projectsDB.update(
      p.id,
      { status: next, progress: next === "completed" ? 100 : p.progress, updatedAt: nowISO() },
      `${p.title} marked ${STATUS_LABEL[next].toLowerCase()}`,
    );
    toast({ tone: "success", title: "Status updated", body: `${p.title}: ${STATUS_LABEL[next]}` });
  };

  const toggleFeatured = (p: Project) => {
    projectsDB.update(p.id, { featured: !p.featured, updatedAt: nowISO() }, `${p.title} ${p.featured ? "removed from" : "featured on"} the homepage`);
    toast({ tone: "info", title: p.featured ? "Removed from homepage" : "Featured on homepage", body: p.title });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Everything here drives the public Projects pages and the homepage selection."
        actions={
          <ButtonLink href="/admin/projects/new" size="sm">
            <Plus aria-hidden className="size-4" /> New project
          </ButtonLink>
        }
      />

      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[{ value: "all", label: "All", count: counts.all }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: counts[s] ?? 0 }))]}
          />
          <div className="flex gap-2">
            <label className="relative flex-1 lg:w-60">
              <span className="sr-only">Search projects</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, place, slug"
                className="h-9 w-full rounded-[3px] border border-line-strong bg-card pr-3 pl-9 text-[0.85rem] focus:border-ink focus:outline-none"
              />
            </label>
            <label className="sr-only" htmlFor="cat">
              Category
            </label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProjectCategory | "all")}
              className="h-9 rounded-[3px] border border-line-strong bg-card px-3 text-[0.85rem] focus:border-ink focus:outline-none"
            >
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_LABEL) as ProjectCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={projects.length ? "No projects match" : "No projects yet"}
            body={projects.length ? "Try another status, category or search term." : "Create your first project to publish it on the website."}
            action={
              projects.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setCategory("all");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <ButtonLink href="/admin/projects/new" size="sm">
                  New project
                </ButtonLink>
              )
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className={tableClass}>
                <caption className="sr-only">Projects, sortable by column</caption>
                <thead className={theadClass}>
                  <tr>
                    <SortHeader label="Project" active={sort.key === "title"} dir={sort.dir} onClick={() => toggleSort("title")} />
                    <th scope="col" className="px-4 py-3 text-left font-medium max-xl:hidden">Category</th>
                    <SortHeader label="Status" active={sort.key === "status"} dir={sort.dir} onClick={() => toggleSort("status")} />
                    <SortHeader label="Progress" active={sort.key === "progress"} dir={sort.dir} onClick={() => toggleSort("progress")} />
                    <SortHeader label="Updated" active={sort.key === "updatedAt"} dir={sort.dir} onClick={() => toggleSort("updatedAt")} className="max-lg:hidden" />
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className={rowClass}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative size-11 shrink-0 overflow-hidden rounded-[3px]">
                            <Img src={p.cover} alt="" sizes="44px" />
                          </div>
                          <div className="min-w-0">
                            <Link href={`/admin/projects/${p.id}/edit`} className="block truncate font-medium hover:text-accent">
                              {p.title}
                            </Link>
                            <span className="block truncate text-[0.8rem] text-muted">{p.location}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-soft max-xl:hidden">{CATEGORY_LABEL[p.category]}</td>
                      <td className="px-4 py-3">
                        <StatusSelect project={p} onChange={changeStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-1 w-16 overflow-hidden rounded-full bg-line">
                            <span className="block h-full rounded-full bg-ink" style={{ width: `${p.progress}%` }} />
                          </span>
                          <span className="tabular-nums text-muted">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted max-lg:hidden">{formatDate(p.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <RowActions project={p} onFeature={toggleFeatured} onDelete={setToDelete} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((p) => (
                <li key={p.id} className="p-4">
                  <div className="flex gap-3">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-[3px]">
                      <Img src={p.cover} alt="" sizes="64px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/projects/${p.id}/edit`} className="block truncate font-medium">
                        {p.title}
                      </Link>
                      <p className="truncate text-[0.8rem] text-muted">
                        {p.location} · {CATEGORY_LABEL[p.category]}
                      </p>
                      <div className="mt-2">
                        <StatusSelect project={p} onChange={changeStatus} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="t-meta text-muted">
                      {p.progress}% · {formatDate(p.updatedAt)}
                    </span>
                    <RowActions project={p} onFeature={toggleFeatured} onDelete={setToDelete} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete "${toDelete?.title}"?`}
        description="The project will be removed from the website and the admin. This cannot be undone (except by resetting demo data)."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (!toDelete) return;
          projectsDB.remove(toDelete.id, `${toDelete.title} deleted`);
          toast({ tone: "success", title: "Project deleted", body: toDelete.title });
          setToDelete(null);
        }}
      />
    </>
  );
}

function StatusSelect({ project, onChange }: { project: Project; onChange: (p: Project, s: ProjectStatus) => void }) {
  return (
    <div className="relative inline-flex">
      <StatusBadge status={project.status} className="pointer-events-none pr-6" />
      <label className="sr-only" htmlFor={`st-${project.id}`}>
        Change status for {project.title}
      </label>
      <select
        id={`st-${project.id}`}
        value={project.status}
        onChange={(e) => onChange(project, e.target.value as ProjectStatus)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[0.55rem] opacity-60">
        ▼
      </span>
    </div>
  );
}

function RowActions({ project: p, onFeature, onDelete }: { project: Project; onFeature: (p: Project) => void; onDelete: (p: Project) => void }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        onClick={() => onFeature(p)}
        aria-pressed={p.featured}
        aria-label={p.featured ? `Unfeature ${p.title}` : `Feature ${p.title} on homepage`}
        title={p.featured ? "Featured on homepage" : "Feature on homepage"}
        className={cx("grid size-9 place-items-center rounded-[3px] hover:bg-paper-2", p.featured ? "text-accent" : "text-muted")}
      >
        <Star aria-hidden className={cx("size-4", p.featured && "fill-current")} />
      </button>
      <Link href={`/projects/${p.slug}`} target="_blank" className="grid size-9 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink" aria-label={`View ${p.title} on website (new tab)`} title="View on website">
        <ExternalLink aria-hidden className="size-4" />
      </Link>
      <Link href={`/admin/projects/${p.id}/edit`} className="grid size-9 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink" aria-label={`Edit ${p.title}`} title="Edit">
        <Pencil aria-hidden className="size-4" />
      </Link>
      <IconButton label={`Delete ${p.title}`} icon={Trash2} tone="danger" onClick={() => onDelete(p)} />
    </div>
  );
}
