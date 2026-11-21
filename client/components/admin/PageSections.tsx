"use client";

// The sections a page is built from (API_CONTRACTS §8.1): editor state, conversion to and from the
// API, browser-side checks, and one small form per section type.
import { ArrowDown, ArrowUp, Columns2, Heading, Image as ImageIcon, ImagePlus, Images, LayoutGrid, Pilcrow, Plus, RectangleHorizontal, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BiField } from "@/components/admin/BiField";
import { IconButton } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { BiRichField } from "@/components/admin/RichTextEditor";
import type { AdminBlock, ApiImage, BlockInput, RichTextDoc } from "@/lib/api";
import { isEmptyDoc, isSafeHref } from "@/lib/richtext";
import { DEFAULT_SECTION_STYLE, cleanSectionStyle, type SectionStyle } from "@/lib/style";

export type CardItem = { key: string; titleKa: string; titleEn: string; textKa: string; textEn: string; image: ApiImage | null };

type SectionBody =
  | { key: string; type: "heading"; level: 2 | 3; textKa: string; textEn: string }
  | { key: string; type: "text"; docKa: RichTextDoc | null; docEn: RichTextDoc | null }
  | { key: string; type: "image"; image: ApiImage | null; captionKa: string; captionEn: string }
  | {
      key: string;
      type: "banner";
      image: ApiImage | null;
      titleKa: string;
      titleEn: string;
      textKa: string;
      textEn: string;
      buttonLabelKa: string;
      buttonLabelEn: string;
      buttonHref: string;
    }
  | { key: string; type: "gallery"; images: ApiImage[] }
  | { key: string; type: "textImage"; image: ApiImage | null; imageSide: "left" | "right"; titleKa: string; titleEn: string; docKa: RichTextDoc | null; docEn: RichTextDoc | null }
  | { key: string; type: "cards"; titleKa: string; titleEn: string; items: CardItem[] };

/** One section in the editor: its content plus its style. */
export type Section = SectionBody & { style: SectionStyle };

export type SectionType = Section["type"];

/** What the "Add section" chooser offers, in order. */
export const SECTION_TYPES: { type: SectionType; label: string; description: string; icon: LucideIcon }[] = [
  { type: "heading", label: "Heading", description: "A section title (large or small) to structure the page.", icon: Heading },
  { type: "text", label: "Text", description: "Paragraphs with bold, italic, links and bullet lists.", icon: Pilcrow },
  { type: "image", label: "Image", description: "One photo across the text column, with an optional caption.", icon: ImageIcon },
  { type: "banner", label: "Banner", description: "Full-width photo with a title, short text and an optional button.", icon: RectangleHorizontal },
  { type: "gallery", label: "Gallery", description: "A grid of 2–30 photos; visitors can open each one larger.", icon: Images },
  { type: "textImage", label: "Text and image", description: "Text on one side, a photo on the other.", icon: Columns2 },
  { type: "cards", label: "Cards", description: "1–12 small cards, each with a title, short text and an optional photo.", icon: LayoutGrid },
];

export const sectionLabel = (type: SectionType) => SECTION_TYPES.find((s) => s.type === type)?.label ?? type;

let counter = 0;
export const newKey = (prefix = "s") => `${prefix}-${++counter}`;

const blankCard = (): CardItem => ({ key: newKey("card"), titleKa: "", titleEn: "", textKa: "", textEn: "", image: null });

export function newSection(type: SectionType): Section {
  return { ...newBody(type), style: { ...DEFAULT_SECTION_STYLE } } as Section;
}

function newBody(type: SectionType): SectionBody {
  const key = newKey();
  switch (type) {
    case "heading":
      return { key, type, level: 2, textKa: "", textEn: "" };
    case "text":
      return { key, type, docKa: null, docEn: null };
    case "image":
      return { key, type, image: null, captionKa: "", captionEn: "" };
    case "banner":
      return { key, type, image: null, titleKa: "", titleEn: "", textKa: "", textEn: "", buttonLabelKa: "", buttonLabelEn: "", buttonHref: "" };
    case "gallery":
      return { key, type, images: [] };
    case "textImage":
      return { key, type, image: null, imageSide: "right", titleKa: "", titleEn: "", docKa: null, docEn: null };
    case "cards":
      return { key, type, titleKa: "", titleEn: "", items: [blankCard()] };
  }
}

