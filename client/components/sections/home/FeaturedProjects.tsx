import { ProjectCard } from "@/components/sections/ProjectCard";
import { Reveal } from "@/components/ui/Reveal";
import { TextLink } from "@/components/ui/Button";
import { getT } from "@/i18n/server";
import { cx } from "@/lib/format";
import { getProjects } from "@/lib/public-api";

const MAX = 4;

// Columns for the row under the lead project (at most three).
const ROW: Record<number, string> = { 0: "", 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

/** Featured projects (the admin "featured" flag), topped up with private houses if fewer than four are flagged. */
export async function FeaturedProjects() {
  const { t, locale } = await getT("home");
  const projects = await getProjects(locale);
  const featured = [
    ...projects.filter((p) => p.featured),
    ...projects.filter((p) => !p.featured && p.category === "residential"),
  ].slice(0, MAX);

  if (!featured.length) return null;
  const [lead, ...rest] = featured;

  return (
    <section className="border-t border-line py-[clamp(4rem,9vw,7rem)]" aria-labelledby="featured-title">
      <div className="shell">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="t-eyebrow text-muted">{t("featured.eyebrow")}</p>
            <h2 id="featured-title" className="t-h2 mt-4 max-w-[18ch]">
              {t("featured.title")}
            </h2>
          </div>
          <TextLink href="/projects" className="self-start md:self-auto">
            {t("featured.allProjects", { count: projects.length })}
          </TextLink>
        </div>

        {/* One project leads at full width; the others follow in a single row beneath it. */}
        <ul className={cx("mt-10 grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-12 md:mt-14", ROW[rest.length])}>
          <li className="md:col-span-full">
            <ProjectCard project={lead} lead aspect="aspect-[4/3] md:aspect-[2/1] xl:aspect-[12/5]" sizes="(min-width: 1440px) 1408px, 100vw" />
          </li>
          {rest.map((p) => (
            <Reveal as="li" key={p.id}>
              <ProjectCard project={p} sizes={rest.length > 1 ? `(min-width: 768px) ${Math.round(92 / rest.length)}vw, 100vw` : "100vw"} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
