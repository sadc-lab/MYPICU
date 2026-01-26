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
  variant?: "default" | "muted";
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

  const buttonSizeClasses = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";
  
  const getButtonClasses = (isActive: boolean) => {
    if (variant === "muted") {
      return isActive
        ? "bg-background text-foreground shadow-sm font-medium"
        : "text-muted-foreground hover:text-foreground";
    }
    return isActive
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground hover:bg-muted/80";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
      <div className={cn(
        "flex rounded-lg",
        variant === "muted" ? "bg-muted p-1" : "gap-1"
      )}>
        {displayOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md transition-colors",
              buttonSizeClasses,
              getButtonClasses(value === option.value)
            )}
          >
            {option.label}
          </button>
        ))}
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
