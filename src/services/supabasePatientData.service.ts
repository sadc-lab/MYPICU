// Service to load patient data from Supabase tables
// Reconstructs the PatientFileData format used by all downstream consumers
import { supabase } from '@/integrations/supabase/client';
import { PatientFileData } from './patientFileData.service';

// Cache for loaded patient data
const patientDataCache = new Map<string, PatientFileData>();

// Medication type to JSON key mapping (reverse of import)
const MEDICATION_TYPE_TO_KEY: Record<string, string> = {
  anti_epileptique: 'Variable_anti_epileptique',
  opioides: 'Variable_opioides',
  hypnotiques: 'Variable_hypnotiques',
};

/**
 * Load all patient clinical data from Supabase and reconstruct
 * the PatientFileData object used by charts, adherence, etc.
 */
export async function loadPatientDataFromSupabase(patientId: string): Promise<PatientFileData | null> {
  const normalizedId = patientId.replace('#', '');
  const dbPatientId = `#${normalizedId}`;

  // Check cache
  if (patientDataCache.has(normalizedId)) {
    return patientDataCache.get(normalizedId)!;
  }

  try {
    // Fetch all data in parallel
    const [vitalsRes, medsRes, validityRes, clinicalRes] = await Promise.all([
      fetchAllVitals(dbPatientId),
      fetchAllMedications(dbPatientId),
      fetchAllValidity(dbPatientId),
      fetchAllClinicalInfo(dbPatientId),
    ]);

    // If no data found at all, patient doesn't exist
    if (vitalsRes.length === 0 && medsRes.length === 0 && validityRes.length === 0 && clinicalRes.length === 0) {
      return null;
    }

    // Reconstruct PatientFileData object
    const data: PatientFileData = {
      Variable_age: [],
      Variable_anti_epileptique: [],
      Variable_opioides: [],
      Variable_concentre_plaquettaire: [],
    };

    // 1. Reconstruct vitals (grouped by variable_key)
    for (const vital of vitalsRes) {
      const key = vital.variable_key;
      if (!data[key]) {
        data[key] = [];
      }
      (data[key] as any[]).push({
        noadmsip: parseInt(normalizedId) || 0,
        charttime: vital.charttime,
        valeur: vital.valeur,
      });
    }

    // 2. Reconstruct medications (grouped by medication_type)
    for (const med of medsRes) {
      const jsonKey = MEDICATION_TYPE_TO_KEY[med.medication_type];
      if (jsonKey) {
        if (!data[jsonKey]) {
          data[jsonKey] = [];
        }
        (data[jsonKey] as any[]).push({
          noadmsip: parseInt(normalizedId) || 0,
          drugname: med.drugname,
          charttime: med.charttime,
          variable: med.variable || undefined,
          valeur: med.valeur || undefined,
        });
      }
    }

    // 3. Reconstruct validity data (grouped by indicator_key, with H0-Hn structure)
    const validityByKey = new Map<string, Record<string, any>>();
    for (const v of validityRes) {
      if (!validityByKey.has(v.indicator_key)) {
        validityByKey.set(v.indicator_key, { id_patient: parseInt(normalizedId) || 0 });
      }
      const record = validityByKey.get(v.indicator_key)!;
      record[`H${v.hour_index}`] = v.is_adherent ? 0 : 1; // Convert back: true=adherent=0, false=non-adherent=1
    }
    for (const [key, record] of validityByKey) {
      data[key] = [record];
    }

    // 4. Reconstruct clinical info
    for (const info of clinicalRes) {
      data[info.info_type] = info.data as any;
    }

    patientDataCache.set(normalizedId, data);
    return data;
  } catch (error) {
    console.error(`Error loading patient data from Supabase for ${normalizedId}:`, error);
    return null;
  }
}

/**
 * Check if a patient has data in Supabase
 */
export async function checkPatientExistsInSupabase(patientId: string): Promise<boolean> {
  const normalizedId = patientId.replace('#', '');
  const dbPatientId = `#${normalizedId}`;

  // Check cache first
  if (patientDataCache.has(normalizedId)) return true;

  const { count, error } = await supabase
    .from('patient_vitals')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', dbPatientId);

  if (error) {
    console.error('Error checking patient existence:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Get all patient IDs that have data in Supabase
 */
export async function getAvailablePatientIdsFromSupabase(): Promise<string[]> {
  const { data, error } = await supabase
    .from('patient_vitals')
    .select('patient_id')
    .limit(1000);

  if (error || !data) return [];

  const uniqueIds = [...new Set(data.map(d => d.patient_id))];
  return uniqueIds.map(id => id.replace('#', ''));
}

/**
 * Clear the cache for a specific patient or all patients
 */
export function clearPatientCache(patientId?: string) {
  if (patientId) {
    patientDataCache.delete(patientId.replace('#', ''));
  } else {
    patientDataCache.clear();
  }
}

// --- Internal fetch helpers with pagination to bypass the 1000-row limit ---

async function fetchAllVitals(dbPatientId: string) {
  const allRows: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('patient_vitals')
      .select('variable_key, charttime, valeur')
      .eq('patient_id', dbPatientId)
      .order('charttime', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching vitals:', error);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function fetchAllMedications(dbPatientId: string) {
  const { data, error } = await supabase
    .from('patient_medications')
    .select('medication_type, drugname, charttime, variable, valeur')
    .eq('patient_id', dbPatientId)
    .order('charttime', { ascending: true });

  if (error) {
    console.error('Error fetching medications:', error);
    return [];
  }
  return data || [];
}

async function fetchAllValidity(dbPatientId: string) {
  const { data, error } = await supabase
    .from('patient_validity')
    .select('indicator_key, hour_index, is_adherent')
    .eq('patient_id', dbPatientId)
    .order('hour_index', { ascending: true });

  if (error) {
    console.error('Error fetching validity:', error);
    return [];
  }
  return data || [];
}

async function fetchAllClinicalInfo(dbPatientId: string) {
  const { data, error } = await supabase
    .from('patient_clinical_info')
    .select('info_type, data')
    .eq('patient_id', dbPatientId);

  if (error) {
    console.error('Error fetching clinical info:', error);
    return [];
  }
  return data || [];
}
