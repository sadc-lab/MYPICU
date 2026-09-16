-- =====================================================================
-- Actualisation en direct de l'étude d'autorégulation : la page /autoreg
-- s'abonne aux nouvelles lignes de patient_vitals pour recalculer la courbe
-- PRx/COx sans que le clinicien ait à recharger manuellement. Sans cette
-- publication, l'abonnement Supabase Realtime ne reçoit jamais d'événement.
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_vitals;
