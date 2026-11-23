"use client";

import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { LoadError, ServerErrors, without } from "@/components/admin/parts";
import { EmptyState, IconButton, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Toggle } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { api, errorMessage, fieldErrorsFrom, orNull, saveOrder, type AdminTeamMember, type ApiImage, type TeamMemberInput } from "@/lib/api";
import { cx } from "@/lib/format";

type Draft = { nameKa: string; nameEn: string; nameRu: string; roleKa: string; roleEn: string; roleRu: string; bioKa: string; bioEn: string; bioRu: string; photo: ApiImage | null; visible: boolean };

const blank = (): Draft => ({ nameKa: "", nameEn: "", nameRu: "", roleKa: "", roleEn: "", roleRu: "", bioKa: "", bioEn: "", bioRu: "", photo: null, visible: true });
const toDraft = (m: AdminTeamMember): Draft => ({
  nameKa: m.nameKa,
  nameEn: m.nameEn ?? "",
  nameRu: m.nameRu ?? "",
  roleKa: m.roleKa,
  roleEn: m.roleEn ?? "",
  roleRu: m.roleRu ?? "",
  bioKa: m.bioKa,
  bioEn: m.bioEn ?? "",
  bioRu: m.bioRu ?? "",
  photo: m.photo,
  visible: m.visible,
});
const toInput = (d: Draft): TeamMemberInput => ({
  nameKa: d.nameKa.trim(),
  nameEn: orNull(d.nameEn),
  nameRu: orNull(d.nameRu),
  roleKa: d.roleKa.trim(),
  roleEn: orNull(d.roleEn),
  roleRu: orNull(d.roleRu),
  bioKa: d.bioKa.trim(),
  bioEn: orNull(d.bioEn),
  bioRu: orNull(d.bioRu),
  photoId: d.photo?.id ?? "",
  visible: d.visible,
});

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  const len = (v: string) => v.trim().length;
  if (len(d.nameKa) < 2) e.nameKa = "Name is required (2+ characters).";
  else if (len(d.nameKa) > 100) e.nameKa = "At most 100 characters.";
  if (len(d.nameEn) > 100) e.nameEn = "At most 100 characters.";
  if (len(d.nameRu) > 100) e.nameRu = "At most 100 characters.";
  if (!len(d.roleKa)) e.roleKa = "Role is required.";
  else if (len(d.roleKa) > 100) e.roleKa = "At most 100 characters.";
  if (len(d.roleEn) > 100) e.roleEn = "At most 100 characters.";
  if (len(d.roleRu) > 100) e.roleRu = "At most 100 characters.";
  if (len(d.bioKa) < 20) e.bioKa = "Write a short bio (20+ characters).";
  else if (len(d.bioKa) > 600) e.bioKa = "At most 600 characters.";
  if (len(d.bioEn) > 600) e.bioEn = "At most 600 characters.";
  if (len(d.bioRu) > 600) e.bioRu = "At most 600 characters.";
  if (!d.photo) e.photo = "Choose a photo.";
  return e;
}

const KNOWN = new Set(["nameKa", "nameEn", "nameRu", "roleKa", "roleEn", "roleRu", "bioKa", "bioEn", "bioRu", "photoId", "photo", "visible"]);

