// Autoregulation computation service for the standalone /autoreg study page.
// Parses user-uploaded CSV or JSON files and computes PRx-based indices.

export interface RawSample {
  time: Date;
  pic: number | null;
  pam: number | null;
  ppc: number | null;
}

export interface DerivedSample extends RawSample {
  prx: number | null;
}

export interface CurvePoint {
  ppc: number;
  prx: number;
  count: number;
}

export interface AutoregResult {
  samples: DerivedSample[];
  curve: CurvePoint[];
  optimalPPC: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  minPrx: number | null;
  sampleCount: number;
  durationHours: number;
}

const PRX_THRESHOLD = 0.3;

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
const HEADER_MAP: Record<string, "time" | "pic" | "pam" | "ppc"> = {
  horodate: "time",
  time: "time",
  timestamp: "time",
  datetime: "time",
  date: "time",
  pic: "pic",
  icp: "pic",
  pam: "pam",
  map: "pam",
  abpm: "pam",
  ppc: "ppc",
  cpp: "ppc",
  rawppc: "ppc",
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
    if (pam === null && ppc !== null && pic !== null) pam = ppc + pic;
    out.push({ time: t, pic, pam, ppc });
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
      // Derive PAM from PPC + PIC when only PPC/PIC are recorded (PPC = PAM − PIC).
      if (pam === null && ppc !== null && pic !== null) pam = ppc + pic;
      out.push({ time: t, pic, pam, ppc });
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

// Compute PRx as rolling Pearson correlation of PIC and PAM
export function computePRx(samples: RawSample[], windowSize = 30): DerivedSample[] {
  const out: DerivedSample[] = samples.map((s) => ({ ...s, prx: null }));
  for (let i = windowSize - 1; i < samples.length; i++) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let j = i - windowSize + 1; j <= i; j++) {
      const p = samples[j].pam;
      const c = samples[j].pic;
      if (p !== null && c !== null) {
        xs.push(p);
        ys.push(c);
      }
    }
    out[i].prx = pearson(xs, ys);
  }
  return out;
}

// Build PRx-vs-PPC curve by binning PPC and averaging PRx per bin
export function buildCurve(samples: DerivedSample[], binSize = 5, minPerBin = 3): CurvePoint[] {
  const bins = new Map<number, { sum: number; count: number }>();
  for (const s of samples) {
    if (s.ppc === null || s.prx === null) continue;
    const bin = Math.round(s.ppc / binSize) * binSize;
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
} {
  if (curve.length === 0) {
    return { optimalPPC: null, lowerLimit: null, upperLimit: null, minPrx: null };
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

  return {
    optimalPPC,
    lowerLimit,
    upperLimit,
    minPrx: minPrx === Infinity ? null : Math.round(minPrx * 100) / 100,
  };
}

export function runAnalysis(samples: RawSample[], windowSize = 30, binSize = 5): AutoregResult {
  const derived = computePRx(samples, windowSize);
  const curve = buildCurve(derived, binSize);
  const analysis = analyzeCurve(curve);
  const durationHours =
    samples.length > 1
      ? (samples[samples.length - 1].time.getTime() - samples[0].time.getTime()) / 3_600_000
      : 0;
  return {
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
  ppc: number | null;
  pic: number | null;
  pam: number | null;
}

export function rollingOptimal(
  samples: DerivedSample[],
  windowSize = 240,
  step = 30,
  binSize = 5,
): OptimalTimePoint[] {
  const out: OptimalTimePoint[] = [];
  for (let i = windowSize; i < samples.length; i += step) {
    const slice = samples.slice(i - windowSize, i);
    const curve = buildCurve(slice, binSize, 2);
    const a = analyzeCurve(curve);
    const s = samples[i];
    out.push({
      time: s.time.toISOString(),
      optimalPPC: a.optimalPPC,
      lowerLimit: a.lowerLimit,
      upperLimit: a.upperLimit,
      ppc: s.ppc,
      pic: s.pic,
      pam: s.pam,
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
  const exportedAt = meta.exportedAt ?? new Date();
  const studyDate = meta.studyDate ?? result.samples[0]?.time ?? null;

  lines.push("# Métadonnées du sujet");
  lines.push(`ID patient,${csvEscape(meta.subjectId)}`);
  lines.push(`Code sujet,${csvEscape(meta.subjectCode)}`);
  lines.push(`Libellé sujet,${csvEscape(meta.subjectLabel)}`);
  lines.push(`Fichier source,${csvEscape(meta.fileName)}`);
  lines.push(`Date d'étude,${studyDate ? studyDate.toISOString() : ""}`);
  lines.push(`Date d'export,${exportedAt.toISOString()}`);
  lines.push("");

  lines.push("# Résumé des résultats optimaux");
  lines.push(`PPC optimale (mmHg),${result.optimalPPC ?? ""}`);
  lines.push(`LLA (mmHg),${result.lowerLimit ?? ""}`);
  lines.push(`ULA (mmHg),${result.upperLimit ?? ""}`);
  lines.push(`PRx minimum,${result.minPrx ?? ""}`);
  lines.push(`Nombre d'échantillons,${result.sampleCount}`);
  lines.push(`Durée (h),${result.durationHours}`);
  lines.push("");

  lines.push("# Courbe PRx vs PPC");
  lines.push("PPC (mmHg),PRx moyen,N échantillons,Autorégulation");
  result.curve.forEach((p) =>
    lines.push(`${p.ppc},${p.prx},${p.count},${p.prx < 0.3 ? "Préservée" : "Altérée"}`),
  );
  lines.push("");

  lines.push("# Séries temporelles");
  lines.push("Horodate,PIC,PAM,PPC,PRx");
  result.samples.forEach((s) =>
    lines.push(
      `${s.time.toISOString()},${s.pic ?? ""},${s.pam ?? ""},${s.ppc ?? ""},${s.prx ?? ""}`,
    ),
  );
  return lines.join("\n");
}

