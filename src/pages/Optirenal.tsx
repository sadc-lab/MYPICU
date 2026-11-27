import { useSearchParams } from 'react-router-dom';
import { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Droplets, Activity, Gauge, Scale } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, ReferenceArea, Brush } from 'recharts';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatient } from '@/hooks/usePatients';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataLoadingOverlay } from '@/components/DataLoadingOverlay';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import { MetricRangeBar } from '@/components/MetricRangeBar';
import { ChartZoomControls } from '@/components/ChartZoomControls';
import { MonitoringPeriodControl } from '@/components/MonitoringPeriodControl';
import type { TileStatus } from '@/components/SelectableMetricTile';
import { ChartTimeRangeProvider } from '@/contexts/ChartTimeRangeContext';
import { useTimeRange } from '@/hooks/useTimeRange';
import { useSharedTimeWindow } from '@/hooks/useSharedTimeWindow';
import { useYAxisZoom } from '@/hooks/useYAxisZoom';
import { BRUSH_TOUCH_WIDTH, renderWideTouchTraveller } from '@/lib/chartBrushTraveller';
import { cn } from '@/lib/utils';
import { tr } from '@/i18n';
import { term } from '@/i18n/terms';

// Même palette que le monitorage d'Optibrain : une seule teinte bleue, les
// premiers paliers étant les plus contrastés entre eux.
const CHART_COLORS = ['#1e3a8a', '#93c5fd', '#2563eb', '#60a5fa', '#1d4ed8', '#3b82f6'];

const STATUS_TEXT: Record<TileStatus, string> = {
  normal: 'text-foreground',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
};

