import jsPDF from "jspdf";
import { tr, getLang, intlLocale } from "@/i18n";
import { term } from "@/i18n/terms";
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

const organTitle = (organ: string): string | undefined =>
  ({
    cerveau: tr("OptiBrain — Module neurologique", "OptiBrain — Neurological module"),
    coeur: tr("OptiHeart — Module cardiovasculaire", "OptiHeart — Cardiovascular module"),
    poumons: tr("OptiLungs — Module respiratoire", "OptiLungs — Respiratory module"),
    renal: tr("OptiRenal — Module rénal", "OptiRenal — Renal module"),
    gastro: tr("OptiGastro — Module gastro-intestinal", "OptiGastro — Gastrointestinal module"),
    general: tr("OptiState — Vue globale", "OptiState — Overall view"),
  })[organ];

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
              new Date(p.charttime).toLocaleString(intlLocale(), {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              }),
              term(v.label),
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
  const statLines = stats
    .filter((s) => s.count > 0)
    .map((s) =>
      tr(
        `- ${s.label}: dernier=${s.last}${s.unit}, moy=${s.mean}, min=${s.min}, max=${s.max} (n=${s.count})`,
        `- ${term(s.label)}: last=${s.last}${s.unit}, mean=${s.mean}, min=${s.min}, max=${s.max} (n=${s.count})`,
      ),
    )
    .join("\n");
  if (getLang() === "en") {
    return `**Clinical context (paediatric PICU patient, de-identified):**
- Age: ${ctx.age}
- Weight: ${ctx.weight}
- Diagnosis: ${ctx.diagnosis}
${ctx.exam ? `- Exam: ${ctx.exam}\n` : ""}
**Dashboard data (${hoursBack}h):**
${statLines}

**Question:** Analyse this dashboard. Identify abnormalities and pathophysiological trends, and propose clinical recommendations based on PICU guidelines.`;
  }
  return `**Contexte clinique (patient pédiatrique en USIP, dé-identifié) :**
- Âge: ${ctx.age}
- Poids: ${ctx.weight}
- Diagnostic: ${ctx.diagnosis}
${ctx.exam ? `- Examen: ${ctx.exam}\n` : ""}
**Données dashboard (${hoursBack}h) :**
${statLines}

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
  doc.text(organTitle(organ) || "Dashboard MyPICU", margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    tr(`Export clinique dé-identifié — ${new Date().toLocaleString(intlLocale())}`, `De-identified clinical export — ${new Date().toLocaleString(intlLocale())}`),
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
    tr("Document dé-identifié (sans nom ni ID patient). Vérifiez avant partage avec un assistant IA.", "De-identified document (no patient name or ID). Check before sharing with an AI assistant."),
    margin + 2,
    y + 6
  );
  y += 14;

  // Patient context
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(tr("Contexte patient", "Patient context"), margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const ctxLines = [
    tr(`Âge: ${ctx.age}    Poids: ${ctx.weight}`, `Age: ${ctx.age}    Weight: ${ctx.weight}`),
    tr(`Diagnostic: ${ctx.diagnosis}`, `Diagnosis: ${ctx.diagnosis}`),
    ctx.exam ? tr(`Examen: ${ctx.exam}`, `Exam: ${ctx.exam}`) : "",
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
      [tr("Score cérébral", "Brain score"), ctx.brainScore],
      [tr("Score cardiaque", "Cardiac score"), ctx.heartScore],
      [tr("Score pulmonaire", "Pulmonary score"), ctx.lungsScore],
      [tr("Score rénal", "Renal score"), ctx.kidneyScore],
    ] as Array<[string, number | null | undefined]>
  )
    .filter(([, v]) => v != null)
    .map(([k, v]) => [k, String(v)] as [string, string]);

  if (scoreEntries.length) {
    autoTable(doc, {
      startY: y,
      head: [["Score", tr("Valeur", "Value")]],
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
  doc.text(tr(`Synthèse des paramètres (${hoursBack}h)`, `Parameter summary (${hoursBack}h)`), margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [[tr("Paramètre", "Parameter"), tr("Dernier", "Last"), tr("Moyenne", "Mean"), "Min", "Max", "N"]],
    body: stats.map((s) =>
      s.count
        ? [
            `${term(s.label)} (${s.unit})`,
            String(s.last),
            String(s.mean),
            String(s.min),
            String(s.max),
            String(s.count),
          ]
        : [`${term(s.label)} (${s.unit})`, "—", "—", "—", "—", "0"]
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
    doc.text(tr("Médicaments actifs", "Active medications"), margin, y);
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
    doc.text(tr(`Données brutes (${hoursBack}h, max 200 points/paramètre)`, `Raw data (${hoursBack}h, max 200 points/parameter)`), margin, margin);
    autoTable(doc, {
      startY: margin + 4,
      head: [[tr("Heure", "Time"), tr("Paramètre", "Parameter"), tr("Valeur", "Value")]],
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
  doc.text(tr("Prompt suggéré pour Copilot", "Suggested prompt for Copilot"), margin, margin);
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
      tr(`MyPICU — Dashboard dé-identifié — Page ${i}/${pageCount}`, `MyPICU — De-identified dashboard — Page ${i}/${pageCount}`),
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
  { value: "cerveau", get label() { return tr("OptiBrain (neurologique)", "OptiBrain (neurological)"); } },
  { value: "coeur", get label() { return tr("OptiHeart (cardiovasculaire)", "OptiHeart (cardiovascular)"); } },
  { value: "poumons", get label() { return tr("OptiLungs (respiratoire)", "OptiLungs (respiratory)"); } },
  { value: "renal", get label() { return tr("OptiRenal (rénal)", "OptiRenal (renal)"); } },
  { value: "gastro", get label() { return tr("OptiGastro (gastro-intestinal)", "OptiGastro (gastrointestinal)"); } },
  { value: "general", get label() { return tr("OptiState (global)", "OptiState (overall)"); } },
];

// ---------------- Multi-module export ----------------

export interface MultiDashboardExportOptions {
  patientId: string;
  organs: string[];
  hoursBack?: number;
  promptTemplateIds?: string[];
}

interface OrganSection {
  organ: string;
  stats: SeriesStats[];
  rawRows: Array<[string, string, string]>;
}

export async function exportMultiDashboardPDF(
  opts: MultiDashboardExportOptions
): Promise<{ filename: string; promptText: string } | null> {
  const { patientId, organs, hoursBack = 24, promptTemplateIds = [] } = opts;
  if (!organs.length) return null;

  const ctx = await buildDeidentifiedContext(patientId, organs[0]);
  if (!ctx) return null;

  const sections: OrganSection[] = [];
  let fileData: Awaited<ReturnType<typeof loadPatientFileData>> | null = null;
  if (hasPatientFileData(patientId)) {
    try {
      fileData = await loadPatientFileData(patientId);
    } catch {
      fileData = null;
    }
  }

  for (const organ of organs) {
    const variables = ORGAN_VARIABLES[organ] || ORGAN_VARIABLES.general;
    const stats: SeriesStats[] = [];
    const rawRows: Array<[string, string, string]> = [];
    if (fileData) {
      for (const v of variables) {
        const series = getTimeSeriesForRange(fileData, v.key, hoursBack);
        stats.push(computeStats(series, v.label, v.unit));
        const sorted = [...series]
          .sort((a, b) => new Date(b.charttime).getTime() - new Date(a.charttime).getTime())
          .slice(0, 200);
        for (const p of sorted) {
          rawRows.push([
            new Date(p.charttime).toLocaleString(intlLocale(), {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            }),
            term(v.label),
            `${p.valeur.toFixed(1)} ${v.unit}`,
          ]);
        }
      }
    } else {
      for (const v of variables) stats.push(computeStats([], v.label, v.unit));
    }
    rawRows.sort((a, b) => (a[0] < b[0] ? 1 : -1));
    sections.push({ organ, stats, rawRows });
  }

  const selectedTemplates = promptTemplateIds
    .map((id) => PROMPT_TEMPLATES.find((t) => t.id === id))
    .filter((t): t is PromptTemplate => Boolean(t));

  let promptText: string;
  if (selectedTemplates.length) {
    const parts = selectedTemplates.map((t, i) => {
      const tplCtx = { ...ctx, organ: organs[0] };
      return `### Question ${i + 1} — ${t.label}\n\n${t.build(tplCtx)}`;
    });
    promptText = parts.join("\n\n---\n\n");
  } else {
    const allStats = sections.flatMap((s) => s.stats);
    promptText = buildDefaultDashboardPrompt(ctx, allStats, hoursBack);
  }

  const filename = await renderMultiPDF({
    organs,
    ctx,
    sections,
    hoursBack,
    promptText,
    selectedTemplates,
  });

  return { filename, promptText };
}

