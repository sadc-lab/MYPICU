import { OntologyEdge, OntologyGraph, OntologyNode } from "./types";

// Périmètre v1 : module cérébral (Optibrain). Les seuils reprennent ceux déjà
// codés dans src/pages/Optibrain.tsx (getPicStatus, getPpcStatus,
// baseClinicalIndicators, seuils PRx) plutôt que d'en inventer de nouveaux.

const nodes: OntologyNode[] = [
  // --- Interventions ---
  {
    id: "interv_hypnotique",
    kind: "intervention",
    label: "Hypnotique (ex. Propofol)",
    module: "optibrain",
    definition: "Sédation continue réduisant la demande métabolique cérébrale et la PIC.",
    variableKey: "Variable_hypnotiques",
  },
  {
    id: "interv_opioide",
    kind: "intervention",
    label: "Opioïde",
    module: "optibrain",
    definition: "Analgésie réduisant la réponse hypertensive à la douleur/aux soins, limitant les pics de PIC.",
    variableKey: "Variable_opioides",
  },
  {
    id: "interv_antiepileptique",
    kind: "intervention",
    label: "Anti-épileptique",
    module: "optibrain",
    definition: "Prévention/traitement des crises, qui augmentent la demande métabolique et la PIC.",
    variableKey: "Variable_anti_epileptique",
  },
  {
    id: "interv_positionnement",
    kind: "intervention",
    label: "Positionnement tête",
    module: "optibrain",
    definition: "Élévation de tête 0-30° favorisant le drainage veineux cérébral.",
  },

  // --- Risque ---
  {
    id: "risk_pris",
    kind: "risk",
    label: "Risque PRIS (syndrome de perfusion au propofol)",
    module: "optibrain",
    definition: "Risque métabolique croissant avec la durée d'exposition au propofol.",
    guidelineRefs: ["Surveillance PRIS – doctrine réanimation pédiatrique"],
  },

  // --- Indicateurs primaires (cérébraux) ---
  {
    id: "ind_pic",
    kind: "indicator",
    label: "PIC",
    module: "optibrain",
    group: "Indicateurs primaires",
    definition: "Pression intracrânienne.",
    variableKey: "Variable_PIC",
    thresholds: {
      unit: "mmHg",
      normal: { max: 20 },
      warning: [{ min: 20, max: 25 }],
      critical: [{ min: 25 }],
    },
    guidelineRefs: ["BTF Pediatric Severe TBI Guidelines"],
  },
  {
    id: "ind_ppc",
    kind: "indicator",
    label: "PPC",
    module: "optibrain",
    group: "Indicateurs primaires",
    definition: "Pression de perfusion cérébrale (PAM − PIC).",
    variableKey: "Variable_PPC",
    thresholds: {
      unit: "mmHg",
      normal: { min: 60, max: 70 },
      warning: [{ min: 50, max: 60 }, { min: 70, max: 80 }],
      critical: [{ max: 50 }, { min: 80 }],
    },
    guidelineRefs: ["BTF Pediatric Severe TBI Guidelines"],
  },
  {
    id: "ind_pam",
    kind: "indicator",
    label: "PAM",
    module: "optiheart",
    group: "Indicateurs primaires",
    definition: "Pression artérielle moyenne. Cible dépendante de l'âge — aucun seuil fixe codé pour ce module.",
    variableKey: "Variable_PAM",
  },
  {
    id: "ind_paco2",
    kind: "indicator",
    label: "PaCO2",
    module: "optilungs",
    group: "Indicateurs primaires",
    definition: "Pression artérielle en CO2. Vasodilatateur cérébral direct au-delà de la cible.",
    variableKey: "Variable_paco2",
    thresholds: { unit: "mmHg", normal: { min: 35, max: 45 } },
  },
  {
    id: "ind_etco2",
    kind: "indicator",
    label: "EtCO2",
    module: "optilungs",
    group: "Indicateurs primaires",
    definition: "CO2 télé-expiratoire, marqueur de substitution non invasif de la PaCO2.",
    variableKey: "Variable_ETCO2",
  },
  {
    id: "ind_tete",
    kind: "indicator",
    label: "Position tête",
    module: "optibrain",
    group: "Indicateurs primaires",
    definition: "Angle de la tête de lit.",
    variableKey: "Variable_position_tete",
    thresholds: { unit: "°", normal: { min: 0, max: 30 } },
  },
  {
    id: "ind_gcs",
    kind: "indicator",
    label: "GCS",
    module: "optibrain",
    group: "Indicateurs primaires",
    definition:
      "Score de Glasgow (examen clinique). Convention clinique usuelle : sévère < 9, modéré 9-12, léger 13-15 — aucun seuil de statut n'est codé dans l'app actuellement.",
    thresholds: { unit: "/15", normal: { min: 13, max: 15 } },
  },

  // --- Cibles ACSOS (agressions cérébrales secondaires d'origine systémique) ---
  {
    id: "ind_temp",
    kind: "indicator",
    label: "Température",
    module: "optibrain",
    group: "Cibles ACSOS",
    definition: "Fièvre = agression cérébrale secondaire d'origine systémique (ACSOS).",
    variableKey: "Variable_temperature",
    thresholds: { unit: "°C", normal: { min: 35, max: 38 } },
  },
  {
    id: "ind_glycemie",
    kind: "indicator",
    label: "Glycémie",
    module: "optibrain",
    group: "Cibles ACSOS",
    definition: "Hypo- et hyperglycémie aggravent la lésion cérébrale secondaire.",
    variableKey: "Variable_glycemie",
    thresholds: { unit: "mmol/L", normal: { min: 6, max: 11 } },
  },
  {
    id: "ind_inr",
    kind: "indicator",
    label: "INR",
    module: "optibrain",
    group: "Cibles ACSOS",
    definition: "Coagulopathie = risque d'extension hémorragique.",
    variableKey: "Variable_INR",
    thresholds: { unit: "ratio", normal: { max: 1.2 } },
  },
  {
    id: "ind_plaquettes",
    kind: "indicator",
    label: "Plaquettes",
    module: "optibrain",
    group: "Cibles ACSOS",
    definition: "Thrombopénie = risque hémorragique cérébral.",
    variableKey: "Variable_plaquettes",
    thresholds: { unit: "g/L", normal: { min: 100 } },
  },
  {
    id: "ind_hemoglobine",
    kind: "indicator",
    label: "Hémoglobine",
    module: "optibrain",
    group: "Cibles ACSOS",
    definition: "Anémie réduit le transport d'oxygène cérébral.",
    variableKey: "Variable_hemoglobine",
    thresholds: { unit: "g/dL", normal: { min: 7 } },
  },

  // --- Dérivés (calculés) ---
  {
    id: "der_prx",
    kind: "derived",
    label: "PRx",
    module: "optibrain",
    definition: "Index de réactivité pressionnelle — corrélation glissante PIC/PAM (fenêtre ~30 min).",
    thresholds: {
      unit: "index (-1 à 1)",
      normal: { max: 0.3 },
      warning: [{ min: 0.3, max: 0.5 }],
      critical: [{ min: 0.5 }],
    },
  },
  {
    id: "der_ppcopt",
    kind: "derived",
    label: "PPC optimale (PAM optimale si NIRS)",
    module: "optibrain",
    definition: "PPC individualisée au minimum de la courbe PRx, fenêtre glissante de 4h.",
    thresholds: { unit: "mmHg" },
  },
  {
    id: "der_zone",
    kind: "derived",
    label: "Zone d'autorégulation (LLA–ULA)",
    module: "optibrain",
    definition:
      "Bornes individualisées autour de la PPC optimale. Utilisée aujourd'hui uniquement pour l'affichage de la PPC optimale (Optibrain) — ne pilote pas la classification d'état HTIC/Ischémie/Hyperémie, qui reste basée sur des seuils fixes (voir ind_pic, ind_ppc).",
    thresholds: { unit: "mmHg" },
  },

  // --- Mécanismes ---
  {
    id: "mech_acsos",
    kind: "mechanism",
    label: "ACSOS",
    module: "optibrain",
    definition: "Agressions cérébrales secondaires d'origine systémique — agrégateur des cibles physiologiques hors module cérébral direct.",
    guidelineRefs: ["ACSOS – doctrine neuro-réanimation"],
  },
  {
    id: "cerebral-hypoperfusion",
    kind: "mechanism",
    label: "Hypoperfusion cérébrale",
    module: "optibrain",
    definition: "Baisse de la pression motrice cérébrale par insuffisance hémodynamique systémique avec retentissement intracrânien.",
  },
  {
    id: "hypercapnic-htic",
    kind: "mechanism",
    label: "HTIC hypercapnique",
    module: "optibrain",
    definition: "Hypercapnie entraînant vasodilatation cérébrale et augmentation de la PIC.",
  },

  // --- États cliniques ---
  {
    id: "state_controle",
    kind: "state",
    label: "Contrôlé",
    module: "optibrain",
    definition: "État par défaut, en l'absence d'HTIC, d'ischémie ou d'hyperémie.",
  },
  {
    id: "state_htic",
    kind: "state",
    label: "HTIC",
    module: "optibrain",
    definition: "Hypertension intracrânienne soutenue.",
  },
  {
    id: "state_ischemie",
    kind: "state",
    label: "Ischémie",
    module: "optibrain",
    definition: "Perfusion cérébrale sous la limite inférieure d'autorégulation.",
  },
  {
    id: "state_hyperemie",
    kind: "state",
    label: "Hyperémie",
    module: "optibrain",
    definition: "Perfusion cérébrale au-dessus de la limite supérieure d'autorégulation.",
  },
  {
    id: "state_htic_ischemie",
    kind: "state",
    label: "HTIC + Ischémie",
    module: "optibrain",
    definition: "État composite le plus critique : HTIC et ischémie concomitantes.",
  },
];

