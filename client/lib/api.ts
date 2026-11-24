import type { PageStyle, SectionStyle } from "./style";

// Typed client for the MANI DEVELOPMENT API (server/docs/API_CONTRACTS.md).
// Browser-only for now: admin and sign-in requests carry the session cookie.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

/** Fired on `window` when an admin request answers 401. */
export const UNAUTHENTICATED_EVENT = "mani:unauthenticated";

export type FieldIssue ={ code: string; minimum?: number; maximum?: number };
export type FieldErrors = Record<string, FieldIssue[]>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal };

export async function api<T>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      // The session cookie goes only to the admin and sign-in routes; public routes don't allow
      // credentialed requests (CORS), and don't need them.
      credentials: /^\/api\/(auth|admin)(\/|$|\?)/.test(path) ? "include" : "omit",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK", "Can't reach the server. Is the API running?");
  }
  if (res.status === 204 || res.status === 202) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // The session ended on the server (idle timeout, password change elsewhere): tell the admin shell.
    if (res.status === 401 && path.startsWith("/api/admin") && typeof window !== "undefined") {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    }
    const err = (data as { error?: { code?: string; message?: string; details?: { fieldErrors?: FieldErrors } } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? `Request failed (${res.status}).`, err?.details?.fieldErrors ?? {});
  }
  return data as T;
}

/** A readable sentence for one field issue (codes come from the server, see API_CONTRACTS §1). */
export function describeIssue(issue: FieldIssue): string {
  switch (issue.code) {
    case "too_small":
      if (issue.minimum !== undefined && issue.minimum < 1) return `Must be ${issue.minimum} or more.`;
      return issue.minimum === 1 ? "Required." : `At least ${issue.minimum} characters.`;
    case "too_big":
      return `At most ${issue.maximum} characters.`;
    case "too_short":
      return "Too short (at least 12 characters).";
    case "too_long":
      return "Too long (at most 128 characters).";
    case "same_as_email":
      return "Don't use your email address as the password.";
    case "too_common":
      return "This password is too common. Choose a harder one.";
    case "repeated_character":
      return "Don't repeat a single character.";
    case "required":
      return "Required.";
    case "invalid_phone":
      return "Enter a valid phone number (digits, spaces, + ( ) -).";
    case "invalid_whatsapp":
      return "Digits only, with the country code, e.g. 995555123456.";
    case "invalid_username":
      return "Letters, numbers and dots only.";
    case "not_google_maps":
      return "Paste a Google Maps link (https://maps.app.goo.gl/… or https://www.google.com/maps/…).";
    case "invalid_gtm_id":
      return "Should look like GTM-XXXXXXX.";
    case "invalid_token":
      return "Letters, numbers, - and _ only.";
    case "invalid_url":
      return "Use a full address starting with https://.";
    case "invalid_path":
      return "Use a site path starting with /, e.g. /old-page (no spaces, ? or #).";
    case "live_address":
      return "A live page or project uses this address. Only addresses that no longer exist can redirect.";
    case "same_as_from":
      return "Must be different from the old address.";
    case "page_or_link_required":
      return "Enter a link.";
    case "invalid_image":
      return "The file isn't a valid image.";
    case "reserved_slug":
      return "This address is reserved. Choose another.";
    case "before_start":
      return "Must be on or after the start date.";
    case "required_when_completed":
      return "Completed projects need a completion date.";
    case "must_be_100_when_completed":
      return "Completed projects must be at 100%.";
    case "button_needs_label_and_link":
      return "Give the button both a label and a link, or leave both empty.";
    case "unsafe_link":
      return "Use a link starting with https://, http://, mailto:, tel: or a site path like /contact.";
    case "menu_full":
      return "This menu already has 12 entries. Remove one first.";
    case "unsupported_embed":
      return "Not a supported video link.";
    case "invalid_format":
      return "Invalid format.";
    case "invalid_type":
      return "Required.";
    case "unrecognized_key":
      return "Not allowed.";
    default:
      return `Invalid (${issue.code}).`;
  }
}

