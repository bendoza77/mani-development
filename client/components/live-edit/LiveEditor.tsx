"use client";

import { useEffect, useState, type ReactNode } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Copy, ExternalLink, GripVertical, ImagePlus, Palette, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { SECTION_TYPES, fromBlock, newKey, newSection, sectionLabel, toBlockInput, validateSection, type PickTarget, type Section, type SectionType } from "@/components/admin/PageSections";
import { InlineRichText } from "@/components/admin/RichTextEditor";
import { SortableItem, SortableList } from "@/components/admin/SortableList";
import { PageColorsPanel, SectionStylePanel } from "@/components/admin/StyleControls";
import { KIND, blockAlign, containerClass } from "@/components/sections/PageBlocks";
import { PageIntro } from "@/components/sections/PageIntro";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, errorsFrom, type AdminPage, type ApiImage, type PageInput, type RichTextDoc } from "@/lib/api";
import { cx } from "@/lib/format";
import { ALIGN_CLASS, CHROME_STYLE, PADDING_CLASS, cleanPageStyle, pageColorStyle, sectionColorStyle, type PageStyle, type SectionStyle } from "@/lib/style";
import { InlineText } from "./InlineText";

type Lang = "ka" | "en";

type Draft = {
  kind: AdminPage["kind"];
  slug: string;
  titleKa: string;
  titleEn: string;
  introKa: string;
  introEn: string;
  isPublished: boolean;
  sections: Section[];
  style: PageStyle;
};

