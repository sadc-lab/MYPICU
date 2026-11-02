import type { AutoregulationResult } from "@/services/patientAutoregulation.service";

export interface AutoregulationWindowPoint {
  timestamp: number;
  inferiorLimit: number | null;
  superiorLimit: number | null;
  optimalPressure: number | null;
}

export interface ValidAutoregulationWindowPoint extends AutoregulationWindowPoint {
  inferiorLimit: number;
  superiorLimit: number;
}

const MAX_WINDOW_AGE_MS = 3 * 60 * 1000;

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getAutoregulationWindowSeries(
  result: AutoregulationResult | null,
): AutoregulationWindowPoint[] {
  if (!result?.rawTable) return [];

  const optimalColumn = result.mode === "cox" ? "Global_Optimal_PAM" : "Global_Optimal_PPC";
  return result.rawTable
    .map((row) => ({
      timestamp: new Date(String(row.Horodate ?? "")).getTime(),
      inferiorLimit: finiteNumber(row.Global_Inferior_Limit),
      superiorLimit: finiteNumber(row.Global_Superior_Limit),
      optimalPressure: finiteNumber(row[optimalColumn]),
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function getAutoregulationWindowAt(
  series: AutoregulationWindowPoint[],
  timestamp: number,
): ValidAutoregulationWindowPoint | null {
  let low = 0;
  let high = series.length - 1;
  let match: AutoregulationWindowPoint | null = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (series[middle].timestamp <= timestamp) {
      match = series[middle];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (
    !match
    || timestamp - match.timestamp > MAX_WINDOW_AGE_MS
    || match.inferiorLimit === null
    || match.superiorLimit === null
    || match.inferiorLimit > match.superiorLimit
  ) {
    return null;
  }
  return {
    ...match,
    inferiorLimit: match.inferiorLimit,
    superiorLimit: match.superiorLimit,
  };
}
