import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { kpiCircleClass, getKpiSeverity } from "@/utils/kpiCircleStyle";

interface KpiCircleProps {
  /** Nombre d'éléments problématiques à afficher dans le cercle. */
  count: number;
  /** Forcer la sévérité critique (rouge) même si count < 3. */
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
 * Tooltip explicatif au survol.
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
        <div
          className={kpiCircleClass(count, { hasCritical })}
          aria-label={tooltipTitle}
          role="status"
        >
          {count}
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
