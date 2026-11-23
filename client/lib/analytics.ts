// The only way the site sends analytics events (SEO_ANALYTICS_PERFORMANCE §9.2). Events go to the
// Google Tag Manager data layer, which exists only after the visitor accepted analytics and a
// container is configured (components/analytics/TagManager.tsx). Otherwise every call is a no-op.
// Only two events with fixed, non-personal parameters are allowed.

export type ContactChannel = "phone" | "whatsapp" | "messenger" | "email" | "map";

/** localStorage key of the visitor's analytics choice: "granted", "denied", or absent (not asked yet). */
export const CONSENT_KEY = "mani:analytics-consent";
export type ConsentChoice = "granted" | "denied";

/** Fired on `window` to show the consent banner again (footer link). */
export const CONSENT_OPEN_EVENT = "mani:consent-open";

const CHANNELS: ReadonlySet<string> = new Set<ContactChannel>(["phone", "whatsapp", "messenger", "email", "map"]);

type DataLayerWindow = Window & { dataLayer?: unknown[] };

export function readConsent(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function track(event: "contact_click", params: { channel: ContactChannel }): void;
export function track(event: "generate_lead"): void;
export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || readConsent() !== "granted") return;
  const dataLayer = (window as DataLayerWindow).dataLayer;
  if (!Array.isArray(dataLayer)) return;

  if (event === "contact_click") {
    const channel = params?.channel;
    if (typeof channel !== "string" || !CHANNELS.has(channel)) return;
    dataLayer.push({ event, channel });
  } else if (event === "generate_lead") {
    dataLayer.push({ event });
  }
}

/** Google's `gtag()` helper: it must push the `arguments` object itself, not an array. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed signature; the body reads `arguments`
export function gtag(..._args: unknown[]): void {
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params -- Consent Mode reads the Arguments object
  w.dataLayer.push(arguments);
}
