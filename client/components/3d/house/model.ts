// Procedural description of a conceptual private house, in metres (y up, the street side faces +z).
// Pure data with no three.js import, so the same parts drive both the WebGL model and the
// server-rendered SVG drawing. Nothing here depicts a real client project.
//
// The house: a two-storey volume under a 38° gable roof (reinforced-concrete frame, masonry
// infill, timber rafters, standing-seam metal sheeting) and a single-storey, larch-clad wing with
// a flat roof. Mineral render over a dark base course, a natural-stone entrance wall, recessed
// aluminium windows with stone sills, Juliet railings on the upper French windows, gutters and
// downpipes, then a raised stone terrace, timber deck, pool, gravel drip strips and planting.
//
// Every part has a reveal window [t0, t0 + dur] on a global build progress p that runs 0 → 8,
// one unit per construction stage (see stages.ts). Parts removed later (setting-out profiles,
// scaffolding) also have an `out` time. The model at any p is a pure function of p, so seeking
// or replaying can never leave it half-built or accumulate state.

export type Mat =
  | "soil" | "trench" | "concrete" | "rebar" | "block" | "render" | "base" | "stoneclad"
  | "rafter" | "roof" | "membrane" | "frame" | "steel" | "glass" | "interior" | "floorIn"
  | "curtain" | "sill" | "door" | "cladding" | "backing" | "scaffold" | "plank" | "line"
  | "deck" | "lawn" | "gravel" | "paving" | "stone" | "water" | "hedge" | "shrub" | "canopy"
  | "trunk" | "lamp" | "fabric";

/** box: unit cube · prism: gable triangle · tube: cylinder · trunk: tapered cylinder · leaf: lumpy foliage mass */
export type Shape = "box" | "prism" | "tube" | "trunk" | "leaf";

/**
 * grow: rises along its local y (eased) · rise: rises at a constant rate, so neighbouring pieces with
 * matching windows read as one level sweeping up (masonry courses) · drop: lowered into place ·
 * pop: scales up from its base · spread: unrolls in plan
 */
export type Motion = "grow" | "rise" | "drop" | "pop" | "spread";

export type Part = {
  mat: Mat;
  shape: Shape;
  /** Centre position and size (box dimensions before rotation). */
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  /** Rotation about x, then z (radians). */
  rx: number; rz: number;
  t0: number; dur: number;
  motion: Motion;
  /** Removal start (reverses the motion over `outDur`). */
  out?: number; outDur?: number;
  /** 0–1 brightness variation for natural materials. */
  tone?: number;
  /** Included in the line drawing used as loading state and WebGL fallback. */
  sketch?: boolean;
  /**
   * Box sides that continue into a coplanar neighbour of the same material, so the renderer does
   * not bevel those edges (2 bits per local axis x, y, z: negative side, positive side).
   * Computed by `markSoftEdges`; non-box shapes are never bevelled.
   */
  soft?: number;
  /**
   * Faces completely covered by same-material neighbours (same bit index as `soft`), with the parts
   * that cover them. The renderer skips such a face while all of those neighbours are fully built.
   */
  coveredBy?: { bit: number; by: Part[] }[];
};

/** Progress value at fraction `f` of construction stage `stage` (1-based). */
const T = (stage: number, f: number) => stage - 1 + f;

// ── Dimensions ────────────────────────────────────────────────────────────────
export const PITCH = (38 * Math.PI) / 180;
const SIN = Math.sin(PITCH);
const COS = Math.cos(PITCH);
const TAN = Math.tan(PITCH);

const WALL = 0.3; // masonry thickness
const SKIN = 0.03; // render / backing thickness
const STONE = 0.04; // natural-stone slips at the entrance
const BASE = 0.045; // dark base course, 1.5 cm proud of the render
const BATTEN = 0.035; // larch batten depth over the backing
// Column section: 2 mm inside the masonry each side. Proud columns poked into the 3 cm render
// skin and bled through it as dashed lines along their edges once the facade was finished.
const COL = 0.296;
const GROUND = 0.04; // finished lawn level
const GRAVEL_TOP = 0.16; // drip strips bury the footing ledge
const FRAME_FACE = -0.08; // window frames sit 8 cm behind the wall face…
const FRAME_BACK = -0.2; // …and are 12 cm deep

export const LV = {
  footing: 0.15, // top of strip footings
  slab: 0.4, // ground-floor level
  baseTop: 0.62, // top of the base course
  f1Under: 3.18, // underside of first-floor slab (also the wing roof slab)
  f1: 3.4, // first-floor level / wing roof level
  ringUnder: 5.85,
  eave: 6.15, // top of the eaves ring beam (wall plate level)
  parapet: 3.75, // wing parapet top
};

export const MAIN = { x0: -7, x1: 1, z0: -5.5, z1: 5.5 };
const CX = (MAIN.x0 + MAIN.x1) / 2;
const HALF = (MAIN.x1 - MAIN.x0) / 2;
export const RIDGE = LV.eave + HALF * TAN;
export const WING = { x0: 1, x1: 7, z0: -5.5, z1: 1.5 };
export const PLINTH = { x0: -12.5, x1: 12.5, z0: -9, z1: 12, h: 0.8 };

const EAVE_OVER = 0.5; // horizontal eaves overhang
const GABLE_OVER = 0.4; // verge overhang beyond the gables
const ROOF_Z0 = MAIN.z0 - GABLE_OVER;
const ROOF_Z1 = MAIN.z1 + GABLE_OVER;

// ── Openings (absolute heights) ───────────────────────────────────────────────
type OpeningKind = "window" | "glazedDoor" | "entrance";
type Opening = { a0: number; a1: number; y0: number; y1: number; kind: OpeningKind };

const GF_DOOR = [LV.slab, 2.9] as const;
const GF_WIN = [1.3, 2.9] as const;
const FF_TALL = [3.5, 5.6] as const;
const FF_WIN = [4.3, 5.6] as const;
/** Guard height of the Juliet railings, which is also the transom of the French windows. */
const RAIL_TOP = LV.f1 + 1.0;

const o = (a0: number, a1: number, [y0, y1]: readonly [number, number], kind: OpeningKind = "window"): Opening => ({ a0, a1, y0, y1, kind });

/** One facade plane. `axis` is the direction the wall runs; `at` is its outer face; `out` the outward sign. */
type Elevation = {
  axis: "x" | "z";
  at: number;
  out: 1 | -1;
  openings: Opening[];
  /** Reveal lining for an opening: the finish material and its depth in front of the wall face. */
  finish: (op: Opening) => { mat: Mat; t: number };
  wing?: boolean;
};

const rendered = () => ({ mat: "render" as Mat, t: SKIN });
const clad = () => ({ mat: "backing" as Mat, t: SKIN + BATTEN });

const FRONT: Elevation = {
  axis: "x", at: MAIN.z1, out: 1, finish: rendered,
  openings: [o(-6.2, -3.4, GF_DOOR, "glazedDoor"), o(-2.6, 0.2, GF_DOOR, "glazedDoor"), o(-6.2, -3.4, FF_TALL), o(-2.6, 0.2, FF_TALL)],
};
const BACK: Elevation = {
  axis: "x", at: MAIN.z0, out: -1, finish: rendered,
  openings: [o(-5.8, -4.2, GF_WIN), o(-1.8, -0.2, GF_WIN), o(-5.8, -4.2, FF_WIN), o(-1.8, -0.2, FF_WIN)],
};
const LEFT: Elevation = {
  axis: "z", at: MAIN.x0, out: -1, finish: rendered,
  openings: [o(-4.2, -2.8, GF_WIN), o(-0.6, 0.6, GF_WIN), o(2.6, 4.0, GF_WIN), o(-4.2, -2.8, FF_WIN), o(-0.6, 0.6, FF_WIN), o(2.6, 4.0, FF_WIN)],
};
const RIGHT: Elevation = {
  axis: "z", at: MAIN.x1, out: 1,
  // The ground floor beside the wing is the entrance wall, faced in natural stone.
  finish: (op) => (op.y0 < LV.f1 ? { mat: "stoneclad", t: STONE } : { mat: "render", t: SKIN }),
  openings: [o(2.3, 3.4, GF_DOOR, "entrance"), o(4.0, 4.9, GF_WIN), o(-4.2, -2.8, FF_WIN), o(-0.6, 0.6, FF_WIN), o(2.6, 4.0, FF_WIN)],
};
const WING_FRONT: Elevation = { axis: "x", at: WING.z1, out: 1, finish: clad, wing: true, openings: [o(1.6, 6.4, GF_DOOR, "glazedDoor")] };
const WING_SIDE: Elevation = { axis: "z", at: WING.x1, out: 1, finish: clad, wing: true, openings: [o(-3.9, -1.1, GF_WIN)] };
const WING_BACK: Elevation = { axis: "x", at: WING.z0, out: -1, finish: clad, wing: true, openings: [o(3.0, 5.4, GF_WIN)] };
const ELEVATIONS: Elevation[] = [FRONT, BACK, LEFT, RIGHT, WING_FRONT, WING_SIDE, WING_BACK];

