// Service to load full patient data from Supabase (or JSON files as fallback)
// Patient data includes time-series vital signs, medications, and clinical data
import { loadPatientDataFromSupabase, checkPatientExistsInSupabase, getAvailablePatientIdsFromSupabase } from './supabasePatientData.service';

export interface TimeSeriesDataPoint {
  charttime: string;
  valeur: number;
}

export function getSimulatedNow(patientFileData: PatientFileData): Date {
  const allDates = Object.values(patientFileData.variables)
    .flat()
    .map((d) => new Date(d.charttime).getTime());

  return new Date(Math.max(...allDates));
}

export interface PatientFileData {
  Variable_age: Array<{ noadmsip: number; dateofbirth: string }>;
  Variable_anti_epileptique: Array<{ noadmsip: number; drugname: string; charttime: string }>;
  Variable_opioides: Array<{ noadmsip: number; drugname: string; charttime: string; variable: string; valeur: string }>;
  Variable_concentre_plaquettaire: Array<{
    encounterid: number;
    valeur: string;
    variable: string | null;
    datevariable: string;
  }>;
  // Time-series vital signs - keys vary by patient but follow pattern Variable_*
  [key: string]: unknown;
}

// Variable key mappings for brain metrics
// Keys must match EXACTLY the JSON file structure (case-sensitive)
export const BRAIN_VARIABLE_KEYS = {
  FC: "Variable_FC", // Heart rate (Fréquence Cardiaque)
  PIC: "Variable_PIC", // Intracranial pressure (Pression Intracrânienne)
  PPC: "Variable_PPC", // Cerebral perfusion pressure (Pression de Perfusion Cérébrale)
  PAM: "Variable_PAM", // Mean arterial pressure (Pression Artérielle Moyenne)
  PVC: "Variable_PVC", // Central venous pressure (Pression Veineuse Centrale)
  TEMP: "Variable_temperature", // Temperature (lowercase 't' in JSON)
  ETCO2: "Variable_ETCO2", // End-tidal CO2
  SPO2: "Variable_SPO2", // Oxygen saturation
  PLAQUETTES: "Variable_plaquettes", // Platelets (lowercase in JSON)
  HEMOGLOBINE: "Variable_hemoglobine", // Hemoglobin (lowercase in JSON)
  GLYCEMIE: "Variable_glycemie", // Blood sugar
  INR: "Variable_INR", // INR
  PACO2: "Variable_paco2", // PaCO2
} as const;

// Cache for loaded patient data
const patientDataCache = new Map<string, PatientFileData>();

// Known patient IDs cache (populated on first check)
let knownPatientIds: string[] | null = null;

export async function loadPatientFileData(patientId: string): Promise<PatientFileData | null> {
  // Normalize patient ID (remove # prefix if present)
  const normalizedId = patientId.replace("#", "");

  // Check cache first
  if (patientDataCache.has(normalizedId)) {
    return patientDataCache.get(normalizedId)!;
  }

  // Load from Supabase
  try {
    const supabaseData = await loadPatientDataFromSupabase(patientId);
    if (supabaseData) {
      patientDataCache.set(normalizedId, supabaseData);
      return supabaseData;
    }
  } catch (error) {
    console.error(`Failed to load patient data from Supabase for ${normalizedId}:`, error);
  }

  return null;
}

// Get available patient IDs (from Supabase or fallback)
export function getAvailablePatientFileIds(): string[] {
  // Return cached known IDs or fallback
  return knownPatientIds || ["8749", "6312", "8448"];
}

// Async version to populate from Supabase
export async function refreshAvailablePatientIds(): Promise<string[]> {
  try {
    const ids = await getAvailablePatientIdsFromSupabase();
    if (ids.length > 0) {
      knownPatientIds = ids;
      return ids;
    }
  } catch (error) {
    console.warn('Failed to fetch patient IDs from Supabase:', error);
  }
  return getAvailablePatientFileIds();
}

