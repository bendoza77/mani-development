/**
 * URL slugs for projects, pages and services (docs/DATABASE_DESIGN.md §1, "Slugs for Georgian titles").
 * One Latin slug per record, shared by both languages.
 */

/** Georgian national romanization (2002), all 33 letters of the modern alphabet. */
const GEORGIAN_TO_LATIN: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i", კ: "k", ლ: "l",
  მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s", ტ: "t", უ: "u", ფ: "p", ქ: "k",
  ღ: "gh", ყ: "q", შ: "sh", ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};

const MAX_LENGTH = 80;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slugs that would collide with fixed routes or framework paths. */
const RESERVED = new Set([
  "admin", "api", "en", "ka", "home", "projects", "services", "about", "contact",
  "preview", "sitemap", "robots", "_next",
]);

export function transliterateGeorgian(text: string): string {
  return Array.from(text, (char) => GEORGIAN_TO_LATIN[char] ?? char).join("");
}

/** Suggests a slug from a title in either language. Returns "" when nothing usable remains. */
export function slugify(input: string): string {
  return transliterateGeorgian(input.toLowerCase())
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_LENGTH && SLUG_PATTERN.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}
