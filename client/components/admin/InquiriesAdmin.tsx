"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useNow } from "@/hooks/useNow";
import { ArrowLeft, ChevronLeft, ChevronRight, Inbox, Mail, Phone, Search, Trash2 } from "lucide-react";
import { EmptyState, FilterTabs, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { useDebounced } from "@/hooks/useDebounced";
import { announceAdminChange, api, errorMessage, type InquiryDetail as Detail, type InquiryList, type InquiryNote, type InquiryStatus } from "@/lib/api";
import { INQUIRY_STATUS_LABEL, cx, formatDate, timeAgo } from "@/lib/format";

const STATUSES = Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[];
const PAGE_SIZE = 20;

export function InquiriesAdmin() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const selectedId = params.get("id");
  const statusParam = params.get("status") as InquiryStatus | null;
  const status: InquiryStatus | "all" = statusParam && STATUSES.includes(statusParam) ? statusParam : "all";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Detail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const now = useNow();
  const term = useDebounced(q.trim(), 300);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status !== "all") query.set("status", status);
  if (term) query.set("q", term);
  const list = useApiData<InquiryList>(`/api/admin/inquiries?${query}`);
  const detail = useApiData<Detail>(selectedId ? `/api/admin/inquiries/${selectedId}` : null);

  // The list keeps showing while the next page or filter loads.
  const [shown, setShown] = useState<InquiryList | null>(null);
  if (list.data && list.data !== shown) setShown(list.data);
  const data = list.data ?? shown;
  const rows = data?.items ?? [];
  const counts = data?.counts;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const url = (next: { id?: string | null; status?: InquiryStatus | "all" }) => {
    const s = next.status ?? status;
    const id = next.id === undefined ? selectedId : next.id;
    const p = new URLSearchParams();
    if (s !== "all") p.set("status", s);
    if (id) p.set("id", id);
    const qs = p.toString();
    return qs ? `/admin/inquiries?${qs}` : "/admin/inquiries";
  };
  const select = (id: string | null) => router.replace(url({ id }), { scroll: false });
  const setStatus = (s: InquiryStatus | "all") => {
    setPage(1);
    router.replace(url({ status: s }), { scroll: false });
  };

  const selected = detail.data && detail.data.id === selectedId ? detail.data : null;

  async function changeStatus(i: Detail, next: InquiryStatus) {
    try {
      const updated = await api<Detail>(`/api/admin/inquiries/${i.id}`, { method: "PATCH", body: { status: next } });
      detail.update(() => updated);
      list.reload();
      announceAdminChange();
      toast({ tone: "success", title: "Status updated", body: `${i.name}: ${INQUIRY_STATUS_LABEL[next]}` });
    } catch (error) {
      toast({ tone: "error", title: "Could not update status", body: errorMessage(error) });
    }
  }

  async function remove(i: Detail) {
    setDeleting(true);
    try {
      await api(`/api/admin/inquiries/${i.id}`, { method: "DELETE" });
      toast({ tone: "success", title: "Inquiry deleted" });
      setToDelete(null);
      select(null);
      list.reload();
      announceAdminChange();
    } catch (error) {
      toast({ tone: "error", title: "Could not delete", body: errorMessage(error) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader title="Inquiries" description="Messages sent through the website contact form." />
      <div className="grid overflow-hidden rounded-md border border-line bg-card lg:h-[calc(100dvh-14rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        {/* List */}
        <div className={cx("flex min-h-0 flex-col border-line lg:border-r", selectedId && "max-lg:hidden")}>
          <div className="space-y-2 border-b border-line p-3">
            <label className="relative block">
              <span className="sr-only">Search inquiries</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, subject, message"
                className="h-9 w-full rounded-[3px] border border-line-strong bg-card pr-3 pl-9 text-[0.85rem] focus:border-ink focus:outline-none"
              />
            </label>
            <FilterTabs
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "All", count: counts?.all }, ...STATUSES.map((s) => ({ value: s, label: INQUIRY_STATUS_LABEL[s], count: counts?.[s] }))]}
            />
          </div>
          {list.error && !data ? (
            <div className="px-6 py-14 text-center">
              <p className="text-[0.9rem] text-danger">{list.error.message}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={list.reload}>
                Try again
              </Button>
            </div>
          ) : !data ? (
            <div className="h-64 animate-pulse bg-paper-2/50" aria-busy="true" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={term || status !== "all" ? "No matching inquiries" : "Inbox empty"}
              body={term || status !== "all" ? "Adjust the search or status filter." : "Messages from the contact form will appear here."}
            />
          ) : (
            <>
              <ul className={cx("min-h-0 flex-1 overflow-y-auto", list.loading && "opacity-60")} aria-label="Inquiries" aria-busy={list.loading}>
                {rows.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => select(i.id)}
                      aria-current={i.id === selectedId ? "true" : undefined}
                      className={cx("block w-full border-b border-line px-4 py-3.5 text-left transition-colors", i.id === selectedId ? "bg-paper-2" : "hover:bg-paper/60")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={cx("truncate text-[0.9rem]", i.status === "new" ? "font-semibold" : "font-medium")}>
                          {i.status === "new" && <span aria-hidden className="mr-2 inline-block size-1.5 rounded-full bg-accent align-middle" />}
                          {i.name}
                        </span>
                        <span className="t-meta shrink-0 text-muted">{now ? timeAgo(i.createdAt, now) : ""}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.85rem]">{i.subject}</span>
                      <span className="mt-0.5 block truncate text-[0.8rem] text-muted">{i.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
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
            </>
          )}
        </div>

        {/* Detail */}
        <div className={cx("min-h-0 overflow-y-auto", !selectedId && "max-lg:hidden")}>
          {!selectedId ? (
            <EmptyState icon={Mail} title="Select an inquiry" body="Choose a message from the list to read it, update its status and add internal notes." />
          ) : detail.error ? (
            <div className="p-5 sm:p-7">
              <button type="button" onClick={() => select(null)} className="-ml-1 mb-4 inline-flex items-center gap-1.5 text-[0.85rem] text-muted hover:text-ink lg:hidden">
                <ArrowLeft aria-hidden className="size-4" /> All inquiries
              </button>
              <p className="text-[0.9rem] text-danger">{detail.error.status === 404 ? "This inquiry no longer exists." : detail.error.message}</p>
            </div>
          ) : !selected ? (
            <div className="m-6 h-64 animate-pulse rounded bg-paper-2/50" aria-busy="true" />
          ) : (
            <InquiryDetail
              key={selected.id}
              inquiry={selected}
              onBack={() => select(null)}
              onDelete={() => setToDelete(selected)}
              onStatus={(s) => void changeStatus(selected, s)}
              onNotes={(notes) => detail.update((d) => ({ ...d, notes }))}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this inquiry?"
        description={`The message from ${toDelete?.name ?? ""} and its notes will be permanently removed.`}
        confirmLabel="Delete inquiry"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}

function InquiryDetail({
  inquiry: i,
  onBack,
  onDelete,
  onStatus,
  onNotes,
}: {
  inquiry: Detail;
  onBack: () => void;
  onDelete: () => void;
  onStatus: (s: InquiryStatus) => void;
  onNotes: (notes: InquiryNote[]) => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function addNote(e: FormEvent) {
    e.preventDefault();
    const text = note.trim();
    if (!text) {
      setNoteError("Write something before adding a note.");
      return;
    }
    if (text.length > 2000) {
      setNoteError("Keep notes under 2000 characters.");
      return;
    }
    setAdding(true);
    try {
      const created = await api<InquiryNote>(`/api/admin/inquiries/${i.id}/notes`, { method: "POST", body: { text } });
      onNotes([...i.notes, created]);
      setNote("");
      setNoteError(null);
    } catch (error) {
      setNoteError(errorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  async function removeNote(n: InquiryNote) {
    try {
      await api(`/api/admin/inquiries/${i.id}/notes/${n.id}`, { method: "DELETE" });
      onNotes(i.notes.filter((x) => x.id !== n.id));
    } catch (error) {
      toast({ tone: "error", title: "Could not remove note", body: errorMessage(error) });
    }
  }

  return (
    <article className="p-5 sm:p-7">
      <button type="button" onClick={onBack} className="-ml-1 mb-4 inline-flex items-center gap-1.5 text-[0.85rem] text-muted hover:text-ink lg:hidden">
        <ArrowLeft aria-hidden className="size-4" /> All inquiries
      </button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <StatusBadge status={i.status} kind="inquiry" />
          <h2 className="mt-3 font-display text-2xl leading-tight">{i.subject}</h2>
          <p className="t-meta mt-2 text-muted">Received {formatDate(i.createdAt)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
          <Trash2 aria-hidden className="size-4" /> Delete
        </Button>
      </div>

      <dl className="mt-6 grid gap-3 rounded-[3px] border border-line p-4 text-[0.88rem] sm:grid-cols-3">
        <div>
          <dt className="t-meta text-muted">From</dt>
          <dd className="mt-1 font-medium">{i.name}</dd>
        </div>
        <div className="min-w-0">
          <dt className="t-meta text-muted">Email</dt>
          <dd className="mt-1 truncate">
            <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1.5 hover:text-accent">
              <Mail aria-hidden className="size-3.5 shrink-0" />
              {i.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="t-meta text-muted">Phone</dt>
          <dd className="mt-1">
            {i.phone ? (
              <a href={`tel:${i.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                <Phone aria-hidden className="size-3.5" />
                {i.phone}
              </a>
            ) : (
              <span className="text-muted">Not provided</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 text-[0.95rem] leading-relaxed whitespace-pre-line">{i.message}</div>

      <div className="mt-8">
        <p className="t-meta mb-2 text-muted" id="status-label">
          Status
        </p>
        <div role="radiogroup" aria-labelledby="status-label" className="inline-grid grid-cols-3 gap-1 rounded-[3px] bg-paper-2 p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={i.status === s}
              onClick={() => i.status !== s && onStatus(s)}
              className={cx("h-9 rounded-[2px] px-3 text-[0.82rem] sm:px-4", i.status === s ? "bg-card font-medium shadow-sm" : "text-muted hover:text-ink")}
            >
              {INQUIRY_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-8 border-t border-line pt-6" aria-labelledby="notes-h">
        <h3 id="notes-h" className="text-[0.95rem] font-semibold">
          Internal notes <span className="font-normal text-muted">· {i.notes.length}</span>
        </h3>
        <p className="mt-0.5 text-[0.82rem] text-muted">Only visible to the studio team.</p>
        {i.notes.length > 0 && (
          <ol className="mt-4 space-y-3">
            {i.notes.map((n) => (
              <li key={n.id} className="group rounded-[3px] bg-warn-soft/60 px-4 py-3 text-[0.88rem]">
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-line">{n.text}</p>
                  <button type="button" onClick={() => void removeNote(n)} className="shrink-0 text-[0.75rem] text-muted hover:text-danger" aria-label="Delete note">
                    Remove
                  </button>
                </div>
                <p className="t-meta mt-1.5 text-muted">{formatDate(n.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={addNote} className="mt-4" noValidate>
          <label htmlFor="note" className="sr-only">
            Add a note
          </label>
          <textarea
            id="note"
            rows={3}
            value={note}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? "note-err" : undefined}
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError) setNoteError(null);
            }}
            placeholder="Add a note, e.g. called back, site visit booked…"
            className="w-full rounded-[3px] border border-line-strong bg-card px-3.5 py-2.5 text-[0.9rem] focus:border-ink focus:outline-none aria-invalid:border-danger"
          />
          {noteError && (
            <p id="note-err" role="alert" className="mt-1 text-[0.8rem] text-danger">
              {noteError}
            </p>
          )}
          <Button type="submit" size="sm" variant="outline" className="mt-2" loading={adding}>
            Add note
          </Button>
        </form>
      </section>
    </article>
  );
}
