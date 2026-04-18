import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DeidentifiedContext,
  buildDeidentifiedContext,
  PROMPT_TEMPLATES,
  PromptTemplate,
} from "@/services/copilotPrompt.service";
import {
  loadPatientFileData,
  hasPatientFileData,
  getTimeSeriesForRange,
  TimeSeriesDataPoint,
} from "@/services/patientFileData.service";

/**
 * Variables to export per organ module.
 * Keys MUST match Variable_* keys used in patientFileData.
 */
const ORGAN_VARIABLES: Record<string, Array<{ key: string; label: string; unit: string }>> = {
  cerveau: [
    { key: "Variable_PIC", label: "PIC", unit: "mmHg" },
    { key: "Variable_PPC", label: "PPC", unit: "mmHg" },
    { key: "Variable_PAM", label: "PAM", unit: "mmHg" },
    { key: "Variable_FC", label: "FC", unit: "bpm" },
    { key: "Variable_temperature", label: "Température", unit: "°C" },
    { key: "Variable_EtCO2", label: "ETCO2", unit: "mmHg" },
    { key: "Variable_paco2", label: "PaCO2", unit: "mmHg" },
  ],
  coeur: [
    { key: "Variable_FC", label: "FC", unit: "bpm" },
    { key: "Variable_PAM", label: "PAM", unit: "mmHg" },
    { key: "Variable_PVC", label: "PVC", unit: "mmHg" },
    { key: "Variable_temperature", label: "Température", unit: "°C" },
  ],
  poumons: [
    { key: "Variable_EtCO2", label: "ETCO2", unit: "mmHg" },
    { key: "Variable_paco2", label: "PaCO2", unit: "mmHg" },
    { key: "Variable_FC", label: "FC", unit: "bpm" },
    { key: "Variable_temperature", label: "Température", unit: "°C" },
  ],
  renal: [
    { key: "Variable_PAM", label: "PAM", unit: "mmHg" },
    { key: "Variable_FC", label: "FC", unit: "bpm" },
    { key: "Variable_temperature", label: "Température", unit: "°C" },
  ],
  gastro: [
    { key: "Variable_glycemie", label: "Glycémie", unit: "mmol/L" },
    { key: "Variable_temperature", label: "Température", unit: "°C" },
  ],
  general: [
    { key: "Variable_FC", label: "FC", unit: "bpm" },
    { key: "Variable_PAM", label: "PAM", unit: "mmHg" },
    { key: "Variable_temperature", label: "Température", unit: "°C" },
    { key: "Variable_glycemie", label: "Glycémie", unit: "mmol/L" },
  ],
};

const ORGAN_TITLES: Record<string, string> = {
  cerveau: "OptiBrain — Module neurologique",
  coeur: "OptiHeart — Module cardiovasculaire",
  poumons: "OptiLungs — Module respiratoire",
  renal: "OptiRenal — Module rénal",
  gastro: "OptiGastro — Module gastro-intestinal",
  general: "OptiState — Vue globale",
};

interface SeriesStats {
  label: string;
  unit: string;
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  last: number | null;
  lastTime: string | null;
}

function computeStats(series: TimeSeriesDataPoint[], label: string, unit: string): SeriesStats {
  if (!series.length) {
    return { label, unit, count: 0, min: null, max: null, mean: null, last: null, lastTime: null };
  }
  const vals = series.map((p) => p.valeur).filter((v) => Number.isFinite(v));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sorted = [...series].sort(
    (a, b) => new Date(a.charttime).getTime() - new Date(b.charttime).getTime()
  );
  const last = sorted[sorted.length - 1];
  return {
    label,
    unit,
    count: vals.length,
    min: Number(min.toFixed(1)),
    max: Number(max.toFixed(1)),
    mean: Number(mean.toFixed(1)),
    last: Number(last.valeur.toFixed(1)),
    lastTime: last.charttime,
  };
}

export interface DashboardExportOptions {
  patientId: string;
  organ: string;
  /** hours of history to include in raw data (default 24) */
  hoursBack?: number;
  /** Optional template to embed prompt at end of PDF */
  promptTemplateId?: string;
}

export async function exportOrganDashboardPDF(
  opts: DashboardExportOptions
): Promise<{ filename: string; promptText: string } | null> {
  const { patientId, organ, hoursBack = 24, promptTemplateId } = opts;

  const ctx = await buildDeidentifiedContext(patientId, organ);
  if (!ctx) return null;

  const variables = ORGAN_VARIABLES[organ] || ORGAN_VARIABLES.general;

  // Load time series
  const allStats: SeriesStats[] = [];
  const rawRows: Array<[string, string, string]> = []; // [time, label, value]

  if (hasPatientFileData(patientId)) {
    try {
      const fileData = await loadPatientFileData(patientId);
      if (fileData) {
        for (const v of variables) {
          const series = getTimeSeriesForRange(fileData, v.key, hoursBack);
          allStats.push(computeStats(series, v.label, v.unit));
          // Add to raw rows (cap at 200 most recent points)
          const sorted = [...series]
            .sort((a, b) => new Date(b.charttime).getTime() - new Date(a.charttime).getTime())
            .slice(0, 200);
          for (const p of sorted) {
            rawRows.push([
              new Date(p.charttime).toLocaleString("fr-CA", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              }),
              v.label,
              `${p.valeur.toFixed(1)} ${v.unit}`,
            ]);
          }
        }
      }
    } catch {
      // continue with empty data
    }
  }

  // Sort raw rows by time desc
  rawRows.sort((a, b) => (a[0] < b[0] ? 1 : -1));

  // Build prompt text (if template selected)
  let promptText = "";
  if (promptTemplateId) {
    const tpl = PROMPT_TEMPLATES.find((t) => t.id === promptTemplateId);
    if (tpl) promptText = tpl.build(ctx);
  }
  if (!promptText) {
    promptText = buildDefaultDashboardPrompt(ctx, allStats, hoursBack);
  }

  const filename = await renderPDF({
    organ,
    ctx,
    stats: allStats,
    rawRows,
    hoursBack,
    promptText,
  });

  return { filename, promptText };
}

