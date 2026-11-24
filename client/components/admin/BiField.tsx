"use client";

import { Field, Input, Textarea } from "@/components/ui/Field";
import { cx } from "@/lib/format";

/** Shown under an empty English or Russian box: what the website shows instead. */
export const EN_FALLBACK_HINT = "Optional. Empty = Georgian text is shown.";
export const RU_FALLBACK_HINT = "Optional. Empty = English text is shown (or Georgian).";

/**
 * One text field in the three site languages: Georgian (main language, usually required),
 * English and Russian (both optional; when empty the website falls back Russian → English →
 * Georgian). The name is kept from when there were two languages.
 */
export function BiField({
  label,
  ka,
  en,
  ru,
  onKa,
  onEn,
  onRu,
  required,
  multiline,
  rows = 5,
  maxLength,
  errorKa,
  errorEn,
  errorRu,
  hint,
  className,
}: {
  label: string;
  ka: string;
  en: string;
  ru: string;
  onKa: (v: string) => void;
  onEn: (v: string) => void;
  onRu: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  errorKa?: string;
  errorEn?: string;
  errorRu?: string;
  hint?: string;
  className?: string;
}) {
  const count = (v: string) => (maxLength ? `${v.length}/${maxLength}` : undefined);
  const hintFor = (v: string) => [hint, count(v)].filter(Boolean).join(" · ") || undefined;
  const box =
    (lang: "ka" | "en" | "ru", value: string, onChange: (v: string) => void) =>
    function LanguageBox(a: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) {
      return multiline ? (
        <Textarea {...a} lang={lang} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...a} lang={lang} value={value} onChange={(e) => onChange(e.target.value)} />
      );
    };
  return (
    <div className={cx("grid gap-4 sm:col-span-2 sm:grid-cols-2 xl:grid-cols-3", className)}>
      <Field label={`${label} · Georgian`} required={required} error={errorKa} hint={hintFor(ka)}>
        {box("ka", ka, onKa)}
      </Field>
      <Field label={`${label} · English`} error={errorEn} hint={hintFor(en) ?? EN_FALLBACK_HINT}>
        {box("en", en, onEn)}
      </Field>
      <Field label={`${label} · Russian`} error={errorRu} hint={hintFor(ru) ?? RU_FALLBACK_HINT}>
        {box("ru", ru, onRu)}
      </Field>
    </div>
  );
}