const STATUS_BG: Record<TileStatus, string> = {
  normal: 'bg-muted/30',
  warning: 'bg-status-warning/5',
  critical: 'bg-status-critical/5',
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

const lastUpdate = '14:32';

const renalGroups: RenalGroup[] = [
  {
    get title() { return tr('Bilan entrée - sortie', 'Intake - output balance'); },
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
        get help() {
          return tr(
            `(Entrées − sorties cumulées) / poids de base × 100. Poids de base : ${PATIENT_BASE_WEIGHT_KG} kg.`,
            `(Cumulative intake − output) / baseline weight × 100. Baseline weight: ${PATIENT_BASE_WEIGHT_KG} kg.`,
          );
        },
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
    get title() { return tr('Diurèse', 'Urine output'); },
    metrics: [
      { label: 'Diurèse 1 h', value: 0.4, unit: 'mL/kg/h', status: 'critical', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
      { label: 'Diurèse 3 h', value: 0.5, unit: 'mL/kg/h', status: 'warning', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
      { label: 'Diurèse 6 h', value: 0.6, unit: 'mL/kg/h', status: 'warning', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
      { label: 'Diurèse 12 h', value: 0.7, unit: 'mL/kg/h', status: 'warning', reference: 'Cible ≥ 0.5', range: { min: 0, max: 2, targetMin: 0.5, targetMax: 2 } },
    ],
  },
  {
    get title() { return tr('Marqueurs de filtration', 'Filtration markers'); },
    metrics: [
      { label: 'Créatinine', value: 185, unit: 'µmol/L', status: 'critical', reference: 'Réf : 27–62', range: { min: 0, max: 250, targetMin: 27, targetMax: 62 } },
      { label: 'Urée', value: 18.2, unit: 'mmol/L', status: 'warning', reference: 'Réf : 2.5–6.5', range: { min: 0, max: 25, targetMin: 2.5, targetMax: 6.5 } },
      { label: 'DFG estimé', value: 28, unit: 'mL/min/1.73m²', status: 'critical', reference: 'Réf : > 90', range: { min: 0, max: 150, targetMin: 90, targetMax: 150 } },
      { label: 'Lactate', value: 3.8, unit: 'mmol/L', status: 'warning', reference: 'Réf : 0.5–2.0', range: { min: 0, max: 6, targetMin: 0.5, targetMax: 2 } },
    ],
  },
  {
    get title() { return tr('Électrolytes', 'Electrolytes'); },
    metrics: [
      { label: 'Na+', value: 138, unit: 'mmol/L', status: 'normal', reference: 'Réf : 135–145', range: { min: 120, max: 160, targetMin: 135, targetMax: 145 } },
      { label: 'K+', value: 5.8, unit: 'mmol/L', status: 'critical', reference: 'Réf : 3.5–5.0', range: { min: 2.5, max: 7, targetMin: 3.5, targetMax: 5 } },
      { label: 'HCO₃-', value: 16, unit: 'mmol/L', status: 'warning', reference: 'Réf : 22–26', range: { min: 10, max: 35, targetMin: 22, targetMax: 26 } },
    ],
  },
];

const STATUS_DOT: Record<TileStatus, string> = {
  normal: 'bg-status-normal',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical',
};

const statusLabel = (status: TileStatus): string =>
  ({
    normal: tr('Dans la cible', 'On target'),
    warning: tr('À surveiller', 'To watch'),
    critical: tr('Hors cible', 'Off target'),
  })[status];

// Références et notes de démonstration : mêmes gabarits, traduits à l'affichage.
const refText = (s?: string): string | undefined =>
  s === undefined
    ? s
    : tr(
        s,
        s
          .replace(/^Cible : équilibré$/, 'Target: balanced')
          .replace(/^Réf : /, 'Ref: ')
          .replace(/^Cible /, 'Target ')
          .replace(/^Dernière pesée : (.+) à (.+)$/, 'Last weighing: $1 at $2'),
      );

const allMonitoringMetrics = renalGroups.flatMap((g) => g.metrics);


// Tuiles d'optimisation : un clic ouvre le détail partagé (RenalDetailDialog),
// comme les tuiles d'Optibrain.
const getRenalOptimisationMetrics = (): Array<{
  label: string;
  displayValue: string;
  unit: string;
  status: TileStatus;
  detail: string;
}> => [
  {
    label: 'Bilan net',
    displayValue: '+930',
    unit: 'mL',
    status: 'critical',
    detail: tr('Entrées 1850 / Sorties 920', 'Intake 1850 / Output 920'),
  },
  {
    label: 'Fluid overload',
    displayValue: '12.5',
    unit: '%',
    status: 'critical',
    detail: tr('Cible < 10 %', 'Target < 10%'),
  },
  {
    label: 'Diurèse',
    displayValue: '0.4',
    unit: 'mL/kg/h',
    status: 'critical',
    detail: tr('Dernière heure • cible ≥ 0.5', 'Last hour • target ≥ 0.5'),
  },
  {
    label: 'DFG estimé',
    displayValue: '28',
    unit: 'mL/min/1.73m²',
    status: 'critical',
    detail: tr('Réf > 90', 'Ref > 90'),
  },
];

const TONE_BG: Record<TileStatus, string> = {
  normal: 'bg-status-normal/5 border-status-normal/20',
  warning: 'bg-status-warning/5 border-status-warning/20',
  critical: 'bg-status-critical/5 border-status-critical/20',
};

const metricByLabel = (label: string) => allMonitoringMetrics.find((m) => m.label === label);

// Détail partagé des 4 tuiles d'optimisation, comme le pop-up d'Optibrain :
// chaque section reprend la valeur, sa cible et ce qui la compose, et renvoie
// vers le graphique de monitorage avec les indicateurs utiles.
const RenalDetailDialog = ({
  open,
  onClose,
  onShowInChart,
}: {
  /** Libellé de la tuile cliquée (section mise en évidence), ou null si fermé. */
  open: string | null;
  onClose: () => void;
  onShowInChart: (labels: string[]) => void;
}) => {
  const sections: Array<{
    key: string;
    icon: typeof Scale;
    title: string;
    main: string;
    chart: string[];
    details: string[];
    explanation?: string;
  }> = [
    {
      key: 'Bilan net',
      icon: Scale,
      title: tr('Bilan net — entrées moins sorties', 'Net balance — intake minus output'),
      main: 'Bilan net',
      chart: ['Bilan net', 'Entrées', 'Sorties'],
      details: ['Entrées', 'Sorties'],
    },
    {
      key: 'Fluid overload',
      icon: Droplets,
      title: tr('Surcharge hydrique (fluid overload)', 'Fluid overload'),
      main: 'Fluid overload',
      chart: ['Fluid overload', 'Poids actuel'],
      details: ['Poids actuel'],
      explanation: metricByLabel('Fluid overload')?.help,
    },
    {
      key: 'Diurèse',
      icon: Activity,
      title: tr('Diurèse — dernière heure', 'Urine output — last hour'),
      main: 'Diurèse 1 h',
      chart: ['Diurèse 1 h', 'Diurèse 6 h', 'Diurèse 12 h'],
      details: ['Diurèse 3 h', 'Diurèse 6 h', 'Diurèse 12 h'],
    },
    {
      key: 'DFG estimé',
      icon: Gauge,
      title: tr('Filtration glomérulaire estimée', 'Estimated glomerular filtration'),
      main: 'DFG estimé',
      chart: ['DFG estimé', 'Créatinine', 'Urée'],
      details: ['Créatinine', 'Urée'],
    },
  ];

  return (
    <Dialog open={open !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('Optimisation rénale', 'Renal optimisation')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {sections.map((section) => {
            const main = metricByLabel(section.main);
            if (!main) return null;
            const Icon = section.icon;
            return (
              <div
                key={section.key}
                role="button"
                tabIndex={0}
                title={tr('Voir dans le graphique de monitorage', 'Show in the monitoring chart')}
                onClick={() => onShowInChart(section.chart)}
                onKeyDown={(e) => e.key === 'Enter' && onShowInChart(section.chart)}
                className={cn(
                  'rounded-lg border p-4 cursor-pointer transition-colors hover:brightness-95',
                  TONE_BG[main.status],
                  open === section.key && 'ring-2 ring-primary',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{tr('Voir dans le graphique →', 'View in chart →')}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={cn('text-xl font-bold tabular-nums', STATUS_TEXT[main.status])}>
                    {main.displayValue ?? main.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{main.unit}</span>
                  <span className="text-xs text-muted-foreground">· {statusLabel(main.status)}</span>
                </div>
                {main.reference && <p className="text-xs text-muted-foreground mt-0.5">{refText(main.reference)}</p>}
                {main.range && (
                  <div className="mt-2">
                    <MetricRangeBar
                      value={main.value}
                      min={main.range.min}
                      max={main.range.max}
                      targetMin={main.range.targetMin}
                      targetMax={main.range.targetMax}
                      unit={main.unit}
                      maxWidth="100%"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                  {section.details.map((label) => {
                    const m = metricByLabel(label);
                    if (!m) return null;
                    return (
                      <div key={label} className="flex items-center gap-1.5 text-[11px]">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[m.status])} />
                        <span className="text-muted-foreground">{term(m.label)}</span>
                        <span className={cn('font-medium tabular-nums', STATUS_TEXT[m.status])}>
                          {m.displayValue ?? m.value} {m.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {section.explanation && <p className="text-[11px] text-muted-foreground mt-2">{section.explanation}</p>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Optirenal = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const { data: patient, isLoading } = usePatient(patientId);
  const { timeRange, setTimeRange } = useTimeRange();

  const [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [showTargetZones, setShowTargetZones] = useState(true);
  const [monitoringEditing, setMonitoringEditing] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const showPatientNotFound = !patient && !isLoading;

  const scrollToChart = () =>
    setTimeout(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

  // Depuis le détail : remplace la sélection du graphique par ces indicateurs.
  const openIndicatorsInChart = (labels: string[]) => {
    setDetailOpen(null);
    setSelectedIndicators(labels.slice(0, 3));
    scrollToChart();
  };

  const toggleIndicator = (label: string) => {
    setSelectedIndicators((prev) => {
      if (prev.includes(label)) return prev.filter((l) => l !== label);
      if (prev.length >= 3) {
        toast.warning(tr('Maximum 3 indicateurs', 'Maximum 3 indicators'), {
          description: tr('Désélectionnez un indicateur pour en ajouter un nouveau.', 'Deselect an indicator to add a new one.'),
        });
        return prev;
      }
      return [...prev, label];
    });
    scrollToChart();
  };

  // Séries de démonstration pour tous les indicateurs, calculées une fois par
  // période : chaque indicateur évolue vers sa valeur actuelle. La variation est
  // déterministe pour que la courbe ne change pas quand on (dé)sélectionne un
  // indicateur ou qu'on ajuste la plage sur le graphique.
  const chartData = useMemo(() => {
    const hours = timeRange === 'stay' ? 96 : 24;
    const points = Math.min(hours * 4, 200);
    const now = Date.now();

    return Array.from({ length: points }, (_, i) => {
      const timestamp = now - (points - 1 - i) * ((hours * 3600000) / points);
      const time = new Date(timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const progress = i / (points - 1);

      const dataPoint: Record<string, string | number> = { time: timeStr, timestamp };
      allMonitoringMetrics.forEach((metric, m) => {
        const drift = metric.value * (0.85 + 0.15 * progress);
        const wave = Math.sin(i * 0.35 + m * 1.7) * Math.abs(metric.value) * 0.03;
        dataPoint[metric.label] = Math.round((drift + wave) * 100) / 100;
      });
      return dataPoint;
    });
  }, [timeRange]);

  // Plage de temps choisie sur le graphique (mode édition), comme dans Optibrain.
  const monitoringTimeWindow = useSharedTimeWindow(chartData, (d) => d.timestamp as number);

  const monitoringAutoYDomain = useMemo((): [number, number] => {
    const values: number[] = [];
    for (const point of monitoringTimeWindow.visibleData) {
      for (const label of selectedIndicators) {
        const v = point[label];
        if (typeof v === 'number') values.push(v);
      }
    }
    if (values.length === 0) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Pas de 5 comme Optibrain, ou de 0,5 pour les petites valeurs (diurèse).
    const step = max - min < 5 ? 0.5 : 5;
    return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
  }, [monitoringTimeWindow.visibleData, selectedIndicators]);
  const monitoringZoom = useYAxisZoom(monitoringAutoYDomain);

  const getIndicatorColor = (label: string) => {
    const index = selectedIndicators.indexOf(label);
    if (index === -1) return '#9ca3af';
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8 space-y-4">
          <DataLoadingOverlay isLoading={true} label={tr("Chargement du patient...", "Loading patient...")} variant="skeleton">
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
          <p className="text-foreground">{tr("Patient non trouvé", "Patient not found")}</p>
        </div>
      </div>
    );
  }

  const renalOptimisationMetrics = getRenalOptimisationMetrics();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optirenal" />

      <main className="container mx-auto px-4 sm:px-6 pb-8 max-w-[1600px]">
        <ChartTimeRangeProvider>
        <div className="mb-6">
          <VitalSignsPanel />
        </div>

        <Card className="bg-card shadow-sm mb-6">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg">
                  {tr('Adhérence & Monitorage', 'Adherence & Monitoring')} {timeRange === 'stay' ? tr('sur le séjour', 'over the stay') : tr(`sur ${timeRange}`, `over ${timeRange}`)}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold text-status-critical">{tr('AKI — Stade F (RIFLE)', 'AKI — Stage F (RIFLE)')}</span> • {tr('Dernière MAJ :', 'Last update:')} {lastUpdate}
                </p>
              </div>
              <MonitoringPeriodControl
                timeWindow={monitoringTimeWindow}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                isEditing={monitoringEditing}
                onToggleEditing={() => setMonitoringEditing((v) => !v)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {renalOptimisationMetrics.map((metric) => (
                <div
                  key={metric.label}
                  role="button"
                  tabIndex={0}
                  title={tr('Voir le détail', 'Show details')}
                  className={cn(
                    'flex flex-col items-center cursor-pointer p-2 sm:p-2.5 rounded-lg transition-all border border-transparent hover:border-border hover:shadow-sm',
                    STATUS_BG[metric.status],
                  )}
                  onClick={() => setDetailOpen(metric.label)}
                  onKeyDown={(e) => e.key === 'Enter' && setDetailOpen(metric.label)}
                >
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider text-center">
                    {term(metric.label)}
                  </div>
                  <div className="flex items-baseline gap-1 justify-center">
                    <div className={cn('text-base sm:text-xl font-bold tabular-nums leading-tight text-center', STATUS_TEXT[metric.status])}>
                      {metric.displayValue}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{metric.unit}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 text-center">{metric.detail}</div>
                </div>
              ))}
            </div>

            <RenalDetailDialog
              open={detailOpen}
              onClose={() => setDetailOpen(null)}
              onShowInChart={openIndicatorsInChart}
            />

            {/* Graphique de monitorage */}
            <Card ref={chartRef} className="border-2 border-border">
              <CardHeader className="px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  <CardTitle className="text-sm sm:text-lg">
                    {timeRange === 'stay'
                      ? tr('Monitorage des cibles recommandées (Séjour)', 'Recommended target monitoring (Stay)')
                      : tr(`Monitorage des cibles recommandées (${timeRange.toUpperCase()})`, `Recommended target monitoring (${timeRange.toUpperCase()})`)}
                  </CardTitle>
                  <label className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTargetZones}
                      onChange={(e) => setShowTargetZones(e.target.checked)}
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="hidden sm:inline">{tr("Zones cibles", "Target zones")}</span>
                    <span className="sm:hidden">{tr("Cibles", "Targets")}</span>
                  </label>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 pb-4">
                  {allMonitoringMetrics.map((metric) => {
                    const isSelected = selectedIndicators.includes(metric.label);
                    return (
                      <div
                        key={metric.label}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all border-2',
                          isSelected ? 'bg-card shadow-sm' : 'border-transparent hover:bg-muted/50',
                        )}
                        style={isSelected ? { borderColor: getIndicatorColor(metric.label) } : undefined}
                        onClick={() => toggleIndicator(metric.label)}
                      >
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <div className={cn('w-3 h-3 rounded-full mt-1 shrink-0 cursor-help', STATUS_DOT[metric.status])} />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-60">
                            <div className="font-semibold">{statusLabel(metric.status)}</div>
                            {metric.help && <div className="text-muted-foreground mt-1">{metric.help}</div>}
                          </TooltipContent>
                        </Tooltip>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {term(metric.label)} :{' '}
                            <span className={STATUS_TEXT[metric.status]}>{metric.displayValue ?? metric.value}</span>{' '}
                            <span className="text-xs text-muted-foreground">{metric.unit}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{refText(metric.reference ?? metric.note)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={selectedIndicators.length === 0 ? 'h-24 sm:h-32' : 'h-[250px] sm:h-[300px]'}>
                  {selectedIndicators.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground text-xs sm:text-base text-center px-2">
                        {tr('Sélectionnez des indicateurs ci-dessus pour afficher leur évolution', 'Select indicators above to show their trend')}
                      </p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <ChartZoomControls
                        zoom={monitoringZoom}
                        isEditing={monitoringEditing}
                        onToggleEditing={() => setMonitoringEditing((v) => !v)}
                        hideToggle
                      />
                      <div
                        className={cn(
                          'flex-1 min-h-0 rounded-lg transition-colors',
                          monitoringEditing && 'border-2 border-primary/60 bg-primary/5 p-2',
                        )}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monitoringEditing ? chartData : monitoringTimeWindow.visibleData}>
                            {showTargetZones &&
                              selectedIndicators.map((label) => {
                                const range = allMonitoringMetrics.find((m) => m.label === label)?.range;
                                if (!range) return null;
                                const color = getIndicatorColor(label);
                                return (
                                  <ReferenceArea
                                    key={`zone-${label}`}
                                    y1={range.targetMin}
                                    y2={range.targetMax}
                                    fill={color}
                                    fillOpacity={0.08}
                                    stroke={color}
                                    strokeOpacity={0.3}
                                    strokeDasharray="4 2"
                                  />
                                );
                              })}
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 11 }}
                              className="text-muted-foreground"
                              stroke="hsl(var(--muted-foreground))"
                              tickLine={false}
                            />
                            <YAxis
                              domain={monitoringZoom.yDomain}
                              allowDataOverflow
                              tick={{ fontSize: 11 }}
                              className="text-muted-foreground"
                              stroke="hsl(var(--muted-foreground))"
                              tickLine={false}
                              axisLine={false}
                            />
                            <ChartTooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--popover))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                padding: '12px',
                                color: 'hsl(var(--popover-foreground))',
                              }}
                              labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                              formatter={(value: number, name: string) => {
                                const unit = allMonitoringMetrics.find((m) => m.label === name)?.unit ?? '';
                                return [
                                  <span key={name} style={{ color: getIndicatorColor(name), fontWeight: 600 }}>
                                    {term(name)}: {value.toFixed(1)} {unit}
                                  </span>,
                                  null,
                                ];
                              }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                              iconType="plainline"
                              formatter={(value: string) => (
                                <span style={{ color: getIndicatorColor(value), fontWeight: 500 }}>{term(value)}</span>
                              )}
                            />
                            {selectedIndicators.map((label) => {
                              const color = getIndicatorColor(label);
                              return (
                                <Line
                                  key={label}
                                  type="monotone"
                                  dataKey={label}
                                  stroke={color}
                                  strokeWidth={2.5}
                                  dot={false}
                                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: color }}
                                  connectNulls={false}
                                />
                              );
                            })}
                            {monitoringEditing && (
                              <Brush
                                dataKey="time"
                                height={24}
                                stroke="hsl(var(--primary))"
                                travellerWidth={BRUSH_TOUCH_WIDTH}
                                traveller={renderWideTouchTraveller}
                                startIndex={monitoringTimeWindow.startIndex}
                                endIndex={monitoringTimeWindow.endIndex}
                                onChange={monitoringTimeWindow.onBrushChange}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
        </ChartTimeRangeProvider>
      </main>
    </div>
  );
};

export default Optirenal;
