import { Fragment, type ReactNode } from "react";
import type { BlockNode, InlineNode, ListItem, RichTextDoc } from "@/lib/api";
import { isSafeHref } from "@/lib/richtext";

/**
 * Renders stored rich text as React elements. Only the allowed node and mark types are drawn,
 * nothing is parsed as HTML, and links that aren't http(s), mailto, tel or on-site are dropped
 * (their text stays).
 */
export function RichText({ doc, className }: { doc: RichTextDoc; className?: string }) {
  // The editor keeps an empty paragraph at the end so there's always room to type; don't draw it.
  const nodes = [...doc.content];
  while (nodes.length && nodes[nodes.length - 1]!.type === "paragraph" && !(nodes[nodes.length - 1] as { content?: unknown[] }).content?.length) nodes.pop();
  return <div className={className}>{nodes.map((node, i) => block(node, i))}</div>;
}

function block(node: BlockNode, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{inline(node.content ?? [])}</p>;
    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-6">
          {node.content.map(listItem)}
        </ul>
      );
    case "orderedList": {
      const start = typeof node.attrs?.start === "number" && node.attrs.start > 1 ? node.attrs.start : undefined;
      return (
        <ol key={key} start={start} className="list-decimal space-y-1 pl-6">
          {node.content.map(listItem)}
        </ol>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key} className="space-y-3 border-l-2 border-accent pl-6 font-display text-[1.25rem] leading-snug text-ink">
          {node.content.map((child, i) => block(child, i))}
        </blockquote>
      );
    default:
      return null;
  }
}

function listItem(item: ListItem, key: number): ReactNode {
  // A list item's single paragraph is drawn inline, so bullets line up with the text.
  return (
    <li key={key}>
      {item.content.map((child, i) => (child.type === "paragraph" && item.content.length === 1 ? <Fragment key={i}>{inline(child.content ?? [])}</Fragment> : block(child, i)))}
    </li>
  );
}

function inline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === "hardBreak") return <br key={i} />;
    if (node.type !== "text") return null;
    let el: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") el = <strong>{el}</strong>;
      else if (mark.type === "italic") el = <em>{el}</em>;
      else if (mark.type === "underline") el = <u>{el}</u>;
      else if (mark.type === "link" && isSafeHref(mark.attrs.href)) {
        const external = /^https?:/i.test(mark.attrs.href);
        el = (
          <a href={mark.attrs.href} className="underline underline-offset-2 hover:text-accent" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {el}
          </a>
        );
      }
    }
    return <Fragment key={i}>{el}</Fragment>;
  });
}
