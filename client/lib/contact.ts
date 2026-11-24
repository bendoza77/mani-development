import { contactHref, type PublicSettings } from "./public-types";

/**
 * Display helpers for the company contact details. The details themselves (phone, WhatsApp,
 * Messenger, address, map link, coordinates) come from Admin → Settings, and the links for each
 * channel are built by `contactHref` in lib/public-types.ts.
 */

/** Digits only, with an international "00" prefix dropped. */
function digits(phone: string) {
  return phone.replace(/\D/g, "").replace(/^00/, "");
}

/**
 * Readable phone number. Georgian numbers are grouped the local way (mobile "+995 5XX XX XX XX",
 * landline "+995 32 2XX XX XX"); anything else is shown exactly as entered.
 */
export function formatPhone(phone: string) {
  const d = digits(phone);
  if (!/^\s*(\+|00)/.test(phone) || !d.startsWith("995") || d.length !== 12) return phone.trim();
  const n = d.slice(3);
  return n.startsWith("5")
    ? `+995 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`
    : `+995 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

/** What Google Maps should look up for the office: the coordinates when set, else the address. */
function mapQuery(s: PublicSettings): string | null {
  if (s.latitude !== null && s.longitude !== null) return `${s.latitude},${s.longitude}`;
  return s.address.trim() || null;
}

/** Google Maps link for the office: the map link from Settings, else a search for the coordinates or address. */
export function mapsHref(s: PublicSettings): string | null {
  const set = contactHref("map", s);
  if (set) return set;
  const q = mapQuery(s);
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

/**
 * Embeddable Google Map of the office for an <iframe>, or null with no coordinates or address.
 * Uses Google's keyless embed URL, so no API key or Maps JavaScript is loaded by the site itself;
 * `lang` sets the map's label language.
 */
export function mapsEmbedSrc(s: PublicSettings, lang: string, zoom = 16): string | null {
  const q = mapQuery(s);
  if (!q) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&hl=${encodeURIComponent(lang)}&output=embed`;
}
