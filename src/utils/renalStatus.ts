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
