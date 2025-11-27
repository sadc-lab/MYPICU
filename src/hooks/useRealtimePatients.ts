import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { patientKeys } from './usePatients';
import { toast } from 'sonner';

/**
 * Hook to subscribe to real-time patient updates from Supabase
 * Automatically invalidates React Query cache when data changes
 */
export function useRealtimePatients() {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('Setting up real-time subscription for patients...');

    const channel = supabase
      .channel('patients-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'patients',
        },
        (payload) => {
          console.log('Real-time patient update received:', payload);

          // Invalidate all patient queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: patientKeys.all });

          // Show toast notification based on event type
          switch (payload.eventType) {
            case 'INSERT':
              toast.info('Nouveau patient ajouté', {
                description: `Patient ${(payload.new as any)?.name || 'inconnu'} ajouté`,
              });
              break;
            case 'UPDATE':
              toast.info('Données patient mises à jour', {
                description: `Patient ${(payload.new as any)?.name || 'inconnu'} modifié`,
              });
              break;
            case 'DELETE':
              toast.info('Patient supprimé', {
                description: `Patient ${(payload.old as any)?.name || 'inconnu'} retiré`,
              });
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time patient updates');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up real-time subscription...');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Hook to subscribe to real-time updates for a specific patient
 */
export function useRealtimePatient(patientId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!patientId) return;

    console.log(`Setting up real-time subscription for patient ${patientId}...`);

    const channel = supabase
      .channel(`patient-${patientId}-realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'patients',
          filter: `id=eq.${patientId}`,
        },
        (payload) => {
          console.log(`Real-time update for patient ${patientId}:`, payload);

          // Invalidate specific patient query
          queryClient.invalidateQueries({ queryKey: patientKeys.detail(patientId) });
          
          // Also invalidate lists that might include this patient
          queryClient.invalidateQueries({ queryKey: patientKeys.lists() });

          toast.info('Données cliniques mises à jour', {
            description: 'Les données du patient ont été actualisées en temps réel',
          });
        }
      )
      .subscribe((status) => {
        console.log(`Real-time subscription for patient ${patientId} status:`, status);
      });

    return () => {
      console.log(`Cleaning up real-time subscription for patient ${patientId}...`);
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);
}
