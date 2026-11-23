// Autoregulation computation service for the standalone /autoreg study page.
import { tr } from '@/i18n';
// Parses user-uploaded CSV or JSON files and computes an autoregulation index:
//   - PRx mode  : correlation PIC (ICP) ↔ PAM, binned by PPC  → PPC optimale
//   - COx mode  : correlation rSO2 (NIRS) ↔ PAM, binned by PAM → PAM optimale
// The mode is auto-detected from the columns present in the file (NIRS → COx).

export type AutoregMode = "prx" | "cox";

export interface ModeLabels {
  index: string;    // "PRx" | "COx"
  pressure: string; // "PPC" | "PAM"
  optimal: string;  // "PPC optimale" | "PAM optimale"
  signal: string;   // "PIC" | "rSO₂"
}

export function modeLabels(mode: AutoregMode): ModeLabels {
  return mode === "cox"
    ? { index: "COx", pressure: tr("PAM", "MAP"), optimal: tr("PAM optimale", "Optimal MAP"), signal: "rSO₂" }
    : { index: "PRx", pressure: tr("PPC", "CPP"), optimal: tr("PPC optimale", "Optimal CPP"), signal: tr("PIC", "ICP") };
}

export interface RawSample {
  time: Date;
  pic: number | null;
  pam: number | null;
  ppc: number | null;
  nirs: number | null;
}

export interface DerivedSample extends RawSample {
  // Autoregulation index (PRx or COx depending on mode).
  prx: number | null;
}

export interface CurvePoint {
  // Pressure axis carrier: PPC in PRx mode, PAM in COx mode.
  ppc: number;
  // Index carrier: PRx in PRx mode, COx in COx mode.
  prx: number;
  count: number;
  // True when the bin holds enough samples (≥ 2% of the usable data) to be
  // clinically trustworthy. Non-robust bins are shown greyed and are excluded
  // from the PAMopt/PPCopt and LLA/ULA computation.
  robust: boolean;
}

export interface AutoregResult {
  mode: AutoregMode;
  samples: DerivedSample[];
  curve: CurvePoint[];
  // Optimal pressure (PPCopt in PRx mode, PAMopt in COx mode).
  optimalPPC: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  // Minimal index value at the plateau nadir (min PRx / min COx).
  minPrx: number | null;
  // True when a preserved-autoregulation zone exists (nadir index < threshold),
  // i.e. the "optimal" value is clinically interpretable. False when the curve is
  // globally above threshold (no real plateau) → optimal is not trustworthy.
  plateauValid: boolean;
  sampleCount: number;
  durationHours: number;
  // ---- Diagnostics driving the clinical-interpretation banner ----
  // Usable index/pressure pairs inside the physiological range.
  usableSamples: number;
  // Share (%) of the paired samples that were physiologically usable.
  pctUsable: number;
  // Mean index over usable samples.
  meanIndex: number | null;
  // Share (%) of usable samples spent above the impairment threshold.
  pctImpaired: number;
  // Number of trustworthy (robust) bins retained for the fit.
  robustBins: number;
}

// Index threshold above which autoregulation is considered impaired (PRx/COx).
export const PRX_THRESHOLD = 0.3;

// Physiological plausibility window for the pressure axis (PAM/PPC, mmHg).
// Values outside are treated as artefacts (line flush, disconnection) and dropped.
export const PHYS_MIN = 20;
export const PHYS_MAX = 150;

// A bin must hold at least this fraction of the usable data to be "robust"
// (matches the ≥2% criterion used in the reference ICM+ methodology).
export const ROBUST_FRACTION = 0.02;

const REQUIRED_SAMPLES = 30;

// Detect the autoregulation mode from parsed samples: NIRS present → COx.
export function detectMode(samples: RawSample[]): AutoregMode {
  return samples.some((s) => s.nirs !== null) ? "cox" : "prx";
}

// ---------- Parsing ----------

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(",", ".").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Normalize header string to a canonical key
function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-\.]/g, "");
}

