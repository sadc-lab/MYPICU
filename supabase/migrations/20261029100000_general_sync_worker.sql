-- Give the reusable sync runtime a module-neutral database role while
-- preserving the privileges and authentication settings of existing installs.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'optibrain_sync')
     AND NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sync_worker') THEN
    ALTER ROLE optibrain_sync RENAME TO sync_worker;
  ELSIF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sync_worker') THEN
    CREATE ROLE sync_worker LOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE TABLE integration.module_sync_state (
  module_name text NOT NULL,
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamptz,
  last_synced_at timestamptz,
  duration_ms integer,
  error text,
  PRIMARY KEY (module_name, patient_id)
);

ALTER ROLE sync_worker LOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public, integration TO sync_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients, public.patient_vitals,
  public.patient_medications, public.patient_validity, public.patient_clinical_info,
  public.patient_autoregulation TO sync_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA integration TO sync_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sync_worker;
