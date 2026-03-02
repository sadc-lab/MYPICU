interface MetricRangeBarProps {
  value: number;
  min: number;
  max: number;
  targetMin: number;
  targetMax: number;
  maxWidth?: string;
}

export const MetricRangeBar = ({
  value,
  min,
  max,
  targetMin,
  targetMax,
  maxWidth = '180px',
}: MetricRangeBarProps) => {
  const range = max - min;
  const inRange = value >= targetMin && value <= targetMax;

  const targetLeftPct = ((targetMin - min) / range) * 100;
  const targetWidthPct = ((targetMax - targetMin) / range) * 100;
  const valuePct = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  return (
    <div className="w-full" style={{ maxWidth }}>
      <div className="relative h-3 bg-muted rounded-full overflow-visible">
        {/* Target zone */}
        <div
          className="absolute top-0 bottom-0 bg-muted-foreground/30 rounded-full"
          style={{
            left: `${targetLeftPct}%`,
            width: `${targetWidthPct}%`,
          }}
        />
        {/* Value dot */}
        <div
          className={`absolute w-3 h-3 rounded-full border-2 z-10 top-0 ${
            inRange
              ? 'bg-muted-foreground border-muted-foreground'
              : 'bg-status-critical border-status-critical'
          }`}
          style={{
            left: `${valuePct}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      <div className="flex justify-between items-center mt-1.5 text-xs text-muted-foreground">
        <span>{targetMin}</span>
        <span>{targetMax}</span>
      </div>
    </div>
  );
};
