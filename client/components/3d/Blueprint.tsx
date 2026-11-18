import { PARTS, PLINTH } from "./buildingModel";

// Server-rendered axonometric line drawing of the maquette, projected from the same
// data as the WebGL model and the hero camera pose. It doubles as the loading state
// and as the permanent fallback when WebGL is unavailable.
const AZ = 0.68;
const EL = 0.42;
const TARGET = { x: 0.2, y: 1.7, z: 0 };
const VIEW_H = 2 * 37 * Math.tan((12 * Math.PI) / 180);

function project(x: number, y: number, z: number): [number, number] {
  const sx = (x - TARGET.x) * Math.cos(AZ) - (z - TARGET.z) * Math.sin(AZ);
  const depth = (x - TARGET.x) * Math.sin(AZ) + (z - TARGET.z) * Math.cos(AZ);
  const sy = (y - TARGET.y) * Math.cos(EL) - depth * Math.sin(EL);
  return [+sx.toFixed(3), +(-sy).toFixed(3)];
}

function rect(x: number, z: number, w: number, d: number, y: number) {
  const pts = [
    project(x - w / 2, y, z - d / 2),
    project(x + w / 2, y, z - d / 2),
    project(x + w / 2, y, z + d / 2),
    project(x - w / 2, y, z + d / 2),
  ];
  return pts.map((p) => p.join(",")).join(" ");
}

const slabs = PARTS.filter((p) => p.kind === "white" && p.motion === "drop");
const columns = PARTS.filter((p) => p.kind === "concrete" && p.motion === "grow" && p.w < 0.2 && p.h > 0.3);
const fins = PARTS.filter((p) => p.kind === "timber");
const trees = PARTS.filter((p) => p.kind === "canopy");

const plinthTop = rect(0, 0, PLINTH.w, PLINTH.d, 0);
const plinthEdges = [
  [PLINTH.w / 2, PLINTH.d / 2],
  [-PLINTH.w / 2, PLINTH.d / 2],
  [PLINTH.w / 2, -PLINTH.d / 2],
].map(([x, z]) => [project(x, 0, z), project(x, -PLINTH.h, z)]);

export function Blueprint({ className, label = true }: { className?: string; label?: boolean }) {
  const w = VIEW_H * 2.4;
  return (
    <svg
      viewBox={`${-w / 2} ${-VIEW_H / 2} ${w} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      role="img"
      aria-label="Axonometric drawing of a residential building on a landscaped plinth"
    >
      <g strokeWidth={0.022} opacity={0.55}>
        <polygon points={plinthTop} />
        {plinthEdges.map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        ))}
        <polygon points={rect(0, 0, PLINTH.w, PLINTH.d, -PLINTH.h)} opacity={0.5} />
      </g>
      <g strokeWidth={0.012} opacity={0.35}>
        {columns.map((c, i) => {
          const [x1, y1] = project(c.x, c.y, c.z);
          const [x2, y2] = project(c.x, c.y + c.h, c.z);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <g strokeWidth={0.02} opacity={0.75}>
        {slabs.map((s, i) => (
          <polygon key={i} points={rect(s.x, s.z, s.w, s.d, s.y + s.h)} />
        ))}
      </g>
      <g strokeWidth={0.012} opacity={0.45}>
        {fins.map((f, i) => {
          const [x1, y1] = project(f.x, f.y, f.z + f.d / 2);
          const [x2, y2] = project(f.x, f.y + f.h, f.z + f.d / 2);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <g strokeWidth={0.016} opacity={0.4}>
        {trees.map((t, i) => {
          const [cx, cy] = project(t.x, t.y + t.h / 2, t.z);
          return <circle key={i} cx={cx} cy={cy} r={t.w / 2} />;
        })}
      </g>
      {label && (
        <g stroke="none" fill="currentColor" opacity={0.55} fontFamily="var(--font-mono)" fontSize={0.2} letterSpacing={0.03}>
          <text x={project(-PLINTH.w / 2, -PLINTH.h, PLINTH.d / 2)[0] - 0.2} y={project(-PLINTH.w / 2, -PLINTH.h, PLINTH.d / 2)[1] + 0.55}>
            AXONOMETRIC · 1:200 · DRAWING 04/A
          </text>
        </g>
      )}
    </svg>
  );
}