export function TeamAdmin() {
  const { data, error, reload, update } = useApiData<{ items: AdminTeamMember[] }>("/api/admin/team");
  const team = data?.items ?? null;
  const toast = useToast();
  const [editing, setEditing] = useState<{ item: AdminTeamMember | null; key: number } | null>(null);
  const [toDelete, setToDelete] = useState<AdminTeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function move(from: number, to: number) {
    if (!team || to < 0 || to >= team.length) return;
    const next = arrayMove(team, from, to);
    update(() => ({ items: next }));
    try {
      const saved = await saveOrder<{ items: AdminTeamMember[] }>("/api/admin/team", next.map((m) => m.id));
      update(() => saved);
    } catch (err) {
      toast({ tone: "error", title: "Order not saved", body: errorMessage(err) });
      reload();
    }
  }

  async function toggleVisible(m: AdminTeamMember) {
    try {
      const saved = await api<AdminTeamMember>(`/api/admin/team/${m.id}`, { method: "PATCH", body: { visible: !m.visible } });
      update((d) => ({ items: d.items.map((x) => (x.id === saved.id ? saved : x)) }));
      toast({ tone: "info", title: m.visible ? "Hidden from website" : "Visible on website", body: m.nameKa });
    } catch (err) {
      toast({ tone: "error", title: "Could not change", body: errorMessage(err) });
    }
  }

  async function remove(m: AdminTeamMember) {
    setDeleting(true);
    try {
      await api(`/api/admin/team/${m.id}`, { method: "DELETE" });
      update((d) => ({ items: d.items.filter((x) => x.id !== m.id) }));
      toast({ tone: "success", title: "Member removed", body: m.nameKa });
      setToDelete(null);
    } catch (err) {
      toast({ tone: "error", title: "Could not remove", body: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Visible members appear on the About page, in this order."
        actions={
          <Button size="sm" onClick={() => setEditing({ item: null, key: Date.now() })}>
            <Plus aria-hidden className="size-4" /> Add member
          </Button>
        }
      />
      {error ? (
        <div className="rounded-md border border-line bg-card">
          <LoadError message={error.message} onRetry={reload} />
        </div>
      ) : !team ? (
        <div className="h-64 animate-pulse rounded-md bg-paper-2/50" aria-busy="true" />
      ) : team.length === 0 ? (
        <div className="rounded-md border border-line bg-card">
          <EmptyState icon={Users} title="No team members" body="Add people to introduce the studio on the About page." />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {team.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-md border border-line bg-card">
              <div className={cx("relative aspect-[4/3] bg-paper-2", !m.visible && "opacity-50 grayscale")}>
                <Img src={m.photo.src} alt="" sizes="(min-width: 1024px) 25vw, 50vw" imgClassName="object-top" />
                {!m.visible && <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-0.5 text-[0.72rem] text-paper">Hidden</span>}
              </div>
              <div className="p-4">
                <p className="font-medium">{m.nameKa}</p>
                <p className="text-[0.83rem] text-muted">
                  {m.roleKa}
                  {!m.nameEn && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[0.7rem] text-warn">No English</span>}
                  {!m.nameRu && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[0.7rem] text-warn">No Russian</span>}
                </p>
                <div className="mt-3 -ml-2 flex">
                  <IconButton label={`Move ${m.nameKa} earlier`} icon={ArrowLeft} disabled={i === 0} onClick={() => void move(i, i - 1)} />
                  <IconButton label={`Move ${m.nameKa} later`} icon={ArrowRight} disabled={i === team.length - 1} onClick={() => void move(i, i + 1)} />
                  <IconButton label={m.visible ? `Hide ${m.nameKa}` : `Show ${m.nameKa}`} icon={m.visible ? Eye : EyeOff} onClick={() => void toggleVisible(m)} />
                  <IconButton label={`Edit ${m.nameKa}`} icon={Pencil} onClick={() => setEditing({ item: m, key: Date.now() })} />
                  <IconButton label={`Remove ${m.nameKa}`} icon={Trash2} tone="danger" onClick={() => setToDelete(m)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <MemberEditor
          key={editing.key}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            update((d) => ({ items: isNew ? [...d.items, saved] : d.items.map((x) => (x.id === saved.id ? saved : x)) }));
            toast({ tone: "success", title: isNew ? "Member added" : "Profile saved", body: saved.nameKa });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Remove ${toDelete?.nameKa}?`}
        description="Their profile will be removed from the About page and the admin."
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}

function MemberEditor({ item, onClose, onSaved }: { item: AdminTeamMember | null; onClose: () => void; onSaved: (m: AdminTeamMember, isNew: boolean) => void }) {
  const [d, setD] = useState<Draft>(() => (item ? toDraft(item) : blank()));
  const [show, setShow] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const local = validate(d);
  const err = (k: string) => (show ? local[k] : undefined) ?? server[k] ?? (k === "photo" ? server.photoId : undefined);
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
        ? await api<AdminTeamMember>(`/api/admin/team/${item.id}`, { method: "PUT", body })
        : await api<AdminTeamMember>("/api/admin/team", { method: "POST", body });
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
        title={item ? "Edit team member" : "Add team member"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {general && <ServerErrors message={general} fields={server} known={KNOWN} />}
          <div className="flex items-end gap-4">
            <div className="relative aspect-[4/5] w-24 overflow-hidden rounded-[3px] border border-line bg-paper-2">{d.photo && <Img src={d.photo.src} alt="Selected portrait" sizes="96px" />}</div>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                <ImagePlus aria-hidden className="size-4" /> {d.photo ? "Change photo" : "Choose photo"}
              </Button>
              {err("photo") && (
                <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                  {err("photo")}
                </p>
              )}
            </div>
          </div>
          <BiField label="Name" required maxLength={100} ka={d.nameKa} en={d.nameEn} ru={d.nameRu} onKa={(v) => set("nameKa", v)} onEn={(v) => set("nameEn", v)} onRu={(v) => set("nameRu", v)} errorKa={err("nameKa")} errorEn={err("nameEn")} errorRu={err("nameRu")} />
          <BiField label="Role" required maxLength={100} ka={d.roleKa} en={d.roleEn} ru={d.roleRu} onKa={(v) => set("roleKa", v)} onEn={(v) => set("roleEn", v)} onRu={(v) => set("roleRu", v)} errorKa={err("roleKa")} errorEn={err("roleEn")} errorRu={err("roleRu")} />
          <BiField label="Bio" required multiline rows={4} maxLength={600} ka={d.bioKa} en={d.bioEn} ru={d.bioRu} onKa={(v) => set("bioKa", v)} onEn={(v) => set("bioEn", v)} onRu={(v) => set("bioRu", v)} errorKa={err("bioKa")} errorEn={err("bioEn")} errorRu={err("bioRu")} />
          <Toggle checked={d.visible} onChange={(v) => set("visible", v)} label="Visible on About page" />
        </div>
      </Dialog>
      <ImagePicker open={picker} onClose={() => setPicker(false)} initial={d.photo ? [d.photo] : []} onSelect={([img]) => img && set("photo", img)} title="Choose a portrait" />
    </>
  );
}
