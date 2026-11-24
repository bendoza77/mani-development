import { describe, expect, it } from "vitest";
import { richTextDoc } from "./rich-text.js";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, ...marks: unknown[]) => ({ type: "text", text: value, ...(marks.length ? { marks } : {}) });
const ok = (value: unknown) => richTextDoc.safeParse(value).success;

describe("richTextDoc", () => {
  it("accepts bold, italic, underline and a link together", () => {
    expect(ok(doc(p(text("x", { type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "link", attrs: { href: "/contact" } }))))).toBe(true);
  });

  it("accepts a quote containing paragraphs and a list", () => {
    const list = { type: "bulletList", content: [{ type: "listItem", content: [p(text("a"))] }] };
    expect(ok(doc({ type: "blockquote", content: [p(text("quoted")), list] }))).toBe(true);
  });

  it("accepts the extra details the editor adds (link target, ordered-list type)", () => {
    const link = { type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "noopener noreferrer nofollow", class: null } };
    const ordered = { type: "orderedList", attrs: { start: 1, type: null }, content: [{ type: "listItem", content: [p(text("a"))] }] };
    expect(ok(doc(p(text("x", link)), ordered))).toBe(true);
  });

  it.each([
    ["a heading inside text", doc({ type: "heading", attrs: { level: 2 }, content: [text("x")] })],
    ["raw HTML", doc({ type: "html", text: "<script>" })],
    ["an unknown style", doc(p(text("x", { type: "strike" })))],
    ["a javascript: link", doc(p(text("x", { type: "link", attrs: { href: "javascript:alert(1)" } })))],
    ["a protocol-relative link", doc(p(text("x", { type: "link", attrs: { href: "//evil.example" } })))],
  ])("refuses %s", (_label, value) => {
    expect(ok(value)).toBe(false);
  });
});
