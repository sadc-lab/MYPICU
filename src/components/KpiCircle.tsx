import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { kpiCircleClass, getKpiSeverity } from "@/utils/kpiCircleStyle";
import { tr } from '@/i18n';

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
  const itemEn = itemLabel === "indicateur" ? "indicator" : itemLabel === "paramètre" ? "parameter" : itemLabel;
  const tooltipTitle =
    count === 0
      ? tr(`Tous les ${itemLabel}s sont dans les cibles`, `All ${itemEn}s are on target`)
      : tr(`${count} ${itemLabel}${plural} hors cible dans « ${groupLabel} »`, `${count} ${itemEn}${plural} off target in “${groupLabel}”`);
  const tooltipHint =
    severity === 'normal'
      ? tr("Aucune action requise — surveillance standard.", "No action required — standard monitoring.")
      : severity === 'critical'
        ? tr("État critique — intervention prioritaire recommandée.", "Critical state — priority intervention recommended.")
        : tr("État de surveillance — vérifier les valeurs hors cible.", "Watch state — check off-target values.");

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
