"use client";

import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Briefcase, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { SortableItem, SortableList } from "@/components/admin/SortableList";
import { DragHandleButton, LoadError, ServerErrors, without } from "@/components/admin/parts";
import { EmptyState, IconButton, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Toggle } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, errorMessage, fieldErrorsFrom, orNull, saveOrder, type AdminService, type ApiImage, type ServiceInput } from "@/lib/api";
import { cx } from "@/lib/format";

type Draft = {
  slug: string;
  titleKa: string;
  titleEn: string;
  titleRu: string;
  summaryKa: string;
  summaryEn: string;
  summaryRu: string;
  descriptionKa: string;
  descriptionEn: string;
  descriptionRu: string;
  featuresKa: string;
  featuresEn: string;
  featuresRu: string;
  image: ApiImage | null;
  visible: boolean;
};

const blank = (): Draft => ({
  slug: "",
  titleKa: "",
  titleEn: "",
  titleRu: "",
  summaryKa: "",
  summaryEn: "",
  summaryRu: "",
  descriptionKa: "",
  descriptionEn: "",
  descriptionRu: "",
  featuresKa: "",
  featuresEn: "",
  featuresRu: "",
  image: null,
  visible: true,
});

const toDraft = (s: AdminService): Draft => ({
  slug: s.slug,
  titleKa: s.titleKa,
  titleEn: s.titleEn ?? "",
  titleRu: s.titleRu ?? "",
  summaryKa: s.summaryKa,
  summaryEn: s.summaryEn ?? "",
  summaryRu: s.summaryRu ?? "",
  descriptionKa: s.descriptionKa,
  descriptionEn: s.descriptionEn ?? "",
  descriptionRu: s.descriptionRu ?? "",
  featuresKa: s.featuresKa.join("\n"),
  featuresEn: s.featuresEn.join("\n"),
  featuresRu: s.featuresRu.join("\n"),
  image: s.image,
  visible: s.visible,
});

/** One list item per non-empty line. */
export const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function toInput(d: Draft): ServiceInput {
  return {
    slug: orNull(d.slug),
    titleKa: d.titleKa.trim(),
    titleEn: orNull(d.titleEn),
    titleRu: orNull(d.titleRu),
    summaryKa: d.summaryKa.trim(),
    summaryEn: orNull(d.summaryEn),
    summaryRu: orNull(d.summaryRu),
    descriptionKa: d.descriptionKa.trim(),
    descriptionEn: orNull(d.descriptionEn),
    descriptionRu: orNull(d.descriptionRu),
    featuresKa: lines(d.featuresKa),
    featuresEn: lines(d.featuresEn),
    featuresRu: lines(d.featuresRu),
    imageId: d.image?.id ?? "",
    visible: d.visible,
  };
}

function featureError(text: string) {
  const l = lines(text);
  if (l.length > 12) return "At most 12 items.";
  if (l.some((x) => x.length > 100)) return "Each item: at most 100 characters.";
  return undefined;
}

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  const len = (v: string) => v.trim().length;
  if (len(d.titleKa) < 3) e.titleKa = "At least 3 characters.";
  else if (len(d.titleKa) > 80) e.titleKa = "At most 80 characters.";
  if (len(d.titleEn) > 80) e.titleEn = "At most 80 characters.";
  if (len(d.titleRu) > 80) e.titleRu = "At most 80 characters.";
  if (len(d.summaryKa) < 10) e.summaryKa = "Add a short summary (10+ characters).";
  else if (len(d.summaryKa) > 200) e.summaryKa = "At most 200 characters.";
  if (len(d.summaryEn) > 200) e.summaryEn = "At most 200 characters.";
  if (len(d.summaryRu) > 200) e.summaryRu = "At most 200 characters.";
  if (len(d.descriptionKa) < 20) e.descriptionKa = "Describe the service (20+ characters).";
  else if (len(d.descriptionKa) > 2000) e.descriptionKa = "At most 2000 characters.";
  if (len(d.descriptionEn) > 2000) e.descriptionEn = "At most 2000 characters.";
  if (len(d.descriptionRu) > 2000) e.descriptionRu = "At most 2000 characters.";
  const fk = featureError(d.featuresKa);
  const fe = featureError(d.featuresEn);
  const fr = featureError(d.featuresRu);
  if (fk) e.featuresKa = fk;
  if (fe) e.featuresEn = fe;
  if (fr) e.featuresRu = fr;
  if (d.slug.trim() && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug.trim())) e.slug = "Lowercase letters, numbers and single hyphens only.";
  if (!d.image) e.image = "Choose an image.";
  return e;
}