interface RenderMultiArgs {
  organs: string[];
  ctx: DeidentifiedContext;
  sections: OrganSection[];
  hoursBack: number;
  promptText: string;
  selectedTemplates: PromptTemplate[];
}

async function renderMultiPDF(args: RenderMultiArgs): Promise<string> {
  const { organs, ctx, sections, hoursBack, promptText, selectedTemplates } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Cover page
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(tr("Dashboard MyPICU — Export multi-modules", "MyPICU dashboard — Multi-module export"), margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    tr(`Export clinique dé-identifié — ${new Date().toLocaleString(intlLocale())}`, `De-identified clinical export — ${new Date().toLocaleString(intlLocale())}`),
    margin,
    16
  );

  let y = 30;
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(239, 246, 255);
  doc.rect(margin, y, pageWidth - 2 * margin, 10, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    tr("Document dé-identifié (sans nom ni ID patient). Vérifiez avant partage avec un assistant IA.", "De-identified document (no patient name or ID). Check before sharing with an AI assistant."),
    margin + 2,
    y + 6
  );
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(tr("Contexte patient", "Patient context"), margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const ctxLines = [
    tr(`Âge: ${ctx.age}    Poids: ${ctx.weight}`, `Age: ${ctx.age}    Weight: ${ctx.weight}`),
    tr(`Diagnostic: ${ctx.diagnosis}`, `Diagnosis: ${ctx.diagnosis}`),
    ctx.exam ? tr(`Examen: ${ctx.exam}`, `Exam: ${ctx.exam}`) : "",
  ].filter(Boolean);
  for (const line of ctxLines) {
    doc.text(line, margin, y);
    y += 4.5;
  }
  y += 2;

  const scoreEntries: Array<[string, string]> = (
    [
      ["PELOD-2", ctx.pelodScore],
      ["GCS", ctx.gcs],
      [tr("Score cérébral", "Brain score"), ctx.brainScore],
      [tr("Score cardiaque", "Cardiac score"), ctx.heartScore],
      [tr("Score pulmonaire", "Pulmonary score"), ctx.lungsScore],
      [tr("Score rénal", "Renal score"), ctx.kidneyScore],
    ] as Array<[string, number | null | undefined]>
  )
    .filter(([, v]) => v != null)
    .map(([k, v]) => [k, String(v)] as [string, string]);

  if (scoreEntries.length) {
    autoTable(doc, {
      startY: y,
      head: [["Score", tr("Valeur", "Value")]],
      body: scoreEntries,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin },
      tableWidth: 80,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (ctx.medications.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(tr("Médicaments actifs", "Active medications"), margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const medText = doc.splitTextToSize(ctx.medications.join(", "), pageWidth - 2 * margin);
    doc.text(medText, margin, y);
    y += medText.length * 4.5 + 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(tr("Modules inclus dans cet export", "Modules included in this export"), margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const o of organs) {
    doc.text(`• ${organTitle(o) || o}`, margin + 2, y);
    y += 4.5;
  }

  // One section per organ
  for (const section of sections) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(37, 99, 235);
    doc.text(organTitle(section.organ) || section.organ, margin, margin + 2);
    doc.setTextColor(0, 0, 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(tr(`Synthèse des paramètres (${hoursBack}h)`, `Parameter summary (${hoursBack}h)`), margin, margin + 10);

    autoTable(doc, {
      startY: margin + 13,
      head: [[tr("Paramètre", "Parameter"), tr("Dernier", "Last"), tr("Moyenne", "Mean"), "Min", "Max", "N"]],
      body: section.stats.map((s) =>
        s.count
          ? [
              `${term(s.label)} (${s.unit})`,
              String(s.last),
              String(s.mean),
              String(s.min),
              String(s.max),
              String(s.count),
            ]
          : [`${term(s.label)} (${s.unit})`, "—", "—", "—", "—", "0"]
      ),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin },
    });

    if (section.rawRows.length) {
      const finalY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(tr(`Données brutes (max 200 pts/paramètre)`, `Raw data (max 200 pts/parameter)`), margin, finalY);
      autoTable(doc, {
        startY: finalY + 2,
        head: [[tr("Heure", "Time"), tr("Paramètre", "Parameter"), tr("Valeur", "Value")]],
        body: section.rawRows.slice(0, 600),
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin },
      });
    }
  }

  // Prompt page
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text(
    selectedTemplates.length > 1
      ? tr(`${selectedTemplates.length} prompts suggérés pour Copilot`, `${selectedTemplates.length} suggested prompts for Copilot`)
      : tr("Prompt suggéré pour Copilot", "Suggested prompt for Copilot"),
    margin,
    margin
  );
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const promptLines = doc.splitTextToSize(promptText, pageWidth - 2 * margin);
  doc.text(promptLines, margin, margin + 8);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      tr(`MyPICU — Dashboard dé-identifié — Page ${i}/${pageCount}`, `MyPICU — De-identified dashboard — Page ${i}/${pageCount}`),
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  const suffix = organs.length > 1 ? "multi" : organs[0];
  const filename = `dashboard_${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
