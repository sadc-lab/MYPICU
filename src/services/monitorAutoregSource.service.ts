// Builds an autoregulation input from the monitoring series already stored in
// Supabase (`patient_vitals`), so a patient can be analysed on the study page
// without shipping a raw recording file alongside the app.
//
// Only the PRx route is possible from this table: it holds PIC, PAM and PPC but
// no cerebral oximetry channel (rSO₂), so no COx can be derived here. Patients
// monitored by NIRS still need their raw rSO₂/PAM recording.
//
// The result is emitted as CSV text rather than parsed samples on purpose: the
// study page then runs it through the exact same parse → readiness → analysis
// path as an imported file, so a monitor-sourced analysis is validated by the
// same guards (constant-signal detection, physiological window, robust bins).

import { supabase } from "@/integrations/supabase/client";

// Variable keys as written by the patient-data import (see BRAIN_VARIABLE_KEYS).
const PIC_KEY = "Variable_PIC";
const PAM_KEY = "Variable_PAM";
const PPC_KEY = "Variable_PPC";

// Monitor rows are charted per channel and rarely share the exact same
// timestamp, so channels are resampled into fixed buckets before being paired.
// 60 s matches the usual charting cadence of these series.
const BUCKET_MS = 60_000;

// Supabase caps a single response at 1000 rows.
const PAGE_SIZE = 1000;

// Upper bound on pages per channel, so a very long stay cannot turn into an
// unbounded request loop. 40 pages = 40 000 rows ≈ 27 days charted every minute.
// Hitting it truncates the series, which is reported rather than passed silently.
const MAX_PAGES = 40;

export interface MonitorAutoregSource {
  /** CSV text with `Horodate,PIC,PAM,PPC` columns, ready for `parseAny`. */
  csv: string;
  /** Traceable name recorded alongside the results. */
  fileName: string;
  /** Buckets holding both PIC and PAM — the pairs PRx can be computed from. */
  pairedSamples: number;
  /** Rows read per channel, before pairing. */
  rawCounts: { pic: number; pam: number; ppc: number };
  /** True when PPC was computed as PAM − PIC instead of read from the monitor. */
  ppcDerived: boolean;
  /** True when a channel hit the page cap and the series is incomplete. */
  truncated: boolean;
  bucketSeconds: number;
}

interface Point {
  t: number;
  v: number;
}

// Reads one channel, paging past the 1000-row response cap.
async function fetchChannel(
  dbPatientId: string,
  variableKey: string,
): Promise<{ points: Point[]; truncated: boolean }> {
  const points: Point[] = [];
  let truncated = false;

  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) {
      truncated = true;
      break;
    }
    const offset = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("patient_vitals")
      .select("charttime, valeur")
      .eq("patient_id", dbPatientId)
      .eq("variable_key", variableKey)
      .order("charttime", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`patient_vitals: lecture de ${variableKey} échouée`, error);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.valeur === null) continue;
      const t = new Date(row.charttime).getTime();
      if (isNaN(t)) continue;
      points.push({ t, v: Number(row.valeur) });
    }

    if (data.length < PAGE_SIZE) break;
  }

  return { points, truncated };
}

// Mean value per time bucket, so two channels charted a few seconds apart still
// line up on a common timeline.
function bucketMeans(points: Point[]): Map<number, number> {
  const sums = new Map<number, { sum: number; count: number }>();
  for (const { t, v } of points) {
    const bucket = Math.floor(t / BUCKET_MS) * BUCKET_MS;
    const cur = sums.get(bucket) ?? { sum: 0, count: 0 };
    cur.sum += v;
    cur.count += 1;
    sums.set(bucket, cur);
  }
  const means = new Map<number, number>();
  for (const [bucket, { sum, count }] of sums) {
    means.set(bucket, sum / count);
  }
  return means;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Assembles the patient's PIC/PAM/PPC monitoring series into CSV text for the
 * autoregulation analysis. Returns null when the patient has no bucket carrying
 * both PIC and PAM, i.e. nothing a PRx could ever be computed from.
 *
 * Reads are subject to the ward-based RLS: an unauthenticated caller, or one
 * without access to this patient's ward, simply sees no rows.
 */
export async function loadAutoregSourceFromVitals(
  patientId: string,
): Promise<MonitorAutoregSource | null> {
  const normalizedId = patientId.replace("#", "");
  const dbPatientId = `#${normalizedId}`;

  const [picChannel, pamChannel, ppcChannel] = await Promise.all([
    fetchChannel(dbPatientId, PIC_KEY),
    fetchChannel(dbPatientId, PAM_KEY),
    fetchChannel(dbPatientId, PPC_KEY),
  ]);

  const pic = bucketMeans(picChannel.points);
  const pam = bucketMeans(pamChannel.points);
  const ppc = bucketMeans(ppcChannel.points);

  // PRx correlates PIC with PAM: a bucket missing either one is unusable.
  const buckets = Array.from(pic.keys())
    .filter((t) => pam.has(t))
    .sort((a, b) => a - b);

  if (buckets.length === 0) return null;

  let ppcDerived = false;
  const lines = ["Horodate,PIC,PAM,PPC"];
  for (const t of buckets) {
    const picValue = pic.get(t) as number;
    const pamValue = pam.get(t) as number;
    let ppcValue = ppc.get(t);
    if (ppcValue === undefined) {
      // PPC = PAM − PIC. Needed because the PRx curve bins on the PPC axis, and
      // some patients are charted without a computed PPC channel.
      ppcValue = pamValue - picValue;
      ppcDerived = true;
    }
    lines.push(
      `${new Date(t).toISOString()},${round1(picValue)},${round1(pamValue)},${round1(ppcValue)}`,
    );
  }

  return {
    csv: lines.join("\n"),
    fileName: `moniteur_${normalizedId}_PIC-PAM_${BUCKET_MS / 1000}s.csv`,
    pairedSamples: buckets.length,
    rawCounts: {
      pic: picChannel.points.length,
      pam: pamChannel.points.length,
      ppc: ppcChannel.points.length,
    },
    ppcDerived,
    truncated: picChannel.truncated || pamChannel.truncated || ppcChannel.truncated,
    bucketSeconds: BUCKET_MS / 1000,
  };
}

/** Wraps the assembled CSV as a File, so it feeds the normal import path. */
export function monitorSourceToFile(source: MonitorAutoregSource): File {
  return new File([source.csv], source.fileName, { type: "text/csv" });
}
