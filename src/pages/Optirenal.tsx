import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatient } from '@/hooks/usePatients';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataLoadingOverlay } from '@/components/DataLoadingOverlay';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import { MetricRangeBar } from '@/components/MetricRangeBar';
import kidneyIcon from '@/assets/kidney-icon.svg';
import { TimeWindowSelector, TimeWindowValue } from '@/components/ui/TimeWindowSelector';
import {
  CollapsibleModuleCard,
  StatusIconCircle,
  CountCircle,
  ModuleStatus,
} from '@/components/CollapsibleModuleCard';
import { SelectableMetricTile, TileStatus } from '@/components/SelectableMetricTile';
import { OptimisationChart } from '@/components/OptimisationChart';
import { cn } from '@/lib/utils';

const OPT_CHART_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const STATUS_TEXT: Record<TileStatus, string> = {
  normal: 'text-foreground',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
};

interface RenalMetric {
  label: string;
  value: number;
  /** Valeur affichée si elle diffère de `value` (ex: signe +). */
  displayValue?: string;
  unit: string;
  /** Statut clinique fixé selon les seuils de l'équipe de néphrologie. */
  status: TileStatus;
  reference?: string;
  /** Bornes de la barre ; sans bornes, la tuile n'affiche pas de barre. */
  range?: { min: number; max: number; targetMin: number; targetMax: number };
  note?: string;
  help?: string;
}

interface RenalGroup {
  title: string;
  metrics: RenalMetric[];
}

// Données de démonstration, en attendant l'import des variables rénales.
const PATIENT_BASE_WEIGHT_KG = 20;

const dialysis = {
  modality: 'CVVHDF',
  start: '23/08 — 18:00 (J2)',
  duration: '36 h',
};

const lastUpdate = '14:32';

const rifleStages = [
  { letter: 'R', name: 'Risk', criteria: 'SCr ↑ ×1.5 ou DFG ↓ >25 %' },
  { letter: 'I', name: 'Injury', criteria: 'SCr ↑ ×2 ou DFG ↓ >50 %' },
  { letter: 'F', name: 'Failure', criteria: 'SCr ↑ ×3 ou DFG ↓ >75 %' },
  { letter: 'L', name: 'Loss', criteria: 'Perte de fonction rénale >4 sem.' },
  { letter: 'E', name: 'ESKD', criteria: 'Insuffisance rénale terminale >3 mois' },
];
const currentRifleStage = 'F';

