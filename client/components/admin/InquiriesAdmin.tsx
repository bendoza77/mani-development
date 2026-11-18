"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useNow } from "@/hooks/useNow";
import { ArrowLeft, Inbox, Mail, Phone, Search, Trash2 } from "lucide-react";
import { EmptyState, FilterTabs, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { inquiriesDB, nowISO, uid, useDB } from "@/lib/store";
import { INQUIRY_STATUS_LABEL, cx, formatDate, timeAgo } from "@/lib/format";
import type { Inquiry, InquiryStatus } from "@/lib/types";

const STATUSES = Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[];

export function InquiriesAdmin() {
  const inquiries = useDB((d) => d.inquiries);
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const selectedId = params.get("id");
  const statusParam = params.get("status") as InquiryStatus | null;
  const [status, setStatus] = useState<InquiryStatus | "all">(statusParam && STATUSES.includes(statusParam) ? statusParam : "all");
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<Inquiry | null>(null);
  const now = useNow();

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...inquiries]
      .filter((i) => (status === "all" || i.status === status) && (!s || `${i.name} ${i.email} ${i.subject} ${i.message}`.toLowerCase().includes(s)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [inquiries, q, status]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inquiries.length };
    for (const i of inquiries) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [inquiries]);

  const selected = inquiries.find((i) => i.id === selectedId) ?? null;
  const select = (id: string | null) => router.replace(id ? `/admin/inquiries?id=${id}` : "/admin/inquiries", { scroll: false });

  return (
    <>
      <PageHeader title="Inquiries" description="Messages sent through the website contact form (stored locally in this browser)." />
      <div className="grid overflow-hidden rounded-md border border-line bg-card lg:h-[calc(100dvh-14rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        {/* List */}
        <div className={cx("flex min-h-0 flex-col border-line lg:border-r", selected && "max-lg:hidden")}>
          <div className="space-y-2 border-b border-line p-3">
            <label className="relative block">
              <span className="sr-only">Search inquiries</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, subject"
                className="h-9 w-full rounded-[3px] border border-line-strong bg-card pr-3 pl-9 text-[0.85rem] focus:border-ink focus:outline-none"
              />
            </label>
            <FilterTabs
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "All", count: counts.all }, ...STATUSES.map((s) => ({ value: s, label: INQUIRY_STATUS_LABEL[s], count: counts[s] ?? 0 }))]}
            />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Inbox} title={inquiries.length ? "No matching inquiries" : "Inbox empty"} body={inquiries.length ? "Adjust the search or status filter." : "Messages from the contact form will appear here."} />
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Inquiries">
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
          )}
        </div>

        {/* Detail */}
        <div className={cx("min-h-0 overflow-y-auto", !selected && "max-lg:hidden")}>
          {selected ? (
            <InquiryDetail
              key={selected.id}
              inquiry={selected}
              onBack={() => select(null)}
              onDelete={() => setToDelete(selected)}
              onStatus={(s) => {
                inquiriesDB.update(selected.id, { status: s }, `Inquiry from ${selected.name} marked ${INQUIRY_STATUS_LABEL[s].toLowerCase()}`);
                toast({ tone: "success", title: "Status updated", body: `${selected.name}: ${INQUIRY_STATUS_LABEL[s]}` });
              }}
            />
          ) : (
            <EmptyState icon={Mail} title="Select an inquiry" body="Choose a message from the list to read it, update its status and add internal notes." />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this inquiry?"
        description={`The message from ${toDelete?.name ?? ""} and its notes will be permanently removed.`}
        confirmLabel="Delete inquiry"
        onConfirm={() => {
          if (!toDelete) return;
          inquiriesDB.remove(toDelete.id, `Inquiry from ${toDelete.name} deleted`);
          toast({ tone: "success", title: "Inquiry deleted" });
          setToDelete(null);
          select(null);
        }}
      />
    </>
  );
}

function InquiryDetail({ inquiry: i, onBack, onDelete, onStatus }: { inquiry: Inquiry; onBack: () => void; onDelete: () => void; onStatus: (s: InquiryStatus) => void }) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const addNote = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setNoteError("Write something before adding a note.");
      return;
    }
    inquiriesDB.update(i.id, { notes: [...i.notes, { id: uid("n"), text: note.trim(), createdAt: nowISO() }] }, `Note added to ${i.name}'s inquiry`);
    setNote("");
    setNoteError(null);
  };

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
                  <button
                    type="button"
                    onClick={() => inquiriesDB.update(i.id, { notes: i.notes.filter((x) => x.id !== n.id) })}
                    className="shrink-0 text-[0.75rem] text-muted hover:text-danger"
                    aria-label="Delete note"
                  >
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
          <Button type="submit" size="sm" variant="outline" className="mt-2">
            Add note
          </Button>
        </form>
      </section>
    </article>
  );
}
