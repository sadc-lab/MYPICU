// NIRS-based autoregulation (COx) for the Optibrain dashboard.
//
// This module used to carry its own correlation/binning implementation, which
// disagreed with the study page on the same recording — patient 8749 read as
// PAMopt 35 mmHg (zone 10–93) here and 45 mmHg there. Four causes:
//   1. rows missing rSO₂ or PAM were dropped *before* windowing, so a 30-sample
//      window no longer spanned a comparable stretch of real time;
//   2. the window was expressed in minutes here, in samples there;
//   3. no physiological filter, so a bin at PAM = −15 mmHg was kept;
//   4. no robustness floor, so a 13-sample bin outranked a 562-sample one, and
//      absent LLA/ULA were replaced by invented range midpoints.
//
// It now delegates every computation to autoregComputation.service, the engine
// behind the study page, so both screens report the same numbers for the same
// recording. Only loading, caching and dashboard-shaped output live here.

import {
  parseAny,
  computeIndex,
  buildCurve,
  analyzeCurve,
  rollingOptimal,
  type RawSample,
} from "./autoregComputation.service";

export interface NirsDataPoint {
  timestamp: string;
  nirs: number | null;
  pam: number | null;
}

export interface NirsCurvePoint {
  pam: number;
  cox: number;
  count: number;
  /** Bin holds ≥ 2 % of the usable data; only these drive PAMopt and the limits. */
  robust: boolean;
}

export interface NirsAutoregulationResult {
  curveData: NirsCurvePoint[];
  optimalPAM: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  minCox: number | null;
  /** False when the curve never dips below the threshold: no interpretable optimum. */
  plateauValid: boolean;
  robustBins: number;
  hasRealData: boolean;
}

// Correlation window, in samples — the same value the study page uses, so the
// two screens compute COx over identical spans. Expressing it in minutes was one
// of the reasons the numbers diverged.
const COX_WINDOW_SAMPLES = 30;
const BIN_SIZE = 5;

// Cache of parsed recordings, keyed by normalized patient id.
const nirsSampleCache = new Map<string, RawSample[]>();

// Patient IDs with NIRS autoregulation data
const NIRS_AUTOREGULATION_PATIENTS = ["8749"];

export function hasNirsAutoregulationData(patientId: string): boolean {
  const normalizedId = patientId.replace("#", "");
  return NIRS_AUTOREGULATION_PATIENTS.includes(normalizedId);
}

/**
 * Loads the patient's raw recording as samples, parsed exactly as the study page
 * parses an imported file — every timestamped row is kept, gaps included, so the
 * correlation windows match on both screens.
 */
export async function loadNirsSamples(patientId: string): Promise<RawSample[]> {
  const normalizedId = patientId.replace("#", "");

  const cached = nirsSampleCache.get(normalizedId);
  if (cached) return cached;

  try {
    const response = await fetch(`/data/autoregulation_raw_${normalizedId}.csv`);
    if (!response.ok) {
      console.warn(`NIRS data not found for patient: ${normalizedId}`);
      return [];
    }
    const text = await response.text();
    // vercel.json rewrites unknown paths to index.html, so a 200 is not proof the
    // file exists — the body has to be checked as well.
    if (!text.trim() || text.trimStart().startsWith("<")) return [];

    const samples = parseAny(text);
    nirsSampleCache.set(normalizedId, samples);
    return samples;
  } catch (error) {
    console.error(`Error loading NIRS data for patient: ${normalizedId}`, error);
    return [];
  }
}

/**
 * Complete rSO₂ + PAM pairs, for readouts that need actual measured values
 * (current value, 24 h range) rather than a correlation input.
 */
export async function loadNirsData(patientId: string): Promise<NirsDataPoint[]> {
  const samples = await loadNirsSamples(patientId);
  return samples
    .filter((s) => s.nirs !== null && s.pam !== null)
    .map((s) => ({ timestamp: s.time.toISOString(), nirs: s.nirs, pam: s.pam }));
}

/** COx-vs-PAM curve over the whole recording. */
export function buildNirsAutoregulationCurve(
  samples: RawSample[],
  windowSamples: number = COX_WINDOW_SAMPLES,
  binSize: number = BIN_SIZE,
): NirsAutoregulationResult {
  const empty: NirsAutoregulationResult = {
    curveData: [],
    optimalPAM: null,
    lowerLimit: null,
    upperLimit: null,
    minCox: null,
    plateauValid: false,
    robustBins: 0,
    hasRealData: false,
  };

  if (samples.length < 10) return empty;

  const derived = computeIndex(samples, windowSamples, "cox");
  const curve = buildCurve(derived, binSize, 3, "cox");
  const analysis = analyzeCurve(curve);

  return {
    // The shared engine carries pressure on `ppc` and the index on `prx`
    // whatever the mode; in COx mode those are PAM and COx.
    curveData: curve.map((p) => ({
      pam: p.ppc,
      cox: p.prx,
      count: p.count,
      robust: p.robust,
    })),
    optimalPAM: analysis.optimalPPC,
    lowerLimit: analysis.lowerLimit,
    upperLimit: analysis.upperLimit,
    minCox: analysis.minPrx,
    plateauValid: analysis.plateauValid,
    robustBins: curve.filter((p) => p.robust).length,
    hasRealData: curve.length > 0,
  };
}

/**
 * Dashboard-facing result for the "PAM optimale" tile.
 *
 * LLA/ULA are frequently null: the recorded pressure range simply never crosses
 * the threshold on both sides of the optimum. The last rolling-window estimate is
 * returned alongside so the tile can show a value labelled as such — the same
 * convention the study page uses — instead of inventing a range.
 */
