import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DailyReminder {
  id: number;
  patient_id: string;
  organ: string;
  type: 'objective' | 'intervention';
  content: string;
  sort_order: number;
}

const keys = {
  byPatient: (patientId: string) => ['daily-reminders', patientId] as const,
};

/**
 * Standing daily prompts recorded against the patient.
 *
 * These used to be a hardcoded list of ten generic reminders shown for every
 * patient regardless of their care plan. They are now read from
 * `patient_objectives`, which the clinician edits, so the panel reflects the
 * actual plan and shows an explicit empty state when there is none.
 */
export function useDailyReminders(patientId: string | null) {
  const { data } = useQuery({
    queryKey: keys.byPatient(patientId ?? ''),
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<DailyReminder[]> => {
      const { data, error } = await supabase
        .from('patient_objectives')
        .select('id, patient_id, organ, type, content, sort_order')
        .eq('patient_id', patientId!)
        .in('organ', ['daily'])
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyReminder[];
    },
  });

  return { reminders: (data ?? []).map((row) => row.content) };
}