// Check if patient has detailed file data available
// Now checks Supabase first, with sync fallback for known patients
export function hasPatientFileData(patientId: string): boolean {
  const normalizedId = patientId.replace("#", "");
  // If we have cached data, it exists
  if (patientDataCache.has(normalizedId)) return true;
  // Check known IDs (includes Supabase-discovered patients)
  const knownIds = getAvailablePatientFileIds();
  return knownIds.includes(normalizedId);
}

// ============================================================
// CLINICAL VALIDITY RANGES
// Values outside these ranges are considered sensor artifacts
// or physiologically impossible and are filtered out.
// ============================================================
const CLINICAL_VALIDITY_RANGES: Record<string, { min: number; max: number }> = {
  Variable_PIC: { min: 2, max: 80 },         // ICP: 2-80 mmHg (0-1 are artifacts, normal 5-15)
  Variable_PPC: { min: 10, max: 150 },        // CPP: 10-150 mmHg (normal 50-70)
  Variable_PAM: { min: 20, max: 200 },        // MAP: 20-200 mmHg
  Variable_PVC: { min: -5, max: 40 },         // CVP: -5 to 40 mmHg
  Variable_FC: { min: 20, max: 300 },         // HR: 20-300 bpm
  Variable_temperature: { min: 30, max: 43 }, // Temp: 30-43°C
  Variable_EtCO2: { min: 5, max: 100 },       // EtCO2: 5-100 mmHg (normal ~35)
  Variable_SPO2: { min: 40, max: 100 },       // SpO2: 40-100%
  Variable_paco2: { min: 10, max: 120 },      // PaCO2: 10-120 mmHg
  Variable_glycemie: { min: 0.5, max: 50 },   // Glycémie: 0.5-50 mmol/L
  Variable_INR: { min: 0.5, max: 20 },        // INR: 0.5-20
  Variable_plaquettes: { min: 1, max: 1500 }, // Plaquettes: 1-1500 x10⁹/L
  Variable_hemoglobine: { min: 20, max: 250 },// Hb: 20-250 g/L
};

// Spike detection: if a value deviates more than this factor from
// the local median (computed over a sliding window), it's a spike.
const SPIKE_WINDOW_SIZE = 5;       // Points in each direction
const SPIKE_DEVIATION_FACTOR = 3;  // Multiplier of local MAD

/**
 * Check if a value is within the clinically valid range for a variable.
 */
function isWithinClinicalRange(variableKey: string, value: number): boolean {
  const range = CLINICAL_VALIDITY_RANGES[variableKey];
  if (!range) return true; // No range defined → accept
  return value >= range.min && value <= range.max;
}

/**
 * Remove isolated spikes from a sorted time-series.
 * Uses a sliding window median and MAD (median absolute deviation).
 */
function removeSpikes(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
  if (data.length < SPIKE_WINDOW_SIZE * 2 + 1) return data;

  return data.filter((point, index) => {
    const windowStart = Math.max(0, index - SPIKE_WINDOW_SIZE);
    const windowEnd = Math.min(data.length - 1, index + SPIKE_WINDOW_SIZE);
    const windowValues = data.slice(windowStart, windowEnd + 1).map(d => d.valeur);

    // Calculate median
    const sorted = [...windowValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Calculate MAD (Median Absolute Deviation)
    const deviations = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b);
    const mad = deviations[Math.floor(deviations.length / 2)] || 1;

    // If point deviates too far from local median, it's a spike
    const deviation = Math.abs(point.valeur - median);
    return deviation <= mad * SPIKE_DEVIATION_FACTOR;
  });
}

// Helper function to parse values with French decimal notation (comma as separator)
export function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Replace French decimal comma with period
    const normalized = value.replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Extract time-series data for a specific variable key
