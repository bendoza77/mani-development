// Procedural description of the Lintel maquette: a seven-storey residential block with
// timber fins, a stepped terrace block, and landscaped grounds on a stone plinth.
// Pure data (no three.js) so it can also drive the server-rendered SVG blueprint.
//
// Global build progress runs 0 → 5, one unit per construction stage:
//   0–1 groundworks · 1–2 structure · 2–3 walls & cores · 3–4 facade · 4–5 landscape

export type PartKind = "concrete" | "white" | "glass" | "timber" | "green" | "paving" | "water" | "canopy" | "trunk" | "figure";
/** grow: extrudes upward from its base · drop: lowered into place · pop: scales up from base · spread: unrolls in plan */
export type Motion = "grow" | "drop" | "pop" | "spread";

export type Part = {
  kind: PartKind;
  /** centre x/z, base y */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  t0: number;
  dur: number;
  motion: Motion;
};

export const FLOOR_H = 0.62;
export const SLAB_T = 0.1;
export const RAFT_TOP = 0.2;
export const PLINTH = { w: 15, d: 10, h: 0.7 };

type Block = { x0: number; x1: number; z0: number; z1: number; floors: number; setback: number; balcony: number };

// Block A: residential slab with timber fins. Block B: stepped terraces. Link: glazed lobby.
const A: Block = { x0: -4.9, x1: -0.7, z0: -2.1, z1: 1.7, floors: 7, setback: 0, balcony: 0.38 };
const B: Block = { x0: 0.6, x1: 5.4, z0: -2.7, z1: 0.9, floors: 4, setback: 0.62, balcony: 0 };
const L: Block = { x0: -0.7, x1: 0.6, z0: -1.5, z1: 0.5, floors: 1, setback: 0, balcony: 0 };

