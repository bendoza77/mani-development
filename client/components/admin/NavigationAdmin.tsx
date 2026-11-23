"use client";

import Link from "next/link";
import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, FileText, Link2, ListTree, Pencil, Plus, Trash2 } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { SortableItem, SortableList } from "@/components/admin/SortableList";
import { DragHandleButton, LoadError, ServerErrors, without } from "@/components/admin/parts";
import { EmptyState, IconButton, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Toggle } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import {
  api,
  errorMessage,
  fieldErrorsFrom,
  MAX_MENU_ITEMS,
  orNull,
  saveOrder,
  type AdminMenus,
  type AdminNavItem,
  type MenuLocation,
  type NavItemInput,
} from "@/lib/api";
import { cx } from "@/lib/format";

const MENU_LABEL: Record<MenuLocation, string> = { header: "Top menu", footer: "Footer menu" };
const LINK = /^(\/(?!\/)\S*|https:\/\/[^\s/]+\.\S+)$/;

type Draft = { location: MenuLocation; labelKa: string; labelEn: string; url: string; newTab: boolean; visible: boolean };

const itemInput = (i: AdminNavItem, patch: Partial<NavItemInput> = {}): NavItemInput => ({
  location: i.location,
  labelKa: i.labelKa,
  labelEn: i.labelEn,
  pageId: i.pageId,
  url: i.pageId ? null : i.url,
  newTab: i.newTab,
  visible: i.visible,
  ...patch,
});

function validate(d: Draft, isPage: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.labelKa.trim()) e.labelKa = "Label is required.";
  else if (d.labelKa.trim().length > 40) e.labelKa = "At most 40 characters.";
  if (d.labelEn.trim().length > 40) e.labelEn = "At most 40 characters.";
  if (!isPage) {
    if (!d.url.trim()) e.url = "Enter a link.";
    else if (!LINK.test(d.url.trim())) e.url = "Use a site path like /contact or an address starting with https://.";
  }
  return e;
}

const KNOWN = new Set(["location", "labelKa", "labelEn", "url", "pageId", "newTab", "visible"]);

