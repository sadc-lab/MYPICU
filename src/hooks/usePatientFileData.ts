import { useState, useEffect } from 'react';
import { 
  loadPatientFileData, 
  PatientFileData, 
  hasPatientFileData,
  extractTimeSeriesData,
  getPatientMedications
} from '@/services/patientFileData.service';

export function usePatientFileData(patientId: string | null) {
  const [data, setData] = useState<PatientFileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setData(null);
      return;
    }

    // Check if patient has file data available
    if (!hasPatientFileData(patientId)) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    loadPatientFileData(patientId)
      .then((fileData) => {
        setData(fileData);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load patient data');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [patientId]);

  return { data, loading, error, hasFileData: hasPatientFileData(patientId || '') };
}

// Hook to get time series data for charts
export function usePatientTimeSeries(
  patientId: string | null,
  variableKey: string
) {
  const { data, loading, error } = usePatientFileData(patientId);
  const [timeSeries, setTimeSeries] = useState<Array<{ charttime: string; valeur: number }>>([]);

  useEffect(() => {
    if (data) {
      const extracted = extractTimeSeriesData(data, variableKey);
      setTimeSeries(extracted);
    } else {
      setTimeSeries([]);
    }
  }, [data, variableKey]);

  return { timeSeries, loading, error };
}

// Hook to get medications
export function usePatientMedications(patientId: string | null) {
  const { data, loading, error } = usePatientFileData(patientId);
  const [medications, setMedications] = useState<{
    antiEpileptiques: Array<{ drugname: string; charttime: string }>;
    opioides: Array<{ drugname: string; charttime: string; valeur: string }>;
  }>({ antiEpileptiques: [], opioides: [] });

  useEffect(() => {
    if (data) {
      setMedications(getPatientMedications(data));
    } else {
      setMedications({ antiEpileptiques: [], opioides: [] });
    }
  }, [data]);

  return { medications, loading, error };
}
