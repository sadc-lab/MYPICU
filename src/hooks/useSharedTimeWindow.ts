import { useContext, useMemo, useState } from "react";
import { ChartTimeRangeContext, TimeRange } from "@/contexts/ChartTimeRangeContext";

export interface SharedTimeWindow<T> {
  visibleData: T[];
  startIndex: number | undefined;
  endIndex: number | undefined;
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
  /** Une plage existe ET est actuellement appliquée aux données (filtre `visibleData`). */
  isRangeSelected: boolean;
  /** Supprime définitivement la plage mémorisée. */
  resetRange: () => void;
  /** Bornes réelles (epoch ms) de la plage mémorisée, même si elle est suspendue (isRangeSelected = false) —
   * pour pouvoir toujours l'afficher hors du graphique (ex. bouton de plage personnalisée). */
  rangeStart: number | null;
  rangeEnd: number | null;
  /** Une plage a été choisie au moins une fois et reste mémorisée, qu'elle soit active ou suspendue. */
  hasRememberedRange: boolean;
  /** Applique ou suspend la plage mémorisée sans la supprimer — permet de basculer vers une vue standard
   * (24h/Séjour) puis de revenir à la plage personnalisée sans la resélectionner sur le graphique. */
  setRangeActive: (active: boolean) => void;
}

/**
 * Plage de temps sélectionnée (glisser-déposer sur un Brush), partagée avec
 * les autres graphiques du même module quand un ChartTimeRangeProvider les
 * entoure — sinon reste locale à ce graphique (aucun changement requis là
 * où le contexte n'est pas branché, même pattern que useYAxisZoom).
 *
 * `getTime` plutôt qu'un nom de champ fixe : les jeux de données existants
 * n'utilisent pas tous la même clé (`time`, `timestamp`, `t`).
 */
export function useSharedTimeWindow<T>(data: T[], getTime: (item: T) => number): SharedTimeWindow<T> {
  const shared = useContext(ChartTimeRangeContext);
  const [localRange, setLocalRange] = useState<TimeRange | null>(null);
  const [localActive, setLocalActive] = useState(true);
  const range = shared ? shared.range : localRange;
  const setRange = shared ? shared.setRange : setLocalRange;
  const isActive = shared ? shared.isActive : localActive;
  const setActive = shared ? shared.setIsActive : setLocalActive;

  const effectiveRange = isActive ? range : null;

  const { startIndex, endIndex } = useMemo(() => {
    if (!effectiveRange || data.length === 0) return { startIndex: undefined, endIndex: undefined };
    let s = data.findIndex((d) => getTime(d) >= effectiveRange.startTime);
    if (s === -1) s = 0;
    let e = data.length - 1;
    for (let i = data.length - 1; i >= 0; i--) {
      if (getTime(data[i]) <= effectiveRange.endTime) {
        e = i;
        break;
      }
    }
    return { startIndex: s, endIndex: Math.max(s, e) };
  }, [data, effectiveRange, getTime]);

  const visibleData = useMemo(() => {
    if (!effectiveRange) return data;
    return data.filter((d) => {
      const t = getTime(d);
      return t >= effectiveRange.startTime && t <= effectiveRange.endTime;
    });
  }, [data, effectiveRange, getTime]);

  const onBrushChange = (idxRange: { startIndex?: number; endIndex?: number }) => {
    if (idxRange.startIndex === undefined && idxRange.endIndex === undefined) {
      setRange(null);
      setActive(false);
      return;
    }
    const startItem = data[idxRange.startIndex ?? 0];
    const endItem = data[idxRange.endIndex ?? data.length - 1];
    if (startItem !== undefined && endItem !== undefined) {
      setRange({ startTime: getTime(startItem), endTime: getTime(endItem) });
      setActive(true);
    }
  };

  return {
    visibleData,
    startIndex,
    endIndex,
    onBrushChange,
    isRangeSelected: effectiveRange !== null,
    resetRange: () => {
      setRange(null);
      setActive(false);
    },
    rangeStart: range?.startTime ?? null,
    rangeEnd: range?.endTime ?? null,
    hasRememberedRange: range !== null,
    setRangeActive: setActive,
  };
}
