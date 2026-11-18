import { Img } from "@/components/ui/Img";
import { Reveal } from "@/components/ui/Reveal";
import { TextLink } from "@/components/ui/Button";
import { IMAGES } from "@/data/images";

/** Manifesto block: asymmetric editorial layout with a small inset image. */
export function Intro() {
  return (
    <section className="border-t border-line py-[clamp(4.5rem,11vw,9rem)]" aria-labelledby="intro-title">
      <div className="shell grid gap-10 md:grid-cols-12">
        <Reveal className="md:col-span-3">
          <p className="t-eyebrow text-muted">The studio</p>
          <div className="relative mt-8 hidden aspect-[3/4] w-full max-w-[15rem] overflow-hidden rounded-[2px] md:block">
            <Img src={IMAGES.drawings.src} alt="Engineer marking up construction drawings" sizes="15rem" />
          </div>
        </Reveal>
        <div className="md:col-span-9">
          <Reveal>
            <h2 id="intro-title" className="font-display text-[clamp(1.7rem,1.1rem+2.4vw,3.3rem)] leading-[1.12] tracking-[-0.02em] text-balance">
              We are builders who think like architects. Our engineers sit beside the designers, our site leads stay
              from groundbreaking to handover, and{" "}
              <span className="text-muted">every detail is drawn before it is poured.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-3">
            {[
              ["Design-led", "We join projects at concept stage, so ambition and budget are tested together."],
              ["Engineered in-house", "Structural, seismic and temporary-works design by our own team."],
              ["One accountable team", "The people who quote your building are the people who build it."],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 90}>
                <p className="t-meta text-accent">0{i + 1}</p>
                <h3 className="mt-3 text-[1.05rem] font-semibold">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{body}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <TextLink href="/about">About the company</TextLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
