import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/format";

export const inputClass =
  "w-full rounded-[3px] border border-line-strong bg-card px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-muted/80 transition-[border-color,box-shadow] duration-200 hover:border-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/25 aria-invalid:border-danger aria-invalid:ring-danger/20 disabled:opacity-60";

type FieldProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
};

/** Label + control + hint/error wiring with correct aria relationships. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.82rem] font-medium text-ink-soft">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-accent">
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? msgId : undefined,
      })}
      {error ? (
        <p id={msgId} role="alert" className="text-[0.8rem] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-[0.8rem] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-32 resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(
        inputClass,
        "h-11 appearance-none bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236a665f' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")] bg-position-[right_0.9rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Accessible switch built on a native checkbox. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className={cx("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          aria-labelledby={`${id}-l`}
          aria-describedby={description ? `${id}-d` : undefined}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-10 rounded-full bg-line-strong transition-colors peer-checked:bg-ok peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-paper" />
        <span className="absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-4" />
      </span>
      <span className="flex flex-col">
        <span id={`${id}-l`} className="text-[0.9rem] font-medium">
          {label}
        </span>
        {description && (
          <span id={`${id}-d`} className="text-[0.8rem] text-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
