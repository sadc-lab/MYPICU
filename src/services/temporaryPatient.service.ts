import type { PatientFileData } from "@/services/patientFileData.service";
import type { Patient } from "@/types/patient.types";

const TIME_SERIES_KEYS = [
  "Variable_FC",
  "Variable_PIC",
  "Variable_PPC",
  "Variable_PAM",
  "Variable_rSO2",
  "Variable_PVC",
  "Variable_temperature",
  "Variable_EtCO2",
  "Variable_SPO2",
  "Variable_plaquettes",
  "Variable_hemoglobine",
  "Variable_glycemie",
  "Variable_INR",
  "Variable_paco2",
  "Variable_position_tete",
  "Variable_pupille_droite",
  "Variable_pupille_gauche",
] as const;

const MEDICATION_KEYS = [
  "Variable_anti_epileptique",
  "Variable_opioides",
  "Variable_hypnotiques",
] as const;

const CLINICAL_INFO_KEYS = [
  "Variable_age",
  "Variable_premiere_frequence_cardiaque",
  "Variable_concentre_plaquettaire",
  "Variable_culot_globulaire",
  "Variable_plasma",
  "Variable_nutrition",
] as const;

export interface TemporaryPatientImport {
  id: string;
  fileName: string;
  scenario: string;
  severity: number;
  mode: "PRx" | "COx" | null;
  synthetic: boolean;
  deidentified: boolean;
  importedAt: string;
  data: PatientFileData;
  vitalCount: number;
  medicationCount: number;
}

const patients = new Map<string, TemporaryPatientImport>();
const listeners = new Set<() => void>();
let snapshot: TemporaryPatientImport[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function publish() {
  snapshot = [...patients.values()];
  listeners.forEach((listener) => listener());
}

function setPatientDataField(data: PatientFileData, key: string, value: unknown) {
  data[key] = value;
}

export function subscribeToTemporaryPatients(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTemporaryPatientsSnapshot() {
  return snapshot;
}

export function getTemporaryPatient(patientId: string): TemporaryPatientImport | null {
  return patients.get(patientId) ?? null;
}

export function getTemporaryPatientProfile(patientId: string): Patient | null {
  const temporary = getTemporaryPatient(patientId);
  if (!temporary) return null;
  return {
    id: temporary.id,
    name: temporary.scenario,
    age: temporary.synthetic ? "Synthétique" : "Non renseigné",
    weight: "—",
    picuId: `DEMO-${temporary.id.slice(5)}`,
    pelodScore: temporary.severity,
    adherence: 0,
    diagnosis: temporary.synthetic
      ? "Profil de démonstration synthétique"
      : "Profil de démonstration dé-identifié",
    exam: "",
    priority: temporary.severity >= 3 ? "critical" : temporary.severity >= 2 ? "high" : "normal",
    brainScore: temporary.severity,
    heartScore: undefined,
    lungsScore: undefined,
    kidneyScore: undefined,
    ward: "pedA",
  };
}

export function isTemporaryPatientId(patientId: string): boolean {
  return patientId.startsWith("demo-");
}

export function addTemporaryPatientImport(
  fileName: string,
  input: unknown,
): TemporaryPatientImport {
  if (!fileName.toLowerCase().endsWith(".json")) {
    throw new Error("Choisissez un fichier JSON.");
  }
  const idMatch = fileName.match(/^(\d+)/);
  if (!idMatch) {
    throw new Error("Le nom du fichier doit commencer par un identifiant numérique.");
  }
  if (!isRecord(input)) {
    throw new Error("Le fichier JSON doit contenir un objet patient.");
  }

  const data: PatientFileData = {
    Variable_age: [],
    Variable_anti_epileptique: [],
    Variable_opioides: [],
    Variable_concentre_plaquettaire: [],
  };
  let vitalCount = 0;
  let medicationCount = 0;

  for (const key of TIME_SERIES_KEYS) {
    const source = input[key];
    if (!Array.isArray(source)) continue;
    const rows = source.flatMap((item) => {
      if (!isRecord(item) || typeof item.charttime !== "string") return [];
      if (!Number.isFinite(Date.parse(item.charttime))) return [];
      const valeur = numericValue(item.valeur);
      if (valeur === null) return [];
      return [{ charttime: item.charttime, valeur }];
    });
    setPatientDataField(data, key, rows);
    vitalCount += rows.length;
  }

  for (const key of MEDICATION_KEYS) {
    const source = input[key];
    if (!Array.isArray(source)) continue;
    const rows = source.flatMap((item) => {
      if (!isRecord(item) || typeof item.charttime !== "string" || !item.drugname) return [];
      return [{
        charttime: item.charttime,
        drugname: String(item.drugname),
        variable: item.variable == null ? null : String(item.variable),
        valeur: item.valeur == null ? null : String(item.valeur),
      }];
    });
    setPatientDataField(data, key, rows);
    medicationCount += rows.length;
  }

  for (const key of CLINICAL_INFO_KEYS) {
    if (Array.isArray(input[key])) setPatientDataField(data, key, input[key]);
  }

  for (const [key, value] of Object.entries(input)) {
    if (!key.endsWith("_validite") || !Array.isArray(value)) continue;
    const source = value[0];
    if (!isRecord(source)) continue;
    const validity: Record<string, number> = {};
    for (const [hour, result] of Object.entries(source)) {
      if (/^H\d+$/.test(hour) && (result === 0 || result === 1)) validity[hour] = result;
    }
    if (Object.keys(validity).length) setPatientDataField(data, key, [validity]);
  }

  if (isRecord(input.autoreg_data)) {
    setPatientDataField(data, "autoreg_data", input.autoreg_data);
  }

  if (vitalCount === 0) {
    throw new Error("Aucune observation horodatée reconnue dans le fichier.");
  }

  const metadata = isRecord(input.example_patient) ? input.example_patient : {};
  const mode = metadata.autoregulation_mode === "PRX"
    ? "PRx"
    : metadata.autoregulation_mode === "COX"
      ? "COx"
      : null;
  const latestPic = Array.isArray(data.Variable_PIC)
    ? numericValue((data.Variable_PIC.at(-1) as { valeur?: unknown } | undefined)?.valeur)
    : null;
  const latestPpc = Array.isArray(data.Variable_PPC)
    ? numericValue((data.Variable_PPC.at(-1) as { valeur?: unknown } | undefined)?.valeur)
    : null;
  const severity = Math.min(
    3,
    Math.max(
      typeof metadata.severity === "number" ? metadata.severity : 0,
      latestPic !== null && latestPic >= 30 ? 3 : latestPic !== null && latestPic >= 20 ? 2 : 0,
      latestPpc !== null && latestPpc < 50 ? 3 : latestPpc !== null && latestPpc < 60 ? 2 : 0,
    ),
  );
  const patient: TemporaryPatientImport = {
    id: `demo-${idMatch[1]}`,
    fileName,
    scenario: typeof metadata.scenario === "string" ? metadata.scenario : "Import temporaire",
    severity,
    mode,
    synthetic: metadata.synthetic !== false,
    deidentified: metadata.deidentified === true,
    importedAt: new Date().toISOString(),
    data,
    vitalCount,
    medicationCount,
  };

  patients.set(patient.id, patient);
  publish();
  return patient;
}

export function clearTemporaryPatientImports() {
  if (patients.size === 0) return;
  patients.clear();
  publish();
}
