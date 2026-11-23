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

export const getRifleStages = () => [
  { letter: 'R', name: 'Risk', criteria: tr('SCr ↑ ×1.5 ou DFG ↓ >25 %', 'SCr ↑ ×1.5 or GFR ↓ >25%') },
  { letter: 'I', name: 'Injury', criteria: tr('SCr ↑ ×2 ou DFG ↓ >50 %', 'SCr ↑ ×2 or GFR ↓ >50%') },
  { letter: 'F', name: 'Failure', criteria: tr('SCr ↑ ×3 ou DFG ↓ >75 %', 'SCr ↑ ×3 or GFR ↓ >75%') },
  { letter: 'L', name: 'Loss', criteria: tr('Perte de fonction rénale >4 sem.', 'Loss of kidney function >4 wk') },
  { letter: 'E', name: 'ESKD', criteria: tr('Insuffisance rénale terminale >3 mois', 'End-stage kidney disease >3 months') },
];

// Même réserve que getDialysisStatus : stade de démonstration.
export const getRifleStage = (_patientId: string): string | null => 'F';
