"use client";

import { useRef, useState } from "react";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import type { ApiImage, MediaAsset } from "@/lib/api";
import { IMAGE_TYPES, uploadImage } from "@/lib/media";
import { cx } from "@/lib/format";

/**
 * Choose images from the server's media library, or upload new ones (uploaded images are
 * selected automatically). Returns the chosen images in selection order.
 */
export function ImagePicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  initial = [],
  title = "Choose an image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (images: ApiImage[]) => void;
  multiple?: boolean;
  initial?: ApiImage[];
  title?: string;
}) {
  const toast = useToast();
  const { data, error: loadError, reload, update } = useApiData<{ items: MediaAsset[] }>(open ? "/api/admin/media" : null);
  const items = data?.items ?? null;
  const [picked, setPicked] = useState<ApiImage[]>(initial);
  const [uploading, setUploading] = useState(0);
  const [lastOpen, setLastOpen] = useState(open);
  const fileInput = useRef<HTMLInputElement>(null);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setPicked(initial);
  }

  const toggle = (img: ApiImage) =>
    setPicked((p) => (multiple ? (p.some((x) => x.id === img.id) ? p.filter((x) => x.id !== img.id) : [...p, img]) : [img]));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = multiple ? Array.from(files) : [files[0]!];
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const asset = await uploadImage(file);
        update((d) => ({ items: [asset, ...d.items] }));
        setPicked((p) => (multiple ? [...p, asset] : [asset]));
      } catch (error) {
        toast({ tone: "error", title: "Upload failed", body: error instanceof Error ? error.message : file.name });
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={multiple ? "Select images in the order they should appear, or upload new ones." : "Pick one image, or upload a new one."}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[0.82rem] text-muted">{picked.length} selected</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!picked.length || uploading > 0}
            onClick={() => {
              onSelect(picked);
              onClose();
            }}
          >
            Use {multiple ? "images" : "image"}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => void upload(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" loading={uploading > 0} onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden className="size-4" /> Upload {multiple ? "images" : "an image"}
        </Button>
        <span className="text-[0.8rem] text-muted">JPEG, PNG, WebP or AVIF · up to 10 MB</span>
      </div>
      {loadError ? (
        <div className="py-10 text-center text-[0.88rem]">
          <p className="text-danger">{loadError.message}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : items === null ? (
        <p className="py-12 text-center text-[0.88rem] text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-[0.88rem] text-muted">No images yet. Upload the first one.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((m) => {
            const idx = picked.findIndex((p) => p.id === m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m)}
                  aria-pressed={idx >= 0}
                  aria-label={`${m.alt || m.filename}${idx >= 0 ? ", selected" : ""}`}
                  className={cx("relative block aspect-square w-full overflow-hidden rounded-[3px] ring-offset-2 ring-offset-card", idx >= 0 && "ring-2 ring-accent")}
                >
                  <Img src={m.src} alt="" sizes="160px" />
                  {idx >= 0 && (
                    <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-accent text-[0.7rem] font-semibold text-accent-ink">
                      {multiple ? idx + 1 : <Check aria-hidden className="size-3.5" />}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
