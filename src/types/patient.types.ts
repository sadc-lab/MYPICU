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
