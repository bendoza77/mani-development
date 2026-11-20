import { PARTS, type Part } from "./model";
import { HOUSE_STAGES, STAGE_COUNT } from "./stages";

// Axonometric line drawing of the completed house, projected from the same
// part list as the WebGL model and its final camera angle. Painter-sorted filled outlines give
// hidden-line removal without any 3D library. It is the loading state and the no-WebGL fallback.

const [AZ, EL] = HOUSE_STAGES[STAGE_COUNT - 1].pose;
const right = [Math.cos(AZ), 0, -Math.sin(AZ)];
const up = [-Math.sin(AZ) * Math.sin(EL), Math.cos(EL), -Math.cos(AZ) * Math.sin(EL)];
const toward = [Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rotate a local point by rx then rz (matching the model's XYZ Euler with y = 0). */
function rotate([x, y, z]: number[], rx: number, rz: number) {
  const y1 = y * Math.cos(rx) - z * Math.sin(rx);
  const z1 = y * Math.sin(rx) + z * Math.cos(rx);
  return [x * Math.cos(rz) - y1 * Math.sin(rz), x * Math.sin(rz) + y1 * Math.cos(rz), z1];
}

function corners(p: Part) {
  const pts: number[][] =
    p.shape === "prism"
      ? [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]].flatMap(([x, y]) => [[x, y, -0.5], [x, y, 0.5]])
      : [-0.5, 0.5].flatMap((x) => [-0.5, 0.5].flatMap((y) => [-0.5, 0.5].map((z) => [x, y, z])));
  return pts.map(([x, y, z]) => {
    const r = rotate([x * p.w, y * p.h, z * p.d], p.rx, p.rz);
    return [r[0] + p.x, r[1] + p.y, r[2] + p.z];
  });
}

/** Andrew's monotone chain convex hull. */
function hull(points: [number, number][]) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type Shape2D = { depth: number; kind: "poly" | "circle"; d: string; cx?: number; cy?: number; r?: number; tint: "glass" | "roof" | "green" | "plain" };

const TINT: Partial<Record<Part["mat"], Shape2D["tint"]>> = {
  glass: "glass", water: "glass", roof: "roof", membrane: "roof", backing: "roof", door: "roof",
  lawn: "green", hedge: "green", canopy: "green",
};

const SHAPES: Shape2D[] = PARTS.filter((p) => p.sketch && p.out === undefined).map((p): Shape2D => {
  const depth = dot([p.x, p.y, p.z], toward);
  const tint = TINT[p.mat] ?? "plain";
  if (p.shape === "ico") {
    const c = [p.x, p.y, p.z];
    return { depth, kind: "circle", d: "", cx: r2(dot(c, right)), cy: r2(-dot(c, up)), r: r2(p.w / 2), tint };
  }
  const pts = hull(corners(p).map((c) => [dot(c, right), -dot(c, up)] as [number, number]));
  return { depth, kind: "poly", d: pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" "), tint };
}).sort((a, b) => a.depth - b.depth);

const BOUNDS = (() => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of PARTS) {
    if (!p.sketch) continue;
    for (const c of corners(p)) {
      const x = dot(c, right), y = -dot(c, up);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const pad = 1.2;
  return `${r2(x0 - pad)} ${r2(y0 - pad)} ${r2(x1 - x0 + 2 * pad)} ${r2(y1 - y0 + 2 * pad)}`;
})();

// Fills are opaque (mixed against the background) so nearer shapes hide the lines behind them.
const BG = "var(--drawing-bg, var(--night))";
const FILL: Record<Shape2D["tint"], string> = {
  plain: BG,
  glass: `color-mix(in srgb, currentColor 22%, ${BG})`,
  roof: `color-mix(in srgb, currentColor 32%, ${BG})`,
  green: `color-mix(in srgb, currentColor 8%, ${BG})`,
};

/** Line drawing of the completed conceptual house. Inherits its stroke colour from `color`. */
export function HouseDrawing({ className, label }: { className?: string; label: string }) {
  return (
    <svg
      viewBox={BOUNDS}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label={label}
    >
      <g stroke="currentColor" strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {SHAPES.map((s, i) => {
          const common = { vectorEffect: "non-scaling-stroke" as const, strokeOpacity: 0.7, style: { fill: FILL[s.tint] } };
          return s.kind === "circle" ? (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />
          ) : (
            <polygon key={i} points={s.d} {...common} />
          );
        })}
      </g>
    </svg>
  );
}
