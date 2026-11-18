import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Img } from "@/components/ui/Img";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CATEGORY_LABEL, cx, formatYear } from "@/lib/format";
import type { Project } from "@/lib/types";

type Props = {
  project: Project;
  sizes: string;
  /** Tailwind aspect class for the image frame. */
  aspect?: string;
  priority?: boolean;
  index?: number;
  className?: string;
  /** Admin preview renders without a link. */
  asPreview?: boolean;
};

export function ProjectCard({ project: p, sizes, aspect = "aspect-[4/3]", priority, index, className, asPreview }: Props) {
  const year = p.status === "completed" ? formatYear(p.completionDate) : `Est. ${formatYear(p.estimatedCompletion)}`;
  const body = (
    <>
      <div className={cx("relative overflow-hidden rounded-[2px]", aspect)}>
        <Img
          src={p.cover}
          alt={`${p.title}, ${p.location}`}
          sizes={sizes}
          priority={priority}
          imgClassName="zoom-media group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
          <StatusBadge status={p.status} className="bg-card/90 backdrop-blur-sm" />
          <span className="grid size-9 translate-y-1 place-items-center rounded-full bg-card/90 text-ink opacity-0 transition-all duration-500 ease-(--ease-arch) group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            <ArrowUpRight aria-hidden className="size-4" />
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="t-h3 transition-colors group-hover:text-accent">{p.title}</h3>
          <p className="mt-1.5 text-[0.92rem] text-muted">{p.location}</p>
        </div>
        <div className="shrink-0 text-right">
          {index !== undefined && <p className="t-meta text-muted">{String(index + 1).padStart(2, "0")}</p>}
          <p className="t-meta mt-1 text-ink-soft">
            {CATEGORY_LABEL[p.category]} · {year}
          </p>
        </div>
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
