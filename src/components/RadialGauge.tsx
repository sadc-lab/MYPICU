import { cn } from "@/lib/utils";

interface RadialGaugeProps {
  /** Current value (numeric). */
  value: number;
  /** Display unit, optional. */
  unit?: string;
  /** Indicator label shown below the gauge. */
  label: string;
  /** Target range minimum (numeric). */
  targetMin: number;
  /** Target range maximum (numeric). */
  targetMax: number;
  /** Absolute scale minimum. Defaults to 0.8 * targetMin. */
  scaleMin?: number;
  /** Absolute scale maximum. Defaults to 1.5 * targetMax. */
  scaleMax?: number;
  /** Severity status — drives needle/value color. */
  status?: "normal" | "warning" | "critical";
  /** Human-readable target string for caption (e.g. "< 20 mmHg"). */
  targetCaption?: string;
}

/**
 * Semi-circular radial gauge. Shows:
 *  - Grey arc base
 *  - Green sub-arc for the target range
 *  - Colored needle on the current value
 *  - Numeric value + label
 */
export const RadialGauge = ({
  value,
  unit,
  label,
  targetMin,
  targetMax,
  scaleMin,
  scaleMax,
  status = "normal",
  targetCaption,
}: RadialGaugeProps) => {
  // Compute scale bounds with padding when not provided.
  const lo = scaleMin ?? Math.min(value, targetMin) * 0.8;
  const hi = scaleMax ?? Math.max(value, targetMax) * 1.2;
  const range = Math.max(hi - lo, 0.0001);

  // SVG geometry — semi-circle from 180° (left) to 0° (right).
  const W = 140;
  const H = 86;
  const CX = W / 2;
  const CY = 76;
  const R = 60;
  const STROKE = 12;

  const valueToAngle = (v: number) => {
    const clamped = Math.min(Math.max(v, lo), hi);
    const ratio = (clamped - lo) / range;
    // Map [0,1] to [180°, 0°] (left-to-right semi-circle).
    return 180 - ratio * 180;
  };

  const polar = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: CX + radius * Math.cos(rad),
      y: CY - radius * Math.sin(rad),
    };
  };

  // Build an arc path between two angles (angle in degrees, 180→0).
  const arcPath = (a1: number, a2: number, radius: number) => {
    const start = polar(a1, radius);
    const end = polar(a2, radius);
    const largeArc = Math.abs(a1 - a2) > 180 ? 1 : 0;
    // sweep = 0 because angles decrease going clockwise on the upper half
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const baseArc = arcPath(180, 0, R);
  const targetArc = arcPath(valueToAngle(targetMin), valueToAngle(targetMax), R);
  const needleAngle = valueToAngle(value);
  const needleEnd = polar(needleAngle, R - 4);
  const needleBase = polar(needleAngle, 6);

  const valueColor =
    status === "critical"
      ? "text-status-critical"
      : status === "warning"
      ? "text-status-warning"
      : "text-foreground";

  const needleColor =
    status === "critical"
      ? "stroke-status-critical"
      : status === "warning"
      ? "stroke-status-warning"
      : "stroke-foreground";

  // Format value to 1 decimal max.
  const displayValue = Number.isFinite(value)
    ? Math.abs(value) >= 100
      ? value.toFixed(0)
      : value.toFixed(1).replace(/\.0$/, "")
    : "—";

  return (
    <div className="flex flex-col items-center text-center">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[160px] h-auto"
        role="img"
        aria-label={`${label}: ${displayValue}${unit ?? ""}`}
      >
        {/* Base arc */}
        <path
          d={baseArc}
          fill="none"
          className="stroke-muted"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Target zone arc */}
        <path
          d={targetArc}
          fill="none"
          className="stroke-status-normal/60"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={needleBase.x}
          y1={needleBase.y}
          x2={needleEnd.x}
          y2={needleEnd.y}
          className={needleColor}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={CX} cy={CY} r={4} className="fill-foreground" />
        {/* Scale labels */}
        <text
          x={4}
          y={H - 2}
          className="fill-muted-foreground text-[8px]"
        >
          {Math.round(lo)}
        </text>
        <text
          x={W - 4}
          y={H - 2}
          textAnchor="end"
          className="fill-muted-foreground text-[8px]"
        >
          {Math.round(hi)}
        </text>
      </svg>

      <div className={cn("text-lg font-bold leading-none", valueColor)}>
        {displayValue}
        {unit && (
          <span className="text-[10px] font-normal text-muted-foreground ml-1">
            {unit}
          </span>
        )}
      </div>
      <div className="text-xs font-medium text-foreground mt-1 leading-tight">
        {label}
      </div>
      {targetCaption && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Cible : {targetCaption}
        </div>
      )}
    </div>
  );
};

/**
 * Parse a target string like "< 20 mmHg", "> 65 mmHg", "4.5-6.0 L/min",
 * "35-45 mmHg" into numeric [min, max].
 */
export function parseTargetRange(
  target: string,
  currentValue: number,
): { targetMin: number; targetMax: number } | null {
  if (!target) return null;
  const cleaned = target.replace(/[^\d.\-<>\s]/g, " ").trim();

  // Range "a-b"
  const rangeMatch = cleaned.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return {
      targetMin: parseFloat(rangeMatch[1]),
      targetMax: parseFloat(rangeMatch[2]),
    };
  }

  // "< X" → upper bound
  const ltMatch = cleaned.match(/<\s*(-?\d+(?:\.\d+)?)/);
  if (ltMatch) {
    const max = parseFloat(ltMatch[1]);
    return { targetMin: max * 0.3, targetMax: max };
  }

  // "> X" → lower bound
  const gtMatch = cleaned.match(/>\s*(-?\d+(?:\.\d+)?)/);
  if (gtMatch) {
    const min = parseFloat(gtMatch[1]);
    const span = Math.max(min * 0.3, Math.abs(currentValue - min) * 1.5);
    return { targetMin: min, targetMax: min + span };
  }

  return null;
}
