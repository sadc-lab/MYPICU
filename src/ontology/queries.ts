import { cerebralOntology, getOntologyNode } from "./cerebral.ontology";
import { OntologyEdge, OntologyNode, OntologyThresholds } from "./types";

export { getOntologyNode, getOntologyNodeByVariableKey, getOntologyEdgesForNode } from "./cerebral.ontology";

export interface RelatedNode {
  node: OntologyNode;
  edge: OntologyEdge;
  direction: "in" | "out";
}

/**
 * Nœuds connectés à `id` par une arête entrante ou sortante, avec l'arête
 * et le sens, pour affichage ("PaCO2 → augmente PIC" vs "PIC ← augmenté par PaCO2").
 */
export function getRelatedNodes(id: string): RelatedNode[] {
  return cerebralOntology.edges
    .filter((e) => e.from === id || e.to === id)
    .map((edge) => {
      const direction: "in" | "out" = edge.from === id ? "out" : "in";
      const otherId = direction === "out" ? edge.to : edge.from;
      const node = getOntologyNode(otherId);
      return node ? { node, edge, direction } : null;
    })
    .filter((r): r is RelatedNode => r !== null);
}

function formatBand(band: { min?: number; max?: number } | undefined): string | null {
  if (!band) return null;
  if (band.min !== undefined && band.max !== undefined) return `${band.min} – ${band.max}`;
  if (band.min !== undefined) return `> ${band.min}`;
  if (band.max !== undefined) return `< ${band.max}`;
  return null;
}

/**
 * Formate les seuils d'un nœud en une ligne lisible, ex:
 * "mmHg · cible < 20 · alerte 20 – 25 · critique > 25"
 * Réutilisé par le générateur de prompt Copilot et par l'UI Optibrain.
 */
export function formatThresholds(thresholds: OntologyThresholds | undefined): string | null {
  if (!thresholds) return null;
  const parts: string[] = [];
  const normal = formatBand(thresholds.normal);
  if (normal) parts.push(`cible ${normal}`);
  const warning = (thresholds.warning ?? []).map(formatBand).filter(Boolean).join(" / ");
  if (warning) parts.push(`alerte ${warning}`);
  const critical = (thresholds.critical ?? []).map(formatBand).filter(Boolean).join(" / ");
  if (critical) parts.push(`critique ${critical}`);
  if (parts.length === 0) return null;
  return `${thresholds.unit} · ${parts.join(" · ")}`;
}