// Map header aliases → canonical field
const HEADER_MAP: Record<string, "time" | "pic" | "pam" | "ppc" | "nirs"> = {
  horodate: "time",
  time: "time",
  timestamp: "time",
  datetime: "time",
  date: "time",
  pic: "pic",
  icp: "pic",
  pam: "pam",
  map: "pam",
  abp: "pam",
  abpm: "pam",
  ppc: "ppc",
  cpp: "ppc",
  rawppc: "ppc",
  // NIRS / cerebral oximetry aliases → drive COx mode
  nirs: "nirs",
  rso2: "nirs",
  rso2l: "nirs",
  rso2r: "nirs",
  sto2: "nirs",
  scto2: "nirs",
  crso2: "nirs",
  cox: "nirs",
};

export function parseCSV(text: string): RawSample[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Auto-detect delimiter
  const first = lines[0];
  const delim = first.includes(";") && !first.includes(",") ? ";" : ",";

  const headers = first.split(delim).map((h) => normHeader(h));
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h];
    if (key && !(key in idx)) idx[key] = i;
  });

  if (!("time" in idx)) return [];

  const out: RawSample[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim);
    const t = parseDate(cells[idx.time]);
    if (!t) continue;
    const pic = idx.pic !== undefined ? parseNum(cells[idx.pic]) : null;
    let pam = idx.pam !== undefined ? parseNum(cells[idx.pam]) : null;
    const ppc = idx.ppc !== undefined ? parseNum(cells[idx.ppc]) : null;
    const nirs = idx.nirs !== undefined ? parseNum(cells[idx.nirs]) : null;
    if (pam === null && ppc !== null && pic !== null) pam = ppc + pic;
    out.push({ time: t, pic, pam, ppc, nirs });
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime());
}

// Parse Fisher-style JSON where each entry is { "h1,h2,h3": "v1,v2,v3" }
export function parseFisherJSON(json: unknown): RawSample[] {
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  const tableKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
  if (!tableKey) return [];
  const rows = obj[tableKey] as Array<Record<string, string>>;
  const out: RawSample[] = [];

  for (const row of rows) {
    for (const [hdr, val] of Object.entries(row)) {
      const headers = hdr.split(",").map((h) => h.trim());
      const values = String(val).split(",").map((v) => v.trim());
      const map: Record<string, string> = {};
      headers.forEach((h, i) => {
        const canonical = HEADER_MAP[normHeader(h)];
        const raw = values[i] ?? "";
        if (canonical) {
          // First non-empty value wins so `rawPPC` fills PPC when PPC is empty.
          if (!map[canonical] && raw !== "") map[canonical] = raw;
        }
      });

      const t = parseDate(map["time"]);
      if (!t) continue;
      const pic = parseNum(map["pic"]);
      let pam = parseNum(map["pam"]);
      const ppc = parseNum(map["ppc"]);
      const nirs = parseNum(map["nirs"]);
      // Derive PAM from PPC + PIC when only PPC/PIC are recorded (PPC = PAM − PIC).
      if (pam === null && ppc !== null && pic !== null) pam = ppc + pic;
      out.push({ time: t, pic, pam, ppc, nirs });
    }
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime());
}

