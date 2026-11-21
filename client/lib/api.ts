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
      return issue.minimum === 1 ? "Required." : `At least ${issue.minimum} characters.`;
    case "too_big":
      return `At most ${issue.maximum} characters.`;
    case "too_short":
      return "Too short (at least 12 characters).";
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

/** Field errors as `{ field: "message" }`, plus a general message for errors without fields. */
export function errorsFrom(error: unknown): { fields: Record<string, string>; message: string } {
  if (!(error instanceof ApiError)) return { fields: {}, message: "Unexpected error. Please try again." };
  const fields: Record<string, string> = {};
  for (const [key, issues] of Object.entries(error.fieldErrors)) {
    if (issues[0]) fields[key] = describeIssue(issues[0]);
  }
  if (error.code === "SLUG_TAKEN") fields.slug = "Another item already uses this address.";
  return { fields, message: error.message };
}

// ─── Shared shapes ──────────────────────────────────────────────────────────

export type ApiImage = { id: string; src: string; width: number; height: number; alt: string };
export type MediaAsset = ApiImage & { filename: string; bytes: number; mimeType: string; createdAt: string };

export type ProjectCategory = "residential" | "apartments" | "commercial" | "hospitality" | "renovation";
export type ProjectStatus = "planning" | "in-progress" | "completed" | "on-hold";

export type SpecInput = { labelKa: string; labelEn?: string | null; valueKa: string; valueEn?: string | null };

type ProjectFields = {
  slug: string;
  titleKa: string;
  titleEn?: string | null;
  summaryKa: string;
  summaryEn?: string | null;
  descriptionKa: string;
  descriptionEn?: string | null;
  locationKa: string;
  locationEn?: string | null;
  cityKa: string;
  cityEn?: string | null;
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

export type ProjectInput = ProjectFields & { coverId: string; galleryIds: string[] };
export type AdminProject = ProjectFields & {
  id: string;
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

export type CardInput = { titleKa: string; titleEn?: string | null; textKa?: string | null; textEn?: string | null; mediaId?: string | null };

export type BlockInput = BlockInputBase & { style?: BlockStyleInput };

type BlockInputBase =
  | { type: "heading"; level: 2 | 3; textKa: string; textEn?: string | null }
  | { type: "text"; docKa: RichTextDoc; docEn?: RichTextDoc | null }
  | { type: "image"; mediaId: string; captionKa?: string | null; captionEn?: string | null }
  | {
      type: "banner";
      mediaId: string;
      titleKa: string;
      titleEn?: string | null;
      textKa?: string | null;
      textEn?: string | null;
      buttonLabelKa?: string | null;
      buttonLabelEn?: string | null;
      buttonHref?: string | null;
    }
  | { type: "gallery"; mediaIds: string[] }
  | {
      type: "textImage";
      mediaId: string;
      imageSide: "left" | "right";
      titleKa?: string | null;
      titleEn?: string | null;
      docKa: RichTextDoc;
      docEn?: RichTextDoc | null;
    }
  | { type: "cards"; titleKa?: string | null; titleEn?: string | null; items: CardInput[] };

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
  isPublished: boolean;
  updatedAt: string;
  inHeader?: boolean;
  inFooter?: boolean;
};

export type MenuPlacement = { show: boolean; position?: number | null };
export type PageMenu = { labelKa?: string | null; labelEn?: string | null; header: MenuPlacement; footer: MenuPlacement };

export type AdminPage = PageSummary & {
  introKa: string;
  introEn: string | null;
  blocks: AdminBlock[];
  menu?: { labelKa: string | null; labelEn: string | null; header: { show: boolean; position: number | null }; footer: { show: boolean; position: number | null } };
  style?: PageStyle;
};

export type PageInput = {
  slug: string;
  titleKa: string;
  titleEn?: string | null;
  introKa?: string;
  introEn?: string | null;
  isPublished: boolean;
  blocks: BlockInput[];
  /** Omit to leave the page's menu entries unchanged. */
  menu?: PageMenu;
  /** Page colors; omit to leave unchanged. */
  style?: PageStyle;
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