// ── Part helpers ──────────────────────────────────────────────────────────────
type Extra = Partial<Pick<Part, "rx" | "rz" | "out" | "outDur" | "tone" | "sketch" | "shape">>;
type Range = [number, number];

/** Deterministic 0–1 hash, so the model is identical on every load and in the SVG drawing. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function build(): Part[] {
  const parts: Part[] = [];

  /** Axis-aligned box from extents. */
  const box = (mat: Mat, [x0, x1]: Range, [y0, y1]: Range, [z0, z1]: Range, t0: number, dur: number, motion: Motion, extra: Extra = {}) =>
    parts.push({ mat, shape: "box", x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, w: x1 - x0, h: y1 - y0, d: z1 - z0, rx: 0, rz: 0, t0, dur, motion, ...extra });

  /** Box positioned on a facade: u along the wall, v vertical, n0/n1 offsets outward from the outer face. */
  const onWall = (e: Elevation, mat: Mat, u: Range, v: Range, n0: number, n1: number, t0: number, dur: number, motion: Motion, extra: Extra = {}) => {
    const p0 = e.at + e.out * n0;
    const p1 = e.at + e.out * n1;
    const n: Range = [Math.min(p0, p1), Math.max(p0, p1)];
    if (e.axis === "x") box(mat, u, v, n, t0, dur, motion, extra);
    else box(mat, n, v, u, t0, dur, motion, extra);
  };

  /** A box rotated about z (for roof members, along a slope in the x–y plane). */
  const slopeZ = (mat: Mat, cx: number, cy: number, z0: number, z1: number, len: number, thick: number, rz: number, t0: number, dur: number, motion: Motion, extra: Extra = {}) =>
    parts.push({ mat, shape: "box", x: cx, y: cy, z: (z0 + z1) / 2, w: len, h: thick, d: z1 - z0, rx: 0, rz, t0, dur, motion, ...extra });

  const tube = (mat: Mat, x: number, y: number, z: number, len: number, r: number, rx: number, rz: number, t0: number, dur: number, extra: Extra = {}) =>
    parts.push({ mat, shape: "tube", x, y, z, w: r * 2, h: len, d: r * 2, rx, rz, t0, dur, motion: "grow", ...extra });

  /** A tube between two points in an x–y plane at depth z (pipes, branches). */
  const tubeXY = (mat: Mat, xa: number, ya: number, xb: number, yb: number, z: number, r: number, t0: number, dur: number, extra: Extra = {}) => {
    const len = Math.hypot(xb - xa, yb - ya);
    // Local +y is rotated to point from a to b: (−sin rz, cos rz) ∥ (dx, dy).
    tube(mat, (xa + xb) / 2, (ya + yb) / 2, z, len, r, 0, Math.atan2(-(xb - xa), yb - ya), t0, dur, extra);
  };

  /**
   * Rectangles covering [u0,u1]×[v0,v1] minus the openings that fall inside it, as a grid cut at
   * every opening edge in both directions. Each cell edge is then either a real edge (an opening or
   * the end of the run) or meets a neighbouring cell along its whole length, which is what lets the
   * renderer bevel only the real ones. `lintel` marks a cell directly over an opening. With
   * `columns`, vertically adjacent solid cells are merged (continuous cladding boards).
   */
  const solidRects = (u0: number, u1: number, v0: number, v1: number, openings: Opening[], columns = false) => {
    const inside = openings.filter((op) => op.a1 > u0 && op.a0 < u1 && op.y1 > v0 && op.y0 < v1);
    const cutsOf = (lo: number, hi: number, vals: number[]) =>
      [lo, hi, ...vals].filter((c) => c >= lo && c <= hi).sort((a, b) => a - b).filter((c, i, arr) => i === 0 || c - arr[i - 1] > 1e-3);
    const us = cutsOf(u0, u1, inside.flatMap((op) => [op.a0, op.a1]));
    const vs = cutsOf(v0, v1, inside.flatMap((op) => [op.y0, op.y1]));
    const open = (a: number, b: number, c: number, d: number) =>
      inside.some((op) => op.a0 <= a + 1e-6 && op.a1 >= b - 1e-6 && op.y0 <= c + 1e-6 && op.y1 >= d - 1e-6);
    const out: { u: Range; v: Range; lintel: boolean }[] = [];
    for (let i = 0; i < us.length - 1; i++) {
      const [a, b] = [us[i], us[i + 1]];
      for (let j = 0; j < vs.length - 1; j++) {
        const [c, d] = [vs[j], vs[j + 1]];
        if (open(a, b, c, d)) continue;
        const lintel = j > 0 && open(a, b, vs[j - 1], c);
        const prev = out[out.length - 1];
        if (columns && prev && prev.u[0] === a && Math.abs(prev.v[1] - c) < 1e-6 && !lintel) prev.v = [prev.v[0], d];
        else out.push({ u: [a, b], v: [c, d], lintel });
      }
    }
    return out;
  };

  // ── Stage 1 · Site preparation (0 → 1) ──────────────────────────────────────
  box("soil", [-9.6, 9.2], [0, 0.02], [-7.8, 7.8], T(1, 0.02), 0.3, "spread");
  // Setting-out: timber profiles beyond each corner with string lines along the building lines.
  // They come down once the footings are poured.
  const PROFILE_OUT = { out: T(2, 0.6), outDur: 0.12 };
  const setOut: { axis: "x" | "z"; at: number; a0: number; a1: number }[] = [
    { axis: "x", at: MAIN.z1, a0: MAIN.x0 - 1.5, a1: MAIN.x1 + 1.5 },
    { axis: "x", at: MAIN.z0, a0: MAIN.x0 - 1.5, a1: WING.x1 + 1.5 },
    { axis: "z", at: MAIN.x0, a0: MAIN.z0 - 1.5, a1: MAIN.z1 + 1.5 },
    { axis: "z", at: WING.x1, a0: WING.z0 - 1.5, a1: WING.z1 + 1.5 },
  ];
  setOut.forEach((l, li) => {
    for (const [k, a] of [l.a0, l.a1].entries()) {
      const t = T(1, 0.24 + li * 0.04 + k * 0.02);
      const s = k === 0 ? -1 : 1; // board sits just outside the posts
      for (const side of [-0.45, 0.45]) {
        const [x, z] = l.axis === "x" ? [a, l.at + side] : [l.at + side, a];
        box("plank", [x - 0.03, x + 0.03], [0.02, 0.78], [z - 0.03, z + 0.03], t, 0.12, "grow", { ...PROFILE_OUT, tone: hash(li * 3 + k) });
      }
      const ns: Range = [a + s * 0.03, a + s * 0.055];
      if (l.axis === "x") box("plank", [ns[0], ns[1]].sort((p, q) => p - q) as Range, [0.6, 0.72], [l.at - 0.6, l.at + 0.6], t + 0.06, 0.12, "spread", { ...PROFILE_OUT, tone: 0.4 });
      else box("plank", [l.at - 0.6, l.at + 0.6], [0.6, 0.72], [ns[0], ns[1]].sort((p, q) => p - q) as Range, t + 0.06, 0.12, "spread", { ...PROFILE_OUT, tone: 0.4 });
    }
    const mid = (l.a0 + l.a1) / 2;
    const len = l.a1 - l.a0;
    if (l.axis === "x") tube("line", mid, 0.73, l.at, len, 0.007, 0, Math.PI / 2, T(1, 0.5 + li * 0.04), 0.14, PROFILE_OUT);
    else tube("line", l.at, 0.73, mid, len, 0.007, Math.PI / 2, 0, T(1, 0.5 + li * 0.04), 0.14, PROFILE_OUT);
  });
  // Excavated trenches for the strip footings (a little wider than the concrete).
  const strips: [Range, Range][] = [
    [[MAIN.x0 - 0.2, MAIN.x1 + 0.2], [MAIN.z1 - 0.5, MAIN.z1 + 0.2]],
    [[MAIN.x0 - 0.2, WING.x1 + 0.2], [MAIN.z0 - 0.2, MAIN.z0 + 0.5]],
    [[MAIN.x0 - 0.2, MAIN.x0 + 0.5], [MAIN.z0 - 0.2, MAIN.z1 + 0.2]],
    [[MAIN.x1 - 0.5, MAIN.x1 + 0.2], [MAIN.z0 - 0.2, MAIN.z1 + 0.2]],
    [[WING.x1 - 0.5, WING.x1 + 0.2], [WING.z0 - 0.2, WING.z1 + 0.2]],
    [[MAIN.x1, WING.x1 + 0.2], [WING.z1 - 0.5, WING.z1 + 0.2]],
    [[MAIN.x0, MAIN.x1], [-0.35, 0.35]], // internal bearing line
  ];
  strips.forEach(([xs, zs], i) =>
    box("trench", [xs[0] - 0.12, xs[1] + 0.12], [0, 0.024], [zs[0] - 0.12, zs[1] + 0.12], T(1, 0.55 + i * 0.035), 0.2, "spread"),
  );

  // ── Stage 2 · Foundation (1 → 2) ────────────────────────────────────────────
  strips.forEach(([xs, zs], i) => box("concrete", xs, [0, LV.footing], zs, T(2, 0.04 + i * 0.045), 0.22, "spread"));
  box("concrete", [MAIN.x0, MAIN.x1], [LV.footing, LV.slab], [MAIN.z0, MAIN.z1], T(2, 0.45), 0.22, "spread", { sketch: true });
  box("concrete", [WING.x0, WING.x1], [LV.footing, LV.slab], [WING.z0, WING.z1], T(2, 0.52), 0.2, "spread", { sketch: true });

  // Column grid on the wall centrelines.
  const inX = (x: number) => (x < CX ? MAIN.x0 + 0.15 : MAIN.x1 - 0.15);
  const gfCols: [number, number][] = [
    [inX(MAIN.x0), MAIN.z0 + 0.15], [inX(MAIN.x0), -2], [inX(MAIN.x0), 1.35], [inX(MAIN.x0), MAIN.z1 - 0.15],
    [inX(MAIN.x1), MAIN.z0 + 0.15], [inX(MAIN.x1), -2], [inX(MAIN.x1), 1.35], [inX(MAIN.x1), MAIN.z1 - 0.15],
    [-3, MAIN.z1 - 0.15], [-3, MAIN.z0 + 0.15],
    [WING.x1 - 0.15, WING.z0 + 0.15], [WING.x1 - 0.15, WING.z1 - 0.15],
  ];
  const ffCols = gfCols.slice(0, 10);
  // Starter bars waiting for the columns: four per column.
  gfCols.forEach(([x, z], i) => {
    for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]])
      tube("rebar", x + dx, LV.slab + 0.45, z + dz, 0.9, 0.014, 0, 0, T(2, 0.76 + i * 0.01), 0.12);
  });

  // ── Stage 3 · Structural frame (2 → 3) ──────────────────────────────────────
  const col = (x: number, z: number, y0: number, y1: number, t0: number) =>
    box("concrete", [x - COL / 2, x + COL / 2], [y0, y1], [z - COL / 2, z + COL / 2], t0, 0.18, "grow");
  gfCols.forEach(([x, z], i) => col(x, z, LV.slab, LV.f1Under, T(3, 0.02 + i * 0.018)));
  box("concrete", [MAIN.x0, MAIN.x1], [LV.f1Under, LV.f1], [MAIN.z0, MAIN.z1], T(3, 0.32), 0.2, "drop", { sketch: true });
  box("concrete", [WING.x0, WING.x1], [LV.f1Under, LV.f1], [WING.z0, WING.z1], T(3, 0.38), 0.2, "drop", { sketch: true });
  ffCols.forEach(([x, z], i) => col(x, z, LV.f1, LV.ringUnder, T(3, 0.55 + i * 0.016)));
  // Eaves ring beam: front/back full length, sides between them (no coplanar overlaps).
  box("concrete", [MAIN.x0, MAIN.x1], [LV.ringUnder, LV.eave], [MAIN.z1 - WALL, MAIN.z1], T(3, 0.78), 0.14, "drop");
  box("concrete", [MAIN.x0, MAIN.x1], [LV.ringUnder, LV.eave], [MAIN.z0, MAIN.z0 + WALL], T(3, 0.8), 0.14, "drop");
  box("concrete", [MAIN.x0, MAIN.x0 + WALL], [LV.ringUnder, LV.eave], [MAIN.z0 + WALL, MAIN.z1 - WALL], T(3, 0.82), 0.14, "drop");
  box("concrete", [MAIN.x1 - WALL, MAIN.x1], [LV.ringUnder, LV.eave], [MAIN.z0 + WALL, MAIN.z1 - WALL], T(3, 0.84), 0.14, "drop");

  // ── Stage 4 · Walls (3 → 4) ─────────────────────────────────────────────────
  // Scaffolding first, around the two-storey volume, standing clear of the eaves and verges.
  // Struck once the facade is finished.
  const SC = { out: T(7, 0.84), outDur: 0.14 };
  const IN = 0.85, OUTER = 1.6;
  const runs: { axis: "x" | "z"; at: number; out: 1 | -1; a0: number; a1: number }[] = [
    { axis: "x", at: MAIN.z1, out: 1, a0: MAIN.x0 - OUTER, a1: MAIN.x1 + 0.6 },
    { axis: "z", at: MAIN.x0, out: -1, a0: MAIN.z0 - 1.45, a1: MAIN.z1 + 1.45 },
    { axis: "x", at: MAIN.z0, out: -1, a0: MAIN.x0 - OUTER, a1: MAIN.x1 + 0.6 },
    { axis: "z", at: MAIN.x1, out: 1, a0: WING.z1 + 0.6, a1: MAIN.z1 + 1.45 },
  ];
  const SC_TOP = LV.eave + 1.1;
  const LIFTS = [2.2, 4.2, 6.2];
  runs.forEach((r, ri) => {
    const n = Math.max(2, Math.round((r.a1 - r.a0) / 2.1) + 1);
    const t = T(4, ri * 0.04);
    for (const off of [IN, OUTER]) {
      const p = r.at + r.out * off;
      for (let i = 0; i < n; i++) {
        const a = r.a0 + ((r.a1 - r.a0) * i) / (n - 1);
        const [x, z] = r.axis === "x" ? [a, p] : [p, a];
        tube("scaffold", x, SC_TOP / 2, z, SC_TOP, 0.03, 0, 0, t + i * 0.01, 0.16, SC);
      }
      for (const y of [...LIFTS, SC_TOP - 0.1]) {
        const mid = (r.a0 + r.a1) / 2;
        const len = r.a1 - r.a0;
        if (r.axis === "x") tube("scaffold", mid, y, p, len, 0.025, 0, Math.PI / 2, t + 0.12 + y * 0.01, 0.16, SC);
        else tube("scaffold", p, y, mid, len, 0.025, Math.PI / 2, 0, t + 0.12 + y * 0.01, 0.16, SC);
      }
    }
    // Boards between the two rows at each lift.
    for (const y of LIFTS) {
      const n0 = r.at + r.out * (IN + 0.05);
      const n1 = r.at + r.out * (OUTER - 0.05);
      const ns: Range = [Math.min(n0, n1), Math.max(n0, n1)];
      if (r.axis === "x") box("plank", [r.a0, r.a1], [y + 0.03, y + 0.07], ns, t + 0.22 + y * 0.01, 0.16, "spread", { ...SC, tone: (ri % 3) / 3 });
      else box("plank", ns, [y + 0.03, y + 0.07], [r.a0, r.a1], t + 0.22 + y * 0.01, 0.16, "spread", { ...SC, tone: (ri % 3) / 3 });
    }
    // One diagonal brace per run, on the outer face.
    const span = Math.min(4.2, r.a1 - r.a0);
    const len = Math.hypot(4.2, span);
    const ang = Math.atan2(4.2, span);
    const p = r.at + r.out * OUTER;
    const mid = r.a0 + span / 2;
    if (r.axis === "x") tube("scaffold", mid, 2.2, p, len, 0.022, 0, Math.PI / 2 - ang, t + 0.3, 0.14, SC);
    else tube("scaffold", p, 2.2, mid, len, 0.022, -(Math.PI / 2 - ang), 0, t + 0.3, 0.14, SC);
  });

  // Masonry infill per floor, with every opening formed and a concrete lintel over each one.
  type WallRun = { e: Elevation; u0: number; u1: number; floors: Range[] };
  const walls: WallRun[] = [
    { e: FRONT, u0: MAIN.x0, u1: MAIN.x1, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: BACK, u0: MAIN.x0, u1: MAIN.x1, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: LEFT, u0: MAIN.z0 + WALL, u1: MAIN.z1 - WALL, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: RIGHT, u0: MAIN.z0 + WALL, u1: MAIN.z1 - WALL, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: WING_FRONT, u0: WING.x0, u1: WING.x1, floors: [[LV.slab, LV.f1Under]] },
    { e: WING_BACK, u0: WING.x0, u1: WING.x1, floors: [[LV.slab, LV.f1Under]] },
    { e: WING_SIDE, u0: WING.z0 + WALL, u1: WING.z1 - WALL, floors: [[LV.slab, LV.f1Under]] },
  ];
  // Each storey rises as one level, course by course: every cell's reveal window is the slice of
  // the storey's window that its own height spans, at a constant rate.
  walls.forEach(({ e, u0, u1, floors }, wi) => {
    floors.forEach(([v0, v1], fi) => {
      const start = T(4, 0.16 + fi * 0.3 + wi * 0.012);
      const span = 0.24;
      solidRects(u0, u1, v0, v1, e.openings).forEach(({ u, v, lintel }) => {
        const f0 = (v[0] - v0) / (v1 - v0);
        const f1 = (v[1] - v0) / (v1 - v0);
        onWall(e, lintel ? "concrete" : "block", u, v, -WALL, 0, start + f0 * span, Math.max((f1 - f0) * span, 0.005), "rise");
      });
    });
  });
  // Gable walls up to the roof line.
  for (const [z0, z1, t] of [[MAIN.z1 - WALL, MAIN.z1, T(4, 0.8)], [MAIN.z0, MAIN.z0 + WALL, T(4, 0.83)]] as const)
    parts.push({ mat: "block", shape: "prism", x: CX, y: (LV.eave + RIDGE) / 2, z: (z0 + z1) / 2, w: MAIN.x1 - MAIN.x0, h: RIDGE - LV.eave, d: z1 - z0, rx: 0, rz: 0, t0: t, dur: 0.18, motion: "grow" });
  // Wing parapet upstand.
  box("concrete", [WING.x0, WING.x1], [LV.f1, LV.parapet], [WING.z1 - 0.2, WING.z1], T(4, 0.86), 0.12, "grow");
  box("concrete", [WING.x0, WING.x1], [LV.f1, LV.parapet], [WING.z0, WING.z0 + 0.2], T(4, 0.88), 0.12, "grow");
  box("concrete", [WING.x1 - 0.2, WING.x1], [LV.f1, LV.parapet], [WING.z0 + 0.2, WING.z1 - 0.2], T(4, 0.86), 0.12, "grow");

  // ── Stage 5 · Roof (4 → 5) ──────────────────────────────────────────────────
  const yLeft = (x: number) => LV.eave + (x - MAIN.x0) * TAN;
  const yRight = (x: number) => LV.eave + (MAIN.x1 - x) * TAN;
  const slopeLen = (HALF + EAVE_OVER) / COS;
  const lx = (MAIN.x0 - EAVE_OVER + CX) / 2;
  const rxm = (CX + MAIN.x1 + EAVE_OVER) / 2;
  /** Centre of a member lying `off` metres above the roof line, mid-slope. */
  const onSlope = (side: -1 | 1, off: number): [number, number] =>
    side < 0 ? [lx - SIN * off, yLeft(lx) + COS * off] : [rxm + SIN * off, yRight(rxm) + COS * off];

  box("rafter", [MAIN.x0, MAIN.x0 + 0.16], [LV.eave, LV.eave + 0.14], [MAIN.z0, MAIN.z1], T(5, 0.0), 0.1, "drop"); // wall plates
  box("rafter", [MAIN.x1 - 0.16, MAIN.x1], [LV.eave, LV.eave + 0.14], [MAIN.z0, MAIN.z1], T(5, 0.02), 0.1, "drop");
  // Ridge beam: kept below the rafter tops and just inside the verge trims, so no end grain shows.
  box("rafter", [CX - 0.11, CX + 0.11], [RIDGE - 0.15, RIDGE + 0.2], [ROOF_Z0 + 0.08, ROOF_Z1 - 0.08], T(5, 0.06), 0.14, "drop");
  const nRaft = 15;
  for (let i = 0; i < nRaft; i++) {
    const z = ROOF_Z0 + 0.1 + ((ROOF_Z1 - ROOF_Z0 - 0.2) * i) / (nRaft - 1);
    for (const side of [-1, 1] as const) {
      // Tails stop short of the fascia, boxed in by the soffit (none hang below it).
      const [cx, cy] = onSlope(side, 0.1);
      const tail = 0.2;
      slopeZ("rafter", cx - side * COS * (tail / 2), cy + SIN * (tail / 2), z - 0.04, z + 0.04, slopeLen - tail, 0.2, side < 0 ? PITCH : -PITCH, T(5, 0.14 + i * 0.016 + (side > 0 ? 0.008 : 0)), 0.14, "drop", { tone: hash(i * 2 + side) });
    }
  }
  // Standing-seam sheeting in four bays per slope, then seams, ridge cap, verges, fascias and gutters.
  const bays = 4;
  for (let b = 0; b < bays; b++) {
    const z0 = ROOF_Z0 + ((ROOF_Z1 - ROOF_Z0) * b) / bays;
    const z1 = ROOF_Z0 + ((ROOF_Z1 - ROOF_Z0) * (b + 1)) / bays;
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, 0.225);
      slopeZ("roof", cx, cy, z0, z1, slopeLen + 0.04, 0.05, side < 0 ? PITCH : -PITCH, T(5, 0.52 + b * 0.06 + (side > 0 ? 0.03 : 0)), 0.14, "drop", { sketch: true, tone: 0.42 + 0.16 * hash(b * 5 + side) });
    }
  }
  for (let z = ROOF_Z0 + 0.25; z < ROOF_Z1 - 0.1; z += 0.5) {
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, 0.27);
      slopeZ("roof", cx, cy, z - 0.012, z + 0.012, slopeLen + 0.02, 0.045, side < 0 ? PITCH : -PITCH, T(5, 0.76 + (z - ROOF_Z0) * 0.008), 0.12, "grow", { tone: 0.55 });
    }
  }
  const capY = RIDGE + 0.25 / COS;
  // The cap runs out over the verge trims so it closes their apex joint from above.
  box("roof", [CX - 0.2, CX + 0.2], [capY - 0.04, capY + 0.08], [ROOF_Z0 - 0.05, ROOF_Z1 + 0.05], T(5, 0.88), 0.08, "drop", { tone: 0.5 });
  for (const z of [ROOF_Z0 - 0.02, ROOF_Z1 + 0.02]) {
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, 0.12);
      slopeZ("roof", cx, cy, z - 0.025, z + 0.025, slopeLen + 0.06, 0.32, side < 0 ? PITCH : -PITCH, T(5, 0.9), 0.08, "grow", { sketch: true, tone: 0.5 });
    }
    // Apex block: the two square-cut trims leave a V between their ends where the rafters show.
    box("roof", [CX - 0.15, CX + 0.15], [RIDGE + 0.03, RIDGE + 0.3], [z - 0.025, z + 0.025], T(5, 0.9), 0.08, "grow", { tone: 0.5 });
  }
  const eaveL = MAIN.x0 - EAVE_OVER;
  const eaveR = MAIN.x1 + EAVE_OVER;
  box("roof", [eaveL - 0.04, eaveL], [yLeft(eaveL) - 0.12, yLeft(eaveL) + 0.26], [ROOF_Z0, ROOF_Z1], T(5, 0.92), 0.08, "grow", { sketch: true, tone: 0.5 });
  box("roof", [eaveR, eaveR + 0.04], [yRight(eaveR) - 0.12, yRight(eaveR) + 0.26], [ROOF_Z0, ROOF_Z1], T(5, 0.92), 0.08, "grow", { sketch: true, tone: 0.5 });
  // Half-round gutters hung off the fascia (tube along z).
  const GUTTER_R = 0.075;
  const gY = yLeft(eaveL) - 0.03;
  const gxL = eaveL - 0.04 - GUTTER_R;
  const gxR = eaveR + 0.04 + GUTTER_R;
  for (const gx of [gxL, gxR]) tube("frame", gx, gY, (ROOF_Z0 + ROOF_Z1) / 2, ROOF_Z1 - ROOF_Z0, GUTTER_R, Math.PI / 2, 0, T(5, 0.94), 0.06);
  // Soffits under the eaves overhang.
  box("render", [eaveL, MAIN.x0], [yLeft(eaveL) - 0.02, yLeft(eaveL) + 0.01], [ROOF_Z0, ROOF_Z1], T(5, 0.9), 0.08, "spread");
  box("render", [MAIN.x1, eaveR], [yRight(eaveR) - 0.02, yRight(eaveR) + 0.01], [ROOF_Z0, ROOF_Z1], T(5, 0.9), 0.08, "spread");
  // Verge soffits: the underside of the gable overhangs, lined like the eaves.
  for (const [z0, z1] of [[MAIN.z1 + SKIN, ROOF_Z1], [ROOF_Z0, MAIN.z0 - SKIN]] as const) {
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, -0.0125);
      slopeZ("render", cx, cy, z0, z1, slopeLen, 0.025, side < 0 ? PITCH : -PITCH, T(5, 0.91), 0.08, "grow");
    }
  }
  // Wing flat roof: membrane inside the parapet, metal coping on top.
  box("membrane", [WING.x0, WING.x1 - 0.2], [LV.f1, LV.f1 + 0.03], [WING.z0 + 0.2, WING.z1 - 0.2], T(5, 0.2), 0.22, "spread", { sketch: true });
  box("frame", [WING.x0, WING.x1 + 0.08], [LV.parapet, LV.parapet + 0.05], [WING.z1 - 0.24, WING.z1 + 0.08], T(5, 0.44), 0.08, "spread", { sketch: true });
  box("frame", [WING.x0, WING.x1 + 0.08], [LV.parapet, LV.parapet + 0.05], [WING.z0 - 0.08, WING.z0 + 0.24], T(5, 0.46), 0.08, "spread", { sketch: true });
  box("frame", [WING.x1 - 0.24, WING.x1 + 0.08], [LV.parapet, LV.parapet + 0.05], [WING.z0 + 0.24, WING.z1 - 0.24], T(5, 0.48), 0.08, "spread");

  // ── Stage 6 · Windows & doors (5 → 6) ───────────────────────────────────────
  // Aluminium frames recessed into the reveals, opening sashes, double glazing, stone sills and
  // thresholds. Behind every opening a shallow "room" (floor, ceiling, back wall, curtains) gives
  // the glass real depth instead of a flat dark panel.
  const F = 0.075; // outer frame face width
  let opening = 0;
  ELEVATIONS.forEach((e) => {
    e.openings.forEach((op) => {
      const idx = opening++;
      const t = T(6, 0.06 + (idx % 22) * 0.032);
      const fin = e.finish(op);
      const width = op.a1 - op.a0;
      const fr = (u: Range, v: Range, n0 = FRAME_BACK, n1 = FRAME_FACE, mat: Mat = "frame", tt = t, motion: Motion = "pop") =>
        onWall(e, mat, u, v, n0, n1, tt, 0.12, motion);

      // Interior room box: floor-to-ceiling of the storey the opening belongs to.
      const upper = op.y0 >= LV.f1;
      const [fl, ce] = upper ? [LV.f1, LV.ringUnder] : [LV.slab, LV.f1Under];
      const M = 0.22, DEPTH = 0.75;
      const inner = -WALL, back = -WALL - DEPTH;
      if (op.kind !== "entrance") {
        const tr = T(6, 0.02 + (idx % 22) * 0.01);
        onWall(e, "floorIn", [op.a0 - M, op.a1 + M], [fl, fl + 0.02], back, inner, tr, 0.1, "spread");
        onWall(e, "interior", [op.a0 - M, op.a1 + M], [ce - 0.02, ce], back, inner, tr, 0.1, "spread");
        onWall(e, "interior", [op.a0 - M, op.a1 + M], [fl, ce], back - 0.02, back, tr, 0.1, "spread", { tone: hash(idx) });
        // Linen curtains drawn to the sides, partly behind the wall.
        const cw = Math.min(0.42, width * (0.16 + 0.08 * hash(idx + 7)));
        for (const [u0, u1] of [[op.a0 - 0.18, op.a0 + cw], [op.a1 - cw, op.a1 + 0.18]] as Range[])
          onWall(e, "curtain", [u0, u1], [fl + 0.03, ce - 0.05], inner - 0.17, inner - 0.12, tr + 0.04, 0.1, "grow", { tone: hash(idx + 3) });
      }

      // Outer frame.
      fr([op.a0, op.a1], [op.y1 - F, op.y1]);
      fr([op.a0, op.a1], [op.y0, op.y0 + F]);
      fr([op.a0, op.a0 + F], [op.y0 + F, op.y1 - F]);
      fr([op.a1 - F, op.a1], [op.y0 + F, op.y1 - F]);
      const panes = op.kind === "entrance" ? 1 : Math.max(1, Math.round(width / 1.4));
      const us = Array.from({ length: panes + 1 }, (_, k) => op.a0 + (width * k) / panes);
      for (let k = 1; k < panes; k++) fr([us[k] - F / 2, us[k] + F / 2], [op.y0 + F, op.y1 - F]);
      const french = op.kind === "window" && op.y0 === FF_TALL[0];
      if (french) fr([op.a0 + F, op.a1 - F], [RAIL_TOP - F / 2, RAIL_TOP + F / 2]);

      if (op.kind === "entrance") {
        // Oak entrance door with inlaid grooves and a stainless pull handle.
        const du: Range = [op.a0 + F, op.a1 - F];
        onWall(e, "door", du, [op.y0 + F, op.y1 - F], -0.17, -0.11, t + 0.06, 0.12, "grow", { sketch: true });
        for (const y of [1.15, 1.75, 2.35]) onWall(e, "backing", [du[0] + 0.1, du[1] - 0.1], [y, y + 0.012], -0.11, -0.104, t + 0.1, 0.06, "spread");
        const hu = du[0] + 0.13;
        onWall(e, "steel", [hu - 0.016, hu + 0.016], [0.95, 2.05], -0.075, -0.045, t + 0.12, 0.06, "grow");
        for (const y of [1.08, 1.9]) onWall(e, "steel", [hu - 0.01, hu + 0.01], [y, y + 0.02], -0.11, -0.075, t + 0.12, 0.06, "pop");
      } else {
        // Cells between the frame bars; French windows have a fixed pane below the transom.
        const cells: { u: Range; v: Range; sash: boolean }[] = [];
        for (let k = 0; k < panes; k++) {
          const u: Range = [us[k] + (k === 0 ? F : F / 2), us[k + 1] - (k === panes - 1 ? F : F / 2)];
          if (french) {
            cells.push({ u, v: [op.y0 + F, RAIL_TOP - F / 2], sash: false });
            cells.push({ u, v: [RAIL_TOP + F / 2, op.y1 - F], sash: true });
          } else cells.push({ u, v: [op.y0 + F, op.y1 - F], sash: true });
        }
        const S = op.kind === "glazedDoor" ? 0.075 : 0.05;
        cells.forEach(({ u, v, sash }, ci) => {
          const ts = t + 0.04 + ci * 0.01;
          let gu = u, gv = v;
          if (sash) {
            fr(u, [v[1] - S, v[1]], -0.17, -0.1, "frame", ts);
            fr(u, [v[0], v[0] + S], -0.17, -0.1, "frame", ts);
            fr([u[0], u[0] + S], [v[0] + S, v[1] - S], -0.17, -0.1, "frame", ts);
            fr([u[1] - S, u[1]], [v[0] + S, v[1] - S], -0.17, -0.1, "frame", ts);
            gu = [u[0] + S, u[1] - S];
            gv = [v[0] + S, v[1] - S];
          }
          onWall(e, "glass", gu, gv, -0.142, -0.132, ts + 0.04, 0.1, "grow", { sketch: true });
          // Sliding doors: a slim pull handle on the meeting stile.
          if (op.kind === "glazedDoor" && panes > 1) {
            const hu = ci < panes - 1 ? u[1] - S / 2 : u[0] + S / 2;
            onWall(e, "steel", [hu - 0.012, hu + 0.012], [op.y0 + 0.9, op.y0 + 1.25], -0.1, -0.075, ts + 0.06, 0.06, "grow");
          }
        });
      }

      // Stone sill under windows (projecting past the finish with a drip), threshold under doors.
      if (op.kind === "window") onWall(e, "sill", [op.a0 - 0.05, op.a1 + 0.05], [op.y0 - 0.05, op.y0], FRAME_BACK, fin.t + 0.045, t - 0.02, 0.1, "spread", { tone: hash(idx + 11) });
      else onWall(e, "sill", [op.a0, op.a1], [op.y0 - 0.04, op.y0 + 0.01], FRAME_BACK, fin.t + 0.04, t - 0.02, 0.1, "spread", { tone: hash(idx + 11) });
    });
  });

  // ── Stage 7 · Facade & exterior finishes (6 → 7) ────────────────────────────
  // Dark mineral base course, wrapping the corners and stepping round door openings.
  const baseRuns: { e: Elevation; u: Range; top: number }[] = [
    { e: FRONT, u: [MAIN.x0 - BASE, MAIN.x1 + BASE], top: LV.baseTop },
    { e: BACK, u: [MAIN.x0 - BASE, MAIN.x1], top: LV.baseTop },
    { e: WING_BACK, u: [WING.x0, WING.x1 + BASE], top: LV.slab },
    { e: LEFT, u: [MAIN.z0, MAIN.z1], top: LV.baseTop },
    { e: RIGHT, u: [WING.z1, MAIN.z1], top: LV.baseTop },
    { e: WING_SIDE, u: [WING.z0, WING.z1], top: LV.slab },
  ];
  baseRuns.forEach(({ e, u, top }, bi) =>
    solidRects(u[0], u[1], GROUND, top, e.openings).forEach((r) => onWall(e, "base", r.u, r.v, 0, BASE, T(7, 0.02 + bi * 0.02), 0.14, "grow")),
  );

  // Render over the two-storey volume, wrapping slab edges and the ring beam; stone at the entrance.
  type Skin = { e: Elevation; mat: Mat; t: number; regions: [number, number, number, number][] };
  const skins: Skin[] = [
    { e: FRONT, mat: "render", t: SKIN, regions: [[MAIN.x0 - SKIN, MAIN.x1 + SKIN, LV.baseTop, LV.eave]] },
    { e: BACK, mat: "render", t: SKIN, regions: [[MAIN.x0 - SKIN, MAIN.x1, LV.baseTop, LV.parapet + 0.05], [MAIN.x0 - SKIN, MAIN.x1 + SKIN, LV.parapet + 0.05, LV.eave]] },
    { e: LEFT, mat: "render", t: SKIN, regions: [[MAIN.z0, MAIN.z1, LV.baseTop, LV.eave]] },
    { e: RIGHT, mat: "render", t: SKIN, regions: [[WING.z1, MAIN.z1, LV.f1Under, LV.eave], [MAIN.z0, WING.z1, LV.f1 + 0.03, LV.eave]] },
    { e: RIGHT, mat: "stoneclad", t: STONE, regions: [[WING.z1, MAIN.z1, LV.baseTop, LV.f1Under]] },
  ];
  skins.forEach(({ e, mat, t: th, regions }, ri) =>
    regions.forEach(([u0, u1, v0, v1]) =>
      solidRects(u0, u1, v0, v1, e.openings).forEach((r, k) =>
        onWall(e, mat, r.u, r.v, 0, th, T(7, 0.06 + ri * 0.04 + k * 0.004), 0.2, "grow", { sketch: mat === "render", tone: mat === "stoneclad" ? 0.5 : undefined }),
      ),
    ),
  );
  for (const [z0, z1, t] of [[MAIN.z1, MAIN.z1 + SKIN, T(7, 0.14)], [MAIN.z0 - SKIN, MAIN.z0, T(7, 0.18)]] as const)
    parts.push({ mat: "render", shape: "prism", x: CX, y: (LV.eave + RIDGE + 0.02) / 2, z: (z0 + z1) / 2, w: MAIN.x1 - MAIN.x0 + 2 * SKIN, h: RIDGE + 0.02 - LV.eave, d: z1 - z0, rx: 0, rz: 0, t0: t, dur: 0.18, motion: "grow", sketch: true });

  // Wing: dark backing, then vertical larch battens.
  const wingClad: { e: Elevation; u0: number; u1: number }[] = [
    { e: WING_FRONT, u0: WING.x0, u1: WING.x1 + SKIN + 0.05 },
    { e: WING_SIDE, u0: WING.z0, u1: WING.z1 },
    { e: WING_BACK, u0: WING.x0, u1: WING.x1 + SKIN + 0.05 },
  ];
  let batten = 0;
  wingClad.forEach(({ e, u0, u1 }, ci) => {
    solidRects(u0, u1, LV.slab, LV.parapet, e.openings).forEach(({ u: [a, b], v: [c, d] }) =>
      onWall(e, "backing", [a, b], [c, d], 0, SKIN, T(7, 0.06 + ci * 0.03), 0.16, "grow", { sketch: true }),
    );
    // Battens run the full height of each column between openings.
    solidRects(u0, u1, LV.slab, LV.parapet, e.openings, true).forEach(({ u: [a, b], v: [c, d] }) => {
      for (let u = a + 0.05; u + 0.07 <= b + 1e-6; u += 0.13) {
        const tone = ((batten++ * 7919) % 97) / 97;
        onWall(e, "cladding", [u, u + 0.07], [c, d], SKIN, SKIN + BATTEN, T(7, 0.24 + ci * 0.06 + (u - a) * 0.012), 0.14, "grow", { tone });
      }
    });
  });

  // Reveal linings: the finish returns into every opening up to the frame, so no raw masonry shows.
  ELEVATIONS.forEach((e, ei) => {
    e.openings.forEach((op) => {
      const { mat, t: th } = e.finish(op);
      const tr = T(7, 0.32 + ei * 0.02);
      const tone = mat === "stoneclad" ? 0.5 : undefined;
      onWall(e, mat, [op.a0, op.a0 + th], [op.y0, op.y1 - th], FRAME_FACE, th, tr, 0.1, "grow", { tone });
      onWall(e, mat, [op.a1 - th, op.a1], [op.y0, op.y1 - th], FRAME_FACE, th, tr, 0.1, "grow", { tone });
      onWall(e, mat, [op.a0, op.a1], [op.y1 - th, op.y1], FRAME_FACE, th, tr, 0.1, "grow", { tone });
      // Juliet railings in the upper French windows: flat-bar balusters between two rails.
      if (op.kind === "window" && op.y0 === FF_TALL[0]) {
        const ua = op.a0 + th, ub = op.a1 - th;
        const tj = T(7, 0.58);
        onWall(e, "frame", [ua, ub], [RAIL_TOP - 0.05, RAIL_TOP], -0.068, -0.012, tj, 0.08, "spread");
        onWall(e, "frame", [ua, ub], [LV.f1 + 0.16, LV.f1 + 0.2], -0.05, -0.03, tj, 0.08, "spread");
        const count = Math.round((ub - ua) / 0.11);
        for (let k = 0; k < count; k++) {
          const u = ua + ((ub - ua) * (k + 0.5)) / count;
          onWall(e, "frame", [u - 0.008, u + 0.008], [LV.f1 + 0.2, RAIL_TOP - 0.05], -0.048, -0.032, tj + 0.02 + k * 0.002, 0.08, "grow");
        }
      }
    });
  });

  // Louvred roof-space vents high in both gables.
  for (const e of [FRONT, BACK]) {
    const vy0 = RIDGE - 1.35, vy1 = RIDGE - 0.95;
    const tv = T(7, 0.44);
    onWall(e, "backing", [CX - 0.27, CX + 0.27], [vy0 + 0.03, vy1 - 0.03], SKIN, SKIN + 0.004, tv, 0.08, "grow");
    onWall(e, "frame", [CX - 0.3, CX + 0.3], [vy1 - 0.03, vy1], SKIN, SKIN + 0.03, tv, 0.08, "spread");
    onWall(e, "frame", [CX - 0.3, CX + 0.3], [vy0, vy0 + 0.03], SKIN, SKIN + 0.03, tv, 0.08, "spread");
    onWall(e, "frame", [CX - 0.3, CX - 0.27], [vy0 + 0.03, vy1 - 0.03], SKIN, SKIN + 0.03, tv, 0.08, "grow");
    onWall(e, "frame", [CX + 0.27, CX + 0.3], [vy0 + 0.03, vy1 - 0.03], SKIN, SKIN + 0.03, tv, 0.08, "grow");
    for (let k = 0; k < 4; k++) {
      const y = vy0 + 0.06 + k * 0.08;
      onWall(e, "frame", [CX - 0.27, CX + 0.27], [y, y + 0.03], SKIN + 0.004, SKIN + 0.022, tv + 0.02, 0.08, "spread");
    }
  }

  // Downpipes: outlet, swan neck under the soffit, then down the wall with clamps.
  const pipe = (gx: number, px: number, z: number, bottom: number, t0: number) => {
    const r = 0.05;
    const yo = gY - GUTTER_R - 0.16; // bottom of the outlet
    tube("frame", gx, gY - GUTTER_R - 0.08 + 0.02, z, 0.2, r * 0.9, 0, 0, t0, 0.06);
    const yn = yo - 0.34; // bottom of the swan neck
    tubeXY("frame", px, yn - 0.03, gx, yo + 0.03, z, r * 0.9, t0 + 0.02, 0.06);
    tube("frame", px, (bottom + yn) / 2, z, yn - bottom + 0.02, r, 0, 0, t0 + 0.04, 0.1);
    for (let y = bottom + 1.2; y < yn - 0.4; y += 1.6) box("frame", [px - 0.065, px + 0.065], [y, y + 0.04], [z - 0.065, z + 0.065], t0 + 0.1, 0.04, "pop");
  };
  const pxL = MAIN.x0 - SKIN - 0.07;
  const pxR = MAIN.x1 + STONE + 0.07;
  pipe(gxL, pxL, MAIN.z1 - 0.25, GRAVEL_TOP, T(7, 0.5));
  pipe(gxL, pxL, MAIN.z0 + 0.25, GRAVEL_TOP, T(7, 0.52));
  pipe(gxR, pxR, MAIN.z1 - 0.25, 0.36, T(7, 0.54));
  pipe(gxR, MAIN.x1 + SKIN + 0.07, MAIN.z0 + 0.25, LV.f1 + 0.03, T(7, 0.56)); // discharges onto the wing roof
  // Wing roof: scupper through the parapet into a hopper and downpipe.
  const wx = WING.x1 + SKIN + BATTEN + 0.07;
  const wz = WING.z0 + 0.45;
  box("frame", [WING.x1 - 0.2, wx], [LV.f1 + 0.05, LV.f1 + 0.13], [wz - 0.06, wz + 0.06], T(7, 0.58), 0.06, "spread");
  box("frame", [wx - 0.08, wx + 0.08], [LV.f1 - 0.12, LV.f1 + 0.08], [wz - 0.08, wz + 0.08], T(7, 0.6), 0.06, "pop");
  tube("frame", wx, (GRAVEL_TOP + LV.f1 - 0.12) / 2, wz, LV.f1 - 0.12 - GRAVEL_TOP, 0.05, 0, 0, T(7, 0.62), 0.1);

  // Exterior lights: wall lights by the terrace doors, the entrance and the wing, a canopy downlight.
  const wallLight = (e: Elevation, u: number, y: number, n0: number, t0: number) => {
    onWall(e, "frame", [u - 0.06, u + 0.06], [y, y + 0.26], n0, n0 + 0.09, t0, 0.06, "pop");
    onWall(e, "lamp", [u - 0.05, u + 0.05], [y - 0.015, y], n0 + 0.01, n0 + 0.08, t0 + 0.02, 0.06, "pop");
  };
  wallLight(FRONT, -3, 2.3, SKIN, T(7, 0.66));
  wallLight(RIGHT, 3.68, 2.05, STONE, T(7, 0.68));
  wallLight(WING_FRONT, 6.72, 2.2, SKIN + BATTEN, T(7, 0.7));
  // Entrance canopy goes up after the scaffold is struck.
  box("frame", [MAIN.x1 + STONE, MAIN.x1 + 1.15], [3.0, 3.1], [2.0, 3.7], T(7, 0.9), 0.08, "spread", { sketch: true });
  box("lamp", [1.55, 1.67], [2.99, 3.0], [2.79, 2.91], T(7, 0.94), 0.04, "pop");

  // ── Stage 8 · Landscaping & completed house (7 → 8) ─────────────────────────
  box("lawn", [PLINTH.x0 + 0.25, PLINTH.x1 - 0.25], [0, GROUND], [PLINTH.z0 + 0.25, PLINTH.z1 - 0.25], T(8, 0.0), 0.28, "spread", { sketch: true });
  // Gravel drip strips with steel edging where the walls meet the garden (they bury the footing ledge).
  const gravel: [Range, Range][] = [
    [[MAIN.x0 - 0.55, WING.x1 + 0.55], [MAIN.z0 - 0.55, MAIN.z0]],
    [[MAIN.x0 - 0.55, MAIN.x0], [MAIN.z0, MAIN.z1]],
    [[WING.x1, WING.x1 + 0.55], [WING.z0, WING.z1 + 0.25]],
  ];
  gravel.forEach(([xs, zs], i) => box("gravel", xs, [GROUND, GRAVEL_TOP], zs, T(8, 0.08 + i * 0.03), 0.14, "spread"));
  const edge = (xs: Range, zs: Range, t0: number) => box("frame", xs, [GROUND, GRAVEL_TOP + 0.015], zs, t0, 0.1, "spread");
  edge([MAIN.x0 - 0.56, WING.x1 + 0.56], [MAIN.z0 - 0.56, MAIN.z0 - 0.55], T(8, 0.16));
  edge([MAIN.x0 - 0.56, MAIN.x0 - 0.55], [MAIN.z0 - 0.55, MAIN.z1], T(8, 0.16));
  edge([WING.x1 + 0.55, WING.x1 + 0.56], [MAIN.z0 - 0.55, WING.z1 + 0.25], T(8, 0.16));
  edge([WING.x1, WING.x1 + 0.56], [WING.z1 + 0.25, WING.z1 + 0.26], T(8, 0.16));

  // Raised stone terrace in front of the living room, flush with the door thresholds, with a long step.
  const TZ1 = MAIN.z1 + 2.4;
  box("paving", [MAIN.x0 - 0.3, MAIN.x1 + 0.25], [GROUND, 0.38], [MAIN.z1, TZ1], T(8, 0.12), 0.18, "spread", { sketch: true });
  box("paving", [MAIN.x0 - 0.1, MAIN.x1 - 0.1], [GROUND, 0.21], [TZ1, TZ1 + 0.36], T(8, 0.16), 0.12, "spread", { sketch: true });
  // Concrete planters with shrubs flanking the step.
  for (const px of [MAIN.x0 + 0.1, MAIN.x1 - 0.75]) {
    box("concrete", [px, px + 0.6], [0.38, 0.92], [TZ1 - 0.75, TZ1 - 0.15], T(8, 0.42), 0.1, "grow");
    box("soil", [px + 0.05, px + 0.55], [0.92, 0.93], [TZ1 - 0.7, TZ1 - 0.2], T(8, 0.5), 0.06, "spread");
    parts.push({ mat: "shrub", shape: "leaf", x: px + 0.3, y: 1.18, z: TZ1 - 0.45, w: 0.72, h: 0.62, d: 0.7, rx: 0, rz: 0, t0: T(8, 0.62), dur: 0.14, motion: "pop", tone: hash(px) });
  }
  // Stepping-stone path from the street gate to the deck.
  for (let i = 0; i < 6; i++) {
    const z = PLINTH.z1 - 0.9 - i * 0.92;
    box("stone", [1.5, 2.7], [GROUND, 0.09], [z - 0.32, z + 0.32], T(8, 0.2 + i * 0.02), 0.1, "spread", { sketch: true, tone: hash(i + 40) });
  }
  // Larch deck in front of the wing, aligned with the main facade, on a dark substructure.
  const DZ1 = MAIN.z1;
  box("backing", [WING.x0, WING.x1], [GROUND, 0.3], [WING.z1, DZ1], T(8, 0.18), 0.12, "spread");
  for (let z = WING.z1 + 0.02, i = 0; z + 0.14 <= DZ1 + 1e-6; z += 0.16, i++)
    box("deck", [WING.x0, WING.x1], [0.3, 0.36], [z, z + 0.14], T(8, 0.2 + i * 0.006), 0.12, "spread", { tone: ((i * 37) % 11) / 11, sketch: i === 0 });
  box("deck", [WING.x0, WING.x1], [0.06, 0.355], [DZ1, DZ1 + 0.03], T(8, 0.36), 0.08, "grow", { tone: 0.3 }); // fascia
  box("deck", [1.3, 2.9], [GROUND, 0.2], [DZ1 + 0.03, DZ1 + 0.4], T(8, 0.38), 0.08, "spread", { tone: 0.6 }); // step
  // Pool with stone coping.
  const PX0 = 3.3, PX1 = 7.1, PZ0 = 6.2, PZ1 = 8.6, C = 0.3;
  box("water", [PX0, PX1], [0, 0.075], [PZ0, PZ1], T(8, 0.32), 0.2, "spread", { sketch: true });
  box("stone", [PX0 - C, PX1 + C], [GROUND, 0.13], [PZ0 - C, PZ0], T(8, 0.3), 0.14, "spread", { sketch: true, tone: 0.5 });
  box("stone", [PX0 - C, PX1 + C], [GROUND, 0.13], [PZ1, PZ1 + C], T(8, 0.3), 0.14, "spread", { sketch: true, tone: 0.55 });
  box("stone", [PX0 - C, PX0], [GROUND, 0.13], [PZ0, PZ1], T(8, 0.3), 0.14, "spread", { sketch: true, tone: 0.45 });
  box("stone", [PX1, PX1 + C], [GROUND, 0.13], [PZ0, PZ1], T(8, 0.3), 0.14, "spread", { sketch: true, tone: 0.5 });
  // Two sun loungers on the deck: sled frame, cushion and raised backrest facing the pool.
  for (const x of [3.9, 5.3]) {
    const z0 = 2.9, z1 = 4.9, hinge = z0 + 0.62;
    box("frame", [x, x + 0.7], [0.36, 0.4], [z0, z0 + 0.05], T(8, 0.8), 0.06, "grow");
    box("frame", [x, x + 0.7], [0.36, 0.4], [z1 - 0.05, z1], T(8, 0.8), 0.06, "grow");
    box("frame", [x, x + 0.7], [0.4, 0.46], [z0, z1], T(8, 0.82), 0.08, "spread");
    box("fabric", [x + 0.03, x + 0.67], [0.46, 0.54], [hinge, z1 - 0.02], T(8, 0.86), 0.08, "pop");
    const tilt = 0.9, len = 0.62;
    parts.push({ mat: "fabric", shape: "box", x: x + 0.35, y: 0.5 + (len / 2) * Math.sin(tilt), z: hinge - (len / 2) * Math.cos(tilt), w: 0.64, h: 0.07, d: len, rx: tilt, rz: 0, t0: T(8, 0.88), dur: 0.08, motion: "pop" });
  }
  // Low rendered garden wall with a stone coping along the street, with a gap for the path.
  for (const [x0, x1, t] of [[PLINTH.x0 + 0.3, 1.2, T(8, 0.36)], [3.0, PLINTH.x1 - 0.3, T(8, 0.38)]] as const) {
    box("render", [x0, x1], [GROUND, 0.75], [PLINTH.z1 - 0.55, PLINTH.z1 - 0.35], t, 0.12, "grow", { sketch: true });
    box("sill", [x0 - 0.02, x1 + 0.02], [0.75, 0.8], [PLINTH.z1 - 0.58, PLINTH.z1 - 0.32], t + 0.1, 0.06, "spread", { tone: 0.5 });
  }
  // Path lights beside the stepping stones.
  for (const z of [10.2, 8.4, 6.6]) {
    box("frame", [1.09, 1.21], [GROUND, 0.62], [z - 0.06, z + 0.06], T(8, 0.76), 0.08, "grow");
    box("lamp", [1.087, 1.213], [0.48, 0.54], [z - 0.063, z + 0.063], T(8, 0.8), 0.04, "pop");
  }
  // Clipped hedges on the three garden boundaries.
  box("hedge", [PLINTH.x0 + 0.3, PLINTH.x0 + 1.0], [GROUND, 1.1], [PLINTH.z0 + 0.3, PLINTH.z1 - 1.0], T(8, 0.48), 0.16, "grow", { tone: 0.3, sketch: true });
  box("hedge", [PLINTH.x0 + 0.3, PLINTH.x1 - 0.3], [GROUND, 1.2], [PLINTH.z0 + 0.3, PLINTH.z0 + 1.0], T(8, 0.5), 0.16, "grow", { tone: 0.6, sketch: true });
  box("hedge", [PLINTH.x1 - 1.0, PLINTH.x1 - 0.3], [GROUND, 1.1], [PLINTH.z0 + 1.0, PLINTH.z1 - 1.0], T(8, 0.52), 0.16, "grow", { tone: 0.1, sketch: true });

  // Trees: tapered trunk, two scaffold branches and a canopy of overlapping foliage masses.
  // "broad" is a spreading garden tree, "column" a fastigiate one for the tighter spots.
  type Lobe = [dx: number, y: number, dz: number, w: number, h: number];
  const KINDS: Record<"broad" | "column", { trunk: number; lobes: Lobe[] }> = {
    broad: { trunk: 2.5, lobes: [[0, 3.75, 0, 2.6, 2.1], [0.85, 3.15, 0.3, 1.9, 1.6], [-0.8, 3.25, -0.35, 1.8, 1.6], [0.15, 3.05, -0.9, 1.7, 1.4], [-0.3, 3.0, 0.85, 1.6, 1.4]] },
    column: { trunk: 1.5, lobes: [[0, 2.3, 0, 1.45, 1.9], [0.08, 3.45, 0.05, 1.3, 1.9], [0, 4.5, -0.04, 0.95, 1.4]] },
  };
  const trees: [number, number, number, "broad" | "column"][] = [
    [-10, -6.4, 1.15, "broad"], [-9.8, 1.5, 1.0, "column"], [-10.2, 8.6, 0.9, "broad"], [9.9, -6.6, 1.2, "broad"],
    [10.2, -1.2, 0.95, "column"], [10.1, 8.9, 1.05, "broad"], [-3.5, -7.6, 0.85, "broad"], [9.7, 3.6, 0.85, "column"],
  ];
  trees.forEach(([x, z, s, kind], i) => {
    const t = T(8, 0.52 + i * 0.028);
    const k = KINDS[kind];
    const th = k.trunk * s;
    parts.push({ mat: "trunk", shape: "trunk", x, y: GROUND + th / 2, z, w: 0.28 * s, h: th, d: 0.28 * s, rx: 0, rz: 0, t0: t, dur: 0.12, motion: "grow", tone: hash(i) });
    if (kind === "broad") {
      for (const side of [-1, 1]) tubeXY("trunk", x, GROUND + th - 0.3 * s, x + side * 0.75 * s, GROUND + th + 0.75 * s, z + side * 0.1, 0.06 * s, t + 0.04, 0.1, { tone: hash(i + side) });
    }
    k.lobes.forEach(([dx, y, dz, w, h], li) =>
      parts.push({ mat: "canopy", shape: "leaf", x: x + dx * s, y: GROUND + y * s, z: z + dz * s, w: w * s, h: h * s, d: w * s * (0.9 + 0.2 * hash(i * 9 + li)), rx: 0, rz: 0, t0: t + 0.05 + li * 0.012, dur: 0.16, motion: "pop", tone: hash(i * 5 + li), sketch: li === 0 }),
    );
  });
  // Shrubs: along the inside of the street wall, behind the house and on the side lawn.
  const shrubs: [number, number, number][] = [
    [-10.6, 10.7, 1.0], [-8.4, 10.8, 0.8], [-6.0, 10.7, 0.9], [-3.4, 10.8, 0.75], [-1.0, 10.7, 0.85],
    [4.4, 10.7, 0.8], [6.6, 10.8, 0.95], [8.8, 10.7, 0.8], [10.8, 10.6, 1.0],
    [-5.2, -6.75, 0.8], [-1.6, -6.85, 0.9], [2.4, -6.75, 0.85], [5.2, -6.85, 0.8],
    [-8.35, -3.0, 0.8], [-8.4, 3.6, 0.85], [-8.3, -0.6, 0.65],
  ];
  shrubs.forEach(([x, z, s], i) =>
    parts.push({ mat: "shrub", shape: "leaf", x, y: GROUND + s * 0.3, z, w: s * 1.1, h: s * 0.82, d: s, rx: 0, rz: 0, t0: T(8, 0.64 + i * 0.012), dur: 0.14, motion: "pop", tone: hash(i + 90) }),
  );

  markSoftEdges(parts);
  return parts;
}

