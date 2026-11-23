import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { BlockType, Prisma } from "../../generated/prisma/client.js";
import { optionalText, requiredText } from "../content/fields.js";
import { richTextDoc, SAFE_HREF } from "../content/rich-text.js";
import { blockStyle, blockStyleInput } from "../content/style.js";
import { pick, pickDoc, toImage, type Locale } from "../media/media.serialize.js";

/**
 * Page sections ("blocks", docs/API_CONTRACTS.md §8.1). Each one is stored as a content_blocks row:
 * its texts in `data`, its photos in content_block_media (so a photo in use can't be deleted).
 */

const href = z.string().trim().max(500).regex(SAFE_HREF, "unsafe_link");

const card = z.strictObject({
  titleKa: requiredText(80),
  titleEn: optionalText(80),
  textKa: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => v ?? ""),
  textEn: optionalText(300),
  mediaId: z.uuid().nullish(),
});

export const blockInput = z.discriminatedUnion("type", [
  z.strictObject({
    style: blockStyleInput.optional(),
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    textKa: requiredText(150),
    textEn: optionalText(150),
  }),
  z.strictObject({ style: blockStyleInput.optional(), type: z.literal("text"), docKa: richTextDoc, docEn: richTextDoc.nullish() }),
  z.strictObject({ style: blockStyleInput.optional(), type: z.literal("image"), mediaId: z.uuid(), captionKa: optionalText(200), captionEn: optionalText(200) }),
  z
    .strictObject({
      style: blockStyleInput.optional(),
      type: z.literal("banner"),
      mediaId: z.uuid(),
      titleKa: requiredText(120),
      titleEn: optionalText(120),
      textKa: optionalText(300),
      textEn: optionalText(300),
      buttonLabelKa: optionalText(40),
      buttonLabelEn: optionalText(40),
      buttonHref: href.nullish().transform((v) => v || null),
    })
    .refine((b) => !b.buttonLabelKa === !b.buttonHref, { path: ["buttonHref"], message: "button_needs_label_and_link" }),
  z.strictObject({ style: blockStyleInput.optional(), type: z.literal("gallery"), mediaIds: z.array(z.uuid()).min(2).max(30) }),
  z.strictObject({
    style: blockStyleInput.optional(),
    type: z.literal("textImage"),
    mediaId: z.uuid(),
    imageSide: z.enum(["left", "right"]),
    titleKa: optionalText(120),
    titleEn: optionalText(120),
    docKa: richTextDoc,
    docEn: richTextDoc.nullish(),
  }),
  z.strictObject({
    style: blockStyleInput.optional(),
    type: z.literal("cards"),
    titleKa: optionalText(120),
    titleEn: optionalText(120),
    items: z.array(card).min(1).max(12),
  }),
]);

export type BlockInput = z.output<typeof blockInput>;
type BlockData = Record<string, unknown>;

/** The photos of a section, in order. For cards, position = card index (cards without a photo have none). */
function mediaOf(block: BlockInput): { mediaId: string; position: number }[] {
  switch (block.type) {
    case "image":
    case "banner":
    case "textImage":
      return [{ mediaId: block.mediaId, position: 0 }];
    case "gallery":
      return block.mediaIds.map((mediaId, position) => ({ mediaId, position }));
    case "cards":
      return block.items.flatMap((item, position) => (item.mediaId ? [{ mediaId: item.mediaId, position }] : []));
    default:
      return [];
  }
}

export const imageIdsOf = (blocks: BlockInput[]) => blocks.flatMap((b) => mediaOf(b).map((m) => m.mediaId));

/** content_blocks.data: everything but the photo ids. */
function dataOf(block: BlockInput): BlockData {
  const rest: BlockData = { ...block };
  delete rest.type;
  delete rest.mediaId;
  delete rest.mediaIds;
  if (block.type === "text" || block.type === "textImage") rest.docEn = block.docEn ?? null;
  if (block.type === "cards") rest.items = block.items.map(({ mediaId: _m, ...item }) => item);
  return rest;
}

