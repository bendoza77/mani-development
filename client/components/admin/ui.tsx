"use client";

// Small presentational building blocks shared by admin pages.
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/format";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[clamp(1.8rem,1.4rem+1.4vw,2.5rem)] leading-tight tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.92rem] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, bodyClassName }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cx("min-w-0 rounded-md border border-line bg-card", className)} aria-label={title}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[0.95rem] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-paper-2">
        <Icon aria-hidden className="size-5 text-muted" />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[0.88rem] text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export type SortDir = "asc" | "desc";

/** Column header button that announces sort state via aria-sort on the parent th. */
export function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cx("px-4 py-3 text-left font-medium", className)}>
      <button type="button" onClick={onClick} className={cx("inline-flex items-center gap-1.5 hover:text-ink", active && "text-ink")}>
        {label}
        <Icon aria-hidden className={cx("size-3.5", !active && "opacity-50")} />
      </button>
    </th>
  );
}

export const tableClass = "w-full border-collapse text-[0.88rem]";
export const theadClass = "border-b border-line bg-paper/60 text-[0.75rem] uppercase tracking-[0.06em] text-muted";
export const rowClass = "border-b border-line last:border-0 transition-colors hover:bg-paper/60";

export function IconButton({ label, icon: Icon, onClick, tone = "default", disabled }: { label: string; icon: LucideIcon; onClick: () => void; tone?: "default" | "danger"; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "grid size-9 place-items-center rounded-[3px] text-muted transition-colors disabled:opacity-30",
        tone === "danger" ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-paper-2 hover:text-ink",
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

/** Pill tabs used for status filters. */
export function FilterTabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.83rem] transition-colors",
            value === o.value ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cx("tabular-nums", value === o.value ? "text-paper/70" : "text-muted")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
