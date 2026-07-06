ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS intolerances TEXT;