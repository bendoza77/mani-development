"use client";

import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Eye, EyeOff, GalleryHorizontalEnd, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
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
import { api, errorMessage, fieldErrorsFrom, MAX_SLIDES, orNull, saveOrder, type AdminSlide, type ApiImage, type SlideInput } from "@/lib/api";
import { cx } from "@/lib/format";

type Draft = {
  image: ApiImage | null;
  headingKa: string;
  headingEn: string;
  headingRu: string;
  textKa: string;
  textEn: string;
  textRu: string;
  ctaLabelKa: string;
  ctaLabelEn: string;
  ctaLabelRu: string;
  ctaUrl: string;
  isPublished: boolean;
};

const blank = (): Draft => ({ image: null, headingKa: "", headingEn: "", headingRu: "", textKa: "", textEn: "", textRu: "", ctaLabelKa: "", ctaLabelEn: "", ctaLabelRu: "", ctaUrl: "", isPublished: true });
const toDraft = (s: AdminSlide): Draft => ({
  image: s.image,
  headingKa: s.headingKa,
  headingEn: s.headingEn ?? "",
  headingRu: s.headingRu ?? "",
  textKa: s.textKa,
  textEn: s.textEn ?? "",
  textRu: s.textRu ?? "",
  ctaLabelKa: s.ctaLabelKa,
  ctaLabelEn: s.ctaLabelEn ?? "",
  ctaLabelRu: s.ctaLabelRu ?? "",
  ctaUrl: s.ctaUrl,
  isPublished: s.isPublished,
});
const toInput = (d: Draft): SlideInput => ({
  imageId: d.image?.id ?? "",
  headingKa: d.headingKa.trim(),
  headingEn: orNull(d.headingEn),
  headingRu: orNull(d.headingRu),
  textKa: d.textKa.trim(),
  textEn: orNull(d.textEn),
  textRu: orNull(d.textRu),
  ctaLabelKa: d.ctaLabelKa.trim(),
  ctaLabelEn: orNull(d.ctaLabelEn),
  ctaLabelRu: orNull(d.ctaLabelRu),
  ctaUrl: d.ctaUrl.trim(),
  isPublished: d.isPublished,
});

const LINK = /^(\/(?!\/)\S*|https:\/\/[^\s/]+\.\S+)$/;

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  const len = (v: string) => v.trim().length;
  if (!d.image) e.image = "Choose an image.";
  if (!len(d.headingKa)) e.headingKa = "Heading is required.";
  else if (len(d.headingKa) > 120) e.headingKa = "At most 120 characters.";
  if (len(d.headingEn) > 120) e.headingEn = "At most 120 characters.";
  if (len(d.headingRu) > 120) e.headingRu = "At most 120 characters.";
  if (len(d.textKa) > 300) e.textKa = "At most 300 characters.";
  if (len(d.textEn) > 300) e.textEn = "At most 300 characters.";
  if (len(d.textRu) > 300) e.textRu = "At most 300 characters.";
  if (len(d.ctaLabelKa) > 40) e.ctaLabelKa = "At most 40 characters.";
  if (len(d.ctaLabelEn) > 40) e.ctaLabelEn = "At most 40 characters.";
  if (len(d.ctaLabelRu) > 40) e.ctaLabelRu = "At most 40 characters.";
  const url = d.ctaUrl.trim();
  if (url && !LINK.test(url)) e.ctaUrl = "Use a site path like /projects or an address starting with https://.";
  else if (!len(d.ctaLabelKa) !== !url) e[url ? "ctaLabelKa" : "ctaUrl"] = "Give the button both a label and a link, or leave both empty.";
  return e;
}

const KNOWN = new Set(["imageId", "image", "headingKa", "headingEn", "headingRu", "textKa", "textEn", "textRu", "ctaLabelKa", "ctaLabelEn", "ctaLabelRu", "ctaUrl", "isPublished"]);

