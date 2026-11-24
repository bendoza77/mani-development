import { Img } from "@/components/ui/Img";
import { Reveal } from "@/components/ui/Reveal";
import { getT } from "@/i18n/server";
import { getTeam } from "@/lib/public-api";

export async function TeamGrid() {
  const { t, locale } = await getT("about");
  const team = await getTeam(locale);
  if (!team.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-[clamp(0.75rem,2vw,2rem)] gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {team.map((m, i) => (
        <Reveal as="li" key={m.id} delay={(i % 4) * 70} className="group">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2px]">
            <Img
              src={m.photo.src}
              alt={t("team.portraitAlt", { name: m.name })}
              sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 48vw"
              imgClassName="grayscale-[85%] transition-[filter,transform] duration-700 ease-(--ease-arch) group-hover:grayscale-0 group-hover:scale-[1.03]"
            />
          </div>
          <h3 className="mt-4 text-[1rem] font-semibold">{m.name}</h3>
          <p className="t-meta mt-1 text-accent">{m.role}</p>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">{m.bio}</p>
        </Reveal>
      ))}
    </ul>
  );
}
