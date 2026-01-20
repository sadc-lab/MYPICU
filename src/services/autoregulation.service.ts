// Service to load and parse autoregulation data for optimal PPC calculation
// Data comes from Fisher method analysis files

export interface AutoregulationDataPoint {
  horodate: string;
  pic: number | null;
  ppc: number | null;
  pam: number | null;
  prx: number | null;
  optimalPPC: number | null;
  lowerLimit: number | null;  // LLA - Lower Limit of Autoregulation
  upperLimit: number | null;  // ULA - Upper Limit of Autoregulation
}

export interface OptimalPPCResult {
  optimalPPC: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  prxScore: number | null;
  timestamp: string | null;
  hasData: boolean;
}

// Raw data structure from JSON file
interface RawAutoregulationEntry {
  [key: string]: string;
}

interface AutoregulationFileData {
  P8448_Full_AR_Table_3min_Fisher?: RawAutoregulationEntry[];
  [key: string]: RawAutoregulationEntry[] | undefined;
}

// Cache for loaded autoregulation data
const autoregulationCache = new Map<string, AutoregulationFileData>();

// Available patient IDs with autoregulation data
const AVAILABLE_AUTOREGULATION_PATIENTS = ["8448"];

export function hasAutoregulationData(patientId: string): boolean {
  const normalizedId = patientId.replace("#", "");
  return AVAILABLE_AUTOREGULATION_PATIENTS.includes(normalizedId);
}

export async function loadAutoregulationData(patientId: string): Promise<AutoregulationFileData | null> {
  const normalizedId = patientId.replace("#", "");
  
  // Check cache first
  if (autoregulationCache.has(normalizedId)) {
    return autoregulationCache.get(normalizedId)!;
  }
  
  try {
    const response = await fetch(`/autoregulation_ppc_optimale_${normalizedId}.json`);
    if (!response.ok) {
      console.warn(`Autoregulation data not found for patient: ${normalizedId}`);
      return null;
    }
    
    const data: AutoregulationFileData = await response.json();
    autoregulationCache.set(normalizedId, data);
    return data;
  } catch (error) {
    console.error(`Error loading autoregulation data for patient: ${normalizedId}`, error);
    return null;
  }
}

// Parse a CSV-style row from the JSON format
// The key contains column headers, the value contains comma-separated data
function parseCSVRow(entry: RawAutoregulationEntry): Map<string, string> {
  const result = new Map<string, string>();
  
  for (const [headerString, valueString] of Object.entries(entry)) {
    const headers = headerString.split(",");
    const values = valueString.split(",");
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].trim();
      const value = values[i]?.trim() || "";
      result.set(header, value);
    }
  }
  
  return result;
}