const edges: OntologyEdge[] = [
  { id: "e1", from: "interv_hypnotique", to: "ind_pic", kind: "targets", label: "sédation ↓ PIC" },
  { id: "e2", from: "interv_opioide", to: "ind_pic", kind: "targets", label: "analgésie ↓ réponse hypertensive" },
  { id: "e3", from: "interv_antiepileptique", to: "ind_pic", kind: "targets", label: "↓ demande métabolique" },
  { id: "e4", from: "interv_positionnement", to: "ind_tete", kind: "targets", label: "cible 0-30°" },
  { id: "e5", from: "interv_hypnotique", to: "risk_pris", kind: "risk_of", condition: "Propofol > 48h" },

  { id: "e6", from: "ind_pam", to: "ind_ppc", kind: "determines", label: "PPC = PAM − PIC" },
  { id: "e7", from: "ind_pic", to: "ind_ppc", kind: "determines", label: "PIC ↑ ⇒ PPC ↓" },
  { id: "e8", from: "ind_pic", to: "der_prx", kind: "computed_from" },
  { id: "e9", from: "ind_pam", to: "der_prx", kind: "computed_from", label: "corrélation glissante 30 min" },
  { id: "e10", from: "der_prx", to: "der_ppcopt", kind: "computed_from", label: "minimum de la courbe PRx (4h)" },
  { id: "e11", from: "der_ppcopt", to: "der_zone", kind: "determines", label: "LLA / ULA autour de PPCopt" },

  { id: "e12", from: "ind_paco2", to: "ind_pic", kind: "increases", condition: "PaCO2 > 45 mmHg" },
  { id: "e13", from: "mech_acsos", to: "ind_pic", kind: "increases", label: "aggrave le risque d'HTIC" },

  { id: "e14", from: "ind_temp", to: "mech_acsos", kind: "part_of_chain" },
  { id: "e15", from: "ind_glycemie", to: "mech_acsos", kind: "part_of_chain" },
  { id: "e16", from: "ind_inr", to: "mech_acsos", kind: "part_of_chain" },
  { id: "e17", from: "ind_plaquettes", to: "mech_acsos", kind: "part_of_chain" },
  { id: "e18", from: "ind_hemoglobine", to: "mech_acsos", kind: "part_of_chain" },

  { id: "e19", from: "ind_pam", to: "cerebral-hypoperfusion", kind: "part_of_chain" },
  { id: "e20", from: "ind_ppc", to: "cerebral-hypoperfusion", kind: "part_of_chain" },
  { id: "e21", from: "ind_pic", to: "cerebral-hypoperfusion", kind: "part_of_chain" },
  { id: "e22", from: "ind_paco2", to: "hypercapnic-htic", kind: "part_of_chain" },
  { id: "e23", from: "ind_pic", to: "hypercapnic-htic", kind: "part_of_chain" },
  { id: "e24", from: "ind_ppc", to: "hypercapnic-htic", kind: "part_of_chain" },

  { id: "e25", from: "ind_pic", to: "state_htic", kind: "triggers", condition: "PIC ≥ 20 mmHg" },
  { id: "e26", from: "ind_ppc", to: "state_ischemie", kind: "triggers", condition: "PPC < 50 mmHg" },
  { id: "e27", from: "ind_ppc", to: "state_hyperemie", kind: "triggers", condition: "PPC > 80 mmHg (et PIC < 20)" },
  { id: "e28", from: "state_htic", to: "state_htic_ischemie", kind: "combines_to" },
  { id: "e29", from: "state_ischemie", to: "state_htic_ischemie", kind: "combines_to" },
];

export const cerebralOntology: OntologyGraph = { nodes, edges };

export function getOntologyNode(id: string): OntologyNode | undefined {
  return cerebralOntology.nodes.find((n) => n.id === id);
}

export function getOntologyNodeByVariableKey(variableKey: string): OntologyNode | undefined {
  return cerebralOntology.nodes.find((n) => n.variableKey === variableKey);
}

export function getOntologyEdgesForNode(id: string): OntologyEdge[] {
  return cerebralOntology.edges.filter((e) => e.from === id || e.to === id);
}
