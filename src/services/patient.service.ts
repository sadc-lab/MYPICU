import { Patient, PatientQueryParams, PatientResponse } from '@/types/patient.types';
import { supabase } from '@/integrations/supabase/client';
import { pedAPatients, pedBPatients } from '@/utils/patientData';

/**
 * Patient Service
 * 
 * This service provides a centralized API layer for patient data operations.
 * Now connected to Supabase for real-time data with fallback to static data.
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
  return row;
};

class PatientService {
  private useSupabase = true;

  /**
   * Fetch all patients with optional filters from Supabase
   */
  async getPatients(params?: PatientQueryParams): Promise<PatientResponse> {
    if (this.useSupabase) {
      try {
        let query = supabase.from('patients').select('*');

        // Apply filters
        if (params?.ward) {
          query = query.eq('ward', params.ward);
        }

        if (params?.priority) {
          query = query.eq('priority', params.priority);
        }

        if (params?.search) {
          query = query.or(`name.ilike.%${params.search}%,id.ilike.%${params.search}%,diagnosis.ilike.%${params.search}%`);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Supabase error, falling back to static data:', error);
          return this.getStaticPatients(params);
        }

        if (data && data.length > 0) {
          const patients = data.map(transformDbPatient);
          return { patients, total: patients.length };
        }

        // If no data in Supabase, fall back to static data
        console.log('No data in Supabase, using static data');
        return this.getStaticPatients(params);
      } catch (error) {
        console.error('Error fetching from Supabase:', error);
        return this.getStaticPatients(params);
      }
    }

    return this.getStaticPatients(params);
  }

  /**
   * Fallback to static data
   */
  private async getStaticPatients(params?: PatientQueryParams): Promise<PatientResponse> {
    let patients = [...pedAPatients, ...pedBPatients];

    if (params?.ward) {
      patients = params.ward === 'pedA' ? pedAPatients : pedBPatients;
    }

    if (params?.priority) {
      patients = patients.filter(p => p.priority === params.priority);
    }

    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      patients = patients.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.id.toLowerCase().includes(searchLower) ||
        p.diagnosis.toLowerCase().includes(searchLower)
      );
    }

    return { patients, total: patients.length };
  }

  /**
   * Fetch a single patient by ID
   */
  async getPatientById(id: string): Promise<Patient | null> {
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Supabase error:', error);
          return this.getStaticPatientById(id);
        }

        if (data) {
          return transformDbPatient(data);
        }

        return this.getStaticPatientById(id);
      } catch (error) {
        console.error('Error fetching patient:', error);
        return this.getStaticPatientById(id);
      }
    }

    return this.getStaticPatientById(id);
  }

  private async getStaticPatientById(id: string): Promise<Patient | null> {
    const allPatients = [...pedAPatients, ...pedBPatients];
    return allPatients.find(p => p.id === id) || null;
  }

  /**
   * Update patient data
   */
  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    if (this.useSupabase) {
      try {
        const dbUpdates = transformToDbRow(updates);
        
        const { data, error } = await supabase
          .from('patients')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }

        if (data) {
          return transformDbPatient(data);
        }
      } catch (error) {
        console.error('Error updating patient:', error);
      }
    }

    // Fallback for static data
    const allPatients = [...pedAPatients, ...pedBPatients];
    const patient = allPatients.find(p => p.id === id);
    
    if (!patient) {
      throw new Error('Patient not found');
    }

    return { ...patient, ...updates };
  }

  /**
   * Get patients grouped by ward
   */
  async getPatientsByWard(): Promise<{ pedA: Patient[]; pedB: Patient[] }> {
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*');

        if (error) {
          console.error('Supabase error:', error);
          return { pedA: pedAPatients, pedB: pedBPatients };
        }

        if (data && data.length > 0) {
          const patients = data.map(transformDbPatient);
          return {
            pedA: patients.filter(p => (p as any).ward === 'pedA'),
            pedB: patients.filter(p => (p as any).ward === 'pedB'),
          };
        }

        return { pedA: pedAPatients, pedB: pedBPatients };
      } catch (error) {
        console.error('Error fetching patients by ward:', error);
        return { pedA: pedAPatients, pedB: pedBPatients };
      }
    }
    
    return { pedA: pedAPatients, pedB: pedBPatients };
  }

  /**
   * Seed initial data to Supabase
   */
  async seedData(): Promise<void> {
    const allPatients = [
      ...pedAPatients.map(p => ({ ...p, ward: 'pedA' })),
      ...pedBPatients.map(p => ({ ...p, ward: 'pedB' })),
    ];

    for (const patient of allPatients) {
      const dbRow = {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        weight: patient.weight,
        picu_id: patient.picuId,
        pelod_score: patient.pelodScore,
        adherence: patient.adherence,
        diagnosis: patient.diagnosis,
        exam: patient.exam,
        priority: patient.priority,
        tour: patient.tour,
        brain_score: patient.brainScore,
        heart_score: patient.heartScore,
        lungs_score: patient.lungsScore,
        kidney_score: patient.kidneyScore,
        ward: (patient as any).ward,
      };

      const { error } = await supabase
        .from('patients')
        .upsert(dbRow, { onConflict: 'id' });

      if (error) {
        console.error('Error seeding patient:', patient.id, error);
      }
    }

    console.log('Data seeding complete');
  }
}

// Export singleton instance
export const patientService = new PatientService();
