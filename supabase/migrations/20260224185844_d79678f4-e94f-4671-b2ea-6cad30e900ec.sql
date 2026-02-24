
-- Update GCS values for patients with known GCS
UPDATE public.patients SET gcs = 3 WHERE id = '#8749';
UPDATE public.patients SET gcs = 7 WHERE id = '#6312';
UPDATE public.patients SET gcs = 5 WHERE id = '#8448';

-- Fix ward assignments for pedB patients
UPDATE public.patients SET ward = 'pedB' WHERE id IN ('#4', '#5', '#6', '#7', '#9');
