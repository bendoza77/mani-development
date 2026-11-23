"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { Copy, ImageOff, Search, Trash2, Upload, X } from "lucide-react";
import { LoadError } from "@/components/admin/parts";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, errorMessage, orNull, type MediaAsset, type MediaUsage } from "@/lib/api";
import { IMAGE_TYPES, uploadImage } from "@/lib/media";
import { MEDIA_CATEGORY_LABEL, cx, formatBytes, formatDate } from "@/lib/format";

export function MediaAdmin() {
  const { data, error, reload, update } = useApiData<{ items: MediaAsset[] }>("/api/admin/media");
  const media = useMemo(() => data?.items ?? [], [data]);
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return media.filter((m) => !s || `${m.filename} ${m.alt}`.toLowerCase().includes(s));
  }, [media, q]);

  const focused = media.find((m) => m.id === focusId) ?? null;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading((n) => n + list.length);
    let added = 0;
    for (const file of list) {
      try {
        const asset = await uploadImage(file);
        update((d) => ({ items: [asset, ...d.items] }));
        setFocusId(asset.id);
        added++;
      } catch (err) {
        toast({ tone: "error", title: "Upload failed", body: err instanceof Error ? err.message : file.name });
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added) {
      setQ("");
      toast({ tone: "success", title: `${added} image${added > 1 ? "s" : ""} uploaded` });
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  return (
    <>
      <PageHeader
        title="Media library"
        description="Images available to projects, pages, services, team profiles and the slider."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              multiple
              hidden
              onChange={(e) => {
                const files = e.target.files;
                if (files) void upload(files).then(() => (e.target.value = ""));
              }}
            />
            <Button size="sm" loading={uploading > 0} onClick={() => fileInput.current?.click()}>
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
        className={cx(
          "relative grid gap-6 xl:grid-cols-[1fr_20rem]",
          dragging && "after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:border-2 after:border-dashed after:border-accent after:bg-accent-soft/40",
        )}
      >
        <div className="min-w-0 rounded-md border border-line bg-card">
          <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="px-1 text-[0.85rem] text-muted">{data ? `${media.length} image${media.length === 1 ? "" : "s"}` : "Loading…"}</p>
            <label className="relative sm:w-64">
              <span className="sr-only">Search media</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by file name or alt text"
                className="h-9 w-full rounded-[3px] border border-line-strong bg-card pr-3 pl-9 text-[0.85rem] focus:border-ink focus:outline-none"
              />
            </label>
          </div>

          {error ? (
            <LoadError message={error.message} onRetry={reload} />
          ) : !data ? (
            <div className="h-64 animate-pulse bg-paper-2/50" aria-busy="true" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title={media.length ? "No images match" : "Library is empty"}
              body={media.length ? "Try a different search." : "Upload images or drop them here."}
              action={
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  Upload images
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setFocusId(m.id)}
                    aria-label={`Details for ${m.filename}`}
                    aria-pressed={focusId === m.id}
                    className={cx("relative block aspect-square w-full overflow-hidden rounded-[3px] bg-paper-2 ring-offset-2 ring-offset-card", focusId === m.id && "ring-2 ring-ink")}
                  >
                    <Img src={m.src} alt="" sizes="(min-width: 1280px) 15vw, (min-width: 640px) 30vw, 45vw" />
                  </button>
                  <p className="mt-1.5 truncate text-[0.78rem]">{m.filename}</p>
                  <p className="t-meta text-muted">{formatDate(m.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line px-4 py-3 text-[0.78rem] text-muted">Tip: drag image files onto this area to upload. JPEG, PNG, WebP or AVIF, up to 10 MB each.</p>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start" aria-label="Media details">
          {focused ? (
            <MediaDetails
              key={focused.id}
              asset={focused}
              onClose={() => setFocusId(null)}
              onSaved={(saved) => update((d) => ({ items: d.items.map((m) => (m.id === saved.id ? saved : m)) }))}
              onDeleted={(id) => {
                setFocusId(null);
                update((d) => ({ items: d.items.filter((m) => m.id !== id) }));
              }}
              onCopy={() => {
                const url = new URL(focused.src, window.location.origin).href;
                navigator.clipboard?.writeText(url).then(
                  () => toast({ tone: "info", title: "Address copied", body: url }),
                  () => toast({ tone: "error", title: "Clipboard unavailable" }),
                );
              }}
            />
          ) : (
            <div className="rounded-md border border-dashed border-line-strong p-8 text-center text-[0.85rem] text-muted">Select an image to see its details.</div>
          )}
        </aside>
      </div>
    </>
  );
}

function MediaDetails({
  asset,
  onClose,
  onCopy,
  onSaved,
  onDeleted,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onCopy: () => void;
  onSaved: (a: MediaAsset) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [altKa, setAltKa] = useState(asset.altKa);
  const [altEn, setAltEn] = useState(asset.altEn ?? "");
  const [category, setCategory] = useState<MediaAsset["category"]>(asset.category);
  const [saving, setSaving] = useState(false);
  const [usedBy, setUsedBy] = useState<MediaUsage[] | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    api<{ usedBy: MediaUsage[] }>(`/api/admin/media/${asset.id}/usage`, { signal: ctrl.signal }).then(
      (r) => setUsedBy(r.usedBy),
      (err) => !ctrl.signal.aborted && setUsageError(!!err),
    );
    return () => ctrl.abort();
  }, [asset.id]);

  const dirty = altKa.trim() !== asset.altKa || (altEn.trim() || null) !== asset.altEn || category !== asset.category;

  async function save() {
    setSaving(true);
    try {
      const saved = await api<MediaAsset>(`/api/admin/media/${asset.id}`, {
        method: "PATCH",
        body: { altKa: altKa.trim(), altEn: orNull(altEn), category },
      });
      onSaved(saved);
      toast({ tone: "success", title: "Image details saved", body: saved.filename });
    } catch (err) {
      toast({ tone: "error", title: "Couldn't save", body: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/admin/media/${asset.id}`, { method: "DELETE" });
      setConfirming(false);
      onDeleted(asset.id);
      toast({ tone: "success", title: "Image deleted", body: asset.filename });
    } catch (err) {
      setConfirming(false);
      toast({ tone: "error", title: "Couldn't delete", body: errorMessage(err) });
      // Someone may have started using it meanwhile: refresh the list of places.
      api<{ usedBy: MediaUsage[] }>(`/api/admin/media/${asset.id}/usage`).then((r) => setUsedBy(r.usedBy), () => {});
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="truncate text-[0.92rem] font-semibold">{asset.filename}</h2>
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
            <dd className="mt-0.5 tabular-nums">{formatBytes(asset.bytes)}</dd>
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
        <Field label="Alt text · Georgian" hint="Describes the photo for screen readers and Google.">
          {(p) => <Input {...p} value={altKa} maxLength={300} onChange={(e) => setAltKa(e.target.value)} />}
        </Field>
        <Field label="Alt text · English">
          {(p) => <Input {...p} value={altEn} maxLength={300} onChange={(e) => setAltEn(e.target.value)} />}
        </Field>
        <Field label="Category">
          {(p) => (
            <Select {...p} value={category} onChange={(e) => setCategory(e.target.value as MediaAsset["category"])}>
              {Object.entries(MEDIA_CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!dirty} loading={saving} onClick={() => void save()}>
            Save details
          </Button>
          <Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy aria-hidden className="size-4" /> Copy address
          </Button>
        </div>

        <div className="border-t border-line pt-4">
          <p className="t-meta text-muted">Used in</p>
          {usageError ? (
            <p className="mt-1 text-[0.85rem] text-muted">Couldn&apos;t check where this image is used.</p>
          ) : usedBy === null ? (
            <p className="mt-1 text-[0.85rem] text-muted">Checking…</p>
          ) : usedBy.length === 0 ? (
            <p className="mt-1 text-[0.85rem] text-muted">Not used anywhere.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[0.85rem]">
              {usedBy.map((u) => (
                <li key={`${u.type}:${u.id}`}>
                  <Link href={u.href} className="underline underline-offset-2 hover:text-accent">
                    {u.label}
                  </Link>{" "}
                  <span className="text-muted">({u.type})</span>
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            variant="danger"
            className="mt-3"
            disabled={usedBy === null || usedBy.length > 0}
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden className="size-4" /> Delete image
          </Button>
          {usedBy && usedBy.length > 0 && <p className="mt-1.5 text-[0.78rem] text-muted">Remove it from the places above before deleting.</p>}
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete "${asset.filename}"?`}
        description="The image file is removed for good. This can't be undone."
        confirmLabel="Delete image"
        loading={deleting}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