/**
 * Finds axis-aligned boxes of the same material that touch face to face (a wall cell and the cell
 * beside it, a frame rail and its stile) and flags those sides as soft, so the shader bevel only
 * rounds edges that are real corners in the finished house. A face that neighbours cover entirely
 * is also flagged hidden: drawn, its outer edge would z-fight with the neighbour's front face and
 * show as a dashed line along the seam. Boxes are bucketed by material and boundary plane, so this
 * stays cheap for a few thousand parts.
 */
function markSoftEdges(parts: Part[]) {
  type Side = { p: Part; axis: number; pos: boolean };
  const buckets = new Map<string, Side[]>();
  const lo = (p: Part, a: number) => [p.x - p.w / 2, p.y - p.h / 2, p.z - p.d / 2][a];
  const hi = (p: Part, a: number) => [p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2][a];
  for (const p of parts) {
    if (p.shape !== "box" || p.rx !== 0 || p.rz !== 0) continue;
    for (let a = 0; a < 3; a++) {
      for (const pos of [false, true]) {
        const key = `${p.mat}|${a}|${Math.round((pos ? hi(p, a) : lo(p, a)) * 1000)}`;
        let list = buckets.get(key);
        if (!list) buckets.set(key, (list = []));
        list.push({ p, axis: a, pos });
      }
    }
  }
  /** Contact area of two boxes across a plane normal to `axis` (0 when they do not overlap). */
  const contact = (a: Part, b: Part, axis: number) => {
    let area = 1;
    for (let k = 0; k < 3; k++) {
      if (k === axis) continue;
      const o = Math.min(hi(a, k), hi(b, k)) - Math.max(lo(a, k), lo(b, k));
      if (o <= 1e-4) return 0;
      area *= o;
    }
    return area;
  };
  const faceArea = (p: Part, axis: number) => [p.h * p.d, p.w * p.d, p.w * p.h][axis];
  const covered = new Map<Part, { area: number; by: Part[] }[]>();
  const cover = (p: Part, bit: number, area: number, by: Part) => {
    let c = covered.get(p);
    if (!c) covered.set(p, (c = Array.from({ length: 6 }, () => ({ area: 0, by: [] }))));
    c[bit].area += area;
    c[bit].by.push(by);
    p.soft = (p.soft ?? 0) | (1 << bit);
  };
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    for (const A of list) {
      if (!A.pos) continue;
      for (const B of list) {
        if (B.pos || B.p === A.p) continue;
        const area = contact(A.p, B.p, A.axis);
        if (area <= 0) continue;
        cover(A.p, 2 * A.axis + 1, area, B.p);
        cover(B.p, 2 * A.axis, area, A.p);
      }
    }
  }
  // Neighbours along one face never overlap each other, so summed contact = covered area.
  for (const [p, c] of covered) {
    c.forEach(({ area, by }, bit) => {
      if (area >= faceArea(p, bit >> 1) * 0.999) (p.coveredBy ??= []).push({ bit, by });
    });
  }
}

export const PARTS: readonly Part[] = build();