export function ServicesAdmin() {
  const { data, error, reload, update } = useApiData<{ items: AdminService[] }>("/api/admin/services");
  const services = data?.items ?? null;
  const toast = useToast();
  const [editing, setEditing] = useState<{ item: AdminService | null; key: number } | null>(null);
  const [toDelete, setToDelete] = useState<AdminService | null>(null);
  const [deleting, setDeleting] = useState(false);

  const replace = (s: AdminService) => update((d) => ({ items: d.items.map((x) => (x.id === s.id ? s : x)) }));

  async function move(from: number, to: number) {
    if (!services || to < 0 || to >= services.length) return;
    const next = arrayMove(services, from, to);
    update(() => ({ items: next }));
    try {
      const saved = await saveOrder<{ items: AdminService[] }>("/api/admin/services", next.map((s) => s.id));
      update(() => saved);
    } catch (err) {
      toast({ tone: "error", title: "Order not saved", body: errorMessage(err) });
      reload();
    }
  }

  async function toggleVisible(s: AdminService) {
    try {
      replace(await api<AdminService>(`/api/admin/services/${s.id}`, { method: "PATCH", body: { visible: !s.visible } }));
      toast({ tone: "info", title: s.visible ? "Service hidden" : "Service visible", body: s.titleKa });
    } catch (err) {
      toast({ tone: "error", title: "Could not change", body: errorMessage(err) });
    }
  }

  async function remove(s: AdminService) {
    setDeleting(true);
    try {
      await api(`/api/admin/services/${s.id}`, { method: "DELETE" });
      update((d) => ({ items: d.items.filter((x) => x.id !== s.id) }));
      toast({ tone: "success", title: "Service deleted", body: s.titleKa });
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
        title="Services"
        description="Order here is the order on the public Services page and the homepage. Drag or use the arrows to reorder."
        actions={
          <Button size="sm" onClick={() => setEditing({ item: null, key: Date.now() })}>
            <Plus aria-hidden className="size-4" /> New service
          </Button>
        }
      />
      <Panel>
        {error ? (
          <LoadError message={error.message} onRetry={reload} />
        ) : !services ? (
          <div className="h-64 animate-pulse bg-paper-2/50" aria-busy="true" />
        ) : services.length === 0 ? (
          <EmptyState icon={Briefcase} title="No services" body="Add the first service to show it on the website." />
        ) : (
          <SortableList ids={services.map((s) => s.id)} onMove={(from, to) => void move(from, to)}>
            <ol>
              {services.map((s, i) => (
                <li key={s.id} className="border-b border-line last:border-0">
                  <SortableItem id={s.id}>
                    {(handle) => (
                      <div className={cx("flex items-center gap-3 bg-card px-3 py-3 sm:gap-4 sm:px-4", !s.visible && "bg-paper/50")}>
                        <DragHandleButton {...handle} label={`Drag to reorder ${s.titleKa}`} />
                        <span className="t-meta hidden w-6 shrink-0 text-center text-muted tabular-nums sm:block">{String(i + 1).padStart(2, "0")}</span>
                        <div className={cx("relative hidden size-14 shrink-0 overflow-hidden rounded-[3px] sm:block", !s.visible && "opacity-50")}>
                          <Img src={s.image.src} alt="" sizes="56px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cx("truncate font-medium", !s.visible && "text-muted")}>
                            {s.titleKa}
                            {!s.visible && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[0.7rem] font-normal text-muted">Hidden</span>}
                            {!s.titleEn && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[0.7rem] font-normal text-warn">No English</span>}
                            {!s.titleRu && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[0.7rem] font-normal text-warn">No Russian</span>}
                          </p>
                          <p className="truncate text-[0.83rem] text-muted">{s.summaryKa}</p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <span className="max-sm:hidden">
                            <IconButton label={`Move ${s.titleKa} up`} icon={ArrowUp} disabled={i === 0} onClick={() => void move(i, i - 1)} />
                          </span>
                          <span className="max-sm:hidden">
                            <IconButton label={`Move ${s.titleKa} down`} icon={ArrowDown} disabled={i === services.length - 1} onClick={() => void move(i, i + 1)} />
                          </span>
                          <IconButton label={s.visible ? `Hide ${s.titleKa}` : `Show ${s.titleKa}`} icon={s.visible ? Eye : EyeOff} onClick={() => void toggleVisible(s)} />
                          <IconButton label={`Edit ${s.titleKa}`} icon={Pencil} onClick={() => setEditing({ item: s, key: Date.now() })} />
                          <IconButton label={`Delete ${s.titleKa}`} icon={Trash2} tone="danger" onClick={() => setToDelete(s)} />
                        </div>
                      </div>
                    )}
                  </SortableItem>
                </li>
              ))}
            </ol>
          </SortableList>
        )}
      </Panel>

      {editing && (
        <ServiceEditor
          key={editing.key}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            update((d) => ({ items: isNew ? [...d.items, saved] : d.items.map((x) => (x.id === saved.id ? saved : x)) }));
            toast({ tone: "success", title: isNew ? "Service added" : "Service saved", body: saved.titleKa });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete "${toDelete?.titleKa}"?`}
        description="It will disappear from the Services page. Consider hiding it instead if you may need it again."
        confirmLabel="Delete service"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}

function ServiceEditor({ item, onClose, onSaved }: { item: AdminService | null; onClose: () => void; onSaved: (s: AdminService, isNew: boolean) => void }) {
  const [d, setD] = useState<Draft>(() => (item ? toDraft(item) : blank()));
  const [show, setShow] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const local = validate(d);
  const err = (k: string) => (show ? local[k] : undefined) ?? server[k] ?? (k === "image" ? server.imageId : undefined);
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
        ? await api<AdminService>(`/api/admin/services/${item.id}`, { method: "PUT", body })
        : await api<AdminService>("/api/admin/services", { method: "POST", body });
      onSaved(saved, !item);
    } catch (e) {
      setServer(fieldErrorsFrom(e));
      setGeneral(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={!picker}
        onClose={onClose}
        title={item ? "Edit service" : "New service"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              {item ? "Save" : "Add service"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {general && <ServerErrors message={general} fields={server} known={KNOWN} />}
          <BiField label="Title" required maxLength={80} ka={d.titleKa} en={d.titleEn} ru={d.titleRu} onKa={(v) => set("titleKa", v)} onEn={(v) => set("titleEn", v)} onRu={(v) => set("titleRu", v)} errorKa={err("titleKa")} errorEn={err("titleEn")} errorRu={err("titleRu")} />
          <BiField label="Summary" required maxLength={200} hint="One line for cards" ka={d.summaryKa} en={d.summaryEn} ru={d.summaryRu} onKa={(v) => set("summaryKa", v)} onEn={(v) => set("summaryEn", v)} onRu={(v) => set("summaryRu", v)} errorKa={err("summaryKa")} errorEn={err("summaryEn")} errorRu={err("summaryRu")} />
          <BiField label="Description" required multiline rows={4} maxLength={2000} ka={d.descriptionKa} en={d.descriptionEn} ru={d.descriptionRu} onKa={(v) => set("descriptionKa", v)} onEn={(v) => set("descriptionEn", v)} onRu={(v) => set("descriptionRu", v)} errorKa={err("descriptionKa")} errorEn={err("descriptionEn")} errorRu={err("descriptionRu")} />
          <BiField label="What's included" multiline rows={4} hint="One item per line, up to 12" ka={d.featuresKa} en={d.featuresEn} ru={d.featuresRu} onKa={(v) => set("featuresKa", v)} onEn={(v) => set("featuresEn", v)} onRu={(v) => set("featuresRu", v)} errorKa={err("featuresKa")} errorEn={err("featuresEn")} errorRu={err("featuresRu")} />
          <Field label="Web address" error={err("slug")} hint="Optional. Made from the title when empty.">
            {(a) => <Input {...a} value={d.slug} placeholder="e.g. house-construction" onChange={(ev) => set("slug", ev.target.value.toLowerCase())} />}
          </Field>
          <div>
            <p className="text-[0.82rem] font-medium text-ink-soft">
              Image <span className="text-accent">*</span>
            </p>
            <div className="mt-2 flex items-end gap-4">
              <div className="relative aspect-[4/3] w-36 overflow-hidden rounded-[3px] border border-line bg-paper-2">{d.image && <Img src={d.image.src} alt="Selected service image" sizes="144px" />}</div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                <ImagePlus aria-hidden className="size-4" /> {d.image ? "Change" : "Choose image"}
              </Button>
            </div>
            {err("image") && (
              <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                {err("image")}
              </p>
            )}
          </div>
          <Toggle checked={d.visible} onChange={(v) => set("visible", v)} label="Visible on website" />
        </div>
      </Dialog>
      <ImagePicker open={picker} onClose={() => setPicker(false)} initial={d.image ? [d.image] : []} onSelect={([img]) => img && set("image", img)} title="Choose a service image" />
    </>
  );
}

const KNOWN = new Set(["slug", "titleKa", "titleEn", "titleRu", "summaryKa", "summaryEn", "summaryRu", "descriptionKa", "descriptionEn", "descriptionRu", "featuresKa", "featuresEn", "featuresRu", "imageId", "image", "visible"]);
