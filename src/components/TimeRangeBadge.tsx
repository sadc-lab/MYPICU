import { X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimeRangeBadgeProps {
  rangeStart: number | null;
  rangeEnd: number | null;
  onReset: () => void;
  className?: string;
}

/**
 * Rappel persistant qu'une plage de temps est active sur ce graphique —
 * visible même hors mode édition (crayon), pour ne pas avoir à rouvrir
 * l'édition juste pour s'en souvenir. Le × réinitialise directement.
 */
export function TimeRangeBadge({ rangeStart, rangeEnd, onReset, className }: TimeRangeBadgeProps) {
  if (rangeStart === null || rangeEnd === null) return null;

  const formatT = (t: number) => format(new Date(t), "HH:mm", { locale: fr });

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-xs bg-primary/5 border border-primary/20 rounded-md pl-2.5 pr-1 py-1",
        className,
      )}
    >
      <span className="font-medium text-foreground tabular-nums">
        {formatT(rangeStart)} – {formatT(rangeEnd)}
      </span>
      <button
        type="button"
        onClick={onReset}
        title="Effacer la sélection"
        aria-label="Effacer la sélection"
        className="flex items-center justify-center h-6 w-6 -mr-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