export async function getOptimalPAMFromNirs(
  patientId: string,
  windowSamples: number = COX_WINDOW_SAMPLES,
): Promise<{
  optimalPPC: number | null; // PAMopt, named for OptimalPPCResult compatibility
  lowerLimit: number | null;
  upperLimit: number | null;
  prxScore: number | null;
  timestamp: string | null;
  hasData: boolean;
  lowerLimitLastWindow: number | null;
  upperLimitLastWindow: number | null;
  lastWindowAt: string | null;
}> {
  const empty = {
    optimalPPC: null,
    lowerLimit: null,
    upperLimit: null,
    prxScore: null,
    timestamp: null,
    hasData: false,
    lowerLimitLastWindow: null,
    upperLimitLastWindow: null,
    lastWindowAt: null,
  };

  try {
    const samples = await loadNirsSamples(patientId);
    if (samples.length === 0) return empty;

    const result = buildNirsAutoregulationCurve(samples, windowSamples, BIN_SIZE);
    if (!result.hasRealData) return empty;

    // Same rolling parameters as the study page, so both report the same
    // last-window LLA/ULA.
    const derived = computeIndex(samples, windowSamples, "cox");
    const rolled = rollingOptimal(
      derived,
      Math.min(240, Math.floor(derived.length / 3)),
      30,
      BIN_SIZE,
      "cox",
    );
    let lowerLimitLastWindow: number | null = null;
    let upperLimitLastWindow: number | null = null;
    let lastWindowAt: string | null = null;
    for (const r of rolled) {
      if (r.lowerLimit !== null) {
        lowerLimitLastWindow = r.lowerLimit;
        lastWindowAt = r.time;
      }
      if (r.upperLimit !== null) {
        upperLimitLastWindow = r.upperLimit;
        lastWindowAt = r.time;
      }
    }

    return {
      optimalPPC: result.optimalPAM,
      lowerLimit: result.lowerLimit,
      upperLimit: result.upperLimit,
      prxScore: result.minCox,
      timestamp: samples[samples.length - 1].time.toISOString(),
      hasData: result.hasRealData,
      lowerLimitLastWindow,
      upperLimitLastWindow,
      lastWindowAt,
    };
  } catch (error) {
    console.error("Error calculating optimal PAM from NIRS:", error);
    return empty;
  }
}

export interface NirsTimeSeriesPoint {
  timestamp: string;
  time: number;
  pam: number | null;
  nirs: number | null;
  cox: number | null;
  optimalPAM: number | null;
  lowerLimit: number | null; // Dynamic LLA
  upperLimit: number | null; // Dynamic ULA
}

/**
 * Per-point autoregulation limits recomputed over a trailing lookback window, so
 * the dashboard can shade a zone that moves with the patient.
 *
 * Timestamps are shifted so the recording's last sample lands on "now" — the
 * dashboard's time selectors are relative to the present, and these recordings
 * are historical exports. The study page shows the real recording times instead.
 */
export function getNirsTimeSeriesWithDynamicLimits(
  samples: RawSample[],
  windowSamples: number = COX_WINDOW_SAMPLES,
  lookbackHours: number = 4,
  outputHours: number = 6,
): NirsTimeSeriesPoint[] {
  if (samples.length < 10) return [];

  const derived = computeIndex(samples, windowSamples, "cox");
  const lookbackMs = lookbackHours * 3_600_000;
  const latest = derived[derived.length - 1].time.getTime();
  const now = Date.now();
  const timeOffset = now - latest;
  const cutoff = now - outputHours * 3_600_000;

  const out: NirsTimeSeriesPoint[] = [];
  // Trailing pointer over the lookback window: avoids rescanning the history for
  // every output point.
  let start = 0;
  // The limits derive from a multi-hour window, so they barely move from one
  // sample to the next: recomputing every STRIDE points and holding the value in
  // between is visually indistinguishable and 3× cheaper — measured on patient
  // 8749, 380 ms → 122 ms over a 24 h window, on the main thread while the
  // dashboard renders (3558 → 3550 points carrying a limit).
  const STRIDE = 10;
  let analysis = { optimalPPC: null as number | null, lowerLimit: null as number | null, upperLimit: null as number | null };
  let sinceRecompute = STRIDE;

  for (let i = 0; i < derived.length; i++) {
    const t = derived[i].time.getTime();
    while (derived[start].time.getTime() < t - lookbackMs) start++;

    const normalizedTime = t + timeOffset;
    if (normalizedTime < cutoff) continue;

    if (sinceRecompute >= STRIDE) {
      // minPerBin of 2 (rather than 3) because a lookback window holds far fewer
      // samples than the whole recording; the robustness floor inside buildCurve
      // still keeps thin bins out of the limits.
      const curve = buildCurve(derived.slice(start, i + 1), BIN_SIZE, 2, "cox");
      const full = analyzeCurve(curve);
      analysis = {
        optimalPPC: full.optimalPPC,
        lowerLimit: full.lowerLimit,
        upperLimit: full.upperLimit,
      };
      sinceRecompute = 0;
    }
    sinceRecompute++;

    out.push({
      timestamp: new Date(normalizedTime).toISOString(),
      time: normalizedTime,
      pam: derived[i].pam,
      nirs: derived[i].nirs,
      cox: derived[i].prx,
      optimalPAM: analysis.optimalPPC,
      lowerLimit: analysis.lowerLimit,
      upperLimit: analysis.upperLimit,
    });
  }

  return out;
}

/** Current rSO₂/PAM and the 24 h PAM range, from the measured pairs. */
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
  const cutoff24h = new Date(lastPoint.timestamp).getTime() - 24 * 3_600_000;

  let pamMin = Infinity;
  let pamMax = -Infinity;
  for (const point of data) {
    if (new Date(point.timestamp).getTime() >= cutoff24h && point.pam !== null) {
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
