// The six construction stages shown by the house model. Stage n is fully built at progress n.
// Stage labels are translations (namespace "house", key "stages"), in the same order as this list.

export type HouseStage = {
  /** Camera framing: azimuth (rad, 0 = straight at the street facade), elevation (rad), target height (m), distance factor. */
  pose: [az: number, el: number, targetY: number, zoom: number];
};

export const HOUSE_STAGES: HouseStage[] = [
  { pose: [0.62, 0.62, 0.4, 1.12] }, // Foundation
  { pose: [0.78, 0.46, 3.0, 1] }, // Structural frame
  { pose: [0.38, 0.4, 3.6, 1] }, // Walls & envelope
  { pose: [0.66, 0.58, 4.4, 1] }, // Roof
  { pose: [0.3, 0.32, 3.4, 0.96] }, // Windows, doors & facade
  { pose: [0.56, 0.36, 3.2, 1] }, // Completed house
];

export const STAGE_COUNT = HOUSE_STAGES.length;
