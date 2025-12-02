// Service to load full patient data from JSON files
// Patient data includes time-series vital signs, medications, and clinical data

export interface PatientFileData {
  Variable_age: Array<{ noadmsip: number; dateofbirth: string }>;
  Variable_anti_epileptique: Array<{ noadmsip: number; drugname: string; charttime: string }>;
  Variable_opioides: Array<{ noadmsip: number; drugname: string; charttime: string; variable: string; valeur: string }>;
  Variable_concentre_plaquettaire: Array<{ encounterid: number; valeur: string; variable: string | null; datevariable: string }>;
  // Time-series vital signs data arrays with charttime and valeur
  [key: string]: unknown;
}

// Cache for loaded patient data
const patientDataCache = new Map<string, PatientFileData>();

export async function loadPatientFileData(patientId: string): Promise<PatientFileData | null> {
  // Normalize patient ID (remove # prefix if present)
  const normalizedId = patientId.replace('#', '');
  
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
  return ['8448', '6312'];
}

// Check if patient has detailed file data available
export function hasPatientFileData(patientId: string): boolean {
  const normalizedId = patientId.replace('#', '');
  return getAvailablePatientFileIds().includes(normalizedId);
}

// Extract time-series data for a specific variable
export function extractTimeSeriesData(
  patientData: PatientFileData,
  variableKey: string
): Array<{ charttime: string; valeur: number }> {
  const data = patientData[variableKey];
  if (!Array.isArray(data)) return [];
  
  return data
    .filter((item: any) => item.charttime && typeof item.valeur === 'number')
    .map((item: any) => ({
      charttime: item.charttime,
      valeur: item.valeur
    }));
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
      charttime: item.charttime
    })),
    opioides: (patientData.Variable_opioides || []).map((item: any) => ({
      drugname: item.drugname,
      charttime: item.charttime,
      valeur: item.valeur
    }))
  };
}
