import { ReactNode, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePatient } from '@/hooks/usePatients';
import { usePatientCustomView } from '@/hooks/usePatientCustomView';
import {
  hasPatientFileData,
  loadPatientFileData,
  getClinicalIndicatorsStatus,
  getLatestValue,
  getAllTimeSeriesData,
  getVariableKeyFromLabel,
  PatientFileData,
} from '@/services/patientFileData.service';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Pin,
  X,
} from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import {
  brainMonitoringTargets,
  heartMonitoringTargets,
  lungMonitoringTargets,
} from '@/utils/organMetrics';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import kidneyIcon from '@/assets/kidney-icon.svg';
import intestineIcon from '@/assets/intestine-icon.svg';
import { cn } from '@/lib/utils';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import { ModuleIndicatorDropdown } from '@/components/ModuleIndicatorDropdown';

const MODULE_LABELS: Record<ModuleKey, string> = {
  optibrain: 'OptiBrain',
  optiheart: 'OptiHeart',
  optilungs: 'OptiLungs',
  optirenal: 'OptiRenal',
  optigastro: 'OptiGastro',
};

const MODULE_ICONS: Record<ModuleKey, ReactNode> = {
  optibrain: <img src={brainIcon} alt="" className="h-5 w-5" />,
  optiheart: <HeartIcon className="h-5 w-5 text-status-critical" />,
  optilungs: <img src={lungsIcon} alt="" className="h-5 w-5" />,
  optirenal: <img src={kidneyIcon} alt="" className="h-5 w-5" />,
  optigastro: <img src={intestineIcon} alt="" className="h-5 w-5" />,
};

type ModuleKey = 'optibrain' | 'optiheart' | 'optilungs' | 'optirenal' | 'optigastro';

interface Indicator {
  label: string;
  value: string | number;
  unit?: string;
  target: string;
  status: string;
  trend?: string;
  change?: number;
}

interface ModuleSummary {
  key: ModuleKey;
  organValue: string;
  label: string;
  score: number;
  iconNode: JSX.Element;
  indicators: Indicator[];
  interpretation: string;
  interventions: string[];
}

