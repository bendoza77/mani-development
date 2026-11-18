"use client";

import { useState, type FormEvent } from "react";
import { Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/ui";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { StorageFullError, resetDemoData, updateSettings, useDB } from "@/lib/store";
import { cx } from "@/lib/format";
import type { Settings, ThemePreference } from "@/lib/types";

type Errors = Partial<Record<keyof Settings, string>>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+/;

function validate(s: Settings): Errors {
  const e: Errors = {};
  if (s.companyName.trim().length < 2) e.companyName = "Company name is required.";
  else if (s.companyName.length > 24) e.companyName = "Keep it under 24 characters so it fits the header.";
  if (s.tagline.length > 40) e.tagline = "Keep the tagline under 40 characters.";
  if (!EMAIL.test(s.email.trim())) e.email = "Enter a valid email address.";
  if (s.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number.";
  if (s.address.trim().length < 5) e.address = "Address is required.";
  for (const k of ["instagram", "linkedin", "facebook"] as const) if (s[k] && !URL_RE.test(s[k])) e[k] = "Use a full URL starting with https://";
  return e;
}

export function SettingsAdmin() {
  const settings = useDB((d) => d.settings);
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Adopt stored settings once the store hydrates (or after a reset elsewhere) when there are no local edits.
  const [base, setBase] = useState(settings);
  if (base !== settings) {
    const untouched = JSON.stringify(draft) === JSON.stringify(base);
    setBase(settings);
    if (untouched) setDraft(settings);
  }

  const errors = validate(draft);
  const e = (k: keyof Settings) => (show ? errors[k] : undefined);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setShow(true);
    if (Object.keys(errors).length) {
      toast({ tone: "error", title: "Check the highlighted fields" });
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 350));
    try {
      const clean = { ...draft, companyName: draft.companyName.trim(), email: draft.email.trim() };
      updateSettings(clean, "Company settings updated");
      setDraft(clean);
      toast({ tone: "success", title: "Settings saved", body: "The website header, footer and contact page now use these details." });
    } catch (err) {
      toast({ tone: "error", title: "Could not save", body: err instanceof StorageFullError ? err.message : "Unexpected storage error." });
    }
    setSaving(false);
  }

  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Match system", icon: Monitor },
  ];

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        title="Settings"
        description="Company details shown across the public website."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" disabled={!dirty} onClick={() => setDraft(settings)}>
              Discard
            </Button>
            <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Brand" bodyClassName="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Company name" required error={e("companyName")}>
              {(a) => <Input {...a} value={draft.companyName} onChange={(ev) => set("companyName", ev.target.value)} />}
            </Field>
            <Field label="Tagline" error={e("tagline")}>
              {(a) => <Input {...a} value={draft.tagline} onChange={(ev) => set("tagline", ev.target.value)} />}
            </Field>
          </Panel>
          <Panel title="Contact" bodyClassName="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Email" required error={e("email")}>
              {(a) => <Input {...a} type="email" value={draft.email} onChange={(ev) => set("email", ev.target.value)} />}
            </Field>
            <Field label="Phone" required error={e("phone")}>
              {(a) => <Input {...a} type="tel" value={draft.phone} onChange={(ev) => set("phone", ev.target.value)} />}
            </Field>
            <Field label="Address" required error={e("address")} className="sm:col-span-2">
              {(a) => <Input {...a} value={draft.address} onChange={(ev) => set("address", ev.target.value)} />}
            </Field>
            <Field label="Opening hours">
              {(a) => <Input {...a} value={draft.hours} onChange={(ev) => set("hours", ev.target.value)} />}
            </Field>
          </Panel>
          <Panel title="Social links" bodyClassName="grid gap-5 p-5 sm:grid-cols-3">
            {(["instagram", "linkedin", "facebook"] as const).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)} error={e(k)}>
                {(a) => <Input {...a} type="url" placeholder="https://" value={draft[k]} onChange={(ev) => set(k, ev.target.value)} />}
              </Field>
            ))}
          </Panel>
          <Panel title="Appearance" bodyClassName="p-5">
            <p className="text-[0.85rem] text-muted" id="theme-label">
              Theme for the website and admin in this browser. Applied immediately when saved.
            </p>
            <div role="radiogroup" aria-labelledby="theme-label" className="mt-3 grid gap-2 sm:grid-cols-3">
              {themes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.theme === t.value}
                  onClick={() => set("theme", t.value)}
                  className={cx("flex items-center gap-3 rounded-[3px] border p-4 text-left text-[0.88rem] transition-colors", draft.theme === t.value ? "border-ink bg-paper" : "border-line hover:border-line-strong")}
                >
                  <t.icon aria-hidden className="size-4.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Demo data" bodyClassName="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-[0.88rem] text-muted">Restore every project, service, inquiry, testimonial, team member, media file and setting to the original sample content.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmReset(true)} className="shrink-0">
              <RotateCcw aria-hidden className="size-4" /> Reset demo data
            </Button>
          </Panel>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-md border border-line bg-card p-5">
            <p className="t-meta text-muted">Logo preview</p>
            <div className="mt-4 grid gap-3">
              {[
                { bg: "bg-paper text-ink", label: "On light" },
                { bg: "bg-night text-night-ink", label: "On dark" },
              ].map((v) => (
                <div key={v.label} className={cx("flex items-center gap-2.5 rounded-[3px] px-4 py-5", v.bg)}>
                  <LogoMark className="size-7" />
                  <span className="flex min-w-0 flex-col leading-none">
                    <span className="truncate text-[1.05rem] font-semibold uppercase tracking-[0.2em]">{draft.companyName || "Name"}</span>
                    <span className="mt-1 truncate font-mono text-[0.58rem] uppercase tracking-[0.18em] opacity-60">{draft.tagline}</span>
                  </span>
                  <span className="sr-only">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
          {dirty && <p className="text-[0.8rem] text-warn">Unsaved changes — the website still shows the previous details.</p>}
        </aside>
      </div>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all demo data?"
        description="All edits made in this browser will be lost and the original sample content restored."
        confirmLabel="Reset data"
        onConfirm={() => {
          resetDemoData();
          setConfirmReset(false);
          toast({ tone: "success", title: "Demo data reset" });
        }}
      />
    </form>
  );
}
