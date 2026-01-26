import { cn } from "@/lib/utils";

export type TimeWindowValue = "3h" | "6h" | "12h" | "24h" | "stay";

interface TimeWindowOption {
  value: TimeWindowValue;
  label: string;
}

const DEFAULT_OPTIONS: TimeWindowOption[] = [
  { value: "3h", label: "3h" },
  { value: "6h", label: "6h" },
  { value: "12h", label: "12h" },
  { value: "24h", label: "24h" },
  { value: "stay", label: "Séjour" },
];

const WITHOUT_STAY_OPTIONS: TimeWindowOption[] = [
  { value: "3h", label: "3h" },
  { value: "6h", label: "6h" },
  { value: "12h", label: "12h" },
  { value: "24h", label: "24h" },
];

interface TimeWindowSelectorProps {
  value: TimeWindowValue | string;
  onChange: (value: TimeWindowValue) => void;
  options?: TimeWindowOption[];
  includeStay?: boolean;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "muted" | "compact";
  className?: string;
}

export function TimeWindowSelector({
  value,
  onChange,
  options,
  includeStay = true,
  label,
  size = "default",
  variant = "default",
  className,
}: TimeWindowSelectorProps) {
  const displayOptions = options || (includeStay ? DEFAULT_OPTIONS : WITHOUT_STAY_OPTIONS);

  const sizeClasses = {
    sm: "h-7 text-xs",
    default: "h-8 text-sm",
  };

  const buttonSizeClasses = {
    sm: "px-2 min-w-[32px]",
    default: "px-3 min-w-[40px]",
  };

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {label && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
        )}
        <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          {displayOptions.map((option) => {
            const isActive = value === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={cn(
                  "inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs font-medium transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{label}</span>
      )}
      <div className={cn(
        "inline-flex items-center rounded-lg border border-border overflow-hidden",
        sizeClasses[size]
      )}>
        {displayOptions.map((option, index) => {
          const isActive = value === option.value;
          const isFirst = index === 0;
          const isLast = index === displayOptions.length - 1;
          
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex items-center justify-center font-medium transition-all",
                buttonSizeClasses[size],
                sizeClasses[size],
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50",
                !isFirst && "border-l border-border",
                isFirst && "rounded-l-md",
                isLast && "rounded-r-md"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Helper to convert numeric hours to TimeWindowValue
export function hoursToTimeWindow(hours: number): TimeWindowValue {
  switch (hours) {
    case 3: return "3h";
    case 6: return "6h";
    case 12: return "12h";
    case 24: return "24h";
    default: return "6h";
  }
}

// Helper to convert TimeWindowValue to numeric hours
export function timeWindowToHours(value: TimeWindowValue | string): number | null {
  const match = value.match(/^(\d+)h$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  if (value === "stay") {
    return null;
  }
  return null;
}
