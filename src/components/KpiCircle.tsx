import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";
import { kpiCircleClass, getKpiSeverity } from "@/utils/kpiCircleStyle";

interface KpiCircleProps {
  /** Nombre d'éléments problématiques à afficher dans le cercle. */
  count: number;
  /** Forcer la sévérité critique (rouge + badge alerte) même si count < 3. */
  hasCritical?: boolean;
  /**
   * Libellé du groupe de KPI (ex: "Signes vitaux", "Hémodynamique", "OptiBrain").
   * Utilisé dans le tooltip pour contextualiser le compte.
   */
  groupLabel: string;
  /**
   * Mot décrivant l'unité comptée (ex: "paramètre", "indicateur").
   * Le composant gère automatiquement le pluriel.
   */
  itemLabel?: string;
}

/**
 * Cercle compteur unifié pour tous les groupes de KPI.
 * Tooltip explicatif au survol + badge AlertTriangle pour les états critiques
 * (sans animation clignotante).
 */
export const KpiCircle = ({
  count,
  hasCritical = false,
  groupLabel,
  itemLabel = "paramètre",
}: KpiCircleProps) => {
  const severity = getKpiSeverity(count, hasCritical);
  const plural = count > 1 ? "s" : "";
  const tooltipTitle =
    count === 0
      ? `Tous les ${itemLabel}s sont dans les cibles`
      : `${count} ${itemLabel}${plural} hors cible dans « ${groupLabel} »`;
  const tooltipHint =
    severity === 'normal'
      ? "Aucune action requise — surveillance standard."
      : severity === 'critical'
        ? "État critique — intervention prioritaire recommandée."
        : "État de surveillance — vérifier les valeurs hors cible.";

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div className="relative inline-flex shrink-0">
          <div
            className={kpiCircleClass(count, { hasCritical })}
            aria-label={tooltipTitle}
            role="status"
          >
            {count}
          </div>
          {severity === 'critical' && (
            <span
              className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-critical text-white ring-2 ring-background"
              aria-hidden="true"
            >
              <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-xs">{tooltipTitle}</p>
          <p className="text-xs text-muted-foreground">{tooltipHint}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
