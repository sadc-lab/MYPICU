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

export const rifleStages = [
  { letter: 'R', name: 'Risk', criteria: 'SCr ↑ ×1.5 ou DFG ↓ >25 %' },
  { letter: 'I', name: 'Injury', criteria: 'SCr ↑ ×2 ou DFG ↓ >50 %' },
  { letter: 'F', name: 'Failure', criteria: 'SCr ↑ ×3 ou DFG ↓ >75 %' },
  { letter: 'L', name: 'Loss', criteria: 'Perte de fonction rénale >4 sem.' },
  { letter: 'E', name: 'ESKD', criteria: 'Insuffisance rénale terminale >3 mois' },
];

// Même réserve que getDialysisStatus : stade de démonstration.
export const getRifleStage = (_patientId: string): string | null => 'F';
