import { Patient, PatientQueryParams, PatientResponse } from '@/types/patient.types';
import { pedAPatients, pedBPatients } from '@/utils/patientData';

/**
 * Patient Service
 * 
 * This service provides a centralized API layer for patient data operations.
 * Currently uses static data, but can easily be swapped to use real API calls
 * by replacing the implementation of these methods with fetch/axios calls.
 */
class PatientService {
  /**
   * Fetch all patients with optional filters
   * TODO: Replace with actual API call when backend is ready
   * Example: return fetch('/api/patients', { params }).then(res => res.json())
   */
  async getPatients(params?: PatientQueryParams): Promise<PatientResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    let patients = [...pedAPatients, ...pedBPatients];

    // Apply filters
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

    return {
      patients,
      total: patients.length
    };
  }

  /**
   * Fetch a single patient by ID
   * TODO: Replace with actual API call
   * Example: return fetch(`/api/patients/${id}`).then(res => res.json())
   */
  async getPatientById(id: string): Promise<Patient | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const allPatients = [...pedAPatients, ...pedBPatients];
    return allPatients.find(p => p.id === id) || null;
  }

  /**
   * Update patient data
   * TODO: Replace with actual API call
   * Example: return fetch(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
   */
  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real implementation, this would update the backend
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
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      pedA: pedAPatients,
      pedB: pedBPatients
    };
  }
}

// Export singleton instance
export const patientService = new PatientService();
