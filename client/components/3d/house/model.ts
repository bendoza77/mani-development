// Procedural description of a conceptual private house, in metres (y up, the street side faces +z).
// Pure data with no three.js import, so the same parts drive both the WebGL model and the
// server-rendered SVG drawing. Nothing here depicts a real client project.
//
// The house: a two-storey volume under a 38° gable roof (reinforced-concrete frame, masonry
// infill, timber rafters, standing-seam metal sheeting) and a single-storey, timber-clad wing
// with a flat roof, set back behind a terrace and pool.
//
// Every part has a reveal window [t0, t0 + dur] on a global build progress p that runs 0 → 6,
// one unit per construction stage. Parts removed later (scaffolding) also have an `out` time.
// The model at any p is a pure function of p, so stage jumps can never leave it half-built.

export type Mat =
  | "soil" | "concrete" | "rebar" | "block" | "render" | "rafter" | "roof" | "membrane"
  | "frame" | "glass" | "sill" | "door" | "cladding" | "backing" | "scaffold" | "plank"
  | "deck" | "lawn" | "paving" | "water" | "hedge" | "canopy" | "trunk";

export type Shape = "box" | "prism" | "tube" | "ico";

/** grow: rises along its local y · drop: lowered into place · pop: scales up from its base · spread: unrolls in plan */
export type Motion = "grow" | "drop" | "pop" | "spread";

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
};

// ── Dimensions ────────────────────────────────────────────────────────────────
export const PITCH = (38 * Math.PI) / 180;
const SIN = Math.sin(PITCH);
const COS = Math.cos(PITCH);
const TAN = Math.tan(PITCH);

const WALL = 0.3; // masonry thickness
const SKIN = 0.03; // render / backing thickness
const COL = 0.32; // column section: 1 cm proud of the masonry each side

