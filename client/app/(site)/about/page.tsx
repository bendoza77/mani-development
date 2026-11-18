import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { COMPANY_STATS } from "@/components/sections/home/Stats";
import { Counter } from "@/components/ui/Counter";
import { Img } from "@/components/ui/Img";
import { Reveal } from "@/components/ui/Reveal";
import { IMAGES } from "@/data/images";

export const metadata: Metadata = {
  title: "About",
  description: "The story, values and people behind Lintel, a design-led construction and development company.",
};

const VALUES = [
  ["Say what it will cost", "Honest numbers early, even when they are not the numbers a client hopes for."],
  ["Draw it before you pour it", "Every junction resolved on paper first. Site is for building, not designing."],
  ["Leave the site better", "Tidy sites, respected neighbours, trees protected, waste sorted."],
  ["Stay after handover", "Twelve months of aftercare and a phone number that is always answered."],
];

const MILESTONES = [
  ["2009", "Founded in Tbilisi", "David Mchedlishvili starts Lintel with six people and a single house in Tskneti."],
  ["2012", "First apartment building", "A 24-unit block in Vake, delivered three weeks early."],
  ["2015", "Engineering team in-house", "Structural engineers join the company, beginning our design-and-build offer."],
  ["2018", "Batumi office", "A second office opens to serve projects along the Black Sea coast."],
  ["2021", "Development arm", "Lintel begins developing its own residential projects with landowners."],
  ["2023", "Saburtalo Exchange", "Our largest commercial building to date reaches completion."],
  ["2026", "64 buildings", "Four projects on site, two in design, and a team of 140."],
];

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About"
        title={
          <>
            A builder that thinks <em className="text-accent">like an architect</em>
          </>
        }
        lead="Lintel was founded on a simple idea: buildings turn out better when the people who design them and the people who build them sit at the same table."
      />

      <section className="shell grid gap-10 pb-[clamp(4.5rem,10vw,8rem)] lg:grid-cols-12" aria-labelledby="story-title">
        <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[2px] lg:col-span-5" variant="fade">
          <Img src={IMAGES["site-team"].src} alt="Lintel site team reviewing a slab before a concrete pour" sizes="(min-width: 1024px) 40vw, 100vw" />
        </Reveal>
        <div className="flex flex-col justify-center lg:col-span-6 lg:col-start-7">
          <p className="t-eyebrow text-muted">Our story</p>
          <h2 id="story-title" className="t-h2 mt-4">Seventeen years, one way of working</h2>
          <div className="mt-6 space-y-4 leading-[1.75] text-ink-soft">
            <p>
              A lintel is the beam above a door or window: the quiet structural element that carries the load so the
              opening can exist. We chose the name because it describes what we try to be for our clients and their
              architects.
            </p>
            <p>
              We began with private houses and grew project by project into apartment buildings, workplaces and our own
              developments. The team is larger now, but the principle has not changed: engineers beside designers, a
              single accountable lead on every site, and no detail left to be solved with a hammer.
            </p>
          </div>
          <blockquote className="mt-10 border-l-2 border-accent pl-6">
            <p className="font-display text-[1.5rem] leading-snug">
              &ldquo;Our job is to make the architect&rsquo;s drawing true, and to make it last.&rdquo;
            </p>
            <footer className="t-meta mt-3 text-muted">David Mchedlishvili, founder</footer>
          </blockquote>
        </div>
      </section>

      <section className="bg-night py-[clamp(4.5rem,10vw,8rem)] text-night-ink" aria-labelledby="mission-title">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="t-eyebrow text-night-muted">Mission &amp; values</p>
            <h2 id="mission-title" className="t-h2 mt-4">
              Build fewer things, <em className="text-accent">build them properly</em>
            </h2>
            <p className="t-lead mt-6 text-night-muted">
              Our mission is to deliver buildings that their owners are still proud of in thirty years, through honest
              planning, sound engineering and careful craft.
            </p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-[2px] bg-white/10 sm:grid-cols-2 lg:col-span-7">
            {VALUES.map(([t, b], i) => (
              <Reveal as="li" key={t} delay={i * 80} className="bg-night p-7">
                <p className="t-meta text-accent">0{i + 1}</p>
                <h3 className="mt-4 text-[1.1rem] font-semibold">{t}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-night-muted">{b}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line" aria-label="Company in numbers">
        <dl className="shell grid grid-cols-2 gap-y-10 py-[clamp(3rem,7vw,5rem)] lg:grid-cols-4">
          {COMPANY_STATS.map((s) => (
            <div key={s.label}>
              <dt className="t-eyebrow text-muted">{s.label}</dt>
              <dd className="mt-3 font-display text-[clamp(2.6rem,1.8rem+3vw,4.5rem)] leading-none tracking-[-0.04em]">
                <Counter value={s.value} suffix={s.suffix} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="shell grid gap-12 py-[clamp(4.5rem,10vw,8rem)] lg:grid-cols-12" aria-labelledby="philosophy-title">
        <div className="lg:col-span-4">
          <p className="t-eyebrow text-muted">Construction philosophy &amp; standards</p>
          <h2 id="philosophy-title" className="t-h2 mt-4">How we hold ourselves to account</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8">
          {[
            ["Inspection hold points", "Reinforcement, waterproofing and facade fixings are inspected and signed before they are covered."],
            ["Material testing", "Concrete, steel and glazing are sampled and tested by independent laboratories on every project."],
            ["Seismic detailing", "Ductile detailing and connection design are reviewed by our engineers on every structure."],
            ["Transparent reporting", "Clients receive weekly progress, cost and risk reports, including problems."],
          ].map(([t, b], i) => (
            <Reveal key={t} delay={i * 70} className="border-t border-ink pt-5">
              <h3 className="text-[1.05rem] font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{b}</p>
            </Reveal>
          ))}
          <p className="text-[0.8rem] text-muted sm:col-span-2">
            Prototype note: Lintel is fictional. Standards described here are illustrative, not claims of certification.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-paper-2/50 py-[clamp(4.5rem,10vw,8rem)]" aria-labelledby="milestones-title">
        <div className="shell">
          <p className="t-eyebrow text-muted">Milestones</p>
          <h2 id="milestones-title" className="t-h2 mt-4">From one house to sixty-four buildings</h2>
          <ol className="relative mt-14 border-l border-line-strong md:mt-16 md:grid md:grid-cols-7 md:border-t md:border-l-0">
            {MILESTONES.map(([year, title, body], i) => (
              <Reveal as="li" key={year} delay={i * 60} className="relative pb-10 pl-7 md:pt-8 md:pr-5 md:pb-0 md:pl-0">
                <span aria-hidden className="absolute top-1.5 -left-[5px] size-[9px] rotate-45 bg-accent md:-top-[5px] md:left-0" />
                <p className="font-display text-3xl tabular-nums">{year}</p>
                <h3 className="mt-3 text-[0.98rem] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-soft">{body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell py-[clamp(4.5rem,10vw,8rem)]" aria-labelledby="team-title">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="t-eyebrow text-muted">Leadership</p>
            <h2 id="team-title" className="t-h2 mt-4">The people accountable for your building</h2>
          </div>
        </div>
        <TeamGrid />
      </section>
    </>
  );
}
