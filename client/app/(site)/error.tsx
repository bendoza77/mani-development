"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="shell flex min-h-[80svh] flex-col justify-center pt-(--header-h)">
      <p className="t-eyebrow text-muted">Something went wrong</p>
      <h1 className="t-h1 mt-5 max-w-[16ch]">We hit an unexpected problem loading this page.</h1>
      <p className="t-lead mt-5 max-w-xl text-ink-soft">
        Try again. If you edited demo data in the admin panel, resetting it from Settings will restore the defaults.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <ButtonLink href="/" variant="outline" size="lg">
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}
