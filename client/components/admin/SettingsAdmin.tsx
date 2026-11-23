"use client";

import { useState, type FormEvent } from "react";
import { ImagePlus, Monitor, Moon, Sun, X } from "lucide-react";
import { BiField } from "@/components/admin/BiField";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { LoadError, ServerErrors, without } from "@/components/admin/parts";
import { PageHeader, Panel } from "@/components/admin/ui";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { useThemePref, type ThemePreference } from "@/hooks/useThemePref";
import { api, ApiError, describeIssue, errorMessage, fieldErrorsFrom, orNull, type AdminSettings, type ApiImage, type SettingsInput } from "@/lib/api";
import { cx } from "@/lib/format";

type Draft = {
  companyName: string;
  taglineKa: string;
  taglineEn: string;
  taglineRu: string;
  email: string;
  phone: string;
  addressKa: string;
  addressEn: string;
  addressRu: string;
  hoursKa: string;
  hoursEn: string;
  hoursRu: string;
  instagramUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
  whatsappNumber: string;
  messengerUsername: string;
  mapUrl: string;
  latitude: string;
  longitude: string;
  defaultSeoDescriptionKa: string;
  defaultSeoDescriptionEn: string;
  defaultSeoDescriptionRu: string;
  defaultOgImage: ApiImage | null;
  googleSiteVerification: string;
  gtmContainerId: string;
};

const toDraft = (s: AdminSettings): Draft => ({
  companyName: s.companyName,
  taglineKa: s.taglineKa,
  taglineEn: s.taglineEn ?? "",
  taglineRu: s.taglineRu ?? "",
  email: s.email,
  phone: s.phone,
  addressKa: s.addressKa,
  addressEn: s.addressEn ?? "",
  addressRu: s.addressRu ?? "",
  hoursKa: s.hoursKa,
  hoursEn: s.hoursEn ?? "",
  hoursRu: s.hoursRu ?? "",
  instagramUrl: s.instagramUrl,
  linkedinUrl: s.linkedinUrl,
  facebookUrl: s.facebookUrl,
  whatsappNumber: s.whatsappNumber,
  messengerUsername: s.messengerUsername,
  mapUrl: s.mapUrl,
  latitude: s.latitude === null ? "" : String(s.latitude),
  longitude: s.longitude === null ? "" : String(s.longitude),
  defaultSeoDescriptionKa: s.defaultSeoDescriptionKa,
  defaultSeoDescriptionEn: s.defaultSeoDescriptionEn ?? "",
  defaultSeoDescriptionRu: s.defaultSeoDescriptionRu ?? "",
  defaultOgImage: s.defaultOgImage,
  googleSiteVerification: s.googleSiteVerification,
  gtmContainerId: s.gtmContainerId,
});

const num = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")));

