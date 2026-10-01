-- These three original UI migrations omitted ON DELETE CASCADE. Without it,
-- merely viewing a patient prevents the agreed discharge-retention purge.
ALTER TABLE public.patient_view_log DROP CONSTRAINT patient_view_log_patient_id_fkey;
ALTER TABLE public.patient_view_log ADD CONSTRAINT patient_view_log_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE public.patient_custom_view DROP CONSTRAINT patient_custom_view_patient_id_fkey;
ALTER TABLE public.patient_custom_view ADD CONSTRAINT patient_custom_view_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE public.patient_objectives DROP CONSTRAINT patient_objectives_patient_id_fkey;
ALTER TABLE public.patient_objectives ADD CONSTRAINT patient_objectives_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
