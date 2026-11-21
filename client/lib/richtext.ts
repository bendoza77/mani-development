// Helpers for the restricted rich text the API stores (ProseMirror JSON; server/docs/API_CONTRACTS.md §8.1).
import type { BlockNode, InlineNode, RichTextDoc } from "./api";

/** Links the API accepts: http(s), mailto, tel, or a path on this site (one leading slash). */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(href) || (href.startsWith("/") && !href.startsWith("//"));
}

function inlineText(nodes: InlineNode[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === "text" ? n.text : " ")).join("");
}

function blockText(node: BlockNode): string {
  switch (node.type) {
    case "paragraph":
      return inlineText(node.content);
    case "bulletList":
    case "orderedList":
      return node.content.map((li) => li.content.map(blockText).join(" ")).join(" ");
    case "blockquote":
      return node.content.map(blockText).join(" ");
    default:
      return "";
  }
}

/** The visible text of a document (for "is it empty?" checks). */
export function plainText(doc: RichTextDoc | null | undefined): string {
  return doc ? doc.content.map(blockText).join(" ") : "";
}

export const isEmptyDoc = (doc: RichTextDoc | null | undefined) => plainText(doc).trim() === "";
