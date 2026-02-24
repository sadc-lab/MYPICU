
-- Table for all time-series vital signs data
CREATE TABLE public.patient_vitals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id text NOT NULL,
  variable_key text NOT NULL,
  charttime timestamptz NOT NULL,
  valeur numeric,
  CONSTRAINT fk_patient_vitals_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

-- Indexes for performance (critical with 500K+ rows per patient)
CREATE INDEX idx_patient_vitals_patient_variable ON public.patient_vitals (patient_id, variable_key);
CREATE INDEX idx_patient_vitals_patient_variable_time ON public.patient_vitals (patient_id, variable_key, charttime DESC);

-- Enable RLS
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access" ON public.patient_vitals
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert access" ON public.patient_vitals
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Table for medications (anti-epileptiques, opioides, hypnotiques)
CREATE TABLE public.patient_medications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id text NOT NULL,
  medication_type text NOT NULL, -- 'anti_epileptique', 'opioides', 'hypnotiques'
  drugname text NOT NULL,
  charttime timestamptz NOT NULL,
  variable text,
  valeur text,
  CONSTRAINT fk_patient_medications_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_patient_medications_patient ON public.patient_medications (patient_id, medication_type);

ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access" ON public.patient_medications
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert access" ON public.patient_medications
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Table for validity/adherence data (normalized from H0-H47 structure)
CREATE TABLE public.patient_validity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id text NOT NULL,
  indicator_key text NOT NULL, -- e.g. 'PPCData_validite', 'PicHticData_validite'
  hour_index integer NOT NULL, -- 0-47
  is_adherent boolean NOT NULL, -- true = adhérent (was 0 in JSON), false = non adhérent (was 1)
  CONSTRAINT fk_patient_validity_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_patient_validity_patient_indicator ON public.patient_validity (patient_id, indicator_key);
CREATE UNIQUE INDEX idx_patient_validity_unique ON public.patient_validity (patient_id, indicator_key, hour_index);

ALTER TABLE public.patient_validity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access" ON public.patient_validity
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert access" ON public.patient_validity
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Table for other clinical info (age, first FC, blood products, etc.)
CREATE TABLE public.patient_clinical_info (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id text NOT NULL,
  info_type text NOT NULL, -- 'age', 'premiere_frequence_cardiaque', 'concentre_plaquettaire', etc.
  data jsonb NOT NULL, -- flexible storage for varying structures
  CONSTRAINT fk_patient_clinical_info_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_patient_clinical_info_patient ON public.patient_clinical_info (patient_id, info_type);

ALTER TABLE public.patient_clinical_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access" ON public.patient_clinical_info
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert access" ON public.patient_clinical_info
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');