// Parse numeric value, handling French decimal notation
function parseNumericValue(value: string): number | null {
  if (!value || value === "") return null;
  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

// Get the latest optimal PPC value from a specific time window
// windowMinutes: PRx calculation window (5, 10, 15, 30, 60, 90)
// windowHours: lookback window (2, 4, 8, 12, 24)
export function getOptimalPPC(
  data: AutoregulationFileData,
  windowMinutes: number = 30,
  windowHours: number = 4
): OptimalPPCResult {
  const defaultResult: OptimalPPCResult = {
    optimalPPC: null,
    lowerLimit: null,
    upperLimit: null,
    prxScore: null,
    timestamp: null,
    hasData: false,
  };
  
  // Find the Fisher table data
  const tableKey = Object.keys(data).find(k => k.includes("Fisher"));
  if (!tableKey) return defaultResult;
  
  const tableData = data[tableKey];
  if (!Array.isArray(tableData) || tableData.length === 0) return defaultResult;
  
  // Column names for the specified window
  const optimalPPCCol = `Optimal_PPC_${windowMinutes}min${windowHours}h`;
  const llaCol = `LLA_${windowMinutes}min${windowHours}h`;
  const ulaCol = `ULA_${windowMinutes}min${windowHours}h`;
  const prxScoreCol = `PRx_Score_${windowMinutes}min${windowHours}h`;
  
  // Search from the end to find the most recent valid data
  for (let i = tableData.length - 1; i >= 0; i--) {
    const row = parseCSVRow(tableData[i]);
    
    const optimalPPC = parseNumericValue(row.get(optimalPPCCol) || "");
    const lla = parseNumericValue(row.get(llaCol) || "");
    const ula = parseNumericValue(row.get(ulaCol) || "");
    const prxScore = parseNumericValue(row.get(prxScoreCol) || "");
    const horodate = row.get("Horodate") || null;
    
    // Return first row with valid optimal PPC
    if (optimalPPC !== null) {
      return {
        optimalPPC,
        lowerLimit: lla,
        upperLimit: ula,
        prxScore,
        timestamp: horodate,
        hasData: true,
      };
    }
  }
  
  return defaultResult;
}

// Get time series of optimal PPC for charting
export function getOptimalPPCTimeSeries(
  data: AutoregulationFileData,
  windowMinutes: number = 30,
  windowHours: number = 4,
  hoursBack: number = 24
): AutoregulationDataPoint[] {
  const result: AutoregulationDataPoint[] = [];
  
  const tableKey = Object.keys(data).find(k => k.includes("Fisher"));
  if (!tableKey) return result;
  
  const tableData = data[tableKey];
  if (!Array.isArray(tableData)) return result;
  
  const optimalPPCCol = `Optimal_PPC_${windowMinutes}min${windowHours}h`;
  const llaCol = `LLA_${windowMinutes}min${windowHours}h`;
  const ulaCol = `ULA_${windowMinutes}min${windowHours}h`;
  
  const now = new Date();
  const cutoffTime = now.getTime() - hoursBack * 60 * 60 * 1000;
  
  // Find the latest timestamp in the data for time normalization
  let latestDataTime = 0;
  for (const entry of tableData) {
    const row = parseCSVRow(entry);
    const horodate = row.get("Horodate");
    if (horodate) {
      const time = new Date(horodate).getTime();
      if (time > latestDataTime) latestDataTime = time;
    }
  }
  
  const timeOffset = now.getTime() - latestDataTime;
  
  for (const entry of tableData) {
    const row = parseCSVRow(entry);
    
    const horodate = row.get("Horodate");
    if (!horodate) continue;
    
    const originalTime = new Date(horodate).getTime();
    const normalizedTime = originalTime + timeOffset;
    
    // Filter by time range
    if (normalizedTime < cutoffTime) continue;
    
    const optimalPPC = parseNumericValue(row.get(optimalPPCCol) || "");
    const lla = parseNumericValue(row.get(llaCol) || "");
    const ula = parseNumericValue(row.get(ulaCol) || "");
    const pic = parseNumericValue(row.get("PIC") || "");
    const ppc = parseNumericValue(row.get("PPC") || "");
    const pam = parseNumericValue(row.get("PAM") || "");
    const prx = parseNumericValue(row.get("PRx") || row.get(`PRx_${windowMinutes}min`) || "");
    
    result.push({
      horodate: new Date(normalizedTime).toISOString(),
      pic,
      ppc,
      pam,
      prx,
      optimalPPC,
      lowerLimit: lla,
      upperLimit: ula,
    });
  }
  
  return result.sort((a, b) => 
    new Date(a.horodate).getTime() - new Date(b.horodate).getTime()
  );
}

// Get current PPC status relative to optimal range
export function getPPCStatusVsOptimal(
  currentPPC: number | null,
  optimalResult: OptimalPPCResult
): "optimal" | "below" | "above" | "unknown" {
  if (currentPPC === null || !optimalResult.hasData || optimalResult.optimalPPC === null) {
    return "unknown";
  }
  
  const lla = optimalResult.lowerLimit ?? optimalResult.optimalPPC - 5;
  const ula = optimalResult.upperLimit ?? optimalResult.optimalPPC + 5;
  
  if (currentPPC < lla) return "below";
  if (currentPPC > ula) return "above";
  return "optimal";
}