function buildParts(): Part[] {
  const parts: Part[] = [];
  const add = (p: Part) => parts.push(p);
  const box = (
    kind: PartKind,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    y: number,
    h: number,
    t0: number,
    dur: number,
    motion: Motion,
  ) => add({ kind, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, y, h, t0, dur, motion });

  const blocks: [Block, number][] = [
    [A, 0],
    [B, 0.18],
    [L, 0.32],
  ];

  // ── Stage 1: groundworks (footings, then raft slabs) ──────────────────────
  blocks.forEach(([b, lag]) => {
    const nx = Math.max(2, Math.round((b.x1 - b.x0) / 1.05) + 1);
    const nz = Math.max(2, Math.round((b.z1 - b.z0) / 1.25) + 1);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const x = b.x0 + 0.2 + ((b.x1 - b.x0 - 0.4) * i) / (nx - 1);
        const z = b.z0 + 0.2 + ((b.z1 - b.z0 - 0.4) * j) / (nz - 1);
        box("concrete", x - 0.17, x + 0.17, z - 0.17, z + 0.17, 0, 0.12, 0.02 + lag * 0.5 + (i + j) * 0.018, 0.22, "grow");
      }
    box("concrete", b.x0 - 0.12, b.x1 + 0.12, b.z0 - 0.12, b.z1 + 0.12, 0, RAFT_TOP, 0.42 + lag, 0.4, "spread");
  });

  // ── Stage 2: structure (columns per floor, then the slab above) ───────────
  blocks.forEach(([b, lag]) => {
    for (let f = 0; f < b.floors; f++) {
      const z1 = b.z1 - f * b.setback;
      const base = RAFT_TOP + f * FLOOR_H;
      const t = 1 + lag * 0.4 + (f / Math.max(b.floors, 5)) * 0.72;
      const nx = Math.max(2, Math.round((b.x1 - b.x0) / 1.05) + 1);
      const nz = Math.max(2, Math.round((z1 - b.z0) / 1.3) + 1);
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          const x = b.x0 + 0.14 + ((b.x1 - b.x0 - 0.28) * i) / (nx - 1);
          const z = b.z0 + 0.14 + ((z1 - b.z0 - 0.28) * j) / (nz - 1);
          box("concrete", x - 0.055, x + 0.055, z - 0.055, z + 0.055, base, FLOOR_H - SLAB_T, t + i * 0.006, 0.16, "grow");
        }
      // Slab on top of this floor; block A carries a balcony overhang on the front.
      box("white", b.x0 - 0.06, b.x1 + 0.06, b.z0 - 0.06, z1 + b.balcony, base + FLOOR_H - SLAB_T, SLAB_T, t + 0.1, 0.2, "drop");
    }
  });

  // ── Stage 3: cores and solid walls ────────────────────────────────────────
  blocks.forEach(([b, lag]) => {
    for (let f = 0; f < b.floors; f++) {
      const z1 = b.z1 - f * b.setback;
      const base = RAFT_TOP + f * FLOOR_H;
      const hh = FLOOR_H - SLAB_T;
      const t = 2 + lag * 0.35 + f * 0.075;
      if (b === A) {
        box("concrete", -3.35, -2.25, -1.55, -0.35, base, hh, t, 0.2, "grow"); // stair + lift core
        box("white", b.x0, b.x0 + 0.12, b.z0, z1, base, hh, t + 0.05, 0.22, "grow"); // gable walls
        box("white", b.x1 - 0.12, b.x1, b.z0, z1, base, hh, t + 0.08, 0.22, "grow");
        box("white", b.x0, b.x1, b.z0, b.z0 + 0.12, base, hh, t + 0.1, 0.22, "grow"); // back wall
      } else if (b === B) {
        box("white", b.x0, b.x1, b.z0, b.z0 + 0.12, base, hh, t, 0.22, "grow");
        box("white", b.x1 - 0.12, b.x1, b.z0, z1 - 1.2, base, hh, t + 0.06, 0.22, "grow");
        box("concrete", 1.2, 2.1, -2.5, -1.6, base, hh, t + 0.03, 0.2, "grow");
      } else {
        box("white", b.x0, b.x1, b.z0, b.z0 + 0.1, base, hh, t, 0.2, "grow");
      }
    }
    // Roof upstands and plant enclosure.
    const top = RAFT_TOP + b.floors * FLOOR_H;
    const zTop = b.z1 - (b.floors - 1) * b.setback;
    if (b !== L) {
      box("white", b.x0, b.x1, b.z0, b.z0 + 0.08, top, 0.16, 2.75 + lag * 0.3, 0.2, "grow");
      box("white", b.x0, b.x0 + 0.08, b.z0, zTop, top, 0.16, 2.78 + lag * 0.3, 0.2, "grow");
      box("white", b.x1 - 0.08, b.x1, b.z0, zTop, top, 0.16, 2.8 + lag * 0.3, 0.2, "grow");
    }
    if (b === A) box("white", -3.45, -2.15, -1.65, -0.25, top, 0.42, 2.85, 0.2, "grow");
  });

  // ── Stage 4: facade (glazing, timber fins, balustrades) ───────────────────
  blocks.forEach(([b, lag]) => {
    for (let f = 0; f < b.floors; f++) {
      const z1 = b.z1 - f * b.setback;
      const base = RAFT_TOP + f * FLOOR_H;
      const hh = FLOOR_H - SLAB_T;
      const t = 3 + lag * 0.3 + f * 0.06;
      const inset = 0.1;
      // front glazing
      box("glass", b.x0 + 0.12, b.x1 - 0.12, z1 - inset - 0.03, z1 - inset, base, hh, t, 0.2, "grow");
      if (b !== A) {
        box("glass", b.x0, b.x0 + 0.03, b.z0 + 0.12, z1 - inset, base, hh, t + 0.05, 0.2, "grow");
      }
      if (b === B) box("glass", b.x1 - 0.03, b.x1, z1 - 1.2, z1 - inset, base, hh, t + 0.05, 0.2, "grow");
      if (b === A) {
        // Timber fins along the balcony edge.
        const n = 13;
        for (let i = 0; i < n; i++) {
          const x = b.x0 + 0.05 + ((b.x1 - b.x0 - 0.1) * i) / (n - 1);
          box("timber", x - 0.03, x + 0.03, z1 + b.balcony - 0.16, z1 + b.balcony - 0.02, base, hh, t + 0.12 + i * 0.012, 0.16, "grow");
        }
        // Side glazing at the balcony ends
        box("glass", b.x0 + 0.12, b.x1 - 0.12, b.z0 + 0.12, b.z0 + 0.15, base + 0.08, hh - 0.16, t + 0.08, 0.2, "grow");
        // Punched windows in both gables, so no elevation reads as a blank wall
        for (const zc of [-1.35, -0.2, 0.95]) {
          box("glass", b.x1, b.x1 + 0.025, zc - 0.34, zc + 0.34, base + 0.1, hh - 0.2, t + 0.1, 0.18, "grow");
          box("glass", b.x0 - 0.025, b.x0, zc - 0.34, zc + 0.34, base + 0.1, hh - 0.2, t + 0.1, 0.18, "grow");
        }
      } else {
        // Slim mullions divide the ribbon glazing into bays
        const n = Math.max(2, Math.round((b.x1 - b.x0 - 0.24) / 0.58));
        for (let i = 1; i < n; i++) {
          const x = b.x0 + 0.12 + ((b.x1 - b.x0 - 0.24) * i) / n;
          box("white", x - 0.018, x + 0.018, z1 - inset, z1 - inset + 0.035, base, hh, t + 0.1 + i * 0.01, 0.16, "grow");
        }
      }
      if (b === B && f < b.floors - 1) {
        // Terrace balustrade: low white upstand at the slab edge above.
        box("white", b.x0, b.x1, z1 - b.setback, z1 - b.setback + 0.05, base + FLOOR_H, 0.14, t + 0.15, 0.16, "grow");
      }
    }
  });

  // ── Stage 5: landscape ───────────────────────────────────────────────────
  // Paving, courtyard pool and paths
  box("paving", -6.6, 6.6, 2.35, 2.95, 0, 0.02, 4.0, 0.35, "spread");
  box("paving", -0.35, 0.45, 0.5, 2.35, 0, 0.02, 4.05, 0.3, "spread");
  box("water", 1.1, 4.7, 3.25, 4.15, 0, 0.03, 4.12, 0.35, "spread");
  box("paving", 0.9, 4.9, 3.05, 4.35, 0, 0.015, 4.08, 0.3, "spread");
  // Lawn and planters
  box("green", -6.7, -1.0, 3.2, 4.5, 0, 0.04, 4.1, 0.35, "spread");
  box("green", 5.7, 7.1, -4.4, 2.2, 0, 0.04, 4.12, 0.35, "spread");
  box("green", -7.1, -5.4, -4.4, 2.1, 0, 0.04, 4.14, 0.35, "spread");
  // Terrace planters on block B
  for (let f = 0; f < B.floors - 1; f++) {
    const z = B.z1 - f * B.setback - B.setback + 0.18;
    box("green", B.x0 + 0.15, B.x1 - 0.15, z, z + 0.2, RAFT_TOP + (f + 1) * FLOOR_H, 0.12, 4.2 + f * 0.06, 0.25, "pop");
  }
  // Roof gardens
  box("green", A.x0 + 0.2, -3.6, A.z0 + 0.2, A.z1 - 0.2, RAFT_TOP + A.floors * FLOOR_H, 0.08, 4.35, 0.3, "spread");
  box("green", B.x0 + 0.2, B.x1 - 0.2, B.z0 + 0.2, B.z1 - (B.floors - 1) * B.setback - 0.25, RAFT_TOP + B.floors * FLOOR_H, 0.08, 4.4, 0.3, "spread");
  box("green", L.x0 + 0.1, L.x1 - 0.1, L.z0 + 0.1, L.z1 - 0.1, RAFT_TOP + FLOOR_H, 0.08, 4.42, 0.25, "spread");

  // Trees: trunk + canopy, staggered growth
  const trees: [number, number, number][] = [
    [-6.2, 3.7, 1.0],
    [-4.9, 4.0, 0.8],
    [-3.3, 3.6, 1.1],
    [-6.4, 0.6, 0.9],
    [-6.3, -2.3, 1.15],
    [-6.1, -3.8, 0.85],
    [6.4, 1.3, 1.05],
    [6.2, -0.9, 0.85],
    [6.5, -3.0, 1.2],
    [5.6, 3.9, 0.9],
    [3.2, -3.9, 0.8],
    [-1.6, -3.8, 0.95],
    [0.2, -3.6, 0.75],
  ];
  trees.forEach(([x, z, s], i) => {
    const t = 4.15 + i * 0.045;
    add({ kind: "trunk", x, y: 0, z, w: 0.06, h: 0.55 * s, d: 0.06, t0: t, dur: 0.3, motion: "pop" });
    add({ kind: "canopy", x, y: 0.42 * s, z, w: 0.95 * s, h: 0.85 * s, d: 0.95 * s, t0: t + 0.05, dur: 0.4, motion: "pop" });
  });

  // Scale figures, as on a physical architectural model
  const people: [number, number][] = [
    [-0.1, 1.6],
    [0.3, 2.6],
    [-2.4, 2.65],
    [2.6, 2.8],
    [4.9, 2.6],
    [-5.3, 2.55],
  ];
  people.forEach(([x, z], i) =>
    add({ kind: "figure", x, y: 0, z, w: 0.1, h: 0.3, d: 0.1, t0: 4.6 + i * 0.05, dur: 0.25, motion: "pop" }),
  );

  return parts;
}

export const PARTS: Part[] = buildParts();

export const BUILDING_TOP = RAFT_TOP + A.floors * FLOOR_H + 0.42;

/** Tower crane timing: assembled during groundworks, dismantled before landscaping. */
export const CRANE = { x: 0, z: -2.45, in0: 0.25, in1: 0.75, out0: 3.55, out1: 3.95, height: BUILDING_TOP + 1.6 };

export const STAGE_NAMES = ["Groundworks", "Structure", "Walls & cores", "Facade", "Landscape"] as const;