// Now applies clinical range filtering AND spike removal
export function extractTimeSeriesData(patientData: PatientFileData, variableKey: string): TimeSeriesDataPoint[] {
  const data = patientData[variableKey];
  if (!Array.isArray(data)) return [];

  // Step 1: Parse and filter null values + clinical range
  const parsed = data
    .filter((item: any) => {
      if (!item.charttime) return false;
      const value = parseNumericValue(item.valeur);
      if (value === null) return false;
      return isWithinClinicalRange(variableKey, value);
    })
    .map((item: any) => ({
      charttime: item.charttime,
      valeur: parseNumericValue(item.valeur)!,
    }));

  // Step 2: Remove spikes (only for time-series with enough data)
  return removeSpikes(parsed);
}

// Get latest value for a variable (uses same clinical filtering)
export function getLatestValue(
  patientData: PatientFileData,
  variableKey: string,
): { value: number; timestamp: string } | null {
  const data = patientData[variableKey];

  if (!Array.isArray(data) || data.length === 0) return null;

  // Filter valid entries using clinical ranges
  const validEntries = data
    .filter((item: any) => {
      if (!item.charttime) return false;
      const valeur = parseNumericValue(item.valeur);
      if (valeur === null) return false;
      return isWithinClinicalRange(variableKey, valeur);
    })
    .map((item: any) => ({
      charttime: item.charttime,
      valeur: parseNumericValue(item.valeur)!,
    }));

  if (validEntries.length === 0) return null;

  // Sort by timestamp descending to get most recent
  const sorted = [...validEntries].sort((a, b) => new Date(b.charttime).getTime() - new Date(a.charttime).getTime());

  return {
    value: sorted[0].valeur,
    timestamp: sorted[0].charttime,
  };
}

// Get time-series data filtered by time range
// Les données sont normalisées pour traiter les timestamps comme si c'était aujourd'hui
export function getTimeSeriesForRange(
  patientData: PatientFileData,
  variableKey: string,
  hoursBack: number = 24,
  sampleEveryMinutes: number = 15,
  normalizeToToday: boolean = true,
): TimeSeriesDataPoint[] {
  const allData = extractTimeSeriesData(patientData, variableKey);
  if (allData.length === 0) return [];

  // Sort by original timestamp
  const sorted = [...allData].sort((a, b) => new Date(b.charttime).getTime() - new Date(a.charttime).getTime());

  // Si normalizeToToday est true, on calcule le décalage pour que les données semblent d'aujourd'hui
  const latestOriginalTime = new Date(sorted[0].charttime).getTime();
  const now = new Date().getTime();
  const timeOffset = normalizeToToday ? now - latestOriginalTime : 0;

  const cutoffTime = now - hoursBack * 60 * 60 * 1000;

  // Filter to time range (using normalized time)
  const filtered = sorted.filter((item) => {
    const originalTime = new Date(item.charttime).getTime();
    const normalizedTime = originalTime + timeOffset;
    return normalizedTime >= cutoffTime;
  });

  // Normalize timestamps and sample data
  const normalized = filtered.map((item) => {
    const originalTime = new Date(item.charttime).getTime();
    const normalizedTime = new Date(originalTime + timeOffset);
    return {
      ...item,
      charttime: normalizedTime.toISOString(),
      originalCharttime: item.charttime,
    };
  });

  // Sample data at specified intervals to reduce points
  if (sampleEveryMinutes > 0) {
    const sampled: TimeSeriesDataPoint[] = [];
    let lastSampledTime = 0;

    // Process in chronological order
    const chronological = normalized.reverse();

    for (const item of chronological) {
      const itemTime = new Date(item.charttime).getTime();
      if (itemTime - lastSampledTime >= sampleEveryMinutes * 60 * 1000) {
        sampled.push(item);
        lastSampledTime = itemTime;
      }
    }

    return sampled;
  }

  return normalized.reverse(); // Return in chronological order
}

// Get ALL time-series data without sampling (for sparse data like INR)
export function getAllTimeSeriesData(
  patientData: PatientFileData,
  variableKey: string,
  hoursBack: number = 24,
  normalizeToToday: boolean = true,
): TimeSeriesDataPoint[] {
  return getTimeSeriesForRange(patientData, variableKey, hoursBack, 0, normalizeToToday);
}

