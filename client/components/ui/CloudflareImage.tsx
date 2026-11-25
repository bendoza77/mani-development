"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cloudflareLoader } from "@/lib/cloudflare-image";

/**
 * next/image for Cloudflare-hosted uploads. A client component because the loader is a function,
 * which can't be passed from a server component; the props it takes are all plain values.
 *
 * Sized copies need "flexible variants" switched on in Cloudflare (server/docs/RUNBOOK.md). If a
 * sized copy fails to load (the setting is off, or Cloudflare refuses the options), the photo falls
 * back to its original `/public` address, so it still shows, only larger.
 */
export function CloudflareImage({ alt, onError, ...props }: Omit<ImageProps, "loader">) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Image {...props} alt={alt} unoptimized />;
  return (
    <Image
      {...props}
      alt={alt}
      loader={cloudflareLoader}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
