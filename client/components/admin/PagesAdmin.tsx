"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, FileText, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, IconButton, PageHeader, Panel, rowClass, tableClass, theadClass } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, type PageSummary } from "@/lib/api";
import { cx, formatDate } from "@/lib/format";

/** Where a page lives on the public website. Built-in pages keep their fixed addresses. */
export function publicPathOf(page: Pick<PageSummary, "kind" | "systemKey" | "slug">): string {
  if (page.kind === "system") return page.systemKey === "home" ? "/" : `/${page.systemKey}`;
  return `/${page.slug}`;
}

export function PagesAdmin() {
  const toast = useToast();
  const { data, error, reload, update } = useApiData<{ items: PageSummary[] }>("/api/admin/pages");
  const [toDelete, setToDelete] = useState<PageSummary | null>(null);
  const pages = data?.items ?? null;

  async function remove(page: PageSummary) {
    try {
      await api(`/api/admin/pages/${page.id}`, { method: "DELETE" });
      update((d) => ({ items: d.items.filter((p) => p.id !== page.id) }));
      toast({ tone: "success", title: "Page deleted", body: page.titleKa });
    } catch (err) {
      toast({ tone: "error", title: "Could not delete", body: err instanceof Error ? err.message : page.titleKa });
    }
  }

  return (
    <>
      <PageHeader
        title="Pages"
        description="Built-in pages (home, projects, services, about, contact) and your own pages. Published custom pages appear at their own address."
        actions={
          <ButtonLink href="/admin/pages/new" size="sm">
            <Plus aria-hidden className="size-4" /> New page
          </ButtonLink>
        }
      />
      <Panel>
        {error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[0.9rem] text-danger">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={reload}>
              Try again
            </Button>
          </div>
        ) : pages === null ? (
          <div className="h-64 animate-pulse bg-paper-2/50" aria-busy="true" />
        ) : pages.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No pages yet"
            body="Create a page, add headings, text and images, then publish it."
            action={
              <ButtonLink href="/admin/pages/new" size="sm">
                New page
              </ButtonLink>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <caption className="sr-only">Pages</caption>
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Page</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium max-sm:hidden">Address</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium max-md:hidden">Menu</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium max-lg:hidden">Updated</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id} className={rowClass}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/pages/${p.id}/edit`} className="font-medium hover:text-accent">
                        {p.titleKa}
                      </Link>
                      {p.titleEn && <span className="block text-[0.8rem] text-muted">{p.titleEn}</span>}
                      {p.kind === "system" && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[0.72rem] text-muted">
                          <Lock aria-hidden className="size-3" /> Built-in
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.8rem] text-muted max-sm:hidden">{publicPathOf(p)}</td>
                    <td className="px-4 py-3">
                      <span className={cx("rounded-full px-2.5 py-1 text-[0.75rem]", p.isPublished ? "bg-ok-soft text-ok" : "bg-paper-2 text-muted")}>
                        {p.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-md:hidden">
                      {p.inHeader || p.inFooter ? (
                        <span className="flex flex-wrap gap-1">
                          {p.inHeader && <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.72rem] text-ink-soft">Top</span>}
                          {p.inFooter && <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.72rem] text-ink-soft">Footer</span>}
                        </span>
                      ) : (
                        <span className="text-[0.8rem] text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted max-lg:hidden">{formatDate(p.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {p.isPublished && (
                          <Link
                            href={publicPathOf(p)}
                            target="_blank"
                            className="grid size-9 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink"
                            aria-label={`View ${p.titleKa} on website (new tab)`}
                            title="View on website"
                          >
                            <ExternalLink aria-hidden className="size-4" />
                          </Link>
                        )}
                        <Link
                          href={`/admin/pages/${p.id}/edit`}
                          className="grid size-9 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink"
                          aria-label={`Edit ${p.titleKa}`}
                          title="Edit"
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Link>
                        {p.kind === "custom" && <IconButton label={`Delete ${p.titleKa}`} icon={Trash2} tone="danger" onClick={() => setToDelete(p)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete "${toDelete?.titleKa}"?`}
        description="The page and its menu links will be removed from the website. This cannot be undone."
        confirmLabel="Delete page"
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
          setToDelete(null);
        }}
      />
    </>
  );
}
