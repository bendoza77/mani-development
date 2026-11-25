// Uploaded photos live on Cloudflare Images (server/src/integrations/media-storage.ts builds
// `https://imagedelivery.net/<hash>/<id>/public`). With flexible variants switched on
// (server/docs/RUNBOOK.md), the last path part can be options instead of a variant name, so each
// screen gets a copy at the width it draws, as AVIF or WebP where the browser supports them.

const DELIVERY = /^https:\/\/imagedelivery\.net\/[^/?#]+\/[^/?#]+\/[^/?#]+$/;

export const isCloudflareImage = (src: string) => DELIVERY.test(src);

/** next/image loader: `…/<id>/public` → `…/<id>/w=<width>,q=<quality>` (format is chosen automatically). */
export function cloudflareLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  if (!isCloudflareImage(src)) return src;
  return src.replace(/\/[^/]+$/, `/w=${width},q=${quality ?? 75}`);
}
