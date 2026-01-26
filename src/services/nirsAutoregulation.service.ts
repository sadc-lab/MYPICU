// Service to handle NIRS-based autoregulation data (COx calculation)
// Different from PRx-based autoregulation which uses PPC

export interface NirsDataPoint {
  timestamp: string;
  nirs: number | null;
  pam: number | null;
}

export interface NirsCurvePoint {
  pam: number;
  cox: number;
  count: number;
}

export interface NirsAutoregulationResult {
  curveData: NirsCurvePoint[];
  optimalPAM: number | null;
  lowerLimit: number | null;  // LLA
  upperLimit: number | null;  // ULA
  minCox: number | null;
  hasRealData: boolean;
}

// Cache for loaded CSV data
const nirsDataCache = new Map<string, NirsDataPoint[]>();

// Patient IDs with NIRS autoregulation data
const NIRS_AUTOREGULATION_PATIENTS = ["8749"];

export function hasNirsAutoregulationData(patientId: string): boolean {
  const normalizedId = patientId.replace("#", "");
  return NIRS_AUTOREGULATION_PATIENTS.includes(normalizedId);
}

// Parse CSV content to raw data points
function parseNirsCsv(csvContent: string): NirsDataPoint[] {
  const lines = csvContent.trim().split('\n');
  const result: NirsDataPoint[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    const timestamp = parts[0];
    const nirs = parts[1] && parts[1].trim() !== '' ? parseFloat(parts[1]) : null;
    const pam = parts[2] && parts[2].trim() !== '' ? parseFloat(parts[2]) : null;
    
    // Only include rows with actual data
    if (nirs !== null && pam !== null) {
      result.push({ timestamp, nirs, pam });
    }
  }
  
  return result;
}

// Load NIRS data from CSV file
export async function loadNirsData(patientId: string): Promise<NirsDataPoint[]> {
  const normalizedId = patientId.replace("#", "");
  
  if (nirsDataCache.has(normalizedId)) {
    return nirsDataCache.get(normalizedId)!;
  }
  
  try {
    const response = await fetch(`/data/autoregulation_raw_${normalizedId}.csv`);
    if (!response.ok) {
      console.warn(`NIRS data not found for patient: ${normalizedId}`);
      return [];
    }
    
    const csvContent = await response.text();
    const data = parseNirsCsv(csvContent);
    nirsDataCache.set(normalizedId, data);
    return data;
  } catch (error) {
    console.error(`Error loading NIRS data for patient: ${normalizedId}`, error);
    return [];
  }
}

// Calculate Pearson correlation coefficient
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// Calculate COx (correlation between NIRS and PAM) for each data point
function calculateCOxValues(data: NirsDataPoint[], windowMinutes: number): (number | null)[] {
  const result: (number | null)[] = [];
  const windowMs = windowMinutes * 60 * 1000;
  
  for (let i = 0; i < data.length; i++) {
    const currentTime = new Date(data[i].timestamp).getTime();
    const windowStart = currentTime - windowMs;
    
    const nirsValues: number[] = [];
    const pamValues: number[] = [];
    
    for (let j = i; j >= 0; j--) {
      const pointTime = new Date(data[j].timestamp).getTime();
      if (pointTime < windowStart) break;
      
      if (data[j].nirs !== null && data[j].pam !== null) {
        nirsValues.push(data[j].nirs);
        pamValues.push(data[j].pam);
      }
    }
    
    // Need at least 5 points for meaningful correlation
    if (nirsValues.length >= 5) {
      const cox = calculateCorrelation(nirsValues, pamValues);
      result.push(Math.round(cox * 100) / 100);
    } else {
      result.push(null);
    }
  }
  
  return result;
}