// Check if a variable has sparse data (few data points)
export function isVariableSparse(patientData: PatientFileData, variableKey: string, threshold: number = 10): boolean {
  const allData = extractTimeSeriesData(patientData, variableKey);
  return allData.length < threshold;
}

// Get patient age from file data
export function getPatientAge(patientData: PatientFileData): { dateofbirth: string } | null {
  const ageData = patientData.Variable_age;
  if (Array.isArray(ageData) && ageData.length > 0) {
    return { dateofbirth: ageData[0].dateofbirth };
  }
  return null;
}

// Get medications from file data
export function getPatientMedications(patientData: PatientFileData): {
  antiEpileptiques: Array<{ drugname: string; charttime: string }>;
  opioides: Array<{ drugname: string; charttime: string; valeur: string }>;
} {
  return {
    antiEpileptiques: (patientData.Variable_anti_epileptique || []).map((item: any) => ({
      drugname: item.drugname,
      charttime: item.charttime,
    })),
    opioides: (patientData.Variable_opioides || []).map((item: any) => ({
      drugname: item.drugname,
      charttime: item.charttime,
      valeur: item.valeur,
    })),
  };
}

// Calculate average value for time series
export function calculateAverage(timeSeries: TimeSeriesDataPoint[]): number {
  if (timeSeries.length === 0) return 0;
  const sum = timeSeries.reduce((acc, item) => acc + item.valeur, 0);
  return Math.round((sum / timeSeries.length) * 10) / 10;
}

// Calculate time distribution in ranges (for PIC analysis)
export function calculateTimeInRanges(
  timeSeries: TimeSeriesDataPoint[],
  ranges: Array<{ min: number; max: number; label: string }>,
): Array<{ label: string; minutes: number; percentage: number }> {
  if (timeSeries.length === 0) return [];

  const results = ranges.map((range) => ({
    label: range.label,
    count: 0,
    min: range.min,
    max: range.max,
  }));

  timeSeries.forEach((item) => {
    for (const result of results) {
      if (item.valeur >= result.min && item.valeur < result.max) {
        result.count++;
        break;
      }
    }
  });

  const total = timeSeries.length;

  return results.map((r) => ({
    label: r.label,
    minutes: r.count, // Each data point is ~1 minute
    percentage: Math.round((r.count / total) * 100),
  }));
}

// Get all available variable keys from patient data
export function getAvailableVariables(patientData: PatientFileData): string[] {
  return Object.keys(patientData).filter(
    (key) =>
      key.startsWith("Variable_") &&
      Array.isArray(patientData[key]) &&
      (patientData[key] as any[]).length > 0 &&
      (patientData[key] as any[])[0]?.charttime !== undefined,
  );
}

// Validity data keys mapping for all indicators
// Keys must match EXACTLY the JSON file structure
export const VALIDITY_DATA_KEYS = {
  // Clinical indicators (Adhérence aux cibles recommandées)
  PositionTete: "PositionTeteData_validite", // Tête - matches JSON
  PicHtic: "PicHticData_validite", // PIC
  PPC: "PPCData_validite", // PPC
  Temperature: "TemperatureData_validite", // Temp - matches JSON
  PaCO2: "PaCO2Data_validite", // PaCO2 - matches JSON
  Glycemie: "GlycemieData_validite", // Glycémie
  Hemoglobine: "HemoglobineData_validite", // Hb - matches JSON
  INR: "INRData_validite", // INR - matches JSON
  Plaquettes: "PlaquettesData_validite", // Plaquettes - matches JSON
  // Monitoring interventions (Monitorage et interventions en place)
  PicMonitorage: "PicMonitorageData_validite",
  PupilleDroite: "PupilleDroiteData_validite",
  PAM: "PAMData_validite",
  Hypnotique: "HypnotiqueData_validite",
  PupilleGauche: "PupilleGaucheData_validite",
  Propofol: "PropofolData_validite",
  PVC: "PVCData_validite",
  AntiEpileptique: "AntiEpileptiqueData_validite",
  Opioides: "OpioidesData_validite",
  Nutrition: "NutritionData_validite",
  EtCO2: "EtCO2Data_validite",
} as const;

