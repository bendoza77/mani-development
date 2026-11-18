import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden className="drafting-grid absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="shell flex h-(--header-h) items-center">
        <Link href="/" aria-label="Home" className="inline-flex items-center gap-2.5 text-ink">
          <LogoMark className="size-7" />
          <span className="text-[1.05rem] font-semibold tracking-[0.2em] uppercase">Lintel</span>
        </Link>
      </div>
      <div className="shell flex flex-1 flex-col justify-center py-16">
        <p className="t-eyebrow text-muted">Error 404 · Drawing not found</p>
        <h1 className="t-display mt-6 max-w-[14ch]">
          This opening has <em className="text-accent">no lintel.</em>
        </h1>
        <p className="t-lead mt-6 max-w-xl text-ink-soft">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has moved. Let&rsquo;s get you back onto solid ground.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href="/" arrow size="lg">
            Back to home
          </ButtonLink>
          <ButtonLink href="/projects" variant="outline" size="lg">
            View projects
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
