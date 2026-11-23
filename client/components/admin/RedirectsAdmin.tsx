"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Search, Signpost, Trash2 } from "lucide-react";
import { LoadError, without } from "@/components/admin/parts";
import { EmptyState, IconButton, PageHeader, Panel, rowClass, tableClass, theadClass } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { useDebounced } from "@/hooks/useDebounced";
import { api, errorMessage, fieldErrorsFrom, type AdminRedirect, type RedirectList } from "@/lib/api";
import { cx, formatDate } from "@/lib/format";

const PAGE_SIZE = 50;
const PATH = /^\/(?!\/)[^\s?#]*$/;

/** What people paste: a full address of this site, or a path. The API wants the path only. */
function cleanPath(input: string): string {
  let v = input.trim();
  try {
    if (/^https?:\/\//i.test(v)) v = new URL(v).pathname;
  } catch {
    /* not a full address: keep as typed */
  }
  if (v && !v.startsWith("/")) v = `/${v}`;
  return v.length > 1 ? v.replace(/\/+$/, "") : v;
}

function checkPath(v: string): string | undefined {
  if (!v) return "Required.";
  if (v.length > 300) return "At most 300 characters.";
  if (!PATH.test(v) || v.includes("//")) return "Use a site path starting with /, e.g. /old-page (no spaces, ? or #).";
  return undefined;
}

export function RedirectsAdmin() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const term = useDebounced(q.trim(), 300);
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (term) query.set("q", term);
  const { data, error, reload, loading } = useApiData<RedirectList>(`/api/admin/redirects?${query}`);
  const [shown, setShown] = useState<RedirectList | null>(null);
  if (data && data !== shown) setShown(data);
  const list = data ?? shown;
  const pages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<AdminRedirect | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const fromPath = cleanPath(from);
    const toPath = cleanPath(to);
    const found: Record<string, string> = {};
    const fe = checkPath(fromPath);
    const te = checkPath(toPath);
    if (fe) found.fromPath = fe;
    if (te) found.toPath = te;
    if (!fe && !te && fromPath === toPath) found.toPath = "Must be different from the old address.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setAdding(true);
    try {
      await api<AdminRedirect>("/api/admin/redirects", { method: "POST", body: { fromPath, toPath } });
      toast({ tone: "success", title: "Redirect added", body: `${fromPath} → ${toPath}` });
      setFrom("");
      setTo("");
      setQ("");
      setPage(1);
      reload();
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      setErrors(Object.keys(fields).length ? fields : { general: errorMessage(err) });
    } finally {
      setAdding(false);
    }
  }

  async function remove(r: AdminRedirect) {
    setDeleting(true);
    try {
      await api(`/api/admin/redirects/${r.id}`, { method: "DELETE" });
      toast({ tone: "success", title: "Redirect removed", body: r.fromPath });
      setToDelete(null);
      reload();
    } catch (err) {
      toast({ tone: "error", title: "Could not remove", body: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Send visitors from an old address to a new one, e.g. after a page was renamed. Renaming a published project or page adds its redirect automatically. Addresses work for both languages."
      />

      <Panel title="Add a redirect" bodyClassName="p-5">
        <form onSubmit={add} noValidate className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr_auto]">
          {errors.general && (
            <p role="alert" className="rounded-[3px] bg-danger-soft px-3.5 py-2.5 text-[0.88rem] text-danger md:col-span-4">
              {errors.general}
            </p>
          )}
          <Field label="Old address" required error={errors.fromPath} hint="A path on this site that no longer exists.">
            {(a) => (
              <Input
                {...a}
                value={from}
                placeholder="/old-page"
                onChange={(e) => {
                  setFrom(e.target.value);
                  setErrors((x) => without(without(x, "fromPath"), "general"));
                }}
              />
            )}
          </Field>
          <ArrowRight aria-hidden className="mt-10 hidden size-4 text-muted md:block" />
          <Field label="New address" required error={errors.toPath} hint="Where visitors should land.">
            {(a) => (
              <Input
                {...a}
                value={to}
                placeholder="/new-page"
                onChange={(e) => {
                  setTo(e.target.value);
                  setErrors((x) => without(without(x, "toPath"), "general"));
                }}
              />
            )}
          </Field>
          <Button type="submit" size="sm" loading={adding} className="md:mt-7.5">
            Add redirect
          </Button>
        </form>
      </Panel>

      <Panel className="mt-6">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="px-1 text-[0.85rem] text-muted">{list ? `${list.total} redirect${list.total === 1 ? "" : "s"}` : "Loading…"}</p>
          <label className="relative sm:w-64">
            <span className="sr-only">Search redirects</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search addresses"
              className="h-9 w-full rounded-[3px] border border-line-strong bg-card pr-3 pl-9 text-[0.85rem] focus:border-ink focus:outline-none"
            />
          </label>
        </div>
        {error && !list ? (
          <LoadError message={error.message} onRetry={reload} />
        ) : !list ? (
          <div className="h-48 animate-pulse bg-paper-2/50" aria-busy="true" />
        ) : list.items.length === 0 ? (
          <EmptyState icon={Signpost} title={term ? "No matching redirects" : "No redirects yet"} body={term ? "Try another search." : "Add one above when an address changes."} />
        ) : (
          <div className={cx("overflow-x-auto", loading && "opacity-60")}>
            <table className={tableClass}>
              <caption className="sr-only">Redirects</caption>
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Old address
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    New address
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium max-sm:hidden">
                    Added
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((r) => (
                  <tr key={r.id} className={rowClass}>
                    <td className="px-4 py-2.5 font-mono text-[0.82rem] break-all">{r.fromPath}</td>
                    <td className="px-4 py-2.5 font-mono text-[0.82rem] break-all">{r.toPath}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted max-sm:hidden">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        <IconButton label={`Remove redirect from ${r.fromPath}`} icon={Trash2} tone="danger" onClick={() => setToDelete(r)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[0.82rem]">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft aria-hidden className="size-4" /> Newer
            </Button>
            <span className="text-muted tabular-nums">
              Page {page} of {pages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Older <ChevronRight aria-hidden className="size-4" />
            </Button>
          </nav>
        )}
      </Panel>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Remove this redirect?"
        description={`Visitors to ${toDelete?.fromPath ?? ""} will see "page not found" instead of being sent to ${toDelete?.toPath ?? ""}.`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}
