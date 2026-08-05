-- =====================================================================
-- Déploiement progressif du cloisonnement par unité (période de grâce)
-- ---------------------------------------------------------------------
-- Objectif : pouvoir déployer la RLS par unité SANS couper l'accès des
-- cliniciens déjà en service. Règle transitoire :
--   * un utilisateur SANS aucune affectation d'unité conserve l'accès
--     complet (comportement actuel) ;
--   * dès qu'on lui affecte au moins une unité (public.user_wards), il est
--     immédiatement cloisonné à cette/ces unité(s).
-- On active donc le cloisonnement utilisateur par utilisateur, à la demande,
-- en insérant des lignes dans user_wards — aucune coupure globale.
--
-- Pour passer en cloisonnement STRICT (dény par défaut) plus tard, il
-- suffira de redéfinir ces deux fonctions sans la clause « NOT EXISTS ».
-- =====================================================================

CREATE OR REPLACE FUNCTION public.can_access_ward(_ward text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- Période de grâce : aucun cloisonnement tant que l'utilisateur n'a
    -- aucune unité assignée.
    NOT EXISTS (
      SELECT 1 FROM public.user_wards w WHERE w.user_id = auth.uid()
    )
    OR EXISTS (
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
  SELECT
    -- Période de grâce : accès complet si aucune unité n'est assignée.
    NOT EXISTS (
      SELECT 1 FROM public.user_wards w WHERE w.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.user_wards w ON w.ward = p.ward
      WHERE p.id = _patient_id
        AND w.user_id = auth.uid()
    );
$$;
