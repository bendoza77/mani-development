"use client";

/**
 * An inline script that runs only from the server-rendered HTML (before first paint).
 *
 * Switching language re-renders the root layout on the client, and React warns whenever client
 * rendering produces a <script> (it would never execute). Following the Next.js guide "Preventing
 * flash before hydration", the client copy gets type="text/plain": inert and warning-free, while
 * suppressHydrationWarning accepts the type difference. The theme it sets on <html> persists.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