/** A short, friendly sentence for an API error (by its code), for toasts and banners. */
export function errorMessage(error: unknown, fallback = "Unexpected error. Please try again."): string {
  if (!(error instanceof ApiError)) return error instanceof Error && error.message ? error.message : fallback;
  switch (error.code) {
    case "ORDER_MISMATCH":
      return "The list changed in another tab or by someone else. It has been reloaded; please try again.";
    case "SLIDE_LIMIT":
      return "The slider holds at most 8 slides. Delete one first.";
    case "MENU_FULL":
      return "This menu already has 12 items. Remove one first.";
    case "REDIRECT_EXISTS":
      return "That old address already redirects somewhere. Delete that redirect first.";
    case "ALREADY_IN_MENU":
      return "That page is already in this menu.";
    case "INVALID_REFERENCE":
      return error.message || "A chosen item no longer exists. Reload and try again.";
    case "RATE_LIMITED":
      return "Too many requests. Please wait a few minutes and try again.";
    case "VALIDATION_FAILED":
      return "Check the highlighted fields.";
    default:
      return error.message || fallback;
  }
}

/** Field errors as `{ field: "message" }`, plus a general message for errors without fields. */
export function errorsFrom(error: unknown): { fields: Record<string, string>; message: string } {
  if (!(error instanceof ApiError)) return { fields: {}, message: "Unexpected error. Please try again." };
  const fields: Record<string, string> = {};
  for (const [key, issues] of Object.entries(error.fieldErrors)) {
    if (issues[0]) fields[key] = describeIssue(issues[0]);
  }
  if (error.code === "SLUG_TAKEN") fields.slug = "Another item already uses this address.";
  if (error.code === "REDIRECT_EXISTS") fields.fromPath = "This address already redirects somewhere.";
  return { fields, message: error.code === "VALIDATION_FAILED" ? error.message : errorMessage(error) };
}

/**
 * Field errors for a form, with list items folded onto their list (e.g. `featuresKa.3` →
 * `featuresKa`), so a form can show them under the one control that edits the list.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  const { fields } = errorsFrom(error);
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(fields)) {
    const base = key.split(".")[0]!;
    const shown = key === base ? message : `Item ${Number(key.split(".")[1]) + 1}: ${message}`;
    out[base] ??= shown;
  }
  return out;
}

/** Fired on `window` after an admin change that other parts of the panel show (badge, bell). */
export const ADMIN_CHANGED_EVENT = "mani:admin-changed";
export function announceAdminChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
}

/** Saves a whole-list order (`PUT …/order { ids }`); 409 ORDER_MISMATCH if the list is stale. */
export function saveOrder<T>(path: string, ids: string[], extra: Record<string, unknown> = {}) {
  return api<T>(`${path}/order`, { method: "PUT", body: { ...extra, ids } });
}

// ─── Shared shapes ──────────────────────────────────────────────────────────

export type ApiImage = { id: string; src: string; width: number; height: number; alt: string };
export type MediaAsset = ApiImage & {
  filename: string;
  bytes: number;
  mimeType: string;
  createdAt: string;
  altKa: string;
  altEn: string | null;
  altRu: string | null;
  category: "exterior" | "interior" | "construction" | "team" | "uploads";
};
/** A place that shows a photo (GET /api/admin/media/:id/usage). */
export type MediaUsage = { type: string; id: string; label: string; href: string };

export type ProjectCategory = "residential" | "apartments" | "commercial" | "hospitality" | "renovation";
export type ProjectStatus = "planning" | "in-progress" | "completed" | "on-hold";

export type SpecInput = { labelKa: string; labelEn?: string | null; labelRu?: string | null; valueKa: string; valueEn?: string | null; valueRu?: string | null };

type ProjectFields = {
  slug: string;
  titleKa: string;
  titleEn?: string | null;
  titleRu?: string | null;
  summaryKa: string;
  summaryEn?: string | null;
  summaryRu?: string | null;
  descriptionKa: string;
  descriptionEn?: string | null;
  descriptionRu?: string | null;
  locationKa: string;
  locationEn?: string | null;
  locationRu?: string | null;
  cityKa: string;
  cityEn?: string | null;
  cityRu?: string | null;
  category: ProjectCategory;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  estimatedCompletion: string;
  completionDate: string | null;
  featured: boolean;
  architect: string;
  specs: SpecInput[];
  isPublished: boolean;
};

