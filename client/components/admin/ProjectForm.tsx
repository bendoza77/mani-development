"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { IconButton, PageHeader } from "@/components/admin/ui";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { StorageFullError, nowISO, projectsDB, uid, useDB } from "@/lib/store";
import { CATEGORY_LABEL, STATUS_LABEL, slugify } from "@/lib/format";
import type { Project, ProjectCategory, ProjectStatus } from "@/lib/types";

type Errors = Partial<Record<keyof Project, string>>;

const blank = (): Project => ({
  id: "", // assigned on first save (ids are random, so never generated during render)
  slug: "",
  title: "",
  summary: "",
  description: "",
  location: "",
  city: "",
  category: "residential",
  status: "planning",
  progress: 0,
  startDate: "",
  estimatedCompletion: "",
  completionDate: undefined,
  featured: false,
  cover: "",
  gallery: [],
  specs: [],
  architect: "",
  updatedAt: "",
});

function validate(p: Project, others: Project[]): Errors {
  const e: Errors = {};
  if (p.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) e.slug = "Use lowercase letters, numbers and single hyphens.";
  else if (others.some((o) => o.slug === p.slug)) e.slug = "Another project already uses this URL.";
  if (p.summary.trim().length < 10) e.summary = "Add a one-line summary (10+ characters).";
  else if (p.summary.length > 180) e.summary = `Keep it under 180 characters (${p.summary.length}).`;
  if (p.description.trim().length < 30) e.description = "Write at least a short paragraph (30+ characters).";
  if (!p.location.trim()) e.location = "Location is required.";
  if (!p.city.trim()) e.city = "City is required.";
  if (!p.cover) e.cover = "Choose a cover image.";
  if (!Number.isFinite(p.progress) || p.progress < 0 || p.progress > 100) e.progress = "Progress must be between 0 and 100.";
  if (!p.startDate) e.startDate = "Start date is required.";
  if (!p.estimatedCompletion) e.estimatedCompletion = "Estimated completion is required.";
  else if (p.startDate && p.estimatedCompletion < p.startDate) e.estimatedCompletion = "Must be after the start date.";
  if (p.status === "completed" && !p.completionDate) e.completionDate = "Completed projects need a completion date.";
  if (p.completionDate && p.startDate && p.completionDate < p.startDate) e.completionDate = "Must be after the start date.";
  return e;
}

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export function ProjectForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const projects = useDB((d) => d.projects);
  const existing = projectId ? projects.find((p) => p.id === projectId) : undefined;
  const isNew = !projectId;

  const [draft, setDraft] = useState<Project>(() => existing ?? blank());
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<"cover" | "gallery" | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(existing ?? draft));

  // The store hydrates from localStorage after first render; adopt the stored project once it appears.
  const [syncedId, setSyncedId] = useState(existing?.id);
  if (existing && syncedId !== existing.id) {
    setSyncedId(existing.id);
    setDraft(existing);
    setBaseline(JSON.stringify(existing));
  }

  const others = useMemo(() => projects.filter((p) => p.id !== draft.id), [projects, draft.id]);
  const errors = validate(draft, others);
  const err = (k: keyof Project) => (showErrors ? errors[k] : undefined);
  const dirty = JSON.stringify(draft) !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (projectId && !existing) {
    return (
      <div className="rounded-md border border-line bg-card p-10 text-center">
        <p className="font-medium">Project not found</p>
        <p className="mt-1 text-[0.88rem] text-muted">It may have been deleted, or demo data was reset.</p>
        <Link href="/admin/projects" className="mt-4 inline-block text-[0.88rem] underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    const first = Object.keys(errors)[0];
    if (first) {
      document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] textarea, [data-field="${first}"] select, [data-field="${first}"] button`)?.focus();
      toast({ tone: "error", title: "Check the highlighted fields", body: `${Object.keys(errors).length} field(s) need attention.` });
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 450));
    const record: Project = { ...draft, id: draft.id || uid("p"), title: draft.title.trim(), progress: draft.status === "completed" ? 100 : Math.round(draft.progress), updatedAt: nowISO() };
    try {
      if (isNew) projectsDB.add(record, `${record.title} created`);
      else projectsDB.update(record.id, record, `${record.title} updated`);
    } catch (error) {
      setSaving(false);
      toast({ tone: "error", title: "Could not save", body: error instanceof StorageFullError ? error.message : "Unexpected storage error." });
      return;
    }
    setBaseline(JSON.stringify(record));
    toast({ tone: "success", title: isNew ? "Project created" : "Changes saved", body: `${record.title} is live on the website.` });
    router.push("/admin/projects");
  }

  const cancel = () => (dirty ? setConfirmLeave(true) : router.push("/admin/projects"));

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={isNew ? "New project" : `Edit ${existing?.title}`}
        description={isNew ? "Projects appear on the public website as soon as they are saved." : `Public URL: /projects/${draft.slug || "…"}`}
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

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Basics">
            <div data-field="title">
              <Field label="Title" required error={err("title")}>
                {(a) => (
                  <Input
                    {...a}
                    value={draft.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setDraft((d) => ({ ...d, title, slug: slugTouched ? d.slug : slugify(title) }));
                    }}
                  />
                )}
              </Field>
            </div>
            <div data-field="slug">
              <Field label="URL slug" required error={err("slug")} hint={`/projects/${draft.slug || "your-project"}`}>
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
            <div data-field="summary" className="sm:col-span-2">
              <Field label="Short description" required error={err("summary")} hint={`${draft.summary.length}/180 · shown on project cards`}>
                {(a) => <Input {...a} value={draft.summary} onChange={(e) => set("summary", e.target.value)} />}
              </Field>
            </div>
            <div data-field="description" className="sm:col-span-2">
              <Field label="Full description" required error={err("description")} hint="Separate paragraphs with a blank line.">
                {(a) => <Textarea {...a} rows={7} value={draft.description} onChange={(e) => set("description", e.target.value)} />}
              </Field>
            </div>
          </Section>

          <Section title="Details">
            <div data-field="location">
              <Field label="Location" required error={err("location")} hint="e.g. Vake, Tbilisi">
                {(a) => <Input {...a} value={draft.location} onChange={(e) => set("location", e.target.value)} />}
              </Field>
            </div>
            <div data-field="city">
              <Field label="City" required error={err("city")}>
                {(a) => <Input {...a} value={draft.city} onChange={(e) => set("city", e.target.value)} />}
              </Field>
            </div>
            <Field label="Category">
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
            <Field label="Status">
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
            <div data-field="progress">
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
            </div>
            <Field label="Architect">
              {(a) => <Input {...a} value={draft.architect} onChange={(e) => set("architect", e.target.value)} />}
            </Field>
          </Section>

          <Section title="Schedule">
            <div data-field="startDate">
              <Field label="Start date" required error={err("startDate")}>
                {(a) => <Input {...a} type="date" value={toDateInput(draft.startDate)} onChange={(e) => set("startDate", e.target.value)} />}
              </Field>
            </div>
            <div data-field="estimatedCompletion">
              <Field label="Estimated completion" required error={err("estimatedCompletion")}>
                {(a) => <Input {...a} type="date" value={toDateInput(draft.estimatedCompletion)} onChange={(e) => set("estimatedCompletion", e.target.value)} />}
              </Field>
            </div>
            <div data-field="completionDate">
              <Field label="Completion date" error={err("completionDate")} hint="Required once completed">
                {(a) => <Input {...a} type="date" value={toDateInput(draft.completionDate)} onChange={(e) => set("completionDate", e.target.value || undefined)} />}
              </Field>
            </div>
          </Section>

          <Section title="Images">
            <div data-field="cover" className="sm:col-span-2">
              <p className="text-[0.82rem] font-medium text-ink-soft">
                Cover image <span className="text-accent">*</span>
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <div className="relative aspect-[4/3] w-48 overflow-hidden rounded-[3px] border border-line bg-paper-2">
                  {draft.cover ? <Img src={draft.cover} alt="Selected cover" sizes="192px" /> : <span className="grid h-full place-items-center text-[0.8rem] text-muted">No cover</span>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setPicker("cover")}>
                  <ImagePlus aria-hidden className="size-4" /> {draft.cover ? "Change cover" : "Choose cover"}
                </Button>
              </div>
              {err("cover") && (
                <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                  {err("cover")}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-[0.82rem] font-medium text-ink-soft">Gallery · {draft.gallery.length} images</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicker("gallery")}>
                  <Plus aria-hidden className="size-4" /> Select images
                </Button>
              </div>
              {draft.gallery.length === 0 ? (
                <p className="mt-2 rounded-[3px] border border-dashed border-line-strong px-4 py-6 text-center text-[0.85rem] text-muted">No gallery images. The project page will hide the gallery.</p>
              ) : (
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {draft.gallery.map((src, i) => (
                    <li key={`${src}-${i}`} className="group relative aspect-square overflow-hidden rounded-[3px]">
                      <Img src={src} alt={`Gallery image ${i + 1}`} sizes="140px" />
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

          <Section title="Specifications" description="Shown as a key facts list on the project page.">
            <div className="min-w-0 space-y-2 sm:col-span-2">
              {draft.specs.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input aria-label={`Specification ${i + 1} label`} value={s.label} placeholder="Label" onChange={(e) => set("specs", draft.specs.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))} className="h-10 w-2/5 min-w-0 rounded-[3px] border border-line-strong bg-card px-3 text-[0.88rem] focus:border-ink focus:outline-none" />
                  <input aria-label={`Specification ${i + 1} value`} value={s.value} placeholder="Value" onChange={(e) => set("specs", draft.specs.map((x) => (x.id === s.id ? { ...x, value: e.target.value } : x)))} className="h-10 min-w-0 flex-1 rounded-[3px] border border-line-strong bg-card px-3 text-[0.88rem] focus:border-ink focus:outline-none" />
                  <IconButton label={`Remove specification ${s.label || i + 1}`} icon={Trash2} tone="danger" onClick={() => set("specs", draft.specs.filter((x) => x.id !== s.id))} />
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => set("specs", [...draft.specs, { id: uid("s"), label: "", value: "" }])}>
                <Plus aria-hidden className="size-4" /> Add specification
              </Button>
            </div>
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-md border border-line bg-card p-5">
            <Toggle checked={draft.featured} onChange={(v) => set("featured", v)} label="Feature on homepage" description="Shown in the Selected work grid." />
          </div>
          <div className="rounded-md border border-line bg-card p-5">
            <p className="t-meta mb-4 text-muted">Card preview</p>
            {draft.cover ? (
              <ProjectCard
                asPreview
                project={{ ...draft, title: draft.title || "Untitled project", location: draft.location || "Location", estimatedCompletion: draft.estimatedCompletion || "2027-01-01" }}
                sizes="20rem"
              />
            ) : (
              <p className="rounded-[3px] bg-paper-2 px-4 py-10 text-center text-[0.85rem] text-muted">Choose a cover image to preview the card.</p>
            )}
          </div>
          {dirty && <p className="text-[0.8rem] text-warn">You have unsaved changes.</p>}
        </aside>
      </div>

      <MediaPicker open={picker === "cover"} onClose={() => setPicker(null)} initial={draft.cover ? [draft.cover] : []} onSelect={([src]) => set("cover", src)} title="Choose a cover image" />
      <MediaPicker open={picker === "gallery"} onClose={() => setPicker(null)} multiple initial={draft.gallery} onSelect={(srcs) => set("gallery", srcs)} title="Select gallery images" />
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
        title={`Delete "${existing?.title}"?`}
        description="The project will be removed from the website and the admin. This cannot be undone (except by resetting demo data)."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (!existing) return;
          projectsDB.remove(existing.id, `${existing.title} deleted`);
          toast({ tone: "success", title: "Project deleted", body: existing.title });
          router.push("/admin/projects");
        }}
      />
    </form>
  );
}

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const next = [...arr];
  [next[i], next[i + dir]] = [next[i + dir], next[i]];
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
