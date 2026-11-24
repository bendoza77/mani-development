"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Underline, Undo2 } from "lucide-react";
import { EN_FALLBACK_HINT, RU_FALLBACK_HINT } from "@/components/admin/BiField";
import type { RichTextDoc } from "@/lib/api";
import { cx } from "@/lib/format";
import { isEmptyDoc, isSafeHref } from "@/lib/richtext";
import { CHROME_STYLE } from "@/lib/style";

/**
 * Only what the API accepts (API_CONTRACTS §8.1): paragraphs, bulleted and numbered lists, quotes,
 * line breaks; bold, italic, underline and links. Everything else is switched off, so text pasted
 * from Word or Google Docs is reduced to these (headings and tables become plain paragraphs).
 */
const EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    strike: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto", "tel"],
      isAllowedUri: (url) => isSafeHref(url),
      shouldAutoLink: (url) => isSafeHref(url),
    },
  }),
];

/**
 * The writing area. The site's base styles remove list bullets, so lists, quotes and links are
 * styled here (Tailwind classes, so they always ship with this component).
 */
const EDITOR_CLASS = [
  "min-h-40 px-3.5 py-3 text-[0.95rem] leading-relaxed text-ink focus:outline-none",
  "[&>*+*]:mt-3 [&_li>*+*]:mt-1",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:pl-1",
  "[&_ul_ul]:list-[circle] [&_ol_ol]:list-[lower-alpha]",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:text-ink-soft [&_blockquote]:italic",
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
].join(" ");

type Props = {
  value: RichTextDoc | null;
  onChange: (doc: RichTextDoc | null) => void;
  /** Visible label text; also names the editing area for screen readers. */
  label: ReactNode;
  required?: boolean;
  lang?: string;
  error?: string;
  hint?: string;
};

/**
 * Rich text edited in place on the live page: the text keeps the page's own look (`className`),
 * and the formatting toolbar floats above it while it has focus.
 */
