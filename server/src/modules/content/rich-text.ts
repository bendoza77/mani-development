import { z } from "zod";

/**
 * Formatted text for "text" blocks: ProseMirror/Tiptap JSON limited to an allow-list
 * (paragraphs, bulleted/numbered lists, quotes; bold, italic, underline, links)
 * (docs/API_CONTRACTS.md §8.1, docs/SECURITY_PLAN.md §17). It is stored and returned as JSON and
 * rendered by the website as React elements, never as HTML, so there is no markup to inject.
 */

/** Links allowed in text and buttons: web, email, phone, or a path on this site. */
export const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

const mark = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bold") }),
  z.strictObject({ type: z.literal("italic") }),
  z.strictObject({ type: z.literal("underline") }),
  z.strictObject({
    type: z.literal("link"),
    attrs: z.object({ href: z.string().max(2000).regex(SAFE_HREF, "unsafe_link") }).loose(),
  }),
]);

const inline = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), text: z.string().min(1), marks: z.array(mark).max(4).optional() }),
  z.strictObject({ type: z.literal("hardBreak") }),
]);

const paragraph = z.strictObject({ type: z.literal("paragraph"), content: z.array(inline).optional() });

type ListNode = {
  type: "bulletList" | "orderedList";
  attrs?: { start?: number };
  content: { type: "listItem"; content: (z.infer<typeof paragraph> | ListNode)[] }[];
};

const list: z.ZodType<ListNode> = z.lazy(() =>
  z.strictObject({
    type: z.enum(["bulletList", "orderedList"]),
    attrs: z.object({ start: z.number().int().min(1).optional() }).loose().optional(),
    content: z
      .array(z.strictObject({ type: z.literal("listItem"), content: z.array(z.union([paragraph, list])).min(1) }))
      .min(1),
  }),
);

/** A quote: paragraphs and lists, no nested quotes. */
const blockquote = z.strictObject({
  type: z.literal("blockquote"),
  content: z.array(z.union([paragraph, list])).min(1),
});

export const richTextDoc = z
  .strictObject({ type: z.literal("doc"), content: z.array(z.union([paragraph, list, blockquote])) })
  .superRefine((doc, ctx) => {
    let characters = 0;
    let deepest = 0;
    const walk = (node: unknown, depth: number) => {
      deepest = Math.max(deepest, depth);
      const n = node as { text?: string; content?: unknown[] };
      if (typeof n.text === "string") characters += n.text.length;
      for (const child of n.content ?? []) walk(child, depth + 1);
    };
    walk(doc, 0);
    if (characters > 20_000) ctx.addIssue({ code: "custom", message: "too_long" });
    // doc → list → item → list → item … : 6 levels of lists is plenty.
    if (deepest > 14) ctx.addIssue({ code: "custom", message: "too_deep" });
  });

export type RichTextDoc = z.infer<typeof richTextDoc>;