const s = (v: string | null | undefined) => v ?? "";

export function fromBlock(b: AdminBlock): Section {
  return { ...bodyFromBlock(b), style: cleanSectionStyle(b.style) } as Section;
}

function bodyFromBlock(b: AdminBlock): SectionBody {
  const key = newKey();
  switch (b.type) {
    case "heading":
      return { key, type: "heading", level: b.level, textKa: b.textKa, textEn: s(b.textEn) };
    case "text":
      // Documents load into the editor exactly as saved.
      return { key, type: "text", docKa: b.docKa, docEn: b.docEn ?? null };
    case "image":
      return { key, type: "image", image: b.image, captionKa: s(b.captionKa), captionEn: s(b.captionEn) };
    case "banner":
      return {
        key,
        type: "banner",
        image: b.image,
        titleKa: b.titleKa,
        titleEn: s(b.titleEn),
        textKa: s(b.textKa),
        textEn: s(b.textEn),
        buttonLabelKa: s(b.buttonLabelKa),
        buttonLabelEn: s(b.buttonLabelEn),
        buttonHref: s(b.buttonHref),
      };
    case "gallery":
      return { key, type: "gallery", images: b.images };
    case "textImage":
      return {
        key,
        type: "textImage",
        image: b.image,
        imageSide: b.imageSide,
        titleKa: s(b.titleKa),
        titleEn: s(b.titleEn),
        docKa: b.docKa,
        docEn: b.docEn ?? null,
      };
    case "cards":
      return {
        key,
        type: "cards",
        titleKa: s(b.titleKa),
        titleEn: s(b.titleEn),
        items: b.items.map((i) => ({ key: newKey("card"), titleKa: i.titleKa, titleEn: s(i.titleEn), textKa: s(i.textKa), textEn: s(i.textEn), image: i.image })),
      };
  }
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);
const EMPTY_DOC: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };
const docOrNull = (d: RichTextDoc | null) => (d && !isEmptyDoc(d) ? d : null);

/** The save body for one section: input fields and style only, no previews. */
export function toBlockInput(b: Section): BlockInput {
  return { ...bodyInput(b), style: b.style } as BlockInput;
}

function bodyInput(b: Section): BlockInput {
  switch (b.type) {
    case "heading":
      return { type: "heading", level: b.level, textKa: b.textKa.trim(), textEn: orNull(b.textEn) };
    case "text":
      return { type: "text", docKa: b.docKa ?? EMPTY_DOC, docEn: docOrNull(b.docEn) };
    case "image":
      return { type: "image", mediaId: b.image?.id ?? "", captionKa: orNull(b.captionKa), captionEn: orNull(b.captionEn) };
    case "banner":
      return {
        type: "banner",
        mediaId: b.image?.id ?? "",
        titleKa: b.titleKa.trim(),
        titleEn: orNull(b.titleEn),
        textKa: orNull(b.textKa),
        textEn: orNull(b.textEn),
        buttonLabelKa: orNull(b.buttonLabelKa),
        buttonLabelEn: orNull(b.buttonLabelEn),
        buttonHref: orNull(b.buttonHref),
      };
    case "gallery":
      return { type: "gallery", mediaIds: b.images.map((i) => i.id) };
    case "textImage":
      return {
        type: "textImage",
        mediaId: b.image?.id ?? "",
        imageSide: b.imageSide,
        titleKa: orNull(b.titleKa),
        titleEn: orNull(b.titleEn),
        docKa: b.docKa ?? EMPTY_DOC,
        docEn: docOrNull(b.docEn),
      };
    case "cards":
      return {
        type: "cards",
        titleKa: orNull(b.titleKa),
        titleEn: orNull(b.titleEn),
        // Card textKa is a string on the server ("" when empty), not null.
        items: b.items.map((i) => ({ titleKa: i.titleKa.trim(), titleEn: orNull(i.titleEn), textKa: i.textKa.trim(), textEn: orNull(i.textEn), mediaId: i.image?.id ?? null })),
      };
  }
}

