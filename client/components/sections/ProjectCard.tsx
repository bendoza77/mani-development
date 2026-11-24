"use client";

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
  className?: string;
  /** The lead card of a group: a larger title for a full-width image. */
  lead?: boolean;
  /** Admin preview renders without a link. */
  asPreview?: boolean;
};

export function ProjectCard({ project: p, sizes, aspect = "aspect-[4/3]", lead, className, asPreview }: Props) {
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
        <StatusBadge
          status={p.status}
          label={t(`status.${p.status}`)}
          className="pointer-events-none absolute top-3 left-3 bg-card/90 backdrop-blur-sm sm:top-4 sm:left-4"
        />
      </div>
      <div className="mt-4">
        {/* The year sits on the title's baseline so a row of cards reads as a schedule. */}
        <div className="flex items-baseline justify-between gap-4">
          <h3 className={cx(lead ? "t-h2" : "t-h3", "transition-colors group-hover:text-accent")}>{p.title}</h3>
          <span className="t-meta shrink-0 text-muted">{year}</span>
        </div>
        <p className="mt-1.5 text-[0.92rem] text-ink-soft">{p.location}</p>
        <p className="t-meta mt-0.5 text-muted">{t(`category.${p.category}`)}</p>
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