export function InlineRichText({
  value,
  onChange,
  label,
  lang,
  className,
}: {
  value: RichTextDoc | null;
  onChange: (doc: RichTextDoc | null) => void;
  label: string;
  lang?: string;
  className?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        ...(lang ? { lang } : {}),
        class: cx(
          "min-h-12 cursor-text rounded-[2px] outline-none focus:ring-2 focus:ring-accent/60 focus:ring-offset-4",
          "[&>*+*]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul_ul]:list-[circle] [&_li>*+*]:mt-1",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-6 [&_blockquote]:font-display [&_blockquote]:text-[1.25rem] [&_blockquote]:leading-snug [&_blockquote]:text-ink",
          "[&_a]:underline [&_a]:underline-offset-2",
          className,
        ),
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          event.stopPropagation();
          setLinkOpen(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as RichTextDoc;
      onChange(isEmptyDoc(doc) ? null : doc);
    },
  });

  return (
    <div className="group/rt relative">
      {editor && (
        <div
          style={CHROME_STYLE}
          className="absolute bottom-full left-0 z-30 mb-2 hidden w-max max-w-[min(36rem,90vw)] overflow-hidden rounded-md border border-line bg-card text-left text-[0.9rem] font-normal shadow-card group-focus-within/rt:block"
        >
          <Toolbar editor={editor} linkOpen={linkOpen} setLinkOpen={setLinkOpen} />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextEditor({ value, onChange, label, required, lang, error, hint }: Props) {
  const labelId = useId();
  const msgId = useId();
  const [linkOpen, setLinkOpen] = useState(false);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value ?? "",
    // The admin renders on the client; this avoids a server/client mismatch warning in Next.js.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(error || hint ? { "aria-describedby": msgId } : {}),
        ...(error ? { "aria-invalid": "true" } : {}),
        ...(lang ? { lang } : {}),
        class: EDITOR_CLASS,
      },
      handleKeyDown: (_view, event) => {
        // Ctrl/⌘ + K opens the link field (and must not reach the admin panel's search shortcut).
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          event.stopPropagation();
          setLinkOpen(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as RichTextDoc;
      onChange(isEmptyDoc(doc) ? null : doc);
    },
  });

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[0.82rem] font-medium text-ink-soft">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-accent">
            *
          </span>
        )}
      </span>
      <div
        className={cx(
          "overflow-hidden rounded-[3px] border bg-card transition-[border-color,box-shadow] focus-within:border-ink focus-within:ring-2 focus-within:ring-accent/25",
          error ? "border-danger" : "border-line-strong",
        )}
      >
        {editor ? <Toolbar editor={editor} linkOpen={linkOpen} setLinkOpen={setLinkOpen} /> : <div className="h-10 border-b border-line bg-paper/60" />}
        <EditorContent editor={editor} />
      </div>
      {error ? (
        <p id={msgId} role="alert" className="text-[0.8rem] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-[0.8rem] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Toolbar({ editor, linkOpen, setLinkOpen }: { editor: Editor; linkOpen: boolean; setLinkOpen: (open: boolean) => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const run = (fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => fn(editor.chain().focus()).run();

  return (
    <div className="border-b border-line bg-paper/60">
      <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap items-center gap-0.5 p-1">
        <Tool label="Bold" shortcut="Ctrl+B" icon={Bold} active={state.bold} onClick={() => run((c) => c.toggleBold())} />
        <Tool label="Italic" shortcut="Ctrl+I" icon={Italic} active={state.italic} onClick={() => run((c) => c.toggleItalic())} />
        <Tool label="Underline" shortcut="Ctrl+U" icon={Underline} active={state.underline} onClick={() => run((c) => c.toggleUnderline())} />
        <Tool label={state.link ? "Edit link" : "Add link"} shortcut="Ctrl+K" icon={Link2} active={state.link || linkOpen} onClick={() => setLinkOpen(!linkOpen)} />
        <Divider />
        <Tool label="Bulleted list" shortcut="Ctrl+Shift+8" icon={List} active={state.bulletList} onClick={() => run((c) => c.toggleBulletList())} />
        <Tool label="Numbered list" shortcut="Ctrl+Shift+7" icon={ListOrdered} active={state.orderedList} onClick={() => run((c) => c.toggleOrderedList())} />
        <Tool label="Quote" shortcut="Ctrl+Shift+B" icon={Quote} active={state.blockquote} onClick={() => run((c) => c.toggleBlockquote())} />
        <Divider />
        <Tool label="Undo" shortcut="Ctrl+Z" icon={Undo2} disabled={!state.canUndo} onClick={() => run((c) => c.undo())} />
        <Tool label="Redo" shortcut="Ctrl+Shift+Z" icon={Redo2} disabled={!state.canRedo} onClick={() => run((c) => c.redo())} />
        <Tool label="Clear formatting" icon={RemoveFormatting} onClick={() => run((c) => c.unsetAllMarks().clearNodes())} />
      </div>
      {linkOpen && <LinkField key={state.href} editor={editor} initial={state.href} hasLink={state.link} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}

function LinkField({ editor, initial, hasLink, onClose }: { editor: Editor; initial: string; hasLink: boolean; onClose: () => void }) {
  const [href, setHref] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const apply = () => {
    const value = href.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    // A bare address like "example.com" becomes https://example.com.
    const normalized = /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/") ? value : `https://${value}`;
    if (!isSafeHref(normalized)) {
      setError("Use https://…, http://…, mailto:…, tel:… or a site path like /contact.");
      input.current?.focus();
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: insert the address itself as the link text.
      editor.chain().focus().insertContent({ type: "text", text: normalized, marks: [{ type: "link", attrs: { href: normalized } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    }
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-2">
      <label htmlFor={inputId} className="text-[0.78rem] text-muted">
        Link
      </label>
      <input
        ref={input}
        id={inputId}
        autoFocus
        type="text"
        inputMode="url"
        value={href}
        placeholder="https://… or /contact"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        onChange={(e) => {
          setHref(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        className="h-8 min-w-0 flex-1 rounded-[3px] border border-line-strong bg-card px-2.5 text-[0.85rem] focus:border-ink focus:outline-none"
      />
      <button type="button" onClick={apply} className="h-8 rounded-[3px] bg-ink px-3 text-[0.8rem] text-paper hover:bg-accent">
        {hasLink ? "Update" : "Add link"}
      </button>
      {hasLink && (
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            onClose();
          }}
          className="h-8 rounded-[3px] px-3 text-[0.8rem] text-danger hover:bg-danger-soft"
        >
          Remove link
        </button>
      )}
      <button type="button" onClick={close} className="h-8 rounded-[3px] px-3 text-[0.8rem] text-muted hover:bg-paper-2">
        Cancel
      </button>
      {error && (
        <p id={`${inputId}-err`} role="alert" className="w-full text-[0.78rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Tool({
  label,
  shortcut,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  shortcut?: string;
  icon: typeof Bold;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      aria-keyshortcuts={shortcut?.replace("Ctrl", "Control")}
      disabled={disabled}
      // Keep the text selection while clicking a toolbar button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "grid size-8 place-items-center rounded-[3px] transition-colors disabled:opacity-30",
        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink",
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}

/**
 * Georgian (main), English and Russian (optional) editors, like BiField. Rich text needs room,
 * so the three stack and only sit side by side on very wide screens.
 */
export function BiRichField({
  label,
  ka,
  en,
  ru,
  onKa,
  onEn,
  onRu,
  required,
  errorKa,
  errorEn,
  errorRu,
  hint,
}: {
  label: string;
  ka: RichTextDoc | null;
  en: RichTextDoc | null;
  ru: RichTextDoc | null;
  onKa: (doc: RichTextDoc | null) => void;
  onEn: (doc: RichTextDoc | null) => void;
  onRu: (doc: RichTextDoc | null) => void;
  required?: boolean;
  errorKa?: string;
  errorEn?: string;
  errorRu?: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-4 sm:col-span-2 2xl:grid-cols-3 [&>*]:min-w-0">
      <RichTextEditor label={`${label} · Georgian`} required={required} lang="ka" value={ka} onChange={onKa} error={errorKa} hint={hint} />
      <RichTextEditor label={`${label} · English`} lang="en" value={en} onChange={onEn} error={errorEn} hint={EN_FALLBACK_HINT} />
      <RichTextEditor label={`${label} · Russian`} lang="ru" value={ru} onChange={onRu} error={errorRu} hint={RU_FALLBACK_HINT} />
    </div>
  );
}