// Build the autoregulation curve (COx vs PAM)
export function buildNirsAutoregulationCurve(
  data: NirsDataPoint[],
  windowMinutes: number = 30,
  binSize: number = 5
): NirsAutoregulationResult {
  const defaultResult: NirsAutoregulationResult = {
    curveData: [],
    optimalPAM: null,
    lowerLimit: null,
    upperLimit: null,
    minCox: null,
    hasRealData: false,
  };
  
  if (data.length < 10) return defaultResult;
  
  // Calculate COx for each point
  const coxValues = calculateCOxValues(data, windowMinutes);
  
  // Group by PAM bins and calculate mean COx
  const bins = new Map<number, { sum: number; count: number }>();
  
  for (let i = 0; i < data.length; i++) {
    const pam = data[i].pam;
    const cox = coxValues[i];
    
    if (pam !== null && cox !== null) {
      const binCenter = Math.round(pam / binSize) * binSize;
      const existing = bins.get(binCenter) || { sum: 0, count: 0 };
      existing.sum += cox;
      existing.count += 1;
      bins.set(binCenter, existing);
    }
  }
  
  // Convert to curve data
  const curveData: NirsCurvePoint[] = [];
  let minCox = Infinity;
  let optimalPAM: number | null = null;
  
  const sortedBins = Array.from(bins.entries())
    .filter(([, { count }]) => count >= 3)
    .sort((a, b) => a[0] - b[0]);
  
  for (const [pam, { sum, count }] of sortedBins) {
    const meanCox = sum / count;
    curveData.push({
      pam,
      cox: Math.round(meanCox * 100) / 100,
      count,
    });
    
    if (meanCox < minCox) {
      minCox = meanCox;
      optimalPAM = pam;
    }
  }
  
  // Find LLA and ULA (where COx crosses 0.3 threshold)
  const COX_THRESHOLD = 0.3;
  let lowerLimit: number | null = null;
  let upperLimit: number | null = null;
  
  // Find LLA (from left, where COx drops below threshold)
  for (let i = 0; i < curveData.length - 1; i++) {
    if (curveData[i].cox >= COX_THRESHOLD && curveData[i + 1].cox < COX_THRESHOLD) {
      lowerLimit = curveData[i].pam;
      break;
    }
  }
  
  // Find ULA (from right, where COx rises above threshold)
  for (let i = curveData.length - 1; i > 0; i--) {
    if (curveData[i].cox >= COX_THRESHOLD && curveData[i - 1].cox < COX_THRESHOLD) {
      upperLimit = curveData[i].pam;
      break;
    }
  }
  
  // If no thresholds found, estimate from curve shape
  if (lowerLimit === null && optimalPAM !== null && curveData.length > 2) {
    const firstPAM = curveData[0].pam;
    lowerLimit = Math.round((optimalPAM + firstPAM) / 2);
  }
  
  if (upperLimit === null && optimalPAM !== null && curveData.length > 2) {
    const lastPAM = curveData[curveData.length - 1].pam;
    upperLimit = Math.round((optimalPAM + lastPAM) / 2);
  }
  
  return {
    curveData,
    optimalPAM,
    lowerLimit,
    upperLimit,
    minCox: minCox === Infinity ? null : Math.round(minCox * 100) / 100,
    hasRealData: curveData.length > 0,
  };
}

// Get current PAM and NIRS from the latest data
export function getCurrentNirsValues(data: NirsDataPoint[]): {
  currentPAM: number | null;
  currentNIRS: number | null;
  pamMin: number | null;
  pamMax: number | null;
} {
  if (data.length === 0) {
    return { currentPAM: null, currentNIRS: null, pamMin: null, pamMax: null };
  }
  
  const lastPoint = data[data.length - 1];
  
  // Calculate 24h range
  const now = new Date(lastPoint.timestamp).getTime();
  const cutoff24h = now - 24 * 60 * 60 * 1000;
  
  let pamMin = Infinity;
  let pamMax = -Infinity;
  
  for (const point of data) {
    const time = new Date(point.timestamp).getTime();
    if (time >= cutoff24h && point.pam !== null) {
      pamMin = Math.min(pamMin, point.pam);
      pamMax = Math.max(pamMax, point.pam);
    }
  }
  
  return {
    currentPAM: lastPoint.pam,
    currentNIRS: lastPoint.nirs,
    pamMin: pamMin === Infinity ? null : pamMin,
    pamMax: pamMax === -Infinity ? null : pamMax,
  };
}