// Auto-detect format from raw text
export function parseAny(text: string): RawSample[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return parseFisherJSON(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  return parseCSV(text);
}

export interface ReadinessError {
  cause: string;
  steps: string[];
}

export function describeAnalysisReadiness(samples: RawSample[]): ReadinessError | null {
  if (samples.length === 0) {
    return {
      cause: tr("Aucune donnée exploitable détectée dans le fichier.", "No usable data detected in the file."),
      steps: [
        tr("Vérifiez que le fichier contient bien des lignes horodatées.", "Check that the file contains timestamped rows."),
        tr("Formats acceptés : CSV/Excel avec en-têtes horodatées, soit NIRS + PAM (rSO₂, PAM) pour le COx, soit PIC + PAM + PPC pour le PRx ; JSON Fisher également accepté.", "Accepted formats: CSV/Excel with timestamped headers, either NIRS + MAP (rSO₂, MAP) for COx, or ICP + MAP + CPP for PRx; Fisher JSON also accepted."),
        tr("Assurez-vous que les colonnes de signal (rSO₂/NIRS ou PIC/PPC) et PAM ne sont pas vides.", "Make sure the signal columns (rSO₂/NIRS or ICP/CPP) and MAP are not empty."),
      ],
    };
  }

  if (samples.length < REQUIRED_SAMPLES) {
    return {
      cause: tr(`Fichier insuffisant : ${samples.length} échantillon(s) détecté(s), ${REQUIRED_SAMPLES} minimum requis.`, `Insufficient file: ${samples.length} sample(s) detected, ${REQUIRED_SAMPLES} minimum required.`),
      steps: [
        tr("Prolongez la période d'enregistrement (au moins 90 minutes recommandé).", "Extend the recording period (at least 90 minutes recommended)."),
        tr("Vérifiez la fréquence d'échantillonnage.", "Check the sampling rate."),
      ],
    };
  }

  const mode = detectMode(samples);

  // ----- COx mode : NIRS (rSO₂) ↔ PAM -----
  if (mode === "cox") {
    const complete = samples.filter((s) => s.nirs !== null && s.pam !== null);
    if (samples.filter((s) => s.pam !== null).length === 0) {
      return {
        cause: tr("Champ entièrement vide : PAM.", "Field entirely empty: MAP."),
        steps: [
          tr("Un signal NIRS (rSO₂) a été détecté mais la colonne PAM est absente ou vide.", "A NIRS (rSO₂) signal was detected but the MAP column is missing or empty."),
          tr("Le COx nécessite la pression artérielle moyenne (PAM) synchrone à la rSO₂.", "COx requires mean arterial pressure (MAP) synchronous with rSO₂."),
          tr("Vérifiez le mapping des colonnes (en-tête PAM / MAP / ABP).", "Check the column mapping (PAM / MAP / ABP header)."),
        ],
      };
    }
    if (complete.length < REQUIRED_SAMPLES) {
      return {
        cause: tr(`Calcul impossible : seulement ${complete.length}/${samples.length} échantillons contiennent rSO₂ et PAM exploitables.`, `Computation impossible: only ${complete.length}/${samples.length} samples contain usable rSO₂ and MAP.`),
        steps: [
          tr("Trop de valeurs manquantes : contrôlez les artefacts et les périodes de déconnexion du capteur NIRS.", "Too many missing values: check artefacts and NIRS sensor disconnection periods."),
          tr("Réexportez une plage où rSO₂ et PAM sont enregistrés simultanément.", "Re-export a period where rSO₂ and MAP are recorded simultaneously."),
        ],
      };
    }
    const constantFields = [
      { label: "rSO₂", values: complete.map((s) => s.nirs as number) },
      { label: tr("PAM", "MAP"), values: complete.map((s) => s.pam as number) },
    ].filter(({ values }) => new Set(values.map((v) => v.toFixed(3))).size < 2);
    if (constantFields.length > 0) {
      const details = constantFields
        .map(({ label, values }) => `${label} = ${values[0].toFixed(1)} (constant)`)
        .join(", ");
      return {
        cause: tr(`Signaux constants détectés : ${details}.`, `Constant signals detected: ${details}.`),
        steps: [
          tr("Ce fichier ressemble à un enregistrement sans signal brut variable (ou à un export de résultats déjà calculés).", "This file looks like a recording without a varying raw signal (or an export of already computed results)."),
          tr("La corrélation COx nécessite des variations physiologiques de rSO₂ et de PAM.", "COx correlation requires physiological variations of rSO₂ and MAP."),
          tr("Vérifiez que le capteur NIRS était bien connecté (attention aux valeurs saturées à 94 %).", "Check that the NIRS sensor was connected (beware of values saturated at 94%)."),
          tr("Réimportez un enregistrement brut où rSO₂ et PAM évoluent réellement.", "Re-import a raw recording where rSO₂ and MAP actually vary."),
        ],
      };
    }
    return null;
  }

  // ----- PRx mode : PIC (ICP) ↔ PAM, binned by PPC -----
  const missing = {
    PIC: samples.filter((s) => s.pic === null).length,
    PAM: samples.filter((s) => s.pam === null).length,
    PPC: samples.filter((s) => s.ppc === null).length,
  };
  const fieldLabel: Record<string, string> = { PIC: tr('PIC', 'ICP'), PAM: tr('PAM', 'MAP'), PPC: tr('PPC', 'CPP') };
  const emptyFields = Object.entries(missing).filter(([, n]) => n === samples.length).map(([k]) => fieldLabel[k] ?? k);
  if (emptyFields.length > 0) {
    return {
      cause: tr(`Champs entièrement vides : ${emptyFields.join(', ')}.`, `Fields entirely empty: ${emptyFields.join(', ')}.`),
      steps: [
        tr("Aucun signal NIRS (rSO₂) détecté : le fichier est traité en mode PRx (PIC/PAM/PPC).", "No NIRS (rSO₂) signal detected: the file is processed in PRx mode (ICP/MAP/CPP)."),
        tr("Pour le PRx, PIC, PAM et PPC doivent être présents (PPC peut être calculé si PAM et PIC le sont).", "For PRx, ICP, MAP and CPP must be present (CPP can be computed if MAP and ICP are)."),
        tr("Pour une analyse COx non invasive, importez plutôt un fichier avec les colonnes rSO₂ (NIRS) et PAM.", "For a non-invasive COx analysis, import a file with rSO₂ (NIRS) and MAP columns instead."),
      ],
    };
  }

  const complete = samples.filter((s) => s.pic !== null && s.pam !== null && s.ppc !== null);
  if (complete.length < REQUIRED_SAMPLES) {
    return {
      cause: tr(`Calcul impossible : seulement ${complete.length}/${samples.length} échantillons contiennent PIC, PAM et PPC exploitables.`, `Computation impossible: only ${complete.length}/${samples.length} samples contain usable ICP, MAP and CPP.`),
      steps: [
        tr("Trop de valeurs manquantes : contrôlez les artefacts et les périodes de déconnexion du capteur.", "Too many missing values: check artefacts and sensor disconnection periods."),
        tr("Réexportez le fichier sur une plage temporelle où les 3 signaux sont enregistrés simultanément.", "Re-export the file over a period where all 3 signals are recorded simultaneously."),
      ],
    };
  }

  const constantFields = [
    { label: tr('PIC', 'ICP'), values: complete.map((s) => s.pic as number) },
    { label: tr('PAM', 'MAP'), values: complete.map((s) => s.pam as number) },
    { label: tr('PPC', 'CPP'), values: complete.map((s) => s.ppc as number) },
  ].filter(({ values }) => new Set(values.map((v) => v.toFixed(3))).size < 2);

  if (constantFields.length > 0) {
    const details = constantFields
      .map(({ label, values }) => `${label} = ${values[0].toFixed(1)} (constant)`)
      .join(', ');
    // A file whose signal channels are all flat/zeroed is typically a results
    // template or an export without raw signal, not a real recording.
    const allFlat = constantFields.length >= 2;
    return {
      cause: allFlat
        ? tr(`Fichier sans signal brut exploitable : ${details}.`, `File without a usable raw signal: ${details}.`)
        : tr(`Signaux constants détectés : ${details}.`, `Constant signals detected: ${details}.`),
      steps: [
        allFlat
          ? tr("Ce fichier ressemble à un export de résultats déjà calculés (ou un gabarit vide) : les canaux bruts PIC/PAM/PPC ne varient pas.", "This file looks like an export of already computed results (or an empty template): the raw ICP/MAP/CPP channels do not vary.")
          : tr("La corrélation PRx nécessite des variations physiologiques de PIC et PAM.", "PRx correlation requires physiological variations of ICP and MAP."),
        tr("Pour calculer l'autorégulation, importez un enregistrement BRUT : rSO₂ + PAM (COx, non invasif) ou PIC + PAM + PPC (PRx).", "To compute autoregulation, import a RAW recording: rSO₂ + MAP (COx, non-invasive) or ICP + MAP + CPP (PRx)."),
        tr("Vérifiez que les capteurs étaient connectés et non zérotés artificiellement.", "Check that the sensors were connected and not artificially zeroed."),
        tr("Évitez les périodes de sédation profonde stable où les signaux ne varient pas.", "Avoid periods of stable deep sedation where signals do not vary."),
      ],
    };
  }

  return null;
}

// ---------- Computation ----------

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i];
    sxx += xs[i] * xs[i]; syy += ys[i] * ys[i];
    sxy += xs[i] * ys[i];
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (!den || !isFinite(den)) return null;
  return num / den;
}

