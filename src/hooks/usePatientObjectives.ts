import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PatientObjective {
  id: number;
  patient_id: string;
  organ: string;
  type: 'objective' | 'intervention';
  content: string;
  sort_order: number;
}

const objectiveKeys = {
  all: ['patient-objectives'] as const,
  byPatientOrgan: (patientId: string, organ: string) =>
    [...objectiveKeys.all, patientId, organ] as const,
};

async function fetchObjectives(patientId: string, organ: string) {
  const { data, error } = await supabase
    .from('patient_objectives')
    .select('*')
    .eq('patient_id', patientId)
    .eq('organ', organ)
    .order('type')
    .order('sort_order');

  if (error) throw error;
  return data as PatientObjective[];
}

async function saveAll(
  patientId: string,
  organ: string,
  type: 'objective' | 'intervention',
  items: string[]
) {
  // Delete existing
  const { error: delError } = await supabase
    .from('patient_objectives')
    .delete()
    .eq('patient_id', patientId)
    .eq('organ', organ)
    .eq('type', type);

  if (delError) throw delError;

  if (items.length === 0) return [];

  // Insert new
  const rows = items.map((content, i) => ({
    patient_id: patientId,
    organ,
    type,
    content: content.trim(),
    sort_order: i,
  }));

  const { data, error } = await supabase
    .from('patient_objectives')
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

export function usePatientObjectives(patientId: string, organ: string) {
  const queryClient = useQueryClient();
  const queryKey = objectiveKeys.byPatientOrgan(patientId, organ);

  const { data: rawData, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchObjectives(patientId, organ),
    enabled: !!patientId && !!organ,
    staleTime: 2 * 60 * 1000,
  });

  // Objectives and interventions are recorded by the clinician. With no rows
  // the lists stay empty: a built-in default set rendered plausible-looking
  // goals (and English text, in an otherwise French UI) as if they were this
  // patient's plan.
  const objectives = (rawData ?? []).filter((r) => r.type === 'objective').map((r) => r.content);
  const interventions = (rawData ?? [])
    .filter((r) => r.type === 'intervention')
    .map((r) => r.content);

  const saveObjectives = useMutation({
    mutationFn: (items: string[]) => saveAll(patientId, organ, 'objective', items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Objectifs sauvegardés');
    },
    onError: () => toast.error('Erreur lors de la sauvegarde des objectifs'),
  });

  const saveInterventions = useMutation({
    mutationFn: (items: string[]) => saveAll(patientId, organ, 'intervention', items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Interventions sauvegardées');
    },
    onError: () => toast.error('Erreur lors de la sauvegarde des interventions'),
  });

  return {
    objectives,
    interventions,
    isLoading,
    saveObjectives: saveObjectives.mutate,
    saveInterventions: saveInterventions.mutate,
    isSaving: saveObjectives.isPending || saveInterventions.isPending,
  };
}
