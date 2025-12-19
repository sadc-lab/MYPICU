export interface Patient {
  id: string;
  name: string;
  age: string;
  weight: string;
  picuId: string;
  pelodScore: number;
  adherence: number;
  diagnosis: string;
  exam: string;
  priority: string;
  tour?: string;
  brainScore?: number;
  heartScore?: number;
  lungsScore?: number;
  kidneyScore?: number;
  ward?: 'pedA' | 'pedB';
  gcs?: number; // Glasgow Coma Scale (3-15)
}

export interface PatientQueryParams {
  ward?: 'pedA' | 'pedB';
  priority?: string;
  search?: string;
}

export interface PatientResponse {
  patients: Patient[];
  total: number;
}

// Database row type (snake_case)
export interface PatientDbRow {
  id: string;
  name: string;
  age: string;
  weight: string;
  picu_id: string;
  pelod_score: number;
  adherence: number;
  diagnosis: string;
  exam: string | null;
  priority: string;
  tour: string | null;
  brain_score: number | null;
  heart_score: number | null;
  lungs_score: number | null;
  kidney_score: number | null;
  ward: string;
  created_at: string;
  updated_at: string;
}
