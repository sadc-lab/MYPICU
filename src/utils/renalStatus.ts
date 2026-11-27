import { tr } from '@/i18n';

export interface DialysisStatus {
  modality: string;
  start: string;
  duration: string;
}

// Données de démonstration, en attendant l'import des variables rénales :
// tous les patients sont affichés comme en dialyse.
export const getDialysisStatus = (_patientId: string): DialysisStatus | null => ({
  modality: 'CVVHDF',
  start: '23/08 — 18:00 (J2)',
  duration: '36 h',
});

// Médicaments néphrotoxiques, repérés par leur nom (DCI ou nom commercial
// courant, en minuscules et sans accents). Chaque entrée donne la classe
// affichée au clinicien.
const NEPHROTOXIC_CLASSES: Array<{ match: RegExp; classFr: string; classEn: string }> = [
  { match: /gentamicin|tobramycin|amikacin/, classFr: 'Aminoside', classEn: 'Aminoglycoside' },
  { match: /vancomycin|teicoplanin/, classFr: 'Glycopeptide', classEn: 'Glycopeptide' },
  { match: /ibuprofen|ketorolac|naproxen|indometacin|indomethacin|diclofenac/, classFr: 'AINS', classEn: 'NSAID' },
  { match: /amphotericin|ambisome/, classFr: 'Antifongique (amphotéricine B)', classEn: 'Antifungal (amphotericin B)' },
  { match: /aciclovir|acyclovir|ganciclovir|foscarnet|cidofovir/, classFr: 'Antiviral', classEn: 'Antiviral' },
  { match: /tacrolimus|ciclosporin|cyclosporin/, classFr: 'Inhibiteur de la calcineurine', classEn: 'Calcineurin inhibitor' },
  { match: /colistin|polymyxin/, classFr: 'Polymyxine', classEn: 'Polymyxin' },
  { match: /methotrexat|cisplatin|ifosfamid/, classFr: 'Chimiothérapie', classEn: 'Chemotherapy' },
  { match: /contraste|contrast|iohexol|iodixanol/, classFr: 'Produit de contraste iodé', classEn: 'Iodinated contrast' },
];

const normalizeDrugName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface Medication {
  name: string;
  start: string;
  /** Information utile au suivi rénal (ex. dernier taux résiduel). */
  note?: string;
}

export interface NephrotoxicMedication extends Medication {
  drugClass: string;
}

/** Garde seulement les médicaments néphrotoxiques, avec leur classe. */
export const filterNephrotoxic = (medications: Medication[]): NephrotoxicMedication[] =>
  medications.flatMap((med) => {
    const found = NEPHROTOXIC_CLASSES.find((c) => c.match.test(normalizeDrugName(med.name)));
    return found ? [{ ...med, drugClass: tr(found.classFr, found.classEn) }] : [];
  });

// Même réserve que getDialysisStatus : médicaments de démonstration, en
// attendant l'import des prescriptions. Le paracétamol n'est pas néphrotoxique
// et ne doit donc pas apparaître.
export const getCurrentMedications = (_patientId: string): Medication[] => [
  { name: 'Vancomycine', start: '22/08 — 10:00', note: tr('Taux résiduel 18 mg/L', 'Trough level 18 mg/L') },
  { name: 'Gentamicine', start: '23/08 — 08:00' },
  { name: 'Paracétamol', start: '21/08 — 14:00' },
];

export const getNephrotoxicMedications = (patientId: string): NephrotoxicMedication[] =>
  filterNephrotoxic(getCurrentMedications(patientId));

export const getRifleStages = () => [
  { letter: 'R', name: 'Risk', criteria: tr('SCr ↑ ×1.5 ou DFG ↓ >25 %', 'SCr ↑ ×1.5 or GFR ↓ >25%') },
  { letter: 'I', name: 'Injury', criteria: tr('SCr ↑ ×2 ou DFG ↓ >50 %', 'SCr ↑ ×2 or GFR ↓ >50%') },
  { letter: 'F', name: 'Failure', criteria: tr('SCr ↑ ×3 ou DFG ↓ >75 %', 'SCr ↑ ×3 or GFR ↓ >75%') },
  { letter: 'L', name: 'Loss', criteria: tr('Perte de fonction rénale >4 sem.', 'Loss of kidney function >4 wk') },
  { letter: 'E', name: 'ESKD', criteria: tr('Insuffisance rénale terminale >3 mois', 'End-stage kidney disease >3 months') },
];

// Même réserve que getDialysisStatus : stade de démonstration.
export const getRifleStage = (_patientId: string): string | null => 'F';
