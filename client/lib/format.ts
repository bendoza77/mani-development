import type { InquiryStatus, MediaCategory, ProjectCategory, ProjectStatus } from "./types";

// Locale-independent formatting so server and client markup always match.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

/** "18 Nov 2026" */
export function formatDate(iso?: string) {
  const p = iso ? parts(iso) : null;
  return p ? `${p.day} ${MONTHS[p.m]} ${p.y}` : "—";
}

/** "Nov 2026" */
export function formatMonth(iso?: string) {
  const p = iso ? parts(iso) : null;
  return p ? `${MONTHS[p.m]} ${p.y}` : "—";
}

export function formatYear(iso?: string) {
  const p = iso ? parts(iso) : null;
  return p ? String(p.y) : "—";
}

/** Relative time for admin views. Only call from client-rendered UI (it reads the clock). */
export function timeAgo(iso: string, now: number) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return formatDate(iso);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  residential: "Residential",
  apartments: "Apartments",
  commercial: "Commercial",
  hospitality: "Hospitality",
  renovation: "Renovation",
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "In planning",
  "in-progress": "Under construction",
  completed: "Completed",
  "on-hold": "On hold",
};

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "New",
  "in-progress": "In progress",
  resolved: "Resolved",
};

export const MEDIA_CATEGORY_LABEL: Record<MediaCategory, string> = {
  exterior: "Exterior",
  interior: "Interior",
  construction: "Construction",
  team: "Team",
  uploads: "Uploads",
};

export const STAGES = ["Groundworks", "Structure", "Envelope", "Interiors", "Handover"] as const;

/** Maps overall progress to the five public construction stages. */
export function stageState(progress: number, index: number): "done" | "active" | "upcoming" {
  const span = 100 / STAGES.length;
  if (progress >= (index + 1) * span) return "done";
  if (progress > index * span) return "active";
  return "upcoming";
}

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
