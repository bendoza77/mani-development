"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Briefcase, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { EmptyState, IconButton, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea, Toggle } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { servicesDB, uid, useDB } from "@/lib/store";
import { cx } from "@/lib/format";
import type { Service } from "@/lib/types";

const blank = (): Service => ({ id: "", title: "", summary: "", description: "", image: "", features: [], visible: true });

export function ServicesAdmin() {
  const services = useDB((d) => d.services);
  const toast = useToast();
  const [editing, setEditing] = useState<{ item: Service; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const toggleVisible = (s: Service) => {
    servicesDB.update(s.id, { visible: !s.visible }, `${s.title} ${s.visible ? "hidden from" : "shown on"} the website`);
    toast({ tone: "info", title: s.visible ? "Service hidden" : "Service visible", body: s.title });
  };

  return (
    <>
      <PageHeader
        title="Services"
        description="Order here is the order on the public Services page and homepage capabilities list."
        actions={
          <Button size="sm" onClick={() => setEditing({ item: blank(), isNew: true })}>
            <Plus aria-hidden className="size-4" /> New service
          </Button>
        }
      />
      <Panel>
        {services.length === 0 ? (
          <EmptyState icon={Briefcase} title="No services" body="Add the first service to show it on the website." />
        ) : (
          <ol>
            {services.map((s, i) => (
              <li key={s.id} className={cx("flex items-center gap-4 border-b border-line px-4 py-3 last:border-0", !s.visible && "bg-paper/50")}>
                <span className="t-meta w-6 shrink-0 text-center text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div className={cx("relative hidden size-14 shrink-0 overflow-hidden rounded-[3px] sm:block", !s.visible && "opacity-50")}>
                  {s.image && <Img src={s.image} alt="" sizes="56px" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cx("truncate font-medium", !s.visible && "text-muted")}>
                    {s.title}
                    {!s.visible && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[0.7rem] font-normal text-muted">Hidden</span>}
                  </p>
                  <p className="truncate text-[0.83rem] text-muted">{s.summary}</p>
                </div>
                <div className="flex shrink-0 items-center">
                  <IconButton label={`Move ${s.title} up`} icon={ArrowUp} disabled={i === 0} onClick={() => servicesDB.move(s.id, -1)} />
                  <IconButton label={`Move ${s.title} down`} icon={ArrowDown} disabled={i === services.length - 1} onClick={() => servicesDB.move(s.id, 1)} />
                  <IconButton label={s.visible ? `Hide ${s.title}` : `Show ${s.title}`} icon={s.visible ? Eye : EyeOff} onClick={() => toggleVisible(s)} />
                  <IconButton label={`Edit ${s.title}`} icon={Pencil} onClick={() => setEditing({ item: s, isNew: false })} />
                  <IconButton label={`Delete ${s.title}`} icon={Trash2} tone="danger" onClick={() => setToDelete(s)} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <ServiceEditor
        key={editing?.item.id ?? "none"}
        state={editing}
        onClose={() => setEditing(null)}
        onSave={(item, isNew) => {
          if (isNew) servicesDB.add({ ...item, id: uid("s") }, `${item.title} service added`, "end");
          else servicesDB.update(item.id, item, `${item.title} service updated`);
          toast({ tone: "success", title: isNew ? "Service added" : "Service saved", body: item.title });
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete "${toDelete?.title}"?`}
        description="It will disappear from the Services page. Consider hiding it instead if you may need it again."
        confirmLabel="Delete service"
        onConfirm={() => {
          if (!toDelete) return;
          servicesDB.remove(toDelete.id, `${toDelete.title} service deleted`);
          toast({ tone: "success", title: "Service deleted", body: toDelete.title });
          setToDelete(null);
        }}
      />
    </>
  );
}

function ServiceEditor({ state, onClose, onSave }: { state: { item: Service; isNew: boolean } | null; onClose: () => void; onSave: (s: Service, isNew: boolean) => void }) {
  const [draft, setDraft] = useState<Service>(() => state?.item ?? blank());
  const [features, setFeatures] = useState(() => (state?.item.features ?? []).join("\n"));
  const [showErrors, setShowErrors] = useState(false);
  const [picker, setPicker] = useState(false);

  const errors = {
    title: draft.title.trim().length < 3 ? "Title must be at least 3 characters." : undefined,
    summary: draft.summary.trim().length < 10 ? "Add a short summary (10+ characters)." : undefined,
    description: draft.description.trim().length < 20 ? "Describe the service (20+ characters)." : undefined,
    image: !draft.image ? "Choose an image." : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  const e = (k: keyof typeof errors) => (showErrors ? errors[k] : undefined);

  return (
    <>
      <Dialog
        open={!!state && !picker}
        onClose={onClose}
        title={state?.isNew ? "New service" : "Edit service"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowErrors(true);
                if (invalid) return;
                onSave({ ...draft, title: draft.title.trim(), features: features.split("\n").map((f) => f.trim()).filter(Boolean) }, !!state?.isNew);
              }}
            >
              {state?.isNew ? "Add service" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Title" required error={e("title")}>
            {(a) => <Input {...a} value={draft.title} onChange={(ev) => setDraft({ ...draft, title: ev.target.value })} />}
          </Field>
          <Field label="Summary" required error={e("summary")}>
            {(a) => <Input {...a} value={draft.summary} onChange={(ev) => setDraft({ ...draft, summary: ev.target.value })} />}
          </Field>
          <Field label="Description" required error={e("description")}>
            {(a) => <Textarea {...a} rows={4} value={draft.description} onChange={(ev) => setDraft({ ...draft, description: ev.target.value })} />}
          </Field>
          <Field label="What's included" hint="One item per line.">
            {(a) => <Textarea {...a} rows={4} value={features} onChange={(ev) => setFeatures(ev.target.value)} />}
          </Field>
          <div>
            <p className="text-[0.82rem] font-medium text-ink-soft">
              Image <span className="text-accent">*</span>
            </p>
            <div className="mt-2 flex items-end gap-4">
              <div className="relative aspect-[4/3] w-36 overflow-hidden rounded-[3px] border border-line bg-paper-2">{draft.image && <Img src={draft.image} alt="Selected service image" sizes="144px" />}</div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                <ImagePlus aria-hidden className="size-4" /> {draft.image ? "Change" : "Choose image"}
              </Button>
            </div>
            {e("image") && (
              <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                {e("image")}
              </p>
            )}
          </div>
          <Toggle checked={draft.visible} onChange={(v) => setDraft({ ...draft, visible: v })} label="Visible on website" />
        </div>
      </Dialog>
      <MediaPicker open={picker} onClose={() => setPicker(false)} initial={draft.image ? [draft.image] : []} onSelect={([src]) => setDraft((d) => ({ ...d, image: src }))} />
    </>
  );
}
