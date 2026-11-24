"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, MessageSquareQuote, Pencil, Plus, Trash2 } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { LoadError, ServerErrors, without } from "@/components/admin/parts";
import { EmptyState, FilterTabs, IconButton, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Select, Toggle } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, errorMessage, fieldErrorsFrom, orNull, type AdminProject, type AdminTestimonial, type TestimonialInput, type TestimonialList } from "@/lib/api";
import { cx } from "@/lib/format";

type Draft = { quoteKa: string; quoteEn: string; quoteRu: string; authorKa: string; authorEn: string; authorRu: string; roleKa: string; roleEn: string; roleRu: string; projectId: string; published: boolean };

const blank = (): Draft => ({ quoteKa: "", quoteEn: "", quoteRu: "", authorKa: "", authorEn: "", authorRu: "", roleKa: "", roleEn: "", roleRu: "", projectId: "", published: false });
const toDraft = (t: AdminTestimonial): Draft => ({
  quoteKa: t.quoteKa,
  quoteEn: t.quoteEn ?? "",
  quoteRu: t.quoteRu ?? "",
  authorKa: t.authorKa,
  authorEn: t.authorEn ?? "",
  authorRu: t.authorRu ?? "",
  roleKa: t.roleKa,
  roleEn: t.roleEn ?? "",
  roleRu: t.roleRu ?? "",
  projectId: t.projectId ?? "",
  published: t.published,
});
const toInput = (d: Draft): TestimonialInput => ({
  quoteKa: d.quoteKa.trim(),
  quoteEn: orNull(d.quoteEn),
  quoteRu: orNull(d.quoteRu),
  authorKa: d.authorKa.trim(),
  authorEn: orNull(d.authorEn),
  authorRu: orNull(d.authorRu),
  roleKa: d.roleKa.trim(),
  roleEn: orNull(d.roleEn),
  roleRu: orNull(d.roleRu),
  projectId: d.projectId || null,
  published: d.published,
});

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  const len = (v: string) => v.trim().length;
  if (len(d.quoteKa) < 20) e.quoteKa = "The quote should be at least 20 characters.";
  else if (len(d.quoteKa) > 400) e.quoteKa = "At most 400 characters.";
  if (len(d.quoteEn) > 400) e.quoteEn = "At most 400 characters.";
  if (len(d.quoteRu) > 400) e.quoteRu = "At most 400 characters.";
  if (!len(d.authorKa)) e.authorKa = "Author is required.";
  else if (len(d.authorKa) > 100) e.authorKa = "At most 100 characters.";
  if (len(d.authorEn) > 100) e.authorEn = "At most 100 characters.";
  if (len(d.authorRu) > 100) e.authorRu = "At most 100 characters.";
  if (!len(d.roleKa)) e.roleKa = "Role or company is required.";
  else if (len(d.roleKa) > 100) e.roleKa = "At most 100 characters.";
  if (len(d.roleEn) > 100) e.roleEn = "At most 100 characters.";
  if (len(d.roleRu) > 100) e.roleRu = "At most 100 characters.";
  return e;
}

const KNOWN = new Set(["quoteKa", "quoteEn", "quoteRu", "authorKa", "authorEn", "authorRu", "roleKa", "roleEn", "roleRu", "projectId", "published"]);

