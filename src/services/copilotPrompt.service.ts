import { supabase } from "@/integrations/supabase/client";
import {
  loadPatientFileData,
  hasPatientFileData,
  getLatestValue,
  PatientFileData,
} from "@/services/patientFileData.service";
import { getOntologyNodeByVariableKey, formatThresholds } from "@/ontology/queries";
import { tr, getLang } from "@/i18n";
import { term } from "@/i18n/terms";

export type PromptCategory =
  | "differential"
  | "labs"
  | "treatment"
  | "interpretation"
  | "guidelines"
  | "monitoring";

export interface PromptTemplate {
  id: string;
  category: PromptCategory;
  label: string;
  description: string;
  organs?: string[]; // restrict to specific organ pages, undefined = all
  build: (ctx: DeidentifiedContext) => string;
}

/**
 * De-identified clinical context.
 * MINIMAL de-identification: removes name + patient ID,
 * keeps age/weight/clinical data (useful for clinical reasoning).
 */
export interface DeidentifiedContext {
  age: string;
  weight: string;
  diagnosis: string;
  exam?: string;
  pelodScore?: number;
  gcs?: number;
  brainScore?: number;
  heartScore?: number;
  lungsScore?: number;
  kidneyScore?: number;
  vitals: Record<string, number | null>;
  medications: string[];
  organ?: string;
}

const organLabel = (organ: string): string =>
  ({
    cerveau: tr("neurologique", "neurological"),
    coeur: tr("cardiovasculaire", "cardiovascular"),
    poumons: tr("respiratoire", "respiratory"),
    renal: tr("rénal", "renal"),
    gastro: tr("gastro-intestinal", "gastrointestinal"),
    general: tr("global", "overall"),
  })[organ] ?? "";

const VITAL_LABELS: Record<string, string> = {
  Variable_FC: "FC",
  Variable_PIC: "PIC",
  Variable_PPC: "PPC",
  Variable_PAM: "PAM",
  Variable_PVC: "PVC",
  Variable_temperature: "Température",
  Variable_EtCO2: "ETCO2",
  Variable_paco2: "PaCO2",
  Variable_glycemie: "Glycémie",
  Variable_INR: "INR",
  Variable_plaquettes: "Plaquettes",
  Variable_hemoglobine: "Hémoglobine",
  Variable_position_tete: "Position tête",
};

/**
 * Build a de-identified clinical context for the patient.
 * Strips name and patient ID. Keeps clinical data.
 */
export async function buildDeidentifiedContext(
  patientId: string,
  organ?: string
): Promise<DeidentifiedContext | null> {
  // Patient demographics from DB (no name/id included)
  const { data: patient, error } = await supabase
    .from("patients")
    .select("age, weight, diagnosis, exam, pelod_score, gcs, brain_score, heart_score, lungs_score, kidney_score")
    .eq("id", patientId)
    .maybeSingle();

  if (error || !patient) return null;

  const ctx: DeidentifiedContext = {
    age: patient.age,
    weight: patient.weight,
    diagnosis: patient.diagnosis,
    exam: patient.exam || undefined,
    pelodScore: patient.pelod_score ?? undefined,
    gcs: patient.gcs ?? undefined,
    brainScore: patient.brain_score ?? undefined,
    heartScore: patient.heart_score ?? undefined,
    lungsScore: patient.lungs_score ?? undefined,
    kidneyScore: patient.kidney_score ?? undefined,
    vitals: {},
    medications: [],
    organ,
  };

  // Try to load latest vitals + meds
  if (hasPatientFileData(patientId)) {
    try {
      const fileData = await loadPatientFileData(patientId);
      if (fileData) {
        for (const key of Object.keys(VITAL_LABELS)) {
          const latest = getLatestValue(fileData, key);
          ctx.vitals[key] = latest ? latest.value : null;
        }
        const opioidesArr = (fileData.Variable_opioides as Array<{ drugname: string }> | undefined) || [];
        const antiepArr = (fileData.Variable_anti_epileptique as Array<{ drugname: string }> | undefined) || [];
        const opioides = opioidesArr.map((m) => m.drugname).filter(Boolean);
        const antiep = antiepArr.map((m) => m.drugname).filter(Boolean);
        ctx.medications = [...new Set([...opioides, ...antiep])];
      }
    } catch {
      // ignore — still useful without
    }
  }

  return ctx;
}

function formatVitals(vitals: Record<string, number | null>): string {
  const lines: string[] = [];
  for (const [key, label] of Object.entries(VITAL_LABELS)) {
    const v = vitals[key];
    if (v == null || isNaN(v)) continue;
    const ontologyNode = getOntologyNodeByVariableKey(key);
    const thresholds = ontologyNode ? formatThresholds(ontologyNode.thresholds) : null;
    lines.push(thresholds ? `- ${term(label)}: ${v} (${thresholds})` : `- ${term(label)}: ${v}`);
  }
  return lines.length ? lines.join("\n") : tr("(aucune donnée vitale récente)", "(no recent vital data)");
}