export const LV = {
  footing: 0.15, // top of exposed strip footings
  slab: 0.4, // ground-floor level
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

const o = (a0: number, a1: number, [y0, y1]: readonly [number, number], kind: OpeningKind = "window"): Opening => ({ a0, a1, y0, y1, kind });

/** One facade plane. `axis` is the direction the wall runs; `at` is its outer face; `out` the outward sign. */
type Elevation = {
  axis: "x" | "z";
  at: number;
  out: 1 | -1;
  openings: Opening[];
};

const FRONT: Elevation = {
  axis: "x", at: MAIN.z1, out: 1,
  openings: [o(-6.2, -3.4, GF_DOOR, "glazedDoor"), o(-2.6, 0.2, GF_DOOR, "glazedDoor"), o(-6.2, -3.4, FF_TALL), o(-2.6, 0.2, FF_TALL)],
};
const BACK: Elevation = {
  axis: "x", at: MAIN.z0, out: -1,
  openings: [o(-5.8, -4.2, GF_WIN), o(-1.8, -0.2, GF_WIN), o(-5.8, -4.2, FF_WIN), o(-1.8, -0.2, FF_WIN)],
};
const LEFT: Elevation = {
  axis: "z", at: MAIN.x0, out: -1,
  openings: [o(-4.2, -2.8, GF_WIN), o(-0.6, 0.6, GF_WIN), o(2.6, 4.0, GF_WIN), o(-4.2, -2.8, FF_WIN), o(-0.6, 0.6, FF_WIN), o(2.6, 4.0, FF_WIN)],
};
const RIGHT: Elevation = {
  axis: "z", at: MAIN.x1, out: 1,
  openings: [o(2.3, 3.4, GF_DOOR, "entrance"), o(4.0, 4.9, GF_WIN), o(-4.2, -2.8, FF_WIN), o(-0.6, 0.6, FF_WIN), o(2.6, 4.0, FF_WIN)],
};
const WING_FRONT: Elevation = { axis: "x", at: WING.z1, out: 1, openings: [o(1.6, 6.4, GF_DOOR, "glazedDoor")] };
const WING_SIDE: Elevation = { axis: "z", at: WING.x1, out: 1, openings: [o(-3.9, -1.1, GF_WIN)] };
const WING_BACK: Elevation = { axis: "x", at: WING.z0, out: -1, openings: [o(3.0, 5.4, GF_WIN)] };

// ── Part helpers ──────────────────────────────────────────────────────────────
type Extra = Partial<Pick<Part, "rx" | "rz" | "out" | "outDur" | "tone" | "sketch" | "shape">>;

function build(): Part[] {
  const parts: Part[] = [];

  /** Axis-aligned box from extents. */
  const box = (mat: Mat, [x0, x1]: [number, number], [y0, y1]: [number, number], [z0, z1]: [number, number], t0: number, dur: number, motion: Motion, extra: Extra = {}) =>
    parts.push({ mat, shape: "box", x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, w: x1 - x0, h: y1 - y0, d: z1 - z0, rx: 0, rz: 0, t0, dur, motion, ...extra });

  /** Box positioned on a facade: u along the wall, v vertical, n0/n1 offsets outward from the outer face. */
  const onWall = (e: Elevation, mat: Mat, u: [number, number], v: [number, number], n0: number, n1: number, t0: number, dur: number, motion: Motion, extra: Extra = {}) => {
    const p0 = e.at + e.out * n0;
    const p1 = e.at + e.out * n1;
    const n: [number, number] = [Math.min(p0, p1), Math.max(p0, p1)];
    if (e.axis === "x") box(mat, u, v, n, t0, dur, motion, extra);
    else box(mat, n, v, u, t0, dur, motion, extra);
  };

  /** A box rotated about z (for roof members, along a slope in the x–y plane). */
  const slopeZ = (mat: Mat, cx: number, cy: number, z0: number, z1: number, len: number, thick: number, rz: number, t0: number, dur: number, motion: Motion, extra: Extra = {}) =>
    parts.push({ mat, shape: "box", x: cx, y: cy, z: (z0 + z1) / 2, w: len, h: thick, d: z1 - z0, rx: 0, rz, t0, dur, motion, ...extra });

  const tube = (mat: Mat, x: number, y: number, z: number, len: number, r: number, rx: number, rz: number, t0: number, dur: number, extra: Extra = {}) =>
    parts.push({ mat, shape: "tube", x, y, z, w: r * 2, h: len, d: r * 2, rx, rz, t0, dur, motion: "grow", ...extra });

  /**
   * Rectangles covering [u0,u1]×[v0,v1] minus the openings that fall inside it.
   * Each vertical strip between opening edges is either solid, or split above/below one opening.
   */
  const solidRects = (u0: number, u1: number, v0: number, v1: number, openings: Opening[]) => {
    const inside = openings.filter((op) => op.a1 > u0 && op.a0 < u1 && op.y1 > v0 && op.y0 < v1);
    const cuts = [...new Set([u0, u1, ...inside.flatMap((op) => [op.a0, op.a1])])].filter((c) => c >= u0 && c <= u1).sort((a, b) => a - b);
    const out: [number, number, number, number][] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (b - a < 1e-3) continue;
      const op = inside.find((q) => q.a0 <= a + 1e-6 && q.a1 >= b - 1e-6);
      if (!op) out.push([a, b, v0, v1]);
      else {
        if (op.y0 - v0 > 1e-3) out.push([a, b, v0, Math.max(v0, op.y0)]);
        if (v1 - op.y1 > 1e-3) out.push([a, b, Math.min(v1, op.y1), v1]);
      }
    }
    return out;
  };

  // ── Stage 1 · Foundation (0 → 1) ────────────────────────────────────────────
  box("soil", [-9, 8.6], [0, 0.02], [-7, 7.2], 0.02, 0.28, "spread");
  const strips: [[number, number], [number, number]][] = [
    [[MAIN.x0 - 0.2, MAIN.x1 + 0.2], [MAIN.z1 - 0.5, MAIN.z1 + 0.2]],
    [[MAIN.x0 - 0.2, WING.x1 + 0.2], [MAIN.z0 - 0.2, MAIN.z0 + 0.5]],
    [[MAIN.x0 - 0.2, MAIN.x0 + 0.5], [MAIN.z0 - 0.2, MAIN.z1 + 0.2]],
    [[MAIN.x1 - 0.5, MAIN.x1 + 0.2], [MAIN.z0 - 0.2, MAIN.z1 + 0.2]],
    [[WING.x1 - 0.5, WING.x1 + 0.2], [WING.z0 - 0.2, WING.z1 + 0.2]],
    [[MAIN.x1, WING.x1 + 0.2], [WING.z1 - 0.5, WING.z1 + 0.2]],
    [[MAIN.x0, MAIN.x1], [-0.35, 0.35]], // internal bearing line
  ];
  strips.forEach(([xs, zs], i) => box("concrete", xs, [0, LV.footing], zs, 0.2 + i * 0.05, 0.22, "spread"));
  box("concrete", [MAIN.x0, MAIN.x1], [LV.footing, LV.slab], [MAIN.z0, MAIN.z1], 0.58, 0.24, "spread", { sketch: true });
  box("concrete", [WING.x0, WING.x1], [LV.footing, LV.slab], [WING.z0, WING.z1], 0.64, 0.22, "spread", { sketch: true });

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
      tube("rebar", x + dx, LV.slab + 0.45, z + dz, 0.9, 0.014, 0, 0, 0.78 + i * 0.008, 0.12);
  });

  // ── Stage 2 · Structural frame (1 → 2) ──────────────────────────────────────
  const col = (x: number, z: number, y0: number, y1: number, t0: number) =>
    box("concrete", [x - COL / 2, x + COL / 2], [y0, y1], [z - COL / 2, z + COL / 2], t0, 0.18, "grow");
  gfCols.forEach(([x, z], i) => col(x, z, LV.slab, LV.f1Under, 1.02 + i * 0.018));
  box("concrete", [MAIN.x0, MAIN.x1], [LV.f1Under, LV.f1], [MAIN.z0, MAIN.z1], 1.32, 0.2, "drop", { sketch: true });
  box("concrete", [WING.x0, WING.x1], [LV.f1Under, LV.f1], [WING.z0, WING.z1], 1.38, 0.2, "drop", { sketch: true });
  ffCols.forEach(([x, z], i) => col(x, z, LV.f1, LV.ringUnder, 1.55 + i * 0.016));
  // Eaves ring beam: front/back full length, sides between them (no coplanar overlaps).
  box("concrete", [MAIN.x0, MAIN.x1], [LV.ringUnder, LV.eave], [MAIN.z1 - WALL, MAIN.z1], 1.78, 0.14, "drop");
  box("concrete", [MAIN.x0, MAIN.x1], [LV.ringUnder, LV.eave], [MAIN.z0, MAIN.z0 + WALL], 1.8, 0.14, "drop");
  box("concrete", [MAIN.x0, MAIN.x0 + WALL], [LV.ringUnder, LV.eave], [MAIN.z0 + WALL, MAIN.z1 - WALL], 1.82, 0.14, "drop");
  box("concrete", [MAIN.x1 - WALL, MAIN.x1], [LV.ringUnder, LV.eave], [MAIN.z0 + WALL, MAIN.z1 - WALL], 1.84, 0.14, "drop");

  // ── Stage 3 · Walls & envelope (2 → 3) ──────────────────────────────────────
  // Scaffolding first, around the two-storey volume, removed once the facade is finished.
  const SC = { out: 4.78, outDur: 0.18 };
  const runs: { axis: "x" | "z"; at: number; out: 1 | -1; a0: number; a1: number }[] = [
    { axis: "x", at: MAIN.z1, out: 1, a0: MAIN.x0 - 1.15, a1: MAIN.x1 + 0.6 },
    { axis: "z", at: MAIN.x0, out: -1, a0: MAIN.z0 - 1.15, a1: MAIN.z1 + 1.15 },
    { axis: "x", at: MAIN.z0, out: -1, a0: MAIN.x0 - 1.15, a1: MAIN.x1 + 0.6 },
    { axis: "z", at: MAIN.x1, out: 1, a0: WING.z1 + 0.6, a1: MAIN.z1 + 1.15 },
  ];
  const SC_TOP = LV.eave + 1.1;
  const LIFTS = [2.2, 4.2, 6.2];
  runs.forEach((r, ri) => {
    const n = Math.max(2, Math.round((r.a1 - r.a0) / 2.1) + 1);
    const t = 2.0 + ri * 0.04;
    for (const off of [0.35, 1.15]) {
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
      const n0 = r.at + r.out * 0.4;
      const n1 = r.at + r.out * 1.1;
      const ns: [number, number] = [Math.min(n0, n1), Math.max(n0, n1)];
      if (r.axis === "x") box("plank", [r.a0, r.a1], [y + 0.03, y + 0.07], ns, t + 0.22 + y * 0.01, 0.16, "spread", { ...SC, tone: (ri % 3) / 3 });
      else box("plank", ns, [y + 0.03, y + 0.07], [r.a0, r.a1], t + 0.22 + y * 0.01, 0.16, "spread", { ...SC, tone: (ri % 3) / 3 });
    }
    // One diagonal brace per run.
    const len = Math.hypot(4.2, Math.min(4.2, r.a1 - r.a0));
    const ang = Math.atan2(4.2, Math.min(4.2, r.a1 - r.a0));
    const p = r.at + r.out * 1.15;
    const mid = r.a0 + Math.min(4.2, r.a1 - r.a0) / 2;
    if (r.axis === "x") tube("scaffold", mid, 2.1 + 0.1, p, len, 0.022, 0, Math.PI / 2 - ang, t + 0.3, 0.14, SC);
    else tube("scaffold", p, 2.2, mid, len, 0.022, -(Math.PI / 2 - ang), 0, t + 0.3, 0.14, SC);
  });

  // Masonry infill per floor, with every opening formed.
  type WallRun = { e: Elevation; u0: number; u1: number; floors: [number, number][] };
  const walls: WallRun[] = [
    { e: FRONT, u0: MAIN.x0, u1: MAIN.x1, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: BACK, u0: MAIN.x0, u1: MAIN.x1, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: LEFT, u0: MAIN.z0 + WALL, u1: MAIN.z1 - WALL, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: RIGHT, u0: MAIN.z0 + WALL, u1: MAIN.z1 - WALL, floors: [[LV.slab, LV.f1Under], [LV.f1, LV.ringUnder]] },
    { e: WING_FRONT, u0: WING.x0, u1: WING.x1, floors: [[LV.slab, LV.f1Under]] },
    { e: WING_BACK, u0: WING.x0, u1: WING.x1, floors: [[LV.slab, LV.f1Under]] },
    { e: WING_SIDE, u0: WING.z0 + WALL, u1: WING.z1 - WALL, floors: [[LV.slab, LV.f1Under]] },
  ];
  walls.forEach(({ e, u0, u1, floors }, wi) => {
    floors.forEach(([v0, v1], fi) => {
      solidRects(u0, u1, v0, v1, e.openings).forEach(([a, b, c, d], k) =>
        onWall(e, "block", [a, b], [c, d], -WALL, 0, 2.18 + fi * 0.3 + wi * 0.025 + k * 0.008, 0.2, "grow"),
      );
    });
  });
  // Gable walls up to the roof line.
  for (const [z0, z1, t] of [[MAIN.z1 - WALL, MAIN.z1, 2.76], [MAIN.z0, MAIN.z0 + WALL, 2.8]] as const)
    parts.push({ mat: "block", shape: "prism", x: CX, y: (LV.eave + RIDGE) / 2, z: (z0 + z1) / 2, w: MAIN.x1 - MAIN.x0, h: RIDGE - LV.eave, d: z1 - z0, rx: 0, rz: 0, t0: t, dur: 0.18, motion: "grow" });
  // Wing parapet upstand.
  box("concrete", [WING.x0, WING.x1], [LV.f1, LV.parapet], [WING.z1 - 0.2, WING.z1], 2.86, 0.12, "grow");
  box("concrete", [WING.x0, WING.x1], [LV.f1, LV.parapet], [WING.z0, WING.z0 + 0.2], 2.88, 0.12, "grow");
  box("concrete", [WING.x1 - 0.2, WING.x1], [LV.f1, LV.parapet], [WING.z0 + 0.2, WING.z1 - 0.2], 2.86, 0.12, "grow");

  // ── Stage 4 · Roof (3 → 4) ──────────────────────────────────────────────────
  const yLeft = (x: number) => LV.eave + (x - MAIN.x0) * TAN;
  const yRight = (x: number) => LV.eave + (MAIN.x1 - x) * TAN;
  const slopeLen = (HALF + EAVE_OVER) / COS;
  const lx = (MAIN.x0 - EAVE_OVER + CX) / 2;
  const rxm = (CX + MAIN.x1 + EAVE_OVER) / 2;
  /** Centre of a member lying `off` metres above the roof line, mid-slope. */
  const onSlope = (side: -1 | 1, off: number): [number, number] =>
    side < 0 ? [lx - SIN * off, yLeft(lx) + COS * off] : [rxm + SIN * off, yRight(rxm) + COS * off];

  box("rafter", [MAIN.x0, MAIN.x0 + 0.16], [LV.eave, LV.eave + 0.14], [MAIN.z0, MAIN.z1], 3.0, 0.1, "drop"); // wall plates
  box("rafter", [MAIN.x1 - 0.16, MAIN.x1], [LV.eave, LV.eave + 0.14], [MAIN.z0, MAIN.z1], 3.02, 0.1, "drop");
  box("rafter", [CX - 0.11, CX + 0.11], [RIDGE - 0.05, RIDGE + 0.3], [ROOF_Z0 + 0.05, ROOF_Z1 - 0.05], 3.06, 0.14, "drop"); // ridge beam
  const nRaft = 15;
  for (let i = 0; i < nRaft; i++) {
    const z = ROOF_Z0 + 0.1 + ((ROOF_Z1 - ROOF_Z0 - 0.2) * i) / (nRaft - 1);
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, 0.1);
      slopeZ("rafter", cx, cy, z - 0.04, z + 0.04, slopeLen, 0.2, side < 0 ? PITCH : -PITCH, 3.14 + i * 0.016 + (side > 0 ? 0.008 : 0), 0.14, "drop");
    }
  }
  // Standing-seam sheeting in four bays per slope, then seams, ridge cap, verges, fascias and gutters.
  const bays = 4;
  for (let b = 0; b < bays; b++) {
    const z0 = ROOF_Z0 + ((ROOF_Z1 - ROOF_Z0) * b) / bays;
    const z1 = ROOF_Z0 + ((ROOF_Z1 - ROOF_Z0) * (b + 1)) / bays;
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, 0.225);
      slopeZ("roof", cx, cy, z0, z1, slopeLen + 0.04, 0.05, side < 0 ? PITCH : -PITCH, 3.52 + b * 0.06 + (side > 0 ? 0.03 : 0), 0.14, "drop", { sketch: true });
    }
  }
  for (let z = ROOF_Z0 + 0.25; z < ROOF_Z1 - 0.1; z += 0.5) {
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, 0.27);
      slopeZ("roof", cx, cy, z - 0.012, z + 0.012, slopeLen + 0.02, 0.045, side < 0 ? PITCH : -PITCH, 3.76 + (z - ROOF_Z0) * 0.008, 0.12, "grow");
    }
  }
  const capY = RIDGE + 0.25 / COS;
  box("roof", [CX - 0.2, CX + 0.2], [capY - 0.04, capY + 0.08], [ROOF_Z0, ROOF_Z1], 3.88, 0.08, "drop");
  for (const z of [ROOF_Z0 - 0.02, ROOF_Z1 + 0.02]) {
    for (const side of [-1, 1] as const) {
      const [cx, cy] = onSlope(side, 0.12);
      slopeZ("roof", cx, cy, z - 0.025, z + 0.025, slopeLen + 0.06, 0.32, side < 0 ? PITCH : -PITCH, 3.9, 0.08, "grow", { sketch: true });
    }
  }
  const eaveL = MAIN.x0 - EAVE_OVER;
  const eaveR = MAIN.x1 + EAVE_OVER;
  box("roof", [eaveL - 0.04, eaveL], [yLeft(eaveL) - 0.12, yLeft(eaveL) + 0.26], [ROOF_Z0, ROOF_Z1], 3.92, 0.08, "grow", { sketch: true });
  box("roof", [eaveR, eaveR + 0.04], [yRight(eaveR) - 0.12, yRight(eaveR) + 0.26], [ROOF_Z0, ROOF_Z1], 3.92, 0.08, "grow", { sketch: true });
  box("frame", [eaveL - 0.2, eaveL - 0.04], [yLeft(eaveL) - 0.14, yLeft(eaveL) - 0.02], [ROOF_Z0, ROOF_Z1], 3.95, 0.05, "spread");
  box("frame", [eaveR + 0.04, eaveR + 0.2], [yRight(eaveR) - 0.14, yRight(eaveR) - 0.02], [ROOF_Z0, ROOF_Z1], 3.95, 0.05, "spread");
  // Soffits under the eaves overhang.
  box("render", [eaveL, MAIN.x0], [yLeft(eaveL) - 0.02, yLeft(eaveL) + 0.01], [ROOF_Z0, ROOF_Z1], 3.9, 0.08, "spread");
  box("render", [MAIN.x1, eaveR], [yRight(eaveR) - 0.02, yRight(eaveR) + 0.01], [ROOF_Z0, ROOF_Z1], 3.9, 0.08, "spread");
  // Wing flat roof: membrane inside the parapet, metal coping on top.
  box("membrane", [WING.x0, WING.x1 - 0.2], [LV.f1, LV.f1 + 0.03], [WING.z0 + 0.2, WING.z1 - 0.2], 3.2, 0.22, "spread", { sketch: true });
  box("frame", [WING.x0, WING.x1 + 0.06], [LV.parapet, LV.parapet + 0.05], [WING.z1 - 0.24, WING.z1 + 0.06], 3.44, 0.08, "spread", { sketch: true });
  box("frame", [WING.x0, WING.x1 + 0.06], [LV.parapet, LV.parapet + 0.05], [WING.z0 - 0.06, WING.z0 + 0.24], 3.46, 0.08, "spread", { sketch: true });
  box("frame", [WING.x1 - 0.24, WING.x1 + 0.06], [LV.parapet, LV.parapet + 0.05], [WING.z0 + 0.24, WING.z1 - 0.24], 3.48, 0.08, "spread");

  // ── Stage 5 · Windows, doors & facade (4 → 5) ───────────────────────────────
  // Render over the whole two-storey volume, wrapping slab edges and the ring beam.
  const renderRuns: { e: Elevation; regions: [number, number, number, number][] }[] = [
    { e: FRONT, regions: [[MAIN.x0 - SKIN, MAIN.x1 + SKIN, LV.slab, LV.eave]] },
    { e: BACK, regions: [[MAIN.x0 - SKIN, MAIN.x1 + SKIN, LV.slab, LV.eave]] },
    { e: LEFT, regions: [[MAIN.z0, MAIN.z1, LV.slab, LV.eave]] },
    { e: RIGHT, regions: [[WING.z1, MAIN.z1, LV.slab, LV.f1], [MAIN.z0, MAIN.z1, LV.f1 + 0.03, LV.eave]] },
  ];
  renderRuns.forEach(({ e, regions }, ri) =>
    regions.forEach(([u0, u1, v0, v1]) =>
      solidRects(u0, u1, v0, v1, e.openings).forEach(([a, b, c, d], k) =>
        onWall(e, "render", [a, b], [c, d], 0, SKIN, 4.02 + ri * 0.04 + k * 0.006, 0.2, "grow", { sketch: true }),
      ),
    ),
  );
  for (const [z0, z1, t] of [[MAIN.z1, MAIN.z1 + SKIN, 4.12], [MAIN.z0 - SKIN, MAIN.z0, 4.16]] as const)
    parts.push({ mat: "render", shape: "prism", x: CX, y: (LV.eave + RIDGE + 0.02) / 2, z: (z0 + z1) / 2, w: MAIN.x1 - MAIN.x0 + 2 * SKIN, h: RIDGE + 0.02 - LV.eave, d: z1 - z0, rx: 0, rz: 0, t0: t, dur: 0.18, motion: "grow", sketch: true });

  // Wing: dark backing, then vertical timber battens.
  const wingClad: { e: Elevation; u0: number; u1: number }[] = [
    { e: WING_FRONT, u0: WING.x0, u1: WING.x1 + SKIN + 0.05 },
    { e: WING_SIDE, u0: WING.z0, u1: WING.z1 },
    { e: WING_BACK, u0: WING.x0, u1: WING.x1 + SKIN + 0.05 },
  ];
  let batten = 0;
  wingClad.forEach(({ e, u0, u1 }, ci) => {
    solidRects(u0, u1, LV.slab, LV.parapet, e.openings).forEach(([a, b, c, d]) => {
      onWall(e, "backing", [a, b], [c, d], 0, SKIN, 4.04 + ci * 0.03, 0.16, "grow", { sketch: true });
      for (let u = a + 0.05; u + 0.07 <= b + 1e-6; u += 0.13) {
        const tone = ((batten++ * 7919) % 97) / 97;
        onWall(e, "cladding", [u, u + 0.07], [c, d], SKIN, SKIN + 0.035, 4.22 + ci * 0.06 + (u - a) * 0.012, 0.14, "grow", { tone });
      }
    });
  });

  // Windows and doors: recessed anthracite frames with glazing, sills under windows.
  const allOpenings: Elevation[] = [FRONT, BACK, LEFT, RIGHT, WING_FRONT, WING_SIDE, WING_BACK];
  let opening = 0;
  allOpenings.forEach((e) => {
    e.openings.forEach((op) => {
      const t = 4.36 + (opening++ % 18) * 0.014;
      const F = 0.06; // frame bar
      const n0 = -0.2, n1 = -0.08; // recessed into the reveal
      const f = (u: [number, number], v: [number, number]) => onWall(e, "frame", u, v, n0, n1, t, 0.14, "pop");
      f([op.a0, op.a1], [op.y1 - F, op.y1]);
      f([op.a0, op.a1], [op.y0, op.y0 + F]);
      f([op.a0, op.a0 + F], [op.y0 + F, op.y1 - F]);
      f([op.a1 - F, op.a1], [op.y0 + F, op.y1 - F]);
      const width = op.a1 - op.a0;
      const panes = op.kind === "entrance" ? 1 : Math.max(1, Math.round(width / 1.6));
      for (let k = 1; k < panes; k++) {
        const u = op.a0 + (width * k) / panes;
        f([u - F / 2, u + F / 2], [op.y0 + F, op.y1 - F]);
      }
      if (op.kind === "entrance") {
        onWall(e, "door", [op.a0 + F, op.a1 - F], [op.y0 + F, op.y1 - F], -0.16, -0.12, t + 0.1, 0.12, "grow", { sketch: true });
      } else {
        onWall(e, "glass", [op.a0 + F, op.a1 - F], [op.y0 + F, op.y1 - F], -0.15, -0.13, t + 0.08, 0.14, "grow", { sketch: true });
      }
      if (op.kind === "window") onWall(e, "sill", [op.a0 - 0.05, op.a1 + 0.05], [op.y0 - 0.05, op.y0], -0.2, 0.08, t + 0.04, 0.1, "spread");
    });
  });
  // Entrance canopy and downpipes.
  box("frame", [MAIN.x1, MAIN.x1 + 1.1], [3.0, 3.1], [2.0, 3.7], 4.66, 0.1, "spread", { sketch: true });
  // Downpipes fixed to the wall at the corners, rising to the gutter line under the eaves.
  const pipeTop = yLeft(eaveL) - 0.1;
  for (const [x, z] of [[MAIN.x0 - SKIN - 0.07, MAIN.z1 - 0.25], [MAIN.x0 - SKIN - 0.07, MAIN.z0 + 0.25], [MAIN.x1 + SKIN + 0.07, MAIN.z1 - 0.25]] as const)
    tube("frame", x, (0.05 + pipeTop) / 2, z, pipeTop - 0.05, 0.05, 0, 0, 4.72, 0.1);

  // ── Stage 6 · Completed house (5 → 6) ───────────────────────────────────────
  box("lawn", [PLINTH.x0 + 0.25, PLINTH.x1 - 0.25], [0, 0.04], [PLINTH.z0 + 0.25, PLINTH.z1 - 0.25], 5.0, 0.3, "spread", { sketch: true });
  // Stone terrace in front of the living room, and a stepping-stone path to the entrance terrace.
  box("paving", [MAIN.x0 - 0.3, MAIN.x1], [0.04, 0.1], [MAIN.z1, MAIN.z1 + 2.2], 5.1, 0.18, "spread", { sketch: true });
  for (let i = 0; i < 7; i++) {
    const z = PLINTH.z1 - 0.9 - i * 0.92;
    box("paving", [1.5, 2.7], [0.04, 0.09], [z - 0.32, z + 0.32], 5.12 + i * 0.02, 0.12, "spread", { sketch: true });
  }
  // Timber terrace in front of the wing.
  box("backing", [WING.x0, WING.x1], [0.04, 0.3], [WING.z1, WING.z1 + 3.6], 5.18, 0.12, "spread");
  for (let z = WING.z1 + 0.02, i = 0; z + 0.14 <= WING.z1 + 3.6 + 1e-6; z += 0.16, i++)
    box("deck", [WING.x0, WING.x1], [0.3, 0.36], [z, z + 0.14], 5.2 + i * 0.008, 0.12, "spread", { tone: ((i * 37) % 11) / 11, sketch: i === 0 });
  // Pool with stone coping.
  const PX0 = 2.0, PX1 = 6.6, PZ0 = 6.1, PZ1 = 8.5, C = 0.3;
  box("water", [PX0, PX1], [0, 0.07], [PZ0, PZ1], 5.32, 0.2, "spread", { sketch: true });
  box("paving", [PX0 - C, PX1 + C], [0.04, 0.13], [PZ0 - C, PZ0], 5.3, 0.14, "spread", { sketch: true });
  box("paving", [PX0 - C, PX1 + C], [0.04, 0.13], [PZ1, PZ1 + C], 5.3, 0.14, "spread", { sketch: true });
  box("paving", [PX0 - C, PX0], [0.04, 0.13], [PZ0, PZ1], 5.3, 0.14, "spread", { sketch: true });
  box("paving", [PX1, PX1 + C], [0.04, 0.13], [PZ0, PZ1], 5.3, 0.14, "spread", { sketch: true });
  // Sun loungers.
  for (const x of [4.2, 5.4]) box("render", [x, x + 0.7], [0.36, 0.5], [WING.z1 + 1.6, WING.z1 + 3.4], 5.78, 0.1, "pop");
  // Low rendered garden wall along the street, with a gap for the path; hedges on the other sides.
  box("render", [PLINTH.x0 + 0.3, 1.2], [0.04, 0.75], [PLINTH.z1 - 0.55, PLINTH.z1 - 0.35], 5.36, 0.14, "grow", { sketch: true });
  box("render", [3.0, PLINTH.x1 - 0.3], [0.04, 0.75], [PLINTH.z1 - 0.55, PLINTH.z1 - 0.35], 5.38, 0.14, "grow", { sketch: true });
  box("hedge", [PLINTH.x0 + 0.3, PLINTH.x0 + 1.0], [0.04, 1.1], [PLINTH.z0 + 0.3, PLINTH.z1 - 1.0], 5.5, 0.16, "grow", { tone: 0.3, sketch: true });
  box("hedge", [PLINTH.x0 + 0.3, PLINTH.x1 - 0.3], [0.04, 1.2], [PLINTH.z0 + 0.3, PLINTH.z0 + 1.0], 5.52, 0.16, "grow", { tone: 0.6, sketch: true });
  box("hedge", [PLINTH.x1 - 1.0, PLINTH.x1 - 0.3], [0.04, 1.1], [PLINTH.z0 + 1.0, PLINTH.z1 - 1.0], 5.54, 0.16, "grow", { tone: 0.1, sketch: true });
  // Trees: trunk, then a faceted canopy.
  const trees: [number, number, number][] = [
    [-10, -6.4, 1.15], [-9.8, 1.5, 1.0], [-10.2, 8.6, 0.9], [9.9, -6.6, 1.2], [10.2, -1.2, 0.95], [10.1, 8.9, 1.05], [-3.5, -7.6, 0.85],
  ];
  trees.forEach(([x, z, s], i) => {
    const t = 5.54 + i * 0.03;
    parts.push({ mat: "trunk", shape: "tube", x, y: 1.0 * s, z, w: 0.22 * s, h: 2.0 * s, d: 0.22 * s, rx: 0, rz: 0, t0: t, dur: 0.16, motion: "grow" });
    parts.push({ mat: "canopy", shape: "ico", x, y: 3.1 * s, z, w: 3.0 * s, h: 3.4 * s, d: 3.0 * s, rx: 0, rz: 0, t0: t + 0.06, dur: 0.2, motion: "pop", tone: (i % 5) / 5, sketch: true });
  });

  return parts;
}

export const PARTS: readonly Part[] = build();
