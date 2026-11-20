import { LocaleLink as Link } from "@/i18n/LocaleLink";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { cx } from "@/lib/format";

type Variant = "primary" | "accent" | "outline" | "ghost" | "light" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[0.01em] transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-(--ease-arch) disabled:cursor-not-allowed disabled:opacity-55 active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-accent hover:text-accent-ink",
  accent: "bg-accent text-accent-ink hover:bg-accent-hover",
  outline: "border border-line-strong text-ink hover:border-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink hover:bg-paper-2",
  light: "bg-night-ink text-night hover:bg-accent hover:text-accent-ink",
  danger: "bg-danger text-white hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[0.82rem] rounded-[3px]",
  md: "h-11 px-5 text-[0.9rem] rounded-[3px]",
  lg: "h-13 px-7 text-[0.95rem] rounded-[3px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: Variant; size?: Size; arrow?: boolean; children: ReactNode };

function Arrow() {
  return (
    <ArrowUpRight
      aria-hidden
      className="size-4 transition-transform duration-300 ease-(--ease-arch) group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5"
    />
  );
}

export function Button({
  variant,
  size,
  arrow,
  loading,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      // Defaults to type="button" so buttons inside dialogs never submit an enclosing form by accident.
      className={buttonClass(variant, size, className)}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
      {arrow && !loading && <Arrow />}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  arrow,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

/** Understated underlined text link with an arrow, used in editorial sections. */
export function TextLink({ className, children, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(
        "group/tl inline-flex items-center gap-1.5 border-b border-current pb-0.5 text-[0.92rem] font-medium transition-colors hover:text-accent",
        className,
      )}
      {...rest}
    >
      {children}
      <ArrowUpRight
        aria-hidden
        className="size-3.5 transition-transform duration-300 group-hover/tl:translate-x-0.5 group-hover/tl:-translate-y-0.5"
      />
    </Link>
  );
}