export interface ValidityData {
  id_patient: number;
  [key: string]: number; // H0, H1, H2, etc.
}

// Get validity data for a specific monitoring item
export function getValidityData(patientData: PatientFileData, validityKey: string): ValidityData | null {
  const data = patientData[validityKey];
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as ValidityData;
}

// Calculate adherence percentage from validity data for a specific time range
// In JSON: 0 = adhérent, 1 = non adhérent
// hoursBack: number of hours from start of stay (e.g., 3, 6, 12, 24, 96 for stay)
// Returns null if no data available
export function calculateValidityAdherence(
  validityData: ValidityData | null,
  hoursBack?: number,
): {
  adherent: number;
  total: number;
  percentage: number;
  hasData: boolean;
} {
  if (!validityData) return { adherent: 0, total: 0, percentage: 100, hasData: false };

  let hourKeys = Object.keys(validityData)
    .filter((k) => k.startsWith("H"))
    .sort((a, b) => parseInt(a.replace("H", "")) - parseInt(b.replace("H", "")));

  if (hourKeys.length === 0) return { adherent: 0, total: 0, percentage: 100, hasData: false };

  // If hoursBack is specified, take the first N hours from start of stay
  if (hoursBack && hoursBack > 0) {
    // Get hours from the beginning (H0, H1, ... up to hoursBack)
    hourKeys = hourKeys.slice(0, hoursBack);
  }

  const total = hourKeys.length;
  // 0 = adhérent, 1 = non adhérent
  const adherent = hourKeys.filter((k) => validityData[k] === 0).length;

  return {
    adherent,
    total,
    percentage: total > 0 ? Math.round((adherent / total) * 100) : 100,
    hasData: true,
  };
}

// Get validity status for first N hours of stay
// In JSON: 0 = adhérent, 1 = non adhérent
export function getLatestValidityStatus(
  validityData: ValidityData | null,
  firstNHours: number = 24,
): "normal" | "warning" | "critical" {
  if (!validityData) return "normal";

  const hourKeys = Object.keys(validityData)
    .filter((k) => k.startsWith("H"))
    .sort((a, b) => parseInt(a.replace("H", "")) - parseInt(b.replace("H", "")))
    .slice(0, firstNHours);

  if (hourKeys.length === 0) return "normal";

  // 0 = adhérent, 1 = non adhérent
  const adherentCount = hourKeys.filter((k) => validityData[k] === 0).length;
  const percentage = (adherentCount / hourKeys.length) * 100;

  if (percentage >= 80) return "normal";
  if (percentage >= 50) return "warning";
  return "critical";
}

// Get adherence status color based on percentage
// ≥90% → grey (normal), 80-90% → orange (warning), <80% → red (critical)
export function getAdherenceStatus(percentage: number): "normal" | "warning" | "critical" {
  if (percentage >= 90) return "normal";
  if (percentage >= 80) return "warning";
  return "critical";
}

// Get all monitoring interventions status from patient data
export function getMonitoringInterventionsStatus(
  patientData: PatientFileData,
  hoursBack?: number,
): Array<{
  key: string;
  label: string;
  status: "normal" | "warning" | "critical";
  adherencePercentage: number;
}> {
  const mappings: Array<{ key: keyof typeof VALIDITY_DATA_KEYS; label: string }> = [
    { key: "Opioides", label: "Opioide" },
    { key: "Hypnotique", label: "Hypnotique" },
    { key: "Propofol", label: "Propofol 48h" },
    { key: "PicMonitorage", label: "PIC" },
    { key: "PAM", label: "PAM" },
    { key: "PVC", label: "PVC" },
    { key: "EtCO2", label: "ETCO2" },
    { key: "Temperature", label: "Température" },
  ];

  return mappings.map(({ key, label }) => {
    const validityKey = VALIDITY_DATA_KEYS[key];
    const validityData = getValidityData(patientData, validityKey);
    const { percentage } = calculateValidityAdherence(validityData, hoursBack);
    const status = getAdherenceStatus(percentage);

    return {
      key,
      label,
      status,
      adherencePercentage: percentage,
    };
  });
}