/** Search-engine overrides for a project or page (API_CONTRACTS §8.2); empty = use the record's own. */
export type SeoFields = {
  titleKa: string;
  titleEn: string | null;
  titleRu: string | null;
  descriptionKa: string;
  descriptionEn: string | null;
  descriptionRu: string | null;
  ogImageId: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

/** Quick changes from the projects list (`PATCH /api/admin/projects/:id`). */
export type ProjectPatch = { status?: ProjectStatus; progress?: number; featured?: boolean; isPublished?: boolean };

/** `seo` may be omitted on save to keep what is stored. */
export type ProjectInput = ProjectFields & { coverId: string; galleryIds: string[]; seo?: SeoFields };
export type AdminProject = ProjectFields & {
  id: string;
  seo?: SeoFields;
  cover: ApiImage;
  gallery: ApiImage[];
  publishedAt: string | null;
  updatedAt: string;
};

export type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  location: string;
  city: string;
  category: ProjectCategory;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  estimatedCompletion: string;
  completionDate: string | null;
  featured: boolean;
  cover: ApiImage;
  updatedAt: string;
};
export type ProjectDetail = ProjectCard & {
  description: string;
  architect: string;
  specs: { id: string; label: string; value: string }[];
  gallery: ApiImage[];
};

// ─── Rich text (ProseMirror JSON, restricted; API_CONTRACTS §8.1) ───────────

// The editor (Tiptap) may add a few harmless attributes (link target/rel/class, list start/type).
export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; attrs: { href: string; target?: string | null; rel?: string | null; class?: string | null } };
export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type InlineNode = TextNode | { type: "hardBreak" };
export type Paragraph = { type: "paragraph"; content?: InlineNode[] };
export type BlockNode = Paragraph | BulletList | OrderedList | Blockquote;
export type ListItem = { type: "listItem"; content: BlockNode[] };
export type BulletList = { type: "bulletList"; content: ListItem[] };
export type OrderedList = { type: "orderedList"; attrs?: { start?: number | null; type?: string | null }; content: ListItem[] };
export type Blockquote = { type: "blockquote"; content: BlockNode[] };
export type RichTextDoc = { type: "doc"; content: BlockNode[] };

// ─── Pages ──────────────────────────────────────────────────────────────────

/** Optional on save; the API always returns the full style with defaults. */
export type BlockStyleInput = Partial<SectionStyle>;

export type CardInput = { titleKa: string; titleEn?: string | null; titleRu?: string | null; textKa?: string | null; textEn?: string | null; textRu?: string | null; mediaId?: string | null };

export type BlockInput = BlockInputBase & { style?: BlockStyleInput };

type BlockInputBase =
  | { type: "heading"; level: 2 | 3; textKa: string; textEn?: string | null; textRu?: string | null }
  | { type: "text"; docKa: RichTextDoc; docEn?: RichTextDoc | null; docRu?: RichTextDoc | null }
  | { type: "image"; mediaId: string; captionKa?: string | null; captionEn?: string | null; captionRu?: string | null }
  | {
      type: "banner";
      mediaId: string;
      titleKa: string;
      titleEn?: string | null;
      titleRu?: string | null;
      textKa?: string | null;
      textEn?: string | null;
      textRu?: string | null;
      buttonLabelKa?: string | null;
      buttonLabelEn?: string | null;
      buttonLabelRu?: string | null;
      buttonHref?: string | null;
    }
  | { type: "gallery"; mediaIds: string[] }
  | {
      type: "textImage";
      mediaId: string;
      imageSide: "left" | "right";
      titleKa?: string | null;
      titleEn?: string | null;
      titleRu?: string | null;
      docKa: RichTextDoc;
      docEn?: RichTextDoc | null;
      docRu?: RichTextDoc | null;
    }
  | { type: "cards"; titleKa?: string | null; titleEn?: string | null; titleRu?: string | null; items: CardInput[] };

/** Saved sections as the admin API returns them: the input fields, image previews and the full style. */
export type AdminBlock = AdminBlockBase & { style?: SectionStyle };

type AdminBlockBase =
  | ({ id: string } & Extract<BlockInputBase, { type: "heading" }>)
  | ({ id: string } & Extract<BlockInputBase, { type: "text" }>)
  | ({ id: string; image: ApiImage | null } & Extract<BlockInputBase, { type: "image" }>)
  | ({ id: string; image: ApiImage | null } & Extract<BlockInputBase, { type: "banner" }>)
  | ({ id: string; images: ApiImage[] } & Extract<BlockInputBase, { type: "gallery" }>)
  | ({ id: string; image: ApiImage | null } & Extract<BlockInputBase, { type: "textImage" }>)
  | ({ id: string } & Omit<Extract<BlockInputBase, { type: "cards" }>, "items"> & { items: (CardInput & { image: ApiImage | null })[] });