const toInput = (d: Draft): SettingsInput => ({
  companyName: d.companyName.trim(),
  taglineKa: d.taglineKa.trim(),
  taglineEn: orNull(d.taglineEn),
  taglineRu: orNull(d.taglineRu),
  email: d.email.trim(),
  phone: d.phone.trim(),
  addressKa: d.addressKa.trim(),
  addressEn: orNull(d.addressEn),
  addressRu: orNull(d.addressRu),
  hoursKa: d.hoursKa.trim(),
  hoursEn: orNull(d.hoursEn),
  hoursRu: orNull(d.hoursRu),
  instagramUrl: d.instagramUrl.trim(),
  linkedinUrl: d.linkedinUrl.trim(),
  facebookUrl: d.facebookUrl.trim(),
  // People paste "+995 555 12 34 56"; the API wants digits only.
  whatsappNumber: d.whatsappNumber.replace(/[\s+()-]/g, ""),
  messengerUsername: d.messengerUsername.trim(),
  mapUrl: d.mapUrl.trim(),
  latitude: num(d.latitude),
  longitude: num(d.longitude),
  defaultSeoDescriptionKa: d.defaultSeoDescriptionKa.trim(),
  defaultSeoDescriptionEn: orNull(d.defaultSeoDescriptionEn),
  defaultSeoDescriptionRu: orNull(d.defaultSeoDescriptionRu),
  defaultOgImageId: d.defaultOgImage?.id ?? null,
  googleSiteVerification: d.googleSiteVerification.trim(),
  gtmContainerId: d.gtmContainerId.trim(),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/]+\.[^\s]+$/;

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  const i = toInput(d);
  if (i.companyName.length < 2) e.companyName = "Company name is required.";
  else if (i.companyName.length > 24) e.companyName = "At most 24 characters, so it fits the header.";
  if (i.taglineKa.length > 40) e.taglineKa = "At most 40 characters.";
  if ((i.taglineEn ?? "").length > 40) e.taglineEn = "At most 40 characters.";
  if ((i.taglineRu ?? "").length > 40) e.taglineRu = "At most 40 characters.";
  if (!EMAIL.test(i.email)) e.email = "Enter a valid email address.";
  if (!/^[\d\s+()-]+$/.test(i.phone) || i.phone.replace(/\D/g, "").length < 7) e.phone = describeIssue({ code: "invalid_phone" });
  if (i.addressKa.length < 5) e.addressKa = "Address is required (5+ characters).";
  for (const k of ["instagramUrl", "linkedinUrl", "facebookUrl"] as const) if (i[k] && !URL_RE.test(i[k])) e[k] = describeIssue({ code: "invalid_url" });
  if (i.whatsappNumber && !/^\d{8,15}$/.test(i.whatsappNumber)) e.whatsappNumber = describeIssue({ code: "invalid_whatsapp" });
  if (i.messengerUsername && !/^[A-Za-z0-9.]+$/.test(i.messengerUsername)) e.messengerUsername = describeIssue({ code: "invalid_username" });
  if (i.latitude !== null && !(Number.isFinite(i.latitude) && i.latitude >= -90 && i.latitude <= 90)) e.latitude = "A number from -90 to 90.";
  if (i.longitude !== null && !(Number.isFinite(i.longitude) && i.longitude >= -180 && i.longitude <= 180)) e.longitude = "A number from -180 to 180.";
  if ((i.latitude === null) !== (i.longitude === null)) e[i.latitude === null ? "latitude" : "longitude"] = "Fill in both, or leave both empty.";
  if (i.defaultSeoDescriptionKa.length > 300) e.defaultSeoDescriptionKa = "At most 300 characters.";
  if ((i.defaultSeoDescriptionEn ?? "").length > 300) e.defaultSeoDescriptionEn = "At most 300 characters.";
  if ((i.defaultSeoDescriptionRu ?? "").length > 300) e.defaultSeoDescriptionRu = "At most 300 characters.";
  if (i.googleSiteVerification && !/^[A-Za-z0-9_-]+$/.test(i.googleSiteVerification)) e.googleSiteVerification = describeIssue({ code: "invalid_token" });
  if (i.gtmContainerId && !/^GTM-[A-Z0-9]+$/.test(i.gtmContainerId)) e.gtmContainerId = describeIssue({ code: "invalid_gtm_id" });
  return e;
}

const KNOWN = new Set<string>([
  "companyName", "taglineKa", "taglineEn", "taglineRu", "email", "phone", "addressKa", "addressEn", "addressRu", "hoursKa", "hoursEn", "hoursRu",
  "instagramUrl", "linkedinUrl", "facebookUrl", "whatsappNumber", "messengerUsername", "mapUrl", "latitude", "longitude",
  "defaultSeoDescriptionKa", "defaultSeoDescriptionEn", "defaultSeoDescriptionRu", "defaultOgImageId", "googleSiteVerification", "gtmContainerId",
]);