// Get all clinical indicators status from patient data
export function getClinicalIndicatorsStatus(
  patientData: PatientFileData,
  hoursBack?: number,
): Array<{
  key: string;
  label: string;
  status: "normal" | "warning" | "critical";
  adherencePercentage: number;
}> {
  const mappings: Array<{ key: keyof typeof VALIDITY_DATA_KEYS; label: string }> = [
    { key: "PositionTete", label: "Tête" },
    { key: "PicHtic", label: "PIC" },
    { key: "PPC", label: "PPC" },
    { key: "Temperature", label: "Temp." },
    { key: "PaCO2", label: "PaCO2" },
    { key: "Glycemie", label: "Glycémie" },
    { key: "Hemoglobine", label: "Hb" },
    { key: "INR", label: "INR" },
    { key: "Plaquettes", label: "Plaquettes" },
  ];

  return mappings.map(({ key, label }) => {
    const validityKey = VALIDITY_DATA_KEYS[key];
    const validityData = getValidityData(patientData, validityKey);
    const { percentage } = calculateValidityAdherence(validityData, hoursBack);
    const status = getAdherenceStatus(percentage);

    return {
      key,
      label,
      status,
      adherencePercentage: percentage,
    };
  });
}

// ============================================================
// NEUROLOGICAL STATE COMPUTATION
// Determines current and historical neuro state from PIC + PPC data
// ============================================================

export type NeuroStateType = "controlled" | "htic" | "htic_ischemia" | "ischemia" | "hyperemia";

export interface NeuroStateResult {
  /** Current instantaneous state */
  currentState: NeuroStateType;
  /** Human-readable label */
  currentStateLabel: string;
  /** Time since last state change (formatted) */
  currentStateSince: string | null;
  /** Distribution of time in each state (percentage) */
  history: {
    hyperemia: number;
    hticWithIschemia: number;
    htic: number;
    ischemia: number;
    controlled: number;
  };
  /** Whether we have enough data to compute */
  hasData: boolean;
}

const NEURO_STATE_LABELS: Record<NeuroStateType, string> = {
  controlled: "Contrôlé",
  htic: "HTIC",
  htic_ischemia: "HTIC + Ischémie",
  ischemia: "Ischémie",
  hyperemia: "Hyperémie",
};

/**
 * Determine the neurological state from a single PIC + PPC measurement.
 * 
 * Clinical logic:
 * - PIC ≥ 20 mmHg → HTIC (intracranial hypertension)
 * - PPC < 50 mmHg → Ischemia (cerebral hypoperfusion)
 * - PIC ≥ 20 AND PPC < 50 → HTIC + Ischemia
 * - PPC > 80 mmHg (with normal PIC) → Hyperemia
 * - Otherwise → Controlled
 */
function classifyNeuroState(pic: number | null, ppc: number | null): NeuroStateType {
  const isHtic = pic !== null && pic >= 20;
  const isIschemia = ppc !== null && ppc < 50;
  const isHyperemia = ppc !== null && ppc > 80 && !isHtic;

  if (isHtic && isIschemia) return "htic_ischemia";
  if (isHtic) return "htic";
  if (isIschemia) return "ischemia";
  if (isHyperemia) return "hyperemia";
  return "controlled";
}

/**
 * Compute the neurological state dynamically from PIC and PPC time-series data.
 * 
 * @param patientData - The loaded patient file data
 * @param hoursBack - Number of hours to look back for history distribution
 * @returns NeuroStateResult with current state and time distribution
 */
