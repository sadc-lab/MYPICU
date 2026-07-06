CREATE TABLE public.autoreg_study_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  study_patient_id TEXT NOT NULL,
  study_patient_code TEXT,
  study_patient_label TEXT,
  file_name TEXT,
  optimal_ppc NUMERIC,
  lower_limit NUMERIC,
  upper_limit NUMERIC,
  min_prx NUMERIC,
  sample_count INTEGER,
  duration_hours NUMERIC,
  curve JSONB,
  rolling JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autoreg_study_results TO authenticated;
GRANT ALL ON public.autoreg_study_results TO service_role;

ALTER TABLE public.autoreg_study_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own autoreg results"
  ON public.autoreg_study_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own autoreg results"
  ON public.autoreg_study_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own autoreg results"
  ON public.autoreg_study_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own autoreg results"
  ON public.autoreg_study_results FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX autoreg_study_results_user_patient_idx
  ON public.autoreg_study_results (user_id, study_patient_id, computed_at DESC);