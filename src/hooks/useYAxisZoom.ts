import { useMemo, useState } from "react";

export interface YAxisZoom {
  yDomain: [number, number];
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  isZoomed: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

/**
 * Échelle Y ajustable par le clinicien : un multiplicateur appliqué autour
 * du centre de l'échelle auto-calculée, plutôt qu'un domaine figé — reste
 * pertinent quand de nouvelles données arrivent en temps réel (le centre
 * suit les données, seul le niveau de zoom est mémorisé).
 */
export function useYAxisZoom(autoDomain: [number, number]): YAxisZoom {
  const [zoomFactor, setZoomFactor] = useState(1);

  const yDomain = useMemo((): [number, number] => {
    const [autoMin, autoMax] = autoDomain;
    if (zoomFactor === 1) return [autoMin, autoMax];
    const center = (autoMin + autoMax) / 2;
    const halfRange = ((autoMax - autoMin) / 2) * zoomFactor;
    return [Math.round(center - halfRange), Math.round(center + halfRange)];
  }, [autoDomain, zoomFactor]);

  return {
    yDomain,
    zoomIn: () => setZoomFactor((z) => Math.max(0.2, +(z * 0.8).toFixed(2))),
    zoomOut: () => setZoomFactor((z) => Math.min(5, +(z * 1.25).toFixed(2))),
    resetZoom: () => setZoomFactor(1),
    isZoomed: zoomFactor !== 1,
    canZoomIn: zoomFactor > 0.2,
    canZoomOut: zoomFactor < 5,
  };
}
