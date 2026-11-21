/**
 * Company contact channels: the single place to configure WhatsApp, Messenger and Google Maps.
 *
 * The phone number and the street address shown on the site are not set here. They live in the
 * company Settings (seeded in `data/seed.ts`, editable in Admin → Settings), so every phone link
 * on the site follows what an editor enters there.
 *
 * WhatsApp opens a chat with the company phone number from Settings unless `whatsapp` overrides it.
 * Messenger set to `null` is not configured: its button is hidden in production builds and shown
 * as a dashed placeholder during `next dev`, so a visitor never gets a link that goes nowhere.
 */
export const CONTACT = {
  /**
   * Optional WhatsApp number in international format, e.g. "+995 5XX XX XX XX". Leave `null` to use
   * the company phone number from Settings (the one in the header). Set it only when WhatsApp runs
   * on a different number, such as a mobile; the number must be registered on WhatsApp.
   */
  whatsapp: null as string | null,

  /**
   * TODO(company): the official Facebook Page username (facebook.com/<username>) or numeric Page ID.
   * Messenger links open a conversation with that Page via https://m.me/<username>.
   */
  messengerPage: null as string | null,

  maps: {
    /**
     * Search text Google Maps resolves to the office, from the company's real address. Kept to the
     * street address on purpose: adding "Terminal" or the floor returns a list of nearby towers
     * instead of a single pin (checked 2026-11-21).
     */
    query: "37m Ilia Chavchavadze Ave, Tbilisi, Georgia",
    /**
     * TODO(company, optional): the Google Maps Place ID of the office, for an exact pin
     * (find it at https://developers.google.com/maps/documentation/places/web-service/place-id).
     */
    placeId: null as string | null,
  },
};

/** Digits only, with an international "00" prefix dropped: the form wa.me and tel: expect. */
function digits(phone: string) {
  return phone.replace(/\D/g, "").replace(/^00/, "");
}

/** A valid `tel:` URI for any human-formatted number, e.g. "+995 32 200 14 14" → "tel:+995322001414". */
export function telHref(phone: string) {
  const d = digits(phone);
  const international = /^\s*(\+|00)/.test(phone);
  return `tel:${international ? "+" : ""}${d}`;
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

/** WhatsApp click-to-chat link (https://wa.me/<number>), with an optional message the visitor can edit. */
export function whatsappHref(phone: string, message?: string) {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits(phone)}${text}`;
}

/** Messenger conversation with a Facebook Page. Accepts a username, Page ID or a pasted Page URL. */
export function messengerHref(page: string) {
  const id = page
    .trim()
    .replace(/^https?:\/\/(www\.|m\.)?(facebook\.com|fb\.com|m\.me)\//i, "")
    .replace(/[/?#].*$/, "");
  return `https://m.me/${encodeURIComponent(id)}`;
}

/**
 * Embeddable Google Map of the office for an <iframe>. Uses Google's keyless embed URL, so no API
 * key or Maps JavaScript is loaded by the site itself; `lang` sets the map's label language.
 */
export function mapsEmbedSrc(lang: string, zoom = 16) {
  const q = encodeURIComponent(CONTACT.maps.query);
  return `https://maps.google.com/maps?q=${q}&z=${zoom}&hl=${encodeURIComponent(lang)}&output=embed`;
}

/** Google Maps link for the office. Opens the Maps app on phones and maps.google.com on desktop. */
export function mapsHref() {
  const { query, placeId } = CONTACT.maps;
  const place = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${place}`;
}
