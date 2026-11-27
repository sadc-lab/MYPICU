import { X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { tr, dateLocale } from '@/i18n';

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

  // La date n'est ajoutée que si la plage déborde sur plusieurs jours.
  const sameDay = new Date(rangeStart).toDateString() === new Date(rangeEnd).toDateString();
  const formatT = (t: number) => format(new Date(t), sameDay ? "HH:mm" : "dd/MM HH:mm", { locale: dateLocale() });

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
        title={tr("Effacer la sélection", "Clear selection")}
        aria-label={tr("Effacer la sélection", "Clear selection")}
        className="flex items-center justify-center h-6 w-6 -mr-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
