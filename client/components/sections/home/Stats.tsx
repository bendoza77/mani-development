import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";
import { cx } from "@/lib/format";

export const COMPANY_STATS = [
  { value: 17, suffix: "", label: "Years building", note: "Founded in Tbilisi, 2009" },
  { value: 64, suffix: "", label: "Buildings delivered", note: "Homes, apartments and workplaces" },
  { value: 310, suffix: "k", label: "Square metres built", note: "Across five Georgian regions" },
  { value: 24, suffix: "", label: "In-house engineers", note: "Structural, MEP and site" },
];

export function Stats() {
  return (
    <section className="border-y border-line bg-paper-2/60" aria-label="Company in numbers">
      <dl className="shell grid grid-cols-2 lg:grid-cols-4">
        {COMPANY_STATS.map((s, i) => (
          <Reveal
            key={s.label}
            delay={i * 80}
            className={cx(
              "border-line py-10 sm:py-14 lg:border-b-0 lg:px-8",
              i % 2 === 0 ? "border-r pr-5" : "pl-5",
              i < 2 && "border-b",
              i === 0 && "lg:pl-0",
              i === 1 && "lg:border-r",
              i === 3 && "lg:border-r-0",
            )}
          >
            <dt className="t-eyebrow text-muted">{s.label}</dt>
            <dd className="mt-4 font-display text-[clamp(2.8rem,1.8rem+4vw,5.5rem)] leading-none tracking-[-0.04em]">
              <Counter value={s.value} suffix={s.suffix} />
            </dd>
            <dd className="mt-3 text-[0.85rem] text-muted">{s.note}</dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
