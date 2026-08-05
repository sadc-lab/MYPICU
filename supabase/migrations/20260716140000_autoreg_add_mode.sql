-- Ajoute la colonne `mode` à autoreg_study_results pour distinguer les deux
-- index d'autorégulation calculés par l'outil d'étude :
--   'prx' : corrélation PIC ↔ PAM (invasif)  → PPC optimale
--   'cox' : corrélation rSO₂ (NIRS) ↔ PAM    → PAM optimale
ALTER TABLE public.autoreg_study_results
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'prx';
