// Shapes of the public API (server/docs/API_CONTRACTS.md §5–8), already in the visitor's language,
// plus small pure helpers. No server-only or client-only imports: used on both sides.
import type { ContactChannel } from "./analytics";
import type { ApiImage, ProjectCard, ProjectDetail } from "./api";
import type { Project } from "./types";

export const COMPANY_NAME = "MANI DEVELOPMENT";

export type PublicSettings = {
  companyName: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  hours: string;
  instagramUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
  /** International digits without "+", or "" (feature off). */
  whatsappNumber: string;
  messengerUsername: string;
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
  defaultSeoDescription: string;
  defaultOgImage: ApiImage | null;
  googleSiteVerification: string;
  gtmContainerId: string;
};

/** What the site shows when the API can't be reached: the name only, every feature off. */
export const EMPTY_SETTINGS: PublicSettings = {
  companyName: COMPANY_NAME,
  tagline: "",
  email: "",
  phone: "",
  address: "",
  hours: "",
  instagramUrl: "",
  linkedinUrl: "",
  facebookUrl: "",
  whatsappNumber: "",
  messengerUsername: "",
  mapUrl: "",
  latitude: null,
  longitude: null,
  defaultSeoDescription: "",
  defaultOgImage: null,
  googleSiteVerification: "",
  gtmContainerId: "",
};

export type PublicService = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  features: string[];
  image: ApiImage;
};

export type PublicTeamMember = { id: string; name: string; role: string; bio: string; photo: ApiImage };

export type PublicTestimonial = {
  id: string;
  quote: string;
  author: string;
  role: string;
  project: { slug: string; title: string } | null;
};

/** An approved visitor review, shown as written (not translated). */
export type PublicReview = { id: string; fullName: string; text: string; rating: number; createdAt: string };

export type PublicSlide = {
  id: string;
  image: ApiImage;
  heading: string;
  text: string;
  cta: { label: string; href: string } | null;
};

/** Resolved search-engine fields of a project or page (API_CONTRACTS §8.2). */
export type PublicSeo = { title: string; description: string; image: ApiImage | null; index: boolean; follow: boolean };

export type SitemapEntry = { path: string; lastModified: string; locales: string[] };

export type NavLink = { label: string; href: string; newTab: boolean };
export type Menus = { header: NavLink[]; footer: NavLink[] };

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Maps an API project to the shape the existing website components use (lib/types.ts). */
export function toProject(p: ProjectCard | ProjectDetail): Project {
  const detail = "description" in p ? p : undefined;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    description: detail?.description ?? "",
    location: p.location,
    city: p.city,
    category: p.category,
    status: p.status,
    progress: p.progress,
    startDate: p.startDate,
    estimatedCompletion: p.estimatedCompletion,
    completionDate: p.completionDate ?? undefined,
    featured: p.featured,
    cover: p.cover.src,
    gallery: detail?.gallery.map((g) => g.src) ?? [],
    specs: detail?.specs ?? [],
    architect: detail?.architect ?? "",
    updatedAt: p.updatedAt,
  };
}

// ─── Contact channels ──────────────────────────────────────────────────────

export type { ContactChannel };

/** The link for a contact channel, or null when the setting is empty (the button is then hidden). */
export function contactHref(channel: ContactChannel, s: PublicSettings): string | null {
  switch (channel) {
    case "phone": {
      const digits = s.phone.replace(/[^\d+]/g, "");
      return digits.replace(/\D/g, "").length >= 7 ? `tel:${digits}` : null;
    }
    case "email":
      return /^[^\s@]+@[^\s@]+$/.test(s.email) ? `mailto:${s.email}` : null;
    case "whatsapp":
      return /^\d{8,15}$/.test(s.whatsappNumber) ? `https://wa.me/${s.whatsappNumber}` : null;
    case "messenger":
      return /^[A-Za-z0-9.]+$/.test(s.messengerUsername) ? `https://m.me/${s.messengerUsername}` : null;
    case "map":
      if (/^https:\/\//i.test(s.mapUrl)) return s.mapUrl;
      if (s.latitude !== null && s.longitude !== null) {
        return `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`;
      }
      return null;
  }
}

/** Only on-site paths and https addresses are shown as links. */
export function isSafeLink(href: string): boolean {
  return (href.startsWith("/") && !href.startsWith("//")) || /^https:\/\//i.test(href);
}