// Compute the autoregulation index as a rolling Pearson correlation between PAM
// and the tissue signal (PIC for PRx, rSO₂/NIRS for COx).
export function computeIndex(
  samples: RawSample[],
  windowSize = 30,
  mode: AutoregMode = "prx",
): DerivedSample[] {
  const out: DerivedSample[] = samples.map((s) => ({ ...s, prx: null }));
  for (let i = windowSize - 1; i < samples.length; i++) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let j = i - windowSize + 1; j <= i; j++) {
      const p = samples[j].pam;
      const c = mode === "cox" ? samples[j].nirs : samples[j].pic;
      if (p !== null && c !== null) {
        xs.push(p);
        ys.push(c);
      }
    }
    out[i].prx = pearson(xs, ys);
  }
  return out;
}

// Backward-compatible alias (PRx = correlation PIC/PAM).
export function computePRx(samples: RawSample[], windowSize = 30): DerivedSample[] {
  return computeIndex(samples, windowSize, "prx");
}

// Build index-vs-pressure curve. Pressure axis is PPC in PRx mode, PAM in COx mode.
// Samples outside the physiological range are dropped as artefacts; each retained
// bin is flagged `robust` when it holds ≥ minFraction of the usable samples.
export function buildCurve(
  samples: DerivedSample[],
  binSize = 5,
  minPerBin = 3,
  mode: AutoregMode = "prx",
  minFraction = ROBUST_FRACTION,
): CurvePoint[] {
  const bins = new Map<number, { sum: number; count: number }>();
  let usableTotal = 0;
  for (const s of samples) {
    const axis = mode === "cox" ? s.pam : s.ppc;
    if (axis === null || s.prx === null) continue;
    if (axis < PHYS_MIN || axis > PHYS_MAX) continue; // physiological artefact filter
    usableTotal += 1;
    const bin = Math.round(axis / binSize) * binSize;
    const cur = bins.get(bin) || { sum: 0, count: 0 };
    cur.sum += s.prx;
    cur.count += 1;
    bins.set(bin, cur);
  }
  const robustThreshold = Math.max(minPerBin, Math.ceil(usableTotal * minFraction));
  const curve: CurvePoint[] = [];
  Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([ppc, { sum, count }]) => {
      if (count >= minPerBin) {
        curve.push({
          ppc,
          prx: Math.round((sum / count) * 100) / 100,
          count,
          robust: count >= robustThreshold,
        });
      }
    });
  return curve;
}

