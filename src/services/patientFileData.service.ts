// Service to load full patient data from JSON files
// Patient data includes time-series vital signs, medications, and clinical data

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

export async function loadPatientFileData(patientId: string): Promise<PatientFileData | null> {
  // Normalize patient ID (remove # prefix if present)
  const normalizedId = patientId.replace("#", "");

  // Check cache first
  if (patientDataCache.has(normalizedId)) {
    return patientDataCache.get(normalizedId)!;
  }

  try {
    const response = await fetch(`/data/patients/${normalizedId}.json`);
    if (!response.ok) {
      console.warn(`Patient file data not found for ID: ${normalizedId}`);
      return null;
    }

    const data: PatientFileData = await response.json();
    patientDataCache.set(normalizedId, data);
    return data;
  } catch (error) {
    console.error(`Error loading patient file data for ID: ${normalizedId}`, error);
    return null;
  }
}

// Get available patient IDs with file data
export function getAvailablePatientFileIds(): string[] {
  return ["8749", "6312"];
}

// Check if patient has detailed file data available
export function hasPatientFileData(patientId: string): boolean {
  const normalizedId = patientId.replace("#", "");
  return getAvailablePatientFileIds().includes(normalizedId);
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
export function extractTimeSeriesData(patientData: PatientFileData, variableKey: string): TimeSeriesDataPoint[] {
  const data = patientData[variableKey];
  if (!Array.isArray(data)) return [];

  return data
    .filter((item: any) => {
      if (!item.charttime) return false;
      const parsed = parseNumericValue(item.valeur);
      return parsed !== null;
    })
    .map((item: any) => ({
      charttime: item.charttime,
      valeur: parseNumericValue(item.valeur)!,
    }));
}

// Variables where certain values are not clinically valid (sensor error/disconnection)
// PIC/PPC: values <= 0 or < 5 are likely sensor errors (normal ICP is 5-15 mmHg)
const EXCLUDE_ZERO_VARIABLES = ["Variable_PIC", "Variable_PPC"];
const MIN_VALID_PIC_VALUE = 5; // Minimum clinically valid PIC value in mmHg

// Get latest value for a variable
export function getLatestValue(
  patientData: PatientFileData,
  variableKey: string,
): { value: number; timestamp: string } | null {
  const data = patientData[variableKey];

  if (!Array.isArray(data) || data.length === 0) return null;

  // Check if this variable should exclude invalid values
  const excludeInvalid = EXCLUDE_ZERO_VARIABLES.includes(variableKey);

  // Filter valid entries and ensure valeur is a number (handles French decimal notation)
  const validEntries = data
    .filter((item: any) => {
      if (!item.charttime) return false;
      const valeur = parseNumericValue(item.valeur);
      if (valeur === null) return false;
      // Exclude zero and aberrant low values for PIC/PPC
      if (excludeInvalid) {
        if (variableKey === "Variable_PIC" && valeur < MIN_VALID_PIC_VALUE) return false;
        if (variableKey === "Variable_PPC" && valeur <= 0) return false;
      }
      return true;
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
