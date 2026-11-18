"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cx } from "@/lib/format";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
};

/**
 * Modal built on the native <dialog> element: focus trapping, Escape handling and
 * inert background come from the browser. Focus returns to the opener on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    }
  }, [open]);

  // If the hosting route is hidden (Activity) or unmounted, make sure the modal is closed.
  useEffect(() => {
    const el = ref.current;
    return () => el?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={cx(
        "modal m-auto max-h-[min(90dvh,56rem)] w-[calc(100%-2rem)] overflow-visible rounded-md bg-transparent p-0 text-ink",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
      )}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(90dvh,56rem)] flex-col overflow-hidden rounded-md border border-line bg-card shadow-card">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-[1.05rem] font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-[0.85rem] text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 grid size-9 shrink-0 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        </header>
        {children && <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3.5 sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
