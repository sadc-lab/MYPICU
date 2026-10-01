-- Missing baseline tables, reconstructed from src/integrations/supabase/types.ts.
CREATE TABLE public.patients (
  id text PRIMARY KEY, name text NOT NULL, age text NOT NULL DEFAULT '',
  weight text NOT NULL DEFAULT '', picu_id text NOT NULL DEFAULT '',
  diagnosis text NOT NULL DEFAULT '', exam text,
  pelod_score numeric, adherence numeric, priority text NOT NULL DEFAULT '', tour text,
  brain_score integer, heart_score integer, lungs_score integer, kidney_score integer,
  ward text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.autoreg_study_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_patient_id text NOT NULL, study_patient_code text, study_patient_label text,
  file_name text, optimal_ppc numeric, lower_limit numeric, upper_limit numeric,
  min_prx numeric, sample_count integer, duration_hours numeric,
  curve jsonb, rolling jsonb, computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.autoreg_study_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_results ON public.autoreg_study_results FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
