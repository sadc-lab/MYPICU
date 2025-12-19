// ===============================
// Adherence / validity calculation
// ===============================

// 1️⃣ Adhérence basée sur séries temporelles (GRAPHIQUES)
export function calculateTimeSeriesAdherence(
  data: TimeSeriesDataPoint[],
  target: { min: number; max: number },
  hoursBack: number,
  simulatedNow: Date,
): number | null {
  if (!data || data.length === 0) return null;

  const startTime = simulatedNow.getTime() - hoursBack * 60 * 60 * 1000;

  const window = data.filter((d) => new Date(d.charttime).getTime() >= startTime);

  if (window.length === 0) return null;

  const inRange = window.filter((d) => d.valeur >= target.min && d.valeur <= target.max);

  return Math.round((inRange.length / window.length) * 100);
}

// 2️⃣ Adhérence basée sur données de validité horaires (JSON *_validite)
export function calculateValidityAdherenceFromHourlyData(
  validityData: ValidityData | null,
  hoursBack: number = 24,
): number | null {
  if (!validityData) return null;

  const hourEntries = Object.keys(validityData)
    .filter((k) => k.startsWith("H"))
    .map((k) => ({
      hour: parseInt(k.replace("H", ""), 10),
      value: validityData[k],
    }))
    .filter((h) => h.hour < hoursBack);

  if (hourEntries.length === 0) return null;

  const adherentCount = hourEntries.filter((h) => h.value === 0).length;

  return Math.round((adherentCount / hourEntries.length) * 100);
}