const Optistate = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get('patient') || '#25';
  const { data: patient, isLoading } = usePatient(patientId);
  const { overrides, getOverride, setOverride, clearOverride } = usePatientCustomView(patientId);

  // Vraies données cérébrales, quand elles existent, pour une comparaison
  // avant/maintenant honnête dans "Assembler les modules" — les autres
  // organes restent sur les données statiques de démo (aucune série réelle
  // à comparer pour eux aujourd'hui).
  const hasFileData = hasPatientFileData(patientId);
  const [patientFileData, setPatientFileData] = useState<PatientFileData | null>(null);
  useEffect(() => {
    if (hasFileData) {
      loadPatientFileData(patientId).then(setPatientFileData);
    } else {
      setPatientFileData(null);
    }
  }, [patientId, hasFileData]);

  // Organes "assemblés" : pré-sélectionnés une fois pour les systèmes déjà
  // en alerte (score >= 1), puis librement ajustables par le clinicien —
  // c'est cette même sélection qui pilote la matrice ci-dessous, fusionnant
  // la détection automatique et l'assemblage manuel en un seul mécanisme.
  const autoSelectedModulesRef = useRef(false);
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(new Set());
  useEffect(() => {
    if (autoSelectedModulesRef.current || !patient) return;
    autoSelectedModulesRef.current = true;
    const initial = new Set<ModuleKey>();
    if ((patient.brainScore || 0) >= 1) initial.add('optibrain');
    if ((patient.heartScore || 0) >= 1) initial.add('optiheart');
    if ((patient.lungsScore || 0) >= 1) initial.add('optilungs');
    if ((patient.kidneyScore || 0) >= 1) initial.add('optirenal');
    setSelectedModules(initial);
  }, [patient]);

  if (!patient || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p>{isLoading ? 'Chargement...' : 'Patient non trouvé'}</p>
        </div>
      </div>
    );
  }

  const vitalSigns = [
    { label: 'FC', value: 130, min: 60, targetMin: 80, targetMax: 120, max: 140, unit: 'bpm' },
    { label: 'TAM', value: 70, min: 60, targetMin: 78, targetMax: 85, max: 100, unit: 'mmHg' },
    { label: 'FR', value: 25, min: 15, targetMin: 20, targetMax: 30, max: 35, unit: '/min' },
    { label: 'T°', value: 37, min: 34, targetMin: 35, targetMax: 37, max: 39, unit: '°C' },
    { label: 'SPO2', value: 95, min: 80, targetMin: 90, targetMax: 100, max: 100, unit: '%' },
  ];

  const isInRange = (v: number, min: number, max: number) => v >= min && v <= max;

  // Cibles cliniques cérébrales réelles — mêmes libellés/cibles que
  // baseClinicalIndicators dans Optibrain.tsx, pour rester cohérent.
  const BRAIN_CLINICAL_TARGETS: Array<{ label: string; target: string }> = [
    { label: 'Tête', target: '0-30°' },
    { label: 'PIC', target: '< 20mmHg' },
    { label: 'PPC', target: '60-70 mmHg' },
    { label: 'Température', target: '35-38°C' },
    { label: 'PaCO2', target: '35-45mmHg' },
    { label: 'Glycémie', target: '6-11 mmol/L' },
    { label: 'Hémoglobine', target: '> 7g/dl' },
    { label: 'INR', target: '< 1.2' },
    { label: 'Plaquettes', target: '> 100 g/L' },
  ];

  // getClinicalIndicatorsStatus utilise des libellés légèrement différents
  // (ex: "Temp.", "Hb") — même correspondance (et même angle mort pour
  // Température/Hémoglobine) que dans Optibrain.tsx, pour rester cohérent
  // entre les deux pages plutôt que de corriger silencieusement ici.
  const brainClinicalStatuses = patientFileData ? getClinicalIndicatorsStatus(patientFileData, 24) : null;

  const realBrainIndicators: Indicator[] | null = patientFileData
    ? BRAIN_CLINICAL_TARGETS.map(({ label, target }) => {
        const variableKey = getVariableKeyFromLabel(label);
        if (!variableKey || !patientFileData[variableKey]) return null;
        const latest = getLatestValue(patientFileData, variableKey);
        if (!latest) return null;

        const statusEntry = brainClinicalStatuses?.find((s) => s.label === label);
        return {
          label,
          target,
          value: latest.value,
          status: statusEntry?.status ?? 'normal',
        } as Indicator;
      }).filter((i): i is Indicator => i !== null)
    : null;

  // Indicateurs candidats par module (données disponibles dans l'app aujourd'hui).
  // Cerveau utilise les vraies données quand elles existent pour ce patient ;
  // sinon, comme les autres organes, les données statiques de démo.
  // optirenal/optigastro n'ont aucun indicateur défini nulle part encore — le
  // sélecteur les affichera grisés plutôt que de prétendre en avoir.
  const MODULE_ALL_INDICATORS: Record<ModuleKey, Indicator[]> = {
    optibrain: realBrainIndicators ?? brainMonitoringTargets,
    optiheart: heartMonitoringTargets,
    optilungs: lungMonitoringTargets,
    optirenal: [],
    optigastro: [],
  };

  // Fusionne la sélection automatique (statut hors cible) avec les
  // surcharges manuelles du clinicien (épinglé = toujours visible,
  // masqué = jamais visible, sans surcharge = comportement automatique).
  const computeEffectiveIndicators = (moduleKey: ModuleKey, allTargets: Indicator[]): Indicator[] =>
    allTargets
      .filter((t) => {
        const override = getOverride(moduleKey, t.label);
        if (override === 'hide') return false;
        if (override === 'pin') return true;
        return !!t.status && t.status !== 'normal';
      })
      .map((t) => ({
        label: t.label,
        value: t.value,
        unit: t.unit,
        target: t.target,
        status: t.status,
        trend: t.trend,
        change: t.change,
      }));

  // Build module summaries (only modules that have problems)
  const allModules: ModuleSummary[] = [
    {
      key: 'optibrain',
      organValue: 'cerveau',
      label: 'OptiBrain',
      score: patient.brainScore || 0,
      iconNode: (
        <img
          src={brainIcon}
          alt=""
          className="h-6 w-6"
          style={{
            filter:
              'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)',
          }}
        />
      ),
      indicators: computeEffectiveIndicators('optibrain', MODULE_ALL_INDICATORS.optibrain),
      interpretation:
        'PIC à 26 mmHg en tendance baissière mais persistante > 20 — suspicion d’HTIC réactive nécessitant un contrôle rapproché de la PPC et de la sédation.',
      interventions: [
        'Sédation: Hypnotique 220 mg/h, Opioide 150 mcg/h',
        'Propofol cumulé 48h: 10.5 g (< 12 g)',
        'Nutrition entérale en cours',
      ],
    },
    {
      key: 'optiheart',
      organValue: 'coeur',
      label: 'OptiHeart',
      score: patient.heartScore || 0,
      iconNode: <HeartIcon className="h-6 w-6 text-status-critical" />,
      indicators: computeEffectiveIndicators('optiheart', MODULE_ALL_INDICATORS.optiheart),
      interpretation:
        'Bas débit cardiaque (3.2 L/min) avec FEVG 35% — dysfonction systolique persistante malgré support inotrope. Bilan hydrique positif à surveiller.',
      interventions: [
        'Inotrope: Dobutamine 5 mcg/kg/min',
        'Vasopresseur: Noradrénaline 0.15 mcg/kg/min (en sevrage)',
        'Bilan hydrique: +500 mL sur 24h',
      ],
    },
    {
      key: 'optilungs',
      organValue: 'poumons',
      label: 'OptiLungs',
      score: patient.lungsScore || 0,
      iconNode: (
        <img
          src={lungsIcon}
          alt=""
          className="h-6 w-6"
          style={{
            filter:
              'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)',
          }}
        />
      ),
      indicators: computeEffectiveIndicators('optilungs', MODULE_ALL_INDICATORS.optilungs),
      interpretation: 'Échanges gazeux dans les cibles. Surveillance standard.',
      interventions: ['Ventilation mécanique en cours'],
    },
    {
      key: 'optirenal',
      organValue: 'renal',
      label: 'OptiRenal',
      score: patient.kidneyScore || 0,
      iconNode: (
        <img
          src={kidneyIcon}
          alt=""
          className="h-6 w-6"
          style={{
            filter:
              'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)',
          }}
        />
      ),
      indicators: computeEffectiveIndicators('optirenal', MODULE_ALL_INDICATORS.optirenal),
      interpretation: '',
      interventions: [],
    },
    {
      key: 'optigastro',
      organValue: 'gastro',
      label: 'OptiGastro',
      score: 0,
      iconNode: (
        <img
          src={intestineIcon}
          alt=""
          className="h-6 w-6"
          style={{
            filter:
              'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)',
          }}
        />
      ),
      indicators: computeEffectiveIndicators('optigastro', MODULE_ALL_INDICATORS.optigastro),
      interpretation: '',
      interventions: [],
    },
  ];

  // Modules affichés : score >= 1 (comportement automatique inchangé) OU au
  // moins un indicateur effectif (épinglé manuellement, même sans score).
  const failingModules = allModules
    .filter((m) => m.score >= 1 || m.indicators.length > 0)
    .sort((a, b) => b.score - a.score);

  // Aggregate all failing indicators across modules + abnormal vital signs
  // for physiopath chain matching.
  const allFailingIndicators = [
    ...allModules.flatMap((m) =>
      m.indicators.map((ind) => {
        // Comparaison "avant/maintenant" (dernière visite) retirée pour le
        // moment sur tous les modules — useLastViewed reste intact pour la
        // remettre facilement.
        return {
          label: ind.label,
          module: m.key,
          status: ind.status,
          trend: ind.trend,
          value: ind.value,
          unit: ind.unit,
          previousValue: undefined as number | null | undefined,
          changed: undefined as boolean | undefined,
        };
      }),
    ),
    // Abnormal vitals are mapped to the most relevant module so chains can match.
    ...vitalSigns
      .filter((v) => !isInRange(v.value, v.targetMin, v.targetMax))
      .map((v) => {
        const moduleByVital: Record<string, ModuleKey> = {
          FC: 'optiheart',
          TAM: 'optiheart',
          FR: 'optilungs',
          SPO2: 'optilungs',
          'T°': 'optiheart',
        };
        return {
          label: v.label === 'SPO2' ? 'SpO2' : v.label,
          module: moduleByVital[v.label] ?? 'optiheart',
          status: 'critical',
          value: v.value,
          unit: v.unit,
          previousValue: undefined as number | null | undefined,
          changed: undefined as boolean | undefined,
        };
      }),
  ];

  // Labels déjà affichés, par module — pour exclure ces indicateurs du
  // dropdown "ajouter" propre à chaque module.
  const alreadyShownByModule: Record<ModuleKey, Set<string>> = {
    optibrain: new Set(),
    optiheart: new Set(),
    optilungs: new Set(),
    optirenal: new Set(),
    optigastro: new Set(),
  };
  allModules.forEach((m) => {
    m.indicators.forEach((ind) => alreadyShownByModule[m.key].add(ind.label));
  });

  const toggleModule = (key: ModuleKey) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Une seule matrice, alimentée par les organes assemblés (auto ou manuel).
  const matrixRows = allFailingIndicators.filter((f) => selectedModules.has(f.module));

  // Indicateurs masqués manuellement, pour pouvoir les réafficher — un
  // masquage ne doit jamais être une suppression silencieuse permanente.
  const hiddenEntries = Object.entries(overrides)
    .filter(([, action]) => action === 'hide')
    .map(([key]) => {
      const [module, label] = key.split('|') as [ModuleKey, string];
      return { module, label };
    });

  const getStatusColor = (status: string) => {
    if (status === 'critical')
      return {
        text: 'text-status-critical',
        bg: 'bg-status-critical/10',
        border: 'border-status-critical/30',
        dot: 'bg-status-critical',
      };
    if (status === 'warning')
      return {
        text: 'text-status-warning',
        bg: 'bg-status-warning/10',
        border: 'border-status-warning/30',
        dot: 'bg-status-warning',
      };
    return {
      text: 'text-status-normal',
      bg: 'bg-status-normal/10',
      border: 'border-status-normal/30',
      dot: 'bg-status-normal',
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optistate" />

      <main className="container mx-auto px-6 pb-8 max-w-[1600px] space-y-6">
        {/* Vital signs presented as module-style metric cards (expanded on Optistate) */}
        <VitalSignsPanel defaultOpen />

        {/* Systèmes en alerte + Assembler les modules — un seul tout cohérent */}
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-semibold">Systèmes en alerte</CardTitle>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1.5',
                    matrixRows.length > 0
                      ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
                      : 'bg-status-normal/10 text-status-normal border-status-normal/30'
                  )}
                >
                  {matrixRows.length > 0 ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {matrixRows.length} indicateur{matrixRows.length > 1 ? 's' : ''} hors cible
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Dans les cibles
                    </>
                  )}
                </Badge>
              </div>
            </div>
            {hiddenEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-3 mt-3 border-t">
                <span>Masqués :</span>
                {hiddenEntries.map(({ module, label }) => (
                  <button
                    key={`${module}|${label}`}
                    type="button"
                    onClick={() => clearOverride(module, label)}
                    title="Réafficher cet indicateur"
                    className="inline-flex items-center gap-1 rounded-full border border-status-inactive/30 bg-status-inactive-bg text-status-inactive px-2 py-0.5 hover:brightness-95"
                  >
                    {MODULE_LABELS[module]} · {label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Systèmes assemblés : pré-cochés pour ceux en alerte, ajustables librement */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Systèmes assemblés — cliquez pour ajouter ou retirer
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => {
                  const isOn = selectedModules.has(key);
                  const isFailing = failingModules.some((m) => m.key === key);
                  return (
                    <div
                      key={key}
                      className={cn(
                        'flex items-center rounded-md border text-xs font-medium transition-all overflow-hidden',
                        isOn
                          ? 'bg-primary/15 border-primary ring-1 ring-primary'
                          : 'bg-card border-border hover:border-primary/50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleModule(key)}
                        className={cn(
                          'flex items-center gap-2 pl-3 pr-2 py-2',
                          isOn ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className="h-5 w-5 flex items-center justify-center">{MODULE_ICONS[key]}</span>
                        {MODULE_LABELS[key]}
                        {isFailing && <span className="h-1.5 w-1.5 rounded-full bg-status-critical" />}
                      </button>
                      <div className={cn('w-px self-stretch my-1.5', isOn ? 'bg-primary/30' : 'bg-border')} />
                      <ModuleIndicatorDropdown
                        moduleLabel={MODULE_LABELS[key]}
                        indicators={MODULE_ALL_INDICATORS[key]}
                        alreadyShown={alreadyShownByModule[key]}
                        onPick={(label) => setOverride(key, label, 'pin')}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Matrice unique : indicateurs des systèmes assemblés */}
            {selectedModules.size === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                Sélectionnez un ou plusieurs systèmes ci-dessus pour voir leurs indicateurs.
              </p>
            ) : matrixRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-status-normal mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucun indicateur hors cible dans les systèmes sélectionnés.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="font-medium px-2 py-1.5">Indicateur</th>
                      <th className="font-medium px-2 py-1.5">Système</th>
                      <th className="font-medium px-2 py-1.5">Évolution</th>
                      <th className="font-medium px-2 py-1.5">Statut</th>
                      <th className="font-medium px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((row, i) => {
                      const accent = getStatusColor(row.status);
                      const isPinned = getOverride(row.module, row.label) === 'pin';
                      const hasPrevious = row.previousValue !== undefined && row.previousValue !== null;
                      return (
                        <tr key={`${row.module}-${row.label}-${i}`} className={cn('border-t', accent.bg)}>
                          <td className="px-2 py-2 font-medium text-foreground">
                            {isPinned && <Pin className="inline h-3 w-3 mr-1 text-primary" />}
                            {row.label}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/${row.module}?patient=${encodeURIComponent(patientId)}`)}
                              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <span className={cn('h-1.5 w-1.5 rounded-full', accent.dot)} />
                              {MODULE_LABELS[row.module]}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              {hasPrevious && (
                                <>
                                  <span className="text-muted-foreground">{row.previousValue}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                                </>
                              )}
                              <span className="font-semibold text-foreground">
                                {row.value}
                                {row.unit ? ` ${row.unit}` : ''}
                              </span>
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] px-1.5 py-0', accent.bg, accent.border, accent.text)}
                            >
                              {row.status === 'critical' ? 'Critique' : row.status === 'warning' ? 'Alerte' : 'Normal'}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              aria-label={`Masquer ${row.label}`}
                              title="Masquer cet indicateur"
                              className="rounded-full p-1 hover:bg-foreground/10"
                              onClick={() => setOverride(row.module, row.label, 'hide')}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Optistate;
