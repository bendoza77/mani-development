"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Img } from "@/components/ui/Img";
import { useDB } from "@/lib/store";
import { MEDIA_CATEGORY_LABEL, cx } from "@/lib/format";
import type { MediaCategory } from "@/lib/types";

/** Choose one or more images from the simulated media library. */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  initial = [],
  title = "Choose an image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (srcs: string[]) => void;
  multiple?: boolean;
  initial?: string[];
  title?: string;
}) {
  const media = useDB((d) => d.media);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<MediaCategory | "all">("all");
  const [picked, setPicked] = useState<string[]>(initial);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setPicked(initial);
  }

  const items = useMemo(
    () => media.filter((m) => (cat === "all" || m.category === cat) && (!q.trim() || `${m.name} ${m.alt}`.toLowerCase().includes(q.trim().toLowerCase()))),
    [media, q, cat],
  );

  const toggle = (src: string) =>
    setPicked((p) => (multiple ? (p.includes(src) ? p.filter((x) => x !== src) : [...p, src]) : [src]));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={multiple ? "Select images in the order they should appear." : "Pick one image from the media library."}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[0.82rem] text-muted">{picked.length} selected</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!picked.length}
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
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search media</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search media" className="h-9 w-full rounded-[3px] border border-line-strong bg-card pr-3 pl-9 text-[0.85rem] focus:border-ink focus:outline-none" />
        </label>
        <select aria-label="Media category" value={cat} onChange={(e) => setCat(e.target.value as MediaCategory | "all")} className="h-9 rounded-[3px] border border-line-strong bg-card px-3 text-[0.85rem]">
          <option value="all">All categories</option>
          {(Object.keys(MEDIA_CATEGORY_LABEL) as MediaCategory[]).map((c) => (
            <option key={c} value={c}>
              {MEDIA_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-[0.88rem] text-muted">No images match.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((m) => {
            const idx = picked.indexOf(m.src);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.src)}
                  aria-pressed={idx >= 0}
                  aria-label={`${m.alt}${idx >= 0 ? ", selected" : ""}`}
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