function buildDefaultDashboardPrompt(
  ctx: DeidentifiedContext,
  stats: SeriesStats[],
  hoursBack: number
): string {
  return `**Contexte clinique (patient pédiatrique en USIP, dé-identifié) :**
- Âge: ${ctx.age}
- Poids: ${ctx.weight}
- Diagnostic: ${ctx.diagnosis}
${ctx.exam ? `- Examen: ${ctx.exam}\n` : ""}
**Données dashboard (${hoursBack}h) :**
${stats
  .filter((s) => s.count > 0)
  .map(
    (s) =>
      `- ${s.label}: dernier=${s.last}${s.unit}, moy=${s.mean}, min=${s.min}, max=${s.max} (n=${s.count})`
  )
  .join("\n")}

**Question :** Analysez ce dashboard. Identifiez les anomalies, tendances physiopathologiques et proposez des recommandations cliniques basées sur les guidelines PICU.`;
}

interface RenderArgs {
  organ: string;
  ctx: DeidentifiedContext;
  stats: SeriesStats[];
  rawRows: Array<[string, string, string]>;
  hoursBack: number;
  promptText: string;
}

async function renderPDF(args: RenderArgs): Promise<string> {
  const { organ, ctx, stats, rawRows, hoursBack, promptText } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(ORGAN_TITLES[organ] || "Dashboard MyPICU", margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Export clinique dé-identifié — ${new Date().toLocaleString("fr-CA")}`,
    margin,
    16
  );
  y = 30;

  // Privacy banner
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(239, 246, 255);
  doc.rect(margin, y, pageWidth - 2 * margin, 10, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Document dé-identifié (sans nom ni ID patient). Vérifiez avant partage avec un assistant IA.",
    margin + 2,
    y + 6
  );
  y += 14;

  // Patient context
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Contexte patient", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const ctxLines = [
    `Âge: ${ctx.age}    Poids: ${ctx.weight}`,
    `Diagnostic: ${ctx.diagnosis}`,
    ctx.exam ? `Examen: ${ctx.exam}` : "",
  ].filter(Boolean);
  for (const line of ctxLines) {
    doc.text(line, margin, y);
    y += 4.5;
  }
  y += 2;

  // Scores
  const scoreEntries: Array<[string, string]> = (
    [
      ["PELOD-2", ctx.pelodScore],
      ["GCS", ctx.gcs],
      ["Score cérébral", ctx.brainScore],
      ["Score cardiaque", ctx.heartScore],
      ["Score pulmonaire", ctx.lungsScore],
      ["Score rénal", ctx.kidneyScore],
    ] as Array<[string, number | null | undefined]>
  )
    .filter(([, v]) => v != null)
    .map(([k, v]) => [k, String(v)] as [string, string]);

  if (scoreEntries.length) {
    autoTable(doc, {
      startY: y,
      head: [["Score", "Valeur"]],
      body: scoreEntries,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin },
      tableWidth: 80,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Synthesis table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Synthèse des paramètres (${hoursBack}h)`, margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Paramètre", "Dernier", "Moyenne", "Min", "Max", "N"]],
    body: stats.map((s) =>
      s.count
        ? [
            `${s.label} (${s.unit})`,
            String(s.last),
            String(s.mean),
            String(s.min),
            String(s.max),
            String(s.count),
          ]
        : [`${s.label} (${s.unit})`, "—", "—", "—", "—", "0"]
    ),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: margin, right: margin },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Medications
  if (ctx.medications.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Médicaments actifs", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const medText = doc.splitTextToSize(ctx.medications.join(", "), pageWidth - 2 * margin);
    doc.text(medText, margin, y);
    y += medText.length * 4.5 + 4;
  }

  // Raw data table on new page
  if (rawRows.length) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Données brutes (${hoursBack}h, max 200 points/paramètre)`, margin, margin);
    autoTable(doc, {
      startY: margin + 4,
      head: [["Heure", "Paramètre", "Valeur"]],
      body: rawRows.slice(0, 800), // cap PDF size
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin },
    });
  }

  // Prompt page
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Prompt suggéré pour Copilot", margin, margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const promptLines = doc.splitTextToSize(promptText, pageWidth - 2 * margin);
  doc.text(promptLines, margin, margin + 8);

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `MyPICU — Dashboard dé-identifié — Page ${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  const filename = `dashboard_${organ}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

export function getOrganTemplates(organ: string): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter((t) => !t.organs || t.organs.includes(organ));
}

export const ORGAN_OPTIONS = [
  { value: "cerveau", label: "OptiBrain (neurologique)" },
  { value: "coeur", label: "OptiHeart (cardiovasculaire)" },
  { value: "poumons", label: "OptiLungs (respiratoire)" },
  { value: "renal", label: "OptiRenal (rénal)" },
  { value: "gastro", label: "OptiGastro (gastro-intestinal)" },
  { value: "general", label: "OptiState (global)" },
];
