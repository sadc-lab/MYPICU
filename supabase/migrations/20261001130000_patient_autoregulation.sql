-- Brain autoregulation results for the current ward, computed by the OptiBrain
-- module.
--
-- This is separate from autoreg_study_results on purpose: that table holds
-- exploratory analyses a clinician ran on an uploaded file, is scoped to the
-- uploading user, and holds whatever was computed in their browser. This table
-- holds the module's own output for real inpatients and is read by the patient
-- pages. OptiBrain is authoritative for these values; the frontend no longer
-- recomputes them.
CREATE TABLE public.patient_autoregulation (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- prx correlates intracranial pressure against cerebral perfusion pressure;
  -- cox correlates arterial pressure against cerebral oxygenation.
  mode text NOT NULL CHECK (mode IN ('prx', 'cox')),
  optimal_pressure numeric,
  inferior_limit numeric,
  superior_limit numeric,
  -- Lowest correlation index reached; near 0 the pressure is well tolerated,
  -- near 1 autoregulation has failed.
  min_index numeric,
  pressure_variable text,
  signal_variable text,
  sample_count integer,
  -- The module's own per-window analysis table, kept verbatim. The dashboard
  -- draws the curve from this so the shape on screen and the headline figures
  -- come from the same computation.
  raw jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  -- One current result per patient and mode; a recomputation replaces it.
  UNIQUE (patient_id, mode)
);

CREATE INDEX idx_patient_autoregulation_patient
  ON public.patient_autoregulation(patient_id);

ALTER TABLE public.patient_autoregulation ENABLE ROW LEVEL SECURITY;

-- Same ward scoping as the other patient tables: a clinician sees results for
-- patients on the unit they are assigned to.
DROP POLICY IF EXISTS "Ward-scoped select" ON public.patient_autoregulation;
CREATE POLICY "Ward-scoped select" ON public.patient_autoregulation
  FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));

-- Writes come only from the sync worker, which holds a service role. No
-- authenticated write policy is granted.