function fromPage(p: AdminPage): Draft {
  return {
    kind: p.kind,
    slug: p.slug,
    titleKa: p.titleKa,
    titleEn: p.titleEn ?? "",
    introKa: p.introKa,
    introEn: p.introEn ?? "",
    isPublished: p.isPublished,
    sections: p.blocks.map(fromBlock),
    style: cleanPageStyle(p.style),
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/** The full save body. The menu is left out, so the page's menu entries stay as they are. */
function toInput(d: Draft): PageInput {
  return {
    slug: d.slug,
    titleKa: d.titleKa.trim(),
    titleEn: orNull(d.titleEn),
    introKa: d.introKa.trim(),
    introEn: orNull(d.introEn),
    isPublished: d.isPublished,
    blocks: d.sections.map(toBlockInput),
    style: d.style,
  };
}

/** A copy of a section with fresh keys (cards keep their content but get new item keys). */
function duplicate(s: Section): Section {
  const copy = structuredClone(s) as Section;
  copy.key = newKey();
  if (copy.type === "cards") copy.items = copy.items.map((i) => ({ ...i, key: newKey("card") }));
  return copy;
}

type Panel = { kind: "section"; key: string } | { kind: "page" } | null;

/** Edit the page in place, in its real look. `onClose(true)` after a successful save. */
export function LiveEditor({ pageId, onClose }: { pageId: string; onClose: (saved: boolean) => void }) {
  const toast = useToast();
  const { data: loaded, error: loadError } = useApiData<AdminPage>(`/api/admin/pages/${pageId}`);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [adopted, setAdopted] = useState<AdminPage | undefined>(undefined);
  if (loaded && adopted !== loaded) {
    const d = fromPage(loaded);
    setAdopted(loaded);
    setDraft(d);
    setBaseline(JSON.stringify(d));
  }

  const [lang, setLang] = useState<Lang>("ka");
  const [panel, setPanel] = useState<Panel>(null);
  const [chooserAt, setChooserAt] = useState<number | null>(null);
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = draft !== null && JSON.stringify(draft) !== baseline;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Esc closes the side panel.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("dialog[open]")) setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  if (loadError) {
    return (
      <div style={CHROME_STYLE} className="shell py-40 text-center">
        <p className="font-medium">Could not open the editor</p>
        <p className="mt-1 text-[0.9rem] text-muted">{loadError.message}</p>
        <button type="button" onClick={() => onClose(false)} className="mt-4 underline">
          Back to the page
        </button>
      </div>
    );
  }
  if (!draft) {
    return (
      <div className="shell py-40 text-center text-muted" role="status">
        Opening the editor…
      </div>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setSections = (fn: (list: Section[]) => Section[]) => {
    setDraft((d) => (d ? { ...d, sections: fn(d.sections) } : d));
    setErrors({});
  };
  const update = (key: string, patch: Partial<Section>) => setDraft((d) => (d ? { ...d, sections: d.sections.map((s) => (s.key === key ? ({ ...s, ...patch } as Section) : s)) } : d));
  const updateStyle = (key: string, patch: Partial<SectionStyle>) =>
    setDraft((d) => (d ? { ...d, sections: d.sections.map((s) => (s.key === key ? { ...s, style: { ...s.style, ...patch } } : s)) } : d));
  const move = (from: number, to: number) => setSections((list) => arrayMove(list, from, to));

  const insert = (type: SectionType, at: number) => {
    const section = newSection(type);
    setSections((list) => [...list.slice(0, at), section, ...list.slice(at)]);
    setChooserAt(null);
    // Sections that need a photo open the picker straight away.
    if (type === "image" || type === "banner" || type === "textImage") setPicking({ key: section.key, kind: "image" });
    if (type === "gallery") setPicking({ key: section.key, kind: "gallery" });
  };

  // Photo picking for whichever section asked.
  const picked = picking ? draft.sections.find((s) => s.key === picking.key) : undefined;
  const pickerInitial: ApiImage[] = (() => {
    if (!picking || !picked) return [];
    if (picking.kind === "gallery") return picked.type === "gallery" ? picked.images : [];
    if (picking.kind === "card") {
      const card = picked.type === "cards" ? picked.items.find((c) => c.key === picking.cardKey) : undefined;
      return card?.image ? [card.image] : [];
    }
    return "image" in picked && picked.image ? [picked.image] : [];
  })();
  const onPicked = (images: ApiImage[]) => {
    if (!picking || !picked) return;
    if (picking.kind === "gallery") update(picking.key, { images });
    else if (picking.kind === "card" && picked.type === "cards") {
      update(picking.key, { items: picked.items.map((c) => (c.key === picking.cardKey ? { ...c, image: images[0] ?? null } : c)) });
    } else if (images[0]) update(picking.key, { image: images[0] } as Partial<Section>);
  };

  async function save() {
    if (!draft) return;
    const problems: Record<string, string> = {};
    if (!draft.titleKa.trim()) problems.titleKa = "The Georgian page title is required.";
    draft.sections.forEach((s, i) => validateSection(s, i, problems));
    if (Object.keys(problems).length) {
      setErrors(problems);
      toast({ tone: "error", title: "Not saved yet", body: `${Object.keys(problems).length} thing(s) need attention (marked in red).` });
      return;
    }
    setSaving(true);
    try {
      await api<AdminPage>(`/api/admin/pages/${pageId}`, { method: "PUT", body: toInput(draft) });
      setBaseline(JSON.stringify(draft));
      toast({ tone: "success", title: "Page saved", body: draft.isPublished || draft.kind === "system" ? "The changes are live." : "Saved as a draft." });
      onClose(true);
    } catch (error) {
      setSaving(false);
      const { fields, message } = errorsFrom(error);
      setErrors(fields);
      toast({ tone: "error", title: "Could not save", body: Object.keys(fields).length ? "Some content needs attention (marked in red)." : message });
    }
  }

  const cancel = () => (dirty ? setConfirmCancel(true) : onClose(false));
  const panelSection = panel?.kind === "section" ? draft.sections.find((s) => s.key === panel.key) : undefined;
  const panelIndex = panelSection ? draft.sections.indexOf(panelSection) : -1;
  const colors = pageColorStyle(draft.style);
  const errorCount = Object.keys(errors).length;
  const sectionErrors = (i: number) => Object.entries(errors).filter(([k]) => k.startsWith(`blocks.${i}.`) || k === `blocks.${i}`).map(([, v]) => v);

  const t = (ka: string, en: string) => (lang === "ka" ? ka : en);
  const langProps = { lang, resetKey: lang };

  return (
    <>
      <div style={colors} className={cx("pb-28", colors && "page-has-colors")}>
        <PageIntro
          eyebrow="MANI DEVELOPMENT"
          title={
            <InlineText
              value={t(draft.titleKa, draft.titleEn)}
              placeholder={t("Page title", draft.titleKa || "Page title")}
              label={`Page title (${lang === "ka" ? "Georgian" : "English"})`}
              maxLength={120}
              onChange={(v) => set(lang === "ka" ? { titleKa: v } : { titleEn: v })}
              {...langProps}
            />
          }
          lead={
            <InlineText
              value={t(draft.introKa, draft.introEn)}
              placeholder={t("Short intro (optional)", draft.introKa || "Short intro (optional)")}
              label={`Page intro (${lang === "ka" ? "Georgian" : "English"})`}
              maxLength={400}
              multiline
              onChange={(v) => set(lang === "ka" ? { introKa: v } : { introEn: v })}
              {...langProps}
            />
          }
        />
        {errors.titleKa && (
          <p role="alert" style={CHROME_STYLE} className="shell mb-4 rounded-[3px] bg-danger-soft px-3 py-2 text-[0.85rem] text-danger">
            {errors.titleKa}
          </p>
        )}

        <article>
          <Inserter onClick={() => setChooserAt(0)} label="Add a section at the top" />
          <SortableList ids={draft.sections.map((s) => s.key)} onMove={move}>
            {draft.sections.map((s, i) => (
              <SortableItem key={s.key} id={s.key}>
                {(handle) => (
                  <>
                    <LiveSection
                      section={s}
                      index={i}
                      count={draft.sections.length}
                      lang={lang}
                      dragHandle={
                        <button
                          type="button"
                          ref={handle.setActivatorNodeRef}
                          {...handle.attributes}
                          {...handle.listeners}
                          aria-label={`Drag to move section ${i + 1} (${sectionLabel(s.type)}). Keyboard: Space to pick up, arrow keys to move, Space to drop.`}
                          title="Drag to move"
                          className="grid size-8 cursor-grab touch-none place-items-center rounded-[3px] text-muted hover:bg-paper-2 active:cursor-grabbing"
                        >
                          <GripVertical aria-hidden className="size-4" />
                        </button>
                      }
                      selected={panel?.kind === "section" && panel.key === s.key}
                      problems={sectionErrors(i)}
                      update={(patch) => update(s.key, patch)}
                      pick={setPicking}
                      onMove={(dir) => move(i, i + dir)}
                      onStyle={() => setPanel({ kind: "section", key: s.key })}
                      onDuplicate={() => setSections((list) => [...list.slice(0, i + 1), duplicate(s), ...list.slice(i + 1)])}
                      onDelete={() => setToDelete(s.key)}
                    />
                    <Inserter onClick={() => setChooserAt(i + 1)} label={`Add a section after section ${i + 1}`} />
                  </>
                )}
              </SortableItem>
            ))}
          </SortableList>
          {draft.sections.length === 0 && (
            <p style={CHROME_STYLE} className="shell rounded-md border border-dashed border-line-strong py-12 text-center text-muted">
              No sections yet. Use the + button to add one.
            </p>
          )}
        </article>
      </div>

      {/* Editing bar */}
      <div style={CHROME_STYLE} role="toolbar" aria-label="Page editing" className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-2 px-4 py-2.5">
          <p className="mr-1 text-[0.85rem] font-semibold">Editing page</p>
          <div role="group" aria-label="Language being edited" className="inline-flex rounded-full bg-paper-2 p-1">
            {(["ka", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={cx("h-8 rounded-full px-3 text-[0.8rem]", lang === l ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                {l === "ka" ? "ქართული" : "English"}
              </button>
            ))}
          </div>
          <BarButton onClick={() => setPanel({ kind: "page" })} icon={Palette} pressed={panel?.kind === "page"}>
            Page colors
          </BarButton>
          <span className="flex-1" />
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8rem] text-warn" role="status">
              <span aria-hidden className="size-2 rounded-full bg-warn" /> Unsaved changes
            </span>
          ) : (
            <span className="text-[0.8rem] text-muted" role="status">
              No changes
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-[0.8rem] text-danger" role="alert">
              {errorCount} problem{errorCount === 1 ? "" : "s"}
            </span>
          )}
          <a href={`/admin/pages/${pageId}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[0.82rem] text-muted hover:bg-paper-2 hover:text-ink">
            <ExternalLink aria-hidden className="size-4" /> Open in admin editor
          </a>
          <button type="button" onClick={cancel} className="h-9 rounded-[3px] border border-line-strong px-4 text-[0.85rem] hover:border-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="h-9 rounded-[3px] bg-ink px-5 text-[0.85rem] font-medium text-paper hover:bg-accent disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Side panel: one section's settings, or the page colors */}
      {panel && (
        <aside
          style={CHROME_STYLE}
          aria-label={panel.kind === "page" ? "Page colors" : "Section settings"}
          className="fixed top-[var(--header-h)] right-0 bottom-[3.75rem] z-[60] flex w-[min(24rem,100vw)] flex-col border-l border-line bg-card shadow-card"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[0.95rem] font-semibold">
              {panel.kind === "page" ? "Page colors" : panelSection ? `Section ${panelIndex + 1} · ${sectionLabel(panelSection.type)}` : "Section"}
            </h2>
            <button type="button" onClick={() => setPanel(null)} aria-label="Close panel (Esc)" className="grid size-9 place-items-center rounded-[3px] hover:bg-paper-2">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {panel.kind === "page" && <PageColorsPanel value={draft.style} onChange={(patch) => setDraft((d) => (d ? { ...d, style: { ...d.style, ...patch } } : d))} />}
            {panelSection && (
              <>
                <SectionSettings section={panelSection} update={(patch) => update(panelSection.key, patch)} pick={setPicking} />
                <SectionStylePanel bare value={panelSection.style} page={draft.style} onChange={(patch) => updateStyle(panelSection.key, patch)} />
              </>
            )}
          </div>
        </aside>
      )}

      {/* Dialogs use the editing palette, not the page's colors */}
      <div style={CHROME_STYLE}>
        <Dialog open={chooserAt !== null} onClose={() => setChooserAt(null)} title="Add a section" description="Choose what to add here." size="lg">
          <ul className="grid gap-2 sm:grid-cols-2">
            {SECTION_TYPES.map((type) => (
              <li key={type.type}>
                <button
                  type="button"
                  onClick={() => chooserAt !== null && insert(type.type, chooserAt)}
                  className="flex h-full w-full items-start gap-3 rounded-[3px] border border-line p-3 text-left hover:border-ink hover:bg-paper-2"
                >
                  <type.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
                  <span>
                    <span className="block text-[0.9rem] font-medium">{type.label}</span>
                    <span className="block text-[0.8rem] text-muted">{type.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
        <ImagePicker
          open={picking !== null}
          onClose={() => setPicking(null)}
          multiple={picking?.kind === "gallery"}
          initial={pickerInitial}
          onSelect={onPicked}
          title={picking?.kind === "gallery" ? "Select gallery photos" : "Choose a photo"}
        />
        <ConfirmDialog
          open={toDelete !== null}
          onClose={() => setToDelete(null)}
          title="Delete this section?"
          description="It disappears from the page when you save. Until then, Cancel brings it back."
          confirmLabel="Delete section"
          onConfirm={() => {
            const key = toDelete;
            setToDelete(null);
            if (panel?.kind === "section" && panel.key === key) setPanel(null);
            setSections((list) => list.filter((s) => s.key !== key));
          }}
        />
        <ConfirmDialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          title="Discard your changes?"
          description="Everything you changed since opening the editor will be lost."
          confirmLabel="Discard changes"
          onConfirm={() => {
            setConfirmCancel(false);
            onClose(false);
          }}
        />
      </div>
    </>
  );
}

function BarButton({ onClick, icon: Icon, pressed, children }: { onClick: () => void; icon: typeof Palette; pressed?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cx("inline-flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[0.82rem]", pressed ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2")}
    >
      <Icon aria-hidden className="size-4" /> {children}
    </button>
  );
}

/** The "+" between sections. */
function Inserter({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div style={CHROME_STYLE} className="group/ins relative flex h-6 items-center justify-center">
      <span aria-hidden className="absolute inset-x-[var(--gutter)] top-1/2 h-px bg-accent/40 opacity-0 transition-opacity group-focus-within/ins:opacity-100 group-hover/ins:opacity-100" />
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="relative grid size-7 place-items-center rounded-full border border-line-strong bg-card text-ink-soft opacity-40 shadow-sm transition-opacity group-hover/ins:opacity-100 hover:border-ink focus-visible:opacity-100"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** Settings that aren't text on the page: heading size, button link, photo side, gallery photos. */
function SectionSettings({ section, update, pick }: { section: Section; update: (patch: Partial<Section>) => void; pick: (t: PickTarget) => void }) {
  switch (section.type) {
    case "heading":
      return (
        <Field label="Heading size">
          {(a) => (
            <Select {...a} value={section.level} onChange={(e) => update({ level: Number(e.target.value) as 2 | 3 })}>
              <option value={2}>Section heading (H2)</option>
              <option value={3}>Sub-heading (H3)</option>
            </Select>
          )}
        </Field>
      );
    case "banner":
      return (
        <Field label="Button link" hint="A site page like /contact, or https://… The button label is edited on the page. Leave both empty for no button.">
          {(a) => <Input {...a} value={section.buttonHref} placeholder="/contact" onChange={(e) => update({ buttonHref: e.target.value })} />}
        </Field>
      );
    case "textImage":
      return (
        <Field label="Photo side">
          {(a) => (
            <Select {...a} value={section.imageSide} onChange={(e) => update({ imageSide: e.target.value as "left" | "right" })}>
              <option value="right">Photo on the right</option>
              <option value="left">Photo on the left</option>
            </Select>
          )}
        </Field>
      );
    case "gallery":
      return (
        <button type="button" onClick={() => pick({ key: section.key, kind: "gallery" })} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line-strong px-3 text-[0.85rem] hover:border-ink">
          <ImagePlus aria-hidden className="size-4" /> Choose photos ({section.images.length})
        </button>
      );
    default:
      return null;
  }
}

type LiveSectionProps = {
  section: Section;
  index: number;
  count: number;
  lang: Lang;
  /** The drag handle button (built where the sortable item's handle is available). */
  dragHandle: ReactNode;
  selected: boolean;
  problems: string[];
  update: (patch: Partial<Section>) => void;
  pick: (t: PickTarget) => void;
  onMove: (dir: -1 | 1) => void;
  onStyle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/** One section, in its real look, with text editable in place and a small tool bar on hover/focus. */
function LiveSection(props: LiveSectionProps) {
  const { section: s, index, count, dragHandle, selected, problems } = props;
  const label = `${index + 1} · ${sectionLabel(s.type)}`;
  return (
    <section
      style={sectionColorStyle(s.style)}
      className={cx(
        "group/sec relative",
        PADDING_CLASS[s.style.padding],
        ALIGN_CLASS[s.style.align],
        "outline-2 -outline-offset-2 outline-accent/60 hover:outline-dashed focus-within:outline-dashed",
        selected && "outline-solid!",
        problems.length > 0 && "outline-solid! outline-danger!",
      )}
    >
      {/* Section tools */}
      <div
        style={CHROME_STYLE}
        role="toolbar"
        aria-label={`Section ${label}`}
        className={cx(
          "absolute top-2 left-2 z-20 flex items-center gap-0.5 rounded-md border border-line bg-card p-0.5 text-left shadow-card transition-opacity",
          // Keyboard focus scrolls the tools into view below the fixed site header.
          "[&>*]:scroll-mt-[calc(var(--header-h)+1rem)]",
          selected || problems.length ? "opacity-100" : "opacity-0 group-hover/sec:opacity-100 focus-within:opacity-100",
        )}
      >
        {dragHandle}
        <span className="px-1.5 text-[0.75rem] text-muted">{label}</span>
        <Tool label={`Move section ${index + 1} up`} icon={ArrowUp} disabled={index === 0} onClick={() => props.onMove(-1)} />
        <Tool label={`Move section ${index + 1} down`} icon={ArrowDown} disabled={index === count - 1} onClick={() => props.onMove(1)} />
        <Tool label={`Style and settings for section ${index + 1}`} icon={SlidersHorizontal} onClick={props.onStyle} pressed={selected} />
        <Tool label={`Duplicate section ${index + 1}`} icon={Copy} onClick={props.onDuplicate} />
        <Tool label={`Delete section ${index + 1}`} icon={Trash2} danger onClick={props.onDelete} />
      </div>
      {problems.length > 0 && (
        <div style={CHROME_STYLE} role="alert" className="shell mt-10 mb-3 rounded-[3px] bg-danger-soft px-3 py-2 text-left text-[0.85rem] text-danger">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
      <div className={containerClass(s.style.width, KIND[s.type])}>
        <SectionContent {...props} />
      </div>
    </section>
  );
}

function Tool({ label, icon: Icon, onClick, disabled, danger, pressed }: { label: string; icon: typeof X; onClick: () => void; disabled?: boolean; danger?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cx(
        "grid size-8 place-items-center rounded-[3px] disabled:opacity-30",
        pressed ? "bg-ink text-paper" : danger ? "text-danger hover:bg-danger-soft" : "text-ink-soft hover:bg-paper-2",
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

/** "Change photo" over a photo. */
function PhotoButton({ onClick, label, hasPhoto }: { onClick: () => void; label: string; hasPhoto: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={CHROME_STYLE}
      aria-label={label}
      className="absolute right-3 bottom-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-full bg-card/95 px-3 text-[0.8rem] shadow-card hover:bg-card"
    >
      <ImagePlus aria-hidden className="size-4" /> {hasPhoto ? "Change photo" : "Add photo"}
    </button>
  );
}

function SectionContent({ section: s, lang, update, pick }: LiveSectionProps) {
  const ka = lang === "ka";
  const who = ka ? "Georgian" : "English";
  // For English, an empty field shows the Georgian text as a hint (that's what visitors would see).
  const ph = (kaValue: string, fallback: string) => (ka ? fallback : kaValue || fallback);
  const common = { lang, resetKey: `${s.key}-${lang}` };
  const align = blockAlign(s.style.align);

  switch (s.type) {
    case "heading": {
      const Tag = s.level === 2 ? "h2" : "h3";
      return (
        <InlineText
          as={Tag}
          className={s.level === 2 ? "t-h2" : "t-h3"}
          value={ka ? s.textKa : s.textEn}
          placeholder={ph(s.textKa, "Heading")}
          label={`Heading (${who})`}
          maxLength={150}
          onChange={(v) => update(ka ? { textKa: v } : { textEn: v })}
          {...common}
        />
      );
    }
    case "text":
      return (
        <RichField
          key={`${s.key}-${lang}`}
          lang={lang}
          value={ka ? s.docKa : s.docEn}
          kaEmpty={!s.docKa}
          onChange={(d) => update(ka ? { docKa: d } : { docEn: d })}
          className="space-y-4 text-[1.05rem] leading-[1.75] text-ink-soft"
        />
      );
    case "image":
      return (
        <figure>
          <div className="relative overflow-hidden rounded-[2px] bg-paper-2" style={{ aspectRatio: s.image ? `${s.image.width} / ${s.image.height}` : "16 / 9" }}>
            {s.image && <Img src={s.image.src} alt={s.image.alt} sizes="(min-width: 768px) 48rem, 100vw" />}
            <PhotoButton hasPhoto={!!s.image} label="Choose the photo for this section" onClick={() => pick({ key: s.key, kind: "image" })} />
          </div>
          <InlineText
            as="figcaption"
            className="mt-2 block text-[0.85rem] text-muted"
            value={ka ? s.captionKa : s.captionEn}
            placeholder={ph(s.captionKa, "Caption (optional)")}
            label={`Photo caption (${who})`}
            maxLength={200}
            onChange={(v) => update(ka ? { captionKa: v } : { captionEn: v })}
            {...common}
          />
        </figure>
      );
    case "banner":
      return (
        <div className="relative isolate flex min-h-[clamp(22rem,50vw,34rem)] flex-col justify-end overflow-hidden bg-night text-white">
          {s.image && <Img src={s.image.src} alt="" sizes="100vw" className="-z-10" />}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
          <PhotoButton hasPhoto={!!s.image} label="Choose the banner photo" onClick={() => pick({ key: s.key, kind: "image" })} />
          <div className="shell py-[clamp(2rem,6vw,4rem)]">
            <InlineText
              as="h2"
              className={cx("t-h2 block max-w-[18ch] text-white", align)}
              value={ka ? s.titleKa : s.titleEn}
              placeholder={ph(s.titleKa, "Banner title")}
              label={`Banner title (${who})`}
              maxLength={120}
              onChange={(v) => update(ka ? { titleKa: v } : { titleEn: v })}
              {...common}
            />
            <InlineText
              as="p"
              className={cx("t-lead mt-4 block max-w-2xl text-white/85", align)}
              value={ka ? s.textKa : s.textEn}
              placeholder={ph(s.textKa, "Short text (optional)")}
              label={`Banner text (${who})`}
              maxLength={300}
              multiline
              onChange={(v) => update(ka ? { textKa: v } : { textEn: v })}
              {...common}
            />
            <span className="mt-8 inline-flex h-13 items-center gap-2 rounded-[3px] bg-white px-7 text-[0.95rem] font-medium text-[#151617]">
              <InlineText
                value={ka ? s.buttonLabelKa : s.buttonLabelEn}
                placeholder={ph(s.buttonLabelKa, "Button label (optional)")}
                label={`Button label (${who}). The link is set in the section settings.`}
                maxLength={40}
                onChange={(v) => update(ka ? { buttonLabelKa: v } : { buttonLabelEn: v })}
                {...common}
              />
            </span>
          </div>
        </div>
      );
    case "gallery":
      return (
        <div>
          {s.images.length ? (
            <ul className="grid grid-cols-2 gap-[clamp(0.5rem,1.2vw,1rem)] md:grid-cols-4">
              {s.images.map((img) => (
                <li key={img.id} className="relative aspect-[4/3] overflow-hidden rounded-[2px]">
                  <Img src={img.src} alt={img.alt} sizes="25vw" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[2px] border border-dashed border-line-strong py-10 text-center text-muted">No photos yet (choose 2 to 30).</p>
          )}
          <button
            type="button"
            style={CHROME_STYLE}
            onClick={() => pick({ key: s.key, kind: "gallery" })}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-[0.8rem] shadow-card"
          >
            <ImagePlus aria-hidden className="size-4" /> Choose photos ({s.images.length})
          </button>
        </div>
      );
    case "textImage":
      return (
        <div className="grid items-center gap-[clamp(1.5rem,4vw,4rem)] lg:grid-cols-12">
          <div className={cx("relative aspect-[4/3] overflow-hidden rounded-[2px] bg-paper-2 lg:col-span-6", s.imageSide === "left" ? "lg:order-1" : "lg:order-2")}>
            {s.image && <Img src={s.image.src} alt={s.image.alt} sizes="(min-width: 1024px) 48vw, 100vw" />}
            <PhotoButton hasPhoto={!!s.image} label="Choose the photo for this section" onClick={() => pick({ key: s.key, kind: "image" })} />
          </div>
          <div className={cx("lg:col-span-6", s.imageSide === "left" ? "lg:order-2 lg:pl-4" : "lg:order-1 lg:pr-4")}>
            <InlineText
              as="h2"
              className="t-h2 block"
              value={ka ? s.titleKa : s.titleEn}
              placeholder={ph(s.titleKa, "Title (optional)")}
              label={`Title (${who})`}
              maxLength={120}
              onChange={(v) => update(ka ? { titleKa: v } : { titleEn: v })}
              {...common}
            />
            <div className="mt-6">
              <RichField
                key={`${s.key}-${lang}`}
                lang={lang}
                value={ka ? s.docKa : s.docEn}
                kaEmpty={!s.docKa}
                onChange={(d) => update(ka ? { docKa: d } : { docEn: d })}
                className="space-y-4 leading-[1.75] text-ink-soft"
              />
            </div>
          </div>
        </div>
      );
    case "cards": {
      const setItem = (key: string, patch: Partial<(typeof s.items)[number]>) => update({ items: s.items.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
      return (
        <>
          <InlineText
            as="h2"
            className={cx("t-h2 block max-w-[20ch]", align)}
            value={ka ? s.titleKa : s.titleEn}
            placeholder={ph(s.titleKa, "Section title (optional)")}
            label={`Cards section title (${who})`}
            maxLength={120}
            onChange={(v) => update(ka ? { titleKa: v } : { titleEn: v })}
            {...common}
          />
          <ul className="mt-10 grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((item, j) => (
              <li key={item.key} className="relative border-t border-line pt-5">
                <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[2px] bg-paper-2">
                  {item.image && <Img src={item.image.src} alt={item.image.alt} sizes="33vw" />}
                  <PhotoButton hasPhoto={!!item.image} label={`Choose a photo for card ${j + 1} (optional)`} onClick={() => pick({ key: s.key, kind: "card", cardKey: item.key })} />
                  {item.image && (
                    <button
                      type="button"
                      style={CHROME_STYLE}
                      onClick={() => setItem(item.key, { image: null })}
                      className="absolute top-3 right-3 z-10 rounded-full bg-card/95 px-3 py-1 text-[0.75rem] shadow-card"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
                <InlineText
                  as="h3"
                  className="block font-display text-[1.35rem] leading-snug"
                  value={ka ? item.titleKa : item.titleEn}
                  placeholder={ph(item.titleKa, "Card title")}
                  label={`Card ${j + 1} title (${who})`}
                  maxLength={80}
                  onChange={(v) => setItem(item.key, ka ? { titleKa: v } : { titleEn: v })}
                  {...common}
                />
                <InlineText
                  as="p"
                  className="mt-2 block leading-relaxed text-ink-soft"
                  value={ka ? item.textKa : item.textEn}
                  placeholder={ph(item.textKa, "Short text (optional)")}
                  label={`Card ${j + 1} text (${who})`}
                  maxLength={300}
                  multiline
                  onChange={(v) => setItem(item.key, ka ? { textKa: v } : { textEn: v })}
                  {...common}
                />
                {s.items.length > 1 && (
                  <button
                    type="button"
                    style={CHROME_STYLE}
                    onClick={() => update({ items: s.items.filter((c) => c.key !== item.key) })}
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-[0.75rem] text-danger shadow-sm"
                  >
                    <Trash2 aria-hidden className="size-3.5" /> Remove card {j + 1}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {s.items.length < 12 && (
            <button
              type="button"
              style={CHROME_STYLE}
              onClick={() => update({ items: [...s.items, { key: newKey("card"), titleKa: "", titleEn: "", textKa: "", textEn: "", image: null }] })}
              className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-[0.8rem] shadow-card"
            >
              <Plus aria-hidden className="size-4" /> Add card ({s.items.length}/12)
            </button>
          )}
        </>
      );
    }
  }
}

/** Rich text in place, with a note when English is empty (visitors then see the Georgian text). */
function RichField({ value, onChange, lang, kaEmpty, className }: { value: RichTextDoc | null; onChange: (d: RichTextDoc | null) => void; lang: Lang; kaEmpty: boolean; className: string }) {
  return (
    <div>
      {lang === "en" && !value && (
        <p style={CHROME_STYLE} className="mb-2 inline-block rounded-full bg-paper-2 px-3 py-1 text-[0.75rem] text-muted">
          {kaEmpty ? "Empty in both languages" : "English is empty: visitors see the Georgian text"}
        </p>
      )}
      <InlineRichText value={value} onChange={onChange} lang={lang} label={`Text (${lang === "ka" ? "Georgian" : "English"})`} className={className} />
    </div>
  );
}