export function analyzeCurve(fullCurve: CurvePoint[]): {
  optimalPPC: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  minPrx: number | null;
  plateauValid: boolean;
} {
  // Only trustworthy (robust) bins drive the optimum and the limits. Non-robust
  // bins remain in the curve for display but never distort PAMopt/LLA/ULA.
  const curve = fullCurve.filter((p) => p.robust);
  if (curve.length === 0) {
    return { optimalPPC: null, lowerLimit: null, upperLimit: null, minPrx: null, plateauValid: false };
  }
  let minPrx = Infinity;
  let optimalPPC: number | null = null;
  for (const p of curve) {
    if (p.prx < minPrx) {
      minPrx = p.prx;
      optimalPPC = p.ppc;
    }
  }
  let lowerLimit: number | null = null;
  let upperLimit: number | null = null;

  if (optimalPPC !== null) {
    // LLA: highest PPC below optimal where PRx crosses above threshold
    for (let i = 0; i < curve.length - 1; i++) {
      if (curve[i].ppc >= optimalPPC) break;
      if (curve[i].prx >= PRX_THRESHOLD && curve[i + 1].prx < PRX_THRESHOLD) {
        lowerLimit = curve[i + 1].ppc;
      }
    }
    // ULA
    for (let i = curve.length - 1; i > 0; i--) {
      if (curve[i].ppc <= optimalPPC) break;
      if (curve[i].prx >= PRX_THRESHOLD && curve[i - 1].prx < PRX_THRESHOLD) {
        upperLimit = curve[i - 1].ppc;
      }
    }
  }

  const roundedMin = minPrx === Infinity ? null : Math.round(minPrx * 100) / 100;
  // A trustworthy plateau requires a preserved zone: the nadir must dip below the
  // impairment threshold. If every bin sits above it, autoregulation is globally
  // impaired and no meaningful "optimal" pressure exists.
  const plateauValid = curve.length >= 3 && roundedMin !== null && roundedMin < PRX_THRESHOLD;

  return {
    optimalPPC,
    lowerLimit,
    upperLimit,
    minPrx: roundedMin,
    plateauValid,
  };
}

