"use client";

import { ArrowUpRight } from "lucide-react";
import { useFormatters, useTranslation } from "@/i18n/client";
import { LocaleLink as Link } from "@/i18n/LocaleLink";
import { Img } from "@/components/ui/Img";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cx } from "@/lib/format";
import type { Project } from "@/lib/types";

type Props = {
  project: Project;
  sizes: string;
  /** Tailwind aspect class for the image frame. */
  aspect?: string;
  index?: number;
  className?: string;
  /** Admin preview renders without a link. */
  asPreview?: boolean;
};

export function ProjectCard({ project: p, sizes, aspect = "aspect-[4/3]", index, className, asPreview }: Props) {
  const { t } = useTranslation("common");
  const { t: tp } = useTranslation("projects");
  const fmt = useFormatters();
  const year = p.status === "completed" ? fmt.year(p.completionDate) : fmt.estimatedYear(p.estimatedCompletion);
  const body = (
    <>
      <div className={cx("relative overflow-hidden rounded-[2px]", aspect)}>
        <Img
          src={p.cover}
          alt={tp("card.imageAlt", { title: p.title, location: p.location })}
          sizes={sizes}
          imgClassName="zoom-media group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
          <StatusBadge status={p.status} label={t(`status.${p.status}`)} className="bg-card/90 backdrop-blur-sm" />
          <span className="grid size-9 translate-y-1 place-items-center rounded-full bg-card/90 text-ink opacity-0 transition-all duration-500 ease-(--ease-arch) group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            <ArrowUpRight aria-hidden className="size-4" />
          </span>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="t-h3 transition-colors group-hover:text-accent">{p.title}</h3>
        <p className="mt-1.5 text-[0.92rem] text-muted">{p.location}</p>
        <p className="t-meta mt-2 text-ink-soft">
          {index !== undefined && <span className="text-muted">{String(index + 1).padStart(2, "0")} · </span>}
          {t(`category.${p.category}`)} · {year}
        </p>
      </div>
    </>
  );

  if (asPreview) return <div className={cx("group block", className)}>{body}</div>;
  return (
    <Link href={`/projects/${p.slug}`} className={cx("group block rounded-[2px]", className)}>
      {body}
    </Link>
  );
}
