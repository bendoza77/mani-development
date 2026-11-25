"use client";

import { useSiteSettings } from "@/components/layout/SiteSettings";
import { cx } from "@/lib/format";

/** The brand mark: a beam spanning two posts, with a fired-clay bearing line. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path fill="currentColor" d="M3 6h26v5H3z" />
      <path fill="var(--accent)" d="M3 11h26v1.6H3z" />
      <path fill="currentColor" d="M6.5 12.6h4.5V27H6.5zM21 12.6h4.5V27H21z" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { companyName: name, tagline } = useSiteSettings();
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className="flex flex-col leading-none">
        <span lang="en" className="whitespace-nowrap text-[1.05rem] font-semibold uppercase tracking-[0.06em] sm:tracking-[0.2em]">
          {name}
        </span>
        {!compact && tagline && (
          <span className="mt-1.5 whitespace-nowrap text-[0.72rem] opacity-75 max-sm:hidden">{tagline}</span>
        )}
      </span>
    </span>
  );
}
