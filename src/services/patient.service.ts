import { Patient, PatientQueryParams, PatientResponse } from '@/types/patient.types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Patient Service
 * 
 * This service provides a centralized API layer for patient data operations.
 * Supabase is the source of truth, including empty results and access errors.
 */

// Helper to transform database row to Patient type
const transformDbPatient = (row: any): Patient => ({
  id: row.id,
  name: row.name,
  age: row.age,
  weight: row.weight,
  picuId: row.picu_id,
  pelodScore: row.pelod_score,
  adherence: row.adherence,
  diagnosis: row.diagnosis,
  exam: row.exam || '',
  priority: row.priority,
  tour: row.tour,
  brainScore: row.brain_score,
  heartScore: row.heart_score,
  lungsScore: row.lungs_score,
  kidneyScore: row.kidney_score,
  ward: row.ward === 'pedB' ? 'pedB' : 'pedA',
  gcs: row.gcs,
  allergies: row.allergies || undefined,
  intolerances: row.intolerances || undefined,
});

// Helper to transform Patient to database row
const transformToDbRow = (patient: Partial<Patient>) => {
  const row: Record<string, any> = {};
  if (patient.id !== undefined) row.id = patient.id;
  if (patient.name !== undefined) row.name = patient.name;
  if (patient.age !== undefined) row.age = patient.age;
  if (patient.weight !== undefined) row.weight = patient.weight;
  if (patient.picuId !== undefined) row.picu_id = patient.picuId;
  if (patient.pelodScore !== undefined) row.pelod_score = patient.pelodScore;
  if (patient.adherence !== undefined) row.adherence = patient.adherence;
  if (patient.diagnosis !== undefined) row.diagnosis = patient.diagnosis;
  if (patient.exam !== undefined) row.exam = patient.exam;
  if (patient.priority !== undefined) row.priority = patient.priority;
  if (patient.tour !== undefined) row.tour = patient.tour;
  if (patient.brainScore !== undefined) row.brain_score = patient.brainScore;
  if (patient.heartScore !== undefined) row.heart_score = patient.heartScore;
  if (patient.lungsScore !== undefined) row.lungs_score = patient.lungsScore;
  if (patient.kidneyScore !== undefined) row.kidney_score = patient.kidneyScore;
  if (patient.ward !== undefined) row.ward = patient.ward;
  if (patient.gcs !== undefined) row.gcs = patient.gcs;
  if (patient.allergies !== undefined) row.allergies = patient.allergies;
  if (patient.intolerances !== undefined) row.intolerances = patient.intolerances;
  return row;
};

class PatientService {
  /**
   * Fetch all patients with optional filters from Supabase
   */
  async getPatients(params?: PatientQueryParams): Promise<PatientResponse> {
    let query = supabase.from('patients').select('*');
    if (params?.ward) query = query.eq('ward', params.ward);
    if (params?.priority) query = query.eq('priority', params.priority);
    if (params?.search) {
      query = query.or(`name.ilike.%${params.search}%,id.ilike.%${params.search}%,diagnosis.ilike.%${params.search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const patients = (data || []).map(transformDbPatient);
    return { patients, total: patients.length };
  }

  /**
   * Fetch a single patient by ID
   */
  async getPatientById(id: string): Promise<Patient | null> {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? transformDbPatient(data) : null;
  }

  /**
   * Update patient data
   */
  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    const { data, error } = await supabase.from('patients')
      .update(transformToDbRow(updates)).eq('id', id).select().single();
    if (error) throw error;
    return transformDbPatient(data);
  }

  /**
   * Get patients grouped by ward
   */
  async getPatientsByWard(): Promise<{ pedA: Patient[]; pedB: Patient[] }> {
    const { patients } = await this.getPatients();
    return {
      pedA: patients.filter(p => p.ward === 'pedA'),
      pedB: patients.filter(p => p.ward === 'pedB'),
    };
  }
}

// Export singleton instance
export const patientService = new PatientService();
