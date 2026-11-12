// Charts for the Model Manager. Hand-rolled SVG rather than a charting dependency:
// the data is a few dozen points, and these need to be theme-aware and clickable
// without a wrapper library's opinions. Every value is also present in the table
// below, so a chart is a second view, never the only access to the data.

import { FIT_COLOR, type FitLevel } from "@/lib/model-manager";
import { cn } from "@/lib/utils";

const PAD = { left: 46, right: 14, top: 12, bottom: 30 };
const WIDTH = 640;
const HEIGHT = 260;

export interface ScatterPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  level: FitLevel;
  detail: string;
}

function ticks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

export function ModelScatter({
  points,
  xLabel,
  yLabel,
  xFormat = (n) => String(Math.round(n)),
  yFormat = (n) => String(Math.round(n)),
  logX = false,
  selectedId,
  onSelect,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFormat?: (n: number) => string;
  yFormat?: (n: number) => string;
  logX?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No models match these filters.
      </p>
    );
  }

  const tx = (value: number) => (logX ? Math.log10(Math.max(value, 0.1)) : value);
  const xs = points.map((p) => tx(p.x));
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xPad = (xMax - xMin || 1) * 0.06;
  const yPad = (yMax - yMin || 1) * 0.12;
  const xScale = (value: number) =>
    PAD.left + ((tx(value) - (xMin - xPad)) / (xMax - xMin + xPad * 2 || 1)) * plotW;
  const yScale = (value: number) =>
    PAD.top + plotH - ((value - (yMin - yPad)) / (yMax - yMin + yPad * 2 || 1)) * plotH;

  const xTicks = ticks(xMin, xMax, 4);
  const yTicks = ticks(yMin, yMax, 4);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${yLabel} by ${xLabel} for each model`}
      className="h-auto w-full select-none"
    >
      {yTicks.map((tick) => {
        const y =
          PAD.top + plotH - ((tick - (yMin - yPad)) / (yMax - yMin + yPad * 2 || 1)) * plotH;
        return (
          <g key={`y-${tick}`}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-border/50"
              strokeDasharray="2 4"
            />
            <text
              x={PAD.left - 8}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[9px]"
            >
              {yFormat(tick)}
            </text>
          </g>
        );
      })}
      {xTicks.map((tick) => {
        const value = logX ? 10 ** tick : tick;
        return (
          <text
            key={`x-${tick}`}
            x={xScale(value)}
            y={HEIGHT - 12}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {xFormat(value)}
          </text>
        );
      })}
      <text
        x={WIDTH / 2}
        y={HEIGHT - 1}
        textAnchor="middle"
        className="fill-muted-foreground text-[9px] uppercase tracking-wider"
      >
        {xLabel}
      </text>
      <text
        x={12}
        y={PAD.top + plotH / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${PAD.top + plotH / 2})`}
        className="fill-muted-foreground text-[9px] uppercase tracking-wider"
      >
        {yLabel}
      </text>
      {points.map((point) => {
        const selected = point.id === selectedId;
        return (
          <g key={point.id} className="cursor-pointer" onClick={() => onSelect(point.id)}>
            <title>{`${point.label} — ${point.detail}`}</title>
            <circle
              cx={xScale(point.x)}
              cy={yScale(point.y)}
              r={selected ? 7 : 4.5}
              fill={FIT_COLOR[point.level]}
              fillOpacity={selected ? 1 : 0.78}
              stroke={selected ? "currentColor" : "none"}
              className={selected ? "text-foreground" : undefined}
              strokeWidth={selected ? 1.5 : 0}
            />
            {selected && (
              <text
                x={xScale(point.x) + 10}
                y={yScale(point.y) + 3}
                className="fill-foreground text-[9px]"
              >
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export interface BarRow {
  id: string;
  label: string;
  value: number;
  detail: string;
  level: FitLevel;
}

export function DomainBars({
  rows,
  max = 100,
  selectedId,
  onSelect,
}: {
  rows: BarRow[];
  max?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nothing in the current selection is graded for this domain.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onSelect(row.id)}
            className="group block w-full text-left"
            title={row.detail}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "truncate text-xs",
                  row.id === selectedId ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {row.label}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {Math.round(row.value)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(2, (row.value / max) * 100)}%`,
                  backgroundColor: FIT_COLOR[row.level],
                }}
              />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FitLegend() {
  const items: { level: FitLevel; label: string }[] = [
    { level: "native", label: "Runs on GPU" },
    { level: "spills", label: "Uses system RAM" },
    { level: "too_big", label: "Too big here" },
    { level: "external", label: "Outside llama.cpp" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.level} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: FIT_COLOR[item.level] }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
