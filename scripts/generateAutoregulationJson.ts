// Script to generate autoregulation JSON from CSV
// Run with: npx ts-node scripts/generateAutoregulationJson.ts

import * as fs from 'fs';
import * as path from 'path';

interface RawNirsPamData {
  timestamp: string;
  nirs: number | null;
  pam: number | null;
}

interface AutoregulationJsonEntry {
  Horodate: string;
  NIRS: string;
  PAM: string;
  COx_5min: string;
  COx_30min: string;
  Optimal_PAM_30min4h: string;
  LLA_30min4h: string;
  ULA_30min4h: string;
}

function parseNirsPamCsv(csvContent: string): RawNirsPamData[] {
  const lines = csvContent.trim().split('\n');
  const result: RawNirsPamData[] = [];
  
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

function calculateCOx(data: RawNirsPamData[], windowMinutes: number): (number | null)[] {
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
    
    if (nirsValues.length >= 5) {
      const cox = calculateCorrelation(nirsValues, pamValues);
      result.push(Math.round(cox * 100) / 100);
    } else {
      result.push(null);
    }
  }
  
  return result;
}

function calculateOptimalPAM(
  data: RawNirsPamData[],
  coxValues: (number | null)[],
  lookbackHours: number
): { optimal: number | null; lla: number | null; ula: number | null } {
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

// Main execution
const csvPath = path.join(__dirname, '../public/data/autoregulation_raw_8749.csv');
const outputPath = path.join(__dirname, '../public/autoregulation_nirs_8749.json');

console.log('Reading CSV from:', csvPath);
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const rawData = parseNirsPamCsv(csvContent);

console.log(`Parsed ${rawData.length} rows`);
const filteredData = rawData.filter(d => d.nirs !== null && d.pam !== null);
console.log(`Filtered to ${filteredData.length} rows with data`);

const cox5min = calculateCOx(filteredData, 5);
const cox30min = calculateCOx(filteredData, 30);
const optimalResult = calculateOptimalPAM(filteredData, cox30min, 4);

console.log('Optimal PAM:', optimalResult);

const entries: AutoregulationJsonEntry[] = [];
for (let i = 0; i < filteredData.length; i++) {
  const d = filteredData[i];
  entries.push({
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

const tableData = entries.map(entry => {
  const headers = Object.keys(entry).join(',');
  const values = Object.values(entry).join(',');
  return { [headers]: values };
});

const output = {
  P8749_Full_AR_Table_NIRS_Fisher: tableData
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log('Written to:', outputPath);
