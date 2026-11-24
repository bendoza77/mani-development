"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { useNow } from "@/hooks/useNow";
import { ArrowUpRight, Building2, FilePlus2, Image as ImageIcon, Inbox, Settings, type LucideIcon } from "lucide-react";
import { Panel, PageHeader } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApiData } from "@/hooks/useApiData";
import type { DashboardData, ProjectStatus } from "@/lib/api";
import { STATUS_LABEL, timeAgo } from "@/lib/format";

const ChartSkeleton = () => <div className="h-52 animate-pulse rounded bg-paper-2" />;
const StatusChart = dynamic(() => import("./DashboardCharts").then((m) => m.StatusChart), { ssr: false, loading: ChartSkeleton });
const InquiriesChart = dynamic(() => import("./DashboardCharts").then((m) => m.InquiriesChart), { ssr: false, loading: ChartSkeleton });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Dashboard() {
  const { data, error, reload } = useApiData<DashboardData>("/api/admin/dashboard");
  const now = useNow();

  const statusData = useMemo(
    () => (Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => ({ label: STATUS_LABEL[s], value: data?.projects.byStatus[s] ?? 0 })),
    [data],
  );
  // "2026-11" → "Nov"; the server counts the last six calendar months.
  const monthly = useMemo(
    () => (data?.inquiries.perMonth ?? []).map((m) => ({ label: MONTHS[Number(m.month.slice(5, 7)) - 1] ?? m.month, value: m.count })),
    [data],
  );

  if (error) {
    return (
      <>
        <PageHeader title="Overview" />
        <Panel bodyClassName="px-6 py-14 text-center">
          <p className="text-[0.9rem] text-danger">{error.message}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={reload}>
            Try again
          </Button>
        </Panel>
      </>
    );
  }

  const ps = data?.projects.byStatus;
  const qs = data?.inquiries.byStatus;
  const n = (v: number | undefined) => (data ? (v ?? 0) : "–");
  const recentInquiries = data?.recentInquiries ?? [];
  const recentProjects = data?.recentProjects ?? [];
  const activity = data?.activity ?? [];
  const tiles: { label: string; value: number | string; note: string; href: string }[] = [
    { label: "Total projects", value: n(data?.projects.total), note: `${n(ps?.planning)} in planning`, href: "/admin/projects" },
    { label: "Active projects", value: n(ps?.["in-progress"]), note: "Under construction", href: "/admin/projects?status=in-progress" },
    { label: "Completed", value: n(ps?.completed), note: "Delivered to clients", href: "/admin/projects?status=completed" },
    { label: "Total inquiries", value: n(data?.inquiries.total), note: `${n(qs?.["in-progress"])} in progress`, href: "/admin/inquiries" },
    { label: "New inquiries", value: n(qs?.new), note: qs?.new ? "Awaiting first reply" : "Inbox clear", href: "/admin/inquiries?status=new" },
  ];

  const shortcuts: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Add a project", href: "/admin/projects/new", icon: FilePlus2 },
    { label: "Review inquiries", href: "/admin/inquiries", icon: Inbox },
    { label: "Upload media", href: "/admin/media", icon: ImageIcon },
    { label: "Company settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="Portfolio, pipeline and inbox at a glance."
        actions={
          <ButtonLink href="/admin/projects/new" size="sm">
            New project
          </ButtonLink>
        }
      />

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t, i) => (
          <li key={t.label} className={i === 4 ? "col-span-2 md:col-span-1" : undefined}>
            <Link href={t.href} className="group block h-full rounded-md border border-line bg-card p-4 transition-colors hover:border-line-strong sm:p-5">
              <p className="flex items-center justify-between text-[0.8rem] text-muted">
                {t.label}
                <ArrowUpRight aria-hidden className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
              <p className="mt-3 font-display text-[2.4rem] leading-none tabular-nums">{t.value}</p>
              <p className="mt-2 text-[0.78rem] text-muted">{t.note}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Projects by status" bodyClassName="p-5">
          {data ? <StatusChart data={statusData} /> : <ChartSkeleton />}
        </Panel>
        <Panel title="Inquiries per month" bodyClassName="p-5">
          {data ? <InquiriesChart data={monthly} /> : <ChartSkeleton />}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Recent inquiries"
          className="xl:col-span-2"
          action={
            <Link href="/admin/inquiries" className="text-[0.82rem] text-muted hover:text-ink">
              View all
            </Link>
          }
        >
          {data && recentInquiries.length === 0 && <p className="px-5 py-8 text-center text-[0.85rem] text-muted">No inquiries yet.</p>}
          <ul>
            {recentInquiries.map((q) => (
              <li key={q.id} className="border-b border-line last:border-0">
                <Link href={`/admin/inquiries?id=${q.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper/60">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper-2 text-[0.75rem] font-semibold">
                    {q.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9rem] font-medium">{q.name}</span>
                    <span className="block truncate text-[0.82rem] text-muted">{q.subject}</span>
                  </span>
                  <span className="hidden text-[0.78rem] text-muted sm:block">{now ? timeAgo(q.createdAt, now) : ""}</span>
                  <StatusBadge status={q.status} kind="inquiry" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Shortcuts" bodyClassName="grid grid-cols-2 gap-2 p-3">
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href} className="flex flex-col gap-3 rounded-[3px] border border-line p-4 text-[0.85rem] transition-colors hover:border-ink">
              <s.icon aria-hidden className="size-5 text-accent" strokeWidth={1.6} />
              {s.label}
            </Link>
          ))}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Recent project updates" className="xl:col-span-2">
          <ul>
            {recentProjects.map((p) => (
              <li key={p.id} className="border-b border-line last:border-0">
                <Link href={`/admin/projects/${p.id}/edit`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper/60">
                  <Building2 aria-hidden className="size-4.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9rem] font-medium">{p.title}</span>
                    <span className="block truncate text-[0.82rem] text-muted">{p.location}</span>
                  </span>
                  <span className="hidden w-28 sm:block">
                    <span className="block h-1 overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${p.progress}%` }} />
                    </span>
                    <span className="t-meta mt-1 block text-right text-muted">{p.progress}%</span>
                  </span>
                  <StatusBadge status={p.status} className="max-sm:hidden" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Activity">
          <ol className="max-h-96 overflow-y-auto px-5 py-2">
            {data && activity.length === 0 && <li className="py-6 text-center text-[0.85rem] text-muted">Nothing yet.</li>}
            {activity.slice(0, 12).map((a) => (
              <li key={a.id} className="relative border-l border-line py-2.5 pl-4">
                <span aria-hidden className="absolute top-4 -left-[3.5px] size-1.5 rounded-full bg-accent" />
                <p className="text-[0.85rem]">{a.message}</p>
                <p className="t-meta mt-0.5 text-muted">{now ? timeAgo(a.at, now) : ""}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
