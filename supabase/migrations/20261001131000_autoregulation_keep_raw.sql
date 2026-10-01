-- Keep the module's own analysis table and drop the columns nothing reads.
--
-- The four removed columns were specified before the module's output shape was
-- known: the correlation and pressure window grids are properties of a single
-- computation, and the curve is contained in `raw`. Storing them separately
-- left four columns permanently null and a second place for the curve to drift
-- out of step with the figures beside it.
ALTER TABLE public.patient_autoregulation
  ADD COLUMN IF NOT EXISTS raw jsonb;

COMMENT ON COLUMN public.patient_autoregulation.raw IS
  'Per-window analysis table as returned by the OptiBrain module, kept verbatim. '
  'The dashboard draws the pressure-to-index curve from it so the plotted shape and '
  'the headline figures come from one computation.';

ALTER TABLE public.patient_autoregulation
  DROP COLUMN IF EXISTS curve,
  DROP COLUMN IF EXISTS correlation_windows,
  DROP COLUMN IF EXISTS pressure_windows,
  DROP COLUMN IF EXISTS duration_hours;

-- The sync role's grants live with the table they apply to, rather than in the
-- local bootstrap script: a table added later would otherwise be invisible to
-- the worker that has to write it.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_autoregulation TO optibrain_sync;