export function SettingsAdmin() {
  const { data, error, reload, update } = useApiData<AdminSettings>("/api/admin/settings");

  return (
    <>
      {error ? (
        <>
          <PageHeader title="Settings" />
          <Panel>
            <LoadError message={error.message} onRetry={reload} />
          </Panel>
        </>
      ) : !data ? (
        <>
          <PageHeader title="Settings" description="Company details shown across the public website." />
          <div className="h-96 animate-pulse rounded-md bg-paper-2/50" aria-busy="true" />
        </>
      ) : (
        <SettingsForm key={data.updatedAt} saved={data} onSaved={(s) => update(() => s)} />
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <AppearancePanel />
          <PasswordPanel />
        </div>
      </div>
    </>
  );
}

function SettingsForm({ saved, onSaved }: { saved: AdminSettings; onSaved: (s: AdminSettings) => void }) {
  const toast = useToast();
  const [base] = useState(() => toDraft(saved));
  const [d, setD] = useState<Draft>(base);
  const [show, setShow] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  const local = validate(d);
  const err = (k: string) => (show ? local[k] : undefined) ?? server[k] ?? (k === "defaultOgImage" ? server.defaultOgImageId : undefined);
  const dirty = JSON.stringify(d) !== JSON.stringify(base);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setServer((s) => without(s, k));
  };

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setShow(true);
    if (Object.keys(local).length) {
      toast({ tone: "error", title: "Check the highlighted fields" });
      return;
    }
    setSaving(true);
    setGeneral(null);
    try {
      const next = await api<AdminSettings>("/api/admin/settings", { method: "PUT", body: toInput(d) });
      toast({ tone: "success", title: "Settings saved", body: "The website now uses these details." });
      onSaved(next);
    } catch (e) {
      setServer(fieldErrorsFrom(e));
      setGeneral(errorMessage(e));
      toast({ tone: "error", title: "Could not save", body: errorMessage(e) });
      setSaving(false);
    }
  }

  const text = (k: keyof Draft, label: string, extra: { required?: boolean; hint?: string; placeholder?: string; type?: string; className?: string } = {}) => (
    <Field label={label} required={extra.required} error={err(k)} hint={extra.hint} className={extra.className}>
      {(a) => <Input {...a} type={extra.type ?? "text"} placeholder={extra.placeholder} value={d[k] as string} onChange={(ev) => set(k, ev.target.value)} />}
    </Field>
  );

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        title="Settings"
        description="Company details shown across the public website."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => setD(base)}>
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
          {general && <ServerErrors message={general} fields={server} known={KNOWN} />}
          <Panel title="Brand" bodyClassName="grid gap-5 p-5 sm:grid-cols-2">
            {text("companyName", "Company name", { required: true, hint: `${d.companyName.length}/24` })}
            <BiField label="Tagline" maxLength={40} ka={d.taglineKa} en={d.taglineEn} ru={d.taglineRu} onKa={(v) => set("taglineKa", v)} onEn={(v) => set("taglineEn", v)} onRu={(v) => set("taglineRu", v)} errorKa={err("taglineKa")} errorEn={err("taglineEn")} errorRu={err("taglineRu")} />
          </Panel>

          <Panel title="Contact" bodyClassName="grid gap-5 p-5 sm:grid-cols-2">
            {text("email", "Email", { required: true, type: "email", hint: "Contact form messages are sent here." })}
            {text("phone", "Phone", { required: true, type: "tel" })}
            <BiField label="Address" required maxLength={200} ka={d.addressKa} en={d.addressEn} ru={d.addressRu} onKa={(v) => set("addressKa", v)} onEn={(v) => set("addressEn", v)} onRu={(v) => set("addressRu", v)} errorKa={err("addressKa")} errorEn={err("addressEn")} errorRu={err("addressRu")} />
            <BiField label="Opening hours" maxLength={100} ka={d.hoursKa} en={d.hoursEn} ru={d.hoursRu} onKa={(v) => set("hoursKa", v)} onEn={(v) => set("hoursEn", v)} onRu={(v) => set("hoursRu", v)} errorKa={err("hoursKa")} errorEn={err("hoursEn")} errorRu={err("hoursRu")} />
          </Panel>

          <Panel title="Chat buttons" bodyClassName="grid gap-5 p-5 sm:grid-cols-2">
            {text("whatsappNumber", "WhatsApp number", { hint: "With country code, digits only, e.g. 995555123456. Empty = no WhatsApp button.", placeholder: "995555123456", type: "tel" })}
            {text("messengerUsername", "Messenger username", { hint: "The name in m.me/…, e.g. manidevelopment. Empty = no Messenger button.", placeholder: "manidevelopment" })}
          </Panel>

          <Panel title="Map" bodyClassName="grid gap-5 p-5 sm:grid-cols-2">
            {text("mapUrl", "Google Maps link", { hint: "In Google Maps: Share → Copy link. Empty = no map link.", placeholder: "https://maps.app.goo.gl/…", type: "url", className: "sm:col-span-2" })}
            {text("latitude", "Latitude", { hint: "Optional, for the map pin, e.g. 41.7151", placeholder: "41.7151", type: "text" })}
            {text("longitude", "Longitude", { hint: "Optional, e.g. 44.7871", placeholder: "44.7871", type: "text" })}
          </Panel>

          <Panel title="Social links" bodyClassName="grid gap-5 p-5 sm:grid-cols-3">
            {text("instagramUrl", "Instagram", { type: "url", placeholder: "https://" })}
            {text("linkedinUrl", "LinkedIn", { type: "url", placeholder: "https://" })}
            {text("facebookUrl", "Facebook", { type: "url", placeholder: "https://" })}
          </Panel>

          <Panel title="Search engines and sharing" bodyClassName="grid gap-5 p-5 sm:grid-cols-2">
            <BiField
              label="Default description"
              multiline
              rows={3}
              maxLength={300}
              hint="Used when a page has no description of its own"
              ka={d.defaultSeoDescriptionKa}
              en={d.defaultSeoDescriptionEn}
              ru={d.defaultSeoDescriptionRu}
              onKa={(v) => set("defaultSeoDescriptionKa", v)}
              onEn={(v) => set("defaultSeoDescriptionEn", v)}
              onRu={(v) => set("defaultSeoDescriptionRu", v)}
              errorKa={err("defaultSeoDescriptionKa")}
              errorEn={err("defaultSeoDescriptionEn")}
              errorRu={err("defaultSeoDescriptionRu")}
            />
            <div className="sm:col-span-2">
              <p className="text-[0.82rem] font-medium text-ink-soft">Default share image</p>
              <p className="mt-0.5 text-[0.8rem] text-muted">Shown when a link to the site is shared and the page has no image of its own. Best at 1200×630.</p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div className="relative aspect-[1200/630] w-48 overflow-hidden rounded-[3px] border border-line bg-paper-2">
                  {d.defaultOgImage && <Img src={d.defaultOgImage.src} alt="Default share image" sizes="192px" />}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                  <ImagePlus aria-hidden className="size-4" /> {d.defaultOgImage ? "Change" : "Choose image"}
                </Button>
                {d.defaultOgImage && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("defaultOgImage", null)}>
                    <X aria-hidden className="size-4" /> Remove
                  </Button>
                )}
              </div>
              {err("defaultOgImage") && (
                <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
                  {err("defaultOgImage")}
                </p>
              )}
            </div>
            {text("googleSiteVerification", "Google verification code", { hint: "From Google Search Console (HTML tag method): only the content value." })}
            {text("gtmContainerId", "Google Tag Manager ID", { hint: "Looks like GTM-XXXXXXX. Empty = no Tag Manager.", placeholder: "GTM-" })}
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
                    <span className="truncate text-[1.05rem] font-semibold uppercase tracking-[0.2em]">{d.companyName || "Name"}</span>
                    <span className="mt-1 truncate font-mono text-[0.58rem] uppercase tracking-[0.18em] opacity-60">{d.taglineKa}</span>
                  </span>
                  <span className="sr-only">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
          {dirty && <p className="text-[0.8rem] text-warn">Unsaved changes. The website still shows the previous details.</p>}
        </aside>
      </div>
      <ImagePicker open={picker} onClose={() => setPicker(false)} initial={d.defaultOgImage ? [d.defaultOgImage] : []} onSelect={([img]) => img && set("defaultOgImage", img)} title="Choose a share image" />
    </form>
  );
}

