-- Per-encounter identifiers the OptiBrain indicator pipeline needs as
-- bootstrap inputs. It computes 96 hourly windows starting from the first
-- charted heart rate, and needs a date of birth to select the age band for the
-- cerebral perfusion pressure target. Neither exists in the patients table,
-- which carries only a formatted age string.
ALTER TABLE integration.patient_map
  ADD COLUMN IF NOT EXISTS dateofbirth date;