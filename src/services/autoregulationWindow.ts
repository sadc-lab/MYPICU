export type AutoregulationMode = "prx" | "cox";

export interface AutoregulationWindow {
  mode: AutoregulationMode;
  optimalPressure: number | null;
  inferiorLimit: number | null;
  superiorLimit: number | null;
}

export type WindowPosition = "inside" | "below" | "above" | "unavailable";

export function hasAutoregulationInputs(
  mode: AutoregulationMode,
  availableVariables: Iterable<string>,
): boolean {
  const variables = new Set(availableVariables);
  const required = mode === "prx"
    ? ["Variable_PIC", "Variable_PPC"]
    : ["Variable_rSO2", "Variable_PAM"];
  return required.every((variable) => variables.has(variable));
}

export function hasAutoregulationWindow(
  result: AutoregulationWindow | null | undefined,
): result is AutoregulationWindow & {
  optimalPressure: number;
  inferiorLimit: number;
  superiorLimit: number;
} {
  return Boolean(
    result
    && Number.isFinite(result.optimalPressure)
    && Number.isFinite(result.inferiorLimit)
    && Number.isFinite(result.superiorLimit)
    && result.inferiorLimit! <= result.superiorLimit!,
  );
}

export function pickAutoregulationWindow<T extends AutoregulationWindow>(
  results: T[],
  availableVariables: Iterable<string>,
): T | null {
  const eligible = results.filter(
    (result) =>
      hasAutoregulationWindow(result)
      && hasAutoregulationInputs(result.mode, availableVariables),
  );
  return eligible.find((result) => result.mode === "prx") ?? eligible[0] ?? null;
}

export function getWindowPosition(
  value: number | null | undefined,
  result: AutoregulationWindow | null | undefined,
): WindowPosition {
  if (value == null || !Number.isFinite(value) || !hasAutoregulationWindow(result)) {
    return "unavailable";
  }
  if (value < result.inferiorLimit) return "below";
  if (value > result.superiorLimit) return "above";
  return "inside";
}
