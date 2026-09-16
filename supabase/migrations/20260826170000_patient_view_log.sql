-- =====================================================================
-- Journal de consultation : dernière fois qu'un clinicien a ouvert le
-- dossier d'un patient donné — sert à marquer visuellement ce qui a
-- changé depuis sa dernière visite (Optibrain).
-- =====================================================================

CREATE TABLE public.patient_view_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id text NOT NULL REFERENCES public.patients(id),
  last_viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, patient_id)
);

ALTER TABLE public.patient_view_log ENABLE ROW LEVEL SECURITY;

-- Un clinicien ne lit/écrit que ses propres lignes, sur les patients de
-- son unité (même fonction d'autorisation que les autres tables patient).
CREATE POLICY "Own view log" ON public.patient_view_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.can_access_patient(patient_id))
  WITH CHECK (auth.uid() = user_id AND public.can_access_patient(patient_id));
