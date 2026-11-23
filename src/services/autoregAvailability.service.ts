// Indique, pour la liste de l'unité, quels patients ont de quoi calculer une
// autorégulation cérébrale — pour que le clinicien voie d'emblée qui fait partie
// de l'étude, sans ouvrir chaque patient.
//
// C'est un pré-filtre : il vérifie la présence des signaux, pas leur qualité.
// La vue d'analyse applique ensuite les garde-fous complets (signal constant,
// plage physiologique, paires PIC/PAM synchrones) et dit pourquoi si le calcul
// reste impossible.

import { supabase } from "@/integrations/supabase/client";
import { isNirsBasedPatient } from "@/services/autoregulation.service";

export type AutoregAvailability = "cox" | "prx";

// Une seule ligne suffit : la requête s'appuie sur l'index
// (patient_id, variable_key) et reste instantanée même sur un long séjour.
async function hasVariable(dbPatientId: string, variableKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("patient_vitals")
    .select("id")
    .eq("patient_id", dbPatientId)
    .eq("variable_key", variableKey)
    .not("valeur", "is", null)
    .limit(1);
  if (error) {
    console.error(`Disponibilité autorégulation : lecture de ${variableKey} échouée`, error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Patients disposant des signaux d'autorégulation, avec leur méthode :
 * COx (enregistrement NIRS rSO₂/PAM) ou PRx (PIC et PAM au moniteur).
 */
export async function getAutoregAvailability(
  patientIds: string[],
): Promise<Record<string, AutoregAvailability>> {
  const entries = await Promise.all(
    patientIds.map(async (id): Promise<[string, AutoregAvailability | null]> => {
      if (isNirsBasedPatient(id)) return [id, "cox"];
      const dbPatientId = `#${id.replace("#", "")}`;
      const [pic, pam] = await Promise.all([
        hasVariable(dbPatientId, "Variable_PIC"),
        hasVariable(dbPatientId, "Variable_PAM"),
      ]);
      return [id, pic && pam ? "prx" : null];
    }),
  );
  const out: Record<string, AutoregAvailability> = {};
  for (const [id, mode] of entries) if (mode) out[id] = mode;
  return out;
}
