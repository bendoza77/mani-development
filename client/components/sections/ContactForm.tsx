"use client";

import Script from "next/script";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Trans } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { TURNSTILE_SCRIPT_SRC, useTurnstile } from "@/hooks/useTurnstile";
import { useLocale, useTranslation } from "@/i18n/client";
import { track } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";

type Values = { name: string; email: string; phone: string; subject: string; message: string };
type Key = keyof Values;
/** Which fields are invalid. Messages are looked up in contact:validation.<field>. */
type Errors = Partial<Record<Key, true>>;
const EMPTY: Values = { name: "", email: "", phone: "", subject: "", message: "" };
const KEYS: Key[] = ["name", "email", "phone", "subject", "message"];
/** What the visitor is planning. The chosen label is sent as the inquiry subject, so the admin inbox shows it as is. */
const TOPICS = ["house", "apartment", "business", "renovation", "other"] as const;
/** "project" is the extra choice offered when the visitor arrives from a project page. */
type Topic = (typeof TOPICS)[number] | "project";

export function validateContact(v: Values): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = true;
  if (v.phone.trim() && (v.phone.replace(/\D/g, "").length < 7 || /[^\d\s+()-]/.test(v.phone))) e.phone = true;
  if (v.subject.trim().length < 3) e.subject = true;
  if (v.message.trim().length < 20) e.message = true;
  return e;
}

type Failure = "failed" | "rateLimited" | "spam" | "verify";

