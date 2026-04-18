import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePatient } from '@/hooks/usePatients';
import {
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { MetricRangeBar } from '@/components/MetricRangeBar';
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
import { PhysiopathChains } from '@/components/PhysiopathChains';

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

  const filterAbnormal = (targets: any[]): Indicator[] =>
    targets
      .filter((t) => t.status && t.status !== 'normal')
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
      indicators: filterAbnormal(brainMonitoringTargets),
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
      indicators: filterAbnormal(heartMonitoringTargets),
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
      indicators: filterAbnormal(lungMonitoringTargets),
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
      indicators: [],
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
      indicators: [],
      interpretation: '',
      interventions: [],
    },
  ];

  // Only failing modules (score >= 1) get displayed in detail
  const failingModules = allModules
    .filter((m) => m.score >= 1)
    .sort((a, b) => b.score - a.score);

  const failingCount = failingModules.length;

  // Aggregate all failing indicators across modules + abnormal vital signs
  // for physiopath chain matching.
  const allFailingIndicators = [
    ...allModules.flatMap((m) =>
      m.indicators.map((ind) => ({
        label: ind.label,
        module: m.key,
        status: ind.status,
        trend: ind.trend,
        value: ind.value,
        unit: ind.unit,
      })),
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
        };
      }),
  ];



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
      text: 'text-muted-foreground',
      bg: 'bg-muted',
      border: 'border-border',
      dot: 'bg-muted-foreground/40',
    };
  };

  const getModuleAccent = (score: number) => {
    if (score >= 3)
      return {
        bar: 'bg-status-critical',
        badge: 'bg-status-critical/15 text-status-critical border-status-critical/30',
        label: 'Critique',
      };
    if (score === 2)
      return {
        bar: 'bg-status-warning',
        badge: 'bg-status-warning/15 text-status-warning border-status-warning/30',
        label: 'Surveillance',
      };
    return {
      bar: 'bg-orange-400',
      badge:
        'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
      label: 'À surveiller',
    };
  };

  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5" />;
    if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optistate" />

      <main className="container mx-auto px-6 pb-8 max-w-[1600px] space-y-6">
        {/* SECTION 1: Vital signs */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Signes Vitaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              {vitalSigns.map((vital, index) => {
                const inRange = isInRange(vital.value, vital.targetMin, vital.targetMax);
                const valueColor = inRange ? 'text-foreground' : 'text-status-critical';
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {vital.label}
                    </div>
                    <div className={`text-4xl font-bold ${valueColor} mb-1`}>{vital.value}</div>
                    <div className="text-[11px] text-muted-foreground mb-3">{vital.unit}</div>
                    <MetricRangeBar
                      value={vital.value}
                      min={vital.min}
                      max={vital.max}
                      targetMin={vital.targetMin}
                      targetMax={vital.targetMax}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 1.5: Cross-system physiopath chains */}
        <PhysiopathChains
          failingIndicators={allFailingIndicators}
          onModuleClick={(mod) =>
            navigate(`/${mod}?patient=${encodeURIComponent(patientId)}`)
          }
        />

        {/* SECTION 2: Failing modules — clinical detail */}
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-semibold">Systèmes en alerte</CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  'gap-1.5',
                  failingCount > 0
                    ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
                    : 'bg-status-normal/10 text-status-normal border-status-normal/30'
                )}
              >
                {failingCount > 0 ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {failingCount} système{failingCount > 1 ? 's' : ''} en alerte
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Tous les systèmes dans les cibles
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {failingCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-status-normal mb-3" />
                <p className="text-sm text-muted-foreground max-w-md">
                  Aucun système ne présente d'indicateur hors cible. Continuez la surveillance
                  standard.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {failingModules.map((m) => {
                  const accent = getModuleAccent(m.score);
                  return (
                    <div
                      key={m.key}
                      className="relative rounded-lg border bg-card overflow-hidden"
                    >
                      {/* Severity bar */}
                      <div className={cn('absolute left-0 top-0 bottom-0 w-1', accent.bar)} />

                      <div className="pl-5 pr-4 py-4">
                        {/* Module header */}
                        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                              {m.iconNode}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-foreground">
                                  {m.label}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={cn('text-[10px] px-2 py-0', accent.badge)}
                                >
                                  {accent.label}
                                </Badge>
                              </div>
                              {m.interpretation && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                                  {m.interpretation}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1 shrink-0"
                            onClick={() =>
                              navigate(`/${m.key}?patient=${encodeURIComponent(patientId)}`)
                            }
                          >
                            Voir le module
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Indicators table — 2 columns wide */}
                          <div className="lg:col-span-2">
                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Indicateurs hors cible ({m.indicators.length})
                            </div>
                            {m.indicators.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">
                                Aucun indicateur hors cible enregistré.
                              </p>
                            ) : (
                              <div className="rounded-md border overflow-hidden">
                                <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b">
                                  <div>Indicateur</div>
                                  <div>Valeur</div>
                                  <div>Cible</div>
                                  <div className="text-right">Tendance</div>
                                </div>
                                {m.indicators.map((ind, i) => {
                                  const c = getStatusColor(ind.status);
                                  return (
                                    <div
                                      key={i}
                                      className={cn(
                                        'grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 px-3 py-2 text-xs items-center',
                                        i % 2 === 1 ? 'bg-muted/20' : 'bg-background'
                                      )}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={cn('h-1.5 w-1.5 rounded-full shrink-0', c.dot)}
                                        />
                                        <span className="font-medium text-foreground truncate">
                                          {ind.label}
                                        </span>
                                      </div>
                                      <div className={cn('font-semibold', c.text)}>
                                        {ind.value}
                                        {ind.unit ? (
                                          <span className="text-muted-foreground font-normal ml-1">
                                            {ind.unit}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="text-muted-foreground">{ind.target}</div>
                                      <div
                                        className={cn(
                                          'flex items-center justify-end',
                                          c.text
                                        )}
                                      >
                                        <TrendIcon trend={ind.trend} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Interventions actives */}
                          <div>
                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Interventions actives
                            </div>
                            {m.interventions.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">
                                Aucune intervention en cours.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {m.interventions.map((it, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-foreground"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                                    <span className="leading-snug">{it}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Optistate;
