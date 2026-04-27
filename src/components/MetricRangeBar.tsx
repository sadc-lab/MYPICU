import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReactNode } from "react";

interface MetricRangeBarProps {
  value: number;
  min: number;
  max: number;
  targetMin: number;
  targetMax: number;
  maxWidth?: string;
  unit?: string;
  /** Affiche un triangle pointeur surmonté de la valeur au-dessus du point. */
  showValuePointer?: boolean;
  /** Contenu personnalisé du tooltip au survol du point/triangle. */
  tooltipContent?: ReactNode;
  /** Taille de la valeur affichée au-dessus du triangle. */
  valueSize?: 'sm' | 'md' | 'lg' | 'xl';
  /** Masque le texte de la valeur au-dessus du triangle (n'affiche que la flèche). */
  hideValueLabel?: boolean;
}

export const MetricRangeBar = ({
  value,
  min,
  max,
  targetMin,
  targetMax,
  maxWidth = '180px',
  unit,
  showValuePointer = false,
  tooltipContent,
  valueSize = 'sm',
}: MetricRangeBarProps) => {
  const range = max - min;
  const inRange = value >= targetMin && value <= targetMax;
  const valueSizeClass = {
    sm: 'text-[11px]',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-2xl sm:text-3xl',
  }[valueSize];
  const unitSizeClass = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-xs',
  }[valueSize];
  const triangleSizeClass = valueSize === 'xl' || valueSize === 'lg'
    ? 'border-l-[7px] border-r-[7px] border-t-[8px]'
    : 'border-l-[5px] border-r-[5px] border-t-[6px]';
  const pointerPaddingClass = {
    sm: 'pt-7',
    md: 'pt-8',
    lg: 'pt-10',
    xl: 'pt-12',
  }[valueSize];

  const targetLeftPct = ((targetMin - min) / range) * 100;
  const targetWidthPct = ((targetMax - targetMin) / range) * 100;
  const valuePct = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  const valueColor = inRange ? 'text-muted-foreground' : 'text-status-critical';
  const triangleColor = inRange ? 'border-t-muted-foreground' : 'border-t-status-critical';

  const dot = (
    <div
      className={`w-3 h-3 rounded-full border-2 ${
        inRange
          ? 'bg-muted-foreground border-muted-foreground'
          : 'bg-status-critical border-status-critical'
      }`}
    />
  );

  // (le pointeur triangulaire est rendu inline plus bas pour pouvoir l'envelopper d'un Tooltip)

  return (
    <div className="w-full" style={{ maxWidth }}>
      <div className={`relative ${showValuePointer ? pointerPaddingClass : ''}`}>
        <div className="relative h-3 bg-muted rounded-full">
          {/* Target zone */}
          <div
            className="absolute top-0 bottom-0 bg-muted-foreground/30 rounded-full"
            style={{
              left: `${targetLeftPct}%`,
              width: `${targetWidthPct}%`,
            }}
          />
          {/* Value dot (with optional pointer + tooltip) */}
          {tooltipContent ? (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <div
                  className="absolute z-10 top-0 cursor-help"
                  style={{ left: `${valuePct}%`, transform: 'translateX(-50%)' }}
                >
                  {dot}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {tooltipContent}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div
              className="absolute z-10 top-0"
              style={{ left: `${valuePct}%`, transform: 'translateX(-50%)' }}
            >
              {dot}
            </div>
          )}
        </div>
        {/* Value pointer above the bar (sits in the pt-7 padding area) */}
        {showValuePointer && (
          tooltipContent ? (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <div
                  className="absolute z-10 cursor-help flex flex-col items-center"
                  style={{
                    left: `${valuePct}%`,
                    top: '0',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <span className={`${valueSizeClass} font-semibold tabular-nums leading-none ${valueColor}`}>
                    {value}
                    {unit ? <span className={`ml-0.5 ${unitSizeClass} font-normal opacity-70`}>{unit}</span> : null}
                  </span>
                  <div
                    className={`w-0 h-0 ${triangleSizeClass} border-l-transparent border-r-transparent ${triangleColor} mt-0.5`}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {tooltipContent}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div
              className="absolute z-10 flex flex-col items-center"
              style={{
                left: `${valuePct}%`,
                top: '0',
                transform: 'translateX(-50%)',
              }}
            >
              <span className={`${valueSizeClass} font-semibold tabular-nums leading-none ${valueColor}`}>
                {value}
                {unit ? <span className={`ml-0.5 ${unitSizeClass} font-normal opacity-70`}>{unit}</span> : null}
              </span>
              <div
                className={`w-0 h-0 ${triangleSizeClass} border-l-transparent border-r-transparent ${triangleColor} mt-0.5`}
              />
            </div>
          )
        )}
      </div>
      <div className="flex justify-between items-center mt-1.5 text-xs text-muted-foreground">
        <span>{targetMin}</span>
        <span>{targetMax}</span>
      </div>
    </div>
  );
};
