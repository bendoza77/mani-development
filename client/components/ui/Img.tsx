import Image from "next/image";
import { IMAGES } from "@/data/images";
import { cx } from "@/lib/format";

const TONES = new Map<string, string>(Object.values(IMAGES).map((m) => [m.src, m.tone]));

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  /** Preload as the page's LCP image. Use for at most one above-the-fold image per page. */
  preload?: boolean;
  quality?: 70 | 80;
  /** Skip the tone placeholder (e.g. letterboxed lightbox images). */
  noTone?: boolean;
};

/**
 * Fills its (positioned) parent. Local assets go through next/image for responsive
 * AVIF/WebP variants; uploaded data URLs from the media library render as plain <img>.
 * The dominant tone is painted underneath so nothing pops while loading.
 */
export function Img({ src, alt, sizes, className, imgClassName, preload, quality = 70, noTone }: Props) {
  const tone = TONES.get(src) ?? "var(--paper-2)";
  const local = src.startsWith("/");
  return (
    <div className={cx("absolute inset-0 overflow-hidden", className)} style={noTone ? undefined : { backgroundColor: tone }}>
      {local ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={quality}
          preload={preload}
          className={cx("object-cover", imgClassName)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL, nothing to optimise
        <img src={src} alt={alt} className={cx("absolute inset-0 size-full object-cover", imgClassName)} />
      )}
    </div>
  );
}
