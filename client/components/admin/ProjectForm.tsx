"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { SeoPanel, blankSeo, seoDraftFrom, seoInputFrom, validateSeo, type SeoDraft } from "@/components/admin/SeoPanel";
import { IconButton, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Toggle } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, errorsFrom, type AdminProject, type ApiImage, type ProjectCategory, type ProjectInput, type ProjectStatus } from "@/lib/api";
import { CATEGORY_LABEL, STATUS_LABEL, slugify } from "@/lib/format";

type SpecRow = { key: string; labelKa: string; labelEn: string; valueKa: string; valueEn: string };

type Draft = {
  slug: string;
  titleKa: string;
  titleEn: string;
  summaryKa: string;
  summaryEn: string;
  descriptionKa: string;
  descriptionEn: string;
  locationKa: string;
  locationEn: string;
  cityKa: string;
  cityEn: string;
  category: ProjectCategory;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  estimatedCompletion: string;
  completionDate: string;
  featured: boolean;
  architect: string;
  isPublished: boolean;
  cover: ApiImage | null;
  gallery: ApiImage[];
  specs: SpecRow[];
  seo: SeoDraft;
};

type Errors = Record<string, string>;

let specCounter = 0;
const specKey = () => `spec-${++specCounter}`;

const blank = (): Draft => ({
  slug: "",
  titleKa: "",
  titleEn: "",
  summaryKa: "",
  summaryEn: "",
  descriptionKa: "",
  descriptionEn: "",
  locationKa: "",
  locationEn: "",
  cityKa: "",
  cityEn: "",
  category: "residential",
  status: "planning",
  progress: 0,
  startDate: "",
  estimatedCompletion: "",
  completionDate: "",
  featured: false,
  architect: "",
  isPublished: false,
  cover: null,
  gallery: [],
  specs: [],
  seo: blankSeo(),
});