function AppearancePanel() {
  const [theme, setTheme] = useThemePref();
  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Match system", icon: Monitor },
  ];
  return (
    <Panel title="Appearance" bodyClassName="p-5">
      <p className="text-[0.85rem] text-muted" id="theme-label">
        Light or dark, for this browser only. Applied right away.
      </p>
      <div role="radiogroup" aria-labelledby="theme-label" className="mt-3 grid gap-2 sm:grid-cols-3">
        {themes.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={theme === t.value}
            onClick={() => setTheme(t.value)}
            className={cx("flex items-center gap-3 rounded-[3px] border p-4 text-left text-[0.88rem] transition-colors", theme === t.value ? "border-ink bg-paper" : "border-line hover:border-line-strong")}
          >
            <t.icon aria-hidden className="size-4.5" />
            {t.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function PasswordPanel() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; repeat?: string; general?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Enter your current password.";
    if (Array.from(next).length < 12) found.next = "Use at least 12 characters.";
    if (repeat !== next) found.repeat = "The two passwords don't match.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await api("/api/auth/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setRepeat("");
      toast({ tone: "success", title: "Password changed", body: "Other devices were signed out." });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") setErrors({ current: "The current password is incorrect." });
      else if (err instanceof ApiError && err.fieldErrors.newPassword?.[0]) setErrors({ next: describeIssue(err.fieldErrors.newPassword[0]) });
      else setErrors({ general: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="password" className="scroll-mt-24">
      <Panel title="Change password" bodyClassName="p-5">
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-3">
          {errors.general && (
            <p role="alert" className="rounded-[3px] bg-danger-soft px-3.5 py-2.5 text-[0.88rem] text-danger sm:col-span-3">
              {errors.general}
            </p>
          )}
          <Field label="Current password" error={errors.current}>
            {(a) => <Input {...a} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </Field>
          <Field label="New password" error={errors.next} hint="At least 12 characters.">
            {(a) => <Input {...a} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
          </Field>
          <Field label="Repeat new password" error={errors.repeat}>
            {(a) => <Input {...a} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" variant="outline" loading={saving}>
              Change password
            </Button>
          </div>
        </form>
      </Panel>
    </section>
  );
}
