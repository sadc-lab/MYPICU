// ======================================
// Patient File Data Service
// ======================================

// ---------- Types ----------

export interface TimeSeriesDataPoint {
  charttime: string;
  valeur: number;
}

export interface ValidityData {
  id_patient: number;
  [key: string]: number;
}

export interface PatientFileData {
  Variable_age?: Array<{ noadmsip: number; dateofbirth: string }>;
  Variable_anti_epileptique?: Array<{ noadmsip: number; drugname: string; charttime: string }>;
  Variable_opioides?: Array<{ noadmsip: number; drugname: string; charttime: string; valeur: string }>;
  [key: string]: any;
}

// ---------- Cache ----------

const patientDataCache = new Map<string, PatientFileData>();

// ---------- Loaders ----------

export async function loadPatientFileData(patientId: string): Promise<PatientFileData | null> {
  const normalizedId = patientId.replace("#", "");

  if (patientDataCache.has(normalizedId)) {
    return patientDataCache.get(normalizedId)!;
  }

  try {
    const res = await fetch(`/data/patients/${normalizedId}.json`);
    if (!res.ok) return null;

    const data: PatientFileData = await res.json();
    patientDataCache.set(normalizedId, data);
    return data;
  } catch {
    return null;
  }
}

export function getAvailablePatientFileIds(): string[] {
  return ["8749", "6312"];
}

export function hasPatientFileData(patientId: string): boolean {
  return getAvailablePatientFileIds().includes(patientId.replace("#", ""));
}

// ---------- Helpers ----------

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const v = parseFloat(value.replace(",", "."));
    return isNaN(v) ? null : v;
  }
  return null;
}

export function extractTimeSeriesData(patientData: PatientFileData, variableKey: string): TimeSeriesDataPoint[] {
  const data = patientData[variableKey];
  if (!Array.isArray(data)) return [];

  return data
    .map((d: any) => ({
      charttime: d.charttime,
      valeur: parseNumericValue(d.valeur),
    }))
    .filter((d: any) => d.charttime && d.valeur !== null);
}

export function getLatestValue(
  patientData: PatientFileData,
  variableKey: string,
): { value: number; timestamp: string } | null {
  const series = extractTimeSeriesData(patientData, variableKey);
  if (series.length === 0) return null;

  const sorted = [...series].sort((a, b) => new Date(b.charttime).getTime() - new Date(a.charttime).getTime());

  return { value: sorted[0].valeur, timestamp: sorted[0].charttime };
}

export function getTimeSeriesForRange(
  patientData: PatientFileData,
  variableKey: string,
  hoursBack: number = 24,
): TimeSeriesDataPoint[] {
  const series = extractTimeSeriesData(patientData, variableKey);
  const cutoff = Date.now() - hoursBack * 3600 * 1000;
  return series.filter((d) => new Date(d.charttime).getTime() >= cutoff);
}

export function getAllTimeSeriesData(patientData: PatientFileData, variableKey: string): TimeSeriesDataPoint[] {
  return extractTimeSeriesData(patientData, variableKey);
}

export function isVariableSparse(patientData: PatientFileData, variableKey: string, threshold: number = 10): boolean {
  return extractTimeSeriesData(patientData, variableKey).length < threshold;
}

export function calculateAverage(series: TimeSeriesDataPoint[]): number {
  if (series.length === 0) return 0;
  return Math.round((series.reduce((a, b) => a + b.valeur, 0) / series.length) * 10) / 10;
}

export function calculateTimeInRanges(
  series: TimeSeriesDataPoint[],
  ranges: Array<{ min: number; max: number; label: string }>,
) {
  const total = series.length;
  if (!total) return [];

  return ranges.map((r) => {
    const count = series.filter((d) => d.valeur >= r.min && d.valeur < r.max).length;
    return {
      label: r.label,
      minutes: count,
      percentage: Math.round((count / total) * 100),
    };
  });
}

export function getAvailableVariables(patientData: PatientFileData): string[] {
  return Object.keys(patientData).filter((k) => k.startsWith("Variable_") && Array.isArray(patientData[k]));
}

export function getPatientMedications(patientData: PatientFileData) {
  return {
    antiEpileptiques: patientData.Variable_anti_epileptique ?? [],
    opioides: patientData.Variable_opioides ?? [],
  };
}

// ---------- Validity ----------

export const VALIDITY_DATA_KEYS = {
  PicHtic: "PicHticData_validite",
  PPC: "PPCData_validite",
  Temperature: "TemperatureData_validite",
  Glycemie: "GlycemieData_validite",
} as const;

export function getValidityData(patientData: PatientFileData, validityKey: string): ValidityData | null {
  const d = patientData[validityKey];
  return Array.isArray(d) && d.length > 0 ? (d[0] as ValidityData) : null;
}

// ===============================
// Adherence / validity calculation
// ===============================

// 1️⃣ Graph-based adherence
export function calculateTimeSeriesAdherence(
  data: TimeSeriesDataPoint[],
  target: { min: number; max: number },
  hoursBack: number,
  simulatedNow: Date,
): number | null {
  const start = simulatedNow.getTime() - hoursBack * 3600 * 1000;
  const window = data.filter((d) => new Date(d.charttime).getTime() >= start);
  if (!window.length) return null;

  const inRange = window.filter((d) => d.valeur >= target.min && d.valeur <= target.max);

  return Math.round((inRange.length / window.length) * 100);
}

// 2️⃣ Hourly validity adherence
export function calculateValidityAdherenceFromHourlyData(
  validityData: ValidityData | null,
  hoursBack: number = 24,
): { percentage: number; hasData: boolean } {
  if (!validityData) return { percentage: 0, hasData: false };

  const entries = Object.keys(validityData)
    .filter((k) => k.startsWith("H"))
    .map((k) => ({ hour: +k.slice(1), value: validityData[k] }))
    .filter((h) => h.hour < hoursBack);

  if (!entries.length) return { percentage: 0, hasData: false };

  const ok = entries.filter((e) => e.value === 0).length;
  return {
    percentage: Math.round((ok / entries.length) * 100),
    hasData: true,
  };
}

// Backward compatibility
export function calculateValidityAdherence(validityData: ValidityData | null, hoursBack: number = 24) {
  return calculateValidityAdherenceFromHourlyData(validityData, hoursBack);
}

export function getAdherenceStatus(percentage: number): "normal" | "warning" | "critical" {
  if (percentage >= 90) return "normal";
  if (percentage >= 80) return "warning";
  return "critical";
}