export function NavigationAdmin() {
  const { data, error, reload, update } = useApiData<AdminMenus>("/api/admin/navigation");
  const toast = useToast();
  const [editing, setEditing] = useState<{ item: AdminNavItem | null; location: MenuLocation; key: number } | null>(null);
  const [toDelete, setToDelete] = useState<AdminNavItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function move(location: MenuLocation, from: number, to: number) {
    const list = data?.[location];
    if (!list || to < 0 || to >= list.length) return;
    const next = arrayMove(list, from, to);
    update((d) => ({ ...d, [location]: next }));
    try {
      const saved = await saveOrder<AdminMenus>("/api/admin/navigation", next.map((i) => i.id), { location });
      update(() => saved);
    } catch (err) {
      toast({ tone: "error", title: "Order not saved", body: errorMessage(err) });
      reload();
    }
  }

  async function toggleVisible(i: AdminNavItem) {
    try {
      const saved = await api<AdminNavItem>(`/api/admin/navigation/${i.id}`, { method: "PUT", body: itemInput(i, { visible: !i.visible }) });
      update((d) => ({ ...d, [i.location]: d[i.location].map((x) => (x.id === saved.id ? saved : x)) }));
      toast({ tone: "info", title: i.visible ? "Hidden from menu" : "Shown in menu", body: i.labelKa });
    } catch (err) {
      toast({ tone: "error", title: "Could not change", body: errorMessage(err) });
    }
  }

  async function remove(i: AdminNavItem) {
    setDeleting(true);
    try {
      await api(`/api/admin/navigation/${i.id}`, { method: "DELETE" });
      update((d) => ({ ...d, [i.location]: d[i.location].filter((x) => x.id !== i.id) }));
      toast({ tone: "success", title: "Removed from menu", body: i.labelKa });
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
        title="Menus"
        description="The links in the website's top menu and footer, in this order. Pages are added from the page editor (Pages → a page → Menu); here you can add other links."
      />
      {error ? (
        <Panel>
          <LoadError message={error.message} onRetry={reload} />
        </Panel>
      ) : !data ? (
        <div className="h-64 animate-pulse rounded-md bg-paper-2/50" aria-busy="true" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {(["header", "footer"] as const).map((location) => {
            const list = data[location];
            const full = list.length >= MAX_MENU_ITEMS;
            return (
              <Panel
                key={location}
                title={`${MENU_LABEL[location]} · ${list.length}/${MAX_MENU_ITEMS}`}
                action={
                  <Button size="sm" variant="outline" disabled={full} title={full ? "This menu is full" : undefined} onClick={() => setEditing({ item: null, location, key: Date.now() })}>
                    <Plus aria-hidden className="size-4" /> Add link
                  </Button>
                }
              >
                {list.length === 0 ? (
                  <EmptyState icon={ListTree} title="Empty menu" body="Add a link, or place a page here from the page editor." />
                ) : (
                  <SortableList ids={list.map((i) => i.id)} onMove={(from, to) => void move(location, from, to)}>
                    <ol>
                      {list.map((item, idx) => (
                        <li key={item.id} className="border-b border-line last:border-0">
                          <SortableItem id={item.id}>
                            {(handle) => (
                              <div className={cx("flex items-center gap-2 bg-card px-3 py-2.5 sm:gap-3", !item.visible && "bg-paper/50")}>
                                <DragHandleButton {...handle} label={`Drag to reorder ${item.labelKa}`} />
                                {item.page ? <FileText aria-hidden className="size-4 shrink-0 text-muted" /> : <Link2 aria-hidden className="size-4 shrink-0 text-muted" />}
                                <div className="min-w-0 flex-1">
                                  <p className={cx("truncate text-[0.9rem] font-medium", !item.visible && "text-muted")}>
                                    {item.labelKa}
                                    {!item.visible && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[0.7rem] font-normal text-muted">Hidden</span>}
                                    {item.page && !item.page.isPublished && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[0.7rem] font-normal text-warn">Page is a draft</span>}
                                  </p>
                                  <p className="truncate text-[0.8rem] text-muted">
                                    {item.page ? (
                                      <>
                                        Page: {item.page.title} ·{" "}
                                        <Link href={`/admin/pages/${item.page.id}/edit`} className="underline-offset-2 hover:text-ink hover:underline">
                                          Open page editor
                                        </Link>
                                      </>
                                    ) : (
                                      <>
                                        {item.url}
                                        {item.newTab && <ExternalLink aria-label="opens in a new tab" className="ml-1 inline size-3 align-[-1px]" />}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center">
                                  <span className="max-sm:hidden">
                                    <IconButton label={`Move ${item.labelKa} up`} icon={ArrowUp} disabled={idx === 0} onClick={() => void move(location, idx, idx - 1)} />
                                  </span>
                                  <span className="max-sm:hidden">
                                    <IconButton label={`Move ${item.labelKa} down`} icon={ArrowDown} disabled={idx === list.length - 1} onClick={() => void move(location, idx, idx + 1)} />
                                  </span>
                                  <IconButton label={item.visible ? `Hide ${item.labelKa}` : `Show ${item.labelKa}`} icon={item.visible ? Eye : EyeOff} onClick={() => void toggleVisible(item)} />
                                  <IconButton label={`Edit ${item.labelKa}`} icon={Pencil} onClick={() => setEditing({ item, location, key: Date.now() })} />
                                  <IconButton label={`Remove ${item.labelKa} from the menu`} icon={Trash2} tone="danger" onClick={() => setToDelete(item)} />
                                </div>
                              </div>
                            )}
                          </SortableItem>
                        </li>
                      ))}
                    </ol>
                  </SortableList>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {editing && data && (
        <ItemEditor
          key={editing.key}
          item={editing.item}
          location={editing.location}
          menus={data}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            const before = editing.item;
            if (!before) update((d) => ({ ...d, [saved.location]: [...d[saved.location], saved] }));
            else if (before.location === saved.location) update((d) => ({ ...d, [saved.location]: d[saved.location].map((x) => (x.id === saved.id ? saved : x)) }));
            else reload(); // moved to the other menu: both lists were renumbered
            toast({ tone: "success", title: isNew ? "Link added" : "Menu item saved", body: saved.labelKa });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Remove "${toDelete?.labelKa ?? ""}" from the ${toDelete ? MENU_LABEL[toDelete.location].toLowerCase() : "menu"}?`}
        description={toDelete?.page ? "Only the menu entry is removed. The page itself stays." : "The link will disappear from the website menu."}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}

function ItemEditor({
  item,
  location,
  menus,
  onClose,
  onSaved,
}: {
  item: AdminNavItem | null;
  location: MenuLocation;
  menus: AdminMenus;
  onClose: () => void;
  onSaved: (i: AdminNavItem, isNew: boolean) => void;
}) {
  const [d, setD] = useState<Draft>(() => ({
    location: item?.location ?? location,
    labelKa: item?.labelKa ?? "",
    labelEn: item?.labelEn ?? "",
    url: item?.url ?? "",
    newTab: item?.newTab ?? false,
    visible: item?.visible ?? true,
  }));
  const [show, setShow] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isPage = !!item?.page;

  const local = validate(d, isPage);
  const err = (k: string) => (show ? local[k] : undefined) ?? server[k];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setServer((s) => without(s, k));
  };
  const otherFull = (loc: MenuLocation) => loc !== item?.location && menus[loc].length >= MAX_MENU_ITEMS;

  async function save() {
    setShow(true);
    if (Object.keys(local).length) return;
    setSaving(true);
    setGeneral(null);
    const body: NavItemInput = {
      location: d.location,
      labelKa: d.labelKa.trim(),
      labelEn: orNull(d.labelEn),
      pageId: item?.pageId ?? null,
      url: isPage ? null : d.url.trim(),
      newTab: d.newTab,
      visible: d.visible,
    };
    try {
      const saved = item
        ? await api<AdminNavItem>(`/api/admin/navigation/${item.id}`, { method: "PUT", body })
        : await api<AdminNavItem>("/api/admin/navigation", { method: "POST", body });
      onSaved(saved, !item);
    } catch (e) {
      setServer(fieldErrorsFrom(e));
      setGeneral(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? "Edit menu item" : "Add a link"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            {item ? "Save" : "Add link"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {general && <ServerErrors message={general} fields={server} known={KNOWN} />}
        {isPage && item?.page && (
          <p className="rounded-[3px] bg-paper-2 px-4 py-3 text-[0.85rem]">
            This item opens the page <strong className="font-medium">{item.page.title}</strong>. To change the page itself, use the{" "}
            <Link href={`/admin/pages/${item.page.id}/edit`} className="underline underline-offset-2 hover:text-accent">
              page editor
            </Link>
            .
          </p>
        )}
        <Field label="Menu" error={err("location")}>
          {(a) => (
            <Select {...a} value={d.location} onChange={(ev) => set("location", ev.target.value as MenuLocation)}>
              {(["header", "footer"] as const).map((loc) => (
                <option key={loc} value={loc} disabled={otherFull(loc)}>
                  {MENU_LABEL[loc]}
                  {otherFull(loc) ? " (full)" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <BiField label="Label" required maxLength={40} ka={d.labelKa} en={d.labelEn} onKa={(v) => set("labelKa", v)} onEn={(v) => set("labelEn", v)} errorKa={err("labelKa")} errorEn={err("labelEn")} />
        {!isPage && (
          <Field label="Link" required error={err("url")} hint="A site path like /contact, or a full address starting with https://.">
            {(a) => <Input {...a} value={d.url} placeholder="/contact" onChange={(ev) => set("url", ev.target.value)} />}
          </Field>
        )}
        <Toggle checked={d.newTab} onChange={(v) => set("newTab", v)} label="Open in a new tab" description="Useful for links to other websites." />
        <Toggle checked={d.visible} onChange={(v) => set("visible", v)} label="Visible in the menu" />
      </div>
    </Dialog>
  );
}
