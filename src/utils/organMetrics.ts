// Consolidated organ metrics for the application
import {
  getLatestValue,
  type PatientFileData,
} from '@/services/patientFileData.service';

/**
 * Monitoring indicators are built from the cached record for the selected
 * patient. There is no static fallback: an unmeasured indicator is reported as
 * unmeasured rather than carrying a constant, because a fabricated value is
 * indistinguishable from a real one once it reaches the alert matrix.
 */
export interface MonitoringIndicator {
  label: string;
  value: string | number | null;
  unit?: string;
  target: string;
  status: "normal" | "warning" | "critical" | "unknown";
  trend?: string;
  change?: number;
  organ: string;
}

interface TargetSpec {
  label: string;
  variableKey: string;
  unit?: string;
  target: string;
  min: number;
  max: number;
  organ: string;
  digits?: number;
}

const BRAIN_TARGETS: TargetSpec[] = [
  { label: 'PIC', variableKey: 'Variable_PIC', unit: 'mmHg', target: '< 20 mmHg', min: 0, max: 60, organ: 'brain' },
  { label: 'PAM', variableKey: 'Variable_PAM', unit: 'mmHg', target: '> 65 mmHg', min: 30, max: 120, organ: 'brain' },
  { label: 'PPC', variableKey: 'Variable_PPC', unit: 'mmHg', target: '60-70 mmHg', min: 0, max: 120, organ: 'brain' },
  { label: 'PVC', variableKey: 'Variable_PVC', unit: 'mmHg', target: '2-8 mmHg', min: 0, max: 30, organ: 'brain' },
  { label: 'EtCO2', variableKey: 'Variable_EtCO2', unit: 'mmHg', target: '35-45 mmHg', min: 20, max: 80, organ: 'brain' },
  { label: 'PaCO2', variableKey: 'Variable_paco2', unit: 'mmHg', target: '35-45 mmHg', min: 15, max: 120, organ: 'brain' },
  { label: 'Pupille droite', variableKey: 'Variable_pupille_droite', unit: 'mm', target: 'Réactive, 2-4 mm', min: 0, max: 8, organ: 'brain' },
  { label: 'Pupille gauche', variableKey: 'Variable_pupille_gauche', unit: 'mm', target: 'Réactive, 2-4 mm', min: 0, max: 8, organ: 'brain' },
];

const HEART_TARGETS: TargetSpec[] = [
  { label: 'PAM', variableKey: 'Variable_PAM', unit: 'mmHg', target: '> 65 mmHg', min: 30, max: 120, organ: 'heart' },
  { label: 'Lactates', variableKey: 'Variable_lactate', unit: 'mmol/L', target: '< 2 mmol/L', min: 0, max: 20, organ: 'heart', digits: 1 },
  { label: 'ScvO2', variableKey: 'Variable_SvO2', unit: '%', target: '> 70%', min: 30, max: 100, organ: 'heart' },
];

type MedicationRow = { drugname?: string; charttime?: string; valeur?: string };

/** Latest drug dose recorded in each class, e.g. "Noradrenaline 0.15". */
function latestMedication(
  patientFileData: PatientFileData | null,
  classKey: string,
  drugName?: string,
): string | null {
  if (!patientFileData) return null;
  const rows = patientFileData[classKey];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const medicationRows = rows as MedicationRow[];
  const matching = drugName
    ? medicationRows.filter((row) => String(row.drugname || '').toLowerCase().includes(drugName.toLowerCase()))
    : medicationRows;
  if (matching.length === 0) return null;
  const ordered = [...matching].sort(
    (a, b) => new Date(b.charttime ?? 0).getTime() - new Date(a.charttime ?? 0).getTime(),
  );
  const dose = ordered[0]?.valeur;
  const name = ordered[0]?.drugname;
  if (!name) return null;
  return dose ? `${name} ${dose}` : String(name);
}

/**
 * Build one indicator per target from real measurements. A target with no
 * reading yields status "unknown" so the UI can grey it out instead of
 * inventing a plausible number.
 */
function buildIndicators(
  specs: TargetSpec[],
  patientFileData: PatientFileData | null,
  resolve?: (spec: TargetSpec) => string | number | null | undefined,
): MonitoringIndicator[] {
  return specs.map((spec) => {
    if (resolve) {
      // Drug classes resolve to a name plus dose, which is not range-checkable;
      // only numeric readings can be classified against a window.
      const value = resolve(spec);
      if (value === null || value === undefined) {
        return { label: spec.label, value: null, unit: spec.unit, target: spec.target, status: 'unknown', organ: spec.organ };
      }
      const numeric = typeof value === 'number' ? value : null;
      return {
        label: spec.label,
        value,
        unit: spec.unit,
        target: spec.target,
        status:
          numeric === null
            ? 'normal'
            : numeric >= spec.min && numeric <= spec.max
            ? 'normal'
            : 'warning',
        organ: spec.organ,
      };
    }
    const latest = patientFileData ? getLatestValue(patientFileData, spec.variableKey) : null;
    if (!latest) {
      return { label: spec.label, value: null, unit: spec.unit, target: spec.target, status: 'unknown', organ: spec.organ };
    }
    return {
      label: spec.label,
      value: spec.digits !== undefined ? Number(latest.value.toFixed(spec.digits)) : Math.round(latest.value),
      unit: spec.unit,
      target: spec.target,
      status: latest.value >= spec.min && latest.value <= spec.max ? 'normal' : 'warning',
      organ: spec.organ,
    };
  });
}

export function brainMonitoringTargetsOf(patientFileData: PatientFileData | null): MonitoringIndicator[] {
  const numeric = buildIndicators(BRAIN_TARGETS, patientFileData);
  const drugs: MonitoringIndicator[] = [
    {
      label: 'Opioide',
      resolve: () => latestMedication(patientFileData, 'Variable_opioides'),
      target: '100-200 mcg/h',
      unit: 'mcg/h',
      organ: 'brain',
    },
    {
      label: 'Hypnotique',
      resolve: () => latestMedication(patientFileData, 'Variable_hypnotiques'),
      target: '150-250 mg/h',
      unit: 'mg/h',
      organ: 'brain',
    },
    {
      label: 'Inotrope / vasopresseur',
      resolve: () => latestMedication(patientFileData, 'Variable_inotropes_vasopresseurs'),
      target: 'Selon besoin',
      organ: 'brain',
    },
  ].map((entry) => {
    const value = entry.resolve();
    return {
      label: entry.label,
      value: value ?? null,
      unit: entry.unit,
      target: entry.target,
      status: value ? ('normal' as const) : ('unknown' as const),
      organ: entry.organ,
    };
  });
  return [...numeric, ...drugs];
}

export function heartMonitoringTargetsOf(patientFileData: PatientFileData | null): MonitoringIndicator[] {
  const numeric = buildIndicators(HEART_TARGETS, patientFileData);
  const vasoactive = latestMedication(patientFileData, 'Variable_inotropes_vasopresseurs');
  numeric.push({
    label: 'Support inotrope / vasopresseur',
    value: vasoactive ?? null,
    target: 'Selon besoin',
    status: vasoactive ? 'normal' : 'unknown',
    organ: 'heart',
  });
  return numeric;
}

/** Optilungs, OptiRenal and OptiGastro are out of scope for the first version. */
export function lungMonitoringTargetsOf(): MonitoringIndicator[] {
  return [];
}