export function computeNeurologicalState(
  patientData: PatientFileData,
  hoursBack: number = 24,
): NeuroStateResult {
  const noDataResult: NeuroStateResult = {
    currentState: "controlled",
    currentStateLabel: "Contrôlé",
    currentStateSince: null,
    history: { hyperemia: 0, hticWithIschemia: 0, htic: 0, ischemia: 0, controlled: 100 },
    hasData: false,
  };

  // Get PIC and PPC time series (normalized to today)
  const picSeries = getTimeSeriesForRange(patientData, "Variable_PIC", hoursBack, 5, true);
  const ppcSeries = getTimeSeriesForRange(patientData, "Variable_PPC", hoursBack, 5, true);

  if (picSeries.length === 0 && ppcSeries.length === 0) return noDataResult;

  // Build a merged timeline with closest PIC/PPC values
  // Index PPC by timestamp for fast lookup
  const ppcByTime = new Map<number, number>();
  for (const p of ppcSeries) {
    ppcByTime.set(new Date(p.charttime).getTime(), p.valeur);
  }

  // Use PIC as primary timeline (since PIC drives HTIC detection)
  const primarySeries = picSeries.length > 0 ? picSeries : ppcSeries;
  
  // Compute state at each time point
  interface StatePoint { time: number; state: NeuroStateType }
  const stateTimeline: StatePoint[] = [];

  for (const point of primarySeries) {
    const time = new Date(point.charttime).getTime();
    const picVal = picSeries.length > 0 ? point.valeur : null;
    
    // Find closest PPC value (within 30 min)
    let closestPpc: number | null = null;
    let minDiff = 30 * 60 * 1000; // 30 min max
    for (const [ppcTime, ppcVal] of ppcByTime) {
      const diff = Math.abs(ppcTime - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestPpc = ppcVal;
      }
    }

    const state = classifyNeuroState(picVal, closestPpc);
    stateTimeline.push({ time, state });
  }

  if (stateTimeline.length === 0) return noDataResult;

  // Sort chronologically
  stateTimeline.sort((a, b) => a.time - b.time);

  // Current state = last data point
  const currentState = stateTimeline[stateTimeline.length - 1].state;

  // Find when current state started (walk backwards)
  let stateChangeTime: number | null = null;
  for (let i = stateTimeline.length - 2; i >= 0; i--) {
    if (stateTimeline[i].state !== currentState) {
      stateChangeTime = stateTimeline[i + 1].time;
      break;
    }
  }

  // Format "since" duration
  let currentStateSince: string | null = null;
  if (stateChangeTime) {
    const diffMs = Date.now() - stateChangeTime;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours > 0) {
      currentStateSince = `depuis ${diffHours}h${diffMins > 0 ? String(diffMins).padStart(2, '0') : ''}`;
    } else {
      currentStateSince = `depuis ${diffMins}min`;
    }
  }

  // Calculate time distribution (weighted by inter-point intervals)
  const totalDurations: Record<NeuroStateType, number> = {
    controlled: 0, htic: 0, htic_ischemia: 0, ischemia: 0, hyperemia: 0,
  };
  let totalDuration = 0;

  for (let i = 0; i < stateTimeline.length - 1; i++) {
    const duration = stateTimeline[i + 1].time - stateTimeline[i].time;
    totalDurations[stateTimeline[i].state] += duration;
    totalDuration += duration;
  }

  // Add last segment (assume it extends to now)
  if (stateTimeline.length > 0) {
    const lastDuration = Date.now() - stateTimeline[stateTimeline.length - 1].time;
    const cappedDuration = Math.min(lastDuration, 30 * 60 * 1000); // Cap at 30 min
    totalDurations[stateTimeline[stateTimeline.length - 1].state] += cappedDuration;
    totalDuration += cappedDuration;
  }

  const toPercent = (d: number) => totalDuration > 0 ? Math.round((d / totalDuration) * 100) : 0;

  return {
    currentState,
    currentStateLabel: NEURO_STATE_LABELS[currentState],
    currentStateSince,
    history: {
      hyperemia: toPercent(totalDurations.hyperemia),
      hticWithIschemia: toPercent(totalDurations.htic_ischemia),
      htic: toPercent(totalDurations.htic),
      ischemia: toPercent(totalDurations.ischemia),
      controlled: toPercent(totalDurations.controlled),
    },
    hasData: true,
  };
}
