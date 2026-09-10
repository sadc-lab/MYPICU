-- =====================================================================
-- Vue "état" personnalisable : surcharges manuelles (épingler/masquer)
-- d'un indicateur pour un patient, par-dessus la sélection automatique
-- (score d'organe + statut hors cible) déjà en place dans Optistate.
-- =====================================================================

CREATE TABLE public.patient_custom_view (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.patients(id),
  module text NOT NULL, -- 'optibrain' | 'optiheart' | 'optilungs' | 'optirenal' | 'optigastro'
  indicator_label text NOT NULL,
  action text NOT NULL CHECK (action IN ('pin', 'hide')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (patient_id, module, indicator_label)
);

CREATE INDEX idx_patient_custom_view_lookup ON public.patient_custom_view (patient_id);

ALTER TABLE public.patient_custom_view ENABLE ROW LEVEL SECURITY;

-- Cloisonnement par unité, même pattern que les autres tables patient
-- (voir 20260716120000_secure_ward_based_rls.sql).
CREATE POLICY "Ward-scoped select" ON public.patient_custom_view
  FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));

CREATE POLICY "Ward-scoped insert" ON public.patient_custom_view
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));

CREATE POLICY "Ward-scoped update" ON public.patient_custom_view
  FOR UPDATE TO authenticated
  USING (public.can_access_patient(patient_id))
  WITH CHECK (public.can_access_patient(patient_id));

CREATE POLICY "Ward-scoped delete" ON public.patient_custom_view
  FOR DELETE TO authenticated
  USING (public.can_access_patient(patient_id));
