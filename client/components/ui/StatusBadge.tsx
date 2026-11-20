import { INQUIRY_STATUS_LABEL, STATUS_LABEL, cx } from "@/lib/format";
import type { InquiryStatus, ProjectStatus } from "@/lib/types";

const TONE: Record<ProjectStatus | InquiryStatus, string> = {
  completed: "bg-ok-soft text-ok",
  resolved: "bg-ok-soft text-ok",
  "in-progress": "bg-warn-soft text-warn",
  planning: "bg-info-soft text-info",
  new: "bg-accent-soft text-accent",
  "on-hold": "bg-paper-2 text-muted",
};

/** Status chip: colour is always paired with a text label (never colour alone). */
export function StatusBadge({
  status,
  kind = "project",
  label: labelOverride,
  className,
}: {
  status: ProjectStatus | InquiryStatus;
  kind?: "project" | "inquiry";
  /** Localized label from the public site; the English-only admin relies on the defaults. */
  label?: string;
  className?: string;
}) {
  const label =
    labelOverride ??
    (kind === "project" ? STATUS_LABEL[status as ProjectStatus] : INQUIRY_STATUS_LABEL[status as InquiryStatus]);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.68rem] font-medium tracking-[0.04em] uppercase whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
