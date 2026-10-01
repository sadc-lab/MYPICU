import { supabase } from "@/integrations/supabase/client";

/**
 * Brain autoregulation for the current ward.
 *
 * The OptiBrain module computes these values; this reads them. It is not
 * recomputed here: the browser previously reimplemented the correlation and
 * the two implementations do not agree numerically, which meant the figure on
 * screen could differ from the one in the clinical record.
 *
 * Adherence per indicator stays in `patient_validity`, also produced by the
 * module. The exploratory study page keeps its own browser-side engine, which
 * runs on a file a clinician uploaded rather than on a live inpatient.
 */
export interface AutoregulationResult {
  mode: "prx" | "cox";
  optimalPressure: number | null;
  inferiorLimit: number | null;
  superiorLimit: number | null;
  /** Lowest correlation index reached: near 0 is well tolerated, near 1 has failed. */
  minIndex: number | null;
  pressureVariable: string | null;
  signalVariable: string | null;
  computedAt: string | null;
  /**
   * The module's per-window analysis table. The dashboard draws the
   * pressure-to-index curve from this, so the curve and the headline figures
   * come from the same computation rather than being rebuilt separately.
   */
  rawTable: Array<Record<string, unknown>> | null;
}

const cache = new Map<string, AutoregulationResult[]>();

/** Result for one patient, preferring PRx where both modes were computed. */
export function pickPrimary(results: AutoregulationResult[]): AutoregulationResult | null {
  return results.find((r) => r.mode === "prx") ?? results[0] ?? null;
}

export async function loadAutoregulation(
  patientId: string,
): Promise<AutoregulationResult[]> {
  // Patient ids are stored with their leading '#', as '#' + encounterid.
  // Stripping it matched no rows and the panel read as never assessed.
  const dbPatientId = patientId.startsWith("#") ? patientId : `#${patientId}`;
  const cached = cache.get(dbPatientId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("patient_autoregulation")
    .select(
      "mode, optimal_pressure, inferior_limit, superior_limit, min_index, pressure_variable, signal_variable, computed_at, raw",
    )
    .eq("patient_id", dbPatientId);

  if (error) throw error;

  const results: AutoregulationResult[] = (data ?? []).map((row) => ({
    mode: row.mode as "prx" | "cox",
    optimalPressure: row.optimal_pressure == null ? null : Number(row.optimal_pressure),
    inferiorLimit: row.inferior_limit == null ? null : Number(row.inferior_limit),
    superiorLimit: row.superior_limit == null ? null : Number(row.superior_limit),
    minIndex: row.min_index == null ? null : Number(row.min_index),
    pressureVariable: row.pressure_variable,
    signalVariable: row.signal_variable,
    computedAt: row.computed_at,
    rawTable: Array.isArray(row.raw) ? (row.raw as Array<Record<string, unknown>>) : null,
  }));

  cache.set(dbPatientId, results);
  return results;
}

export function clearAutoregulationCache(patientId?: string): void {
  if (patientId) {
    cache.delete(patientId);
  } else {
    cache.clear();
  }
}

/**
 * Format an optimal pressure for display with its autoregulatory window.
 * Returns null when the module found no reliable plateau, so the caller shows
 * an explicit absence rather than a blank that reads like a missing value.
 */
export function describeAutoregulation(result: AutoregulationResult | null): string | null {
  if (!result || result.optimalPressure == null) return null;
  const unit = result.pressureVariable === "PAM" ? "mmHg" : "mmHg";
  if (result.inferiorLimit == null || result.superiorLimit == null) {
    return `${result.optimalPressure} ${unit}`;
  }
  return `${result.optimalPressure} ${unit} (cible ${result.inferiorLimit}–${result.superiorLimit})`;
}