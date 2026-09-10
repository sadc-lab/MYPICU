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
  // Limits are often unidentifiable over a whole recording: the pressure range
  // never crosses the threshold on both sides of the optimum. These carry the most
  // recent rolling-window estimate so the UI can show a labelled value instead of
  // inventing a range — the same convention as the study page.
  lowerLimitLastWindow?: number | null;
  upperLimitLastWindow?: number | null;
  lastWindowAt?: string | null;
}

// Raw data structure from JSON file
interface RawAutoregulationEntry {
  [key: string]: string;
}

// The Fisher table is located by name (any key containing "Fisher"), so no
// patient-specific key needs to be declared here.
interface AutoregulationFileData {
  [key: string]: RawAutoregulationEntry[] | undefined;
}

// Cache for loaded autoregulation data
const autoregulationCache = new Map<string, AutoregulationFileData>();

// Patient IDs shipping a PRx (invasive PIC/PAM) Fisher export in public/, as
// `autoregulation_ppc_optimale_<id>.json`. Empty for now: the only such file was
// patient 8448's, whose PAM, PPC and PRx columns were entirely empty (no ICP
// catheter — PIC was a constant 0), so it could never yield a PPCopt. Add an id
// back here only once a real export with populated PIC/PAM/PRx accompanies it.
const AVAILABLE_AUTOREGULATION_PATIENTS: string[] = [];

// Patient IDs using NIRS-based autoregulation (COx)
const NIRS_AUTOREGULATION_PATIENTS = ["8749"];

// Clinical safety: only patients with a real recording are declared as having
// autoregulation data. No simulated/demo values are ever produced — a patient
// without usable signal must show an explicit "no data" state, never a curve
// that could be mistaken for their own measurements.
export function hasAutoregulationData(patientId: string): boolean {
  const normalizedId = patientId.replace("#", "");
  return AVAILABLE_AUTOREGULATION_PATIENTS.includes(normalizedId) ||
         NIRS_AUTOREGULATION_PATIENTS.includes(normalizedId);
}

export function isNirsBasedPatient(patientId: string): boolean {
  const normalizedId = patientId.replace("#", "");
  return NIRS_AUTOREGULATION_PATIENTS.includes(normalizedId);
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

    // Rows with no pressure, no PRx and no computed limit carry nothing this
    // series can plot (PIC alone is charted elsewhere): keeping them would hand
    // the chart a run of nulls, which reads as "data available" while nothing is
    // drawable. Drop them so callers see a truly empty series.
    if (
      ppc === null && pam === null && prx === null &&
      optimalPPC === null && lla === null && ula === null
    ) {
      continue;
    }

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

// Data point for PRx vs PPC autoregulation curve
export interface AutoregulationCurvePoint {
  ppc: number;
  prx: number;
  count: number; // Number of samples at this PPC bin
}

// Generate PRx vs PPC curve data for visualization
// Groups PPC values into bins and calculates mean PRx for each bin
export function getAutoregulationCurveData(
  data: AutoregulationFileData,
  windowMinutes: number = 30,
  binSize: number = 5 // PPC bin size in mmHg
): {
  curveData: AutoregulationCurvePoint[];
  optimalPPC: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  minPrx: number | null;
} {
  const defaultResult = {
    curveData: [],
    optimalPPC: null,
    lowerLimit: null,
    upperLimit: null,
    minPrx: null,
  };
  
  const tableKey = Object.keys(data).find(k => k.includes("Fisher"));
  if (!tableKey) return defaultResult;
  
  const tableData = data[tableKey];
  if (!Array.isArray(tableData)) return defaultResult;
  
  const prxCol = `PRx_${windowMinutes}min`;
  
  // Collect all PPC-PRx pairs
  const ppcPrxPairs: Array<{ ppc: number; prx: number }> = [];
  
  for (const entry of tableData) {
    const row = parseCSVRow(entry);
    
    const ppc = parseNumericValue(row.get("PPC") || row.get("rawPPC") || "");
    const prx = parseNumericValue(row.get(prxCol) || row.get("PRx") || "");
    
    if (ppc !== null && prx !== null && ppc > 0) {
      ppcPrxPairs.push({ ppc, prx });
    }
  }
  
  // No usable PPC/PRx pair in the file (empty or already-computed export):
  // return an empty result so the UI shows "no data" instead of a curve.
  if (ppcPrxPairs.length === 0) {
    return defaultResult;
  }
  
  // Group by PPC bins and calculate mean PRx
  const bins = new Map<number, { sum: number; count: number }>();
  
  for (const { ppc, prx } of ppcPrxPairs) {
    const binCenter = Math.round(ppc / binSize) * binSize;
    const existing = bins.get(binCenter) || { sum: 0, count: 0 };
    existing.sum += prx;
    existing.count += 1;
    bins.set(binCenter, existing);
  }
  
  // Convert to curve data points
  const curveData: AutoregulationCurvePoint[] = [];
  let minPrx = Infinity;
  let optimalPPCFromCurve: number | null = null;
  
  const sortedBins = Array.from(bins.entries()).sort((a, b) => a[0] - b[0]);
  
  for (const [ppc, { sum, count }] of sortedBins) {
    if (count >= 3) { // Only include bins with enough samples
      const meanPrx = sum / count;
      curveData.push({
        ppc,
        prx: Math.round(meanPrx * 100) / 100,
        count,
      });
      
      if (meanPrx < minPrx) {
        minPrx = meanPrx;
        optimalPPCFromCurve = ppc;
      }
    }
  }
  
  // Estimate LLA and ULA (where PRx crosses 0.3 threshold)
  const PRX_THRESHOLD = 0.3;
  let lowerLimit: number | null = null;
  let upperLimit: number | null = null;
  
  // Find LLA (first crossing from left where PRx goes below threshold)
  for (let i = 0; i < curveData.length - 1; i++) {
    if (curveData[i].prx >= PRX_THRESHOLD && curveData[i + 1].prx < PRX_THRESHOLD) {
      lowerLimit = curveData[i].ppc;
      break;
    }
  }
  
  // Find ULA (first crossing from right where PRx goes above threshold)
  for (let i = curveData.length - 1; i > 0; i--) {
    if (curveData[i].prx >= PRX_THRESHOLD && curveData[i - 1].prx < PRX_THRESHOLD) {
      upperLimit = curveData[i].ppc;
      break;
    }
  }
  
  return {
    curveData,
    optimalPPC: optimalPPCFromCurve,
    lowerLimit,
    upperLimit,
    minPrx: minPrx === Infinity ? null : Math.round(minPrx * 100) / 100,
  };
}


// Re-export the parseCSVRow function for external use
export { parseCSVRow };
