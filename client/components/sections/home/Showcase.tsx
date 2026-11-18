import Link from "next/link";
import { Img } from "@/components/ui/Img";
import { IMAGES } from "@/data/images";

/**
 * Full-bleed architectural image with a scroll-linked parallax driven entirely by CSS
 * scroll-driven animations (compositor thread, no JS). Browsers without support show it static.
 */
export function Showcase() {
  return (
    <section aria-labelledby="showcase-title" className="relative">
      <div className="relative h-[clamp(28rem,85svh,56rem)] overflow-hidden">
        <div className="showcase-parallax absolute inset-x-0 -top-[12%] h-[124%]">
          <Img
            src={IMAGES["villa-cantilever"].src}
            alt="Mtatsminda House: a white cantilevered upper floor over a fully glazed ground floor"
            sizes="100vw"
            quality={80}
          />
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="shell absolute inset-x-0 bottom-0 pb-[clamp(2rem,5vw,4rem)] text-white">
          <div className="grid gap-6 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <p className="t-eyebrow text-white/75">Project in focus · Tbilisi</p>
              <h2 id="showcase-title" className="t-h2 mt-4 max-w-[16ch]">
                A seven-metre cantilever, carried without a single visible column.
              </h2>
            </div>
            <div className="md:col-span-4 md:col-start-9">
              <dl className="grid grid-cols-3 gap-4 border-t border-white/25 pt-4">
                {[
                  ["7.2 m", "Cantilever"],
                  ["640 m²", "Built area"],
                  ["19 mo", "On site"],
                ].map(([v, k]) => (
                  <div key={k}>
                    <dt className="t-meta text-white/70">{k}</dt>
                    <dd className="mt-1 font-display text-2xl">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href="/projects/mtatsminda-house"
                className="mt-6 inline-flex items-center gap-2 border-b border-white/60 pb-0.5 text-[0.92rem] hover:border-white"
              >
                Read the case study
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
