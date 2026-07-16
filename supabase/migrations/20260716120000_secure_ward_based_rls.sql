-- =====================================================================
-- Sécurité clinique : cloisonnement des données patient par unité (ward)
-- Modèle d'accès : un clinicien ne voit/modifie que les patients des
-- unités auxquelles il est explicitement assigné (table user_wards).
-- Remplace les politiques permissives "auth.role() = authenticated"
-- qui donnaient accès à TOUS les patients à TOUT compte authentifié.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table d'affectation utilisateur -> unité
--    Source d'autorité pour l'autorisation (NE PAS se fier au
--    user_metadata du JWT, modifiable côté client).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_wards (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ward        text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, ward)
);

CREATE INDEX IF NOT EXISTS idx_user_wards_user ON public.user_wards (user_id);

ALTER TABLE public.user_wards ENABLE ROW LEVEL SECURITY;

-- Un utilisateur peut consulter ses propres affectations (pour l'UI).
DROP POLICY IF EXISTS "Users can view own ward assignments" ON public.user_wards;
CREATE POLICY "Users can view own ward assignments" ON public.user_wards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Aucune politique INSERT/UPDATE/DELETE pour authenticated :
-- l'affectation des unités est une opération d'administration réalisée
-- via service_role (dashboard Supabase ou fonction d'admin dédiée).
GRANT SELECT ON public.user_wards TO authenticated;
GRANT ALL ON public.user_wards TO service_role;

-- ---------------------------------------------------------------------
-- 2. Fonctions d'autorisation (SECURITY DEFINER)
--    Exécutées avec les droits du propriétaire pour lire `patients`
--    et `user_wards` sans déclencher de récursion RLS.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_ward(_ward text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_wards w
    WHERE w.user_id = auth.uid()
      AND w.ward = _ward
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_patient(_patient_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients p
    JOIN public.user_wards w ON w.ward = p.ward
    WHERE p.id = _patient_id
      AND w.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_ward(text)     FROM public;
REVOKE ALL ON FUNCTION public.can_access_patient(text)  FROM public;
GRANT EXECUTE ON FUNCTION public.can_access_ward(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_patient(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Table patients : activer RLS + cloisonnement par unité
-- ---------------------------------------------------------------------
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Retirer d'éventuelles politiques permissives créées via le dashboard.
DROP POLICY IF EXISTS "Authenticated read access"   ON public.patients;
DROP POLICY IF EXISTS "Authenticated insert access" ON public.patients;
DROP POLICY IF EXISTS "Authenticated update access" ON public.patients;
DROP POLICY IF EXISTS "Authenticated delete access" ON public.patients;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.patients;

DROP POLICY IF EXISTS "Ward-scoped select" ON public.patients;
CREATE POLICY "Ward-scoped select" ON public.patients
  FOR SELECT TO authenticated
  USING (public.can_access_ward(ward));

DROP POLICY IF EXISTS "Ward-scoped insert" ON public.patients;
CREATE POLICY "Ward-scoped insert" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_ward(ward));

DROP POLICY IF EXISTS "Ward-scoped update" ON public.patients;
CREATE POLICY "Ward-scoped update" ON public.patients
  FOR UPDATE TO authenticated
  USING (public.can_access_ward(ward))
  WITH CHECK (public.can_access_ward(ward));

DROP POLICY IF EXISTS "Ward-scoped delete" ON public.patients;
CREATE POLICY "Ward-scoped delete" ON public.patients
  FOR DELETE TO authenticated
  USING (public.can_access_ward(ward));

-- ---------------------------------------------------------------------
-- 4. Tables de données patient : remplacer les politiques permissives
--    par un cloisonnement basé sur l'unité du patient rattaché.
-- ---------------------------------------------------------------------

-- Helper local (DO block) appliqué à chaque table dépendante de patient_id.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'patient_vitals',
    'patient_medications',
    'patient_validity',
    'patient_clinical_info',
    'patient_objectives'
  ]
  LOOP
    -- Retirer les anciennes politiques permissives.
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read access"   ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated insert access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated update access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated delete access" ON public.%I;', tbl);

    -- Nouvelles politiques cloisonnées par unité.
    EXECUTE format($f$
      CREATE POLICY "Ward-scoped select" ON public.%I
        FOR SELECT TO authenticated
        USING (public.can_access_patient(patient_id));
    $f$, tbl);

    EXECUTE format($f$
      CREATE POLICY "Ward-scoped insert" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (public.can_access_patient(patient_id));
    $f$, tbl);

    EXECUTE format($f$
      CREATE POLICY "Ward-scoped update" ON public.%I
        FOR UPDATE TO authenticated
        USING (public.can_access_patient(patient_id))
        WITH CHECK (public.can_access_patient(patient_id));
    $f$, tbl);

    EXECUTE format($f$
      CREATE POLICY "Ward-scoped delete" ON public.%I
        FOR DELETE TO authenticated
        USING (public.can_access_patient(patient_id));
    $f$, tbl);
  END LOOP;
END $$;

-- =====================================================================
-- NOTE D'EXPLOITATION
-- Après déploiement, plus aucun clinicien ne voit de patient tant qu'il
-- n'est pas affecté à une unité. Assigner une unité (via dashboard) :
--
--   INSERT INTO public.user_wards (user_id, ward)
--   VALUES ('<uuid_utilisateur>', 'pedA');
--
-- Unités actuelles présentes dans `patients.ward` : 'pedA', 'pedB'.
-- =====================================================================
