UPDATE public.patients
SET ward = 'pedA'
WHERE ward IS DISTINCT FROM 'pedA';