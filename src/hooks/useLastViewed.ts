import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Horodatage de la dernière consultation d'un patient par le clinicien
 * courant — sert à marquer ce qui a changé depuis sa dernière visite.
 * Lit l'ancienne valeur (la référence pour le diff), puis l'écrase avec
 * l'heure actuelle pour la prochaine visite.
 */
export function useLastViewed(patientId: string) {
  const { user } = useAuth();
  const [previousVisitAt, setPreviousVisitAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !patientId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('patient_view_log')
        .select('last_viewed_at')
        .eq('user_id', user.id)
        .eq('patient_id', patientId)
        .maybeSingle();

      if (cancelled) return;

      setPreviousVisitAt(data ? new Date(data.last_viewed_at) : null);
      setIsLoading(false);

      await supabase.from('patient_view_log').upsert(
        { user_id: user.id, patient_id: patientId, last_viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,patient_id' },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [user, patientId]);

  return { previousVisitAt, isLoading };
}
