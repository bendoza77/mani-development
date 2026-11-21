"use client";

import { useEffect, useRef, type ElementType, type KeyboardEvent } from "react";
import { cx } from "@/lib/format";

/**
 * Plain text edited in place (contentEditable, text only). Uncontrolled while typing so the caret
 * never jumps; it re-reads `value` only when `resetKey` changes (e.g. switching language).
 * Single-line fields commit on Enter; multi-line fields allow line breaks.
 */
export function InlineText({
  as: Tag = "span",
  value,
  onChange,
  placeholder,
  label,
  multiline = false,
  maxLength,
  className,
  resetKey,
  lang,
}: {
  as?: ElementType;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  /** Accessible name, e.g. "Heading (Georgian)". */
  label: string;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
  resetKey?: string;
  lang?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  // Write the value into the element only when (re)starting, not on every keystroke.
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately only on reset
  }, [resetKey]);

  const read = () => {
    const el = ref.current;
    if (!el) return;
    let text = (el.innerText ?? el.textContent ?? "").replace(/ /g, " ");
    if (!multiline) text = text.replace(/\s*\n\s*/g, " ");
    if (maxLength && text.length > maxLength) {
      text = text.slice(0, maxLength);
      el.textContent = text;
    }
    onChange(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === "Escape") ref.current?.blur();
  };

  return (
    <Tag
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline={multiline || undefined}
      data-placeholder={placeholder}
      lang={lang}
      tabIndex={0}
      spellCheck
      onInput={read}
      onBlur={read}
      onKeyDown={onKeyDown}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        // Text only: strip any formatting from the clipboard.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, multiline ? text : text.replace(/\s*\n\s*/g, " "));
      }}
      className={cx(
        "cursor-text rounded-[2px] outline-none focus:ring-2 focus:ring-accent/60 focus:ring-offset-2",
        "empty:before:pointer-events-none empty:before:opacity-45 empty:before:content-[attr(data-placeholder)]",
        multiline && "whitespace-pre-line",
        className,
      )}
    />
  );
}