export type PageSummary = {
  id: string;
  kind: "system" | "custom";
  systemKey: string | null;
  slug: string;
  titleKa: string;
  titleEn: string | null;
  titleRu: string | null;
  isPublished: boolean;
  updatedAt: string;
  inHeader?: boolean;
  inFooter?: boolean;
};

export type MenuPlacement = { show: boolean; position?: number | null };
export type PageMenu = { labelKa?: string | null; labelEn?: string | null; labelRu?: string | null; header: MenuPlacement; footer: MenuPlacement };

export type AdminPage = PageSummary & {
  introKa: string;
  introEn: string | null;
  introRu: string | null;
  blocks: AdminBlock[];
  menu?: { labelKa: string | null; labelEn: string | null; labelRu: string | null; header: { show: boolean; position: number | null }; footer: { show: boolean; position: number | null } };
  style?: PageStyle;
  seo?: SeoFields;
};

export type PageInput = {
  slug: string;
  titleKa: string;
  titleEn?: string | null;
  titleRu?: string | null;
  introKa?: string;
  introEn?: string | null;
  introRu?: string | null;
  isPublished: boolean;
  blocks: BlockInput[];
  /** Omit to leave the page's menu entries unchanged. */
  menu?: PageMenu;
  /** Page colors; omit to leave unchanged. */
  style?: PageStyle;
  /** Search-engine overrides; omit to leave unchanged. */
  seo?: SeoFields;
};

export type PublicBlock = PublicBlockBase & { style?: SectionStyle };

type PublicBlockBase =
  | { id: string; type: "heading"; level: 2 | 3; text: string }
  | { id: string; type: "text"; doc: RichTextDoc }
  | { id: string; type: "image"; image: ApiImage; caption: string }
  | { id: string; type: "banner"; image: ApiImage; title: string; text: string; button: { label: string; href: string } | null }
  | { id: string; type: "gallery"; images: ApiImage[] }
  | { id: string; type: "textImage"; image: ApiImage; imageSide: "left" | "right"; title: string; doc: RichTextDoc }
  | { id: string; type: "cards"; title: string; items: { title: string; text: string; image: ApiImage | null }[] };

export type PublicPage = { id: string; slug: string; title: string; intro: string; blocks: PublicBlock[]; updatedAt: string; style?: PageStyle };

// ─── Admin: session, overview ───────────────────────────────────────────────

export type SessionUser = { id: string; name: string; email: string };

export type InquiryStatus = "new" | "in-progress" | "resolved";
export type InquirySummary = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
};
export type InquiryNote = { id: string; text: string; createdAt: string };
export type InquiryDetail = InquirySummary & { notes: InquiryNote[] };
export type InquiryCounts = { all: number; new: number; "in-progress": number; resolved: number };
export type InquiryList = { items: InquirySummary[]; page: number; pageSize: number; total: number; counts: InquiryCounts };

export type AdminNotification = { id: string; title: string; body: string; href: string; at: string; read: boolean };
export type NotificationList = { unread: number; items: AdminNotification[] };

export type ActivityEntry = { id: string; kind: string; message: string; at: string };

export type DashboardData = {
  projects: { total: number; byStatus: Record<ProjectStatus, number> };
  inquiries: { total: number; byStatus: Record<InquiryStatus, number>; perMonth: { month: string; count: number }[] };
  recentInquiries: InquirySummary[];
  recentProjects: { id: string; title: string; location: string; progress: number; status: ProjectStatus; updatedAt: string }[];
  activity: ActivityEntry[];
};

export type SearchResult = { type: "project" | "inquiry" | "service" | "team"; id: string; label: string; meta: string; href: string };

// ─── Admin: site content ────────────────────────────────────────────────────

export type ServiceInput = {
  slug?: string | null;
  titleKa: string;
  titleEn?: string | null;
  titleRu?: string | null;
  summaryKa: string;
  summaryEn?: string | null;
  summaryRu?: string | null;
  descriptionKa: string;
  descriptionEn?: string | null;
  descriptionRu?: string | null;
  featuresKa: string[];
  featuresEn: string[];
  featuresRu: string[];
  imageId: string;
  visible: boolean;
};
export type AdminService = Required<ServiceInput> & { id: string; slug: string; image: ApiImage; position: number; updatedAt: string };

