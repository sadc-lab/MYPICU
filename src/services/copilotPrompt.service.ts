import { supabase } from "@/integrations/supabase/client";
import {
  loadPatientFileData,
  hasPatientFileData,
  getLatestValue,
  PatientFileData,
} from "@/services/patientFileData.service";
import { getOntologyNodeByVariableKey, formatThresholds } from "@/ontology/queries";

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

const ORGAN_LABEL: Record<string, string> = {
  cerveau: "neurologique",
  coeur: "cardiovasculaire",
  poumons: "respiratoire",
  renal: "rénal",
  gastro: "gastro-intestinal",
  general: "global",
};

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
    lines.push(thresholds ? `- ${label}: ${v} (${thresholds})` : `- ${label}: ${v}`);
  }
  return lines.length ? lines.join("\n") : "(aucune donnée vitale récente)";
}

function formatScores(ctx: DeidentifiedContext): string {
  const lines: string[] = [];
  if (ctx.pelodScore != null) lines.push(`- PELOD-2: ${ctx.pelodScore}`);
  if (ctx.gcs != null) lines.push(`- GCS: ${ctx.gcs}`);
  if (ctx.brainScore != null) lines.push(`- Score cérébral: ${ctx.brainScore}`);
  if (ctx.heartScore != null) lines.push(`- Score cardiaque: ${ctx.heartScore}`);
  if (ctx.lungsScore != null) lines.push(`- Score pulmonaire: ${ctx.lungsScore}`);
  if (ctx.kidneyScore != null) lines.push(`- Score rénal: ${ctx.kidneyScore}`);
  return lines.length ? lines.join("\n") : "(aucun score disponible)";
}

function patientHeader(ctx: DeidentifiedContext): string {
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
    label: "Diagnostic différentiel",
    description: "Liste de diagnostics différentiels basés sur la présentation clinique",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quels sont les diagnostics différentiels à considérer pour ce tableau clinique ? Classez-les par probabilité et indiquez les examens complémentaires utiles pour les départager.`,
  },
  {
    id: "diff-deterioration",
    category: "differential",
    label: "Causes de détérioration",
    description: "Causes possibles d'une détérioration aiguë",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Devant une détérioration clinique${ctx.organ ? ` ${ORGAN_LABEL[ctx.organ] || ""}` : ""}, quelles sont les causes les plus probables à rechercher en priorité ?`,
  },

  // LABS / IMAGING
  {
    id: "labs-interpret",
    category: "labs",
    label: "Interprétation des labos",
    description: "Aide à l'interprétation de résultats biologiques",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Aidez-moi à interpréter les résultats biologiques de ce patient. Quelles anomalies sont cliniquement significatives et quelle est leur signification dans ce contexte ?`,
  },
  {
    id: "imaging-suggest",
    category: "labs",
    label: "Examens d'imagerie utiles",
    description: "Quels examens d'imagerie demander",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quels examens d'imagerie seraient les plus pertinents à demander pour ce patient et pourquoi ?`,
  },

  // TREATMENT
  {
    id: "treat-plan",
    category: "treatment",
    label: "Plan thérapeutique",
    description: "Plan de prise en charge basé sur les guidelines PICU",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quel plan thérapeutique recommandez-vous pour ce patient pédiatrique en USIP, en vous basant sur les guidelines internationales actuelles ?${ctx.organ ? ` Centrez la réponse sur la prise en charge ${ORGAN_LABEL[ctx.organ] || ""}.` : ""}`,
  },
  {
    id: "treat-meds",
    category: "treatment",
    label: "Ajustement médicamenteux",
    description: "Recommandations sur la médication actuelle",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Compte tenu de l'âge, du poids et de l'état clinique de ce patient, quels ajustements médicamenteux suggérez-vous ? Y a-t-il des interactions ou contre-indications à surveiller ?`,
  },
  {
    id: "treat-fluids",
    category: "treatment",
    label: "Gestion hydroélectrolytique",
    description: "Stratégie de remplissage et électrolytes",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quelle stratégie de remplissage et de gestion hydroélectrolytique recommandez-vous pour ce patient ?`,
  },

  // INTERPRETATION
  {
    id: "interp-trends",
    category: "interpretation",
    label: "Interprétation des tendances",
    description: "Analyse des tendances des signes vitaux",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quelles tendances physiopathologiques sont suggérées par ces signes vitaux ? Quels paramètres méritent une surveillance accrue ?`,
  },
  {
    id: "interp-severity",
    category: "interpretation",
    label: "Évaluation de la gravité",
    description: "Niveau de gravité et pronostic",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Comment évalueriez-vous la gravité actuelle de ce patient ? Quels sont les éléments pronostiques à considérer ?`,
  },

  // GUIDELINES
  {
    id: "guide-picu",
    category: "guidelines",
    label: "Guidelines PICU applicables",
    description: "Recommandations internationales pertinentes",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quelles guidelines internationales (PALS, ESPNIC, SCCM, etc.) s'appliquent à cette situation ? Résumez les recommandations clés.`,
  },

  // MONITORING
  {
    id: "monitor-priorities",
    category: "monitoring",
    label: "Priorités de monitorage",
    description: "Éléments à surveiller en priorité",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quels paramètres de monitorage et signes d'alerte doivent être surveillés en priorité chez ce patient dans les prochaines heures ?`,
  },
  {
    id: "monitor-redflags",
    category: "monitoring",
    label: "Signes d'alerte (red flags)",
    description: "Signes nécessitant escalade",
    build: (ctx) => `${patientHeader(ctx)}

**Question :** Quels sont les signes d'alerte (red flags) qui devraient déclencher une escalade thérapeutique ou un appel à l'intensiviste sénior ?`,
  },
];

export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  differential: "Diagnostic différentiel",
  labs: "Labos & imagerie",
  treatment: "Plan thérapeutique",
  interpretation: "Interprétation",
  guidelines: "Guidelines",
  monitoring: "Monitorage",
};

export function getTemplatesForOrgan(organ?: string): PromptTemplate[] {
  if (!organ) return PROMPT_TEMPLATES;
  return PROMPT_TEMPLATES.filter((t) => !t.organs || t.organs.includes(organ));
}

export const COPILOT_URL = "https://m365.cloud.microsoft/chat/?titleId=T_30cd0c45-1a97-594b-3a2d-dd9154f328ef";
