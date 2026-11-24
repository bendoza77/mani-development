"use client";

// Small pieces shared by the API-backed admin screens.
import { GripVertical } from "lucide-react";
import type { DragHandle } from "@/components/admin/SortableList";
import { Button } from "@/components/ui/Button";

/** A copy of `obj` without `key` (to clear one server error when its field is edited). */
export function without<T extends Record<string, unknown>>(obj: T, key: string): T {
  if (!(key in obj)) return obj;
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[0.9rem] text-danger">{message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** The save error, plus any field errors the form has no place for. */
export function ServerErrors({ message, fields = {}, known }: { message: string; fields?: Record<string, string>; known?: Set<string> }) {
  const other = Object.entries(fields).filter(([k]) => !known?.has(k));
  const hasFieldErrors = Object.keys(fields).length > 0;
  return (
    <div role="alert" className="rounded-[3px] bg-danger-soft px-4 py-3 text-[0.88rem] text-danger">
      <p>{hasFieldErrors && other.length === 0 ? "Check the highlighted fields." : message}</p>
      {other.map(([k, v]) => (
        <p key={k}>
          {k}: {v}
        </p>
      ))}
    </div>
  );
}

/** Use as `<DragHandleButton {...handle} label="…" />` inside a SortableItem. */
export function DragHandleButton({ attributes, listeners, setActivatorNodeRef, label }: DragHandle & { label: string }) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${label}. With the keyboard: Space to pick up, arrow keys to move, Space to drop.`}
      title="Drag to reorder"
      className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  );
}
