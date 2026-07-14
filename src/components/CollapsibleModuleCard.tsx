import { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModuleStatus = 'normal' | 'warning' | 'critical' | 'inactive';

interface CollapsibleModuleCardProps {
  /** Header icon/circle — pass a custom node (icon in colored circle, KpiCircle, or count-in-circle). */
  headerIcon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Outer variant: "primary" for top-level module cards, "nested" for sub-cards inside a monitorage card. */
  variant?: 'primary' | 'nested';
  className?: string;
  contentClassName?: string;
}

/**
 * Uniform collapsible card used across all Opti-* modules.
 * Provides the identical header (icon circle + title + subtitle + chevron) and body wrapper.
 */
export const CollapsibleModuleCard = ({
  headerIcon,
  title,
  subtitle,
  expanded,
  onToggle,
  children,
  variant = 'primary',
  className,
  contentClassName,
}: CollapsibleModuleCardProps) => {
  return (
    <Card
      className={cn(
        variant === 'primary' ? 'bg-card shadow-sm' : 'border-2 border-border',
        className
      )}
    >
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4 sm:px-6"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="shrink-0">{headerIcon}</div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">{title}</h3>
              {subtitle && (
                <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
              )}
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className={cn('pt-0 px-4 sm:px-6 pb-4', contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  );
};

/** Status-colored circle wrapping an image/icon (used for Optimisation module headers). */
interface StatusIconCircleProps {
  status: ModuleStatus;
  children: ReactNode;
  size?: 'sm' | 'md';
}

const STATUS_CIRCLE_CLASSES: Record<ModuleStatus, string> = {
  normal: 'border-status-normal text-status-normal bg-status-normal/10',
  warning: 'border-status-warning text-status-warning bg-status-warning/10',
  critical: 'border-status-critical text-status-critical bg-status-critical/10',
  inactive: 'border-muted-foreground text-muted-foreground bg-muted',
};

export const StatusIconCircle = ({ status, children, size = 'md' }: StatusIconCircleProps) => {
  const sizeClasses =
    size === 'sm'
      ? 'w-10 h-10 sm:w-12 sm:h-12 border-2'
      : 'w-12 h-12 sm:w-16 sm:h-16 border-4';
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold shrink-0',
        sizeClasses,
        STATUS_CIRCLE_CLASSES[status]
      )}
    >
      {children}
    </div>
  );
};

/** Number-in-a-circle (used in Monitorage sub-cards to show count out of total). */
interface CountCircleProps {
  count: number;
  total?: number;
  status: ModuleStatus;
}

export const CountCircle = ({ count, total, status }: CountCircleProps) => (
  <div
    className={cn(
      'w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold border-4 shrink-0',
      STATUS_CIRCLE_CLASSES[status]
    )}
  >
    {total !== undefined ? `${count}/${total}` : count}
  </div>
);
