// Page and section styling (colors, alignment, spacing, width). Values come from the API, which
// accepts only exact 6-digit hex colors and fixed keywords; they are checked again here before
// anything reaches a style attribute.
import type { CSSProperties } from "react";

export type Align = "left" | "center" | "right";
export type Padding = "none" | "small" | "medium" | "large";
export type Width = "narrow" | "normal" | "wide" | "full";

export type SectionStyle = { background: string | null; textColor: string | null; align: Align; padding: Padding; width: Width };
export type PageStyle = { background: string | null; textColor: string | null; accent: string | null };

export const DEFAULT_SECTION_STYLE: SectionStyle = { background: null, textColor: null, align: "left", padding: "medium", width: "normal" };
export const DEFAULT_PAGE_STYLE: PageStyle = { background: null, textColor: null, accent: null };

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const hexOrNull = (v: unknown) => (isHex(v) ? v.toLowerCase() : null);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

export function cleanSectionStyle(s: Partial<SectionStyle> | null | undefined): SectionStyle {
  return {
    background: hexOrNull(s?.background),
    textColor: hexOrNull(s?.textColor),
    align: oneOf(s?.align, ["left", "center", "right"] as const, "left"),
    padding: oneOf(s?.padding, ["none", "small", "medium", "large"] as const, "medium"),
    width: oneOf(s?.width, ["narrow", "normal", "wide", "full"] as const, "normal"),
  };
}

export function cleanPageStyle(s: Partial<PageStyle> | null | undefined): PageStyle {
  return { background: hexOrNull(s?.background), textColor: hexOrNull(s?.textColor), accent: hexOrNull(s?.accent) };
}

/** The site's own colors (light theme, app/globals.css), offered as presets. */
export const PALETTE: { name: string; hex: string }[] = [
  { name: "Paper", hex: "#f2eee7" },
  { name: "Card", hex: "#faf8f4" },
  { name: "Accent soft", hex: "#f1e0d4" },
  { name: "Sand", hex: "#f2e6cc" },
  { name: "Green soft", hex: "#dfe9df" },
  { name: "Blue soft", hex: "#dce5ee" },
  { name: "Muted", hex: "#6a665f" },
  { name: "Accent", hex: "#ad4e28" },
  { name: "Green", hex: "#3a6b4b" },
  { name: "Blue", hex: "#35577a" },
  { name: "Ink soft", hex: "#3f4043" },
  { name: "Ink", hex: "#151617" },
  { name: "Night", hex: "#131415" },
  { name: "Night ink", hex: "#ece8e1" },
  { name: "White", hex: "#ffffff" },
];

/** Site defaults, used for the contrast check when a color is left empty. */
export const SITE_BACKGROUND = "#f2eee7";
export const SITE_TEXT = "#151617";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

// Fixed classes for the keyword values (never built from user input).
export const ALIGN_CLASS: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" };
export const PADDING_CLASS: Record<Padding, string> = {
  none: "py-0",
  small: "py-[clamp(0.75rem,2vw,1.25rem)]",
  medium: "py-[clamp(1.25rem,3vw,2.25rem)]",
  large: "py-[clamp(3rem,8vw,6rem)]",
};

type CssVars = CSSProperties & Record<`--${string}`, string>;

/** Inline colors for a section: its own background, and the text color via the site's color variables. */
export function sectionColorStyle(s: SectionStyle): CssVars | undefined {
  const style: CssVars = {};
  if (isHex(s.background)) style.backgroundColor = s.background;
  if (isHex(s.textColor)) {
    style.color = s.textColor;
    style["--ink"] = s.textColor;
    style["--ink-soft"] = s.textColor;
    style["--muted"] = s.textColor;
  }
  return Object.keys(style).length ? style : undefined;
}

/**
 * Editing controls shown on top of a live page use the site's light palette whatever the page's
 * own colors (or the visitor's dark theme) are, so they always stay readable.
 */
export const CHROME_STYLE: CssVars = {
  color: "#151617",
  colorScheme: "light",
  "--paper": "#f2eee7",
  "--paper-2": "#e9e3d8",
  "--card": "#faf8f4",
  "--ink": "#151617",
  "--ink-soft": "#3f4043",
  "--muted": "#66625b",
  "--line": "rgb(21 22 23 / 0.12)",
  "--line-strong": "rgb(21 22 23 / 0.24)",
  "--accent": "#ad4e28",
  "--accent-hover": "#933f1e",
  "--accent-ink": "#fff8f2",
  "--danger": "#a3372a",
  "--danger-soft": "#f4dcd6",
  "--warn": "#855a12",
  "--warn-soft": "#f2e6cc",
  "--ok": "#3a6b4b",
};

/** Inline colors for a whole page: background, text and accent (links, buttons). */
export function pageColorStyle(s: PageStyle): CssVars | undefined {
  const style: CssVars = {};
  if (isHex(s.background)) {
    style.backgroundColor = s.background;
    style["--paper"] = s.background;
  }
  if (isHex(s.textColor)) {
    style.color = s.textColor;
    style["--ink"] = s.textColor;
    style["--ink-soft"] = s.textColor;
    style["--muted"] = s.textColor;
  }
  if (isHex(s.accent)) {
    style["--accent"] = s.accent;
    style["--accent-hover"] = s.accent;
  }
  return Object.keys(style).length ? style : undefined;
}