export function TestimonialsAdmin() {
  const { data, error, reload, update } = useApiData<TestimonialList>("/api/admin/testimonials");
  const items = useMemo(() => data?.items ?? [], [data]);
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [editing, setEditing] = useState<{ item: AdminTestimonial | null; key: number } | null>(null);
  const [toDelete, setToDelete] = useState<AdminTestimonial | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => items.filter((t) => filter === "all" || (filter === "published" ? t.published : !t.published)), [items, filter]);
  const published = items.filter((t) => t.published).length;

  const store = (next: AdminTestimonial[]) =>
    update(() => {
      const pub = next.filter((t) => t.published).length;
      return { items: next, counts: { all: next.length, published: pub, draft: next.length - pub } };
    });

  async function togglePublished(t: AdminTestimonial) {
    try {
      const saved = await api<AdminTestimonial>(`/api/admin/testimonials/${t.id}`, { method: "PATCH", body: { published: !t.published } });
      store(items.map((x) => (x.id === saved.id ? saved : x)));
      toast({ tone: "info", title: t.published ? "Unpublished" : "Published", body: `Quote by ${t.authorKa}` });
    } catch (err) {
      toast({ tone: "error", title: "Could not change", body: errorMessage(err) });
    }
  }

  async function remove(t: AdminTestimonial) {
    setDeleting(true);
    try {
      await api(`/api/admin/testimonials/${t.id}`, { method: "DELETE" });
      store(items.filter((x) => x.id !== t.id));
      toast({ tone: "success", title: "Testimonial deleted" });
      setToDelete(null);
    } catch (err) {
      toast({ tone: "error", title: "Could not delete", body: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Published quotes rotate in the homepage testimonials section."
        actions={
          <Button size="sm" onClick={() => setEditing({ item: null, key: Date.now() })}>
            <Plus aria-hidden className="size-4" /> New testimonial
          </Button>
        }
      />
      <Panel>
        <div className="border-b border-line p-3">
          <FilterTabs
            label="Filter testimonials"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: data ? items.length : undefined },
              { value: "published", label: "Published", count: data ? published : undefined },
              { value: "draft", label: "Drafts", count: data ? items.length - published : undefined },
            ]}
          />
        </div>
        {error ? (
          <LoadError message={error.message} onRetry={reload} />
        ) : !data ? (
          <div className="h-64 animate-pulse bg-paper-2/50" aria-busy="true" />
        ) : rows.length === 0 ? (
          <EmptyState icon={MessageSquareQuote} title="Nothing here" body={items.length ? "No testimonials in this view." : "Add a client quote to build trust on the homepage."} />
        ) : (
          <ul className="grid gap-px bg-line md:grid-cols-2">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-col bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex flex-wrap gap-1.5">
                    <span className={cx("rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium", t.published ? "bg-ok-soft text-ok" : "bg-paper-2 text-muted")}>{t.published ? "Published" : "Draft"}</span>
                    {!t.quoteEn && <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-[0.72rem] text-warn">No English</span>}
                    {!t.quoteRu && <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-[0.72rem] text-warn">No Russian</span>}
                  </span>
                  <div className="-mt-1 -mr-2 flex">
                    <IconButton label={t.published ? `Unpublish quote by ${t.authorKa}` : `Publish quote by ${t.authorKa}`} icon={t.published ? EyeOff : Eye} onClick={() => void togglePublished(t)} />
                    <IconButton label={`Edit quote by ${t.authorKa}`} icon={Pencil} onClick={() => setEditing({ item: t, key: Date.now() })} />
                    <IconButton label={`Delete quote by ${t.authorKa}`} icon={Trash2} tone="danger" onClick={() => setToDelete(t)} />
                  </div>
                </div>
                <blockquote className="mt-3 flex-1 font-display text-[1.1rem] leading-snug">&ldquo;{t.quoteKa}&rdquo;</blockquote>
                <p className="mt-4 text-[0.85rem]">
                  <span className="font-medium">{t.authorKa}</span> <span className="text-muted">· {t.roleKa}</span>
                </p>
                {t.project && <p className="t-meta mt-1 text-muted">{t.project.title}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && (
        <TestimonialEditor
          key={editing.key}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            store(isNew ? [saved, ...items] : items.map((x) => (x.id === saved.id ? saved : x)));
            toast({ tone: "success", title: isNew ? "Testimonial added" : "Testimonial saved", body: saved.authorKa });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this testimonial?"
        description={`The quote by ${toDelete?.authorKa ?? ""} will be permanently removed.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}

function TestimonialEditor({ item, onClose, onSaved }: { item: AdminTestimonial | null; onClose: () => void; onSaved: (t: AdminTestimonial, isNew: boolean) => void }) {
  const projects = useApiData<{ items: AdminProject[] }>("/api/admin/projects");
  const [d, setD] = useState<Draft>(() => (item ? toDraft(item) : blank()));
  const [show, setShow] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const local = validate(d);
  const err = (k: string) => (show ? local[k] : undefined) ?? server[k];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setServer((s) => without(s, k));
  };

  async function save() {
    setShow(true);
    if (Object.keys(local).length) return;
    setSaving(true);
    setGeneral(null);
    try {
      const body = toInput(d);
      const saved = item
        ? await api<AdminTestimonial>(`/api/admin/testimonials/${item.id}`, { method: "PUT", body })
        : await api<AdminTestimonial>("/api/admin/testimonials", { method: "POST", body });
      onSaved(saved, !item);
    } catch (e) {
      setServer(fieldErrorsFrom(e));
      setGeneral(errorMessage(e));
      setSaving(false);
    }
  }

  const options = [...(projects.data?.items ?? [])].sort((a, b) => a.titleKa.localeCompare(b.titleKa));
  // Keep the current link selectable even before the project list arrives.
  const current = item?.project && !options.some((p) => p.id === item.project?.id) ? item.project : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? "Edit testimonial" : "New testimonial"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {general && <ServerErrors message={general} fields={server} known={KNOWN} />}
        <BiField label="Quote" required multiline rows={4} maxLength={400} ka={d.quoteKa} en={d.quoteEn} ru={d.quoteRu} onKa={(v) => set("quoteKa", v)} onEn={(v) => set("quoteEn", v)} onRu={(v) => set("quoteRu", v)} errorKa={err("quoteKa")} errorEn={err("quoteEn")} errorRu={err("quoteRu")} />
        <BiField label="Author" required maxLength={100} ka={d.authorKa} en={d.authorEn} ru={d.authorRu} onKa={(v) => set("authorKa", v)} onEn={(v) => set("authorEn", v)} onRu={(v) => set("authorRu", v)} errorKa={err("authorKa")} errorEn={err("authorEn")} errorRu={err("authorRu")} />
        <BiField label="Role / company" required maxLength={100} ka={d.roleKa} en={d.roleEn} ru={d.roleRu} onKa={(v) => set("roleKa", v)} onEn={(v) => set("roleEn", v)} onRu={(v) => set("roleRu", v)} errorKa={err("roleKa")} errorEn={err("roleEn")} errorRu={err("roleRu")} />
        <Field
          label="Related project"
          error={err("projectId")}
          hint={projects.error ? `Projects could not be loaded: ${projects.error.message}` : "Shown under the quote while the project is published."}
        >
          {(a) => (
            <Select {...a} value={d.projectId} onChange={(ev) => set("projectId", ev.target.value)}>
              <option value="">None</option>
              {current && <option value={current.id}>{current.title}</option>}
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titleKa}
                  {p.isPublished ? "" : " (draft)"}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Toggle checked={d.published} onChange={(v) => set("published", v)} label="Published" description="Show on the homepage." />
      </div>
    </Dialog>
  );
}