export function runAnalysis(samples: RawSample[], windowSize = 30, binSize = 5): AutoregResult {
  const mode = detectMode(samples);
  const derived = computeIndex(samples, windowSize, mode);
  const curve = buildCurve(derived, binSize, 3, mode);
  const analysis = analyzeCurve(curve);
  const durationHours =
    samples.length > 1
      ? (samples[samples.length - 1].time.getTime() - samples[0].time.getTime()) / 3_600_000
      : 0;

  // ---- Diagnostics for the clinical-interpretation banner ----
  const axisOf = (s: DerivedSample) => (mode === "cox" ? s.pam : s.pic);
  const paired = derived.filter((s) => s.prx !== null && s.pam !== null && axisOf(s) !== null);
  const usable = paired.filter((s) => {
    const a = mode === "cox" ? s.pam : s.ppc;
    return a !== null && a >= PHYS_MIN && a <= PHYS_MAX;
  });
  const meanIndex =
    usable.length > 0
      ? Math.round((usable.reduce((acc, s) => acc + (s.prx as number), 0) / usable.length) * 100) / 100
      : null;
  const pctImpaired =
    usable.length > 0
      ? Math.round((usable.filter((s) => (s.prx as number) > PRX_THRESHOLD).length / usable.length) * 1000) / 10
      : 0;
  const pctUsable =
    paired.length > 0 ? Math.round((usable.length / paired.length) * 1000) / 10 : 0;

  return {
    mode,
    samples: derived,
    curve,
    ...analysis,
    sampleCount: samples.length,
    durationHours: Math.round(durationHours * 10) / 10,
    usableSamples: usable.length,
    pctUsable,
    meanIndex,
    pctImpaired,
    robustBins: curve.filter((p) => p.robust).length,
  };
}

// Rolling optimal PPC over time (window in samples)
export interface OptimalTimePoint {
  time: string;
  optimalPPC: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  // Measured pressure on the mode's axis (PPC in PRx mode, PAM in COx mode).
  ppc: number | null;
  pic: number | null;
  pam: number | null;
  nirs: number | null;
}