/** Browser-side checks with the same keys the server uses (`blocks.N.field`). The server checks again. */
export function validateSection(b: Section, i: number, e: Record<string, string>) {
  const k = (f: string) => `blocks.${i}.${f}`;
  switch (b.type) {
    case "heading":
      if (!b.textKa.trim()) e[k("textKa")] = "Georgian heading text is required.";
      break;
    case "text":
      if (isEmptyDoc(b.docKa)) e[k("docKa")] = "Georgian text is required.";
      break;
    case "image":
      if (!b.image) e[k("mediaId")] = "Choose or upload an image.";
      break;
    case "banner": {
      if (!b.image) e[k("mediaId")] = "Choose or upload a photo.";
      if (!b.titleKa.trim()) e[k("titleKa")] = "Georgian title is required.";
      const hasLabel = !!(b.buttonLabelKa.trim() || b.buttonLabelEn.trim());
      const hasHref = !!b.buttonHref.trim();
      if (hasLabel !== hasHref || (hasHref && !b.buttonLabelKa.trim())) e[k("buttonHref")] = "Give the button a Georgian label and a link, or leave both empty.";
      else if (hasHref && !isSafeHref(b.buttonHref.trim())) e[k("buttonHref")] = "Use a link starting with https://, http://, mailto:, tel: or a site path like /contact.";
      break;
    }
    case "gallery":
      if (b.images.length < 2) e[k("mediaIds")] = "Choose at least 2 photos.";
      else if (b.images.length > 30) e[k("mediaIds")] = "At most 30 photos.";
      break;
    case "textImage":
      if (!b.image) e[k("mediaId")] = "Choose or upload a photo.";
      if (isEmptyDoc(b.docKa)) e[k("docKa")] = "Georgian text is required.";
      break;
    case "cards":
      if (b.items.length < 1) e[k("items")] = "Add at least one card.";
      else if (b.items.length > 12) e[k("items")] = "At most 12 cards.";
      b.items.forEach((item, j) => {
        if (!item.titleKa.trim()) e[k(`items.${j}.titleKa`)] = `Card ${j + 1}: Georgian title is required.`;
      });
      break;
  }
}

/** What to pick photos for: a section's main photo, its gallery, or one card's photo. */
export type PickTarget = { key: string; kind: "image" | "gallery" | "card"; cardKey?: string };

type EditorProps<T extends Section> = {
  section: T;
  update: (patch: Partial<T>) => void;
  pick: (target: PickTarget) => void;
  errorFor: (field: string) => string | undefined;
};