function formatScores(ctx: DeidentifiedContext): string {
  const lines: string[] = [];
  if (ctx.pelodScore != null) lines.push(`- PELOD-2: ${ctx.pelodScore}`);
  if (ctx.gcs != null) lines.push(`- GCS: ${ctx.gcs}`);
  if (ctx.brainScore != null) lines.push(`- ${tr("Score cérébral", "Brain score")}: ${ctx.brainScore}`);
  if (ctx.heartScore != null) lines.push(`- ${tr("Score cardiaque", "Cardiac score")}: ${ctx.heartScore}`);
  if (ctx.lungsScore != null) lines.push(`- ${tr("Score pulmonaire", "Pulmonary score")}: ${ctx.lungsScore}`);
  if (ctx.kidneyScore != null) lines.push(`- ${tr("Score rénal", "Renal score")}: ${ctx.kidneyScore}`);
  return lines.length ? lines.join("\n") : tr("(aucun score disponible)", "(no score available)");
}

function patientHeader(ctx: DeidentifiedContext): string {
  if (getLang() === "en") {
    return `**Clinical context (paediatric PICU patient, de-identified):**
- Age: ${ctx.age}
- Weight: ${ctx.weight}
- Main diagnosis: ${ctx.diagnosis}${ctx.exam ? `\n- Exam: ${ctx.exam}` : ""}

**Severity scores:**
${formatScores(ctx)}

**Recent vital signs:**
${formatVitals(ctx.vitals)}

**Active medications:** ${ctx.medications.length ? ctx.medications.join(", ") : "(none recorded)"}`;
  }
  return `**Contexte clinique (patient pédiatrique en USIP, dé-identifié) :**
- Âge: ${ctx.age}
- Poids: ${ctx.weight}
- Diagnostic principal: ${ctx.diagnosis}${ctx.exam ? `\n- Examen: ${ctx.exam}` : ""}

**Scores de gravité :**
${formatScores(ctx)}

**Signes vitaux récents :**
${formatVitals(ctx.vitals)}

**Médicaments actifs :** ${ctx.medications.length ? ctx.medications.join(", ") : "(aucun renseigné)"}`;
}

