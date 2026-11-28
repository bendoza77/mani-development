// The eight construction stages shown by the house model. Stage n is fully built at progress n
// (progress runs 0 → STAGE_COUNT; see model.ts). Stage labels are translations (namespace "house",
// key "stages"), in the same order as this list.

export type HouseStage = {
  /** Camera framing: azimuth (rad, 0 = straight at the street facade), elevation (rad), target height (m), distance factor. */
  pose: [az: number, el: number, targetY: number, zoom: number];
};

export const HOUSE_STAGES: HouseStage[] = [
  { pose: [0.62, 0.7, 0.2, 1.12] }, // Site preparation
  { pose: [0.62, 0.62, 0.4, 1.12] }, // Foundation
  { pose: [0.78, 0.46, 3.0, 1] }, // Structural frame
  { pose: [0.38, 0.4, 3.6, 1] }, // Walls
  { pose: [0.66, 0.58, 4.4, 1] }, // Roof
  { pose: [0.3, 0.32, 3.4, 0.96] }, // Windows & doors
  { pose: [0.45, 0.34, 3.4, 0.98] }, // Facade & finishes
  { pose: [0.56, 0.36, 3.2, 1] }, // Landscaping / completed house
];

export const STAGE_COUNT = HOUSE_STAGES.length;

/** The stage being worked on at build progress p (1-based; p = 0 is the start of stage 1). */
export const stageAt = (p: number) => Math.min(STAGE_COUNT, Math.max(1, Math.ceil(p - 1e-4)));

/** Seconds the automatic build spends on one stage (it eases through each stage boundary). */
export const STAGE_SECONDS = 2.3;

/**
 * Build progress shared by the viewer UI and the 3D scene. A plain mutable object rather than React
 * state: the scene advances it every frame, and the UI writes it directly when the visitor seeks,
 * so no React render happens per frame.
 */
export type BuildState = {
  /** Current progress, 0 (empty plot) → STAGE_COUNT (finished house). */
  p: number;
  /** Advancing on its own (the automatic build). */
  playing: boolean;
  /** Animated seek in progress toward this value, if any (stage navigation). */
  target: number | null;
  /** Requests a frame; set by the scene while it is mounted. */
  invalidate: () => void;
};
