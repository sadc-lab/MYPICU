import { createContext, ReactNode, useState } from "react";

export interface TimeRange {
  startTime: number;
  endTime: number;
}

export interface ChartTimeRangeState {
  range: TimeRange | null;
  setRange: (range: TimeRange | null) => void;
  /** La plage est mémorisée (range !== null) mais peut être suspendue (isActive = false)
   * sans être supprimée — le clinicien peut ainsi passer sur "24h"/"Séjour" puis revenir
   * à sa plage personnalisée sans avoir à la resélectionner sur le graphique. */
  isActive: boolean;
  setIsActive: (active: boolean) => void;
}

export const ChartTimeRangeContext = createContext<ChartTimeRangeState | null>(null);

/**
 * Partage une seule plage de temps sélectionnée entre tous les graphiques
 * d'une page/module — choisir une période sur l'un l'applique aux autres,
 * sans forcer une échelle Y commune (chaque graphique recalcule la sienne
 * à partir de ses propres données dans cette plage).
 */
export const ChartTimeRangeProvider = ({ children }: { children: ReactNode }) => {
  const [range, setRange] = useState<TimeRange | null>(null);
  const [isActive, setIsActive] = useState(false);
  return (
    <ChartTimeRangeContext.Provider value={{ range, setRange, isActive, setIsActive }}>
      {children}
    </ChartTimeRangeContext.Provider>
  );
};
