import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
} from 'recharts';
import { parseTargetRange } from '@/components/RadialGauge';

export interface ChartIndicator {
  label: string;
  value: string | number;
  unit?: string;
  target: string;
  status: string; // 'critical' | 'warning' | 'normal'
}

interface MultiIndicatorChartProps {
  indicators: ChartIndicator[];
  /** Number of hours to simulate retro-actively (default 24). */
  hours?: number;
}

// Distinct, color-blind friendly palette using HSL semantic-friendly hues.
// We avoid using `text-status-*` because each indicator needs its OWN hue.
const PALETTE = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

/**
 * Normalize a real value into a 0–100 scale where:
 *   0   = targetMin
 *   100 = targetMax
 * Values outside the target band map outside [0, 100] proportionally.
 * This lets us overlay indicators with different units (mmHg, %, L/min, …)
 * on a single Y axis, with the target band always = [0, 100].
 */
const normalize = (value: number, targetMin: number, targetMax: number): number => {
  const span = targetMax - targetMin;
  if (span === 0) return 50;
  return ((value - targetMin) / span) * 100;
};

export const MultiIndicatorChart = ({
  indicators,
  hours = 24,
}: MultiIndicatorChartProps) => {
  // Pre-compute series metadata (current value, target band, color, etc.)
  const series = useMemo(() => {
    return indicators
      .map((ind, i) => {
        const numericValue =
          typeof ind.value === 'number'
            ? ind.value
            : parseFloat(String(ind.value).replace(/[^\d.\-]/g, ''));
        if (!Number.isFinite(numericValue)) return null;

        const range = parseTargetRange(ind.target, numericValue);
        if (!range) return null;

        const color = PALETTE[i % PALETTE.length];
        return {
          key: `m_${i}`,
          label: ind.label,
          unit: ind.unit ?? '',
          color,
          status: ind.status,
          current: numericValue,
          targetMin: range.targetMin,
          targetMax: range.targetMax,
          targetCaption: ind.target,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [indicators]);

  // Build a synthetic time series that ends at the current value and gently
  // drifts away from the target band the more the current value is out of range.
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    const points = 24; // 1 point per hour
    const now = Date.now();
    const stepMs = (hours * 60 * 60 * 1000) / (points - 1);

    const data: Array<Record<string, number | string>> = [];
    for (let i = 0; i < points; i++) {
      const t = now - (points - 1 - i) * stepMs;
      const row: Record<string, number | string> = {
        time: t,
      };

      for (const s of series) {
        // Normalize current value
        const normCurrent = normalize(s.current, s.targetMin, s.targetMax);
        // Earlier points start closer to the band (50), then drift toward current
        const progress = i / (points - 1); // 0 → 1
        const drifted = 50 + (normCurrent - 50) * Math.pow(progress, 1.4);
        // Add small deterministic wiggle so the line is not flat
        const wiggle = Math.sin((i + s.key.length) * 0.9) * 4;
        row[s.key] = Math.round((drifted + wiggle) * 10) / 10;
        // Store the real (un-normalized) value for the tooltip
        const denorm =
          s.targetMin +
          ((row[s.key] as number) / 100) * (s.targetMax - s.targetMin);
        row[`${s.key}_real`] = Math.round(denorm * 100) / 100;
      }
      data.push(row);
    }
    return data;
  }, [series, hours]);

  if (series.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Aucun indicateur exploitable pour le graphique.
      </p>
    );
  }

  const formatXAxis = (t: number) => {
    const d = new Date(t);
    return `${d.getHours().toString().padStart(2, '0')}h`;
  };

  // Custom tooltip showing real values per indicator
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const ts = new Date(label as number);
    return (
      <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg min-w-[180px]">
        <p className="text-[11px] text-muted-foreground mb-1.5 border-b border-border pb-1.5">
          {ts.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <div className="space-y-1">
          {payload.map((p: any) => {
            const s = series.find((ss) => ss.key === p.dataKey);
            if (!s) return null;
            const real = p.payload[`${s.key}_real`];
            const inRange = real >= s.targetMin && real <= s.targetMax;
            return (
              <div
                key={s.key}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-foreground">{s.label}</span>
                </span>
                <span
                  className={
                    inRange
                      ? 'text-foreground font-medium'
                      : 'text-status-critical font-medium'
                  }
                >
                  {real} {s.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
          >
            {/* Target band (normalized to 0–100) */}
            <ReferenceArea
              y1={0}
              y2={100}
              fill="hsl(var(--status-normal))"
              fillOpacity={0.1}
            />

            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />

            <YAxis
              domain={[-50, 150]}
              ticks={[0, 50, 100]}
              tickFormatter={(v) => {
                if (v === 0) return 'Min';
                if (v === 100) return 'Max';
                if (v === 50) return 'Cible';
                return '';
              }}
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={40}
            />

            <Tooltip content={<CustomTooltip />} />

            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name={s.label}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with current value vs target — one line per indicator */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
        {series.map((s) => {
          const inRange = s.current >= s.targetMin && s.current <= s.targetMax;
          return (
            <div
              key={s.key}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-foreground font-medium truncate">
                  {s.label}
                </span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span
                  className={
                    inRange
                      ? 'text-foreground font-semibold'
                      : 'text-status-critical font-semibold'
                  }
                >
                  {s.current}
                  {s.unit ? ` ${s.unit}` : ''}
                </span>
                <span className="text-muted-foreground">
                  / {s.targetCaption}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground italic">
        Échelle normalisée — la bande verte représente la zone cible commune à
        tous les indicateurs. Survolez la courbe pour voir les valeurs réelles.
      </p>
    </div>
  );
};
