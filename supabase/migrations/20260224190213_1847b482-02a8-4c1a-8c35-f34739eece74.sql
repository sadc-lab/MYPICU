
-- Create table for patient therapeutic objectives and interventions
CREATE TABLE public.patient_objectives (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.patients(id),
  organ text NOT NULL, -- 'brain', 'heart', 'lungs'
  type text NOT NULL CHECK (type IN ('objective', 'intervention')),
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_patient_objectives_lookup ON public.patient_objectives(patient_id, organ, type);

-- Enable RLS
ALTER TABLE public.patient_objectives ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated read access" ON public.patient_objectives
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert access" ON public.patient_objectives
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update access" ON public.patient_objectives
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete access" ON public.patient_objectives
  FOR DELETE USING (auth.role() = 'authenticated');
