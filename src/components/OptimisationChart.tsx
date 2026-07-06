import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';

export interface OptimisationChartSeries {
  label: string;
  color: string;
  /** Optional target range shown as a colored ReferenceArea. */
  targetZone?: { min: number; max: number };
}

interface OptimisationChartProps {
  data: Array<Record<string, any>>;
  series: OptimisationChartSeries[];
  height?: string;
}

/**
 * Uniform time-series chart used inside every Optimisation card.
 * Renders target zones + monotone lines with matching series colors.
 */
export const OptimisationChart = ({
  data,
  series,
  height = 'h-[250px] sm:h-[300px]',
}: OptimisationChartProps) => {
  const colorFor = (label: string) => series.find((s) => s.label === label)?.color ?? '#9ca3af';

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          {series.map((s) =>
            s.targetZone ? (
              <ReferenceArea
                key={`zone-${s.label}`}
                y1={s.targetZone.min}
                y2={s.targetZone.max}
                fill={s.color}
                fillOpacity={0.08}
                stroke={s.color}
                strokeOpacity={0.3}
                strokeDasharray="4 2"
              />
            ) : null
          )}
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              padding: '12px',
              color: 'hsl(var(--popover-foreground))',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 8 }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            iconType="plainline"
            formatter={(value: string) => (
              <span style={{ color: colorFor(value), fontWeight: 500 }}>{value}</span>
            )}
          />
          {series.map((s) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: s.color }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
