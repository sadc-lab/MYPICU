import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CustomViewAction = 'pin' | 'hide';

interface CustomViewRow {
  id: number;
  patient_id: string;
  module: string;
  indicator_label: string;
  action: string;
}

const customViewKeys = {
  all: ['patient-custom-view'] as const,
  byPatient: (patientId: string) => [...customViewKeys.all, patientId] as const,
};

function overrideKey(module: string, label: string) {
  return `${module}|${label}`;
}

async function fetchOverrides(patientId: string) {
  const { data, error } = await supabase
    .from('patient_custom_view')
    .select('*')
    .eq('patient_id', patientId);

  if (error) throw error;
  return data as CustomViewRow[];
}

async function upsertOverride(
  patientId: string,
  module: string,
  indicatorLabel: string,
  action: CustomViewAction,
) {
  const { error } = await supabase.from('patient_custom_view').upsert(
    { patient_id: patientId, module, indicator_label: indicatorLabel, action },
    { onConflict: 'patient_id,module,indicator_label' },
  );
  if (error) throw error;
}

async function deleteOverride(patientId: string, module: string, indicatorLabel: string) {
  const { error } = await supabase
    .from('patient_custom_view')
    .delete()
    .eq('patient_id', patientId)
    .eq('module', module)
    .eq('indicator_label', indicatorLabel);
  if (error) throw error;
}

/**
 * Surcharges manuelles (épingler/masquer) par-dessus la sélection
 * automatique d'indicateurs dans Optistate, persistées par patient.
 * Contrairement à usePatientObjectives, la sauvegarde se fait ligne par
 * ligne (upsert/delete) et non en remplaçant toute la liste — la base
 * automatique change dynamiquement selon les scores du patient.
 */
export function usePatientCustomView(patientId: string) {
  const queryClient = useQueryClient();
  const queryKey = customViewKeys.byPatient(patientId);

  const { data: rows, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchOverrides(patientId),
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });

  const overrides: Record<string, CustomViewAction> = {};
  (rows ?? []).forEach((r) => {
    if (r.action === 'pin' || r.action === 'hide') {
      overrides[overrideKey(r.module, r.indicator_label)] = r.action;
    }
  });

  const setOverrideMutation = useMutation({
    mutationFn: (vars: { module: string; label: string; action: CustomViewAction }) =>
      upsertOverride(patientId, vars.module, vars.label, vars.action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error('Erreur lors de la mise à jour de la vue personnalisée'),
  });

  const clearOverrideMutation = useMutation({
    mutationFn: (vars: { module: string; label: string }) =>
      deleteOverride(patientId, vars.module, vars.label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error('Erreur lors de la mise à jour de la vue personnalisée'),
  });

  return {
    overrides,
    getOverride: (module: string, label: string) => overrides[overrideKey(module, label)],
    isLoading,
    setOverride: (module: string, label: string, action: CustomViewAction) =>
      setOverrideMutation.mutate({ module, label, action }),
    clearOverride: (module: string, label: string) => clearOverrideMutation.mutate({ module, label }),
    isSaving: setOverrideMutation.isPending || clearOverrideMutation.isPending,
  };
}