export async function writeBlocks(tx: Prisma.TransactionClient, owner: { pageId: string }, blocks: BlockInput[]) {
  await tx.contentBlock.deleteMany({ where: owner });
  for (const [position, block] of blocks.entries()) {
    const media = mediaOf(block);
    await tx.contentBlock.create({
      data: {
        ...owner,
        position,
        type: block.type as BlockType,
        data: dataOf(block) as Prisma.InputJsonValue,
        ...(media.length ? { media: { create: media } } : {}),
      },
    });
  }
}

export const blocksInclude = {
  orderBy: { position: "asc" },
  include: { media: { orderBy: { position: "asc" }, include: { media: true } } },
} satisfies Prisma.Page$blocksArgs;

type BlockRow = Prisma.ContentBlockGetPayload<{ include: typeof blocksInclude.include }>;
type MediaRow = BlockRow["media"][number]["media"];

const mediaAt = (block: BlockRow, position: number): MediaRow | undefined =>
  block.media.find((m) => m.position === position)?.media;

/** For the admin editor: the stored fields in both languages, plus photo ids and previews. */
export function toAdminBlock(block: BlockRow, config: Config) {
  const data = block.data as BlockData;
  const img = (m: MediaRow | undefined) => (m ? toImage(m, config) : null);
  const base = { id: block.id, type: block.type, ...data, style: blockStyle(data.style) };
  switch (block.type) {
    case "image":
    case "banner":
    case "textImage": {
      const m = mediaAt(block, 0);
      return { ...base, mediaId: m?.id ?? null, image: img(m) };
    }
    case "gallery":
      return { ...base, mediaIds: block.media.map((m) => m.media.id), images: block.media.map((m) => toImage(m.media, config)) };
    case "cards": {
      const items = (data.items as BlockData[] | undefined) ?? [];
      return {
        ...base,
        items: items.map((item, i) => {
          const m = mediaAt(block, i);
          return { ...item, mediaId: m?.id ?? null, image: img(m) };
        }),
      };
    }
    default:
      return base;
  }
}

/** For the website: one language (Russian → English → Georgian fallback). Broken sections are dropped. */
export function toPublicBlock(block: BlockRow, config: Config, locale: Locale) {
  const out = publicContent(block, config, locale);
  return out ? { ...out, style: blockStyle((block.data as BlockData).style) } : null;
}

function publicContent(block: BlockRow, config: Config, locale: Locale) {
  const data = block.data as BlockData;
  const t = (ka: unknown, en: unknown, ru: unknown) =>
    pick(String(ka ?? ""), (en as string | null) ?? null, (ru as string | null) ?? null, locale);
  const doc = (ka: unknown, en: unknown, ru: unknown) => pickDoc(ka, en, ru, locale);
  const image = (position: number) => {
    const m = mediaAt(block, position);
    return m ? toImage(m, config, locale) : null;
  };
  const id = block.id;
  switch (block.type) {
    case "heading":
      return { id, type: "heading", level: data.level, text: t(data.textKa, data.textEn, data.textRu) };
    case "text":
      return { id, type: "text", doc: doc(data.docKa, data.docEn, data.docRu) };
    case "image":
      return image(0) && { id, type: "image", image: image(0), caption: t(data.captionKa, data.captionEn, data.captionRu) };
    case "banner":
      return (
        image(0) && {
          id,
          type: "banner",
          image: image(0),
          title: t(data.titleKa, data.titleEn, data.titleRu),
          text: t(data.textKa, data.textEn, data.textRu),
          button: data.buttonHref ? { label: t(data.buttonLabelKa, data.buttonLabelEn, data.buttonLabelRu), href: data.buttonHref } : null,
        }
      );
    case "gallery":
      return { id, type: "gallery", images: block.media.map((m) => toImage(m.media, config, locale)) };
    case "textImage":
      return (
        image(0) && {
          id,
          type: "textImage",
          image: image(0),
          imageSide: data.imageSide,
          title: t(data.titleKa, data.titleEn, data.titleRu),
          doc: doc(data.docKa, data.docEn, data.docRu),
        }
      );
    case "cards":
      return {
        id,
        type: "cards",
        title: t(data.titleKa, data.titleEn, data.titleRu),
        items: ((data.items as BlockData[] | undefined) ?? []).map((item, i) => ({
          title: t(item.titleKa, item.titleEn, item.titleRu),
          text: t(item.textKa, item.textEn, item.textRu),
          image: image(i),
        })),
      };
    default:
      return null;
  }
}
