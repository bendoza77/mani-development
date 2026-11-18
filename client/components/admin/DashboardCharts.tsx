"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { label: string; value: number };

// Single-series magnitude charts: one validated hue (var(--accent), ≥3:1 on both card surfaces),
// direct value labels, recessive axes, no grid, no legend (the panel title names the series).
const axisTick = { fill: "var(--muted)", fontSize: 12, fontFamily: "var(--font-sans)" };

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Datum }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-[3px] border border-line bg-card px-3 py-2 text-[0.8rem] shadow-card">
      <p className="text-muted">{d.label}</p>
      <p className="font-medium text-ink tabular-nums">
        {d.value} {unit}
      </p>
    </div>
  );
}

function DataTable({ data, caption, unit }: { data: Datum[]; caption: string; unit: string }) {
  return (
    <details className="mt-2 text-[0.8rem]">
      <summary className="cursor-pointer text-muted hover:text-ink">View as table</summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" className="py-1 font-medium">Category</th>
            <th scope="col" className="py-1 text-right font-medium">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label} className="border-t border-line">
              <td className="py-1">{d.label}</td>
              <td className="py-1 text-right tabular-nums">{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function StatusChart({ data }: { data: Datum[] }) {
  return (
    <div>
      <div className="h-52" role="img" aria-label={`Projects by status: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={128} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--paper-2)" }} content={<ChartTooltip unit="projects" />} />
            <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 500 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} caption="Projects by status" unit="Projects" />
    </div>
  );
}

export function InquiriesChart({ data }: { data: Datum[] }) {
  return (
    <div>
      <div className="h-52" role="img" aria-label={`Inquiries per month: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
            <YAxis hide allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--paper-2)" }} content={<ChartTooltip unit="inquiries" />} />
            <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              <LabelList dataKey="value" position="top" style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 500 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} caption="Inquiries per month" unit="Inquiries" />
    </div>
  );
}
