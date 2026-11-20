"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Trans } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n/client";
import { recordInquiry } from "@/lib/store";

type Values = { name: string; email: string; phone: string; subject: string; message: string };
/** Which fields are invalid. Messages are looked up in contact:validation.<field>. */
type Errors = Partial<Record<keyof Values, true>>;
const EMPTY: Values = { name: "", email: "", phone: "", subject: "", message: "" };

export function validateContact(v: Values): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = true;
  if (v.phone.trim() && (v.phone.replace(/\D/g, "").length < 7 || /[^\d\s+()-]/.test(v.phone))) e.phone = true;
  if (v.subject.trim().length < 3) e.subject = true;
  if (v.message.trim().length < 20) e.message = true;
  return e;
}

export function ContactForm() {
  const { t } = useTranslation("contact");
  const toast = useToast();
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  // Prefill the subject when arriving from a project page (?subject=...).
  useEffect(() => {
    const subject = new URLSearchParams(window.location.search).get("subject");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state after hydration
    if (subject) setValues((v) => ({ ...v, subject: subject.slice(0, 120) }));
  }, []);

  const errors = validateContact(values);
  const show = (k: keyof Values) =>
    touched[k] && errors[k] ? t(`validation.${k}`, { length: values.message.trim().length }) : undefined;
  const bind = (k: keyof Values) => ({
    name: k,
    value: values[k],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, subject: true, message: true });
    const first = (Object.keys(errors) as (keyof Values)[])[0];
    if (first) {
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus("sending");
    await new Promise((r) => setTimeout(r, 1100)); // simulated network latency
    if (simulateFailure) {
      setStatus("failed");
      toast({ tone: "error", title: t("toast.failedTitle"), body: t("toast.failedBody") });
      return;
    }
    recordInquiry({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      subject: values.subject.trim(),
      message: values.message.trim(),
    });
    setStatus("sent");
    toast({ tone: "success", title: t("toast.savedTitle"), body: t("toast.savedBody") });
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-start rounded-[3px] border border-line bg-card p-8 sm:p-10" role="status">
        <CircleCheck aria-hidden className="size-9 text-ok" strokeWidth={1.4} />
        <h2 className="t-h3 mt-6">{t("success.title", { name: values.name.split(" ")[0] })}</h2>
        <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
          <Trans
            t={t}
            i18nKey="success.body"
            values={{ subject: values.subject }}
            components={{ strong: <strong className="font-medium text-ink" /> }}
          />
        </p>
        <p className="mt-4 max-w-md rounded-[3px] bg-paper-2 px-4 py-3 text-[0.85rem] text-muted">
          {/* The admin demo is English-only, so this link is never localized. */}
          <Trans
            t={t}
            i18nKey="success.note"
            components={{ link: <Link href="/admin/inquiries" className="underline hover:text-ink" /> }}
          />
        </p>
        <Button
          variant="outline"
          className="mt-8"
          onClick={() => {
            setValues(EMPTY);
            setTouched({});
            setStatus("idle");
          }}
        >
          {t("success.again")}
        </Button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2" aria-describedby="form-note">
      {status === "failed" && (
        <div role="alert" className="flex items-start gap-3 rounded-[3px] border border-danger/30 bg-danger-soft px-4 py-3 text-[0.9rem] text-danger sm:col-span-2">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("form.failed")}
        </div>
      )}
      <Field label={t("form.name")} required error={show("name")}>
        {(a) => <Input {...a} {...bind("name")} autoComplete="name" disabled={sending} />}
      </Field>
      <Field label={t("form.email")} required error={show("email")}>
        {(a) => <Input {...a} {...bind("email")} type="email" autoComplete="email" inputMode="email" disabled={sending} />}
      </Field>
      <Field label={t("form.phone")} error={show("phone")} hint={t("form.optional")}>
        {(a) => <Input {...a} {...bind("phone")} type="tel" autoComplete="tel" inputMode="tel" disabled={sending} />}
      </Field>
      <Field label={t("form.subject")} required error={show("subject")}>
        {(a) => <Input {...a} {...bind("subject")} disabled={sending} maxLength={120} />}
      </Field>
      <Field label={t("form.message")} required error={show("message")} className="sm:col-span-2">
        {(a) => <Textarea {...a} {...bind("message")} rows={6} disabled={sending} placeholder={t("form.messagePlaceholder")} />}
      </Field>

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p id="form-note" className="max-w-sm text-[0.8rem] text-muted">
          {t("form.note")}
        </p>
        <Button type="submit" size="lg" loading={sending} arrow>
          {sending ? t("form.sending") : status === "failed" ? t("form.retry") : t("form.submit")}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-[0.8rem] text-muted sm:col-span-2">
        <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} className="size-4 accent-(--accent)" />
        {t("form.simulateFailure")}
      </label>
    </form>
  );
}
