import type { ReactNode } from "react";

/** Consistent editorial opening for inner pages. */
export function PageIntro({
  eyebrow,
  title,
  lead,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="relative isolate pt-[calc(var(--header-h)+clamp(2.5rem,7vw,6rem))] pb-[clamp(2.5rem,6vw,5rem)]">
      <div aria-hidden className="drafting-grid absolute inset-0 -z-10 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="shell grid gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <p className="t-eyebrow rise-in text-muted">{eyebrow}</p>
          <h1 className="t-h1 rise-in mt-6 max-w-[18ch]" style={{ "--d": "80ms" } as React.CSSProperties}>
            {title}
          </h1>
          {lead && (
            <p className="t-lead rise-in mt-6 max-w-2xl text-ink-soft" style={{ "--d": "160ms" } as React.CSSProperties}>
              {lead}
            </p>
          )}
        </div>
        {aside && (
          <div className="rise-in lg:col-span-4" style={{ "--d": "240ms" } as React.CSSProperties}>
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