// ---------- TEMPLATES ----------

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // DIFFERENTIAL
  {
    id: "diff-general",
    category: "differential",
    get label() { return tr("Diagnostic différentiel", "Differential diagnosis"); },
    get description() { return tr("Liste de diagnostics différentiels basés sur la présentation clinique", "List of differential diagnoses based on the clinical presentation"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Quels sont les diagnostics différentiels à considérer pour ce tableau clinique ? Classez-les par probabilité et indiquez les examens complémentaires utiles pour les départager.", "**Question:** What differential diagnoses should be considered for this clinical picture? Rank them by likelihood and indicate the additional tests useful to distinguish them.")}`,
  },
  {
    id: "diff-deterioration",
    category: "differential",
    get label() { return tr("Causes de détérioration", "Causes of deterioration"); },
    get description() { return tr("Causes possibles d'une détérioration aiguë", "Possible causes of acute deterioration"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr(`**Question :** Devant une détérioration clinique${ctx.organ ? ` ${organLabel(ctx.organ)}` : ""}, quelles sont les causes les plus probables à rechercher en priorité ?`, `**Question:** Faced with ${ctx.organ ? `${organLabel(ctx.organ)} ` : ""}clinical deterioration, which causes are most likely and should be looked for first?`)}`,
  },

  // LABS / IMAGING
  {
    id: "labs-interpret",
    category: "labs",
    get label() { return tr("Interprétation des labos", "Lab interpretation"); },
    get description() { return tr("Aide à l'interprétation de résultats biologiques", "Help interpreting lab results"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Aidez-moi à interpréter les résultats biologiques de ce patient. Quelles anomalies sont cliniquement significatives et quelle est leur signification dans ce contexte ?", "**Question:** Help me interpret this patient's lab results. Which abnormalities are clinically significant and what do they mean in this context?")}`,
  },
  {
    id: "imaging-suggest",
    category: "labs",
    get label() { return tr("Examens d'imagerie utiles", "Useful imaging"); },
    get description() { return tr("Quels examens d'imagerie demander", "Which imaging studies to order"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Quels examens d'imagerie seraient les plus pertinents à demander pour ce patient et pourquoi ?", "**Question:** Which imaging studies would be most relevant to order for this patient, and why?")}`,
  },

  // TREATMENT
  {
    id: "treat-plan",
    category: "treatment",
    get label() { return tr("Plan thérapeutique", "Treatment plan"); },
    get description() { return tr("Plan de prise en charge basé sur les guidelines PICU", "Management plan based on PICU guidelines"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr(`**Question :** Quel plan thérapeutique recommandez-vous pour ce patient pédiatrique en USIP, en vous basant sur les guidelines internationales actuelles ?${ctx.organ ? ` Centrez la réponse sur la prise en charge ${organLabel(ctx.organ)}.` : ""}`, `**Question:** What treatment plan do you recommend for this paediatric PICU patient, based on current international guidelines?${ctx.organ ? ` Focus the answer on ${organLabel(ctx.organ)} management.` : ""}`)}`,
  },
  {
    id: "treat-meds",
    category: "treatment",
    get label() { return tr("Ajustement médicamenteux", "Medication adjustment"); },
    get description() { return tr("Recommandations sur la médication actuelle", "Recommendations on current medication"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Compte tenu de l'âge, du poids et de l'état clinique de ce patient, quels ajustements médicamenteux suggérez-vous ? Y a-t-il des interactions ou contre-indications à surveiller ?", "**Question:** Given this patient's age, weight and clinical state, what medication adjustments do you suggest? Are there interactions or contraindications to watch for?")}`,
  },
  {
    id: "treat-fluids",
    category: "treatment",
    get label() { return tr("Gestion hydroélectrolytique", "Fluid and electrolyte management"); },
    get description() { return tr("Stratégie de remplissage et électrolytes", "Fluid resuscitation and electrolyte strategy"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Quelle stratégie de remplissage et de gestion hydroélectrolytique recommandez-vous pour ce patient ?", "**Question:** What fluid resuscitation and electrolyte management strategy do you recommend for this patient?")}`,
  },

  // INTERPRETATION
  {
    id: "interp-trends",
    category: "interpretation",
    get label() { return tr("Interprétation des tendances", "Trend interpretation"); },
    get description() { return tr("Analyse des tendances des signes vitaux", "Analysis of vital sign trends"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Quelles tendances physiopathologiques sont suggérées par ces signes vitaux ? Quels paramètres méritent une surveillance accrue ?", "**Question:** What pathophysiological trends do these vital signs suggest? Which parameters warrant closer monitoring?")}`,
  },
  {
    id: "interp-severity",
    category: "interpretation",
    get label() { return tr("Évaluation de la gravité", "Severity assessment"); },
    get description() { return tr("Niveau de gravité et pronostic", "Severity level and prognosis"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Comment évalueriez-vous la gravité actuelle de ce patient ? Quels sont les éléments pronostiques à considérer ?", "**Question:** How would you assess this patient's current severity? What prognostic factors should be considered?")}`,
  },

  // GUIDELINES
  {
    id: "guide-picu",
    category: "guidelines",
    get label() { return tr("Guidelines PICU applicables", "Applicable PICU guidelines"); },
    get description() { return tr("Recommandations internationales pertinentes", "Relevant international recommendations"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Quelles guidelines internationales (PALS, ESPNIC, SCCM, etc.) s'appliquent à cette situation ? Résumez les recommandations clés.", "**Question:** Which international guidelines (PALS, ESPNIC, SCCM, etc.) apply to this situation? Summarise the key recommendations.")}`,
  },

  // MONITORING
  {
    id: "monitor-priorities",
    category: "monitoring",
    get label() { return tr("Priorités de monitorage", "Monitoring priorities"); },
    get description() { return tr("Éléments à surveiller en priorité", "Items to monitor first"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Quels paramètres de monitorage et signes d'alerte doivent être surveillés en priorité chez ce patient dans les prochaines heures ?", "**Question:** Which monitoring parameters and warning signs should be watched first in this patient over the next hours?")}`,
  },
  {
    id: "monitor-redflags",
    category: "monitoring",
    get label() { return tr("Signes d'alerte (red flags)", "Warning signs (red flags)"); },
    get description() { return tr("Signes nécessitant escalade", "Signs requiring escalation"); },
    build: (ctx) => `${patientHeader(ctx)}

${tr("**Question :** Quels sont les signes d'alerte (red flags) qui devraient déclencher une escalade thérapeutique ou un appel à l'intensiviste sénior ?", "**Question:** What warning signs (red flags) should trigger therapeutic escalation or a call to the senior intensivist?")}`,
  },
];

export const getCategoryLabels = (): Record<PromptCategory, string> => ({
  differential: tr("Diagnostic différentiel", "Differential diagnosis"),
  labs: tr("Labos & imagerie", "Labs & imaging"),
  treatment: tr("Plan thérapeutique", "Treatment plan"),
  interpretation: tr("Interprétation", "Interpretation"),
  guidelines: tr("Guidelines", "Guidelines"),
  monitoring: tr("Monitorage", "Monitoring"),
});

export function getTemplatesForOrgan(organ?: string): PromptTemplate[] {
  if (!organ) return PROMPT_TEMPLATES;
  return PROMPT_TEMPLATES.filter((t) => !t.organs || t.organs.includes(organ));
}

export const COPILOT_URL = "https://m365.cloud.microsoft/chat/?titleId=T_30cd0c45-1a97-594b-3a2d-dd9154f328ef";
