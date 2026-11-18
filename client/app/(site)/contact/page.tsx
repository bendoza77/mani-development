import type { Metadata } from "next";
import { ContactDetails } from "@/components/sections/ContactDetails";
import { ContactForm } from "@/components/sections/ContactForm";
import { PageIntro } from "@/components/sections/PageIntro";

export const metadata: Metadata = {
  title: "Contact",
  description: "Start a project with Lintel: tell us about your site, sketch or question.",
};

/** Stylised site-plan map (static SVG, no map API or key required). */
function StudioMap() {
  return (
    <figure className="relative overflow-hidden rounded-[3px] border border-line bg-paper-2">
      <svg viewBox="0 0 400 260" className="block h-auto w-full text-ink" role="img" aria-label="Stylised map showing the studio in Vake, Tbilisi, near the Mtkvari river">
        <defs>
          <pattern id="blocks" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <rect width="20" height="20" x="3" y="3" fill="currentColor" opacity="0.06" />
          </pattern>
        </defs>
        <rect width="400" height="260" fill="url(#blocks)" />
        <path d="M-10 210 C 80 170, 120 230, 200 190 S 330 120, 420 150" fill="none" stroke="var(--info)" strokeOpacity="0.35" strokeWidth="16" strokeLinecap="round" />
        <g fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="5" strokeLinecap="round">
          <path d="M20 40 L 380 120" />
          <path d="M60 250 L 150 10" />
          <path d="M210 250 L 260 0" />
          <path d="M0 120 C 120 110, 200 80, 400 60" />
        </g>
        <g fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2">
          <path d="M0 170 L 400 230" />
          <path d="M320 0 L 300 260" />
          <path d="M0 70 L 200 0" />
        </g>
        <circle cx="215" cy="92" r="26" fill="var(--accent)" opacity="0.12" />
        <g transform="translate(215 92)">
          <path d="M0 -22 C 12 -22, 14 -10, 0 6 C -14 -10, -12 -22, 0 -22 Z" fill="var(--accent)" />
          <circle cy="-14" r="4" fill="var(--accent-ink)" />
        </g>
        <text x="236" y="86" fontFamily="var(--font-mono)" fontSize="9" fill="currentColor" letterSpacing="1">OUR STUDIO</text>
        <text x="236" y="99" fontFamily="var(--font-mono)" fontSize="8" fill="currentColor" opacity="0.6">VAKE · TBILISI</text>
        <text x="40" y="232" fontFamily="var(--font-mono)" fontSize="8" fill="var(--info)" letterSpacing="2" opacity="0.8">MTKVARI</text>
      </svg>
      <figcaption className="t-meta border-t border-line px-4 py-3 text-muted">Illustrative map · not to scale</figcaption>
    </figure>
  );
}

export default function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title={
          <>
            Tell us about <em className="text-accent">your site</em>
          </>
        }
        lead="A plot, a sketch, a set of drawings or just a question. We read every message and usually reply within two working days."
      />
      <section className="shell grid gap-14 pb-[clamp(4.5rem,10vw,8rem)] lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ContactForm />
        </div>
        <aside className="space-y-8 lg:col-span-4 lg:col-start-9" aria-label="Contact information">
          <ContactDetails />
          <StudioMap />
        </aside>
      </section>
    </>
  );
}
