import { cn } from "@/lib/utils";

interface RangeFieldProps {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  unit?: string;
  value: number;
}

/**
 * A labelled slider paired with a numeric input: the slider is for feel, the
 * input for exact values (and for pasting a number someone else specified).
 * Both edit the same number and clamp to the same range.
 */
export function RangeField({
  label,
  max = 24,
  min = 0,
  onChange,
  step = 1,
  unit = "px",
  value,
}: RangeFieldProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-text-secondary">{label}</span>
        <span className="inline-flex items-center gap-1">
          <input
            aria-label={label}
            className={cn(
              "h-6 w-12 rounded border border-current/20 bg-transparent px-1 text-right",
              "text-xs tabular-nums text-midground",
              "focus-visible:border-current/40 focus-visible:outline-none",
            )}
            max={max}
            min={min}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(clamp(next));
            }}
            step={step}
            type="number"
            value={value}
          />
          <span className="text-xs text-text-tertiary">{unit}</span>
        </span>
      </div>

      <input
        aria-label={`${label} slider`}
        className="h-1 w-full cursor-pointer accent-midground"
        max={max}
        min={min}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
        step={step}
        type="range"
        value={value}
      />
    </div>
  );
}
