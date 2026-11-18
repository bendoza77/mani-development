"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { Check, Copy, ImageOff, Search, Trash2, Upload, X } from "lucide-react";
import { EmptyState, FilterTabs, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { StorageFullError, mediaDB, nowISO, uid, useDB } from "@/lib/store";
import { MEDIA_CATEGORY_LABEL, cx, formatBytes, formatDate } from "@/lib/format";
import type { DB, MediaAsset, MediaCategory } from "@/lib/types";

const CATEGORIES = Object.keys(MEDIA_CATEGORY_LABEL) as MediaCategory[];
const MAX_EDGE = 1600;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** Downscale an image file in the browser and return a JPEG data URL (simulated upload, nothing leaves the device). */
async function processUpload(file: File): Promise<Omit<MediaAsset, "id" | "category" | "createdAt">> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  if (file.size > MAX_INPUT_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} could not be decoded.`);
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const src = canvas.toDataURL("image/jpeg", 0.8);
  const base = file.name.replace(/\.[^.]+$/, "");
  return { name: file.name, src, alt: base.replace(/[-_]+/g, " "), width: w, height: h, size: Math.round((src.length - 23) * 0.75) };
}

function usages(db: Pick<DB, "projects" | "services" | "team">, src: string) {
  const out: string[] = [];
  for (const p of db.projects) if (p.cover === src || p.gallery.includes(src)) out.push(`Project: ${p.title}`);
  for (const s of db.services) if (s.image === src) out.push(`Service: ${s.title}`);
  for (const m of db.team) if (m.photo === src) out.push(`Team: ${m.name}`);
  return out;
}

export function MediaAdmin() {
  const media = useDB((d) => d.media);
  const projects = useDB((d) => d.projects);
  const services = useDB((d) => d.services);
  const team = useDB((d) => d.team);
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<MediaCategory | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return media.filter((m) => (cat === "all" || m.category === cat) && (!s || `${m.name} ${m.alt}`.toLowerCase().includes(s)));
  }, [media, q, cat]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: media.length };
    for (const m of media) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [media]);

  const focused = media.find((m) => m.id === focusId) ?? null;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    let added = 0;
    for (const file of list) {
      try {
        const processed = await processUpload(file);
        const asset: MediaAsset = { id: uid("md"), category: "uploads", createdAt: nowISO(), ...processed };
        mediaDB.add(asset, `${file.name} uploaded`);
        added++;
        setFocusId(asset.id);
      } catch (err) {
        toast({
          tone: "error",
          title: err instanceof StorageFullError ? "Storage full" : "Upload failed",
          body: err instanceof Error ? err.message : "Unknown error",
        });
        if (err instanceof StorageFullError) break;
      }
    }
    setUploading(false);
    if (added) {
      setCat("all");
      toast({ tone: "success", title: `${added} image${added > 1 ? "s" : ""} added`, body: "Stored in this browser only (simulated upload)." });
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  };

  const deleteIds = (ids: string[]) => {
    for (const id of ids) {
      const m = media.find((x) => x.id === id);
      if (m) mediaDB.remove(id, `${m.name} deleted from media`);
    }
    setSelected((s) => s.filter((x) => !ids.includes(x)));
    if (focusId && ids.includes(focusId)) setFocusId(null);
    toast({ tone: "success", title: `${ids.length} file${ids.length > 1 ? "s" : ""} deleted` });
  };

  const inUse = confirmDelete ? confirmDelete.flatMap((id) => usages({ projects, services, team }, media.find((m) => m.id === id)?.src ?? "")) : [];

  return (
    <>
      <PageHeader
        title="Media library"
        description="Images available to projects, services and team profiles. Uploads are resized in your browser and kept in local storage."
        actions={
          <>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files).then(() => (e.target.value = ""))} />
            <Button size="sm" loading={uploading} onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden className="size-4" /> Upload images
            </Button>
          </>
        }
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
        onDrop={onDrop}
        className={cx("relative grid gap-6 xl:grid-cols-[1fr_20rem]", dragging && "after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:border-2 after:border-dashed after:border-accent after:bg-accent-soft/40")}
      >
        <div className="min-w-0 rounded-md border border-line bg-card">
          <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterTabs
              label="Filter by category"
              value={cat}
              onChange={setCat}
              options={[{ value: "all", label: "All", count: counts.all }, ...CATEGORIES.map((c) => ({ value: c, label: MEDIA_CATEGORY_LABEL[c], count: counts[c] ?? 0 }))]}
            />
            <label className="relative lg:w-60">
              <span className="sr-only">Search media</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or alt text" className="h-9 w-full rounded-[3px] border border-line-strong bg-card pr-3 pl-9 text-[0.85rem] focus:border-ink focus:outline-none" />
            </label>
          </div>

          {selected.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-2 px-4 py-2 text-[0.85rem]" role="status">
              <span>{selected.length} selected</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  <X aria-hidden className="size-4" /> Clear
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(selected)}>
                  <Trash2 aria-hidden className="size-4" /> Delete
                </Button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title={media.length ? "No images match" : "Library is empty"}
              body={media.length ? "Try a different category or search." : "Upload images or drop them here."}
              action={
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  Upload images
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {items.map((m) => {
                const isSel = selected.includes(m.id);
                return (
                  <li key={m.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setFocusId(m.id)}
                      aria-label={`Details for ${m.name}`}
                      className={cx("relative block aspect-square w-full overflow-hidden rounded-[3px] bg-paper-2 ring-offset-2 ring-offset-card", focusId === m.id && "ring-2 ring-ink", isSel && "ring-2 ring-accent")}
                    >
                      <Img src={m.src} alt="" sizes="(min-width: 1280px) 15vw, (min-width: 640px) 30vw, 45vw" />
                    </button>
                    <label className={cx("absolute top-2 left-2 grid size-7 cursor-pointer place-items-center rounded-[3px] border transition-opacity", isSel ? "border-accent bg-accent text-accent-ink" : "border-white/70 bg-black/30 text-transparent opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100")}>
                      <input type="checkbox" className="sr-only" checked={isSel} onChange={() => toggle(m.id)} aria-label={`Select ${m.name}`} />
                      <Check aria-hidden className="size-4" />
                    </label>
                    <p className="mt-1.5 truncate text-[0.78rem]">{m.name}</p>
                    <p className="t-meta text-muted">{MEDIA_CATEGORY_LABEL[m.category]}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-line px-4 py-3 text-[0.78rem] text-muted">Tip: drag image files anywhere onto this area to upload. Large images are downscaled to {MAX_EDGE}px.</p>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start" aria-label="Media details">
          {focused ? (
            <MediaDetails
              key={focused.id}
              asset={focused}
              usedBy={usages({ projects, services, team }, focused.src)}
              onClose={() => setFocusId(null)}
              onDelete={() => setConfirmDelete([focused.id])}
              onCopy={() => {
                navigator.clipboard?.writeText(focused.src.startsWith("data:") ? focused.name : focused.src).then(
                  () => toast({ tone: "info", title: "Copied", body: focused.src.startsWith("data:") ? "File name copied (uploads are stored inline)." : focused.src }),
                  () => toast({ tone: "error", title: "Clipboard unavailable" }),
                );
              }}
            />
          ) : (
            <div className="rounded-md border border-dashed border-line-strong p-8 text-center text-[0.85rem] text-muted">Select an image to see its details, edit alt text or change its category.</div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.length ?? 0} file${(confirmDelete?.length ?? 0) > 1 ? "s" : ""}?`}
        description={
          inUse.length
            ? `Still in use by ${inUse.slice(0, 3).join(", ")}${inUse.length > 3 ? ` and ${inUse.length - 3} more` : ""}. Those pages will keep showing the image until you replace it, but it will no longer be in the library.`
            : "The files will be removed from the library."
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) deleteIds(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

function MediaDetails({ asset, usedBy, onClose, onDelete, onCopy }: { asset: MediaAsset; usedBy: string[]; onClose: () => void; onDelete: () => void; onCopy: () => void }) {
  const toast = useToast();
  const [alt, setAlt] = useState(asset.alt);
  const [category, setCategory] = useState(asset.category);
  const dirty = alt !== asset.alt || category !== asset.category;
  return (
    <div className="rounded-md border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="truncate text-[0.92rem] font-semibold">{asset.name}</h2>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close details">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="relative aspect-[4/3] bg-paper-2">
        <Img src={asset.src} alt={asset.alt} sizes="20rem" imgClassName="object-contain" noTone />
      </div>
      <div className="space-y-4 p-4">
        <dl className="grid grid-cols-3 gap-2 text-[0.8rem]">
          <div>
            <dt className="t-meta text-muted">Size</dt>
            <dd className="mt-0.5 tabular-nums">{formatBytes(asset.size)}</dd>
          </div>
          <div>
            <dt className="t-meta text-muted">Pixels</dt>
            <dd className="mt-0.5 tabular-nums">
              {asset.width}×{asset.height}
            </dd>
          </div>
          <div>
            <dt className="t-meta text-muted">Added</dt>
            <dd className="mt-0.5">{formatDate(asset.createdAt)}</dd>
          </div>
        </dl>
        <Field label="Alt text" hint="Describes the image for screen readers.">
          {(a) => <Input {...a} value={alt} onChange={(e) => setAlt(e.target.value)} />}
        </Field>
        <Field label="Category">
          {(a) => (
            <Select {...a} value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {MEDIA_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <p className="t-meta text-muted">Used by</p>
          {usedBy.length ? (
            <ul className="mt-1 space-y-0.5 text-[0.82rem]">
              {usedBy.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[0.82rem] text-muted">Not used anywhere yet.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            disabled={!dirty || !alt.trim()}
            onClick={() => {
              mediaDB.update(asset.id, { alt: alt.trim(), category }, `${asset.name} details updated`);
              toast({ tone: "success", title: "Media updated", body: asset.name });
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy aria-hidden className="size-4" /> Copy path
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={onDelete}>
            <Trash2 aria-hidden className="size-4" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
