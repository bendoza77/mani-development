import { z } from "zod";

/**
 * The look of a page and of each section, chosen in the editor. Colors are exact #rrggbb values
 * (stored lower-case), and everything else is a fixed choice, so nothing but a color can ever
 * reach the website's styles.
 */

const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
  .transform((value) => value.toLowerCase());

export const blockStyleInput = z.strictObject({
  background: color.nullish(),
  textColor: color.nullish(),
  align: z.enum(["left", "center", "right"]).optional(),
  padding: z.enum(["none", "small", "medium", "large"]).optional(),
  width: z.enum(["narrow", "normal", "wide", "full"]).optional(),
});

export const pageStyleInput = z.strictObject({
  background: color.nullish(),
  textColor: color.nullish(),
  accent: color.nullish(),
});

export type BlockStyle = {
  background: string | null;
  textColor: string | null;
  align: "left" | "center" | "right";
  padding: "none" | "small" | "medium" | "large";
  width: "narrow" | "normal" | "wide" | "full";
};

export type PageStyle = { background: string | null; textColor: string | null; accent: string | null };

/** Fills in the defaults, so the website always gets every setting. */
export function blockStyle(value: unknown): BlockStyle {
  const parsed = blockStyleInput.safeParse(value ?? {});
  const s = parsed.success ? parsed.data : {};
  return {
    background: s.background ?? null,
    textColor: s.textColor ?? null,
    align: s.align ?? "left",
    padding: s.padding ?? "medium",
    width: s.width ?? "normal",
  };
}

export function pageStyle(value: unknown): PageStyle {
  const parsed = pageStyleInput.safeParse(value ?? {});
  const s = parsed.success ? parsed.data : {};
  return { background: s.background ?? null, textColor: s.textColor ?? null, accent: s.accent ?? null };
}
