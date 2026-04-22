/**
 * Unified styling for KPI count circles across the app
 * (VitalSignsPanel, Optibrain/Heart/Lungs group headers, Optistate module headers,
 *  Optibrain Adhérence & Monitorage, Optimisation cérébrale).
 *
 * Style : fond à faible opacité + bordure pleine + texte coloré (lisible et discret).
 *
 * Severity tiers:
 *  - 0           → normal (gris/vert pâle)
 *  - 1–2         → surveillance (orange)
 *  - 3+ ou critical → critique (rouge, pulse léger)
 */
export type KpiSeverity = 'normal' | 'warning' | 'critical';

export const getKpiSeverity = (
  count: number,
  hasCritical = false,
): KpiSeverity => {
  if (count === 0) return 'normal';
  if (hasCritical || count >= 3) return 'critical';
  return 'warning';
};

const baseClasses =
  'rounded-full flex items-center justify-center font-bold tabular-nums shrink-0 transition-all duration-300 ease-out border-2';

const severityClasses: Record<KpiSeverity, string> = {
  normal:
    'bg-status-normal/10 text-status-normal border-status-normal/60',
  warning:
    'bg-status-warning/10 text-status-warning border-status-warning',
  critical:
    'bg-status-critical/10 text-status-critical border-status-critical animate-[pulse_2.5s_ease-in-out_infinite]',
};

/**
 * Returns the full className for a KPI circle.
 * @param count - number to display
 * @param options.hasCritical - force critical severity
 * @param options.size - 'sm' (h-9 w-9, text-sm) used everywhere by default
 */
export const kpiCircleClass = (
  count: number,
  options: { hasCritical?: boolean; size?: 'sm' } = {},
): string => {
  const { hasCritical = false, size = 'sm' } = options;
  const severity = getKpiSeverity(count, hasCritical);
  const sizing = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-9 w-9 text-sm';
  return `${baseClasses} ${sizing} ${severityClasses[severity]}`;
};
