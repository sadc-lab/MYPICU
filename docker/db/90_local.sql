-- Only runs once on this new local database, before the first census sync.
DELETE FROM public.patients WHERE id IN
  ('#8749','#25','#23','#24','#22','#21','#6312','#16','#8448','#4','#5','#6','#7','#9');

CREATE SCHEMA IF NOT EXISTS integration;
REVOKE ALL ON SCHEMA integration FROM PUBLIC, anon, authenticated;
CREATE TABLE integration.patient_map (
  patient_id text PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  encounterid bigint NOT NULL UNIQUE, admitted_at timestamptz,
  discharged_at timestamptz, clinicalunitid text, last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE integration.sync_state (
  patient_id text PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  status text NOT NULL, started_at timestamptz, last_synced_at timestamptz,
  duration_ms integer, row_count bigint, error text
);
CREATE TABLE integration.census_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id), last_success_at timestamptz,
  last_attempt_at timestamptz, patient_count integer, error text
);
CREATE INDEX patient_vitals_patient_time ON public.patient_vitals(patient_id, charttime, id);
CREATE INDEX patient_medications_patient_time ON public.patient_medications(patient_id, charttime);

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
-- Ward assignments can only be written by the administrator.
REVOKE INSERT, UPDATE, DELETE ON public.user_wards FROM authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;

CREATE ROLE optibrain_sync LOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public, integration TO optibrain_sync;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients, public.patient_vitals,
  public.patient_medications, public.patient_validity, public.patient_clinical_info
  TO optibrain_sync;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA integration TO optibrain_sync;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO optibrain_sync;
