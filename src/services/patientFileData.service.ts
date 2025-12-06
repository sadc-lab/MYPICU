// Service to load full patient data from JSON files
// Patient data includes time-series vital signs, medications, and clinical data

export interface TimeSeriesDataPoint {
  charttime: string;
  valeur: number;
}

export interface PatientFileData {
  Variable_age: Array<{ noadmsip: number; dateofbirth: string }>;
  Variable_anti_epileptique: Array<{ noadmsip: number; drugname: string; charttime: string }>;
  Variable_opioides: Array<{ noadmsip: number; drugname: string; charttime: string; variable: string; valeur: string }>;
  Variable_concentre_plaquettaire: Array<{ encounterid: number; valeur: string; variable: string | null; datevariable: string }>;
  // Time-series vital signs - keys vary by patient but follow pattern Variable_*
  [key: string]: unknown;
}

// Variable key mappings for brain metrics
export const BRAIN_VARIABLE_KEYS = {
  FC: 'Variable_FC',           // Heart rate (Fréquence Cardiaque)
  PIC: 'Variable_PIC',         // Intracranial pressure (Pression Intracrânienne)
  PPC: 'Variable_PPC',         // Cerebral perfusion pressure (Pression de Perfusion Cérébrale)
  PAM: 'Variable_PAM',         // Mean arterial pressure (Pression Artérielle Moyenne)
  PVC: 'Variable_PVC',         // Central venous pressure (Pression Veineuse Centrale)
  TEMP: 'Variable_Temperature', // Temperature
  ETCO2: 'Variable_ETCO2',     // End-tidal CO2
  SPO2: 'Variable_SPO2',       // Oxygen saturation
} as const;

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

// Extract time-series data for a specific variable key
export function extractTimeSeriesData(
  patientData: PatientFileData,
  variableKey: string
): TimeSeriesDataPoint[] {
  const data = patientData[variableKey];
  if (!Array.isArray(data)) return [];
  
  return data
    .filter((item: any) => item.charttime && typeof item.valeur === 'number')
    .map((item: any) => ({
      charttime: item.charttime,
      valeur: item.valeur
    }));
}

// Get latest value for a variable
export function getLatestValue(
  patientData: PatientFileData,
  variableKey: string
): { value: number; timestamp: string } | null {
  const timeSeries = extractTimeSeriesData(patientData, variableKey);
  if (timeSeries.length === 0) return null;
  
  // Sort by timestamp descending
  const sorted = [...timeSeries].sort((a, b) => 
    new Date(b.charttime).getTime() - new Date(a.charttime).getTime()
  );
  
  return {
    value: sorted[0].valeur,
    timestamp: sorted[0].charttime
  };
}

