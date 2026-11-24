"use client";

import { Star } from "lucide-react";
import { useTranslation } from "@/i18n/client";
import { cx } from "@/lib/format";

/** A 1–5 rating as five stars (filled ones in clay), read out as "4 out of 5 stars". */
export function Stars({ value, className }: { value: number; className?: string }) {
  const { t } = useTranslation("home");
  return (
    <span role="img" aria-label={t("reviews.stars", { count: value })} className={cx("inline-flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden strokeWidth={1.5} className={cx("size-4", n <= value ? "fill-accent text-accent" : "text-line-strong")} />
      ))}
    </span>
  );
}