/** Sends the message to the API (POST /api/public/inquiries, API_CONTRACTS §5). */
export function ContactForm() {
  const { t } = useTranslation("contact");
  const locale = useLocale();
  const toast = useToast();
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  /** Fields the server rejected; cleared when the visitor edits them. */
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | Failure>("idle");
  const [website, setWebsite] = useState(""); // honeypot: people never see or fill it
  const [topic, setTopic] = useState<Topic | "">("");
  /** Subject prefilled by a project page link, offered as the first choice. */
  const [projectSubject, setProjectSubject] = useState("");
  const form = useRef<HTMLFormElement>(null);

  const { enabled: turnstileOn, token, widgetRef, reset: resetTurnstile, onScriptLoad } = useTurnstile(locale);

  // Prefill the subject when arriving from a project page (?subject=...).
  useEffect(() => {
    const subject = new URLSearchParams(window.location.search).get("subject");
    if (!subject) return;
    const text = subject.slice(0, 120);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state after hydration
    setProjectSubject(text);
    setTopic("project");
    setValues((v) => ({ ...v, subject: text }));
  }, []);

  const errors = { ...validateContact(values), ...serverErrors };
  const show = (k: Key) => ((touched[k] || serverErrors[k]) && errors[k] ? t(`validation.${k}`, { length: values.message.trim().length }) : undefined);
  const update = (k: Key, value: string) => {
    setValues((v) => ({ ...v, [k]: value }));
    if (serverErrors[k]) {
      setServerErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };
  const bind = (k: Key) => ({
    name: k,
    value: values[k],
    onChange: (e: { target: { value: string } }) => update(k, e.target.value),
    onBlur: () => setTouched((x) => ({ ...x, [k]: true })),
  });
  const chooseTopic = (next: Topic) => {
    setTopic(next);
    update("subject", next === "project" ? projectSubject : t(`form.topics.${next}`));
  };

  /** Brings the whole field (label included) into view below the fixed header, then focuses it. */
  const focusField = (k: Key) => {
    const control = form.current?.querySelector<HTMLElement>(`[name="${k}"]`);
    if (!control) return;
    (control.closest("div") ?? control).scrollIntoView({ block: "nearest" });
    control.focus({ preventScroll: true });
  };

  function fail(kind: Failure) {
    setStatus(kind);
    if (kind === "failed") toast({ tone: "error", title: t("toast.failedTitle"), body: t("toast.failedBody") });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setTouched({ name: true, email: true, phone: true, subject: true, message: true });
    const first = KEYS.find((k) => errors[k]);
    if (first) {
      focusField(first);
      return;
    }
    if (turnstileOn && !token) {
      setStatus("verify");
      return;
    }
    setStatus("sending");
    try {
      await api<{ received: true }>("/api/public/inquiries", {
        method: "POST",
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          subject: values.subject.trim(),
          message: values.message.trim(),
          locale,
          website,
          ...(token ? { turnstileToken: token } : {}),
        },
      });
    } catch (error) {
      // A Turnstile token works once: get a fresh one for the next attempt.
      resetTurnstile();
      if (error instanceof ApiError && error.status === 400 && Object.keys(error.fieldErrors).length) {
        const rejected: Errors = {};
        for (const k of KEYS) if (error.fieldErrors[k]?.length) rejected[k] = true;
        if (Object.keys(rejected).length) {
          setServerErrors(rejected);
          setStatus("idle");
          focusField(KEYS.find((k) => rejected[k])!);
          return;
        }
      }
      if (error instanceof ApiError && error.status === 429) return fail("rateLimited");
      if (error instanceof ApiError && error.status === 403) return fail("spam");
      return fail("failed");
    }
    setStatus("sent");
    track("generate_lead");
    toast({ tone: "success", title: t("toast.savedTitle"), body: t("toast.savedBody") });
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-start rounded-[3px] border border-line bg-card p-8 sm:p-10" role="status">
        <CircleCheck aria-hidden className="size-9 text-ok" strokeWidth={1.4} />
        <h2 className="t-h3 mt-6">{t("success.title", { name: values.name.trim().split(" ")[0] })}</h2>
        <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
          <Trans
            t={t}
            i18nKey="success.body"
            values={{ subject: values.subject }}
            components={{ strong: <strong className="font-medium text-ink" /> }}
          />
        </p>
        <p className="mt-4 max-w-md text-[0.9rem] text-muted">{t("success.note")}</p>
        <Button
          variant="outline"
          className="mt-8"
          onClick={() => {
            setValues(EMPTY);
            setTopic("");
            setTouched({});
            setServerErrors({});
            setStatus("idle");
          }}
        >
          {t("success.again")}
        </Button>
      </div>
    );
  }

  const sending = status === "sending";
  const problem = status === "failed" || status === "rateLimited" || status === "spam" || status === "verify" ? status : null;

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2" aria-describedby="form-note">
      {turnstileOn && <Script src={TURNSTILE_SCRIPT_SRC} strategy="afterInteractive" onReady={onScriptLoad} />}
      {problem && (
        <div role="alert" className="flex items-start gap-3 rounded-[3px] border border-danger/30 bg-danger-soft px-4 py-3 text-[0.9rem] text-danger sm:col-span-2">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(`form.${problem}`)}
        </div>
      )}
      <Field label={t("form.name")} required error={show("name")}>
        {(a) => <Input {...a} {...bind("name")} autoComplete="name" disabled={sending} maxLength={100} />}
      </Field>
      <Field label={t("form.email")} required error={show("email")}>
        {(a) => <Input {...a} {...bind("email")} type="email" autoComplete="email" inputMode="email" disabled={sending} maxLength={254} />}
      </Field>
      <Field label={t("form.phone")} error={show("phone")} hint={t("form.optional")}>
        {(a) => <Input {...a} {...bind("phone")} type="tel" autoComplete="tel" inputMode="tel" disabled={sending} maxLength={40} />}
      </Field>
      <Field label={t("form.subject")} required error={show("subject")}>
        {(a) => (
          <Select
            {...a}
            name="subject"
            value={topic}
            onChange={(e) => chooseTopic(e.target.value as Topic)}
            onBlur={() => setTouched((x) => ({ ...x, subject: true }))}
            disabled={sending}
            className={topic ? undefined : "text-muted"}
          >
            <option value="" disabled>
              {t("form.subjectChoose")}
            </option>
            {projectSubject && (
              <option value="project" className="text-ink">
                {projectSubject}
              </option>
            )}
            {TOPICS.map((k) => (
              <option key={k} value={k} className="text-ink">
                {t(`form.topics.${k}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("form.message")} required error={show("message")} className="sm:col-span-2">
        {(a) => <Textarea {...a} {...bind("message")} rows={6} disabled={sending} maxLength={5000} placeholder={t("form.messagePlaceholder")} />}
      </Field>

      {/* Honeypot: hidden from people and screen readers; bots that fill it are quietly ignored by the API. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          {t("form.website")}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {turnstileOn && <div ref={widgetRef} className="min-h-[65px] sm:col-span-2" />}

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p id="form-note" className="max-w-sm text-[0.8rem] text-muted">
          {t("form.note")}
        </p>
        <Button type="submit" size="lg" loading={sending}>
          {sending ? t("form.sending") : problem && problem !== "verify" ? t("form.retry") : t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
