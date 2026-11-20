import { seedProjects, seedServices, seedSettings, seedTeam, seedTestimonials } from "@/data/seed";
import type { Project, Service, Settings, TeamMember, Testimonial } from "@/lib/types";
import type { ContentOverlay } from "./resources";

/**
 * Localizes records from the demo database.
 *
 * The admin demo edits English text in the browser, so a translation is only used while a field
 * still holds its seeded English value. Anything an editor changed or created is shown exactly as
 * entered. Names of projects and architecture firms are proper names and are never translated.
 */
const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
const SEED = {
  projects: byId(seedProjects),
  services: byId(seedServices),
  testimonials: byId(seedTestimonials),
  team: byId(seedTeam),
};

function pick<T extends object, K extends keyof T>(
  record: T,
  seed: T | undefined,
  overlay: Partial<Record<K, unknown>> | undefined,
  keys: K[],
): T {
  if (!seed || !overlay) return record;
  let out = record;
  for (const k of keys) {
    const translated = overlay[k];
    if (translated !== undefined && record[k] === seed[k]) {
      if (out === record) out = { ...record };
      out[k] = translated as T[K];
    }
  }
  return out;
}

export type ContentLocalizer = ReturnType<typeof createContentLocalizer>;

export function createContentLocalizer(overlay: ContentOverlay) {
  const project = (p: Project): Project => {
    const t = overlay.projects?.[p.id];
    const seed = SEED.projects.get(p.id);
    if (!t || !seed) return p;
    const out = pick(p, seed, t, ["title", "summary", "description", "location", "city"]);
    // Spec rows keep their seeded ids when edited, so they are matched by id, not position.
    const specs = p.specs.map((s) => {
      const index = seed.specs.findIndex((x) => x.id === s.id);
      const seedSpec = seed.specs[index];
      const tr = t.specs?.[index];
      if (!seedSpec || !tr) return s;
      return {
        ...s,
        label: s.label === seedSpec.label ? tr.label : s.label,
        value: s.value === seedSpec.value ? tr.value : s.value,
      };
    });
    return { ...out, specs };
  };

  const service = (s: Service): Service => {
    const t = overlay.services?.[s.id];
    const seed = SEED.services.get(s.id);
    if (!t || !seed) return s;
    const out = pick(s, seed, t, ["title", "summary", "description"]);
    const features =
      t.features && s.features.join("\n") === seed.features.join("\n") ? t.features : s.features;
    return { ...out, features };
  };

  const testimonial = (x: Testimonial): Testimonial =>
    pick(x, SEED.testimonials.get(x.id), overlay.testimonials?.[x.id], ["quote", "author", "role"]);

  const member = (m: TeamMember): TeamMember => pick(m, SEED.team.get(m.id), overlay.team?.[m.id], ["name", "role", "bio"]);

  const settings = (s: Settings): Settings => pick(s, seedSettings, overlay.settings, ["tagline", "address", "hours"]);

  return { project, service, testimonial, member, settings };
}
