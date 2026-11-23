"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { publicPathOf } from "@/components/admin/PagesAdmin";
import { SECTION_TYPES, sectionFields, fromBlock, newSection, sectionLabel, toBlockInput, validateSection, type PickTarget, type Section, type SectionType } from "@/components/admin/PageSections";
import { SortableItem, SortableList } from "@/components/admin/SortableList";
import { PageColorsPanel, SectionStylePanel } from "@/components/admin/StyleControls";
import { SeoPanel, blankSeo, seoDraftFrom, seoInputFrom, validateSeo, type SeoDraft } from "@/components/admin/SeoPanel";
import { IconButton, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Toggle } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, errorsFrom, type AdminPage, type ApiImage, type PageInput } from "@/lib/api";
import { slugify } from "@/lib/format";
import { DEFAULT_PAGE_STYLE, cleanPageStyle, type PageStyle } from "@/lib/style";

type MenuDraft = {
  labelKa: string;
  labelEn: string;
  labelRu: string;
  header: { show: boolean; position: string };
  footer: { show: boolean; position: string };
};

type Draft = { slug: string; titleKa: string; titleEn: string; titleRu: string; introKa: string; introEn: string; introRu: string; isPublished: boolean; sections: Section[]; menu: MenuDraft; style: PageStyle; seo: SeoDraft };

const blankMenu = (): MenuDraft => ({ labelKa: "", labelEn: "", labelRu: "", header: { show: false, position: "" }, footer: { show: false, position: "" } });
const blank = (): Draft => ({ slug: "", titleKa: "", titleEn: "", titleRu: "", introKa: "", introEn: "", introRu: "", isPublished: false, sections: [], menu: blankMenu(), style: { ...DEFAULT_PAGE_STYLE }, seo: blankSeo() });

function fromPage(p: AdminPage): Draft {
  const m = p.menu;
  return {
    slug: p.slug,
    titleKa: p.titleKa,
    titleEn: p.titleEn ?? "",
    titleRu: p.titleRu ?? "",
    introKa: p.introKa,
    introEn: p.introEn ?? "",
    introRu: p.introRu ?? "",
    isPublished: p.isPublished,
    sections: p.blocks.map(fromBlock),
    style: cleanPageStyle(p.style),
    seo: seoDraftFrom(p.seo),
    menu: m
      ? {
          labelKa: m.labelKa ?? "",
          labelEn: m.labelEn ?? "",
          labelRu: m.labelRu ?? "",
          header: { show: m.header.show, position: m.header.position ? String(m.header.position) : "" },
          footer: { show: m.footer.show, position: m.footer.position ? String(m.footer.position) : "" },
        }
      : blankMenu(),
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);
const position = (v: string) => (v.trim() ? Number(v) : null);

function toInput(d: Draft): PageInput {
  return {
    slug: d.slug,
    titleKa: d.titleKa.trim(),
    titleEn: orNull(d.titleEn),
    titleRu: orNull(d.titleRu),
    introKa: d.introKa.trim(),
    introEn: orNull(d.introEn),
    introRu: orNull(d.introRu),
    isPublished: d.isPublished,
    blocks: d.sections.map(toBlockInput),
    style: d.style,
    seo: seoInputFrom(d.seo),
    menu: {
      labelKa: orNull(d.menu.labelKa),
      labelEn: orNull(d.menu.labelEn),
      labelRu: orNull(d.menu.labelRu),
      header: { show: d.menu.header.show, position: d.menu.header.show ? position(d.menu.header.position) : null },
      footer: { show: d.menu.footer.show, position: d.menu.footer.show ? position(d.menu.footer.position) : null },
    },
  };
}

function validate(d: Draft, isSystem: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.titleKa.trim()) e.titleKa = "Georgian title is required.";
  if (!isSystem && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) e.slug = "Use lowercase Latin letters, numbers and single hyphens.";
  d.sections.forEach((b, i) => validateSection(b, i, e));
  for (const where of ["header", "footer"] as const) {
    const p = d.menu[where].position.trim();
    if (d.menu[where].show && p && !/^[1-9]\d?$/.test(p)) e[`menu.${where}.position`] = "Use a number from 1 to 12, or leave empty.";
  }
  Object.assign(e, validateSeo(d.seo));
  return e;
}