export function rollingOptimal(
  samples: DerivedSample[],
  windowSize = 240,
  step = 30,
  binSize = 5,
  mode: AutoregMode = "prx",
): OptimalTimePoint[] {
  const out: OptimalTimePoint[] = [];
  for (let i = windowSize; i < samples.length; i += step) {
    const slice = samples.slice(i - windowSize, i);
    const curve = buildCurve(slice, binSize, 2, mode);
    const a = analyzeCurve(curve);
    const s = samples[i];
    out.push({
      time: s.time.toISOString(),
      optimalPPC: a.optimalPPC,
      lowerLimit: a.lowerLimit,
      upperLimit: a.upperLimit,
      ppc: mode === "cox" ? s.pam : s.ppc,
      pic: s.pic,
      pam: s.pam,
      nirs: s.nirs,
    });
  }
  return out;
}

// CSV export helper
export interface CSVMetadata {
  subjectId?: string;
  subjectCode?: string;
  subjectLabel?: string;
  fileName?: string;
  studyDate?: Date;
  exportedAt?: Date;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function resultsToCSV(result: AutoregResult, meta: CSVMetadata = {}): string {
  const lines: string[] = [];
  const L = modeLabels(result.mode);
  const exportedAt = meta.exportedAt ?? new Date();
  const studyDate = meta.studyDate ?? result.samples[0]?.time ?? null;

  lines.push("# Métadonnées du sujet");
  lines.push(`ID patient,${csvEscape(meta.subjectId)}`);
  lines.push(`Code sujet,${csvEscape(meta.subjectCode)}`);
  lines.push(`Libellé sujet,${csvEscape(meta.subjectLabel)}`);
  lines.push(`Fichier source,${csvEscape(meta.fileName)}`);
  lines.push(`Index d'autorégulation,${L.index}`);
  lines.push(`Date d'étude,${studyDate ? studyDate.toISOString() : ""}`);
  lines.push(`Date d'export,${exportedAt.toISOString()}`);
  lines.push("");

  lines.push("# Résumé des résultats optimaux");
  lines.push(`${L.optimal} (mmHg),${result.optimalPPC ?? ""}`);
  lines.push(`LLA (mmHg),${result.lowerLimit ?? ""}`);
  lines.push(`ULA (mmHg),${result.upperLimit ?? ""}`);
  lines.push(`${L.index} minimum,${result.minPrx ?? ""}`);
  lines.push(`Plateau fiable,${result.plateauValid ? "oui" : "non"}`);
  lines.push(`Nombre d'échantillons,${result.sampleCount}`);
  lines.push(`Durée (h),${result.durationHours}`);
  lines.push("");

  lines.push("# Qualité & interprétation");
  lines.push(`Échantillons exploitables,${result.usableSamples}`);
  lines.push(`Part exploitable (%),${result.pctUsable}`);
  lines.push(`${L.index} moyen,${result.meanIndex ?? ""}`);
  lines.push(`Temps altéré (${L.index}>0.3) (%),${result.pctImpaired}`);
  lines.push(`Bins fiables (>=2% données),${result.robustBins}`);
  lines.push("");

  lines.push(`# Courbe ${L.index} vs ${L.pressure}`);
  lines.push(`${L.pressure} (mmHg),${L.index} moyen,N échantillons,Fiable,Autorégulation`);
  result.curve.forEach((p) =>
    lines.push(`${p.ppc},${p.prx},${p.count},${p.robust ? "oui" : "non"},${p.prx < 0.3 ? "Préservée" : "Altérée"}`),
  );
  lines.push("");

  lines.push("# Séries temporelles");
  if (result.mode === "cox") {
    lines.push(`Horodate,rSO2,PAM,COx`);
    result.samples.forEach((s) =>
      lines.push(`${s.time.toISOString()},${s.nirs ?? ""},${s.pam ?? ""},${s.prx ?? ""}`),
    );
  } else {
    lines.push(`Horodate,PIC,PAM,PPC,PRx`);
    result.samples.forEach((s) =>
      lines.push(
        `${s.time.toISOString()},${s.pic ?? ""},${s.pam ?? ""},${s.ppc ?? ""},${s.prx ?? ""}`,
      ),
    );
  }
  return lines.join("\n");
}

