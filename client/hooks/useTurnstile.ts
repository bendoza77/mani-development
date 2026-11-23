"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";

/** Cloudflare Turnstile (spam check), only when a site key is configured. */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Load with next/script (`onReady={onScriptLoad}`) when `enabled`. */
export const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
type TurnstileWindow = Window & { turnstile?: Turnstile };

/**
 * The Turnstile widget for a public form: put `widgetRef` on an empty div, send `token` with the
 * form, and call `reset` after a failed send (a token works once).
 */
export function useTurnstile(locale: Locale) {
  const widgetEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [token, setToken] = useState("");

  const renderWidget = useCallback(() => {
    const ts = (window as TurnstileWindow).turnstile;
    if (!ts || !widgetEl.current || widgetId.current) return;
    widgetId.current = ts.render(widgetEl.current, {
      sitekey: TURNSTILE_SITE_KEY,
      language: locale,
      callback: (value: string) => setToken(value),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
  }, [locale]);

  // The widget container can mount again (e.g. after "Send another message"), so it is wired with a callback ref.
  const widgetRef = useCallback(
    (el: HTMLDivElement | null) => {
      widgetEl.current = el;
      if (el) {
        renderWidget();
      } else if (widgetId.current) {
        (window as TurnstileWindow).turnstile?.remove(widgetId.current);
        widgetId.current = null;
      }
    },
    [renderWidget],
  );

  useEffect(() => {
    if (TURNSTILE_SITE_KEY && turnstileReady) renderWidget();
  }, [turnstileReady, renderWidget]);

  const reset = useCallback(() => {
    if (widgetId.current) (window as TurnstileWindow).turnstile?.reset(widgetId.current);
    setToken("");
  }, []);

  const onScriptLoad = useCallback(() => setTurnstileReady(true), []);

  return { enabled: Boolean(TURNSTILE_SITE_KEY), token, widgetRef, reset, onScriptLoad };
}