export function PageForm({ pageId }: { pageId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const isNew = !pageId;
  const { data: loaded, error: loadError } = useApiData<AdminPage>(pageId ? `/api/admin/pages/${pageId}` : null);

  const [draft, setDraft] = useState<Draft>(blank);
  const [baseline, setBaseline] = useState(() => JSON.stringify(blank()));
  const [adopted, setAdopted] = useState<AdminPage | undefined>(undefined);
  if (loaded && adopted !== loaded) {
    const d = fromPage(loaded);
    setAdopted(loaded);
    setDraft(d);
    setBaseline(JSON.stringify(d));
  }

  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSystem = adopted?.kind === "system";
  const clientErrors = validate(draft, isSystem);
  const err = (k: string) => serverErrors[k] ?? (showErrors ? clientErrors[k] : undefined);
  const sectionErrors = (i: number) =>
    Object.entries({ ...(showErrors ? clientErrors : {}), ...serverErrors }).filter(([k]) => k.startsWith(`blocks.${i}.`) || k === `blocks.${i}`);
  const dirty = JSON.stringify(draft) !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (pageId && loadError) {
    return (
      <div className="rounded-md border border-line bg-card p-10 text-center">
        <p className="font-medium">{loadError.status === 404 ? "Page not found" : "Could not load the page"}</p>
        <p className="mt-1 text-[0.88rem] text-muted">{loadError.status === 404 ? "It may have been deleted." : loadError.message}</p>
        <Link href="/admin/pages" className="mt-4 inline-block text-[0.88rem] underline">
          Back to pages
        </Link>
      </div>
    );
  }
  if (pageId && !adopted) return <div className="h-96 animate-pulse rounded-md bg-paper-2" aria-busy="true" />;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setMenu = (patch: Partial<MenuDraft>) => {
    setDraft((d) => ({ ...d, menu: { ...d.menu, ...patch } }));
    setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("menu"))));
  };
  const setSections = (fn: (sections: Section[]) => Section[]) => {
    setDraft((d) => ({ ...d, sections: fn(d.sections) }));
    // Positions may shift, so the server's per-section messages no longer line up.
    setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("blocks."))));
  };
  const updateSection = (key: string, patch: Partial<Section>) =>
    setSections((list) => list.map((b) => (b.key === key ? ({ ...b, ...patch } as Section) : b)));
  const moveSection = (i: number, dir: -1 | 1) =>
    setSections((list) => {
      const next = [...list];
      [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
      return next;
    });
  const addSection = (type: SectionType) => {
    setSections((list) => [...list, newSection(type)]);
    setChooserOpen(false);
  };

  const setTitleKa = (titleKa: string) => setDraft((d) => ({ ...d, titleKa, slug: slugTouched ? d.slug : slugify(d.titleEn || titleKa) }));
  const setTitleEn = (titleEn: string) => setDraft((d) => ({ ...d, titleEn, slug: slugTouched ? d.slug : slugify(titleEn || d.titleKa) }));
  const setTitleRu = (titleRu: string) => setDraft((d) => ({ ...d, titleRu }));

  // Photo picking for whichever section asked.
  const pickedSection = picking ? draft.sections.find((b) => b.key === picking.key) : undefined;
  const pickerInitial: ApiImage[] = (() => {
    if (!picking || !pickedSection) return [];
    if (picking.kind === "gallery") return pickedSection.type === "gallery" ? pickedSection.images : [];
    if (picking.kind === "card") {
      const card = pickedSection.type === "cards" ? pickedSection.items.find((c) => c.key === picking.cardKey) : undefined;
      return card?.image ? [card.image] : [];
    }
    return "image" in pickedSection && pickedSection.image ? [pickedSection.image] : [];
  })();
  const onPicked = (images: ApiImage[]) => {
    if (!picking || !pickedSection) return;
    if (picking.kind === "gallery") updateSection(picking.key, { images });
    else if (picking.kind === "card" && pickedSection.type === "cards") {
      updateSection(picking.key, { items: pickedSection.items.map((c) => (c.key === picking.cardKey ? { ...c, image: images[0] ?? null } : c)) });
    } else if (images[0]) updateSection(picking.key, { image: images[0] } as Partial<Section>);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    setServerErrors({});
    const count = Object.keys(clientErrors).length;
    if (count) {
      toast({ tone: "error", title: "Check the highlighted fields", body: `${count} field(s) need attention.` });
      return;
    }
    setSaving(true);
    try {
      const body = toInput(draft);
      const saved = isNew
        ? await api<AdminPage>("/api/admin/pages", { method: "POST", body })
        : await api<AdminPage>(`/api/admin/pages/${pageId}`, { method: "PUT", body });
      setBaseline(JSON.stringify(draft));
      toast({ tone: "success", title: isNew ? "Page created" : "Changes saved", body: saved.isPublished ? `${saved.titleKa} is live on the website.` : `${saved.titleKa} is saved as a draft.` });
      router.push("/admin/pages");
    } catch (error) {
      setSaving(false);
      const { fields, message } = errorsFrom(error);
      setServerErrors(fields);
      toast({ tone: "error", title: "Could not save", body: Object.keys(fields).length ? "Check the highlighted fields." : message });
    }
  }

  async function remove() {
    try {
      await api(`/api/admin/pages/${pageId}`, { method: "DELETE" });
      toast({ tone: "success", title: "Page deleted", body: draft.titleKa });
      router.push("/admin/pages");
    } catch (error) {
      toast({ tone: "error", title: "Could not delete", body: error instanceof Error ? error.message : "" });
    }
  }

  const cancel = () => (dirty ? setConfirmLeave(true) : router.push("/admin/pages"));
  const publicPath = adopted ? publicPathOf({ ...adopted, slug: draft.slug }) : `/${draft.slug || "…"}`;
  const knownTop = new Set(["slug", "titleKa", "titleEn", "titleRu", "introKa", "introEn", "introRu"]);
  const generalErrors = Object.entries(serverErrors).filter(([k]) => !knownTop.has(k) && !k.startsWith("blocks.") && !k.startsWith("menu") && !k.startsWith("seo."));

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={isNew ? "New page" : `Edit ${adopted?.titleKa ?? ""}`}
        description={`Public address: ${publicPath}${draft.isPublished ? "" : " (draft: not shown on the website)"}`}
        actions={
          <>
            {!isNew && !isSystem && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-danger">
                <Trash2 aria-hidden className="size-4" /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              {isNew ? "Create page" : "Save changes"}
            </Button>
          </>
        }
      />

      {generalErrors.length > 0 && (
        <div role="alert" className="mb-6 rounded-[3px] bg-danger-soft px-4 py-3 text-[0.88rem] text-danger">
          {generalErrors.map(([k, v]) => (
            <p key={k}>
              {k}: {v}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Page" description="Georgian is the main language. English and Russian are optional; empty English fields show the Georgian text, empty Russian fields the English (or Georgian) text.">
            <BiField label="Title" required maxLength={120} ka={draft.titleKa} en={draft.titleEn} ru={draft.titleRu} onKa={setTitleKa} onEn={setTitleEn} onRu={setTitleRu} errorKa={err("titleKa")} errorEn={err("titleEn")} errorRu={err("titleRu")} />
            {!isSystem && (
              <div className="sm:col-span-2">
                <Field label="URL slug" required error={err("slug")} hint={`/${draft.slug || "your-page"} · Latin letters, numbers and hyphens`}>
                  {(a) => (
                    <Input
                      {...a}
                      value={draft.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                      }}
                    />
                  )}
                </Field>
              </div>
            )}
            <BiField label="Intro" multiline rows={3} maxLength={400} hint="Short text under the title" ka={draft.introKa} en={draft.introEn} ru={draft.introRu} onKa={(v) => set("introKa", v)} onEn={(v) => set("introEn", v)} onRu={(v) => set("introRu", v)} errorKa={err("introKa")} errorEn={err("introEn")} errorRu={err("introRu")} />
          </Panel>

          <section aria-label="Page sections" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[0.95rem] font-semibold">Sections · {draft.sections.length}</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setChooserOpen(true)}>
                <Plus aria-hidden className="size-4" /> Add section
              </Button>
            </div>
            {draft.sections.length === 0 && (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-10 text-center text-[0.88rem] text-muted">
                No sections yet. Use &ldquo;Add section&rdquo; to add text, photos, a banner, a gallery or cards.
              </p>
            )}
            <SortableList ids={draft.sections.map((b) => b.key)} onMove={(from, to) => setSections((list) => arrayMove(list, from, to))}>
            {draft.sections.map((b, i) => {
              const errors = sectionErrors(i);
              const shown = new Set<string>();
              const errorFor = (field: string) => {
                const key = `blocks.${i}.${field}`;
                const msg = serverErrors[key] ?? (showErrors ? clientErrors[key] : undefined);
                if (msg) shown.add(key);
                return msg;
              };
              const editor = sectionFields({ section: b, update: (patch) => updateSection(b.key, patch), pick: setPicking, errorFor });
              // Messages for fields the form doesn't show next to an input.
              const leftover = errors.filter(([k]) => !shown.has(k));
              return (
                <SortableItem key={b.key} id={b.key}>
                {(handle) => (
                <div className="rounded-md border border-line bg-card">
                  <div className="flex items-center justify-between border-b border-line px-2 py-2 sm:px-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        ref={handle.setActivatorNodeRef}
                        {...handle.attributes}
                        {...handle.listeners}
                        aria-label={`Drag to reorder section ${i + 1} (${sectionLabel(b.type)}). With the keyboard: Space to pick up, arrow keys to move, Space to drop.`}
                        title="Drag to reorder"
                        className="grid size-8 cursor-grab touch-none place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink active:cursor-grabbing"
                      >
                        <GripVertical aria-hidden className="size-4" />
                      </button>
                      <p className="t-meta text-muted">
                        {i + 1} · {sectionLabel(b.type)}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <IconButton label={`Move section ${i + 1} up`} icon={ArrowUp} disabled={i === 0} onClick={() => moveSection(i, -1)} />
                      <IconButton label={`Move section ${i + 1} down`} icon={ArrowDown} disabled={i === draft.sections.length - 1} onClick={() => moveSection(i, 1)} />
                      <IconButton label={`Remove section ${i + 1}`} icon={Trash2} tone="danger" onClick={() => setSections((list) => list.filter((x) => x.key !== b.key))} />
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 sm:grid-cols-2 [&>*]:min-w-0">
                    {editor}
                    <SectionStylePanel value={b.style} page={draft.style} onChange={(patch) => setSections((list) => list.map((x) => (x.key === b.key ? { ...x, style: { ...x.style, ...patch } } : x)))} />
                    {leftover.length > 0 && (
                      <div role="alert" className="text-[0.8rem] text-danger sm:col-span-2">
                        {leftover.map(([k, v]) => (
                          <p key={k}>{v}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )}
                </SortableItem>
              );
            })}
            </SortableList>
            {draft.sections.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setChooserOpen(true)}>
                <Plus aria-hidden className="size-4" /> Add section
              </Button>
            )}
          </section>

          <SeoPanel
            value={draft.seo}
            onChange={(patch) => {
              setDraft((d) => ({ ...d, seo: { ...d.seo, ...patch } }));
              setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("seo."))));
            }}
            error={err}
            fallbackTitle={draft.titleKa}
            fallbackDescription={draft.introKa}
            path={isSystem && adopted ? publicPathOf(adopted) : `/${draft.slug || "…"}`}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-auto">
          <div className="rounded-md border border-line bg-card p-5">
            {isSystem ? (
              <p className="text-[0.85rem] text-muted">Built-in page: always published, and its address can&rsquo;t change.</p>
            ) : (
              <Toggle checked={draft.isPublished} onChange={(v) => set("isPublished", v)} label="Published" description="Show this page on the website." />
            )}
          </div>

          <fieldset className="space-y-4 rounded-md border border-line bg-card p-5">
            <legend className="sr-only">Menu</legend>
            <div>
              <h2 aria-hidden className="text-[0.95rem] font-semibold">
                Menu
              </h2>
              <p className="mt-0.5 text-[0.8rem] text-muted">Where this page appears in the site menus.{!draft.isPublished && !isSystem ? " Draft pages are never shown." : ""}</p>
            </div>
            {(["header", "footer"] as const).map((where) => (
              <div key={where} className="space-y-2">
                <Toggle
                  checked={draft.menu[where].show}
                  onChange={(v) => setMenu({ [where]: { ...draft.menu[where], show: v } })}
                  label={where === "header" ? "Show in top menu" : "Show in footer menu"}
                />
                {draft.menu[where].show && (
                  <Field label="Position" error={err(`menu.${where}.position`) ?? err(`menu.${where}`)} hint="1 = first. Empty = keep its place, or add at the end.">
                    {(a) => (
                      <Input
                        {...a}
                        type="number"
                        min={1}
                        max={12}
                        inputMode="numeric"
                        className="w-24"
                        value={draft.menu[where].position}
                        onChange={(e) => setMenu({ [where]: { ...draft.menu[where], position: e.target.value } })}
                      />
                    )}
                  </Field>
                )}
                {!draft.menu[where].show && err(`menu.${where}`) && (
                  <p role="alert" className="text-[0.8rem] text-danger">
                    {err(`menu.${where}`)}
                  </p>
                )}
              </div>
            ))}
            <Field label="Menu label · Georgian" error={err("menu.labelKa")} hint="Optional, up to 40 characters">
              {(a) => <Input {...a} lang="ka" maxLength={40} placeholder={draft.titleKa || "Page title"} value={draft.menu.labelKa} onChange={(e) => setMenu({ labelKa: e.target.value })} />}
            </Field>
            <Field label="Menu label · English" error={err("menu.labelEn")} hint="Optional. Empty = page title">
              {(a) => <Input {...a} lang="en" maxLength={40} placeholder={draft.titleEn || draft.titleKa || "Page title"} value={draft.menu.labelEn} onChange={(e) => setMenu({ labelEn: e.target.value })} />}
            </Field>
            <Field label="Menu label · Russian" error={err("menu.labelRu")} hint="Optional. Empty = page title">
              {(a) => <Input {...a} lang="ru" maxLength={40} placeholder={draft.titleRu || draft.titleEn || draft.titleKa || "Page title"} value={draft.menu.labelRu} onChange={(e) => setMenu({ labelRu: e.target.value })} />}
            </Field>
          </fieldset>

          <PageColorsPanel value={draft.style} onChange={(patch) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }))} />

          {dirty && <p className="text-[0.8rem] text-warn">You have unsaved changes.</p>}
        </aside>
      </div>

      <Dialog
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="Add a section"
        description="Choose what to add at the end of the page. You can move it afterwards."
        size="lg"
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {SECTION_TYPES.map((t) => (
            <li key={t.type}>
              <button
                type="button"
                onClick={() => addSection(t.type)}
                className="flex h-full w-full items-start gap-3 rounded-[3px] border border-line p-3 text-left hover:border-ink hover:bg-paper-2 focus-visible:border-ink"
              >
                <t.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
                <span>
                  <span className="block text-[0.9rem] font-medium">{t.label}</span>
                  <span className="block text-[0.8rem] text-muted">{t.description}</span>
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
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Discard unsaved changes?"
        description="Your edits to this page will be lost."
        confirmLabel="Discard"
        onConfirm={() => router.push("/admin/pages")}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete "${adopted?.titleKa}"?`}
        description="The page and its menu links will be removed from the website. This cannot be undone."
        confirmLabel="Delete page"
        onConfirm={() => {
          setConfirmDelete(false);
          void remove();
        }}
      />
    </form>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-md border border-line bg-card">
      <legend className="sr-only">{title}</legend>
      <div className="border-b border-line px-5 py-3.5">
        <h2 aria-hidden className="text-[0.95rem] font-semibold">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[0.82rem] text-muted">{description}</p>}
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 [&>*]:min-w-0">{children}</div>
    </fieldset>
  );
}