// Get time-series data filtered by time range
export function getTimeSeriesForRange(
  patientData: PatientFileData,
  variableKey: string,
  hoursBack: number = 24,
  sampleEveryMinutes: number = 15
): TimeSeriesDataPoint[] {
  const allData = extractTimeSeriesData(patientData, variableKey);
  if (allData.length === 0) return [];
  
  // Find the most recent timestamp
  const sorted = [...allData].sort((a, b) => 
    new Date(b.charttime).getTime() - new Date(a.charttime).getTime()
  );
  
  const latestTime = new Date(sorted[0].charttime).getTime();
  const cutoffTime = latestTime - (hoursBack * 60 * 60 * 1000);
  
  // Filter to time range
  const filtered = sorted.filter(item => {
    const itemTime = new Date(item.charttime).getTime();
    return itemTime >= cutoffTime;
  });
  
  // Sample data at specified intervals to reduce points
  if (sampleEveryMinutes > 0) {
    const sampled: TimeSeriesDataPoint[] = [];
    let lastSampledTime = 0;
    
    // Process in chronological order
    const chronological = filtered.reverse();
    
    for (const item of chronological) {
      const itemTime = new Date(item.charttime).getTime();
      if (itemTime - lastSampledTime >= sampleEveryMinutes * 60 * 1000) {
        sampled.push(item);
        lastSampledTime = itemTime;
      }
    }
    
    return sampled;
  }
  
  return filtered.reverse(); // Return in chronological order
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

// Calculate average value for time series
export function calculateAverage(timeSeries: TimeSeriesDataPoint[]): number {
  if (timeSeries.length === 0) return 0;
  const sum = timeSeries.reduce((acc, item) => acc + item.valeur, 0);
  return Math.round((sum / timeSeries.length) * 10) / 10;
}

// Calculate time distribution in ranges (for PIC analysis)
export function calculateTimeInRanges(
  timeSeries: TimeSeriesDataPoint[],
  ranges: Array<{ min: number; max: number; label: string }>
): Array<{ label: string; minutes: number; percentage: number }> {
  if (timeSeries.length === 0) return [];
  
  const results = ranges.map(range => ({
    label: range.label,
    count: 0,
    min: range.min,
    max: range.max
  }));
  
  timeSeries.forEach(item => {
    for (const result of results) {
      if (item.valeur >= result.min && item.valeur < result.max) {
        result.count++;
        break;
      }
    }
  });
  
  const total = timeSeries.length;
  
  return results.map(r => ({
    label: r.label,
    minutes: r.count, // Each data point is ~1 minute
    percentage: Math.round((r.count / total) * 100)
  }));
}

// Get all available variable keys from patient data
export function getAvailableVariables(patientData: PatientFileData): string[] {
  return Object.keys(patientData).filter(key => 
    key.startsWith('Variable_') && 
    Array.isArray(patientData[key]) &&
    (patientData[key] as any[]).length > 0 &&
    (patientData[key] as any[])[0]?.charttime !== undefined
  );
}

// Validity data keys mapping for all indicators
// Keys must match EXACTLY the JSON file structure
export const VALIDITY_DATA_KEYS = {
  // Clinical indicators (Adhérence aux cibles recommandées)
  PositionTete: 'PositionTeteData_validite',      // Tête - matches JSON
  PicHtic: 'PicHticData_validite',                 // PIC 
  PPC: 'PPCData_validite',                         // PPC
  Temperature: 'TemperatureData_validite',         // Temp - matches JSON
  PaCO2: 'PaCO2Data_validite',                     // PaCO2 - matches JSON
  Glycemie: 'GlycemieData_validite',               // Glycémie
  Hemoglobine: 'HemoglobineData_validite',         // Hb - matches JSON
  INR: 'INRData_validite',                         // INR - matches JSON
  Plaquettes: 'PlaquettesData_validite',           // Plaquettes - matches JSON
  // Monitoring interventions (Monitorage et interventions en place)
  PicMonitorage: 'PicMonitorageData_validite',
  PupilleDroite: 'PupilleDroiteData_validite',
  PAM: 'PAMData_validite',
  Hypnotique: 'HypnotiqueData_validite',
  PupilleGauche: 'PupilleGaucheData_validite',
  Propofol: 'PropofolData_validite',
  PVC: 'PVCData_validite',
  AntiEpileptique: 'AntiEpileptiqueData_validite',
  Opioides: 'OpioidesData_validite',
  Nutrition: 'NutritionData_validite',
  EtCO2: 'EtCO2Data_validite',
} as const;

export interface ValidityData {
  id_patient: number;
  [key: string]: number; // H0, H1, H2, etc.
}

// Get validity data for a specific monitoring item
export function getValidityData(
  patientData: PatientFileData,
  validityKey: string
): ValidityData | null {
  const data = patientData[validityKey];
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as ValidityData;
}

// Calculate adherence percentage from validity data for a specific time range
// In JSON: 0 = adhérent, 1 = non adhérent
// hoursBack: number of hours to look back (e.g., 3, 6, 12, 24, 96 for stay)
// Returns null if no data available
export function calculateValidityAdherence(validityData: ValidityData | null, hoursBack?: number): {
  adherent: number;
  total: number;
  percentage: number;
  hasData: boolean;
} {
  if (!validityData) return { adherent: 0, total: 0, percentage: 100, hasData: false };
  
  let hourKeys = Object.keys(validityData)
    .filter(k => k.startsWith('H'))
    .sort((a, b) => parseInt(a.replace('H', '')) - parseInt(b.replace('H', '')));
  
  if (hourKeys.length === 0) return { adherent: 0, total: 0, percentage: 100, hasData: false };
  
  // If hoursBack is specified, only take the last N hours
  if (hoursBack && hoursBack > 0) {
    // Get the latest hours (from the end of the array)
    hourKeys = hourKeys.slice(-hoursBack);
  }
  
  const total = hourKeys.length;
  // 0 = adhérent, 1 = non adhérent
  const adherent = hourKeys.filter(k => validityData[k] === 0).length;
  
  return {
    adherent,
    total,
    percentage: total > 0 ? Math.round((adherent / total) * 100) : 100,
    hasData: true
  };
}

// Get latest validity status (checks last N hours, default 24)
// In JSON: 0 = adhérent, 1 = non adhérent
export function getLatestValidityStatus(
  validityData: ValidityData | null,
  lastNHours: number = 24
): 'normal' | 'warning' | 'critical' {
  if (!validityData) return 'normal';
  
  const hourKeys = Object.keys(validityData)
    .filter(k => k.startsWith('H'))
    .sort((a, b) => parseInt(b.replace('H', '')) - parseInt(a.replace('H', '')))
    .slice(0, lastNHours);
  
  if (hourKeys.length === 0) return 'normal';
  
  // 0 = adhérent, 1 = non adhérent
  const adherentCount = hourKeys.filter(k => validityData[k] === 0).length;
  const percentage = (adherentCount / hourKeys.length) * 100;
  
  if (percentage >= 80) return 'normal';
  if (percentage >= 50) return 'warning';
  return 'critical';
}

// Get adherence status color based on percentage
// ≥90% → grey (normal), 80-90% → orange (warning), <80% → red (critical)
export function getAdherenceStatus(percentage: number): 'normal' | 'warning' | 'critical' {
  if (percentage >= 90) return 'normal';
  if (percentage >= 80) return 'warning';
  return 'critical';
}

// Get all monitoring interventions status from patient data
export function getMonitoringInterventionsStatus(patientData: PatientFileData, hoursBack?: number): Array<{
  key: string;
  label: string;
  status: 'normal' | 'warning' | 'critical';
  adherencePercentage: number;
}> {
  const mappings: Array<{ key: keyof typeof VALIDITY_DATA_KEYS; label: string }> = [
    { key: 'Opioides', label: 'Opioide' },
    { key: 'Hypnotique', label: 'Hypnotique' },
    { key: 'Propofol', label: 'Propofol 48h' },
    { key: 'PicMonitorage', label: 'PIC' },
    { key: 'PAM', label: 'PAM' },
    { key: 'PVC', label: 'PVC' },
    { key: 'EtCO2', label: 'ETCO2' },
    { key: 'Temperature', label: 'Température' },
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
      adherencePercentage: percentage
    };
  });
}

// Get all clinical indicators status from patient data
export function getClinicalIndicatorsStatus(patientData: PatientFileData, hoursBack?: number): Array<{
  key: string;
  label: string;
  status: 'normal' | 'warning' | 'critical';
  adherencePercentage: number;
}> {
  const mappings: Array<{ key: keyof typeof VALIDITY_DATA_KEYS; label: string }> = [
    { key: 'PositionTete', label: 'Tête' },
    { key: 'PicHtic', label: 'PIC' },
    { key: 'PPC', label: 'PPC' },
    { key: 'Temperature', label: 'Temp.' },
    { key: 'PaCO2', label: 'PaCO2' },
    { key: 'Glycemie', label: 'Glycémie' },
    { key: 'Hemoglobine', label: 'Hb' },
    { key: 'INR', label: 'INR' },
    { key: 'Plaquettes', label: 'Plaquettes' },
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
      adherencePercentage: percentage
    };
  });
}
