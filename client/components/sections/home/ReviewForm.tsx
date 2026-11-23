"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { CircleCheck, Star, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { TURNSTILE_SCRIPT_SRC, useTurnstile } from "@/hooks/useTurnstile";
import { useLocale, useTranslation } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import { cx } from "@/lib/format";

type Key = "name" | "text" | "rating";
type Errors = Partial<Record<Key, true>>;
/** Screen order, so a failed send focuses the first problem the visitor would reach. */
const KEYS: Key[] = ["rating", "name", "text"];
/** API field names (POST /api/public/reviews) → form fields. */
const API_FIELDS: Record<string, Key> = { fullName: "name", text: "text", rating: "rating" };
const TEXT_MIN = 20;
const TEXT_MAX = 1000;

export type ReviewDraft = { name: string; text: string; rating: number };
export const EMPTY_REVIEW: ReviewDraft = { name: "", text: "", rating: 0 };
type Values = ReviewDraft;
type Failure = "failed" | "rateLimited" | "spam" | "verify";

function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = true;
  if (v.text.trim().length < TEXT_MIN) e.text = true;
  if (!(v.rating >= 1 && v.rating <= 5)) e.rating = true;
  return e;
}

/**
 * The "Write a review" form (inside the dialog). New reviews wait for an admin to approve them.
 * The typed values live in the parent, so closing the dialog by accident (Escape, a click outside)
 * keeps the draft; `onSent` clears it once the review is sent.
 */
export function ReviewForm({
  values,
  setValues,
  onSent,
  onClose,
}: {
  values: Values;
  setValues: Dispatch<SetStateAction<Values>>;
  onSent: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("home");
  const locale = useLocale();
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  /** Fields the server rejected; cleared when the visitor edits them. */
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | Failure>("idle");
  const [website, setWebsite] = useState(""); // honeypot: people never see or fill it
  const [hover, setHover] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const ratingId = useId();
  const { enabled: turnstileOn, token, widgetRef, reset: resetTurnstile, onScriptLoad } = useTurnstile(locale);

  // The thank-you replaces the form (and the focused send button), so move focus onto it.
  useEffect(() => {
    if (status === "sent") closeButton.current?.focus();
  }, [status]);

  const errors = { ...validate(values), ...serverErrors };
  const show = (k: Key) => ((touched[k] || serverErrors[k]) && errors[k] ? t(`reviews.form.validation.${k}`, { length: values.text.trim().length }) : undefined);

  function change<K extends Key>(k: K, value: Values[K]) {
    setValues((v) => ({ ...v, [k]: value }));
    if (serverErrors[k]) {
      setServerErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }
  const blur = (k: Key) => () => setTouched((x) => ({ ...x, [k]: true }));
  const focusField = (k: Key) =>
    form.current?.querySelector<HTMLElement>(k === "rating" ? 'input[name="rating"]' : `[name="${k}"]`)?.focus();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setTouched({ name: true, text: true, rating: true });
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
      await api<{ received: true }>("/api/public/reviews", {
        method: "POST",
        body: {
          fullName: values.name.trim(),
          text: values.text.trim(),
          rating: values.rating,
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
        for (const [field, key] of Object.entries(API_FIELDS)) if (error.fieldErrors[field]?.length) rejected[key] = true;
        if (Object.keys(rejected).length) {
          setServerErrors(rejected);
          setStatus("idle");
          focusField(KEYS.find((k) => rejected[k])!);
          return;
        }
      }
      if (error instanceof ApiError && error.status === 429) return setStatus("rateLimited");
      if (error instanceof ApiError && error.status === 403) return setStatus("spam");
      return setStatus("failed");
    }
    onSent();
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-start" role="status">
        <CircleCheck aria-hidden className="size-9 text-ok" strokeWidth={1.4} />
        <h3 className="t-h3 mt-5">{t("reviews.form.thanksTitle")}</h3>
        <p className="mt-2 max-w-md leading-relaxed text-ink-soft">{t("reviews.form.thanksBody")}</p>
        <Button ref={closeButton} variant="outline" className="mt-7" onClick={onClose}>
          {t("reviews.form.close")}
        </Button>
      </div>
    );
  }

  const sending = status === "sending";
  const problem = status === "failed" || status === "rateLimited" || status === "spam" || status === "verify" ? status : null;
  const textLength = values.text.trim().length;
  const ratingError = show("rating");
  const shown = hover || values.rating;

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="grid gap-5">
      {turnstileOn && <Script src={TURNSTILE_SCRIPT_SRC} strategy="afterInteractive" onReady={onScriptLoad} />}
      {problem && (
        <div role="alert" className="flex items-start gap-3 rounded-[3px] border border-danger/30 bg-danger-soft px-4 py-3 text-[0.9rem] text-danger">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(`reviews.form.errors.${problem}`)}
        </div>
      )}

      {/* Native radios: arrow keys move between the stars, and each has its own label. */}
      <fieldset aria-describedby={ratingError ? `${ratingId}-msg` : undefined}>
        <legend className="text-[0.82rem] font-medium text-ink-soft">
          {t("reviews.form.rating")}
          <span aria-hidden className="ml-0.5 text-accent">
            *
          </span>
        </legend>
        <div className="mt-1.5 flex w-fit" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="grid size-10 cursor-pointer place-items-center rounded-[3px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
              onMouseEnter={() => setHover(n)}
            >
              <input
                type="radio"
                name="rating"
                value={n}
                className="sr-only"
                checked={values.rating === n}
                onChange={() => change("rating", n)}
                onBlur={blur("rating")}
                disabled={sending}
                required
                aria-label={t("reviews.stars", { count: n })}
              />
              <Star
                aria-hidden
                strokeWidth={1.5}
                className={cx("size-7 transition-colors", n <= shown ? "fill-accent text-accent" : "text-line-strong")}
              />
            </label>
          ))}
        </div>
        {ratingError && (
          <p id={`${ratingId}-msg`} role="alert" className="mt-1.5 text-[0.8rem] text-danger">
            {ratingError}
          </p>
        )}
      </fieldset>

      <Field label={t("reviews.form.name")} required error={show("name")}>
        {(a) => (
          <Input
            {...a}
            name="name"
            value={values.name}
            onChange={(e) => change("name", e.target.value)}
            onBlur={blur("name")}
            autoComplete="name"
            disabled={sending}
            maxLength={100}
          />
        )}
      </Field>
      <Field
        label={t("reviews.form.text")}
        required
        error={show("text")}
        hint={textLength < TEXT_MIN ? t("reviews.form.textMin", { length: textLength }) : t("reviews.form.textCount", { length: textLength })}
      >
        {(a) => (
          <Textarea
            {...a}
            name="text"
            value={values.text}
            onChange={(e) => change("text", e.target.value)}
            onBlur={blur("text")}
            rows={5}
            disabled={sending}
            maxLength={TEXT_MAX}
          />
        )}
      </Field>

      {/* Honeypot: hidden from people and screen readers; bots that fill it are quietly ignored by the API. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          {t("reviews.form.website")}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {turnstileOn && <div ref={widgetRef} className="min-h-[65px]" />}

      <div className="flex justify-end">
        <Button type="submit" loading={sending}>
          {sending ? t("reviews.form.sending") : t("reviews.form.send")}
        </Button>
      </div>
    </form>
  );
}
