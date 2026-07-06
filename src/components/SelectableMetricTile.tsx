import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TileStatus = 'normal' | 'warning' | 'critical';

interface SelectableMetricTileProps {
  label: string;
  displayValue: ReactNode;
  unit?: string;
  status?: TileStatus;
  criticalLabel?: string;
  criticalColor?: string;
  icon?: ReactNode;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const STATUS_TEXT: Record<TileStatus, string> = {
  normal: 'text-foreground',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
};

/**
 * Selectable metric tile used in Optimisation cards across all modules.
 * Uniform sizing, borders, selection state, status coloring.
 */
export const SelectableMetricTile = ({
  label,
  displayValue,
  unit,
  status = 'normal',
  criticalLabel,
  criticalColor = 'text-muted-foreground',
  icon,
  isSelected,
  onClick,
}: SelectableMetricTileProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center cursor-pointer p-2 sm:p-3 rounded-lg transition-all border-2',
        isSelected
          ? 'bg-card shadow-sm border-primary'
          : 'border-transparent hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide text-center">
        {label}
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        {icon}
        <div className={cn('text-2xl sm:text-4xl font-bold', STATUS_TEXT[status])}>
          {displayValue}
        </div>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {criticalLabel && (
        <div className={cn('text-[10px] sm:text-xs font-medium text-center leading-tight', criticalColor)}>
          {criticalLabel}
        </div>
      )}
    </div>
  );
};
