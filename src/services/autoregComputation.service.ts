// Autoregulation computation service for the standalone /autoreg study page.
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
    ? { index: "COx", pressure: "PAM", optimal: "PAM optimale", signal: "rSO₂" }
    : { index: "PRx", pressure: "PPC", optimal: "PPC optimale", signal: "PIC" };
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
}

// Index threshold above which autoregulation is considered impaired (PRx/COx).
export const PRX_THRESHOLD = 0.3;

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
      cause: "Aucune donnée exploitable détectée dans le fichier.",
      steps: [
        "Vérifiez que le fichier contient bien des lignes horodatées.",
        "Formats acceptés : CSV/Excel avec en-têtes horodatées, soit NIRS + PAM (rSO₂, PAM) pour le COx, soit PIC + PAM + PPC pour le PRx ; JSON Fisher également accepté.",
        "Assurez-vous que les colonnes de signal (rSO₂/NIRS ou PIC/PPC) et PAM ne sont pas vides.",
      ],
    };
  }

  if (samples.length < REQUIRED_SAMPLES) {
    return {
      cause: `Fichier insuffisant : ${samples.length} échantillon(s) détecté(s), ${REQUIRED_SAMPLES} minimum requis.`,
      steps: [
        "Prolongez la période d'enregistrement (au moins 90 minutes recommandé).",
        "Vérifiez la fréquence d'échantillonnage.",
      ],
    };
  }

  const mode = detectMode(samples);

  // ----- COx mode : NIRS (rSO₂) ↔ PAM -----
  if (mode === "cox") {
    const complete = samples.filter((s) => s.nirs !== null && s.pam !== null);
    if (samples.filter((s) => s.pam !== null).length === 0) {
      return {
        cause: "Champ entièrement vide : PAM.",
        steps: [
          "Un signal NIRS (rSO₂) a été détecté mais la colonne PAM est absente ou vide.",
          "Le COx nécessite la pression artérielle moyenne (PAM) synchrone à la rSO₂.",
          "Vérifiez le mapping des colonnes (en-tête PAM / MAP / ABP).",
        ],
      };
    }
    if (complete.length < REQUIRED_SAMPLES) {
      return {
        cause: `Calcul impossible : seulement ${complete.length}/${samples.length} échantillons contiennent rSO₂ et PAM exploitables.`,
        steps: [
          "Trop de valeurs manquantes : contrôlez les artefacts et les périodes de déconnexion du capteur NIRS.",
          "Réexportez une plage où rSO₂ et PAM sont enregistrés simultanément.",
        ],
      };
    }
    const constantFields = [
      { label: "rSO₂", values: complete.map((s) => s.nirs as number) },
      { label: "PAM", values: complete.map((s) => s.pam as number) },
    ].filter(({ values }) => new Set(values.map((v) => v.toFixed(3))).size < 2);
    if (constantFields.length > 0) {
      const details = constantFields
        .map(({ label, values }) => `${label} = ${values[0].toFixed(1)} (constant)`)
        .join(", ");
      return {
        cause: `Signaux constants détectés : ${details}.`,
        steps: [
          "La corrélation COx nécessite des variations physiologiques de rSO₂ et de PAM.",
          "Vérifiez que le capteur NIRS était bien connecté (attention aux valeurs saturées à 94 %).",
          "Réexportez une plage où les signaux évoluent réellement.",
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
  const emptyFields = Object.entries(missing).filter(([, n]) => n === samples.length).map(([k]) => k);
  if (emptyFields.length > 0) {
    return {
      cause: `Champs entièrement vides : ${emptyFields.join(', ')}.`,
      steps: [
        "Aucun signal NIRS (rSO₂) détecté : le fichier est traité en mode PRx (PIC/PAM/PPC).",
        "Pour le PRx, PIC, PAM et PPC doivent être présents (PPC peut être calculé si PAM et PIC le sont).",
        "Pour une analyse COx non invasive, importez plutôt un fichier avec les colonnes rSO₂ (NIRS) et PAM.",
      ],
    };
  }

  const complete = samples.filter((s) => s.pic !== null && s.pam !== null && s.ppc !== null);
  if (complete.length < REQUIRED_SAMPLES) {
    return {
      cause: `Calcul impossible : seulement ${complete.length}/${samples.length} échantillons contiennent PIC, PAM et PPC exploitables.`,
      steps: [
        "Trop de valeurs manquantes : contrôlez les artefacts et les périodes de déconnexion du capteur.",
        "Réexportez le fichier sur une plage temporelle où les 3 signaux sont enregistrés simultanément.",
      ],
    };
  }

  const constantFields = [
    { label: 'PIC', values: complete.map((s) => s.pic as number) },
    { label: 'PAM', values: complete.map((s) => s.pam as number) },
    { label: 'PPC', values: complete.map((s) => s.ppc as number) },
  ].filter(({ values }) => new Set(values.map((v) => v.toFixed(3))).size < 2);

  if (constantFields.length > 0) {
    const details = constantFields
      .map(({ label, values }) => `${label} = ${values[0].toFixed(1)} (constant)`)
      .join(', ');
    return {
      cause: `Signaux constants détectés : ${details}.`,
      steps: [
        "La corrélation PRx nécessite des variations physiologiques de PIC et PAM.",
        "La courbe PPC optimale nécessite une variabilité de PPC sur la période.",
        "Vérifiez que le capteur PIC était bien connecté et non zéroté artificiellement.",
        "Réexportez une plage où les signaux évoluent réellement (éviter les périodes de sédation profonde stable).",
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
export function buildCurve(
  samples: DerivedSample[],
  binSize = 5,
  minPerBin = 3,
  mode: AutoregMode = "prx",
): CurvePoint[] {
  const bins = new Map<number, { sum: number; count: number }>();
  for (const s of samples) {
    const axis = mode === "cox" ? s.pam : s.ppc;
    if (axis === null || s.prx === null) continue;
    const bin = Math.round(axis / binSize) * binSize;
    const cur = bins.get(bin) || { sum: 0, count: 0 };
    cur.sum += s.prx;
    cur.count += 1;
    bins.set(bin, cur);
  }
  const curve: CurvePoint[] = [];
  Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([ppc, { sum, count }]) => {
      if (count >= minPerBin) {
        curve.push({ ppc, prx: Math.round((sum / count) * 100) / 100, count });
      }
    });
  return curve;
}

export function analyzeCurve(curve: CurvePoint[]): {
  optimalPPC: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  minPrx: number | null;
  plateauValid: boolean;
} {
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
  return {
    mode,
    samples: derived,
    curve,
    ...analysis,
    sampleCount: samples.length,
    durationHours: Math.round(durationHours * 10) / 10,
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
  lines.push(`Nombre d'échantillons,${result.sampleCount}`);
  lines.push(`Durée (h),${result.durationHours}`);
  lines.push("");

  lines.push(`# Courbe ${L.index} vs ${L.pressure}`);
  lines.push(`${L.pressure} (mmHg),${L.index} moyen,N échantillons,Autorégulation`);
  result.curve.forEach((p) =>
    lines.push(`${p.ppc},${p.prx},${p.count},${p.prx < 0.3 ? "Préservée" : "Altérée"}`),
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