const renalGroups: RenalGroup[] = [
  {
    title: 'Bilan entrée - sortie',
    metrics: [
      { label: 'Entrées', value: 1850, unit: 'mL/24h', status: 'normal' },
      { label: 'Sorties', value: 920, unit: 'mL/24h', status: 'normal' },
      {
        label: 'Bilan net',
        value: 930,
        displayValue: '+930',
        unit: 'mL',
        status: 'critical',
        reference: 'Cible : équilibré',
        range: { min: -1000, max: 1500, targetMin: -200, targetMax: 200 },
      },
      {
        label: 'Fluid overload',
        value: 12.5,
        unit: '%',
        status: 'critical',
        reference: 'Réf : < 10 %',
        range: { min: 0, max: 20, targetMin: 0, targetMax: 10 },
        help: `(Entrées − sorties cumulées) / poids de base × 100. Poids de base : ${PATIENT_BASE_WEIGHT_KG} kg.`,
      },
      {
        label: 'Poids actuel',
        value: 22.5,
        unit: 'kg',
        status: 'normal',
        note: 'Dernière pesée : 24/08 à 06:00',
      },
    ],
  },
  {
    title: 'Diurèse',
    metrics: [
      { label: 'Diurèse 1 h', value: 0.4, unit: 'mL/kg/h', status: 'critical', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
      { label: 'Diurèse 3 h', value: 0.5, unit: 'mL/kg/h', status: 'warning', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
      { label: 'Diurèse 6 h', value: 0.6, unit: 'mL/kg/h', status: 'warning', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
      { label: 'Diurèse 12 h', value: 0.7, unit: 'mL/kg/h', status: 'warning', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
    ],
  },
  {
    title: 'Marqueurs de filtration',
    metrics: [
      { label: 'Créatinine', value: 185, unit: 'µmol/L', status: 'critical', reference: 'Réf : 27–62', range: { min: 0, max: 250, targetMin: 27, targetMax: 62 } },
      { label: 'Urée', value: 18.2, unit: 'mmol/L', status: 'warning', reference: 'Réf : 2.5–6.5', range: { min: 0, max: 25, targetMin: 2.5, targetMax: 6.5 } },
      { label: 'DFG estimé', value: 28, unit: 'mL/min/1.73m²', status: 'critical', reference: 'Réf : > 90', range: { min: 0, max: 150, targetMin: 90, targetMax: 150 } },
      { label: 'Lactate', value: 3.8, unit: 'mmol/L', status: 'warning', reference: 'Réf : 0.5–2.0', range: { min: 0, max: 6, targetMin: 0.5, targetMax: 2 } },
    ],
  },
  {
    title: 'Électrolytes',
    metrics: [
      { label: 'Na+', value: 138, unit: 'mmol/L', status: 'normal', reference: 'Réf : 135–145', range: { min: 120, max: 160, targetMin: 135, targetMax: 145 } },
      { label: 'K+', value: 5.8, unit: 'mmol/L', status: 'critical', reference: 'Réf : 3.5–5.0', range: { min: 2.5, max: 7, targetMin: 3.5, targetMax: 5 } },
      { label: 'HCO₃-', value: 16, unit: 'mmol/L', status: 'warning', reference: 'Réf : 22–26', range: { min: 10, max: 35, targetMin: 22, targetMax: 26 } },
    ],
  },
];

const groupStatus = (metrics: RenalMetric[]): ModuleStatus => {
  if (metrics.some((m) => m.status === 'critical')) return 'critical';
  if (metrics.some((m) => m.status === 'warning')) return 'warning';
  return 'inactive';
};

const RenalMetricTile = ({ metric }: { metric: RenalMetric }) => (
  <div className="flex flex-col items-center">
    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide text-center">
      {metric.label}
      {metric.help && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-60 normal-case">
            {metric.help}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    <div className="flex items-baseline gap-1 mb-2">
      <div className={cn('text-2xl sm:text-4xl font-bold', STATUS_TEXT[metric.status])}>
        {metric.displayValue ?? metric.value}
      </div>
      <div className="text-[10px] text-muted-foreground">{metric.unit}</div>
    </div>
    {metric.range && (
      <MetricRangeBar
        value={metric.value}
        min={metric.range.min}
        max={metric.range.max}
        targetMin={metric.range.targetMin}
        targetMax={metric.range.targetMax}
      />
    )}
    {(metric.reference || metric.note) && (
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">
        {metric.reference ?? metric.note}
      </div>
    )}
  </div>
);

const Optirenal = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const { data: patient, isLoading } = usePatient(patientId);

  const [optimisationExpanded, setOptimisationExpanded] = useState(true);
  const [selectedRenalOptIndicators, setSelectedRenalOptIndicators] = useState<string[]>([]);
  const [optChartTimeRange, setOptChartTimeRange] = useState<string>('24h');
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({
    'Bilan entrée - sortie': true,
    'Diurèse': true,
    'Marqueurs de filtration': true,
    'Électrolytes': true,
    'Classification RIFLE': false,
  });

  const showPatientNotFound = !patient && !isLoading;

  const renalOptimisationMetrics: Array<{
    label: string;
    displayValue: string;
    unit: string;
    status: TileStatus;
    criticalLabel: string;
    criticalColor: string;
  }> = [
    {
      label: 'Bilan net',
      displayValue: '+930',
      unit: 'mL',
      status: 'critical',
      criticalLabel: 'Entrées 1850 / Sorties 920',
      criticalColor: 'text-status-critical',
    },
    {
      label: 'Fluid overload',
      displayValue: '12.5',
      unit: '%',
      status: 'critical',
      criticalLabel: 'Cible < 10 %',
      criticalColor: 'text-status-critical',
    },
    {
      label: 'Diurèse',
      displayValue: '0.4',
      unit: 'mL/kg/h',
      status: 'critical',
      criticalLabel: 'Dernière heure • cible ≥ 0.5',
      criticalColor: 'text-status-critical',
    },
    {
      label: 'DFG estimé',
      displayValue: '28',
      unit: 'mL/min/1.73m²',
      status: 'critical',
      criticalLabel: 'Réf > 90',
      criticalColor: 'text-status-critical',
    },
  ];

  const optTargetZones: Record<string, { min: number; max: number }> = {
    'Bilan net': { min: -200, max: 200 },
    'Fluid overload': { min: 0, max: 10 },
    'Diurèse': { min: 0.5, max: 2 },
    'DFG estimé': { min: 90, max: 150 },
  };

  const colorFor = (label: string) => {
    const index = selectedRenalOptIndicators.indexOf(label);
    if (index === -1) return '#9ca3af';
    return OPT_CHART_COLORS[index % OPT_CHART_COLORS.length];
  };

  const renalOptChartData = useMemo(() => {
    if (selectedRenalOptIndicators.length === 0) return [];
    const hoursMap: Record<string, number> = { '24h': 24, stay: 96 };
    const hours = hoursMap[optChartTimeRange] || 24;
    const points = Math.min(hours * 4, 200);
    const now = Date.now();

    const generators: Record<string, (t: number, progress: number) => number> = {
      'Bilan net': (_t, p) => 200 + p * 730 + Math.random() * 60,
      'Fluid overload': (_t, p) => 8 + p * 4.5 + Math.random() * 0.4,
      'Diurèse': (t) => 0.6 + Math.sin(t * 0.5) * 0.15 + Math.random() * 0.1,
      'DFG estimé': (_t, p) => 45 - p * 17 + Math.random() * 3,
    };

    return Array.from({ length: points }, (_, i) => {
      const timestamp = now - (points - i) * ((hours * 3600000) / points);
      const time = new Date(timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const progress = i / points;
      const t = progress * Math.PI * 4;

      const dataPoint: Record<string, string | number> = { time: timeStr, timestamp };
      selectedRenalOptIndicators.forEach((label) => {
        const gen = generators[label];
        if (gen) dataPoint[label] = Math.round(gen(t, progress) * 100) / 100;
      });
      return dataPoint;
    });
  }, [optChartTimeRange, selectedRenalOptIndicators]);

  const toggleGroup = (title: string) =>
    setGroupsOpen((prev) => ({ ...prev, [title]: !prev[title] }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8 space-y-4">
          <DataLoadingOverlay isLoading={true} label="Chargement du patient..." variant="skeleton">
            <div />
          </DataLoadingOverlay>
        </div>
      </div>
    );
  }

  if (showPatientNotFound) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p className="text-foreground">Patient non trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optirenal" />

      <main className="container mx-auto px-4 sm:px-6 pb-8 max-w-[1600px] space-y-6">
        <VitalSignsPanel />

        <CollapsibleModuleCard
          expanded={optimisationExpanded}
          onToggle={() => setOptimisationExpanded((p) => !p)}
          headerIcon={
            <StatusIconCircle status="critical">
              <img
                src={kidneyIcon}
                alt="kidney"
                className="h-6 w-6 sm:h-8 sm:w-8"
                style={{
                  filter:
                    'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)',
                }}
              />
            </StatusIconCircle>
          }
          title="Optimisation rénale"
          subtitle={
            <>
              <span className="font-semibold text-status-critical">AKI — Stade F (RIFLE)</span> • Dialyse
              en cours • Dernière MAJ : {lastUpdate}
            </>
          }
        >
          <div className="mt-4 rounded-lg border border-status-critical/40 bg-status-critical-bg/30 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
            <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-status-critical animate-pulse" />
              <span className="text-sm font-semibold text-status-critical uppercase tracking-wide">
                Dialyse en cours
              </span>
            </div>
            <div>
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Modalité</div>
              <div className="text-sm font-semibold text-foreground">{dialysis.modality}</div>
            </div>
            <div>
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Début</div>
              <div className="text-sm font-semibold text-foreground">{dialysis.start}</div>
            </div>
            <div>
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Durée</div>
              <div className="text-sm font-semibold text-foreground">{dialysis.duration}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6 pt-4">
            {renalOptimisationMetrics.map((metric) => (
              <SelectableMetricTile
                key={metric.label}
                label={metric.label}
                displayValue={metric.displayValue}
                unit={metric.unit}
                status={metric.status}
                criticalLabel={metric.criticalLabel}
                criticalColor={metric.criticalColor}
                isSelected={selectedRenalOptIndicators.includes(metric.label)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRenalOptIndicators((prev) =>
                    prev.includes(metric.label) ? [] : [metric.label]
                  );
                }}
              />
            ))}
          </div>

          {selectedRenalOptIndicators.length > 0 && (
            <div className="border-t border-border pt-4 mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">Évolution temporelle</div>
                <TimeWindowSelector
                  value={optChartTimeRange as TimeWindowValue}
                  onChange={(v) => setOptChartTimeRange(v)}
                  includeStay={true}
                  size="sm"
                  variant="compact"
                />
              </div>
              <OptimisationChart
                data={renalOptChartData}
                series={selectedRenalOptIndicators.map((label) => ({
                  label,
                  color: colorFor(label),
                  targetZone: optTargetZones[label],
                }))}
              />
            </div>
          )}
        </CollapsibleModuleCard>

        <Card className="bg-card shadow-sm">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Monitorage rénal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renalGroups.map((group) => {
              const abnormal = group.metrics.filter((m) => m.status !== 'normal').length;
              return (
                <CollapsibleModuleCard
                  key={group.title}
                  variant="nested"
                  expanded={groupsOpen[group.title] ?? false}
                  onToggle={() => toggleGroup(group.title)}
                  headerIcon={
                    <CountCircle
                      count={abnormal}
                      total={group.metrics.length}
                      status={groupStatus(group.metrics)}
                    />
                  }
                  title={group.title}
                  subtitle={
                    abnormal === 0
                      ? 'Tous les paramètres dans les cibles'
                      : `${abnormal} paramètre${abnormal > 1 ? 's' : ''} hors cible`
                  }
                  contentClassName="px-3 sm:px-6 pb-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-8 pt-4 border-t">
                    {group.metrics.map((metric) => (
                      <RenalMetricTile key={metric.label} metric={metric} />
                    ))}
                  </div>
                </CollapsibleModuleCard>
              );
            })}

            <CollapsibleModuleCard
              variant="nested"
              expanded={groupsOpen['Classification RIFLE'] ?? false}
              onToggle={() => toggleGroup('Classification RIFLE')}
              headerIcon={
                <StatusIconCircle status="critical">
                  <span className="text-lg sm:text-xl">{currentRifleStage}</span>
                </StatusIconCircle>
              }
              title="Classification RIFLE"
              subtitle={
                <>
                  Stade actuel :{' '}
                  <span className="font-semibold text-status-critical">
                    {rifleStages.find((s) => s.letter === currentRifleStage)?.name}
                  </span>
                </>
              }
              contentClassName="px-3 sm:px-6 pb-4"
            >
              <div className="space-y-2 pt-4 border-t">
                {rifleStages.map((stage) => {
                  const active = stage.letter === currentRifleStage;
                  return (
                    <div
                      key={stage.letter}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 border',
                        active
                          ? 'border-status-critical/40 bg-status-critical-bg/30'
                          : 'border-transparent bg-muted/40'
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold shrink-0',
                          active ? 'bg-status-critical text-white' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {stage.letter}
                      </div>
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          active ? 'text-status-critical' : 'text-foreground'
                        )}
                      >
                        {stage.name}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">{stage.criteria}</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleModuleCard>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optirenal;
