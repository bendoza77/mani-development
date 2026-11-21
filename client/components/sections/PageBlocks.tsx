import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { RichText } from "@/components/RichText";
import { Gallery } from "@/components/sections/Gallery";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Img } from "@/components/ui/Img";
import type { PublicBlock } from "@/lib/api";
import { cx } from "@/lib/format";
import { isSafeHref } from "@/lib/richtext";
import { ALIGN_CLASS, PADDING_CLASS, cleanSectionStyle, sectionColorStyle, type Align, type Width } from "@/lib/style";

/**
 * The sections of an admin-built page, in the site's editorial style. Each section sits in its own
 * band: its colors come from validated hex values (inline), and alignment, spacing and width from
 * fixed classes. Nothing is rendered as HTML, and button links outside the safe list are dropped.
 */
export function PageBlocks({ blocks, pageTitle }: { blocks: PublicBlock[]; pageTitle: string }) {
  return (
    <div className="pb-[clamp(2.5rem,6vw,4.5rem)]">
      {blocks.map((b) => (
        <StyledSection key={b.id} block={b} pageTitle={pageTitle} />
      ))}
    </div>
  );
}

/** How wide a section's content is. Text reads in a column; galleries and cards use the page width; banners bleed. */
export type Kind = "column" | "wide" | "bleed";
export const KIND: Record<PublicBlock["type"], Kind> = {
  heading: "column",
  text: "column",
  image: "column",
  gallery: "wide",
  textImage: "wide",
  cards: "wide",
  banner: "bleed",
};

export function containerClass(width: Width, kind: Kind): string {
  switch (width) {
    case "narrow":
      return "shell max-w-2xl";
    case "wide":
      return "shell";
    case "full":
      return kind === "bleed" ? "" : "px-[var(--gutter)]";
    default:
      return kind === "column" ? "shell max-w-3xl" : kind === "wide" ? "shell" : "";
  }
}

function StyledSection({ block, pageTitle }: { block: PublicBlock; pageTitle: string }) {
  const style = cleanSectionStyle(block.style);
  const content = blockContent({ block, pageTitle, align: style.align });
  if (content === null) return null;
  return (
    <section style={sectionColorStyle(style)} className={cx(PADDING_CLASS[style.padding], ALIGN_CLASS[style.align])}>
      <div className={containerClass(style.width, KIND[block.type])}>{content}</div>
    </section>
  );
}

/** Centre or right-align elements that have their own max width (titles, lead text). */
export const blockAlign = (align: Align) => (align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : "");

/** A section's content, or null when it has nothing to show. A plain function (no hooks). */
function blockContent({ block, pageTitle, align }: { block: PublicBlock; pageTitle: string; align: Align }): ReactNode {
  switch (block.type) {
    case "heading":
      if (!block.text) return null;
      return block.level === 2 ? <h2 className="t-h2">{block.text}</h2> : <h3 className="t-h3">{block.text}</h3>;

    case "text":
      if (!block.doc?.content) return null;
      return <RichText doc={block.doc} className="space-y-4 text-[1.05rem] leading-[1.75] text-ink-soft" />;

    case "image":
      return (
        <figure>
          <div className="relative overflow-hidden rounded-[2px]" style={{ aspectRatio: `${block.image.width} / ${block.image.height}` }}>
            <Img src={block.image.src} alt={block.image.alt} sizes="(min-width: 768px) 48rem, 100vw" />
          </div>
          {block.caption && <figcaption className="mt-2 text-[0.85rem] text-muted">{block.caption}</figcaption>}
        </figure>
      );

    case "banner":
      return <Banner block={block} align={align} />;

    case "gallery":
      return block.images.length ? <Gallery images={block.images.map((i) => i.src)} title={pageTitle} /> : null;

    case "textImage":
      return (
        <div className="grid items-center gap-[clamp(1.5rem,4vw,4rem)] lg:grid-cols-12">
          <div className={cx("relative aspect-[4/3] overflow-hidden rounded-[2px] lg:col-span-6", block.imageSide === "left" ? "lg:order-1" : "lg:order-2")}>
            <Img src={block.image.src} alt={block.image.alt} sizes="(min-width: 1024px) 48vw, 100vw" />
          </div>
          <div className={cx("lg:col-span-6", block.imageSide === "left" ? "lg:order-2 lg:pl-4" : "lg:order-1 lg:pr-4")}>
            {block.title && <h2 className="t-h2">{block.title}</h2>}
            {block.doc?.content && <RichText doc={block.doc} className={cx("space-y-4 leading-[1.75] text-ink-soft", block.title && "mt-6")} />}
          </div>
        </div>
      );

    case "cards":
      return (
        <>
          {block.title && <h2 className={cx("t-h2 max-w-[20ch]", blockAlign(align))}>{block.title}</h2>}
          <ul className={cx("grid gap-x-[clamp(1rem,2.5vw,2.5rem)] gap-y-10 sm:grid-cols-2 lg:grid-cols-3", block.title && "mt-10")}>
            {block.items.map((item, i) => (
              <li key={i} className="border-t border-line pt-5">
                {item.image && (
                  <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[2px]">
                    <Img src={item.image.src} alt={item.image.alt} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw" />
                  </div>
                )}
                <h3 className="font-display text-[1.35rem] leading-snug">{item.title}</h3>
                {item.text && <p className="mt-2 leading-relaxed text-ink-soft">{item.text}</p>}
              </li>
            ))}
          </ul>
        </>
      );

    default:
      return null;
  }
}

function Banner({ block, align }: { block: Extract<PublicBlock, { type: "banner" }>; align: Align }) {
  const button = block.button && isSafeHref(block.button.href) ? block.button : null;
  const external = button ? /^(https?:|mailto:|tel:)/i.test(button.href) : false;
  return (
    <div className="relative isolate flex min-h-[clamp(22rem,50vw,34rem)] flex-col justify-end overflow-hidden bg-night text-white">
      <Img src={block.image.src} alt={block.image.alt} sizes="100vw" className="-z-10" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
      <div className="shell py-[clamp(2rem,6vw,4rem)]">
        <h2 className={cx("t-h2 max-w-[18ch] text-white", blockAlign(align))}>{block.title}</h2>
        {block.text && <p className={cx("t-lead mt-4 max-w-2xl text-white/85", blockAlign(align))}>{block.text}</p>}
        {button &&
          (external ? (
            <a
              href={button.href}
              className={buttonClass("light", "lg", "mt-8")}
              {...(/^https?:/i.test(button.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {button.label}
              <ArrowUpRight aria-hidden className="size-4" />
            </a>
          ) : (
            <ButtonLink href={button.href} variant="light" size="lg" arrow className="mt-8">
              {button.label}
            </ButtonLink>
          ))}
      </div>
    </div>
  );
}
