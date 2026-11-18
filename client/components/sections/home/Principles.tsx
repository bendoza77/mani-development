import { HardHat, Ruler, ShieldCheck } from "lucide-react";
import { Img } from "@/components/ui/Img";
import { Reveal } from "@/components/ui/Reveal";
import { IMAGES } from "@/data/images";

const PRINCIPLES = [
  {
    icon: Ruler,
    title: "Quality you can measure",
    body: "Tolerances are written into every package and checked on site. Concrete is cube-tested, facades are water-tested, and nothing is signed off from a photo.",
    points: ["Hold-point inspections", "Independent material testing", "Snag-free handover target"],
  },
  {
    icon: HardHat,
    title: "Safety as a design input",
    body: "Temporary works, crane plans and edge protection are designed with the building, not improvised around it. Every person on site has a daily briefing.",
    points: ["Daily pre-start briefings", "Designed temporary works", "Near-miss reporting culture"],
  },
  {
    icon: ShieldCheck,
    title: "Engineering for this ground",
    body: "Georgia is seismically active. Our engineers model every structure for it, review consultant designs, and supervise the details that make the difference.",
    points: ["Seismic design review", "Ductile reinforcement detailing", "In-house structural team"],
  },
];

export function Principles() {
  return (
    <section className="py-[clamp(4.5rem,11vw,9rem)]" aria-labelledby="principles-title">
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="t-eyebrow text-muted">Principles</p>
            <h2 id="principles-title" className="t-h2 mt-4 max-w-[15ch]">
              Quality, safety and engineering are not departments
            </h2>
          </div>
          <Reveal className="relative aspect-[16/9] overflow-hidden rounded-[2px] lg:col-span-7" variant="fade">
            <Img src={IMAGES["site-rebar"].src} alt="Site team fixing reinforcement on a concrete slab" sizes="(min-width: 1024px) 58vw, 100vw" />
          </Reveal>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-[2px] border border-line bg-line md:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 100} className="flex flex-col bg-paper p-7 sm:p-9">
              <p.icon aria-hidden strokeWidth={1.4} className="size-8 text-accent" />
              <h3 className="t-h3 mt-8">{p.title}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{p.body}</p>
              <ul className="mt-auto pt-8">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-3 border-t border-line py-3 text-[0.88rem]">
                    <span aria-hidden className="size-1.5 rotate-45 bg-ink" />
                    {pt}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
