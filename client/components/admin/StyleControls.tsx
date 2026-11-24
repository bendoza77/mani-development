"use client";

import { useId } from "react";
import { AlignCenter, AlignLeft, AlignRight, Ban, TriangleAlert } from "lucide-react";
import { cx } from "@/lib/format";
import { PALETTE, SITE_BACKGROUND, SITE_TEXT, contrastRatio, isHex, type Align, type PageStyle, type Padding, type SectionStyle, type Width } from "@/lib/style";

/** A color: none (site default), one of the site's colors, or any color from the picker. */
export function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (hex: string | null) => void }) {
  const id = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="text-[0.82rem] font-medium text-ink-soft">{label}</legend>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          aria-label={`${label}: none (site default)`}
          title="None (site default)"
          className={cx(
            "grid size-7 place-items-center rounded-full border border-line-strong bg-card text-muted",
            value === null && "ring-2 ring-accent ring-offset-2 ring-offset-card",
          )}
        >
          <Ban aria-hidden className="size-3.5" />
        </button>
        {PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            aria-pressed={value === c.hex}
            aria-label={`${label}: ${c.name}`}
            title={c.name}
            className={cx("size-7 rounded-full border border-black/15", value === c.hex && "ring-2 ring-accent ring-offset-2 ring-offset-card")}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <label htmlFor={id} className="ml-1 flex items-center gap-1.5 text-[0.78rem] text-muted">
          <input
            id={id}
            type="color"
            value={value ?? "#ffffff"}
            onChange={(e) => onChange(isHex(e.target.value) ? e.target.value.toLowerCase() : null)}
            className="size-7 cursor-pointer rounded border border-line-strong bg-card p-0.5"
          />
          <span>Custom</span>
          <span aria-live="polite" className="font-mono">
            {value ?? "none"}
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/** Shown when text on its background is harder to read than WCAG AA allows (4.5:1). */
export function ContrastWarning({ text, background }: { text: string; background: string }) {
  const ratio = contrastRatio(text, background);
  if (ratio >= 4.5) return null;
  return (
    <p role="status" className="flex items-start gap-1.5 rounded-[3px] bg-warn-soft px-2.5 py-1.5 text-[0.78rem] text-warn">
      <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      Low contrast ({ratio.toFixed(1)}:1). Text may be hard to read; aim for at least 4.5:1.
    </p>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: typeof AlignLeft }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[0.82rem] font-medium text-ink-soft">{label}</legend>
      <div className="mt-2 inline-flex flex-wrap gap-1 rounded-[3px] bg-paper-2 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            aria-label={o.icon ? `${label}: ${o.label}` : undefined}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={cx("inline-flex h-8 items-center gap-1 rounded-[2px] px-2.5 text-[0.78rem]", value === o.value ? "bg-card shadow-sm" : "text-muted hover:text-ink")}
          >
            {o.icon ? <o.icon aria-hidden className="size-4" /> : o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const ALIGN_OPTIONS: { value: Align; label: string; icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
];
const PADDING_OPTIONS: { value: Padding; label: string }[] = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const WIDTH_OPTIONS: { value: Width; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "normal", label: "Normal" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
];

/** The per-section "Style" panel. `page` gives the page colors for the contrast check. */
/** Changes are sent as patches (only the field that changed), so quick successive clicks never overwrite each other. */
export function SectionStylePanel({ value, onChange, page, bare }: { value: SectionStyle; onChange: (patch: Partial<SectionStyle>) => void; page: PageStyle; /** Always open, without the collapsible header (e.g. in a side panel). */ bare?: boolean }) {
  const set = <K extends keyof SectionStyle>(k: K, v: SectionStyle[K]) => onChange({ [k]: v } as Partial<SectionStyle>);
  const changed = JSON.stringify(value) !== JSON.stringify({ background: null, textColor: null, align: "left", padding: "medium", width: "normal" });
  if (bare) return <StyleFields value={value} set={set} page={page} />;
  return (
    <details className="group rounded-[3px] border border-line sm:col-span-2" open={changed || undefined}>
      <summary className="cursor-pointer list-none px-3 py-2 text-[0.82rem] font-medium text-ink-soft select-none hover:text-ink">
        <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-90">▸</span>
        Style{changed ? " · customised" : ""}
      </summary>
      <div className="grid gap-4 border-t border-line p-3 sm:grid-cols-2">
        <ColorField label="Background" value={value.background} onChange={(v) => set("background", v)} />
        <ColorField label="Text color" value={value.textColor} onChange={(v) => set("textColor", v)} />
        <div className="sm:col-span-2">
          <ContrastWarning text={value.textColor ?? page.textColor ?? SITE_TEXT} background={value.background ?? page.background ?? SITE_BACKGROUND} />
        </div>
        <Choice label="Alignment" value={value.align} options={ALIGN_OPTIONS} onChange={(v) => set("align", v)} />
        <Choice label="Spacing" value={value.padding} options={PADDING_OPTIONS} onChange={(v) => set("padding", v)} />
        <Choice label="Width" value={value.width} options={WIDTH_OPTIONS} onChange={(v) => set("width", v)} />
      </div>
    </details>
  );
}

/** The page's own colors (background, text, accent for links and buttons). */
export function PageColorsPanel({ value, onChange }: { value: PageStyle; onChange: (patch: Partial<PageStyle>) => void }) {
  return (
    <fieldset className="space-y-4 rounded-md border border-line bg-card p-5">
      <legend className="sr-only">Page colors</legend>
      <div>
        <h2 aria-hidden className="text-[0.95rem] font-semibold">
          Page colors
        </h2>
        <p className="mt-0.5 text-[0.8rem] text-muted">For this page only. None = the site&rsquo;s usual colors.</p>
      </div>
      <ColorField label="Background" value={value.background} onChange={(v) => onChange({ background: v })} />
      <ColorField label="Text" value={value.textColor} onChange={(v) => onChange({ textColor: v })} />
      <ColorField label="Accent (links, buttons)" value={value.accent} onChange={(v) => onChange({ accent: v })} />
      <ContrastWarning text={value.textColor ?? SITE_TEXT} background={value.background ?? SITE_BACKGROUND} />
    </fieldset>
  );
}

function StyleFields({ value, set, page }: { value: SectionStyle; set: <K extends keyof SectionStyle>(k: K, v: SectionStyle[K]) => void; page: PageStyle }) {
  return (
    <div className="grid gap-4">
      <ColorField label="Background" value={value.background} onChange={(v) => set("background", v)} />
      <ColorField label="Text color" value={value.textColor} onChange={(v) => set("textColor", v)} />
      <ContrastWarning text={value.textColor ?? page.textColor ?? SITE_TEXT} background={value.background ?? page.background ?? SITE_BACKGROUND} />
      <Choice label="Alignment" value={value.align} options={ALIGN_OPTIONS} onChange={(v) => set("align", v)} />
      <Choice label="Spacing" value={value.padding} options={PADDING_OPTIONS} onChange={(v) => set("padding", v)} />
      <Choice label="Width" value={value.width} options={WIDTH_OPTIONS} onChange={(v) => set("width", v)} />
    </div>
  );
}
