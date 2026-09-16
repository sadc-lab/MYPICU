// Modèle de graphe ontologique clinique : concepts (nœuds) et relations (arêtes)
// utilisés pour ancrer le contexte envoyé à l'IA et, à terme, valider ses réponses.

export type OntologyNodeKind =
  | "intervention"
  | "indicator"
  | "derived"
  | "mechanism"
  | "state"
  | "risk";

export type OntologyModule =
  | "optibrain"
  | "optiheart"
  | "optilungs"
  | "optirenal"
  | "optigastro";

export interface ThresholdBand {
  min?: number;
  max?: number;
}

export interface OntologyThresholds {
  unit: string;
  /** Plage cible (statut "normal"). */
  normal?: ThresholdBand;
  /** Une ou deux bandes (bas / haut) selon si la variable est mono- ou bidirectionnelle. */
  warning?: ThresholdBand[];
  critical?: ThresholdBand[];
}

export interface OntologyNode {
  id: string;
  kind: OntologyNodeKind;
  label: string;
  module: OntologyModule;
  /** Sous-groupe d'affichage (ex: indicateurs "primaires" vs cibles "ACSOS"). */
  group?: string;
  definition: string;
  /** Clé de variable dans PatientFileData (ex: "Variable_PIC"), quand applicable. */
  variableKey?: string;
  thresholds?: OntologyThresholds;
  /** Corps de référence, sans citation ponctuelle (ex: "BTF Pediatric Severe TBI Guidelines"). */
  guidelineRefs?: string[];
}

export type OntologyEdgeKind =
  | "targets" // intervention -> indicateur qu'elle module
  | "risk_of" // condition -> état de risque
  | "determines" // relation quasi-formulaire (ex: PAM, PIC -> PPC)
  | "computed_from" // métrique dérivée calculée à partir de mesures
  | "increases" // A en hausse tend à faire monter B
  | "triggers" // franchissement de seuil -> état clinique
  | "combines_to" // deux états concomitants -> état composite
  | "part_of_chain"; // indicateur participant à un mécanisme physiopathologique

export interface OntologyEdge {
  id: string;
  from: string;
  to: string;
  kind: OntologyEdgeKind;
  label?: string;
  /** Condition déclenchante en langage clinique, ex: "PIC ≥ 20 mmHg soutenu". */
  condition?: string;
}

export interface OntologyGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}
