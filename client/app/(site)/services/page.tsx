import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageIntro } from "@/components/sections/PageIntro";
import { ServicesList } from "@/components/sections/ServicesList";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Services",
  description: "Residential and apartment construction, commercial building, planning, structural engineering, renovation and project management.",
};

const MODELS = [
  {
    name: "Design & build",
    body: "One contract and one team, from concept with your architect to handover. The simplest route to cost certainty.",
    best: "Private homes, apartment buildings",
  },
  {
    name: "Build only",
    body: "Your design team completes the drawings; we price, plan and build them, with early buildability input if you want it.",
    best: "Developer-led projects with appointed architects",
  },
  {
    name: "Management",
    body: "We manage programme, cost and quality on your behalf, procuring trade packages directly in your name.",
    best: "Investors and owner-occupiers",
  },
];

const FAQ = [
  ["Where do you work?", "Mainly in Tbilisi, Batumi and the Kakheti region, with selected projects elsewhere in Georgia."],
  ["What size of project do you take on?", "From single private houses of around 300 m² to apartment and commercial buildings above 30,000 m²."],
  ["Can you work with our own architect?", "Yes. Most of our projects are designed by independent architects; our role is to make their design buildable and deliver it."],
  ["How do you price a project?", "After an initial meeting we prepare a cost plan, then a fixed or target price once the design is developed enough to be reliable."],
];

export default function ServicesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Services"
        title={
          <>
            Everything it takes to get a building <em className="text-accent">out of the ground</em>
          </>
        }
        lead="Seven disciplines under one roof, so the people who plan your building are the same people who build it."
      />
      <ServicesList />

      <section className="border-t border-line bg-paper-2/50 py-[clamp(4.5rem,10vw,8rem)]" aria-labelledby="models-title">
        <div className="shell">
          <p className="t-eyebrow text-muted">Ways to work with us</p>
          <h2 id="models-title" className="t-h2 mt-4 max-w-[18ch]">
            Three engagement models, one standard of work
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[2px] border border-line bg-line md:grid-cols-3">
            {MODELS.map((m, i) => (
              <Reveal key={m.name} delay={i * 90} className="flex flex-col bg-paper p-7 sm:p-9">
                <p className="t-meta text-accent">0{i + 1}</p>
                <h3 className="t-h3 mt-4">{m.name}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{m.body}</p>
                <p className="t-meta mt-auto border-t border-line pt-4 text-muted">Best for · {m.best}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="shell grid gap-10 py-[clamp(4.5rem,10vw,8rem)] lg:grid-cols-12" aria-labelledby="faq-title">
        <h2 id="faq-title" className="t-h2 lg:col-span-4">
          Common questions
        </h2>
        <div className="border-t border-line lg:col-span-8">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.05rem] font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <Plus aria-hidden className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="max-w-2xl pb-6 leading-relaxed text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