function fromProject(p: AdminProject): Draft {
  return {
    slug: p.slug,
    titleKa: p.titleKa,
    titleEn: p.titleEn ?? "",
    summaryKa: p.summaryKa,
    summaryEn: p.summaryEn ?? "",
    descriptionKa: p.descriptionKa,
    descriptionEn: p.descriptionEn ?? "",
    locationKa: p.locationKa,
    locationEn: p.locationEn ?? "",
    cityKa: p.cityKa,
    cityEn: p.cityEn ?? "",
    category: p.category,
    status: p.status,
    progress: p.progress,
    startDate: p.startDate.slice(0, 10),
    estimatedCompletion: p.estimatedCompletion.slice(0, 10),
    completionDate: p.completionDate?.slice(0, 10) ?? "",
    featured: p.featured,
    architect: p.architect,
    isPublished: p.isPublished,
    cover: p.cover,
    gallery: p.gallery,
    specs: p.specs.map((s) => ({ key: specKey(), labelKa: s.labelKa, labelEn: s.labelEn ?? "", valueKa: s.valueKa, valueEn: s.valueEn ?? "" })),
    seo: seoDraftFrom(p.seo),
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

function toInput(d: Draft): ProjectInput {
  return {
    slug: d.slug,
    titleKa: d.titleKa.trim(),
    titleEn: orNull(d.titleEn),
    summaryKa: d.summaryKa.trim(),
    summaryEn: orNull(d.summaryEn),
    descriptionKa: d.descriptionKa.trim(),
    descriptionEn: orNull(d.descriptionEn),
    locationKa: d.locationKa.trim(),
    locationEn: orNull(d.locationEn),
    cityKa: d.cityKa.trim(),
    cityEn: orNull(d.cityEn),
    category: d.category,
    status: d.status,
    progress: d.status === "completed" ? 100 : Math.round(d.progress),
    startDate: d.startDate,
    estimatedCompletion: d.estimatedCompletion,
    completionDate: d.completionDate || null,
    featured: d.featured,
    architect: d.architect.trim(),
    isPublished: d.isPublished,
    coverId: d.cover?.id ?? "",
    galleryIds: d.gallery.map((g) => g.id),
    specs: d.specs
      .filter((s) => s.labelKa.trim() || s.valueKa.trim())
      .map((s) => ({ labelKa: s.labelKa.trim(), labelEn: orNull(s.labelEn), valueKa: s.valueKa.trim(), valueEn: orNull(s.valueEn) })),
    seo: seoInputFrom(d.seo),
  };
}

/** Checks the browser can do before sending; the server checks everything again. */
function validate(d: Draft): Errors {
  const e: Errors = {};
  if (!d.titleKa.trim()) e.titleKa = "Georgian title is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) e.slug = "Use lowercase Latin letters, numbers and single hyphens.";
  if (!d.summaryKa.trim()) e.summaryKa = "Georgian summary is required.";
  if (!d.descriptionKa.trim()) e.descriptionKa = "Georgian description is required.";
  if (!d.locationKa.trim()) e.locationKa = "Georgian location is required.";
  if (!d.cityKa.trim()) e.cityKa = "Georgian city is required.";
  if (!d.cover) e.coverId = "Choose or upload a cover image.";
  if (!d.startDate) e.startDate = "Start date is required.";
  if (!d.estimatedCompletion) e.estimatedCompletion = "Estimated completion is required.";
  else if (d.startDate && d.estimatedCompletion < d.startDate) e.estimatedCompletion = "Must be on or after the start date.";
  if (d.status === "completed" && !d.completionDate) e.completionDate = "Completed projects need a completion date.";
  if (d.completionDate && d.startDate && d.completionDate < d.startDate) e.completionDate = "Must be on or after the start date.";
  d.specs.forEach((s, i) => {
    if ((s.labelKa.trim() || s.valueKa.trim()) && !s.labelKa.trim()) e[`specs.${i}.labelKa`] = "Label is required.";
    if ((s.labelKa.trim() || s.valueKa.trim()) && !s.valueKa.trim()) e[`specs.${i}.valueKa`] = "Value is required.";
  });
  Object.assign(e, validateSeo(d.seo));
  return e;
}

export function ProjectForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const isNew = !projectId;

  const { data: loaded, error: loadError } = useApiData<AdminProject>(projectId ? `/api/admin/projects/${projectId}` : null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [baseline, setBaseline] = useState(() => JSON.stringify(blank()));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<"cover" | "gallery" | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Adopt the project once it has loaded (during render, so there's no flash of the empty form).
  const [adopted, setAdopted] = useState<AdminProject | undefined>(undefined);
  if (loaded && adopted !== loaded) {
    const d = fromProject(loaded);
    setAdopted(loaded);
    setDraft(d);
    setBaseline(JSON.stringify(d));
  }

  const clientErrors = validate(draft);
  const err = (k: string) => serverErrors[k] ?? (showErrors ? clientErrors[k] : undefined);
  const dirty = JSON.stringify(draft) !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (projectId && loadError) {
    return (
      <div className="rounded-md border border-line bg-card p-10 text-center">
        <p className="font-medium">{loadError.status === 404 ? "Project not found" : "Could not load the project"}</p>
        <p className="mt-1 text-[0.88rem] text-muted">{loadError.status === 404 ? "It may have been deleted." : loadError.message}</p>
        <Link href="/admin/projects" className="mt-4 inline-block text-[0.88rem] underline">
          Back to projects
        </Link>
      </div>
    );
  }
  if (projectId && !adopted) return <div className="h-96 animate-pulse rounded-md bg-paper-2" aria-busy="true" />;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    // Editing a field clears the server's complaint about it.
    const keys = k === "cover" ? ["coverId"] : k === "gallery" ? ["galleryIds"] : [k as string];
    if (keys.some((key) => serverErrors[key])) {
      setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !keys.includes(key))));
    }
  };

  const setTitleKa = (titleKa: string) =>
    setDraft((d) => ({ ...d, titleKa, slug: slugTouched ? d.slug : slugify(d.titleEn || titleKa) }));
  const setTitleEn = (titleEn: string) =>
    setDraft((d) => ({ ...d, titleEn, slug: slugTouched ? d.slug : slugify(titleEn || d.titleKa) }));

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
        ? await api<AdminProject>("/api/admin/projects", { method: "POST", body })
        : await api<AdminProject>(`/api/admin/projects/${projectId}`, { method: "PUT", body });
      setBaseline(JSON.stringify(draft));
      toast({
        tone: "success",
        title: isNew ? "Project created" : "Changes saved",
        body: saved.isPublished ? `${saved.titleKa} is live on the website.` : `${saved.titleKa} is saved as a draft.`,
      });
      router.push("/admin/projects");
    } catch (error) {
      setSaving(false);
      const { fields, message } = errorsFrom(error);
      setServerErrors(fields);
      toast({ tone: "error", title: "Could not save", body: Object.keys(fields).length ? "Check the highlighted fields." : message });
    }
  }

  async function remove() {
    if (!projectId) return;
    try {
      await api(`/api/admin/projects/${projectId}`, { method: "DELETE" });
      toast({ tone: "success", title: "Project deleted", body: draft.titleKa });
      router.push("/admin/projects");
    } catch (error) {
      toast({ tone: "error", title: "Could not delete", body: error instanceof Error ? error.message : "" });
    }
  }

  const cancel = () => (dirty ? setConfirmLeave(true) : router.push("/admin/projects"));
  const otherServerErrors = Object.entries(serverErrors).filter(([k]) => !KNOWN_FIELDS.has(k) && !k.startsWith("specs.") && !k.startsWith("seo."));

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={isNew ? "New project" : `Edit ${loaded?.titleKa ?? ""}`}
        description={`Public address: /projects/${draft.slug || "…"}${draft.isPublished ? "" : " (draft: not shown on the website)"}`}
        actions={
          <>
            {!isNew && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-danger">
                <Trash2 aria-hidden className="size-4" /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              {isNew ? "Create project" : "Save changes"}
            </Button>
          </>
        }
      />

      {otherServerErrors.length > 0 && (
        <div role="alert" className="mb-6 rounded-[3px] bg-danger-soft px-4 py-3 text-[0.88rem] text-danger">
          {otherServerErrors.map(([k, v]) => (
            <p key={k}>
              {k}: {v}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Basics" description="Georgian is the main language. English is optional; empty English fields show the Georgian text.">
            <BiField label="Title" required maxLength={120} ka={draft.titleKa} en={draft.titleEn} onKa={setTitleKa} onEn={setTitleEn} errorKa={err("titleKa")} errorEn={err("titleEn")} />
            <div className="sm:col-span-2">
              <Field label="URL slug" required error={err("slug")} hint={`/projects/${draft.slug || "your-project"} · Latin letters, numbers and hyphens`}>
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
            <BiField label="Short description" required maxLength={180} hint="Shown on project cards" ka={draft.summaryKa} en={draft.summaryEn} onKa={(v) => set("summaryKa", v)} onEn={(v) => set("summaryEn", v)} errorKa={err("summaryKa")} errorEn={err("summaryEn")} />
            <BiField label="Full description" required multiline rows={7} hint="Separate paragraphs with a blank line." ka={draft.descriptionKa} en={draft.descriptionEn} onKa={(v) => set("descriptionKa", v)} onEn={(v) => set("descriptionEn", v)} errorKa={err("descriptionKa")} errorEn={err("descriptionEn")} />
          </Section>

          <Section title="Details">
            <BiField label="Location" required maxLength={120} hint="e.g. Vake, Tbilisi" ka={draft.locationKa} en={draft.locationEn} onKa={(v) => set("locationKa", v)} onEn={(v) => set("locationEn", v)} errorKa={err("locationKa")} errorEn={err("locationEn")} />
            <BiField label="City" required maxLength={80} ka={draft.cityKa} en={draft.cityEn} onKa={(v) => set("cityKa", v)} onEn={(v) => set("cityEn", v)} errorKa={err("cityKa")} errorEn={err("cityEn")} />
            <Field label="Category" error={err("category")}>
              {(a) => (
                <Select {...a} value={draft.category} onChange={(e) => set("category", e.target.value as ProjectCategory)}>
                  {(Object.keys(CATEGORY_LABEL) as ProjectCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Status" error={err("status")}>
              {(a) => (
                <Select
                  {...a}
                  value={draft.status}
                  onChange={(e) => {
                    const status = e.target.value as ProjectStatus;
                    setDraft((d) => ({ ...d, status, progress: status === "completed" ? 100 : d.progress }));
                  }}
                >
                  {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={`Progress · ${draft.progress}%`} error={err("progress")}>
              {(a) => (
                <input
                  {...a}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.progress}
                  disabled={draft.status === "completed"}
                  onChange={(e) => set("progress", Number(e.target.value))}
                  className="mt-3 w-full accent-(--accent)"
                />
              )}
            </Field>
            <Field label="Architect" error={err("architect")}>
              {(a) => <Input {...a} value={draft.architect} onChange={(e) => set("architect", e.target.value)} />}
            </Field>
          </Section>

          <Section title="Schedule">
            <Field label="Start date" required error={err("startDate")}>
              {(a) => <Input {...a} type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />}
            </Field>
            <Field label="Estimated completion" required error={err("estimatedCompletion")}>
              {(a) => <Input {...a} type="date" value={draft.estimatedCompletion} onChange={(e) => set("estimatedCompletion", e.target.value)} />}
            </Field>
            <Field label="Completion date" error={err("completionDate")} hint="Required once completed">
              {(a) => <Input {...a} type="date" value={draft.completionDate} onChange={(e) => set("completionDate", e.target.value)} />}
            </Field>
          </Section>

          <Section title="Images">
            <div className="sm:col-span-2">
              <p className="text-[0.82rem] font-medium text-ink-soft">
                Cover image <span className="text-accent">*</span>
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <div className="relative aspect-[4/3] w-48 overflow-hidden rounded-[3px] border border-line bg-paper-2">
                  {draft.cover ? <Img src={draft.cover.src} alt="Selected cover" sizes="192px" /> : <span className="grid h-full place-items-center text-[0.8rem] text-muted">No cover</span>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setPicker("cover")}>
                  <ImagePlus aria-hidden className="size-4" /> {draft.cover ? "Change cover" : "Choose or upload cover"}
                </Button>
              </div>
              {err("coverId") && (
                <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                  {err("coverId")}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-[0.82rem] font-medium text-ink-soft">Gallery · {draft.gallery.length} images</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicker("gallery")}>
                  <Plus aria-hidden className="size-4" /> Select or upload images
                </Button>
              </div>
              {err("galleryIds") && (
                <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                  {err("galleryIds")}
                </p>
              )}
              {draft.gallery.length === 0 ? (
                <p className="mt-2 rounded-[3px] border border-dashed border-line-strong px-4 py-6 text-center text-[0.85rem] text-muted">No gallery images. The project page will hide the gallery.</p>
              ) : (
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {draft.gallery.map((img, i) => (
                    <li key={img.id} className="group relative aspect-square overflow-hidden rounded-[3px]">
                      <Img src={img.src} alt={`Gallery image ${i + 1}`} sizes="140px" />
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1 text-white">
                        <button type="button" aria-label={`Move image ${i + 1} earlier`} disabled={i === 0} onClick={() => set("gallery", move(draft.gallery, i, -1))} className="grid size-7 place-items-center rounded disabled:opacity-30">
                          <ArrowUp aria-hidden className="size-3.5 -rotate-90" />
                        </button>
                        <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => set("gallery", draft.gallery.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded">
                          <X aria-hidden className="size-3.5" />
                        </button>
                        <button type="button" aria-label={`Move image ${i + 1} later`} disabled={i === draft.gallery.length - 1} onClick={() => set("gallery", move(draft.gallery, i, 1))} className="grid size-7 place-items-center rounded disabled:opacity-30">
                          <ArrowDown aria-hidden className="size-3.5 -rotate-90" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="Specifications" description="Shown as a key facts list on the project page. Georgian label and value are required; English is optional.">
            <div className="min-w-0 space-y-3 sm:col-span-2">
              {draft.specs.map((s, i) => {
                const update = (patch: Partial<SpecRow>) => set("specs", draft.specs.map((x) => (x.key === s.key ? { ...x, ...patch } : x)));
                const rowError = err(`specs.${i}.labelKa`) ?? err(`specs.${i}.valueKa`) ?? err(`specs.${i}.labelEn`) ?? err(`specs.${i}.valueEn`);
                return (
                  <div key={s.key} className="rounded-[3px] border border-line p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <SpecInput label={`Specification ${i + 1} label (Georgian)`} placeholder="Label · ქართ." value={s.labelKa} onChange={(v) => update({ labelKa: v })} lang="ka" />
                      <SpecInput label={`Specification ${i + 1} value (Georgian)`} placeholder="Value · ქართ." value={s.valueKa} onChange={(v) => update({ valueKa: v })} lang="ka" />
                      <SpecInput label={`Specification ${i + 1} label (English)`} placeholder="Label · English (optional)" value={s.labelEn} onChange={(v) => update({ labelEn: v })} lang="en" />
                      <SpecInput label={`Specification ${i + 1} value (English)`} placeholder="Value · English (optional)" value={s.valueEn} onChange={(v) => update({ valueEn: v })} lang="en" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {rowError ? (
                        <p role="alert" className="text-[0.8rem] text-danger">
                          {rowError}
                        </p>
                      ) : (
                        <span />
                      )}
                      <IconButton label={`Remove specification ${i + 1}`} icon={Trash2} tone="danger" onClick={() => set("specs", draft.specs.filter((x) => x.key !== s.key))} />
                    </div>
                  </div>
                );
              })}
              <Button type="button" variant="ghost" size="sm" onClick={() => set("specs", [...draft.specs, { key: specKey(), labelKa: "", labelEn: "", valueKa: "", valueEn: "" }])}>
                <Plus aria-hidden className="size-4" /> Add specification
              </Button>
            </div>
          </Section>

          <SeoPanel
            value={draft.seo}
            onChange={(patch) => {
              set("seo", { ...draft.seo, ...patch });
              const keys = Object.keys(patch).map((k) => `seo.${k}`);
              if (keys.some((k) => serverErrors[k])) setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.includes(k))));
            }}
            error={err}
            fallbackTitle={draft.titleKa}
            fallbackDescription={draft.summaryKa}
            path={`/projects/${draft.slug || "…"}`}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="space-y-4 rounded-md border border-line bg-card p-5">
            <Toggle checked={draft.isPublished} onChange={(v) => set("isPublished", v)} label="Published" description="Show this project on the website." />
            <Toggle checked={draft.featured} onChange={(v) => set("featured", v)} label="Feature on homepage" description="Shown in the Selected work grid." />
          </div>
          {draft.cover && (
            <div className="rounded-md border border-line bg-card p-5">
              <p className="t-meta mb-3 text-muted">Card preview</p>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[3px]">
                <Img src={draft.cover.src} alt="" sizes="20rem" />
              </div>
              <p className="mt-3 font-display text-lg leading-tight">{draft.titleKa || "Untitled project"}</p>
              <p className="mt-1 text-[0.82rem] text-muted">{draft.locationKa || "Location"}</p>
            </div>
          )}
          {dirty && <p className="text-[0.8rem] text-warn">You have unsaved changes.</p>}
        </aside>
      </div>

      <ImagePicker open={picker === "cover"} onClose={() => setPicker(null)} initial={draft.cover ? [draft.cover] : []} onSelect={([img]) => img && set("cover", img)} title="Choose a cover image" />
      <ImagePicker open={picker === "gallery"} onClose={() => setPicker(null)} multiple initial={draft.gallery} onSelect={(imgs) => set("gallery", imgs)} title="Select gallery images" />
      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Discard unsaved changes?"
        description="Your edits to this project will be lost."
        confirmLabel="Discard"
        onConfirm={() => router.push("/admin/projects")}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete "${loaded?.titleKa}"?`}
        description="The project will be removed from the website and the admin. This cannot be undone."
        confirmLabel="Delete project"
        onConfirm={() => {
          setConfirmDelete(false);
          void remove();
        }}
      />
    </form>
  );
}

const KNOWN_FIELDS = new Set([
  "slug", "titleKa", "titleEn", "summaryKa", "summaryEn", "descriptionKa", "descriptionEn", "locationKa", "locationEn",
  "cityKa", "cityEn", "category", "status", "progress", "startDate", "estimatedCompletion", "completionDate", "architect",
  "coverId", "galleryIds",
]);

function SpecInput({ label, placeholder, value, onChange, lang }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; lang: string }) {
  return (
    <input
      aria-label={label}
      lang={lang}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-w-0 rounded-[3px] border border-line-strong bg-card px-3 text-[0.88rem] focus:border-ink focus:outline-none"
    />
  );
}

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const next = [...arr];
  [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
  return next;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
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
