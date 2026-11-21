"use client";

import { Field, Input, Textarea } from "@/components/ui/Field";
import { cx } from "@/lib/format";

/**
 * One text field in both languages: Georgian (main language, usually required) and English
 * (optional; when empty the website shows the Georgian text).
 */
export function BiField({
  label,
  ka,
  en,
  onKa,
  onEn,
  required,
  multiline,
  rows = 5,
  maxLength,
  errorKa,
  errorEn,
  hint,
  className,
}: {
  label: string;
  ka: string;
  en: string;
  onKa: (v: string) => void;
  onEn: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  errorKa?: string;
  errorEn?: string;
  hint?: string;
  className?: string;
}) {
  const count = (v: string) => (maxLength ? `${v.length}/${maxLength}` : undefined);
  const hintFor = (v: string) => [hint, count(v)].filter(Boolean).join(" · ") || undefined;
  return (
    <div className={cx("grid gap-4 sm:col-span-2 sm:grid-cols-2", className)}>
      <Field label={`${label} · Georgian`} required={required} error={errorKa} hint={hintFor(ka)}>
        {(a) =>
          multiline ? (
            <Textarea {...a} lang="ka" rows={rows} value={ka} onChange={(e) => onKa(e.target.value)} />
          ) : (
            <Input {...a} lang="ka" value={ka} onChange={(e) => onKa(e.target.value)} />
          )
        }
      </Field>
      <Field label={`${label} · English`} error={errorEn} hint={hintFor(en) ?? "Optional. Empty = Georgian text is shown."}>
        {(a) =>
          multiline ? (
            <Textarea {...a} lang="en" rows={rows} value={en} onChange={(e) => onEn(e.target.value)} />
          ) : (
            <Input {...a} lang="en" value={en} onChange={(e) => onEn(e.target.value)} />
          )
        }
      </Field>
    </div>
  );
}
