import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService } from '@/services/patient.service';
import { Patient, PatientQueryParams } from '@/types/patient.types';
import { toast } from 'sonner';

/**
 * Query keys for React Query cache management
 */
export const patientKeys = {
  all: ['patients'] as const,
  lists: () => [...patientKeys.all, 'list'] as const,
  list: (params?: PatientQueryParams) => [...patientKeys.lists(), params] as const,
  details: () => [...patientKeys.all, 'detail'] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
  byWard: () => [...patientKeys.all, 'by-ward'] as const,
};

/**
 * Hook to fetch all patients with optional filters
 */
export function usePatients(params?: PatientQueryParams) {
  return useQuery({
    queryKey: patientKeys.list(params),
    queryFn: () => patientService.getPatients(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single patient by ID
 */
export function usePatient(id: string | null) {
  return useQuery({
    queryKey: patientKeys.detail(id || ''),
    queryFn: () => patientService.getPatientById(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch patients grouped by ward
 */
export function usePatientsByWard() {
  return useQuery({
    queryKey: patientKeys.byWard(),
    queryFn: () => patientService.getPatientsByWard(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to update patient data
 */
export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Patient> }) =>
      patientService.updatePatient(id, updates),
    onSuccess: (updatedPatient) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: patientKeys.detail(updatedPatient.id) });
      queryClient.invalidateQueries({ queryKey: patientKeys.byWard() });
      
      toast.success('Patient updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update patient');
    },
  });
}