export type TeamMemberInput = {
  nameKa: string;
  nameEn?: string | null;
  nameRu?: string | null;
  roleKa: string;
  roleEn?: string | null;
  roleRu?: string | null;
  bioKa: string;
  bioEn?: string | null;
  bioRu?: string | null;
  photoId: string;
  visible: boolean;
};
export type AdminTeamMember = Required<TeamMemberInput> & { id: string; photo: ApiImage; position: number; updatedAt: string };

export type TestimonialInput = {
  quoteKa: string;
  quoteEn?: string | null;
  quoteRu?: string | null;
  authorKa: string;
  authorEn?: string | null;
  authorRu?: string | null;
  roleKa: string;
  roleEn?: string | null;
  roleRu?: string | null;
  projectId: string | null;
  published: boolean;
};
export type AdminTestimonial = Required<TestimonialInput> & {
  id: string;
  project: { id: string; slug: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
};
export type TestimonialList = { items: AdminTestimonial[]; counts: { all: number; published: number; draft: number } };

export type ReviewStatus = "pending" | "approved" | "rejected";
export type AdminReview = {
  id: string;
  fullName: string;
  text: string;
  rating: number;
  locale: "ka" | "en" | "ru";
  status: ReviewStatus;
  reviewedAt: string | null;
  createdAt: string;
};
export type ReviewList = { items: AdminReview[]; counts: { all: number; pending: number; approved: number; rejected: number } };

export type SlideInput = {
  imageId: string;
  headingKa: string;
  headingEn?: string | null;
  headingRu?: string | null;
  textKa?: string | null;
  textEn?: string | null;
  textRu?: string | null;
  ctaLabelKa?: string | null;
  ctaLabelEn?: string | null;
  ctaLabelRu?: string | null;
  ctaUrl?: string | null;
  isPublished: boolean;
};
export type AdminSlide = {
  id: string;
  imageId: string;
  image: ApiImage;
  headingKa: string;
  headingEn: string | null;
  headingRu: string | null;
  textKa: string;
  textEn: string | null;
  textRu: string | null;
  ctaLabelKa: string;
  ctaLabelEn: string | null;
  ctaLabelRu: string | null;
  ctaUrl: string;
  isPublished: boolean;
  position: number;
  updatedAt: string;
};
export const MAX_SLIDES = 8;

export type MenuLocation = "header" | "footer";
export const MAX_MENU_ITEMS = 12;
export type NavItemInput = {
  location: MenuLocation;
  labelKa: string;
  labelEn?: string | null;
  labelRu?: string | null;
  pageId?: string | null;
  url?: string | null;
  newTab: boolean;
  visible: boolean;
};
export type AdminNavItem = {
  id: string;
  location: MenuLocation;
  labelKa: string;
  labelEn: string | null;
  labelRu: string | null;
  pageId: string | null;
  page: { id: string; title: string; isPublished: boolean } | null;
  url: string | null;
  href: string | null;
  newTab: boolean;
  visible: boolean;
  position: number;
};
export type AdminMenus = Record<MenuLocation, AdminNavItem[]>;

export type SettingsInput = {
  companyName: string;
  taglineKa: string;
  taglineEn?: string | null;
  taglineRu?: string | null;
  email: string;
  phone: string;
  addressKa: string;
  addressEn?: string | null;
  addressRu?: string | null;
  hoursKa: string;
  hoursEn?: string | null;
  hoursRu?: string | null;
  instagramUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
  whatsappNumber: string;
  messengerUsername: string;
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
  defaultSeoDescriptionKa: string;
  defaultSeoDescriptionEn?: string | null;
  defaultSeoDescriptionRu?: string | null;
  defaultOgImageId: string | null;
  googleSiteVerification: string;
  gtmContainerId: string;
};
export type AdminSettings = Required<SettingsInput> & { defaultOgImage: ApiImage | null; updatedAt: string };

export type AdminRedirect = { id: string; fromPath: string; toPath: string; createdAt: string };
export type RedirectList = { items: AdminRedirect[]; page: number; pageSize: number; total: number };

/** Empty text becomes null (the API's "use the Georgian" for English fields). */
export const orNull = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);