export function SlidesAdmin() {
  const { data, error, reload, update } = useApiData<{ items: AdminSlide[] }>("/api/admin/slides");
  const slides = data?.items ?? null;
  const toast = useToast();
  const [editing, setEditing] = useState<{ item: AdminSlide | null; key: number } | null>(null);
  const [toDelete, setToDelete] = useState<AdminSlide | null>(null);
  const [deleting, setDeleting] = useState(false);
  const full = (slides?.length ?? 0) >= MAX_SLIDES;

  async function move(from: number, to: number) {
    if (!slides || to < 0 || to >= slides.length) return;
    const next = arrayMove(slides, from, to);
    update(() => ({ items: next }));
    try {
      const saved = await saveOrder<{ items: AdminSlide[] }>("/api/admin/slides", next.map((s) => s.id));
      update(() => saved);
    } catch (err) {
      toast({ tone: "error", title: "Order not saved", body: errorMessage(err) });
      reload();
    }
  }

  async function togglePublished(s: AdminSlide) {
    try {
      const saved = await api<AdminSlide>(`/api/admin/slides/${s.id}`, { method: "PATCH", body: { isPublished: !s.isPublished } });
      update((d) => ({ items: d.items.map((x) => (x.id === saved.id ? saved : x)) }));
      toast({ tone: "info", title: s.isPublished ? "Slide hidden" : "Slide published", body: s.headingKa });
    } catch (err) {
      toast({ tone: "error", title: "Could not change", body: errorMessage(err) });
    }
  }

  async function remove(s: AdminSlide) {
    setDeleting(true);
    try {
      await api(`/api/admin/slides/${s.id}`, { method: "DELETE" });
      update((d) => ({ items: d.items.filter((x) => x.id !== s.id) }));
      toast({ tone: "success", title: "Slide deleted", body: s.headingKa });
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
        title="Homepage slider"
        description={`The large pictures at the top of the homepage, in this order. Up to ${MAX_SLIDES} slides; only published ones are shown.`}
        actions={
          <Button size="sm" disabled={!slides || full} onClick={() => setEditing({ item: null, key: Date.now() })} title={full ? `The slider holds at most ${MAX_SLIDES} slides` : undefined}>
            <Plus aria-hidden className="size-4" /> New slide
          </Button>
        }
      />
      <Panel
        title={slides ? `${slides.length} of ${MAX_SLIDES} slides` : "Slides"}
        action={full ? <span className="text-[0.8rem] text-muted">Full. Delete a slide to add another.</span> : undefined}
      >
        {error ? (
          <LoadError message={error.message} onRetry={reload} />
        ) : !slides ? (
          <div className="h-64 animate-pulse bg-paper-2/50" aria-busy="true" />
        ) : slides.length === 0 ? (
          <EmptyState icon={GalleryHorizontalEnd} title="No slides yet" body="Add the first slide: a wide photo with a short heading." />
        ) : (
          <SortableList ids={slides.map((s) => s.id)} onMove={(from, to) => void move(from, to)}>
            <ol>
              {slides.map((s, i) => (
                <li key={s.id} className="border-b border-line last:border-0">
                  <SortableItem id={s.id}>
                    {(handle) => (
                      <div className={cx("flex items-center gap-3 bg-card px-3 py-3 sm:gap-4 sm:px-4", !s.isPublished && "bg-paper/50")}>
                        <DragHandleButton {...handle} label={`Drag to reorder slide ${i + 1}`} />
                        <div className={cx("relative aspect-[16/9] w-20 shrink-0 overflow-hidden rounded-[3px] sm:w-28", !s.isPublished && "opacity-50")}>
                          <Img src={s.image.src} alt="" sizes="112px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cx("truncate font-medium", !s.isPublished && "text-muted")}>
                            {s.headingKa}
                            {!s.isPublished && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[0.7rem] font-normal text-muted">Hidden</span>}
                            {!s.headingEn && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[0.7rem] font-normal text-warn">No English</span>}
                            {!s.headingRu && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[0.7rem] font-normal text-warn">No Russian</span>}
                          </p>
                          <p className="truncate text-[0.83rem] text-muted">{s.ctaUrl ? `Button: ${s.ctaLabelKa} → ${s.ctaUrl}` : s.textKa || "No button"}</p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <span className="max-sm:hidden">
                            <IconButton label={`Move slide ${i + 1} up`} icon={ArrowUp} disabled={i === 0} onClick={() => void move(i, i - 1)} />
                          </span>
                          <span className="max-sm:hidden">
                            <IconButton label={`Move slide ${i + 1} down`} icon={ArrowDown} disabled={i === slides.length - 1} onClick={() => void move(i, i + 1)} />
                          </span>
                          <IconButton label={s.isPublished ? `Hide slide ${i + 1}` : `Publish slide ${i + 1}`} icon={s.isPublished ? Eye : EyeOff} onClick={() => void togglePublished(s)} />
                          <IconButton label={`Edit slide ${i + 1}`} icon={Pencil} onClick={() => setEditing({ item: s, key: Date.now() })} />
                          <IconButton label={`Delete slide ${i + 1}`} icon={Trash2} tone="danger" onClick={() => setToDelete(s)} />
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
        <SlideEditor
          key={editing.key}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            update((d) => ({ items: isNew ? [...d.items, saved] : d.items.map((x) => (x.id === saved.id ? saved : x)) }));
            toast({ tone: "success", title: isNew ? "Slide added" : "Slide saved", body: saved.headingKa });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this slide?"
        description={`"${toDelete?.headingKa ?? ""}" will be removed from the homepage. The photo stays in the media library.`}
        confirmLabel="Delete slide"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}

function SlideEditor({ item, onClose, onSaved }: { item: AdminSlide | null; onClose: () => void; onSaved: (s: AdminSlide, isNew: boolean) => void }) {
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
        ? await api<AdminSlide>(`/api/admin/slides/${item.id}`, { method: "PUT", body })
        : await api<AdminSlide>("/api/admin/slides", { method: "POST", body });
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
        title={item ? "Edit slide" : "New slide"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              {item ? "Save" : "Add slide"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {general && <ServerErrors message={general} fields={server} known={KNOWN} />}
          <div>
            <p className="text-[0.82rem] font-medium text-ink-soft">
              Image <span className="text-accent">*</span>
            </p>
            <p className="mt-0.5 text-[0.8rem] text-muted">A wide photo, at least 1920 pixels across.</p>
            <div className="mt-2 flex items-end gap-4">
              <div className="relative aspect-[16/9] w-48 overflow-hidden rounded-[3px] border border-line bg-paper-2">{d.image && <Img src={d.image.src} alt="Selected slide image" sizes="192px" />}</div>
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
          <BiField label="Heading" required maxLength={120} ka={d.headingKa} en={d.headingEn} ru={d.headingRu} onKa={(v) => set("headingKa", v)} onEn={(v) => set("headingEn", v)} onRu={(v) => set("headingRu", v)} errorKa={err("headingKa")} errorEn={err("headingEn")} errorRu={err("headingRu")} />
          <BiField label="Text" multiline rows={3} maxLength={300} hint="Optional" ka={d.textKa} en={d.textEn} ru={d.textRu} onKa={(v) => set("textKa", v)} onEn={(v) => set("textEn", v)} onRu={(v) => set("textRu", v)} errorKa={err("textKa")} errorEn={err("textEn")} errorRu={err("textRu")} />
          <BiField label="Button label" maxLength={40} hint="Optional" ka={d.ctaLabelKa} en={d.ctaLabelEn} ru={d.ctaLabelRu} onKa={(v) => set("ctaLabelKa", v)} onEn={(v) => set("ctaLabelEn", v)} onRu={(v) => set("ctaLabelRu", v)} errorKa={err("ctaLabelKa")} errorEn={err("ctaLabelEn")} errorRu={err("ctaLabelRu")} />
          <Field label="Button link" error={err("ctaUrl")} hint="A site path like /projects, or an address starting with https://. Empty = no button.">
            {(a) => <Input {...a} value={d.ctaUrl} placeholder="/projects" onChange={(ev) => set("ctaUrl", ev.target.value)} />}
          </Field>
          <Toggle checked={d.isPublished} onChange={(v) => set("isPublished", v)} label="Published" description="Show this slide on the homepage." />
        </div>
      </Dialog>
      <ImagePicker open={picker} onClose={() => setPicker(false)} initial={d.image ? [d.image] : []} onSelect={([img]) => img && set("image", img)} title="Choose a slide image" />
    </>
  );
}
