/**
 * Unified styling for KPI count circles across the app
 * (VitalSignsPanel, Optibrain/Heart/Lungs group headers, Optistate module headers).
 *
 * Severity tiers:
 *  - 0           → normal (vert pâle, sans emphase)
 *  - 1–2         → surveillance (orange plein)
 *  - 3+ ou critical → critique (rouge plein, pulse léger)
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
  'rounded-full flex items-center justify-center font-bold tabular-nums shrink-0 transition-all duration-300 ease-out ring-1';

const severityClasses: Record<KpiSeverity, string> = {
  normal:
    'bg-status-normal/10 text-status-normal ring-status-normal/20',
  warning:
    'bg-status-warning text-white ring-status-warning/40 shadow-sm shadow-status-warning/30',
  critical:
    'bg-status-critical text-white ring-status-critical/50 shadow-sm shadow-status-critical/40 animate-[pulse_2.5s_ease-in-out_infinite]',
};

/**
 * Returns the full className for a KPI circle.
 * @param size - 'sm' (h-9 w-9, text-sm) used everywhere by default
 * @param count - number to display
 * @param hasCritical - force critical severity (e.g., a vital is in red zone)
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
