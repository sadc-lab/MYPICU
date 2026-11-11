import {
  rollingOptimal,
  runAnalysis,
  type RawSample,
} from "@/services/autoregComputation.service";
import {
  getTemporaryPatient,
} from "@/services/temporaryPatient.service";
import type { AutoregulationResult } from "@/services/patientAutoregulation.service";

function readChannel(
  data: Record<string, unknown>,
  key: string,
  timestampKey = "charttime",
  valueKey = "valeur",
): Map<number, number> {
  const rows = data[key];
  if (!Array.isArray(rows)) return new Map();
  const values = new Map<number, number>();
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const point = row as Record<string, unknown>;
    if (typeof point[timestampKey] !== "string") continue;
    const timestamp = Date.parse(point[timestampKey] as string);
    const value = typeof point[valueKey] === "number"
      ? point[valueKey] as number
      : Number(point[valueKey]);
    if (Number.isFinite(timestamp) && Number.isFinite(value)) values.set(timestamp, value);
  }
  return values;
}

export function computeTemporaryAutoregulation(
  patientId: string,
): AutoregulationResult[] {
  const patient = getTemporaryPatient(patientId);
  if (!patient?.mode) return [];

  const prx = patient.mode === "PRx";
  const autoregData = typeof patient.data.autoreg_data === "object"
    && patient.data.autoreg_data !== null
    ? patient.data.autoreg_data as Record<string, unknown>
    : null;
  const readAutoregOrDisplayChannel = (
    autoregKey: string,
    autoregValueKey: string,
    displayKey: string,
  ) => {
    const autoregValues = autoregData
      ? readChannel(autoregData, autoregKey, "horodate", autoregValueKey)
      : new Map<number, number>();
    return autoregValues.size > 0
      ? autoregValues
      : readChannel(patient.data, displayKey);
  };
  const pic = readAutoregOrDisplayChannel(
    "Variable_PIC_autoreg", "PIC", "Variable_PIC",
  );
  const ppc = readAutoregOrDisplayChannel(
    "Variable_PPC_autoreg", "PPC", "Variable_PPC",
  );
  const pam = readAutoregOrDisplayChannel(
    "Variable_PAM_autoreg", "PAM", "Variable_PAM",
  );
  const nirs = readAutoregOrDisplayChannel(
    "Variable_NIRS_autoreg", "NIRS", "Variable_rSO2",
  );
  const times = Array.from(new Set([
    ...(prx ? pic.keys() : nirs.keys()),
    ...(prx ? ppc.keys() : pam.keys()),
  ])).sort((a, b) => a - b);
  const complete = times.flatMap((timestamp) => {
    const arterialPressure = pam.get(timestamp);
    const signal = prx ? pic.get(timestamp) : nirs.get(timestamp);
    const cpp = ppc.get(timestamp);
    if (signal === undefined || (prx ? cpp === undefined : arterialPressure === undefined)) return [];
    return [{
      time: new Date(timestamp),
      pic: prx ? signal : null,
      pam: arterialPressure ?? null,
      ppc: prx ? cpp! : null,
      nirs: prx ? null : signal,
    } satisfies RawSample];
  });
  if (complete.length < 60) return [];

  const latestTimestamp = complete[complete.length - 1].time.getTime();
  const timeOffset = Date.now() - latestTimestamp;
  const samples = complete.map((sample) => ({
    ...sample,
    time: new Date(sample.time.getTime() + timeOffset),
  }));
  const analysis = runAnalysis(samples);
  const windows = rollingOptimal(
    analysis.samples,
    60,
    1,
    5,
    analysis.mode,
  );
  const rawTable = windows.map((point) => ({
    Horodate: point.time,
    Global_Optimal_PPC: analysis.mode === "prx" ? point.optimalPPC : null,
    Global_Optimal_PAM: analysis.mode === "cox" ? point.optimalPPC : null,
    Global_Inferior_Limit: point.lowerLimit,
    Global_Superior_Limit: point.upperLimit,
    PPC: point.ppc,
    PIC: point.pic,
    PAM: point.pam,
    NIRS: point.nirs,
  }));

  return [{
    mode: analysis.mode,
    optimalPressure: analysis.optimalPPC,
    inferiorLimit: analysis.lowerLimit,
    superiorLimit: analysis.upperLimit,
    minIndex: analysis.minPrx,
    pressureVariable: analysis.mode === "prx" ? "PPC" : "PAM",
    signalVariable: analysis.mode === "prx" ? "PIC" : "NIRS1",
    computedAt: new Date().toISOString(),
    rawTable,
  }];
}
