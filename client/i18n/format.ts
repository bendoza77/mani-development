import type { TFunction } from "i18next";
import { utcParts } from "@/lib/format";

/**
 * Date formatting driven by the translation files rather than `Intl`, so server and client
 * output is identical (no hydration mismatch) and Georgian month names stay under our control.
 */
export function createFormatters(t: TFunction<"common">) {
  const months = t("date.months", { returnObjects: true }) as string[];
  const month = (iso?: string) => {
    const p = utcParts(iso);
    return p ? t("date.monthYear", { month: months[p.m], year: p.y }) : "—";
  };
  const year = (iso?: string) => {
    const p = utcParts(iso);
    return p ? String(p.y) : "—";
  };
  const estimatedYear = (iso?: string) => t("date.estimatedYear", { year: year(iso) });
  return { month, year, estimatedYear };
}

export type Formatters = ReturnType<typeof createFormatters>;
