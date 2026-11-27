// Sélecteur de période du monitorage, commun aux modules d'organe (Optibrain,
// Optirenal) : 24h, séjour, ou la plage choisie à la main sur le graphique, plus
// le bouton qui met le graphique en mode édition (échelle Y et période).

import { format } from "date-fns";
import { Check, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SharedTimeWindow } from "@/hooks/useSharedTimeWindow";
import type { TimeRange } from "@/hooks/useTimeRange";
import { dateLocale, tr } from "@/i18n";

interface MonitoringPeriodControlProps<T> {
  timeWindow: SharedTimeWindow<T>;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  isEditing: boolean;
  onToggleEditing: () => void;
}

export function MonitoringPeriodControl<T>({
  timeWindow,
  timeRange,
  onTimeRangeChange,
  isEditing,
  onToggleEditing,
}: MonitoringPeriodControlProps<T>) {
  const presets: Array<{ value: TimeRange; label: string }> = [
    { value: "24h", label: "24h" },
    { value: "stay", label: tr("Séjour", "Stay") },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{tr("Période sélectionnée :", "Selected period:")}</span>
      <div className="inline-flex items-center h-7 text-xs rounded-lg border border-border overflow-hidden">
        {timeWindow.hasRememberedRange && (
          <span
            className={`inline-flex items-center h-7 ${
              timeWindow.isRangeSelected
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <button
              type="button"
              onClick={() => timeWindow.setRangeActive(true)}
              title={tr("Revenir à la plage choisie sur le graphique", "Back to the range chosen on the chart")}
              className="inline-flex items-center justify-center pl-2 pr-1 h-7 text-xs font-medium tabular-nums"
            >
              {format(new Date(timeWindow.rangeStart!), "HH:mm", { locale: dateLocale() })}
              –
              {format(new Date(timeWindow.rangeEnd!), "HH:mm", { locale: dateLocale() })}
            </button>
            <button
              type="button"
              onClick={timeWindow.resetRange}
              title={tr("Supprimer la plage choisie", "Clear the chosen range")}
              className="inline-flex items-center justify-center pr-2 pl-0.5 h-7 opacity-70 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {presets.map((preset, i) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => {
              timeWindow.setRangeActive(false);
              onTimeRangeChange(preset.value);
            }}
            className={`inline-flex items-center justify-center px-2 min-w-[32px] h-7 text-xs font-medium transition-all ${
              i > 0 || timeWindow.hasRememberedRange ? "border-l border-border" : ""
            } ${
              !timeWindow.isRangeSelected && timeRange === preset.value
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant={isEditing ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onToggleEditing}
      >
        {isEditing ? (
          <>
            <Check className="h-3.5 w-3.5" />
            {tr("Terminer", "Done")}
          </>
        ) : (
          <>
            <Edit2 className="h-3.5 w-3.5" />
            {tr("Modifier le graphique", "Edit chart")}
          </>
        )}
      </Button>
    </div>
  );
}
