// Patients rétrospectifs de l'étude : enregistrements bruts (CSV, Excel, JSON
// Fisher) ajoutés à la main par un clinicien, sous un pseudonyme.
//
// Le fichier reste dans ce navigateur (IndexedDB) : rien n'est envoyé à un
// serveur, comme pour l'outil d'import /autoreg. Conséquence assumée : un
// patient rétrospectif n'est visible que sur le poste où il a été ajouté.
// IndexedDB plutôt que localStorage, dont la limite (~5 Mo) est vite atteinte
// par un enregistrement de plusieurs jours.

import * as XLSX from "xlsx";
import { describeAnalysisReadiness, detectMode, parseAny, type AutoregMode, type ReadinessError } from "./autoregComputation.service";
import { tr } from "@/i18n";

export interface RetroPatient {
  id: string;
  code: string; // R01, R02…
  label: string; // pseudonyme
  fileName: string;
  mode: AutoregMode;
  createdAt: number;
}

interface StoredRetroPatient extends RetroPatient {
  text: string;
}

const DB_NAME = "mypicu-retro";
const STORE = "patients";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listRetroPatients(): Promise<RetroPatient[]> {
  const all = await withStore<StoredRetroPatient[]>("readonly", (s) => s.getAll());
  return all
    .map(({ text: _text, ...meta }) => meta)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getRetroPatientText(id: string): Promise<string | null> {
  const row = await withStore<StoredRetroPatient | undefined>("readonly", (s) => s.get(id));
  return row?.text ?? null;
}

export async function deleteRetroPatient(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

async function readFileAsText(file: File): Promise<string> {
  if (/\.xlsx?$/i.test(file.name)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const first = wb.SheetNames[0];
    if (!first) throw new Error(tr("Fichier Excel sans feuille.", "Excel file without a sheet."));
    return XLSX.utils.sheet_to_csv(wb.Sheets[first]);
  }
  return file.text();
}

export type AddRetroResult =
  | { ok: true; patient: RetroPatient }
  | { ok: false; error: ReadinessError | string };

/**
 * Lit le fichier, vérifie qu'une autorégulation est calculable (mêmes
 * garde-fous que l'analyse), puis l'enregistre. Rien n'est conservé si le
 * fichier n'est pas exploitable.
 */
export async function addRetroPatient(label: string, file: File): Promise<AddRetroResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: tr("Fichier trop volumineux (max 25 Mo).", "File too large (max 25 MB).") };
  const text = await readFileAsText(file);
  const samples = parseAny(text);
  const readiness = describeAnalysisReadiness(samples);
  if (readiness) return { ok: false, error: readiness };

  const existing = await listRetroPatients();
  const next = existing.reduce((max, p) => Math.max(max, Number(p.code.slice(1)) || 0), 0) + 1;
  const code = `R${String(next).padStart(2, "0")}`;
  const patient: RetroPatient = {
    id: crypto.randomUUID(),
    code,
    label: label.trim() || tr(`Patient rétrospectif ${code}`, `Retrospective patient ${code}`),
    fileName: file.name,
    mode: detectMode(samples),
    createdAt: Date.now(),
  };
  await withStore("readwrite", (s) => s.put({ ...patient, text } satisfies StoredRetroPatient));
  return { ok: true, patient };
}
