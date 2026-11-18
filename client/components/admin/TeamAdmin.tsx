"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { EmptyState, IconButton, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea, Toggle } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { teamDB, uid, useDB } from "@/lib/store";
import { cx } from "@/lib/format";
import type { TeamMember } from "@/lib/types";

const blank = (): TeamMember => ({ id: "", name: "", role: "", bio: "", photo: "", visible: true });

export function TeamAdmin() {
  const team = useDB((d) => d.team);
  const toast = useToast();
  const [editing, setEditing] = useState<{ item: TeamMember; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<TeamMember | null>(null);

  return (
    <>
      <PageHeader
        title="Team"
        description="Visible members appear on the About page, in this order."
        actions={
          <Button size="sm" onClick={() => setEditing({ item: blank(), isNew: true })}>
            <Plus aria-hidden className="size-4" /> Add member
          </Button>
        }
      />
      {team.length === 0 ? (
        <div className="rounded-md border border-line bg-card">
          <EmptyState icon={Users} title="No team members" body="Add people to introduce the studio on the About page." />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {team.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-md border border-line bg-card">
              <div className={cx("relative aspect-[4/3] bg-paper-2", !m.visible && "opacity-50 grayscale")}>
                {m.photo && <Img src={m.photo} alt="" sizes="(min-width: 1024px) 25vw, 50vw" imgClassName="object-top" />}
                {!m.visible && <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-0.5 text-[0.72rem] text-paper">Hidden</span>}
              </div>
              <div className="p-4">
                <p className="font-medium">{m.name}</p>
                <p className="text-[0.83rem] text-muted">{m.role}</p>
                <div className="mt-3 -ml-2 flex">
                  <IconButton label={`Move ${m.name} earlier`} icon={ArrowUp} disabled={i === 0} onClick={() => teamDB.move(m.id, -1)} />
                  <IconButton label={`Move ${m.name} later`} icon={ArrowDown} disabled={i === team.length - 1} onClick={() => teamDB.move(m.id, 1)} />
                  <IconButton
                    label={m.visible ? `Hide ${m.name}` : `Show ${m.name}`}
                    icon={m.visible ? Eye : EyeOff}
                    onClick={() => {
                      teamDB.update(m.id, { visible: !m.visible }, `${m.name} ${m.visible ? "hidden" : "shown"} on About page`);
                      toast({ tone: "info", title: m.visible ? "Hidden from website" : "Visible on website", body: m.name });
                    }}
                  />
                  <IconButton label={`Edit ${m.name}`} icon={Pencil} onClick={() => setEditing({ item: m, isNew: false })} />
                  <IconButton label={`Remove ${m.name}`} icon={Trash2} tone="danger" onClick={() => setToDelete(m)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <MemberEditor
        key={editing?.item.id ?? "none"}
        state={editing}
        onClose={() => setEditing(null)}
        onSave={(item, isNew) => {
          if (isNew) teamDB.add({ ...item, id: uid("m") }, `${item.name} added to the team`, "end");
          else teamDB.update(item.id, item, `${item.name}'s profile updated`);
          toast({ tone: "success", title: isNew ? "Member added" : "Profile saved", body: item.name });
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Remove ${toDelete?.name}?`}
        description="Their profile will be removed from the About page and the admin."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!toDelete) return;
          teamDB.remove(toDelete.id, `${toDelete.name} removed from the team`);
          toast({ tone: "success", title: "Member removed", body: toDelete.name });
          setToDelete(null);
        }}
      />
    </>
  );
}

function MemberEditor({ state, onClose, onSave }: { state: { item: TeamMember; isNew: boolean } | null; onClose: () => void; onSave: (m: TeamMember, isNew: boolean) => void }) {
  const [d, setD] = useState<TeamMember>(() => state?.item ?? blank());
  const [show, setShow] = useState(false);
  const [picker, setPicker] = useState(false);
  const errors = {
    name: d.name.trim().length < 2 ? "Name is required." : undefined,
    role: !d.role.trim() ? "Role is required." : undefined,
    bio: d.bio.trim().length < 20 ? "Write a short bio (20+ characters)." : undefined,
    photo: !d.photo ? "Choose a photo." : undefined,
  };
  const e = (k: keyof typeof errors) => (show ? errors[k] : undefined);
  return (
    <>
      <Dialog
        open={!!state && !picker}
        onClose={onClose}
        title={state?.isNew ? "Add team member" : "Edit team member"}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShow(true);
                if (Object.values(errors).some(Boolean)) return;
                onSave({ ...d, name: d.name.trim(), role: d.role.trim() }, !!state?.isNew);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="flex items-end gap-4">
            <div className="relative aspect-[4/5] w-24 overflow-hidden rounded-[3px] border border-line bg-paper-2">{d.photo && <Img src={d.photo} alt="Selected portrait" sizes="96px" />}</div>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                <ImagePlus aria-hidden className="size-4" /> {d.photo ? "Change photo" : "Choose photo"}
              </Button>
              {e("photo") && (
                <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                  {e("photo")}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={e("name")}>
              {(a) => <Input {...a} value={d.name} onChange={(ev) => setD({ ...d, name: ev.target.value })} />}
            </Field>
            <Field label="Role" required error={e("role")}>
              {(a) => <Input {...a} value={d.role} onChange={(ev) => setD({ ...d, role: ev.target.value })} />}
            </Field>
          </div>
          <Field label="Bio" required error={e("bio")}>
            {(a) => <Textarea {...a} rows={4} value={d.bio} onChange={(ev) => setD({ ...d, bio: ev.target.value })} />}
          </Field>
          <Toggle checked={d.visible} onChange={(v) => setD({ ...d, visible: v })} label="Visible on About page" />
        </div>
      </Dialog>
      <MediaPicker open={picker} onClose={() => setPicker(false)} initial={d.photo ? [d.photo] : []} onSelect={([src]) => setD((x) => ({ ...x, photo: src }))} title="Choose a portrait" />
    </>
  );
}
