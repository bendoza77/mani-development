"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, MessageSquareQuote, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, FilterTabs, IconButton, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { testimonialsDB, uid, useDB } from "@/lib/store";
import { cx } from "@/lib/format";
import type { Testimonial } from "@/lib/types";

const blank = (): Testimonial => ({ id: "", quote: "", author: "", role: "", project: "", published: false });

export function TestimonialsAdmin() {
  const items = useDB((d) => d.testimonials);
  const projects = useDB((d) => d.projects);
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [editing, setEditing] = useState<{ item: Testimonial; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<Testimonial | null>(null);

  const rows = useMemo(() => items.filter((t) => filter === "all" || (filter === "published" ? t.published : !t.published)), [items, filter]);
  const published = items.filter((t) => t.published).length;

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Published quotes rotate in the homepage testimonials section."
        actions={
          <Button size="sm" onClick={() => setEditing({ item: blank(), isNew: true })}>
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
              { value: "all", label: "All", count: items.length },
              { value: "published", label: "Published", count: published },
              { value: "draft", label: "Drafts", count: items.length - published },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={MessageSquareQuote} title="Nothing here" body={items.length ? "No testimonials in this view." : "Add a client quote to build trust on the homepage."} />
        ) : (
          <ul className="grid gap-px bg-line md:grid-cols-2">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-col bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className={cx("rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium", t.published ? "bg-ok-soft text-ok" : "bg-paper-2 text-muted")}>{t.published ? "Published" : "Draft"}</span>
                  <div className="-mt-1 -mr-2 flex">
                    <IconButton
                      label={t.published ? `Unpublish quote by ${t.author}` : `Publish quote by ${t.author}`}
                      icon={t.published ? EyeOff : Eye}
                      onClick={() => {
                        testimonialsDB.update(t.id, { published: !t.published }, `Testimonial by ${t.author} ${t.published ? "unpublished" : "published"}`);
                        toast({ tone: "info", title: t.published ? "Unpublished" : "Published", body: `Quote by ${t.author}` });
                      }}
                    />
                    <IconButton label={`Edit quote by ${t.author}`} icon={Pencil} onClick={() => setEditing({ item: t, isNew: false })} />
                    <IconButton label={`Delete quote by ${t.author}`} icon={Trash2} tone="danger" onClick={() => setToDelete(t)} />
                  </div>
                </div>
                <blockquote className="mt-3 flex-1 font-display text-[1.1rem] leading-snug">&ldquo;{t.quote}&rdquo;</blockquote>
                <p className="mt-4 text-[0.85rem]">
                  <span className="font-medium">{t.author}</span> <span className="text-muted">· {t.role}</span>
                </p>
                {t.project && <p className="t-meta mt-1 text-muted">{t.project}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <TestimonialEditor
        key={editing?.item.id ?? "none"}
        state={editing}
        projectTitles={projects.map((p) => p.title)}
        onClose={() => setEditing(null)}
        onSave={(item, isNew) => {
          if (isNew) testimonialsDB.add({ ...item, id: uid("t") }, `Testimonial by ${item.author} added`);
          else testimonialsDB.update(item.id, item, `Testimonial by ${item.author} updated`);
          toast({ tone: "success", title: isNew ? "Testimonial added" : "Testimonial saved", body: item.author });
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this testimonial?"
        description={`The quote by ${toDelete?.author ?? ""} will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!toDelete) return;
          testimonialsDB.remove(toDelete.id, `Testimonial by ${toDelete.author} deleted`);
          toast({ tone: "success", title: "Testimonial deleted" });
          setToDelete(null);
        }}
      />
    </>
  );
}

function TestimonialEditor({
  state,
  projectTitles,
  onClose,
  onSave,
}: {
  state: { item: Testimonial; isNew: boolean } | null;
  projectTitles: string[];
  onClose: () => void;
  onSave: (t: Testimonial, isNew: boolean) => void;
}) {
  const [d, setD] = useState<Testimonial>(() => state?.item ?? blank());
  const [show, setShow] = useState(false);
  const errors = {
    quote: d.quote.trim().length < 20 ? "The quote should be at least 20 characters." : d.quote.length > 400 ? "Keep it under 400 characters." : undefined,
    author: !d.author.trim() ? "Author is required." : undefined,
    role: !d.role.trim() ? "Role or company is required." : undefined,
  };
  const e = (k: keyof typeof errors) => (show ? errors[k] : undefined);
  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={state?.isNew ? "New testimonial" : "Edit testimonial"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShow(true);
              if (Object.values(errors).some(Boolean)) return;
              onSave({ ...d, quote: d.quote.trim(), author: d.author.trim(), role: d.role.trim() }, !!state?.isNew);
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Quote" required error={e("quote")} hint={`${d.quote.length}/400`}>
          {(a) => <Textarea {...a} rows={4} value={d.quote} onChange={(ev) => setD({ ...d, quote: ev.target.value })} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Author" required error={e("author")}>
            {(a) => <Input {...a} value={d.author} onChange={(ev) => setD({ ...d, author: ev.target.value })} />}
          </Field>
          <Field label="Role / company" required error={e("role")}>
            {(a) => <Input {...a} value={d.role} onChange={(ev) => setD({ ...d, role: ev.target.value })} />}
          </Field>
        </div>
        <Field label="Related project">
          {(a) => (
            <Select {...a} value={d.project} onChange={(ev) => setD({ ...d, project: ev.target.value })}>
              <option value="">None</option>
              {projectTitles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Toggle checked={d.published} onChange={(v) => setD({ ...d, published: v })} label="Published" description="Show on the homepage." />
      </div>
    </Dialog>
  );
}
