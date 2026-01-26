// Utility to convert NIRS/PAM CSV data to autoregulation JSON format
// Calculates COx (Cerebral Oximetry Index) as correlation between NIRS and PAM

export interface RawNirsPamData {
  timestamp: string;
  nirs: number | null;
  pam: number | null;
}

export interface AutoregulationJsonEntry {
  Horodate: string;
  NIRS: string;
  PAM: string;
  COx_5min: string;
  COx_30min: string;
  Optimal_PAM_30min4h: string;
  LLA_30min4h: string;
  ULA_30min4h: string;
}

// Parse CSV content to raw data
export function parseNirsPamCsv(csvContent: string): RawNirsPamData[] {
  const lines = csvContent.trim().split('\n');
  const result: RawNirsPamData[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    const timestamp = parts[0];
    const nirs = parts[1] && parts[1].trim() !== '' ? parseFloat(parts[1]) : null;
    const pam = parts[2] && parts[2].trim() !== '' ? parseFloat(parts[2]) : null;
    
    result.push({ timestamp, nirs, pam });
  }
  
  return result;
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

// Calculate rolling COx (correlation between NIRS and PAM)
function calculateCOx(data: RawNirsPamData[], windowMinutes: number): (number | null)[] {
  const result: (number | null)[] = [];
  const windowMs = windowMinutes * 60 * 1000;
  
  for (let i = 0; i < data.length; i++) {
    const currentTime = new Date(data[i].timestamp).getTime();
    const windowStart = currentTime - windowMs;
    
    // Collect data points in window
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

// Calculate optimal PAM from COx curve
function calculateOptimalPAM(
  data: RawNirsPamData[],
  coxValues: (number | null)[],
  lookbackHours: number
): { optimal: number | null; lla: number | null; ula: number | null } {
  // Group PAM values by bins and calculate mean COx for each bin
  const binSize = 5;
  const bins = new Map<number, { sum: number; count: number }>();
  
  const lookbackMs = lookbackHours * 60 * 60 * 1000;
  const latestTime = new Date(data[data.length - 1].timestamp).getTime();
  const cutoffTime = latestTime - lookbackMs;
  
  for (let i = 0; i < data.length; i++) {
    const pointTime = new Date(data[i].timestamp).getTime();
    if (pointTime < cutoffTime) continue;
    
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
  
  // Find optimal PAM (lowest COx)
  let minCox = Infinity;
  let optimalPAM: number | null = null;
  
  const sortedBins = Array.from(bins.entries())
    .filter(([, { count }]) => count >= 3)
    .sort((a, b) => a[0] - b[0]);
  
  for (const [pam, { sum, count }] of sortedBins) {
    const meanCox = sum / count;
    if (meanCox < minCox) {
      minCox = meanCox;
      optimalPAM = pam;
    }
  }
  
  // Estimate LLA/ULA (where COx crosses 0.3)
  const COX_THRESHOLD = 0.3;
  let lla: number | null = null;
  let ula: number | null = null;
  
  for (let i = 0; i < sortedBins.length - 1; i++) {
    const cox1 = sortedBins[i][1].sum / sortedBins[i][1].count;
    const cox2 = sortedBins[i + 1][1].sum / sortedBins[i + 1][1].count;
    
    if (cox1 >= COX_THRESHOLD && cox2 < COX_THRESHOLD && lla === null) {
      lla = sortedBins[i][0];
    }
  }
  
  for (let i = sortedBins.length - 1; i > 0; i--) {
    const cox1 = sortedBins[i][1].sum / sortedBins[i][1].count;
    const cox2 = sortedBins[i - 1][1].sum / sortedBins[i - 1][1].count;
    
    if (cox1 >= COX_THRESHOLD && cox2 < COX_THRESHOLD && ula === null) {
      ula = sortedBins[i][0];
    }
  }
  
  return { optimal: optimalPAM, lla, ula };
}

// Convert raw data to autoregulation JSON format
export function convertToAutoregulationJson(rawData: RawNirsPamData[]): AutoregulationJsonEntry[] {
  // Filter to only rows with data (every 60s approximately)
  const filteredData = rawData.filter(d => d.nirs !== null && d.pam !== null);
  
  // Calculate COx for different windows
  const cox5min = calculateCOx(filteredData, 5);
  const cox30min = calculateCOx(filteredData, 30);
  
  // Calculate optimal PAM with 4h lookback
  const optimalResult = calculateOptimalPAM(filteredData, cox30min, 4);
  
  const result: AutoregulationJsonEntry[] = [];
  
  for (let i = 0; i < filteredData.length; i++) {
    const d = filteredData[i];
    
    result.push({
      Horodate: d.timestamp,
      NIRS: d.nirs?.toString() || '',
      PAM: d.pam?.toString() || '',
      COx_5min: cox5min[i]?.toString() || '',
      COx_30min: cox30min[i]?.toString() || '',
      Optimal_PAM_30min4h: optimalResult.optimal?.toString() || '',
      LLA_30min4h: optimalResult.lla?.toString() || '',
      ULA_30min4h: optimalResult.ula?.toString() || '',
    });
  }
  
  return result;
}

// Generate the final JSON structure compatible with autoregulation.service.ts
export function generateAutoregulationFile(entries: AutoregulationJsonEntry[]): object {
  // Convert to the expected format (key-value pairs where key is headers, value is data)
  const tableData = entries.map(entry => {
    const headers = Object.keys(entry).join(',');
    const values = Object.values(entry).join(',');
    return { [headers]: values };
  });
  
  return {
    P8749_Full_AR_Table_NIRS_Fisher: tableData
  };
}