function PhotoSlot({ image, onPick, onClear, label, error, wide }: { image: ApiImage | null; onPick: () => void; onClear?: () => void; label: string; error?: string; wide?: boolean }) {
  return (
    <div className="sm:col-span-2">
      <p className="text-[0.82rem] font-medium text-ink-soft">{label}</p>
      <div className="mt-2 flex flex-wrap items-end gap-4">
        <div className={`relative overflow-hidden rounded-[3px] border border-line bg-paper-2 ${wide ? "aspect-[21/9] w-72" : "aspect-[4/3] w-56"}`}>
          {image ? <Img src={image.src} alt="" sizes="288px" /> : <span className="grid h-full place-items-center text-[0.8rem] text-muted">No photo</span>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPick}>
            <ImagePlus aria-hidden className="size-4" /> {image ? "Change photo" : "Choose or upload photo"}
          </Button>
          {image && onClear && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Remove photo
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}


/**
 * The form fields for one section. A plain function (no hooks), so the page form can call it and
 * then show any error messages that no field displayed.
 */
export function sectionFields({ section, update, pick, errorFor }: EditorProps<Section>): ReactNode {
  switch (section.type) {
    case "heading": {
      const b = section;
      return (
        <>
          <Field label="Size">
            {(a) => (
              <Select {...a} value={b.level} onChange={(e) => update({ level: Number(e.target.value) as 2 | 3 })}>
                <option value={2}>Section heading (H2)</option>
                <option value={3}>Sub-heading (H3)</option>
              </Select>
            )}
          </Field>
          <div className="max-sm:hidden" />
          <BiField label="Heading" required maxLength={150} ka={b.textKa} en={b.textEn} onKa={(v) => update({ textKa: v })} onEn={(v) => update({ textEn: v })} errorKa={errorFor("textKa")} errorEn={errorFor("textEn")} />
        </>
      );
    }
    case "text": {
      const b = section;
      return (
        <BiRichField label="Text" required ka={b.docKa} en={b.docEn} onKa={(d) => update({ docKa: d })} onEn={(d) => update({ docEn: d })} errorKa={errorFor("docKa")} errorEn={errorFor("docEn")} />
      );
    }
    case "image": {
      const b = section;
      return (
        <>
          <PhotoSlot label="Photo *" image={b.image} onPick={() => pick({ key: b.key, kind: "image" })} error={errorFor("mediaId")} />
          <BiField label="Caption" maxLength={200} ka={b.captionKa} en={b.captionEn} onKa={(v) => update({ captionKa: v })} onEn={(v) => update({ captionEn: v })} errorKa={errorFor("captionKa")} errorEn={errorFor("captionEn")} />
        </>
      );
    }
    case "banner": {
      const b = section;
      return (
        <>
          <PhotoSlot label="Background photo *" wide image={b.image} onPick={() => pick({ key: b.key, kind: "image" })} error={errorFor("mediaId")} />
          <BiField label="Title" required maxLength={120} ka={b.titleKa} en={b.titleEn} onKa={(v) => update({ titleKa: v })} onEn={(v) => update({ titleEn: v })} errorKa={errorFor("titleKa")} errorEn={errorFor("titleEn")} />
          <BiField label="Short text" multiline rows={3} maxLength={300} ka={b.textKa} en={b.textEn} onKa={(v) => update({ textKa: v })} onEn={(v) => update({ textEn: v })} errorKa={errorFor("textKa")} errorEn={errorFor("textEn")} />
          <BiField label="Button label" maxLength={40} hint="Optional" ka={b.buttonLabelKa} en={b.buttonLabelEn} onKa={(v) => update({ buttonLabelKa: v })} onEn={(v) => update({ buttonLabelEn: v })} errorKa={errorFor("buttonLabelKa")} errorEn={errorFor("buttonLabelEn")} />
          <div className="sm:col-span-2">
            <Field label="Button link" error={errorFor("buttonHref")} hint="A site page like /contact, or a full address like https://… (needs a button label)">
              {(a) => <Input {...a} value={b.buttonHref} placeholder="/contact" onChange={(e) => update({ buttonHref: e.target.value })} />}
            </Field>
          </div>
        </>
      );
    }
    case "gallery": {
      const b = section;
      return (
        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.82rem] font-medium text-ink-soft">Photos · {b.images.length} (2–30)</p>
            <Button type="button" variant="outline" size="sm" onClick={() => pick({ key: b.key, kind: "gallery" })}>
              <Plus aria-hidden className="size-4" /> Select or upload photos
            </Button>
          </div>
          {b.images.length === 0 ? (
            <p className="mt-2 rounded-[3px] border border-dashed border-line-strong px-4 py-6 text-center text-[0.85rem] text-muted">No photos yet.</p>
          ) : (
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {b.images.map((img, i) => (
                <li key={img.id} className="relative aspect-square overflow-hidden rounded-[3px]">
                  <Img src={img.src} alt={`Photo ${i + 1}`} sizes="120px" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1 text-white">
                    <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => update({ images: move(b.images, i, -1) })} className="grid size-7 place-items-center rounded disabled:opacity-30">
                      <ArrowUp aria-hidden className="size-3.5 -rotate-90" />
                    </button>
                    <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => update({ images: b.images.filter((_, j) => j !== i) })} className="grid size-7 place-items-center rounded">
                      <X aria-hidden className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={i === b.images.length - 1} onClick={() => update({ images: move(b.images, i, 1) })} className="grid size-7 place-items-center rounded disabled:opacity-30">
                      <ArrowDown aria-hidden className="size-3.5 -rotate-90" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {errorFor("mediaIds") && (
            <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
              {errorFor("mediaIds")}
            </p>
          )}
        </div>
      );
    }
    case "textImage": {
      const b = section;
      return (
        <>
          <PhotoSlot label="Photo *" image={b.image} onPick={() => pick({ key: b.key, kind: "image" })} error={errorFor("mediaId")} />
          <Field label="Photo side">
            {(a) => (
              <Select {...a} value={b.imageSide} onChange={(e) => update({ imageSide: e.target.value as "left" | "right" })}>
                <option value="right">Photo on the right</option>
                <option value="left">Photo on the left</option>
              </Select>
            )}
          </Field>
          <div className="max-sm:hidden" />
          <BiField label="Title" maxLength={120} hint="Optional" ka={b.titleKa} en={b.titleEn} onKa={(v) => update({ titleKa: v })} onEn={(v) => update({ titleEn: v })} errorKa={errorFor("titleKa")} errorEn={errorFor("titleEn")} />
          <BiRichField label="Text" required ka={b.docKa} en={b.docEn} onKa={(d) => update({ docKa: d })} onEn={(d) => update({ docEn: d })} errorKa={errorFor("docKa")} errorEn={errorFor("docEn")} />
        </>
      );
    }
    case "cards": {
      const b = section;
      const setItem = (key: string, patch: Partial<CardItem>) => update({ items: b.items.map((x) => (x.key === key ? { ...x, ...patch } : x)) });
      return (
        <>
          <BiField label="Section title" maxLength={120} hint="Optional" ka={b.titleKa} en={b.titleEn} onKa={(v) => update({ titleKa: v })} onEn={(v) => update({ titleEn: v })} errorKa={errorFor("titleKa")} errorEn={errorFor("titleEn")} />
          <div className="space-y-3 sm:col-span-2">
            {b.items.map((item, j) => (
              <div key={item.key} className="rounded-[3px] border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="t-meta text-muted">Card {j + 1}</p>
                  <div className="flex">
                    <IconButton label={`Move card ${j + 1} earlier`} icon={ArrowUp} disabled={j === 0} onClick={() => update({ items: move(b.items, j, -1) })} />
                    <IconButton label={`Move card ${j + 1} later`} icon={ArrowDown} disabled={j === b.items.length - 1} onClick={() => update({ items: move(b.items, j, 1) })} />
                    <IconButton label={`Remove card ${j + 1}`} icon={Trash2} tone="danger" disabled={b.items.length === 1} onClick={() => update({ items: b.items.filter((x) => x.key !== item.key) })} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <BiField label="Card title" required maxLength={80} ka={item.titleKa} en={item.titleEn} onKa={(v) => setItem(item.key, { titleKa: v })} onEn={(v) => setItem(item.key, { titleEn: v })} errorKa={errorFor(`items.${j}.titleKa`)} errorEn={errorFor(`items.${j}.titleEn`)} />
                  <BiField label="Card text" multiline rows={3} maxLength={300} ka={item.textKa} en={item.textEn} onKa={(v) => setItem(item.key, { textKa: v })} onEn={(v) => setItem(item.key, { textEn: v })} errorKa={errorFor(`items.${j}.textKa`)} errorEn={errorFor(`items.${j}.textEn`)} />
                  <PhotoSlot
                    label="Photo (optional)"
                    image={item.image}
                    onPick={() => pick({ key: b.key, kind: "card", cardKey: item.key })}
                    onClear={() => setItem(item.key, { image: null })}
                    error={errorFor(`items.${j}.mediaId`)}
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" disabled={b.items.length >= 12} onClick={() => update({ items: [...b.items, blankCard()] })}>
              <Plus aria-hidden className="size-4" /> Add card ({b.items.length}/12)
            </Button>
            {errorFor("items") && (
              <p role="alert" className="text-[0.8rem] text-danger">
                {errorFor("items")}
              </p>
            )}
          </div>
        </>
      );
    }
  }
}

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const next = [...arr];
  [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
  return next;
}
