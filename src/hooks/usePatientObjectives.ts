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

// Default objectives/interventions per organ (used when no data in DB)
const DEFAULTS: Record<string, { objectives: string[]; interventions: string[] }> = {
  brain: {
    objectives: [
      'Maintain ICP < 20 mmHg',
      'Maintain CPP 50-70 mmHg',
      'Normocapnia (PaCO2 35-45 mmHg)',
      'Head of bed elevated 30°',
    ],
    interventions: [
      'Osmotherapy with mannitol administered',
      'Sedation optimized',
      'Continuous ICP monitorage',
    ],
  },
  heart: {
    objectives: [
      'Maintain MAP > 65 mmHg',
      'Cardiac index > 2.5 L/min/m²',
      'Lactate < 2 mmol/L',
      'ScvO2 > 70%',
    ],
    interventions: [
      'Fluid resuscitation completed',
      'Inotropic support optimized',
      'Continuous hemodynamic monitorage',
    ],
  },
  lungs: {
    objectives: [
      'Maintain SpO2 > 92%',
      'Lung protective ventilation (TV 6-8 mL/kg IBW)',
      'Plateau pressure < 30 cmH2O',
      'Optimize PEEP for recruitment',
    ],
    interventions: [
      'FiO2 reduced from 50% to 40%',
      'Recruitment maneuver performed',
      'Prone positioning considered',
    ],
  },
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

  // Separate objectives and interventions
  const defaults = DEFAULTS[organ] || { objectives: [], interventions: [] };
  const hasData = rawData && rawData.length > 0;

  const objectives = hasData
    ? rawData.filter(r => r.type === 'objective').map(r => r.content)
    : defaults.objectives;

  const interventions = hasData
    ? rawData.filter(r => r.type === 'intervention').map(r => r.content)
    : defaults.interventions;

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
